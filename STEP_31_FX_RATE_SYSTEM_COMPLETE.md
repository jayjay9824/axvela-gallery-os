# STEP 31 — Real FX Rate System (v1) 완료

STEP 29 ExternalAuctionProvider에 박혀있던 정적 `FX_TO_KRW` 테이블 + `toKRW`
함수를 **`FXRateProvider` 시스템으로 외부화**. 향후 실 환율 API (Open Exchange
Rates / 한국은행 ECOS / Fixer.io 등) 도입 시 새 provider 구현체만 작성하면
PriceSuggestion / ExternalAuctionProvider / Invoice 코드 0줄 수정으로 동작.

> rule_20 FX matrix: 🟡 부분 → ✅ — 외부 시장 가격 변환 + audit snapshot 기록
> 인프라 모두 마련. Invoice lock 시점 환율 적용은 helper만 제공 (schema 변경
> 최소화 — 실 적용은 후속 STEP).

핵심 결정:
- **FXRate 타입 + FXRateProvider interface** — STEP 19/29의 MarketDataProvider
  와 같은 sync API 패턴. `getRate(base, quote)` 하나만 — provider 내부에서
  cache/pre-fetch/WebSocket 등 자유. 사용자 spec 명시 9개 필드 모두 포함
  (id / baseCurrency / quoteCurrency / rate / provider / fetchedAt / validUntil
  / isExternal / sourceNote).
- **3-tier fallback policy** — `getFXRate(base, quote)` 호출 시: ① active
  provider 시도 → ② static fallback 테이블 → ③ null 반환. 어느 시점에서도
  silent crash 없음. `convertCurrency`는 unknown pair 시 0 반환 (loud surface).
- **Module-level helpers** — `getFXRate` / `convertCurrency` / `createFXSnapshot`.
  Provider singleton (`getActiveFXProvider`) lazy init — 첫 호출 시
  `MockFXRateProvider` 자동 생성. `setActiveFXProvider()`로 실 provider 교체.
- **STEP 18 / 19 helpers는 무수정** — internal-market-provider는 KRW-only로
  유지 (FX 미사용). axvela-price.ts는 신호의 fxRefs를 collect만 (dedup 후
  PriceSuggestion.fxSnapshots에 보관) — 가격 계산 로직 0줄 변경. STEP 29만
  실제 FX 변환을 사용 (USD 옥션 가격 → KRW).
- **PriceSuggestion FX traceability** — external signal에 첨부된 FX snapshot이
  `(base/quote/provider)` 키로 dedup되어 `PriceSuggestion.fxSnapshots`에 보관.
  사용자가 SuggestionCard에서 "FX: USD→KRW 1,380 · mock_fx_v1 · 2026-05-04"
  형태로 audit reference 직접 확인 가능.
- **Invoice schema 변경 0** — `createFXSnapshot(base, quote)` helper는 마련했으나
  Invoice lock 흐름 무수정. Money Flow / Payment / Settlement / Tax 계산 로직
  0줄 변경. 실 wiring은 후속 STEP에서.
- **Determinism 보존** — Mock provider는 정적 테이블 → 같은 쌍 호출 시 같은
  rate. fetchedAt만 호출 시점으로 변동 (메타데이터). FXRate.id는
  `fx_${base}_${quote}_${providerId}` 안정 키 — timestamp 무관.

---

## 1. 현재 코드 분석

**STEP 31 진입 시점 (v30 baseline):**

| 항목 | 진입 시점 | STEP 31 종료 |
|---|---|---|
| FX 변환 위치 | `external-auction-provider.ts` 안에 hardcoded | **외부화** — `fx-provider.ts` 단일 source of truth |
| `FX_TO_KRW: Record<string,number>` | external-auction-provider.ts (4 entries) | **삭제** — `MockFXRateProvider`로 이동 + 6 entries (cross rates 포함) |
| `toKRW(amount, currency)` private helper | external-auction-provider.ts | **삭제** — `convertCurrency(amount, base, quote)` 글로벌 |
| FXRate 타입 | 부재 | 신규 `src/types/fx.ts` |
| FXRateProvider interface | 부재 | 신규 |
| Provider registry | 부재 | `getActiveFXProvider` / `setActiveFXProvider` |
| Fallback policy | 부재 (toKRW가 0 반환) | 3-tier (provider → static → null) |
| FX snapshot 기록 | 부재 | external signal `source.fxRefs?` + PriceSuggestion `fxSnapshots?` |
| UI FX 노출 | 부재 | SuggestionCard 푸터 FX 라인 (외부 신호 사용 시에만) |
| `createFXSnapshot()` helper | 부재 | 신규 — 향후 Invoice lock에서 호출 가능 |

