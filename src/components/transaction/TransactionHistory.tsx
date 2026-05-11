"use client";

import * as React from "react";
import { useArtworkStore } from "@/store/useArtworkStore";
import { ResalePill } from "@/components/transaction/TransactionSummary";
import {
  formatMoney,
  formatRelativeKR,
  TRANSACTION_STATUS_LABEL,
  TRANSACTION_STATUS_COLOR,
} from "@/lib/utils";
import {
  getActiveTransaction,
  getPreviousTransactions,
  hasTransactionHistory,
} from "@/lib/transaction-helpers";
import type { Transaction, TransactionStatus } from "@/types/transaction";

/**
 * Multi-Transaction context section (STEP 14, rule_13 follow-through).
 *
 * Renders only when an artwork has more than one transaction — i.e. after
 * resale registration. Surfaces:
 *   - the current (active) transaction, accent-bordered, with the ownership
 *     chain "previousOwner → buyer" inline when the active tx is a resale
 *   - the historical transactions as compact cards, each opens the standard
 *     TransactionDetailDrawer (re-used) so existing edit / view UX is intact.
 *
 * No table. No accordion (current+past in flow). 3-column layout untouched —
 * this is a single new section between TransactionSummary and SettlementSummary.
 */
interface TransactionHistoryProps {
  artworkId: string;
}

export function TransactionHistory({ artworkId }: TransactionHistoryProps) {
  const transactions = useArtworkStore((s) => s.transactions);
  const openTransactionDetail = useArtworkStore(
    (s) => s.openTransactionDetail
  );

  // Don't render if there's only one tx — STEP 14 is about multi-tx context.
  if (!hasTransactionHistory(transactions, artworkId)) return null;

  const active = getActiveTransaction(transactions, artworkId);
  const previous = getPreviousTransactions(transactions, artworkId);

  if (!active) return null; // defensive — hasTransactionHistory implies active exists

  return (
    <section className="px-6 py-5 border-b border-line">
      <SectionHeader
        label="Transaction History"
        hint={`총 ${1 + previous.length}건 · 현재 1 / 과거 ${previous.length}`}
      />

      {/* Current tx — accent-bordered card */}
      <div className="mt-3">
        <Subhead label="현재 거래" />
        <CurrentCard
          tx={active}
          onOpen={() => openTransactionDetail(active.id)}
        />
      </div>

      {/* Past transactions — compact card list */}
      {previous.length > 0 && (
        <div className="mt-4">
          <Subhead label={`과거 거래 (${previous.length})`} />
          <ul className="flex flex-col gap-1.5">
            {previous.map((tx) => (
              <li key={tx.id}>
                <PastCard
                  tx={tx}
                  onOpen={() => openTransactionDetail(tx.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

function CurrentCard({
  tx,
  onOpen,
}: {
  tx: Transaction;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      // Left accent border indicates "current" — minimal, no shadow (rule_16).
      className="w-full text-left rounded-md border border-line bg-surface px-3.5 py-3 transition-colors hover:bg-surface-muted"
      style={{ boxShadow: "inset 3px 0 0 0 #1B1B1B" }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusPill status={tx.status} />
          {tx.isResale && <ResalePill />}
        </div>
        <span className="text-[10.5px] text-ink-subtle tracking-tightish shrink-0">
          {formatRelativeKR(tx.createdAt)}
        </span>
      </div>

      {/* Ownership chain — only meaningful for resale tx */}
      <OwnershipChain tx={tx} />

      <div className="mt-1 text-[13px] font-semibold text-ink tabular-nums tracking-tight2">
        {formatMoney(tx.agreedPrice, tx.currency)}
      </div>
    </button>
  );
}

function PastCard({ tx, onOpen }: { tx: Transaction; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-muted"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <StatusPill status={tx.status} small />
          {tx.isResale && <ResalePill />}
        </div>
        <p className="mt-1 text-[12.5px] text-ink truncate tracking-tightish">
          {tx.buyerName.trim() || (
            <span className="text-ink-muted italic">구매자 미지정</span>
          )}
        </p>
        <p className="mt-0.5 text-[10.5px] text-ink-subtle tracking-tightish tabular-nums">
          {formatMoney(tx.agreedPrice, tx.currency)} ·{" "}
          {formatRelativeKR(tx.createdAt)}
        </p>
      </div>
      <ChevronRightIcon />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Ownership chain — "이전 소유자 → 구매자" or buyer-only
// ---------------------------------------------------------------------------

function OwnershipChain({ tx }: { tx: Transaction }) {
  const buyer = tx.buyerName.trim();
  const buyerLabel = buyer || "미정";
  const buyerClass = buyer ? "text-ink" : "text-ink-muted italic";

  // Resale: show ownership transition
  if (tx.isResale && tx.previousOwner) {
    return (
      <div className="flex items-center gap-1.5 text-[12px] tracking-tightish">
        <span className="text-ink-muted truncate">{tx.previousOwner}</span>
        <ArrowRightMiniIcon />
        <span className={`truncate ${buyerClass}`}>{buyerLabel}</span>
      </div>
    );
  }

  // Original tx: just the buyer
  return (
    <p className={`text-[12.5px] font-medium tracking-tight2 truncate ${buyerClass}`}>
      {buyerLabel}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Local primitives
// ---------------------------------------------------------------------------

function StatusPill({
  status,
  small = false,
}: {
  status: TransactionStatus;
  small?: boolean;
}) {
  const color = TRANSACTION_STATUS_COLOR[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-surface border border-line tracking-tightish font-medium ${
        small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[10.5px]"
      }`}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{TRANSACTION_STATUS_LABEL[status]}</span>
    </span>
  );
}

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="text-[11px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
        {label}
      </h3>
      {hint && (
        <span className="text-[10.5px] text-ink-subtle tracking-tightish">
          {hint}
        </span>
      )}
    </div>
  );
}

function Subhead({ label }: { label: string }) {
  return (
    <p className="mb-1.5 text-[10.5px] text-ink-subtle tracking-tightish font-medium">
      {label}
    </p>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-ink-subtle group-hover:text-ink-muted shrink-0 transition-colors"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ArrowRightMiniIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 text-ink-subtle shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
