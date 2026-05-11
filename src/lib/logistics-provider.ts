// ============================================================================
// Logistics Provider Registry — STEP 50 (rule_21).
//
// STEP 19 `market-data.ts` 패턴 답습. Provider 집합을 한 곳에서 관리, 호출자는
// dispatcher 함수만 사용.
//
// **본 STEP은 ACTIVE_LOGISTICS_PROVIDERS에 mock 1개만**. 외부 호출 0줄.
// 향후 DHL / FedEx / 국내 미술 운송사 API 연동 시 본 배열에 push만 하면 됨
// (다른 코드 변경 0).
//
// **Failure 격리**: try/catch로 provider throw를 dispatcher가 흡수. 실패 시
// null 반환 → 호출자 store action이 silent no-op 처리 (timeline 오염 0).
// ============================================================================

import type {
  LogisticsProvider,
  LogisticsProviderInput,
  LogisticsProviderResult,
} from "@/types/logistics-provider";
import { MockLogisticsProvider } from "./mock-logistics-provider";

// ---------------------------------------------------------------------------
// Active provider registry
// ---------------------------------------------------------------------------

/**
 * 활성 provider 목록.
 *
 * v1 (STEP 50): MockLogisticsProvider 단독.
 * 향후 STEP에서: + DHL / FedEx / 국내 미술 운송사 등 추가.
 *
 * 정렬은 우선순위 순 (앞쪽이 first-try). dispatcher는 첫 성공 provider 결과를
 * 반환. mock은 v2 이후 빠질 수 있음 (real provider로 교체).
 */
const ACTIVE_LOGISTICS_PROVIDERS: LogisticsProvider[] = [
  new MockLogisticsProvider(),
];

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

/**
 * Provider sync 호출. 첫 성공 provider 결과 반환, 모두 실패 시 null.
 *
 * **결정성**: 같은 input + 같은 provider 상태 → 같은 출력 (fetchedAt만 변동).
 * **실패 격리**: provider 1개 실패해도 다른 provider 시도. 모두 실패해도 null
 * 반환만 — throw하지 않음 (호출자 보호).
 */
export function fetchLogisticsSync(
  input: LogisticsProviderInput
): LogisticsProviderResult | null {
  for (const provider of ACTIVE_LOGISTICS_PROVIDERS) {
    try {
      return provider.fetchSync(input);
    } catch {
      // Defensive: 다음 provider 시도. 모두 실패하면 아래 null 반환.
    }
  }
  return null;
}

/**
 * 활성 provider 보유 여부. UI에서 sync 버튼 노출 분기용 — 향후 0 provider 환경
 * 대비 (실 API 키 미설정 등). 본 STEP에서는 mock 1개로 항상 true.
 */
export function hasLogisticsProvider(): boolean {
  return ACTIVE_LOGISTICS_PROVIDERS.length > 0;
}

/**
 * Active provider의 메타데이터 — UI footer / banner에 "Mock provider" 표시용.
 * Provider 다중일 경우 첫 번째 (가장 우선순위 높은) provider 정보 반환.
 */
export function getActiveLogisticsProviderInfo(): {
  providerId: string;
  isMock: boolean;
} | null {
  const first = ACTIVE_LOGISTICS_PROVIDERS[0];
  if (!first) return null;
  return { providerId: first.providerId, isMock: first.isMock };
}
