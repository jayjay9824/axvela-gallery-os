// ============================================================================
// operational-insight-summary.ts — STEP 92 Layer 3 AI Summary Generation
//
// **본 module이 무엇인가**:
//   `OperationalInsightSnapshot` (Layer 1 + 2 결과) → *Korean institutional
//   tone* 한 줄 / 한 문장 summary로 변환. 사용자 spec 정확 매칭:
//     - "Inquiry activity increased around Artist X during the last 14 days."
//     - "Repeated engagement detected across selected works."
//   Korean 변환:
//     - "최근 14일간 작가 X에 대한 문의가 +N건 증가했습니다."
//     - "선택된 작품군에서 반복 engagement가 감지되었습니다."
//
// **본 module이 *아닌* 것**:
//   ❌ 실 LLM API 호출 (rule_5 AI-Human Loop / AI Direction "AI 자동 호출 0건")
//   ❌ 가격 / 가치 / 추천 단정 (사용자 spec DO NOT 정조준)
//   ❌ 비결정성 (deterministic — same input → same output)
//
// **AI Direction §1 / §10 정합 ✓**:
//   - "AI / Market Insight 결과는 도메인 entity에 timestamp + model version
//     함께 영속 저장 (rule_4 Trust Layer 일관)" — 본 STEP은 *deterministic
//     templating* — model version 무관 / 외부 호출 부재 / 결정성 보장.
//   - 사용자 spec "AI summary generation"의 의미는 *operational summary
//     synthesis* — *predictive AI*가 아닌 *deterministic narrative composer*.
//   - 향후 실 LLM hook 시 *본 deterministic summary가 fallback baseline*으로
//     자연 합류 (사용자 명시 trigger 시만 LLM 호출).
//
// **STEP 86 anchor pattern 답습 (DOC-2 §3.5 Pure Derive Layer)**:
//   - Pure / no I/O / no DOM / no store / no persistence
//   - 입력 (snapshot) → 출력 (summary view shape)
//   - 결정성 ✓ (Layer 1+2의 결정성을 그대로 전파)
//
// **사용자 spec UX 톤 정확 매칭**:
//   - Bloomberg Terminal: factual / no hype / concise
//   - McKinsey: structured / hierarchical / numbered observation
//   - Museum-grade calmness: 운영 보조 / "참고" / 인간 판단 우선
// ============================================================================

import {
  INSIGHT_DIRECTION_LABEL_KR,
  type InquiryTrendInsight,
  type ArtistActivityInsight,
  type GalleryActivitySignalsInsight,
  type InsightDirection,
  type InsightPeriod,
  type OperationalInsightSnapshot,
  type SavePatternInsight,
  type SettlementAnalyticsInsight,
  type TransactionFunnelInsight,
} from "@/lib/operational-insight";

// ============================================================================
// 1. Output shape
// ============================================================================

export type InsightSignificanceLevel =
  | "high" // 운영자 즉시 인지가 필요한 sharp signal (spike / 큰 증가/감소 / 지연)
  | "medium" // 점진적 trend / 안정 흐름
  | "low" // 운영 안정 / 변화 없음
  | "noise"; // 데이터 부족 — honest disclosure

export interface CategorySummary {
  /** Display title — 6 category 매핑. */
  title: string;
  /** Single-sentence headline. Bloomberg Terminal 톤 — factual, no hype. */
  headline: string;
  /** 1-3 supporting observation lines. McKinsey 톤 — structured. */
  observations: string[];
  /** Significance level — UI에서 visual hierarchy 결정. */
  significance: InsightSignificanceLevel;
  /** Direction (raw passthrough). UI glyph mapping용. */
  direction: InsightDirection;
}

export interface OperationalInsightSummary {
  /** Snapshot 생성 시각 mirror. */
  generatedAt: string;
  /** Period mirror. */
  period: InsightPeriod;
  /** Top-level overview (3-line institutional summary). */
  overview: string[];
  /** 6 category별 summary — 사용자 spec §1~§6 매핑. */
  categories: {
    inquiry: CategorySummary;
    save: CategorySummary;
    artist: CategorySummary;
    settlement: CategorySummary;
    funnel: CategorySummary;
    activity: CategorySummary;
  };
  /** Footer disclaimer — 운영 참고 / 인간 판단 우선 / 가격 예측 무관. */
  disclaimer: string[];
}

