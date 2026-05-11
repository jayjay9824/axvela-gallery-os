# STEP 73 — Customer Drilldown Navigation

> **목표**: STEP 67/70/72 4-piece reusable architecture를 그대로 재사용하여
> Customer 도메인 + CustomerViewDrawer의 모든 카운트를 drilldown으로 확장.
> 고객 활동 (문의 / 거래 / 보유 작품 / segment / channel)이 *passive 숫자*에서
> *연결 객체 list → 작품 navigate* 흐름으로 전환.
> **2번째 drawer 0개 · CustomerViewDrawer UI redesign 0건 · Customer derivation 0줄**

---

## State

- **이전**: STEP 72 / Route 139 kB
- **이번**: STEP 73 / **Route 141 kB (+2 kB)**
- Build ✅ · type-check ✅ · Lint ✅

---

## 신규 도메인 5개

| 도메인 | 입력 | 출력 columns |
|---|---|---|
| `customer_inquiries` | customerId | 작품 / 채널 / 상태 / 접수일 |
| `customer_purchases` | customerId | 작품 / 금액 / 상태 / invoice / 거래일 |
| `customer_owned_artworks` | customerId | 작품 / 작가 / 작품 상태 / 획득일 |
| `customer_segment` | optional segment | 고객 / segment / 채널 / 문의 / 거래 / 최근 활동 |
| `customer_channel` | optional source | 고객 / segment / 채널 / 문의 / 거래 / 최근 활동 |

---

## Payload 필드 추가

```ts
export interface DrilldownPayload {
  // ... 기존 필드들
  /** STEP 73 — Customer.id (derived entity, displayName lowercase trim) */
  customerId?: string;
  /** STEP 73 — UI title fallback */
  customerName?: string;
  /** STEP 73 — CustomerSegment string ("PROSPECT" / ...) */
  segment?: string;
}
```

`source` 필드는 STEP 70에서 정의된 것을 customer_channel에서 재사용.

---

## Resolver 로직 요약

### `resolveCustomerInquiries`
```ts
const customer = lookupCustomer(payload.customerId, state);  // deriveCustomers
const inquiryIdSet = new Set(customer?.inquiryIds ?? []);
state.inquiries.filter(i => inquiryIdSet.has(i.id))
  .sort(createdAt desc)
  → row { artwork, source label, status (inquiryStatusTone), createdAt }
```

### `resolveCustomerPurchases`
```ts
const customer = lookupCustomer(payload.customerId, state);
const txIdSet = new Set(customer?.transactionIds ?? []);
state.transactions.filter(t => txIdSet.has(t.id))
+ Invoice lookup by transactionId (latest sentAt > issuedAt)
  → row { artwork, amount, status (transactionStatusTone), invoice, createdAt }
```

### `resolveCustomerOwnedArtworks`
```ts
const customer = lookupCustomer(payload.customerId, state);
// First-touch acquisition date: 같은 작품의 가장 이른 transaction.createdAt
customer.ownedArtworkIds 그대로 + 정렬 (acquisition desc)
  → row { artwork, artist, state (artworkStateTone), 획득일 }
```

### `resolveCustomerSegment` / `resolveCustomerChannel`
```ts
const customers = deriveCustomersFromState(state);  // empty fxLookup
// segment 매칭 또는 primarySource 매칭
customers.filter(predicate)
  .sort(lastInteractionAt desc)
  → customerListToResult(filtered, ...)

// shared customerListToResult:
row { customer (displayName + primaryContact),
      segment label (tone),
      channel,
      inquiry count,
      purchase count + linkedArtwork title,
      lastInteractionAt }
artworkId = c.ownedArtworkIds[0] (없으면 row non-clickable)
```

---

## CustomerViewDrawer Integration Sites (9개)

### Detail panel 측 (4 site)

| Site | Domain | Inherit |
|---|---|---|
| KPI "누적 매입" card | `customer_purchases` | customerId |
| KPI "보유 작품" card | `customer_owned_artworks` | customerId |
| Section "보유 / 매입 작품" header count | `customer_purchases` | customerId |
| Section "문의 이력" header count | `customer_inquiries` | customerId |

KPI는 ClickableMetric으로 wrap, Section은 `onCountClick` prop 추가하여 header `{N}건` span을 button으로 변환.

