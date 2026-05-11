"use client";

// ============================================================================
// FiscalSummaryDrawer — STEP 88 VAT Summary Aggregate Layer
//
// **본 drawer가 무엇인가**:
//   갤러리 운영자가 *현재 운영 흐름의 세무/정산 진행 상황*을 한눈에 파악하는
//   read-only aggregate view. 기존 Invoice / Receipt / Settlement / TaxRecord /
//   Transaction 데이터 위에 *derived view*만 표시.
//
// **본 drawer가 *아닌* 것** (사용자 spec 정조준):
//   - 회계 ledger / accountant export → STEP 91 영역
//   - 세무 신고 시스템 → 영구 out-of-scope
//   - government API 통합 → 영구 out-of-scope
//   - ERP 회계 모듈 / 다단계 modal / spreadsheet
//
// **사용자 spec §3 톤**:
//   - calm / premium / operational / readable
//   - Apple + OpenAI + high-end gallery operations
//   - tax office software 톤 0건
//   - dense spreadsheet 0건
//   - ERP visual clutter 0건
//
// **사용자 spec §5 period support**:
//   - monthly / quarterly / yearly 단순 전환
//   - 복잡한 date picker 0건
//   - referenceDate = "now" 고정
//
// **사용자 spec §7 future export preparation**:
//   - [PDF 저장 준비] / [회계 전달 준비] 버튼 표시
//   - 본 STEP에서는 disabled + "STEP 91 정착 후 활성" hint
//   - 실제 export 0건 (STEP 91 영역)
//
// **사용자 spec §6 Audit / Trust Alignment**:
//   - STEP 86 trust metadata projection — 미래 STEP에서 활용
//   - STEP 87 receipt lifecycle — recentActivity에 receipt event 자연 포함
//   - audit architecture — Drilldown click → 기존 drawer (Receipt / Settlement /
//     Invoice) 진입
//   - Approval Workflow 0건 (STEP 101+ 영역)
//
// **rule_3 Money Flow Separation strict** — 도메인별 amount 별도 column.
// 절대 cross-domain 단일 숫자 합산 0건. Payment + Settlement + Tax 단일
// 합계 절대 금지.
//
// **rule_20 FX Lock 보존** — currency-aware 분리 표시. KRW 환산 0건 (Reporting
// / STEP 35 영역).
//
// **rule_15 / rule_16 / rule_17 일관**:
//   - Primary 1개 ([닫기] 또는 disabled future action)
//   - minimalism (그림자 0 / Apple 톤)
//   - drawer layer (3-Column 0줄 변경)
// ============================================================================

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  buildFiscalSummaryAggregate,
  formatFiscalAmount,
  FISCAL_PERIOD_LABEL_KR,
  FISCAL_ACTIVITY_KIND_LABEL_KR,
  type FiscalPeriodKind,
  type FiscalActivityEntry,
} from "@/lib/fiscal-summary";
import { formatRelativeKR, cn } from "@/lib/utils";

// ============================================================================
// Drawer wrapper
// ============================================================================

export function FiscalSummaryDrawer() {
  const fiscalSummaryRequest = useArtworkStore((s) => s.fiscalSummaryRequest);
  const closeFiscalSummary = useArtworkStore((s) => s.closeFiscalSummary);

  const isOpen = fiscalSummaryRequest.kind === "open";

  return (
    <Drawer
      open={isOpen}
      onClose={closeFiscalSummary}
      title="운영용 세무 흐름"
      widthClass="w-[600px]"
    >
      <FiscalSummaryBody isOpen={isOpen} />
    </Drawer>
  );
}

// ============================================================================
// Body — period switching + aggregate display
// ============================================================================

interface BodyProps {
  isOpen: boolean;
}