**의존 관계:**
- `src/types/fx.ts` ← `src/types/transaction.ts` (Currency type)
- `src/lib/fx-provider.ts` ← `src/types/fx.ts`, `src/types/transaction.ts`
- `src/types/market-signal.ts` ← `src/types/fx.ts` (FXRate import 추가)
- `src/types/price-suggestion.ts` ← `src/types/fx.ts` (FXRate import 추가)
- `src/lib/external-auction-provider.ts` ← `src/lib/fx-provider.ts` (convertCurrency / getFXRate)
- `src/lib/axvela-price.ts` ← `src/types/fx.ts` (FXRate import for fxSnapshots collect)
- `src/components/artwork/ArtworkFormDrawer.tsx` — fxSnapshots destructure + FX footer

순환 import 0건. axvela-price.ts는 fx-provider를 직접 호출하지 않음 (signal 안의 FX snapshot을 dedup만).

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/types/market-signal.ts` | FXRate import 추가. `MarketSignalSource.external` 분기에 optional `fxRefs?: FXRate[]` 필드 추가 (internal 분기는 무수정). |
| `src/types/price-suggestion.ts` | FXRate import 추가. `PriceSuggestion`에 optional `fxSnapshots?: FXRate[]` 필드 추가 — 외부 신호 사용 시 dedup된 unique 환율 보관. |
| `src/lib/external-auction-provider.ts` | **정적 `FX_TO_KRW` 테이블 + `toKRW` 함수 삭제** (line 39-50 제거). `convertCurrency` / `getFXRate` import 추가. 3개 toKRW 호출 사이트 (artist_avg krwValues / artist_recent_sale recentKRW / marketplace listing krwValues) 모두 `convertCurrency(amount, "USD", "KRW")`로 교체. `buildSignalsFor` 시작에 `usdKrwSnapshot` 생성 + 모든 external signal source에 `fxRefs: FXRate[]` 첨부. |
| `src/lib/axvela-price.ts` | FXRate import 추가. external signal들의 `source.fxRefs`를 `(base/quote/provider)` 키로 dedup → `fxSnapshotsMap` → array. PriceSuggestion 반환 객체에 `...(fxSnapshots.length > 0 ? { fxSnapshots } : {})` spread (비어있으면 필드 자체 미포함 — JSON 깨끗하게). 가격 계산 로직 / sourceRefs 누적 / confidence boost / disclaimer 분기 / rationale 0줄 수정. |
| `src/components/artwork/ArtworkFormDrawer.tsx` | `SuggestionCard` destructure에 `fxSnapshots` 추가. rationale list 아래 FX footer 섹션 추가 — `fxSnapshots && fxSnapshots.length > 0`일 때 각 FXRate에 대해 "FX USD→KRW 1,380 · mock_fx_v1 · 2026-05-04" 한 줄 표시. text-[9.5px] muted 톤 — 사용자 spec "안내 문구 정도만" 준수. STEP 29 `EXT REF` 배지 / 신뢰도 row / Range row / appliedAt 마커 / rationale list 모두 무수정. |
| `ARCHITECTURE.md` | rule_20 FX matrix 갱신 + STEP 31 changelog |

---

## 3. 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/types/fx.ts` | 70 | `FXRate` interface (9 fields per spec) + `FXRateProvider` interface (providerId / isExternal / getRate). Currency type은 `@/types/transaction`에서 import — KRW/USD/EUR/JPY 4종. |
| `src/lib/fx-provider.ts` | 195 | `MockFXRateProvider` class (providerId="mock_fx_v1", isExternal=false). `MOCK_RATES` 9 entries (USD/EUR/JPY ↔ KRW 6개 + cross rates 3개). `getActiveFXProvider` / `setActiveFXProvider` singleton registry. `getFXRate` (3-tier fallback) / `convertCurrency` / `createFXSnapshot` module helpers. `FALLBACK_RATES` 6 entries (provider 실패 안전망). `identityRate(currency)` (base===quote 전용). |
| `STEP_31_FX_RATE_SYSTEM_COMPLETE.md` | 본 문서 |

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/lib/internal-market-provider.ts` | KRW-only 신호 — FX 미사용 (사용자 spec "STEP 19 MarketSignal helper 정적 테이블 직접 참조 안 함" — 본래 참조도 안 했음, 무수정) |
| `src/lib/axvela-price.ts` 가격 계산 로직 (3-tier confidence + blend + boost + disclaimer) | 0줄 수정 — FX는 audit metadata만 collect |
| `src/lib/market-data.ts` | `gatherMarketSignals` / `ACTIVE_PROVIDERS` 무수정 |
| `src/types/market-signal.ts` `MarketSignal` interface 본문 | source.fxRefs만 추가, 나머지 필드 그대로 |
| Invoice / Payment / Settlement / Tax / Contract / Logistics 도메인 | 0줄 변경 (사용자 spec 명시) |
| `src/store/useArtworkStore.ts` (`generatePriceSuggestionForArtwork` / `applyPriceSuggestion` / 모든 도메인 액션) | 0줄 변경 |
| `mock-data.ts` / 모든 도메인 entity / Currency type | 0줄 변경 |
| Audit (STEP 20/21/23/25) | 0줄 변경 |
| Persistence (STEP 27 / 27.7 / 30) | 0줄 변경 |
| 3-Column 레이아웃 / Sidebar / 모든 Drawer (SuggestionCard 외) | 0줄 변경 |
| RBAC matrix / 권한 / `package.json` | 0줄 변경 |

---

## 5. 핵심 코드

### 5.1 `FXRate` type (사용자 spec 9개 필드)

```ts
export interface FXRate {
  id: string;
  baseCurrency: Currency;
  quoteCurrency: Currency;
  rate: number;             // 1 base = rate × quote
  provider: string;
  fetchedAt: string;
  validUntil?: string;
  isExternal: boolean;
  sourceNote?: string;
}
```

### 5.2 `FXRateProvider` contract

```ts
export interface FXRateProvider {
  readonly providerId: string;
  readonly isExternal: boolean;
  getRate(base: Currency, quote: Currency): FXRate | null;
}
```

### 5.3 `MockFXRateProvider`

```ts
const MOCK_RATES: Record<string, number> = {
  "USD/KRW": 1380, "EUR/KRW": 1480, "JPY/KRW": 9.2,
  "KRW/USD": 1/1380, "KRW/EUR": 1/1480, "KRW/JPY": 1/9.2,
  "USD/EUR": 0.93, "EUR/USD": 1/0.93,
  "USD/JPY": 150, "JPY/USD": 1/150,
  "EUR/JPY": 161.0, "JPY/EUR": 1/161.0,
};

