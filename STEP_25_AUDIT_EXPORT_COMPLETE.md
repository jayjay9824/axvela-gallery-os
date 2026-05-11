# STEP 25 — Audit Log Export (완료)

STEP 20~23에서 완성된 Audit Log를 외부로 내보내는 export layer 추가.
**rule_4 Document Trust Layer의 최종 출력 단계**.

> 외부 라이브러리 0개 추가 · 백엔드 0줄 · 외부 API 호출 0줄.
> 단일 작품 (AuditLogDrawer) + 갤러리 전체 (GlobalAuditDrawer) 양쪽에서 사용 가능.

핵심 결정:
- **외부 PDF 라이브러리 추가 안 함** — `window.open()` + `window.print()` 활용. 새 창에 스타일된 HTML 리포트를 열고 자동으로 인쇄 다이얼로그를 띄워 사용자가 "PDF로 저장" 선택. jsPDF / pdfmake 등 0개. 출력 품질은 브라우저 native PDF로 일관 — 한글 폰트 / 페이지네이션 / 인쇄 미리보기 모두 OS 처리.
- **JSON / CSV는 표준 Blob + `URL.createObjectURL()`** — `<a download>` 클릭 트리거. UTF-8 BOM 포함 (Excel 한글 보존), CRLF 라인 종결 (RFC 4180).
- **데이터 출처 보존** — STEP 20 `ClassifiedAuditEvent` (domain / actorType / emphasis / version / chainHint) + STEP 21 chain summary + STEP 23 cross-artwork artwork label을 export payload에 모두 포함. raw `TimelineEvent` 필드도 보존.
- **공유 컴포넌트** — `AuditExportBar`. AuditLogDrawer + GlobalAuditDrawer 양쪽이 import.
- **사용자 spec 문구 그대로** — "감사 로그 내보내기" / "내부 기록 기반 Audit Report입니다." / "법적/외부 제출 시 참고용으로 사용 가능합니다." / 금지 표현 ("공식 증명서" / "법적 효력 보장") 미사용.
- **Filtered 결과만 export** — drawer에서 적용된 4-axis 필터 결과를 export. "현재 보고 있는 것을 그대로 내보내기" 직관적 흐름.

---

## 1. 현재 코드 분석

**STEP 25 진입 시점 (v25 baseline):**

| 항목 | 진입 시점 | STEP 25 필요 |
|---|---|---|
| AuditLogDrawer | 단일 작품 view + 2축 필터 + 카드 | export bar 추가 |
| GlobalAuditDrawer | 갤러리 전체 view + 4축 필터 + 카드 | export bar 추가 |
| ClassifiedAuditEvent (STEP 20) | domain / actorType / emphasis / version / chainHint | export payload 입력 |
| audit-navigation chain (STEP 21) | drawer-side chain detail builder | export 시 chain summary 한 줄 압축 |
| Artwork label (STEP 23) | cross-artwork rib | CSV / PDF / JSON에 작품 식별자로 사용 |
| Export 기능 | 부재 | 신규 |
| PDF 라이브러리 | 부재 | 추가 안 함 (print API 활용) |

**의존 관계:**
- `audit-export.ts`는 `ClassifiedAuditEvent` 타입과 `Artwork` lookup만 의존 — store 직접 의존 0
- `AuditExportBar`는 stateless presentational — props로 모든 데이터 주입
- 두 drawer 모두 자체 `filtered` 결과를 그대로 prop으로 패스 — drawer state 노출 없음

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/components/audit/AuditLogDrawer.tsx` | `AuditExportBar` import + filter row 다음에 마운트. exportScope (`single_artwork`) + exportCtx (`artworkById` 단일 entry) 메모이제이션 추가. |
| `src/components/audit/GlobalAuditDrawer.tsx` | `AuditExportBar` import + filter rows 다음에 마운트. exportScope (`global`) + exportCtx (`artworkById` 전체 map) 메모이제이션 + `filteredClassified` (`{classified, artwork}[]` → `ClassifiedAuditEvent[]` 추출) 추가. |
| `ARCHITECTURE.md` | rule_4 trust layer 매트릭스 갱신 + STEP 25 changelog 항목 추가 |

---

## 3. 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/audit-export.ts` | 320 | 3-format export helpers + filename builder + dispatcher. JSON pretty-print + CSV RFC 4180 + PDF print-API HTML report. |
| `src/components/audit/AuditExportBar.tsx` | 90 | 두 drawer 공유 export 진입점 UI. 3개 버튼 (JSON / CSV / PDF) inline. |
| `STEP_25_AUDIT_EXPORT_COMPLETE.md` | 본 문서 |

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/store/useArtworkStore.ts` | export는 read-only — store 액션 추가 0 |
| `src/types/role.ts` / `src/lib/rbac.ts` | 권한 추가 0 — audit view 자체에 접근 가능하면 export도 가능 (단일=누구나, global=audit.view_global 보유자 — 자연 차등) |
| `src/lib/audit-helpers.ts` (STEP 20) | classifyAuditEvent / ClassifiedAuditEvent 그대로 사용 |
| `src/lib/audit-navigation.ts` (STEP 21) | chain detail builder 무수정 (export는 chainHint만 사용) |
| `src/components/audit/AuditEventCard.tsx` (STEP 23) | 0줄 변경 |
| TimelineEvent / MarketSignal / Money Flow / Contract / Tax / Logistics 도메인 코드 | 0줄 변경 (사용자 spec 명시) |
| 3-Column 레이아웃 | 무변경 |
| Backend / API route | **추가 0건** (사용자 spec 명시) |
| package.json (jsPDF / pdfmake / html2canvas 등) | **추가 0건** (사용자 spec "외부 라이브러리 최소화" 준수 — print API 활용) |

---

## 5. 핵심 코드

### 5.1 Format 타입 + Scope (audit-export.ts)

```ts
export type ExportFormat = "json" | "csv" | "pdf";

