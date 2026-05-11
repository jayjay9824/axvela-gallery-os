// ============================================================================
// Payment — money actually received against an Invoice (rule_3).
// Money flow separation: Payment is its own entity, NEVER merged with Invoice
// (which is a charge document) or Settlement / Tax (which are downstream).
//
// One Payment belongs to one Invoice (and transitively one Transaction +
// Artwork — denormalized refs are stored for direct access without joining).
// Registration is the canonical trigger for:
//   - Invoice.status DRAFT/SENT → PAID
//   - Transaction.status AGREED → PAID
//   - Artwork.state DEAL → PAID (rule_6)
// ============================================================================

import type { Currency } from "./transaction";

/**
 * Payment processing status.
 * - RECEIVED  수령 완료 — funds confirmed by gallery (default on register)
 * - PENDING   확인 대기 — money in flight (e.g. wire en route)
 * - FAILED    실패 — rejected, bounced, charge-backed
 * - REFUNDED  환불 — gallery returned funds
 *
 * Only RECEIVED triggers downstream cascade. Other statuses exist so the
 * Payment record can be created and updated without flipping Invoice/Artwork
 * state prematurely.
 */
export type PaymentStatus =
  | "RECEIVED"
  | "PENDING"
  | "FAILED"
  | "REFUNDED";

/**
 * Payment instrument used.
 * Gallery-friendly enum — keep small. Refine in later step if needed.
 */
export type PaymentMethod =
  | "BANK_TRANSFER"  // 계좌이체 (가장 흔함)
  | "WIRE"           // 해외 송금
  | "CARD"           // 카드
  | "CASH"           // 현금 (showroom)
  | "OTHER";         // 기타

export interface Payment {
  id: string;

  // Hierarchy refs — denormalized for direct lookup (rule_11 Document chain).
  invoiceId: string;
  transactionId: string;
  artworkId: string;

  // Money — independently tracked from Invoice in case of partial / over payments.
  amount: number;
  currency: Currency;

  // Operational metadata
  method: PaymentMethod;
  status: PaymentStatus;
  /** ISO datetime of when the buyer actually paid (entered by staff). */
  paidAt: string;
  /** Free-form internal note — e.g. bank ref number, payer name on transfer. */
  memo?: string;

  // Audit
  createdAt: string; // ISO datetime — when the record was registered in AXVELA
  updatedAt: string; // ISO datetime
}
