# STEP 42 — Customer / Collector Domain Promotion (Customer 1급 도메인 승격)

> **목표**: STEP 41의 derive view (Collector)에 머물던 customer-facing 도메인을
> 1급 type 위치로 승격. 데이터는 여전히 Inquiry / Transaction에서 derive되지만,
> Customer는 갤러리 운영자가 인지하는 단위로 type/모듈/UI에서 1급 시민이 됨.

---

## State

- **이전**: `STEP 41` — Collector View / Route 86.8 kB
- **이번**: `STEP 42` — Customer Domain Promotion / **Route 88.6 kB (+1.8 kB)**

---

## Flow

```
Artwork  ─┬→  Inquiry (collectorName)  ─┐
          └→  Transaction (buyerName)  ─┴→  Customer (1급 type, derive view)
                                              ↑
                              Sidebar "고객" → CustomerViewDrawer
```

**rule_1 Artwork-First 보존**: 데이터의 Single Source of Truth는 여전히
Inquiry/Transaction. Customer는 Artwork 흐름의 *결과 view*. Customer 자체에
write가 일어나지 않으므로 도메인 cascade 흐름은 무영향.

**rule_10 강화**: Sidebar PRIMARY 영역에 "고객" 1급 항목. 이전 SECONDARY
disabled 중복 제거.

---

## 핵심 설계 결정

### 1) 1급 도메인이지만 **데이터는 derive 유지**

사용자 spec "Persistence 구조 변경 금지" 준수. Customer는 type/module/UI에서
1급이지만 store slice는 추가 0개:

| 측면 | 위치 | 처리 |
|---|---|---|
| **Type 정의** | `src/types/customer.ts` (신규) | 1급 |
| **Aggregation 모듈** | `src/lib/customer-aggregates.ts` (신규) | 1급 |
| **UI** | `src/components/customer/CustomerViewDrawer.tsx` (신규) | 1급 |
| **Store slice** | (없음) | derive — 매 view 시점 재계산 |
| **Persistence** | (없음) | `validateV1` 15개 required 키 무변경 |

### 2) STEP 41 호환 — 권한/store action 그대로

| 식별자 | STEP 41 | STEP 42 | 변경 사유 |
|---|---|---|---|
| RBAC permission | `collector.view_global` | 그대로 | 액션 키 변경 시 호출자 변경 비용 큼 |
| Store request slice | `collectorViewRequest` | 그대로 | 같은 이유 |
| Store action | `openCollectorView` / `closeCollectorView` / `selectCollector` | 그대로 | 같은 이유 |
| Sidebar 라벨 | "Collector View" | **"고객"** | 1급 도메인 승격 명명 정리 |
| Drawer 컴포넌트 | `CollectorViewDrawer` | `CustomerViewDrawer` (신규) | 신규 필드 표현 위해 신규 컴포넌트 |

→ **Semantic은 customer로 확장, identifier는 STEP 41 유지** = 하위 호환 + 의미 승격.

### 3) Customer는 STEP 41 Collector의 **superset**

추가된 필드:

- `kind` (`FIRST_TIME` / `ACTIVE_LEAD` / `RETURNING`) — 활동 패턴 분류
- `segment` (`PROSPECT` / `ONE_TIME_BUYER` / `REPEAT_BUYER` / `DORMANT`) — 운영 참고 segment
- `firstInteractionAt` — 첫 활동 시각
- `allContacts` — 등장한 모든 contact (dedup, frequency sort)
- `primarySource` + `channelMix` — InquirySource 기반 채널 인텔리전스

기존 STEP 41 필드는 모두 그대로 유지 (signal / metric).

---

