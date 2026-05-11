// ============================================================================
// MarketSignal — STEP 19 (rule_19 Market Data v1 · 내부 신호 레이어)
//
// **외부 API 호출 없음.** 내부 transaction / payment / inquiry / resale 기록만
// 사용해 가격 제안 정확도를 보강하는 derived signal 객체.
//
// 핵심 원칙:
//   - "감정가" / "시장가 확정" 표현 금지 — *참고 신호*만.
//   - Deterministic: 같은 store 상태 → 같은 signal 집합 (timestamp 제외).
//   - Source attribution: 모든 signal은 "어디서 왔는지" 추적 가능 — internal /
//     external 구분. external은 STEP 29 placeholder만 정의 (실제 호출 없음).
//   - PriceSuggestion sourceRefs에 `market_signal` kind로 연결됨 — audit trail
//     한 줄 더 늘어나는 형태로 기존 STEP 18 흐름 보존.
//
// 향후 STEP 29 (External Auction Market Reference)에서 확장:
//   - `ExternalAuctionProvider implements MarketDataProvider` 추가
//   - `MarketSignalSource = { kind: "external"; provider: "...", fxRefs?: ... }` 활용
//   - currency conversion / fetchedAt freshness 정책 정착
// ============================================================================

import type { FXRate } from "@/types/fx";

import type { Currency } from "./transaction";

/**
 * Internal signal types (v1). External 추가는 STEP 29.
 *
 * - artist_avg            같은 작가 작품들의 평균 거래가 (KRW 기준 transactions만)
 * - artist_recent_sale    같은 작가 최근 거래 1건 — 가장 시간상 가까운 신호
 * - self_resale           본 작품의 이전 거래(들) — resale 케이스에 강한 신호
 * - inquiry_volume        본 작품 inquiry 빈도 — 가격이 아닌 *수요* 신호 (확신만 보강)
 * - external_reference    STEP 29 placeholder. 본 STEP에서 emit하지 않음.
 */
export type MarketSignalKind =
  | "artist_avg"
  | "artist_recent_sale"
  | "self_resale"
  | "inquiry_volume"
  | "external_reference";

/**
 * Signal source attribution. Internal vs External 구분 — STEP 29에서 external
 * 활성화 시 provider 식별자 필수.
 */
export type MarketSignalSource =
  | {
      kind: "internal";
      /** 사람이 읽는 짧은 설명 (예: "본 갤러리 KRW 거래 3건 평균") */
      description: string;
    }
  | {
      kind: "external";
      provider: string;
      fetchedAt: string;
      /**
       * STEP 31 — 본 signal 계산 과정에서 참조한 FX rate(s). 외부 통화 가격을
       * KRW로 변환할 때 사용된 환율의 audit snapshot. PriceSuggestion이
       * `fxSnapshots`로 dedup 후 보관.
       */
      fxRefs?: FXRate[];
    };

/**
 * A market signal that contributes to a PriceSuggestion. **Ephemeral** —
 * 매 generate 호출 시 새로 계산되며 store에 별도 슬라이스로 보관하지 않음.
 * Audit trail은 PriceSuggestion.sourceRefs[]를 통해 보존.
 */
export interface MarketSignal {
  id: string;
  kind: MarketSignalKind;

  /** 본 signal이 어떤 작품 컨텍스트에서 계산되었는지 (currentArtwork.id) */
  artworkId: string;

  // --- Numeric content (kind에 따라 일부만 채워짐) ---------------------------
  /** 단일 가격 신호 (artist_recent_sale, self_resale에서 채워짐) */
  valueKRW?: number;
  /** 평균 신호 (artist_avg에서 채워짐) */
  averageKRW?: number;
  /** 빈도 신호 (inquiry_volume에서 채워짐) */
  volumeCount?: number;
  /** 신호의 base currency. 모두 KRW 정규화 (USD/EUR 거래는 v1에서 제외) */
  currency: Currency;

  // --- Source attribution ---------------------------------------------------
  source: MarketSignalSource;
  /**
   * 본 signal이 reflect하는 시점 (ISO datetime).
   * - internal: 가장 최근 입력 record의 timestamp
   * - external: provider fetchedAt (STEP 29)
   */
  freshness: string;
  /** 신호를 만든 데이터 포인트 수 (transactions / payments / inquiries 개수) */
  sampleSize: number;

  // --- Confidence input -----------------------------------------------------
  /**
   * 0~1. PriceSuggestion 신뢰도 보정에 쓰이는 가중치.
   * - 0.85  self_resale (본 작품 실 거래)
   * - 0.70  artist_avg (sampleSize ≥ 2)
   * - 0.50  artist_recent_sale (단일 sample)
   * - 0.30  inquiry_volume (수요 신호 — 가격 직접 신호 아님)
   */
  weight: number;

  /** 카드에 표시할 짧은 한국어 설명 (한 문장) */
  rationale: string;
}

/**
 * Provider의 입력. Store가 필요한 슬라이스만 read-only로 모아 전달.
 * generate 시점에 한 번 빌드되어 모든 활성 provider에 패스됨.
 */
export interface MarketDataInput {
  /** 평가 대상 작품 */
  artworkId: string;
  /** 작가명 — same-artist 신호의 매칭 키 (Artist.name 사용) */
  artistName: string;
  /**
   * 갤러리 전체 작품 — same-artist 식별 + median fallback.
   * artist 필드는 객체 — provider는 `artist.name`로 매칭한다.
   */
  allArtworks: ReadonlyArray<{
    id: string;
    artist: { name: string };
    priceKRW: number;
  }>;
  /** Transactions (artwork-keyed) — agreedPrice / currency / isResale */
  allTransactions: Readonly<Record<string, ReadonlyArray<{
    id: string;
    artworkId: string;
    agreedPrice: number;
    currency: Currency;
    status: string;
    createdAt: string;
    updatedAt: string;
    isResale?: boolean;
    previousTransactionId?: string;
  }>>>;
  /** Payments (transaction-keyed) — paidAt freshness signal */
  allPayments: Readonly<Record<string, ReadonlyArray<{
    id: string;
    transactionId: string;
    amount: number;
    currency: Currency;
    paidAt: string;
  }>>>;
  /** Inquiries (artwork-keyed) — count for volume signal */
  allInquiries: Readonly<Record<string, ReadonlyArray<{
    id: string;
    artworkId: string;
    createdAt: string;
  }>>>;
}

/**
 * Provider interface — 본 STEP은 InternalMarketDataProvider 1개.
 * STEP 29에서 ExternalAuctionProvider 등 추가.
 *
 * 실행 model: synchronous + pure. provider는 네트워크 / async 호출 금지 (v1).
 * STEP 29 external 도입 시 async + caching layer 추가 예정.
 */
export interface MarketDataProvider {
  /** 식별자 — debug / source attribution용 */
  readonly providerId: string;
  /** 실제로 외부 네트워크를 사용하는지 — v1 internal은 false */
  readonly isExternal: boolean;
  /** Signal 계산 — 결정성 보장 */
  fetchSignals(input: MarketDataInput): MarketSignal[];
}
