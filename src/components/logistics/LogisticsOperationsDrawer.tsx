// ============================================================================
// LogisticsOperationsDrawer — STEP 54.
//
// 갤러리 전체 logistics record를 한 화면에서 보는 1급 운영 view. STEP 51
// DocumentsDrawer / STEP 35 ReportingDrawer / STEP 41 CustomerViewDrawer 패턴
// 일관 — read-only utility. row 클릭 시 작품 select + 기존
// LogisticsDetailDrawer 재사용.
//
// 너비 w-[800px] (DocumentsDrawer / GlobalAuditDrawer와 같음 — list가 핵심).
// ============================================================================

"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import { hasPermission } from "@/lib/rbac";
import { cn, LOGISTICS_STATUS_LABEL, LOGISTICS_STATUS_COLOR } from "@/lib/utils";
import { ClickableMetric } from "@/components/drilldown/ClickableMetric";
import {
  aggregateLogistics,
  LOGISTICS_STATUS_FILTER_LABEL_KR,
  type LogisticsAggregateResult,
  type LogisticsRow,
} from "@/lib/logistics-aggregates";
import {
  buildCalendarMonth,
  shiftAnchorByMonth,
  CALENDAR_WEEKDAY_LABELS_KR,
  type CalendarMonth,
  type CalendarCell,
  type CalendarItem,
} from "@/lib/logistics-calendar";
import {
  formatTimeFilterLabel,
  resolveTimeRange,
  EMPTY_REPORTING_TIME_FILTER,
  type ReportingTimeFilter,
  type ReportingTimePreset,
} from "@/lib/reporting-aggregates";
import type { LogisticsStatus } from "@/types/logistics";

// ============================================================================
// Drawer wrapper
// ============================================================================

export function LogisticsOperationsDrawer() {
  const request = useArtworkStore((s) => s.logisticsOperationsRequest);
  const close = useArtworkStore((s) => s.closeLogisticsOperations);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const isAllowed = hasPermission(currentRole, "report.view_global");
  const isOpen = request.kind === "open" && isAllowed;

  return (
    <Drawer
      open={isOpen}
      onClose={close}
      title="물류 운영"
      widthClass="w-[800px]"
    >
      {isOpen && <OperationsBody onClose={close} />}
    </Drawer>
  );
}

// ============================================================================
// Body
// ============================================================================

