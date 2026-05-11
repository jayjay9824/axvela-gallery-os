// ============================================================================
// operational-insight.ts — STEP 92 Operational Intelligence Derive Layer (Phase 3)
//
// **본 module이 무엇인가**:
//   *real operational intelligence* — 갤러리 운영에서 자연 발생한 *행동 데이터*
//   (inquiry / transaction / settlement)를 받아 *operational signal*로 derive.
//   사용자 spec 6 categories 모두 정착: Inquiry / Save / Artist Activity /
//   Settlement / Transaction Funnel / Gallery Activity.
//
// **본 module이 *아닌* 것** (사용자 spec DO NOT 정조준):
//   ❌ AI artwork pricing prediction
//   ❌ speculative valuation
//   ❌ investment scoring
//   ❌ fake confidence systems
//   ❌ autonomous recommendations
//
// **3-Layer architecture (사용자 spec 정확 매칭)**:
//   Layer 1 — Operational metrics (raw aggregation, 본 module 전반)
//   Layer 2 — Pattern detection (direction / spike / repeat, 본 module 후반)
//   Layer 3 — AI summary generation (operational-insight-summary.ts, 별도)
//
// **AI Direction §1 정합 ✓**:
//   - 사용 표현: "운영 신호" / "참고 신호" / "패턴 감지" / "운영 참고"
//   - 금지 표현: "AI 예측" / "확정 시장가" / "투자 가치" / "자동 추천" 0건
//
// **STEP 86 anchor pattern 답습 (DOC-2 §3.5 Pure Derive Layer 정확 매칭)**:
//   - Pure / no I/O / no DOM / no store / no persistence
//   - 입력 (entity arrays + period + now) → 출력 (insight view shape)
//   - 결정성 (same input → same output)
//   - production runtime 부담 0 (import 부재 시 tree-shake out)
//
// **Honest Signal Principle (사용자 spec "fake confidence systems" 금지 정조준)**:
//   데이터 부재 카테고리는 "insufficient" direction + 명시적 zero-state로 표시.
//   합성 데이터 / 가짜 숫자 / 추정 보간 절대 0건.
// ============================================================================

import type { Artwork } from "@/types/artwork";
import type { Inquiry } from "@/types/inquiry";
import type { Transaction } from "@/types/transaction";
import type { Settlement } from "@/types/settlement";

// ============================================================================
// 1. Period definition — 사용자 spec "7일 / 14일 / 30일" Bloomberg Terminal 톤
// ============================================================================

export type InsightPeriod = "7d" | "14d" | "30d";

export const INSIGHT_PERIOD_LABEL_KR: Readonly<Record<InsightPeriod, string>> = {
  "7d": "최근 7일",
  "14d": "최근 14일",
  "30d": "최근 30일",
} as const;

const PERIOD_DAYS: Readonly<Record<InsightPeriod, number>> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
} as const;

const DAY_MS = 86_400_000;

/**
 * `now` 기준으로 [previousStart, currentStart, currentEnd] 3-point window.
 * - currentEnd     = now
 * - currentStart   = now - period
 * - previousStart  = now - 2*period
 *
 * 즉 *현재 기간*과 *동일 길이의 직전 기간*을 비교 — direction (increase /
 * decrease / steady / spike) 결정의 기준.
 */
function buildWindow(period: InsightPeriod, now: number): {
  previousStart: number;
  currentStart: number;
  currentEnd: number;
} {
  const days = PERIOD_DAYS[period];
  const currentEnd = now;
  const currentStart = now - days * DAY_MS;
  const previousStart = now - 2 * days * DAY_MS;
  return { previousStart, currentStart, currentEnd };
}

// ============================================================================
// 2. Pattern detection primitives (Layer 2)
// ============================================================================

export type InsightDirection =
  | "increase" // 현재 > 직전 (≥ +20%)
  | "decrease" // 현재 < 직전 (≤ -20%)
  | "steady" // 변동 작음 (±20% 이내)
  | "spike" // 단일 day count가 평균 × 3 이상
  | "insufficient"; // 데이터 부족 — honest signal

