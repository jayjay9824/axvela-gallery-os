// ============================================================================
// AXVELA AI Price Suggestion — STEP 18 (rule_18 (c) 가격 제안)
//
// **Deterministic helper.** 외부 마켓 데이터 / 외부 API 호출 금지 —
// 내부 artwork / transaction / payment 기록만 사용한다. rule_19 (Market Data)
// 본격 구현 전의 v1 형태.
//
// Tiered confidence (사용자 spec 명시):
//   - 0.82  paid transaction + payment 기록 존재
//   - 0.62  artwork 등록 가격만 존재
//   - 0.35  둘 다 없음 → 갤러리 median fallback
//
// 결정성(determinism) 보장: 같은 입력 → 같은 출력 (timestamp 제외). 따라서
// 동일 작품에 대해 generate를 여러 번 호출해도 결과 일관 — AI가 "주관적"으로
// 보이지 않게 하고, 사용자가 결과를 신뢰할 수 있게 함 (rule_4 trust layer).
// ============================================================================

import type { Artwork } from "@/types/artwork";
import type { Transaction, Currency } from "@/types/transaction";
import type { Payment } from "@/types/payment";
import type {
  PriceSuggestion,
  PriceSuggestionSourceRef,
} from "@/types/price-suggestion";
import type { MarketSignal } from "@/types/market-signal";
import type { FXRate } from "@/types/fx";
import { formatMoney } from "@/lib/utils";

/**
 * Range 비율 — 한 base price를 받아 ±값으로 펼침.
 *   low  = base * 0.85
 *   mid  = base * 1.00
 *   high = base * 1.20
 *
 * 비대칭(low 15% ↓, high 20% ↑)인 이유: 갤러리 컨텍스트에서 협상 시작 가격은
 * 상한이 더 큰 경향. 사용자가 mid를 적용해 form에 반영하더라도, low/high를
 * 협상 hint로 활용 가능.
 */
const RANGE_LOW_RATIO = 0.85;
const RANGE_MID_RATIO = 1.0;
const RANGE_HIGH_RATIO = 1.2;

/**
 * Tier 3 (가격 없음) fallback에 쓰일 절대 최소값. 갤러리 median이 0인
 * 극단 케이스 (모든 작품 가격 미등록)를 위한 안전망.
 */
const TIER3_FLOOR_KRW = 1_000_000;

/**
 * Generate a deterministic price suggestion for an artwork.
 *
 * @param artwork                   대상 작품
 * @param artworkTransactions       해당 작품의 모든 Transaction (latest-first 정렬 가정)
 * @param artworkPayments           해당 작품의 모든 Payment
 * @param galleryMedianPriceKRW     Tier 3 fallback용 갤러리 평균 (>0 작품들의 중앙값)
 * @param marketSignals             STEP 19 — provider가 emit한 market signal 집합.
 *                                  비어 있으면 base price + Tier confidence는 STEP 18 그대로,
 *                                  rationale에 "외부 데이터 없음" 명시. 신호가 있으면
 *                                  base price를 신호 가중치만큼 blend + confidence boost.
 * @returns                         id / createdAt / appliedAt 제외한 suggestion 본문
 */
