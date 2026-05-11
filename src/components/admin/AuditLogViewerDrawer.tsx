// ============================================================================
// AuditLogViewerDrawer — STEP 65 / STEP 78 / STEP 83.
//
// OWNER 전용 system-level 운영 로그 viewer. SystemAuditEvent[] 조회 + category /
// severity 필터 + (옵션) clear (확인 dialog 보호). read-only by default — 단일
// destructive action은 OWNER 전용 confirm + audit 자기참조 entry로 transparent.
//
// **artwork-scoped AuditLogDrawer (작품별 timeline viewer)와 별개** —
// system / admin 운영 기록만 표시.
//
// **STEP 78 — Audit Log Filter Drilldown**:
//   본 drawer의 summary / category / severity count는 OperationalDrilldownDrawer
//   (STEP 67 reusable architecture)의 `audit_*` 도메인을 호출하여 *연결 이벤트
//   list view*로 진입한다. row.artworkId가 추출되면 (metadata.artworkId 또는
//   targetType="artwork" + targetRef) 작품으로 navigate 가능 (rule_1).
//
// **STEP 83 — Audit Event Export**:
//   footer button 확장 — [닫기] → [CSV] [JSON] [닫기] (rule_15 max 3 buttons
//   한도 내). filtered events만 export — \"What you see is what you export\"
//   원칙. CSV는 RFC 4180 + UTF-8 BOM (Excel 한글 호환), JSON은 pretty 2-space
//   indent. 모든 disclaimer 부정형 only — 결과 보장 / 법적 효력 표현 0건.
//
// **표현 정책 (사용자 spec STEP 65 + STEP 78 + STEP 83):**
//   - "운영 로그" / "시스템 기록" / "운영 참고" / "상세 보기" / "연결 이벤트"
//   - "device-local" / "audit event" / "export snapshot"
//   - "legal audit" / "compliance guaranteed" / "permanent record" /
//     "forensic proof" / "tamper-proof" / "법적 감사 기록" / "certified audit" /
//     "forensic evidence" 표현 0건
//
// **UI 원칙**: institutional minimalism / text-first / 그림자 0 / 그래프 0.
// ============================================================================

"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import { hasPermission } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { ClickableMetric } from "@/components/drilldown/ClickableMetric";
import {
  AUDIT_CATEGORY_LABEL_KR,
  AUDIT_SEVERITY_LABEL_KR,
  type AuditCategory,
  type AuditSeverity,
  type SystemAuditEvent,
} from "@/types/audit-event";
import { exportSystemAudit } from "@/lib/system-audit-export";
import {
  buildAuditTrend,
  dayBoundaryIso,
  type AuditTrendDay,
  type TrendWindow,
} from "@/lib/audit-trend";

// ============================================================================
// Drawer wrapper
// ============================================================================

export function AuditLogViewerDrawer() {
  const request = useArtworkStore((s) => s.systemAuditLogRequest);
  const close = useArtworkStore((s) => s.closeSystemAuditLog);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const isAllowed = hasPermission(currentRole, "audit.view");
  const isOpen = request.kind === "open" && isAllowed;

  return (
    <Drawer
      open={isOpen}
      onClose={close}
      title="운영 로그"
      widthClass="w-[760px]"
    >
      {isOpen && <ViewerBody onClose={close} />}
    </Drawer>
  );
}

// ============================================================================
// Body
// ============================================================================

type CategoryFilter = AuditCategory | "all";
type SeverityFilter = AuditSeverity | "all";

const CATEGORY_OPTIONS: ReadonlyArray<{
  value: CategoryFilter;
  label: string;
}> = [
  { value: "all", label: "전체 카테고리" },
  { value: "image_storage", label: AUDIT_CATEGORY_LABEL_KR.image_storage },
  { value: "backup", label: AUDIT_CATEGORY_LABEL_KR.backup },
  { value: "restore", label: AUDIT_CATEGORY_LABEL_KR.restore },
  { value: "permission", label: AUDIT_CATEGORY_LABEL_KR.permission },
  { value: "system", label: AUDIT_CATEGORY_LABEL_KR.system },
];

const SEVERITY_OPTIONS: ReadonlyArray<{
  value: SeverityFilter;
  label: string;
}> = [
  { value: "all", label: "전체 단계" },
  { value: "info", label: AUDIT_SEVERITY_LABEL_KR.info },
  { value: "warning", label: AUDIT_SEVERITY_LABEL_KR.warning },
  { value: "error", label: AUDIT_SEVERITY_LABEL_KR.error },
];

