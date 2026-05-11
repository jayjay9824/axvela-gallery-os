// ============================================================================
// tax-invoice.ts — STEP 89 Tax Invoice Domain Entity
//
// **본 entity가 무엇인가**:
//   *전자세금계산서* 의 *운영 record* — Invoice (요청) → Receipt (확인) → Tax
//   Invoice (사업자용 세금계산서) 흐름의 마지막 fiscal document. *세무 시스템*
//   이 아니라 *운영 trust 위에 만들어지는 lightweight document*. STEP 86
//   `DocumentTrustMetadata` view shape에 자연 합류.
//
// **본 entity가 *아닌* 것** (사용자 spec 정조준):
//   - ERP 회계 module
//   - 국세청 자동 제출 (영구 out-of-scope)
//   - government tax filing
//   - automated VAT submission
//
// **AI Direction §1 / Trust Layer 정책 강화**:
//   - 사용: "세금계산서" / "사업자용 세금계산서" / "운영 record" / "발행 대기" /
//     "발행 완료" / "정산 준비"
//   - 금지: "공식 세무 효력 보장" / "국세청 발급 완료" / "법적 증빙 완료" /
//     "compliance verified" / "tax filing complete" / "tamper-proof"
//
// **rule_3 Money Flow Separation**:
//   Tax Invoice는 *문서*, *돈의 흐름이 아니다*. amount/vatAmount/totalAmount는
//   *기록*만 (별도 cross-domain 합산 0건 — STEP 88 fiscal aggregate 패턴 일관).
//
// **rule_4 Document Trust Layer**:
//   DRAFT → ISSUED LOCK + parentTaxInvoiceId chain + revisionReason 옵셔널 +
//   audit emit. ISSUED 후 직접 수정 금지 — `createTaxInvoiceVersion` fork만.
//
// **rule_11 Transaction Core**:
//   invoiceId 1:1 anchor — Tax Invoice는 Invoice에 종속. transactionId /
//   artworkId는 chain shortcut for drilldown. customerId 옵셔널 mirror.
// ============================================================================

import type { Currency } from "@/types/transaction";

// ============================================================================
// Status — Receipt 패턴 답습 (DRAFT/ISSUED 2-state, Invoice의 3-state와 차이)
// ============================================================================

/**
 * Tax Invoice 진행 상태.
 * - `DRAFT`  : 자동/수동 생성된 초안. 운영자가 amount/VAT/total/businessType/
 *              memo 자유 편집 가능. 미발행.
 * - `ISSUED` : 발행 완료. *LOCK* 상태로 진입 (rule_4). 모든 필드 read-only.
 *              정정 필요 시 `createTaxInvoiceVersion(parent, reason)` fork.
 */
export type TaxInvoiceStatus = "DRAFT" | "ISSUED";

export const TAX_INVOICE_STATUS_LABEL_KR: Readonly<
  Record<TaxInvoiceStatus, string>
> = {
  DRAFT: "발행 대기",
  ISSUED: "발행 완료",
} as const;

export const TAX_INVOICE_STATUS_COLOR: Readonly<
  Record<TaxInvoiceStatus, string>
> = {
  DRAFT: "ink-subtle",
  ISSUED: "ink",
} as const;

// ============================================================================
// Business type — Korean fiscal context (사용자 spec §3)
// ============================================================================

/**
 * 수신자 사업 유형. Korean fiscal context — 세금계산서 발행 가능 여부 자체가
 * 수신자 type에 따라 달라짐. 본 STEP에서는 *기록*만 (validation 없음).
 *
 * - `business`   : 사업자등록증 보유 법인/개인사업자. 세금계산서 정식 발급 가능.
 * - `individual` : 일반 개인. 세금계산서 *원래 부적절* — 운영자가 의도적
 *                  발행 시에만 (예: 세무 관리 목적의 내부 record).
 * - `tax_exempt` : 부가세 면세 사업자. VAT 0원 발행 가능.
 * - `other`      : 분류 외 (해외 / 기관 / 비영리 등).
 */
export type TaxInvoiceBusinessType =
  | "business"
  | "individual"
  | "tax_exempt"
  | "other";

export const TAX_INVOICE_BUSINESS_TYPE_LABEL_KR: Readonly<
  Record<TaxInvoiceBusinessType, string>
> = {
  business: "사업자",
  individual: "개인",
  tax_exempt: "면세 사업자",
  other: "기타",
} as const;

