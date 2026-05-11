// ============================================================================
// Transaction — the operational core once an Inquiry becomes a real deal.
// One Transaction belongs to one Artwork (rule_1) and is the parent of future
// Document / Payment / Settlement / Tax records (rule_11). This step does NOT
// implement those children — only the Transaction shell.
// ============================================================================

/**
 * Transaction lifecycle.
 * - NEGOTIATING  협상 중 — terms being finalized (default on auto-create)
 * - AGREED       합의 완료 — buyer + price + conditions locked, ready for invoice
 * - PAID         결제 수령 — Payment registered (rule_3) — invoice cleared
 * - SETTLED      정산 완료 — internal distribution done (rule_3, completeSettlement)
 * - COMPLETED    거래 완료 — final state matching artwork CLOSED
 * - CANCELLED    취소 — deal fell through
 *
 * Note: the Transaction status is independent of the artwork state machine
 * (rule_6). Both progress in parallel, but registerPayment + completeSettlement
 * keep them synchronized for the AGREED → PAID → SETTLED progression.
 */
export type TransactionStatus =
  | "NEGOTIATING"
  | "AGREED"
  | "PAID"
  | "SETTLED"
  | "COMPLETED"
  | "CANCELLED";

export type Currency = "KRW" | "USD" | "EUR" | "JPY";

export interface Transaction {
  id: string;
  artworkId: string;
  /** Source Inquiry id. Empty string when no inquiry was the origin. */
  inquiryId: string;
  /** Buyer identity — typically inherited from the source Inquiry's collectorName. */
  buyerName: string;
  /** Final agreed price expressed in `currency`. Inherits from artwork.priceKRW initially. */
  agreedPrice: number;
  currency: Currency;
  status: TransactionStatus;
  /** Internal note about the deal. */
  dealMemo?: string;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime

  // --- Resale loop (rule_13) ----------------------------------------------
  // These four fields are present only on transactions created by
  // createResaleTransaction (i.e. the second-or-later transaction on a
  // single artwork). Previous transactions remain immutable — resale is
  // implemented as a NEW transaction, never as a mutation of the old one.
  /** True when this transaction is the resale entry on a previously CLOSED artwork. */
  isResale?: boolean;
  /** Id of the prior (typically COMPLETED) transaction this resale follows. */
  previousTransactionId?: string;
  /** Buyer name of the prior transaction — surfaces in TransactionSummary. */
  previousOwner?: string;
  /**
   * Gallery commission for the resale, expressed as a 0-1 ratio.
   * v1: hardcoded to 0.15 (15%) at creation time. Future steps may make this
   * configurable per-deal.
   */
  resaleCommissionRate?: number;
}