function ViewerBody({ onClose }: { onClose: () => void }) {
  const auditEvents = useArtworkStore((s) => s.auditEvents);
  const clearAuditEvents = useArtworkStore((s) => s.clearAuditEvents);
  // STEP 78 — drilldown 진입점.
  const openDrilldown = useArtworkStore((s) => s.openDrilldown);
  const closeAuditViewer = useArtworkStore((s) => s.closeSystemAuditLog);

  const [categoryFilter, setCategoryFilter] =
    React.useState<CategoryFilter>("all");
  const [severityFilter, setSeverityFilter] =
    React.useState<SeverityFilter>("all");

  // 필터 적용 + 정렬은 store가 이미 최신순으로 유지 (push at index 0).
  const filtered = React.useMemo(() => {
    return auditEvents.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter)
        return false;
      if (severityFilter !== "all" && e.severity !== severityFilter)
        return false;
      return true;
    });
  }, [auditEvents, categoryFilter, severityFilter]);

  // KPI: severity 카운트 (전체 기준 — 필터 무관)
  const severityCounts = React.useMemo(() => {
    const counts: Record<AuditSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
    };
    for (const e of auditEvents) {
      if (counts[e.severity] !== undefined) counts[e.severity] += 1;
    }
    return counts;
  }, [auditEvents]);

  // STEP 78 — category 카운트 (전체 기준 — 카테고리 chip strip용).
  const categoryCounts = React.useMemo(() => {
    const counts: Record<AuditCategory, number> = {
      image_storage: 0,
      backup: 0,
      restore: 0,
      permission: 0,
      system: 0,
    };
    for (const e of auditEvents) {
      if (counts[e.category as AuditCategory] !== undefined) {
        counts[e.category as AuditCategory] += 1;
      }
    }
    return counts;
  }, [auditEvents]);

  // STEP 78 — 동작별 카운트 (action 자체는 free string — store / 도메인이
  // 자유롭게 발급). 운영 환경 대부분 actions는 STEP 80 orphan_remove_request_*
  // 같은 명시적 dotted/snake notation으로 발급되어 통계 의미 있음.
  // top 5 + 결정성 정렬 (count desc → action asc) — 노이즈 회피.
  // 본 strip는 actionBreakdown.length >= 2 일 때만 렌더 (rule_16 미니멀리즘).
  const actionBreakdown = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of auditEvents) {
      counts.set(e.action, (counts.get(e.action) ?? 0) + 1);
    }
    const entries = Array.from(counts.entries()).map(([action, count]) => ({
      action,
      count,
    }));
    entries.sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.action.localeCompare(b.action);
    });
    return entries.slice(0, 5);
  }, [auditEvents]);

  // STEP 78 — drilldown 진입 핸들러. drawer를 닫고 OperationalDrilldownDrawer
  // 를 열어 layer 전환 (rule_17 — 두 drawer 동시 노출 회피, 사용자 spec
  // "no modal stacking chaos" 준수). 완료 후 사용자가 drilldown drawer를
  // 닫으면 자연 작품 컨텍스트 (rule_1) 또는 sidebar로 복귀.
  const handleOpenAuditDrilldown = React.useCallback(
    (
      domain:
        | "audit_events"
        | "audit_category"
        | "audit_severity"
        | "audit_action",
      extra: {
        auditCategory?: AuditCategory;
        auditSeverity?: AuditSeverity;
        auditAction?: string;
        // STEP 85 — Trend day-dot click 시 narrow timeRange. STEP 78 payload
        // 필드의 첫 활성 사용처. 부재 시 전 기간.
        periodFromIso?: string;
        periodToIso?: string;
      } = {}
    ) => {
      closeAuditViewer();
      // setTimeout(0) — drawer close → re-render → drilldown open 안정 transition
      // (STEP 51/72 패턴 일관 — modal/drawer layer 충돌 회피)
      setTimeout(() => {
        openDrilldown({
          domain,
          auditCategory: extra.auditCategory,
          auditSeverity: extra.auditSeverity,
          auditAction: extra.auditAction,
          periodFromIso: extra.periodFromIso,
          periodToIso: extra.periodToIso,
        });
      }, 0);
    },
    [closeAuditViewer, openDrilldown]
  );

  const handleClear = React.useCallback(() => {
    if (typeof window === "undefined") return;
    if (auditEvents.length === 0) return;

    const ok = window.confirm(
      [
        `현재 device의 운영 로그를 비웁니다.`,
        ``,
        `- 영향: 본 device의 ${auditEvents.length}건 entry가 제거됩니다.`,
        `- 다른 device 영향 0 — 본 작업은 device-local 기록에만 적용.`,
        `- 비움 자체는 단일 audit entry로 기록됩니다 (transparent).`,
        `- 작품 timeline / 도메인 데이터 영향 0.`,
        ``,
        `계속하시겠습니까?`,
      ].join("\n")
    );
    if (!ok) return;
    clearAuditEvents();
  }, [auditEvents.length, clearAuditEvents]);

  // STEP 83 — Export handler. \"What you see is what you export\" — 현재
  // viewer가 노출 중인 filtered events만 export. category / severity 필터
  // inherit. CSV / JSON 단일 dispatcher에 format만 위임. filtered.length === 0
  // 일 때 button disabled로 호출 차단되지만, 안전 가드로 본 callback에서도
  // early return.
  const handleExport = React.useCallback(
    (format: "csv" | "json") => {
      if (filtered.length === 0) return;
      exportSystemAudit(format, filtered, {
        generatedAt: new Date().toISOString(),
        filters: {
          category: categoryFilter,
          severity: severityFilter,
          // 향후 timeRange / search 추가 시 viewer state로 채움
          timeRange: null,
          searchQuery: undefined,
        },
        totalEventCount: auditEvents.length,
      });
    },
    [filtered, categoryFilter, severityFilter, auditEvents.length]
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Summary + filters + clear ───────────────────────────────────── */}
      <div className="px-6 pt-4 pb-3 border-b border-line shrink-0 flex flex-col gap-3">
        <SummaryRow
          total={auditEvents.length}
          counts={severityCounts}
          onOpenDrilldown={handleOpenAuditDrilldown}
        />
        {/* STEP 78 — 카테고리 chip strip (모든 카테고리 노출, count=0 disabled) */}
        <CategoryChipsRow
          counts={categoryCounts}
          onOpenDrilldown={handleOpenAuditDrilldown}
        />
        {/* STEP 78 — 동작별 chip strip (top 5, 2건 이상일 때만 렌더 — rule_16) */}
        {actionBreakdown.length >= 2 && (
          <ActionBreakdownRow
            entries={actionBreakdown}
            onOpenDrilldown={handleOpenAuditDrilldown}
          />
        )}
        {/* STEP 85 — Audit Trend Visualization (events 1건 이상일 때만 렌더) */}
        {auditEvents.length > 0 && (
          <TrendSection
            events={auditEvents}
            categoryFilter={categoryFilter}
            severityFilter={severityFilter}
            onOpenDrilldown={handleOpenAuditDrilldown}
          />
        )}
        <FilterRow
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          severityFilter={severityFilter}
          onSeverityChange={setSeverityFilter}
          onClear={handleClear}
          canClear={auditEvents.length > 0}
        />
      </div>

      {/* ── List ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean">
        {filtered.length === 0 ? (
          <EmptyState
            isFilterActive={
              categoryFilter !== "all" || severityFilter !== "all"
            }
            totalCount={auditEvents.length}
          />
        ) : (
          <ul className="flex flex-col">
            {filtered.map((event) => (
              <AuditEventRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-line px-6 py-3 shrink-0 flex items-center justify-between gap-3 bg-surface">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="text-[10.5px] text-ink-subtle tracking-tightish whitespace-nowrap">
            {filtered.length}건 표시 · 전체 {auditEvents.length}건
          </span>
          <span className="text-[10px] text-ink-subtle italic tracking-tightish truncate">
            Owner 전용 · device-local 시스템 기록 · 운영 참고용
          </span>
        </div>
        {/* STEP 83 — export button strip + 닫기. rule_15 max 3 buttons. */}
        <div className="flex items-center gap-2 shrink-0">
          <ExportButton
            label="CSV"
            disabled={filtered.length === 0}
            onClick={() => handleExport("csv")}
            title="운영 참고용 CSV export — RFC 4180 / UTF-8 BOM"
          />
          <ExportButton
            label="JSON"
            disabled={filtered.length === 0}
            onClick={() => handleExport("json")}
            title="운영 참고용 JSON export — 2-space pretty"
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
// STEP 83 — Export Button (text-first, 절제된 톤)
//
// rule_16 minimalism — Button primitive 변형 대신 작은 outlined button로 일관.
// disabled 시 opacity-50 + cursor-not-allowed (filter 결과 0건 케이스 graceful).
// ============================================================================

