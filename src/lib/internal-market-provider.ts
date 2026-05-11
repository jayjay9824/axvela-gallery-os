// ============================================================================
// InternalMarketDataProvider — STEP 19
//
// 갤러리 내부 transaction / payment / inquiry / resale 기록만 사용.
// 외부 API 호출 0. Pure function 형태 — 같은 input → 같은 output.
//
// 신호 4종 (kinds):
//   1. artist_avg          같은 작가의 KRW 거래 평균 (sample ≥ 1)
//   2. artist_recent_sale  같은 작가의 가장 최근 KRW 거래 1건
//   3. self_resale         본 작품의 이전 거래 (resale 케이스)
//   4. inquiry_volume      본 작품 inquiry 수 (수요 신호 — 가격 직접 영향 아님)
//
// 통화 정책: USD/EUR 거래는 v1에서 *제외*. KRW 거래만 신호 풀에 포함.
// 향후 STEP에서 FX 변환 helper 추가 시 confidence가 다른 통화도 반영 가능.
// ============================================================================

import type {
  MarketDataInput,
  MarketDataProvider,
  MarketSignal,
} from "@/types/market-signal";
import { formatMoney } from "@/lib/utils";

/**
 * Deterministic id 생성 — Date.now() 사용 X. 입력 기반 hash 형태로
 * 같은 input → 같은 id 보장 (재실행해도 audit trail 일관).
 */
function signalId(kind: string, artworkId: string, salt: string): string {
  return `mkt_${kind}_${artworkId}_${salt}`;
}

export class InternalMarketDataProvider implements MarketDataProvider {
  readonly providerId = "internal_v1";
  readonly isExternal = false;

  fetchSignals(input: MarketDataInput): MarketSignal[] {
    const out: MarketSignal[] = [];

    out.push(...this.computeArtistSignals(input));
    out.push(...this.computeSelfResaleSignal(input));
    out.push(...this.computeInquiryVolumeSignal(input));

    return out;
  }

  // --------------------------------------------------------------------------
  // 1. artist_avg + artist_recent_sale
  // --------------------------------------------------------------------------

  private computeArtistSignals(input: MarketDataInput): MarketSignal[] {
    const out: MarketSignal[] = [];

    // Same-artist artworks (현재 artwork 제외)
    const siblingArtworkIds = new Set(
      input.allArtworks
        .filter(
          (a) => a.artist.name === input.artistName && a.id !== input.artworkId
        )
        .map((a) => a.id)
    );

    if (siblingArtworkIds.size === 0) return out;

    // Same-artist KRW transactions에서 agreed price 수집
    type Pt = { value: number; at: string };
    const points: Pt[] = [];
    for (const sibId of siblingArtworkIds) {
      const txs = input.allTransactions[sibId] ?? [];
      for (const tx of txs) {
        if (tx.currency !== "KRW") continue; // v1: KRW only
        if (tx.agreedPrice <= 0) continue;
        points.push({ value: tx.agreedPrice, at: tx.updatedAt });
      }
    }

    if (points.length === 0) return out;

    // (a) artist_avg
    const sum = points.reduce((acc, p) => acc + p.value, 0);
    const avg = Math.round(sum / points.length);
    const latestAt = points
      .map((p) => p.at)
      .sort()
      .reverse()[0];

    out.push({
      id: signalId("artist_avg", input.artworkId, `${points.length}`),
      kind: "artist_avg",
      artworkId: input.artworkId,
      averageKRW: avg,
      currency: "KRW",
      sampleSize: points.length,
      freshness: latestAt,
      weight: points.length >= 2 ? 0.7 : 0.5,
      source: {
        kind: "internal",
        description: `같은 작가 KRW 거래 ${points.length}건 평균`,
      },
      rationale: `같은 작가 KRW 거래 ${points.length}건 평균 ${formatMoney(avg, "KRW")}`,
    });

    // (b) artist_recent_sale — 가장 최근 거래 1건
    const sorted = [...points].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
    const recent = sorted[0];

    out.push({
      id: signalId("artist_recent_sale", input.artworkId, recent.at),
      kind: "artist_recent_sale",
      artworkId: input.artworkId,
      valueKRW: recent.value,
      currency: "KRW",
      sampleSize: 1,
      freshness: recent.at,
      weight: 0.5,
      source: {
        kind: "internal",
        description: "같은 작가 최근 거래 1건",
      },
      rationale: `같은 작가 최근 거래 ${formatMoney(recent.value, "KRW")}`,
    });

    return out;
  }

  // --------------------------------------------------------------------------
  // 2. self_resale — 본 작품의 이전 거래 (가장 신뢰 가능한 가격 신호)
  // --------------------------------------------------------------------------

  private computeSelfResaleSignal(input: MarketDataInput): MarketSignal[] {
    const out: MarketSignal[] = [];
    const myTxs = input.allTransactions[input.artworkId] ?? [];

    if (myTxs.length < 2) return out; // 단일 거래는 self-resale signal 아님

    // 가장 오래된 → resale 이전의 prior tx로 간주 (rule_13: 새 tx prepend 패턴)
    const sortedByCreated = [...myTxs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const priorTx = sortedByCreated[0];

    if (priorTx.currency !== "KRW") return out; // v1: KRW only
    if (priorTx.agreedPrice <= 0) return out;

    out.push({
      id: signalId("self_resale", input.artworkId, priorTx.id),
      kind: "self_resale",
      artworkId: input.artworkId,
      valueKRW: priorTx.agreedPrice,
      currency: "KRW",
      sampleSize: 1,
      freshness: priorTx.updatedAt,
      weight: 0.85,
      source: {
        kind: "internal",
        description: "본 작품 이전 거래 (resale prior)",
      },
      rationale: `본 작품 이전 거래 ${formatMoney(priorTx.agreedPrice, "KRW")} — 가장 강한 신호`,
    });

    return out;
  }

  // --------------------------------------------------------------------------
  // 3. inquiry_volume — 수요 신호 (가격 직접 영향 아님, 신뢰만 보강)
  // --------------------------------------------------------------------------

  private computeInquiryVolumeSignal(input: MarketDataInput): MarketSignal[] {
    const list = input.allInquiries[input.artworkId] ?? [];
    if (list.length === 0) return [];

    const latestAt = [...list]
      .map((i) => i.createdAt)
      .sort()
      .reverse()[0];

    return [
      {
        id: signalId("inquiry_volume", input.artworkId, `${list.length}`),
        kind: "inquiry_volume",
        artworkId: input.artworkId,
        volumeCount: list.length,
        currency: "KRW", // formal, not used for volume signal
        sampleSize: list.length,
        freshness: latestAt,
        weight: 0.3,
        source: {
          kind: "internal",
          description: "본 작품 inquiry 누적",
        },
        rationale: `본 작품 inquiry ${list.length}건 — 수요 신호 (가격 직접 신호 아님)`,
      },
    ];
  }
}
