# STEP 35.5 + 35.6 + 36 — Reporting / Money Flow 묶음 완료

세 가지 polish/extension을 한 사이클로 묶어 진행. 모두 **view layer 중심** —
도메인 로직 0줄, 핵심 계산 0줄. 기존 STEP 35 ReportingDrawer를 한 단계 깊게
가다듬고 (시간 필터 + 내보내기), Settlement / Tax drawer의 외화 표시를 더
명확히 (KRW 환산 inline).

| STEP | 한 줄 |
|---|---|
| **35.5** | ReportingDrawer에 기간 필터 (전체 / 이번 달 / 이번 분기 / 사용자 지정) — KPI / Currency / Status 모두 즉시 재계산 |
| **35.6** | ReportingDrawer에 CSV / PDF 내보내기 — STEP 25 audit-export 패턴 재활용, 필터 결과 기준 |
| **36** | Settlement / Tax 분배 라인 표시에 외화 ⟶ KRW 환산 보조 라벨 inline — `MoneyAmount` 공용 컴포넌트 |

핵심 결정:
- **세 STEP 모두 read-only display layer** — store action / 도메인 helper /
  계산 로직 / FX provider / Persistence 모두 0줄 변경. 입력 변화 없이 view만
  더 정보 풍부하게.
- **"회계 확정" / "세무 신고 완료" / "법적 효력" 표현 0건** — CSV / PDF /
  Drawer / MoneyAmount 모두 grep 검증 통과. 부정형 ("회계 확정 / 세무 신고와
  무관") 또는 주석에서만 등장.
- **사용자 spec "관련 기능 2~3개 묶어서 진행 후 한 번에 검증"에 맞춘 사이클** —
  세 STEP의 변경 면적이 작아 묶어도 검증 부담 작음. ReportingDrawer가 공통 진입
  점이라 시각 검증도 단일 동선.

---

## STEP 35.5 — Reporting Time Filter

### 변경 요약
- `src/lib/reporting-aggregates.ts`에 `ReportingTimePreset` / `ReportingTimeFilter` /
  `EMPTY_REPORTING_TIME_FILTER` types + `resolveTimeRange()` / `formatTimeFilterLabel()` /
  `filterByTimeRange()` pure helpers 추가.
- `ReportingDrawer`에 timeFilter state (drawer-local, 닫혔다 열면 reset) +
  `useMemo`로 filter → aggregate chain. 기존 `computeReportingAggregates`는 그대로
  활용 — filter는 그 앞 단계에서 invoice/settlement/tax slice를 자른 후 전달.
- `TimeFilterBar` 신규 sub-component — 4 chip + custom mode native date inputs.

### 시간 기준
- Invoice: `issuedAt` (DRAFT 시점)
- Settlement: `createdAt`
- TaxRecord: `createdAt`

→ 세 도메인이 같은 시점 기준 정렬 → 같은 기간에 발생한 흐름이 일관 표시됨.

### Preset 정의
```ts
ALL          → null range (필터 비활성)
THIS_MONTH   → [year-month-01, year-month-end] (local time 기준)
THIS_QUARTER → [Q-start-01, Q-end] (Q1: 0-2, Q2: 3-5, Q3: 6-8, Q4: 9-11)
CUSTOM       → [customStart, customEnd] (둘 다 채워졌을 때만 활성)
```

### Range 비교 정책
- ISO lexicographic — `event.at < start` 차단, `event.at.slice(0,10) > end` 차단
- 둘 다 inclusive — `[start, end]` 포함

### UI
```
┌─────────────────────────────────────────────────┐
│ 기간  [전체] [이번 달] [이번 분기] [사용자 지정]  │  preset chip row
│                                  2026-05-01 ~  │  현재 라벨
│                                  2026-05-31    │
│ 범위  [📅 시작일] ~ [📅 종료일]                 │  CUSTOM 모드만 노출
└─────────────────────────────────────────────────┘
```

`active chip` = `bg-ink text-white border-ink`, 비활성은 `bg-surface text-ink-muted`.
preset 전환 시 customStart/customEnd 자동 초기화 (CUSTOM 외 preset 선택 시 무관).

### Aggregator chain
```ts
const aggregates = useMemo(() => {
  const flatInv = Object.values(invoices).flat();
  const flatSet = Object.values(settlements).flat();
  const flatTax = Object.values(taxRecords).flat();
  const range = resolveTimeRange(timeFilter);
  const filtered = filterByTimeRange(flatInv, flatSet, flatTax, range);
  return computeReportingAggregates(
    filtered.invoices,
    filtered.settlements,
    filtered.taxRecords
  );
}, [invoices, settlements, taxRecords, timeFilter]);
```

→ KPI 4 카드 / Currency Breakdown / Status Summary 모두 자동으로 필터된 결과 기준.

---

## STEP 35.6 — Reporting Export

### 변경 요약
- 신규 `src/lib/reporting-export.ts` — CSV + PDF 두 format dispatcher.
  STEP 25 audit-export.ts 패턴 차용 (`triggerDownload` / `escapeHTML` /
  `nowFilenameSafe` / `window.print` HTML).
- ReportingDrawer footer 좌측에 "내보내기 [CSV] [PDF]" 버튼 + 닫기 우측.
- 데이터 0건 (invoice / settlement / tax 모두 0)이면 두 버튼 모두 disabled.
- 현재 적용된 timeFilter 라벨이 export에 함께 포함됨 — 사용자 spec "Export는
  필터 적용 결과 기준" 충족.

### CSV 구조 (Excel UTF-8 BOM 포함, 한국어 깨짐 방지)
```
운영 참고 리포트
내부 정산 기준 / FX snapshot 기준 (lock 시점)
회계 확정 또는 세무 신고와 무관
생성 시각,2026-05-04 16:30
기간,이번 달 · 2026-05-01 ~ 2026-05-31
FX 데이터,mock provider (mock_fx_v1) — 실 환율과 차이 가능

[핵심 지표]
지표,KRW 값,건수,비고
Total Sales,48200000,12,
Settlement Total,...
Taxable Amount,...
FX Converted,...

[통화별 매출 분포]
통화,건수,통화 단위 합계,KRW 환산,비고
KRW,6,48200000,48200000,
USD,2,12500,16375000,
EUR,1,8200,(누락),1건 환산 누락

[상태별 분포]
도메인,상태,건수
Invoice,초안,2
Invoice,발송,5
...
Settlement,...
Tax,...
```

CSV 표현은 BOM (`\uFEFF`) 추가로 Excel에서 한글 깨짐 차단. `csv()` 헬퍼로
쉼표/따옴표/줄바꿈 안전 escape.

### PDF (HTML print)
- `window.open("", "_blank")` → HTML write → `win.onload` 시 `win.print()`
- 팝업 차단 시 alert로 안내
- Pretendard 우선 + `@page { margin: 16mm }` 인쇄 친화 layout
- 헤더: "운영 참고 리포트" + 생성 시각 + 기간 + 기준 ("내부 정산 기준 / FX
  snapshot 기준 (lock 시점)")
- mock FX 시 amber `⚠ 현재 FX provider는 mock 데이터입니다 ...` 명시
- 하단 footnote: "본 리포트는 운영 참고용이며 회계 확정 / 세무 신고 권한 /
  외부 보고와 무관합니다"

### 표현 검증
grep으로 `회계 확정|세무 신고 완료|법적 효력` 검색 → UI에 노출되는 모든 텍스트는
부정형 또는 disclaimer로만 사용. CSV header / PDF body / Drawer 어디에도
"회계 확정 완료" / "세무 신고 완료" / "법적 효력 있음" 같은 단정 표현 0건.

---

## STEP 36 — Settlement Currency-aware Net

### 변경 요약
- 신규 `src/components/shared/MoneyAmount.tsx` (~80 LOC) — 화폐 금액 표시
  공용 컴포넌트.
- `SettlementDetailDrawer`의 `BreakdownLine` 본체 — 기존 `<span>{formatMoney(...)}</span>`
  → `<MoneyAmount ... convertedKRW={...} />`.
- 호출부 (작가 정산 / 갤러리 수수료 / 플랫폼 수수료) 3곳에 `fxRate={settlement.fxRateUsed}`
  추가 — 외화 거래 시 즉석 환산 활성화.
- `TaxDetailDrawer`도 동일 패턴 (VAT / 원천세 2곳).

### MoneyAmount 컴포넌트 정책
```tsx
<MoneyAmount
  amount={1000}              // 원통화 amount
  currency="USD"             // 통화
  convertedKRW={1375000}     // (선택) KRW 환산값
  emphasized                 // (선택) 메인 라인 강조
  muted                      // (선택) dim 톤
  align="right"              // (기본 right)
/>
```

세 가지 케이스:
1. **KRW 거래** → 단일 라인 `₩48,200,000` (기존과 동일)
2. **외화 + convertedKRW 있음** → 메인 `USD 1,000` + 보조 `≈ ₩1,375,000` (작은 회색)
3. **외화 + convertedKRW 부재** → 메인 `EUR 8,200` + 보조 `환산 정보 없음` (amber)

### Settlement BreakdownLine 변경
```tsx
function BreakdownLine({ label, pct, amount, currency, fxRate, ... }) {
  const convertedKRW = currency !== "KRW" && typeof fxRate === "number"
    ? Math.round(amount * fxRate)
    : undefined;
  return (
    <div className="flex justify-between">
      <span>{label} {pct && `${Math.round(pct*100)}%`}</span>
      <MoneyAmount amount={amount} currency={currency} convertedKRW={convertedKRW} ... />
    </div>
  );
}
```

→ 외화 거래에서 작가 정산 / 갤러리 수수료 / 플랫폼 수수료 각각이 `USD 600` +
`≈ ₩825,000` 형태로 표시. 사용자가 한 줄에서 원통화 + KRW 동시 인지.

### 핵심 계산 로직 0줄
- `Math.round(amount * fxRate)` 즉석 계산은 view layer에서만
- Settlement.artistShare / galleryShare / platformFee 본체 값은 store가 계산
  (STEP 14)한 그대로 — 0줄 변경
- TaxRecord.vatAmount / withholdingAmount 본체 값도 store 계산 그대로
- `fxRateUsed`는 STEP 34에서 propagate된 read-only 필드 — 본 STEP에서 변경 0

### "Net" 의미
사용자 spec "Settlement Currency-aware Net"의 "net"은 정산 분배 (작가 정산 /
갤러리 수수료 / 플랫폼 수수료)를 의미. KRW 통합 view에서 각 항목의 KRW 환산값을
즉시 인지 가능 — 갤러리 운영자가 "이번 정산에서 작가에게 KRW 얼마 보내는지"
계산기 없이 확인 가능.

---

## 1. 현재 코드 분석

| 항목 | 진입 시점 (STEP 35 baseline) | 종료 시점 |
|---|---|---|
| ReportingDrawer 기간 필터 | 부재 (전체 데이터만) | 4 preset chip + custom date range |
| Reporting CSV / PDF Export | 부재 | 두 format dispatcher + footer 버튼 |
| Settlement / Tax 외화 표시 | currency 단일 amount만 | 외화일 때 보조 KRW 환산 라벨 |
| MoneyAmount 공용 컴포넌트 | 부재 | 신규 재사용 가능 helper |
| 도메인 store / 핵심 계산 / FX provider | STEP 31~34 그대로 | **무수정** |
| 기존 ReportingDrawer KPI/Currency/Status sections | 정상 | **무수정** (filter chain만 추가) |
| 다른 모든 drawer / sidebar / audit | 그대로 | **무수정** |

---

## 2. STEP별 변경 요약

### STEP 35.5
| 영역 | 변경 |
|---|---|
| `src/lib/reporting-aggregates.ts` | + types (ReportingTimePreset / ReportingTimeFilter) + 4 helper (resolveTimeRange / filterByTimeRange / formatTimeFilterLabel / formatLocalISODate / inRange) — ~85 LOC |
| `ReportingDrawer` | + state (timeFilter useState, isOpen 변경 시 reset) + filter chain in useMemo + TimeFilterBar JSX + 신규 sub-component TimeFilterBar |

### STEP 35.6
| 영역 | 변경 |
|---|---|
| 신규 `src/lib/reporting-export.ts` | ~280 LOC. exportReportingAsCSV / exportReportingAsPDF / buildReportingHTML / triggerDownload / escapeHTML / formatNowKR / buildReportFilename / public dispatcher exportReporting |
| `ReportingDrawer` | + import + handleExport useCallback + footer 영역에 ExportButton 2개 (CSV / PDF) + 신규 sub-component ExportButton |

### STEP 36
| 영역 | 변경 |
|---|---|
| 신규 `src/components/shared/MoneyAmount.tsx` | ~80 LOC. MoneyAmount component + formatKRWInline / formatForeignAmount helpers |
| `SettlementDetailDrawer` | + MoneyAmount import. BreakdownLine 호출부 3곳에 fxRate prop 추가. BreakdownLine signature/body 업데이트 — fxRate prop 추가 + amount 표시를 MoneyAmount로 대체 |
| `TaxDetailDrawer` | + MoneyAmount import. BreakdownLine 호출부 2곳에 fxRate prop 추가. BreakdownLine signature/body 업데이트 — 동일 패턴 |

---

## 3. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/lib/reporting-aggregates.ts` | + ReportingTimePreset / ReportingTimeFilter / EMPTY_REPORTING_TIME_FILTER types + 4 helpers (~85 LOC). 기존 ReportingAggregates / computeReportingAggregates / display helper 0줄 변경. |
| `src/components/reporting/ReportingDrawer.tsx` | + 4 import (filterByTimeRange / resolveTimeRange / formatTimeFilterLabel / EMPTY_REPORTING_TIME_FILTER + types) + reporting-export import. + timeFilter state + reset effect. + handleExport useCallback. JSX에 TimeFilterBar 1줄, footer에 ExportButton 2개. + 신규 sub-component TimeFilterBar (~85 LOC) + ExportButton (~25 LOC). 기존 KPISection / CurrencyBreakdownSection / StatusSummarySection / FootnoteSection / DisclaimerBanner 0줄 변경. |
| `src/components/settlement/SettlementDetailDrawer.tsx` | + MoneyAmount import. BreakdownLine 호출부 3곳에 fxRate 1줄 추가. BreakdownLine 본체 — fxRate prop 추가 + 즉석 convertedKRW 계산 + 기존 `<span>{formatMoney(...)}</span>` → `<MoneyAmount .../>`. ~30 LOC 변경. 도메인 액션 / Section header / FXReferencePanel / Audit trail / footer 0줄 변경. |
| `src/components/tax/TaxDetailDrawer.tsx` | 동일 패턴. BreakdownLine 호출부 2곳 + 본체 변경. ~25 LOC 변경. |
| `ARCHITECTURE.md` | STEP 35.5 + 35.6 + 36 통합 changelog |

---

## 4. 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/reporting-export.ts` | 280 | CSV / PDF export. STEP 25 audit-export.ts 패턴 차용. 입력은 ReportingAggregates + ReportExportContext (timeFilterLabel 1 필드). public dispatcher `exportReporting(format, agg, ctx)`. CSV는 멀티 섹션 (헤더 / 핵심 지표 / 통화별 / 상태별), Excel UTF-8 BOM 포함. PDF는 HTML write + window.print, Pretendard 친화 inline CSS. mock FX 시 amber 경고. "회계 확정 / 세무 신고 / 법적 효력" 표현 0건. |
| `src/components/shared/MoneyAmount.tsx` | 80 | 화폐 금액 표시 공용 컴포넌트. KRW 단일 라인 / 외화 + convertedKRW 보조 라인 / 외화 + 환산 정보 없음 amber. emphasized / muted / align props. formatKRWInline / formatForeignAmount helpers 함께 export. |
| `STEP_35_5_35_6_36_REPORTING_MONEY_FLOW_BUNDLE_COMPLETE.md` | 본 문서 |

---

## 5. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/types/invoice.ts` / `src/types/settlement.ts` / `src/types/tax.ts` / `src/types/fx.ts` | 0줄 — 도메인 타입 무관 |
| `src/lib/fx-provider.ts` (STEP 31) | 0줄 — FX 환율 계산 자체는 store action에서 끝남, view는 read-only |
| `src/store/useArtworkStore.ts` | 0줄 — 본 사이클은 view layer만 |
| Mock data | 0줄 |
| `src/lib/audit-*` (STEP 20/21/24/25) | 0줄 — audit 영역 무관 |
| `src/components/audit/*` (STEP 20/21/23/24/25/26) | 0줄 |
| `src/components/layout/Sidebar.tsx` (STEP 40 / 35) | 0줄 |
| `src/components/reporting/ReportingDrawer.tsx`의 KPISection / CurrencyBreakdownSection / StatusSummarySection / FootnoteSection / DisclaimerBanner | 0줄 — filter / export 추가만 |
| `src/components/settlement/SettlementDetailDrawer.tsx`의 Section header (totalAmount 표시) / FXReferencePanel / Audit trail / Status pill / footer | 0줄 |
| `src/components/tax/TaxDetailDrawer.tsx`의 동일 영역 | 0줄 |
| 다른 모든 drawer / Detail Panel / Persistence / Market Data / AI / 3-Column 레이아웃 / RBAC / `package.json` | 0줄 |

---

## 6. 핵심 코드

### 6.1 STEP 35.5 — Time filter chain

```ts
// Pure helpers (reporting-aggregates.ts)
export function resolveTimeRange(filter, now = new Date()): { start, end } | null {
  if (filter.preset === "ALL") return null;
  if (filter.preset === "CUSTOM") {
    if (!filter.customStart || !filter.customEnd) return null;
    return { start: filter.customStart, end: filter.customEnd };
  }
  // THIS_MONTH / THIS_QUARTER → local time month/quarter boundaries
}

export function filterByTimeRange(invoices, settlements, taxRecords, range) {
  if (range === null) return { invoices, settlements, taxRecords };
  return {
    invoices: invoices.filter((i) => inRange(i.issuedAt, range.start, range.end)),
    settlements: settlements.filter((s) => inRange(s.createdAt, range.start, range.end)),
    taxRecords: taxRecords.filter((t) => inRange(t.createdAt, range.start, range.end)),
  };
}
```

### 6.2 STEP 35.6 — Export dispatcher

```ts
export function exportReporting(
  format: ReportExportFormat,
  agg: ReportingAggregates,
  ctx: ReportExportContext
): void {
  if (format === "csv") exportReportingAsCSV(agg, ctx);
  else exportReportingAsPDF(agg, ctx);
}
```

### 6.3 STEP 36 — MoneyAmount component

```tsx
export function MoneyAmount({ amount, currency, convertedKRW, emphasized, muted, align="right" }) {
  const isKRW = currency === "KRW";
  const mainText = isKRW ? formatKRWInline(amount) : formatForeignAmount(amount, currency);
  const mainCls = cn("tabular-nums tracking-tight2",
    emphasized ? "text-[14px] text-ink font-semibold"
    : muted ? "text-[13px] text-ink-subtle"
    : "text-[13px] text-ink-muted");

  if (isKRW) return <span><span className={mainCls}>{mainText}</span></span>;

  return (
    <span className="flex flex-col items-end">
      <span className={mainCls}>{mainText}</span>
      {convertedKRW !== undefined ? (
        <span className="text-[10.5px] text-ink-subtle mt-0.5">≈ {formatKRWInline(convertedKRW)}</span>
      ) : (
        <span className="text-[10px] text-amber-700 mt-0.5">환산 정보 없음</span>
      )}
    </span>
  );
}
```

### 6.4 Settlement BreakdownLine 변경

```tsx
function BreakdownLine({ label, pct, amount, currency, fxRate, emphasized, muted }) {
  const convertedKRW = currency !== "KRW" && typeof fxRate === "number"
    ? Math.round(amount * fxRate)
    : undefined;

  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-[12.5px] tracking-tightish ...">{label}</span>
        {pct !== null && <span>{Math.round(pct*100)}%</span>}
      </div>
      <MoneyAmount amount={amount} currency={currency} convertedKRW={convertedKRW}
                   emphasized={emphasized} muted={muted} />
    </div>
  );
}
```

---

## 7. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    83.5 kB         171 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 35 (Multi-currency Reporting) | 79.5 kB | — |
| **STEP 35.5 + 35.6 + 36 (Bundle)** | **83.5 kB** | **+4.0** |

`tsc --noEmit` 0 error / `next build` 0 warning. **외부 npm 의존성 0개**.

---

## 8. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_3** Money Flow 분리 | ✅ | Settlement / Tax 분배 항목별 KRW 환산이 inline 노출 — 도메인 분리 시각적 강화 |
| **rule_4** Trust Layer | ✅ | fxSnapshot 부재 시 "환산 정보 없음" 명시 — trust 신호 |
| **rule_7** RBAC | ✅ 0줄 | report.view_global Manager 이상 (STEP 35 그대로) |
| **rule_14 / rule_17** Layout / Layer | ✅ 0줄 | Drawer 내부 변경만 |
| **rule_20** FX | ✅ | fxSnapshot lock 시점 환율 read-only 활용 — 변경 0 |
| 핵심 계산 로직 변경 | ✅ 0줄 | Settlement / Tax / Payment 분배 / 세금 계산 모두 store action에서 끝, view는 즉석 환산만 |
| Invoice LOCK / FX Snapshot 로직 | ✅ 0줄 | |
| 3-column 레이아웃 변경 | ✅ 0줄 | |
| 신규 외부 API 호출 | ✅ 0건 | |
| 외부 라이브러리 추가 | ✅ 0개 | window.print + Blob + URL.createObjectURL — 모두 표준 브라우저 API |
| 보고서 Drawer 중심 | ✅ | Settlement / Tax drawer는 표시 polish만 |
| Build 통과 | ✅ | |
| "회계 확정" / "세무 신고 완료" / "법적 효력" 표현 금지 | ✅ | grep 검증 — UI 노출 텍스트 0건. 부정형 / 주석 / 라벨 정책 명시만 사용 |
| Time filter — 전체 / 이번 달 / 이번 분기 / 사용자 지정 | ✅ |
| KPI / Currency / Status 필터 결과 기준 재계산 | ✅ | useMemo chain |
| STEP 24 AuditFilterBar 패턴 참고 | ✅ | chip + native date input — 동일 패턴 |
| Export CSV / PDF | ✅ |
| STEP 25 audit-export 패턴 재활용 | ✅ | triggerDownload / window.print HTML / escape helpers |
| "운영 참고 리포트" 문구 유지 | ✅ | CSV 헤더 / PDF h1 / Drawer 헤더 |
| Export 필터 적용 결과 기준 | ✅ | aggregates는 timeFilter 적용 후 계산 → handleExport에 그대로 전달 |
| Settlement / Tax 원통화 + KRW 환산 명확 구분 | ✅ | 외화 거래 시 메인 라인 + 보조 라인 (≈ ₩…) |
| display helper / view layer 중심 | ✅ | MoneyAmount 공용 컴포넌트 — 도메인 의존 0 |
| invoice.fxSnapshot / settlement.convertedTotalKRW / taxRecord.taxableAmountKRW read-only 참조 | ✅ |

---

## 9. 검증 시나리오

### A — STEP 35.5 Preset 전환
1. Manager 권한 → "보고서" → ReportingDrawer 진입
2. TimeFilterBar에서 "이번 달" 클릭
3. **기대**: KPI 카드 / Currency table / Status 카드 모두 즉시 재계산 — 이번 달 invoice/settlement/tax만 합산. 라벨 "이번 달 · 2026-05-01 ~ 2026-05-31" 표시.

### B — STEP 35.5 Custom range
1. "사용자 지정" 클릭 → 시작일 / 종료일 input 노출
2. 시작일 = 2026-04-01, 종료일 = 2026-04-30 입력
3. **기대**: 4월에 발생한 데이터만 합산. 라벨 "2026-04-01 ~ 2026-04-30".

### C — STEP 35.5 Drawer 닫기 후 재오픈
1. 필터 적용 → 닫기 → 다시 열기
2. **기대**: 필터 reset (ALL). isOpen 변경 effect 트리거.

### D — STEP 35.6 CSV Export
1. 필터 "이번 달" 적용 후 footer "CSV" 클릭
2. **기대**: `axvela-reporting-{timestamp}.csv` 다운로드. Excel에서 한글 정상 표시 (BOM). 헤더 "운영 참고 리포트" / 기간 라벨 / 핵심 지표 4행 / 통화별 행 / 상태별 행 모두 포함.

### E — STEP 35.6 PDF Export
1. footer "PDF" 클릭
2. **기대**: 새 창 열림 → 자동 print 다이얼로그. "운영 참고 리포트" h1 / 메타 (생성 시각 / 기간 / 기준) / 4 표 (핵심 지표 / 통화별 / 상태별) / footnote.

### F — STEP 35.6 Mock FX 표시
1. 외화 invoice 발송 (mock_fx_v1 fxSnapshot)
2. CSV / PDF export
3. **기대**:
   - CSV: `FX 데이터,mock provider (mock_fx_v1) — 실 환율과 차이 가능` 헤더 줄
   - PDF: amber `⚠ 현재 FX provider는 mock 데이터입니다 (mock_fx_v1) ...`

### G — STEP 35.6 0건 disabled
1. Custom range를 미래 날짜로 → invoice 0건
2. **기대**: 두 export 버튼 disabled (`opacity-50 cursor-not-allowed`).

### H — STEP 35.6 표현 검증
1. Export 결과 (CSV / PDF) 직접 열어 텍스트 검색
2. **기대**: "회계 확정 완료" / "세무 신고 완료" / "법적 효력" 0건. "운영 참고용 / 회계 확정 또는 세무 신고와 무관" 같은 부정형만.

### I — STEP 36 외화 settlement 표시
1. USD 거래 + Settlement 생성 (STEP 34 자동 fxRateUsed propagate)
2. SettlementDetailDrawer 열기 → "분배 내역"
3. **기대**: "작가 정산 60% USD 600 (≈ ₩825,000)" 형태. 갤러리 수수료도 동일.

### J — STEP 36 KRW settlement 표시
1. KRW 거래 settlement
2. **기대**: 기존과 동일. 단일 라인 `₩28,500,000`. 보조 라인 미렌더.

### K — STEP 36 fxRate 부재
1. 외화 거래에서 어떤 이유로 fxRateUsed 부재 (이론상 STEP 34 cascade로 채워지지만 edge case)
2. **기대**: 메인 라인 USD 1,000 + 보조 "환산 정보 없음" amber.

### L — STEP 36 Tax 동일 패턴
1. 외화 tax record (Settlement → Tax cascade)
2. TaxDetailDrawer 열기 → "세금 내역"
3. **기대**: "부가세 (VAT) 10% USD 100 (≈ ₩137,500)".

### M — Persistence 호환
1. F5 새로고침
2. **기대**: timeFilter / drawer state UI 영속 안 됨 (의도). 도메인 데이터 (invoice / settlement / tax / fxSnapshot) 영속.

### N — 도메인 흐름 무영향
1. invoice 발송 / settlement 생성 / tax issue / payment register 등
2. **기대**: 본 묶음 변경이 도메인 store 흐름에 0영향. 모든 cascade / timeline / FX 계산 v34+STEP24+STEP26+STEP40+STEP35 baseline과 동일.

### O — Audit drawer 무영향
1. AuditLogDrawer / GlobalAuditDrawer
2. **기대**: STEP 24 6-axis 필터 + STEP 26 시각화 정상.

### P — Sidebar 무영향
1. STEP 40 disabled 항목들 / "보고서" 항목 (STEP 35) / RoleSwitcher / SyncStatus
2. **기대**: 모두 정상.

---

## 10. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| Time filter persistence 부재 | drawer 닫혔다 열면 reset — 의도된 동작 | 향후 Saved Filter Preset (STEP 38) 패턴 적용 가능 |
| Time filter 작년 / 작분기 미지원 | preset 4개만 (전체/이번 달/이번 분기/사용자 지정) | 사용자 지정으로 충분 — 추후 확장 가능 |
| Currency mismatch warning 부재 | invoice 환율과 settlement 환율이 다를 때 (이론상 같지만 edge case) 경고 안 함 | 후속 reconciliation STEP |
| PDF는 사용자 print 다이얼로그 의존 | "PDF로 저장"은 사용자가 print 다이얼로그에서 선택 | 인라인 PDF generation 라이브러리 도입 시 가능 (현재는 외부 라이브러리 0 정책) |
| MoneyAmount는 settlement/tax drawer만 적용 | invoice drawer / 다른 곳은 그대로 | 점진 확산 가능 — 본 STEP은 사용자 spec "Settlement / Tax 표시" 한정 |
| Time filter는 issuedAt/createdAt만 | sentAt / paidAt / settledAt / issuedAt 별도 차원 부재 | 후속 STEP에서 고급 필터 추가 가능 |
| Tax의 taxableAmountKRW은 STEP 34 helper 사용, 즉석 환산 안 함 | display는 fxRateUsed로 즉석 — 양쪽 결과 일치 (Math.round 차이만 가능) | reconciliation STEP에서 검증 |
| CSV의 "비고" 컬럼은 한국어만 | i18n 부재 | 향후 |
| PDF 다국어 폰트 fallback | Pretendard 없으면 시스템 폰트 — 일부 글자 깨질 수 있음 | 향후 폰트 embed |

---

## 11. 다음 STEP 후보

본 사이클로 Reporting / Money Flow view layer 완성. 자연스러운 후속:

1. **STEP 33 — Real FX Provider** — OpenExchangeRatesProvider 실 구현. 본
   STEP 35.6 export footer의 mock 경고가 자연스럽게 사라짐.
2. **STEP 41 — Collector View** — STEP 40 "준비 중" 항목 활성화. 고객별 보유
   작품 + 거래 이력.
3. **STEP 38 — Saved Filter Preset** — audit + reporting 둘 다 적용 가능한
   범용 preset 시스템.
4. **STEP 28 — Real AI Integration** — 실 AI API.
5. **STEP 27.5 — IndexedDBAdapter** — localStorage 5MB 한계 해소.
6. **STEP 39 — Audit Heatmap** — 7일 × N주 grid heatmap.
7. **STEP 37 — Document Approval Workflow** — Contract / Curation multi-step.
8. **STEP 35.7 — Reporting Drill-down** — KPI 카드 클릭 시 해당 invoice/settlement
   리스트로 진입.
