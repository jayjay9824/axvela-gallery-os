"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  useArtworkStore,
  type InvoiceUpdate,
} from "@/store/useArtworkStore";
import {
  formatMoney,
  formatRelativeKR,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_COLOR,
  TRANSACTION_STATUS_LABEL,
  CURRENCY_LABEL,
} from "@/lib/utils";
import type { Invoice, InvoiceStatus } from "@/types/invoice";
import type { Transaction, Currency } from "@/types/transaction";
import type { Artwork } from "@/types/artwork";
// STEP 129 — Invoice PRE/FINAL 분기 + 인쇄 surface mount
import { getInvoiceKind } from "@/lib/invoice-helpers";
import { InvoicePrintView } from "./InvoicePrintView";
import { DocumentWritingAssistButton } from "@/components/document/DocumentWritingAssistButton";
import { TranslationToolbar } from "@/components/translation";
// Document Lifecycle Clarity STEP — lifecycle helpers + sub-components
import {
  buildInvoiceVersionChain,
  getInvoiceNextAction,
  getInvoiceStateBadges,
} from "@/lib/document-lifecycle";
import { NextActionBanner } from "@/components/document-lifecycle/NextActionBanner";
import { DocumentActivityTimeline } from "@/components/document-lifecycle/DocumentActivityTimeline";
import { VersionHistoryStrip } from "@/components/document-lifecycle/VersionHistoryStrip";
import { ApprovalSlotPlaceholder } from "@/components/document-lifecycle/ApprovalSlotPlaceholder";
import { StateBadgeStrip } from "@/components/document-lifecycle/StateBadgeStrip";

const CURRENCY_OPTIONS = (Object.keys(CURRENCY_LABEL) as Currency[]).map(
  (c) => ({ value: c, label: CURRENCY_LABEL[c] })
);

// ============================================================================
// Drawer wrapper
// ============================================================================

export function InvoiceDetailDrawer() {
  const invoiceDetailRequest = useArtworkStore(
    (s) => s.invoiceDetailRequest
  );
  const closeInvoiceDetail = useArtworkStore((s) => s.closeInvoiceDetail);
  const invoices = useArtworkStore((s) => s.invoices);
  const transactions = useArtworkStore((s) => s.transactions);
  const artworks = useArtworkStore((s) => s.artworks);

  const isOpen = invoiceDetailRequest.kind === "open";

  const inv: Invoice | undefined = isOpen
    ? Object.values(invoices)
        .flat()
        .find((i) => i.id === invoiceDetailRequest.invoiceId)
    : undefined;

  const tx: Transaction | undefined = inv
    ? Object.values(transactions)
        .flat()
        .find((t) => t.id === inv.transactionId)
    : undefined;

  const artwork: Artwork | undefined = tx
    ? artworks.find((a) => a.id === tx.artworkId)
    : undefined;

  // Locate the parent (predecessor) version, if any, for the chain header
  const parent: Invoice | undefined = inv?.parentInvoiceId
    ? Object.values(invoices)
        .flat()
        .find((i) => i.id === inv.parentInvoiceId)
    : undefined;

  return (
    <>
      <Drawer
        open={isOpen}
        onClose={closeInvoiceDetail}
        title={inv ? `Invoice 상세 · v${inv.version}` : "Invoice 상세"}
      >
        {isOpen && inv && tx && artwork && (
          <InvoiceView
            key={inv.id}
            invoice={inv}
            transaction={tx}
            artwork={artwork}
            parent={parent}
            onClose={closeInvoiceDetail}
          />
        )}
      </Drawer>

      {/* STEP 129 — Hidden printable area. window.print() 트리거 시에만 보임.
          locked invoice 한정 (DRAFT 단계 인쇄 미지원 — PRE 도 SENT/LOCK 진입
          후 pro-forma 출력 가능). STEP 87 ReceiptDetailDrawer 패턴 답습. */}
      {isOpen && inv && tx && artwork && inv.isLocked && (
        <div className="hidden print:block">
          <InvoicePrintView invoice={inv} artwork={artwork} transaction={tx} />
        </div>
      )}
    </>
  );
}

// ============================================================================
// View — branches on lock state
// ============================================================================