function OperationsBody({ onClose }: { onClose: () => void }) {
  const logistics = useArtworkStore((s) => s.logistics);
  const conditionReports = useArtworkStore((s) => s.conditionReports);
  const transactions = useArtworkStore((s) => s.transactions);
  const artworks = useArtworkStore((s) => s.artworks);
  const bulkSync = useArtworkStore((s) => s.bulkSyncLogisticsFromProvider);

  const [statusFilter, setStatusFilter] = React.useState<
    LogisticsStatus | "all"
  >("all");
  const [textQuery, setTextQuery] = React.useState("");
  const [timeFilter, setTimeFilter] = React.useState<ReportingTimeFilter>(
    EMPTY_REPORTING_TIME_FILTER
  );
  // STEP 58 — view mode toggle. 기본 list 유지 (사용자 spec).
  const [viewMode, setViewMode] = React.useState<"list" | "calendar">("list");
  // STEP 58 — calendar anchor (이번 month 기본). prev/next month 네비게이션.
  const [calendarAnchor, setCalendarAnchor] = React.useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  // STEP 58 — bulk sync 결과 (마지막 호출 결과 — 다음 호출까지 노출)
  const [syncStatus, setSyncStatus] = React.useState<
    | { kind: "idle" }
    | { kind: "syncing"; total: number }
    | { kind: "done"; ok: number; skipped: number; failed: number }
  >({ kind: "idle" });

  const result = React.useMemo<LogisticsAggregateResult>(() => {
    const range = resolveTimeRange(timeFilter);
    return aggregateLogistics(
      { logistics, conditionReports, transactions, artworks },
      { statusFilter, textQuery, timeRange: range }
    );
  }, [
    logistics,
    conditionReports,
    transactions,
    artworks,
    statusFilter,
    textQuery,
    timeFilter,
  ]);

  // STEP 58 — calendar month grid (viewMode === "calendar"일 때만 계산하면
  // useMemo deps 안정성으로 list 모드에서 계산 안 됨)
  const calendarMonth = React.useMemo<CalendarMonth | null>(() => {
    if (viewMode !== "calendar") return null;
    return buildCalendarMonth(result.rows, calendarAnchor);
  }, [viewMode, result.rows, calendarAnchor]);

  // STEP 58 — bulk sync handler. 현재 필터된 rows 기준 (사용자 spec).
  const handleBulkSync = React.useCallback(() => {
    const ids = result.rows.map((r) => r.logistics.id);
    if (ids.length === 0) return;
    setSyncStatus({ kind: "syncing", total: ids.length });
    // 동기 호출 — provider는 mock이라 즉시 반환. 향후 실 provider 시 async 변환.
    const out = bulkSync(ids);
    setSyncStatus({ kind: "done", ...out });
  }, [result.rows, bulkSync]);

  return (
    <div className="flex flex-col h-full">
      {/* ── KPI cards + filter + view toggle + bulk sync ─────────────────── */}
      <div className="px-6 pt-4 pb-3 border-b border-line shrink-0 flex flex-col gap-3">
        <KPISection kpis={result.kpis} />
        <BulkSyncBar
          rowCount={result.rows.length}
          syncStatus={syncStatus}
          onBulkSync={handleBulkSync}
        />
        <FilterRow
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          textQuery={textQuery}
          onTextChange={setTextQuery}
          timeFilter={timeFilter}
          onTimeChange={setTimeFilter}
        />
        <ViewToggle
          viewMode={viewMode}
          onChange={setViewMode}
          calendarMonth={calendarMonth}
          onShiftMonth={(delta) =>
            setCalendarAnchor((cur) => shiftAnchorByMonth(cur, delta))
          }
          onResetMonth={() => {
            const d = new Date();
            d.setDate(1);
            setCalendarAnchor(d);
          }}
        />
      </div>

      {/* ── Body — list or calendar ───────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean">
        {result.rows.length === 0 ? (
          <EmptyState />
        ) : viewMode === "list" ? (
          <ul className="flex flex-col">
            {result.rows.map((row) => (
              <LogisticsRowCard key={row.logistics.id} row={row} />
            ))}
          </ul>
        ) : calendarMonth ? (
          <CalendarGrid month={calendarMonth} />
        ) : null}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-line px-6 py-3 shrink-0 flex items-center justify-between bg-surface">
        <div className="flex items-baseline gap-3">
          <span className="text-[10.5px] text-ink-subtle tracking-tightish">
            {result.filteredCount}건 표시 · 기간 {result.totalCountInRange}건
          </span>
          <span className="text-[10px] text-ink-subtle italic tracking-tightish">
            운영 참고 · provider 기준
          </span>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </footer>
    </div>
  );
}

// ============================================================================
// KPI cards (5개)
// STEP 67 — 각 KPI card는 ClickableMetric으로 wrap + drilldown 호출. status별
// LOGISTICS_STATUS drilldown / 검수 대기는 awaiting_condition drilldown.
// ============================================================================

function KPISection({
  kpis,
}: {
  kpis: LogisticsAggregateResult["kpis"];
}) {
  const openDrilldown = useArtworkStore((s) => s.openDrilldown);

  return (
    <div className="grid grid-cols-5 gap-2">
      <ClickableMetric
        onClick={() =>
          openDrilldown({
            domain: "logistics_status",
            logisticsStatus: "READY_FOR_PICKUP",
          })
        }
        ariaLabel={`출고 대기 ${kpis.readyForPickupCount}건 — 상세 보기`}
      >
        <KPICard
          label="출고 대기"
          value={kpis.readyForPickupCount}
          color={LOGISTICS_STATUS_COLOR.READY_FOR_PICKUP}
        />
      </ClickableMetric>
      <ClickableMetric
        onClick={() =>
          openDrilldown({
            domain: "logistics_status",
            logisticsStatus: "IN_TRANSIT",
          })
        }
        ariaLabel={`배송 중 ${kpis.inTransitCount}건 — 상세 보기`}
      >
        <KPICard
          label="배송 중"
          value={kpis.inTransitCount}
          color={LOGISTICS_STATUS_COLOR.IN_TRANSIT}
        />
      </ClickableMetric>
      <ClickableMetric
        onClick={() =>
          openDrilldown({
            domain: "logistics_status",
            logisticsStatus: "DELIVERED",
          })
        }
        ariaLabel={`도착 완료 ${kpis.deliveredCount}건 — 상세 보기`}
      >
        <KPICard
          label="도착 완료"
          value={kpis.deliveredCount}
          color={LOGISTICS_STATUS_COLOR.DELIVERED}
        />
      </ClickableMetric>
      <ClickableMetric
        onClick={() =>
          openDrilldown({
            domain: "logistics_status",
            logisticsStatus: "CONDITION_CHECKED",
          })
        }
        ariaLabel={`검수 완료 ${kpis.conditionCheckedCount}건 — 상세 보기`}
      >
        <KPICard
          label="검수 완료"
          value={kpis.conditionCheckedCount}
          color={LOGISTICS_STATUS_COLOR.CONDITION_CHECKED}
        />
      </ClickableMetric>
      <ClickableMetric
        onClick={() =>
          openDrilldown({ domain: "logistics_awaiting_condition" })
        }
        ariaLabel={`검수 대기 ${kpis.awaitingConditionCheckCount}건 — 상세 보기`}
      >
        <KPICard
          label="검수 대기"
          value={kpis.awaitingConditionCheckCount}
          color={LOGISTICS_STATUS_COLOR.DELIVERED}
          emphasized={kpis.awaitingConditionCheckCount > 0}
          hint="인도 후 AFTER 검수 보고서 부재"
        />
      </ClickableMetric>
    </div>
  );
}

function KPICard({
  label,
  value,
  color,
  emphasized,
  hint,
}: {
  label: string;
  value: number;
  color: string;
  emphasized?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-line bg-surface px-2.5 py-2 flex flex-col gap-0.5",
        emphasized && "border-line-strong"
      )}
      title={hint}
    >
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[9.5px] uppercase tracking-[0.1em] text-ink-subtle font-medium truncate">
          {label}
        </span>
      </div>
      <span className="text-[18px] font-semibold tabular-nums text-ink tracking-tight">
        {value}
      </span>
    </div>
  );
}

// ============================================================================
// Filter row
// ============================================================================

const STATUS_CHIPS: ReadonlyArray<{
  value: LogisticsStatus | "all";
  label: string;
}> = [
  { value: "all", label: "전체" },
  { value: "READY_FOR_PICKUP", label: "출고 대기" },
  { value: "IN_TRANSIT", label: "배송 중" },
  { value: "DELIVERED", label: "인도 완료" },
  { value: "CONDITION_CHECKED", label: "검수 완료" },
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
  statusFilter: LogisticsStatus | "all";
  onStatusChange: (next: LogisticsStatus | "all") => void;
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
            placeholder="작품 / 작가 / carrier / tracking"
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
        <span className="ml-auto text-[10px] tabular-nums tracking-tightish text-ink-subtle truncate max-w-[16rem]">
          {formatTimeFilterLabel(timeFilter)}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Row card
// ============================================================================

function LogisticsRowCard({ row }: { row: LogisticsRow }) {
  const openLogisticsDetail = useArtworkStore((s) => s.openLogisticsDetail);
  const closeOps = useArtworkStore((s) => s.closeLogisticsOperations);
  const setSelectedArtwork = useArtworkStore((s) => s.select);

  const handleOpen = () => {
    if (row.artworkId) setSelectedArtwork(row.artworkId);
    closeOps();
    setTimeout(() => {
      openLogisticsDetail(row.logistics.id);
    }, 0);
  };

  const log = row.logistics;
  const statusLabel = LOGISTICS_STATUS_LABEL[log.status];
  const statusColor = LOGISTICS_STATUS_COLOR[log.status];

  // Provider 라벨 — STEP 50 sync 기록이 있으면 노출
  const providerLabel = log.providerId
    ? log.providerIsMock
      ? `${log.providerId} · mock`
      : log.providerId
    : null;

  return (
    <li>
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          "w-full text-left px-6 py-3 border-b border-line",
          "hover:bg-surface-muted/60 transition-colors",
          "focus:outline-none focus:bg-surface-muted/80",
          "grid grid-cols-[140px_1fr_140px_120px] gap-3 items-baseline"
        )}
      >
        {/* col 1: status + condition badges */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: statusColor }}
            />
            <span className="text-[11px] text-ink truncate tracking-tightish font-medium">
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {row.hasBeforeReport && (
              <ConditionBadge label="BEFORE" status={null} />
            )}
            {row.hasAfterReport && (
              <ConditionBadge label="AFTER" status={row.latestConditionStatus} />
            )}
            {/* 검수 대기 시각 표시 — DELIVERED + AFTER 부재 */}
            {log.status === "DELIVERED" && !row.hasAfterReport && (
              <span className="text-[8.5px] tracking-[0.06em] px-1 py-px rounded border border-status-deal/60 text-status-deal italic">
                검수 대기
              </span>
            )}
          </div>
        </div>

        {/* col 2: artwork title + artist + axid + carrier/tracking */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[12.5px] font-medium text-ink truncate tracking-tightish">
            {row.artworkTitle}
          </span>
          <span className="text-[10.5px] text-ink-subtle truncate tracking-tightish">
            {row.artistName}
            <span className="font-mono ml-2">{row.artworkAxidCode}</span>
            {row.buyerLabel !== "—" && (
              <span className="ml-2 text-ink-muted">→ {row.buyerLabel}</span>
            )}
          </span>
          {(log.carrierName || log.trackingNumber) && (
            <span className="text-[10px] text-ink-subtle truncate tracking-tightish">
              {log.carrierName || "—"}
              {log.trackingNumber && (
                <span className="font-mono ml-2">{log.trackingNumber}</span>
              )}
              {providerLabel && (
                <span className="ml-2 italic">· {providerLabel}</span>
              )}
            </span>
          )}
        </div>

        {/* col 3: provider sync info */}
        <div className="text-right">
          {log.providerLastSyncedAt ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10.5px] text-ink-muted tracking-tightish">
                최근 조회
              </span>
              <span className="text-[10px] tabular-nums text-ink-subtle tracking-tightish">
                {formatDate(log.providerLastSyncedAt)}
              </span>
            </div>
          ) : (
            <span className="text-[9.5px] text-ink-subtle italic tracking-tightish">
              sync 기록 없음
            </span>
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
      </button>
    </li>
  );
}

