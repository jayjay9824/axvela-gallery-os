// ============================================================================
// Market Analysis Generator — STEP 45 (rule_18 (b)).
//
// Deterministic pure function: Artwork + signals + price suggestion + 컨텍스트
// → 6-section commentary report. **AI API 호출 0건 · 외부 네트워크 0건 ·
// MarketSignal 구조 무수정 · 신규 store slice 0개**.
//
// 같은 입력 → 같은 출력 보장 (generatedAt만 호출 시점에 따라 변동, 메타데이터).
// ============================================================================

import type { Artwork } from "@/types/artwork";
import type { Currency } from "@/types/transaction";
import type { MarketSignal } from "@/types/market-signal";
import type { PriceSuggestion } from "@/types/price-suggestion";
import { confidenceLabel } from "@/types/price-suggestion";
import type {
  MarketAnalysisReport,
  MarketPositionSection,
  MarketPositionTier,
  ComparableSummarySection,
  LiquiditySection,
  LiquidityLevel,
  DemandSection,
  DemandLevel,
  PricingConfidenceSection,
  RiskNote,
  RiskNotesSection,
  AnalysisMetadata,
} from "@/types/market-analysis";

// ----------------------------------------------------------------------------
// Public input
// ----------------------------------------------------------------------------

/**
 * Generator 입력. 모든 필드는 store에서 read-only로 추출 — generator 자체는
 * store 무지(無知). 호출자 (drawer)가 build 책임.
 */
export interface MarketAnalysisInput {
  artwork: Artwork;
  /** gatherMarketSignals() 결과 — 본 작품 컨텍스트의 모든 신호. */
  signals: MarketSignal[];
  /** Latest PriceSuggestion (priceSuggestions[artworkId][0]). 부재 시 null. */
  latestSuggestion: PriceSuggestion | null;
  /** Same-artist KRW transaction count (PAID/SETTLED/COMPLETED 기준). */
  artistTransactionCount: number;
  /** Same-artist 갤러리 보유 작품 수 (priceKRW > 0). */
  artistArtworkCount: number;
  /** 본 작품 transactions count (모든 status). */
  ownTransactionCount: number;
  /** 본 작품 누적 inquiry count. */
  totalInquiryCount: number;
  /** 30일 이내 created inquiry count. */
  recentInquiryCount: number;
  /** Active inquiry count (OPEN / RESPONDED / ESCALATED). */
  activeInquiryCount: number;
  /** 갤러리 KRW median price (priceKRW > 0 작품 중간값). 0이면 INSUFFICIENT_DATA. */
  galleryMedianKRW: number;
}

// ----------------------------------------------------------------------------
// Constants — 임계값 (STEP 41/42 customer 패턴 일관)
// ----------------------------------------------------------------------------

const ABOVE_MEDIAN_RATIO = 1.2;
const BELOW_MEDIAN_RATIO = 0.8;

const LIQUIDITY_STRONG_TX = 3;
const LIQUIDITY_MODERATE_TX = 2;

const DEMAND_ELEVATED_RECENT = 3;
const DEMAND_ELEVATED_ACTIVE = 2;

// ----------------------------------------------------------------------------
// Public dispatcher
// ----------------------------------------------------------------------------

export function generateMarketAnalysis(
  input: MarketAnalysisInput
): MarketAnalysisReport {
  const {
    artwork,
    signals,
    latestSuggestion,
    artistTransactionCount,
    artistArtworkCount,
    ownTransactionCount,
    totalInquiryCount,
    recentInquiryCount,
    activeInquiryCount,
    galleryMedianKRW,
  } = input;

  const marketPosition = buildMarketPosition({
    priceKRW: artwork.priceKRW,
    galleryMedianKRW,
    artistArtworkCount,
  });

  const comparableSummary = buildComparableSummary(signals);

  const liquiditySignal = buildLiquidity({
    signals,
    artistTransactionCount,
    ownTransactionCount,
  });

  const demandSignal = buildDemand({
    totalInquiryCount,
    recentInquiryCount,
    activeInquiryCount,
  });

  const pricingConfidence = buildPricingConfidence({
    latestSuggestion,
    signals,
  });

  const riskNotes = buildRiskNotes({
    artwork,
    marketPosition,
    comparableSummary,
    liquiditySignal,
    demandSignal,
    pricingConfidence,
    signals,
  });

  const metadata = buildMetadata({ signals, latestSuggestion });

  return {
    artworkId: artwork.id,
    artworkTitle: artwork.title,
    artistName: artwork.artist.name,
    generatedAt: new Date().toISOString(),
    marketPosition,
    comparableSummary,
    liquiditySignal,
    demandSignal,
    pricingConfidence,
    riskNotes,
    metadata,
  };
}

