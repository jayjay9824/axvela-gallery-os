// ============================================================================
// AuditTrailVisualization — STEP 26
//
// AuditFilterBar 결과를 시각화. 외부 차트 라이브러리 0개 — 모두 `<div>` +
// tailwind 폭/높이 비례로 단순 bar / mini timeline 표현. 사용자 spec "복잡한
// 차트 금지 / bar / mini timeline / heatmap 느낌의 단순 시각화" 준수.
//
// Controlled — `classified` prop만으로 모든 차원 derive. AuditFilterBar가
// 변경되면 부모 drawer가 새 filtered list를 emit → 본 컴포넌트가 즉시 재계산.
//
// 4 sections (single) / 5 sections (global):
//   1. Importance Counts        — LOCK / APPROVED / CORRECTION / PAYMENT /
//                                 SETTLEMENT / TAX_ISSUED 6개 메트릭 grid
//   2. Domain bars              — 8 도메인 가로 bar (max → 100%)
//   3. Actor bars               — AI / HUMAN / SYSTEM 3 bar
//   4. Day timeline             — 데이터 범위 안의 일별 count, 막대 height
//   5. Top artworks (global)    — count 내림차순 Top 5
// ============================================================================

"use client";

import * as React from "react";
import type {
  ClassifiedAuditEvent,
  AuditDomain,
  AuditEmphasis,
} from "@/lib/audit-helpers";
import { broadActorType } from "@/lib/audit-helpers";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Display labels & ordering
// ---------------------------------------------------------------------------

const DOMAIN_ORDER: AuditDomain[] = [
  "AI",
  "DOCUMENT",
  "MONEY",
  "LOGISTICS",
  "INQUIRY",
  "TRANSACTION",
  "STATE",
  "NOTE",
];

const DOMAIN_LABEL_KR: Record<AuditDomain, string> = {
  AI: "AI",
  DOCUMENT: "문서",
  MONEY: "정산·결제·세무",
  LOGISTICS: "물류",
  INQUIRY: "Inquiry",
  TRANSACTION: "거래",
  STATE: "상태 전환",
  NOTE: "노트",
};

type ActorTypeBroad = "AI" | "HUMAN" | "SYSTEM";

const ACTOR_ORDER: ActorTypeBroad[] = ["AI", "HUMAN", "SYSTEM"];

const ACTOR_LABEL_KR: Record<ActorTypeBroad, string> = {
  AI: "AI",
  HUMAN: "사람",
  SYSTEM: "System",
};

// 사용자 spec 명시 6개 — null은 별도 카운트 안 함
const EMPHASIS_ORDER: Exclude<AuditEmphasis, null>[] = [
  "LOCK",
  "APPROVED",
  "CORRECTION",
  "PAYMENT",
  "SETTLEMENT",
  "TAX_ISSUED",
];

const EMPHASIS_LABEL_KR: Record<Exclude<AuditEmphasis, null>, string> = {
  LOCK: "Lock",
  APPROVED: "승인",
  CORRECTION: "수정",
  PAYMENT: "결제",
  SETTLEMENT: "정산",
  TAX_ISSUED: "세무",
};

// Day timeline window — 데이터에 따라 동적, 최대 30일
const TIMELINE_MAX_DAYS = 30;
const TIMELINE_MIN_DAYS = 14;
const TOP_ARTWORKS_LIMIT = 5;

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface AuditTrailVisualizationProps {
  classified: ClassifiedAuditEvent[];
  mode: "single" | "global";
  /** Global mode 전용 — artworkId → 짧은 라벨. */
  artworkLookup?: Record<string, string>;
}

