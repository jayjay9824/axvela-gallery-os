// ============================================================================
// Contract — Document Chain의 핵심 (rule_4, rule_5, rule_11).
//
// Invoice와 동일한 LOCK + Versioning 패턴을 따르지만, 4-stage approval flow:
//   DRAFT → REVIEW → APPROVED → LOCKED
//
// AI-Human Loop (rule_5):
//   AI 초안 생성 (createContract)
//   → 인간 수정 (updateContract — DRAFT 상태에서만)
//   → 검토 요청 (submitContractForReview — DRAFT → REVIEW)
//   → 승인 (approveContract — REVIEW → APPROVED)
//   → 잠금 (lockContract — APPROVED → LOCKED, immutable)
//
// LOCK 이후 수정 필요 시 createContractVersion()으로 새 DRAFT 생성. 기존 버전은
// 영구 보존 (삭제 금지, rule_4). parentContractId로 chain 추적.
// ============================================================================

/**
 * Contract approval lifecycle.
 * - DRAFT     초안 — AI 생성 직후, 편집 가능
 * - REVIEW    검토 요청 — 담당자에게 제출됨, 편집 잠김
 * - APPROVED  승인 완료 — 검토자 승인, LOCK 대기
 * - LOCKED    잠금 — immutable, 수정은 새 버전 생성으로만 가능
 */
export type ContractStatus = "DRAFT" | "REVIEW" | "APPROVED" | "LOCKED";

export interface Contract {
  id: string;
  transactionId: string;
  /** Denormalized for direct lookup (rule_11 chain). */
  artworkId: string;

  /** Version number within the parent chain. v1 = original. */
  version: number;
  /** Predecessor contract in the version chain. null for v1. */
  parentContractId: string | null;

  /** Free-form contract body. AI-generated on create, human-editable in DRAFT. */
  content: string;

  status: ContractStatus;
  /** ISO datetime when status flipped to LOCKED. null until then. */
  lockedAt: string | null;

  // Audit
  createdAt: string;
  updatedAt: string;

  // ── STEP 86 — Document Trust Metadata 정착 슬롯 ────────────────────────
  // 본 3개 필드는 모두 *옵셔널 / 미래-prep* — 기존 데이터 영향 0, validateV1
  // 무영향. helper `deriveContractTrust(contract, ctx)`가 본 필드 + 기존
  // `createdAt` / `lockedAt` / `version` / `parentContractId`를 합쳐 공통
  // `DocumentTrustMetadata` view로 projection. **Approval Workflow 미구현**
  // (STEP 103 Contract Approval Activation 영역 — 본 STEP은 metadata 슬롯만).

  /**
   * Contract record를 시스템에 *create* 한 actor label. 기존 데이터 호환:
   * undefined → helper fallback ("AXVELA OS"). 미래 STEP 16 패턴과 일관 —
   * AI 자동 초안 생성 시 "AXVELA AI" actor 기록 가능.
   */
  generatedBy?: string;

  /**
   * Contract를 LOCK한 actor label. 기존 데이터 호환: undefined +
   * lockedAt !== null 시 helper fallback. STEP 103 시점에 ApprovalAction
   * .grantedBy를 본 슬롯에 사출 (LOCKED 진입 결정자 record).
   */
  lockedBy?: string;

  /**
   * 본 record의 origin 컨텍스트. "auto" / "manual" / "imported". 기존 데이터
   * 호환: undefined → helper fallback ("auto" 가정).
   */
  sourceContext?: "manual" | "auto" | "imported";
}