interface InvoiceViewProps {
  invoice: Invoice;
  transaction: Transaction;
  artwork: Artwork;
  parent: Invoice | undefined;
  onClose: () => void;
}

function InvoiceView(props: InvoiceViewProps) {
  return props.invoice.isLocked ? (
    <LockedInvoiceView {...props} />
  ) : (
    <DraftInvoiceForm {...props} />
  );
}

// ============================================================================
// DRAFT mode — editable, sendable
// ============================================================================

function DraftInvoiceForm({
  invoice,
  transaction,
  artwork,
  parent,
  onClose,
}: InvoiceViewProps) {
  const updateInvoice = useArtworkStore((s) => s.updateInvoice);
  const sendInvoice = useArtworkStore((s) => s.sendInvoice);

  // STEP 129 — 4-layer 방어 layer (d): send button label PRE/FINAL 분기.
  // PRE = buyer 안내용 pro-forma 발송, FINAL = 결제용 정식 인보이스 발송.
  const invoiceKind = getInvoiceKind(invoice);
  const sendButtonLabel =
    invoiceKind === "pre" ? "PRE (안내용) 발송" : "결제용 Invoice 발송";

  const [amountRaw, setAmountRaw] = React.useState(String(invoice.amount));
  const [currency, setCurrency] = React.useState<Currency>(invoice.currency);

  const numericAmount = Number(amountRaw.replace(/[^\d]/g, "")) || 0;
  const amountDisplay = formatMoney(numericAmount, currency);

  const isDirty =
    numericAmount !== invoice.amount || currency !== invoice.currency;

  const persistChanges = () => {
    if (!isDirty) return;
    const patch: InvoiceUpdate = {
      amount: numericAmount,
      currency,
    };
    updateInvoice(invoice.id, patch);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    persistChanges();
  };

  const handleSend = () => {
    if (isDirty) persistChanges();
    sendInvoice(invoice.id);
    onClose();
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full" noValidate>
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        <Header
          invoice={invoice}
          transaction={transaction}
          artwork={artwork}
          parent={parent}
        />

        {/* DRAFT banner */}
        <div className="mb-5 px-3 py-2.5 rounded-md bg-status-deal/5 border border-status-deal/30">
          <p className="text-[11.5px] text-status-deal tracking-tightish font-medium">
            초안 상태 · 수정 가능
          </p>
          <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish">
            발송 시 자동으로 잠기며 이후 수정은 새 버전 생성으로만
            가능합니다.
          </p>
        </div>

        <Section label="청구 금액">
          <TextField
            label="금액"
            value={amountRaw}
            onChange={(e) =>
              setAmountRaw(e.target.value.replace(/[^\d]/g, ""))
            }
            placeholder="0"
            inputMode="numeric"
            hint={amountDisplay}
            required
          />
          <Select
            label="통화"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            options={CURRENCY_OPTIONS}
            hint="발송 시점 환율로 Lock됩니다"
          />
        </Section>

        <Divider />

        <Section label="AI 정리 보조">
          <DocumentWritingAssistButton
            target="invoice"
            buildSourceText={() =>
              `청구 금액 ${amountDisplay} (${currency}). 작품: ${artwork?.title ?? "-"} / ${artwork?.artist.name ?? "-"}.`
            }
            buildContext={() =>
              `Invoice ${invoice.id} · ${invoice.status} · 작품 ${artwork?.title ?? ""}`
            }
            onApply={(text) => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(text).catch(() => {});
              }
            }}
            applyButtonLabel="복사"
          />
        </Section>

        <Divider />

        {/* STEP 96 — 다국어 보기 (translation projection) */}
        <Section label="다국어 보기">
          <TranslationToolbar
            buildSourceText={() =>
              `청구 금액 ${amountDisplay} (${currency}). 작품: ${artwork?.title ?? "-"} / ${artwork?.artist.name ?? "-"}.`
            }
            domain="invoice"
          />
        </Section>

        <Divider />

        <Section label="문서 이력">
          <DocumentTrail invoice={invoice} />
        </Section>
      </div>

      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>
        <Button
          type="submit"
          variant="secondary"
          disabled={!isDirty}
          aria-disabled={!isDirty}
        >
          변경 저장
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSend}
          disabled={numericAmount <= 0}
          aria-disabled={numericAmount <= 0}
        >
          {sendButtonLabel}
        </Button>
      </footer>
    </form>
  );
}