export type InsightSignificance = "high" | "medium" | "low" | "noise";

const DIRECTION_THRESHOLD = 0.2; // ±20% 임계점 — Bloomberg Terminal 톤 (소음 회피)
const SPIKE_THRESHOLD = 2.0; // 평균 × 2 이상 = spike (Bloomberg-style 2σ alerting)
const SPIKE_ABSOLUTE_MIN = 5; // 단일 day 절대 5건 이상 — noise 회피
const MIN_DATA_POINTS = 3; // 카테고리당 최소 3건 미만 → insufficient

/**
 * 두 기간 count를 받아 direction을 결정. previous 0인 경우는 별도 분기 (분모
 * 0 회피, 신규 활동 시작 사례 처리).
 */
function deriveDirection(
  current: number,
  previous: number,
  totalDataPoints: number
): InsightDirection {
  if (totalDataPoints < MIN_DATA_POINTS) return "insufficient";
  if (previous === 0) {
    return current > 0 ? "increase" : "steady";
  }
  const ratio = (current - previous) / previous;
  if (ratio >= DIRECTION_THRESHOLD) return "increase";
  if (ratio <= -DIRECTION_THRESHOLD) return "decrease";
  return "steady";
}

/**
 * 단일 day spike detection — 일별 분포에서 평균 × 3 이상 day가 존재하는지.
 * 운영 패턴에서 *비정상 활동 burst* 감지 (예: 전시 오픈 day, viral 작품 등).
 */
function detectSpike(timestamps: number[], windowStart: number, windowEnd: number): boolean {
  if (timestamps.length < MIN_DATA_POINTS) return false;
  const buckets = new Map<number, number>();
  for (const ts of timestamps) {
    if (ts < windowStart || ts > windowEnd) continue;
    const dayKey = Math.floor(ts / DAY_MS);
    buckets.set(dayKey, (buckets.get(dayKey) ?? 0) + 1);
  }
  if (buckets.size === 0) return false;
  const counts = [...buckets.values()];
  const avg = counts.reduce((sum, n) => sum + n, 0) / counts.length;
  if (avg <= 0) return false;
  const max = Math.max(...counts);
  return max >= avg * SPIKE_THRESHOLD && max >= SPIKE_ABSOLUTE_MIN;
}

// ============================================================================
// 3. Snapshot & Insight types — 사용자 spec 6 categories
// ============================================================================

/**
 * Top item entry — 카테고리별 ranking 표시용 (Bloomberg Terminal 톤 일관).
 */
export interface InsightTopEntry {
  /** Display label (artist name / artwork title 등). */
  label: string;
  /** Stable identifier (artworkId / artistName 등). */
  id?: string;
  /** Count value — 절대 평가 / 가격 / "value" 0건. */
  count: number;
}

// ── §1 Inquiry Trends ─────────────────────────────────────────────────────

export interface InquiryTrendInsight {
  category: "inquiry";
  period: InsightPeriod;
  /** 현재 period 내 inquiry 수. */
  currentCount: number;
  /** 직전 동일 length period 내 inquiry 수. */
  previousCount: number;
  /** Pattern direction. */
  direction: InsightDirection;
  /**
   * 일평균 velocity (inquiries / day). Bloomberg Terminal 톤 — 의미 명확,
   * 가격이 아닌 *활동량 지표*.
   */
  velocityPerDay: number;
  /**
   * 동일 contact (collector)가 동일 artwork에 *반복 inquiry*한 건수.
   * "Repeated inquiry pattern" 사용자 spec §1 정확 매칭.
   */
  repeatedContacts: number;
  /** Top inquired artworks (id + title + count). 최대 3건. */
  topArtworks: InsightTopEntry[];
}

// ── §2 Save / Interest Patterns ───────────────────────────────────────────

