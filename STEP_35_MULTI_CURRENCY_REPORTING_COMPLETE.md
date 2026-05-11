# STEP 35 — Multi-currency Reporting Layer 완료

STEP 31 / 32 / 34에서 데이터 layer까지 완성된 FX 정보를 **갤러리 운영자가
한눈에 보는 Drawer view로 가시화**. KRW 통합 환산 기준의 운영 참고 리포트 —
Total Sales / Settlement Total / Taxable Amount / FX Converted KRW Total +
Currency Breakdown + Status Summary. **도메인 로직 0줄 변경 · 새 store 도메인
slice 0개 · pure presentation + read-only aggregation**.

핵심 결정:
- **Pure read-only aggregator** — `src/lib/reporting-aggregates.ts`의
  `computeReportingAggregates(invoices, settlements, taxRecords)` 단일 pure
  function. 모든 합계는 STEP 31/32/34에서 이미 store action이 계산해 둔 결과
  (`Invoice.fxSnapshot.rate` / `Settlement.convertedTotalKRW` /
  `TaxRecord.taxableAmountKRW`)를 단순 합산. **새 도메인 계산 로직 0개**.
- **rule_3 Money Flow 분리 유지** — 카드별로 Total Sales (Invoice 기준) /
  Settlement Total (Settlement 기준) / Taxable Amount (Tax 기준)이 별개 차원으로
  표시. 한 데이터 source가 다른 카드를 침범하지 않음.
- **rule_20 FX snapshot 기준** — 각 invoice의 lock 시점 환율 (변하지 않는
  snapshot)을 사용. 환율이 이후 변동해도 본 리포트는 그 시점 환산값 그대로.
- **fxSnapshot 부재 시 안전 처리** — DRAFT 상태 외화 invoice / 환산 정보 없는
  settlement / tax는 합산에서 제외하고 별도 "환산 정보 부족 N건" 카운터로
  표시. 사용자에게 "이 카드의 합계는 N건 누락됨" 명시 — 잘못된 신뢰감 방지.
- **표현 정책 엄격 준수** — 사용자 spec 명시 "회계 확정" / "세무 신고 완료"
  표현 금지. 본 STEP의 모든 라벨은 "운영 참고 리포트" / "내부 정산 기준" /
  "FX snapshot 기준" / "회계 확정 또는 세무 신고와 무관" 사용. Status 라벨도
  시스템 내부 상태 그대로 ("발송" / "결제 완료" / "정산 완료" / "발행").
- **Mock FX provider 표시** — invoice의 fxSnapshot.provider 또는 sourceNote에
  "mock" 키워드 매칭 시 footer에 amber 톤 ⚠️ 명시. fxProviderId까지 monospace
  로 노출. 사용자 spec "mock FX provider임을 필요한 곳에 작게 표시" 준수.
- **RBAC 게이트** — Manager 이상만 접근. 새 permission `report.view_global`
  추가 (audit.view_global과 같은 패턴). 권한 부족 STAFF는 sidebar "보고서"
  항목이 disabled + "Manager 권한 필요" hint (rule_7 disabled 패턴 일관성).
- **Drawer (rule_17) — 800px width** — GlobalAuditDrawer와 동일 톤. 3-Column
  레이아웃 (rule_14) 무변경. 단일 Drawer 내부에 6 섹션 (disclaimer banner →
  KPI 4 카드 grid → Currency table → Status 3 카드 → footnote).
- **Sidebar "보고서" 활성화** — STEP 40에서 disabled + "준비 중"으로 처리했던
  항목을 RBAC 기반으로 활성화. STEP 40의 정신 ("모든 항목은 의미 있는 진입점")
  유지하면서 점진 전환.
- **Export 미포함** — 사용자 spec "Export는 추후 STEP으로 미루고, 이번 STEP은
  View 중심으로 진행". 후속 STEP에서 audit-export.ts 패턴 재활용 가능.

