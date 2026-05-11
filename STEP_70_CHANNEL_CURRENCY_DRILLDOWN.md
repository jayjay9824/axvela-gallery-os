# STEP 70 — Channel Mix / Currency Breakdown Drilldown Expansion

> **목표**: STEP 67의 4-piece reusable architecture를 그대로 재사용하여
> Reporting의 Channel Mix 섹션 + Currency Breakdown 섹션에 drilldown 확장.
> Reporting metrics 모두 *passive 숫자 표시*에서 *연결 객체 list → 작품 navigate*
> 흐름으로 전환.
> **2번째 drilldown 시스템 0개 · Reporting UI redesign 0건 · 모든 보호 도메인 0줄**

---

## State

- **이전**: STEP 67 / Route 136 kB
- **이번**: STEP 70 / **Route 138 kB (+2 kB)**
- Build ✅ · type-check ✅ · Lint ✅

---

## 핵심 사상

```
[BEFORE STEP 67]
Reporting KPI cards → drilldown (4 cards)
Reporting Channel Mix / Currency Breakdown → 단순 표시 그대로

[AFTER STEP 70]
Reporting Channel Mix top-line 3 카드 → drilldown
Reporting Channel Mix 채널별 row × 3 metric → drilldown (source inherit)
Reporting Currency Breakdown 통화별 row → drilldown (currency inherit)

→ Reporting 모든 숫자가 클릭 가능. operational graph navigation 완성.
```

**핵심 제약 준수**: STEP 67 4-piece (types + resolver + drawer + ClickableMetric) 그대로 재사용 — *2번째 drilldown 시스템 0개* (사용자 spec).

---

## 신규 도메인 4개

| 도메인 | 입력 | 출력 columns |
|---|---|---|
| `reporting_channel_inquiries` | period + optional source | 작품 / 고객 / 채널 / 상태 / 접수일 |
| `reporting_channel_customers` | period + optional source (primarySource) | 고객 / segment / primary 채널 / 최근 활동 / 문의 / 거래 |
| `reporting_channel_deals` | period + optional source (first-touch) | 작품 / 고객 / 금액 / 채널 / 상태 / invoice |
| `reporting_currency_breakdown` | period + currency | 작품 / 고객 / 통화 단위 / KRW 환산 / 상태 / 발행 |

---

## Payload 필드 추가

```ts
export interface DrilldownPayload {
  // ... 기존 필드들
  /** STEP 70 — Channel Mix drilldown 시 inherits 채널 (InquirySource string) */
  source?: string;
  /** STEP 70 — Currency Breakdown drilldown 시 inherits 통화 (Currency string) */
  currency?: string;
}
```

`InquirySource` / `Currency` enum을 직접 import하지 않고 `string`으로 보유 — type 모듈 의존성 회피, resolver가 sanity check.

---

## Resolver 로직 요약

### `resolveReportingChannelInquiries`
```ts
state.inquiries
  .filter(i => isInPeriod(i.createdAt) && (!source || i.source === source))
  .sort(createdAt desc)
  → row { artwork, customer (collectorName), source label, status (tone), createdAt }
```

### `resolveReportingChannelCustomers`
```ts
const periodInquiries = state.inquiries.filter(period filter)
const periodTransactions = state.transactions.filter(period filter)
deriveCustomers(periodInquiries, periodTransactions, {})  // 빈 fxLookup
  .filter(c => !source || c.primarySource === source)
  .sort(lastInteractionAt desc)
  → row { customer, segment, primary 채널, 최근 활동, inquiry 수, 거래 수 }
  artworkId = c.ownedArtworkIds[0] (없으면 row non-clickable)
```

### `resolveReportingChannelDeals` (First-Touch Attribution)
```ts
// inquiry pool은 period 무관 사용 — channel 추정은 첫 inquiry까지 거슬러야 함
const inquiriesByArtwork = group state.inquiries by artworkId

state.transactions
  .filter(tx => isInPeriod(tx.createdAt))
  .filter(tx => !source || attributeTransactionSource(tx, inquiriesByArtwork) === source)

attributeTransactionSource(tx):
  if tx.inquiryId → 직접 inquiry source 사용
  else → 같은 작품의 가장 이른 inquiry source 사용
```

### `resolveReportingCurrencyBreakdown`
```ts
state.invoices
  .filter(inv => (!currency || inv.currency === currency) && isInPeriod(inv.sentAt ?? inv.issuedAt))
  → row {
       artwork,
       customer (Transaction lookup → buyerName),
       통화 단위 amount,
       KRW 환산: KRW direct / fxSnapshot * amount / "환산 정보 부족" warning,
       status (tone),
       date
     }
```

---

## Reporting Integration Sites

### Channel Mix 섹션