function ExportButton({
  label,
  disabled,
  onClick,
  title,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      title={title}
      className={cn(
        "h-7 px-2.5 rounded-md text-[10.5px] tracking-tightish border transition-colors",
        disabled
          ? "bg-surface text-ink-subtle border-line cursor-not-allowed opacity-50"
          : "bg-surface text-ink border-line hover:bg-surface-muted hover:border-line-strong"
      )}
    >
      {label}
    </button>
  );
}

// ============================================================================
// Summary Row — 4 cards (STEP 78 — clickable via OperationalDrilldownDrawer)
// ============================================================================

type AuditDrilldownDomain =
  | "audit_events"
  | "audit_category"
  | "audit_severity"
  | "audit_action";

interface AuditDrilldownExtra {
  auditCategory?: AuditCategory;
  auditSeverity?: AuditSeverity;
  auditAction?: string;
  /** STEP 85 — TrendSection day-dot click 시 narrow. STEP 78 payload 활용. */
  periodFromIso?: string;
  periodToIso?: string;
}

function SummaryRow({
  total,
  counts,
  onOpenDrilldown,
}: {
  total: number;
  counts: Record<AuditSeverity, number>;
  onOpenDrilldown: (
    domain: AuditDrilldownDomain,
    extra?: AuditDrilldownExtra
  ) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <ClickableMetric
        onClick={total > 0 ? () => onOpenDrilldown("audit_events") : undefined}
        disabled={total === 0}
        ariaLabel="전체 운영 로그 — 상세 보기"
      >
        <SummaryCard label="전체" value={`${total}건`} />
      </ClickableMetric>
      <ClickableMetric
        onClick={
          counts.info > 0
            ? () =>
                onOpenDrilldown("audit_severity", { auditSeverity: "info" })
            : undefined
        }
        disabled={counts.info === 0}
        ariaLabel="정보 단계 운영 로그 — 상세 보기"
      >
        <SummaryCard label="정보" value={`${counts.info}건`} />
      </ClickableMetric>
      <ClickableMetric
        onClick={
          counts.warning > 0
            ? () =>
                onOpenDrilldown("audit_severity", { auditSeverity: "warning" })
            : undefined
        }
        disabled={counts.warning === 0}
        ariaLabel="주의 단계 운영 로그 — 상세 보기"
      >
        <SummaryCard
          label="주의"
          value={`${counts.warning}건`}
          emphasized={counts.warning > 0}
          tone="warning"
        />
      </ClickableMetric>
      <ClickableMetric
        onClick={
          counts.error > 0
            ? () =>
                onOpenDrilldown("audit_severity", { auditSeverity: "error" })
            : undefined
        }
        disabled={counts.error === 0}
        ariaLabel="오류 단계 운영 로그 — 상세 보기"
      >
        <SummaryCard
          label="오류"
          value={`${counts.error}건`}
          emphasized={counts.error > 0}
          tone="error"
        />
      </ClickableMetric>
    </div>
  );
}