// ============================================================================
// 2. Period label helper
// ============================================================================

const PERIOD_TEXT: Readonly<Record<InsightPeriod, string>> = {
  "7d": "지난 7일간",
  "14d": "지난 14일간",
  "30d": "지난 30일간",
} as const;

const PERIOD_DAYS_NUM: Readonly<Record<InsightPeriod, number>> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
} as const;

// ============================================================================
// 3. Significance assignment — direction + magnitude 기반
// ============================================================================

function significanceFromDirection(
  direction: InsightDirection,
  signalCount = 0
): InsightSignificanceLevel {
  if (direction === "insufficient") return "noise";
  if (direction === "spike") return "high";
  if (direction === "increase" || direction === "decrease") {
    return signalCount >= 5 ? "high" : "medium";
  }
  return "low"; // steady
}

// ============================================================================
// 4. §1 Inquiry summary
// ============================================================================

function summarizeInquiry(insight: InquiryTrendInsight): CategorySummary {
  const periodText = PERIOD_TEXT[insight.period];
  const observations: string[] = [];

  let headline: string;
  if (insight.direction === "insufficient") {
    headline = `${periodText} 문의 활동 데이터가 충분하지 않습니다.`;
    observations.push(
      `현재 기간 문의 ${insight.currentCount}건 · 직전 기간 ${insight.previousCount}건 — 패턴 감지에 데이터 부족.`
    );
  } else if (insight.direction === "increase") {
    const delta = insight.currentCount - insight.previousCount;
    headline = `${periodText} 문의 활동이 +${delta}건 증가했습니다.`;
    observations.push(
      `일평균 ${insight.velocityPerDay.toFixed(2)}건 · 직전 기간 대비 ${insight.currentCount}/${insight.previousCount}.`
    );
  } else if (insight.direction === "decrease") {
    const delta = insight.previousCount - insight.currentCount;
    headline = `${periodText} 문의 활동이 -${delta}건 감소했습니다.`;
    observations.push(
      `일평균 ${insight.velocityPerDay.toFixed(2)}건 · 직전 기간 대비 ${insight.currentCount}/${insight.previousCount}.`
    );
  } else if (insight.direction === "spike") {
    headline = `${periodText} 단일 day 문의 burst가 감지되었습니다.`;
    observations.push(
      `현재 기간 문의 ${insight.currentCount}건 · 일평균 ${insight.velocityPerDay.toFixed(2)}건.`
    );
  } else {
    headline = `${periodText} 문의 활동이 안정 흐름으로 유지되었습니다.`;
    observations.push(
      `현재 기간 문의 ${insight.currentCount}건 · 일평균 ${insight.velocityPerDay.toFixed(2)}건.`
    );
  }

  if (insight.repeatedContacts > 0) {
    observations.push(
      `동일 collector 반복 문의 ${insight.repeatedContacts}건 감지 — 강한 interest 신호 가능성.`
    );
  }
  if (insight.topArtworks.length > 0) {
    const top = insight.topArtworks[0];
    observations.push(`문의 집중 작품: ${top.label} (${top.count}건).`);
  }

  return {
    title: "문의 흐름",
    headline,
    observations,
    significance: significanceFromDirection(
      insight.direction,
      Math.abs(insight.currentCount - insight.previousCount)
    ),
    direction: insight.direction,
  };
}

// ============================================================================
// 5. §2 Save / Interest pattern summary
// ============================================================================