## 변경 파일 목록

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/components/layout/Sidebar.tsx` | ~12 LOC | "Collector View" → "고객" 라벨, SECONDARY disabled "고객" 제거 |
| `src/app/page.tsx` | 2 lines | `CollectorViewDrawer` → `CustomerViewDrawer` import/mount 교체 |
| `src/lib/collector-aggregates.ts` | +12 LOC (header) | Deprecated 헤더 주석만 |
| `src/components/collector/CollectorViewDrawer.tsx` | +10 LOC (header) | Deprecated 헤더 주석만 |
| `ARCHITECTURE.md` | +1 changelog 항목 + rule_10 row 보강 | 정합성 매트릭스 갱신 |

---

## 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/types/customer.ts` | ~110 | 1급 type — `Customer` interface + `CustomerKind` / `CustomerSegment` / `CustomerSignal` unions |
| `src/lib/customer-aggregates.ts` | ~340 | Pure derive function `deriveCustomers()` + segment/kind/signal 휴리스틱 + display helpers (한국어 라벨, KRW format, 상대 시간) |
| `src/components/customer/CustomerViewDrawer.tsx` | ~580 | Master-detail Drawer (880px) — segment chip filter / 4-card KPI / channel mix / contact dedup |
| `STEP_42_CUSTOMER_DOMAIN.md` | (이 문서) | STEP 완료 보고 |

---

## 핵심 코드

### `src/types/customer.ts` (신규 1급 entity)

```typescript
export type CustomerKind = "FIRST_TIME" | "ACTIVE_LEAD" | "RETURNING";

export type CustomerSegment =
  | "PROSPECT"          // 거래 0건
  | "ONE_TIME_BUYER"    // 거래 1건
  | "REPEAT_BUYER"      // 거래 2건+
  | "DORMANT";          // 90일 이상 비활동

export type CustomerSignal =
  | "MULTI_DEAL" | "ACTIVE_INQUIRY"
  | "RECENT_ACTIVITY" | "HIGH_VALUE";

export interface Customer {
  id: string;
  displayName: string;
  primaryContact: string;
  allContacts: string[];

  inquiryIds: string[];
  transactionIds: string[];
  ownedArtworkIds: string[];

  totalPurchaseKRW: number;
  missingFxCount: number;
  activeInquiryCount: number;
  activeTransactionCount: number;

  firstInteractionAt: string;
  lastInteractionAt: string;

  primarySource?: InquirySource;
  channelMix: Partial<Record<InquirySource, number>>;

  kind: CustomerKind;
  segment: CustomerSegment;
  signals: CustomerSignal[];
}
```

### `src/lib/customer-aggregates.ts` (segment / kind 휴리스틱)

```typescript
function computeKind(acc: CustomerAccum): CustomerKind {
  if (acc.transactionIds.size >= 1) return "RETURNING";
  if (acc.activeInquiryCount > 0) return "ACTIVE_LEAD";
  return "FIRST_TIME";
}

function computeSegment(
  acc: CustomerAccum,
  now: number,
  dormantMs: number,
  isRecentlyActive: boolean
): CustomerSegment {
  const txCount = acc.transactionIds.size;
  const base: CustomerSegment =
    txCount >= 2 ? "REPEAT_BUYER"
    : txCount === 1 ? "ONE_TIME_BUYER"
    : "PROSPECT";

  // 활동성 우선 — 진행 중이거나 최근 활동이면 base 유지
  if (isRecentlyActive
      || acc.activeInquiryCount > 0
      || acc.activeTransactionCount > 0) {
    return base;
  }

  // 마지막 활동 90일+ → DORMANT 덮어쓰기
  if (acc.lastInteractionAt) {
    const last = new Date(acc.lastInteractionAt).getTime();
    if (!Number.isNaN(last) && now - last > dormantMs) {
      return "DORMANT";
    }
  }
  return base;
}
```

### `src/components/customer/CustomerViewDrawer.tsx` (4-card KPI)

