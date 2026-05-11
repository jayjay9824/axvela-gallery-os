// ============================================================================
// Logistics Operations Aggregates — STEP 54.
//
// 갤러리 전체 logistics record를 flatten + KPI 집계 + 검색/필터/정렬해
// LogisticsOperationsDrawer에 공급. STEP 35 Reporting / STEP 41 Customer / STEP
// 51 Documents 패턴 일관 — read-only utility.
//
// **설계 원칙:**
//   - Logistics / ConditionReport store / type 0줄 변경 — read-only consumer
//   - rule_21 본격화 — 본 STEP은 1급 운영 view (drawer)
//   - 결정성: 같은 입력 → 같은 출력
//   - 시간 필터는 STEP 35.5 ReportingTimeFilter / resolveTimeRange 재사용
//
// **표현 정책:**
//   - "운영 참고" / "provider 기준" / "최근 조회"
//   - "배송 보장" / "도착 확정" / "보험 보장" / "법적 효력" 표현 0건
// ============================================================================

import type { Logistics, LogisticsStatus } from "@/types/logistics";
import type { ConditionReport, ReportType } from "@/types/condition-report";
import type { Transaction } from "@/types/transaction";
import type { Artwork } from "@/types/artwork";

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

/**
 * 단일 logistics record + 컨텍스트 한 묶음. drawer가 직접 그리는 row 단위.
 *
 * - 도메인 entity (logistics)는 그대로 보존 (rule_21 immutable rule 무영향)
 * - artwork / transaction 정보는 lookup으로 채움 (denormalized for UI)
 * - condition reports는 logisticsId로 grouped (BEFORE / AFTER 모두 표시 가능)
 * - provider 메타는 row에서 직접 사용 (sync 후 시각적 노출)
 */
export interface LogisticsRow {
  /** 원본 logistics record — drawer 클릭 시 entityId 사용 */
  logistics: Logistics;

  /** Artwork 컨텍스트 (lookup 결과 — 부재 시 fallback "—") */
  artworkId: string;
  artworkTitle: string;
  artistName: string;
  artworkAxidCode: string;

  /** Transaction 컨텍스트 (buyer name 표시용 — 운영자가 출고지 / 수령처 식별) */
  transactionId: string;
  buyerLabel: string; // "—" if no transaction lookup

  /** 정렬 + 시간 필터용 primary date (ISO datetime) */
  primaryDate: string;
  /** UI 표시용 한국어 날짜 라벨 ("픽업일" / "인도일" / "최근 수정") */
  primaryDateLabel: string;

  /** 본 logistics에 연결된 ConditionReport 메타 (drawer row badge용) */
  hasBeforeReport: boolean;
  hasAfterReport: boolean;
  /** 가장 최근 condition status (있으면 — 단순 표시용) */
  latestConditionStatus: "GOOD" | "WATCH" | "DAMAGED" | null;
}

/**
 * KPI 카드 — 사용자 spec 5종.
 *
 * - 출고 대기: status = READY_FOR_PICKUP
 * - 배송 중: status = IN_TRANSIT
 * - 도착 완료: status = DELIVERED (검수 미진행)
 * - 검수 완료: status = CONDITION_CHECKED
 * - 검수 대기: status = DELIVERED && AFTER_DELIVERY 보고서 부재
 *
 * 모두 시간 필터 적용 후 카운트. 시간 필터는 logistics.primaryDate 기준.
 */
export interface LogisticsKPIs {
  readyForPickupCount: number;
  inTransitCount: number;
  deliveredCount: number;
  conditionCheckedCount: number;
  /** DELIVERED but no AFTER_DELIVERY report yet — 운영자 행동 필요 */
  awaitingConditionCheckCount: number;
}

export interface LogisticsAggregateInput {
  logistics: Record<string, Logistics[]>;
  conditionReports: Record<string, ConditionReport[]>;
  transactions: Record<string, Transaction[]>;
  artworks: Artwork[];
}

export interface LogisticsAggregateOptions {
  /** 도메인 status 필터 — "all"이면 모든 status 노출 */
  statusFilter: LogisticsStatus | "all";
  /** 작품명 / 작가 / carrier / trackingId 부분 매칭 (lowercase substring) */
  textQuery: string;
  /** STEP 35.5 패턴 — null이면 전체 기간 */
  timeRange: { start: string; end: string } | null;
}