export type ExportScope =
  | { kind: "single_artwork"; artworkId: string; artworkLabel: string }
  | { kind: "global" };

export interface ExportContext {
  artworkById: Record<string, Artwork>;
  chainSummaryByEventId?: Record<string, string>;
}
```

### 5.2 Filename 규칙 (사용자 spec 그대로)

```ts
export function buildExportFilename(scope: ExportScope, format: ExportFormat): string {
  const ts = nowFilenameSafe(); // YYYYMMDD-HHMMSS
  const ext = format === "pdf" ? "pdf" : format;
  return scope.kind === "global"
    ? `axvela-audit-global-${ts}.${ext}`
    : `axvela-audit-${scope.artworkId}-${ts}.${ext}`;
}
```

### 5.3 JSON export — 모든 메타데이터 보존

```ts
const payload = {
  schema: "axvela.audit.v1",
  generatedAt: new Date().toISOString(),
  scope: { ... },
  eventCount: classified.length,
  note: "내부 기록 기반 Audit Report입니다. 법적/외부 제출 시 참고용으로 사용 가능합니다.",
  events: classified.map(c => ({
    id, artworkId, artworkLabel, kind, title, detail, at, actor, actorRole,
    relatedEntityType, relatedEntityId,                     // STEP 21 nav refs
    classification: { domain, actorType, emphasis, version, isCorrection, chainHint },
    chainSummary: chainSummaryFor(ctx, c),
  })),
};
```

### 5.4 CSV export — RFC 4180 + UTF-8 BOM (Excel 한글 보존)

```ts
const CSV_COLUMNS = ["time", "artworkId", "artworkTitle", "domain", "actor",
                     "actorRole", "title", "detail", "version", "chain"];

