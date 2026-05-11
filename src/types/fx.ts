// ============================================================================
// FX Rate Types — STEP 31 (Real FX Rate System v1)
//
// 통화 변환을 위한 type layer. v1은 deterministic mock provider만 — 실제 외부
// 환율 API 호출 0줄. 향후 STEP에서 본 interface를 만족하는 새 provider 추가
// 만으로 실시간 feed 도입 가능.
//
// 사용 위치:
//   - STEP 29 ExternalAuctionProvider — USD 옥션 가격 → KRW 변환
//   - STEP 31 PriceSuggestion — 외부 신호 사용 시 FX snapshot을 audit ref로 첨부
//   - 향후 Invoice lock 시점 환율 기록 (이번 STEP에서는 helper만 마련, schema
//     변경 0)
//
// 결정성 (rule_4 trust):
//   - 같은 base/quote 쌍은 같은 provider 안에서 동일 rate 반환 (cache 아니어도
//     deterministic)
//   - id는 provider/pair 기반 안정 키 — fetchedAt timestamp로 시간 차원만 변동
// ============================================================================

import type { Currency } from "@/types/transaction";

/**
 * 한 시점의 환율 스냅샷. Provider가 emit하거나 호출자가 audit 용도로 보관.
 *
 * 의미:
 *   - `1 baseCurrency = rate × quoteCurrency`
 *   - 예: `{ base: "USD", quote: "KRW", rate: 1380 }` → 1 USD = 1380 KRW
 */
export interface FXRate {
  /** Provider/pair 기반 안정 식별자. fetchedAt 타임스탬프와 별개. */
  id: string;
  baseCurrency: Currency;
  quoteCurrency: Currency;

  /** 1 base 단위가 quote 통화로 몇인지. 항상 양수. */
  rate: number;

  /** Provider 식별자 (예: "mock_fx_v1", "fallback_static_v1", "identity") */
  provider: string;

  /** ISO datetime — provider가 본 rate를 산출한 시점. */
  fetchedAt: string;

  /** ISO datetime — TTL 경계. 명시 안 하면 만료 정책 없음 (mock default). */
  validUntil?: string;

  /** 외부 네트워크 fetch 결과면 true. mock / fallback / identity는 false. */
  isExternal: boolean;

  /** 사람이 읽는 short note (audit / 디버그 용) */
  sourceNote?: string;
}

/**
 * 환율 공급자 contract. v1 mock + 향후 실 API provider 모두 구현.
 *
 * Sync API 의도적 — STEP 19/29 MarketDataProvider와 같은 패턴. 실 API 도입 시
 * provider 내부에서 cache / pre-fetch / WebSocket으로 sync 응답 유지.
 */
export interface FXRateProvider {
  /** 식별자 — debug / audit / status UI에 노출 */
  readonly providerId: string;
  /** 실 네트워크 호출 여부. mock = false. */
  readonly isExternal: boolean;

  /**
   * 환율 조회. 지원 안 하는 통화 쌍은 null 반환 (호출자가 fallback 결정).
   *
   * 같은 통화 쌍 (base === quote)도 호출 가능 — provider가 identity rate (1.0)
   * 반환 권장. 모듈 helper `getFXRate`는 base===quote 케이스를 provider 호출
   * 전 처리하므로 provider 구현은 base !== quote만 다루어도 됨.
   */
  getRate(base: Currency, quote: Currency): FXRate | null;
}
