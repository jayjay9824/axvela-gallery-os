"use client";

// ============================================================================
// AccountantExportDrawer — STEP 91 Accountant Export Package
//
// **본 drawer가 무엇인가**:
//   갤러리 운영자가 *회계사 / 세무 담당자에게 전달*할 운영 record handoff
//   package를 생성·다운로드하는 UI surface. STEP 88 FiscalSummaryDrawer의
//   [회계 전달 준비] 버튼이 본 drawer를 연다.
//
// **본 drawer가 *아닌* 것** (사용자 spec 정조준):
//   - 회계 ledger / accountant portal → 본 STEP은 *handoff package*만
//   - 세무 신고 시스템 → 영구 out-of-scope
//   - government API 통합 → 영구 out-of-scope
//   - ERP 회계 module → tone 자체가 *gallery operations*
//
// **사용자 spec §5 톤**:
//   - 사용: "회계 전달 준비" / "운영 참고" / "검토 필요" / "미완료 항목" /
//     "회계사 확인 필요"
//   - 금지: "세무 신고 완료" / "국세청 제출 완료" / "법적 효력 보장" /
//     "회계 확정"
//
// **사용자 spec §6 UI Integration**:
//   - FiscalSummaryDrawer "회계 전달 준비" 버튼이 entry point
//   - 단일 Primary action ([CSV 다운로드])
//   - 복잡 dashboard / accounting UI 0건
//
// **사용자 spec §7 Pending/Missing Item Check**:
//   - unpaid invoice / receipt not issued / tax invoice pending /
//     settlement not completed / missing customer / missing business info
//   - operational guidance only (NOT validation block)
//
// **사용자 spec §8 Future API Ready**:
//   - 향후 회계 SaaS / 세무 app / accountant portal / external delivery
//     provider 연동 예정
//   - 본 STEP에서는 actual API 0건 — UI footer에만 명시
//
// **rule_3 / rule_4 / rule_15 / rule_16 / rule_17 일관**:
//   - 도메인별 section 분리 (rule_3)
//   - LOCK된 doc은 read-only로 export, source는 변경 0건 (rule_4)
//   - Primary 1개 ([CSV 다운로드])
//   - Apple/OpenAI minimalism — 그림자 0 / chart 0개
//   - drawer layer (3-Column 0줄 변경)
// ============================================================================

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  buildAccountantExportPackage,
  downloadCsv,
  PENDING_ITEM_LABEL_KR,
  type PendingItem,
} from "@/lib/accountant-export";
import {
  FISCAL_PERIOD_LABEL_KR,
  type FiscalPeriodKind,
} from "@/lib/fiscal-summary";
import { formatRelativeKR } from "@/lib/utils";

// ============================================================================
// Drawer wrapper
// ============================================================================

export function AccountantExportDrawer() {
  const accountantExportRequest = useArtworkStore(
    (s) => s.accountantExportRequest
  );
  const closeAccountantExport = useArtworkStore(
    (s) => s.closeAccountantExport
  );

  const isOpen = accountantExportRequest.kind === "open";

  return (
    <Drawer
      open={isOpen}
      onClose={closeAccountantExport}
      title="회계 전달 준비"
      widthClass="w-[600px]"
    >
      <AccountantExportBody isOpen={isOpen} />
    </Drawer>
  );
}

// ============================================================================
// Body — period selection + summary preview + download CTA
// ============================================================================

interface BodyProps {
  isOpen: boolean;
}

