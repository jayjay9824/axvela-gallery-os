"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  useArtworkStore,
  type TransactionUpdate,
} from "@/store/useArtworkStore";
import {
  formatMoney,
  formatRelativeKR,
  TRANSACTION_STATUS_LABEL,
  CURRENCY_LABEL,
  INQUIRY_STATUS_LABEL,
  INQUIRY_TYPE_LABEL,
} from "@/lib/utils";
import { isHistoricalTransaction } from "@/lib/transaction-helpers";
import type {
  Transaction,
  TransactionStatus,
  Currency,
} from "@/types/transaction";

const STATUS_OPTIONS = (
  Object.keys(TRANSACTION_STATUS_LABEL) as TransactionStatus[]
).map((s) => ({ value: s, label: TRANSACTION_STATUS_LABEL[s] }));

const CURRENCY_OPTIONS = (Object.keys(CURRENCY_LABEL) as Currency[]).map(
  (c) => ({ value: c, label: CURRENCY_LABEL[c] })
);

// ============================================================================
// Drawer wrapper
// ============================================================================

export function TransactionDetailDrawer() {
  const transactionDetailRequest = useArtworkStore(
    (s) => s.transactionDetailRequest
  );
  const closeTransactionDetail = useArtworkStore(
    (s) => s.closeTransactionDetail
  );
  const transactions = useArtworkStore((s) => s.transactions);
  const inquiries = useArtworkStore((s) => s.inquiries);
  const artworks = useArtworkStore((s) => s.artworks);

  const isOpen = transactionDetailRequest.kind === "open";

  const tx: Transaction | undefined = isOpen
    ? Object.values(transactions)
        .flat()
        .find((t) => t.id === transactionDetailRequest.transactionId)
    : undefined;

  const artwork = tx
    ? artworks.find((a) => a.id === tx.artworkId)
    : undefined;

  const sourceInquiry =
    tx && tx.inquiryId
      ? Object.values(inquiries)
          .flat()
          .find((i) => i.id === tx.inquiryId)
      : undefined;

  return (
    <Drawer open={isOpen} onClose={closeTransactionDetail} title="거래 상세">
      {isOpen && tx && artwork && (
        <TransactionForm
          key={tx.id}
          tx={tx}
          artworkTitle={artwork.title}
          artworkAxid={artwork.axid.code}
          artworkColor={artwork.thumbnailColor}
          // STEP 14 — historical tx are read-only (rule_4)
          readOnly={isHistoricalTransaction(transactions, tx.id)}
          sourceInquiryLabel={
            sourceInquiry
              ? `${
                  sourceInquiry.collectorName.trim() || "(이름 없음)"
                } · ${INQUIRY_TYPE_LABEL[sourceInquiry.inquiryType]} · ${
                  INQUIRY_STATUS_LABEL[sourceInquiry.status]
                }`
              : null
          }
          onCancel={closeTransactionDetail}
        />
      )}
    </Drawer>
  );
}

// ============================================================================
// Form
// ============================================================================

interface TransactionFormProps {
  tx: Transaction;
  artworkTitle: string;
  artworkAxid: string;
  artworkColor: string;
  sourceInquiryLabel: string | null;
  onCancel: () => void;
  /**
   * STEP 14 — when true, the form renders in read-only mode (all inputs
   * disabled, save button hidden, banner shown). True for any tx that is
   * not the active (newest) tx of its parent artwork.
   */
  readOnly?: boolean;
}

