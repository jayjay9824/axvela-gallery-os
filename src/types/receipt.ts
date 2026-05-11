// ============================================================================
// Receipt — Cash Receipt 도메인 entity (STEP 87, Phase 1 Fiscal Foundation 두 번째).
//
// **본 entity는 무엇인가**:
//   Payment confirm 시 자동 생성되는 *고객 전달용 영수증* (rule_4 Document
//   Trust Layer / rule_11 Transaction Core / rule_3 Money Flow Separation).
//   Invoice는 *charge document* (요청), Receipt는 *acknowledgement document*
//   (수령 확인) — 두 도큐는 별개 라이프사이클이며 별개 version chain.
//
// **본 entity가 *아닌* 것**:
//   - Tax Invoice (전자세금계산서) — STEP 89 영역 / 운영 참고 only / 외부 정부
//     시스템 자동 제출 영구 금지
//   - Settlement Receipt (작가 정산 영수) — STEP 90 영역
//   - Certificate of Authenticity — STEP 90 영역 (CERTIFICATE docType)
//   - Generic file upload — Receipt는 *generated*, *not uploaded* (rule_4)
//
// **Trust language 정책 (AXVELA_AI_DIRECTION + AXVELA_TRUST_LAYER 일관)**:
//   - 사용: "발급 기록" / "운영 참고 영수증" / "거래 확인용" / "고객 전달용" /
//     "발행 완료" / "발송 준비"
//   - 금지: "법적 증빙 보장" / "국세청 발급 완료" / "세무 신고 완료" /
//     "공식 세무 효력 보장" / "tamper-proof" / "compliance verified"
//
// **STEP 86 Document Trust Metadata 정착 슬롯**: 본 entity는 `generatedBy?` /
// `lockedBy?` / `sourceContext?` 옵셔널 필드 보유 — `deriveReceiptTrust(receipt,
// ctx)`가 본 슬롯 + 도메인별 필드를 합쳐 공통 `DocumentTrustMetadata` view로
// projection.
//
// **STEP 87 Send-Ready 정착 슬롯**: 고객 발송 준비 / future email/SMS API
// integration용 옵셔널 필드 — *실제 외부 API 연동 0건*. 본 STEP에서는 *상태
// 기록 + UI 진입점*만, 실제 발송은 운영자가 외부 도구로 직접 처리.
// ============================================================================

import type { Currency } from "./transaction";

/**
 * Receipt lifecycle.
 * - DRAFT   초안       — auto-generated when Payment registers, editable
 * - ISSUED  발행 완료    — finalized + LOCKED, ready for print/PDF/send
 *
 * **Invoice와의 의도적 차이**:
 *   Invoice는 DRAFT → SENT → PAID 3단계 (charge → commit → settle). Receipt는
 *   *수령 확인 도큐*이므로 ISSUED 자체가 finalize signal — separate "SENT" 상태
 *   불필요. 외부 발송 여부는 별도 `deliveryStatus?` 슬롯으로 추적.
 */
export type ReceiptStatus = "DRAFT" | "ISSUED";

/**
 * Send-ready 상태 — 운영자가 *고객에게 전달 준비*한 시점부터의 흐름.
 *
 * **본 enum은 *실제 발송 여부*가 아니라 *준비 흐름의 운영 상태*만 추적**:
 *   - "not_prepared"     준비 안됨 (default — receipt 발행 직후)
 *   - "prepared"         발송 준비 완료 — 운영자가 "고객 발송 준비" 클릭함
 *   - "pending_external" 외부 발송 연동 대기 — future email/SMS API 활성 시
 *
 * **실제 발송 자체는 STEP 87 영역 외**:
 *   - 운영자가 외부 도구 (이메일 / 메신저 / 인쇄 후 직접 전달)로 처리
 *   - 본 STEP은 *운영 메모* 수준만 — sent / 미발송 boolean 단정 아님
 *   - future external API 통합 시 `sentAt` / `sentChannel` / `externalDelivery*`
 *     슬롯이 채워짐 (STEP 87 본 영역 외 — 별도 STEP)
 */