// ----------------------------------------------------------------------------
// Section builders
// ----------------------------------------------------------------------------

function buildMarketPosition(args: {
  priceKRW: number;
  galleryMedianKRW: number;
  artistArtworkCount: number;
}): MarketPositionSection {
  const { priceKRW, galleryMedianKRW, artistArtworkCount } = args;

  if (galleryMedianKRW <= 0 || priceKRW <= 0) {
    return {
      tier: "INSUFFICIENT_DATA",
      ratioToMedian: null,
      artistArtworkCount,
      commentary:
        "갤러리 KRW 가격 데이터가 부족해 위치 비교를 산출할 수 없습니다.",
    };
  }

  const ratio = priceKRW / galleryMedianKRW;
  let tier: MarketPositionTier;
  let commentary: string;

  if (ratio >= ABOVE_MEDIAN_RATIO) {
    tier = "ABOVE_MEDIAN";
    commentary = `갤러리 중간 가격 대비 약 ${pctLabel(ratio)} 수준 — 상위 가격 구간입니다.`;
  } else if (ratio <= BELOW_MEDIAN_RATIO) {
    tier = "BELOW_MEDIAN";
    commentary = `갤러리 중간 가격 대비 약 ${pctLabel(ratio)} 수준 — 하위 가격 구간입니다.`;
  } else {
    tier = "AT_MEDIAN";
    commentary = `갤러리 중간 가격대에 근접합니다 (약 ${pctLabel(ratio)}).`;
  }

  if (artistArtworkCount >= 2) {
    commentary += ` 갤러리에 같은 작가 작품 ${artistArtworkCount}점 보유.`;
  }

  return {
    tier,
    ratioToMedian: ratio,
    artistArtworkCount,
    commentary,
  };
}

function buildComparableSummary(signals: MarketSignal[]): ComparableSummarySection {
  // Internal artist_avg
  const internalAvgSignal = signals.find(
    (s) => s.kind === "artist_avg" && s.source.kind === "internal"
  );
  const internalArtistAvgKRW = internalAvgSignal?.averageKRW ?? null;
  const internalArtistSampleSize = internalAvgSignal?.sampleSize ?? 0;

  // External artist_avg (STEP 29 provider)
  const externalAvgSignal = signals.find(
    (s) => s.kind === "artist_avg" && s.source.kind === "external"
  );
  const externalArtistAvgKRW = externalAvgSignal?.averageKRW ?? null;
  const externalArtistSampleSize = externalAvgSignal?.sampleSize ?? 0;

  // Recent sale — internal + external 통합, freshness 기준 가장 최근
  const recentSignals = signals.filter((s) => s.kind === "artist_recent_sale");
  let recentSale: ComparableSummarySection["recentSale"] = null;
  if (recentSignals.length > 0) {
    // freshness ISO desc — string 비교만으로 chronological
    const sorted = [...recentSignals].sort((a, b) =>
      b.freshness.localeCompare(a.freshness)
    );
    const top = sorted[0];
    if (top.valueKRW !== undefined) {
      recentSale = {
        valueKRW: top.valueKRW,
        isExternal: top.source.kind === "external",
        freshness: top.freshness,
      };
    }
  }

  let commentary: string;
  const parts: string[] = [];

  if (internalArtistAvgKRW !== null) {
    parts.push(
      `내부 거래 평균 ${formatKRW(internalArtistAvgKRW)} (sample ${internalArtistSampleSize})`
    );
  }
  if (externalArtistAvgKRW !== null) {
    parts.push(
      `외부 reference 평균 ${formatKRW(externalArtistAvgKRW)} (sample ${externalArtistSampleSize})`
    );
  }

  if (parts.length === 0) {
    commentary = "동일 작가의 비교 가능한 거래 신호가 없습니다.";
  } else {
    commentary = parts.join(" · ");
    if (recentSale) {
      commentary += ` · 최근 ${recentSale.isExternal ? "외부" : "내부"} 거래 ${formatKRW(recentSale.valueKRW)}`;
    }
  }

  return {
    internalArtistAvgKRW,
    internalArtistSampleSize,
    externalArtistAvgKRW,
    externalArtistSampleSize,
    recentSale,
    commentary,
  };
}

