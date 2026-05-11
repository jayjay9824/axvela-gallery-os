// ============================================================================
// Transaction helpers — pure read accessors over the store's `transactions`
// slice. Used by TransactionHistory + DetailPanel branching to surface the
// resale loop's multi-transaction structure (rule_13) without leaking
// store-internal logic into UI components.
//
// All functions are O(n) over a single artwork's transaction list (typically
// 1–3 entries) and are safe to call from inside React render.
// ============================================================================

import type { Transaction } from "@/types/transaction";

/** Convenience type alias for the store's transactions slice. */
export type TransactionsByArtwork = Record<string, Transaction[]>;

/**
 * All transactions for an artwork, in store order (newest first by convention).
 * Returns an empty array when the artwork has no transactions yet.
 */
export function getTransactionsByArtworkId(
  transactions: TransactionsByArtwork,
  artworkId: string
): Transaction[] {
  return transactions[artworkId] ?? [];
}

/**
 * The "active" (current) transaction for an artwork — the first entry in the
 * list, since store actions always prepend. After resale this is the new
 * resale tx; before resale it's the only / primary tx. Returns undefined for
 * pre-DEAL artworks.
 */
export function getActiveTransaction(
  transactions: TransactionsByArtwork,
  artworkId: string
): Transaction | undefined {
  return (transactions[artworkId] ?? [])[0];
}

/**
 * All transactions *other than* the active one, in newest-first order. Empty
 * for single-tx artworks. Used by the History section to render the historical
 * tx cards under the "과거 거래" subhead.
 */
export function getPreviousTransactions(
  transactions: TransactionsByArtwork,
  artworkId: string
): Transaction[] {
  const list = transactions[artworkId] ?? [];
  return list.slice(1);
}

/**
 * True when an artwork has more than one transaction — the only condition
 * under which the History section should render at all (rule_15: don't add
 * UI that has no information to convey).
 */
export function hasTransactionHistory(
  transactions: TransactionsByArtwork,
  artworkId: string
): boolean {
  return (transactions[artworkId] ?? []).length > 1;
}

// ----------------------------------------------------------------------------
// Active vs Historical (STEP 14 — read-only guard)
//
// Active transaction  = transactions[artworkId][0]   (newest, store prepends)
// Historical          = transactions[artworkId][1+]  (immutable, rule_4)
//
// Both store guards and UI read-only banners use these two helpers as their
// single source of truth. Changing the definition of "active" later means
// updating just one place.
// ----------------------------------------------------------------------------

/**
 * True iff `transactionId` is the *active* (newest) transaction of its parent
 * artwork. Walks the transactions slice once. Returns false for unknown ids
 * — safer default for guard callers.
 */
export function isActiveTransaction(
  transactions: TransactionsByArtwork,
  transactionId: string
): boolean {
  for (const list of Object.values(transactions)) {
    if (list.length === 0) continue;
    if (list[0].id === transactionId) return true;
    // If we found the tx but it wasn't [0], it's historical
    if (list.some((t) => t.id === transactionId)) return false;
  }
  return false;
}

/**
 * Inverse of isActiveTransaction — returns true for known historical tx.
 * Returns false for unknown ids (so guard callers using isHistorical to *block*
 * actions don't accidentally block unknown ids; pair with explicit existence
 * check upstream).
 */
export function isHistoricalTransaction(
  transactions: TransactionsByArtwork,
  transactionId: string
): boolean {
  for (const list of Object.values(transactions)) {
    if (list.length === 0) continue;
    const idx = list.findIndex((t) => t.id === transactionId);
    if (idx === -1) continue;
    return idx > 0;
  }
  return false;
}

// ----------------------------------------------------------------------------
// Children-presence checks — used to detect the "fresh resale" empty state.
//
// A resale tx that's just been created has no Invoice / Payment / Settlement /
// Tax / Contract / Logistics yet; those will be created as the new flow
// progresses. The DetailPanel needs to detect this and substitute a single
// guidance card for the four otherwise-empty Money/Document/Logistics
// summaries (rule_15 + the user's explicit "비어있는 카드 그대로 두지 말 것").
// ----------------------------------------------------------------------------

/**
 * Slim, dependency-free shape of the store fields this check reads — keeps
 * the helper testable without importing the full store type.
 */
export interface TransactionChildrenSlices {
  invoices: Record<string, unknown[]>;
  payments: Record<string, unknown[]>;
  settlements: Record<string, unknown[]>;
  taxRecords: Record<string, unknown[]>;
  contracts: Record<string, unknown[]>;
  logistics: Record<string, unknown[]>;
}

/**
 * True when the given transaction has at least one child record across any of
 * the six dependent domains. False means "this tx is a blank slate" — used by
 * the DetailPanel to decide whether to show the empty-state guidance card.
 *
 * Note: ConditionReport is keyed by logisticsId, not transactionId, so it's
 * not checked directly — its presence is implied by logistics presence.
 */
export function hasTransactionChildren(
  transactionId: string,
  slices: TransactionChildrenSlices
): boolean {
  return (
    (slices.invoices[transactionId]?.length ?? 0) > 0 ||
    (slices.payments[transactionId]?.length ?? 0) > 0 ||
    (slices.settlements[transactionId]?.length ?? 0) > 0 ||
    (slices.taxRecords[transactionId]?.length ?? 0) > 0 ||
    (slices.contracts[transactionId]?.length ?? 0) > 0 ||
    (slices.logistics[transactionId]?.length ?? 0) > 0
  );
}