export type ReceiptDeliveryStatus =
  | "not_prepared"
  | "prepared"
  | "pending_external";

export const RECEIPT_DELIVERY_STATUS_LABEL_KR: Readonly<
  Record<ReceiptDeliveryStatus, string>
> = {
  not_prepared: "준비 안됨",
  prepared: "발송 준비 완료",
  pending_external: "외부 발송 연동 대기",
} as const;

/**
 * 발송 채널 — future email/SMS API 통합 시 운영자가 *어떤 채널로 발송했는지*
 * 기록. 본 STEP은 슬롯만, 실제 routing 0건.
 *
 * - "email"     이메일 (future SMTP / SaaS provider)
 * - "sms"       SMS (future telecom provider)
 * - "manual"    운영자가 직접 인쇄/face-to-face 전달 — *운영 메모*용
 * - "external"  외부 시스템에 위임 (예: 메신저 봇 / 다른 갤러리 SaaS)
 */
export type ReceiptSendChannel = "email" | "sms" | "manual" | "external";

export const RECEIPT_SEND_CHANNEL_LABEL_KR: Readonly<
  Record<ReceiptSendChannel, string>
> = {
  email: "이메일",
  sms: "SMS",
  manual: "직접 전달",
  external: "외부 시스템",
} as const;

/**
 * Receipt 도메인 entity.
 *
 * **chain 구조 (rule_11 Transaction Core)**:
 *   Artwork → Transaction → Payment → **Receipt**
 *
 *   Receipt는 Payment에 1:1 종속 — 한 Payment가 여러 Receipt를 가질 수 있는
 *   유일한 시나리오는 *재발행 (new version)*. 그 경우 새 Receipt는 동일 paymentId
 *   참조 + parentReceiptId chain.
 *
 * **rule_4 Document Trust Layer 정합**:
 *   - DRAFT  → editable
 *   - ISSUED → LOCKED (수정 0건, 새 version 생성으로만 변경)
 *
 * **STEP 86 Document Trust Metadata 슬롯**:
 *   `generatedBy?` / `lockedBy?` / `sourceContext?` — `deriveReceiptTrust(receipt,
 *   ctx)`가 본 슬롯 + 기존 entity 필드를 공통 view로 projection.
 *
 * **STEP 87 Send-Ready 슬롯**:
 *   `deliveryStatus?` / `preparedForSend*` / `sentAt?` / `sentBy?` /
 *   `sentChannel?` / `recipientContact?` / `externalDelivery*` — 모두 옵셔널 /
 *   future-ready / 실제 외부 API 연동 0건.
 */
export interface Receipt {
  id: string;
  /** Payment 참조 (chain anchor — sourceContext의 anchor). */
  paymentId: string;
  /** Denormalized for direct lookup (rule_11 chain shortcut). */
  transactionId: string;
  /** Denormalized for direct lookup (rule_11 chain shortcut). */
  artworkId: string;

  /** Snapshotted from Payment.amount at issue time — FX lock 일관성 (rule_20). */
  amount: number;
  /** Snapshotted from Payment.currency at issue time. */
  currency: Currency;

  status: ReceiptStatus;
  /** ISO datetime the DRAFT was created. */
  issuedAt: string;
  /** ISO datetime the receipt was finalized (DRAFT → ISSUED). Filled on issueReceipt(). */
  finalizedAt?: string;

  // ── Document trust layer (rule_4 — STEP 7 LOCK + Versioning, Invoice 패턴 답습) ─
  /** Version number within the parent chain. v1 = original. */
  version: number;
  /** Predecessor receipt in the version chain. null for v1. */
  parentReceiptId: string | null;
  /** ISO datetime when the document was locked. null while DRAFT. */
  lockedAt: string | null;
  /** True iff the document is immutable. Set when ISSUED. */
  isLocked: boolean;

  // ── STEP 86 Document Trust Metadata 정착 슬롯 ────────────────────────────
  /** Receipt record를 시스템에 *create*한 actor label. helper fallback "AXVELA OS". */
  generatedBy?: string;
  /** Receipt를 LOCK (ISSUED 진입)한 actor label. */
  lockedBy?: string;
  /** Record origin context: "auto" (Payment trigger 자동 생성) / "manual" / "imported". */
  sourceContext?: "manual" | "auto" | "imported";

