// src/components/invoice/InvoicePDFDocument.tsx
//
// ============================================================================
// InvoicePDFDocument — STEP 132 Phase 2 Commit 1 (Foundation)
//
// **본 컴포넌트의 목적**:
//   @react-pdf/renderer 의 <Document> / <Page> primitive 로 Invoice 를 PDF
//   문서로 렌더. Server-side 전용 — API route 에서 `renderToBuffer` 또는
//   `renderToStream` 으로 PDF buffer 생성.
//
// **InvoicePrintView (STEP 129) 와의 dimension 분리** (Phase 1 §8.2):
//   - InvoicePrintView = client-side `window.print()` surface (browser native).
//     정착물 **0줄 변경** (보존 약속).
//   - 본 컴포넌트 = server-side PDF 발급 surface. 같은 데이터 → 같은 layout,
//     별도 dimension. 시각 톤 (rule_16 minimalism) 답습.
//
// **PRE / FINAL 분기 (STEP 127 + STEP 128 §5 정합)**:
//   - FINAL invoice (default): 표준 인보이스 layout
//   - PRE invoice: 동일 layout + "PRO FORMA — NOT FOR PAYMENT" watermark
//                  + buyer 안내 disclaimer
//
// **i18n (Q5 결정 (A) + STEP 130 정합)**:
//   - 작품 title / artist name: `getTitle` / `getArtistName` 호출 (locale prop 종속).
//   - UI 라벨 ("거래 청구서", "결제 완료" 등): 한국어 그대로 (InvoicePrintView 답습).
//     라벨 i18n 은 별도 STEP scope (현재 commit 1 영역 외).
//
// **rule_4 Trust Layer 가드**:
//   본 컴포넌트는 *pure render* — 데이터만 받아 PDF 변환. LOCKED / DRAFT
//   guard 는 API route 에서 수행 (단일 책임 분리).
//
// **AXID 표기 (STEP 127 Phase 1 §2.7 옵션 Z)**:
//   `formatAxidForDocument(axid)` helper 가 internal `AXV-YYYY-NNNN` →
//   display `AX-YYYY-KR-NNNNNN` 변환. 시스템 식별자 무손상.
//
// **Trust language 정책 (AXVELA_AI_DIRECTION 일관)**:
//   사용: "거래 청구 문서" / "결제 안내" / "buyer 안내용" / "운영 참고용 발급 기록"
//   금지: "법적 효력 보장" / "세무 신고 완료" / "공식 거래 확정"
//
// **rule_16 minimalism**: @react-pdf/renderer + lib/pdf/styles (정착) +
// lib/utils / invoice-helpers / i18n-helpers (기존 정착) 만 사용. 추가 dep 0.
// ============================================================================

import * as React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { Invoice } from "@/types/invoice";
import type { Artwork } from "@/types/artwork";
import type { Transaction } from "@/types/transaction";
import type { DocumentLocale } from "@/lib/document-locale";
import { commonPDFStyles } from "@/lib/pdf/styles";
import { ensureFontsRegistered } from "@/lib/pdf/fonts";
import {
  formatMoney,
  INVOICE_STATUS_LABEL,
  formatAxidForDocument,
} from "@/lib/utils";
import { getInvoiceKind } from "@/lib/invoice-helpers";
import { getTitle, getArtistName } from "@/lib/i18n-helpers";

interface Props {
  invoice: Invoice;
  artwork: Artwork | null;
  transaction: Transaction | null;
  /** Locale for artwork title + artist name. UI labels remain Korean (Q5 (A) 정합). */
  locale: DocumentLocale;
  /** Gallery info — defaults to "AXVELA Gallery" (InvoicePrintView 답습). */
  galleryName?: string;
}

/**
 * Invoice (Pre / Final) 의 PDF 문서 컴포넌트. server-side `renderToBuffer`
 * 등에 그대로 전달.
 *
 * **rule_16 minimalism** — calm institutional tone, monochrome.
 *
 * @example
 *   import { renderToBuffer } from "@react-pdf/renderer";
 *   const buffer = await renderToBuffer(
 *     <InvoicePDFDocument
 *       invoice={inv}
 *       artwork={art}
 *       transaction={tx}
 *       locale="ko"
 *     />
 *   );
 */