function ConditionBadge({
  label,
  status,
}: {
  label: string;
  status: "GOOD" | "WATCH" | "DAMAGED" | null;
}) {
  // GOOD: neutral / WATCH: amber / DAMAGED: red. Status null이면 단순 outline.
  const colorClass =
    status === "DAMAGED"
      ? "border-status-deal/70 text-status-deal"
      : status === "WATCH"
        ? "border-status-inquiry/70 text-status-inquiry"
        : "border-line-strong text-ink-muted";
  return (
    <span
      className={cn(
        "text-[8.5px] tracking-[0.06em] px-1 py-px rounded border",
        colorClass
      )}
      title={status ? `Condition: ${status}` : undefined}
    >
      {label}
      {status && status !== "GOOD" && <span className="ml-1">· {status}</span>}
    </span>
  );
}

// ============================================================================
// Empty state
// ============================================================================

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center px-6 py-10">
      <div className="text-center max-w-sm">
        <p className="text-[12px] text-ink-muted tracking-tightish">
          현재 필터 조건에 해당하는 logistics record가 없습니다.
        </p>
        <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1.5 leading-relaxed">
          상태 / 기간 / 검색을 조정해보세요. logistics는 거래에서 생성되며, 본
          화면은 운영 참고용 검색 view입니다.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