export interface LogisticsAggregateResult {
  /** 필터 통과한 row들 — primaryDate desc 정렬 */
  rows: LogisticsRow[];
  /** 시간 필터만 적용한 KPI (status 필터 무관) — 카드 카운트는 항상 시간 기준 */
  kpis: LogisticsKPIs;
  /** 시간 필터 적용 후 전체 row 수 (카드 합계와 일치) */
  totalCountInRange: number;
  /** 필터 통과한 row 수 (status + 텍스트 + 시간) */
  filteredCount: number;
}

// ----------------------------------------------------------------------------
// Public dispatcher
// ----------------------------------------------------------------------------

/**
 * Logistics + 컨텍스트 + 필터 → LogisticsAggregateResult.
 *
 * 도메인 store / type 0줄 변경 — 모두 read-only consumer.
 */
export function aggregateLogistics(
  input: LogisticsAggregateInput,
  options: LogisticsAggregateOptions
): LogisticsAggregateResult {
  // 1. Lookup tables
  const artworkLookup = new Map(input.artworks.map((a) => [a.id, a]));
  const txLookup = new Map<string, Transaction>();
  for (const list of Object.values(input.transactions)) {
    for (const tx of list) txLookup.set(tx.id, tx);
  }
  // condition reports → group by logisticsId
  const crByLogisticsId = new Map<string, ConditionReport[]>();
  for (const list of Object.values(input.conditionReports)) {
    for (const cr of list) {
      const existing = crByLogisticsId.get(cr.logisticsId) ?? [];
      existing.push(cr);
      crByLogisticsId.set(cr.logisticsId, existing);
    }
  }

  // 2. Flatten logistics → LogisticsRow
  const allRows: LogisticsRow[] = [];
  for (const list of Object.values(input.logistics)) {
    for (const log of list) {
      const row = buildLogisticsRow(log, artworkLookup, txLookup, crByLogisticsId);
      allRows.push(row);
    }
  }

  // 3. 시간 필터 (KPI는 시간 필터만 적용)
  const inRangeRows = options.timeRange
    ? allRows.filter((r) => inRange(r.primaryDate, options.timeRange!))
    : allRows;

  // 4. KPI 계산 (시간 필터 적용 후, status 필터 무관)
  const kpis: LogisticsKPIs = {
    readyForPickupCount: 0,
    inTransitCount: 0,
    deliveredCount: 0,
    conditionCheckedCount: 0,
    awaitingConditionCheckCount: 0,
  };
  for (const r of inRangeRows) {
    switch (r.logistics.status) {
      case "READY_FOR_PICKUP":
        kpis.readyForPickupCount += 1;
        break;
      case "IN_TRANSIT":
        kpis.inTransitCount += 1;
        break;
      case "DELIVERED":
        kpis.deliveredCount += 1;
        // 사용자 spec: 검수 대기 = DELIVERED && AFTER_DELIVERY 보고서 부재
        if (!r.hasAfterReport) kpis.awaitingConditionCheckCount += 1;
        break;
      case "CONDITION_CHECKED":
        kpis.conditionCheckedCount += 1;
        break;
    }
  }

  // 5. status 필터 + 텍스트 필터 (시간 적용 후 set 위에)
  const filtered = inRangeRows.filter((r) => {
    if (options.statusFilter !== "all" && r.logistics.status !== options.statusFilter) {
      return false;
    }
    if (options.textQuery.trim()) {
      const q = options.textQuery.trim().toLowerCase();
      const haystack = [
        r.artworkTitle,
        r.artistName,
        r.artworkAxidCode,
        r.logistics.carrierName,
        r.logistics.trackingNumber,
        r.buyerLabel,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // 6. 정렬 — primaryDate desc, tiebreak: logistics.id asc
  filtered.sort((a, b) => {
    if (b.primaryDate !== a.primaryDate)
      return b.primaryDate.localeCompare(a.primaryDate);
    return a.logistics.id.localeCompare(b.logistics.id);
  });

  return {
    rows: filtered,
    kpis,
    totalCountInRange: inRangeRows.length,
    filteredCount: filtered.length,
  };
}

// ----------------------------------------------------------------------------
// Public labels
// ----------------------------------------------------------------------------

export const LOGISTICS_STATUS_FILTER_LABEL_KR: Record<
  LogisticsStatus | "all",
  string
> = {
  all: "전체",
  READY_FOR_PICKUP: "픽업 대기",
  IN_TRANSIT: "배송 중",
  DELIVERED: "인도 완료",
  CONDITION_CHECKED: "검수 완료",
};

// ----------------------------------------------------------------------------
// Internal — row builder
// ----------------------------------------------------------------------------

function buildLogisticsRow(
  log: Logistics,
  artworkLookup: Map<string, Artwork>,
  txLookup: Map<string, Transaction>,
  crByLogisticsId: Map<string, ConditionReport[]>
): LogisticsRow {
  const artwork = artworkLookup.get(log.artworkId);
  const tx = txLookup.get(log.transactionId);

  // primary date 정책 (status 의존):
  //   READY_FOR_PICKUP → updatedAt (가장 최근 활동)
  //   IN_TRANSIT → pickupDate (있으면) > updatedAt
  //   DELIVERED → deliveryDate (있으면) > updatedAt
  //   CONDITION_CHECKED → updatedAt (검수 완료 시점)
  const { primaryDate, primaryDateLabel } = pickPrimaryDate(log);

  // condition reports lookup
  const crs = crByLogisticsId.get(log.id) ?? [];
  const beforeReports = crs.filter((c) => c.reportType === ("BEFORE_SHIPMENT" as ReportType));
  const afterReports = crs.filter((c) => c.reportType === ("AFTER_DELIVERY" as ReportType));

  // 최근 condition status — after 우선, 부재 시 before, 둘 다 부재 시 null
  const sortedAfter = afterReports
    .slice()
    .sort((a, b) => stableTimestamp(b).localeCompare(stableTimestamp(a)));
  const sortedBefore = beforeReports
    .slice()
    .sort((a, b) => stableTimestamp(b).localeCompare(stableTimestamp(a)));
  const latest = sortedAfter[0] ?? sortedBefore[0] ?? null;

  // buyer label — Transaction.buyerName 사용. 부재 시 "—".
  type WithBuyer = Transaction & { buyerName?: string };
  const buyerLabel = tx ? (tx as WithBuyer).buyerName?.trim() || "—" : "—";

  return {
    logistics: log,
    artworkId: log.artworkId,
    artworkTitle: artwork?.title ?? "—",
    artistName: artwork?.artist.name ?? "—",
    artworkAxidCode: artwork?.axid.code ?? "—",
    transactionId: log.transactionId,
    buyerLabel,
    primaryDate,
    primaryDateLabel,
    hasBeforeReport: beforeReports.length > 0,
    hasAfterReport: afterReports.length > 0,
    latestConditionStatus: latest?.conditionStatus ?? null,
  };
}

function pickPrimaryDate(log: Logistics): {
  primaryDate: string;
  primaryDateLabel: string;
} {
  switch (log.status) {
    case "IN_TRANSIT":
      return log.pickupDate
        ? { primaryDate: toISO(log.pickupDate), primaryDateLabel: "픽업일" }
        : { primaryDate: log.updatedAt, primaryDateLabel: "최근 수정" };
    case "DELIVERED":
      return log.deliveryDate
        ? { primaryDate: toISO(log.deliveryDate), primaryDateLabel: "인도일" }
        : { primaryDate: log.updatedAt, primaryDateLabel: "최근 수정" };
    case "CONDITION_CHECKED":
      return { primaryDate: log.updatedAt, primaryDateLabel: "검수 완료" };
    case "READY_FOR_PICKUP":
    default:
      return { primaryDate: log.updatedAt, primaryDateLabel: "최근 수정" };
  }
}

/**
 * `pickupDate` / `deliveryDate`는 YYYY-MM-DD일 가능성이 높음 — 정렬은 ISO이면
 * 문자열 비교로 충분하므로 빈 문자열 가드만 적용. 본 helper는 `inRange` 비교
 * 일관성을 위해 ISO suffix 부재 시 그대로 반환 (yyyy-mm-dd가 들어오면 inRange가
 * yyyy-mm-dd... vs yyyy-mm-ddT00:00:00 비교 — 정상).
 */
function toISO(value: string): string {
  return value || "";
}

function inRange(at: string, range: { start: string; end: string }): boolean {
  if (!at) return false;
  return at >= range.start && at <= range.end;
}

/**
 * ConditionReport의 시간 정렬 키. lockedAt > reportedAt > createdAt 순.
 * 부재 필드 가드 — 옵셔널 typeface로 타입 안전성 확보.
 */
function stableTimestamp(cr: ConditionReport): string {
  type WithMeta = ConditionReport & {
    lockedAt?: string;
    reportedAt?: string;
    createdAt: string;
  };
  const c = cr as WithMeta;
  return c.lockedAt ?? c.reportedAt ?? c.createdAt ?? "";
}