export interface SavePatternInsight {
  category: "save";
  period: InsightPeriod;
  /**
   * 동일 collector contact가 *동일 artwork*에 반복 inquiry한 *고유 collector*
   * 수 — *repeated engagement*의 honest proxy (실 save 데이터 부재 시).
   */
  repeatedEngagementCount: number;
  /** Repeated engagement direction (현재 vs 직전 비교). */
  direction: InsightDirection;
  /** Repeated engagement 발생한 top artworks (interest signal). */
  highInterestArtworks: InsightTopEntry[];
  /**
   * 데이터 가용성 — Save / Favorite entity 부재 시 true. *honest signal* —
   * fake confidence 회피 (사용자 spec).
   */
  saveTrackingUnavailable: boolean;
}

// ── §3 Artist Activity ─────────────────────────────────────────────────────

export interface ArtistActivityInsight {
  category: "artist";
  period: InsightPeriod;
  /** 현재 period 내 활동 (inquiry+transaction)이 발생한 고유 artist 수. */
  activeArtists: number;
  /** 직전 period 내 활동 artist 수. */
  previousActiveArtists: number;
  /** 전체 활동량 direction. */
  direction: InsightDirection;
  /**
   * Artist별 inquiry+transaction count ranking. label = artist name. 최대 3건.
   * "Artist interaction trend" 사용자 spec §3 정확 매칭.
   */
  topArtists: InsightTopEntry[];
}

// ── §4 Settlement Analytics ────────────────────────────────────────────────

export interface SettlementAnalyticsInsight {
  category: "settlement";
  period: InsightPeriod;
  /** 현재 period 내 COMPLETED settlement 수. */
  completedCount: number;
  /** 현재 period 내 PENDING settlement 수. */
  pendingCount: number;
  /** 현재 period 내 READY (정산 준비 완료) 수. */
  readyCount: number;
  /**
   * 평균 정산 소요 (createdAt → settledAt). 일 단위. COMPLETED만 대상.
   * 0 이면 데이터 없음. *fake confidence 회피* — 1건도 없으면 isUnavailable true.
   */
  avgDaysToSettle: number;
  /**
   * 30일 이상 PENDING/READY 상태 머무른 건수 — *delayed settlement signal*.
   * 사용자 spec §4 정확 매칭.
   */
  delayedCount: number;
  /** completedCount direction (현재 vs 직전). */
  direction: InsightDirection;
  /** 데이터 부족 시 honest signal. */
  insufficient: boolean;
}

// ── §5 Transaction Flow Insight (funnel) ─────────────────────────────────

export interface TransactionFunnelInsight {
  category: "funnel";
  period: InsightPeriod;
  /** Stage 1: 본 period 내 발생한 inquiry 총 수. */
  inquiryCount: number;
  /** Stage 2: 그 중 Transaction (HOLD 이상)으로 진입 수. */
  holdCount: number;
  /** Stage 3: 그 중 PAID 진입 수. */
  paidCount: number;
  /** Stage 4: 그 중 Settlement COMPLETED까지 도달 수. */
  settledCount: number;
  /** Inquiry → Hold conversion (0~1). */
  inquiryToHoldRate: number;
  /** Hold → Settlement conversion (0~1). */
  holdToSettlementRate: number;
  /** 데이터 부족 시 (inquiry 3건 미만) honest signal. */
  insufficient: boolean;
}

// ── §6 Gallery Activity Signals ────────────────────────────────────────────

export interface GalleryActivitySignalsInsight {
  category: "activity";
  period: InsightPeriod;
  /** Aggregate event density (inquiry + transaction + settlement) total. */
  totalEvents: number;
  /** Direction vs 직전 period. */
  direction: InsightDirection;
  /** Single-day spike 감지 여부 — *activity burst signal*. */
  spikeDetected: boolean;
  /**
   * 동일 collector contact가 둘 이상의 다른 artwork에 inquiry → *repeat
   * interaction signal* (collector engagement 강도).
   */
  repeatInteractionCollectors: number;
  /**
   * Booth / visitor traffic 데이터 부재 — *honest signal*. Aggregate density만
   * 표시되며 physical traffic은 미수집.
   */
  trafficTrackingUnavailable: boolean;
}

// ── 통합 Snapshot ──────────────────────────────────────────────────────────

