# STEP 72 — Documents Hub Tab Counts Drilldown

> **목표**: STEP 67/70 4-piece reusable architecture를 그대로 재사용하여 Documents
> Hub의 모든 탭 카운트 + footer count를 drilldown으로 확장. 모든 문서 카운트가
> *passive 숫자*에서 *연결 문서 list → 작품 navigate* 흐름으로 전환.
> **2번째 drawer 시스템 0개 · UI redesign 0건 · 문서 generation/export 로직 0줄**

---

## State

- **이전**: STEP 70 / Route 138 kB
- **이번**: STEP 72 / **Route 139 kB (+1 kB)**
- Build ✅ · type-check ✅ · Lint ✅

---

## 신규 도메인 5개

| 도메인 | DocumentDomain 매핑 | 컬럼 |
|---|---|---|
| `documents_all` | `"all"` (통합 표) | 작품 / **구분** / 상태 / 금액 / 일자 |
| `documents_invoices` | `"INVOICE"` | 작품 / 상태 / 금액 / 버전 / 비고 / 일자 |
| `documents_contracts` | `"CONTRACT"` | 작품 / 상태 / 금액 / 버전 / 비고 / 일자 |
| `documents_tax_records` | `"TAX"` | 작품 / 상태 / 금액 / 버전 / 비고 / 일자 |
| `documents_condition_reports` | `"CONDITION_REPORT"` | 작품 / 상태 / 금액 / 버전 / 비고 / 일자 |

`documents_all`은 도메인 컬럼이 추가로 노출되는 통합 view, 도메인별은 도메인 컬럼 빼고 도메인 특화.

---

## Payload 필드 추가

```ts
export interface DrilldownPayload {
  // ... 기존 필드들
  /** STEP 72 — Documents Hub status filter inherit */
  documentStatus?: string;  // "all" / "completed" / "inprogress"
  /** STEP 72 — Documents Hub textQuery inherit */
  searchQuery?: string;
}
```

---

## Resolver 로직 요약

```ts
function resolveDocumentsHub(payload, state) {
  const targetDomain = mapDocumentsDomain(payload.domain);  // INVOICE / CONTRACT / ... / "all"
  const status = payload.documentStatus ?? "all";
  const textQuery = payload.searchQuery ?? "";

  // resolver flat array → aggregateDocuments 기대 grouped Record 변환
  const result = aggregateDocuments({
    invoices: groupByTransactionId(state.invoices),
    contracts: groupBy(state.contracts),
    taxRecords: groupBy(state.taxRecords),
    conditionReports: groupBy(state.conditionReports),
    transactions: groupBy(state.transactions),
    artworks: state.artworks,
  }, {
    domainFilter: targetDomain,
    statusFilter: status,
    textQuery,
    timeRange: { start: payload.periodFromIso, end: payload.periodToIso },
  });

  // DocumentRow → DrilldownRow 매핑
  const rows = result.rows.map(r => ({
    id: `${r.domain}-${r.entityId}`,
    artworkId: r.artworkId,  // 모든 문서가 artwork link 보유 (rule_1)
    cells: { artwork, domain, status (LOCK meta), amount, version, detail, date },
  }));

  // domain별 컬럼 분기 — "all"이면 도메인 컬럼 추가
  return { title, context (filter chips), columns, rows };
}
```

기존 `aggregateDocuments`를 그대로 재사용 — 문서 도메인 로직 0줄 변경.

---

## Documents Hub Integration Sites

### 1. DomainTabs split (5 site)

기존 `<button>` outermost를 `<div>`로 변경 + 내부 두 개 형제 button:

```tsx
<div className="h-8 rounded-md border ... flex items-center">
  {/* 탭 전환 — 기존 동작 보존 */}
  <button onClick={onTabClick}>{label}</button>
  {/* count drilldown — STEP 72 신규 */}
  <button onClick={onCountClick} disabled={count === 0} title="...상세 보기">
    <span className="...rounded-full">{countLabel}</span>
  </button>
</div>
```

| 탭 | Drilldown domain |
|---|---|
| 전체 | documents_all |
| 인보이스 | documents_invoices |
| 계약서 | documents_contracts |
| 세무 기록 | documents_tax_records |
| 검수 보고서 | documents_condition_reports |

**count = 0이면 disabled** (cursor-not-allowed + opacity-60). 기존 visual 보존 — wrapper div가 active 스타일 그대로 유지.

### 2. Footer count link (1 site)

