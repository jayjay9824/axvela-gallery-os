# STEP 44 — Customer Export (CSV / PDF)

> **목표**: STEP 42 Customer 1급 도메인 + STEP 43 Customer Detail Navigation
> 위에 Export layer 추가. STEP 25 audit-export / STEP 35.6 reporting-export
> 패턴 재사용해 위험도 최소화 + 일관성 확보.

---

## State

- **이전**: STEP 43 / Route 88.8 kB
- **이번**: STEP 44 / **Route 92.3 kB (+3.5 kB)**
- Build ✅ · type-check ✅ (`tsc --noEmit` 0 error)

---

## Flow

```
CustomerViewDrawer (master-detail)
  │
  ├─ Master  : segment chip filter + 검색 → filteredCustomers
  ├─ Detail  : selected customer (STEP 42)
  │            └─ 작품 row 클릭 → DetailPanel navigation (STEP 43)
  │
  └─ Footer  : [CSV] [PDF] [닫기]   ← STEP 44
                │      │
                │      └→ window.open + onload print → browser native PDF
                └→ Blob (UTF-8 BOM + RFC 4180 CSV) → <a download>
```

**Export 대상 = filteredCustomers** (segment chip + 검색 적용 결과). "보고 있는 것을 그대로 내보내기" 원칙.

---

## 변경 파일 목록

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/components/customer/CustomerViewDrawer.tsx` | ~50 LOC | `customer-export` import / `filterLabel` memo / `handleExport` callback / footer 변경 / `ExportButton` sub-component |
| `ARCHITECTURE.md` | +1 changelog | STEP 44 추가 |

---

## 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/customer-export.ts` | ~410 | `CustomerExportFormat` / `CustomerExportContext` / `exportCustomers` dispatcher + CSV / PDF 두 빌더 + 4 helpers |
| `STEP_44_CUSTOMER_EXPORT_COMPLETE.md` | (이 문서) | STEP 완료 보고 |

---

## 핵심 코드

### 1) Export dispatcher + format

```ts
// src/lib/customer-export.ts

export type CustomerExportFormat = "csv" | "pdf";

export interface CustomerExportContext {
  filterLabel: string;     // "전체" / "Segment: 반복 구매" / "...· 검색: '김'"
  totalCount: number;      // 필터 전 전체 수
  filteredCount: number;   // = customers.length, 가독성용 중복
}

export function exportCustomers(
  format: CustomerExportFormat,
  customers: Customer[],
  ctx: CustomerExportContext
): void {
  if (format === "csv") {
    exportCustomersAsCSV(customers, ctx);
  } else {
    exportCustomersAsPDF(customers, ctx);
  }
}
```

### 2) CSV — UTF-8 BOM + RFC 4180

```ts
export function exportCustomersAsCSV(
  customers: Customer[],
  ctx: CustomerExportContext
): void {
  const lines: string[] = [];

  // Metadata (5 lines + blank separator)
  lines.push("Customer 운영 참고 — 컬렉터 / 매수자 derive view");
  lines.push("Inquiry / Transaction에서 자동 derive — 확정 고객 등급 또는 영구 마스터 데이터 아닙니다");
  lines.push(`생성 시각,${csv(formatNowKR())}`);
  lines.push(`필터,${csv(ctx.filterLabel)}`);
  lines.push(`결과,${csv(`${ctx.filteredCount} / ${ctx.totalCount}명`)}`);
  lines.push("");

  // 16-column header
  lines.push(["이름", "대표 연락처", "추가 연락처 수", "Segment", "Kind",
              "거래 수", "문의 수", "보유 작품 수", "누적 매입 KRW",
              "환산 정보 부족 건수", "진행 중 거래", "진행 중 문의",
              "첫 활동", "마지막 활동", "주요 채널", "운영 참고 신호"]
              .map(csv).join(","));

  // Per-customer rows (16 columns)
  for (const c of customers) {
    lines.push([
      c.displayName,
      c.primaryContact,
      String(Math.max(0, c.allContacts.length - 1)),
      CUSTOMER_SEGMENT_LABEL_KR[c.segment],
      CUSTOMER_KIND_LABEL_KR[c.kind],
      String(c.transactionIds.length),
      String(c.inquiryIds.length),
      String(c.ownedArtworkIds.length),
      String(c.totalPurchaseKRW),
      String(c.missingFxCount),
      String(c.activeTransactionCount),
      String(c.activeInquiryCount),
      c.firstInteractionAt.slice(0, 10),
      c.lastInteractionAt.slice(0, 10),
      c.primarySource ? INQUIRY_SOURCE_LABEL_KR[c.primarySource] : "",
      c.signals.map(s => CUSTOMER_SIGNAL_LABEL_KR[s]).join("; "),
    ].map(csv).join(","));
  }

  // UTF-8 BOM + CRLF (Excel for Windows 한글 깨짐 방지)
  const body = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, buildCustomerFilename("csv"));
}

/** RFC 4180 escape — `"`, `,`, `\r`, `\n` 포함 시 `"..."` 감싸고 내부 `"` → `""` */
function csv(value: string): string {
  if (value === "") return "";
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
```