```tsx
{/* KPI grid — 4 metrics (STEP 41 3개 → 4개로 확장) */}
<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
  <Stat
    label="누적 매입"
    value={formatCustomerKRW(customer.totalPurchaseKRW)}
    hint={
      customer.missingFxCount > 0
        ? `${customer.missingFxCount}건 환산 정보 부족`
        : "KRW 환산"
    }
    warn={customer.missingFxCount > 0}
  />
  <Stat
    label="보유 작품"
    value={`${customer.ownedArtworkIds.length}점`}
    hint={`총 거래 ${customer.transactionIds.length}건`}
  />
  <Stat
    label="첫 활동"          {/* STEP 42 신규 */}
    value={formatRelativeTime(customer.firstInteractionAt)}
    hint={customer.firstInteractionAt.slice(0, 10) || "—"}
  />
  <Stat
    label="마지막 활동"
    value={formatRelativeTime(customer.lastInteractionAt)}
    hint={customer.lastInteractionAt.slice(0, 10) || "—"}
  />
</div>
```

### Sidebar — "고객" 1급 항목 통합

```tsx
// STEP 42 — Customer / Collector Domain Promotion. STEP 41의 "Collector View"
// 항목 라벨을 "고객"으로 변경 (1급 도메인 위치).
const openCustomerView = useArtworkStore((s) => s.openCollectorView);
const canViewCustomer = hasPermission(currentRole, "collector.view_global");

const PRIMARY: NavItem[] = React.useMemo(
  () => [
    ...PRIMARY_STATIC,                           // 작품 / 거래 / 문서
    {
      label: "고객",                              // STEP 41 "Collector View" 교체
      disabled: !canViewCustomer,
      hint: canViewCustomer ? undefined : permissionHint("collector.view_global"),
      onClick: canViewCustomer ? openCustomerView : undefined,
    },
  ],
  [canViewCustomer, openCustomerView]
);
```

---

## Build 결과

```
> npm run build

Route (app)                              Size     First Load JS
┌ ○ /                                    88.6 kB         176 kB
└ ○ /_not-found                          873 B            88 kB
+ First Load JS shared by all            87.1 kB
  ├ chunks/117-5e00970e6c23baf7.js       31.6 kB
  ├ chunks/fd9d1056-66f89d490d24d204.js  53.6 kB
  └ other shared chunks (total)          1.86 kB

✓ Compiled successfully
✓ type-check 통과 (tsc --noEmit, 0 error)
```

**Δ Route**: 86.8 kB → **88.6 kB (+1.8 kB)** vs STEP 41 baseline.

증분 분석:
- `src/types/customer.ts` — type 정의만, 런타임 0 byte
- `src/lib/customer-aggregates.ts` — derive function + display helpers
- `src/components/customer/CustomerViewDrawer.tsx` — 4-card KPI / SegmentFilterChips / channel mix display 추가 UI
- STEP 41 `collector-aggregates.ts` + `CollectorViewDrawer.tsx` — tree-shake 자동 제외 (page.tsx에서 import 제거됨)

---

## 검증 매트릭스

| 사용자 spec | 검증 결과 |
|---|---|
| Customer / Collector를 1급 데이터 레이어로 승격 | ✅ Type / Lib / UI 1급 위치 |
| 기본 필드: id / name / email (mock) / createdAt / lastInteractionAt | ✅ + firstInteractionAt / channelMix / kind / segment |
| 개인정보처럼 보이지 않도록 mock 유지 | ✅ Inquiry/Transaction의 mock 데이터 그대로 사용 |
| 기존 데이터에서 derive 가능 | ✅ deriveCustomers() pure function |
| Customer 기반으로 재구성 | ✅ CustomerViewDrawer로 확장 |
| Collector list → Customer list로 확장 | ✅ Master-detail 동일 구조 + 신규 segment chip filter |
| Collector detail (보유 작품 / 문의 이력 / 거래 이력 / 총 구매 / 최근 인터랙션 / High-intent signal) | ✅ 모두 표시 + 첫 활동 / channel mix / kind 추가 |
| 새로운 핵심 계산 로직 추가 금지 | ✅ Money Flow / Settlement / Tax / FX 0줄 변경 |
| 기존 store read-only 기반 aggregation | ✅ inquiries / transactions / invoices read-only |
| Sidebar "고객" 활성화 (STEP 40 disabled 해제) | ✅ PRIMARY 1급 항목 |
| Manager 이상 접근 가능 | ✅ collector.view_global 그대로 |
| 3-column layout 유지 | ✅ Drawer overlay만 |
| Drawer 또는 dedicated panel | ✅ Drawer 880px |
| 과도한 CRM 기능 금지 (view 중심) | ✅ Read-only, 작성/수정 없음 |
| "운영 참고" 표현 유지 | ✅ Banner / segment hints / signal hints 모두 운영 참고 |
| 확정/등급/판단 표현 금지 | ✅ "VIP" / "골드/실버" / "확정 등급" 0건 (부정형 정책 주석 제외) |
| Payment / Settlement / Tax / FX 로직 변경 금지 | ✅ 0줄 변경 |
| AI 로직 추가 금지 | ✅ 0줄 변경 |
| 외부 API 호출 금지 | ✅ fetch / axios 0건 |
| Persistence 구조 변경 금지 | ✅ PersistedState shape / validateV1 / SCHEMA_VERSION 모두 0줄 변경 |

