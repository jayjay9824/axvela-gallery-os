// ============================================================================
// Logistics Calendar — STEP 58.
//
// Month grid (6주 x 7요일) 계산 utility. 결정성 함수 — 같은 입력 → 같은 출력.
// LogisticsRow를 적절한 날짜 cell에 배치 + status별 분류.
//
// **날짜 우선순위 (사용자 spec)**:
//   1. pickupDate (있으면 — 출고 캘린더의 핵심 의미)
//   2. deliveryDate (없으면 fallback)
//   3. primaryDate (둘 다 없으면 LogisticsRow가 이미 계산한 fallback)
//
// **표현 정책**: "예정 일정" / "운영 참고" 권장. "도착 확정" 표현 0건.
// ============================================================================

import type { LogisticsRow } from "./logistics-aggregates";
import type { LogisticsStatus } from "@/types/logistics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarItem {
  row: LogisticsRow;
  /** 본 cell에서 사용된 날짜 (status 분류와 무관) */
  pickedDate: string;
  /** 어떤 필드에서 가져왔는지 — UI tooltip 용 */
  pickedFrom: "pickup" | "delivery" | "primary";
}

export interface CalendarCell {
  /** ISO date YYYY-MM-DD */
  isoDate: string;
  /** day-of-month (1~31) */
  dayOfMonth: number;
  /** 본 cell이 anchorDate의 month와 같은 month인지 (false면 prev/next month spillover) */
  inMonth: boolean;
  /** 0=Sunday ~ 6=Saturday */
  weekday: number;
  /** 본 cell의 모든 logistics rows */
  items: CalendarItem[];
  /** status별 count — 빠른 badge 렌더링용 */
  countsByStatus: Record<LogisticsStatus, number>;
  /** 오늘인지 (UI 강조용) */
  isToday: boolean;
}

export interface CalendarMonth {
  /** 표시 anchor (해당 month의 1일 ISO) */
  anchorDate: string;
  /** 6주 x 7일 = 42개 cell. 첫 번째 cell은 anchor month의 1일이 포함된 주의 일요일 */
  cells: CalendarCell[];
  /** UI 라벨 — "2026년 5월" */
  monthLabel: string;
  /** 본 month 안에 들어간 row 수 (spillover 제외) */
  inMonthItemCount: number;
}

// ---------------------------------------------------------------------------
// Public — month grid builder
// ---------------------------------------------------------------------------

/**
 * `anchorDate` 기준 month의 6주 grid 생성. cells는 항상 42개 (week 시작은 일요일).
 *
 * - rows는 한 번만 순회 — O(N) row → O(1) cell lookup (Map)
 * - 같은 cell의 items는 정렬: pickedDate asc → row.logistics.id asc (결정성)
 * - rows 안에서 날짜 부재 또는 invalid한 경우는 cell 배치 생략 (skipped 카운트
 *   대신 silent — UI는 list view에서 그 record를 항상 볼 수 있음)
 */
export function buildCalendarMonth(
  rows: LogisticsRow[],
  anchorDate: Date,
  now: Date = new Date()
): CalendarMonth {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  // 1) Grid 시작일 = anchor month 1일이 속한 주의 일요일
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=Sun
  const gridStart = new Date(year, month, 1 - startWeekday);

  // 2) 42 cells 초기화
  const cellByIso = new Map<string, CalendarCell>();
  const cells: CalendarCell[] = [];
  const todayIso = toIsoDate(now);

  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const iso = toIsoDate(d);
    const cell: CalendarCell = {
      isoDate: iso,
      dayOfMonth: d.getDate(),
      inMonth: d.getMonth() === month,
      weekday: d.getDay(),
      items: [],
      countsByStatus: {
        READY_FOR_PICKUP: 0,
        IN_TRANSIT: 0,
        DELIVERED: 0,
        CONDITION_CHECKED: 0,
      },
      isToday: iso === todayIso,
    };
    cells.push(cell);
    cellByIso.set(iso, cell);
  }

  // 3) Rows 배치
  let inMonthItemCount = 0;
  for (const row of rows) {
    const picked = pickCalendarDate(row);
    if (!picked) continue; // skip — list view에서 보임
    const iso = toIsoDate(new Date(picked.date));
    if (!iso) continue;
    const cell = cellByIso.get(iso);
    if (!cell) continue; // grid 범위 밖 — anchor month의 ±주차 벗어남

    cell.items.push({
      row,
      pickedDate: picked.date,
      pickedFrom: picked.from,
    });
    cell.countsByStatus[row.logistics.status] += 1;
    if (cell.inMonth) inMonthItemCount += 1;
  }

  // 4) Cell 안 items 정렬 — pickedDate asc → logistics.id asc
  for (const cell of cells) {
    cell.items.sort((a, b) => {
      if (a.pickedDate !== b.pickedDate)
        return a.pickedDate.localeCompare(b.pickedDate);
      return a.row.logistics.id.localeCompare(b.row.logistics.id);
    });
  }

  return {
    anchorDate: toIsoDate(firstOfMonth),
    cells,
    monthLabel: formatMonthLabelKR(year, month),
    inMonthItemCount,
  };
}

// ---------------------------------------------------------------------------
// Public — month navigation
// ---------------------------------------------------------------------------

export function shiftAnchorByMonth(anchor: Date, deltaMonths: number): Date {
  const next = new Date(anchor);
  next.setDate(1); // overflow 방지 (5/31 + 1month → 6/31 → 7/1 안 됨)
  next.setMonth(next.getMonth() + deltaMonths);
  return next;
}

// ---------------------------------------------------------------------------
// Internal — date pick
// ---------------------------------------------------------------------------

function pickCalendarDate(
  row: LogisticsRow
): { date: string; from: "pickup" | "delivery" | "primary" } | null {
  const log = row.logistics;
  if (log.pickupDate && isValidDateString(log.pickupDate)) {
    return { date: log.pickupDate, from: "pickup" };
  }
  if (log.deliveryDate && isValidDateString(log.deliveryDate)) {
    return { date: log.deliveryDate, from: "delivery" };
  }
  if (row.primaryDate && isValidDateString(row.primaryDate)) {
    return { date: row.primaryDate, from: "primary" };
  }
  return null;
}

function isValidDateString(s: string): boolean {
  if (!s) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function toIsoDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatMonthLabelKR(year: number, month: number): string {
  return `${year}년 ${month + 1}월`;
}

// ---------------------------------------------------------------------------
// Public — weekday short labels (한국어)
// ---------------------------------------------------------------------------

export const CALENDAR_WEEKDAY_LABELS_KR: ReadonlyArray<string> = [
  "일",
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
];