// ============================================================================
// Delivery / Send — 사용자 spec §7 future-ready slots
// ============================================================================

/**
 * 운영자 발송 흐름 상태. Receipt와 동일 패턴 (STEP 87) — 실제 외부 API 발송
 * 0건, 운영 메모 only.
 */
export type TaxInvoiceDeliveryStatus =
  | "not_prepared"
  | "prepared"
  | "pending_external";

export const TAX_INVOICE_DELIVERY_STATUS_LABEL_KR: Readonly<
  Record<TaxInvoiceDeliveryStatus, string>
> = {
  not_prepared: "발송 준비 전",
  prepared: "발송 준비 완료",
  pending_external: "외부 발송 대기",
} as const;

/**
 * 향후 외부 발송 채널 슬롯 (사용자 spec §7).
 * 본 STEP에서는 enum만 정의 — 실제 발송 0건.
 */
export type TaxInvoiceSendChannel =
  | "email"
  | "manual"
  | "external";

export const TAX_INVOICE_SEND_CHANNEL_LABEL_KR: Readonly<
  Record<TaxInvoiceSendChannel, string>
> = {
  email: "이메일",
  manual: "수동 전달",
  external: "외부 시스템 연동",
} as const;

// ============================================================================
// External Sync — 사용자 spec §6 future-ready (회계 SaaS / 세무 software API)
// ============================================================================

/**
 * 외부 회계/세무 SaaS 연동 상태 (사용자 spec §6 future API ready).
 * 본 STEP에서는 항상 `not_synced` — 외부 API 연동 0건.
 */
export type TaxInvoiceExternalSyncStatus =
  | "not_synced"
  | "pending"
  | "synced"
  | "failed";

export const TAX_INVOICE_EXTERNAL_SYNC_STATUS_LABEL_KR: Readonly<
  Record<TaxInvoiceExternalSyncStatus, string>
> = {
  not_synced: "동기화 안 됨",
  pending: "동기화 대기",
  synced: "동기화 완료",
  failed: "동기화 실패",
} as const;

// ============================================================================
// TaxInvoice entity
// ============================================================================

/**
 * Tax Invoice (전자세금계산서 운영 record) entity.
 *
 * **lifecycle** (rule_4 Document Trust Layer):
 *   DRAFT (편집 가능)
 *     → issueTaxInvoice(id)
 *   ISSUED + LOCK (immutable, finalizedAt 기록)
 *     → createTaxInvoiceVersion(parentId, reason?) fork
 *   새 DRAFT (parentTaxInvoiceId chain)
 *
 * **money flow** (rule_3):
 *   - amount      : 공급가액 (taxable supply, VAT 제외)
 *   - vatAmount   : 부가세 (VAT)
 *   - totalAmount : 총액 = amount + vatAmount (rule_3 — *amount + vat 합산은
 *                   본 entity 안 기록 only, 다른 도메인 합산 0건*)
 *
 * **rule_20 FX Lock**:
 *   currency는 linked Invoice의 currency mirror. KRW 환산 0건.
 *
 * **rule_11 Transaction Core**:
 *   invoiceId 1:1 anchor. transactionId / artworkId는 chain shortcut
 *   (drilldown / Detail Panel 진입 효율).
 */
export interface TaxInvoice {
  /** Unique id — `tax-inv-{ulid}` 패턴 권장. */
  id: string;

  // ── Linkage (rule_3 + rule_11) ───────────────────────────────────────────
  /** Linked Invoice — 1:1 anchor. Tax Invoice는 Invoice에 종속. */
  invoiceId: string;
  /** Linked Receipt — 옵셔널. 영수증 먼저 발행한 경우 link. */
  receiptId?: string;
  /** Transaction shortcut (rule_11 chain navigation). */
  transactionId: string;
  /** Artwork shortcut (rule_11 chain navigation). */
  artworkId: string;
  /** Customer — Invoice의 customerId mirror. 옵셔널 (Invoice에 customerId 부재 가능). */
  customerId?: string;

  // ── Amount (Korean fiscal context) ───────────────────────────────────────
  /** 공급가액 (taxable supply amount, VAT 제외). */
  amount: number;
  /** 부가세 (VAT). 사업자등록 일반 10%, 면세 0원. 운영자 직접 편집 가능 (DRAFT). */
  vatAmount: number;
  /** 총액 = amount + vatAmount. 운영자가 합계 직접 입력 / 자동 계산 모두 허용. */
  totalAmount: number;
  /** Currency — linked Invoice mirror (rule_20). */
  currency: Currency;