function summarizeSave(insight: SavePatternInsight): CategorySummary {
  const periodText = PERIOD_TEXT[insight.period];
  const observations: string[] = [];

  let headline: string;
  if (insight.repeatedEngagementCount === 0 && insight.direction === "insufficient") {
    headline = `${periodText} 반복 engagement 데이터가 충분하지 않습니다.`;
  } else if (insight.repeatedEngagementCount === 0) {
    headline = `${periodText} 반복 engagement는 감지되지 않았습니다.`;
  } else {
    headline = `${periodText} 선택된 작품군에서 반복 engagement ${insight.repeatedEngagementCount}건이 감지되었습니다.`;
  }

  observations.push(
    `반복 engagement = 동일 collector × 동일 작품 ≥2회 문의 (${INSIGHT_DIRECTION_LABEL_KR[insight.direction]}).`
  );

  if (insight.highInterestArtworks.length > 0) {
    const top = insight.highInterestArtworks[0];
    observations.push(
      `복수 collector 관심 작품: ${top.label} (${top.count} collector).`
    );
  }

  if (insight.saveTrackingUnavailable) {
    observations.push(
      "Save / Favorite 별도 tracking 미수집 — 본 신호는 inquiry repeat proxy 기반."
    );
  }

  return {
    title: "Save / 관심 패턴",
    headline,
    observations,
    significance: significanceFromDirection(
      insight.direction,
      insight.repeatedEngagementCount
    ),
    direction: insight.direction,
  };
}

// ============================================================================
// 6. §3 Artist activity summary
// ============================================================================

function summarizeArtist(insight: ArtistActivityInsight): CategorySummary {
  const periodText = PERIOD_TEXT[insight.period];
  const observations: string[] = [];

  let headline: string;
  if (insight.direction === "insufficient") {
    headline = `${periodText} 작가별 활동 데이터가 충분하지 않습니다.`;
  } else if (insight.topArtists.length > 0) {
    const top = insight.topArtists[0];
    if (insight.direction === "increase") {
      headline = `${periodText} 작가 ${top.label} 주변 활동이 증가했습니다.`;
    } else if (insight.direction === "decrease") {
      headline = `${periodText} 작가별 활동이 직전 기간 대비 감소했습니다.`;
    } else if (insight.direction === "spike") {
      headline = `${periodText} 작가 ${top.label}에 활동 burst가 감지되었습니다.`;
    } else {
      headline = `${periodText} 작가별 활동이 안정 흐름으로 유지되었습니다.`;
    }
  } else {
    headline = `${periodText} 작가별 활동 신호가 감지되지 않았습니다.`;
  }

  observations.push(
    `활동 작가 ${insight.activeArtists}인 · 직전 기간 ${insight.previousActiveArtists}인.`
  );

  if (insight.topArtists.length > 0) {
    const list = insight.topArtists
      .map((a, i) => `${i + 1}. ${a.label} (${a.count})`)
      .join(" · ");
    observations.push(`상위 활동 작가 ${list}.`);
  }

  return {
    title: "작가 활동",
    headline,
    observations,
    significance: significanceFromDirection(insight.direction, insight.activeArtists),
    direction: insight.direction,
  };
}

// ============================================================================
// 7. §4 Settlement analytics summary
// ============================================================================

function summarizeSettlement(insight: SettlementAnalyticsInsight): CategorySummary {
  const periodText = PERIOD_TEXT[insight.period];
  const observations: string[] = [];

  let headline: string;
  if (insight.delayedCount > 0) {
    // *delayed itself IS a signal* — insufficient 분기보다 우선
    headline = `${periodText} 30일 이상 지연된 정산 ${insight.delayedCount}건이 감지되었습니다.`;
  } else if (insight.insufficient) {
    headline = `${periodText} 정산 데이터가 충분하지 않습니다.`;
  } else if (insight.direction === "increase") {
    headline = `${periodText} 정산 완료 흐름이 증가했습니다.`;
  } else if (insight.direction === "decrease") {
    headline = `${periodText} 정산 완료 흐름이 직전 기간 대비 감소했습니다.`;
  } else {
    headline = `${periodText} 정산 흐름이 안정 유지되었습니다.`;
  }

  observations.push(
    `현재 기간: 완료 ${insight.completedCount} · 준비 ${insight.readyCount} · 대기 ${insight.pendingCount}.`
  );

  if (insight.avgDaysToSettle > 0) {
    observations.push(`완료 평균 소요 ${insight.avgDaysToSettle}일.`);
  }

  if (insight.delayedCount > 0) {
    observations.push(
      `지연 정산 ${insight.delayedCount}건 — 운영자 검토 권장.`
    );
  }

  const significance: InsightSignificanceLevel =
    insight.delayedCount > 0
      ? "high"
      : significanceFromDirection(insight.direction, insight.completedCount);

  return {
    title: "정산 흐름",
    headline,
    observations,
    significance,
    direction: insight.direction,
  };
}

