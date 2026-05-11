// ============================================================================
// Market Analysis — STEP 45 (rule_18 (b) AI 시장 분석 view).
//
// AXVELA AI가 단일 작품에 대해 생성하는 *참고 분석 commentary*. 기존
// MarketSignal (STEP 19/29) + PriceSuggestion (STEP 18) + 작품 컨텍스트를
// read-only로 결합해 운영자가 한 번에 읽는 6-section 리포트로 derive.
//
// **데이터 정책 (사용자 spec):**
//   - 실제 AI API 호출 0건 — `generateMarketAnalysis()` deterministic helper
//   - 외부 API 신규 호출 0건 — `gatherMarketSignals()` 결과만 read-only 소비
//   - MarketSignal 구조 변경 0줄 (consumer 역할만)
//   - 신규 도메인 store slice 0개 (UI request slice는 drawer 상태용 — persisted X)
//   - Money Flow / Settlement / Tax / FX / Customer / Persistence 무영향
//
// **표현 정책 (사용자 spec 엄격 준수):**
//   - "감정가" / "확정 시장가" / "투자 수익 보장" 절대 금지
//   - "참고 분석" / "운영 참고" / "시장 신호 기반" 사용
//   - 모든 commentary는 휴리스틱 기반 — "확정" 표현 금지
// ============================================================================

import type { Currency } from "./transaction";

// ----------------------------------------------------------------------------
// Section 1 — Market Position
// ----------------------------------------------------------------------------

/**
 * 작품의 가격 위치를 갤러리 중간가 기준으로 분류. STEP 18의 gallery_median
 * fallback과 같은 데이터를 활용 (read-only).
 */
export type MarketPositionTier =
  | "ABOVE_MEDIAN"      // 갤러리 중간가의 1.2x 이상
  | "AT_MEDIAN"         // 0.8x ~ 1.2x
  | "BELOW_MEDIAN"      // 0.8x 미만
  | "INSUFFICIENT_DATA"; // 갤러리 median 계산 불가 (KRW 작품 부족)

export interface MarketPositionSection {
  tier: MarketPositionTier;
  /** priceKRW / galleryMedianKRW. tier === INSUFFICIENT_DATA 시 null. */
  ratioToMedian: number | null;
  /** 같은 작가의 갤러리 보유 작품 수 (price > 0 기준) */
  artistArtworkCount: number;
  /** 사람이 읽는 commentary (한국어 한 문장) */
  commentary: string;
}

// ----------------------------------------------------------------------------
// Section 2 — Comparable Signal Summary
// ----------------------------------------------------------------------------

export interface ComparableSummarySection {
  /** Internal artist_avg signal — KRW. signal 부재 시 null. */
  internalArtistAvgKRW: number | null;
  internalArtistSampleSize: number;
  /** External artist_avg signal — KRW. signal 부재 시 null (STEP 29 provider 의존). */
  externalArtistAvgKRW: number | null;
  externalArtistSampleSize: number;
  /** 가장 최근 동일 작가 거래 (internal/external 통합, freshness 기준 1건). */
  recentSale:
    | {
        valueKRW: number;
        isExternal: boolean;
        freshness: string; // ISO date
      }
    | null;
  commentary: string;
}

// ----------------------------------------------------------------------------
// Section 3 — Liquidity Signal
// ----------------------------------------------------------------------------

/**
 * 유동성 단계. self_resale 신호 + same-artist transaction velocity proxy 결합.
 *
 * - STRONG             self_resale 신호 보유 + same-artist tx ≥ 3
 * - MODERATE           self_resale 보유 또는 same-artist tx ≥ 2
 * - LIMITED            same-artist tx 1개 이하 (단일 데이터 포인트)
 * - INSUFFICIENT_DATA  same-artist KRW tx 0건
 */
export type LiquidityLevel =
  | "STRONG"
  | "MODERATE"
  | "LIMITED"
  | "INSUFFICIENT_DATA";

