# STEP 51 — Documents Hub

> **목표**: Sidebar "문서" 메뉴 활성화 + 4개 문서 도메인을 통합 read-only 검색 view로 묶음.
> Production에서 사용자가 직접 발견한 페인 포인트 ("발행한 인보이스 모아 보기 /
> 계약서 보관 / 세무 보고") 대응. **rule_1 Artwork-First 엄격 보존** — 검색 utility,
> 신규 생성/편집은 여전히 작품 → 거래 흐름에서만.

---

## State

- **이전**: STEP 50.5 / Route 109 kB
- **이번**: STEP 51 / **Route 114 kB (+5 kB)**
- Build ✅ · type-check ✅ · Lint ✅ (`No ESLint warnings or errors`)

---

## Flow

```
Sidebar "문서" 메뉴 (활성화됨, RBAC: Manager+)
  │
  ↓ openDocuments()
  │
  DocumentsDrawer (w-[800px])
    │
    ├─ 도메인 탭: 전체 / 인보이스 / 계약서 / 세금계산서 / Condition Report
    │   - 각 탭에 "filtered / total" 카운트 배지
    │
    ├─ 필터 row 1: 상태 chip (전체 / 완료·LOCK / 작업중) + 검색 input (작품/작가/AXID)
    ├─ 필터 row 2: 기간 chip (전체 / 이번 달 / 이번 분기 / 사용자 지정)
    │
    ├─ Row list (primaryDate desc):
    │   각 row 4-col grid (도메인+status / 작품+artist+axid / 금액 / primaryDate)
    │       │
    │       ↓ 클릭
    │       ├─ setSelectedArtwork(artworkId)  ← rule_1 자연 복귀
    │       ├─ closeDocuments()
    │       └─ 도메인 detail drawer open:
    │           - INVOICE        → InvoiceDetailDrawer
    │           - CONTRACT       → ContractDetailDrawer
    │           - TAX            → TaxDetailDrawer
    │           - CONDITION_REPORT → ConditionReportDrawer (edit mode)
    │
    └─ Footer: [CSV] [PDF] [닫기]
        ├─ CSV: 검색 결과 리스트만 (개별 PDF ZIP은 후속 STEP)
        └─ PDF: 검색 결과 리스트만 (window.print)
```

**도메인 신규 생성/편집 0건** — 본 drawer는 검색 utility, 모든 신규 생성은 작품 → 거래 흐름.

---

## 변경 파일 목록

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/store/useArtworkStore.ts` | ~30 LOC | `DocumentsRequest` 타입 + UI slice + open/close action |
| `src/components/layout/Sidebar.tsx` | ~30 LOC | "문서" 메뉴 STATIC → 동적 빌드 + RBAC 가드 |
| `src/app/page.tsx` | 2 LOC | DocumentsDrawer mount |
| `ARCHITECTURE.md` | +1 changelog | STEP 51 추가 |

## 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/documents-aggregates.ts` | ~310 | 4 도메인 flatten + filter + sort + DocumentRow 타입 |
| `src/lib/documents-export.ts` | ~290 | CSV / PDF list export (개별 PDF ZIP 제외) |
| `src/components/documents/DocumentsDrawer.tsx` | ~480 | 와이드 drawer + 탭 + 필터 + row list + export |
| `STEP_51_DOCUMENTS_HUB.md` | (이 문서) | 완료 보고 |

---

## 핵심 코드

### 1) Aggregator — 4 도메인 통합 row

```ts
// src/lib/documents-aggregates.ts

export interface DocumentRow {
  domain: DocumentDomain;          // INVOICE | CONTRACT | TAX | CONDITION_REPORT
  entityId: string;                // 도메인 detail drawer 호출 시 사용
  domainLabel: string;             // 한국어 라벨
  statusLabel: string;
  isLocked: boolean;               // rule_4 Document Trust
  isCompleted: boolean;            // status 필터 매칭용
  primaryDate: string;             // 정렬 + 시간 필터 키
  primaryDateLabel: string;        // "발행일" / "지불일" / "LOCK" / "기록일"
  artworkId: string;
  artworkTitle: string;
  artistName: string;
  artworkAxidCode: string;
  transactionId: string;
  amountLabel: string | null;      // INVOICE/TAX
  versionLabel: string | null;     // INVOICE/CONTRACT의 v1/v2/...
  detailLabel: string | null;      // tax type / report type
}

export function aggregateDocuments(
  input: DocumentsAggregateInput,
  options: DocumentsAggregateOptions
): DocumentsAggregateResult {
  const artworkLookup = new Map(input.artworks.map((a) => [a.id, a]));
  // Invoice는 artworkId 부재 — transactions 경유 lookup
  const txArtworkLookup = new Map<string, string>();
  for (const list of Object.values(input.transactions)) {
    for (const tx of list) txArtworkLookup.set(tx.id, tx.artworkId);
  }

  const allRows: DocumentRow[] = [];
  // 4 도메인 flatten (각 도메인별 buildXxxRow)
  // ...

  // 도메인별 전체 카운트 (필터 전 — 탭 배지 보존)
  // status / 시간 / 텍스트 필터 적용 (도메인 필터 제외)
  // 도메인별 필터 후 카운트
  // 도메인 탭 필터 적용
  // primaryDate desc 정렬
  return { rows, totalCountByDomain, filteredCountByDomain, totalFilteredCount };
}
```

**도메인별 status mapping**:

| 도메인 | DRAFT/작업중 | 완료 (isLocked) |
|---|---|---|
| Invoice | DRAFT | SENT, PAID |
| Contract | DRAFT, REVIEW | APPROVED, LOCKED |
| TaxRecord | PENDING, READY | ISSUED |
| ConditionReport | (없음 — 항상 immutable) | 항상 completed |

**도메인별 primaryDate**:

| 도메인 | 우선순위 |
|---|---|
| Invoice | `paidAt` > `sentAt` > `issuedAt` |
| Contract | `lockedAt` > `updatedAt` |
| TaxRecord | `issuedAt` > `createdAt` |
| ConditionReport | `lockedAt` > `reportedAt` > `createdAt` |

### 2) Sidebar — "문서" 메뉴 활성화

```tsx
// src/components/layout/Sidebar.tsx

// PRIMARY_STATIC에서 "문서" 항목 제거 — 동적 빌드로 이동
const PRIMARY_STATIC: NavItem[] = [
  { label: "작품", active: true },
  { label: "거래",          disabled: true, hint: "작품 상세에서 접근" },
  // STEP 51: "문서"는 동적 빌드 (RBAC 적용)
];

const openDocuments = useArtworkStore((s) => s.openDocuments);
const canViewDocuments = hasPermission(currentRole, "report.view_global");

const PRIMARY = useMemo(() => [
  ...PRIMARY_STATIC,
  {
    label: "문서",
    disabled: !canViewDocuments,
    hint: canViewDocuments ? undefined : permissionHint("report.view_global"),
    onClick: canViewDocuments ? openDocuments : undefined,
  },
  { label: "고객", ... },
], [canViewDocuments, openDocuments, ...]);
```

이전 "작품 상세에서 접근" hint 제거 ✓.

### 3) Row 클릭 흐름 (rule_1 자연 복귀)

```tsx
// src/components/documents/DocumentsDrawer.tsx

const handleOpen = () => {
  // 1. 작품 컨텍스트 활성화 — DetailPanel에 자연 노출 (rule_1)
  if (row.artworkId) setSelectedArtwork(row.artworkId);

  // 2. Documents drawer 닫기
  closeDocuments();

  // 3. 한 tick 뒤 도메인 detail drawer open
  setTimeout(() => {
    switch (row.domain) {
      case "INVOICE":          openInvoiceDetail(row.entityId); break;
      case "CONTRACT":         openContractDetail(row.entityId); break;
      case "TAX":              openTaxDetail(row.entityId); break;
      case "CONDITION_REPORT": openConditionReportEdit(row.entityId); break;
    }
  }, 0);
};
```

**3단계 흐름의 핵심**:
- DetailPanel이 작품 정보로 갱신됨 → 사용자가 도메인 drawer 닫으면 곧바로 그 작품의 컨텍스트가 노출 → rule_1 Artwork-First 자연 복귀
- 같은 z-50 layer에 두 drawer가 동시에 떠있는 UX 혼란 회피

### 4) Status / Time 필터 (STEP 35.5 패턴 재사용)

```tsx
// 상태 chip
const STATUS_CHIPS = [
  { value: "all", label: "전체" },
  { value: "completed", label: "완료 / LOCK" },
  { value: "inprogress", label: "작업중" },
];

// 기간 chip — STEP 35.5 ReportingTimeFilter 그대로 재사용
const TIME_PRESET_CHIPS = [
  { value: "ALL", label: "전체 기간" },
  { value: "THIS_MONTH", label: "이번 달" },
  { value: "THIS_QUARTER", label: "이번 분기" },
  { value: "CUSTOM", label: "사용자 지정" },
];
```

검색 input은 `작품 / 작가 / AXID` 부분 매칭 (lowercase substring).

### 5) Export — list-only

```ts
// src/lib/documents-export.ts

// CSV: UTF-8 BOM + RFC 4180 + CRLF + 5-row metadata + 11-col body
// PDF: window.print + A4 16mm + Pretendard + 4 summary card + 9-col table

export function exportDocuments(
  format: DocumentsExportFormat,  // "csv" | "pdf"
  rows: DocumentRow[],
  ctx: DocumentsExportContext
): void {
  if (format === "csv") return exportAsCSV(rows, ctx);
  if (format === "pdf") return exportAsPDF(rows, ctx);
}
```

**개별 PDF ZIP 다운로드는 후속 STEP** (사용자 spec 결정 3).

---

## 검증 매트릭스

### 사용자 spec 5개 결정값

| 결정 | 결과 |
|---|---|
| (1) 4개 도메인 모두 포함 | ✅ Invoice / Contract / TaxRecord / ConditionReport |
| (2) DRAFT 포함 전체 노출 + 필터로 좁히기 | ✅ statusFilter "all" 기본값 |
| (3) list export만 (CSV + PDF) | ✅ 개별 PDF ZIP 제외 (후속 STEP) |
| (4) "문서" 메뉴 활성화 + hint 제거 | ✅ Sidebar PRIMARY 동적 빌드 |
| (5) 신규 생성/편집 0건 | ✅ 항목 클릭은 기존 detail drawer 재사용 only |

### 사용자 spec 추가 요구

| 요구 | 결과 |
|---|---|
| InvoiceDetailDrawer 재사용 | ✅ openInvoiceDetail |
| ContractDetailDrawer 재사용 | ✅ openContractDetail |
| TaxDetailDrawer 재사용 | ✅ openTaxDetail |
| ConditionReport drawer 재사용 | ✅ openConditionReportEdit |
| Artwork-First 원칙 유지 | ✅ row 클릭 시 setSelectedArtwork → 자연 복귀 |
| Payment / Settlement / Tax / FX / Customer / AI 0줄 | ✅ |
| Persistence schema 변경 0줄 | ✅ UI slice만, validateV1 무영향 |
| 외부 API / 신규 라이브러리 | ✅ 0건 / 0개 |
| build 통과 | ✅ Route 114 kB |

---

## Manifesto rule 정합성

| Rule | STEP 51 영향 | 상태 |
|---|---|---|
| **rule_1** Artwork-First | 본 drawer는 read-only utility — 도메인 신규 생성/편집은 여전히 작품 → 거래 흐름. 항목 클릭은 setSelectedArtwork → DetailPanel 자연 활성화 → rule_1 복귀 | ✅ 보존 |
| **rule_4** Trust Layer | LOCK 배지 + 부정형 disclaimer ("회계 확정 / 세무 신고 / 외부 보고 / 법적 효력과 무관") | ✅ 강화 |
| **rule_7** RBAC | Reporting과 같은 `report.view_global` 권한 (Manager+) 가드 | ✅ 보존 |
| **rule_14** 3-Column | 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | drawer footer "CSV" / "PDF" / "닫기" — export 보조 버튼은 사용자 spec 명시 허용 | ✅ 보존 |
| **rule_16** 미니멀 디자인 | 절제된 회색 + chip 패턴 일관 + LOCK 배지 작은 typography + 그림자 0 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | overlay 안 view 추가만 | ✅ 보존 |

---

## 다음 STEP 후보

남은 작업:

1. **STEP 52 — JSON Export-Import (백업/복원)** — localStorage 데이터 백업 / 복원
2. **STEP 53 — 외부 storage 연결 (이미지)** — Vercel Blob / Cloudflare R2
3. **STEP 54 — Logistics 통합 view** — Customer / Reporting 패턴 일관
4. **STEP 55 — Documents Hub 후속**:
   - 개별 PDF ZIP 다운로드
   - 작가 / 작품별 필터 추가
   - 도메인별 추가 컬럼 노출 옵션

---

## 결과 요약

- 신규 파일 3개 (lib 2 + component 1, 총 ~1080 LOC)
- 수정 파일 3개 (store + Sidebar + page.tsx)
- 0 신규 라이브러리 / 0 외부 API / 0 도메인 타입 변경 / 0 schema 변경
- 4개 도메인 통합 read-only 검색 view
- 항목 클릭 = 기존 detail drawer 재사용 (신규 UI 0개)
- list export (CSV + PDF) 제공 — 개별 PDF ZIP은 후속 STEP
- rule_1 Artwork-First 엄격 보존 (검색은 utility, 생성/편집은 작품 흐름에서만)
- Route +5 kB (109 → 114 kB)

**STEP 51 완료. 회계 / 세무 / 계약 보관 운영 흐름 충족.**
