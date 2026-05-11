// ============================================================================
// accountant-export.ts — STEP 91 Accountant Export Package
//
// **본 모듈이 무엇인가**:
//   갤러리 운영자가 *회계사 / 세무 담당자에게 전달*할 수 있는 운영 record
//   handoff package를 만드는 pure helper. 기존 Invoice / Receipt / TaxInvoice /
//   Settlement / TaxRecord 데이터 위에 *cross-doc projection*. STEP 86 anchor의
//   *cross-doc 통합 사용* 시점.
//
// **본 모듈이 *아닌* 것** (사용자 spec 정조준):
//   - 세무 신고 시스템 (영구 out-of-scope, AXVELA_AI_DIRECTION §1)
//   - 국세청 자동 제출 (영구 out-of-scope)
//   - 회계 SaaS API 연동 (사용자 spec §8 future-ready slot only)
//   - ERP 회계 module
//
// **Trust language 정책 (AXVELA_AI_DIRECTION + AXVELA_TRUST_LAYER 강화)**:
//   - 사용: "회계 전달 준비" / "운영 참고" / "검토 필요" / "미완료 항목" /
//     "회계사 확인 필요" / "발급 기록"
//   - 금지: "세무 신고 완료" / "국세청 제출 완료" / "법적 효력 보장" /
//     "회계 확정" / "certified tax report" / "compliance verified" /
//     "tamper-proof"
//
// **STEP 86 anchor의 *cross-doc 통합 사용*** — 모든 fiscal entity를 *unified
//   trust vocabulary*로 단일 row 형태로 export. Invoice / Receipt / TaxInvoice /
//   Settlement 모두 STEP 86 슬롯 (`generatedBy?` / `lockedBy?` /
//   `sourceContext?`)을 보유 → row 변환 함수가 `deriveXxxTrust`를 호출하지 않고
//   직접 슬롯에서 read 가능 (추후 trust shape 변환 필요해지면 helper 사용).
//
// **rule_3 Money Flow Separation strict** — Invoice / Receipt / Tax Invoice /
//   Settlement / Tax 별도 *section*으로 분리. cross-section 단일 합산 0건.
//
// **rule_20 FX Lock 보존** — currency 그대로 표시. KRW 환산 0건 (Reporting 영역,
//   STEP 35).
//
// **CSV 호환성** — UTF-8 BOM (EF BB BF) prefix → Excel/Numbers 한국어 깨짐 방지.
//   Comma-separated, 큰따옴표 escape, RFC 4180 호환.
// ============================================================================

import type { Artwork } from "@/types/artwork";
import type { Inquiry } from "@/types/inquiry";
import type { Invoice } from "@/types/invoice";
import type { Receipt } from "@/types/receipt";
import type { Settlement } from "@/types/settlement";
import type { TaxInvoice } from "@/types/tax-invoice";
import type { TaxRecord } from "@/types/tax";
import type { Transaction, Currency } from "@/types/transaction";
import {
  computeFiscalPeriodRange,
  type FiscalDateRange,
  type FiscalPeriodSelection,
} from "@/lib/fiscal-summary";
import {
  RECEIPT_STATUS_LABEL_KR,
  RECEIPT_DELIVERY_STATUS_LABEL_KR,
} from "@/types/receipt";
import {
  TAX_INVOICE_STATUS_LABEL_KR,
  TAX_INVOICE_BUSINESS_TYPE_LABEL_KR,
} from "@/types/tax-invoice";

// ============================================================================
// Pending / Missing item types (사용자 spec §7)
// ============================================================================

export type PendingItemKind =
  | "unpaid_invoice"
  | "receipt_pending"
  | "tax_invoice_pending"
  | "settlement_pending"
  | "missing_customer"
  | "missing_business_info";

export const PENDING_ITEM_LABEL_KR: Readonly<Record<PendingItemKind, string>> =
  {
    unpaid_invoice: "결제 미완료 인보이스",
    receipt_pending: "영수증 미발행",
    tax_invoice_pending: "세금계산서 발행 대기",
    settlement_pending: "정산 미완료",
    missing_customer: "고객 정보 부족",
    missing_business_info: "사업자 정보 검토 필요",
  } as const;