function buildLiquidity(args: {
  signals: MarketSignal[];
  artistTransactionCount: number;
  ownTransactionCount: number;
}): LiquiditySection {
  const { signals, artistTransactionCount, ownTransactionCount } = args;

  const selfResaleSignal = signals.find((s) => s.kind === "self_resale");
  const hasSelfResale = !!selfResaleSignal;
  const selfResaleValueKRW = selfResaleSignal?.valueKRW ?? null;

  let level: LiquidityLevel;
  if (hasSelfResale && artistTransactionCount >= LIQUIDITY_STRONG_TX) {
    level = "STRONG";
  } else if (hasSelfResale || artistTransactionCount >= LIQUIDITY_MODERATE_TX) {
    level = "MODERATE";
  } else if (artistTransactionCount >= 1) {
    level = "LIMITED";
  } else {
    level = "INSUFFICIENT_DATA";
  }

  let commentary: string;
  switch (level) {
    case "STRONG":
      commentary = `본 작품 자체 거래 기록 + 작가 KRW 거래 ${artistTransactionCount}건 — 유동성 신호가 강한 편입니다.`;
      break;
    case "MODERATE":
      commentary = hasSelfResale
        ? `본 작품 prior 거래 보유 — 자체 trade 이력이 있으나 작가 거래 sample은 ${artistTransactionCount}건으로 제한적입니다.`
        : `작가 KRW 거래 ${artistTransactionCount}건 — 일정한 유동성 신호가 관찰됩니다.`;
      break;
    case "LIMITED":
      commentary =
        "거래 데이터가 1건 — 단일 데이터 포인트로 유동성 판단이 제한적입니다.";
      break;
    case "INSUFFICIENT_DATA":
      commentary =
        "동일 작가의 KRW 거래 기록이 없어 유동성 신호를 산출할 수 없습니다.";
      break;
  }

  if (ownTransactionCount > 1) {
    commentary += ` 본 작품 transaction ${ownTransactionCount}건.`;
  }

  return {
    level,
    hasSelfResale,
    selfResaleValueKRW,
    artistTransactionCount,
    ownTransactionCount,
    commentary,
  };
}

function buildDemand(args: {
  totalInquiryCount: number;
  recentInquiryCount: number;
  activeInquiryCount: number;
}): DemandSection {
  const { totalInquiryCount, recentInquiryCount, activeInquiryCount } = args;

  let level: DemandLevel;
  let commentary: string;

  if (totalInquiryCount === 0) {
    level = "NONE";
    commentary = "본 작품에 대한 문의 기록이 없습니다.";
  } else if (
    recentInquiryCount >= DEMAND_ELEVATED_RECENT ||
    activeInquiryCount >= DEMAND_ELEVATED_ACTIVE
  ) {
    level = "ELEVATED";
    commentary = `최근 30일 문의 ${recentInquiryCount}건 / 진행 중 ${activeInquiryCount}건 — 문의 신호가 두드러집니다.`;
  } else if (recentInquiryCount >= 1 || activeInquiryCount >= 1) {
    level = "STEADY";
    commentary = `누적 문의 ${totalInquiryCount}건, 최근 ${recentInquiryCount}건 / 진행 중 ${activeInquiryCount}건 — 일정한 문의 신호.`;
  } else {
    level = "LOW";
    commentary = `누적 문의 ${totalInquiryCount}건이 있으나 최근 활동 / 진행 중 응대는 없습니다.`;
  }

  return {
    level,
    totalInquiryCount,
    recentInquiryCount,
    activeInquiryCount,
    commentary,
  };
}