---

## 1. 현재 코드 분석

**STEP 35 진입 시점 (v34 + STEP 24 + STEP 26 + STEP 40 baseline):**

| 항목 | 진입 시점 | STEP 35 종료 |
|---|---|---|
| FX 데이터 layer | Invoice.fxSnapshot (STEP 32 lock) / Settlement.convertedTotalKRW (STEP 34) / TaxRecord.taxableAmountKRW (STEP 34) 모두 store에 채워짐 | **무수정** — read-only로 활용 |
| Multi-currency 통합 view | 부재 (사용자가 각 drawer 따로 보면서 합산) | 신규 Drawer 1개 — 한 화면에 모두 |
| Sidebar "보고서" 항목 | STEP 40에서 disabled + "준비 중" hint | RBAC 기반 활성화 (Manager 이상) |
| RBAC permission | `audit.view_global` 1개 cross-artwork view | + `report.view_global` (Manager 이상) |
| Store slice for drawer state | auditLogRequest / globalAuditRequest | + `reportingRequest` |
| Pure aggregation function | 부재 | 신규 `computeReportingAggregates()` |
| 도메인 store action (Payment / Settlement / Tax 계산) | STEP 14~34에서 완성 | **무수정** |
| Audit drawer (STEP 24/26) / 다른 모든 drawer | 정상 | **무수정** |

**의존 관계:**
- `ReportingDrawer` → `computeReportingAggregates` (신규 lib) + `useArtworkStore` (read-only) + `Drawer` UI
- `reporting-aggregates.ts` ← `Invoice` / `Settlement` / `TaxRecord` 타입만 import (도메인 read 의존)
- Sidebar → `openReporting` action + `report.view_global` permission

