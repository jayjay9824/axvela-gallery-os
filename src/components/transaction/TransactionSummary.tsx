"use client";

import * as React from "react";
import { useArtworkStore } from "@/store/useArtworkStore";
import { Button } from "@/components/ui/Button";
import {
  formatMoney,
  formatRelativeKR,
  TRANSACTION_STATUS_LABEL,
  TRANSACTION_STATUS_COLOR,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_COLOR,
  PAYMENT_METHOD_LABEL,
} from "@/lib/utils";
import type { TransactionStatus } from "@/types/transaction";
import type { InvoiceStatus } from "@/types/invoice";

interface TransactionSummaryProps {
  artworkId: string;
}

export function TransactionSummary({ artworkId }: TransactionSummaryProps) {
  const transactions = useArtworkStore((s) => s.transactions);
  const inquiries = useArtworkStore((s) => s.inquiries);
  const invoices = useArtworkStore((s) => s.invoices);
  const payments = useArtworkStore((s) => s.payments);
  // STEP 89 — Tax Invoice (전자세금계산서 운영 record) — embed naturally in
  // transaction zone (rule_11 — child docs of Transaction).
  const taxInvoices = useArtworkStore((s) => s.taxInvoices);
  const openTransactionDetail = useArtworkStore(
    (s) => s.openTransactionDetail
  );
  const openInvoiceDetail = useArtworkStore((s) => s.openInvoiceDetail);
  const openTaxInvoiceDetail = useArtworkStore((s) => s.openTaxInvoiceDetail);
  const createTaxInvoice = useArtworkStore((s) => s.createTaxInvoice);

  const list = transactions[artworkId] ?? [];
  const latest = list[0];

  // Find the source inquiry to surface the link
  const sourceInquiry = latest?.inquiryId
    ? (inquiries[artworkId] ?? []).find((i) => i.id === latest.inquiryId)
    : undefined;

  // Latest invoice for this transaction (rule_11 — Document is child of Transaction)
  const latestInvoice = latest
    ? (invoices[latest.id] ?? [])[0]
    : undefined;

  // Latest payment for this transaction (rule_3 — money flow is its own layer)
  const latestPayment = latest
    ? (payments[latest.id] ?? [])[0]
    : undefined;

  // STEP 89 — Latest Tax Invoice (사업자용 세금계산서) for this transaction.
  // Sorted DESC by createdAt (store invariant) — list[0] is the most recent.
  const latestTaxInvoice = latest
    ? (taxInvoices[latest.id] ?? [])[0]
    : undefined;

  // STEP 89 — Tax Invoice CTA handler. Opens existing if present, otherwise
  // creates a new DRAFT (which auto-opens detail drawer via store side effect).
  // Conditional on `latestInvoice` — Tax Invoice는 Invoice에 종속 (rule_11).
  const handleTaxInvoiceCTA = React.useCallback(() => {
    if (latestTaxInvoice) {
      openTaxInvoiceDetail(latestTaxInvoice.id);
      return;
    }
    if (!latestInvoice) return;
    createTaxInvoice({ invoiceId: latestInvoice.id });
  }, [latestTaxInvoice, latestInvoice, openTaxInvoiceDetail, createTaxInvoice]);

  return (
    <section className="px-6 py-5 border-b border-line">
      <SectionHeader
        label="Transaction"
        hint={list.length > 0 ? `총 ${list.length}건` : "협상의 결과"}
      />

      {latest ? (
        <>
          <div className="mt-3 rounded-md border border-line p-3.5">
            {/* Status row — Resale badge on the left when applicable (rule_13) */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <StatusPill status={latest.status} />
                {latest.isResale && <ResalePill />}
              </div>
              <span className="text-[10.5px] text-ink-subtle tracking-tightish">
                {formatRelativeKR(latest.createdAt)}
              </span>
            </div>

            {/* Buyer */}
            {latest.buyerName.trim() ? (
              <p className="text-[13px] font-semibold text-ink tracking-tight2">
                {latest.buyerName}
              </p>
            ) : (
              <p className="text-[12.5px] text-ink-muted tracking-tightish italic">
                구매자 정보 입력 필요
              </p>
            )}

            {/* Source-from-inquiry link */}
            {sourceInquiry && (
              <p className="mt-0.5 text-[10.5px] text-ink-subtle tracking-tightish flex items-center gap-1">
                <ArrowFromIcon />
                <span>Inquiry로부터 인계</span>
                {sourceInquiry.collectorName.trim() &&
                  sourceInquiry.collectorName !== latest.buyerName && (
                    <span className="text-ink-subtle">
                      · {sourceInquiry.collectorName}
                    </span>
                  )}
              </p>
            )}

            {/* Resale provenance — previous owner + commission (rule_13) */}
            {latest.isResale && (
              <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-ink-subtle tracking-tightish">
                <ArrowFromIcon />
                <span>
                  이전 소유자:{" "}
                  <span className="text-ink-muted">
                    {latest.previousOwner ?? "—"}
                  </span>
                </span>
                {latest.resaleCommissionRate !== undefined && (
                  <span className="text-ink-subtle">
                    · 재판매 커미션 {Math.round(latest.resaleCommissionRate * 100)}%
                  </span>
                )}
              </div>
            )}

            {/* Agreed price — the headline number */}
            <div className="mt-3 pt-3 border-t border-line">
              <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
                합의 가격
              </p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[18px] font-semibold text-ink tracking-tight2 tabular-nums">
                  {formatMoney(latest.agreedPrice, latest.currency)}
                </span>
                <span className="text-[10.5px] text-ink-subtle tracking-tightish font-mono">
                  {latest.currency}
                </span>
              </div>
            </div>

            {/* Memo preview */}
            {latest.dealMemo && (
              <p className="mt-2.5 text-[12px] text-ink-muted leading-relaxed tracking-tightish line-clamp-2">
                “{latest.dealMemo}”
              </p>
            )}

            {/* Invoice — child Document (rule_11) */}
            {latestInvoice && (
              <div className="mt-3 pt-3 border-t border-line">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
                      Invoice
                    </p>
                    <span className="text-[10.5px] text-ink-subtle font-mono tabular-nums tracking-tightish">
                      v{latestInvoice.version}
                    </span>
                    {latestInvoice.isLocked && (
                      <LockMiniIcon aria-label="잠김" />
                    )}
                  </div>
                  <InvoicePill status={latestInvoice.status} />
                </div>
              </div>
            )}

            {/* Payment — separate money-flow layer (rule_3) */}
            {latestInvoice && (
              <div className="mt-3 pt-3 border-t border-line">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
                    Payment
                  </p>
                  {latestPayment ? (
                    <span className="text-[10.5px] text-ink-muted tracking-tightish">
                      {PAYMENT_METHOD_LABEL[latestPayment.method]} ·{" "}
                      {formatRelativeKR(latestPayment.paidAt)}
                    </span>
                  ) : (
                    <span className="text-[10.5px] text-ink-subtle tracking-tightish italic">
                      미등록
                    </span>
                  )}
                </div>
                {latestPayment && (
                  <p className="mt-1 text-[12px] text-ink tabular-nums tracking-tight2">
                    {formatMoney(
                      latestPayment.amount,
                      latestPayment.currency
                    )}{" "}
                    수령
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-2.5 flex flex-col gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-between"
              onClick={() => openTransactionDetail(latest.id)}
            >
              <span>거래 상세</span>
              <ChevronRightIcon />
            </Button>
            {latestInvoice && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={() => openInvoiceDetail(latestInvoice.id)}
              >
                <span>Invoice 보기</span>
                <ChevronRightIcon />
              </Button>
            )}
            {/* STEP 89 — Tax Invoice CTA. Conditional on Invoice 존재. ghost
                톤 — Primary 1개 정책 (rule_15) 보존, "Invoice 보기" 옆 자연
                합류. 라벨은 entity 존재 여부에 따라 분기:
                  - 미발행: "+ 세금계산서 발급"
                  - 발행됨: "세금계산서 v{N}" (status hint 동반) */}
            {latestInvoice && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={handleTaxInvoiceCTA}
              >
                <span>
                  {latestTaxInvoice
                    ? `세금계산서 v${latestTaxInvoice.version}`
                    : "+ 세금계산서 발급"}
                </span>
                <ChevronRightIcon />
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-line p-3.5">
          <p className="text-[12px] text-ink-muted tracking-tightish">
            현재 등록된 거래가 없습니다.
          </p>
          <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1">
            INQUIRY → DEAL 전환 시 자동으로 생성됩니다.
          </p>
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: TransactionStatus }) {
  const color = TRANSACTION_STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{TRANSACTION_STATUS_LABEL[status]}</span>
    </span>
  );
}

/**
 * Resale loop badge (rule_13). Shown when transaction.isResale === true.
 * Uses the BROKERED status hue (#5E3FB8 — same purple as STATE_COLOR.BROKERED)
 * so visual identity stays consistent with the artwork state pill.
 *
 * Exported for reuse by TransactionHistory cards (STEP 14).
 */
export function ResalePill() {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase border"
      style={{
        color: "#5E3FB8",
        borderColor: "#E2D9F4",
        backgroundColor: "#F6F1FC",
      }}
    >
      Resale
    </span>
  );
}

function InvoicePill({ status }: { status: InvoiceStatus }) {
  const color = INVOICE_STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{INVOICE_STATUS_LABEL[status]}</span>
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

function ArrowFromIcon() {
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
      {/* corner-arrow: from above-left, down then right (∟→) */}
      <path d="M5 5v8a3 3 0 0 0 3 3h11" />
      <path d="m15 12 4 4-4 4" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
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

function LockMiniIcon({
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 text-ink-subtle shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
