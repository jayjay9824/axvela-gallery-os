// ============================================================================
// Market Data Registry — STEP 19
//
// Provider 집합을 한 곳에서 관리한다. 본 STEP에서는 InternalMarketDataProvider
// 1개만 활성. STEP 29 (External Auction Market Reference)에서 확장 시:
//
//   import { ExternalAuctionProvider } from "@/lib/external-auction-provider";
//   ACTIVE_PROVIDERS.push(new ExternalAuctionProvider({ apiKey, ... }));
//
// **본 STEP은 ACTIVE_PROVIDERS에 internal 1개만**. 외부 호출 0줄.
// ============================================================================

import type { MarketDataInput, MarketDataProvider, MarketSignal } from "@/types/market-signal";
import { InternalMarketDataProvider } from "@/lib/internal-market-provider";
import { ExternalAuctionProvider } from "@/lib/external-auction-provider";

/**
 * 활성 provider 목록.
 *
 * v1 (STEP 19): InternalMarketDataProvider 단독.
 * v2 (STEP 29): + ExternalAuctionProvider — 옥션 comparable + 마켓플레이스 listing.
 *
 * 실패 격리: 본 배열을 iterate하는 `gatherMarketSignals`는 try/catch로 각 provider
 * 실패를 차단 — external 네트워크 실패가 internal 신호에 영향 0.
 *
 * 향후 STEP에서 provider 추가는 본 배열에만 push (다른 코드 변경 0).
 */
export const ACTIVE_PROVIDERS: MarketDataProvider[] = [
  new InternalMarketDataProvider(),
  new ExternalAuctionProvider(),
];

/**
 * 모든 활성 provider에서 signal 수집.
 *
 * Provider 호출은 sync — internal v1은 모두 pure function. STEP 29에서
 * external 추가 시 async 변경 + caching layer 도입 예정 (그때 본 함수 시그니처도
 * Promise<MarketSignal[]>로 변경 가능).
 */
export function gatherMarketSignals(input: MarketDataInput): MarketSignal[] {
  const out: MarketSignal[] = [];
  for (const provider of ACTIVE_PROVIDERS) {
    try {
      out.push(...provider.fetchSignals(input));
    } catch {
      // Defensive: provider 1개 실패해도 다른 provider 신호는 보존.
      // STEP 29 external provider 도입 후 네트워크 실패 시에도 internal 보존됨.
    }
  }
  return out;
}

/**
 * 활성 provider 중 external이 있는지 — UI에 "외부 데이터 포함" 마커 표시용.
 * STEP 19에서는 항상 false. STEP 29 활성화 시 true.
 */
export function hasExternalProviders(): boolean {
  return ACTIVE_PROVIDERS.some((p) => p.isExternal);
}