| Site | Domain | Source Inherit |
|---|---|---|
| Top-line "문의 (총)" StatCard | `reporting_channel_inquiries` | undefined (전체) |
| Top-line "고객 (derive)" StatCard | `reporting_channel_customers` | undefined |
| Top-line "거래 (총)" StatCard | `reporting_channel_deals` | undefined |
| Bucket row inquiry count cell × N 채널 | `reporting_channel_inquiries` | b.source |
| Bucket row customer count cell × N 채널 | `reporting_channel_customers` | b.source |
| Bucket row transaction count cell × N 채널 | `reporting_channel_deals` | b.source |

각 metric은 `count > 0`일 때만 클릭 가능 (`ClickableMetric` disabled prop).

### Currency Breakdown 섹션

| Site | Domain | Currency Inherit |
|---|---|---|
| 통화 row 전체 (행 단위 클릭) | `reporting_currency_breakdown` | b.currency |

`<tr onClick>` + `role="button"` + `tabIndex` + Enter/Space keyboard support 부착. count 0인 통화는 non-clickable (안전 가드).

**총 신규 클릭 site 수**: top-line 3 + 채널 N(보통 6) × 3 metric + 통화 N(보통 1~4) row ≈ **22+개** site.

---

## Filter Sync (STEP 67 패턴 확장)

```tsx
// ReportingDrawer 안 — STEP 67에서 이미 정착된 outer-scope useMemo
const range = useMemo(() => resolveTimeRange(timeFilter), [timeFilter]);

// STEP 70 — Channel Mix / Currency 섹션에 props 추가 전달만
<CurrencyBreakdownSection
  ...existing props
  timeRangeStart={range?.start}
  timeRangeEnd={range?.end}
/>
<ChannelMixSectionView
  channelMix={aggregates.channelMix}
  timeRangeStart={range?.start}
  timeRangeEnd={range?.end}
/>

// drilldown payload에 자연 inherit
openDrilldown({
  domain: "reporting_channel_inquiries",
  source: b.source,
  periodFromIso: timeRangeStart,
  periodToIso: timeRangeEnd,
});
```

기존 `range` outer-scope는 STEP 67에서 정착됨 — 본 STEP은 props 호출 site 추가만.

---

## 변경 / 신규 파일

### 신규 (1)

| 파일 | LOC | 역할 |
|---|---|---|
| `STEP_70_CHANNEL_CURRENCY_DRILLDOWN.md` | (이 문서) | 완료 보고 |

### 변경 (3 + ARCHITECTURE.md)

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/types/drilldown.ts` | ~30 LOC | DrilldownDomain 4개 추가 + Payload source/currency 필드 |
| `src/lib/drilldown-resolver.ts` | ~350 LOC | 4 resolver 함수 + first-touch attribution + currency conversion + import deriveCustomers |
| `src/components/reporting/ReportingDrawer.tsx` | ~250 LOC | ChannelMixSectionView / ChannelMixTable / CurrencyBreakdownSection — props 추가 + ClickableMetric wrap |

---

## Drilldown Flow 예시

### Channel Mix 시나리오

```
[1] ReportingDrawer 열림 (Owner+)
[2] timeFilter: "이번 달"
[3] aggregates.channelMix bucket "EMAIL" — inquiry 12건
[4] 운영자: EMAIL row의 "문의 12" cell hover → ring-1 + bg-surface-muted/50
[5] 클릭 → openDrilldown({
      domain: "reporting_channel_inquiries",
      source: "EMAIL",
      periodFromIso: "2026-05-01",
      periodToIso: "2026-05-31"
    })
[6] OperationalDrilldownDrawer 열림 (820px)
    ┌─────────────────────────────────────────────────┐
    │ Channel Mix — 이메일 · 문의                       │
    │ 12건 · 기간: 2026-05-01 ~ 2026-05-31             │
    ├─────────────────────────────────────────────────┤
    │ 작품          고객        채널    상태   접수일    │
    │ The Shore   김xx       이메일  ●OPEN  05-12     │
    │ Quiet Hour  Lee xx     이메일  ●RESP  05-08     │
    │ ...                                              │
    ├─────────────────────────────────────────────────┤
    │ 12건 · 작품 클릭 시 상세 보기로 이동                │
    └─────────────────────────────────────────────────┘
[7] 운영자: "Quiet Hour" row 클릭
[8] setSelectedArtwork → closeDrilldown → DetailPanel sync
```

### Currency Breakdown 시나리오

```
[1] Reporting → "통화별 매출 분포" 표
    │ 통화  건수  통화 단위 합계        KRW 환산        │
    │ KRW   23    ₩45,200,000          ₩45,200,000   │  ← 클릭
    │ USD   5     USD 18,000            ₩24,300,000   │  ← 클릭
[2] USD row 클릭 → openDrilldown({
      domain: "reporting_currency_breakdown",
      currency: "USD",
      periodFromIso, periodToIso
    })
[3] drilldown drawer
    │ 통화 기준 · USD                                 │
    │ 5건 · 기간: 2026-05-01 ~ 05-31                  │
    │ 작품  고객  통화 단위    KRW 환산   상태   발행 │
    │ ...   ...   USD 4,800   ₩6,480,000  PAID  ... │