export class MockFXRateProvider implements FXRateProvider {
  readonly providerId = "mock_fx_v1";
  readonly isExternal = false;

  getRate(base, quote): FXRate | null {
    if (base === quote) return identityRate(base, this.providerId);
    const rate = MOCK_RATES[`${base}/${quote}`];
    if (rate === undefined) return null;
    return {
      id: `fx_${base}_${quote}_${this.providerId}`,
      baseCurrency: base, quoteCurrency: quote,
      rate, provider: this.providerId,
      fetchedAt: new Date().toISOString(),
      isExternal: false,
      sourceNote: "내부 정적 환율 테이블 (v1 mock)",
    };
  }
}
```

### 5.4 3-tier fallback in `getFXRate`

```ts
export function getFXRate(base: Currency, quote: Currency): FXRate | null {
  if (base === quote) return identityRate(base, "identity");
  // Tier 1 — active provider
  try {
    const rate = getActiveFXProvider().getRate(base, quote);
    if (rate) return rate;
  } catch { /* fall through */ }
  // Tier 2 — static fallback
  const fallback = FALLBACK_RATES[`${base}/${quote}`];
  if (fallback !== undefined) {
    return {
      id: `fx_${base}_${quote}_fallback`,
      baseCurrency: base, quoteCurrency: quote,
      rate: fallback, provider: "fallback_static_v1",
      fetchedAt: new Date().toISOString(),
      isExternal: false,
      sourceNote: "Provider 실패 fallback — 정적 테이블",
    };
  }
  // Tier 3 — unknown pair
  return null;
}
```

### 5.5 ExternalAuctionProvider 리팩토링 (Before / After)

**Before:**
```ts
const FX_TO_KRW: Record<string, number> = { USD: 1380, EUR: 1480, JPY: 9.2, GBP: 1750 };
function toKRW(amount, currency) {
  const rate = FX_TO_KRW[currency];
  if (!rate) return 0;
  return Math.round(amount * rate);
}
// ...
const krwValues = comparables.map(c => toKRW(c.pricePaidUSD, "USD"));
out.push({
  source: { kind: "external", provider, fetchedAt },
  // ...
});
```

**After:**
```ts
import { convertCurrency, getFXRate } from "@/lib/fx-provider";