### 3) PDF — window.open + onload print

```ts
export function exportCustomersAsPDF(
  customers: Customer[],
  ctx: CustomerExportContext
): void {
  const html = buildCustomersHTML(customers, ctx);
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
  };
}
```

PDF HTML 구조: A4 + 16mm 마진 + Pretendard 한글 친화 inline CSS + h1/h2 + 4-card summary (고객 수 / 누적 매입 KRW / 진행 중 거래 / 진행 중 문의) + 9-column 고객 테이블 + dashed footnote.

### 4) Drawer 통합 — filterLabel + handleExport

```tsx
// src/components/customer/CustomerViewDrawer.tsx

// STEP 44 — Customer Export. 현재 적용된 필터 (segment chip + 검색어) 결과를
// 그대로 export. UI에 노출 중인 데이터 = export 대상의 invariant 보장.
const filterLabel = React.useMemo(() => {
  const segLabel =
    segmentFilter === "ALL"
      ? "전체"
      : `Segment: ${CUSTOMER_SEGMENT_LABEL_KR[segmentFilter]}`;
  const q = search.trim();
  return q ? `${segLabel} · 검색: "${q}"` : segLabel;
}, [segmentFilter, search]);

const handleExport = React.useCallback(
  (format: CustomerExportFormat) => {
    if (filteredCustomers.length === 0) return;
    exportCustomers(format, filteredCustomers, {
      filterLabel,
      totalCount: customers.length,
      filteredCount: filteredCustomers.length,
    });
  },
  [filteredCustomers, customers.length, filterLabel]
);
```

### 5) Footer — STEP 35.6 ReportingDrawer 패턴 그대로

```tsx
<footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-between bg-surface">
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase mr-1">
      내보내기
    </span>
    <ExportButton label="CSV" onClick={() => handleExport("csv")}
                  disabled={filteredCustomers.length === 0} />
    <ExportButton label="PDF" onClick={() => handleExport("pdf")}
                  disabled={filteredCustomers.length === 0} />
  </div>
  <Button type="button" variant="ghost" onClick={closeView}>닫기</Button>
</footer>
```

---

## CSV 출력 예시 (실 mock 데이터 기준 발췌)

```
Customer 운영 참고 — 컬렉터 / 매수자 derive view
Inquiry / Transaction에서 자동 derive — 확정 고객 등급 또는 영구 마스터 데이터 아닙니다
생성 시각,2026-05-04 18:32
필터,Segment: 반복 구매
결과,2 / 7명

이름,대표 연락처,추가 연락처 수,Segment,Kind,거래 수,문의 수,보유 작품 수,누적 매입 KRW,환산 정보 부족 건수,진행 중 거래,진행 중 문의,첫 활동,마지막 활동,주요 채널,운영 참고 신호
김도현,kim.dohyun@example.com,0,반복 구매,거래 경험,2,3,2,75000000,0,0,0,2025-08-12,2026-04-21,이메일,다회 거래; 최근 활동
리움 컬렉션,acquisitions@leeum.example,1,반복 구매,거래 경험,3,1,3,420000000,0,1,0,2025-04-03,2026-04-15,갤러리 방문,다회 거래; 대규모 매입; 최근 활동
```

---

## Build 결과

```
> npm run build

Route (app)                              Size     First Load JS
┌ ○ /                                    92.3 kB         179 kB
└ ○ /_not-found                          873 B            88 kB
+ First Load JS shared by all            87.1 kB

✓ Compiled successfully
✓ type-check 통과 (tsc --noEmit, 0 error)
```

**Δ Route**: 88.8 kB → **92.3 kB (+3.5 kB)** vs STEP 43 baseline.

증분 분석:
- `customer-export.ts` (~410 LOC) — CSV serialization + PDF HTML builder + helpers
- CustomerViewDrawer +50 LOC — filterLabel memo + handleExport + footer 재구성 + ExportButton

---

## 검증 매트릭스