// ============================================================================
// STEP 78 — Category Chips Row
//
// 5개 카테고리 모두 노출 (예측 가능성 + 운영자 환기), count === 0인 카테고리는
// disabled. 각 chip 클릭 → audit_category drilldown.
// ClickableMetric으로 wrap — STEP 67 reusable interaction.
// ============================================================================

const CATEGORY_CHIP_ORDER: ReadonlyArray<AuditCategory> = [
  "image_storage",
  "backup",
  "restore",
  "permission",
  "system",
];

function CategoryChipsRow({
  counts,
  onOpenDrilldown,
}: {
  counts: Record<AuditCategory, number>;
  onOpenDrilldown: (
    domain: AuditDrilldownDomain,
    extra?: AuditDrilldownExtra
  ) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[9.5px] uppercase tracking-[0.12em] text-ink-subtle font-semibold mr-1">
        카테고리별
      </span>
      {CATEGORY_CHIP_ORDER.map((cat) => {
        const count = counts[cat] ?? 0;
        const enabled = count > 0;
        return (
          <ClickableMetric
            key={cat}
            onClick={
              enabled
                ? () =>
                    onOpenDrilldown("audit_category", { auditCategory: cat })
                : undefined
            }
            disabled={!enabled}
            ariaLabel={`${AUDIT_CATEGORY_LABEL_KR[cat]} 운영 로그 — 상세 보기`}
          >
            <CategoryChip
              label={AUDIT_CATEGORY_LABEL_KR[cat]}
              count={count}
              enabled={enabled}
            />
          </ClickableMetric>
        );
      })}
    </div>
  );
}