순환 import 0건. 본 STEP은 **새 layer를 도메인 위에 올린 형태** — 도메인은 STEP 35의 존재를 모름.

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/types/role.ts` | `Permission` union에 `"report.view_global"` 추가 (~3 LOC). `ACTION_MIN_ROLE`에 `"report.view_global": "MANAGER"` 매핑 추가 (~3 LOC). 기존 권한 0줄 변경. |
| `src/store/useArtworkStore.ts` | `ReportingRequest` type 추가 (closed/open 2-state). `ArtworkStoreState`에 `reportingRequest` 필드 + Actions에 `openReporting` / `closeReporting`. 초기 state에 `reportingRequest: { kind: "closed" }`. 액션 본체 — `openReporting`은 RBAC 가드 (`hasPermission("report.view_global")`) 후 set, 권한 부족 시 silent no-op. reset 블록에도 closed 추가. **도메인 액션 / mock data / 다른 모든 slice / 모든 cascade 액션 0줄 변경** (~25 LOC 추가만). |
| `src/components/layout/Sidebar.tsx` | `NavItem` interface에 `onClick?: () => void` 추가 (~5 LOC). `SECONDARY` 정적 배열 → `useMemo` 동적 빌더. "보고서" 항목만 RBAC 기반으로 disabled/hint/onClick 결정 (Manager 이상 권한 시 onClick=openReporting, 부족 시 disabled + "Manager 권한 필요"). 다른 3 항목 (AI 워크플로우 / 고객 / 설정) 그대로 disabled. NavGroup render에 `onClick={isDisabled ? undefined : item.onClick}` 1줄 추가. **Header / 감사 영역 / Pending Approval Queue / RoleSwitcher / SyncStatus / ResetDataButton 모든 부분 0줄 변경** (~30 LOC 변경). |
| `src/app/page.tsx` | `ReportingDrawer` import + mount 1줄 (다른 drawer 옆). |
| `ARCHITECTURE.md` | STEP 35 changelog |

---

## 3. 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/reporting-aggregates.ts` | 240 | Pure aggregation function `computeReportingAggregates(invoices, settlements, taxRecords): ReportingAggregates`. 한 번의 for loop로 invoice / settlement / tax slice 모두 walk. KRW 환산 + currency 분포 + status breakdown + provider tracking 동시 계산. Display helper (`formatKRW` / `formatCurrencyAmount`) + 한국어 status 라벨 (`INVOICE_STATUS_LABEL_KR` 등) 함께 export. |
| `src/components/reporting/ReportingDrawer.tsx` | 380 | 단일 Drawer 컴포넌트. 6 sub-component: `DisclaimerBanner` / `KPISection` (4 카드) / `KPICard` / `CurrencyBreakdownSection` (HTML table) / `StatusSummarySection` (3 카드) / `StatusCard<T>` / `FootnoteSection` / `SectionHeader` / `EmptyRow`. 외부 차트 라이브러리 0개 — 모두 div + tailwind. |
| `STEP_35_MULTI_CURRENCY_REPORTING_COMPLETE.md` | 본 문서 |

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/types/invoice.ts` | Invoice / InvoiceStatus / fxSnapshot 모두 STEP 32 그대로 — 0줄 변경 |
| `src/types/settlement.ts` | Settlement / convertedTotalKRW / fxRateUsed 모두 STEP 34 그대로 — 0줄 변경 |
| `src/types/tax.ts` | TaxRecord / taxableAmountKRW / fxRateUsed 모두 STEP 34 그대로 — 0줄 변경 |
| `src/types/fx.ts` | FXRate provider / rate / sourceNote — STEP 31 그대로 — 0줄 변경 |
| `src/lib/fx-provider.ts` (STEP 31) | mock provider 그대로 |
| `src/store/*` (도메인 액션) | sendInvoice / createSettlement / completeSettlement / createTaxRecord / issueTax / registerPayment / 모든 도메인 액션 0줄 변경 — 본 STEP 35는 그 결과를 read-only로 합산만 |
| Mock data / `mock-data.ts` / 모든 cascade | 0줄 변경 |
| `src/lib/audit-helpers.ts` (STEP 20/24) | 0줄 — audit 영역 무관 |
| `src/components/audit/*` (STEP 20/21/23/24/25/26) | 0줄 — audit drawer 영역 무관 |
| `src/components/audit/AuditTrailVisualization.tsx` (STEP 26) | 0줄 |
| `src/components/audit/AuditFilterBar.tsx` (STEP 24) | 0줄 |
| `src/components/audit/AuditExportBar.tsx` (STEP 25) | 0줄 |
| TimelineEvent 구조 | 0줄 |
| 3-Column 레이아웃 / Sidebar 다른 모든 영역 / 다른 모든 Drawer / 모든 Detail Panel 컴포넌트 | 0줄 변경 |
| Persistence (STEP 27 / 27.7 / 30) | 0줄 — `reportingRequest`는 UI 상태이므로 영속 안 됨 (의도된 동작, drawer 닫혔다 다시 열면 reset) |
| Market Data (STEP 19 / 29) / AI (STEP 16 / 18) | 0줄 |
| `package.json` | 0줄 — 외부 라이브러리 추가 0개 |

---

## 5. 핵심 코드

### 5.1 Pure aggregation

```ts
export interface ReportingAggregates {
  // KPI cards
  totalSalesKRW: number;
  totalSalesCount: number;
  convertibleInvoiceCount: number;
  settlementTotalKRW: number;
  settlementCount: number;
  settlementMissingFxCount: number;
  taxableAmountKRW: number;
  taxRecordCount: number;
  taxMissingFxCount: number;
  fxConvertedKRWTotal: number;
  fxConvertedInvoiceCount: number;
  // Breakdowns
  currencyBreakdown: CurrencyBucket[];
  invoiceStatusBreakdown: Record<InvoiceStatus, number>;
  settlementStatusBreakdown: Record<SettlementStatus, number>;
  taxStatusBreakdown: Record<TaxRecordStatus, number>;
  // Metadata
  fxSourceIsMock: boolean;
  fxProviderId: string | null;
}

export function computeReportingAggregates(invoices, settlements, taxRecords): ReportingAggregates {
  // for loop 1번씩 — invoice / settlement / tax 각각.
  // KRW invoice: amount 그대로. 외화: fxSnapshot.rate로 환산.
  // fxSnapshot 부재 외화: missingFxCount++ (합산 제외).
  // currency별 bucket Map 누적.
  // provider 빈도 max → fxProviderId.
}
```

### 5.2 RBAC permission 1줄

```ts
export type Permission = ... | "report.view_global";
export const ACTION_MIN_ROLE = { ..., "report.view_global": "MANAGER" };
```

### 5.3 Store slice (audit 패턴 그대로)

```ts
export type ReportingRequest = { kind: "closed" } | { kind: "open" };

// State
reportingRequest: ReportingRequest;

// Actions
openReporting: () => {
  if (!hasPermission(get().currentRole, "report.view_global")) return; // silent
  set({ reportingRequest: { kind: "open" } });
},
closeReporting: () => set({ reportingRequest: { kind: "closed" } }),

// Initial: { kind: "closed" }
// Reset: { kind: "closed" }
```

### 5.4 Sidebar 동적 SECONDARY (STEP 40 패턴 + onClick 추가)

```tsx
const openReporting = useArtworkStore((s) => s.openReporting);
const canViewReporting = hasPermission(currentRole, "report.view_global");

const SECONDARY: NavItem[] = React.useMemo(() => [
  { label: "AI 워크플로우", disabled: true, hint: "작품 상태 액션에서 접근" },
  {
    label: "보고서",
    disabled: !canViewReporting,
    hint: canViewReporting ? undefined : permissionHint("report.view_global"),
    onClick: canViewReporting ? openReporting : undefined,
  },
  { label: "고객", disabled: true, hint: "준비 중" },
  { label: "설정", disabled: true, hint: "준비 중" },
], [canViewReporting, openReporting]);
```

### 5.5 ReportingDrawer — 6 sections

```tsx
<Drawer open={isOpen} onClose={closeReporting} title="운영 참고 리포트" widthClass="w-[840px]">
  <DisclaimerBanner />                                  {/* "회계 확정/세무 신고와 무관" */}
  <KPISection aggregates={aggregates} />                 {/* 4 카드 grid */}
  <CurrencyBreakdownSection ... />                      {/* HTML table */}
  <StatusSummarySection aggregates={aggregates} />      {/* 3 카드 (Invoice/Settlement/Tax) */}
  <FootnoteSection fxSourceIsMock={...} fxProviderId={...} />  {/* mock 표시 */}