```

---

## 검증 매트릭스

### 사용자 spec 9개 검증 항목

| 항목 | 결과 |
|---|---|
| 4개 신규 domain 추가 | ✅ enum 4개 |
| Resolver 4개 함수 + dispatch | ✅ 모두 기존 4-piece 인프라 재사용 |
| Reporting UI 통합 (3 top-line + 채널×3 + 통화 row) | ✅ ~22+ site |
| Payload (source / currency / period) | ✅ |
| Artwork-centric navigation | ✅ row.artworkId 있는 도메인은 navigate |
| Non-clickable row (artworkId 부재) | ✅ disabled / read-only |
| Institutional minimalism | ✅ Reporting markup 보존, ClickableMetric wrap만 |
| Build / type-check / lint | ✅ Route 138 kB |
| 표현 정책 영어 (official accounting / certified financial report / investment recommendation / guaranteed revenue / legal accounting) | ✅ 0건 (정책 주석에서만) |

### 사용자 spec 9개 제약

| 제약 | 결과 |
|---|---|
| 기존 STEP 67 architecture 재사용 (4-piece) | ✅ types / resolver / drawer / ClickableMetric 그대로 |
| 2번째 drilldown 시스템 | ✅ 0개 |
| Reporting UI redesign | ✅ 0건 (markup 보존) |
| Payment / Settlement / Tax / FX 계산 로직 | ✅ 0줄 |
| Persistence schema | ✅ 0줄 |
| Logistics / Documents / Image / AI 도메인 | ✅ 0줄 |
| 외부 라이브러리 | ✅ 0개 |
| Build / type-check / lint | ✅ |
| 3-column / DetailPanel | ✅ 0줄 |

---

## Affected Domains Verification

| Domain | 변경 |
|---|---|
| Payment / Settlement / Tax | 0줄 |
| FX (STEP 31 / 32 / 34) | 0줄 (resolver는 fxSnapshot.rate read-only) |
| AI Market Analysis | 0줄 |
| Backup / Restore (STEP 52 / 59 / 65) | 0줄 |
| Image Lifecycle (STEP 53 / 57 / 61 / 62) | 0줄 |
| Logistics provider (STEP 50 / 54 / 58) | 0줄 |
| Documents Hub (STEP 51) | 0줄 |
| Customer (STEP 42) | 0줄 (deriveCustomers는 import만, 함수 0줄 변경) |
| System Audit (STEP 65) | 0줄 |
| OperationalDrilldownDrawer / ClickableMetric (STEP 67) | 0줄 (재사용) |

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_1** Artwork-First | row 클릭은 항상 setSelectedArtwork. customer drilldown도 ownedArtworkIds[0]로 navigate | ✅ 강화 |
| **rule_4** Trust Layer | drilldown은 read-only consumer — destructive 0건 | ✅ 보존 |
| **rule_8** Timeline = Navigation 확장 | Reporting 모든 metric → 연결 객체 → 작품 → 다음 액션 | ✅ **확장 완성** |
| **rule_14** 3-Column | 0줄 | ✅ |
| **rule_15** Max 3 buttons | drawer footer "닫기" 1개 그대로 | ✅ |
| **rule_16** institutional minimalism | KPI 카드 / Channel Mix bar / Currency 표 markup 보존 | ✅ |
| **rule_17** Drawer/Modal Layer | overlay drawer (3-column 위 stack) | ✅ |

---

## 다음 STEP 후보

```
STEP 71  Customer drilldown — CustomerViewDrawer의 inquiry/purchase/owned counts → drilldown
STEP 72  Documents Hub tab counts → drilldown
STEP 73  Sidebar 작품 status 카운트 → drilldown
STEP 74  ImageCleanup orphan row → "외부 저장소에서 제거 요청" inline action
```

각 STEP은 STEP 67 4-piece 인프라 + STEP 70 패턴 그대로 활용 가능 — `DrilldownDomain` 추가 + resolver 함수 1개 + 호출 site wrap.

---

## 결과 요약

- 신규 파일 1개 (이 문서)
- 변경 파일 3개 (drilldown types + resolver + ReportingDrawer)
- 4개 신규 domain (channel inquiries / customers / deals + currency breakdown)
- ~22+ 신규 클릭 site (top-line 3 + 채널×3 + 통화 row)
- 0 신규 라이브러리 / 0 schema / 0 visual redesign / 0 도메인 로직 변경
- STEP 67 4-piece 인프라 그대로 재사용 (drawer / ClickableMetric / store action 0줄)
- Filter sync 자연 확장 — Reporting 전 영역 (KPI + Channel + Currency)
- Artwork-centric navigation 보존 — 모든 row 클릭이 작품으로 returns
- First-touch attribution helper — STEP 47 computeChannelMix와 일관
- Route +2 kB (136 → 138 kB)

**STEP 70 완료. AXVELA Reporting의 모든 metric이 operational graph node로 활성화.**
