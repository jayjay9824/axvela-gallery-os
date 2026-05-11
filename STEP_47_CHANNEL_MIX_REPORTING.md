# STEP 47 — Channel Mix Reporting

> **목표**: STEP 35 ReportingDrawer를 commerce 단일 view에서 commerce + acquisition
> dual-view로 확장. Customer / Inquiry derive 활용해 갤러리 단위 유입 채널 분포
> 추가 — 운영자가 "어떤 채널에서 문의 / 고객 / 거래가 발생하는지" 한눈에 파악.

---

## State

- **이전**: STEP 46 / Route 101 kB
- **이번**: STEP 47 / **Route 103 kB (+2 kB)**
- Build ✅ · type-check ✅ (`tsc --noEmit` 0 error)

---

## Flow

```
ReportingDrawer (Manager 이상, report.view_global)
  │  Time Filter (ALL / THIS_MONTH / THIS_QUARTER / CUSTOM)
  │
  ├─ KPI Section            (기존 STEP 35)
  ├─ Currency Breakdown     (기존 STEP 35)
  ├─ Status Summary         (기존 STEP 35)
  │
  └─ Channel Mix            ← STEP 47 신규 ────────────────────┐
       │                                                       │
       │ 입력 (모두 time-filtered):                            │
       │ • inquiries (createdAt 기준)                          │
       │ • transactions (createdAt 기준)                       │
       │ • customers ← deriveCustomers(inq, tx, fxLookup)      │
       │                                                       │
       │ Aggregator: computeChannelMix(inquiries, tx, customers)│
       │                                                       │
       │ - Inquiry count: inquiry.source 직접 카운트           │
       │ - Customer count: customer.primarySource 카운트       │
       │ - Transaction count: First-touch 어트리뷰션          │
       │   (같은 작품의 가장 이른 inquiry source)              │
       │                                                       │
       └→ ChannelMixSectionView                               │
            ├ 3 StatCard (총 문의 / 총 고객 / 총 거래)         │
            ├ ChannelMixTable (CSS bar + TOP 배지)            │
            └ unattributed footer note (있을 때)              │
                                                              │
  └─ Footnote                (기존 STEP 35) ────────────────────┘
                                                              │
                                                              ↓
  Footer: [CSV] [PDF] [닫기] ← Channel Mix 섹션 자동 포함
```

**Customer master data slice 0개** — Inquiry / Transaction에서 deriveCustomers로 derive only. Persistence schema 무관.

---

## 변경 파일 목록

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/lib/reporting-aggregates.ts` | ~140 LOC | `ChannelMixBucket` / `ChannelMixSection` 타입 + `channelMix` 필드 + `computeChannelMix` + `filterChannelInputByTimeRange` + 시그니처 확장 (optional 4번째 인자) |
| `src/components/reporting/ReportingDrawer.tsx` | ~180 LOC | inquiries/transactions hook + invoiceFxLookup memo + aggregates compute 확장 + `ChannelMixSectionView` / `StatCard` / `ChannelMixTable` / `ChannelBar` 신규 sub-component |
| `src/lib/reporting-export.ts` | ~120 LOC | INQUIRY_SOURCE_LABEL_KR + ChannelMixBucket import + CSV에 [유입 채널 분포] 섹션 + PDF에 `buildChannelMixHTML` + Channel Mix 전용 CSS |
| `ARCHITECTURE.md` | +1 changelog | STEP 47 추가 |

---

## 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `STEP_47_CHANNEL_MIX_REPORTING.md` | (이 문서) | STEP 완료 보고 |

(신규 lib / component / type 파일 없음 — 모두 기존 모듈 확장.)

---

## 핵심 코드

### 1) ChannelMix 타입 — `reporting-aggregates.ts`

```ts
export interface ChannelMixBucket {
  source: InquirySource;
  inquiryCount: number;
  customerCount: number;
  /** First-touch 어트리뷰션 — 같은 작품의 가장 이른 inquiry source 기준 */
  transactionCount: number;
  /** inquiryCount / totalInquiryCount * 100 (분모 0이면 0) */
  inquiryShare: number;
}

export interface ChannelMixSection {
  totalInquiryCount: number;
  totalCustomerCount: number;
  totalTransactionCount: number;
  /** inquiryCount 내림차순. 0/0/0 source는 제외. */
  buckets: ChannelMixBucket[];
  /** 상위 3개 source — UI 강조용 */
  topSources: InquirySource[];
  /** 같은 작품 inquiry 0건인 transaction (어트리뷰션 불가) */
  unattributedTransactionCount: number;
}

