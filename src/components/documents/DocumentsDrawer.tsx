// ============================================================================
// DocumentsDrawer — STEP 51 (Documents Hub).
//
// 4개 문서 도메인 (Invoice / Contract / TaxRecord / ConditionReport)을 통합
// read-only 검색 view로 묶음. rule_1 Artwork-First 보존 — 본 drawer는 검색만,
// 신규 생성 / 편집은 작품 → 거래 흐름에서만.
//
// 항목 클릭 = 기존 도메인 detail drawer 재사용 (InvoiceDetailDrawer /
// ContractDetailDrawer / TaxDetailDrawer / ConditionReportDrawer).
//
// 패턴: ReportingDrawer (STEP 35) + GlobalAuditDrawer (STEP 23) 일관.
// 너비는 GlobalAuditDrawer와 같은 w-[800px] — list가 핵심이라 와이드 사용.
// ============================================================================

"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import { hasPermission } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import {
  aggregateDocuments,
  DOCUMENT_DOMAIN_LABEL_KR,
  DOCUMENT_STATUS_FILTER_LABEL_KR,
  type DocumentDomain,
  type DocumentRow,
  type DocumentStatusFilter,
  type DocumentsAggregateResult,
} from "@/lib/documents-aggregates";
import {
  exportDocuments,
  type DocumentsExportFormat,
} from "@/lib/documents-export";
import { BackupSection } from "@/components/documents/BackupSection";
import {
  formatTimeFilterLabel,
  resolveTimeRange,
  EMPTY_REPORTING_TIME_FILTER,
  type ReportingTimeFilter,
  type ReportingTimePreset,
} from "@/lib/reporting-aggregates";

// ============================================================================
// Drawer wrapper
// ============================================================================

export function DocumentsDrawer() {
  const request = useArtworkStore((s) => s.documentsRequest);
  const close = useArtworkStore((s) => s.closeDocuments);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const isAllowed = hasPermission(currentRole, "report.view_global");
  const isOpen = request.kind === "open" && isAllowed;

  return (
    <Drawer
      open={isOpen}
      onClose={close}
      title="문서 검색"
      widthClass="w-[800px]"
    >
      {isOpen && <DocumentsBody onClose={close} />}
    </Drawer>
  );
}

// ============================================================================
// Body
// ============================================================================

