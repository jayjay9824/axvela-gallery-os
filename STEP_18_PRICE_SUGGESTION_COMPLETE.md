# STEP 18 — AXVELA AI Price Suggestion (완료)

ArtworkFormDrawer 안에서 가격 입력 필드 아래 **AI 가격 제안** UI를 추가.
외부 마켓 데이터 / 외부 API 호출 없이, 내부 보유 기록(artwork / transaction /
payment / resale)만 사용하는 deterministic helper.

> rule_18 (c) AI Layer · rule_5 AI-Human Loop · rule_19 Market Data는 여전히
> 미구현 — 본 STEP은 그 직전 단계의 v1 형태.

핵심 원칙 (사용자 spec 명시):
- AI는 가격을 **확정하지 않는다**.
- AI는 가격 범위(low / mid / high)와 근거만 제안한다.
- 최종 가격 적용은 사용자가 명시적으로 클릭해야 한다.
- 외부 시장 데이터 / 외부 API 호출 금지.

핵심 결정:
- **별도 도메인 객체 `PriceSuggestion`** — Curation / Inquiry response와 동일한
  AI artifact 패턴. id / artworkId / range / confidence / rationale / sourceRefs
  / lifecycle (createdAt / appliedAt).
- **3-tier confidence** (사용자 spec 정수치):
  - 0.82 — paid transaction + payment 기록 존재
  - 0.62 — artwork 가격만 존재
  - 0.35 — 데이터 부족 → 갤러리 median fallback
- **Deterministic** — 같은 입력 → 같은 출력 (timestamp 제외). AI가 "주관적"으로
  보이지 않게 하고, 사용자가 결과를 신뢰할 수 있게 함 (rule_4 trust layer).
- **Resale commission 보정** — `resaleCommissionRate`가 있으면 base를
  `1/(1-rate)`로 확대 (이전 소유자 / 작가 수익 보전 기준).
- **applyPriceSuggestion은 form-side helper** — `artwork.priceKRW`를 직접
  수정하지 않음. 폼의 priceRaw state만 갱신, 폼 저장 시 일반 흐름이 commit.

---

## 1. 현재 코드 분석

| 항목 | 진입 시점 | STEP 18 필요 |
|---|---|---|
| AI Layer | Curation + Inquiry Response | Price Suggestion 추가 |
| Market Data (rule_19) | 미구현 | **여전히 미구현 — 의도적** |
| Artwork.priceKRW | 단일 KRW 필드 | 그대로 유지 |
| Transaction resale 필드 | isResale / resaleCommissionRate | suggestion 입력으로 활용 |
| Payment.amount / currency | multi-currency | Tier 1 신호 |
| ArtworkFormDrawer | 6개 섹션 | 가격 입력 아래 AI panel 추가 |
| 권한 매트릭스 | 31개 permission | `price_suggestion.generate` + `price_suggestion.apply` 추가 |
| Timeline | DOCUMENT kind 그대로 | 신규 ref 없는 이벤트 emit (PriceSuggestion viewer drawer 부재) |

**의존 관계:**
- `axvela-price.ts`는 `Artwork` / `Transaction` / `Payment` / `formatMoney` 의존
- 결정성 보장 위해 random / Date.now() 생성 분리 (helper는 순수 함수, store가
  id / createdAt 메타 부여)