export function generatePriceSuggestion(
  artwork: Artwork,
  artworkTransactions: Transaction[],
  artworkPayments: Payment[],
  galleryMedianPriceKRW: number,
  marketSignals: MarketSignal[] = []
): Omit<PriceSuggestion, "id" | "createdAt" | "appliedAt"> {
  const rationale: string[] = [];
  const sourceRefs: PriceSuggestionSourceRef[] = [];

  // ---------------------------------------------------------------
  // Tier 결정 — paid 거래 → 등록 가격 → 갤러리 median fallback
  // ---------------------------------------------------------------

  const sortedPayments = [...artworkPayments].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
  );
  const recentPayment = sortedPayments[0];

  let basePrice: number;
  let currency: Currency;
  let confidence: number;

  if (recentPayment) {
    // ============== Tier 1 — paid transaction + payment ==============
    basePrice = recentPayment.amount;
    currency = recentPayment.currency;
    confidence = 0.82;

    rationale.push(
      `최근 결제 기록 ${formatMoney(basePrice, currency)} 참고 (가장 신뢰 가능)`
    );
    sourceRefs.push({
      kind: "payment",
      paymentId: recentPayment.id,
      amount: recentPayment.amount,
      currency: recentPayment.currency,
    });

    // 같은 transaction의 agreedPrice도 source로 기록 (chain visibility)
    const sourceTx = artworkTransactions.find(
      (tx) => tx.id === recentPayment.transactionId
    );
    if (sourceTx) {
      sourceRefs.push({
        kind: "transaction",
        transactionId: sourceTx.id,
        agreedPrice: sourceTx.agreedPrice,
        currency: sourceTx.currency,
      });
    }
  } else if (artwork.priceKRW > 0) {
    // ============== Tier 2 — 등록 가격만 존재 ==============
    basePrice = artwork.priceKRW;
    currency = "KRW";
    confidence = 0.62;

    rationale.push(
      `현재 등록 가격 ${formatMoney(basePrice, currency)} 기준`
    );
    sourceRefs.push({ kind: "current_price", valueKRW: basePrice });
  } else {
    // ============== Tier 3 — 데이터 부족 fallback ==============
    const medianBase =
      galleryMedianPriceKRW > 0 ? galleryMedianPriceKRW : TIER3_FLOOR_KRW;
    basePrice = medianBase;
    currency = "KRW";
    confidence = 0.35;

    rationale.push("거래 / 등록 가격 모두 없음 — 매우 낮은 신뢰도");
    rationale.push(
      `갤러리 평균 ${formatMoney(medianBase, currency)}을 임시 기준으로 사용`
    );
    sourceRefs.push({
      kind: "gallery_median",
      valueKRW: medianBase,
      sampleSize: 0, // 호출자가 sample size를 안 넘겨주므로 generic
    });
  }

  // ---------------------------------------------------------------
  // Resale 보정 — resaleCommissionRate가 있으면 base를 commission만큼 확대
  // (작가/이전 소유자 수익 보전을 위해 더 높은 가격 제안)
  // ---------------------------------------------------------------

  const resaleTx = artworkTransactions.find((tx) => tx.isResale === true);
  if (resaleTx && typeof resaleTx.resaleCommissionRate === "number") {
    const rate = resaleTx.resaleCommissionRate;
    const adjusted = Math.round(basePrice / (1 - rate));
    rationale.push(
      `재판매 커미션 ${(rate * 100).toFixed(0)}% 반영 — 기준가 ${formatMoney(
        basePrice,
        currency
      )} → ${formatMoney(adjusted, currency)}`
    );
    sourceRefs.push({
      kind: "resale_commission",
      transactionId: resaleTx.id,
      rate,
      previousPrice: basePrice,
    });
    basePrice = adjusted;
  }

  // ---------------------------------------------------------------
  // STEP 19 — Market signals 통합. base price를 신호 쪽으로 부드럽게 blend +
  // confidence boost + sourceRefs 누적. 신호 없으면 (== STEP 18 행동 보존)
  // 본 블록은 noop. KRW 신호만 base price blend에 반영 (currency가 KRW일 때).
  // ---------------------------------------------------------------

  if (marketSignals.length > 0) {
    // 모든 신호를 sourceRefs로 누적 (audit trail)
    for (const sig of marketSignals) {
      sourceRefs.push({
        kind: "market_signal",
        signalId: sig.id,
        signalKind: sig.kind,
        provider:
          sig.source.kind === "internal"
            ? "internal_v1"
            : sig.source.provider,
        isExternal: sig.source.kind === "external",
        sampleSize: sig.sampleSize,
        summary: sig.rationale,
      });
      rationale.push(sig.rationale);
    }

    // 가격 신호 blend — kind별 영향도 (currency=KRW일 때만 의미)
    if (currency === "KRW") {
      // self_resale (가장 강한 신호) — 15% blend
      const selfResale = marketSignals.find((s) => s.kind === "self_resale");
      if (selfResale && typeof selfResale.valueKRW === "number") {
        const blend = 0.15;
        const before = basePrice;
        basePrice = Math.round(basePrice * (1 - blend) + selfResale.valueKRW * blend);
        rationale.push(
          `이전 거래 신호로 기준가 ${formatMoney(before, currency)} → ${formatMoney(
            basePrice,
            currency
          )} blend (15%)`
        );
      }

      // artist_avg (sample ≥ 2일 때 10%, 아니면 5%) — 다른 작가 작품 평균
      const artistAvg = marketSignals.find((s) => s.kind === "artist_avg");
      if (artistAvg && typeof artistAvg.averageKRW === "number") {
        const blend = artistAvg.sampleSize >= 2 ? 0.1 : 0.05;
        const before = basePrice;
        basePrice = Math.round(basePrice * (1 - blend) + artistAvg.averageKRW * blend);
        rationale.push(
          `같은 작가 평균 신호로 ${formatMoney(before, currency)} → ${formatMoney(
            basePrice,
            currency
          )} blend (${(blend * 100).toFixed(0)}%)`
        );
      }
      // artist_recent_sale은 audit 로그용으로만 — blend 안 함 (avg와 중복 영향 방지)
      // inquiry_volume도 가격 직접 영향 없음 — confidence만 보강
    }

    // Confidence boost — 각 kind별 +값 누적, 0.95 cap
    let boost = 0;
    for (const sig of marketSignals) {
      if (sig.kind === "self_resale") boost += 0.05;
      else if (sig.kind === "artist_avg" && sig.sampleSize >= 2) boost += 0.05;
      else if (sig.kind === "artist_avg") boost += 0.03;
      else if (sig.kind === "artist_recent_sale") boost += 0.03;
      else if (sig.kind === "inquiry_volume" && (sig.volumeCount ?? 0) >= 3)
        boost += 0.02;
    }
    confidence = Math.min(0.95, confidence + boost);
  }

  // ---------------------------------------------------------------
  // Range 산출 — 비대칭 (low 0.85x, mid 1.0x, high 1.2x)
  // 1,000원 단위 round (가격 표시 친화)
  // ---------------------------------------------------------------

  const round = (n: number) => Math.round(n / 1000) * 1000;
  const suggestedLow = round(basePrice * RANGE_LOW_RATIO);
  const suggestedMid = round(basePrice * RANGE_MID_RATIO);
  const suggestedHigh = round(basePrice * RANGE_HIGH_RATIO);

  // ---------------------------------------------------------------
  // 항상 표시되는 disclaimer rationale (마지막 줄). STEP 19에서:
  //   - external signal 포함 시 다른 문구
  //   - 그 외에는 internal-only 명시 (시장가 확정 표현 금지)
  // ---------------------------------------------------------------
  const hasExternal = marketSignals.some(
    (s) => s.source.kind === "external"
  );
  if (hasExternal) {
    rationale.push(
      "내부 거래 기록 + 외부 reference 신호 결합 — 참고 가격 범위입니다"
    );
  } else {
    rationale.push("외부 시장 데이터 미사용 — 내부 거래 기록 기반 v1 제안");
  }

  // STEP 31 — external signal에 첨부된 FX rate snapshot들을 dedup 후 collect.
  // dedup 키: `${base}/${quote}/${provider}` — 같은 통화 쌍 + 같은 provider라면
  // 여러 signal이 같은 환율을 첨부했어도 1개만 보관.
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
    suggestedLow,
    suggestedMid,
    suggestedHigh,
    currency,
    confidence,
    rationale,
    sourceRefs,
    ...(fxSnapshots.length > 0 ? { fxSnapshots } : {}),
  };
}

/**
 * 갤러리 전체 작품의 priceKRW (>0인 것만) 중앙값. Tier 3 fallback에 사용.
 * 0 또는 음수 가격은 미등록으로 간주해 제외. 결과가 0이면 호출자가 floor 처리.
 */
export function computeGalleryMedianPriceKRW(artworks: Artwork[]): number {
  const prices = artworks
    .map((a) => a.priceKRW)
    .filter((p): p is number => typeof p === "number" && p > 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return 0;
  const mid = Math.floor(prices.length / 2);
  if (prices.length % 2 === 1) return prices[mid];
  return Math.round((prices[mid - 1] + prices[mid]) / 2);
}