export interface PendingItem {
  kind: PendingItemKind;
  /** 운영자가 즉시 인지 가능한 한국어 label (Korean ko-KR). */
  label: string;
  /** 추가 detail (id 일부 / 금액 / 상태 등). */
  detail: string;
  /** Drilldown anchor — UI 클릭 시 사용 (옵셔널). */
  relatedKind?:
    | "invoice"
    | "receipt"
    | "tax_invoice"
    | "settlement"
    | "transaction";
  relatedId?: string;
}

// ============================================================================
// Export package shape
// ============================================================================

export interface AccountantExportInput {
  transactions: Transaction[];
  invoices: Invoice[];
  receipts: Receipt[];
  taxInvoices: TaxInvoice[];
  settlements: Settlement[];
  taxRecords: TaxRecord[];
  /** 작품 lookup (artworkId → Artwork) for inline title/artist 표시. */
  artworks: Record<string, Artwork>;
  /** Inquiry lookup (artworkId → Inquiry[]) — customer 추적 (Invoice에 customerId 부재). */
  inquiries: Record<string, Inquiry[]>;
  selection: FiscalPeriodSelection;
  /** 옵셔널 — export metadata에 포함될 갤러리 이름 (운영 식별 메모). */
  galleryName?: string;
}

export interface AccountantExportMetadata {
  generatedAt: string;
  period: FiscalDateRange;
  selection: FiscalPeriodSelection;
  galleryName?: string;
  /** Counts of *included* documents (period filter 적용 후). */
  counts: {
    invoices: number;
    receipts: number;
    taxInvoices: number;
    settlements: number;
    taxRecords: number;
  };
  /** Counts of *missing/pending* operational items. */
  pendingCount: number;
}

export interface AccountantExportPackage {
  metadata: AccountantExportMetadata;
  /** Full CSV content with UTF-8 BOM prefix. */
  csvContent: string;
  /** Suggested download filename. */
  filename: string;
  /** Pending items for UI display (also included as CSV section 7). */
  pendingItems: PendingItem[];
}

// ============================================================================
// Build package — pure function
// ============================================================================

/**
 * Build the accountant export package — CSV + pending items.
 *
 * Pure / no side effects / no DOM / no fetch.
 *
 * **rule_3 strict**: 도메인별 section 분리. cross-section 단일 합산 0건.
 *
 * **rule_20 FX Lock**: currency 그대로 표시. KRW 환산 0건.
 *
 * **운영 톤**: section header는 "Invoice 발행 record" / "영수증 운영 record"
 * 등 *운영 record* 톤. "세무 신고용" / "국세청 제출용" 0건.
 */