function CategoryChip({
  label,
  count,
  enabled,
}: {
  label: string;
  count: number;
  enabled: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 h-6 px-2 rounded-full border bg-surface text-[10px] tracking-tightish",
        enabled
          ? "border-line text-ink"
          : "border-line/60 text-ink-subtle opacity-60"
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums font-medium">{count}</span>
    </span>
  );
}

// ============================================================================
// STEP 78 — Action Breakdown Row
//
// 동작별 chip strip — top 5 actions, action 자체는 free string이므로 mono로
// 표시. count >= 2 distinct actions일 때만 부모가 렌더 (rule_16 미니멀리즘).
// 각 chip 클릭 → audit_action drilldown ({ auditAction: action } payload).
// ============================================================================

function ActionBreakdownRow({
  entries,
  onOpenDrilldown,
}: {
  entries: ReadonlyArray<{ action: string; count: number }>;
  onOpenDrilldown: (
    domain: AuditDrilldownDomain,
    extra?: AuditDrilldownExtra
  ) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[9.5px] uppercase tracking-[0.12em] text-ink-subtle font-semibold mr-1">
        동작별
      </span>
      {entries.map((e) => (
        <ClickableMetric
          key={e.action}
          onClick={() =>
            onOpenDrilldown("audit_action", { auditAction: e.action })
          }
          ariaLabel={`동작 ${e.action} 운영 로그 — 상세 보기`}
        >
          <ActionChip action={e.action} count={e.count} />
        </ClickableMetric>
      ))}
    </div>
  );
}

function ActionChip({ action, count }: { action: string; count: number }) {
  return (
    <span
      className="inline-flex items-baseline gap-1.5 h-6 px-2 rounded-full border bg-surface text-[10px] tracking-tightish border-line text-ink"
      title={action}
    >
      <span className="font-mono truncate max-w-[180px]">{action}</span>
      <span className="tabular-nums font-medium">{count}</span>
    </span>
  );
}

// ============================================================================
// STEP 85 — Trend Section
//
// 7일 / 30일 rolling window의 daily aggregation을 text-first dot strip으로
// 시각화. dot 클릭 → handleOpenAuditDrilldown(timeRange narrow) → STEP 78
// drilldown drawer로 layer 전환.
//
// **디자인 원칙 (rule_16 미니멀리즘 + 사용자 spec)**:
//   - text-first / dense dashboard 회피 / chart 라이브러리 0개
//   - dot은 severity tone subtle color (info=ink-muted, warning=inquiry-amber,
//     error=deal-red, empty=line/30 faint)
//   - dot 크기는 count 비율 — 미세한 시각적 차이로 노이즈 회피
//   - 오늘은 ring border로 구분 (subtle)
//   - 기존 viewer 다른 section (SummaryRow / Chips / FilterRow)과 톤 일관
//
// **Interactive Drilldown (사용자 spec)**:
//   - dot 클릭 → 해당 day의 local 00:00 ~ 23:59:59.999 UTC ISO range 변환
//   - categoryFilter / severityFilter inherit ("기존 filtering flow reuse")
//   - drilldown domain 결정:
//       categoryFilter !== "all" → audit_category {auditCategory}
//       severityFilter !== "all" → audit_severity {auditSeverity}
//       둘 다 "all"            → audit_events
//     모두 periodFromIso / periodToIso 동반.
// ============================================================================