function DocumentsBody({ onClose }: { onClose: () => void }) {
  const invoices = useArtworkStore((s) => s.invoices);
  const contracts = useArtworkStore((s) => s.contracts);
  const taxRecords = useArtworkStore((s) => s.taxRecords);
  const conditionReports = useArtworkStore((s) => s.conditionReports);
  const transactions = useArtworkStore((s) => s.transactions);
  const artworks = useArtworkStore((s) => s.artworks);

  // ── Local filter state (drawer 닫혔다 열면 reset) ─────────────────────────
  const [domainFilter, setDomainFilter] = React.useState<
    DocumentDomain | "all"
  >("all");
  const [statusFilter, setStatusFilter] =
    React.useState<DocumentStatusFilter>("all");
  const [textQuery, setTextQuery] = React.useState("");
  const [timeFilter, setTimeFilter] = React.useState<ReportingTimeFilter>(
    EMPTY_REPORTING_TIME_FILTER
  );

  const result = React.useMemo<DocumentsAggregateResult>(() => {
    const range = resolveTimeRange(timeFilter);
    return aggregateDocuments(
      {
        invoices,
        contracts,
        taxRecords,
        conditionReports,
        transactions,
        artworks,
      },
      {
        domainFilter,
        statusFilter,
        textQuery,
        timeRange: range,
      }
    );
  }, [
    invoices,
    contracts,
    taxRecords,
    conditionReports,
    transactions,
    artworks,
    domainFilter,
    statusFilter,
    textQuery,
    timeFilter,
  ]);

  const filterLabel = React.useMemo(() => {
    const parts: string[] = [];
    parts.push(
      domainFilter === "all"
        ? "전체 도메인"
        : DOCUMENT_DOMAIN_LABEL_KR[domainFilter]
    );
    parts.push(DOCUMENT_STATUS_FILTER_LABEL_KR[statusFilter]);
    parts.push(formatTimeFilterLabel(timeFilter));
    if (textQuery.trim()) parts.push(`검색: ${textQuery.trim()}`);
    return parts.join(" · ");
  }, [domainFilter, statusFilter, timeFilter, textQuery]);

  const handleExport = (format: DocumentsExportFormat) => {
    if (result.rows.length === 0) return;
    exportDocuments(format, result.rows, {
      filterLabel,
      generatedAt: new Date().toISOString(),
      totalCountByDomain: result.totalCountByDomain,
      filteredCountByDomain: result.filteredCountByDomain,
      statusFilter,
    });
  };

  const totalAll = Object.values(result.totalCountByDomain).reduce(
    (a, b) => a + b,
    0
  );

  // STEP 72 — Drilldown 호출. 현재 filter (status / textQuery / timeRange)를
  // payload에 inherit. 탭 count 클릭 시 해당 domain으로, footer 액션 시
  // 현재 활성 도메인으로.
  const openDrilldown = useArtworkStore((s) => s.openDrilldown);
  const drilldownRange = React.useMemo(
    () => resolveTimeRange(timeFilter),
    [timeFilter]
  );
  const handleDrillDomain = React.useCallback(
    (domain: DocumentDomain | "all") => {
      const drillDomain =
        domain === "INVOICE"
          ? "documents_invoices"
          : domain === "CONTRACT"
            ? "documents_contracts"
            : domain === "TAX"
              ? "documents_tax_records"
              : domain === "CONDITION_REPORT"
                ? "documents_condition_reports"
                : "documents_all";
      openDrilldown({
        domain: drillDomain,
        documentStatus: statusFilter,
        searchQuery: textQuery,
        periodFromIso: drilldownRange?.start,
        periodToIso: drilldownRange?.end,
      });
    },
    [openDrilldown, statusFilter, textQuery, drilldownRange]
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-3 border-b border-line shrink-0 flex flex-col gap-2.5">
        <DomainTabs
          activeDomain={domainFilter}
          totalByDomain={result.totalCountByDomain}
          filteredByDomain={result.filteredCountByDomain}
          totalAll={totalAll}
          totalFiltered={result.totalFilteredCount}
          onChange={setDomainFilter}
          onDrillDomain={handleDrillDomain}
        />
        <FilterRow
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          textQuery={textQuery}
          onTextChange={setTextQuery}
          timeFilter={timeFilter}
          onTimeChange={setTimeFilter}
        />
      </div>

      {/* ── List ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean">
        {result.rows.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col">
            {result.rows.map((row) => (
              <DocumentRowCard key={`${row.domain}-${row.entityId}`} row={row} />
            ))}
          </ul>
        )}
      </div>

      {/* ── Backup / Restore (STEP 52) ─────────────────────────────────────
          별도 utility bar — DocumentsDrawer의 검색 흐름과 분리. 사용자 spec:
          "DocumentsDrawer footer 또는 별도 작은 BackupSection". footer 위
          얇은 bar로 통합 — rule_15 max 3 buttons는 primary action 영역에만 적용. */}
      <BackupSection />

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-line px-6 py-3 shrink-0 flex items-center justify-between bg-surface">
        <div className="flex items-baseline gap-3">
          {/* STEP 72 — count text 자체를 클릭 가능 변환 — 현재 활성 도메인 +
              모든 필터를 inherit한 drilldown 호출. count 0이면 비-clickable */}
          {result.rows.length > 0 ? (
            <button
              type="button"
              onClick={() => handleDrillDomain(domainFilter)}
              title={`${result.rows.length}건 — 작품 이동 가능한 상세 보기`}
              className="text-[10.5px] text-ink-subtle tracking-tightish hover:text-ink hover:underline transition-colors"
            >
              {result.rows.length}건 표시 · 총 {totalAll}건 → 상세 보기
            </button>
          ) : (
            <span className="text-[10.5px] text-ink-subtle tracking-tightish">
              {result.rows.length}건 표시 · 총 {totalAll}건
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] text-ink-subtle tracking-tightish">
            리스트 export
          </span>
          <ExportButton
            label="CSV"
            disabled={result.rows.length === 0}
            onClick={() => handleExport("csv")}
          />
          <ExportButton
            label="PDF"
            disabled={result.rows.length === 0}
            onClick={() => handleExport("pdf")}
          />
          <Button type="button" variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// Domain tabs
// ============================================================================

const DOMAIN_ORDER: ReadonlyArray<DocumentDomain> = [
  "INVOICE",
  "CONTRACT",
  "TAX",
  "CONDITION_REPORT",
];

function DomainTabs({
  activeDomain,
  totalByDomain,
  filteredByDomain,
  totalAll,
  totalFiltered,
  onChange,
  onDrillDomain,
}: {
  activeDomain: DocumentDomain | "all";
  totalByDomain: Record<DocumentDomain, number>;
  filteredByDomain: Record<DocumentDomain, number>;
  totalAll: number;
  totalFiltered: number;
  onChange: (next: DocumentDomain | "all") => void;
  /** STEP 72 — 탭의 count badge 클릭 → 해당 도메인 drilldown */
  onDrillDomain: (domain: DocumentDomain | "all") => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scroll-clean">
      <TabButton
        active={activeDomain === "all"}
        onClick={() => onChange("all")}
        onCountClick={() => onDrillDomain("all")}
        label="전체"
        filtered={totalFiltered}
        total={totalAll}
      />
      {DOMAIN_ORDER.map((d) => (
        <TabButton
          key={d}
          active={activeDomain === d}
          onClick={() => onChange(d)}
          onCountClick={() => onDrillDomain(d)}
          label={DOCUMENT_DOMAIN_LABEL_KR[d]}
          filtered={filteredByDomain[d]}
          total={totalByDomain[d]}
        />
      ))}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  onCountClick,
  label,
  filtered,
  total,
}: {
  active: boolean;
  onClick: () => void;
  onCountClick: () => void;
  label: string;
  filtered: number;
  total: number;
}) {
  // 필터 적용으로 갯수가 줄었을 때만 "filtered / total" 노출, 그 외엔 단순 갯수
  const countLabel = filtered === total ? `${total}` : `${filtered} / ${total}`;
  // STEP 72 — count badge가 0이면 drilldown 의미 없음 (disabled)
  const countDisabled = filtered === 0;
  return (
    <div
      className={cn(
        "h-8 rounded-md text-[12px] tracking-tightish border transition-colors shrink-0",
        "flex items-center",
        active
          ? "bg-ink text-white border-ink"
          : "bg-surface text-ink-muted border-line hover:bg-surface-muted hover:text-ink"
      )}
    >
      {/* Tab label part — 클릭 시 탭 전환 (기존 동작 보존) */}
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className="h-full pl-3 pr-2 flex items-center"
      >
        <span>{label}</span>
      </button>
      {/* STEP 72 — Count badge part — 클릭 시 drilldown.
          DOM nesting 안전성을 위해 두 button을 형제로 분리. */}
      <button
        type="button"
        onClick={onCountClick}
        disabled={countDisabled}
        title={
          countDisabled ? undefined : `${label} ${filtered}건 — 상세 보기`
        }
        aria-label={
          countDisabled
            ? undefined
            : `${label} ${filtered}건 운영 상세 보기`
        }
        className={cn(
          "h-full pr-2 pl-1 flex items-center transition-opacity",
          countDisabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:opacity-90"
        )}
      >
        <span
          className={cn(
            "text-[10px] tabular-nums tracking-tightish px-1.5 py-px rounded-full",
            active ? "bg-white/20 text-white" : "bg-surface-muted text-ink-subtle"
          )}
        >
          {countLabel}
        </span>
      </button>
    </div>
  );
}

// ============================================================================
// Filter row (status + search + time)
// ============================================================================

const STATUS_CHIPS: ReadonlyArray<{
  value: DocumentStatusFilter;
  label: string;
}> = [
  { value: "all", label: "전체" },
  { value: "completed", label: "완료 / LOCK" },
  { value: "inprogress", label: "작업중" },
];

const TIME_PRESET_CHIPS: ReadonlyArray<{
  value: ReportingTimePreset;
  label: string;
}> = [
  { value: "ALL", label: "전체 기간" },
  { value: "THIS_MONTH", label: "이번 달" },
  { value: "THIS_QUARTER", label: "이번 분기" },
  { value: "CUSTOM", label: "사용자 지정" },
];

function FilterRow({
  statusFilter,
  onStatusChange,
  textQuery,
  onTextChange,
  timeFilter,
  onTimeChange,
}: {
  statusFilter: DocumentStatusFilter;
  onStatusChange: (next: DocumentStatusFilter) => void;
  textQuery: string;
  onTextChange: (next: string) => void;
  timeFilter: ReportingTimeFilter;
  onTimeChange: (next: ReportingTimeFilter) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* row 1: status + search */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase shrink-0">
          상태
        </span>
        {STATUS_CHIPS.map((opt) => {
          const active = statusFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onStatusChange(opt.value)}
              aria-pressed={active}
              className={cn(
                "h-6 px-2.5 rounded-full text-[11px] tracking-tightish border transition-colors",
                active
                  ? "bg-ink text-white border-ink"
                  : "bg-surface text-ink-muted border-line hover:bg-surface-muted hover:text-ink"
              )}
            >
              {opt.label}
            </button>
          );
        })}
        <div className="flex-1 min-w-[180px] flex items-center gap-1.5 ml-2">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase shrink-0">
            검색
          </span>
          <input
            type="text"
            value={textQuery}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="작품 / 작가 / AXID"
            className="flex-1 h-7 px-2 rounded border border-line bg-surface text-[11.5px] text-ink tracking-tightish focus:outline-none focus:border-line-strong"
          />
          {textQuery && (
            <button
              type="button"
              onClick={() => onTextChange("")}
              className="text-[10px] text-ink-muted hover:text-ink underline-offset-2 hover:underline"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {/* row 2: time filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase shrink-0">
          기간
        </span>
        {TIME_PRESET_CHIPS.map((opt) => {
          const active = timeFilter.preset === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                onTimeChange({
                  preset: opt.value,
                  customStart:
                    opt.value === "CUSTOM" ? timeFilter.customStart : "",
                  customEnd:
                    opt.value === "CUSTOM" ? timeFilter.customEnd : "",
                })
              }
              aria-pressed={active}
              className={cn(
                "h-6 px-2.5 rounded-full text-[11px] tracking-tightish border transition-colors",
                active
                  ? "bg-ink text-white border-ink"
                  : "bg-surface text-ink-muted border-line hover:bg-surface-muted hover:text-ink"
              )}
            >
              {opt.label}
            </button>
          );
        })}
        {timeFilter.preset === "CUSTOM" && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={timeFilter.customStart}
              onChange={(e) =>
                onTimeChange({ ...timeFilter, customStart: e.target.value })
              }
              max={timeFilter.customEnd || undefined}
              className="h-6 px-1.5 rounded border border-line bg-surface text-[11px] text-ink tracking-tightish focus:outline-none focus:border-line-strong"
              aria-label="시작일"
            />
            <span className="text-[10.5px] text-ink-subtle">~</span>
            <input
              type="date"
              value={timeFilter.customEnd}
              onChange={(e) =>
                onTimeChange({ ...timeFilter, customEnd: e.target.value })
              }
              min={timeFilter.customStart || undefined}
              className="h-6 px-1.5 rounded border border-line bg-surface text-[11px] text-ink tracking-tightish focus:outline-none focus:border-line-strong"
              aria-label="종료일"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Row card — 항목 클릭 시 도메인별 detail drawer 재사용
// ============================================================================

function DocumentRowCard({ row }: { row: DocumentRow }) {
  const openInvoiceDetail = useArtworkStore((s) => s.openInvoiceDetail);
  const openContractDetail = useArtworkStore((s) => s.openContractDetail);
  const openTaxDetail = useArtworkStore((s) => s.openTaxDetail);
  const openConditionReportEdit = useArtworkStore(
    (s) => s.openConditionReportEdit
  );
  const closeDocuments = useArtworkStore((s) => s.closeDocuments);
  const setSelectedArtwork = useArtworkStore((s) => s.select);

  // STEP 76 — Documents Row Direct Navigation Enhancement.
  // row click의 두 흐름을 명확히 분리:
  //   (A) row 자체 클릭 → 순수 *작품 이동* (rule_1 Artwork-First).
  //       artworkId가 있을 때만 클릭 가능 — 부재 시 비-clickable.
  //   (B) row 안 inline "문서 상세" 액션 → 기존 도메인 detail drawer open.
  //       event.stopPropagation으로 row click과 분리.
  // 두 흐름 모두 closeDocuments — 같은 layer에 두 drawer 동시 노출 회피.

  const hasArtwork = !!row.artworkId;

  // (A) row click — 작품 navigate. DetailPanel sync는 store action 자연 발생.
  const handleNavigateArtwork = () => {
    if (!hasArtwork) return;
    setSelectedArtwork(row.artworkId);
    closeDocuments();
  };

  // (B) inline action — 도메인 detail drawer open. 작품 navigate는 부수적 수반.
  const handleOpenDocDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasArtwork) setSelectedArtwork(row.artworkId);
    closeDocuments();
    setTimeout(() => {
      switch (row.domain) {
        case "INVOICE":
          openInvoiceDetail(row.entityId);
          break;
        case "CONTRACT":
          openContractDetail(row.entityId);
          break;
        case "TAX":
          openTaxDetail(row.entityId);
          break;
        case "CONDITION_REPORT":
          openConditionReportEdit(row.entityId);
          break;
      }
    }, 0);
  };

  // outer wrapper — clickable이면 button, 아니면 div (a11y semantics 정확)
  const OuterTag = hasArtwork ? "button" : "div";
  const outerProps = hasArtwork
    ? {
        type: "button" as const,
        onClick: handleNavigateArtwork,
        title: `${row.artworkTitle} 작품 이동`,
        "aria-label": `${row.artworkTitle} (${row.domainLabel}) — 작품 이동`,
      }
    : {};

  return (
    <li>
      <OuterTag
        {...outerProps}
        className={cn(
          "w-full text-left px-6 py-3 border-b border-line",
          "grid grid-cols-[110px_1fr_140px_120px_72px] gap-3 items-baseline transition-colors",
          hasArtwork
            ? "cursor-pointer hover:bg-surface-muted/60 focus:outline-none focus:bg-surface-muted/80"
            : "cursor-default"
        )}
      >
        {/* col 1: domain + status */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] font-semibold tracking-[0.12em] text-ink-subtle uppercase">
            {row.domainLabel}
          </span>
          <span className="flex items-center gap-1 min-w-0">
            <span className="text-[11px] text-ink-muted truncate tracking-tightish">
              {row.statusLabel}
            </span>
            {row.isLocked && (
              <span className="text-[8.5px] tracking-[0.06em] px-1 py-px rounded border border-ink/70 text-ink shrink-0">
                LOCK
              </span>
            )}
          </span>
        </div>

        {/* col 2: artwork title + artist + axid */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[12.5px] font-medium text-ink truncate tracking-tightish">
            {row.artworkTitle}
          </span>
          <span className="text-[10.5px] text-ink-subtle truncate tracking-tightish">
            {row.artistName}
            <span className="font-mono ml-2">{row.artworkAxidCode}</span>
            {row.versionLabel && (
              <span className="ml-2 text-ink-muted">{row.versionLabel}</span>
            )}
            {row.detailLabel && (
              <span className="ml-2 text-ink-muted">· {row.detailLabel}</span>
            )}
          </span>
        </div>

        {/* col 3: amount */}
        <div className="text-right">
          {row.amountLabel ? (
            <span className="text-[12px] tabular-nums text-ink tracking-tightish">
              {row.amountLabel}
            </span>
          ) : (
            <span className="text-[10.5px] text-ink-subtle">—</span>
          )}
        </div>

        {/* col 4: primary date */}
        <div className="flex flex-col gap-0.5 text-right">
          <span className="text-[11px] tabular-nums text-ink-muted tracking-tightish">
            {formatDate(row.primaryDate)}
          </span>
          <span className="text-[9.5px] text-ink-subtle tracking-tightish">
            {row.primaryDateLabel}
          </span>
        </div>

        {/* col 5: STEP 76 — actions
            (a) "문서 상세" inline action button — domain detail drawer open
                (event.stopPropagation으로 row click과 분리).
            (b) 우측 chevron — row가 작품 이동 가능함을 시각적으로 표현
                (clickable일 때만). non-clickable이면 placeholder. */}
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={handleOpenDocDetail}
            title={`${row.domainLabel} 문서 상세 보기`}
            aria-label={`${row.domainLabel} 문서 상세`}
            className={cn(
              "shrink-0 px-1.5 py-0.5 rounded border border-line bg-surface",
              "text-[9.5px] tracking-tightish text-ink-subtle",
              "hover:text-ink hover:border-ink/60 hover:bg-surface-muted",
              "transition-colors"
            )}
          >
            문서 상세
          </button>
          {hasArtwork ? (
            <span
              aria-hidden
              className="shrink-0 text-[12px] text-ink-subtle leading-none"
              title="작품 이동"
            >
              →
            </span>
          ) : (
            <span aria-hidden className="shrink-0 w-[12px]" />
          )}
        </div>
      </OuterTag>
    </li>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

// ============================================================================
// Empty state
// ============================================================================

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center px-6 py-10">
      <div className="text-center max-w-sm">
        <p className="text-[12px] text-ink-muted tracking-tightish">
          현재 필터 조건에 해당하는 문서가 없습니다.
        </p>
        <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1.5 leading-relaxed">
          탭 / 상태 / 기간 / 검색을 조정해보세요. 문서는 작품 → 거래 흐름에서
          생성되며, 본 화면은 검색 전용입니다.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Export button
// ============================================================================

function ExportButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      title={disabled ? "내보낼 데이터 없음" : `${label}로 내보내기`}
      className={cn(
        "h-8 px-3 rounded-md text-[12px] tracking-tightish border transition-colors",
        disabled
          ? "bg-surface text-ink-subtle border-line cursor-not-allowed opacity-50"
          : "bg-surface text-ink border-line hover:bg-surface-muted hover:border-line-strong"
      )}
    >
      {label}
    </button>
  );
}