- store의 `priceSuggestions` slice는 `curationNotes` 패턴 미러 (artworkId 키)

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/types/role.ts` | `price_suggestion.generate` + `price_suggestion.apply` permission 추가 (모두 STAFF) |
| `src/store/useArtworkStore.ts` | `priceSuggestions` slice + 두 액션 (`generatePriceSuggestionForArtwork` / `applyPriceSuggestion`) + import / initial state |
| `src/components/artwork/ArtworkFormDrawer.tsx` | 가격 입력 아래 `<PriceSuggestionPanel />` 인라인 마운트 + 컴포넌트 정의 (PriceSuggestionPanel / SuggestionCard / RangeCell) |
| `ARCHITECTURE.md` | STEP 18 changelog 추가 |

---

## 3. 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/types/price-suggestion.ts` | 90 | `PriceSuggestion` 인터페이스 + `PriceSuggestionSourceRef` union (5 kinds: current_price / transaction / payment / resale_commission / gallery_median) + `confidenceLabel(confidence)` helper |
| `src/lib/axvela-price.ts` | 200 | `generatePriceSuggestion(artwork, txs, payments, galleryMedian)` deterministic helper + `computeGalleryMedianPriceKRW(artworks)` |
| `STEP_18_PRICE_SUGGESTION_COMPLETE.md` | (이 파일) | 본 STEP 문서 |

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/types/artwork.ts` | TimelineEvent / Artwork 0줄 변경. PriceSuggestion은 별도 entity |
| `src/types/transaction.ts` | 0줄 — `isResale` / `resaleCommissionRate` 기존 그대로 활용 |
| `src/types/payment.ts` | 0줄 — `amount` / `currency` 기존 그대로 활용 |
| `src/lib/audit-helpers.ts` / `audit-navigation.ts` | 0줄 — price_suggestion entity type 추가는 향후 (PriceSuggestionViewer drawer가 생기면 그 때) |
| Money Flow / Contract / Invoice / Tax / Settlement / Logistics 도메인 | rule_3 / rule_11 — 0줄 변경 |
| `mock-data.ts` | 0줄 — seed 시점에 PriceSuggestion 없음. 사용자가 폼에서 생성 |
| 3-column 레이아웃 (`page.tsx` / Sidebar / ArtworkGrid / DetailPanel) | rule_14 — 무변경 |

---

## 5. 핵심 코드

### 5.1 PriceSuggestion 타입 (`src/types/price-suggestion.ts`)

```ts
export type PriceSuggestionSourceRef =
  | { kind: "current_price"; valueKRW: number }
  | { kind: "transaction"; transactionId: string; agreedPrice: number; currency: Currency }
  | { kind: "payment"; paymentId: string; amount: number; currency: Currency }
  | { kind: "resale_commission"; transactionId: string; rate: number; previousPrice: number }
  | { kind: "gallery_median"; valueKRW: number; sampleSize: number };

export interface PriceSuggestion {
  id: string;
  artworkId: string;
  suggestedLow: number;
  suggestedMid: number;
  suggestedHigh: number;
  currency: Currency;
  confidence: number;        // 0..1, 0.82 / 0.62 / 0.35
  rationale: string[];
  sourceRefs: PriceSuggestionSourceRef[];
  createdAt: string;
  appliedAt?: string;
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.75) return "높음";
  if (confidence >= 0.5) return "보통";
  return "낮음";
}
```

### 5.2 Deterministic helper (`src/lib/axvela-price.ts`)

```ts
const RANGE_LOW_RATIO = 0.85;
const RANGE_MID_RATIO = 1.0;
const RANGE_HIGH_RATIO = 1.2;

