"use client";

// ============================================================================
// InvoicePrintView — STEP 129 — Invoice 인쇄 surface (PRE/FINAL 분기)
//
// **본 컴포넌트의 목적**:
//   `window.print()` 호출 시 *오직 본 영역만* 풀-스크린 인쇄. 나머지 모든
//   UI (drawer, sidebar, detail panel, modals) 는 `@media print` CSS 로 숨김.
//   browser native print-to-PDF 흐름이 본 layout 을 그대로 PDF 로 저장.
//   STEP 87 ReceiptPrintView / STEP 89 TaxInvoicePrintView 패턴 답습.
//
// **PRE / FINAL 분기 (STEP 127 + STEP 128 §5 정합)**:
//   - FINAL invoice (default): 표준 인보이스 layout (결제용 정식 문서)
//   - PRE invoice: 동일 layout + "PRO FORMA — NOT FOR PAYMENT" watermark
//                  + "결제 대상 아님 — buyer 안내용" disclaimer
//
// **STEP 132 forward-compat**:
//   현재 browser native `window.print()` 답습 — STEP 132 (Server-side PDF
//   Architecture) 진입 시점에 신규 영역만 server-side PDF 로 전환 결정
//   (사용자 결정 2026-05-12, STEP 128 §9 항목 6 정정).
//
// **AXID 표기 (STEP 127 Phase 1 §2.7 옵션 Z + STEP 129)**:
//   `formatAxidForDocument(axid)` helper 가 internal `AXV-YYYY-NNNN` →
//   display `AX-YYYY-KR-NNNNNN` 변환. 시스템 식별자 무손상.
//
// **Trust language 정책 (AXVELA_AI_DIRECTION 일관)**:
//   사용: "거래 청구 문서" / "결제 안내" / "buyer 안내용" / "운영 참고용 발급 기록"
//   금지: "법적 효력 보장" / "세무 신고 완료" / "공식 거래 확정"
//
// **rule_16 minimalism**: 외부 라이브러리 0개 / pure React + Tailwind +
// browser native @media print. 그림자 0 / chart 0 / monochrome.
// ============================================================================

import * as React from "react";
import type { Invoice } from "@/types/invoice";
import type { Artwork } from "@/types/artwork";
import type { Transaction } from "@/types/transaction";
import {
  formatMoney,
  INVOICE_STATUS_LABEL,
  formatAxidForDocument,
} from "@/lib/utils";
import { getInvoiceKind } from "@/lib/invoice-helpers";

interface Props {
  invoice: Invoice;
  artwork: Artwork | null;
  transaction: Transaction | null;
  /** Gallery info — 운영자가 settings 에서 설정 가능 (현재는 default). */
  galleryName?: string;
}

/**
 * Invoice (Pre / Final) 인쇄 layout. `window.print()` 트리거 시 전체 페이지.
 *
 * **PRE 분기**:
 *   header 에 "PRO FORMA — NOT FOR PAYMENT" 명시 + amount 옆 안내 disclaimer.
 *
 * **rule_16 minimalism** — calm institutional tone, gallery-native (NOT tax
 * office software, NOT SaaS finance app).
 */