function TransactionForm({
  tx,
  artworkTitle,
  artworkAxid,
  artworkColor,
  sourceInquiryLabel,
  onCancel,
  readOnly = false,
}: TransactionFormProps) {
  const updateTransaction = useArtworkStore((s) => s.updateTransaction);

  const [buyerName, setBuyerName] = React.useState(tx.buyerName);
  const [priceRaw, setPriceRaw] = React.useState(String(tx.agreedPrice));
  const [currency, setCurrency] = React.useState<Currency>(tx.currency);
  const [status, setStatus] = React.useState<TransactionStatus>(tx.status);
  const [dealMemo, setDealMemo] = React.useState(tx.dealMemo ?? "");

  // Live formatted preview of the price as user types
  const numericPrice = Number(priceRaw.replace(/[^\d]/g, "")) || 0;
  const priceDisplay = formatMoney(numericPrice, currency);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip non-digits — currency formatting renders as a hint
    setPriceRaw(e.target.value.replace(/[^\d]/g, ""));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return; // belt-and-braces; store also guards
    const patch: TransactionUpdate = {
      buyerName: buyerName.trim(),
      agreedPrice: numericPrice,
      currency,
      status,
      dealMemo: dealMemo.trim(),
    };
    updateTransaction(tx.id, patch);
    onCancel();
  };

  const isEmpty = !tx.buyerName.trim();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full" noValidate>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        {/* Read-only banner (STEP 14) — historical tx, immutable per rule_4 */}
        {readOnly && (
          <div className="mb-4 px-3 py-2.5 rounded-md bg-surface-muted border border-line">
            <div className="flex items-center gap-2">
              <LockMiniIcon />
              <p className="text-[11.5px] text-ink font-semibold tracking-tightish">
                Historical Transaction · 읽기 전용
              </p>
            </div>
            <p className="mt-1 text-[10.5px] text-ink-subtle tracking-tightish leading-relaxed">
              재판매 이후의 과거 거래는 영구 보존되며 수정할 수 없습니다.
              현재 거래는 Transaction History의 최상단 항목입니다.
            </p>
          </div>
        )}

        {/* Linked artwork header */}
        <div className="mb-4 flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface-muted border border-line">
          <div
            aria-hidden
            className="h-9 w-9 rounded border border-line shrink-0"
            style={{ backgroundColor: artworkColor }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              연결된 작품
            </p>
            <p className="text-[12.5px] text-ink mt-0.5 tracking-tightish font-medium truncate">
              {artworkTitle}
            </p>
            <p className="text-[10.5px] text-ink-subtle mt-0.5 font-mono">
              {artworkAxid}
            </p>
          </div>
        </div>

        {/* Source inquiry link */}
        {sourceInquiryLabel && (
          <div className="mb-5 px-3 py-2 rounded-md border border-line">
            <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              인계된 Inquiry
            </p>
            <p className="text-[11.5px] text-ink-muted mt-0.5 tracking-tightish">
              {sourceInquiryLabel}
            </p>
          </div>
        )}

        {/* Meta */}
        <div className="mb-5 grid grid-cols-2 gap-x-4 gap-y-2">
          <Meta label="생성" value={formatRelativeKR(tx.createdAt)} />
          <Meta label="최근 갱신" value={formatRelativeKR(tx.updatedAt)} />
        </div>

        {isEmpty && !readOnly && (
          <div className="mb-5 px-3 py-2.5 rounded-md bg-status-deal/5 border border-status-deal/30">
            <p className="text-[11.5px] text-status-deal tracking-tightish font-medium">
              자동 생성된 Transaction입니다
            </p>
            <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
              구매자 정보와 합의 가격을 확정해 주세요.
            </p>
          </div>
        )}

        <FormSection label="구매자 정보">
          <TextField
            label="구매자"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            placeholder="예: 리움 컬렉션"
            autoFocus={isEmpty && !readOnly}
            disabled={readOnly}
          />
        </FormSection>

        <Divider />

        <FormSection label="거래 조건">
          <TextField
            label="합의 가격"
            value={priceRaw}
            onChange={handlePriceChange}
            placeholder="0"
            inputMode="numeric"
            hint={priceDisplay}
            disabled={readOnly}
          />
          <Select
            label="통화"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            options={CURRENCY_OPTIONS}
            hint="환율은 Invoice 발행 시점에 Lock됩니다"
            disabled={readOnly}
          />
        </FormSection>

        <Divider />

        <FormSection label="거래 운영">
          <Select
            label="상태"
            value={status}
            onChange={(e) => setStatus(e.target.value as TransactionStatus)}
            options={STATUS_OPTIONS}
            hint="상태 변경 시 Living Timeline에 기록됩니다"
            disabled={readOnly}
          />
          <Textarea
            label="거래 메모"
            value={dealMemo}
            onChange={(e) => setDealMemo(e.target.value)}
            placeholder="협상 진행 상황·합의 조건·내부 메모"
            rows={4}
            disabled={readOnly}
          />
        </FormSection>
      </div>

      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {readOnly ? "닫기" : "취소"}
        </Button>
        {!readOnly && (
          <Button type="submit" variant="primary">
            변경 저장
          </Button>
        )}
      </footer>
    </form>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
        {label}
      </p>
      <p className="text-[12px] text-ink-muted mt-0.5 tracking-tightish">
        {value}
      </p>
    </div>
  );
}

function FormSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5">
      <h3 className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
        {label}
      </h3>
      {children}
    </section>
  );
}

function Divider() {
  return <div className="border-t border-line my-5" aria-hidden />;
}

function LockMiniIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-ink-muted shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
