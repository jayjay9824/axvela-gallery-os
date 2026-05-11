"use client";

// ============================================================================
// TaxInvoiceDetailDrawer — STEP 89 Tax Invoice 운영 surface
//
// **본 drawer가 무엇을 하는가**:
//   1. DRAFT taxInvoice: amount/VAT/total/businessType/memo 편집 + "발행" 버튼으로
//      ISSUED 진입 (LOCK)
//   2. ISSUED taxInvoice: [프린트] / [PDF 저장] / [고객 발송 준비] 액션 + 메타 표시
//   3. Version chain: 새 버전 생성 / 이전 버전 표시 (Receipt 패턴 정확 일관)
//   4. 발송 흐름: deliveryStatus 라벨 + 발송 준비 시각 / 운영자 / 수신자 contact
//
// **사용자 spec §4 detail view 정확 매칭**:
//   - 공급가액 / VAT / 총액 (편집 가능 DRAFT, read-only ISSUED)
//   - 발행 상태 (DRAFT/ISSUED + version)
//   - linked Invoice (id reference + Invoice drawer drilldown)
//   - linked Artwork (title + artist)
//   - issuedBy (lockedBy fallback "AXVELA OS")
//   - trust metadata projection (deriveTaxInvoiceTrust 결과 표시)
//
// **사용자 spec §7 Print/Send Preparation**:
//   - [프린트] → markTaxInvoicePrinted() + window.print() (browser native)
//   - [PDF 저장] → markTaxInvoicePdfExported() + window.print()
//   - [고객 발송 준비] → 메모 입력 modal → prepareTaxInvoiceForSend(id, contact)
//
// **사용자 spec §9 UX Principles**:
//   - calm + trustworthy + operational + gallery-native
//   - NOT government software / ERP
//   - low cognitive load
//
// **AI Direction / Trust Layer 정책 일관**:
//   - 사용 표현: "세금계산서" / "사업자용 세금계산서" / "발행 대기" / "발행 완료" /
//     "정산 준비" / "운영 record"
//   - 금지: "공식 세무 효력 보장" / "국세청 발급 완료" / "법적 증빙 완료" /
//     "compliance verified" / "tax filing complete" / "tamper-proof"
// ============================================================================

import * as React from "react";
import { useArtworkStore } from "@/store/useArtworkStore";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { TranslationToolbar } from "@/components/translation";
import { formatMoney } from "@/lib/utils";
import {
  TAX_INVOICE_STATUS_LABEL_KR,
  TAX_INVOICE_BUSINESS_TYPE_LABEL_KR,
  TAX_INVOICE_DELIVERY_STATUS_LABEL_KR,
  type TaxInvoice,
  type TaxInvoiceBusinessType,
  type TaxInvoiceDeliveryStatus,
} from "@/types/tax-invoice";
import { TaxInvoicePrintView } from "./TaxInvoicePrintView";

export function TaxInvoiceDetailDrawer() {
  const taxInvoiceDetailRequest = useArtworkStore(
    (s) => s.taxInvoiceDetailRequest
  );
  const closeTaxInvoiceDetail = useArtworkStore(
    (s) => s.closeTaxInvoiceDetail
  );

  const isOpen = taxInvoiceDetailRequest.kind === "open";
  const taxInvoiceId =
    taxInvoiceDetailRequest.kind === "open"
      ? taxInvoiceDetailRequest.taxInvoiceId
      : null;

  return (
    <Drawer
      open={isOpen}
      onClose={closeTaxInvoiceDetail}
      title="세금계산서"
      widthClass="w-[600px]"
    >
      {taxInvoiceId && <Body taxInvoiceId={taxInvoiceId} />}
    </Drawer>
  );
}

// ============================================================================
// Body — DRAFT edit / ISSUED actions / Version chain / Delivery prep
// ============================================================================