export function InvoicePrintView({
  invoice,
  artwork,
  transaction,
  galleryName = "AXVELA Gallery",
}: Props) {
  const invoiceKind = getInvoiceKind(invoice);
  const isPre = invoiceKind === "pre";

  const issuedAtFormatted = formatPrintDateTime(invoice.issuedAt);
  const sentAtFormatted = invoice.sentAt
    ? formatPrintDateTime(invoice.sentAt)
    : null;
  const paidAtFormatted = invoice.paidAt
    ? formatPrintDateTime(invoice.paidAt)
    : null;

  const headerLabel = isPre ? "PRO FORMA INVOICE" : "INVOICE";
  const documentTitleKR = isPre ? "예비 인보이스 (Pro Forma)" : "거래 청구서";
  const documentSubtitle = isPre
    ? "buyer 안내용 · 결제 대상 아님"
    : "결제용 정식 문서 · 운영 참고용 발급 기록";

  return (
    <section
      data-invoice-print-id={invoice.id}
      data-invoice-kind={invoiceKind}
      className="invoice-print-area mx-auto max-w-[640px] bg-white text-black p-12 print:p-10 print:max-w-none print:w-full print:min-h-screen"
      aria-label={isPre ? "Pro Forma 예비 인보이스" : "거래 청구서"}
    >
      {/* Header — Gallery name + Invoice kind 라벨 */}
      <header className="border-b border-black/80 pb-5 mb-7">
        <div className="flex items-baseline justify-between">
          <h1 className="text-[18px] font-semibold tracking-tight2 text-black">
            {galleryName}
          </h1>
          <span className="text-[10px] uppercase tracking-[0.18em] text-black/60">
            {headerLabel}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-black/60">{documentSubtitle}</p>
      </header>

      {/* PRE invoice — prominent watermark / disclaimer banner */}
      {isPre && (
        <div className="mb-7 border-2 border-black/40 px-4 py-3 text-center">
          <p className="text-[14px] font-semibold tracking-[0.12em] uppercase text-black">
            PRO FORMA — NOT FOR PAYMENT
          </p>
          <p className="mt-1 text-[10.5px] text-black/65 tracking-tightish">
            본 문서는 buyer 안내용 예비 인보이스입니다. 실제 결제는 정식 인보이스
            (Final) 발행 후 진행됩니다.
          </p>
        </div>
      )}

      {/* Top metadata grid */}
      <dl className="grid grid-cols-[120px_1fr] gap-y-2 gap-x-6 text-[12px] text-black/80 mb-7">
        <dt className="text-black/55">{documentTitleKR} 번호</dt>
        <dd className="font-mono tabular-nums text-black">
          {formatInvoiceNumber(invoice)}
        </dd>

        <dt className="text-black/55">발급 시각</dt>
        <dd className="tabular-nums">{issuedAtFormatted}</dd>

        {sentAtFormatted && (
          <>
            <dt className="text-black/55">발송 시각</dt>
            <dd className="tabular-nums">{sentAtFormatted}</dd>
          </>
        )}

        {paidAtFormatted && (
          <>
            <dt className="text-black/55">결제 완료</dt>
            <dd className="tabular-nums">{paidAtFormatted}</dd>
          </>
        )}

        <dt className="text-black/55">상태</dt>
        <dd>{INVOICE_STATUS_LABEL[invoice.status]}</dd>

        <dt className="text-black/55">분류</dt>
        <dd className="text-black/80">
          {isPre ? "예비 (Pro Forma)" : "정식 (Final)"}
        </dd>

        {transaction && (
          <>
            <dt className="text-black/55">구매자</dt>
            <dd>{transaction.buyerName?.trim() || "—"}</dd>
          </>
        )}
      </dl>

      {/* Artwork item */}
      {artwork && (
        <section className="mb-7">
          <h2 className="text-[10px] uppercase tracking-[0.18em] text-black/55 mb-3">
            거래 항목
          </h2>
          <div className="border border-black/15 rounded-md p-4">
            <p className="text-[13px] font-medium text-black">
              {artwork.title || "(제목 없음)"}
            </p>
            <p className="mt-0.5 text-[11.5px] text-black/70">
              {artwork.artist.name || "—"}
              {artwork.year ? ` · ${artwork.year}` : ""}
            </p>
            {(artwork.medium || artwork.dimensions) && (
              <p className="mt-1 text-[11px] text-black/55">
                {artwork.medium ?? ""}
                {artwork.medium && artwork.dimensions ? " · " : ""}
                {artwork.dimensions ?? ""}
              </p>
            )}
            <p className="mt-2 text-[10.5px] text-black/55 font-mono tracking-tightish">
              {formatAxidForDocument(artwork.axid)}
            </p>
          </div>
        </section>
      )}

      {/* Amount block — prominent typography */}
      <section className="mb-7 border-t border-b border-black/15 py-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em] text-black/55">
            {isPre ? "청구 예정 금액" : "청구 금액"}
          </span>
          <span className="text-[20px] font-semibold tabular-nums text-black tracking-tight">
            {formatMoney(invoice.amount, invoice.currency)}
          </span>
        </div>
        {/* FX snapshot (KRW 환산 참고) */}
        {invoice.fxSnapshot && invoice.fxSnapshot.quoteCurrency === "KRW" && (
          <p className="mt-2 text-[10.5px] text-black/55 text-right tabular-nums">
            환율 참고 · {invoice.fxSnapshot.baseCurrency} →{" "}
            {invoice.fxSnapshot.quoteCurrency}{" "}
            {invoice.fxSnapshot.rate.toLocaleString("en-US", {
              maximumFractionDigits: 4,
            })}
          </p>
        )}
        {transaction && (
          <p className="mt-1.5 text-[10.5px] text-black/55 text-right">
            거래 ID · {transaction.id}
          </p>
        )}
      </section>

      {/* Footer — operational tone disclaimer */}
      <footer className="text-[10px] text-black/55 leading-[1.6]">
        {isPre ? (
          <p>
            본 예비 인보이스는 buyer 안내용 pro forma 문서입니다. 정식 거래는
            Final 인보이스 발행 시점에 성립되며, 결제는 Final 문서 기준으로
            진행됩니다.
          </p>
        ) : (
          <p>
            본 인보이스는 갤러리 운영 참고용 발급 기록이며, buyer 결제 안내
            문서입니다.
          </p>
        )}
        <p className="mt-2 tabular-nums">
          v{invoice.version}
          {invoice.parentInvoiceId ? " · 재발행본" : ""}
          {invoice.revisionReason ? ` · ${invoice.revisionReason}` : ""}
        </p>
        <p className="mt-3 text-black/45">
          {galleryName} · device-local activity record
        </p>
      </footer>

      {/* Print-only CSS — 본 영역만 인쇄, 나머지 UI 모두 숨김. */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .invoice-print-area,
          .invoice-print-area * {
            visibility: visible;
          }
          .invoice-print-area {
            position: absolute;
            inset: 0;
            margin: 0;
            box-shadow: none;
          }
          @page {
            margin: 14mm;
          }
        }
      `}</style>
    </section>
  );
}

// ============================================================================
// Helpers — pure formatting
// ============================================================================

function formatPrintDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

/**
 * Invoice 번호 — 운영 참고 ID. STEP 87 ReceiptPrintView 패턴 답습.
 * PRE 시 "PI-" / FINAL 시 "INV-" prefix 로 분류 시인성 강화.
 */
function formatInvoiceNumber(invoice: Invoice): string {
  const short = invoice.id.slice(-8).toUpperCase();
  const prefix = getInvoiceKind(invoice) === "pre" ? "PI" : "INV";
  return `${prefix}-${short}`;
}