const usdKrwSnapshot = getFXRate("USD", "KRW");
const fxRefs: FXRate[] = usdKrwSnapshot ? [usdKrwSnapshot] : [];
// ...
const krwValues = comparables.map(c =>
  convertCurrency(c.pricePaidUSD, "USD", "KRW")
);
out.push({
  source: { kind: "external", provider, fetchedAt, fxRefs },
  // ...
});
```

3개 호출 사이트 모두 (artist_avg krwValues / artist_recent_sale recentKRW / marketplace listing krwValues) 같은 패턴.

### 5.6 axvela-price.ts FX collect

```ts
// 가격 계산 / sourceRefs 누적 / confidence boost 모두 무수정 — 마지막에 추가:

const fxSnapshotsMap = new Map<string, FXRate>();
for (const sig of marketSignals) {
  if (sig.source.kind !== "external") continue;
  const refs = sig.source.fxRefs;
  if (!refs || refs.length === 0) continue;
  for (const r of refs) {
    const key = `${r.baseCurrency}/${r.quoteCurrency}/${r.provider}`;
    if (!fxSnapshotsMap.has(key)) fxSnapshotsMap.set(key, r);
  }
}
const fxSnapshots: FXRate[] = Array.from(fxSnapshotsMap.values());

return {
  artworkId: artwork.id,
  // ... 기존 필드 무수정 ...
  sourceRefs,
  ...(fxSnapshots.length > 0 ? { fxSnapshots } : {}),
};
```

Empty array일 때 필드 자체 미포함 — JSON cleaner.

### 5.7 SuggestionCard FX footer

```tsx
{fxSnapshots && fxSnapshots.length > 0 && (
  <div className="flex flex-col gap-0.5 pt-1.5 border-t border-line">
    {fxSnapshots.map((fx) => (
      <div
        key={fx.id}
        className="flex items-center gap-1.5 text-[9.5px] tracking-tightish text-ink-subtle"
        title={`Provider: ${fx.provider}${fx.sourceNote ? ` — ${fx.sourceNote}` : ""}`}
      >
        <span className="font-semibold uppercase tracking-[0.08em]">FX</span>
        <span className="tabular-nums">
          {fx.baseCurrency}→{fx.quoteCurrency} {fx.rate.toLocaleString("en-US", { maximumFractionDigits: 4 })}
        </span>
        <span aria-hidden>·</span>
        <span>{fx.provider}</span>
        <span aria-hidden>·</span>
        <span>{fx.fetchedAt.slice(0, 10)}</span>
      </div>
    ))}
  </div>
)}
```

표시 예 (김지은 작가):
```
FX  USD→KRW 1,380  ·  mock_fx_v1  ·  2026-05-04
```

### 5.8 `createFXSnapshot` helper (Invoice 후속 STEP용)

```ts
export function createFXSnapshot(base: Currency, quote: Currency): FXRate | null {
  const rate = getFXRate(base, quote);
  if (!rate) return null;
  return { ...rate, fetchedAt: new Date().toISOString() };
}
```

향후 Invoice lock 흐름에서:
```ts
// 미래 STEP 32+ 가상 코드:
async function lockInvoice(invoice: Invoice) {
  if (invoice.currency !== "KRW") {
    invoice.fxSnapshot = createFXSnapshot(invoice.currency, "KRW");
  }
  invoice.lockedAt = new Date().toISOString();
}
```

본 STEP 31에서는 helper만 마련. Invoice schema 변경 0.

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    72.5 kB         160 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 30 (Remote Sync) | 71.8 kB | — |
| **STEP 31 (FX Rate System)** | **72.5 kB** | **+0.7** |

`tsc --noEmit` 0 error / `next build` 0 warning. **외부 npm 의존성 0개 추가**. 정적 source 검증:
- `toKRW` / `FX_TO_KRW` 사용 사이트 → 0건 (코드 영역에서 완전 제거)
- `fxRefs` 첨부 사이트 → 3건 (external auction provider artist_avg / recent_sale / listing)
- `fxSnapshots` collect & UI render → axvela-price.ts + SuggestionCard

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_4** Trust Layer | ✅ **강화** | FX 환율의 audit snapshot이 PriceSuggestion에 영구 보관 — "왜 이 가격이 나왔는가"의 환율 traceability |
| **rule_5** AI-Human Loop | ✅ | FX는 데이터 layer — AI 흐름 무영향 |
| **rule_18 (b)** 시장 분석 | ✅ | 외부 통화 가격 변환의 audit-grade 기록 가능 |
| **rule_19** Market Data | ✅ | external signal source attribution 강화 |
| **rule_20** FX | ✅ **승격** | 🟡 (정적 테이블 read-only) → ✅ Provider system + 3-tier fallback + audit snapshot. Invoice lock 적용은 후속 STEP에서 wiring (helper 마련) |
| Money Flow / Contract / Invoice / Tax / Settlement 계산 로직 변경 | ✅ 0줄 | 사용자 spec 명시 |
| Invoice LOCK 로직 | ✅ 무변경 | schema 변경 0, helper만 |
| 3-Column 레이아웃 | ✅ 무변경 | SuggestionCard 안에 FX 라인만 추가 |
| 실 외부 FX API 호출 | ✅ 0건 | mock + fallback table만 |
| Backend 추가 | ✅ 0건 | client-only |
| 외부 라이브러리 추가 | ✅ 0개 | browser native + Date 만 사용 |
| 기존 기능 rollback | ✅ 0건 | STEP 18/19/29 모두 그대로 동작 |
| Confidence cap 0.95 유지 | ✅ | axvela-price.ts 가격 계산 0줄 변경 |
| "참고 가격 범위" 표현 | ✅ 0건 변경 | 감정/확정 표현 0건 |

---

## 8. 검증 시나리오

### A — USD market reference가 KRW로 변환됨

1. 김지은 작가 작품 (auction comparable USD $14,500 / $18,200 보유) 편집 진입
2. "AXVELA AI 가격 제안" 클릭
3. **기대**:
   - SuggestionCard에 `EXT REF` 배지 노출 (STEP 29)
   - rationale에 "옥션 comparable 2건 평균 ₩22,563,000 (Sotheby's HK, Christie's HK)" 등 KRW 변환 결과
   - 푸터에 `FX USD→KRW 1,380 · mock_fx_v1 · 2026-05-04` (STEP 31 신규)
4. 변환 검증: ($14,500 + $18,200) / 2 × 1380 = $16,350 × 1380 = ₩22,563,000

### B — FX provider 실패 시 fallback rate 사용

```ts
// 테스트 코드 (콘솔 또는 별도 test):
class FailingProvider implements FXRateProvider {
  readonly providerId = "failing_v1";
  readonly isExternal = false;
  getRate() { throw new Error("simulated"); }
}
setActiveFXProvider(new FailingProvider());

