// ============================================================================
// FX Provider System — STEP 31 (Real FX Rate System v1)
//
// 환율 변환의 단일 진입점. STEP 29 ExternalAuctionProvider에 박혀있던 정적
// `FX_TO_KRW` 테이블 + `toKRW` 함수를 본 모듈로 외부화. 향후 실 환율 API 도입
// 시 `MockFXRateProvider`만 새 구현체로 교체 (Provider/Helpers contract 무변경).
//
// 책임:
//   1) `FXRateProvider` contract을 만족하는 mock 구현 (`MockFXRateProvider`)
//   2) Active provider singleton + 교체 helper (`get/setActiveFXProvider`)
//   3) 통화 변환 모듈 helper (`getFXRate` / `convertCurrency` / `createFXSnapshot`)
//   4) Provider 실패 / 미지원 쌍 → static fallback table → null의 3-tier policy
//
// **본 STEP에서 외부 API 호출 0줄, 외부 라이브러리 0개 추가**.
//
// 향후 실 API provider 예시:
//
//   class OpenExchangeRatesProvider implements FXRateProvider {
//     readonly providerId = "openexchange_v1";
//     readonly isExternal = true;
//     private cache = new Map<string, FXRate>();
//     private async refresh() { /* fetch + cache */ }
//     getRate(base, quote) { return this.cache.get(`${base}/${quote}`) ?? null; }
//   }
//   setActiveFXProvider(new OpenExchangeRatesProvider());
//
// PriceSuggestion / ExternalAuctionProvider / Invoice 코드 무수정.
// ============================================================================

import type { Currency } from "@/types/transaction";
import type { FXRate, FXRateProvider } from "@/types/fx";

// ---------------------------------------------------------------------------
// Mock provider — v1 deterministic 정적 환율
//
// 본 STEP 이전 STEP 29 ExternalAuctionProvider에 박혀있던 테이블이 그대로 이동.
// 실 환율 API 도입 시까지 가격 변환의 단일 source of truth.
// ---------------------------------------------------------------------------

const MOCK_RATES: Record<string, number> = {
  // → KRW (갤러리 본 통화)
  "USD/KRW": 1380,
  "EUR/KRW": 1480,
  "JPY/KRW": 9.2,

  // 역변환 (예: 가격 표시를 base 통화로 보여줄 때)
  "KRW/USD": 1 / 1380,
  "KRW/EUR": 1 / 1480,
  "KRW/JPY": 1 / 9.2,

  // Cross rates (주요 페어)
  "USD/EUR": 0.93,
  "EUR/USD": 1 / 0.93,
  "USD/JPY": 150,
  "JPY/USD": 1 / 150,
  "EUR/JPY": 161.0,
  "JPY/EUR": 1 / 161.0,
};

export class MockFXRateProvider implements FXRateProvider {
  readonly providerId = "mock_fx_v1";
  readonly isExternal = false;

  getRate(base: Currency, quote: Currency): FXRate | null {
    if (base === quote) return identityRate(base, this.providerId);
    const key = `${base}/${quote}`;
    const rate = MOCK_RATES[key];
    if (rate === undefined) return null;
    return {
      id: `fx_${base}_${quote}_${this.providerId}`,
      baseCurrency: base,
      quoteCurrency: quote,
      rate,
      provider: this.providerId,
      fetchedAt: new Date().toISOString(),
      isExternal: false,
      sourceNote: "내부 정적 환율 테이블 (v1 mock)",
    };
  }
}

// ---------------------------------------------------------------------------
// Active provider registry — singleton with lazy init
// ---------------------------------------------------------------------------

let _fxProvider: FXRateProvider | null = null;

/**
 * 현재 활성 FX provider. 첫 호출 시 lazy하게 `MockFXRateProvider` 생성.
 * 향후 실 API 도입 시 mount 전 `setActiveFXProvider(new RealFXProvider())` 호출.
 */
export function getActiveFXProvider(): FXRateProvider {
  if (_fxProvider) return _fxProvider;
  _fxProvider = new MockFXRateProvider();
  return _fxProvider;
}

/**
 * Provider 교체. test / multi-backend 시나리오용.
 */
export function setActiveFXProvider(provider: FXRateProvider): void {
  _fxProvider = provider;
}

// ---------------------------------------------------------------------------
// Module helpers — 호출자 편의 + fallback policy
//
// 3-tier fallback:
//   1) Active provider가 rate 반환 → 사용
//   2) Provider null/throw → static fallback table 시도
//   3) Static table에도 없음 → null (호출자가 final fallback 결정)
// ---------------------------------------------------------------------------

const FALLBACK_RATES: Record<string, number> = {
  // 최소한의 안전망 — 활성 provider 실패 시 가격 변환이 즉시 0이 되는 것을 방지.
  // Mock과 같은 값 — 실 API 도입 시에도 본 fallback은 마지막 안전 그물.
  "USD/KRW": 1380,
  "EUR/KRW": 1480,
  "JPY/KRW": 9.2,
  "KRW/USD": 1 / 1380,
  "KRW/EUR": 1 / 1480,
  "KRW/JPY": 1 / 9.2,
};

export function getFXRate(base: Currency, quote: Currency): FXRate | null {
  if (base === quote) return identityRate(base, "identity");

  // Tier 1 — active provider
  try {
    const provider = getActiveFXProvider();
    const rate = provider.getRate(base, quote);
    if (rate) return rate;
  } catch {
    // fall through to fallback
  }

  // Tier 2 — static fallback table
  const fallback = FALLBACK_RATES[`${base}/${quote}`];
  if (fallback !== undefined) {
    return {
      id: `fx_${base}_${quote}_fallback`,
      baseCurrency: base,
      quoteCurrency: quote,
      rate: fallback,
      provider: "fallback_static_v1",
      fetchedAt: new Date().toISOString(),
      isExternal: false,
      sourceNote: "Provider 실패 fallback — 정적 테이블",
    };
  }

  // Tier 3 — 미지원 쌍
  return null;
}

/**
 * 금액 변환. 미지원 쌍은 0 반환 — 호출자가 0을 "변환 실패" 시그널로 처리하도록
 * (silent 0이 silent NaN보다 안전, 디버깅에서 즉시 가시화).
 */
export function convertCurrency(
  amount: number,
  base: Currency,
  quote: Currency
): number {
  if (base === quote) return amount;
  const rate = getFXRate(base, quote);
  if (!rate) return 0;
  return Math.round(amount * rate.rate);
}

/**
 * Invoice lock / PriceSuggestion / 어떤 audit 시점에서든 "지금 이 순간 환율"을
 * 영구 기록할 때 사용. `getFXRate`와 동일하지만 fetchedAt이 항상 호출 시점.
 *
 * 향후 실 API provider는 cache 결과를 그대로 반환하므로 fetchedAt이 cache hit
 * 시점일 수 있음. createFXSnapshot은 호출 시점으로 고정 — "본 거래 lock 시점"
 * 정확성 보장.
 */
export function createFXSnapshot(
  base: Currency,
  quote: Currency
): FXRate | null {
  const rate = getFXRate(base, quote);
  if (!rate) return null;
  return { ...rate, fetchedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Identity rate — 같은 통화 쌍 (KRW/KRW 등)
// ---------------------------------------------------------------------------

function identityRate(currency: Currency, provider: string): FXRate {
  return {
    id: `fx_id_${currency}`,
    baseCurrency: currency,
    quoteCurrency: currency,
    rate: 1.0,
    provider,
    fetchedAt: new Date().toISOString(),
    isExternal: false,
    sourceNote: "동일 통화 — identity rate",
  };
}