export function buildAccountantExportPackage(
  input: AccountantExportInput
): AccountantExportPackage {
  const range = computeFiscalPeriodRange(input.selection);
  const startMs = new Date(range.start).getTime();
  const endMs = new Date(range.end).getTime();

  // Period 적용
  const inv = input.invoices.filter((i) => {
    const refIso = i.paidAt ?? i.sentAt ?? i.issuedAt;
    if (!refIso) return false;
    const ms = new Date(refIso).getTime();
    return ms >= startMs && ms <= endMs;
  });
  const rcp = input.receipts.filter((r) => {
    const refIso = r.finalizedAt ?? r.issuedAt;
    if (!refIso) return false;
    const ms = new Date(refIso).getTime();
    return ms >= startMs && ms <= endMs;
  });
  const ti = input.taxInvoices.filter((t) => {
    const refIso = t.finalizedAt ?? t.issuedAt;
    if (!refIso) return false;
    const ms = new Date(refIso).getTime();
    return ms >= startMs && ms <= endMs;
  });
  const stl = input.settlements.filter((s) => {
    const refIso = s.settledAt ?? s.createdAt;
    if (!refIso) return false;
    const ms = new Date(refIso).getTime();
    return ms >= startMs && ms <= endMs;
  });
  const tax = input.taxRecords.filter((t) => {
    const refIso = t.issuedAt ?? t.createdAt;
    if (!refIso) return false;
    const ms = new Date(refIso).getTime();
    return ms >= startMs && ms <= endMs;
  });
  const txInRange = input.transactions.filter((t) => {
    if (!t.createdAt) return false;
    const ms = new Date(t.createdAt).getTime();
    return ms >= startMs && ms <= endMs;
  });

  // Pending items detection (사용자 spec §7)
  const pendingItems: PendingItem[] = [];

  // Unpaid invoices
  inv.forEach((i) => {
    if (i.status !== "PAID") {
      pendingItems.push({
        kind: "unpaid_invoice",
        label: PENDING_ITEM_LABEL_KR.unpaid_invoice,
        detail: `${shortId(i.id)} · ${i.status} · ${formatAmount(i.amount, i.currency)}`,
        relatedKind: "invoice",
        relatedId: i.id,
      });
    }
  });

  // Receipt not issued for PAID transactions
  txInRange.forEach((t) => {
    if (t.status === "PAID" || t.status === "SETTLED" || t.status === "COMPLETED") {
      const linkedReceipts = input.receipts.filter(
        (r) => r.transactionId === t.id && r.status === "ISSUED"
      );
      if (linkedReceipts.length === 0) {
        pendingItems.push({
          kind: "receipt_pending",
          label: PENDING_ITEM_LABEL_KR.receipt_pending,
          detail: `tx ${shortId(t.id)} · ${formatAmount(t.agreedPrice ?? 0, t.currency)}`,
          relatedKind: "transaction",
          relatedId: t.id,
        });
      }
    }
  });

  // Tax Invoice DRAFT (대기 중)
  ti.forEach((t) => {
    if (t.status === "DRAFT") {
      pendingItems.push({
        kind: "tax_invoice_pending",
        label: PENDING_ITEM_LABEL_KR.tax_invoice_pending,
        detail: `${shortId(t.id)} · v${t.version} · ${formatAmount(t.totalAmount, t.currency)}`,
        relatedKind: "tax_invoice",
        relatedId: t.id,
      });
    }
    if (t.businessType === "other") {
      pendingItems.push({
        kind: "missing_business_info",
        label: PENDING_ITEM_LABEL_KR.missing_business_info,
        detail: `세금계산서 ${shortId(t.id)} · businessType=other`,
        relatedKind: "tax_invoice",
        relatedId: t.id,
      });
    }
  });

  // Settlement 미완료
  stl.forEach((s) => {
    if (s.status !== "COMPLETED") {
      pendingItems.push({
        kind: "settlement_pending",
        label: PENDING_ITEM_LABEL_KR.settlement_pending,
        detail: `${shortId(s.id)} · ${s.status} · ${formatAmount(s.totalAmount, s.currency)}`,
        relatedKind: "settlement",
        relatedId: s.id,
      });
    }
  });

  // Missing customer info — Invoice가 PAID인데 source inquiry의 collectorName이
  // 비어있는 경우. (Invoice 자체에 customerId 슬롯이 없으므로 inquiry 기반 조회.)
  inv.forEach((i) => {
    if (i.status !== "PAID") return;
    const tx = input.transactions.find((t) => t.id === i.transactionId);
    if (!tx) return;
    if (tx.buyerName?.trim()) return; // 직접 입력된 buyer 이름 있음
    const inqList = input.inquiries[tx.artworkId] ?? [];
    const linkedInquiry = tx.inquiryId
      ? inqList.find((iq) => iq.id === tx.inquiryId)
      : undefined;
    if (!linkedInquiry?.collectorName?.trim()) {
      pendingItems.push({
        kind: "missing_customer",
        label: PENDING_ITEM_LABEL_KR.missing_customer,
        detail: `Invoice ${shortId(i.id)} · 거래 buyer/inquiry collector 모두 비어있음`,
        relatedKind: "invoice",
        relatedId: i.id,
      });
    }
  });

  // ── CSV build ──────────────────────────────────────────────────────────
  const lines: string[] = [];

  // Section 1: Metadata
  lines.push(commentRow("SECTION 1 — Export Metadata"));
  lines.push(csvRow(["Field", "Value"]));
  lines.push(csvRow(["generated_at", new Date().toISOString()]));
  lines.push(csvRow(["period_kind", input.selection.kind]));
  lines.push(csvRow(["period_start", range.start]));
  lines.push(csvRow(["period_end", range.end]));
  lines.push(csvRow(["period_label", range.label]));
  if (input.galleryName) lines.push(csvRow(["gallery_name", input.galleryName]));
  lines.push(csvRow(["doc_type_note", "운영 참고 — NOT 세무 신고 완료"]));
  lines.push(csvRow(["counts_invoices", String(inv.length)]));
  lines.push(csvRow(["counts_receipts", String(rcp.length)]));
  lines.push(csvRow(["counts_tax_invoices", String(ti.length)]));
  lines.push(csvRow(["counts_settlements", String(stl.length)]));
  lines.push(csvRow(["counts_tax_records", String(tax.length)]));
  lines.push(csvRow(["counts_pending_items", String(pendingItems.length)]));
  lines.push("");

  // Section 2: Invoice
  lines.push(commentRow("SECTION 2 — Invoice 발행 record"));
  lines.push(
    csvRow([
      "doc_type",
      "doc_id",
      "version",
      "status",
      "amount",
      "currency",
      "issued_at",
      "sent_at",
      "paid_at",
      "generated_at",
      "generated_by",
      "locked_at",
      "locked_by",
      "finalized_at",
      "source_context",
      "revision_reason",
      "artwork_id",
      "artwork_title",
      "artist_name",
      "buyer_or_collector",
    ])
  );
  inv.forEach((i) => {
    const tx = input.transactions.find((t) => t.id === i.transactionId);
    const artwork = tx ? input.artworks[tx.artworkId] : undefined;
    const buyerName = resolveCustomerName(tx, input.inquiries);
    const finalizedAt = i.paidAt ?? null;
    lines.push(
      csvRow([
        "INVOICE",
        i.id,
        String(i.version),
        i.status,
        String(i.amount),
        i.currency,
        i.issuedAt,
        i.sentAt ?? "",
        i.paidAt ?? "",
        i.issuedAt,
        i.generatedBy ?? "AXVELA OS",
        i.lockedAt ?? "",
        i.lockedBy ?? "",
        finalizedAt ?? "",
        i.sourceContext ?? "manual",
        i.revisionReason ?? "",
        artwork?.id ?? tx?.artworkId ?? "",
        artwork?.title ?? "",
        artwork?.artist?.name ?? "",
        buyerName,
      ])
    );
  });
  lines.push("");

  // Section 3: Receipt
  lines.push(commentRow("SECTION 3 — 영수증 운영 record"));
  lines.push(
    csvRow([
      "doc_type",
      "doc_id",
      "version",
      "status",
      "amount",
      "currency",
      "issued_at",
      "finalized_at",
      "generated_at",
      "generated_by",
      "locked_at",
      "locked_by",
      "source_context",
      "revision_reason",
      "delivery_status",
      "last_printed_at",
      "last_pdf_exported_at",
      "linked_payment_id",
      "linked_transaction_id",
      "artwork_id",
      "artwork_title",
    ])
  );
  rcp.forEach((r) => {
    const artwork = input.artworks[r.artworkId];
    lines.push(
      csvRow([
        "RECEIPT",
        r.id,
        String(r.version),
        r.status,
        String(r.amount),
        r.currency,
        r.issuedAt,
        r.finalizedAt ?? "",
        r.issuedAt,
        r.generatedBy ?? "AXVELA OS",
        r.lockedAt ?? "",
        r.lockedBy ?? "",
        r.sourceContext ?? "auto",
        r.revisionReason ?? "",
        r.deliveryStatus
          ? RECEIPT_DELIVERY_STATUS_LABEL_KR[r.deliveryStatus]
          : "",
        r.lastPrintedAt ?? "",
        r.lastPdfExportedAt ?? "",
        r.paymentId,
        r.transactionId,
        r.artworkId,
        artwork?.title ?? "",
      ])
    );
  });
  lines.push("");

  // Section 4: Tax Invoice
  lines.push(commentRow("SECTION 4 — 세금계산서 발행 record"));
  lines.push(
    csvRow([
      "doc_type",
      "doc_id",
      "version",
      "status",
      "supply_amount",
      "vat_amount",
      "total_amount",
      "currency",
      "business_type",
      "issued_at",
      "finalized_at",
      "generated_at",
      "generated_by",
      "locked_at",
      "locked_by",
      "source_context",
      "revision_reason",
      "memo",
      "linked_invoice_id",
      "linked_receipt_id",
      "linked_transaction_id",
      "artwork_id",
      "artwork_title",
    ])
  );
  ti.forEach((t) => {
    const artwork = input.artworks[t.artworkId];
    lines.push(
      csvRow([
        "TAX_INVOICE",
        t.id,
        String(t.version),
        TAX_INVOICE_STATUS_LABEL_KR[t.status],
        String(t.amount),
        String(t.vatAmount),
        String(t.totalAmount),
        t.currency,
        TAX_INVOICE_BUSINESS_TYPE_LABEL_KR[t.businessType],
        t.issuedAt,
        t.finalizedAt ?? "",
        t.issuedAt,
        t.generatedBy ?? "AXVELA OS",
        t.lockedAt ?? "",
        t.lockedBy ?? "",
        t.sourceContext ?? "manual",
        t.revisionReason ?? "",
        t.memo ?? "",
        t.invoiceId,
        t.receiptId ?? "",
        t.transactionId,
        t.artworkId,
        artwork?.title ?? "",
      ])
    );
  });
  lines.push("");

  // Section 5: Settlement
  lines.push(commentRow("SECTION 5 — 정산 record"));
  lines.push(
    csvRow([
      "doc_type",
      "doc_id",
      "status",
      "total_amount",
      "artist_share",
      "gallery_share",
      "platform_fee",
      "currency",
      "settled_at",
      "linked_transaction_id",
      "artwork_id",
      "artwork_title",
      "artist_name",
    ])
  );
  stl.forEach((s) => {
    const artwork = input.artworks[s.artworkId];
    lines.push(
      csvRow([
        "SETTLEMENT",
        s.id,
        s.status,
        String(s.totalAmount),
        String(s.artistShare),
        String(s.galleryShare),
        s.platformFee !== undefined ? String(s.platformFee) : "",
        s.currency,
        s.settledAt ?? "",
        s.transactionId,
        s.artworkId,
        artwork?.title ?? "",
        artwork?.artist?.name ?? "",
      ])
    );
  });
  lines.push("");

  // Section 6: Tax records
  lines.push(commentRow("SECTION 6 — 세무 record (운영 참고)"));
  lines.push(
    csvRow([
      "doc_type",
      "doc_id",
      "status",
      "taxable_amount",
      "tax_amount",
      "currency",
      "issued_at",
      "linked_transaction_id",
      "artwork_id",
      "artwork_title",
    ])
  );
  tax.forEach((t) => {
    const artwork = input.artworks[t.artworkId];
    lines.push(
      csvRow([
        "TAX",
        t.id,
        t.status,
        String(t.taxableAmount),
        String(t.vatAmount),
        t.currency,
        t.issuedAt ?? "",
        t.transactionId,
        t.artworkId,
        artwork?.title ?? "",
      ])
    );
  });
  lines.push("");

  // Section 7: Pending / Missing items
  lines.push(commentRow("SECTION 7 — 미완료 항목 (회계사 확인 필요)"));
  if (pendingItems.length === 0) {
    lines.push(csvRow(["item_kind", "label", "detail"]));
    lines.push(csvRow(["-", "검토 필요 항목 없음", "본 기간 운영 record는 모두 정착 완료"]));
  } else {
    lines.push(csvRow(["item_kind", "label", "detail", "related_kind", "related_id"]));
    pendingItems.forEach((p) => {
      lines.push(
        csvRow([
          p.kind,
          p.label,
          p.detail,
          p.relatedKind ?? "",
          p.relatedId ?? "",
        ])
      );
    });
  }
  lines.push("");

  // Section 8: Operational notes
  lines.push(commentRow("SECTION 8 — 운영 안내"));
  lines.push(csvRow(["note"]));
  lines.push(
    csvRow([
      "본 export는 갤러리 운영 record를 회계사 / 세무 담당자에게 전달하기 위한 운영 참고 자료입니다.",
    ])
  );
  lines.push(
    csvRow([
      "세무 신고 완료 / 국세청 제출 완료 / 법적 효력 보장 / 회계 확정과 무관합니다.",
    ])
  );
  lines.push(
    csvRow([
      "회계사가 추가 검토 후 정식 처리하시기 바랍니다. 미완료 항목은 SECTION 7을 참고하세요.",
    ])
  );
  lines.push(
    csvRow([
      "본 record는 device-local 운영 시스템에서 생성됩니다. 외부 회계 SaaS / 정부 API 자동 제출은 지원하지 않습니다.",
    ])
  );

  // BOM + join
  const csvBody = lines.join("\r\n");
  const csvContent = "\uFEFF" + csvBody;

  // Filename
  const filename = buildFilename(input.selection, range);

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      period: range,
      selection: input.selection,
      galleryName: input.galleryName,
      counts: {
        invoices: inv.length,
        receipts: rcp.length,
        taxInvoices: ti.length,
        settlements: stl.length,
        taxRecords: tax.length,
      },
      pendingCount: pendingItems.length,
    },
    csvContent,
    filename,
    pendingItems,
  };
}