### Master 측 SegmentFilterChips (5 site)

| Chip | Domain | segment |
|---|---|---|
| 전체 | customer_segment | undefined (전체 고객) |
| 문의 | customer_segment | PROSPECT |
| 1회 | customer_segment | ONE_TIME_BUYER |
| 반복 | customer_segment | REPEAT_BUYER |
| 휴면 | customer_segment | DORMANT |

기존 `<button>` outermost를 `<div>`로 변경 + 내부 두 형제 button:
- 필터 변경 (label part)
- count drilldown (count part)

count = 0이면 disabled. visual은 기존과 거의 동일 (rounded-full + active styling).

---

## Artwork-Centric Navigation

```
[customer_inquiries / customer_purchases / customer_owned_artworks]
  row.artworkId 직접 보유 → row 클릭 → setSelectedArtwork → DetailPanel sync

[customer_segment / customer_channel]
  row.artworkId = c.ownedArtworkIds[0] (보유 작품 첫 항목)
  보유 작품 없는 customer → row non-clickable
  context: "작품 이동: 보유 작품 첫 항목" 명시
```

모든 drilldown이 *작품 navigate*로 자연 returns — 고객 자체는 aggregate signal, artwork가 SSOT (rule_1).

---

## Drilldown Flow 시나리오

```
[1] CustomerViewDrawer 열림
[2] 운영자: "김 컬렉터" 선택 (detail pane 노출)
[3] KPI "보유 작품 5점" 카드 클릭
[4] openDrilldown({
      domain: "customer_owned_artworks",
      customerId: "김 컬렉터",
      customerName: "김 컬렉터"
    })
[5] OperationalDrilldownDrawer 열림 (820px)
    ┌─────────────────────────────────────────────────┐
    │ 고객 상세 — 김 컬렉터 · 보유 작품                  │
    │ 5점 · 거래 기준 derived                           │
    ├─────────────────────────────────────────────────┤
    │ 작품          작가      작품 상태   획득일         │
    │ The Shore   김 작가   ●거래종료    2026-04-15    │
    │ Quiet Hour  Lee 작가  ●결제완료    2026-03-22    │
    │ ...                                              │
    └─────────────────────────────────────────────────┘
[6] 운영자: "Quiet Hour" row 클릭
[7] setSelectedArtwork → closeDrilldown → DetailPanel sync
[8] 작품 lifecycle 진입 — 추가 거래 / settlement / 검수 흐름
```

---

## 변경 / 신규 파일

### 신규 (1)

| 파일 | LOC | 역할 |
|---|---|---|
| `STEP_73_CUSTOMER_DRILLDOWN.md` | (이 문서) | 완료 보고 |