</Drawer>
```

### 5.6 KPI 카드 — 환산 정보 부족 경고

```tsx
<KPICard
  label="Total Sales"
  subLabel="총 매출 · KRW 환산"
  value={formatKRW(aggregates.totalSalesKRW)}
  hint={`${aggregates.convertibleInvoiceCount} / ${aggregates.totalSalesCount} 인보이스`}
  warn={aggregates.totalSalesCount > aggregates.convertibleInvoiceCount
    ? `${aggregates.totalSalesCount - aggregates.convertibleInvoiceCount}건 환산 정보 부족`
    : null}
/>
```

→ 4 카드 grid에서 환산 정보가 부족하면 `⚠️ N건 환산 정보 부족` amber 톤 표시.

### 5.7 Currency Breakdown table

```
┌──────┬──────┬──────────────┬──────────────┐
│ 통화  │ 건수 │ 통화 단위 합계  │ KRW 환산      │
├──────┼──────┼──────────────┼──────────────┤
│ KRW  │  6   │  ₩48,200,000 │  ₩48,200,000 │
│ USD  │  2   │  USD 12,500  │  ₩16,375,000 │
│ EUR  │  1   │  EUR 8,200   │  ⚠ 1건 누락   │
└──────┴──────┴──────────────┴──────────────┘
```

KRW 자체는 dim, 외화 환산값은 강조. fxSnapshot 부재 통화는 "N건 누락" 경고.

### 5.8 Footnote — mock provider 명시

```tsx
{fxSourceIsMock && (
  <p className="text-amber-700">
    ⚠ 현재 FX provider는 mock 데이터입니다 ({fxProviderId})
    — 실 환율과 차이가 있을 수 있습니다.
  </p>
)}
<p>본 리포트는 운영 참고용이며 회계 확정 / 세무 신고 권한 / 외부 보고와 무관합니다.</p>
```

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    79.5 kB         167 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 24 (Audit Filters 강화) | 74.5 kB | — |
| STEP 26 (Audit Visualization) | 76.2 kB | +1.7 |
| STEP 40 (Sidebar Nav Polish) | 76.4 kB | +0.2 |
| **STEP 35 (Multi-currency Reporting)** | **79.5 kB** | **+3.1** |

`tsc --noEmit` 0 error / `next build` 0 warning. **외부 npm 의존성 0개**.

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_3** Money Flow 분리 | ✅ **강화** | KPI 카드 / Status 카드 / Currency table 모두 Payment / Settlement / Tax 별개 차원으로 표시. 한 source가 다른 카드 침범 0건 |
| **rule_4** Trust Layer | ✅ | fxSnapshot lock 시점 기준 — 환율 변동에도 lock된 값 그대로. fxSnapshot 부재 시 "환산 정보 부족" 경고로 trust 명시 |
| **rule_7** RBAC | ✅ | 새 permission `report.view_global` (Manager 이상). Sidebar disabled 패턴 일관성 — 권한 부족 STAFF는 "Manager 권한 필요" hint |
| **rule_10** 홈 = 작품 리스트 | ✅ | 보고서는 Drawer overlay — 홈 작품 리스트 변경 0줄 |
| **rule_14** 3-Column | ✅ 0줄 | Sidebar / Artwork Grid / Detail Panel 무변경 |
| **rule_17** Layer UI | ✅ | Drawer 추가만 — 레이아웃 변경 0 |
| **rule_20** FX | ✅ **가시화** | STEP 31/32/34 데이터 layer가 사용자가 볼 수 있는 화면으로 가시화. fxSnapshot 기준 환산 명시 |
| 신규 도메인 로직 | ✅ 0줄 | aggregation은 read-only |
| Payment / Settlement / Tax 계산 로직 변경 | ✅ 0줄 | |
| 3-column 레이아웃 변경 | ✅ 0줄 | |
| Backend 추가 | ✅ 0건 | |
| 외부 라이브러리 추가 | ✅ 0개 | div + tailwind만 |
| 표현 — "회계 확정" / "세무 신고 완료" 금지 | ✅ | Disclaimer / Footnote / KPI 라벨 모두 검증 |
| 표현 — "운영 참고 리포트" / "내부 정산 기준" / "FX snapshot 기준" | ✅ | DisclaimerBanner / FootnoteSection 모두 사용 |
| Mock FX provider 표시 | ✅ | FootnoteSection ⚠️ amber 톤 + provider id monospace |
| Sidebar "보고서" 활성화 | ✅ | RBAC 기반 (Manager 이상). STAFF는 disabled + "Manager 권한 필요" |
| Manager 이상 권한 | ✅ | `report.view_global` MANAGER |
| Export 미포함 | ✅ | View 중심 — 후속 STEP에서 audit-export.ts 패턴 재활용 가능 |

---

## 8. 검증 시나리오

### A — Manager 권한에서 "보고서" 클릭

1. RoleSwitcher → Manager (default)
2. Sidebar → "보고서" 클릭
3. **기대**:
   - ReportingDrawer 열림 (840px width)
   - 헤더 "운영 참고 리포트"
   - DisclaimerBanner: "운영 참고 리포트 · 내부 정산 기준 / FX snapshot 기준 — 회계 확정 또는 세무 신고와 무관합니다."
   - 4 KPI 카드 (Total Sales / Settlement Total / Taxable Amount / FX Converted)
   - Currency Breakdown table
   - 3 Status 카드 (Invoice / Settlement / Tax Record)
   - Footnote (mock provider 표시)

### B — STAFF 권한에서 "보고서" 클릭 차단

1. RoleSwitcher → Staff
2. Sidebar → "보고서" 항목 시각: disabled + "Manager 권한 필요" hint
3. 클릭 시도 → **무동작**
4. 마우스 hover → 네이티브 툴팁 "Manager 권한 필요"

### C — Owner 권한 정상 (상속)

1. RoleSwitcher → Owner
2. **기대**: Manager 권한 상속 — "보고서" 활성, 클릭 시 drawer 정상 진입

### D — KPI 카드 정확도

1. 실제 mock data 기준 ` Total Sales = 모든 invoice의 KRW 환산 합계
2. **기대**: KRW invoice는 amount 그대로, 외화는 fxSnapshot.rate로 환산. 합계 정확.