function Body({ taxInvoiceId }: { taxInvoiceId: string }) {
  // Lookup target taxInvoice + sibling versions for chain display
  const taxInvoices = useArtworkStore((s) => s.taxInvoices);
  const transactions = useArtworkStore((s) => s.transactions);
  const artworks = useArtworkStore((s) => s.artworks);
  const invoices = useArtworkStore((s) => s.invoices);

  const updateTaxInvoiceDraft = useArtworkStore(
    (s) => s.updateTaxInvoiceDraft
  );
  const issueTaxInvoice = useArtworkStore((s) => s.issueTaxInvoice);
  const createTaxInvoiceVersion = useArtworkStore(
    (s) => s.createTaxInvoiceVersion
  );
  const markTaxInvoicePrinted = useArtworkStore(
    (s) => s.markTaxInvoicePrinted
  );
  const markTaxInvoicePdfExported = useArtworkStore(
    (s) => s.markTaxInvoicePdfExported
  );
  const prepareTaxInvoiceForSend = useArtworkStore(
    (s) => s.prepareTaxInvoiceForSend
  );
  const openTaxInvoiceDetail = useArtworkStore((s) => s.openTaxInvoiceDetail);
  const openInvoiceDetail = useArtworkStore((s) => s.openInvoiceDetail);

  // Find the target + its transaction + version siblings
  const lookup = React.useMemo(() => {
    for (const [txId, list] of Object.entries(taxInvoices)) {
      const found = list.find((ti) => ti.id === taxInvoiceId);
      if (found) {
        return { taxInvoice: found, txId, siblings: list };
      }
    }
    return null;
  }, [taxInvoices, taxInvoiceId]);

  // Linked artwork + invoice for context display
  const artwork = lookup
    ? Object.values(artworks).find((a) => a.id === lookup.taxInvoice.artworkId)
    : undefined;
  const invoice = lookup
    ? (invoices[lookup.txId] ?? []).find(
        (i) => i.id === lookup.taxInvoice.invoiceId
      )
    : undefined;

  // Send-prepare modal local state
  const [sendModalOpen, setSendModalOpen] = React.useState(false);
  const [recipientContact, setRecipientContact] = React.useState("");

  // DRAFT edit local state — synced from store entity, debounced commit
  const taxInvoice = lookup?.taxInvoice;
  const isDraft = taxInvoice?.status === "DRAFT" && !taxInvoice?.isLocked;
  const isIssued = taxInvoice?.status === "ISSUED" || taxInvoice?.isLocked;

  if (!lookup || !taxInvoice) {
    return (
      <div className="px-1 py-2">
        <p className="text-[12px] text-ink-muted tracking-tightish">
          세금계산서 record를 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  const handleIssue = () => {
    issueTaxInvoice(taxInvoice.id);
  };

  const handlePrint = () => {
    markTaxInvoicePrinted(taxInvoice.id);
    // Browser native print — only the print-area is visible (CSS @media)
    window.print();
  };

  const handlePdfSave = () => {
    markTaxInvoicePdfExported(taxInvoice.id);
    // 사용자가 print 다이얼로그에서 "PDF로 저장" 선택 — 외부 라이브러리 0개
    window.print();
  };

  const handlePrepareSend = () => {
    prepareTaxInvoiceForSend(taxInvoice.id, recipientContact.trim() || undefined);
    setSendModalOpen(false);
    setRecipientContact("");
  };

  const handleNewVersion = () => {
    const reason = window.prompt(
      "새 버전 생성 사유 (예: 금액 정정, 수신자 정보 수정)",
      ""
    );
    if (reason === null) return; // canceled
    const newId = createTaxInvoiceVersion(taxInvoice.id, reason || undefined);
    if (newId) openTaxInvoiceDetail(newId);
  };

  const handleCopySummary = async () => {
    const summary = [
      `세금계산서 v${taxInvoice.version}`,
      `발행번호: TI-${taxInvoice.id.slice(-8).toUpperCase()}`,
      `상태: ${TAX_INVOICE_STATUS_LABEL_KR[taxInvoice.status]}`,
      `공급가액: ${formatMoney(taxInvoice.amount, taxInvoice.currency)}`,
      `부가세: ${formatMoney(taxInvoice.vatAmount, taxInvoice.currency)}`,
      `총액: ${formatMoney(taxInvoice.totalAmount, taxInvoice.currency)}`,
      `수신자 분류: ${TAX_INVOICE_BUSINESS_TYPE_LABEL_KR[taxInvoice.businessType]}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(summary);
    } catch {
      // ignore
    }
  };

  const artworkLabel = artwork
    ? `${artwork.title} · ${artwork.artist.name}`
    : undefined;

  return (
    <>
      <div className="flex flex-col gap-5 px-1 print:hidden">
        {/* ── Status banner ─────────────────────────────────────────────── */}
        <section
          className={`rounded-md border px-4 py-3 ${
            isIssued
              ? "border-line bg-surface-muted/30"
              : "border-dashed border-line bg-surface"
          }`}
        >
          <div className="flex items-baseline justify-between">
            <p className="text-[12px] font-semibold tracking-tightish text-ink">
              {TAX_INVOICE_STATUS_LABEL_KR[taxInvoice.status]}
              <span className="ml-2 text-[10.5px] text-ink-subtle font-normal">
                v{taxInvoice.version}
              </span>
            </p>
            <span className="text-[10.5px] text-ink-subtle tracking-tightish font-mono">
              TI-{taxInvoice.id.slice(-8).toUpperCase()}
            </span>
          </div>
          <p className="mt-1.5 text-[10.5px] text-ink-subtle italic leading-relaxed">
            {isIssued
              ? "발행 완료 — LOCK 상태입니다. 정정 필요 시 새 버전으로 생성하세요."
              : "발행 전 DRAFT입니다. 금액 / VAT / 수신자 분류를 확인 후 발행하세요."}
          </p>
        </section>

        {/* ── Linked references ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-2.5">
          <ZoneLabel>연결 정보</ZoneLabel>
          {artwork && (
            <RowLink label="작품">
              {artworkLabel}
            </RowLink>
          )}
          {invoice && (
            <RowLink
              label="인보이스"
              onClick={() => openInvoiceDetail(invoice.id)}
              clickable
            >
              v{invoice.version} ·{" "}
              {formatMoney(invoice.amount, invoice.currency)}
            </RowLink>
          )}
        </section>

        {/* ── Amount block ──────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2.5">
          <ZoneLabel>금액</ZoneLabel>
          <div className="rounded-md border border-line bg-surface px-4 py-3">
            <AmountRow
              label="공급가액"
              value={taxInvoice.amount}
              currency={taxInvoice.currency}
              editable={isDraft}
              onCommit={(next) =>
                updateTaxInvoiceDraft(taxInvoice.id, { amount: next })
              }
            />
            <AmountRow
              label="부가세 (VAT)"
              value={taxInvoice.vatAmount}
              currency={taxInvoice.currency}
              editable={isDraft}
              onCommit={(next) =>
                updateTaxInvoiceDraft(taxInvoice.id, { vatAmount: next })
              }
            />
            <div className="mt-3 pt-3 border-t border-line">
              <AmountRow
                label="총액"
                value={taxInvoice.totalAmount}
                currency={taxInvoice.currency}
                editable={isDraft}
                emphasize
                onCommit={(next) =>
                  updateTaxInvoiceDraft(taxInvoice.id, { totalAmount: next })
                }
              />
            </div>
          </div>
          {isDraft && (
            <p className="text-[10px] text-ink-subtle italic leading-relaxed">
              한국 갤러리 retail 표준은 *VAT 포함 가격* (총액 = 공급가액 +
              VAT). 운영자가 직접 편집 가능합니다.
            </p>
          )}
        </section>

        {/* ── Business type ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2.5">
          <ZoneLabel>수신자 분류</ZoneLabel>
          <BusinessTypeSelector
            value={taxInvoice.businessType}
            disabled={!isDraft}
            onChange={(next) =>
              updateTaxInvoiceDraft(taxInvoice.id, { businessType: next })
            }
          />
        </section>

        {/* ── Memo ──────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2.5">
          <ZoneLabel>메모</ZoneLabel>
          {isDraft ? (
            <textarea
              defaultValue={taxInvoice.memo ?? ""}
              onBlur={(e) =>
                updateTaxInvoiceDraft(taxInvoice.id, { memo: e.target.value })
              }
              placeholder="운영 메모 (선택)"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-[12px] text-ink leading-relaxed tracking-tightish resize-none focus:outline-none focus:border-ink/40 transition-colors"
              rows={2}
            />
          ) : (
            <p className="text-[12px] text-ink-muted leading-relaxed tracking-tightish min-h-[1.5rem]">
              {taxInvoice.memo?.trim() || (
                <span className="italic text-ink-subtle">메모 없음</span>
              )}
            </p>
          )}
        </section>

        {/* ── STEP 96: 다국어 보기 (tax invoice projection) ──────────────── */}
        <section className="flex flex-col gap-2.5">
          <ZoneLabel>다국어 보기</ZoneLabel>
          <TranslationToolbar
            buildSourceText={() =>
              `세금계산서 v${taxInvoice.version} · 공급가액 ${formatMoney(
                taxInvoice.amount,
                taxInvoice.currency,
              )} · 부가세 ${formatMoney(
                taxInvoice.vatAmount,
                taxInvoice.currency,
              )} · 총액 ${formatMoney(
                taxInvoice.totalAmount,
                taxInvoice.currency,
              )}.`
            }
            domain="invoice"
          />
        </section>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2 pt-2 border-t border-line">
          {isDraft ? (
            <>
              <Button
                variant="primary"
                size="md"
                className="w-full justify-between"
                onClick={handleIssue}
              >
                <span>발행</span>
                <ChevronRightIcon />
              </Button>
              <p className="text-[10px] text-ink-subtle italic tracking-tightish">
                발행 후 [프린트] / [PDF 저장] / [고객 발송 준비] 사용 가능합니다.
              </p>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                size="md"
                className="w-full justify-between"
                onClick={handlePrint}
              >
                <span>프린트</span>
                <PrintIcon />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={handlePdfSave}
              >
                <span>PDF 저장</span>
                <ChevronRightIcon />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={() => setSendModalOpen(true)}
              >
                <span>고객 발송 준비</span>
                <ChevronRightIcon />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={handleCopySummary}
              >
                <span>요약 복사</span>
                <ChevronRightIcon />
              </Button>
            </>
          )}
        </section>

        {/* ── Send-prepare inline modal ─────────────────────────────────── */}
        {sendModalOpen && (
          <section className="rounded-md border border-line bg-surface-muted/30 px-4 py-3">
            <p className="text-[11.5px] font-semibold text-ink tracking-tightish">
              고객 발송 준비
            </p>
            <p className="mt-1 text-[10px] text-ink-subtle italic leading-relaxed">
              실제 외부 발송은 본 시스템에서 지원하지 않습니다 — 발송 준비 완료
              상태 + 운영 메모만 저장됩니다.
            </p>
            <input
              type="text"
              value={recipientContact}
              onChange={(e) => setRecipientContact(e.target.value)}
              placeholder="수신자 contact (이메일 / 사업자번호 / 식별 메모)"
              className="mt-2.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-[12px] text-ink tracking-tightish focus:outline-none focus:border-ink/40 transition-colors"
            />
            <div className="mt-2.5 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handlePrepareSend}
              >
                발송 준비 기록
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSendModalOpen(false);
                  setRecipientContact("");
                }}
              >
                취소
              </Button>
            </div>
          </section>
        )}

        {/* ── Delivery status ───────────────────────────────────────────── */}
        {isIssued && taxInvoice.deliveryStatus && (
          <section className="flex flex-col gap-2.5">
            <ZoneLabel>발송 상태</ZoneLabel>
            <DeliveryRow taxInvoice={taxInvoice} />
          </section>
        )}

        {/* ── Version chain (rule_4) ────────────────────────────────────── */}
        {isIssued && (
          <section className="flex flex-col gap-2.5 pt-3 border-t border-line">
            <ZoneLabel>버전 chain</ZoneLabel>
            <div className="flex flex-col gap-1">
              {[...lookup.siblings]
                .sort((a, b) => b.version - a.version)
                .map((ti) => (
                  <button
                    key={ti.id}
                    type="button"
                    disabled={ti.id === taxInvoice.id}
                    onClick={() => openTaxInvoiceDetail(ti.id)}
                    className={`flex items-baseline justify-between gap-2 rounded px-2 py-1.5 text-[11.5px] tracking-tightish transition-colors ${
                      ti.id === taxInvoice.id
                        ? "bg-surface-muted/40 text-ink font-medium cursor-default"
                        : "text-ink-muted hover:text-ink hover:bg-surface-muted/40 cursor-pointer"
                    }`}
                  >
                    <span>
                      v{ti.version} ·{" "}
                      {TAX_INVOICE_STATUS_LABEL_KR[ti.status]}
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(ti.totalAmount, ti.currency)}
                    </span>
                  </button>
                ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between"
              onClick={handleNewVersion}
            >
              <span>+ 새 버전 생성</span>
              <ChevronRightIcon />
            </Button>
            <p className="text-[10px] text-ink-subtle italic tracking-tightish leading-relaxed">
              발행 완료된 세금계산서는 정정 시 새 version으로 생성됩니다 (이전
              버전 보존).
            </p>
          </section>
        )}

        {/* ── Trust metadata footnote ───────────────────────────────────── */}
        <section className="pt-3 border-t border-line text-[10px] text-ink-subtle italic leading-relaxed">
          {taxInvoice.lastPrintedAt && (
            <p>마지막 인쇄: {formatRelative(taxInvoice.lastPrintedAt)}</p>
          )}
          {taxInvoice.lastPdfExportedAt && (
            <p>마지막 PDF 저장: {formatRelative(taxInvoice.lastPdfExportedAt)}</p>
          )}
          {taxInvoice.lockedBy && (
            <p>발행자: {taxInvoice.lockedBy}</p>
          )}
        </section>

        {/* ── Footer disclaimer ─────────────────────────────────────────── */}
        <section className="pt-3 border-t border-line">
          <p className="text-[10px] text-ink-subtle italic leading-relaxed">
            본 세금계산서는 갤러리 운영 참고용 발급 record입니다. 외부 회계
            시스템 / 정부 API 자동 제출은 본 시스템에서 지원하지 않습니다.
          </p>
        </section>
      </div>

      {/* Print-only render — only visible during window.print() */}
      {isIssued && (
        <TaxInvoicePrintView
          taxInvoice={taxInvoice}
          artworkLabel={artworkLabel}
          invoiceLabel={invoice ? `INV-${invoice.id.slice(-8).toUpperCase()}` : undefined}
        />
      )}
    </>
  );
}

// ============================================================================
// Sub-primitives
// ============================================================================

function ZoneLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9.5px] uppercase tracking-[0.2em] text-ink-subtle/70 font-semibold">
      {children}
    </p>
  );
}

function RowLink({
  label,
  children,
  onClick,
  clickable,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  clickable?: boolean;
}) {
  const Tag = clickable ? "button" : "div";
  return (
    <Tag
      onClick={clickable ? onClick : undefined}
      className={`flex items-baseline justify-between gap-2 rounded px-3 py-2 border border-line bg-surface text-[12px] tracking-tightish ${
        clickable
          ? "cursor-pointer hover:bg-surface-muted/40 transition-colors"
          : "cursor-default"
      }`}
    >
      <span className="text-ink-subtle text-[10.5px] uppercase tracking-[0.14em] font-semibold">
        {label}
      </span>
      <span className="text-ink min-w-0 truncate text-right">{children}</span>
    </Tag>
  );
}

function AmountRow({
  label,
  value,
  currency,
  editable,
  emphasize,
  onCommit,
}: {
  label: string;
  value: number;
  currency: string;
  editable: boolean;
  emphasize?: boolean;
  onCommit: (next: number) => void;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span
        className={`text-[10.5px] uppercase tracking-[0.14em] text-ink-subtle font-semibold ${
          emphasize ? "text-ink" : ""
        }`}
      >
        {label}
      </span>
      {editable ? (
        <input
          type="number"
          defaultValue={value}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n) || n < 0) return;
            if (n !== value) onCommit(n);
          }}
          className={`text-right tabular-nums w-32 rounded border border-line bg-surface px-2 py-1 focus:outline-none focus:border-ink/40 transition-colors ${
            emphasize
              ? "text-[16px] font-semibold tracking-tight2"
              : "text-[12px]"
          }`}
        />
      ) : (
        <span
          className={`tabular-nums ${
            emphasize
              ? "text-[16px] font-semibold tracking-tight2 text-ink"
              : "text-[12px] text-ink-muted"
          }`}
        >
          {formatMoney(value, currency as never)}
        </span>
      )}
    </div>
  );
}

function BusinessTypeSelector({
  value,
  disabled,
  onChange,
}: {
  value: TaxInvoiceBusinessType;
  disabled: boolean;
  onChange: (next: TaxInvoiceBusinessType) => void;
}) {
  const options: TaxInvoiceBusinessType[] = [
    "business",
    "individual",
    "tax_exempt",
    "other",
  ];
  return (
    <div className="inline-flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled && !active}
            onClick={() => !disabled && onChange(opt)}
            className={`px-2.5 py-1 rounded-md text-[11px] tracking-tightish transition-colors ${
              active
                ? "bg-ink text-white"
                : disabled
                  ? "bg-surface text-ink-subtle border border-line cursor-not-allowed"
                  : "bg-surface text-ink-muted border border-line hover:text-ink hover:bg-surface-muted/60"
            }`}
          >
            {TAX_INVOICE_BUSINESS_TYPE_LABEL_KR[opt]}
          </button>
        );
      })}
    </div>
  );
}

function DeliveryRow({ taxInvoice }: { taxInvoice: TaxInvoice }) {
  const status: TaxInvoiceDeliveryStatus =
    taxInvoice.deliveryStatus ?? "not_prepared";
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-[11.5px] tracking-tightish">
      <p className="text-ink">
        {TAX_INVOICE_DELIVERY_STATUS_LABEL_KR[status]}
      </p>
      {taxInvoice.preparedForSendAt && (
        <p className="mt-0.5 text-[10.5px] text-ink-subtle">
          {formatRelative(taxInvoice.preparedForSendAt)}
          {taxInvoice.preparedForSendBy && ` · ${taxInvoice.preparedForSendBy}`}
        </p>
      )}
      {taxInvoice.recipientContact && (
        <p className="mt-0.5 text-[10.5px] text-ink-muted">
          수신: {taxInvoice.recipientContact}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelative(iso: string): string {
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