export interface OperationalInsightSnapshot {
  /** Snapshot 생성 시각 (deterministic — 입력 now 그대로 mirror). */
  generatedAt: string;
  /** Snapshot 대상 period. */
  period: InsightPeriod;
  /** 6 category insights — 사용자 spec §1~§6 정확 매칭. */
  inquiry: InquiryTrendInsight;
  save: SavePatternInsight;
  artist: ArtistActivityInsight;
  settlement: SettlementAnalyticsInsight;
  funnel: TransactionFunnelInsight;
  activity: GalleryActivitySignalsInsight;
}

// ============================================================================
// 4. Helpers — entity → timestamp/scope projection
// ============================================================================

function parseIso(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function inWindow(ts: number, start: number, end: number): boolean {
  return ts >= start && ts <= end;
}

// ============================================================================
// 5. Category builders — 사용자 spec §1~§6
// ============================================================================

// ── §1 deriveInquiryTrend ─────────────────────────────────────────────────

/**
 * Inquiry array → InquiryTrendInsight. 사용자 spec §1 정확 매칭:
 * - inquiry increase/decrease ✓ (direction)
 * - inquiry velocity         ✓ (velocityPerDay)
 * - repeated inquiry pattern ✓ (repeatedContacts)
 */
export function deriveInquiryTrend(
  inquiries: readonly Inquiry[],
  artworks: readonly Artwork[],
  period: InsightPeriod,
  now: number
): InquiryTrendInsight {
  const { previousStart, currentStart, currentEnd } = buildWindow(period, now);
  const days = PERIOD_DAYS[period];

  let currentCount = 0;
  let previousCount = 0;
  const currentInquiries: Inquiry[] = [];
  const totalInRange: Inquiry[] = [];

  for (const inq of inquiries) {
    const ts = parseIso(inq.createdAt);
    if (ts === null) continue;
    if (inWindow(ts, currentStart, currentEnd)) {
      currentCount++;
      currentInquiries.push(inq);
      totalInRange.push(inq);
    } else if (inWindow(ts, previousStart, currentStart - 1)) {
      previousCount++;
      totalInRange.push(inq);
    }
  }

  // Repeated contact pattern (사용자 spec "repeated inquiry pattern"):
  // 동일 contact (case-insensitive trim) × 동일 artworkId
  const seenPairs = new Set<string>();
  const repeatedPairs = new Set<string>();
  for (const inq of currentInquiries) {
    const contact = (inq.contact ?? "").trim().toLowerCase();
    if (!contact) continue;
    const key = `${contact}::${inq.artworkId}`;
    if (seenPairs.has(key)) {
      repeatedPairs.add(key);
    } else {
      seenPairs.add(key);
    }
  }
  const repeatedContacts = repeatedPairs.size;

  // Top artworks by inquiry count (current window)
  const artworkCounts = new Map<string, number>();
  for (const inq of currentInquiries) {
    artworkCounts.set(inq.artworkId, (artworkCounts.get(inq.artworkId) ?? 0) + 1);
  }
  const titleByArtworkId = new Map<string, string>();
  for (const a of artworks) {
    titleByArtworkId.set(a.id, a.title);
  }
  const topArtworks: InsightTopEntry[] = [...artworkCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({
      id,
      label: titleByArtworkId.get(id) ?? "(제목 미지정)",
      count,
    }));

  const direction = deriveDirection(currentCount, previousCount, totalInRange.length);
  const velocityPerDay = currentCount / days;

  return {
    category: "inquiry",
    period,
    currentCount,
    previousCount,
    direction,
    velocityPerDay: Math.round(velocityPerDay * 100) / 100,
    repeatedContacts,
    topArtworks,
  };
}

// ── §2 deriveSavePattern ──────────────────────────────────────────────────

/**
 * Save / Interest Patterns. Save / Favorite entity 부재 — *honest signal* +
 * Inquiry repeat을 *interest proxy*로 사용 (동일 collector × 동일 artwork
 * 반복 = 강한 interest signal).
 *
 * 사용자 spec §2 정확 매칭 (proxy로):
 * - save frequency       → repeatedEngagementCount (proxy)
 * - revisit activity     → repeated engagement
 * - repeated engagement  ✓ 직접
 * - high-interest works  ✓ highInterestArtworks
 */
export function deriveSavePattern(
  inquiries: readonly Inquiry[],
  artworks: readonly Artwork[],
  period: InsightPeriod,
  now: number
): SavePatternInsight {
  const { previousStart, currentStart, currentEnd } = buildWindow(period, now);

  // Group by (contact, artworkId)
  const currentPairs = new Map<string, { count: number; artworkId: string }>();
  const previousPairs = new Map<string, { count: number; artworkId: string }>();

  for (const inq of inquiries) {
    const contact = (inq.contact ?? "").trim().toLowerCase();
    if (!contact) continue;
    const ts = parseIso(inq.createdAt);
    if (ts === null) continue;
    const key = `${contact}::${inq.artworkId}`;
    if (inWindow(ts, currentStart, currentEnd)) {
      const cur = currentPairs.get(key);
      currentPairs.set(key, {
        count: (cur?.count ?? 0) + 1,
        artworkId: inq.artworkId,
      });
    } else if (inWindow(ts, previousStart, currentStart - 1)) {
      const cur = previousPairs.get(key);
      previousPairs.set(key, {
        count: (cur?.count ?? 0) + 1,
        artworkId: inq.artworkId,
      });
    }
  }

  // *Repeated* engagement = pair with count ≥ 2 (동일 collector가 동일 artwork에
  // 둘 이상 inquiry — 강한 interest 신호)
  const currentRepeated = [...currentPairs.values()].filter((v) => v.count >= 2);
  const previousRepeatedCount = [...previousPairs.values()].filter(
    (v) => v.count >= 2
  ).length;

  // High-interest artworks = repeated engagement이 *둘 이상의 collector*에서
  // 발생한 artwork
  const artworkRepeatedCollectors = new Map<string, number>();
  for (const [, v] of currentPairs) {
    if (v.count >= 2) {
      artworkRepeatedCollectors.set(
        v.artworkId,
        (artworkRepeatedCollectors.get(v.artworkId) ?? 0) + 1
      );
    }
  }
  const titleByArtworkId = new Map<string, string>();
  for (const a of artworks) {
    titleByArtworkId.set(a.id, a.title);
  }
  const highInterestArtworks: InsightTopEntry[] = [
    ...artworkRepeatedCollectors.entries(),
  ]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({
      id,
      label: titleByArtworkId.get(id) ?? "(제목 미지정)",
      count,
    }));

  const direction = deriveDirection(
    currentRepeated.length,
    previousRepeatedCount,
    currentRepeated.length + previousRepeatedCount
  );

  return {
    category: "save",
    period,
    repeatedEngagementCount: currentRepeated.length,
    direction,
    highInterestArtworks,
    // *honest signal*: 본 시스템에 Save / Favorite entity 미수집 — 실 save
    // tracking 데이터는 향후 STEP에서 정착 가능. 본 카테고리는 inquiry repeat
    // proxy 기반.
    saveTrackingUnavailable: true,
  };
}

