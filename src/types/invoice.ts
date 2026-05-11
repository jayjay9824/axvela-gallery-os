// ============================================================================
// Invoice — first Document born from a Transaction (rule_4, rule_11).
// One Invoice belongs to one Transaction. Auto-created (DRAFT) at INQUIRY → DEAL.
//
// Money-flow separation (rule_3): Invoice is a *charge document*, not a
// payment. Status PAID is flipped by registerPayment() (STEP 7 — Payment).
//
// FX lock (rule_20):
//  - `amount` and `currency` are snapshotted from the Transaction at issuance.
//  - STEP 32: at `sendInvoice` (DRAFT → SENT/LOCKED), if currency !== KRW,
//    `fxSnapshot` records the rate used for KRW conversion at lock time.
//    Each version captures its own snapshot — createInvoiceVersion produces a
//    fresh DRAFT without inherited FX (new version = new lock = new snapshot).
//
// Document trust layer (rule_4 — STEP 7 LOCK + Versioning):
//  - DRAFT  → editable
//  - SENT   → LOCKED (edits forbidden; create new version instead)
//  - PAID   → LOCK retained
// Locked documents are forked via createInvoiceVersion() — the new version
// is a new Invoice (own id) with version+1 and parentInvoiceId pointing to
// the previous version. The chain is immutable history.
// ============================================================================

import type { Currency } from "./transaction";
import type { FXRate } from "./fx";

/**
 * Invoice document lifecycle.
 * - DRAFT  초안       — auto-generated, editable, NOT locked
 * - SENT   발송 완료    — committed to the buyer, LOCKED (rule_4)
 * - PAID   결제 완료    — flipped by registerPayment(), LOCKED (rule_4)
 */
export type InvoiceStatus = "DRAFT" | "SENT" | "PAID";

export interface Invoice {
  id: string;
  transactionId: string;
  /** Snapshotted from Transaction.agreedPrice at issuance — FX lock per rule_20. */
  amount: number;
  /** Snapshotted from Transaction.currency at issuance. */
  currency: Currency;
  status: InvoiceStatus;
  /** ISO datetime the DRAFT was created. */
  issuedAt: string;
  /** ISO datetime the invoice was SENT. Filled on sendInvoice(). */
  sentAt?: string;
  /** ISO datetime the invoice was marked PAID. Filled by registerPayment(). */
  paidAt?: string;

  // ── Document trust layer (rule_4 — STEP 7 LOCK + Versioning) ─────────────
  /** Version number within the parent chain. v1 = original. */
  version: number;
  /** Predecessor invoice in the version chain. null for v1. */
  parentInvoiceId: string | null;
  /** ISO datetime when the document was locked. null while DRAFT. */
  lockedAt: string | null;
  /** True iff the document is immutable. Set when SENT or PAID. */
  isLocked: boolean;

  // ── FX lock (rule_20 — STEP 32 Invoice FX Lock Wiring) ───────────────────
  /**
   * 인보이스 lock 시점에 capture된 환율 snapshot. invoice.currency가 KRW가
   * 아닐 때만 채워짐. 한 번 lock되면 이후 환율이 변동해도 이 snapshot은 변하지
   * 않음 — Settlement / Tax / Audit가 같은 환율 기준 사용 가능.
   *
   * KRW invoice는 undefined (갤러리 base currency, 변환 불필요).
   * createFXSnapshot이 unknown pair 등으로 null 반환 시에도 undefined 유지.
   */
  fxSnapshot?: FXRate;
  /** fxSnapshot.baseCurrency의 explicit duplicate. 쿼리 편의 + JSON 직관. */
  fxBaseCurrency?: Currency;
  /** fxSnapshot.quoteCurrency의 explicit duplicate. v1 사실상 항상 "KRW". */
  fxQuoteCurrency?: Currency;

  // ── Document Lifecycle Clarity STEP — revision reason ────────────────────
  /**
   * 새 버전 생성 시 옵셔널 *수정 사유*. 운영자가 "왜 이 버전이 새로 생성되었는지"
   * timeline + version history에서 즉시 인지할 수 있도록.
   *
   * 예: "가격 수정" / "배송 주소 정정" / "작품 정보 수정"
   *
   * **persistence**: 옵셔널 필드 추가 — v1 호환 (기존 데이터 영향 0).
   * `validateV1`은 슬라이스 *존재*만 검증하므로 본 필드 추가는 schema breaking
   * change 0건. parent invoice의 revisionReason은 의미 없음 (자식 생성 시점의
   * 사유) — v1 (chain head)는 항상 undefined.
   *
   * **Approval Workflow 정책 무관**: 본 필드는 approval chain과 별개 — 단순
   * 운영 메모. STEP 101+ 활성 시 별도 ApprovalAction.note로 분리.
   */
  revisionReason?: string;