function buildPricingConfidence(args: {
  latestSuggestion: PriceSuggestion | null;
  signals: MarketSignal[];
}): PricingConfidenceSection {
  const { latestSuggestion, signals } = args;

  const signalKinds = new Set(signals.map((s) => s.kind));
  const signalKindDiversity = signalKinds.size;

  if (!latestSuggestion) {
    return {
      hasSuggestion: false,
      latestConfidence: null,
      confidenceLabel: "—",
      latestRange: null,
      signalKindDiversity,
      hasAppliedSuggestion: false,
      commentary:
        "본 작품의 참고 가격 신호가 아직 생성되지 않았습니다. 작품 편집에서 신호를 생성할 수 있습니다.",
    };
  }

  const conf = latestSuggestion.confidence;
  const label = confidenceLabel(conf);
  const hasApplied = !!latestSuggestion.appliedAt;

  let commentary = `최신 참고 가격 신호의 신뢰도는 ${(conf * 100).toFixed(0)}% (${label}) 입니다.`;
  if (signalKindDiversity >= 3) {
    commentary += ` ${signalKindDiversity}종 신호로 입력 다양성이 확보된 편입니다.`;
  } else if (signalKindDiversity >= 1) {
    commentary += ` 입력 신호 ${signalKindDiversity}종 — 보강 여지가 있습니다.`;
  } else {
    commentary +=
      " 외부 / 내부 시장 신호가 부족해 신뢰도 보정 input이 제한적입니다.";
  }
  if (hasApplied) {
    commentary += " 본 제안은 사용자가 적용 (Mid 가격) 한 이력이 있습니다.";
  }

  return {
    hasSuggestion: true,
    latestConfidence: conf,
    confidenceLabel: label,
    latestRange: {
      low: latestSuggestion.suggestedLow,
      mid: latestSuggestion.suggestedMid,
      high: latestSuggestion.suggestedHigh,
      currency: latestSuggestion.currency,
    },
    signalKindDiversity,
    hasAppliedSuggestion: hasApplied,
    commentary,
  };
}