export function generatePriceSuggestion(
  artwork: Artwork,
  artworkTransactions: Transaction[],
  artworkPayments: Payment[],
  galleryMedianPriceKRW: number
): Omit<PriceSuggestion, "id" | "createdAt" | "appliedAt"> {
  const sortedPayments = [...artworkPayments].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
  );
  const recentPayment = sortedPayments[0];

  let basePrice: number;
  let currency: Currency;
  let confidence: number;
  const rationale: string[] = [];
  const sourceRefs: PriceSuggestionSourceRef[] = [];

  if (recentPayment) {
    // Tier 1
    basePrice = recentPayment.amount;
    currency = recentPayment.currency;
    confidence = 0.82;
    rationale.push(`최근 결제 기록 ${formatMoney(basePrice, currency)} 참고`);
    sourceRefs.push({ kind: "payment", ... });
  } else if (artwork.priceKRW > 0) {
    // Tier 2
    basePrice = artwork.priceKRW;
    currency = "KRW";
    confidence = 0.62;
    rationale.push(`현재 등록 가격 ${formatMoney(basePrice, currency)} 기준`);
    sourceRefs.push({ kind: "current_price", valueKRW: basePrice });
  } else {
    // Tier 3 — gallery median fallback
    basePrice = galleryMedianPriceKRW > 0 ? galleryMedianPriceKRW : 1_000_000;
    currency = "KRW";
    confidence = 0.35;
    rationale.push("거래 / 등록 가격 모두 없음 — 매우 낮은 신뢰도");
    rationale.push(`갤러리 평균 ${formatMoney(basePrice, currency)} 임시 기준`);
    sourceRefs.push({ kind: "gallery_median", ... });
  }

  // Resale 보정
  const resaleTx = artworkTransactions.find((tx) => tx.isResale);
  if (resaleTx?.resaleCommissionRate) {
    const rate = resaleTx.resaleCommissionRate;
    basePrice = Math.round(basePrice / (1 - rate));
    rationale.push(`재판매 커미션 ${(rate * 100).toFixed(0)}% 반영`);
    sourceRefs.push({ kind: "resale_commission", ... });
  }

  // Range 산출 (1,000원 단위 round)
  const round = (n: number) => Math.round(n / 1000) * 1000;
  return {
    artworkId: artwork.id,
    suggestedLow: round(basePrice * RANGE_LOW_RATIO),
    suggestedMid: round(basePrice * RANGE_MID_RATIO),
    suggestedHigh: round(basePrice * RANGE_HIGH_RATIO),
    currency,
    confidence,
    rationale: [...rationale, "외부 시장 데이터 미사용 — 내부 거래 기록 기반 v1 제안"],
    sourceRefs,
  };
}
```

### 5.3 Store 액션

```ts
generatePriceSuggestionForArtwork: (artworkId) => {
  const state = get();
  if (!hasPermission(state.currentRole, "price_suggestion.generate")) return null;

  const artwork = state.artworks.find((a) => a.id === artworkId);
  if (!artwork) return null;

  const artworkTxs = state.transactions[artworkId] ?? [];
  const txIds = artworkTxs.map((t) => t.id);
  const artworkPayments = txIds.flatMap((txId) => state.payments[txId] ?? []);
  const galleryMedian = computeGalleryMedianPriceKRW(state.artworks);

  const now = new Date().toISOString();
  const body = generatePriceSuggestion(artwork, artworkTxs, artworkPayments, galleryMedian);
  const suggestion: PriceSuggestion = { ...body, id: genId("psg"), createdAt: now };

  const event: TimelineEvent = {
    id: genId("ev"),
    artworkId,
    kind: "DOCUMENT",
    title: "AXVELA AI 가격 제안 생성",
    detail: `${formatMoney(suggestion.suggestedLow, suggestion.currency)} ~ ${formatMoney(suggestion.suggestedHigh, suggestion.currency)} · 신뢰도 ${(suggestion.confidence * 100).toFixed(0)}%`,
    at: now,
    actor: "AXVELA AI",
    // PriceSuggestion 전용 viewer drawer 부재 — relatedEntity ref 미설정으로
    // audit 카드는 비-clickable. 향후 viewer 도입 시 ref 추가.
  };

  set((s) => ({
    priceSuggestions: { ...s.priceSuggestions, [artworkId]: [suggestion, ...(s.priceSuggestions[artworkId] ?? [])] },
    timeline: { ...s.timeline, [artworkId]: [event, ...(s.timeline[artworkId] ?? [])] },
  }));
  return suggestion.id;
},

