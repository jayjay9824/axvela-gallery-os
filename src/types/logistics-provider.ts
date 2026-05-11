// ============================================================================
// Logistics Provider — STEP 50 (rule_21 Logistics 외부 hook).
//
// 갤러리 외부의 운송사 / tracking provider와 통신하기 위한 추상화 layer.
// 본 STEP은 mock provider 1개만 활성. 향후 DHL / FedEx / 국내 미술 운송사 API
// 연동 시 동일 interface를 구현해 `ACTIVE_LOGISTICS_PROVIDERS` 배열에 push.
//
// **설계 원칙 (STEP 19/29 MarketDataProvider 패턴 일관):**
//   - **Sync API 유지** — `fetchSync(input): LogisticsProviderResult`. 본 STEP은
//     mock 결정성 함수, 향후 async 도입 시 인터페이스만 교체 (호출 패턴은
//     dispatcher가 흡수).
//   - **결정성 보장** — 같은 input → 같은 출력 (fetchedAt만 변동).
//     trackingNumber / logisticsId 기반 hash로 outcome bucket 선택.
//   - **Failure 격리** — provider가 throw해도 dispatcher가 try/catch로 차단,
//     호출자(store action)는 null 받고 silent no-op 처리. 사용자는 "provider
//     실패 = 변화 없음" 경험.
//   - **표현 정책** — "참고" / "provider 기준" / "최근 조회 시점" 사용. "배송
//     보장" / "보험 보장" / "확정 도착" / "법적 효력" 표현 0건.
//   - **Persistence 무관** — 본 모듈은 어떤 storage도 갖지 않음. 모든 결과는
//     호출 시점에만 derive, 영속화는 호출자(store action)가 Logistics record의
//     opt 필드로 patch.
// ============================================================================

import type { LogisticsStatus } from "./logistics";

/**
 * Provider 호출 입력. Logistics record + 호출 컨텍스트.
 */
export interface LogisticsProviderInput {
  logisticsId: string;
  artworkId: string;
  transactionId: string;
  /** Logistics record의 현재 상태 — provider가 forward-only 추천 시 참고. */
  currentStatus: LogisticsStatus;
  /** 이미 채워진 trackingNumber. 비어있으면 provider가 mock id 생성 가능. */
  trackingNumber: string;
  /** 이미 채워진 carrierName. 비어있으면 provider가 sample carrier 추천 가능. */
  carrierName: string;
  /** ISO datetime — provider가 elapsed time 기반 휴리스틱에 사용. */
  createdAt: string;
}

/**
 * Provider sync 결과. **확정 도착 / 보장이 아닌 참고 정보만**.
 *
 * - `suggestedStatus`는 provider의 *추천*일 뿐 — store action이 정책 분기로
 *   forward-only non-locking transition만 자동 적용 (READY_FOR_PICKUP →
 *   IN_TRANSIT). DELIVERED / CONDITION_CHECKED 자동 적용 0건.
 * - `estimatedDelivery`는 provider 추정 — 운영자가 입력한 `deliveryDate`와 별개.
 * - `providerNote`는 짧은 한국어 status 설명, 사용자에게 그대로 표시.
 */
export interface LogisticsProviderResult {
  providerId: string;
  isMock: boolean;
  /** trackingNumber로 사용 가능한 식별자 (입력이 비었으면 mock 생성). */
  trackingId: string;
  /** carrier name 추천. */
  carrierName: string;
  /** Provider 추천 status. 자동 적용 정책은 store가 결정. */
  suggestedStatus: LogisticsStatus;
  /** YYYY-MM-DD. provider 추정 — 확정 도착 아님. */
  estimatedDelivery: string;
  /** ISO datetime — sync 호출 시각. */
  fetchedAt: string;
  /** 짧은 한국어 status note. */
  providerNote: string;
}

/**
 * Provider 인터페이스. 향후 외부 API 연동 시 동일 shape 구현.
 *
 * Sync 함수: 결정성 + 실패 격리. throw해도 dispatcher가 흡수.
 */
export interface LogisticsProvider {
  /** Provider 식별자 (e.g. "mock_v1", "dhl_v1", "fedex_v1"). */
  readonly providerId: string;
  /** Mock 여부 — UI에 "Mock provider" 표시 분기용. */
  readonly isMock: boolean;
  /** Sync 호출. 같은 input → 같은 output (fetchedAt 제외). */
  fetchSync(input: LogisticsProviderInput): LogisticsProviderResult;
}