  // ── Document Lifecycle Clarity 정착 슬롯 (Invoice 패턴 답습) ─────────────
  /**
   * 새 버전 생성 시 옵셔널 *수정 사유* (예: "금액 정정" / "수신자 연락처 정정").
   * v1 (chain root)는 항상 undefined. v1 호환 옵셔널.
   */
  revisionReason?: string;

  // ── STEP 87 Print / PDF Export 메모 슬롯 ─────────────────────────────────
  /**
   * 마지막 print 작업 시각. *고객 앞에서 즉시 인쇄* / *PDF 저장* 흐름 추적용.
   * 본 슬롯은 *운영 메모* 수준 — 인쇄 횟수는 별도 timeline 이벤트로 추적
   * 가능. 본 필드는 *최신* 시각만 (UX-1 Action Clarity 일관 — 단일 시그널).
   */
  lastPrintedAt?: string;
  /**
   * 마지막 PDF export 시각. browser native print-to-PDF 흐름 후 운영자
   * 트리거. 실제 PDF 파일은 사용자 디바이스에 저장 (서버에 0 byte).
   */
  lastPdfExportedAt?: string;

  // ── STEP 87 Send-Ready 정착 슬롯 (모두 옵셔널 / future-ready) ────────────
  /**
   * 발송 흐름 상태 (운영 메모 수준). 부재 시 helper fallback "not_prepared".
   * 본 STEP에서 채워지는 값: "not_prepared" / "prepared".
   * 미래 STEP (외부 API 통합) 채움: "pending_external".
   */
  deliveryStatus?: ReceiptDeliveryStatus;
  /** "고객 발송 준비" 액션 시각. */
  preparedForSendAt?: string;
  /** "고객 발송 준비"한 actor label. */
  preparedForSendBy?: string;

  /**
   * 수신자 contact 메모 (이메일 / 전화번호 / 식별 메모). 본 STEP에서는 *display
   * only* — 자동 발송 0건. 사용자가 직접 외부 도구에서 활용.
   */
  recipientContact?: string;

  /**
   * **future-ready 슬롯 — 본 STEP에서 채움 0건**.
   * STEP 87 후 별도 STEP에서 외부 email/SMS API 통합 시 채워짐.
   */
  sentAt?: string;
  sentBy?: string;
  sentChannel?: ReceiptSendChannel;
  externalDeliveryProvider?: string;
  externalDeliveryReferenceId?: string;
}

/**
 * `createReceipt` 액션 입력 — id / status / refs / version / chain은 store가
 * 자동 채움. 호출자는 Payment id만 제공 (자동 trigger 흐름).
 *
 * **수동 생성 시나리오**: 운영자가 명시적으로 만들 때 manual=true 마킹 (sourceContext).
 */
export interface ReceiptCreateInput {
  paymentId: string;
  /** 명시적 sourceContext (override). 부재 시 "auto" 기본. */
  sourceContext?: "manual" | "auto" | "imported";
}

/**
 * Print/PDF/Send-prepare 액션의 audit 메모를 위한 helper input.
 */
export interface ReceiptSendPrepareInput {
  receiptId: string;
  /** 수신자 contact 메모 (이메일 / 전화번호 / 식별 라벨). */
  recipientContact?: string;
}

/**
 * Status / 발송 상태 라벨 (UI Pretendard 한국어 일관).
 */
export const RECEIPT_STATUS_LABEL_KR: Readonly<Record<ReceiptStatus, string>> = {
  DRAFT: "초안",
  ISSUED: "발행 완료",
} as const;

/**
 * Status별 dot color — Apple/OpenAI minimalism 톤, monochrome 정책 (rule_16).
 * - DRAFT  → ink-subtle (회색, 미완료)
 * - ISSUED → ink (검은색, 완료된 record)
 */
export const RECEIPT_STATUS_COLOR: Readonly<Record<ReceiptStatus, string>> = {
  DRAFT: "ink-subtle",
  ISSUED: "ink",
} as const;