const rate = getFXRate("USD", "KRW");
// → fallback static로 진입 → { rate: 1380, provider: "fallback_static_v1", ... }
```

5. **기대**: PriceSuggestion 정상 동작 (변환 결과 동일), FX footer에 `fallback_static_v1` provider 표기.

### C — getFXRate(unknown pair) → null + convertCurrency → 0

```ts
const r = getFXRate("USD", "INR" as Currency); // INR 미지원
// → MockFXRateProvider null + FALLBACK 미존재 → null
const krw = convertCurrency(100, "USD", "INR" as Currency);
// → 0 (loud surface)
```

### D — Identity rate (base === quote)

```ts
const r = getFXRate("KRW", "KRW");
// → { rate: 1.0, provider: "identity", ... }
const v = convertCurrency(50000, "KRW", "KRW");
// → 50000 (변환 없이 그대로)
```

### E — PriceSuggestion 정상 동작 (외부 신호 없음)

1. 정민호 작가 (외부 mock data 부재) 작품 편집 → AI 가격 제안
2. **기대**:
   - `EXT REF` 배지 없음 (STEP 29 동작 그대로)
   - FX footer 없음 (`fxSnapshots` 비어있어 미렌더)
   - rationale 마지막 줄: "외부 시장 데이터 미사용 — 내부 거래 기록 기반 v1 제안"
   - 가격 / 신뢰도 STEP 19 baseline과 동일

### F — Mock data 정상

1. F5 새로고침 후 모든 작품 (외부 데이터 있는 5명 + 없는 2명) 정상 표시
2. ArtworkGrid / DetailPanel / 모든 Drawer 정상

### G — Determinism (cache-stable)

1. 같은 작가 작품 generate 2번
2. **기대**:
   - suggestedLow/Mid/High/confidence 동일 (cache hit으로 신호 재계산 안 됨)
   - fxSnapshots[0].rate, provider, baseCurrency, quoteCurrency 동일
   - fxSnapshots[0].fetchedAt만 각 호출에 따라 다를 수 있음 (cache 만료 시점에 따라)

### H — Confidence cap 0.95 유지

1. external + internal 신호 다수인 작가 (예: 김지은) 작품 generate
2. **기대**: confidence ≤ 0.95 (axvela-price.ts 로직 무수정)

### I — Money Flow / Tax / Settlement 동작 검증

1. 임의 작품 거래 생성 → invoice lock → payment 등록 → settlement → tax record
2. **기대**: 모든 흐름 STEP 30 baseline과 동일. FX system은 외부 reference 가격에만 영향 — Money Flow 무영향.

### J — Provider swap-ready 검증 (개발자 view)

```ts
// 미래 코드 (실제 작성 안 해도 됨, type 검증만):
class OpenExchangeRatesProvider implements FXRateProvider {
  readonly providerId = "openexchange_v1";
  readonly isExternal = true;
  getRate(base, quote): FXRate | null { /* fetch from API */ return null; }
}
setActiveFXProvider(new OpenExchangeRatesProvider());
// PriceSuggestion / ExternalAuctionProvider / Invoice 코드 0줄 수정.
```

### K — UI footer 시각 검증

1. 김지은 작품 generate → SuggestionCard 시각 확인
2. **기대**:
   - 신뢰도 row 옆 `EXT REF` 배지 (STEP 29)
   - rationale 항목들 (STEP 18/19)
   - 맨 아래에 `FX USD→KRW 1,380 · mock_fx_v1 · 2026-05-04` 한 줄 (STEP 31 신규)
   - hover 시 title `Provider: mock_fx_v1 — 내부 정적 환율 테이블 (v1 mock)`

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| Mock 정적 테이블 | 실 환율 변동 미반영 | OpenExchangeRatesProvider / Fixer.io / 한국은행 ECOS connector 도입 |
| Cache TTL 부재 | mock은 매 호출마다 새 fetchedAt | 실 provider는 자체 cache + TTL 구현 |
| Invoice FX wiring 안 됨 | helper만 마련, lock 흐름은 무수정 | 후속 STEP에서 Invoice schema에 `fxSnapshot?: FXRate` 추가 + lock 시점에 createFXSnapshot 호출 |
| 통화 4종만 지원 | Currency type = KRW/USD/EUR/JPY | Currency type 확장 + provider 데이터 추가 |
| Cross rate 정확도 | EUR/JPY 등은 직접 계산 (USD via 미경유) | 실 provider는 정확 mid market rate |
| Bid/ask 분리 안 됨 | 단일 mid rate만 | 실 trading 시나리오 필요 시 spread 도입 |
| 환율 history 부재 | 단일 시점 snapshot만 | timeseries provider 추가 검토 |
| Failure 시뮬레이션 hook 없음 | MockFXRateProvider는 항상 성공 | failureRate 옵션 추가 가능 (STEP 29 ExternalAuctionProvider 패턴) |
| FX UI 표시는 SuggestionCard만 | Invoice / Settlement / Tax 등 다른 곳 미노출 | 후속 STEP에서 각 도메인 drawer에 FX badge 추가 가능 |

---

## 10. 향후 실 백엔드 교체 가이드 (예시)

### Open Exchange Rates 도입 시

```ts
// src/lib/openexchange-fx-provider.ts (신규, 후속 STEP)
export class OpenExchangeRatesProvider implements FXRateProvider {
  readonly providerId = "openexchange_v1";
  readonly isExternal = true;
  private cache = new Map<string, { rate: FXRate; expiresAt: number }>();
  private readonly appId: string;
  private readonly cacheTTLMs = 60 * 60 * 1000; // 1h

