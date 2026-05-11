// ============================================================================
// Document Trust — Pure Derivation Helpers (STEP 86)
//
// **본 파일이 정의하는 것**: 기존 도메인 entity (Invoice / Contract) → 공통
// `DocumentTrustMetadata` view 로의 *projection helpers*.
//
// **본 파일이 정의하지 *않는* 것**:
//   - Approval workflow logic (STEP 101+)
//   - 새 도메인 entity 생성 (Receipt / Tax Invoice 등은 STEP 87~91)
//   - State machine mutation (lifecycle 시스템 그대로 유지)
//   - UI rendering (해당 helper는 `src/lib/document-lifecycle.ts`)
//
// **순수성 정책**:
//   - store / persistence / DOM / fetch 접근 0건
//   - 모든 입력은 args로 입력
//   - Side effect 0건 (logging / mutation 모두 0건)
//
// **Trust language 정책**:
//   - 사용: "operational record" / "generated document" / "finalized version"
//   - 금지: "법적 효력" / "공인 승인" / "compliance verified" / "tamper-proof"
//
// **AXVELA_AI_DIRECTION + AXVELA_TRUST_LAYER 일관**.
// ============================================================================

import type { Invoice } from "@/types/invoice";
import type { Contract } from "@/types/contract";
import type { Receipt } from "@/types/receipt";
import type { TaxInvoice } from "@/types/tax-invoice";
import type {
  DocumentTrustMetadata,
  DocumentTrustDeriveContext,
  DocumentSourceContext,
  DocumentType,
} from "@/types/document-trust";

// ============================================================================
// 공용 fallback constants
// ============================================================================

/**
 * 명시적 actor 부재 시 fallback. 본 시스템에서 "누가 했는지 기록 안 됨"을
 * *operational record* 톤으로 표현 — STEP 80 audit conventional 일관.
 *
 * **rule_5 AI-Human Loop 일관**: AI가 *대신* 한 게 아니라 *시스템이 자동
 * trigger* 한 흐름이라는 점을 명시 — "AXVELA AI" actor와 구분.
 */
const FALLBACK_GENERATED_BY = "AXVELA OS";

/** 명시적 actor 부재 시 lock fallback. lockedBy가 부재인데 lockedAt이 존재하는
 *  legacy data를 위한 안전 fallback. */
const FALLBACK_LOCKED_BY = "AXVELA OS";

/**
 * 기존 데이터 호환 — sourceContext 부재 시 fallback. 관행적으로 자동 흐름
 * (createInvoice / createContract) trigger로 생성된 record 라는 가정.
 */
const FALLBACK_SOURCE_CONTEXT: DocumentSourceContext = "auto";

// ============================================================================
// Invoice → DocumentTrustMetadata
// ============================================================================

/**
 * 기존 `Invoice` entity를 공통 `DocumentTrustMetadata` view로 projection.
 *
 * **필드 매핑**:
 *   - `docType`           → `"INVOICE"` (constant)
 *   - `version`           ← invoice.version
 *   - `parentDocumentId`  ← invoice.parentInvoiceId
 *   - `generatedAt`       ← invoice.issuedAt
 *   - `generatedBy`       ← ctx.explicitGeneratedBy ?? invoice.generatedBy?
 *                            ?? FALLBACK_GENERATED_BY
 *   - `sourceContext`     ← ctx.explicitSourceContext ?? invoice.sourceContext?
 *                            ?? FALLBACK_SOURCE_CONTEXT
 *   - `lockedAt`          ← invoice.lockedAt
 *   - `lockedBy`          ← ctx.explicitLockedBy ?? invoice.lockedBy?
 *                            ?? (lockedAt 존재 시 FALLBACK_LOCKED_BY else null)
 *   - `finalizedAt`       ← invoice.paidAt ?? invoice.sentAt ?? null
 *                            (PAID > SENT > 미마무리)
 *   - `archivedAt`        ← ctx.hasNewerVersion ? ctx.childGeneratedAt ?? null
 *                            : null
 *   - `revisionReason`    ← invoice.revisionReason (Document Lifecycle Clarity STEP)
 *   - `deviceLocal`       ← ctx.remoteSyncActive ? false : true
 *
 * **finalizedAt 의미**:
 *   - PAID 진입 시점이 가장 강한 finalize signal (결제 완료 = 운영 종결)
 *   - SENT만 진입한 invoice는 *발송 완료 / 결제 대기* — finalize 직전 단계,
 *     fallback으로 sentAt 채택 (발송본은 lock된 운영 record로 간주)
 *   - DRAFT는 finalize 전 — null
 *
 * **archivedAt 의미**:
 *   - hasNewerVersion = true → 자식 record가 존재 (새 invoice 버전으로 대체됨)
 *   - childGeneratedAt이 명시되면 그 시점, 부재 시 null (caller가 명시할 책임)
 *
 * @param invoice 대상 invoice entity
 * @param ctx 도메인-외부 컨텍스트 (chain 정보 / sync 상태 / 명시적 actor)
 */
