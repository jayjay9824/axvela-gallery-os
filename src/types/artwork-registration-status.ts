// ============================================================================
// AXVELA — ArtworkRegistrationStatus Type Foundation (STEP 114)
// ============================================================================
//
// **본 모듈의 정체**:
//   Artwork *operational/registration lifecycle* 의 10-state union 정착.
//   `AXVELA_WORKFLOW_ARCHITECTURE.md §3.1` 가 spec source — 본 enum 은 그 spec
//   의 type-level manifestation.
//
// **Two-Dimension State Model**:
//   - `ArtworkState` (rule_6, 기존)        sales lifecycle    DRAFT/READY/INQUIRY/DEAL/PAID/CLOSED/REOPENED/BROKERED
//   - `ArtworkRegistrationStatus` (본 STEP)  operational lifecycle  10-state below
//
//   두 dimension 은 *별도 union* — TypeScript 가 type-distinct 처리, 충돌 0건.
//   두 dimension 의 mapping (자동 derive) 은 STEP 117/122 영역 — 본 STEP 은
//   foundation only.
//
// **Phase 4 §4 Implementation Constraints 정합**:
//   §4.1 Additive only          ✓  신규 type
//   §4.2 Optional slot priority  ✓  Artwork.registrationStatus? 만 추가
//   §4.3 No persistence migration ✓  validateV1 / SCHEMA_VERSION 변경 0줄
//   §4.5 Backward compatibility   ✓  기존 데이터 (registrationStatus 부재) 자동 호환
//
// **외부 라이브러리 0개** — pure TypeScript types + readonly array + record.
// ============================================================================

// ----------------------------------------------------------------------------
// 1. 10-State Union — operational/registration lifecycle
// ----------------------------------------------------------------------------

/**
 * Artwork operational/registration lifecycle.
 *
 * 사용자 spec STEP 114 (AXVELA_WORKFLOW_ARCHITECTURE.md §3.1) 정확 매칭:
 *
 *   DRAFT
 *     ↓ (담당자 검토 요청)
 *   PENDING_REVIEW
 *     ↓ (검토 완료, 거래 진입 준비)
 *   INQUIRY_ACTIVE
 *     ↓ (collector 응답, 협상 진입)
 *   DEAL_IN_PROGRESS
 *     ↓ (계약 시작)
 *   CONTRACT_PENDING
 *     ↓ (계약 완료, 인보이스 발행)
 *   AWAITING_PAYMENT
 *     ↓ (입금 완료)
 *   PAID
 *     ↓ (큐레이션 / 출고 준비)
 *   PREPARING_CURATION
 *     ↓ (전시 / 출고 가능)
 *   READY_FOR_EXHIBITION
 *     ↓ (workflow 완료)
 *   ARCHIVED
 *
 * Note: "DRAFT" / "PAID" literal 은 ArtworkState 에도 존재하나 *별도 type union*
 *       이므로 충돌 0건. 두 dimension 은 의도적으로 분리.
 */
export type ArtworkRegistrationStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "INQUIRY_ACTIVE"
  | "DEAL_IN_PROGRESS"
  | "CONTRACT_PENDING"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "PREPARING_CURATION"
  | "READY_FOR_EXHIBITION"
  | "ARCHIVED";

// ----------------------------------------------------------------------------
// 2. Canonical Ordered List — progression sequence
// ----------------------------------------------------------------------------

/**
 * 진행 순서 array (canonical order).
 *
 * `nextRegistrationStatus` helper 가 본 array 를 traversal source 로 사용.
 * 외부 코드는 본 array 를 *읽기 전용* 으로 사용 — `as const` 의 readonly 보장.
 */
export const ARTWORK_REGISTRATION_STATUSES: readonly ArtworkRegistrationStatus[] =
  [
    "DRAFT",
    "PENDING_REVIEW",
    "INQUIRY_ACTIVE",
    "DEAL_IN_PROGRESS",
    "CONTRACT_PENDING",
    "AWAITING_PAYMENT",
    "PAID",
    "PREPARING_CURATION",
    "READY_FOR_EXHIBITION",
    "ARCHIVED",
  ] as const;

// ----------------------------------------------------------------------------
// 3. Display Labels — Korean (gallery internal)
// ----------------------------------------------------------------------------

/**
 * 한국어 라벨 — gallery internal workflow tone.
 *
 * STEP 113 terminology standards 정합:
 *   "담당자 검토" 사용, "인간 검토" 절대 사용 금지.
 */
export const ARTWORK_REGISTRATION_STATUS_LABEL_KR: Record<
  ArtworkRegistrationStatus,
  string
> = {
  DRAFT: "초안",
  PENDING_REVIEW: "담당자 검토 대기",
  INQUIRY_ACTIVE: "문의 진행 중",
  DEAL_IN_PROGRESS: "거래 협의 중",
  CONTRACT_PENDING: "계약 진행 중",
  AWAITING_PAYMENT: "입금 대기",
  PAID: "입금 완료",
  PREPARING_CURATION: "큐레이션 준비",
  READY_FOR_EXHIBITION: "전시 준비 완료",
  ARCHIVED: "보관",
};

// ----------------------------------------------------------------------------
// 4. Display Labels — English (international)
// ----------------------------------------------------------------------------

/**
 * English label — international gallery operations.
 *
 * STEP 96 multilingual projection 답습 — KR/EN 동시 정착.
 */
export const ARTWORK_REGISTRATION_STATUS_LABEL_EN: Record<
  ArtworkRegistrationStatus,
  string
> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending Review",
  INQUIRY_ACTIVE: "Inquiry Active",
  DEAL_IN_PROGRESS: "Deal In Progress",
  CONTRACT_PENDING: "Contract Pending",
  AWAITING_PAYMENT: "Awaiting Payment",
  PAID: "Paid",
  PREPARING_CURATION: "Preparing Curation",
  READY_FOR_EXHIBITION: "Ready For Exhibition",
  ARCHIVED: "Archived",
};

// ----------------------------------------------------------------------------
// 5. Type Guard — external input validation
// ----------------------------------------------------------------------------

/**
 * 외부 input (URL / persisted state / form / etc.) 진입 시 안전 검증.
 *
 * 사용 예:
 *   if (isArtworkRegistrationStatus(rawValue)) {
 *     // narrowed to ArtworkRegistrationStatus
 *   }
 */
export const isArtworkRegistrationStatus = (
  value: unknown,
): value is ArtworkRegistrationStatus =>
  typeof value === "string" &&
  (ARTWORK_REGISTRATION_STATUSES as readonly string[]).includes(value);

// ----------------------------------------------------------------------------
// 6. Ordering Helper — pure progression
// ----------------------------------------------------------------------------

/**
 * 다음 progression state 반환. Terminal state (`ARCHIVED`) 는 `null` 반환.
 *
 * 주의: 본 helper 는 *순서 query* 만 — actual transition validation
 *      (RBAC / business rule / state guard) 은 STEP 117+ 영역.
 *
 * Pure — side effect 0건, 동일 input → 동일 output 보장.
 */
export const nextRegistrationStatus = (
  current: ArtworkRegistrationStatus,
): ArtworkRegistrationStatus | null => {
  const idx = ARTWORK_REGISTRATION_STATUSES.indexOf(current);
  // -1 cannot happen if `current` is typed correctly, but defensive return.
  if (idx < 0) return null;
  // Terminal — last index
  if (idx >= ARTWORK_REGISTRATION_STATUSES.length - 1) return null;
  return ARTWORK_REGISTRATION_STATUSES[idx + 1];
};