function FiscalSummaryBody({ isOpen }: BodyProps) {
  // Local UI state — period selection (no store state needed)
  const [periodKind, setPeriodKind] = React.useState<FiscalPeriodKind>(
    "monthly"
  );

  // referenceDate — captured at drawer open and re-anchored each time the
  // drawer transitions closed → open, so running activity reflects "now"
  // for each new session.
  const [referenceDate, setReferenceDate] = React.useState(
    () => new Date().toISOString()
  );

  React.useEffect(() => {
    if (isOpen) {
      setReferenceDate(new Date().toISOString());
    }
  }, [isOpen]);

  // Existing slices — read-only
  const transactions = useArtworkStore((s) => s.transactions);
  const invoices = useArtworkStore((s) => s.invoices);
  const receipts = useArtworkStore((s) => s.receipts);
  const settlements = useArtworkStore((s) => s.settlements);
  const taxRecords = useArtworkStore((s) => s.taxRecords);
  const taxInvoices = useArtworkStore((s) => s.taxInvoices);

  const openReceiptDetail = useArtworkStore((s) => s.openReceiptDetail);
  const openSettlementDetail = useArtworkStore((s) => s.openSettlementDetail);
  const openInvoiceDetail = useArtworkStore((s) => s.openInvoiceDetail);
  const openTaxInvoiceDetail = useArtworkStore((s) => s.openTaxInvoiceDetail);
  const closeFiscalSummary = useArtworkStore((s) => s.closeFiscalSummary);
  const openAccountantExport = useArtworkStore((s) => s.openAccountantExport);
  // STEP 125 — MetricCard click drilldown wire-up. single-drawer policy:
  // drilldown 진입 시 fiscal drawer 자동 close (z-index 충돌 방어 — 모든
  // drawer z-50 동일).
  const openDrilldown = useArtworkStore((s) => s.openDrilldown);
  const handleMetricDrilldown = React.useCallback(
    (
      domain:
        | "documents_invoices"
        | "reporting_settlements"
        | "reporting_tax"
    ) => {
      closeFiscalSummary();
      openDrilldown({ domain });
    },
    [closeFiscalSummary, openDrilldown]
  );

  // Compute aggregate (memoized over relevant slices + selection)
  const aggregate = React.useMemo(() => {
    const allTransactions = Object.values(transactions).flat();
    const allInvoices = Object.values(invoices).flat();
    const allReceipts = Object.values(receipts).flat();
    const allSettlements = Object.values(settlements).flat();
    const allTaxRecords = Object.values(taxRecords).flat();
    const allTaxInvoices = Object.values(taxInvoices).flat();
    return buildFiscalSummaryAggregate({
      transactions: allTransactions,
      invoices: allInvoices,
      receipts: allReceipts,
      settlements: allSettlements,
      taxRecords: allTaxRecords,
      taxInvoices: allTaxInvoices,
      selection: { kind: periodKind, referenceDate },
    });
  }, [
    transactions,
    invoices,
    receipts,
    settlements,
    taxRecords,
    taxInvoices,
    periodKind,
    referenceDate,
  ]);

  const handleActivityClick = React.useCallback(
    (entry: FiscalActivityEntry) => {
      if (!entry.relatedKind || !entry.relatedId) return;
      // Drilldown — close fiscal drawer first to avoid layered drawer chrome.
      closeFiscalSummary();
      switch (entry.relatedKind) {
        case "receipt":
          openReceiptDetail(entry.relatedId);
          break;
        case "settlement":
          openSettlementDetail(entry.relatedId);
          break;
        case "invoice":
          openInvoiceDetail(entry.relatedId);
          break;
        case "tax_invoice":
          openTaxInvoiceDetail(entry.relatedId);
          break;
        // tax → no detail drawer entry point yet (TaxRecord)
      }
    },
    [
      closeFiscalSummary,
      openReceiptDetail,
      openSettlementDetail,
      openInvoiceDetail,
      openTaxInvoiceDetail,
    ]
  );

  return (
    <div className="flex flex-col gap-5 px-1">
      {/* ── Period switcher ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <PeriodSwitcher value={periodKind} onChange={setPeriodKind} />
        <span className="text-[10.5px] tabular-nums text-ink-subtle">
          {aggregate.range.label}
        </span>
      </div>

      {/* ── Headline metrics — counts only (cross-domain amount 합산 절대 0건) */}
      {/* STEP 125 — 진행상태 카드 클릭 가능. 매핑: 총 거래 → invoices /
          영수증 발행 → 신규 도메인 미진입 (disabledHint) / 정산 준비 →
          settlements / 세무 record → tax records. */}
      <Section label="진행 상태 (count)">
        <div className="grid grid-cols-2 gap-2.5">
          <MetricCard
            label="총 거래"
            value={aggregate.counts.transactions.total}
            unit="건"
            secondary={`미완료 ${aggregate.counts.transactions.pending} · 결제 ${aggregate.counts.transactions.paid} · 정산 ${aggregate.counts.transactions.settled}`}
            onClick={
              aggregate.counts.transactions.total > 0
                ? () => handleMetricDrilldown("documents_invoices")
                : undefined
            }
          />
          <MetricCard
            label="영수증 발행"
            value={aggregate.counts.receipts.ISSUED}
            unit="건"
            secondary={`발행 대기 ${aggregate.counts.receipts.DRAFT}`}
            disabledHint="상세 리스트 준비 중"
          />
          <MetricCard
            label="정산 준비"
            value={
              aggregate.counts.settlements.PENDING +
              aggregate.counts.settlements.READY
            }
            unit="건"
            secondary={`완료 ${aggregate.counts.settlements.COMPLETED}`}
            onClick={
              aggregate.counts.settlements.PENDING +
                aggregate.counts.settlements.READY +
                aggregate.counts.settlements.COMPLETED >
              0
                ? () => handleMetricDrilldown("reporting_settlements")
                : undefined
            }
          />
          <MetricCard
            label="세무 record"
            value={aggregate.counts.taxRecords.PENDING}
            unit="건 대기"
            secondary={`발행 ${aggregate.counts.taxRecords.ISSUED}`}
            onClick={
              aggregate.counts.taxRecords.PENDING +
                aggregate.counts.taxRecords.ISSUED >
              0
                ? () => handleMetricDrilldown("reporting_tax")
                : undefined
            }
          />
        </div>
      </Section>

      <Divider />

      {/* ── Currency breakdown — rule_20 FX policy 보존 ─────────────── */}
      <Section label="통화별 흐름">
        {aggregate.byCurrency.length === 0 ? (
          <p className="text-[11.5px] text-ink-subtle italic">
            본 기간에 기록된 거래가 없습니다.
          </p>
        ) : (
          <div className="rounded-md border border-line bg-surface overflow-hidden">
            <div className="grid grid-cols-[64px_1fr_1fr_1fr] gap-x-3 px-3 py-2 border-b border-line bg-surface-muted/40 text-[9.5px] uppercase tracking-[0.14em] text-ink-subtle font-semibold">
              <span>통화</span>
              <span className="text-right">거래</span>
              <span className="text-right">발행 완료</span>
              <span className="text-right">정산 준비</span>
            </div>
            {aggregate.byCurrency.map((bucket) => (
              <div
                key={bucket.currency}
                className="grid grid-cols-[64px_1fr_1fr_1fr] gap-x-3 px-3 py-2 text-[11.5px] tabular-nums border-b border-line last:border-b-0"
              >
                <span className="font-medium text-ink">{bucket.currency}</span>
                <span className="text-right text-ink-muted">
                  {formatFiscalAmount(
                    bucket.transactionAmount,
                    bucket.currency
                  )}
                </span>
                <span className="text-right text-ink-muted">
                  {formatFiscalAmount(
                    bucket.receiptIssuedAmount,
                    bucket.currency
                  )}
                </span>
                <span className="text-right text-ink-muted">
                  {formatFiscalAmount(
                    bucket.settlementReadyAmount,
                    bucket.currency
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-ink-subtle italic leading-relaxed">
          각 통화 그대로 표시 — KRW 환산 합계는 별도 보고서를 참고하세요.
        </p>
      </Section>

      <Divider />

      {/* ── Recent fiscal activity ─────────────────────────────────────── */}
      <Section label="최근 운영 흐름">
        {aggregate.recentActivity.length === 0 ? (
          <p className="text-[11.5px] text-ink-subtle italic">
            본 기간에 fiscal activity가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {aggregate.recentActivity.map((entry) => {
              const navigable = !!(entry.relatedKind && entry.relatedId);
              return (
                <li key={`${entry.kind}-${entry.relatedId ?? entry.timestamp}`}>
                  <button
                    type="button"
                    onClick={() => handleActivityClick(entry)}
                    disabled={!navigable}
                    className={`w-full flex items-center justify-between gap-3 rounded px-2.5 py-1.5 text-[11.5px] transition-colors ${
                      navigable
                        ? "hover:bg-surface-muted/50 cursor-pointer"
                        : "cursor-default"
                    }`}
                  >
                    <span className="flex items-baseline gap-2 min-w-0">
                      <span className="text-ink-subtle text-[10px] uppercase tracking-[0.14em] font-semibold w-[88px] shrink-0 text-left">
                        {FISCAL_ACTIVITY_KIND_LABEL_KR[entry.kind]}
                      </span>
                      <span className="text-ink truncate">{entry.label}</span>
                    </span>
                    <span className="flex items-baseline gap-2 shrink-0 text-ink-muted tabular-nums">
                      {entry.amount !== undefined && entry.currency && (
                        <span>
                          {formatFiscalAmount(entry.amount, entry.currency)}
                        </span>
                      )}
                      <span className="text-[10px] text-ink-subtle">
                        {formatRelativeKR(entry.timestamp)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Divider />

      {/* ── Future preparation actions — STEP 91 회계 전달 활성됨 ──────── */}
      <Section label="후속 단계 — 회계 / 외부 전달">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled>
            PDF 저장 준비
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              closeFiscalSummary();
              openAccountantExport();
            }}
          >
            회계 전달 준비
          </Button>
        </div>
        <p className="text-[10.5px] text-ink-subtle leading-relaxed">
          *회계 전달*은 운영 record CSV handoff package 다운로드입니다. 세무
          신고 / 국세청 제출과 무관합니다. PDF 저장은 추후 별도 STEP에서 결정.
        </p>
        <FutureMetaInline meta={aggregate.meta} />
      </Section>

      <Divider />

      {/* ── Footer disclaimer (사용자 spec §3 / §6 일관) ───────────────── */}
      <p className="text-[10px] text-ink-subtle italic leading-relaxed">
        본 view는 갤러리 운영 참고용 fiscal 흐름 요약입니다. 세무 신고 / 회계
        장부 / 공식 세무 효력과는 무관합니다. 외부 회계 시스템 / 정부 API 자동
        제출은 본 시스템에서 지원하지 않습니다.
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

function MetricCard({
  label,
  value,
  unit,
  secondary,
  onClick,
  disabledHint,
}: {
  label: string;
  value: number;
  unit: string;
  secondary?: string;
  /**
   * STEP 125 — Optional click handler. 채워지면 카드는 button affordance 를
   * 가짐 (cursor / hover surface / aria-label / focus ring). 부재 시 plain
   * div 로 취급 (기존 동작 보존).
   */
  onClick?: () => void;
  /**
   * STEP 125 — onClick 미연결 카드의 이유 표시 (예: "준비 중"). disabled 가
   * 아닌 *non-clickable by design* 상태. visual 은 동일하지만 sub-text 노출
   * 통해 사용자에게 affordance 부재 이유를 알림.
   */
  disabledHint?: string;
}) {
  const interactive = typeof onClick === "function";
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick!();
    }
  };
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? handleKey : undefined}
      aria-label={interactive ? `${label} ${value.toLocaleString("ko-KR")}${unit} — 상세 열기` : undefined}
      className={cn(
        "rounded-md border border-line bg-surface px-3 py-2.5 transition-colors",
        interactive
          ? "cursor-pointer hover:bg-surface-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          : ""
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-subtle font-semibold">
        {label}
      </p>
      <p className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight text-ink">
        {value.toLocaleString("ko-KR")}
        <span className="ml-1 text-[11px] font-normal text-ink-subtle">
          {unit}
        </span>
      </p>
      {secondary && (
        <p className="mt-0.5 text-[10.5px] text-ink-subtle leading-relaxed tabular-nums">
          {secondary}
        </p>
      )}
      {disabledHint && (
        <p className="mt-0.5 text-[9.5px] text-ink-subtle italic tracking-tightish">
          {disabledHint}
        </p>
      )}
    </div>
  );
}

function FutureMetaInline({
  meta,
}: {
  meta: {
    exportReady: boolean;
    accountingSyncState: string;
    vatReviewState: string;
    settlementTaxState: string;
  };
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1.5 text-[10px] text-ink-subtle leading-relaxed tabular-nums">
      <span>
        export 준비 ·{" "}
        <span className="text-ink-muted">
          {meta.exportReady ? "준비 완료" : "—"}
        </span>
      </span>
      <span>
        accounting sync ·{" "}
        <span className="text-ink-muted">{meta.accountingSyncState}</span>
      </span>
      <span>
        VAT review ·{" "}
        <span className="text-ink-muted">{meta.vatReviewState}</span>
      </span>
      <span>
        settlement tax ·{" "}
        <span className="text-ink-muted">{meta.settlementTaxState}</span>
      </span>
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
