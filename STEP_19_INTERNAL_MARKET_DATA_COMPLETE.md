# STEP 19 — Internal Market Data Layer (완료)

STEP 18 PriceSuggestion에 **내부 거래 / payment / inquiry / resale 기록 기반
market signal 레이어**를 추가. PriceSuggestion sourceRefs에 새 kind
`market_signal` 연결, base price 부드러운 blend, confidence boost.
**외부 API 호출 0줄** — Provider interface만 열어두고 STEP 29 (External
Auction Market Reference)에서 실제 외부 연동 활성화.

> rule_19 Market Data v1 · rule_18 (b) 시장 분석의 deterministic 토대.

핵심 결정:
- **Provider extension hook 구조** — `MarketDataProvider` interface +
  `ACTIVE_PROVIDERS` registry + `gatherMarketSignals(input)` entry point.
  본 STEP은 `InternalMarketDataProvider` 1개만 활성. STEP 29에서
  `ExternalAuctionProvider`를 ACTIVE_PROVIDERS에 push만 하면 즉시 연결.
- **MarketSignal은 ephemeral** — store 슬라이스 추가하지 않음. 매 generate
  호출 시 새로 계산되며, audit trail은 `PriceSuggestion.sourceRefs[]`에
  embed (`kind: "market_signal"`).
- **Base price blend는 보수적** — self_resale 15%, artist_avg 5~10%만.
  Range 산출 (low/mid/high) 로직은 STEP 18 그대로 — 불필요한 변동 0.
- **Confidence cap 0.95** — 신호 풍부해도 "확정" 표현 금지 (사용자 spec).
- **외부 API 0줄** — `MarketSignalSource = { kind: "external"; ... }`는
  타입 정의에만 존재, fetch 호출 없음. 네트워크 의존성 0.

---

## 1. 현재 코드 분석

**STEP 19 진입 시점 (v24 baseline):**

| 항목 | 진입 시점 | STEP 19 필요 |
|---|---|---|
| PriceSuggestion (STEP 18) | 3-tier confidence (0.82 / 0.62 / 0.35) + resale 보정 | market signal layer 통합 |
| sourceRefs union | 5-kind (current_price / transaction / payment / resale_commission / gallery_median) | + market_signal kind |
| External market data | 부재 | **여전히 부재 — 의도적 (STEP 29)** |
| Provider 확장 구조 | 부재 | interface + registry 추가 |
| Artist matching | `artwork.artist` 객체 (Artist.name) | provider에서 name 매칭 |
| Currency 정책 | KRW base, multi-currency tx 혼재 | v1 신호는 KRW transactions만 |
| Tier confidence | static (0.82 max) | + signal boost (0.95 cap) |