  constructor(opts: { appId: string }) {
    this.appId = opts.appId;
  }

  getRate(base, quote): FXRate | null {
    const key = `${base}/${quote}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.rate;
    // 실 fetch는 별도 prefetch 메서드 (sync API 유지). 첫 호출 시 null 반환,
    // 이후 prefetch 결과를 cache에서 hit.
    void this.prefetch(base, quote);
    return null;
  }

  private async prefetch(base, quote) {
    const res = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${this.appId}&base=${base}`);
    const data = await res.json();
    const rate = data.rates[quote];
    if (typeof rate !== "number") return;
    this.cache.set(`${base}/${quote}`, {
      rate: {
        id: `fx_${base}_${quote}_oxr`,
        baseCurrency: base, quoteCurrency: quote,
        rate, provider: this.providerId,
        fetchedAt: new Date(data.timestamp * 1000).toISOString(),
        validUntil: new Date(Date.now() + this.cacheTTLMs).toISOString(),
        isExternal: true,
        sourceNote: "Open Exchange Rates live",
      },
      expiresAt: Date.now() + this.cacheTTLMs,
    });
  }
}

// 앱 mount 전:
setActiveFXProvider(new OpenExchangeRatesProvider({ appId: process.env.OXR_APP_ID }));
```

PriceSuggestion / ExternalAuctionProvider / Invoice 코드 무수정. SuggestionCard FX footer는 자동으로 "openexchange_v1" provider 표기.

---

## 11. 다음 STEP 후보

1. **STEP 32 — Invoice FX Lock Wiring** — 본 STEP createFXSnapshot 헬퍼를 Invoice lock 흐름에 wiring. Invoice schema에 `fxSnapshot?: FXRate` 추가. Settlement / Tax 흐름에서 lock된 FX rate 참조.
2. **STEP 33 — Real FX Provider** — OpenExchangeRatesProvider 실 구현. Open Exchange Rates / 한국은행 ECOS / Fixer.io 중 선택.
3. **STEP 28 — Real AI Integration** — Curation / Inquiry response / Price suggestion 실 AI API.
4. **STEP 24 — Audit Filters 강화** — date range / multi-select.
5. **STEP 26 — Audit Trail Visualization** — timeline graph / heatmap.
6. **STEP 27.5 — IndexedDBAdapter** — localStorage 5MB 한계 해소.
7. **STEP 30.5 — Periodic Pull / Polling** — multi-device 시 다른 device 변경 자동 인식.
8. **STEP 32 — Document Approval Workflow** — Contract / Curation multi-step approval.