function TrendSection({
  events,
  categoryFilter,
  severityFilter,
  onOpenDrilldown,
}: {
  events: ReadonlyArray<SystemAuditEvent>;
  categoryFilter: CategoryFilter;
  severityFilter: SeverityFilter;
  onOpenDrilldown: (
    domain: AuditDrilldownDomain,
    extra?: AuditDrilldownExtra
  ) => void;
}) {
  const [windowDays, setWindowDays] = React.useState<TrendWindow>(7);

  // 결정성: events 변화 시에만 재계산. now는 component mount 기준 1회 계산
  // (수 초 단위 stale은 trend 시각화에 무관).
  const trendDays = React.useMemo(
    () => buildAuditTrend(events, windowDays),
    [events, windowDays]
  );

  const windowTotalCount = React.useMemo(
    () => trendDays.reduce((sum, d) => sum + d.count, 0),
    [trendDays]
  );

  // dot 클릭 — 현재 viewer 필터를 inherit하여 적절한 drilldown domain 결정.
  const handleDayClick = React.useCallback(
    (day: AuditTrendDay) => {
      if (day.count === 0) return; // empty day는 클릭 무효 (button disabled)
      const { fromIso, toIso } = dayBoundaryIso(day);
      const extra: AuditDrilldownExtra = {
        periodFromIso: fromIso,
        periodToIso: toIso,
      };
      if (categoryFilter !== "all") {
        onOpenDrilldown("audit_category", {
          ...extra,
          auditCategory: categoryFilter,
        });
      } else if (severityFilter !== "all") {
        onOpenDrilldown("audit_severity", {
          ...extra,
          auditSeverity: severityFilter,
        });
      } else {
        onOpenDrilldown("audit_events", extra);
      }
    },
    [categoryFilter, severityFilter, onOpenDrilldown]
  );

  return (
    <div className="flex flex-col gap-1.5">
      {/* ── 헤더: 라벨 + 토글 + 합계 ─────────────────────────── */}
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className="text-[9.5px] uppercase tracking-[0.12em] text-ink-subtle font-semibold">
            시간 흐름
          </span>
          <span className="text-[9.5px] text-ink-subtle italic tracking-tightish">
            최근 {windowDays}일 · {windowTotalCount}건
          </span>
        </div>
        <TrendWindowToggle value={windowDays} onChange={setWindowDays} />
      </div>
      {/* ── Dot strip ──────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-end gap-[3px] py-1",
          windowDays === 30 && "gap-[2px]"
        )}
        role="list"
        aria-label={`최근 ${windowDays}일 운영 흐름`}
      >
        {trendDays.map((day) => (
          <TrendDay
            key={day.dateKey}
            day={day}
            compact={windowDays === 30}
            onClick={handleDayClick}
          />
        ))}
      </div>
      {/* ── 보조 안내 ─────────────────────────────────────── */}
      <span className="text-[9.5px] text-ink-subtle italic tracking-tightish leading-snug">
        일자 클릭 시 해당 기간으로 좁혀 상세 보기 — 운영 참고용
      </span>
    </div>
  );
}

function TrendWindowToggle({
  value,
  onChange,
}: {
  value: TrendWindow;
  onChange: (next: TrendWindow) => void;
}) {
  return (
    <div
      className="inline-flex items-center rounded-md border border-line bg-surface overflow-hidden"
      role="group"
      aria-label="기간 선택"
    >
      <ToggleButton
        active={value === 7}
        onClick={() => onChange(7)}
        label="7일"
      />
      <ToggleButton
        active={value === 30}
        onClick={() => onChange(30)}
        label="30일"
      />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-6 px-2.5 text-[10px] tracking-tightish transition-colors",
        active
          ? "bg-ink text-canvas font-medium"
          : "bg-surface text-ink-subtle hover:bg-surface-muted"
      )}
    >
      {label}
    </button>
  );
}

function TrendDay({
  day,
  compact,
  onClick,
}: {
  day: AuditTrendDay;
  compact: boolean;
  onClick: (day: AuditTrendDay) => void;
}) {
  const enabled = day.count > 0;
  const dotSize = computeDotSize(day.count);
  const toneClass = trendDotToneClass(day.dominantSeverity);
  const cellWidthClass = compact ? "w-[18px]" : "w-[36px]";
  const dotPx = compact
    ? Math.max(4, dotSize - 2) // 30일은 살짝 더 작게
    : dotSize;

  return (
    <button
      type="button"
      onClick={enabled ? () => onClick(day) : undefined}
      disabled={!enabled}
      role="listitem"
      aria-label={
        enabled
          ? `${day.dateKey} · ${day.count}건 — 클릭하면 해당일 상세 보기`
          : `${day.dateKey} · 0건`
      }
      title={
        enabled
          ? `${day.dateKey} · ${day.count}건${day.dominantSeverity ? ` (${day.dominantSeverity})` : ""}`
          : `${day.dateKey} · 0건`
      }
      className={cn(
        "shrink-0 flex flex-col items-center justify-end gap-1 h-[44px] py-0.5",
        cellWidthClass,
        enabled
          ? "cursor-pointer hover:bg-surface-muted/40 rounded-sm"
          : "cursor-default"
      )}
    >
      {/* dot — severity tone + size proportional to count */}
      <span
        aria-hidden
        style={{ width: `${dotPx}px`, height: `${dotPx}px` }}
        className={cn(
          "rounded-full transition-transform",
          toneClass,
          day.isToday && "ring-1 ring-line-strong ring-offset-1 ring-offset-surface"
        )}
      />
      {/* 라벨 — 7일 view에서는 weekday, 30일은 dayOfMonth */}
      <span
        className={cn(
          "text-[9px] tabular-nums tracking-tightish leading-none",
          enabled ? "text-ink-subtle" : "text-ink-subtle/50",
          day.isToday && "font-semibold text-ink"
        )}
      >
        {compact ? day.dayOfMonth : day.weekdayLabel}
      </span>
    </button>
  );
}