export function InvoicePDFDocument({
  invoice,
  artwork,
  transaction,
  locale,
  galleryName = "AXVELA Gallery",
}: Props): React.JSX.Element {
  ensureFontsRegistered();

  const invoiceKind = getInvoiceKind(invoice);
  const isPre = invoiceKind === "pre";

  const issuedAtFormatted = formatPdfDateTime(invoice.issuedAt);
  const sentAtFormatted = invoice.sentAt
    ? formatPdfDateTime(invoice.sentAt)
    : null;
  const paidAtFormatted = invoice.paidAt
    ? formatPdfDateTime(invoice.paidAt)
    : null;

  const headerLabel = isPre ? "PRO FORMA INVOICE" : "INVOICE";
  const documentTitleKR = isPre ? "예비 인보이스 (Pro Forma)" : "거래 청구서";
  const documentSubtitle = isPre
    ? "buyer 안내용 · 결제 대상 아님"
    : "결제용 정식 문서 · 운영 참고용 발급 기록";

  return (
    <Document>
      <Page size="A4" style={commonPDFStyles.page}>
        {/* Header — Gallery name + Invoice kind label */}
        <View style={commonPDFStyles.header}>
          <View style={commonPDFStyles.headerRow}>
            <Text style={commonPDFStyles.galleryName}>{galleryName}</Text>
            <Text style={commonPDFStyles.headerLabel}>{headerLabel}</Text>
          </View>
          <Text style={commonPDFStyles.documentSubtitle}>
            {documentSubtitle}
          </Text>
        </View>

        {/* PRE invoice — prominent watermark banner */}
        {isPre && (
          <View style={commonPDFStyles.watermarkBanner}>
            <Text style={commonPDFStyles.watermarkLabel}>
              PRO FORMA — NOT FOR PAYMENT
            </Text>
            <Text style={commonPDFStyles.watermarkSubtitle}>
              본 문서는 buyer 안내용 예비 인보이스입니다. 실제 결제는 정식
              인보이스 (Final) 발행 후 진행됩니다.
            </Text>
          </View>
        )}

        {/* Metadata grid */}
        <View style={{ marginBottom: 28 }}>
          <View style={commonPDFStyles.metadataRow}>
            <Text style={commonPDFStyles.metadataLabel}>
              {documentTitleKR} 번호
            </Text>
            <Text style={commonPDFStyles.metadataValue}>
              {formatInvoiceNumber(invoice)}
            </Text>
          </View>

          <View style={commonPDFStyles.metadataRow}>
            <Text style={commonPDFStyles.metadataLabel}>발급 시각</Text>
            <Text style={commonPDFStyles.metadataValue}>
              {issuedAtFormatted}
            </Text>
          </View>

          {sentAtFormatted && (
            <View style={commonPDFStyles.metadataRow}>
              <Text style={commonPDFStyles.metadataLabel}>발송 시각</Text>
              <Text style={commonPDFStyles.metadataValue}>
                {sentAtFormatted}
              </Text>
            </View>
          )}

          {paidAtFormatted && (
            <View style={commonPDFStyles.metadataRow}>
              <Text style={commonPDFStyles.metadataLabel}>결제 완료</Text>
              <Text style={commonPDFStyles.metadataValue}>
                {paidAtFormatted}
              </Text>
            </View>
          )}

          <View style={commonPDFStyles.metadataRow}>
            <Text style={commonPDFStyles.metadataLabel}>상태</Text>
            <Text style={commonPDFStyles.metadataValue}>
              {INVOICE_STATUS_LABEL[invoice.status]}
            </Text>
          </View>

          <View style={commonPDFStyles.metadataRow}>
            <Text style={commonPDFStyles.metadataLabel}>분류</Text>
            <Text style={commonPDFStyles.metadataValue}>
              {isPre ? "예비 (Pro Forma)" : "정식 (Final)"}
            </Text>
          </View>

          {transaction && (
            <View style={commonPDFStyles.metadataRow}>
              <Text style={commonPDFStyles.metadataLabel}>구매자</Text>
              <Text style={commonPDFStyles.metadataValue}>
                {transaction.buyerName?.trim() || "—"}
              </Text>
            </View>
          )}
        </View>

        {/* Artwork item card */}
        {artwork && (
          <View>
            <Text style={commonPDFStyles.sectionLabel}>거래 항목</Text>
            <View style={commonPDFStyles.artworkCard}>
              <Text style={commonPDFStyles.artworkTitle}>
                {getTitle(artwork, locale) || "(제목 없음)"}
              </Text>
              <Text style={commonPDFStyles.artworkArtist}>
                {getArtistName(artwork.artist, locale) || "—"}
                {artwork.year ? ` · ${artwork.year}` : ""}
              </Text>
              {(artwork.medium || artwork.dimensions) && (
                <Text style={commonPDFStyles.artworkMeta}>
                  {artwork.medium ?? ""}
                  {artwork.medium && artwork.dimensions ? " · " : ""}
                  {artwork.dimensions ?? ""}
                </Text>
              )}
              <Text style={commonPDFStyles.artworkAxid}>
                {formatAxidForDocument(artwork.axid)}
              </Text>
            </View>
          </View>
        )}

        {/* Amount block — prominent typography */}
        <View style={commonPDFStyles.amountBlock}>
          <View style={commonPDFStyles.amountRow}>
            <Text style={commonPDFStyles.headerLabel}>
              {isPre ? "청구 예정 금액" : "청구 금액"}
            </Text>
            <Text style={commonPDFStyles.amount}>
              {formatMoney(invoice.amount, invoice.currency)}
            </Text>
          </View>
          {invoice.fxSnapshot &&
            invoice.fxSnapshot.quoteCurrency === "KRW" && (
              <Text style={commonPDFStyles.amountHint}>
                환율 참고 · {invoice.fxSnapshot.baseCurrency} →{" "}
                {invoice.fxSnapshot.quoteCurrency}{" "}
                {invoice.fxSnapshot.rate.toLocaleString("en-US", {
                  maximumFractionDigits: 4,
                })}
              </Text>
            )}
          {transaction && (
            <Text style={commonPDFStyles.amountHint}>
              거래 ID · {transaction.id}
            </Text>
          )}
        </View>

        {/* Footer — operational tone disclaimer */}
        <View>
          {isPre ? (
            <Text style={commonPDFStyles.footer}>
              본 예비 인보이스는 buyer 안내용 pro forma 문서입니다. 정식 거래는
              Final 인보이스 발행 시점에 성립되며, 결제는 Final 문서 기준으로
              진행됩니다.
            </Text>
          ) : (
            <Text style={commonPDFStyles.footer}>
              본 인보이스는 갤러리 운영 참고용 발급 기록이며, buyer 결제 안내
              문서입니다.
            </Text>
          )}
          <Text style={commonPDFStyles.footerVersion}>
            v{invoice.version}
            {invoice.parentInvoiceId ? " · 재발행본" : ""}
            {invoice.revisionReason ? ` · ${invoice.revisionReason}` : ""}
          </Text>
          <Text style={commonPDFStyles.footerGalleryAttr}>
            {galleryName} · device-local activity record
          </Text>
        </View>
      </Page>
    </Document>
  );
}

// ============================================================================
// Helpers — pure formatting (InvoicePrintView 답습)
// ============================================================================

function formatPdfDateTime(iso: string): string {
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
 * Invoice 번호 — 운영 참고 ID (InvoicePrintView formatInvoiceNumber 답습).
 * PRE 시 "PI-" / FINAL 시 "INV-" prefix.
 */
function formatInvoiceNumber(invoice: Invoice): string {
  const short = invoice.id.slice(-8).toUpperCase();
  const prefix = getInvoiceKind(invoice) === "pre" ? "PI" : "INV";
  return `${prefix}-${short}`;
}
