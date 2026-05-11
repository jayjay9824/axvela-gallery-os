// ============================================================================
// ExternalAuctionProvider — STEP 29 (External Auction Market Reference)
//
// STEP 19에서 마련한 `MarketDataProvider` 확장 hook의 첫 번째 외부 구현.
// 갤러리 외부의 옥션 / 마켓플레이스 가격을 PriceSuggestion에 신호로 공급.
//
// 설계 원칙:
//   - **Sync API 유지** — `fetchSignals(input): MarketSignal[]`. STEP 19 인터페이스
//     무변경. 내부에 in-memory cache + TTL을 두고, 같은 input은 cache hit으로
//     처리. 실제 네트워크 fetch는 v1에서 시뮬레이션 (mock dataset).
//   - **Failure 격리** — 본 provider가 throw해도 `gatherMarketSignals`의 try/catch가
//     차단 → internal 신호는 그대로 emit. 사용자는 "외부 신호만 빠진" 정상 동작 경험.
//   - **FX 변환 (USD → KRW)** — 정적 환율 테이블 (v1). 향후 STEP에서 실시간 FX
//     feed로 교체 가능. 모든 외부 signal은 KRW로 정규화 emit.
//   - **Freshness + TTL** — 각 cache 엔트리에 fetchedAt 기록, 24h 만료. 만료된
//     데이터는 다음 fetchSignals 호출에서 자동 refresh.
//   - **Source attribution** — 모든 signal의 `source.kind === "external"` +
//     `provider: "auction_v1"` + `fetchedAt: ISO`. STEP 19의 disclaimer 분기
//     ("내부 + 외부 reference 결합" 문구)가 자동 활성.
//   - **결정성** — 같은 input + 같은 cache 상태 → 같은 출력. signal id는 입력
//     기반 hash. fetchedAt timestamp만 변동 (cache 갱신 시점).
//
// **본 STEP에서 실제 네트워크 fetch 안 함** — mock dataset 직접 참조. 향후
// 실 auction API 연동 시 `loadFromAPI()` 메서드만 교체하면 됨 (나머지 cache /
// FX / signal 빌드 로직은 그대로 재사용).
// ============================================================================

import type {
  MarketDataInput,
  MarketDataProvider,
  MarketSignal,
} from "@/types/market-signal";
import { formatMoney } from "@/lib/utils";
import { convertCurrency, getFXRate } from "@/lib/fx-provider";
import type { FXRate } from "@/types/fx";

// ---------------------------------------------------------------------------
// FX 변환은 STEP 31 fx-provider.ts로 외부화. 본 모듈은 `convertCurrency` /
// `getFXRate` 헬퍼만 호출 — 정적 환율 테이블 보유 0줄.
//
// fxRefs 보관 정책: 각 외부 signal의 source.fxRefs에 변환에 사용된 환율 snapshot을
// 첨부 → axvela-price.ts가 dedup 후 PriceSuggestion.fxSnapshots로 collect →
// SuggestionCard에 audit 정보로 노출.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Cache — provider 인스턴스 안에서 artistName 단위로 보관
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

interface CacheEntry {
  signals: MarketSignal[];
  fetchedAt: string;     // ISO datetime
  fetchedAtMs: number;   // 비교 편의용
}

// ---------------------------------------------------------------------------
// Mock dataset — auction comparable sales
//
// 실제 auction API 연동 시 본 상수를 외부 fetch 결과로 대체. 구조는 그대로.
// ---------------------------------------------------------------------------

interface AuctionComparable {
  artistName: string;
  workTitle: string;
  pricePaidUSD: number;
  saleDate: string;       // ISO date
  auctionHouse: string;
}

interface MarketplaceListing {
  artistName: string;
  askingPriceUSD: number;
  listedDate: string;
  marketplace: string;
}