  // ── Operational metadata ────────────────────────────────────────────────
  status: TaxInvoiceStatus;
  /** 수신자 사업 유형 — Korean fiscal context (사용자 spec §3). */
  businessType: TaxInvoiceBusinessType;
  /** 운영 메모 — 운영자 자유 입력. */
  memo?: string;

  // ── Lifecycle (rule_4 Document Trust Layer) ─────────────────────────────
  /** ISO datetime — 본 record가 생성된 시점 (DRAFT). */
  issuedAt: string;
  /** ISO datetime — ISSUED 진입 시점. v1: lockedAt과 동일 (Receipt 패턴 답습). */
  finalizedAt?: string;
  version: number;
  parentTaxInvoiceId: string | null;
  lockedAt: string | null;
  isLocked: boolean;
  /** 새 version 생성 시 사유 (rule_4 + Document Lifecycle Clarity). */
  revisionReason?: string;

  // ── STEP 86 Document Trust slots ────────────────────────────────────────
  /** Tax Invoice record를 *create*한 actor label. fallback "AXVELA OS". */
  generatedBy?: string;
  /** LOCK 수행 actor. lockedAt 존재 + lockedBy 부재 시 fallback. */
  lockedBy?: string;
  /** Record origin context. undefined → "manual" 가정 (수동 발행 기본). */
  sourceContext?: "manual" | "auto" | "imported";

  // ── STEP 87 Print/Send 패턴 (사용자 spec §7) ────────────────────────────
  /** ISO datetime — 마지막 인쇄 시점. 운영 record only. */
  lastPrintedAt?: string;
  /** ISO datetime — 마지막 PDF 저장 시점. */
  lastPdfExportedAt?: string;
  /** 운영자 발송 흐름 상태. */
  deliveryStatus?: TaxInvoiceDeliveryStatus;
  /** ISO datetime — 발송 준비 시점. */
  preparedForSendAt?: string;
  /** 발송 준비 actor. */
  preparedForSendBy?: string;
  /** 수신자 contact (이메일 / 전화 / 식별 메모). */
  recipientContact?: string;
  /** 실제 외부 발송 시점 (본 STEP에서는 채워지지 않음 / future-ready). */
  sentAt?: string;
  /** 실제 외부 발송 actor (본 STEP에서는 채워지지 않음). */
  sentBy?: string;
  /** 외부 발송 채널 (본 STEP에서는 채워지지 않음). */
  sentChannel?: TaxInvoiceSendChannel;

  // ── 외부 회계/세무 SaaS 연동 future-ready (사용자 spec §6) ─────────────
  /** 외부 SaaS 연동 상태. 본 STEP에서는 항상 "not_synced". */
  externalSyncStatus?: TaxInvoiceExternalSyncStatus;
  /** 외부 SaaS provider 식별자 (예: "Hometax" / "Bizmeka" / "Cashbee"). */
  externalProvider?: string;
  /** 외부 SaaS reference id. */
  externalReferenceId?: string;
  /** ISO datetime — 외부 동기화 시점. */
  syncedAt?: string;
}

// ============================================================================
// Inputs
// ============================================================================

/**
 * createTaxInvoice 입력. linked Invoice id 필수, 그 외 옵셔널 (운영자가
 * detail drawer에서 편집).
 */
export interface TaxInvoiceCreateInput {
  invoiceId: string;
  /** 옵셔널 — receipt link (영수증 먼저 발행한 경우). */
  receiptId?: string;
  /** 옵셔널 — 기본값 "business" (세금계산서 자체가 사업자 대상). */
  businessType?: TaxInvoiceBusinessType;
  /** 옵셔널 — VAT 계산 기준. 기본 "vat_inclusive" (한국 갤러리 retail 표준). */
  vatBasis?: "vat_inclusive" | "vat_exclusive" | "tax_exempt";
  /** 옵셔널 — 메모. */
  memo?: string;
}

/**
 * prepareTaxInvoiceForSend 입력 — 외부 발송 *준비*만 (실제 발송 0건).
 */
export interface TaxInvoiceSendPrepareInput {
  taxInvoiceId: string;
  /** 옵셔널 — 수신자 contact 메모. */
  recipientContact?: string;
}