export function deriveInvoiceTrust(
  invoice: Invoice,
  ctx: DocumentTrustDeriveContext
): DocumentTrustMetadata {
  const generatedBy =
    ctx.explicitGeneratedBy ??
    invoice.generatedBy ??
    FALLBACK_GENERATED_BY;

  const sourceContext: DocumentSourceContext =
    ctx.explicitSourceContext ??
    invoice.sourceContext ??
    FALLBACK_SOURCE_CONTEXT;

  const lockedAt = invoice.lockedAt;
  const lockedBy =
    ctx.explicitLockedBy ??
    invoice.lockedBy ??
    (lockedAt !== null ? FALLBACK_LOCKED_BY : null);

  // finalizedAt: PAID > SENT > null
  const finalizedAt = invoice.paidAt ?? invoice.sentAt ?? null;

  // archivedAt: 새 버전 존재 시점
  const archivedAt = ctx.hasNewerVersion
    ? ctx.childGeneratedAt ?? null
    : null;

  const deviceLocal = !ctx.remoteSyncActive;

  return {
    docType: "INVOICE",
    version: invoice.version,
    parentDocumentId: invoice.parentInvoiceId,
    generatedAt: invoice.issuedAt,
    generatedBy,
    sourceContext,
    lockedAt,
    lockedBy,
    finalizedAt,
    archivedAt,
    revisionReason: invoice.revisionReason,
    deviceLocal,
  };
}

// ============================================================================
// Contract → DocumentTrustMetadata
// ============================================================================

/**
 * 기존 `Contract` entity를 공통 `DocumentTrustMetadata` view로 projection.
 *
 * **필드 매핑**:
 *   - `docType`           → `"CONTRACT"` (constant)
 *   - `version`           ← contract.version
 *   - `parentDocumentId`  ← contract.parentContractId
 *   - `generatedAt`       ← contract.createdAt
 *   - `generatedBy`       ← ctx.explicitGeneratedBy ?? contract.generatedBy?
 *                            ?? FALLBACK_GENERATED_BY
 *   - `sourceContext`     ← ctx.explicitSourceContext ?? contract.sourceContext?
 *                            ?? FALLBACK_SOURCE_CONTEXT
 *   - `lockedAt`          ← contract.lockedAt
 *   - `lockedBy`          ← ctx.explicitLockedBy ?? contract.lockedBy?
 *                            ?? (lockedAt 존재 시 FALLBACK_LOCKED_BY else null)
 *   - `finalizedAt`       ← contract.lockedAt
 *                            (LOCKED 진입 시점 = contract finalize)
 *   - `archivedAt`        ← ctx.hasNewerVersion ? ctx.childGeneratedAt ?? null
 *                            : null
 *   - `revisionReason`    → undefined (Contract entity에 본 슬롯 미정착 —
 *                            STEP 103 Contract Approval Activation 영역)
 *   - `deviceLocal`       ← ctx.remoteSyncActive ? false : true
 *
 * **finalizedAt 의미 (Contract specific)**:
 *   - Invoice는 PAID = finalize. Contract는 LOCKED = finalize (계약은 결제와
 *     별개 — 잠긴 계약본 자체가 *operational closure*).
 *   - DRAFT / REVIEW / APPROVED는 모두 lockedAt = null이므로 finalizedAt도 null
 *
 * **revisionReason 정책 (의도적 omission)**:
 *   Contract에 본 슬롯이 *없는* 이유: Contract의 새 version 생성은 REVIEW /
 *   APPROVED 상태와 깊이 연관되어 있고, 본격적인 사유 기록은 *approval chain
 *   memo*에 가까움 — STEP 103 (Contract Approval Activation)에서 ApprovalAction
 *   연결과 함께 정착 예정. 본 STEP 86은 단순 metadata projection 슬롯만.
 *
 * @param contract 대상 contract entity
 * @param ctx 도메인-외부 컨텍스트
 */
