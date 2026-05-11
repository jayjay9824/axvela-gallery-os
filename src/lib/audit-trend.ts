// ============================================================================
// Audit Trend — STEP 85.
//
// SystemAuditEvent[] 를 시간 흐름 기반 daily aggregation으로 변환. 본 helper는
// AuditLogViewerDrawer의 TrendSection에서만 사용 — 다른 도메인 의존성 0개.
//
// **설계 원칙**:
//   - 결정성: 같은 input → 같은 output (sort + tie-break id 명시)
//   - timezone: local time bucket (운영자가 인지하는 \"오늘\" 기준)
//     → bucket key = local YYYY-MM-DD
//     → click 시 해당 day의 local 00:00 ~ 23:59:59.999 UTC ISO range로 변환
//   - severity dominance: error > warning > info (severity color 결정)
//   - rolling window: 오늘 기준 N일 (오늘 - (N-1)일 ~ 오늘)
//   - 신규 라이브러리 0개 (Date / Intl 없이 순수 계산)
//
// **사용처**: AuditLogViewerDrawer.TrendSection
// **본 모듈은 chart 라이브러리 0개**: text-first dot strip 시각화 helper만 제공
//   (실제 렌더링은 viewer의 React 컴포넌트가 담당).
// ============================================================================

import type { AuditSeverity, SystemAuditEvent } from "@/types/audit-event";

/**
 * 단일 일자의 audit 활동 집계.
 *
 * - dateKey: local YYYY-MM-DD — bucket key, react key, drill query 모두 활용
 * - count: 해당 일 audit event 총 개수
 * - bySeverity: severity 별 분포 (color tone 결정용)
 * - dominantSeverity: count > 0 일 때 가장 심각한 severity (error > warning > info)
 *                    count === 0 이면 null (empty day)
 * - isToday: 오늘 여부 (UI에서 ring/border 강조용)
 */
export interface AuditTrendDay {
  dateKey: string;
  /** Local 날짜 components — click handler에서 UTC ISO range 변환 시 사용 */
  year: number;
  month: number; // 1-12
  dayOfMonth: number; // 1-31
  /** UI 라벨 — 7일 view에서는 weekday, 30일 view에서는 dayOfMonth (둘 다 사용 가능) */
  weekdayLabel: string; // "월" / "화" / ...
  count: number;
  bySeverity: Record<AuditSeverity, number>;
  dominantSeverity: AuditSeverity | null;
  isToday: boolean;
}

export type TrendWindow = 7 | 30;

const WEEKDAY_LABELS_KR: ReadonlyArray<string> = [
  "일",
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
];

// ----------------------------------------------------------------------------
// Public — buildAuditTrend
// ----------------------------------------------------------------------------

/**
 * `events`를 `windowDays` 만큼의 rolling window에 집계.
 *
 * 결과 array는 *시간 순서* (가장 오래된 일자가 [0], 오늘이 [length - 1]) —
 * dot strip을 좌→우로 그대로 렌더하면 자연스러운 시간 흐름 표현.
 *
 * **Edge cases**:
 *   - events가 비면 모든 day의 count === 0 인 array 반환 (rule_16: 빈 시각화도
 *     정보. 다만 본 STEP 호출자는 events.length > 0 일 때만 호출하도록 가드)
 *   - 미래 날짜 audit (clock skew) — 본 window 밖이라 자연 무시
 *   - window 범위 밖 audit — 자연 무시
 */
export function buildAuditTrend(
  events: ReadonlyArray<SystemAuditEvent>,
  windowDays: TrendWindow,
  now: Date = new Date()
): ReadonlyArray<AuditTrendDay> {
  // 오늘 자정 (local) 기준 — windowDays - 1 일 전부터 오늘까지
  const todayLocal = startOfLocalDay(now);

  // 1) bucket map 초기화 — 모든 day pre-populate (count=0)
  const buckets = new Map<string, AuditTrendDay>();
  for (let i = windowDays - 1; i >= 0; i--) {
    const day = addDaysLocal(todayLocal, -i);
    const key = formatLocalDateKey(day);
    buckets.set(key, {
      dateKey: key,
      year: day.getFullYear(),
      month: day.getMonth() + 1,
      dayOfMonth: day.getDate(),
      weekdayLabel: WEEKDAY_LABELS_KR[day.getDay()] ?? "",
      count: 0,
      bySeverity: { info: 0, warning: 0, error: 0 },
      dominantSeverity: null,
      isToday: i === 0,
    });
  }

  // 2) events 순회 — 해당 bucket이 있을 때만 집계 (window 밖은 자연 무시)
  for (const e of events) {
    const created = new Date(e.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const key = formatLocalDateKey(startOfLocalDay(created));
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.count += 1;
    if (bucket.bySeverity[e.severity] !== undefined) {
      bucket.bySeverity[e.severity] += 1;
    }
  }

  // 3) dominantSeverity 결정 — error > warning > info
  for (const bucket of buckets.values()) {
    if (bucket.count === 0) {
      bucket.dominantSeverity = null;
    } else if (bucket.bySeverity.error > 0) {
      bucket.dominantSeverity = "error";
    } else if (bucket.bySeverity.warning > 0) {
      bucket.dominantSeverity = "warning";
    } else {
      bucket.dominantSeverity = "info";
    }
  }

  // 4) Map은 insertion order 보존 — 가장 오래된 day [0] → 오늘 [last]
  return Array.from(buckets.values());
}

// ----------------------------------------------------------------------------
// Public — dayBoundaryIso
//
// 특정 day의 UTC ISO range 변환. 호출자 (viewer click handler)가 STEP 78
// drilldown payload의 periodFromIso / periodToIso로 그대로 전달.
//
// resolver의 isInPeriod는 string 비교로 처리하므로 tail은 23:59:59.999가
// 안전 (그 다음 day의 audit는 그 day의 00:00:00 부터라 자연 분리).
// ----------------------------------------------------------------------------

export function dayBoundaryIso(day: AuditTrendDay): {
  fromIso: string;
  toIso: string;
} {
  const from = new Date(day.year, day.month - 1, day.dayOfMonth, 0, 0, 0, 0);
  const to = new Date(
    day.year,
    day.month - 1,
    day.dayOfMonth,
    23,
    59,
    59,
    999
  );
  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
  };
}

// ----------------------------------------------------------------------------
// Internal helpers — 결정성 + 신규 라이브러리 0개
// ----------------------------------------------------------------------------

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDaysLocal(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
}

function formatLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}