// ----------------------------------------------------------------------------
// Trend visualization helpers
// ----------------------------------------------------------------------------

/** Dot 크기 매핑 — count에 따라 미세한 차이로 노이즈 회피 (rule_16). */
function computeDotSize(count: number): number {
  if (count === 0) return 4; // empty marker — faint
  if (count <= 2) return 6;
  if (count <= 5) return 8;
  if (count <= 10) return 10;
  return 12; // cap — 11+ 건은 모두 동일 크기 (시각적 노이즈 차단)
}

function trendDotToneClass(severity: AuditSeverity | null): string {
  switch (severity) {
    case "error":
      return "bg-status-deal";
    case "warning":
      return "bg-status-inquiry";
    case "info":
      return "bg-ink-muted";
    case null:
    default:
      return "bg-line/60"; // empty day — faint
  }
}

function SummaryCard({
  label,
  value,
  emphasized,
  tone,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  tone?: "warning" | "error";
}) {
  const toneColor =
    tone === "error"
      ? "text-status-deal"
      : tone === "warning"
        ? "text-status-inquiry"
        : "text-ink";
  return (
    <div
      className={cn(
        "rounded-md border bg-surface px-2.5 py-2 flex flex-col gap-0.5",
        emphasized ? "border-line-strong" : "border-line"
      )}
    >
      <span className="text-[9.5px] uppercase tracking-[0.1em] text-ink-subtle font-medium truncate">
        {label}
      </span>
      <span
        className={cn(
          "text-[15px] font-semibold tabular-nums tracking-tight",
          emphasized ? toneColor : "text-ink"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ============================================================================
// Filter Row + Clear
// ============================================================================

function FilterRow({
  categoryFilter,
  onCategoryChange,
  severityFilter,
  onSeverityChange,
  onClear,
  canClear,
}: {
  categoryFilter: CategoryFilter;
  onCategoryChange: (next: CategoryFilter) => void;
  severityFilter: SeverityFilter;
  onSeverityChange: (next: SeverityFilter) => void;
  onClear: () => void;
  canClear: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        <InlineSelect
          value={categoryFilter}
          onChange={(v) => onCategoryChange(v as CategoryFilter)}
          options={CATEGORY_OPTIONS}
        />
        <InlineSelect
          value={severityFilter}
          onChange={(v) => onSeverityChange(v as SeverityFilter)}
          options={SEVERITY_OPTIONS}
        />
      </div>
      <button
        type="button"
        onClick={canClear ? onClear : undefined}
        disabled={!canClear}
        aria-disabled={!canClear || undefined}
        className={cn(
          "h-7 px-3 rounded-md text-[10.5px] tracking-tightish border transition-colors",
          !canClear
            ? "bg-surface text-ink-subtle border-line cursor-not-allowed opacity-50"
            : "bg-surface text-status-deal/80 border-line hover:bg-surface-muted hover:border-line-strong hover:text-status-deal"
        )}
        title="device-local 운영 로그 비움 (Owner 전용)"
      >
        운영 로그 비움
      </button>
    </div>
  );
}

function InlineSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-7 pl-2.5 pr-7 rounded-md text-[10.5px] tracking-tightish",
        "bg-surface text-ink border border-line",
        "focus:outline-none focus:border-line-strong",
        "appearance-none cursor-pointer transition-colors",
        // 작은 chevron 마무리는 native — 간단성 우선
        "[background-image:url('data:image/svg+xml;utf8,<svg fill=%22none%22 stroke=%22%236B6B6B%22 stroke-width=%221.5%22 viewBox=%220 0 24 24%22 xmlns=%22http://www.w3.org/2000/svg%22><path stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22M19 9l-7 7-7-7%22 /></svg>')] [background-repeat:no-repeat] [background-position:right_0.5rem_center] [background-size:0.875rem_0.875rem]"
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({
  isFilterActive,
  totalCount,
}: {
  isFilterActive: boolean;
  totalCount: number;
}) {
  return (
    <div className="px-6 py-10 text-center max-w-md mx-auto">
      {totalCount === 0 ? (
        <>
          <p className="text-[12px] text-ink-muted tracking-tightish">
            아직 시스템 기록이 없습니다.
          </p>
          <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1.5 leading-relaxed">
            이미지 정리 / 백업 / 권한 등 시스템 운영 이벤트가 발생하면 여기에
            누적됩니다.
          </p>
        </>
      ) : isFilterActive ? (
        <>
          <p className="text-[12px] text-ink-muted tracking-tightish">
            필터 조건에 맞는 기록이 없습니다.
          </p>
          <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1.5 leading-relaxed">
            전체 {totalCount}건 중 필터 조건에 일치하는 항목이 0건입니다.
            카테고리 / 단계 필터를 조정해 보세요.
          </p>
        </>
      ) : null}
    </div>
  );
}

// ============================================================================
// Audit Event Row
// ============================================================================

function AuditEventRow({ event }: { event: SystemAuditEvent }) {
  const [expanded, setExpanded] = React.useState(false);
  const hasMetadata =
    event.metadata !== undefined &&
    event.metadata !== null &&
    Object.keys(event.metadata).length > 0;

  const severityToneCls = severityToneClass(event.severity);
  const severityLabel = AUDIT_SEVERITY_LABEL_KR[event.severity] ?? event.severity;
  const categoryLabel =
    AUDIT_CATEGORY_LABEL_KR[event.category as AuditCategory] ?? event.category;

  return (
    <li className="border-b border-line/70">
      <button
        type="button"
        onClick={hasMetadata ? () => setExpanded((v) => !v) : undefined}
        disabled={!hasMetadata}
        aria-expanded={hasMetadata ? expanded : undefined}
        className={cn(
          "w-full text-left px-6 py-2.5 transition-colors",
          hasMetadata && "hover:bg-surface-muted/60 cursor-pointer",
          !hasMetadata && "cursor-default"
        )}
      >
        <div className="grid grid-cols-[auto_auto_1fr_auto] gap-3 items-baseline">
          {/* severity dot + label */}
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[9.5px] uppercase tracking-[0.1em] font-semibold",
              severityToneCls
            )}
            title={`severity: ${severityLabel}`}
          >
            <span
              aria-hidden
              className={cn(
                "h-1 w-1 rounded-full",
                severityDotClass(event.severity)
              )}
            />
            {severityLabel}
          </span>
          {/* category */}
          <span className="text-[10px] uppercase tracking-[0.08em] text-ink-subtle truncate">
            {categoryLabel}
          </span>
          {/* message */}
          <span className="text-[11.5px] text-ink tracking-tightish truncate">
            {event.message}
          </span>
          {/* time */}
          <span
            className="text-[9.5px] tabular-nums text-ink-subtle tracking-tightish text-right"
            title={formatHumanDate(event.createdAt)}
          >
            {formatRelativeShort(event.createdAt)}
          </span>
        </div>
        {/* sub-line — actor + action + targetRef */}
        <div className="mt-1 flex items-baseline gap-2 text-[9.5px] text-ink-subtle tracking-tightish flex-wrap">
          <span>{event.actorLabel || "—"}</span>
          <span>·</span>
          <span className="font-mono">{event.action}</span>
          {event.targetRef && (
            <>
              <span>·</span>
              <span className="font-mono truncate max-w-[280px]">
                {event.targetRef}
              </span>
            </>
          )}
        </div>
      </button>
      {/* expanded metadata */}
      {hasMetadata && expanded && (
        <div className="px-6 pb-3 -mt-1">
          <pre className="text-[10px] text-ink-muted bg-surface-muted/40 border border-line rounded p-2.5 overflow-x-auto leading-snug font-mono whitespace-pre-wrap">
            {safeStringify(event.metadata)}
          </pre>
        </div>
      )}
    </li>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function severityDotClass(severity: AuditSeverity): string {
  switch (severity) {
    case "info":
      return "bg-ink-muted";
    case "warning":
      return "bg-status-inquiry";
    case "error":
      return "bg-status-deal";
  }
}

function severityToneClass(severity: AuditSeverity): string {
  switch (severity) {
    case "info":
      return "text-ink-subtle";
    case "warning":
      return "text-status-inquiry";
    case "error":
      return "text-status-deal";
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatHumanDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatRelativeShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const min = 1000 * 60;
  const hour = min * 60;
  const day = hour * 24;
  if (diffMs < min) return "방금 전";
  if (diffMs < hour) return `${Math.floor(diffMs / min)}분 전`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}시간 전`;
  const days = Math.floor(diffMs / day);
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