// ============================================================================
// LOCKED mode — read-only, fork to new version
// ============================================================================

function LockedInvoiceView({
  invoice,
  transaction,
  artwork,
  parent,
  onClose,
}: InvoiceViewProps) {
  const createInvoiceVersion = useArtworkStore(
    (s) => s.createInvoiceVersion
  );
  // Document Lifecycle Clarity STEP — store selectors for lifecycle components
  const allInvoicesForTx = useArtworkStore(
    (s) => s.invoices[invoice.transactionId] ?? []
  );
  const timelineForArtwork = useArtworkStore(
    (s) => s.timeline[transaction.artworkId] ?? []
  );

  // Document Lifecycle Clarity STEP — derive lifecycle context
  const versionChain = React.useMemo(
    () => buildInvoiceVersionChain(invoice, allInvoicesForTx),
    [invoice, allInvoicesForTx]
  );
  // 본 invoice가 chain head가 아니면 새 버전이 존재 = archived
  const hasNewerVersion = versionChain.length > 0 && versionChain[0].invoice.id !== invoice.id;
  const nextAction = React.useMemo(
    () => getInvoiceNextAction(invoice, hasNewerVersion),
    [invoice, hasNewerVersion]
  );
  const stateBadges = React.useMemo(
    () => getInvoiceStateBadges(invoice, hasNewerVersion),
    [invoice, hasNewerVersion]
  );
  const chainIds = React.useMemo(
    () => versionChain.map((e) => e.invoice.id),
    [versionChain]
  );

  // STEP 129 — 인쇄 / PDF 저장 (browser native window.print). STEP 87 Receipt
  // / STEP 89 TaxInvoice 패턴 답습. PRE invoice 의 경우 InvoicePrintView 가
  // "PRO FORMA — NOT FOR PAYMENT" watermark 자동 표시.
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.setTimeout(() => window.print(), 50);
    }
  };

  // 새 버전 생성 — 옵셔널 사유 prompt (rule_16 minimalism — 큰 modal 회피, 기본
  // browser prompt로 가벼운 입력 받음. 향후 STEP에서 본격적인 inline form으로
  // 진화 가능. 지금은 운영자가 빠르게 사유를 남기거나 비워둘 수 있어야 함.)
  const handleNewVersion = () => {
    if (typeof window === "undefined") {
      createInvoiceVersion(invoice.id);
      return;
    }
    const input = window.prompt(
      "새 버전 생성 — 수정 사유 (선택)\n\n예: 가격 수정 / 배송 주소 정정 / 작품 정보 수정\n\n비워두고 OK를 누르면 사유 없이 생성됩니다.",
      ""
    );
    // input === null이면 사용자가 취소 — 새 버전 생성 안 함
    if (input === null) return;
    createInvoiceVersion(invoice.id, input);
    // store re-targets the drawer to the new draft — no manual close needed
  };

  // Document Lifecycle Clarity STEP — institutional locked wording (사용자 spec
  // "이 문서는 잠겨 있습니다" → "최종 발송본" / 운영 톤)
  const lockedHeadline = hasNewerVersion
    ? "이 문서는 이전 발행본입니다"
    : invoice.status === "PAID"
      ? "이 문서는 결제 완료된 발송본입니다"
      : "이 문서는 최종 발송본입니다";

  const lockedBody = hasNewerVersion
    ? `현재 버전(v${invoice.version})은 더 이상 활성 발송본이 아닙니다. 가장 최근 버전을 확인하세요.`
    : `현재 버전(v${invoice.version})은 보호 상태이며 수정할 수 없습니다. 변경이 필요한 경우 새 버전을 생성하세요.`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
        <Header
          invoice={invoice}
          transaction={transaction}
          artwork={artwork}
          parent={parent}
        />

        {/* Document Lifecycle Clarity STEP — Next Required Action banner */}
        <NextActionBanner meta={nextAction} />

        {/* Document Lifecycle Clarity STEP — multi-state badge strip */}
        {stateBadges.length > 0 && (
          <div className="mb-4">
            <StateBadgeStrip badges={stateBadges} />
          </div>
        )}

        {/* Locked banner — institutional operational tone (사용자 spec) */}
        <div className="mb-5 px-3 py-3 rounded-md bg-surface-muted border border-line-strong flex items-start gap-2.5">
          <LockIcon />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-ink tracking-tightish font-semibold">
              {lockedHeadline}
            </p>
            <p className="text-[10.5px] text-ink-muted mt-0.5 tracking-tightish leading-snug">
              {lockedBody}
            </p>
            {/* Document Lifecycle Clarity STEP — 발송 시각 명시 (사용자 spec
                "Also surface: final sent time / locked state / current version") */}
            {invoice.sentAt && !hasNewerVersion && (
              <p className="text-[10.5px] text-ink-subtle mt-1.5 tracking-tightish tabular-nums">
                <span className="text-ink-subtle/80">최종 발송 · </span>
                {formatRelativeKR(invoice.sentAt)}
              </p>
            )}
            {invoice.lockedAt && (
              <p className="text-[10px] text-ink-subtle/80 mt-0.5 tracking-tightish tabular-nums">
                잠금 시각 · {formatRelativeKR(invoice.lockedAt)}
              </p>
            )}
            {invoice.revisionReason && (
              <p className="text-[10px] text-ink-subtle mt-0.5 tracking-tightish italic">
                생성 사유 · {invoice.revisionReason}
              </p>
            )}
          </div>
        </div>

        <Section label="청구 금액">
          {/* Disabled mirror of the editable form so the layout stays consistent */}
          <TextField
            label="금액"
            value={String(invoice.amount)}
            readOnly
            disabled
            hint={formatMoney(invoice.amount, invoice.currency)}
          />
          <Select
            label="통화"
            value={invoice.currency}
            onChange={() => undefined}
            options={CURRENCY_OPTIONS}
            disabled
            hint="발행 시점 환율로 Lock됨"
          />
        </Section>

        <Divider />

        {/* STEP 32 — FX Snapshot 섹션 (locked invoice 한정) */}
        <Section label="FX 환율 스냅샷">
          <FXSnapshotPanel invoice={invoice} />
        </Section>

        <Divider />

        {/* Document Lifecycle Clarity STEP — Version chain visualization */}
        {versionChain.length > 1 && (
          <>
            <Section label="버전 이력">
              <VersionHistoryStrip
                chain={versionChain}
                currentlyViewingId={invoice.id}
              />
            </Section>
            <Divider />
          </>
        )}

        <Section label="문서 이력">
          <DocumentTrail invoice={invoice} />
        </Section>

        <Divider />

        {/* STEP 96 — 다국어 보기 (locked invoice — customer-facing translation) */}
        <Section label="다국어 보기">
          <TranslationToolbar
            buildSourceText={() =>
              `청구 금액 ${formatMoney(invoice.amount, invoice.currency)} (${invoice.currency}). 작품: ${artwork?.title ?? "-"} / ${artwork?.artist.name ?? "-"}.`
            }
            domain="invoice"
          />
        </Section>

        <Divider />

        {/* Document Lifecycle Clarity STEP — operational activity timeline */}
        <Section label="문서 활동">
          <DocumentActivityTimeline
            events={timelineForArtwork}
            entityType="invoice"
            entityIds={chainIds}
            emptyMessage="이 인보이스의 운영 활동이 아직 기록되지 않았습니다."
          />
        </Section>

        <Divider />

        {/* Document Lifecycle Clarity STEP — Approval Workflow reserved slot
            (실제 데이터는 STEP 101+ Approval Workflow 활성 시 표시) */}
        <Section label="승인">
          <ApprovalSlotPlaceholder documentLabel="Invoice" />
        </Section>
      </div>

      <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end gap-2 bg-surface">
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>
        {/* STEP 129 — 인쇄 / PDF 저장 (browser native, STEP 87/89 답습) */}
        <Button type="button" variant="ghost" onClick={handlePrint}>
          인쇄 / PDF 저장
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleNewVersion}
        >
          새 버전 생성
        </Button>
      </footer>
    </div>
  );
}