### 변경 (3 + ARCHITECTURE.md)

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/types/drilldown.ts` | ~25 LOC | 5 domain enum + customerId / customerName / segment payload fields |
| `src/lib/drilldown-resolver.ts` | ~330 LOC | dispatch 5 case + 5 customer resolvers + customerListToResult shared + helpers |
| `src/components/customer/CustomerViewDrawer.tsx` | ~180 LOC | KPI 2 cards wrap + Section onCountClick + SegmentFilterChips split + handlers |

---

## 검증 매트릭스

### 사용자 spec 9개 검증 항목

| 항목 | 결과 |
|---|---|
| 5개 신규 domain | ✅ |
| Resolver 5개 + dispatch | ✅ customerListToResult shared |
| CustomerViewDrawer UI 통합 (9 site) | ✅ KPI 2 + Section 2 + Segment 5 |
| Payload (customerId / customerName / segment / source) | ✅ source는 STEP 70 재사용 |
| Artwork-centric navigation | ✅ 모든 도메인 → 작품 navigate (segment/channel은 ownedArtworkIds[0]) |
| Non-clickable row | ✅ count 0 / ownedArtworkIds 부재 시 disabled |
| Institutional minimalism | ✅ Stat / Section / SegmentChip visual 보존 |
| Read-only drilldown | ✅ destructive 0건 |
| Build / type-check / lint | ✅ Route 141 kB |

### 사용자 spec 8개 제약

| 제약 | 결과 |
|---|---|
| 기존 STEP 67/70/72 architecture 재사용 | ✅ types / drawer / ClickableMetric / store action 그대로 |
| 2번째 drawer 시스템 | ✅ 0개 |
| CustomerViewDrawer UI redesign | ✅ 0건 (Stat / Section / Chip wrapping만) |
| Customer derivation 로직 | ✅ 0줄 (`deriveCustomers` import만) |
| Transaction / Invoice / Payment / Settlement / Tax 계산 | ✅ 0줄 |
| Persistence schema | ✅ 0줄 |
| 외부 라이브러리 | ✅ 0개 |
| Build / type-check / lint | ✅ |

### 표현 정책

| 표현 | 결과 |
|---|---|
| 사용 ("고객 상세" / "연결 문의" / "연결 거래" / "보유 작품" / "운영 참고" / "작품 이동") | ✅ 23회 사용 |
| 금지 ("credit score" / "financial guarantee" / "certified buyer" / "legal customer record" / "investment profile") | ✅ 0건 |

---

## Affected Domains Verification

| Domain | 변경 |
|---|---|
| Payment / Settlement / Tax | 0줄 |
| FX (STEP 31 / 32 / 34) | 0줄 |
| AI Market Analysis | 0줄 |
| Backup / Restore | 0줄 |
| Image Lifecycle | 0줄 |
| Logistics provider | 0줄 |
| Documents Hub (STEP 51 / 72) | 0줄 |
| `customer-aggregates.ts` (`deriveCustomers`) | 0줄 (import만) |
| `OperationalDrilldownDrawer` (STEP 67 / 72) | 0줄 (재사용) |
| `ClickableMetric` (STEP 67) | 0줄 (재사용) |
| `ReportingDrawer` (STEP 67 / 70) | 0줄 |
| `DocumentsDrawer` (STEP 72) | 0줄 |
| System Audit (STEP 65) | 0줄 |

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_1** Artwork-First | 모든 customer drilldown → 작품 navigate (직접 또는 ownedArtworkIds[0]) | ✅ 강화 |
| **rule_4** Trust Layer | drilldown read-only · `deriveCustomers` 변경 0줄 | ✅ 보존 |
| **rule_8** Timeline = Navigation 확장 | Customer 도메인 모든 카운트 → 연결 객체 → 작품 → 다음 액션 | ✅ **확장 완성** |
| **rule_14** 3-Column | 0줄 | ✅ |
| **rule_15** Max 3 buttons | drawer footer "닫기" 1개 그대로 | ✅ |
| **rule_16** institutional minimalism | KPI / Section / SegmentChip visual 거의 동일 (button → div wrap만) | ✅ |
| **rule_17** Drawer/Modal Layer | overlay drawer (3-column 위 stack) | ✅ |
| **STEP 42 Customer 1급 도메인** | derive 로직 + KPI grid + Section + Chips 구조 그대로 — 클릭 가능 변환만 | ✅ 보존 |

---

## 다음 STEP 후보

```
STEP 74  Sidebar 작품 status 카운트 → drilldown (artwork_state 자연 활용)
STEP 75  ImageCleanup orphan row → "외부 저장소에서 제거 요청" inline action
STEP 76  Documents row 자체 클릭 → 기존 detail drawer 통합 강화
STEP 77  Customer detail channelMix entries → customer_inquiries with source filter
```

각 STEP은 STEP 67 4-piece + 누적 패턴 그대로 활용.

---

## 결과 요약

- 신규 파일 1개 (이 문서)
- 변경 파일 3개 (drilldown types + resolver + CustomerViewDrawer)
- 5개 신규 domain (inquiries / purchases / owned / segment / channel)
- 9개 신규 클릭 site (KPI 2 + Section 2 + Segment chips 5)
- 0 신규 라이브러리 / 0 schema / 0 visual redesign / 0 도메인 로직 변경
- STEP 67 4-piece 인프라 그대로 재사용
- Customer derivation 로직 (`deriveCustomers`) read-only consumer만
- Artwork-centric navigation 강화 — 모든 customer drilldown이 작품으로 returns
- Master segment chips는 button → div wrap으로 nested button 회피, visual 보존
- Route +2 kB (139 → 141 kB)

**STEP 73 완료. AXVELA Customer 도메인의 모든 카운트가 operational graph node로 활성화.**