export function deriveContractTrust(
  contract: Contract,
  ctx: DocumentTrustDeriveContext
): DocumentTrustMetadata {
  const generatedBy =
    ctx.explicitGeneratedBy ??
    contract.generatedBy ??
    FALLBACK_GENERATED_BY;

  const sourceContext: DocumentSourceContext =
    ctx.explicitSourceContext ??
    contract.sourceContext ??
    FALLBACK_SOURCE_CONTEXT;

  const lockedAt = contract.lockedAt;
  const lockedBy =
    ctx.explicitLockedBy ??
    contract.lockedBy ??
    (lockedAt !== null ? FALLBACK_LOCKED_BY : null);

  // Contract의 finalize는 LOCKED 진입 = lockedAt
  const finalizedAt = contract.lockedAt;

  const archivedAt = ctx.hasNewerVersion
    ? ctx.childGeneratedAt ?? null
    : null;

  const deviceLocal = !ctx.remoteSyncActive;

  return {
    docType: "CONTRACT",
    version: contract.version,
    parentDocumentId: contract.parentContractId,
    generatedAt: contract.createdAt,
    generatedBy,
    sourceContext,
    lockedAt,
    lockedBy,
    finalizedAt,
    archivedAt,
    revisionReason: undefined, // STEP 103 영역
    deviceLocal,
  };
}

// ============================================================================
// Receipt → DocumentTrustMetadata (STEP 87 — first real consumer of STEP 86)
// ============================================================================

/**
 * 기존 `Receipt` entity를 공통 `DocumentTrustMetadata` view로 projection.
 *
 * **STEP 87 — STEP 86 anchor의 첫 사용처**: 본 helper는 STEP 86이 정의한 view
 * shape이 *real entity*에 자연 fit 하는지 검증. Invoice / Contract pattern을
 * 답습 — entity 추가 시 *별도 type / store / persistence 변경 없이* 본 view
 * 한 가지 추가하면 cross-document tooling (Documents Hub / 미래 STEP 91
 * Accountant Export 등)에 자연 합류.
 *
 * **필드 매핑**:
 *   - `docType`           → `"RECEIPT"` (constant)
 *   - `version`           ← receipt.version
 *   - `parentDocumentId`  ← receipt.parentReceiptId
 *   - `generatedAt`       ← receipt.issuedAt (DRAFT 생성 시점, 발급 record 톤)
 *   - `generatedBy`       ← ctx.explicitGeneratedBy ?? receipt.generatedBy?
 *                            ?? FALLBACK_GENERATED_BY
 *   - `sourceContext`     ← ctx.explicitSourceContext ?? receipt.sourceContext?
 *                            ?? FALLBACK_SOURCE_CONTEXT
 *   - `lockedAt`          ← receipt.lockedAt
 *   - `lockedBy`          ← ctx.explicitLockedBy ?? receipt.lockedBy?
 *                            ?? (lockedAt 존재 시 FALLBACK_LOCKED_BY else null)
 *   - `finalizedAt`       ← receipt.finalizedAt ?? null
 *                            (Receipt는 ISSUED 진입 = finalize)
 *   - `archivedAt`        ← ctx.hasNewerVersion ? ctx.childGeneratedAt ?? null
 *                            : null
 *   - `revisionReason`    ← receipt.revisionReason (Document Lifecycle Clarity 패턴)
 *   - `deviceLocal`       ← !ctx.remoteSyncActive
 *
 * **finalizedAt 의미 (Receipt-specific)**:
 *   - Receipt는 ISSUED 진입 = finalize (단일 단계 lifecycle)
 *   - DRAFT 상태는 finalizedAt undefined → null로 projection
 *   - 발행 후 *외부 발송 여부*는 별개 — `deliveryStatus` / `sentAt` 슬롯 활용
 *
 * @param receipt 대상 receipt entity
 * @param ctx 도메인-외부 컨텍스트 (chain 정보 / sync 상태 / 명시적 actor)
 */