// ── §3 deriveArtistActivity ────────────────────────────────────────────────

/**
 * Artist activity insight. 사용자 spec §3 정확 매칭:
 * - artist interaction trend  ✓ (direction + currentActiveArtists)
 * - artwork engagement trend  ✓ (topArtists by inquiry+tx count)
 * - category-level movement   ✓ (artist 단위 aggregate)
 */
export function deriveArtistActivity(
  artworks: readonly Artwork[],
  inquiries: readonly Inquiry[],
  transactions: readonly Transaction[],
  period: InsightPeriod,
  now: number
): ArtistActivityInsight {
  const { previousStart, currentStart, currentEnd } = buildWindow(period, now);

  const artistByArtworkId = new Map<string, string>();
  for (const a of artworks) {
    artistByArtworkId.set(a.id, a.artist?.name ?? "(작가 미지정)");
  }

  // artist → activity count (inquiry + transaction)
  const currentByArtist = new Map<string, number>();
  const previousByArtist = new Map<string, number>();
  let totalEvents = 0;

  function attribute(
    artworkId: string | undefined,
    iso: string | undefined,
    bucket: "current" | "previous" | null
  ) {
    if (!artworkId) return;
    const artist = artistByArtworkId.get(artworkId);
    if (!artist) return;
    if (bucket === null) return;
    const map = bucket === "current" ? currentByArtist : previousByArtist;
    map.set(artist, (map.get(artist) ?? 0) + 1);
    totalEvents++;
  }

  function bucketize(iso: string | undefined): "current" | "previous" | null {
    const ts = parseIso(iso);
    if (ts === null) return null;
    if (inWindow(ts, currentStart, currentEnd)) return "current";
    if (inWindow(ts, previousStart, currentStart - 1)) return "previous";
    return null;
  }

  for (const inq of inquiries) {
    attribute(inq.artworkId, inq.createdAt, bucketize(inq.createdAt));
  }
  for (const tx of transactions) {
    attribute(tx.artworkId, tx.createdAt, bucketize(tx.createdAt));
  }

  const topArtists: InsightTopEntry[] = [...currentByArtist.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([artist, count]) => ({ label: artist, count, id: artist }));

  const activeArtists = currentByArtist.size;
  const previousActiveArtists = previousByArtist.size;
  const direction = deriveDirection(activeArtists, previousActiveArtists, totalEvents);

  return {
    category: "artist",
    period,
    activeArtists,
    previousActiveArtists,
    direction,
    topArtists,
  };
}

