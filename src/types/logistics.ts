// ============================================================================
// Logistics — physical artwork delivery (rule_21).
//
// Separate domain from money flow (rule_3): Logistics tracks the *physical*
// movement of the artwork from gallery → collector. Status flow is one-way:
//
//   READY_FOR_PICKUP → IN_TRANSIT → DELIVERED → CONDITION_CHECKED
//
// CONDITION_CHECKED is reached when an AFTER_DELIVERY ConditionReport is
// created against a DELIVERED logistics record (auto-cascade).
//
// Artwork.state is NOT auto-changed by Logistics (rule_6 — operator controls
// PAID → CLOSED transition separately, even after CONDITION_CHECKED).
// ============================================================================

/**
 * Logistics lifecycle.
 * - READY_FOR_PICKUP   픽업 대기 — 갤러리 측 출고 준비 완료, carrier 픽업 대기
 * - IN_TRANSIT         배송 중   — carrier가 작품 인수, 운송 진행
 * - DELIVERED          인도 완료 — collector 수령 확인
 * - CONDITION_CHECKED  검수 완료 — 인도 후 컨디션 리포트 작성 완료, 거래 종료 가능
 */
export type LogisticsStatus =
  | "READY_FOR_PICKUP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CONDITION_CHECKED";

export interface Logistics {
  id: string;
  artworkId: string;
  transactionId: string;

  status: LogisticsStatus;

  /** Carrier / 운송사 name (e.g. SafeArt Logistics, FedEx Art). */
  carrierName: string;
  /** Carrier-issued tracking number. Free-form string. */
  trackingNumber: string;
  /** Scheduled / actual pickup date (YYYY-MM-DD or ISO). May be empty. */
  pickupDate: string;
  /** Scheduled / actual delivery date. May be empty. */
  deliveryDate: string;
  /** Internal note — special handling, insurance, contact info, etc. */
  memo: string;

  // --- STEP 50 — Provider sync metadata (rule_21 외부 hook) ----------------
  // 모두 옵셔널 — Persistence schema 변경 최소화 (validateV1은 logistics
  // 슬라이스의 *존재*만 검증, 필드 단위 schema 강제 없음). 기존 record는 모든
  // 필드 부재 상태로 hydrate되며, sync 시점에 채워짐.
  //
  // **표현 정책**: 모든 필드는 "운영 참고" / "provider 기준" 의미. 배송 보장 /
  // 보험 보장 / 확정 도착 / 법적 효력과 무관.

  /** Last provider sync ISO datetime. 부재 시 미동기화 상태. */
  providerLastSyncedAt?: string;
  /** Provider id (e.g. "mock_v1"). 미동기화 시 부재. */
  providerId?: string;
  /** Provider가 mock인지 여부. UI에 "Mock provider" 작게 표시용. */
  providerIsMock?: boolean;
  /** Provider의 짧은 한국어 status note. */
  providerNote?: string;
  /**
   * Provider의 estimated delivery (YYYY-MM-DD). 운영자가 직접 기입한
   * `deliveryDate`와는 별개 — provider 측 추정치이며 확정 도착이 아님.
   */
  providerEstimatedDelivery?: string;

  // Audit
  createdAt: string;
  updatedAt: string;
}
