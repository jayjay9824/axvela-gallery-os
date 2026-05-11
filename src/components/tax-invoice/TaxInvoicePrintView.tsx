"use client";

// ============================================================================
// TaxInvoicePrintView — STEP 89 Tax Invoice 인쇄 surface
//
// **본 view가 무엇을 하는가**:
//   `window.print()` 호출 시 *오직 본 영역만* 풀-스크린 인쇄. 나머지 모든
//   chrome (drawer / sidebar / detail panel / 다른 modals)은 `@media print`
//   visibility:hidden으로 숨김.
//
// **사용자 spec §4 detail view requirements 정확 매칭**:
//   - 공급가액 / VAT / 총액 (큰 typography로 prominent display)
//   - 발행 상태 (ISSUED 시점에만 인쇄 가능하므로 "발행 완료" 라벨)
//   - linked Invoice (id reference)
//   - linked Artwork (title + artist)
//   - issuedBy (lockedBy fallback)
//   - trust metadata projection (version + finalizedAt)
//
// **rule_16 minimalism**:
//   외부 라이브러리 0개 / pure React + Tailwind + browser native @media print.
//
// **Trust language 정책**:
//   사용: "세금계산서" / "운영 참고용 발급 기록" / "사업자 거래 확인용"
//   금지: "공식 세무 효력 보장" / "국세청 발급 완료" / "법적 증빙 완료" /
//         "세무 신고 완료" / "tax filing complete"
//
// **사용자 spec §3 + §9 Korean business context + UX**:
//   gallery-native 톤 / NOT government software / calm + trustworthy.
// ============================================================================

import * as React from "react";
import {
  TAX_INVOICE_STATUS_LABEL_KR,
  TAX_INVOICE_BUSINESS_TYPE_LABEL_KR,
  type TaxInvoice,
} from "@/types/tax-invoice";
import { formatMoney } from "@/lib/utils";

interface TaxInvoicePrintViewProps {
  taxInvoice: TaxInvoice;
  /** Display label for linked artwork — "{title} · {artist}". */
  artworkLabel?: string;
  /** Display reference for linked invoice — "Invoice {id}". */
  invoiceLabel?: string;
  /** Gallery name — header label. Defaults to "AXVELA Gallery". */
  galleryName?: string;
}

export function TaxInvoicePrintView({
  taxInvoice,
  artworkLabel,
  invoiceLabel,
  galleryName = "AXVELA Gallery",
}: TaxInvoicePrintViewProps) {
  const issuedDate = formatPrintDate(
    taxInvoice.finalizedAt ?? taxInvoice.issuedAt
  );

  return (
    <>
      {/* ── @media print visibility 격리 ──────────────────────────────────
          핵심 패턴 (Receipt와 정확 일관):
          - `body * { visibility: hidden }` — 다른 모든 UI 숨김
          - `.tax-invoice-print-area, .tax-invoice-print-area * { visibility: visible }`
          - `.tax-invoice-print-area` 자체는 fixed positioning으로 풀-스크린
          ───────────────────────────────────────────────────────────────── */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .tax-invoice-print-area,
          .tax-invoice-print-area * {
            visibility: visible;
          }
          .tax-invoice-print-area {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: white;
            padding: 0;
            margin: 0;
            overflow: visible;
          }
          @page {
            size: A4;
            margin: 16mm 12mm;
          }
        }
      `}</style>

      <div className="tax-invoice-print-area hidden print:block">
        <div className="max-w-[640px] mx-auto p-12 text-ink font-pretendard">
          {/* Header */}
          <header className="border-b border-black/15 pb-4">
            <h1 className="text-[22px] font-semibold tracking-tight2 leading-tight">
              {galleryName}
            </h1>
            <p className="mt-1 text-[14px] font-semibold tracking-tightish">
              세금계산서
            </p>
            <p className="mt-0.5 text-[10.5px] text-ink-muted tracking-tightish italic">
              운영 참고용 발급 기록 · 사업자 거래 확인용
            </p>
          </header>

          {/* Top metadata grid */}
          <section className="mt-6 grid grid-cols-[100px_1fr] gap-y-2 gap-x-4 text-[12px] tabular-nums">
            <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle font-semibold pt-0.5">
              발급번호
            </span>
            <span className="font-mono text-[12px]">
              TI-{taxInvoice.id.slice(-8).toUpperCase()}
            </span>

            <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle font-semibold pt-0.5">
              발행 시각
            </span>
            <span>{issuedDate}</span>

            <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle font-semibold pt-0.5">
              상태
            </span>
            <span>
              {TAX_INVOICE_STATUS_LABEL_KR[taxInvoice.status]} · v
              {taxInvoice.version}
            </span>

            <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle font-semibold pt-0.5">
              수신자 분류
            </span>
            <span>
              {TAX_INVOICE_BUSINESS_TYPE_LABEL_KR[taxInvoice.businessType]}
            </span>

            {invoiceLabel && (
              <>
                <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle font-semibold pt-0.5">
                  연결 인보이스
                </span>
                <span className="font-mono text-[11.5px]">{invoiceLabel}</span>
              </>
            )}

            {taxInvoice.lockedBy && (
              <>
                <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle font-semibold pt-0.5">
                  발행자
                </span>
                <span>{taxInvoice.lockedBy}</span>
              </>
            )}
          </section>

          {/* Artwork section */}
          {artworkLabel && (
            <section className="mt-6 pt-4 border-t border-black/10">
              <p className="text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle font-semibold">
                거래 작품
              </p>
              <p className="mt-1 text-[14px] tracking-tightish">{artworkLabel}</p>
            </section>
          )}

          {/* Memo */}
          {taxInvoice.memo && taxInvoice.memo.trim().length > 0 && (
            <section className="mt-6 pt-4 border-t border-black/10">
              <p className="text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle font-semibold">
                메모
              </p>
              <p className="mt-1 text-[12px] leading-relaxed">
                {taxInvoice.memo}
              </p>
            </section>
          )}

          {/* Amount block — bold border, prominent typography */}
          <section className="mt-6 border-t border-b border-black/15 py-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle font-semibold">
                공급가액
              </span>
              <span className="text-[14px] tabular-nums font-medium">
                {formatMoney(taxInvoice.amount, taxInvoice.currency)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle font-semibold">
                부가세 (VAT)
              </span>
              <span className="text-[14px] tabular-nums font-medium">
                {formatMoney(taxInvoice.vatAmount, taxInvoice.currency)}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-black/10 flex items-baseline justify-between">
              <span className="text-[12px] uppercase tracking-[0.14em] font-semibold">
                총액
              </span>
              <span className="text-[20px] font-semibold tabular-nums tracking-tight2">
                {formatMoney(taxInvoice.totalAmount, taxInvoice.currency)}
              </span>
            </div>
          </section>

          {/* Footer disclaimer (Trust Layer + AI Direction 정책 일관) */}
          <footer className="mt-8 pt-4 border-t border-black/10 text-[10px] text-ink-muted leading-relaxed italic">
            <p>
              본 세금계산서는 갤러리 운영 참고용 발급 기록입니다. 사업자 거래
              확인용으로 발행되었습니다.
            </p>
            <p className="mt-1">
              {taxInvoice.revisionReason && (
                <>정정 사유: {taxInvoice.revisionReason} · </>
              )}
              v{taxInvoice.version}
              {taxInvoice.parentTaxInvoiceId && (
                <> · 이전 버전 chain 보존</>
              )}
              {" · "}device-local activity record · {galleryName}
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatPrintDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return "—";
  }
}