// ============================================================================
// 8. §5 Transaction funnel summary
// ============================================================================

function summarizeFunnel(insight: TransactionFunnelInsight): CategorySummary {
  const periodText = PERIOD_TEXT[insight.period];
  const observations: string[] = [];

  let headline: string;
  if (insight.insufficient) {
    headline = `${periodText} 전환 funnel 데이터가 충분하지 않습니다.`;
  } else {
    const inqHoldPct = Math.round(insight.inquiryToHoldRate * 100);
    headline = `${periodText} 문의 → Hold 전환 ${inqHoldPct}% · Hold → 정산 ${Math.round(insight.holdToSettlementRate * 100)}%.`;
  }

  observations.push(
    `Stage 분포: 문의 ${insight.inquiryCount} → Hold+ ${insight.holdCount} → PAID+ ${insight.paidCount} → 정산 완료 ${insight.settledCount}.`
  );

  // Direction (funnel은 자체 direction 없음 — 데이터 충분/부족만)
  let significance: InsightSignificanceLevel = "low";
  if (insight.insufficient) {
    significance = "noise";
  } else if (insight.inquiryCount >= 5) {
    significance = "medium";
  }

  return {
    title: "거래 funnel",
    headline,
    observations,
    significance,
    direction: insight.insufficient ? "insufficient" : "steady",
  };
}

// ============================================================================
// 9. §6 Gallery activity signals summary
// ============================================================================

function summarizeActivity(insight: GalleryActivitySignalsInsight): CategorySummary {
  const periodText = PERIOD_TEXT[insight.period];
  const observations: string[] = [];

  let headline: string;
  if (insight.spikeDetected) {
    headline = `${periodText} 단일 day 활동 burst가 감지되었습니다.`;
  } else if (insight.direction === "insufficient") {
    headline = `${periodText} 갤러리 활동 데이터가 충분하지 않습니다.`;
  } else if (insight.direction === "increase") {
    headline = `${periodText} 갤러리 활동이 증가했습니다.`;
  } else if (insight.direction === "decrease") {
    headline = `${periodText} 갤러리 활동이 직전 기간 대비 감소했습니다.`;
  } else {
    headline = `${periodText} 갤러리 활동이 안정 흐름으로 유지되었습니다.`;
  }

  observations.push(`현재 기간 활동 이벤트 ${insight.totalEvents}건.`);

  if (insight.repeatInteractionCollectors > 0) {
    observations.push(
      `복수 작품에 관심을 보인 collector ${insight.repeatInteractionCollectors}명 — 반복 방문 신호.`
    );
  }

  if (insight.trafficTrackingUnavailable) {
    observations.push(
      "물리 booth / visitor traffic 미수집 — 본 신호는 digital event density 기반."
    );
  }

  return {
    title: "갤러리 활동",
    headline,
    observations,
    significance: insight.spikeDetected
      ? "high"
      : significanceFromDirection(insight.direction, insight.totalEvents),
    direction: insight.spikeDetected ? "spike" : insight.direction,
  };
}

// ============================================================================
// 10. Overview composer — 3-line institutional headline (Bloomberg Terminal 톤)
// ============================================================================