// ============================================================================
// Browser-side download trigger — UI calls this from a click handler
// ============================================================================

/**
 * Trigger browser download of CSV via Blob + ObjectURL pattern. Pure browser-
 * side — no fetch / no third-party library. Caller must run in client
 * component (`"use client"`).
 */
export function downloadCsv(filename: string, csvContent: string): void {
  if (typeof window === "undefined") return; // SSR safety
  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Schedule URL revoke after browser triggers download
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * RFC 4180 CSV row — escape cells containing comma / quote / newline by
 * wrapping in double quotes and doubling internal quotes.
 */
function csvRow(cells: string[]): string {
  return cells.map(escapeCell).join(",");
}

function escapeCell(value: string): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * 코멘트 행 — Excel/Numbers는 # 자체를 처리하지 않으므로 일반 cell로 들어감.
 * 단, 시각적으로 *section divider*로 식별 가능하도록 prefix 사용.
 */
function commentRow(text: string): string {
  return csvRow([`### ${text}`]);
}

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return id.slice(0, 12) + "…";
}

function formatAmount(amount: number, currency: Currency): string {
  const formatted = new Intl.NumberFormat("ko-KR").format(Math.round(amount));
  return `${formatted} ${currency}`;
}

function resolveCustomerName(
  tx: Transaction | undefined,
  inquiries: Record<string, Inquiry[]>
): string {
  if (!tx) return "";
  const direct = tx.buyerName?.trim();
  if (direct) return direct;
  const inqList = inquiries[tx.artworkId] ?? [];
  const linked = tx.inquiryId
    ? inqList.find((iq) => iq.id === tx.inquiryId)
    : undefined;
  return linked?.collectorName?.trim() ?? "";
}

function buildFilename(
  selection: FiscalPeriodSelection,
  range: FiscalDateRange
): string {
  // 운영 톤 — "tax_filing" / "compliance" 류 단어 0건
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_");
  const period =
    selection.kind === "monthly"
      ? safe(`${range.label}`)
      : selection.kind === "quarterly"
        ? safe(`${range.label}`)
        : safe(`${range.label}`);
  return `axvela_accountant_export_${selection.kind}_${period}.csv`;
}