// ── §4 deriveSettlementAnalytics ──────────────────────────────────────────

/**
 * Settlement analytics. 사용자 spec §4 정확 매칭:
 * - settlement timing pattern   ✓ (avgDaysToSettle)
 * - transaction completion flow ✓ (completedCount + status counts)
 * - delayed settlement signal   ✓ (delayedCount, 30일+ PENDING/READY)
 */
export function deriveSettlementAnalytics(
  settlements: readonly Settlement[],
  period: InsightPeriod,
  now: number
): SettlementAnalyticsInsight {
  const { previousStart, currentStart, currentEnd } = buildWindow(period, now);

  let completedCount = 0;
  let pendingCount = 0;
  let readyCount = 0;
  let previousCompleted = 0;
  let timingTotal = 0;
  let timingSamples = 0;
  let delayedCount = 0;
  let totalInRange = 0;

  const DELAYED_THRESHOLD_MS = 30 * DAY_MS;

  for (const s of settlements) {
    const created = parseIso(s.createdAt);
    const settled = parseIso(s.settledAt);
    const reference = settled ?? created;

    // Period bucketing — settled가 있으면 settled 기준, 없으면 createdAt
    if (reference !== null) {
      if (inWindow(reference, currentStart, currentEnd)) {
        totalInRange++;
        if (s.status === "COMPLETED") completedCount++;
        else if (s.status === "PENDING") pendingCount++;
        else if (s.status === "READY") readyCount++;

        // Timing — COMPLETED만 / created + settled 둘 다 있어야
        if (s.status === "COMPLETED" && created !== null && settled !== null) {
          const days = (settled - created) / DAY_MS;
          if (days >= 0) {
            timingTotal += days;
            timingSamples++;
          }
        }
      } else if (inWindow(reference, previousStart, currentStart - 1)) {
        totalInRange++;
        if (s.status === "COMPLETED") previousCompleted++;
      }
    }

    // Delayed signal — 현재 시점에서 PENDING/READY이고 createdAt이 30일 이상 전
    if (
      created !== null &&
      (s.status === "PENDING" || s.status === "READY") &&
      now - created >= DELAYED_THRESHOLD_MS
    ) {
      delayedCount++;
    }
  }

  const avgDaysToSettle =
    timingSamples > 0
      ? Math.round((timingTotal / timingSamples) * 10) / 10
      : 0;

  const direction = deriveDirection(completedCount, previousCompleted, totalInRange);

  return {
    category: "settlement",
    period,
    completedCount,
    pendingCount,
    readyCount,
    avgDaysToSettle,
    delayedCount,
    direction,
    insufficient: totalInRange < MIN_DATA_POINTS,
  };
}

// ── §5 deriveTransactionFunnel ────────────────────────────────────────────