// ============================================================================
// STEP 58 — Bulk Sync Bar
// ============================================================================

function BulkSyncBar({
  rowCount,
  syncStatus,
  onBulkSync,
}: {
  rowCount: number;
  syncStatus:
    | { kind: "idle" }
    | { kind: "syncing"; total: number }
    | { kind: "done"; ok: number; skipped: number; failed: number };
  onBulkSync: () => void;
}) {
  const isBusy = syncStatus.kind === "syncing";
  const disabled = rowCount === 0 || isBusy;
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-baseline gap-2 text-[10.5px] tracking-tightish text-ink-subtle">
        <span>현재 필터된 {rowCount}건에 대해 provider 일괄 조회</span>
        <span className="italic text-[9.5px]">
          locked record는 자동 skip
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {syncStatus.kind === "syncing" && (
          <span className="text-[10.5px] text-ink-subtle italic tracking-tightish">
            sync 중... ({syncStatus.total}건)
          </span>
        )}
        {syncStatus.kind === "done" && (
          <span className="text-[10.5px] tracking-tightish">
            <span className="text-ink">최근 조회 완료</span>
            <span className="text-ink-subtle ml-1">
              · 성공 {syncStatus.ok} · skip {syncStatus.skipped}
              {syncStatus.failed > 0 && (
                <span className="text-status-deal ml-1">
                  · 실패 {syncStatus.failed}
                </span>
              )}
            </span>
          </span>
        )}
        <button
          type="button"
          onClick={disabled ? undefined : onBulkSync}
          disabled={disabled}
          aria-disabled={disabled || undefined}
          className={cn(
            "h-7 px-3 rounded-md text-[11px] tracking-tightish border transition-colors",
            disabled
              ? "bg-surface text-ink-subtle border-line cursor-not-allowed opacity-50"
              : "bg-surface text-ink border-line hover:bg-surface-muted hover:border-line-strong"
          )}
        >
          전체 Sync
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 58 — View Toggle (List / Calendar)
// ============================================================================

function ViewToggle({
  viewMode,
  onChange,
  calendarMonth,
  onShiftMonth,
  onResetMonth,
}: {
  viewMode: "list" | "calendar";
  onChange: (next: "list" | "calendar") => void;
  calendarMonth: CalendarMonth | null;
  onShiftMonth: (delta: number) => void;
  onResetMonth: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        <ViewToggleButton
          label="리스트"
          active={viewMode === "list"}
          onClick={() => onChange("list")}
        />
        <ViewToggleButton
          label="캘린더"
          active={viewMode === "calendar"}
          onClick={() => onChange("calendar")}
        />
      </div>
      {viewMode === "calendar" && calendarMonth && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onShiftMonth(-1)}
            aria-label="이전 달"
            className="h-6 w-6 rounded text-[12px] text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors flex items-center justify-center"
          >
            ←
          </button>
          <span className="text-[11.5px] tabular-nums tracking-tightish text-ink min-w-[80px] text-center">
            {calendarMonth.monthLabel}
          </span>
          <button
            type="button"
            onClick={() => onShiftMonth(1)}
            aria-label="다음 달"
            className="h-6 w-6 rounded text-[12px] text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors flex items-center justify-center"
          >
            →
          </button>
          <button
            type="button"
            onClick={onResetMonth}
            className="h-6 px-2 ml-1 rounded text-[10.5px] text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors tracking-tightish"
            title="이번 달로 이동"
          >
            오늘
          </button>
          <span className="text-[10px] text-ink-subtle italic tracking-tightish ml-2">
            예정 일정 {calendarMonth.inMonthItemCount}건
          </span>
        </div>
      )}
    </div>
  );
}

function ViewToggleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-7 px-3 rounded-md text-[11px] tracking-tightish border transition-colors",
        active
          ? "bg-ink text-white border-ink"
          : "bg-surface text-ink-muted border-line hover:bg-surface-muted hover:text-ink"
      )}
    >
      {label}
    </button>
  );
}

// ============================================================================
// STEP 58 — Calendar Grid
// ============================================================================

function CalendarGrid({ month }: { month: CalendarMonth }) {
  return (
    <div className="px-6 py-4">
      {/* weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {CALENDAR_WEEKDAY_LABELS_KR.map((label, idx) => (
          <div
            key={label}
            className={cn(
              "text-[9.5px] uppercase tracking-[0.1em] font-medium text-center pb-1",
              idx === 0 && "text-status-deal/70",
              idx === 6 && "text-status-deal/50",
              idx > 0 && idx < 6 && "text-ink-subtle"
            )}
          >
            {label}
          </div>
        ))}
      </div>
      {/* 6 x 7 = 42 cells */}
      <div className="grid grid-cols-7 gap-1">
        {month.cells.map((cell) => (
          <CalendarCellCard key={cell.isoDate} cell={cell} />
        ))}
      </div>
      {/* legend */}
      <div className="mt-4 flex items-center gap-3 flex-wrap text-[9.5px] tracking-tightish text-ink-subtle">
        <span className="font-medium uppercase tracking-[0.1em]">상태</span>
        <LegendDot color={LOGISTICS_STATUS_COLOR.READY_FOR_PICKUP} label="출고 대기" />
        <LegendDot color={LOGISTICS_STATUS_COLOR.IN_TRANSIT} label="배송 중" />
        <LegendDot color={LOGISTICS_STATUS_COLOR.DELIVERED} label="인도 완료" />
        <LegendDot color={LOGISTICS_STATUS_COLOR.CONDITION_CHECKED} label="검수 완료" />
        <span className="ml-auto italic text-[9px]">
          pickup &gt; delivery &gt; primary 우선순위
        </span>
      </div>
    </div>
  );
}