### E — fxSnapshot 부재 시 경고

1. 새 외화 invoice 생성 (DRAFT) — fxSnapshot 부재
2. 보고서 열기
3. **기대**:
   - Total Sales 카드: "⚠️ 1건 환산 정보 부족" (amber)
   - Currency Breakdown 해당 통화 row: "⚠ 1건 누락" (KRW 환산 컬럼)

### F — Currency Breakdown 정렬

1. KRW / USD / EUR / JPY 등 다양한 통화 mock data
2. **기대**: KRW 항상 첫 줄, 그 외는 알파벳 순

### G — Status 카드 정확

1. Invoice DRAFT 2 / SENT 5 / PAID 8
2. **기대**: Invoice 카드 — DRAFT 2, SENT 5, PAID 8, 합계 15. 0인 status는 dim.

### H — Mock provider 표시

1. 외화 invoice 발송 (STEP 32 sendInvoice — fxSnapshot에 mock_fx_v1 provider 채워짐)
2. 보고서 열기 → Footnote
3. **기대**: ⚠ 현재 FX provider는 mock 데이터입니다 (mock_fx_v1)

### I — KRW only 시 mock 표시 안 됨

1. 모든 invoice가 KRW
2. **기대**: fxSourceIsMock = false → mock 경고 미렌더. 일반 footnote만.

