// ============================================================================
// ConditionReport — 작품 상태 증명 문서 (rule_4 Document trust + rule_21 Logistics).
//
// 한 Logistics 레코드는 두 종류의 ConditionReport를 가질 수 있습니다:
//   - BEFORE_SHIPMENT  출고 전 컨디션 — 갤러리 측 작성, 인수 인계 기준
//   - AFTER_DELIVERY   인도 후 컨디션 — collector 수령 시 작성, 거래 종결 근거
//
// 두 리포트의 conditionStatus를 비교해 손상 여부를 판단합니다. AFTER_DELIVERY
// 리포트 생성은 Logistics를 CONDITION_CHECKED 상태로 자동 전환합니다.
//
// imagePlaceholder는 v1 placeholder 필드 — 실제 이미지 첨부는 후속 단계에서.
// ============================================================================

export type ReportType = "BEFORE_SHIPMENT" | "AFTER_DELIVERY";

/**
 * Condition assessment.
 * - GOOD     양호  — 손상 없음, 인수 가능
 * - WATCH    주의  — 미세 흠집 또는 관찰 필요 항목 있음
 * - DAMAGED  손상  — 명확한 손상 발견, 분쟁/보험 처리 필요
 */
export type ConditionStatus = "GOOD" | "WATCH" | "DAMAGED";

export interface ConditionReport {
  id: string;
  logisticsId: string;
  /** Denormalized for direct lookup (rule_11 chain). */
  artworkId: string;
  /** Denormalized for direct lookup (rule_11 chain). */
  transactionId: string;

  reportType: ReportType;
  conditionStatus: ConditionStatus;

  /** Free-form notes from the inspector (gallery staff or collector). */
  notes: string;
  /**
   * Image attachment placeholder. v1: empty string.
   * Forward-compat for actual file/URL upload in a later step.
   */
  imagePlaceholder: string;

  /**
   * Correction trail (STEP 15, rule_4 Document Trust).
   *
   * ConditionReport is immutable post-create. If an inspector needs to revise
   * an assessment, a new ConditionReport is created with `correctsReportId`
   * pointing at the original. The original record is preserved unchanged.
   *
   * `correctsReportId === undefined` for first-issue reports.
   * Multiple corrections of the same original form a chain (each correction's
   * `correctsReportId` points at the *immediate previous* record, not the
   * root). Walk the chain via repeated lookups when a full audit trail is
   * needed.
   */
  correctsReportId?: string;

  // Audit
  createdAt: string;
  updatedAt: string;
}
