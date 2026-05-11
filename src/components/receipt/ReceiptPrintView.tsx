"use client";

// ============================================================================
// ReceiptPrintView — STEP 87 — Customer-Facing Receipt Layout
//
// **본 컴포넌트의 목적**:
//   `window.print()` 호출 시 *오직 본 영역만* 풀-스크린 인쇄. 나머지 모든 UI
//   (drawer, sidebar, detail panel, modals)는 `@media print` CSS로 숨김.
//   browser native print-to-PDF 흐름이 본 layout을 그대로 PDF로 저장.
//
// **본 컴포넌트가 *아닌* 것**:
//   - 별도 라우트 / 별도 페이지 (current artwork OS는 single-route, /print 페이지
//     없음 — 본 컴포넌트는 inline DOM에 mount 되었다가 print trigger 후 그대로 유지)
//   - PDF generator (외부 라이브러리 0개 — 사용자 spec)
//   - Email/SMS payload generator (실제 발송 영역 외)
//
// **인쇄 톤 (사용자 spec §4 준수)**:
//   - 사용 표현: "발급 기록" / "운영 참고 영수증" / "거래 확인용" / "고객 전달용"
//   - 금지 표현: "법적 증빙 보장" / "국세청 발급 완료" / "세무 신고 완료" /
//     "공식 세무 효력 보장"
//
// **A4-friendly 레이아웃**: A4 portrait 폭 기준 (210mm). 마진은 인쇄 환경에서
// 사용자가 시스템 dialog로 조절 가능. 본 컴포넌트는 *논리적 layout*만 제공.
//
// **rule_16 minimalism + Apple/OpenAI 톤**:
//   - 그림자 0
//   - 작은 typography
//   - 단색 monochrome
//   - chart / icon 0개
// ============================================================================

import * as React from "react";
import type { Receipt } from "@/types/receipt";
import { RECEIPT_STATUS_LABEL_KR } from "@/types/receipt";
import type { Artwork } from "@/types/artwork";
import type { Transaction } from "@/types/transaction";
import { formatMoney } from "@/lib/utils";

interface Props {
  receipt: Receipt;
  artwork: Artwork | null;
  transaction: Transaction | null;
  /** Gallery info — 운영자가 향후 settings에서 설정 가능 (현재는 default). */
  galleryName?: string;
  /** Customer 표시 — 단순 메모 / 발송 준비 시 prepareReceiptForSend의 contact. */
  customerLabel?: string;
}

/**
 * 거래 확인용 영수증 layout. `window.print()` 트리거 시 전체 페이지 영역.
 *
 * **운영 참고 톤** — 갤러리 직원이 *발급 후 바로 고객에게 전달 가능한 문서*
 * 느낌. tax office software 톤 *금지* (사용자 spec §6).
 */
export function ReceiptPrintView({
  receipt,
  artwork,
  transaction,
  galleryName = "AXVELA Gallery",
  customerLabel,
}: Props) {
  const issuedAtFormatted = formatPrintDateTime(receipt.issuedAt);
  const finalizedAtFormatted = receipt.finalizedAt
    ? formatPrintDateTime(receipt.finalizedAt)
    : null;

  return (
    <section
      data-receipt-print-id={receipt.id}
      className="receipt-print-area mx-auto max-w-[640px] bg-white text-black p-12 print:p-10 print:max-w-none print:w-full print:min-h-screen"
      aria-label="고객 전달용 영수증"
    >
      {/* Header — Gallery name + 운영 참고 영수증 라벨 */}
      <header className="border-b border-black/80 pb-5 mb-7">
        <div className="flex items-baseline justify-between">
          <h1 className="text-[18px] font-semibold tracking-tight2 text-black">
            {galleryName}
          </h1>
          <span className="text-[10px] uppercase tracking-[0.18em] text-black/60">
            운영 참고 영수증
          </span>
        </div>
        <p className="mt-1 text-[11px] text-black/60">
          거래 확인용 · 고객 전달용
        </p>
      </header>

      {/* Top metadata grid — 발급 / 발행 / 상태 */}
      <dl className="grid grid-cols-[120px_1fr] gap-y-2 gap-x-6 text-[12px] text-black/80 mb-7">
        <dt className="text-black/55">영수증 번호</dt>
        <dd className="font-mono tabular-nums text-black">
          {formatReceiptNumber(receipt)}
        </dd>

        <dt className="text-black/55">발급 시각</dt>
        <dd className="tabular-nums">{issuedAtFormatted}</dd>

        {finalizedAtFormatted && (
          <>
            <dt className="text-black/55">발행 완료</dt>
            <dd className="tabular-nums">{finalizedAtFormatted}</dd>
          </>
        )}

        <dt className="text-black/55">상태</dt>
        <dd>{RECEIPT_STATUS_LABEL_KR[receipt.status]}</dd>

        {customerLabel && (
          <>
            <dt className="text-black/55">고객</dt>
            <dd>{customerLabel}</dd>
          </>
        )}
      </dl>

      {/* Item — Artwork detail */}
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
          </div>
        </section>
      )}

      {/* Amount block */}
      <section className="mb-7 border-t border-b border-black/15 py-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em] text-black/55">
            수령 금액
          </span>
          <span className="text-[20px] font-semibold tabular-nums text-black tracking-tight">
            {formatMoney(receipt.amount, receipt.currency)}
          </span>
        </div>
        {transaction && (
          <p className="mt-1.5 text-[10.5px] text-black/55 text-right">
            거래 ID · {transaction.id}
          </p>
        )}
      </section>

      {/* Footer — 운영 톤 disclaimer (사용자 spec §4 준수) */}
      <footer className="text-[10px] text-black/55 leading-[1.6]">
        <p>
          본 영수증은 갤러리 운영 참고용 발급 기록이며, 고객 전달용 거래 확인
          문서입니다.
        </p>
        <p className="mt-2 tabular-nums">
          v{receipt.version}
          {receipt.parentReceiptId ? " · 재발행본" : ""}
          {receipt.revisionReason ? ` · ${receipt.revisionReason}` : ""}
        </p>
        <p className="mt-3 text-black/45">
          {galleryName} · device-local activity record
        </p>
      </footer>

      {/* Print-only CSS — 본 영역만 인쇄, 나머지 UI 모두 숨김. */}
      <style jsx global>{`
        @media print {
          /* Hide everything by default */
          body * {
            visibility: hidden;
          }
          /* Show only the print area + descendants */
          .receipt-print-area,
          .receipt-print-area * {
            visibility: visible;
          }
          /* Anchor print area to top-left of page */
          .receipt-print-area {
            position: absolute;
            inset: 0;
            margin: 0;
            box-shadow: none;
          }
          /* Page margins use system defaults — let user adjust in print dialog */
          @page {
            margin: 14mm;
          }
        }
      `}</style>
    </section>
  );
}

// ============================================================================
// helpers — pure formatting
// ============================================================================

function formatPrintDateTime(iso: string): string {
  // YYYY.MM.DD HH:mm — Korean operational tone, tabular-friendly.
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
 * 영수증 번호 — 운영 참고 ID. 외부 정부 시스템 번호와 구분 (사용자 spec §4).
 * 형식: "RCT-{6자리 short id}" — 갤러리 내부 추적용.
 */
function formatReceiptNumber(receipt: Receipt): string {
  const short = receipt.id.slice(-8).toUpperCase();
  return `RCT-${short}`;
}