const MOCK_AUCTION_COMPARABLES: ReadonlyArray<AuctionComparable> = [
  // 김지은 — 2건 (Sotheby's + Christie's)
  {
    artistName: "김지은",
    workTitle: "Aurora Series #08",
    pricePaidUSD: 14500,
    saleDate: "2025-09-12",
    auctionHouse: "Sotheby's Hong Kong",
  },
  {
    artistName: "김지은",
    workTitle: "Untitled (2023)",
    pricePaidUSD: 18200,
    saleDate: "2025-11-04",
    auctionHouse: "Christie's Hong Kong",
  },

  // 박현우 — 1건
  {
    artistName: "박현우",
    workTitle: "Stratum 04",
    pricePaidUSD: 22500,
    saleDate: "2025-08-21",
    auctionHouse: "Phillips Hong Kong",
  },

  // 이서연 — 1건
  {
    artistName: "이서연",
    workTitle: "Deep Field 02",
    pricePaidUSD: 11000,
    saleDate: "2025-10-19",
    auctionHouse: "Sotheby's Hong Kong",
  },

  // 최아름 — 2건 (가장 최근 + 1년 전)
  {
    artistName: "최아름",
    workTitle: "Inversion #5",
    pricePaidUSD: 9800,
    saleDate: "2025-07-08",
    auctionHouse: "Christie's Hong Kong",
  },
  {
    artistName: "최아름",
    workTitle: "Inversion #2",
    pricePaidUSD: 12300,
    saleDate: "2026-01-15",
    auctionHouse: "Phillips Hong Kong",
  },

  // 한도윤 — 1건
  {
    artistName: "한도윤",
    workTitle: "Surface III",
    pricePaidUSD: 16500,
    saleDate: "2025-12-02",
    auctionHouse: "Sotheby's Hong Kong",
  },

  // 정민호 / 윤세라는 의도적으로 데이터 없음 — fallback 시나리오 검증용
];

const MOCK_MARKETPLACE_LISTINGS: ReadonlyArray<MarketplaceListing> = [
  {
    artistName: "이서연",
    askingPriceUSD: 13500,
    listedDate: "2026-02-10",
    marketplace: "Artsy",
  },
  {
    artistName: "박현우",
    askingPriceUSD: 25000,
    listedDate: "2026-03-14",
    marketplace: "Artsy",
  },
];

// ---------------------------------------------------------------------------
// Provider 옵션
// ---------------------------------------------------------------------------

export interface ExternalAuctionProviderOptions {
  /**
   * 실패 시뮬레이션 — 0~1. 0 = 항상 성공 (v1 default). 1 = 항상 실패.
   * 향후 안정성 테스트 시 0.3 등으로 설정 가능. 실패 시 throw → gatherMarketSignals
   * try/catch가 차단 → internal 신호만 emit (시스템 안정성 유지).
   */
  failureRate?: number;
  /** TTL 커스터마이즈 (ms). 기본 24h. */
  cacheTTLMs?: number;
}

// ---------------------------------------------------------------------------
// Provider 구현
// ---------------------------------------------------------------------------

export class ExternalAuctionProvider implements MarketDataProvider {
  readonly providerId = "auction_v1";
  readonly isExternal = true;

  private readonly failureRate: number;
  private readonly cacheTTLMs: number;
  private readonly cache: Map<string, CacheEntry> = new Map();

  constructor(options: ExternalAuctionProviderOptions = {}) {
    this.failureRate = options.failureRate ?? 0;
    this.cacheTTLMs = options.cacheTTLMs ?? CACHE_TTL_MS;
  }

  fetchSignals(input: MarketDataInput): MarketSignal[] {
    // 실패 시뮬레이션 — v1 default 0이므로 발화 안 함. 발화 시 throw → 상위
    // gatherMarketSignals try/catch가 차단 → internal 신호만 emit.
    if (this.failureRate > 0 && Math.random() < this.failureRate) {
      throw new Error(
        `[ExternalAuctionProvider] simulated network failure (rate=${this.failureRate})`
      );
    }

    const cached = this.cache.get(input.artistName);
    if (cached && this.isFresh(cached)) {
      return this.rebindToArtwork(cached.signals, input.artworkId);
    }

    // Cache miss / stale — "fetch" (실제로는 mock dataset lookup) + cache 갱신
    const signals = this.buildSignalsFor(input);
    const now = new Date();
    this.cache.set(input.artistName, {
      signals,
      fetchedAt: now.toISOString(),
      fetchedAtMs: now.getTime(),
    });
    return this.rebindToArtwork(signals, input.artworkId);
  }

  private isFresh(entry: CacheEntry): boolean {
    return Date.now() - entry.fetchedAtMs < this.cacheTTLMs;
  }

  /**
   * Cached signals은 originally 어떤 작품 컨텍스트에서 만들어졌든 같은 작가의
   * 다른 작품에서도 재사용 가능 — `artworkId`만 입력 작품으로 rebind.
   * (signal id는 artistName 기반이라 안정적, artworkId 필드만 갱신.)
   */
  private rebindToArtwork(
    signals: MarketSignal[],
    artworkId: string
  ): MarketSignal[] {
    return signals.map((s) => ({ ...s, artworkId }));
  }