### J — Drawer 닫고 다시 열기

1. 보고서 열기 → 닫기 → 다시 열기
2. **기대**: 데이터 갱신 (그동안 다른 drawer에서 invoice 발송 등 한 경우 즉시 반영)

### K — RoleSwitcher 동작 중 권한 변경

1. Manager → Staff 전환
2. **기대**: Sidebar "보고서" 즉시 disabled로 전환. drawer 열려 있었으면 isAllowed false → drawer 자동 비활성 (isOpen이 false).

### L — Persistence 호환

1. 보고서 열린 상태에서 F5
2. **기대**: drawer 자체는 닫힌 상태로 hydrate (UI 상태이므로 영속 안 됨, 의도된 동작). 도메인 데이터 (invoice / settlement / tax)는 그대로 영속.

### M — Audit Drawer / 다른 영역 무영향

1. 보고서 열기 → 닫기 → AuditLogDrawer / GlobalAuditDrawer / DetailPanel / 모든 도메인 액션 시도
2. **기대**: STEP 24/26/40 모든 검증 통과 상태 100% 보존

### N — 외화 invoice 환산 정확도

1. STEP 32 sendInvoice 통해 USD invoice 발송 (예: $1,000, mock fx 1,375)
2. 보고서 → FX Converted 카드: ₩1,375,000
3. **기대**: 1,000 * 1,375 = 1,375,000 정확 매칭