**의존 관계:**
- `internal-market-provider.ts`는 Transaction / Payment / Inquiry / Artwork 구조 의존
- `axvela-price.ts`는 새 파라미터 `marketSignals: MarketSignal[] = []` 추가 — default empty로 backward compatible
- store action은 `gatherMarketSignals(input)` 한 번 호출 후 helper에 전달

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/types/price-suggestion.ts` | `PriceSuggestionSourceRef`에 6번째 kind `market_signal` 추가 (signalId / signalKind / provider / isExternal / sampleSize / summary) |
| `src/lib/axvela-price.ts` | `generatePriceSuggestion`에 `marketSignals: MarketSignal[] = []` 파라미터 추가. 신호 sourceRefs 누적 + KRW base price blend (self_resale 15% / artist_avg 5~10%) + confidence boost (kind별 누적, 0.95 cap) + external 활성 시 disclaimer 분기 |
| `src/store/useArtworkStore.ts` | `gatherMarketSignals(input)` 호출 → helper에 전달. `state.payments` / `state.inquiries` selector 추가 (기존 슬라이스 그대로 사용 — 신규 없음) |

---

## 3. 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/types/market-signal.ts` | 130 | `MarketSignal` interface + `MarketSignalKind` 5-union (artist_avg / artist_recent_sale / self_resale / inquiry_volume / external_reference) + `MarketSignalSource` (internal / external 2-union, external은 STEP 29 placeholder) + `MarketDataInput` provider 입력 타입 + `MarketDataProvider` interface |
| `src/lib/internal-market-provider.ts` | 175 | `InternalMarketDataProvider` 클래스 — `providerId="internal_v1"`, `isExternal=false`. 4개 신호 계산 함수: `computeArtistSignals` (artist_avg + artist_recent_sale) / `computeSelfResaleSignal` (본 작품 prior tx) / `computeInquiryVolumeSignal` (수요 신호). Deterministic id 생성 (Date.now() / random() 0). |
| `src/lib/market-data.ts` | 50 | `ACTIVE_PROVIDERS` registry (v1: internal 1개) + `gatherMarketSignals(input)` entry point (모든 provider iterate, 실패 시 try/catch defensive — STEP 29 external 도입 시 네트워크 실패가 internal 신호 차단하지 않도록) + `hasExternalProviders()` helper (UI에서 external 마커 표시용 — v1은 항상 false) |
| `STEP_19_INTERNAL_MARKET_DATA_COMPLETE.md` | 본 문서 |

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/components/artwork/ArtworkFormDrawer.tsx` | PriceSuggestionPanel은 `rationale[]`를 그대로 표시 — 신호 정보가 새 rationale 라인으로 자동 노출. UI 변경 0줄 |
| `src/types/role.ts` / `src/lib/rbac.ts` | 권한 변경 없음 — 기존 `price_suggestion.generate` (STAFF) 그대로 |
| TimelineEvent 구조 / store 슬라이스 / Money Flow / Contract / Invoice / Tax / Settlement / Logistics / Curation / Inquiry / Audit (STEP 20/21/23) | 모두 0줄 변경 |
| 3-Column 레이아웃 / Drawer 호출자 / mock-data | 0줄 변경 |
| 외부 라이브러리 (네트워크 / fetch / axios 등) | 0개 추가 — 외부 호출 금지 명시 준수 |

---

## 5. 핵심 코드

### 5.1 MarketSignal 타입

```ts
export type MarketSignalKind =
  | "artist_avg"          // 같은 작가 KRW 거래 평균
  | "artist_recent_sale"  // 같은 작가 최근 거래 1건
  | "self_resale"         // 본 작품의 이전 거래 (가장 강한 신호)
  | "inquiry_volume"      // 수요 신호 (가격 직접 영향 아님)
  | "external_reference"; // STEP 29 placeholder

export type MarketSignalSource =
  | { kind: "internal"; description: string }
  | { kind: "external"; provider: string; fetchedAt: string }; // STEP 29

export interface MarketSignal {
  id: string;
  kind: MarketSignalKind;
  artworkId: string;
  valueKRW?: number;       // single value signal
  averageKRW?: number;     // mean signal
  volumeCount?: number;    // demand signal
  currency: Currency;
  source: MarketSignalSource;
  freshness: string;       // ISO datetime
  sampleSize: number;
  weight: number;          // 0~1, confidence boost 입력
  rationale: string;
}
```

### 5.2 Provider 확장 hook

```ts
export const ACTIVE_PROVIDERS: MarketDataProvider[] = [
  new InternalMarketDataProvider(),
  // STEP 29: new ExternalAuctionProvider(...)
];