function AccountantExportBody({ isOpen }: BodyProps) {
  // Default — current quarter (사용자 spec §2)
  const [periodKind, setPeriodKind] = React.useState<FiscalPeriodKind>(
    "quarterly"
  );
  const [referenceDate, setReferenceDate] = React.useState(() =>
    new Date().toISOString()
  );

  // Re-anchor reference date on each open (즉시 흐름 반영)
  React.useEffect(() => {
    if (isOpen) setReferenceDate(new Date().toISOString());
  }, [isOpen]);

  // Pull all relevant slices read-only
  const transactions = useArtworkStore((s) => s.transactions);
  const invoices = useArtworkStore((s) => s.invoices);
  const receipts = useArtworkStore((s) => s.receipts);
  const taxInvoices = useArtworkStore((s) => s.taxInvoices);
  const settlements = useArtworkStore((s) => s.settlements);
  const taxRecords = useArtworkStore((s) => s.taxRecords);
  const artworks = useArtworkStore((s) => s.artworks);
  const inquiries = useArtworkStore((s) => s.inquiries);

  const closeAccountantExport = useArtworkStore(
    (s) => s.closeAccountantExport
  );
  const openInvoiceDetail = useArtworkStore((s) => s.openInvoiceDetail);
  const openReceiptDetail = useArtworkStore((s) => s.openReceiptDetail);
  const openTaxInvoiceDetail = useArtworkStore((s) => s.openTaxInvoiceDetail);
  const openSettlementDetail = useArtworkStore(
    (s) => s.openSettlementDetail
  );
  const openTransactionDetail = useArtworkStore(
    (s) => s.openTransactionDetail
  );

  // Build package memo'd over relevant inputs
  const exportPackage = React.useMemo(() => {
    const allTransactions = Object.values(transactions).flat();
    const allInvoices = Object.values(invoices).flat();
    const allReceipts = Object.values(receipts).flat();
    const allTaxInvoices = Object.values(taxInvoices).flat();
    const allSettlements = Object.values(settlements).flat();
    const allTaxRecords = Object.values(taxRecords).flat();
    // store.artworks is Artwork[] — helper expects Record<id, Artwork>
    const artworksById: Record<string, typeof artworks[number]> = {};
    for (const a of artworks) artworksById[a.id] = a;
    return buildAccountantExportPackage({
      transactions: allTransactions,
      invoices: allInvoices,
      receipts: allReceipts,
      taxInvoices: allTaxInvoices,
      settlements: allSettlements,
      taxRecords: allTaxRecords,
      artworks: artworksById,
      inquiries,
      selection: { kind: periodKind, referenceDate },
    });
  }, [
    transactions,
    invoices,
    receipts,
    taxInvoices,
    settlements,
    taxRecords,
    artworks,
    inquiries,
    periodKind,
    referenceDate,
  ]);

  const handleDownload = React.useCallback(() => {
    downloadCsv(exportPackage.filename, exportPackage.csvContent);
  }, [exportPackage]);

  const handlePendingClick = React.useCallback(
    (item: PendingItem) => {
      if (!item.relatedKind || !item.relatedId) return;
      // Drilldown — close current drawer first to avoid layered chrome
      closeAccountantExport();
      switch (item.relatedKind) {
        case "invoice":
          openInvoiceDetail(item.relatedId);
          break;
        case "receipt":
          openReceiptDetail(item.relatedId);
          break;
        case "tax_invoice":
          openTaxInvoiceDetail(item.relatedId);
          break;
        case "settlement":
          openSettlementDetail(item.relatedId);
          break;
        case "transaction":
          openTransactionDetail(item.relatedId);
          break;
      }
    },
    [
      closeAccountantExport,
      openInvoiceDetail,
      openReceiptDetail,
      openTaxInvoiceDetail,
      openSettlementDetail,
      openTransactionDetail,
    ]
  );

  return (
    <div className="flex flex-col gap-5 px-1">
      {/* ── Period switcher ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <PeriodSwitcher value={periodKind} onChange={setPeriodKind} />
        <span className="text-[10.5px] tabular-nums text-ink-subtle">
          {exportPackage.metadata.period.label}
        </span>
      </div>

      {/* ── Counts summary ─────────────────────────────────────────────── */}
      <Section label="포함된 운영 record">
        <div className="grid grid-cols-2 gap-2.5">
          <CountCard
            label="Invoice"
            value={exportPackage.metadata.counts.invoices}
          />
          <CountCard
            label="영수증"
            value={exportPackage.metadata.counts.receipts}
          />
          <CountCard
            label="세금계산서"
            value={exportPackage.metadata.counts.taxInvoices}
          />
          <CountCard
            label="정산"
            value={exportPackage.metadata.counts.settlements}
          />
        </div>
        <p className="text-[10.5px] text-ink-subtle leading-relaxed">
          본 기간 운영 record는 CSV로 묶여 다운로드됩니다 — 회계사 / 세무 담당자에게
          참고 자료로 전달하세요.
        </p>
      </Section>

      <Divider />

      {/* ── Pending / Missing items ─────────────────────────────────── */}
      <Section
        label={`검토 필요 항목 ${
          exportPackage.pendingItems.length > 0
            ? `· ${exportPackage.pendingItems.length}건`
            : ""
        }`}
      >
        {exportPackage.pendingItems.length === 0 ? (
          <p className="text-[11.5px] text-ink-subtle italic">
            본 기간 운영 record에 검토 필요 항목이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {exportPackage.pendingItems.map((item, idx) => {
              const navigable = !!(item.relatedKind && item.relatedId);
              return (
                <li
                  key={`${item.kind}-${item.relatedId ?? idx}`}
                >
                  <button
                    type="button"
                    onClick={() => handlePendingClick(item)}
                    disabled={!navigable}
                    className={`w-full flex items-start justify-between gap-3 rounded px-2.5 py-1.5 text-left transition-colors ${
                      navigable
                        ? "hover:bg-surface-muted/50 cursor-pointer"
                        : "cursor-default"
                    }`}
                  >
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[11.5px] text-ink tracking-tightish">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-ink-subtle truncate">
                        {item.detail}
                      </span>
                    </span>
                    {navigable && <ChevronRightIcon />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[10.5px] text-ink-subtle leading-relaxed italic">
          위 항목은 *운영 참고*입니다 — 회계사가 추가 검토 후 정식 처리하세요.
        </p>
      </Section>

      <Divider />

      {/* ── Primary action: CSV Download ─────────────────────────────── */}
      <Section label="CSV 다운로드">
        <Button
          variant="primary"
          size="md"
          className="w-full justify-between"
          onClick={handleDownload}
          disabled={
            exportPackage.metadata.counts.invoices === 0 &&
            exportPackage.metadata.counts.receipts === 0 &&
            exportPackage.metadata.counts.taxInvoices === 0 &&
            exportPackage.metadata.counts.settlements === 0 &&
            exportPackage.metadata.counts.taxRecords === 0
          }
        >
          <span>CSV 다운로드</span>
          <DownloadIcon />
        </Button>
        <p className="text-[10.5px] text-ink-subtle leading-relaxed">
          파일명:{" "}
          <span className="font-mono text-ink-muted">
            {exportPackage.filename}
          </span>
        </p>
        <p className="text-[10px] text-ink-subtle leading-relaxed">
          UTF-8 BOM 포함 — Excel / Numbers / Google Sheets에서 한국어 깨짐 없이 열림.
        </p>
      </Section>

      <Divider />

      {/* ── Future API readiness placeholder (사용자 spec §8) ────────── */}
      <Section label="후속 단계 — API 연동">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled>
            회계 SaaS 직접 전달
          </Button>
          <Button variant="secondary" size="sm" disabled>
            회계사 포털 업로드
          </Button>
        </div>
        <p className="text-[10.5px] text-ink-subtle leading-relaxed">
          외부 회계 SaaS / 세무 app / accountant portal API 연동은 본 STEP에서
          지원하지 않습니다 — CSV 다운로드 후 운영자가 직접 전달하시기 바랍니다.
        </p>
      </Section>

      <Divider />

      {/* ── Footer disclaimer ────────────────────────────────────────── */}
      <p className="text-[10px] text-ink-subtle italic leading-relaxed">
        본 export는 갤러리 운영 record를 회계사 / 세무 담당자에게 전달하기 위한 운영
        참고 자료입니다. 세무 신고 / 회계 장부 / 공식 세무 효력 / 국세청 제출과는
        무관합니다. 외부 회계 시스템 / 정부 API 자동 제출은 본 시스템에서 지원하지
        않습니다.
      </p>
    </div>
  );
}

// ============================================================================
// Sub-primitives
// ============================================================================

function PeriodSwitcher({
  value,
  onChange,
}: {
  value: FiscalPeriodKind;
  onChange: (next: FiscalPeriodKind) => void;
}) {
  const options: FiscalPeriodKind[] = ["monthly", "quarterly", "yearly"];
  return (
    <div
      role="tablist"
      aria-label="기간 선택"
      className="inline-flex items-center rounded-md border border-line bg-surface p-0.5"
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 text-[11px] font-medium tracking-tightish rounded transition-colors ${
              active
                ? "bg-ink text-white"
                : "text-ink-muted hover:text-ink hover:bg-surface-muted/60"
            }`}
          >
            {FISCAL_PERIOD_LABEL_KR[opt]}
          </button>
        );
      })}
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-subtle font-semibold">
        {label}
      </p>
      <p className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight text-ink">
        {value.toLocaleString("ko-KR")}
        <span className="ml-1 text-[11px] font-normal text-ink-subtle">건</span>
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
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
        {label}
      </h3>
      {children}
    </section>
  );
}

function Divider() {
  return <div className="border-t border-line" aria-hidden />;
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 shrink-0 text-ink-subtle"
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

function DownloadIcon() {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