### O — 도메인 흐름 무영향

1. invoice 발송 / settlement 생성 / tax issue 등 모든 도메인 액션
2. **기대**: 본 STEP 35 변경이 도메인 store 흐름에 0영향. 모든 cascade / timeline / FX 계산 v34+STEP24+STEP26+STEP40 baseline과 동일

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| Export 부재 | 사용자 spec "Export는 추후 STEP" 명시 | 후속 STEP에서 audit-export.ts 패턴 재활용 (PDF / CSV) |
| 시계열 (월별 / 분기별) 부재 | 단일 시점 합계만 — 시간축 trend 없음 | STEP 39 Audit Heatmap과 결합 후속 STEP |
| Drill-down 부재 | 카드 클릭해도 상세 invoice/settlement 리스트로 진입 안 됨 | 향후 KPICard onClick → filtered AuditDrawer 진입 가능 |
| 작품별 분포 부재 | Currency Breakdown은 통화별만 — 작품별 매출 ranking 없음 | STEP 26 Top artworks 시각화와 연결한 후속 STEP |
| FX 환산 차이 미표시 | settlement.convertedTotalKRW와 invoice 환산 합이 일치할 것으로 기대하지만 검증 안 함 | 향후 reconciliation 검증 helper |
| Mock FX detection 휴리스틱 | provider id 또는 sourceNote에 "mock" 키워드 매칭 — false negative 가능 | STEP 33 Real FX Provider 후 isMock flag 명시화 |
| 화면 좁을 때 4 카드 grid | grid-cols-2이라 좁은 너비에서는 OK, 다만 번역된 라벨 길어지면 카드 일부 wrap 가능 | i18n 시 추가 polish |
| 통화 종류 많을 때 | Currency Breakdown table은 모든 통화 표시 — 5+ 통화면 길어짐 | 향후 Top N + "기타" 로 묶기 가능 |
| 마이너스 / 환불 케이스 | 현재 Invoice amount는 양수만 가정 | 후속 STEP에서 환불 / void 처리 |
| 시간 필터 부재 | "이번 달 / 이번 분기" 등 기간 선택 부재 | STEP 24 audit filter 패턴 차용 후속 STEP |

---

## 10. 다음 STEP 후보

본 STEP 35로 Money Flow / FX 영역의 view layer 완성. 자연스러운 후속:

1. **STEP 36 — Settlement Currency-aware Net** — splitSettlement / splitTax
   helper에 currency 파라미터. 현재 v1은 KRW 기준 60/40. 외화 거래에서도
   동일 비율 적용되도록 명시.
2. **STEP 33 — Real FX Provider** — OpenExchangeRatesProvider 실 구현. 본
   STEP 35 footer의 mock 경고가 자연스럽게 사라짐.
3. **STEP 35.5 — Reporting Time Filter** — 본 STEP의 KPI / Currency / Status
   에 기간 필터 추가 (이번 달 / 이번 분기 / 사용자 지정). STEP 24 audit
   filter 패턴 재활용.
4. **STEP 35.6 — Reporting Export** — 본 STEP의 view를 PDF / CSV로 export.
   STEP 25 audit-export.ts 패턴 재활용.
5. **STEP 38 — Saved Filter Preset** — 본 STEP 24/26 audit 필터 조합을
   사용자별 저장.
6. **STEP 41 — Collector View** — 본 STEP 40 "준비 중" 항목 활성화. 고객별
   보유 작품 + 거래 이력.
7. **STEP 28 — Real AI Integration** — Curation / Inquiry response / Price
   suggestion 실 AI API.
8. **STEP 27.5 — IndexedDBAdapter** — localStorage 5MB 한계 해소.
9. **STEP 39 — Audit Heatmap** — 7일 × N주 grid heatmap.
10. **STEP 37 — Document Approval Workflow** — Contract / Curation multi-step
    approval.
