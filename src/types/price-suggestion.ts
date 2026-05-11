// ============================================================================
// PriceSuggestion — STEP 18 (rule_18 AI Layer · 가격 제안)
//
// 핵심 원칙:
//   - AXVELA AI는 가격을 *확정하지 않는다*.
//   - 범위 (low / mid / high)와 근거만 제안한다.
//   - 최종 가격 적용은 사용자가 명시적으로 클릭해야 한다 (rule_5 AI-Human Loop).
//   - **외부 시장 데이터 / 외부 API 호출 금지** — 내부 보유 기록만 사용.
//
// rule_19 (Market Data) 본격 구현은 별도 STEP. 본 STEP에서 PriceSuggestion은
// "내부 거래 기록 기반 v1 제안"이며, 외부 마켓 데이터를 통합하기 전 단계의
// 디터미니스틱 helper다.
// ============================================================================

import type { Currency } from "./transaction";
import type { FXRate } from "./fx";
import type { MarketSignalKind } from "./market-signal";

/**
 * Suggestion이 어떤 내부 기록을 근거로 했는지의 traceable reference.
 * Audit / 신뢰성을 위해 timeline emit과 별도로 suggestion 객체에 보관 —
 * 사용자가 카드 위에서 "이 가격을 왜 제안했는지" 확인 가능.
 */
export type PriceSuggestionSourceRef =
  /** Artwork.priceKRW가 base로 사용됨 */
  | { kind: "current_price"; valueKRW: number }
  /** 과거 paid Transaction의 agreedPrice 참조 */
  | {
      kind: "transaction";
      transactionId: string;
      agreedPrice: number;
      currency: Currency;
    }
  /** 실제 결제 기록의 amount 참조 — 가장 신뢰 가능한 신호 */
  | {
      kind: "payment";
      paymentId: string;
      amount: number;
      currency: Currency;
    }
  /** Resale transaction의 commission rate 반영 */
  | {
      kind: "resale_commission";
      transactionId: string;
      rate: number;
      previousPrice: number;
    }
  /** Tier 3 (데이터 부족) fallback — 갤러리 전체 평균을 임시 base로 */
  | {
      kind: "gallery_median";
      valueKRW: number;
      sampleSize: number;
    }
  /**
   * STEP 19 — Market signal reference. provider가 emit한 MarketSignal과 매핑.
   * 본 STEP은 internal-only. STEP 29에서 external signal도 같은 ref로 표시.
   */
  | {
      kind: "market_signal";
      signalId: string;
      signalKind: MarketSignalKind;
      provider: string;        // "internal_v1" / 향후 external provider id
      isExternal: boolean;     // STEP 29 구분 표시용
      sampleSize: number;
      summary: string;         // 카드에 보일 짧은 한 줄 요약
    };

/**
 * AI가 생성한 가격 제안. 한 작품에 여러 suggestion 가능 (재실행 시 새 record).
 *
 * `appliedAt`이 채워진 suggestion은 사용자가 "Mid 가격 적용" 버튼을 눌러
 * form draft에 반영했음을 의미. 단, 이는 **artwork.priceKRW 변경을 보장하지
 * 않는다** — form 저장 흐름을 거쳐야 실제 가격 변경. 적용 후 폼 취소 시
 * appliedAt은 그대로 남고 (의도 기록용), artwork.priceKRW는 무변경.
 */
export interface PriceSuggestion {
  id: string;
  artworkId: string;

  // Suggestion 본문 — 모두 같은 currency
  suggestedLow: number;
  suggestedMid: number;
  suggestedHigh: number;
  currency: Currency;

  /**
   * 0 ~ 1. 데이터 양·신뢰도에 따라 deterministic하게 책정.
   *   - 0.82  paid transaction + payment 기록 존재 (Tier 1)
   *   - 0.62  artwork 가격만 존재 (Tier 2)
   *   - 0.35  데이터 부족 → gallery median fallback (Tier 3)
   */
  confidence: number;

  /** 사용자가 카드에서 읽을 짧은 근거 항목 (한국어 문장) */
  rationale: string[];

  /** Audit trail — 어떤 record를 참조했는지 */
  sourceRefs: PriceSuggestionSourceRef[];

  /**
   * STEP 31 — 본 suggestion 생성 시점에 참조한 FX rate snapshot(s).
   * External market signal이 (USD 등 외부 통화 가격을) KRW로 변환할 때 사용한
   * 환율의 audit 기록. dedup된 unique 환율들. 외부 신호가 없으면 비어 있거나
   * undefined.
   *
   * Suggestion 자체의 KRW 값은 generate 시점에 fix되지만, 본 필드는 "왜 그
   * 값이 나왔는가"의 환율 traceability를 제공.
   */
  fxSnapshots?: FXRate[];

  // Lifecycle
  createdAt: string; // ISO datetime
  /** 사용자가 "Mid 가격 적용"을 누른 시점 (apply 액션 호출 시 채워짐) */
  appliedAt?: string;
}

/**
 * Confidence 0~1을 사용자에게 노출할 짧은 한국어 라벨. 카드의 confidence
 * 표시는 "0.82" 숫자가 아니라 "높음/보통/낮음"을 함께 보여주어 비전문가도 즉시
 * 이해 가능하게 함.
 */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.75) return "높음";
  if (confidence >= 0.5) return "보통";
  return "낮음";
}
