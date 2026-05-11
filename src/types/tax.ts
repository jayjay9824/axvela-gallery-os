// ============================================================================
// TaxRecord — 세무 기록 (rule_3 — money flow separation, final layer).
//
// Strict separation:
//   - Payment    = 고객 → 갤러리 (외부 입금)
//   - Settlement = 갤러리 ↔ 작가 (내부 분배)
//   - TaxRecord  = 거래에 대한 세무 신고 / 매출 기록 (회계 layer)
//
// 세 레이어는 서로 다른 데이터, 다른 액션, 다른 UI로만 존재합니다 (rule_3).
// TaxRecord는 Settlement.COMPLETED를 트리거로 자동 생성되지만, 어떤 경우에도
// Settlement / Payment 객체에 묶이지 않고 독립적인 엔티티로 유지됩니다.
//
// 부모 체인 (rule_11):  Artwork → Transaction → Settlement → TaxRecord
// `transactionId` / `artworkId` / `settlementId`는 모두 비정규화 ref로
// 직접 lookup이 가능합니다.
// ============================================================================

import type { Currency } from "./transaction";

/**
 * TaxRecord lifecycle.
 * - PENDING  대기 중   — 자동 생성 직후, 회계 검토 전
 * - READY    준비 완료 — 회계 검토 완료, 발행 대기 (v1 UI 미노출, forward-compat)
 * - ISSUED   발행 완료 — 세무 신고 / 매출 기록 발행 완료, immutable
 */
export type TaxRecordStatus = "PENDING" | "READY" | "ISSUED";

/**
 * Tax document type (한국 갤러리 운영 기준).
 * - SALES_RECORD  매출 기록 — 직접 판매 거래의 매출 신고 (default)
 * - VAT           부가세 — 10% 부가가치세 신고
 * - WITHHOLDING   원천징수 — 작가 지급 시 원천세 (해외 작가, 사업소득 등)
 *
 * v1은 SALES_RECORD 한 종류만 자동 생성하고 모든 세금 컴포넌트를 한 레코드에
 * 담습니다. 후속 단계에서 작가 등록번호 / 해외 거래 분기에 따라 여러 레코드로
 * 분리될 수 있습니다.
 */
export type TaxType = "SALES_RECORD" | "VAT" | "WITHHOLDING";

export interface TaxRecord {
  id: string;

  // Hierarchy refs (denormalized for direct lookup, rule_11)
  transactionId: string;
  artworkId: string;
  settlementId: string;

  /** Pre-tax base amount — typically equals Settlement.totalAmount. */
  taxableAmount: number;
  /** VAT (부가세). v1: taxableAmount * 0.10. */
  vatAmount: number;
  /** 원천징수액 (artist payment 시 발생). v1: 0 (forward-compat). */
  withholdingAmount: number;
  /** Snapshotted from Settlement at creation (FX lock, rule_20). */
  currency: Currency;

  status: TaxRecordStatus;
  taxType: TaxType;

  /** ISO datetime when status flipped to ISSUED. Filled by issueTaxRecord(). */
  issuedAt?: string;

  // ── FX reference (STEP 34 — rule_20) ────────────────────────────────────
  /**
   * Settlement에서 propagate된 KRW 환산 과세표준. 외화 거래에서 회계 / 세무
   * 신고 시 한국 원화 기준이 필요한 경우 사용. 기존 `taxableAmount`는 원
   * 통화(currency) 기준 그대로 유지 — 두 기준 모두 audit-grade로 보관.
   */
  taxableAmountKRW?: number;
  /** Settlement.fxReferenceInvoiceId propagate (chain audit). */
  fxReferenceInvoiceId?: string;
  /** Settlement.fxRateUsed propagate. */
  fxRateUsed?: number;

  // Audit
  createdAt: string;
  updatedAt: string;
}