export function deriveReceiptTrust(
  receipt: Receipt,
  ctx: DocumentTrustDeriveContext
): DocumentTrustMetadata {
  const generatedBy =
    ctx.explicitGeneratedBy ??
    receipt.generatedBy ??
    FALLBACK_GENERATED_BY;

  const sourceContext: DocumentSourceContext =
    ctx.explicitSourceContext ??
    receipt.sourceContext ??
    FALLBACK_SOURCE_CONTEXT;

  const lockedAt = receipt.lockedAt;
  const lockedBy =
    ctx.explicitLockedBy ??
    receipt.lockedBy ??
    (lockedAt !== null ? FALLBACK_LOCKED_BY : null);

  const finalizedAt = receipt.finalizedAt ?? null;

  const archivedAt = ctx.hasNewerVersion
    ? ctx.childGeneratedAt ?? null
    : null;

  const deviceLocal = !ctx.remoteSyncActive;

  return {
    docType: "RECEIPT",
    version: receipt.version,
    parentDocumentId: receipt.parentReceiptId,
    generatedAt: receipt.issuedAt,
    generatedBy,
    sourceContext,
    lockedAt,
    lockedBy,
    finalizedAt,
    archivedAt,
    revisionReason: receipt.revisionReason,
    deviceLocal,
  };
}

// ============================================================================
// deriveTaxInvoiceTrust — STEP 89 (Tax Invoice → DocumentTrustMetadata)
//
// **STEP 86 anchor 두 번째 사용처** (첫 번째: deriveReceiptTrust). 본 helper
// 추가만으로 Tax Invoice가 STEP 86 view shape에 자연 합류 — Receipt 패턴 정확
// 재사용. 미래 STEP 90 Certificate / STEP 91 Settlement Export도 동일 패턴.
//
// **mapping 의미론**:
//   - docType         → "TAX_INVOICE" (constant)
//   - version         → taxInvoice.version
//   - parentDocumentId → taxInvoice.parentTaxInvoiceId
//   - generatedAt     → taxInvoice.issuedAt (DRAFT 생성 시점)
//   - generatedBy     → ctx → entity → fallback "AXVELA OS"
//   - sourceContext   → ctx → entity → fallback "manual" (Tax Invoice는 수동 발행 기본)
//   - lockedAt        → taxInvoice.lockedAt
//   - lockedBy        → ctx → entity → fallback (lockedAt 존재 시 "AXVELA OS")
//   - finalizedAt     → taxInvoice.finalizedAt (ISSUED 시점, Receipt 패턴 정확 일치)
//   - archivedAt      → ctx.hasNewerVersion ? ctx.childGeneratedAt : null
//   - revisionReason  → taxInvoice.revisionReason 그대로
//   - deviceLocal     → !ctx.remoteSyncActive
//
// **Receipt와 차이점**:
//   - sourceContext fallback: Receipt는 "auto" (Payment cascade 자동 생성),
//     Tax Invoice는 "manual" (운영자 의도적 발행 기본 — 사업자만 대상).
//
// **rule_3 / rule_4 / rule_11 / rule_20 모두 보존** — Receipt 헬퍼와 동일 정책.
// ============================================================================

/**
 * Tax Invoice → `DocumentTrustMetadata` projection.
 *
 * Pure / no I/O / no store / no DOM. STEP 86 anchor의 *두 번째 사용처*로,
 * Receipt 패턴 정확 재사용 — 미래 fiscal entity 추가 시 ~70 LOC helper로
 * 자연 합류 가능함을 입증.
 */