export function AuditTrailVisualization({
  classified,
  mode,
  artworkLookup,
}: AuditTrailVisualizationProps) {
  const stats = React.useMemo(
    () => computeAuditStats(classified, mode, artworkLookup),
    [classified, mode, artworkLookup]
  );

  return (
    <section
      className="rounded-md border border-line bg-surface px-3 py-2.5 flex flex-col gap-3"
      aria-label="감사 로그 시각화"
    >
      <header className="flex items-baseline justify-between">
        <h4 className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
          시각화
        </h4>
        <span className="text-[10.5px] tabular-nums tracking-tightish text-ink-subtle">
          {classified.length === 0
            ? "결과 없음"
            : `${classified.length}건${
                stats.dateSpanLabel ? ` · ${stats.dateSpanLabel}` : ""
              }`}
        </span>
      </header>

      {classified.length === 0 ? (
        <EmptyVizState />
      ) : (
        <>
          <ImportanceCountsRow counts={stats.emphasis} />
          <DomainBars counts={stats.domain} total={stats.totalNonZero} />
          <ActorBars counts={stats.actor} total={stats.totalNonZero} />
          <DayTimeline buckets={stats.dayBuckets} />
          {mode === "global" && stats.topArtworks.length > 0 && (
            <TopArtworks rows={stats.topArtworks} total={classified.length} />
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stats computation (pure)
// ---------------------------------------------------------------------------

interface DayBucket {
  /** YYYY-MM-DD */
  date: string;
  count: number;
}

interface ArtworkCountRow {
  artworkId: string;
  label: string;
  count: number;
}

interface AuditStats {
  /** Emphasis (LOCK / APPROVED / ...) — null은 제외. */
  emphasis: Record<Exclude<AuditEmphasis, null>, number>;
  domain: Record<AuditDomain, number>;
  actor: Record<ActorTypeBroad, number>;
  dayBuckets: DayBucket[];
  topArtworks: ArtworkCountRow[];
  totalNonZero: number;
  /** "2026-04-21 ~ 2026-05-04" 또는 단일 날짜. 빈 데이터면 "" */
  dateSpanLabel: string;
}

function computeAuditStats(
  classified: ClassifiedAuditEvent[],
  mode: "single" | "global",
  artworkLookup?: Record<string, string>
): AuditStats {
  // Initialize zero buckets
  const emphasis: Record<Exclude<AuditEmphasis, null>, number> = {
    LOCK: 0,
    APPROVED: 0,
    CORRECTION: 0,
    PAYMENT: 0,
    SETTLEMENT: 0,
    TAX_ISSUED: 0,
  };
  const domain: Record<AuditDomain, number> = {
    AI: 0,
    DOCUMENT: 0,
    MONEY: 0,
    LOGISTICS: 0,
    INQUIRY: 0,
    TRANSACTION: 0,
    STATE: 0,
    NOTE: 0,
  };
  const actor: Record<ActorTypeBroad, number> = { AI: 0, HUMAN: 0, SYSTEM: 0 };

  const dayMap = new Map<string, number>();
  const artworkMap = new Map<string, number>();

  for (const c of classified) {
    if (c.emphasis !== null) emphasis[c.emphasis]++;
    domain[c.domain]++;
    actor[broadActorType(c.actorType)]++;

    const day = c.event.at.slice(0, 10); // YYYY-MM-DD
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);

    artworkMap.set(c.event.artworkId, (artworkMap.get(c.event.artworkId) ?? 0) + 1);
  }

  // Day buckets — 데이터 범위 안에서 매일 채움 (count 0인 날도 포함)
  let dayBuckets: DayBucket[] = [];
  let dateSpanLabel = "";
  if (dayMap.size > 0) {
    const sortedDays = Array.from(dayMap.keys()).sort();
    const firstDay = sortedDays[0];
    const lastDay = sortedDays[sortedDays.length - 1];

    // 범위가 너무 넓으면 (TIMELINE_MAX_DAYS 초과) lastDay 기준 뒤에서 자름
    const rangeStart = clampDateRange(firstDay, lastDay);
    dayBuckets = enumerateDays(rangeStart, lastDay).map((day) => ({
      date: day,
      count: dayMap.get(day) ?? 0,
    }));
    dateSpanLabel =
      firstDay === lastDay ? firstDay : `${rangeStart} ~ ${lastDay}`;
  }

  // Top artworks (global only)
  let topArtworks: ArtworkCountRow[] = [];
  if (mode === "global") {
    const rows: ArtworkCountRow[] = [];
    for (const [artworkId, count] of artworkMap) {
      const label = artworkLookup?.[artworkId] ?? artworkId;
      rows.push({ artworkId, label, count });
    }
    rows.sort((a, b) => b.count - a.count);
    topArtworks = rows.slice(0, TOP_ARTWORKS_LIMIT);
  }

  // Total for bar normalization (max single bucket — 한 카테고리가 압도적이면 그것 기준)
  const totalNonZero = Math.max(
    1,
    ...Object.values(domain),
    ...Object.values(actor)
  );

  return {
    emphasis,
    domain,
    actor,
    dayBuckets,
    topArtworks,
    totalNonZero,
    dateSpanLabel,
  };
}

/**
 * 데이터 범위가 TIMELINE_MAX_DAYS 초과면 lastDay에서 거꾸로 자름.
 * 미달이면 firstDay 그대로 (bar가 너무 적어 보이지 않게 TIMELINE_MIN_DAYS까지
 * 강제 확장하지는 않음 — 사용자가 본 데이터 범위만 정확히 표시).
 */
function clampDateRange(firstDay: string, lastDay: string): string {
  const first = parseISODate(firstDay);
  const last = parseISODate(lastDay);
  const dayDiff =
    Math.floor((last.getTime() - first.getTime()) / 86_400_000) + 1;

  if (dayDiff <= TIMELINE_MAX_DAYS) return firstDay;

  // 범위 너무 넓음 — last 기준 TIMELINE_MAX_DAYS 전으로 clip
  const clipped = new Date(
    last.getTime() - (TIMELINE_MAX_DAYS - 1) * 86_400_000
  );
  return formatISODate(clipped);
}

function parseISODate(d: string): Date {
  // "YYYY-MM-DD"를 UTC로 (DST 영향 차단)
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
}

function formatISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function enumerateDays(start: string, end: string): string[] {
  const out: string[] = [];
  const startD = parseISODate(start);
  const endD = parseISODate(end);
  for (
    let cur = startD.getTime();
    cur <= endD.getTime();
    cur += 86_400_000
  ) {
    out.push(formatISODate(new Date(cur)));
  }
  // 안전 cap (이론상 lastDay까지로 자연 종료, defensive)
  return out.slice(0, TIMELINE_MAX_DAYS);
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function EmptyVizState() {
  return (
    <p className="text-[11px] text-ink-subtle tracking-tightish leading-relaxed py-2">
      현재 필터 결과 없음 — 시각화 표시 불가
    </p>
  );
}

function ImportanceCountsRow({
  counts,
}: {
  counts: Record<Exclude<AuditEmphasis, null>, number>;
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {EMPHASIS_ORDER.map((e) => {
        const n = counts[e];
        return (
          <div
            key={e}
            className={cn(
              "rounded border px-2 py-1.5 flex flex-col gap-0.5",
              n > 0 ? "border-line bg-surface-muted" : "border-line bg-surface"
            )}
            title={`${EMPHASIS_LABEL_KR[e]} 이벤트 ${n}건`}
          >
            <span className="text-[9.5px] uppercase tracking-[0.12em] text-ink-subtle font-semibold">
              {EMPHASIS_LABEL_KR[e]}
            </span>
            <span
              className={cn(
                "text-[14px] tabular-nums tracking-tightish font-medium",
                n > 0 ? "text-ink" : "text-ink-subtle"
              )}
            >
              {n}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DomainBars({
  counts,
  total,
}: {
  counts: Record<AuditDomain, number>;
  total: number;
}) {
  return (
    <BarSection title="유형별">
      {DOMAIN_ORDER.map((d) => (
        <Bar
          key={d}
          label={DOMAIN_LABEL_KR[d]}
          count={counts[d]}
          maxCount={total}
        />
      ))}
    </BarSection>
  );
}

function ActorBars({
  counts,
  total,
}: {
  counts: Record<ActorTypeBroad, number>;
  total: number;
}) {
  return (
    <BarSection title="작성자별">
      {ACTOR_ORDER.map((a) => (
        <Bar
          key={a}
          label={ACTOR_LABEL_KR[a]}
          count={counts[a]}
          maxCount={total}
        />
      ))}
    </BarSection>
  );
}

function BarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[9.5px] uppercase tracking-[0.12em] text-ink-subtle font-semibold">
        {title}
      </p>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Bar({
  label,
  count,
  maxCount,
}: {
  label: string;
  count: number;
  maxCount: number;
}) {
  // 0 카운트는 bar height 없음, label만 회색
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const isZero = count === 0;
  return (
    <div className="grid grid-cols-[5.5rem_1fr_2.25rem] gap-2 items-center">
      <span
        className={cn(
          "text-[10.5px] tracking-tightish truncate",
          isZero ? "text-ink-subtle" : "text-ink-muted"
        )}
        title={label}
      >
        {label}
      </span>
      <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
        <div
          className={cn(
            "h-full transition-all",
            isZero ? "bg-transparent" : "bg-ink"
          )}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <span
        className={cn(
          "text-[10.5px] tabular-nums tracking-tightish text-right",
          isZero ? "text-ink-subtle" : "text-ink-muted"
        )}
      >
        {count}
      </span>
    </div>
  );
}

function DayTimeline({ buckets }: { buckets: DayBucket[] }) {
  if (buckets.length === 0) return null;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[9.5px] uppercase tracking-[0.12em] text-ink-subtle font-semibold">
        일별 활동
      </p>
      <div
        className="flex items-end gap-[2px] h-12"
        role="img"
        aria-label={`일별 이벤트 수 ${buckets[0].date}부터 ${buckets[buckets.length - 1].date}까지`}
      >
        {buckets.map((b) => {
          const heightPct = b.count === 0 ? 4 : (b.count / max) * 100;
          return (
            <div
              key={b.date}
              className="flex-1 min-w-[2px] flex items-end"
              title={`${b.date} · ${b.count}건`}
            >
              <div
                className={cn(
                  "w-full rounded-sm",
                  b.count === 0 ? "bg-line" : "bg-ink"
                )}
                style={{ height: `${heightPct}%` }}
                aria-hidden
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[9.5px] tabular-nums text-ink-subtle">
        <span>{buckets[0].date}</span>
        {buckets.length > 2 && (
          <span className="text-ink-subtle">{buckets.length}일</span>
        )}
        <span>{buckets[buckets.length - 1].date}</span>
      </div>
    </div>
  );
}

function TopArtworks({
  rows,
  total,
}: {
  rows: ArtworkCountRow[];
  total: number;
}) {
  return (
    <BarSection title={`상위 작품 (Top ${rows.length})`}>
      {rows.map((row) => (
        <Bar
          key={row.artworkId}
          label={row.label}
          count={row.count}
          maxCount={total}
        />
      ))}
    </BarSection>
  );
}