export function gatherMarketSignals(input: MarketDataInput): MarketSignal[] {
  const out: MarketSignal[] = [];
  for (const provider of ACTIVE_PROVIDERS) {
    try {
      out.push(...provider.fetchSignals(input));
    } catch {
      // Defensive: 한 provider 실패해도 다른 provider 신호 보존
    }
  }
  return out;
}
```

### 5.3 Helper에 신호 통합

```ts
export function generatePriceSuggestion(
  artwork: Artwork,
  artworkTransactions: Transaction[],
  artworkPayments: Payment[],
  galleryMedianPriceKRW: number,
  marketSignals: MarketSignal[] = []   // ← STEP 19 추가, default empty (backward compatible)
): Omit<PriceSuggestion, "id" | "createdAt" | "appliedAt"> {
  // ... STEP 18 Tier 1/2/3 계산 ...

  if (marketSignals.length > 0) {
    // 모든 신호 sourceRefs 누적
    for (const sig of marketSignals) {
      sourceRefs.push({
        kind: "market_signal",
        signalId: sig.id,
        signalKind: sig.kind,
        provider: sig.source.kind === "internal" ? "internal_v1" : sig.source.provider,
        isExternal: sig.source.kind === "external",
        sampleSize: sig.sampleSize,
        summary: sig.rationale,
      });
      rationale.push(sig.rationale);
    }

    // KRW base price 부드러운 blend
    if (currency === "KRW") {
      const selfResale = marketSignals.find((s) => s.kind === "self_resale");
      if (selfResale?.valueKRW) {
        basePrice = Math.round(basePrice * 0.85 + selfResale.valueKRW * 0.15);
      }
      const artistAvg = marketSignals.find((s) => s.kind === "artist_avg");
      if (artistAvg?.averageKRW) {
        const blend = artistAvg.sampleSize >= 2 ? 0.1 : 0.05;
        basePrice = Math.round(basePrice * (1 - blend) + artistAvg.averageKRW * blend);
      }
    }

    // Confidence boost
    let boost = 0;
    for (const sig of marketSignals) {
      if (sig.kind === "self_resale") boost += 0.05;
      else if (sig.kind === "artist_avg" && sig.sampleSize >= 2) boost += 0.05;
      else if (sig.kind === "artist_avg") boost += 0.03;
      else if (sig.kind === "artist_recent_sale") boost += 0.03;
      else if (sig.kind === "inquiry_volume" && (sig.volumeCount ?? 0) >= 3) boost += 0.02;
    }
    confidence = Math.min(0.95, confidence + boost);   // 0.95 cap — "확정" 표현 금지
  }

  // ... range 산출 (STEP 18 그대로) + disclaimer ...
}
```

### 5.4 Disclaimer 분기 (external 활성 시 다른 문구)

```ts
const hasExternal = marketSignals.some((s) => s.source.kind === "external");
if (hasExternal) {
  rationale.push("내부 거래 기록 + 외부 reference 신호 결합 — 참고 가격 범위입니다");
} else {
  rationale.push("외부 시장 데이터 미사용 — 내부 거래 기록 기반 v1 제안");
}
```

### 5.5 Internal provider — 4개 신호 계산

```ts
class InternalMarketDataProvider {
  fetchSignals(input: MarketDataInput): MarketSignal[] {
    return [
      ...this.computeArtistSignals(input),    // artist_avg + artist_recent_sale
      ...this.computeSelfResaleSignal(input), // self_resale
      ...this.computeInquiryVolumeSignal(input), // inquiry_volume
    ];
  }
  // ...
}
```

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    64.3 kB         151 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 18 (Price Suggestion) | 62.9 kB | — |
| **STEP 19 (Internal Market Data)** | **64.3 kB** | **+1.4** |

`tsc --noEmit` 0 error / `next build` 0 error 0 warning.

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_4** Trust Layer | ✅ 강화 | sourceRefs[]에 market_signal kind 추가 — 어떤 provider의 어떤 신호로 가격이 조정되었는지 한 줄씩 audit |
| **rule_5** AI-Human Loop | ✅ | 신호가 추가돼도 최종 적용은 여전히 "Mid 적용" 명시 클릭 |
| **rule_18 (b)** 시장 분석 | 🟡 부분 | rule_19 deterministic 토대 마련 — 본격 구현은 STEP 29 외부 reference 결합 후 |
| **rule_19** Market Data | ✅ v1 | internal 신호 layer 활성. 외부는 후속 STEP. |
| 외부 API 호출 | ✅ 0줄 | network / fetch / axios 등 추가 라이브러리 0 |
| "감정가" / "시장가 확정" 표현 | ✅ 사용 안 함 | "참고 가격 범위" / "참고 신호" / "v1 제안"만 사용. confidence cap 0.95 |
| Money Flow / Contract / Invoice / Tax / Settlement / Logistics 코드 변경 | ✅ 0줄 | |
| 3-Column 레이아웃 | ✅ 무변경 | |

---

## 8. 검증 시나리오

### A — 신호 없는 작품 (artist 단일 작품)

1. art_001 (READY, no transactions, no inquiries) 편집
2. "AI 가격 제안" 클릭
3. **기대**: STEP 18 Tier 2 동작 그대로 (현재 가격 ±) → SuggestionCard에 추가 신호 라인 없음. confidence ≈ 0.62. rationale "외부 시장 데이터 미사용 — 내부 거래 기록 기반 v1 제안".

### B — 같은 작가 작품 거래 多

1. 같은 artist의 다른 작품에 거래 2건 이상 존재
2. "AI 가격 제안" 클릭
3. **기대**:
   - rationale에 "같은 작가 KRW 거래 N건 평균 ₩XX" + "같은 작가 최근 거래 ₩YY" 두 줄 추가
   - confidence boost +0.08 (artist_avg≥2 +0.05, artist_recent_sale +0.03)
   - basePrice가 artist_avg 쪽으로 10% blend → low/mid/high 미세 조정

### C — Self resale (art_007 BROKERED)

1. art_007 편집 (이전 거래 tx_004 존재)
2. "AI 가격 제안" 클릭
3. **기대**:
   - rationale "본 작품 이전 거래 ₩15,500,000 — 가장 강한 신호"
   - basePrice가 prior tx 쪽으로 15% blend
   - confidence +0.05
   - sourceRefs에 `market_signal` (signalKind="self_resale", isExternal=false, provider="internal_v1") 1건 + 기존 ref들

### D — 다중 신호 결합

1. art_007 (resale) + 같은 artist의 다른 거래 작품 존재
2. "AI 가격 제안"
3. **기대**: self_resale + artist_avg + artist_recent_sale 모두 emit. confidence base + boost ≤ 0.95 cap. rationale 다중 라인 표시.

### E — Inquiry volume 단독

1. 거래 0건이지만 inquiry 3건 이상 존재한 작품
2. "AI 가격 제안"
3. **기대**:
   - rationale "본 작품 inquiry N건 — 수요 신호 (가격 직접 신호 아님)"
   - confidence +0.02 (인구 신호도 신뢰 보강)
   - basePrice는 무변경 (volume signal blend 0)

### F — Determinism (재실행 일관성)

1. art_007 "AI 가격 제안" 두 번 클릭
2. **기대**: 두 suggestion의 `suggestedLow / suggestedMid / suggestedHigh / confidence`는 **동일**. id / createdAt만 다름. (Date.now() / random() 의존 코드 0줄 — rule_4)

### G — External 신호 부재 확인

1. 어떤 작품이든 generate
2. **기대**: 모든 sourceRefs의 `market_signal.isExternal === false`. `MarketSignalSource.kind === "internal"`. 네트워크 호출 0건 (DevTools Network 탭).

### H — Disclaimer 정확성

1. 모든 generate 결과의 마지막 rationale 라인 확인
2. **기대**: "외부 시장 데이터 미사용 — 내부 거래 기록 기반 v1 제안" (external provider 미활성 상태 유지).

### I — Provider 확장 hook 검증 (개발자 view)

1. `src/lib/market-data.ts`의 `ACTIVE_PROVIDERS` 배열 확인
2. **기대**: 1개 entry (`InternalMarketDataProvider`). STEP 29 주석 명시. STEP 29에서 1줄 push만으로 외부 connector 활성 가능 확인.

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| 외부 API 미연동 | 의도적 — 사용자 spec 명시 (오류 가능성) | **STEP 29 — External Auction Market Reference**에서 활성. ExternalAuctionProvider 추가 + caching layer + currency conversion + freshness 정책 |
| KRW 신호만 | USD/EUR 거래는 v1 신호 풀에서 제외 | FX 변환 helper 도입 시 multi-currency 신호도 정규화 가능 |
| Same-artist 매칭 by name | `Artist.name` 문자열 일치만 (id 매칭 X) | Artist 도메인 정비 시 id 기반 매칭 전환 (정확도 향상) |
| Inquiry volume이 가격 영향 0 | 수요 신호로만 사용 — confidence만 보강 | inquiry volume과 가격 transaction 상관관계 분석 후 weighted 영향 추가 가능 |
| Signal caching 부재 | 매 generate마다 재계산 | STEP 29에서 external 호출 빈도 제한 위해 cache layer 도입 (internal도 함께 캐싱 가능) |
| MarketSignal store 보존 안 됨 | sourceRefs에만 embed | 신호 시계열 분석 필요해지면 별도 store slice + audit timeline 이벤트로 확장 |
| Resale prior detection 단순 | 가장 오래된 tx를 prior로 가정 | `previousTransactionId` chain 명시적 추적으로 정확도 향상 (rule_13) |

---

## 10. 다음 STEP 후보

1. **STEP 29 — External Auction Market Reference** (사용자 spec 명시):
   - `ExternalAuctionProvider implements MarketDataProvider` 추가
   - auction comparable sales / marketplace listing fetch
   - Currency conversion (FX rates) layer
   - `fetchedAt` freshness + cache TTL
   - Provider별 confidence weight 차등 (auction house 별 신뢰도)
   - Network failure 대비 retry / fallback 정책
2. **STEP 24 — Audit Filters 강화** (date range / multi-select).
3. **STEP 25 — Audit Log Export** (JSON / CSV / PDF).
4. **STEP 28 — Real AI Integration** — Curation / Inquiry response / Price suggestion에 실제 AI API 옵션 layer 추가 (deterministic helper와 병행 운영).
5. **STEP 26 — Audit Trail Visualization** (timeline graph / heatmap).