applyPriceSuggestion: (artworkId, suggestionId) => {
  const state = get();
  if (!hasPermission(state.currentRole, "price_suggestion.apply")) return;
  const list = state.priceSuggestions[artworkId] ?? [];
  const target = list.find((s) => s.id === suggestionId);
  if (!target || target.appliedAt) return;  // idempotent

  const now = new Date().toISOString();
  const event: TimelineEvent = {
    id: genId("ev"),
    artworkId,
    kind: "DOCUMENT",
    title: "AI 가격 제안 적용",
    detail: `Mid 가격 ${formatMoney(target.suggestedMid, target.currency)}을 작품 편집 폼에 반영. 저장 시 artwork.priceKRW 갱신.`,
    at: now,
    actor: actorLabel(state.currentRole),
    actorRole: state.currentRole,
  };

  set((s) => ({
    priceSuggestions: { ...s.priceSuggestions, [artworkId]: (s.priceSuggestions[artworkId] ?? []).map((sg) => sg.id === suggestionId ? { ...sg, appliedAt: now } : sg) },
    timeline: { ...s.timeline, [artworkId]: [event, ...(s.timeline[artworkId] ?? [])] },
  }));
},
```

### 5.4 ArtworkFormDrawer UI (PriceSuggestionPanel)

```tsx
{isEdit && artwork && (
  <PriceSuggestionPanel
    artwork={artwork}
    onApplyMid={(midValue) => setPriceRaw(midValue.toString())}
  />
)}
```

PriceSuggestionPanel 내부:
- Header: "AXVELA AI 가격 제안" + italic "AI 초안 — 인간 검토 필요" + Generate/Regenerate button
- SuggestionCard: 3-column grid (Low / Mid / High, Mid가 highlighted) + 신뢰도 + ✓ 적용됨 마커 + rationale list
- "Mid 가격 적용 — {amount}" button → `applyPriceSuggestion()` + `onApplyMid(midValue)`
- 항상 표시 disclaimer: "외부 시장 데이터가 아닌 내부 거래 기록 기반 v1 제안입니다. 최종 가격은 갤러리 담당자가 결정합니다."

UX 문구는 사용자 spec에 정확히 따름.

### 5.5 Apply 흐름 — form-side helper로서의 store 액션

```tsx
const handleApplyMid = () => {
  if (!latest || !canApply) return;
  applySuggestion(artwork.id, latest.id);  // store: timeline emit + appliedAt 마킹
  onApplyMid(latest.suggestedMid);          // form: priceRaw state 갱신
};
```

**중요**: `applyPriceSuggestion`은 artwork.priceKRW를 직접 수정하지 않는다.
폼이 priceRaw를 갱신하고, 사용자가 "변경 저장" 버튼을 눌러야 일반
`updateArtwork()` 흐름이 실제 가격 반영.

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    62.9 kB         150 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 17 baseline | 54.5 kB | — |
| STEP 20 (Audit Log) | 57.2 kB | +2.7 |
| STEP 21 (Audit Navigation) | 59.0 kB | +1.8 |
| STEP 23 (Cross-artwork Audit) | 60.8 kB | +1.8 |
| **STEP 18 (Price Suggestion)** | **62.9 kB** | **+2.1** |

`tsc --noEmit` 0 error / `next build` 0 error 0 warning.

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_1** Artwork-First | ✅ | PriceSuggestion은 artworkId 직접 종속. priceSuggestions slice도 artwork-keyed. |
| **rule_2** Flow System | ✅ | Form 가격 입력 → AI generate → suggestion card → Mid 적용 → priceRaw → 저장 → updateArtwork 흐름. 기능 나열 아님. |
| **rule_3** Money Flow Separation | ✅ | Payment / Settlement / Tax 0줄 변경. PriceSuggestion은 별도 도메인 — Money Flow와 무관 (가격 *제안*은 거래 *집행*과 다름). |
| **rule_4** Document Trust Layer | ✅ | sourceRefs로 traceable evidence 보장. 같은 입력 → 같은 출력의 결정성. timeline 이벤트로 audit 가시화. |
| **rule_5** AI-Human Loop | ✅ **핵심** | AI 초안 → 인간 검토 (suggestion 카드) → 인간 승인 (Mid 적용 클릭) → 폼 반영 → 인간 저장 (form submit). 4-단계 명시. AI는 가격을 결정하지 않는다. |
| **rule_6** State Machine | ✅ | 영향 없음. |
| **rule_7** RBAC | ✅ | 신규 permission 2개 모두 STAFF — Curation / Inquiry response 패턴 일관. 권한 부족 시 disabled + permissionHint 노출. |
| **rule_8** Timeline = Navigation | ✅ | "AXVELA AI 가격 제안 생성" / "AI 가격 제안 적용" timeline 이벤트 emit. 단, viewer drawer 부재로 비-clickable (의도적). |
| **rule_14 / rule_17** Layout / Layer | ✅ | 3-column 무변경. 신규 Drawer 0개 — 기존 ArtworkFormDrawer 내부에만 UI 추가. |
| **rule_18** AI Role | ✅ **확장** | Curation / Inquiry response에 이어 세 번째 AI 모듈 — 가격 제안. |
| **rule_19** Market Data | ⚠️ **미구현 유지** | 사용자 spec 명시 — 외부 마켓 데이터 통합은 미래 STEP. v1은 내부 기록만. |

---

## 8. 검증 시나리오

### A — Tier 1 (paid 거래 + payment 존재) — confidence 0.82

1. RoleSwitcher → STAFF (이상)
2. art_004 (PAID 상태, tx_002 + inv_002 + 결제 ₩6,400,000)을 작품 편집 모드로 열기
3. 가격 입력 아래 "AXVELA AI 가격 제안" 패널 표시
4. "AI 가격 제안" 버튼 클릭
5. **기대**:
   - SuggestionCard 표시 (Low / Mid / High, Mid 강조)
   - Mid ≈ 6,400,000 KRW (최근 결제 기록 base)
   - 신뢰도 "82% · 높음"
   - rationale: "최근 결제 기록 ₩6,400,000 참고 (가장 신뢰 가능)" + disclaimer
   - 갤러리 전체 audit log에 "AXVELA AI 가격 제안 생성" 이벤트 (actor: AXVELA AI)

### B — Tier 2 (가격만) — confidence 0.62

1. art_002 (INQUIRY 상태, 가격 등록되어 있고 결제 기록 없음) 편집 모드
2. AI 버튼 클릭
3. **기대**:
   - Mid ≈ artwork.priceKRW × 1.0 (round to 1000)
   - 신뢰도 "62% · 보통"
   - rationale: "현재 등록 가격 {amount} 기준" + disclaimer

### C — Tier 3 (가격 없음) — confidence 0.35

1. (수동 시나리오) 임시로 artwork.priceKRW = 0 + 거래/결제 없음 상태 작품
2. AI 버튼 클릭
3. **기대**:
   - Mid = 갤러리 median 값 (또는 1,000,000 floor)
   - 신뢰도 "35% · 낮음"
   - rationale: "거래 / 등록 가격 모두 없음" + "갤러리 평균 {amount} 임시 기준" + disclaimer

### D — Resale 보정

1. art_007 (BROKERED, tx_005가 isResale=true, resaleCommissionRate=0.15)
2. AI 버튼 클릭
3. **기대**:
   - basePrice / (1 - 0.15) = basePrice × 1.176... 로 확대 후 range 계산
   - rationale: "재판매 커미션 15% 반영" 포함

### E — Mid 가격 적용 → form 반영 only (artwork 무변경)

1. SuggestionCard 표시된 상태에서 "Mid 가격 적용 — {amount}" 클릭
2. **기대**:
   - 가격 입력 필드의 value가 Mid 값으로 즉시 갱신
   - SuggestionCard에 "✓ 폼에 적용됨" 마커 추가
   - timeline: "AI 가격 제안 적용" 이벤트 (actor: 현재 role)
   - **중요**: 이 시점까지 artwork.priceKRW는 여전히 원래 값 (수정 안 됨)
3. 저장 없이 Drawer 닫고 다시 열면 → priceRaw가 원래 값으로 복원 (form state는 mount 시 artwork에서 읽어옴)
4. 단, suggestion record는 store에 남아있음 → 다시 열면 SuggestionCard도 다시 표시 + appliedAt 보존

### F — 저장 후 artwork.priceKRW 반영

1. Mid 적용 → "변경 저장" 클릭
2. 일반 updateArtwork() 흐름 실행 → artwork.priceKRW 갱신
3. ArtworkGrid의 카드에 새 가격 즉시 반영
4. timeline: "작품 정보 수정" 이벤트도 emit (기존 updateArtwork 흐름)

### G — 권한 부족 (RBAC)

(현재 모든 role이 STAFF 이상이므로 실제 부족 시나리오 없음. 향후 GUEST role
추가 시) → 버튼 disabled + "Staff 권한 필요" hint.

### H — Idempotent apply

1. Mid 적용 후 다시 "Mid 가격 적용" 버튼 클릭
2. **기대**: silent no-op (target.appliedAt 이미 존재) → timeline 중복 emit 방지

### I — 다시 생성

1. SuggestionCard 표시 상태에서 "다시 생성" 버튼 (이전 "AI 가격 제안" 버튼 자리)
2. **기대**: 새 PriceSuggestion record 생성 (id 다름) → priceSuggestions[artworkId] 배열의 head에 추가 → SuggestionCard는 항상 최신 표시

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| PriceSuggestion viewer drawer 부재 | timeline의 "AI 가격 제안 생성" 이벤트가 audit log에서 비-clickable (relatedEntity ref 미설정) | 본 정보가 ArtworkFormDrawer 안에서만 보이고 별도 view 필요해지면 PriceSuggestionDrawer + relatedEntityType 추가 |
| 신규 작품(create 모드) 미지원 | artwork이 store에 없으므로 generate 불가 | "작품 저장 → 즉시 AI 제안" 자동화는 별도 STEP. 현재는 edit 모드만 |
| 외부 마켓 데이터 미사용 | 의도적 — rule_19 별도 STEP | rule_19 본 구현 시 sourceRefs에 "market_index" / "comparable_sale" 등 kind 추가 |
| Apply 후 저장 취소 시 timeline noise | "AI 가격 제안 적용" 이벤트는 emit되었으나 실제 저장 안 함 | 의도된 동작 — 사용자 *의도*도 audit 가치. 저장 로직과 분리하면 흐름이 더 단순. |
| 한 작품에 suggestion 여러 개 누적 | 사용자가 "다시 생성" 반복 시 priceSuggestions[artworkId]가 자라남 | UI는 항상 latest만 보여주므로 사용자 영향 없음. 향후 "이전 제안 보기" 옵션 추가 가능 |
| Currency 자동 매칭 | Tier 1은 payment.currency, Tier 2/3은 항상 KRW | 다국가 거래 늘어나면 사용자가 폼에서 currency picker 추가 + suggestion도 그 통화로 |
| Mid만 적용 가능 | Low / High 적용 버튼 부재 | "Low 적용" / "High 적용" 추가는 사소한 확장. spec이 Mid만 명시해서 일단 구현 보류 |

---

## 10. 다음 STEP 후보

1. **STEP 19 — Market Data (rule_19)** — 외부 마켓 데이터 통합. PriceSuggestion sourceRefs에 새 kind 추가 + confidence 0.82 이상 tier (예: 0.9 — comparable sale 매칭). 본 STEP의 deterministic helper를 **확장**, 폐기 아님.
2. **STEP 24 — Date range / multi-select audit filters** — Cross-artwork audit view 실용 강화 (STEP 23 후속).
3. **STEP 25 — Audit Log Export** — JSON / CSV / PDF.
4. **PriceSuggestion viewer drawer** — Timeline navigation 일관성 보강. relatedEntityType "price_suggestion" 추가, history view 등.