function buildRiskNotes(args: {
  artwork: Artwork;
  marketPosition: MarketPositionSection;
  comparableSummary: ComparableSummarySection;
  liquiditySignal: LiquiditySection;
  demandSignal: DemandSection;
  pricingConfidence: PricingConfidenceSection;
  signals: MarketSignal[];
}): RiskNotesSection {
  const notes: RiskNote[] = [];

  // 데이터 부족
  if (args.marketPosition.tier === "INSUFFICIENT_DATA") {
    notes.push({
      severity: "HIGH",
      message:
        "갤러리 가격 데이터 / 작가 거래 기록이 부족해 본 분석의 비교 기준이 제한적입니다.",
    });
  }

  // Comparable 부재
  if (
    args.comparableSummary.internalArtistAvgKRW === null &&
    args.comparableSummary.externalArtistAvgKRW === null
  ) {
    notes.push({
      severity: "MEDIUM",
      message:
        "동일 작가의 비교 가능한 평균 거래 신호가 없습니다 — 가격 비교 근거가 약합니다.",
    });
  }

  // 유동성 제한
  if (args.liquiditySignal.level === "INSUFFICIENT_DATA") {
    notes.push({
      severity: "MEDIUM",
      message:
        "유동성 신호 산출이 불가합니다 — 같은 작가의 실현된 거래가 없습니다.",
    });
  } else if (args.liquiditySignal.level === "LIMITED") {
    notes.push({
      severity: "LOW",
      message:
        "유동성 sample이 단일 거래 — 일반화하기에는 데이터가 충분하지 않습니다.",
    });
  }

  // 외부 reference 부재
  const hasExternal = args.signals.some((s) => s.source.kind === "external");
  const hasInternal = args.signals.some((s) => s.source.kind === "internal");
  if (!hasExternal && hasInternal) {
    notes.push({
      severity: "LOW",
      message:
        "외부 reference 신호가 없어 분석은 내부 기록 기반입니다 — 시장 비교 폭이 제한될 수 있습니다.",
    });
  }
  if (!hasInternal && hasExternal) {
    notes.push({
      severity: "LOW",
      message:
        "내부 거래 기록이 부족해 외부 reference 위주로 산출되었습니다 — 갤러리 자체 trade 이력 보강이 필요할 수 있습니다.",
    });
  }

  // 참고 가격 신호 부재
  if (!args.pricingConfidence.hasSuggestion) {
    notes.push({
      severity: "LOW",
      message:
        "참고 가격 신호가 아직 생성되지 않아 신뢰도 보정 신호가 없습니다.",
    });
  } else if (
    args.pricingConfidence.latestConfidence !== null &&
    args.pricingConfidence.latestConfidence < 0.5
  ) {
    notes.push({
      severity: "MEDIUM",
      message: `최신 참고 가격 신호 신뢰도가 ${(
        args.pricingConfidence.latestConfidence * 100
      ).toFixed(0)}% — 추가 신호 / 거래 기록 보강을 권장합니다.`,
    });
  }

  // 외화 작품에 대한 환산 불확실성 (artwork.priceKRW가 KRW 거래 기록과 직접 비교됨)
  // 본 v1에서는 artwork.priceKRW만 보유 — 별도 currency가 없으므로 risk note 없음.
  // (rule_20 FX의 envelope은 invoice 단위에서만 작동.)

  // 종결된 작품
  if (
    args.artwork.state === "CLOSED" ||
    args.artwork.state === "BROKERED"
  ) {
    notes.push({
      severity: "LOW",
      message: `작품 상태가 ${args.artwork.state} — 본 분석은 가격 결정용이 아닌 운영 참고용입니다.`,
    });
  }

  // 모든 정상 — 기록 풍부
  if (notes.length === 0) {
    notes.push({
      severity: "LOW",
      message:
        "주의가 필요한 이상 신호는 감지되지 않았습니다. 본 분석은 휴리스틱 기반의 운영 참고용입니다.",
    });
  }

  return { notes };
}

function buildMetadata(args: {
  signals: MarketSignal[];
  latestSuggestion: PriceSuggestion | null;
}): AnalysisMetadata {
  const { signals, latestSuggestion } = args;
  const providers = new Set<string>();
  let totalSampleSize = 0;
  let hasInternal = false;
  let hasExternal = false;
  for (const s of signals) {
    totalSampleSize += s.sampleSize;
    if (s.source.kind === "internal") {
      hasInternal = true;
      // internal source has no provider id field — derive from rationale or fallback
      providers.add("internal_v1");
    } else {
      hasExternal = true;
      providers.add(s.source.provider);
    }
  }
  return {
    signalCount: signals.length,
    hasExternalSignals: hasExternal,
    hasInternalSignals: hasInternal,
    hasPriceSuggestion: !!latestSuggestion,
    totalSampleSize,
    providers: Array.from(providers),
  };
}

// ----------------------------------------------------------------------------
// Display helpers (re-exported for drawer consumption)
// ----------------------------------------------------------------------------

const KRW_FMT = new Intl.NumberFormat("ko-KR");

export function formatKRW(amount: number): string {
  return `₩${KRW_FMT.format(Math.round(amount))}`;
}

function pctLabel(ratio: number): string {
  return `${(ratio * 100).toFixed(0)}%`;
}

export const MARKET_POSITION_LABEL_KR: Record<MarketPositionTier, string> = {
  ABOVE_MEDIAN: "중간가 상위",
  AT_MEDIAN: "중간가 근접",
  BELOW_MEDIAN: "중간가 하위",
  INSUFFICIENT_DATA: "데이터 부족",
};

export const LIQUIDITY_LABEL_KR: Record<LiquidityLevel, string> = {
  STRONG: "강함",
  MODERATE: "보통",
  LIMITED: "제한적",
  INSUFFICIENT_DATA: "데이터 부족",
};

export const DEMAND_LABEL_KR: Record<DemandLevel, string> = {
  ELEVATED: "두드러짐",
  STEADY: "꾸준",
  LOW: "낮음",
  NONE: "없음",
};