---

## Manifesto rule 정합성

| Rule | STEP 42 영향 | 상태 |
|---|---|---|
| **rule_1** Artwork-First | Customer는 Artwork → Inquiry/Transaction 결과 view | ✅ 보존 |
| **rule_3** Money Flow 분리 | Settlement / Payment / Tax 0줄 변경 | ✅ 보존 |
| **rule_4** Document Trust | missingFxCount 명시 — derive 한계 명시 | ✅ 강화 |
| **rule_5** AI-Human Loop | AI 로직 0줄 변경 | ✅ 보존 |
| **rule_7** RBAC | Manager 이상 권한 게이트 그대로 | ✅ 보존 |
| **rule_10** No dashboard | Sidebar "고객" 1급 항목, view 중심 | ✅ 강화 |
| **rule_14** 3-Column | 레이아웃 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | Drawer footer "닫기" 1개만 | ✅ 보존 |
| **rule_16** 미니멀 디자인 | 그림자 최소, 여백 중심 | ✅ 보존 |
| **rule_17** Drawer/Modal | overlay만, 레이아웃 변경 0 | ✅ 보존 |
| **rule_20** FX | Invoice fxSnapshot.rate read-only 참조만 | ✅ 보존 |

---

## STEP 41 backward-compat 처리

```
src/lib/collector-aggregates.ts                     ← deprecated 헤더만 추가
src/components/collector/CollectorViewDrawer.tsx    ← deprecated 헤더만 추가
```

두 파일 모두:
- 본문 0줄 변경
- import 사이트 0개 (Sidebar/page.tsx 모두 customer 사용)
- Production 번들에서 tree-shake 자동 제외 (size 영향 0)
- 다음 STEP에서 안전 삭제 가능

---

## 다음 STEP 후보

본 STEP에서 의도적으로 미구현 (사용자 spec "view 중심" 준수):

1. **Customer Detail에서 작품 직접 진입** — 보유 작품 row 클릭 → DetailPanel select + drawer close
2. **Customer master data slice 도입** — 진짜 1급 데이터화 (notes / preferences). Persistence schema v2 migration 필요
3. **Customer Export** — Reporting export 패턴 답습 (CSV / PDF)
4. **Inquiry 신규 생성 시 Customer suggest** — 동일 이름 customer 자동 추천 (intake form)
5. **Channel mix → Reporting Drawer 통합** — 갤러리 단위 channel 분포 분석

---

## 결과 요약

- 신규 파일 3개 (type 1 / lib 1 / component 1)
- 수정 파일 2개 (Sidebar 라벨 / page.tsx import)
- Deprecated 헤더 2개 (STEP 41 정리)
- Money Flow / FX / AI / Persistence / 외부 API 모두 0줄 변경
- 모든 manifesto rule 정합성 보존 또는 강화
- Route +1.8 kB (86.8 → 88.6 kB)

**STEP 42 완료.**