function CalendarCellCard({ cell }: { cell: CalendarCell }) {
  // STEP 67 — cell의 item count badge + "+N건" overflow 라벨을 클릭 시
  // logistics_calendar_day drilldown으로 dispatch.
  const openDrilldown = useArtworkStore((s) => s.openDrilldown);
  const handleDayClick = () => {
    if (cell.items.length === 0) return;
    openDrilldown({
      domain: "logistics_calendar_day",
      isoDate: cell.isoDate,
    });
  };

  return (
    <div
      className={cn(
        "min-h-[80px] rounded-md border p-1.5 flex flex-col gap-1",
        cell.inMonth
          ? "bg-surface border-line"
          : "bg-surface-muted/30 border-line/50",
        cell.isToday && "border-line-strong ring-1 ring-line-strong/30"
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[10px] tabular-nums tracking-tightish",
            cell.inMonth ? "text-ink-muted" : "text-ink-subtle/50",
            cell.isToday && "text-ink font-semibold"
          )}
        >
          {cell.dayOfMonth}
        </span>
        {cell.items.length > 0 && (
          <button
            type="button"
            onClick={handleDayClick}
            title={`${cell.isoDate} · ${cell.items.length}건 — 상세 보기`}
            className="text-[8.5px] tabular-nums tracking-tightish text-ink-subtle hover:text-ink rounded px-0.5 transition-colors"
          >
            {cell.items.length}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-0.5 min-h-0 overflow-hidden">
        {cell.items.slice(0, 3).map((item) => (
          <CalendarItemRow key={item.row.logistics.id} item={item} />
        ))}
        {cell.items.length > 3 && (
          <button
            type="button"
            onClick={handleDayClick}
            title={`${cell.isoDate} · 전체 ${cell.items.length}건 보기`}
            className="text-[8.5px] text-ink-subtle italic tracking-tightish text-left hover:text-ink hover:underline transition-colors"
          >
            +{cell.items.length - 3}건
          </button>
        )}
      </div>
    </div>
  );
}

function CalendarItemRow({ item }: { item: CalendarItem }) {
  const openLogisticsDetail = useArtworkStore((s) => s.openLogisticsDetail);
  const closeOps = useArtworkStore((s) => s.closeLogisticsOperations);
  const setSelectedArtwork = useArtworkStore((s) => s.select);

  const log = item.row.logistics;
  const statusColor = LOGISTICS_STATUS_COLOR[log.status];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.row.artworkId) setSelectedArtwork(item.row.artworkId);
    closeOps();
    setTimeout(() => {
      openLogisticsDetail(log.id);
    }, 0);
  };

  const fromLabel =
    item.pickedFrom === "pickup"
      ? "픽업"
      : item.pickedFrom === "delivery"
        ? "인도"
        : "참고";

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`${item.row.artworkTitle} · ${item.row.artistName} · ${fromLabel} ${item.pickedDate}`}
      className={cn(
        "flex items-center gap-1 px-1 py-0.5 rounded",
        "text-left text-[9px] tracking-tightish leading-tight",
        "hover:bg-surface-muted transition-colors min-w-0"
      )}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-full shrink-0"
        style={{ backgroundColor: statusColor }}
      />
      <span className="truncate text-ink">
        {item.row.artworkTitle}
      </span>
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </span>
  );
}