function csvQuote(value: string): string {
  if (value === "") return "";
  const needs = /[",\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

const csv = "\uFEFF" + rows.join("\r\n") + "\r\n"; // BOM + CRLF
```

### 5.5 PDF export — print API (외부 라이브러리 0)

```ts
export function exportAuditAsPDF(classified, scope, ctx): void {
  const html = buildAuditReportHTML(classified, scope, ctx);
  const win = window.open("", "_blank");
  if (!win) {
    window.alert("PDF 인쇄 창을 열 수 없습니다. 팝업 차단을 해제하고 다시 시도해주세요.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
    // close하지 않음 — 사용자가 인쇄 취소한 경우 다시 인쇄 가능
  };
}
```

HTML report 구조 (`buildAuditReportHTML`):
- `@page` CSS — A4, 18mm × 16mm 마진
- 헤더: AXVELA Audit Report 제목 + scope label + 생성 timestamp + 이벤트 카운트
- 요약 라인: 총 이벤트 / 작품 수 (global only) / 도메인 분포
- 이벤트 테이블: 시각 / 이벤트 (제목 + detail) / 도메인 / 작성자 (role) / 버전 (chain)
- 푸터: italic disclaimer "내부 기록 기반 Audit Report입니다..." + 스냅샷 timestamp 명시

### 5.6 AuditExportBar (공유 UI)

```tsx
<div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-md border border-line bg-surface-muted">
  <div className="flex flex-col">
    <span>감사 로그 내보내기</span>
    <span className="italic text-ink-subtle">
      {isEmpty ? "내보낼 이벤트 없음" : `${count}건 · 내부 기록 기반 Audit Report`}
    </span>
  </div>
  <div className="flex items-center gap-1.5">
    <Button onClick={() => handleExport("json")} disabled={isEmpty}>JSON</Button>
    <Button onClick={() => handleExport("csv")}  disabled={isEmpty}>CSV</Button>
    <Button onClick={() => handleExport("pdf")}  disabled={isEmpty}>PDF</Button>
  </div>
</div>
```

### 5.7 AuditLogDrawer 통합 (single artwork)

```tsx
const exportScope: ExportScope = artwork
  ? { kind: "single_artwork", artworkId: artwork.id, artworkLabel: `${artwork.title} · ${artwork.artist.name}` }
  : { kind: "global" };
const exportCtx: ExportContext = React.useMemo(
  () => ({ artworkById: artwork ? { [artwork.id]: artwork } : {} }),
  [artwork]
);

// ...filter rows 다음에:
<AuditExportBar classified={filtered} scope={exportScope} ctx={exportCtx} />
```

### 5.8 GlobalAuditDrawer 통합 (cross-artwork)

```tsx
const exportScope: ExportScope = { kind: "global" };
const exportCtx: ExportContext = React.useMemo(() => {
  const map: Record<string, Artwork> = {};
  for (const a of artworks) map[a.id] = a;
  return { artworkById: map };
}, [artworks]);
const filteredClassified = React.useMemo(
  () => filtered.map(({ classified }) => classified),
  [filtered]
);

// ...4-axis filter rows 다음에:
<AuditExportBar classified={filteredClassified} scope={exportScope} ctx={exportCtx} />
```

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    67.7 kB         155 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 18 (Price Suggestion) | 62.9 kB | — |
| STEP 19 (Internal Market Data) | 64.3 kB | +1.4 |
| **STEP 25 (Audit Export)** | **67.7 kB** | **+3.4** |

`tsc --noEmit` 0 error / `next build` 0 error 0 warning. 신규 의존성 0개.

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_4** Document Trust Layer | ✅ **종착점** | 작품 단위 → 갤러리 단위 → **외부 출력**까지 완성. STEP 20/21/23의 모든 분류·체인·맥락 정보가 export payload에 보존됨. |
| **rule_5** AI-Human Loop | ✅ | export는 read-only — AI / 인간 흐름에 영향 없음 |
| **rule_7** RBAC | ✅ | 권한 추가 없음 — audit view 접근 가능자만 export 가능 (자연 차등). Staff은 단일 작품 export, Manager+는 global export. |
| **rule_8** Timeline = Navigation | ✅ | export payload에 `relatedEntityType` / `relatedEntityId` 보존 — 향후 import / 외부 도구에서도 navigation 가능 |
| **rule_14** Layout 3-Column | ✅ | 무변경 — drawer header에만 export bar 1개 추가 |
| **rule_17** Layer UI | ✅ | drawer 안 inline 마운트 — 새 페이지 / modal 추가 0 |
| Money Flow / Contract / Tax / Logistics 0줄 변경 | ✅ | |
| Backend 추가 | ✅ 0건 | 클라이언트-only export |
| 외부 API 호출 | ✅ 0건 | |
| 외부 라이브러리 추가 | ✅ 0개 | jsPDF / pdfmake / html2canvas 등 미사용 — print API 활용 |

---

## 8. 검증 시나리오

### A — 단일 작품 JSON export

1. art_007 DetailPanel → "감사 로그 보기"
2. AuditLogDrawer 헤더의 "JSON" 버튼 클릭
3. **기대**: `axvela-audit-art_007-20260504-HHMMSS.json` 다운로드
4. 파일 열기 — `schema: "axvela.audit.v1"`, `scope: { kind: "single_artwork", artworkId: "art_007", artworkLabel: "..." }`, `events: [...]` (필터된 이벤트만, 모든 메타데이터 + classification + chainSummary 포함)

### B — 단일 작품 CSV export

1. AuditLogDrawer "CSV" 버튼 클릭
2. **기대**: `axvela-audit-art_007-{ts}.csv` 다운로드
3. Excel에서 열기 — 한글 깨짐 없음, 10개 컬럼 (time / artworkId / artworkTitle / domain / actor / actorRole / title / detail / version / chain) 정상 표시
4. 따옴표 / 콤마 / 줄바꿈 포함 detail은 RFC 4180 escape 정상

### C — 단일 작품 PDF export

1. AuditLogDrawer "PDF" 버튼 클릭
2. **기대**:
   - 새 창 열림 (팝업 차단 해제 시)
   - HTML 리포트 렌더링 (AXVELA Audit Report 제목 + artwork label + timestamp + 이벤트 테이블)
   - 자동으로 인쇄 다이얼로그 표시
   - 사용자가 "PDF로 저장" 선택 → 브라우저 native PDF
   - 푸터에 disclaimer "내부 기록 기반 Audit Report입니다..." 표시

### D — Global 4-axis 필터 적용 후 export

1. RoleSwitcher → OWNER → Sidebar "전체 감사 로그"
2. GlobalAuditDrawer에서 도메인=AI, 작성자=AI 적용
3. JSON export
4. **기대**: payload.events에는 AI 도메인 + AI 작성자 이벤트만 포함 (필터 결과만 export). artworkLabel은 각 이벤트마다 다를 수 있음 (cross-artwork)

### E — 빈 결과 export 차단

1. 어떤 작품의 audit log가 0개일 때 또는 필터 적용 후 0개일 때
2. **기대**: AuditExportBar의 3개 버튼 모두 disabled. 라벨 "내보낼 이벤트 없음"

### F — Staff 권한 차등

1. RoleSwitcher → STAFF
2. 단일 작품 audit log 진입 가능 → JSON / CSV / PDF export 가능
3. Sidebar "전체 감사 로그" disabled (STEP 23) → global export 도달 불가
4. **기대**: rule_7 자연 차등 — Staff는 단일 작품 export만, Manager+는 global export 추가 가능

### G — 팝업 차단 시 PDF 처리

1. 브라우저에서 axvela 도메인 팝업 차단
2. PDF 버튼 클릭
3. **기대**: alert "PDF 인쇄 창을 열 수 없습니다. 팝업 차단을 해제하고 다시 시도해주세요." JSON / CSV는 영향 없음

### H — Determinism

1. 같은 store 상태에서 JSON export 두 번
2. **기대**: events 배열의 순서 / 내용 동일. `generatedAt` timestamp만 다름 (당연한 동작)

### I — 금지 표현 검증

1. JSON / CSV / PDF 출력 모두 검사
2. **기대**: "공식 증명서" / "법적 효력 보장" 표현 0건. "내부 기록 기반 Audit Report입니다" / "법적/외부 제출 시 참고용으로 사용 가능합니다" 명시.

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| PDF는 print API 의존 | 사용자가 인쇄 다이얼로그에서 "PDF로 저장" 명시 선택 필요. 헤드리스 / 자동화 환경에서는 작동 X | 자동화가 필요해지면 jsPDF / puppeteer 도입 검토 |
| PDF 페이지네이션 자동 | 브라우저 native — 행이 페이지 경계에 걸칠 수 있음 | CSS `page-break-inside: avoid` 추가 가능 |
| Chain detail은 hint 한 줄만 | 전체 체인 (v1 → v2 → v3) 깊이는 sourceRefs / 별도 view 필요 | JSON export에는 chainSummary 압축 한 줄만. 깊은 체인은 STEP 26 시각화 후보 |
| CSV multi-line detail | RFC 4180 quote escape 적용되지만 일부 구버전 reader에서 깨질 수 있음 | UTF-8 BOM은 Excel 친화 — 다른 reader는 spec 따라 처리됨 |
| Schema versioning | `axvela.audit.v1` 명시했지만 migration tool 없음 | 추후 schema 변경 시 versioned reader / migrator 도입 |
| Filter state는 export에 반영 안 됨 | 어떤 필터로 export했는지는 메타데이터에 기록 안 함 | JSON payload에 `appliedFilters` 추가 가능 |
| Export 시점 timestamp | client local time 기반 | 향후 server timestamp 필요 시 백엔드 도입 |
| 외부 시스템 파싱 호환성 | JSON schema는 자체 정의 — 표준 audit format (CEF / LEEF) 미준수 | 외부 SIEM 연동 필요 시 어댑터 layer 추가 |

---

## 10. 다음 STEP 후보

1. **STEP 26 — Audit Trail Visualization** (timeline graph / heatmap). 갤러리 활동 패턴 가시화 — Recharts / D3.
2. **STEP 24 — Audit Filters 강화** (date range picker / multi-select / 검색 입력). cross-artwork view 실용 강화.
3. **STEP 27 — Persistence + Sync layer**. v1 메모리 스토어 → 백엔드 어댑터. Money Flow / 도메인 코드 0줄 변경 원칙으로 어댑터 패턴.
4. **STEP 29 — External Auction Market Reference** (STEP 19 후속 — auction comparable sales / marketplace listing / FX / freshness TTL).
5. **STEP 28 — Real AI Integration** — Curation / Inquiry response / Price suggestion에 실제 AI API 옵션 layer 추가 (deterministic helper와 병행).