export interface LiquiditySection {
  level: LiquidityLevel;
  /** self_resale signal 존재 여부 (본 작품의 prior tx) */
  hasSelfResale: boolean;
  selfResaleValueKRW: number | null;
  /** Same-artist KRW transactions count */
  artistTransactionCount: number;
  /** 본 작품 transactions count */
  ownTransactionCount: number;
  commentary: string;
}

// ----------------------------------------------------------------------------
// Section 4 — Demand / Inquiry Signal
// ----------------------------------------------------------------------------

/**
 * 수요 단계. inquiry_volume 신호 + 최근 30일 inquiry pace + active inquiry.
 *
 * - ELEVATED   recent inquiry ≥ 3 또는 active inquiry ≥ 2
 * - STEADY     inquiry 1+ (recent ≥ 1 OR active ≥ 1)
 * - LOW        inquiry 보유하지만 모두 휴면 (recent 0 + active 0)
 * - NONE       inquiry 0건
 */
export type DemandLevel = "ELEVATED" | "STEADY" | "LOW" | "NONE";

export interface DemandSection {
  level: DemandLevel;
  /** 본 작품 누적 inquiry 수 */
  totalInquiryCount: number;
  /** 30일 이내 created inquiry 수 */
  recentInquiryCount: number;
  /** OPEN / RESPONDED / ESCALATED 인 inquiry 수 */
  activeInquiryCount: number;
  commentary: string;
}

// ----------------------------------------------------------------------------
// Section 5 — Pricing Confidence
// ----------------------------------------------------------------------------

export interface PricingConfidenceSection {
  /** PriceSuggestion 보유 여부 (priceSuggestions[artworkId][0] 존재) */
  hasSuggestion: boolean;
  /** Latest suggestion confidence (0~1). 부재 시 null. */
  latestConfidence: number | null;
  /** "높음" / "보통" / "낮음" / "—" — confidenceLabel과 일관 */
  confidenceLabel: string;
  /** Latest range — 화면 표시용. 부재 시 null. */
  latestRange:
    | { low: number; mid: number; high: number; currency: Currency }
    | null;
  /** 본 분석에 기여한 unique signal kind 개수 (0~5) */
  signalKindDiversity: number;
  /** 적용된 suggestion인지 (appliedAt 채워진) */
  hasAppliedSuggestion: boolean;
  commentary: string;
}

// ----------------------------------------------------------------------------
// Section 6 — Risk / Caution Notes
// ----------------------------------------------------------------------------

export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface RiskNote {
  severity: RiskSeverity;
  /** 한국어 한 문장. */
  message: string;
}

export interface RiskNotesSection {
  notes: RiskNote[];
}

// ----------------------------------------------------------------------------
// Top-level report
// ----------------------------------------------------------------------------

export interface AnalysisMetadata {
  /** gatherMarketSignals 반환 신호 총 수 */
  signalCount: number;
  /** signal 중 external 보유 여부 (STEP 29 ExternalAuctionProvider) */
  hasExternalSignals: boolean;
  hasInternalSignals: boolean;
  /** PriceSuggestion 보유 여부 */
  hasPriceSuggestion: boolean;
  /** 신호들의 sampleSize 합계 */
  totalSampleSize: number;
  /** 기여한 provider id 목록 (dedup, "internal_v1" / "auction_v1" 등) */
  providers: string[];
}

export interface MarketAnalysisReport {
  artworkId: string;
  artworkTitle: string;
  artistName: string;
  /** ISO datetime — 본 리포트 생성 시각 */
  generatedAt: string;

  marketPosition: MarketPositionSection;
  comparableSummary: ComparableSummarySection;
  liquiditySignal: LiquiditySection;
  demandSignal: DemandSection;
  pricingConfidence: PricingConfidenceSection;
  riskNotes: RiskNotesSection;

  metadata: AnalysisMetadata;
}
