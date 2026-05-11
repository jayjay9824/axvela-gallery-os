// ============================================================================
// MockLogisticsProvider — STEP 50.
//
// Deterministic mock implementation of `LogisticsProvider`. **외부 네트워크 0건**
// — 모든 결과는 입력 hash 기반 sample dataset에서 derive. 같은 input → 같은
// output (fetchedAt만 변동). 향후 실제 DHL / FedEx / 국내 미술 운송사 API
// 연동 시 본 클래스만 교체하면 됨 (interface는 그대로).
//
// **표현 정책**: 모든 mock note는 "운영 참고" 톤. "배송 보장" / "확정 도착" /
// "보험 보장" / "법적 효력" 표현 0건.
// ============================================================================

import type {
  LogisticsProvider,
  LogisticsProviderInput,
  LogisticsProviderResult,
} from "@/types/logistics-provider";
import type { LogisticsStatus } from "@/types/logistics";

// ---------------------------------------------------------------------------
// Sample datasets (deterministic — bucket 선택은 input hash로)
// ---------------------------------------------------------------------------

const SAMPLE_CARRIERS: ReadonlyArray<string> = [
  "SafeArt Logistics",
  "Atelier Art Transport",
  "Crozier Fine Arts",
  "ART NOVA Express",
];

/**
 * Provider note는 status별로 다른 sample 풀에서 선택. 모두 "참고" 톤.
 * "배송 보장" / "확정" 표현 0건.
 */
const SAMPLE_NOTES_BY_STATUS: Record<LogisticsStatus, ReadonlyArray<string>> = {
  READY_FOR_PICKUP: [
    "픽업 대기 · 갤러리 측 출고 준비 완료",
    "carrier 픽업 일정 조율 중",
    "포장 / 인수 서류 준비 단계",
  ],
  IN_TRANSIT: [
    "거점 운송 중 · provider 기준 정상 진행",
    "허브 분류 완료 · 최종 배송 라우팅",
    "통관 진행 중 · 추가 서류 요청 가능성",
    "지역 배송 단계 · 수령 일정 조율 필요",
  ],
  DELIVERED: [
    "수령 확인 · condition check 단계 대기",
    "수령 완료 · 검수 일정 별도 조율",
  ],
  CONDITION_CHECKED: [
    "검수 단계 종료 · provider 측 추가 변경 사항 없음",
    "기록 마감 · audit 보존 단계",
  ],
};

const ESTIMATED_DELIVERY_BASE_DAYS = 7;
const ESTIMATED_DELIVERY_RANGE = 8; // 7~14 days

/**
 * READY_FOR_PICKUP 상태에서 IN_TRANSIT을 추천할 최소 경과 일수.
 * 그 이전에는 forward-only 추천 자체를 안 함 (status 유지).
 *
 * **DELIVERED / CONDITION_CHECKED 자동 추천 0건** — 사용자가 명시적으로 처리.
 */
const READY_TO_TRANSIT_DAYS = 3;

// ---------------------------------------------------------------------------
// Provider impl
// ---------------------------------------------------------------------------

export class MockLogisticsProvider implements LogisticsProvider {
  readonly providerId = "mock_v1";
  readonly isMock = true;

  fetchSync(input: LogisticsProviderInput): LogisticsProviderResult {
    // Deterministic seed — logistics id 기반.
    const seed = simpleHash(input.logisticsId);

    // tracking id — 기존 값 우선 (운영자 입력 보존), 없으면 mock 생성
    const trackingId =
      input.trackingNumber.trim() ||
      `MK-${input.logisticsId.slice(-6).toUpperCase()}-${(seed % 9999)
        .toString()
        .padStart(4, "0")}`;

    // carrier — 기존 값 우선
    const carrierName =
      input.carrierName.trim() ||
      SAMPLE_CARRIERS[seed % SAMPLE_CARRIERS.length];

    // suggestedStatus — forward-only 휴리스틱
    const daysSinceCreate = computeDaysSince(input.createdAt);
    let suggestedStatus: LogisticsStatus = input.currentStatus;
    if (
      input.currentStatus === "READY_FOR_PICKUP" &&
      daysSinceCreate >= READY_TO_TRANSIT_DAYS
    ) {
      suggestedStatus = "IN_TRANSIT";
    }
    // DELIVERED 추천 0건 (immutable 트리거 회피)
    // CONDITION_CHECKED 추천 0건 (cascade 전용)

    // estimatedDelivery — createdAt + 7~14일 (seed 기반 결정성)
    const offsetDays =
      ESTIMATED_DELIVERY_BASE_DAYS + (seed % ESTIMATED_DELIVERY_RANGE);
    const baseDate = new Date(input.createdAt);
    if (Number.isNaN(baseDate.getTime())) {
      // createdAt 파싱 실패 fallback — 오늘 + offset
      baseDate.setTime(Date.now());
    }
    baseDate.setDate(baseDate.getDate() + offsetDays);
    const estimatedDelivery = baseDate.toISOString().slice(0, 10);

    // providerNote — 추천 status 기준 sample 풀에서 deterministic 선택
    const notesPool = SAMPLE_NOTES_BY_STATUS[suggestedStatus];
    const providerNote = notesPool[seed % notesPool.length];

    return {
      providerId: this.providerId,
      isMock: this.isMock,
      trackingId,
      carrierName,
      suggestedStatus,
      estimatedDelivery,
      fetchedAt: new Date().toISOString(),
      providerNote,
    };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * 단순 32-bit string hash. 결정성 + 통계적 분산만 보장 — 보안용 아님.
 */
function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function computeDaysSince(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