```tsx
{result.rows.length > 0 ? (
  <button onClick={() => handleDrillDomain(domainFilter)}>
    {N}건 표시 · 총 {M}건 → 상세 보기
  </button>
) : (
  <span>{N}건 표시 · 총 {M}건</span>
)}
```

현재 활성 도메인 + 모든 필터 inherit.

### 총 6개 신규 클릭 site

---

## Filter Sync (4-Filter inherit)

```tsx
// DocumentsDrawer 안 — outer-scope range
const drilldownRange = useMemo(() => resolveTimeRange(timeFilter), [timeFilter]);

const handleDrillDomain = useCallback((domain) => {
  openDrilldown({
    domain: drillDomain,
    documentStatus: statusFilter,    // "all" / "completed" / "inprogress"
    searchQuery: textQuery,           // text 검색어
    periodFromIso: drilldownRange?.start,
    periodToIso: drilldownRange?.end,
  });
}, [openDrilldown, statusFilter, textQuery, drilldownRange]);
```

resolver가 4 필터 모두 적용해서 row 추출 → context line에 활성 필터 표시.

---

## Artwork-Centric Navigation

```
모든 문서 row → artworkId 보유 (rule_11 Transaction → Artwork chain)
  ↓ row 클릭
setSelectedArtwork(row.artworkId)
  ↓
closeDrilldown()
  ↓
DetailPanel auto-sync — 작품의 timeline / 액션 노출
```

Invoice는 transactionId만 갖지만 `aggregateDocuments`가 Transaction lookup으로 artworkId 채움. 따라서 모든 문서 row가 navigate 가능.

---

## Drilldown Flow 시나리오

```
[1] DocumentsDrawer 열림
[2] 운영자: timeFilter "이번 분기" + status "완료/LOCK" 적용
[3] 인보이스 탭 count badge "12 / 24" 표시 (24건 중 12건 필터 통과)
[4] count 부분 클릭 (탭 전환 아님 — 분리된 button)
[5] openDrilldown({
      domain: "documents_invoices",
      documentStatus: "completed",
      searchQuery: "",
      periodFromIso: "2026-04-01",
      periodToIso: "2026-06-30"
    })
[6] OperationalDrilldownDrawer 열림
    ┌───────────────────────────────────────────────────┐
    │ 문서 상세 — 인보이스                                │
    │ 12건 · 기간: 2026-04-01 ~ 06-30 · 상태: 완료/LOCK   │
    ├───────────────────────────────────────────────────┤
    │ 작품          상태       금액         버전  비고  일자 │
    │ The Shore   ●PAID(LOCK) ₩3,200,000  v2   ...   ...  │
    │ Quiet Hour  ●SENT(LOCK) USD 4,500    v1   ...   ...  │
    │ ...                                                 │
    └───────────────────────────────────────────────────┘
[7] 운영자: "Quiet Hour" row 클릭
[8] setSelectedArtwork → closeDrilldown → DetailPanel sync
[9] DetailPanel에서 settlement / tax 흐름 진입 가능
```

---

## 변경 / 신규 파일

### 신규 (1)

| 파일 | LOC | 역할 |
|---|---|---|
| `STEP_72_DOCUMENTS_DRILLDOWN.md` | (이 문서) | 완료 보고 |