// ============================================================================
// Shared header
// ============================================================================

function Header({
  invoice,
  transaction,
  artwork,
  parent,
}: {
  invoice: Invoice;
  transaction: Transaction;
  artwork: Artwork;
  parent: Invoice | undefined;
}) {
  return (
    <>
      {/* Linked artwork */}
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

      {/* Linked transaction */}
      <div className="mb-5 px-3 py-2 rounded-md border border-line">
        <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
          연결된 Transaction
        </p>
        <p className="text-[11.5px] text-ink-muted mt-0.5 tracking-tightish">
          {transaction.buyerName.trim() || "(구매자 미지정)"} ·{" "}
          {TRANSACTION_STATUS_LABEL[transaction.status]}
        </p>
      </div>

      {/* Status + version chain */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
            상태
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <StatusPill status={invoice.status} />
            {invoice.isLocked && <LockBadge />}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
            버전
          </p>
          <p className="text-[14px] text-ink mt-1 font-mono tabular-nums tracking-tight2">
            v{invoice.version}
          </p>
          {parent && (
            <p className="text-[10.5px] text-ink-subtle mt-0.5 tracking-tightish">
              v{parent.version}에서 파생
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// FX Snapshot panel (STEP 32 — Invoice FX Lock Wiring)
// ============================================================================

function FXSnapshotPanel({ invoice }: { invoice: Invoice }) {
  // KRW invoice → snapshot 없음 (갤러리 base currency)
  if (invoice.currency === "KRW") {
    return (
      <p className="text-[11px] text-ink-muted tracking-tightish leading-relaxed">
        KRW 기준 인보이스 — FX snapshot 없음
      </p>
    );
  }

  // Non-KRW + snapshot 미존재 (예: createFXSnapshot이 unknown pair로 null 반환 — 방어)
  if (!invoice.fxSnapshot) {
    return (
      <p className="text-[11px] text-ink-muted tracking-tightish leading-relaxed">
        본 버전은 FX snapshot 없이 잠겼습니다 — 정산 시 현재 환율 기준 사용
      </p>
    );
  }

  const fx = invoice.fxSnapshot;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <Meta
        label="환율 쌍"
        value={`${fx.baseCurrency} → ${fx.quoteCurrency}`}
        mono
      />
      <Meta
        label="환율"
        value={`1 ${fx.baseCurrency} = ${fx.rate.toLocaleString("en-US", {
          maximumFractionDigits: 4,
        })} ${fx.quoteCurrency}`}
      />
      <Meta label="Provider" value={fx.provider} mono />
      <Meta label="Capture 시점" value={formatRelativeKR(fx.fetchedAt)} />
      {fx.validUntil ? (
        <Meta label="유효 만료" value={formatRelativeKR(fx.validUntil)} />
      ) : (
        <Meta label="유효 만료" value="제한 없음" muted />
      )}
      {fx.sourceNote && (
        <div className="col-span-2 mt-1 px-2.5 py-1.5 rounded border border-line bg-surface-muted">
          <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
            sourceNote
          </p>
          <p className="text-[11px] text-ink-muted mt-0.5 tracking-tightish leading-relaxed">
            {fx.sourceNote}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Document trail (read-only metadata grid)
// ============================================================================

function DocumentTrail({ invoice }: { invoice: Invoice }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <Meta label="Invoice ID" value={invoice.id} mono />
      <Meta label="발행" value={formatRelativeKR(invoice.issuedAt)} />
      {invoice.sentAt ? (
        <Meta label="발송" value={formatRelativeKR(invoice.sentAt)} />
      ) : (
        <Meta label="발송" value="—" muted />
      )}
      {invoice.paidAt ? (
        <Meta label="결제" value={formatRelativeKR(invoice.paidAt)} />
      ) : (
        <Meta label="결제" value="—" muted />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local primitives
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: InvoiceStatus }) {
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

function LockBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-ink/[0.04] border border-line text-ink-muted">
      <LockMiniIcon />
      잠김
    </span>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-ink-muted shrink-0 mt-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function LockMiniIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0"
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

function Meta({
  label,
  value,
  mono,
  muted,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
        {label}
      </p>
      <p
        className={`text-[12px] mt-0.5 tracking-tightish ${
          muted ? "text-ink-subtle" : "text-ink-muted"
        } ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function Section({
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