function composeOverview(
  snapshot: OperationalInsightSnapshot
): string[] {
  const periodText = PERIOD_TEXT[snapshot.period];
  const lines: string[] = [];

  // Line 1: 가장 sharp signal (high significance) 또는 spike 우선
  if (snapshot.activity.spikeDetected) {
    lines.push(
      `${periodText} 갤러리 활동 burst가 감지되었습니다 — 운영자 검토 권장.`
    );
  } else if (snapshot.settlement.delayedCount > 0) {
    lines.push(
      `${periodText} 30일 이상 지연된 정산 ${snapshot.settlement.delayedCount}건이 감지되었습니다.`
    );
  } else if (
    snapshot.inquiry.direction === "increase" &&
    snapshot.inquiry.currentCount - snapshot.inquiry.previousCount >= 5
  ) {
    const delta = snapshot.inquiry.currentCount - snapshot.inquiry.previousCount;
    lines.push(
      `${periodText} 문의 활동이 +${delta}건 증가했습니다.`
    );
  } else {
    lines.push(`${periodText} 갤러리 운영 흐름이 안정 유지되었습니다.`);
  }

  // Line 2: 작가 활동 / repeat engagement 신호
  if (snapshot.artist.topArtists.length > 0 && snapshot.artist.direction === "increase") {
    const top = snapshot.artist.topArtists[0];
    lines.push(`작가 ${top.label} 주변 활동이 증가했습니다 (${top.count}건).`);
  } else if (snapshot.save.repeatedEngagementCount > 0) {
    lines.push(
      `반복 engagement ${snapshot.save.repeatedEngagementCount}건 — interest 신호 강화.`
    );
  } else {
    lines.push(`작가별 활동 ${snapshot.artist.activeArtists}인이 활성 상태입니다.`);
  }

  // Line 3: funnel 또는 정산 흐름
  if (!snapshot.funnel.insufficient && snapshot.funnel.inquiryCount > 0) {
    lines.push(
      `문의 → Hold 전환 ${Math.round(snapshot.funnel.inquiryToHoldRate * 100)}% · 정산 완료 ${snapshot.funnel.settledCount}건.`
    );
  } else {
    lines.push(
      `정산 완료 ${snapshot.settlement.completedCount}건 · 대기/준비 ${snapshot.settlement.pendingCount + snapshot.settlement.readyCount}건.`
    );
  }

  return lines;
}

// ============================================================================
// 11. Disclaimer — AI Direction §1 / §10 정책 정조준
// ============================================================================

const DISCLAIMER_LINES: readonly string[] = [
  "본 신호는 갤러리 운영 보조용 *operational pattern detection* 결과입니다.",
  "가격 예측 / 가치 평가 / 투자 자문 / 자동 추천과 무관합니다.",
  "최종 운영 판단은 인간이 합니다 — AI는 참고 신호만 제공합니다.",
] as const;

// ============================================================================
// 12. Top-level summary composer (entry point)
// ============================================================================

/**
 * `OperationalInsightSnapshot` (Layer 1+2) → `OperationalInsightSummary`
 * (Layer 3). Pure / 결정성 / 외부 호출 0건.
 *
 * **결정성 보장**: 동일 snapshot 입력은 항상 동일 summary 출력.
 * Layer 1+2가 결정성이고 본 module은 입력만 사용 — 자연 결정성.
 *
 * **사용자 spec UX 톤 정확 매칭**:
 * - Bloomberg Terminal: factual headline + tabular observation
 * - McKinsey: 3-line overview + 6 category structure
 * - Museum-grade calmness: disclaimer footer + 인간 판단 우선
 */
export function generateInsightSummary(
  snapshot: OperationalInsightSnapshot
): OperationalInsightSummary {
  return {
    generatedAt: snapshot.generatedAt,
    period: snapshot.period,
    overview: composeOverview(snapshot),
    categories: {
      inquiry: summarizeInquiry(snapshot.inquiry),
      save: summarizeSave(snapshot.save),
      artist: summarizeArtist(snapshot.artist),
      settlement: summarizeSettlement(snapshot.settlement),
      funnel: summarizeFunnel(snapshot.funnel),
      activity: summarizeActivity(snapshot.activity),
    },
    disclaimer: [...DISCLAIMER_LINES],
  };
}

// Type re-exports for downstream consumers
export type {
  InquiryTrendInsight,
  ArtistActivityInsight,
  GalleryActivitySignalsInsight,
  InsightDirection,
  InsightPeriod,
  OperationalInsightSnapshot,
  SavePatternInsight,
  SettlementAnalyticsInsight,
  TransactionFunnelInsight,
};