// ReportingAggregates 확장
export interface ReportingAggregates {
  // ...기존 필드
  channelMix: ChannelMixSection | null;  // 입력 부재 시 null (backward-compat)
  // ...
}
```

### 2) Pure aggregator — `computeChannelMix`

```ts
export function computeChannelMix(
  inquiries: Inquiry[],
  transactions: Transaction[],
  customers: Customer[]
): ChannelMixSection {
  // 1. Inquiry count by source
  const inquiryCountBySource: Record<string, number> = {};
  for (const i of inquiries) {
    inquiryCountBySource[i.source] = (inquiryCountBySource[i.source] ?? 0) + 1;
  }

  // 2. Customer count by primarySource (deriveCustomers 결과 활용)
  const customerCountBySource: Record<string, number> = {};
  for (const c of customers) {
    if (c.primarySource) {
      customerCountBySource[c.primarySource] =
        (customerCountBySource[c.primarySource] ?? 0) + 1;
    }
  }

  // 3. First-touch 어트리뷰션 — 작품별 가장 이른 inquiry source
  const earliestInquiryByArtwork = new Map<string, Inquiry>();
  for (const i of inquiries) {
    const prev = earliestInquiryByArtwork.get(i.artworkId);
    if (!prev || i.createdAt < prev.createdAt) {
      earliestInquiryByArtwork.set(i.artworkId, i);
    }
  }

  const transactionCountBySource: Record<string, number> = {};
  let unattributedTransactionCount = 0;
  for (const t of transactions) {
    const earliest = earliestInquiryByArtwork.get(t.artworkId);
    if (!earliest) {
      unattributedTransactionCount += 1;
      continue;
    }
    transactionCountBySource[earliest.source] =
      (transactionCountBySource[earliest.source] ?? 0) + 1;
  }

  // 4. Build buckets — union of all source sets
  const allSources = new Set<string>([
    ...Object.keys(inquiryCountBySource),
    ...Object.keys(customerCountBySource),
    ...Object.keys(transactionCountBySource),
  ]);

  const totalInquiries = inquiries.length;
  const buckets: ChannelMixBucket[] = [];
  for (const src of allSources) {
    const inq = inquiryCountBySource[src] ?? 0;
    const cus = customerCountBySource[src] ?? 0;
    const tx = transactionCountBySource[src] ?? 0;
    if (inq === 0 && cus === 0 && tx === 0) continue;
    buckets.push({
      source: src as InquirySource,
      inquiryCount: inq,
      customerCount: cus,
      transactionCount: tx,
      inquiryShare: totalInquiries > 0 ? (inq / totalInquiries) * 100 : 0,
    });
  }

  // 5. Sort: inquiryCount desc → customerCount desc → source name asc
  buckets.sort((a, b) => {
    if (b.inquiryCount !== a.inquiryCount) return b.inquiryCount - a.inquiryCount;
    if (b.customerCount !== a.customerCount) return b.customerCount - a.customerCount;
    return a.source.localeCompare(b.source);
  });

  return {
    totalInquiryCount: totalInquiries,
    totalCustomerCount: customers.length,
    totalTransactionCount: transactions.length,
    buckets,
    topSources: buckets.slice(0, 3).map((b) => b.source),
    unattributedTransactionCount,
  };
}
```

### 3) Drawer compute 확장

```tsx
// src/components/reporting/ReportingDrawer.tsx