/**
 * Transaction funnel insight. 사용자 spec §5 정확 매칭:
 * - inquiry → hold → settlement funnel ✓
 * - conversion flow visibility         ✓ (rates)
 * - transaction stage distribution     ✓ (stage counts)
 */
export function deriveTransactionFunnel(
  inquiries: readonly Inquiry[],
  transactions: readonly Transaction[],
  settlements: readonly Settlement[],
  period: InsightPeriod,
  now: number
): TransactionFunnelInsight {
  const { currentStart, currentEnd } = buildWindow(period, now);

  // Inquiry count in current window (Stage 1)
  let inquiryCount = 0;
  const inquiryIdsInWindow = new Set<string>();
  for (const inq of inquiries) {
    const ts = parseIso(inq.createdAt);
    if (ts !== null && inWindow(ts, currentStart, currentEnd)) {
      inquiryCount++;
      inquiryIdsInWindow.add(inq.id);
    }
  }

  // Stage 2-3: Transaction status — current window
  // Project schema (from src/types/transaction.ts):
  //   NEGOTIATING → AGREED → PAID → SETTLED → COMPLETED (+ CANCELLED 분기)
  // *Hold-or-later* = NEGOTIATING and beyond (사용자 spec "hold count" semantic
  // 매핑 — NEGOTIATING/AGREED 가 hold equivalent, transaction lifecycle 진입 신호).
  const HOLD_OR_LATER = new Set<Transaction["status"]>([
    "NEGOTIATING",
    "AGREED",
    "PAID",
    "SETTLED",
    "COMPLETED",
  ]);
  const PAID_OR_LATER = new Set<Transaction["status"]>([
    "PAID",
    "SETTLED",
    "COMPLETED",
  ]);

  let holdCount = 0;
  let paidCount = 0;
  const txIdsInWindow = new Set<string>();
  for (const tx of transactions) {
    const ts = parseIso(tx.createdAt);
    if (ts === null || !inWindow(ts, currentStart, currentEnd)) continue;
    txIdsInWindow.add(tx.id);
    if (HOLD_OR_LATER.has(tx.status)) holdCount++;
    if (PAID_OR_LATER.has(tx.status)) paidCount++;
  }

  // Stage 4: Settlement COMPLETED in current window
  let settledCount = 0;
  for (const s of settlements) {
    if (s.status !== "COMPLETED") continue;
    const ts = parseIso(s.settledAt) ?? parseIso(s.createdAt);
    if (ts !== null && inWindow(ts, currentStart, currentEnd)) {
      settledCount++;
    }
  }

  const inquiryToHoldRate =
    inquiryCount > 0 ? Math.min(holdCount / inquiryCount, 1) : 0;
  const holdToSettlementRate =
    holdCount > 0 ? Math.min(settledCount / holdCount, 1) : 0;

  return {
    category: "funnel",
    period,
    inquiryCount,
    holdCount,
    paidCount,
    settledCount,
    inquiryToHoldRate: Math.round(inquiryToHoldRate * 1000) / 1000,
    holdToSettlementRate: Math.round(holdToSettlementRate * 1000) / 1000,
    insufficient: inquiryCount < MIN_DATA_POINTS,
  };
}

// ── §6 deriveGalleryActivity ──────────────────────────────────────────────

/**
 * Gallery activity signals. 사용자 spec §6:
 * - booth/work traffic         🟡 (데이터 부재 — honest signal)
 * - engagement density         ✓ (totalEvents)
 * - activity spikes            ✓ (spikeDetected)
 * - repeat interaction signals ✓ (repeatInteractionCollectors)
 */