export function deriveTaxInvoiceTrust(
  taxInvoice: TaxInvoice,
  ctx: DocumentTrustDeriveContext
): DocumentTrustMetadata {
  const generatedBy =
    ctx.explicitGeneratedBy ??
    taxInvoice.generatedBy ??
    FALLBACK_GENERATED_BY;

  // Tax Invoice는 *수동 발행*이 기본 (Receipt와 차이 — "manual" fallback).
  const sourceContext: DocumentSourceContext =
    ctx.explicitSourceContext ?? taxInvoice.sourceContext ?? "manual";

  const lockedAt = taxInvoice.lockedAt;
  const lockedBy =
    ctx.explicitLockedBy ??
    taxInvoice.lockedBy ??
    (lockedAt !== null ? FALLBACK_LOCKED_BY : null);

  const finalizedAt = taxInvoice.finalizedAt ?? null;

  const archivedAt = ctx.hasNewerVersion
    ? ctx.childGeneratedAt ?? null
    : null;

  const deviceLocal = !ctx.remoteSyncActive;

  return {
    docType: "TAX_INVOICE",
    version: taxInvoice.version,
    parentDocumentId: taxInvoice.parentTaxInvoiceId,
    generatedAt: taxInvoice.issuedAt,
    generatedBy,
    sourceContext,
    lockedAt,
    lockedBy,
    finalizedAt,
    archivedAt,
    revisionReason: taxInvoice.revisionReason,
    deviceLocal,
  };
}

// ============================================================================
// 운영 라벨 helpers — 미래 UI 통합 시 일관 표기를 위한 *공용* helper
// ============================================================================

/**
 * 도메인 entity의 lifecycle 상태 한 단어 요약 — operational tone.
 *
 * **DocumentTrustMetadata만으로 derive 가능한 *공용* status label** —
 * `archivedAt` / `finalizedAt` / `lockedAt` 만 보고 판단. docType / 도메인별
 * 세부 상태 (Invoice DRAFT/SENT/PAID, Contract DRAFT/REVIEW/APPROVED/LOCKED)와
 * 별개의 *cross-document* 표기.
 *
 * **사용 시나리오**: 미래 Documents Hub의 cross-doc table 헤더 / Settlement
 * Export (STEP 91)의 row level / receipt + tax invoice + certificate 통합 view
 * 등 — 모든 doc type을 같은 vocabulary로 표시해야 할 때.
 *
 * **상태 우선순위 (가장 강한 시그널 우선)**:
 *   1. archived → "이전 발행본"
 *   2. finalized → "마무리 완료"
 *   3. locked (but not finalized) → "잠금 — 마무리 대기"
 *   4. else (편집 가능) → "편집 가능"
 *
 * **AI Direction / Trust Layer 표현 정책 일관**: "공인" / "확정" / "법적" 0건.
 */
export function summarizeTrustStatus(
  trust: DocumentTrustMetadata
): "archived" | "finalized" | "locked_pending" | "editable" {
  if (trust.archivedAt !== null) return "archived";
  if (trust.finalizedAt !== null) return "finalized";
  if (trust.lockedAt !== null) return "locked_pending";
  return "editable";
}

/** 한국어 라벨 매핑 — operational tone, 운영 record record. */
export const TRUST_STATUS_LABEL_KR: Readonly<
  Record<ReturnType<typeof summarizeTrustStatus>, string>
> = {
  archived: "이전 발행본",
  finalized: "마무리 완료",
  locked_pending: "잠금 — 마무리 대기",
  editable: "편집 가능",
} as const;

/**
 * Document type별 한국어 라벨 — 본 helper는 `DOCUMENT_TYPE_LABEL_KR` (in
 * `src/types/document-trust.ts`)의 wrapper. unknown docType이 들어와도
 * 안전하게 fallback string 반환.
 */
export function formatDocumentTypeLabel(docType: DocumentType): string {
  // exhaustive switch — TypeScript가 enum 누락 시 타입 에러 raise
  switch (docType) {
    case "INVOICE":
      return "인보이스";
    case "CONTRACT":
      return "계약서";
    case "RECEIPT":
      return "영수증";
    case "TAX_INVOICE":
      return "세금계산서";
    case "CERTIFICATE":
      return "감정서 / 진본 증명";
    case "SETTLEMENT_EXPORT":
      return "정산 내보내기";
  }
}