### 변경 (4 + ARCHITECTURE.md)

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/types/drilldown.ts` | ~25 LOC | 5 domain enum + documentStatus/searchQuery + Contract state subset 필드 |
| `src/lib/drilldown-resolver.ts` | ~180 LOC | dispatch 5 case + resolveDocumentsHub + groupBy helpers + Contract import |
| `src/components/drilldown/OperationalDrilldownDrawer.tsx` | ~10 LOC | contracts selector + flatten + useMemo deps |
| `src/components/documents/DocumentsDrawer.tsx` | ~150 LOC | TabButton split (label + count 분리) + DomainTabs onDrillDomain prop + footer count link + handleDrillDomain handler |

---

## 검증 매트릭스

### 사용자 spec 9개 검증 항목

| 항목 | 결과 |
|---|---|
| 5개 신규 domain | ✅ |
| Resolver 5개 case (모두 resolveDocumentsHub로 통합) | ✅ |
| Documents Hub UI 통합 (4 도메인 tab + 전체 tab + footer = 6 site) | ✅ |
| Filter sync (status / textQuery / period) | ✅ 4 필터 모두 inherit |
| Artwork-centric navigation | ✅ 모든 row.artworkId 보유 (rule_11 chain) |
| Non-clickable row | ✅ count = 0이면 disabled 처리 |
| Institutional minimalism | ✅ TabButton visual 거의 동일 (flex wrap만 변경) |
| Read-only drilldown | ✅ destructive 0건 |
| Build / type-check / lint | ✅ Route 139 kB |

### 사용자 spec 8개 제약

| 제약 | 결과 |
|---|---|
| 기존 STEP 67/70 architecture 재사용 | ✅ types / drawer / ClickableMetric / store action 그대로 |
| 2번째 drawer 시스템 | ✅ 0개 |
| Documents Hub UI redesign | ✅ 0건 (TabButton wrap만 div로 변경, visual 보존) |
| 문서 generation / export 로직 | ✅ 0줄 (`aggregateDocuments` read-only 호출만) |
| invoice / contract / tax / condition data 로직 | ✅ 0줄 |
| Persistence schema | ✅ 0줄 |
| Payment / Settlement / Tax / FX 계산 | ✅ 0줄 |
| 외부 라이브러리 | ✅ 0개 |

### 표현 정책

| 표현 | 결과 |
|---|---|
| 사용 ("문서 상세" / "연결 문서" / "연결 작품" / "운영 참고" / "상태 기준" / "작품 이동") | ✅ 사용 |
| 금지 ("legal proof" / "certified legal document" / "official accounting" / "guaranteed record" / "tamper-proof") | ✅ 0건 (정책 주석에서도 부재) |

---

## Affected Domains Verification

| Domain | 변경 |
|---|---|
| Payment / Settlement / Tax | 0줄 |
| FX (STEP 31 / 32 / 34) | 0줄 (resolver는 fxSnapshot read-only) |
| AI Market Analysis | 0줄 |
| Backup / Restore | 0줄 |
| Image Lifecycle | 0줄 |
| Logistics provider | 0줄 |
| Customer (STEP 42) | 0줄 |
| System Audit (STEP 65) | 0줄 |
| `documents-aggregates.ts` | 0줄 (read-only consumer만) |
| `OperationalDrilldownDrawer` (STEP 67) | +10 LOC (contracts selector 추가만) |
| `ClickableMetric` (STEP 67) | 0줄 (재사용) |
| `ReportingDrawer` (STEP 70) | 0줄 |

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_1** Artwork-First | 모든 문서 row.artworkId 보유 → 작품 navigate | ✅ 강화 |
| **rule_4** Trust Layer | drilldown read-only · row "LOCK" meta로 trust signal | ✅ 보존 |
| **rule_8** Timeline = Navigation 확장 | Documents Hub 모든 카운트 → 연결 문서 → 작품 → 다음 액션 | ✅ **확장 완성** |
| **rule_11** Transaction Core | Invoice의 transactionId → Artwork chain 보존 (`aggregateDocuments`가 lookup 처리) | ✅ 보존 |
| **rule_14** 3-Column | 0줄 | ✅ |
| **rule_15** Max 3 buttons | drawer footer "닫기" 1개 + Documents footer export 그대로 | ✅ |
| **rule_16** institutional minimalism | TabButton visual 보존 (button → div wrap, 같은 background / border / hover) | ✅ |
| **rule_17** Drawer/Modal Layer | overlay drawer (3-column 위 stack) | ✅ |

---

## 다음 STEP 후보

```
STEP 73  Customer drilldown — CustomerViewDrawer의 inquiry/purchase/owned counts → drilldown
STEP 74  Sidebar 작품 status 카운트 → drilldown (artwork_state 자연 활용)
STEP 75  ImageCleanup orphan row → "외부 저장소에서 제거 요청" inline action
STEP 76  Documents row 자체 클릭 → 기존 detail drawer 통합 강화
```

각 STEP은 STEP 67 4-piece + STEP 70/72 패턴 그대로 활용 가능.

---

## 결과 요약

- 신규 파일 1개 (이 문서)
- 변경 파일 4개 (drilldown types + resolver + drawer + DocumentsDrawer)
- 5개 신규 domain (4 도메인별 + all 통합)
- 6개 신규 클릭 site (5 tab count + 1 footer count)
- 4 필터 inherit (status + textQuery + periodFromIso + periodToIso)
- 0 신규 라이브러리 / 0 schema / 0 visual redesign / 0 도메인 로직 변경
- STEP 67 4-piece 인프라 그대로 재사용 (drawer / ClickableMetric / store action)
- TabButton wrapper을 button→div로 변경하여 nested button 회피, visual 보존
- Artwork-centric navigation 보존 — 모든 문서 row가 작품으로 returns (rule_11 chain)
- Route +1 kB (138 → 139 kB)

**STEP 72 완료. AXVELA Documents Hub의 모든 카운트가 operational graph node로 활성화.**