| 사용자 spec | 검증 결과 |
|---|---|
| **요구사항** | |
| CustomerViewDrawer에 Export 버튼 추가 | ✅ Footer 좌측 [CSV] [PDF] |
| Export format: CSV / PDF | ✅ |
| 현재 필터/세그먼트 적용 결과 기준 | ✅ filteredCustomers 그대로 |
| Customer summary | ✅ PDF 4-card grid + CSV 16-column |
| 총 구매 금액 | ✅ `totalPurchaseKRW` |
| 문의 수 | ✅ `inquiryIds.length` |
| 거래 수 | ✅ `transactionIds.length` |
| 보유/매입 작품 수 | ✅ `ownedArtworkIds.length` |
| 최근 인터랙션 | ✅ `lastInteractionAt` (+ `firstInteractionAt`) |
| segment / kind / signal | ✅ 모두 한국어 라벨로 직렬화 |
| CSV UTF-8 BOM | ✅ `"\uFEFF" + lines.join("\r\n")` |
| PDF 브라우저 print 기반 | ✅ `window.open` + `onload → window.print()` |
| **표현 정책** | |
| "운영 참고용" 표현 사용 | ✅ CSV header / PDF footnote / disclaimer |
| "확정 고객 등급" 금지 | ✅ disclaimer 부정형으로만 |
| "신용 평가" 금지 | ✅ disclaimer 부정형으로만 |
| "법적 효력" 금지 | ✅ disclaimer 부정형으로만 |
| mock name/email 그대로 유지 | ✅ transform 0건 |
| **제약** | |
| 신규 외부 라이브러리 추가 금지 | ✅ `package.json` 0줄 변경 |
| Customer master data slice 추가 금지 | ✅ store slice 0개 추가 |
| Persistence schema 변경 금지 | ✅ PersistedState / validateV1 / SCHEMA_VERSION 0줄 변경 |
| Payment / Settlement / Tax / Invoice / FX / AI 로직 변경 금지 | ✅ 0줄 변경 |

---

## Manifesto rule 정합성

| Rule | STEP 44 영향 | 상태 |
|---|---|---|
| **rule_3** Money Flow 분리 | 누적 매입 KRW는 STEP 32 fxSnapshot.rate read-only 참조만 | ✅ 보존 |
| **rule_4** Document Trust | disclaimer + missingFxCount 카운터로 환산 한계 transparent 노출 | ✅ 강화 |
| **rule_7** RBAC | Drawer 진입 권한 (`collector.view_global`, Manager 이상)이 자연 차등 — Export 자체에 추가 권한 없음 (audit/reporting과 같은 정책) | ✅ 일관성 |
| **rule_14** 3-Column | 레이아웃 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | Footer "CSV" / "PDF" / "닫기" 정확히 3개, 좌우 분리로 기능 차등 | ✅ 보존 |
| **rule_16** 미니멀 디자인 | Pretendard 친화 + 절제된 회색 톤 + 표 중심 + 그림자 0 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | overlay만, 새 창은 print 전용 | ✅ 보존 |
| **rule_20** FX | Invoice fxSnapshot lock 시점 환율 그대로 사용 (이미 STEP 42 customer-aggregates에서 같은 패턴) | ✅ 보존 |

---

## 패턴 재사용 — STEP 25 / 35.6 일관성

| 항목 | STEP 25 (audit-export) | STEP 35.6 (reporting-export) | STEP 44 (customer-export) |
|---|---|---|---|
| Format | JSON / CSV / PDF | CSV / PDF | CSV / PDF |
| Filename 패턴 | `axvela-audit-{scope}-{ts}.{ext}` | `axvela-reporting-{ts}.{ext}` | `axvela-customers-{ts}.{ext}` |
| CSV BOM | ✅ `\uFEFF` | ✅ `\uFEFF` | ✅ `\uFEFF` |
| CSV 라인 종결 | `\r\n` | `\r\n` | `\r\n` |
| RFC 4180 escape | ✅ | ✅ | ✅ |
| PDF 방식 | `window.open` + print | `window.open` + print | `window.open` + print |
| `triggerDownload` helper | ✅ | ✅ | ✅ (동일 함수 재구현) |
| `escapeHTML` helper | ✅ | ✅ | ✅ (동일 함수 재구현) |
| Disclaimer 부정형 표현 | "법적/외부 제출 시 참고용" | "회계 확정 / 세무 신고 권한 / 외부 보고와 무관" | "확정 고객 등급 / 신용 평가 / 법적 효력과 무관" |

세 모듈 모두 같은 골격, 도메인별 column / disclaimer / 합계 로직만 차등.

---

## 다음 STEP 후보

남은 Track 2 / Track 4 항목:

1. **AI 시장 분석 view** (rule_18 (b) 본격화) — STEP 29 외부 데이터 토대 위 commentary layer
2. **Channel mix → Reporting Drawer 통합** — 갤러리 단위 channel 분포 분석
3. **Inquiry 신규 생성 시 Customer suggest** — 동일 이름 customer 자동 추천
4. **Logistics 외부 provider 연결** (rule_21) — STEP 29 ExternalAuctionProvider 패턴

---

## 결과 요약

- 신규 파일 1개 (`customer-export.ts` ~410 LOC)
- 수정 파일 1개 (CustomerViewDrawer ~50 LOC)
- 0 신규 라이브러리 / 0 외부 API / 0 store slice / 0 schema 변경
- STEP 25 / 35.6 export 패턴과 100% 일관 (filename / BOM / RFC 4180 / window.print / disclaimer 부정형)
- 사용자 spec 6개 금지 사항 모두 준수 + 표현 정책 0건 위반
- Route +3.5 kB (88.8 → 92.3 kB)

**STEP 44 완료.**