const aggregates = React.useMemo<ReportingAggregates>(() => {
  const flatInv = Object.values(invoices).flat();
  const flatSet = Object.values(settlements).flat();
  const flatTax = Object.values(taxRecords).flat();
  const flatInq = Object.values(inquiries).flat();
  const flatTx = Object.values(transactions).flat();
  const range = resolveTimeRange(timeFilter);
  const filtered = filterByTimeRange(flatInv, flatSet, flatTax, range);
  const channelFiltered = filterChannelInputByTimeRange(flatInq, flatTx, range);
  
  // Customer는 filtered inquiries+transactions에서 derive — time filter 자동 반영
  const filteredCustomers = deriveCustomers(
    channelFiltered.inquiries,
    channelFiltered.transactions,
    invoiceFxLookup
  );
  
  return computeReportingAggregates(
    filtered.invoices,
    filtered.settlements,
    filtered.taxRecords,
    {
      inquiries: channelFiltered.inquiries,
      transactions: channelFiltered.transactions,
      customers: filteredCustomers,
    }
  );
}, [invoices, settlements, taxRecords, inquiries, transactions, invoiceFxLookup, timeFilter]);
```

### 4) UI Bar — CSS div only (외부 차트 라이브러리 0개)

```tsx
function ChannelBar({ share, isTop }: { share: number; isTop: boolean }) {
  const widthPct = Math.max(2, Math.min(100, share));
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-2 rounded-full bg-surface-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isTop ? "bg-ink" : "bg-ink-muted/60"
          )}
          style={{ width: `${widthPct}%` }}
          aria-hidden
        />
      </div>
      <span className="shrink-0 w-12 text-right text-[10.5px] tabular-nums text-ink-subtle">
        {share.toFixed(1)}%
      </span>
    </div>
  );
}
```

---

## CSV 출력 예시 (실제 mock 데이터 기준 발췌)

```
[유입 채널 분포]
유입 채널 기준 — 문의 / 거래 연결 신호 · 광고 성과 또는 매출 기여 확정과 무관
총 문의,12,총 고객 (derive),7,총 거래,4
Attribution 불가 거래,1건,비고,같은 작품 inquiry 부재
채널,문의 수,inquiry 비중(%),고객 수,거래 수(first-touch)
이메일,5,41.7,3,2
갤러리 방문,4,33.3,2,1
웹사이트,2,16.7,1,0
소개,1,8.3,1,0
상위 채널,이메일 · 갤러리 방문 · 웹사이트
```

---

## PDF 섹션 예시 (실제 렌더 발췌)

```
유입 채널 분포
총 문의 12건 · 총 고객 (derive) 7명 · 총 거래 4건 · first-touch 어트리뷰션 기준

┌─────────────────┬──────────────────────┬──────┬──────┬──────┐
│ 채널            │ inquiry 비중         │ 문의 │ 고객 │ 거래 │
├─────────────────┼──────────────────────┼──────┼──────┼──────┤
│ 이메일 [TOP]    │ ▓▓▓▓▓▓▓▓▓▓▓ 41.7%  │   5  │   3  │   2  │
│ 갤러리 방문[TOP]│ ▓▓▓▓▓▓▓▓ 33.3%       │   4  │   2  │   1  │
│ 웹사이트 [TOP]  │ ▓▓▓▓ 16.7%           │   2  │   1  │   0  │
│ 소개            │ ▓▓ 8.3%              │   1  │   1  │   0  │
└─────────────────┴──────────────────────┴──────┴──────┴──────┘
※ 1건의 거래는 같은 작품의 inquiry 부재로 채널 attribution 불가
상위 채널 · 이메일 · 갤러리 방문 · 웹사이트
```

---

## Build 결과

```
> npm run build

Route (app)                              Size     First Load JS
┌ ○ /                                    103 kB          190 kB
└ ○ /_not-found                          873 B            88 kB