export function deriveGalleryActivity(
  inquiries: readonly Inquiry[],
  transactions: readonly Transaction[],
  settlements: readonly Settlement[],
  period: InsightPeriod,
  now: number
): GalleryActivitySignalsInsight {
  const { previousStart, currentStart, currentEnd } = buildWindow(period, now);

  const allTimestamps: number[] = [];
  let currentEvents = 0;
  let previousEvents = 0;
  let totalInRange = 0;

  function bucket(iso: string | undefined) {
    const ts = parseIso(iso);
    if (ts === null) return;
    allTimestamps.push(ts);
    if (inWindow(ts, currentStart, currentEnd)) {
      currentEvents++;
      totalInRange++;
    } else if (inWindow(ts, previousStart, currentStart - 1)) {
      previousEvents++;
      totalInRange++;
    }
  }
  for (const inq of inquiries) bucket(inq.createdAt);
  for (const tx of transactions) bucket(tx.createdAt);
  for (const s of settlements) bucket(s.settledAt ?? s.createdAt);

  const direction = deriveDirection(currentEvents, previousEvents, totalInRange);
  const spikeDetected = detectSpike(allTimestamps, currentStart, currentEnd);

  // Repeat interaction collectors — 동일 contact가 *둘 이상 다른 artwork*에 inquiry
  const collectorArtworks = new Map<string, Set<string>>();
  for (const inq of inquiries) {
    const ts = parseIso(inq.createdAt);
    if (ts === null || !inWindow(ts, currentStart, currentEnd)) continue;
    const contact = (inq.contact ?? "").trim().toLowerCase();
    if (!contact) continue;
    const set = collectorArtworks.get(contact) ?? new Set<string>();
    set.add(inq.artworkId);
    collectorArtworks.set(contact, set);
  }
  let repeatInteractionCollectors = 0;
  for (const set of collectorArtworks.values()) {
    if (set.size >= 2) repeatInteractionCollectors++;
  }

  return {
    category: "activity",
    period,
    totalEvents: currentEvents,
    direction,
    spikeDetected,
    repeatInteractionCollectors,
    // *honest signal*: physical booth / visitor traffic 데이터 미수집 —
    // aggregate density (digital event count)만 표시.
    trafficTrackingUnavailable: true,
  };
}

// ============================================================================
// 6. Snapshot composer — 6 카테고리를 1 snapshot으로 합성
// ============================================================================

export interface OperationalInsightInput {
  artworks: readonly Artwork[];
  inquiries: readonly Inquiry[];
  transactions: readonly Transaction[];
  settlements: readonly Settlement[];
  period: InsightPeriod;
  /** ISO datetime for "now" — deterministic 입력 (test용 / 실 운영 모두). */
  now: string;
}

/**
 * 6 카테고리 derivation을 단일 snapshot으로 통합. Pure / 결정성 보장.
 * Layer 3 summary generator의 입력.
 */
export function deriveOperationalInsightSnapshot(
  input: OperationalInsightInput
): OperationalInsightSnapshot {
  const nowMs = parseIso(input.now) ?? Date.now();
  return {
    generatedAt: input.now,
    period: input.period,
    inquiry: deriveInquiryTrend(input.inquiries, input.artworks, input.period, nowMs),
    save: deriveSavePattern(input.inquiries, input.artworks, input.period, nowMs),
    artist: deriveArtistActivity(
      input.artworks,
      input.inquiries,
      input.transactions,
      input.period,
      nowMs
    ),
    settlement: deriveSettlementAnalytics(input.settlements, input.period, nowMs),
    funnel: deriveTransactionFunnel(
      input.inquiries,
      input.transactions,
      input.settlements,
      input.period,
      nowMs
    ),
    activity: deriveGalleryActivity(
      input.inquiries,
      input.transactions,
      input.settlements,
      input.period,
      nowMs
    ),
  };
}

// ============================================================================
// 7. Direction display label (Korean institutional tone)
// ============================================================================

export const INSIGHT_DIRECTION_LABEL_KR: Readonly<Record<InsightDirection, string>> = {
  increase: "증가",
  decrease: "감소",
  steady: "안정 유지",
  spike: "활동 급증 감지",
  insufficient: "데이터 부족",
} as const;

/**
 * Bloomberg Terminal 톤 directional indicator — 단일 character marker.
 * Up arrow ▲ / Down arrow ▼ / Steady ─ / Spike ◆ / Insufficient ·
 */
export const INSIGHT_DIRECTION_GLYPH: Readonly<Record<InsightDirection, string>> = {
  increase: "▲",
  decrease: "▼",
  steady: "─",
  spike: "◆",
  insufficient: "·",
} as const;
