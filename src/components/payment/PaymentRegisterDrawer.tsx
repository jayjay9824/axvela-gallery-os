"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  useArtworkStore,
  type PaymentInput,
} from "@/store/useArtworkStore";
import {
  formatMoney,
  CURRENCY_LABEL,
  PAYMENT_METHOD_LABEL,
  STATE_LABEL_KR,
} from "@/lib/utils";
import type { Currency } from "@/types/transaction";
import type { PaymentMethod } from "@/types/payment";
import type { Invoice } from "@/types/invoice";
import type { Transaction } from "@/types/transaction";
import type { Artwork } from "@/types/artwork";

const METHOD_OPTIONS = (
  Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]
).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }));

const CURRENCY_OPTIONS = (Object.keys(CURRENCY_LABEL) as Currency[]).map(
  (c) => ({ value: c, label: CURRENCY_LABEL[c] })
);

// ============================================================================
// Drawer wrapper
// ============================================================================

export function PaymentRegisterDrawer() {
  const paymentRegisterRequest = useArtworkStore(
    (s) => s.paymentRegisterRequest
  );
  const closePaymentRegister = useArtworkStore(
    (s) => s.closePaymentRegister
  );
  const invoices = useArtworkStore((s) => s.invoices);
  const transactions = useArtworkStore((s) => s.transactions);
  const artworks = useArtworkStore((s) => s.artworks);

  const isOpen = paymentRegisterRequest.kind === "open";

  const invoice: Invoice | undefined = isOpen
    ? Object.values(invoices)
        .flat()
        .find((i) => i.id === paymentRegisterRequest.invoiceId)
    : undefined;

  const transaction: Transaction | undefined = invoice
    ? Object.values(transactions)
        .flat()
        .find((t) => t.id === invoice.transactionId)
    : undefined;

  const artwork: Artwork | undefined = transaction
    ? artworks.find((a) => a.id === transaction.artworkId)
    : undefined;

  return (
    <Drawer
      open={isOpen}
      onClose={closePaymentRegister}
      title="결제 등록"
    >
      {isOpen && invoice && transaction && artwork && (
        <PaymentForm
          key={invoice.id}
          invoice={invoice}
          transaction={transaction}
          artwork={artwork}
          onCancel={closePaymentRegister}
        />
      )}
    </Drawer>
  );
}

// ============================================================================
// Form
// ============================================================================

interface PaymentFormProps {
  invoice: Invoice;
  transaction: Transaction;
  artwork: Artwork;
  onCancel: () => void;
}

function todayISODate(): string {
  // Use Asia/Seoul to align with seed data convention; fall back to local.
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function PaymentForm({
  invoice,
  transaction,
  artwork,
  onCancel,
}: PaymentFormProps) {
  const registerPayment = useArtworkStore((s) => s.registerPayment);

  // Defaults — staff-friendly: pre-fill everything from Invoice.
  const [amountRaw, setAmountRaw] = React.useState(String(invoice.amount));
  const [currency, setCurrency] = React.useState<Currency>(invoice.currency);
  const [method, setMethod] = React.useState<PaymentMethod>("BANK_TRANSFER");
  const [paidAt, setPaidAt] = React.useState(todayISODate());
  const [memo, setMemo] = React.useState("");

  const numericAmount = Number(amountRaw.replace(/[^\d]/g, "")) || 0;
  const amountDisplay = formatMoney(numericAmount, currency);

  const willTransitionArtwork = artwork.state === "DEAL";

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmountRaw(e.target.value.replace(/[^\d]/g, ""));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numericAmount || !paidAt) return;
    const payload: PaymentInput = {
      invoiceId: invoice.id,
      amount: numericAmount,
      currency,
      method,
      paidAt,
      memo: memo.trim() || undefined,
    };
    registerPayment(payload);
    onCancel();
  };

  const isSubmittable = numericAmount > 0 && !!paidAt;
  const amountMismatch =
    numericAmount > 0 && numericAmount !== invoice.amount;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full" noValidate>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        {/* Linked artwork header */}
        <div className="mb-4 flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface-muted border border-line">
          <div
            aria-hidden
            className="h-9 w-9 rounded border border-line shrink-0"
            style={{ backgroundColor: artwork.thumbnailColor }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              연결된 작품
            </p>
            <p className="text-[12.5px] text-ink mt-0.5 tracking-tightish font-medium truncate">
              {artwork.title}
            </p>
            <p className="text-[10.5px] text-ink-subtle mt-0.5 font-mono">
              {artwork.axid.code}
            </p>
          </div>
        </div>

        {/* Linked invoice / transaction context */}
        <div className="mb-5 px-3 py-2.5 rounded-md border border-line">
          <div className="flex items-center justify-between">
            <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
              연결된 Invoice
            </p>
            <span className="text-[10.5px] text-ink-subtle font-mono">
              {invoice.id}
            </span>
          </div>
          <p className="text-[11.5px] text-ink-muted mt-1 tracking-tightish">
            {transaction.buyerName.trim() || "구매자 미지정"} ·{" "}
            <span className="tabular-nums">
              {formatMoney(invoice.amount, invoice.currency)}
            </span>
          </p>
        </div>

        {/* Cascade preview — what this action will do (rule_3 transparency) */}
        <div className="mb-5 px-3 py-2.5 rounded-md bg-status-paid/5 border border-status-paid/30">
          <p className="text-[11.5px] text-status-paid tracking-tightish font-medium">
            결제 등록 시 자동 처리됩니다
          </p>
          <ul className="mt-1.5 space-y-0.5 text-[10.5px] text-ink-muted tracking-tightish">
            <li>· Invoice → 결제 완료</li>
            <li>· Transaction → 결제 수령</li>
            {willTransitionArtwork && (
              <li>
                · 작품 상태 → {STATE_LABEL_KR.DEAL} → {STATE_LABEL_KR.PAID}
              </li>
            )}
          </ul>
        </div>

        <FormSection label="결제 금액">
          <TextField
            label="수령 금액"
            value={amountRaw}
            onChange={handleAmountChange}
            placeholder="0"
            inputMode="numeric"
            hint={
              amountMismatch
                ? `Invoice 금액 ${formatMoney(
                    invoice.amount,
                    invoice.currency
                  )}과 다릅니다 — 부분 결제는 ${amountDisplay}로 등록됩니다`
                : amountDisplay
            }
            required
          />
          <Select
            label="통화"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            options={CURRENCY_OPTIONS}
            hint="Invoice 발행 시점 환율로 Lock된 값"
          />
        </FormSection>

        <Divider />

        <FormSection label="결제 정보">
          <Select
            label="결제 방식"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            options={METHOD_OPTIONS}
          />
          <TextField
            label="결제일"
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            hint="실제 입금/결제가 완료된 날짜"
            required
          />
          <Textarea
            label="메모"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="입금 은행, 송금자명, 참조 번호 등 내부 기록"
            rows={3}
          />
        </FormSection>
      </div>

      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!isSubmittable}
          aria-disabled={!isSubmittable}
        >
          결제 등록
        </Button>
      </footer>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Local primitives
// ---------------------------------------------------------------------------

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