✓ Compiled successfully
✓ type-check 통과 (tsc --noEmit, 0 error)
```

**Δ Route**: 101 kB → **103 kB (+2 kB)** vs STEP 46 baseline.

증분 분석:
- reporting-aggregates +140 LOC (types + computeChannelMix + filterChannelInputByTimeRange)
- ReportingDrawer +180 LOC (channel input + 4 sub-component)
- reporting-export +120 LOC (CSV section + PDF buildChannelMixHTML + CSS)

---

## 검증 매트릭스

| 사용자 spec | 검증 결과 |
|---|---|
| **Reporting Aggregates 확장** | |
| Customer / Inquiry 기반 channel mix 집계 | ✅ `computeChannelMix(inquiries, transactions, customers)` |
| 7 source 지원 | ✅ WEBSITE / EMAIL / SHOWROOM / ART_FAIR / REFERRAL / COLLECTOR_VIEW / OTHER (실제 enum) — INSTAGRAM은 enum에 부재, Inquiry 타입 무수정 정책으로 COLLECTOR_VIEW 운용 |
| 전체 문의 수 | ✅ `totalInquiryCount` |
| 채널별 문의 수 | ✅ `bucket.inquiryCount` |
| 채널별 고객 수 | ✅ `bucket.customerCount` (primarySource 기준) |
| 채널별 거래 연결 수 | ✅ `bucket.transactionCount` (first-touch 어트리뷰션) |
| **ReportingDrawer UI** | |
| 기존 Money Flow 리포트 아래 Channel Mix 섹션 | ✅ StatusSummary 다음 / Footnote 직전 |
| 간단한 bar/table 형태 | ✅ 5-col grid + CSS bar |
| 외부 차트 라이브러리 금지 | ✅ CSS div의 width % |
| 상위 3개 채널 강조 | ✅ TOP 배지 + bg-ink bar + bg-surface-muted/40 row |
| **Time Filter 연동** | |
| 기존 STEP 35.5 필터 결과 기준 재계산 | ✅ filterChannelInputByTimeRange로 inquiry/tx time-filter 후 deriveCustomers |
| 전체 / 이번 달 / 이번 분기 / 사용자 지정 모두 반영 | ✅ resolveTimeRange 결과 사용 |
| **Export 연동** | |
| STEP 35.6 CSV에 Channel Mix 섹션 | ✅ Tax 상태 다음 [유입 채널 분포] 섹션 |
| STEP 35.6 PDF에 Channel Mix 섹션 | ✅ 상태별 분포 다음 buildChannelMixHTML |
| 현재 필터 결과 기준 export | ✅ aggregates 그대로 export |
| **표현 정책** | |
| "운영 참고 리포트" 사용 | ✅ Drawer title 그대로 |
| "유입 채널 기준" 사용 | ✅ Section heading + CSV header + PDF heading |
| "문의/거래 연결 신호" 사용 | ✅ subtitle + footnote |
| "확정 고객 등급" 금지 | ✅ 0건 사용 |
| "신용 평가" 금지 | ✅ 0건 사용 |
| "광고 성과 확정" 금지 | ✅ 부정형 disclaimer ("광고 성과 또는 매출 기여 확정과 무관") |
| "매출 기여 확정" 금지 | ✅ 부정형 disclaimer만 |
| **제약** | |
| Customer master data slice 추가 금지 | ✅ deriveCustomers derive only |
| Persistence schema 변경 금지 | ✅ PersistedState / validateV1 / SCHEMA_VERSION 0줄 변경 |
| Payment / Settlement / Tax / FX / AI 로직 변경 금지 | ✅ 0줄 변경 |
| 외부 API 호출 금지 | ✅ 0건 |
| 신규 라이브러리 추가 금지 | ✅ `package.json` 0줄 변경 |
| 3-column layout 변경 금지 | ✅ Drawer overlay 안 섹션 추가만 |

---

## Manifesto rule 정합성

| Rule | STEP 47 영향 | 상태 |
|---|---|---|
| **rule_3** Money Flow 분리 | Channel mix는 acquisition view, money flow와 별개 섹션 | ✅ 보존 |
| **rule_4** Trust Layer | first-touch 어트리뷰션 명시 + unattributedTransactionCount 별도 노출 + disclaimer 부정형 | ✅ 강화 |
| **rule_7** RBAC | `report.view_global` 권한 가드 자연 적용 (drawer 진입 가드 = 섹션 가드) | ✅ 보존 |
| **rule_14** 3-Column | 레이아웃 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | drawer footer "CSV" / "PDF" / "닫기" 정확히 3개 그대로 | ✅ 보존 |
| **rule_16** 미니멀 디자인 | CSS bar + 절제된 회색 + black 강조 + 그림자 0 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | overlay 안 섹션 추가만 | ✅ 보존 |
| **rule_19** Market Data | channel mix는 갤러리 단위 acquisition signal — rule_19 (b) "관심도"의 갤러리 단위 표현 | ✅ 강화 |

---

## 다음 STEP 후보

남은 Track 후보:

1. **Inquiry 신규 생성 시 Customer suggest** — 동일 이름 customer 자동 추천 (intake form UX)
2. **Logistics 외부 provider 연결** (rule_21) — STEP 29 ExternalAuctionProvider 패턴 답습
3. **Market Analysis history slice** — Persistence schema v2 migration (시간 추이 비교용)
4. **Channel Mix → 작가별 / 작품 상태별 cross-tab 확장** — 더 세분화된 acquisition 분석

---

## 결과 요약

- 신규 파일 1개 (이 문서)
- 수정 파일 3개 (reporting-aggregates / ReportingDrawer / reporting-export) + ARCHITECTURE.md
- 0 신규 라이브러리 / 0 외부 API / 0 store slice / 0 schema 변경 / 0 신규 lib 파일
- STEP 35 ReportingDrawer 자연 확장 — 기존 KPI / Currency / Status flow에 5번째 섹션 추가
- STEP 35.6 export 자동 포함 — CSV / PDF 모두 channel mix 섹션 자연 포함
- 외부 차트 라이브러리 0개 — 100% CSS div bar
- Route +2 kB (101 → 103 kB)

**STEP 47 완료.**