  // ── STEP 86 — Document Trust Metadata 정착 슬롯 ────────────────────────
  // 본 3개 필드는 모두 *옵셔널 / 미래-prep* — 기존 데이터 영향 0, validateV1
  // 무영향. helper `deriveInvoiceTrust(invoice, ctx)`가 본 필드 + 기존
  // `issuedAt` / `lockedAt` / 기타 fields를 합쳐 공통 `DocumentTrustMetadata`
  // view로 projection.

  /**
   * Invoice record를 시스템에 *create* 한 actor label. 기존 데이터 호환:
   * undefined → helper fallback ("AXVELA OS"). 미래 STEP에서 명시적 actor
   * 기록 시 본 슬롯 채움.
   *
   * 예: "AXVELA OS" / "직원 · 김민수" / "AXVELA AI" (rule_5 AI-Human Loop —
   * AI 초안 자동 생성 시).
   *
   * **Approval Workflow 무관**: 본 필드는 *creation actor*. STEP 101+에서의
   * reviewer / approver는 별도 ApprovalAction chain.
   */
  generatedBy?: string;

  /**
   * Invoice를 LOCK한 actor label. 기존 데이터 호환: undefined +
   * lockedAt !== null 시 helper fallback ("AXVELA OS"). 미래 STEP 101+ 활성
   * 시 ApprovalAction.grantedBy 같은 reviewer 정보가 본 슬롯에 사출.
   */
  lockedBy?: string;

  /**
   * 본 record의 origin 컨텍스트. "auto" (자동 흐름 trigger 생성, 기본 가정) /
   * "manual" (운영자 직접 생성) / "imported" (백업 import 등 외부에서 들어옴).
   *
   * 기존 데이터 호환: undefined → helper fallback ("auto" 가정). 미래
   * STEP 91 (Accountant Export)에서 본 슬롯 명시 채움 — record origin 추적.
   */
  sourceContext?: "manual" | "auto" | "imported";

  // ── STEP 127 Phase 2 — Invoice Kind Foundation (Optional Slice 8회째) ──
  /**
   * Invoice 의 *문서 분류 dimension*. status (DRAFT/SENT/PAID) 와 직교 —
   * 두 dimension 은 의미 / lifecycle 모두 별개.
   *
   * - `"pre"`  pro-forma / 예비 인보이스 — buyer 안내용 *informational charge
   *           document*. **결제 대상 아님** → registerPayment 불가, settlement
   *           trigger 발생 금지 (rule_3 Money Flow Separation).
   * - `"final"` 결제용 정식 인보이스 — registerPayment 대상, settlement
   *           trigger 발생, fiscal 집계 포함. **기존 모든 invoice 의 의미** (거래
   *           invoice 가 default).
   *
   * **persistence v1 호환**: 옵셔널 슬롯 — 기존 데이터 (Phase 1 ~ STEP 126
   * 까지) 모두 undefined 상태 그대로 보존. validateV1 (`r.invoices` 가
   * array 인지만 검증) 무변경, SCHEMA_VERSION "v1" 변경 0. Optional Slice
   * 패턴 8 회째 답습 (STEP 87/89 + 113~119/116/118 + 117 + 본 STEP 127).
   *
   * **fallback 정책**: 미정의 시 `getInvoiceKind` helper 가 `"final"` 반환
   * — 기존 모든 invoice 의 의미 그대로 보존 (거래 invoice = default).
   * Helper 단일 derivation point — UI / store guard / fiscal filter 모두
   * 본 helper 만 호출 (STEP 128 활성 시점).
   *
   * **STEP 127 Phase 2 scope 한정**: type slot + helper 정착만. UI 진입 /
   * registerPayment guard / fiscal filter / send button label 분기 / PRO
   * FORMA watermark 모두 STEP 128 (out of scope).
   *
   * **Approval Workflow 무관**: 본 필드는 *문서 분류* dimension. STEP 101+
   * 활성 시 ApprovalAction chain 과 별도.
   */
  invoiceKind?: "pre" | "final";
}