  // ------------------------------------------------------------------------
  // Mock data → MarketSignal[] 변환
  // ------------------------------------------------------------------------

  private buildSignalsFor(input: MarketDataInput): MarketSignal[] {
    const out: MarketSignal[] = [];
    const fetchedAt = new Date().toISOString();

    // STEP 31 — 본 signal 빌드에 사용된 환율의 audit snapshot.
    // 모든 mock 데이터가 USD 기준이므로 USD/KRW 한 쌍만 필요. 향후 EUR/JPY 등
    // 다중 통화 mock 추가 시 같은 패턴으로 push.
    const usdKrwSnapshot = getFXRate("USD", "KRW");
    const fxRefs: FXRate[] = usdKrwSnapshot ? [usdKrwSnapshot] : [];

    // 1) Auction comparable sales
    const comparables = MOCK_AUCTION_COMPARABLES.filter(
      (c) => c.artistName === input.artistName
    );

    if (comparables.length > 0) {
      // (a) artist_avg (external)
      const krwValues = comparables.map((c) =>
        convertCurrency(c.pricePaidUSD, "USD", "KRW")
      );
      const sum = krwValues.reduce((a, b) => a + b, 0);
      const avg = Math.round(sum / krwValues.length);
      const houses = Array.from(
        new Set(comparables.map((c) => c.auctionHouse))
      ).join(", ");

      out.push({
        id: `mkt_ext_artist_avg_${slug(input.artistName)}_${comparables.length}`,
        kind: "artist_avg",
        artworkId: input.artworkId,
        averageKRW: avg,
        currency: "KRW",
        sampleSize: comparables.length,
        freshness: fetchedAt,
        weight: comparables.length >= 2 ? 0.75 : 0.55,
        source: {
          kind: "external",
          provider: this.providerId,
          fetchedAt,
          fxRefs,
        },
        rationale: `옥션 comparable ${comparables.length}건 평균 ${formatMoney(
          avg,
          "KRW"
        )} (${houses})`,
      });

      // (b) artist_recent_sale (external) — 가장 최근 거래 1건
      const sortedComps = [...comparables].sort(
        (a, b) =>
          new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
      );
      const recent = sortedComps[0];
      const recentKRW = convertCurrency(recent.pricePaidUSD, "USD", "KRW");

      out.push({
        id: `mkt_ext_recent_${slug(input.artistName)}_${recent.saleDate}`,
        kind: "artist_recent_sale",
        artworkId: input.artworkId,
        valueKRW: recentKRW,
        currency: "KRW",
        sampleSize: 1,
        freshness: recent.saleDate,
        weight: 0.55,
        source: {
          kind: "external",
          provider: this.providerId,
          fetchedAt,
          fxRefs,
        },
        rationale: `최근 옥션 낙찰 ${formatMoney(recentKRW, "KRW")} · ${recent.auctionHouse} (${recent.saleDate})`,
      });
    }

    // 2) Marketplace listings — `external_reference` kind 사용
    //    (asking price이며 sale price 아님 — 신호 성격 다름)
    const listings = MOCK_MARKETPLACE_LISTINGS.filter(
      (l) => l.artistName === input.artistName
    );

    if (listings.length > 0) {
      const krwValues = listings.map((l) =>
        convertCurrency(l.askingPriceUSD, "USD", "KRW")
      );
      const sum = krwValues.reduce((a, b) => a + b, 0);
      const avg = Math.round(sum / krwValues.length);
      const places = Array.from(
        new Set(listings.map((l) => l.marketplace))
      ).join(", ");

      out.push({
        id: `mkt_ext_listing_${slug(input.artistName)}_${listings.length}`,
        kind: "external_reference",
        artworkId: input.artworkId,
        averageKRW: avg,
        currency: "KRW",
        sampleSize: listings.length,
        freshness: fetchedAt,
        weight: 0.4, // listing은 sale보다 약한 신호 (asking price)
        source: {
          kind: "external",
          provider: this.providerId,
          fetchedAt,
          fxRefs,
        },
        rationale: `마켓플레이스 listing ${listings.length}건 평균 호가 ${formatMoney(
          avg,
          "KRW"
        )} (${places}) — 낙찰가 아님`,
      });
    }

    return out;
  }
}

// ---------------------------------------------------------------------------
// Helper — id-safe slug from Korean / mixed-script artist names
// ---------------------------------------------------------------------------

function slug(name: string): string {
  // 비-ASCII는 base36 hash로 압축. 같은 input → 같은 출력 (deterministic).
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
