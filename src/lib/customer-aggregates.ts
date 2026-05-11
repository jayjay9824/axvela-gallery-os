// ============================================================================
// Customer Aggregates — STEP 42 (Customer / Collector Domain Promotion).
//
// Pure derive function: Inquiry / Transaction / Invoice slices → Customer
// entities. **신규 도메인 store 0개 · read-only aggregation**.
//
// STEP 41 collector-aggregates.ts의 superset:
//   - 모든 STEP 41 신호/메트릭 계승
//   - 추가: kind / segment / firstInteractionAt / channelMix / allContacts
//   - 동일한 식별 정책 (name lowercase trim) — backward compat
//
// 사용자 spec 준수:
//   - 새 핵심 계산 로직 0개 — invoice fxRate read-only 참조만
//   - Money Flow / Settlement / Tax / FX 계산 무수정
//   - 외부 API 호출 0건
//   - "확정 고객 등급" 표현 0건 — 모두 운영 참고 휴리스틱
// ============================================================================

import type { Inquiry, InquirySource } from "@/types/inquiry";
import type { Transaction } from "@/types/transaction";
import type {
  Customer,
  CustomerKind,
  CustomerSegment,
  CustomerSignal,
} from "@/types/customer";

// ----------------------------------------------------------------------------
// Threshold constants — STEP 41 호환 + 신규
// ----------------------------------------------------------------------------

/** 진행 중 inquiry 상태 (응대 필요 — ACTIVE_INQUIRY 신호 트리거). */
const ACTIVE_INQUIRY_STATUSES = new Set<Inquiry["status"]>([
  "OPEN",
  "RESPONDED",
  "ESCALATED",
]);

/** 진행 중 transaction 상태 (협상/합의 — Money Flow 미완료). */
const ACTIVE_TX_STATUSES = new Set<Transaction["status"]>([
  "NEGOTIATING",
  "AGREED",
]);

/** HIGH_VALUE 신호 트리거 — 누적 매입액 (KRW). STEP 41과 동일. */
const HIGH_VALUE_KRW_THRESHOLD = 100_000_000;

/** RECENT_ACTIVITY 신호 트리거 — 마지막 활동 일수. STEP 41과 동일. */
const RECENT_ACTIVITY_DAYS = 30;

/** MULTI_DEAL 신호 트리거 — 거래 카운트. STEP 41과 동일. */
const MULTI_DEAL_MIN = 2;

/** DORMANT segment 트리거 — 마지막 활동 일수 (RECENT보다 길게). */
const DORMANT_DAYS = 90;

// ----------------------------------------------------------------------------
// Internal accumulator (derive 중간 상태)
// ----------------------------------------------------------------------------

interface CustomerAccum {
  displayName: string;
  contactCounts: Map<string, number>;
  inquiryIds: Set<string>;
  transactionIds: Set<string>;
  ownedArtworkIds: Set<string>;
  totalPurchaseKRW: number;
  missingFxCount: number;
  activeInquiryCount: number;
  activeTransactionCount: number;
  firstInteractionAt: string;
  lastInteractionAt: string;
  channelMix: Map<InquirySource, number>;
}

// ----------------------------------------------------------------------------
// Public derive
// ----------------------------------------------------------------------------

/**
 * Customer 목록 derive.
 *
 * @param inquiries        flatten된 모든 inquiry (Object.values(inquiries).flat())
 * @param transactions     flatten된 모든 transaction
 * @param invoicesByTxId   transactionId → invoice fxRate lookup (외화 환산용,
 *                          STEP 32 Invoice.fxSnapshot.rate read-only 참조)
 *
 * @returns lastInteractionAt 내림차순 정렬된 Customer 목록.
 */
export function deriveCustomers(
  inquiries: Inquiry[],
  transactions: Transaction[],
  invoicesByTxId: Record<string, { fxRate?: number }>
): Customer[] {
  const accumByKey = new Map<string, CustomerAccum>();

  // ── Inquiries ────────────────────────────────────────────────────────────
  for (const inq of inquiries) {
    const key = normalizeName(inq.collectorName);
    if (!key) continue; // intake pending — collector 아님
    const acc = ensure(accumByKey, key, inq.collectorName);

    acc.inquiryIds.add(inq.id);

    if (inq.contact) {
      acc.contactCounts.set(
        inq.contact,
        (acc.contactCounts.get(inq.contact) ?? 0) + 1
      );
    }

    if (ACTIVE_INQUIRY_STATUSES.has(inq.status)) {
      acc.activeInquiryCount += 1;
    }

    // Channel mix
    acc.channelMix.set(inq.source, (acc.channelMix.get(inq.source) ?? 0) + 1);

    // Time tracking — inquiry는 createdAt만 사용 (updatedAt 부재)
    accumulateTime(acc, inq.createdAt);
  }

  // ── Transactions ─────────────────────────────────────────────────────────
  for (const tx of transactions) {
    const key = normalizeName(tx.buyerName);
    if (!key) continue;
    const acc = ensure(accumByKey, key, tx.buyerName);

    acc.transactionIds.add(tx.id);
    acc.ownedArtworkIds.add(tx.artworkId);

    // 누적 매입액 — invoice fxRate read-only 참조 (STEP 32 fxSnapshot)
    const invInfo = invoicesByTxId[tx.id];
    if (tx.currency === "KRW") {
      acc.totalPurchaseKRW += tx.agreedPrice;
    } else if (invInfo?.fxRate !== undefined) {
      acc.totalPurchaseKRW += Math.round(tx.agreedPrice * invInfo.fxRate);
    } else {
      acc.missingFxCount += 1;
    }

    if (ACTIVE_TX_STATUSES.has(tx.status)) {
      acc.activeTransactionCount += 1;
    }

    accumulateTime(acc, tx.createdAt);
    accumulateTime(acc, tx.updatedAt);
  }

  // ── Convert + segmentation + signals ─────────────────────────────────────
  const out: Customer[] = [];
  const now = Date.now();
  const recentMs = RECENT_ACTIVITY_DAYS * DAY_MS;
  const dormantMs = DORMANT_DAYS * DAY_MS;

  for (const [key, acc] of accumByKey) {
    // Signals (STEP 41 호환 — 4종 동일)
    const signals: CustomerSignal[] = [];
    if (acc.transactionIds.size >= MULTI_DEAL_MIN) signals.push("MULTI_DEAL");
    if (acc.activeInquiryCount > 0) signals.push("ACTIVE_INQUIRY");
    if (acc.totalPurchaseKRW >= HIGH_VALUE_KRW_THRESHOLD)
      signals.push("HIGH_VALUE");
    let isRecentlyActive = false;
    if (acc.lastInteractionAt) {
      const last = new Date(acc.lastInteractionAt).getTime();
      if (!Number.isNaN(last) && now - last <= recentMs) {
        signals.push("RECENT_ACTIVITY");
        isRecentlyActive = true;
      }
    }

    // Kind — 거래/문의 카운트 + 활동 inquiry 기반
    const kind = computeKind(acc);

    // Segment — 거래 카운트 + 활동성 기반
    const segment = computeSegment(acc, now, dormantMs, isRecentlyActive);

    // Channel mix — Map → Partial Record
    const channelMix: Partial<Record<InquirySource, number>> = {};
    for (const [src, n] of acc.channelMix) {
      channelMix[src] = n;
    }
    const primarySource = mostFrequentChannel(acc.channelMix);

    // Contacts
    const sortedContacts = Array.from(acc.contactCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    const allContacts = sortedContacts.map(([c]) => c);
    const primaryContact = allContacts[0] ?? "";

    out.push({
      id: key,
      displayName: acc.displayName,
      primaryContact,
      allContacts,
      inquiryIds: Array.from(acc.inquiryIds),
      transactionIds: Array.from(acc.transactionIds),
      ownedArtworkIds: Array.from(acc.ownedArtworkIds),
      totalPurchaseKRW: acc.totalPurchaseKRW,
      missingFxCount: acc.missingFxCount,
      activeInquiryCount: acc.activeInquiryCount,
      activeTransactionCount: acc.activeTransactionCount,
      firstInteractionAt: acc.firstInteractionAt,
      lastInteractionAt: acc.lastInteractionAt,
      primarySource,
      channelMix,
      kind,
      segment,
      signals,
    });
  }

  // 정렬: lastInteractionAt 내림차순 (최근 활동 우선) → displayName 알파벳
  out.sort((a, b) => {
    if (a.lastInteractionAt === b.lastInteractionAt) {
      return a.displayName.localeCompare(b.displayName, "ko");
    }
    return b.lastInteractionAt.localeCompare(a.lastInteractionAt);
  });

  return out;
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function ensure(
  map: Map<string, CustomerAccum>,
  key: string,
  displayName: string
): CustomerAccum {
  let acc = map.get(key);
  if (!acc) {
    acc = {
      displayName,
      contactCounts: new Map(),
      inquiryIds: new Set(),
      transactionIds: new Set(),
      ownedArtworkIds: new Set(),
      totalPurchaseKRW: 0,
      missingFxCount: 0,
      activeInquiryCount: 0,
      activeTransactionCount: 0,
      firstInteractionAt: "",
      lastInteractionAt: "",
      channelMix: new Map(),
    };
    map.set(key, acc);
  }
  return acc;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** ISO timestamp 한 건을 first/last로 반영 (defensive — 빈 문자열 무시). */
function accumulateTime(acc: CustomerAccum, iso: string): void {
  if (!iso) return;
  if (!acc.firstInteractionAt || iso < acc.firstInteractionAt) {
    acc.firstInteractionAt = iso;
  }
  if (iso > acc.lastInteractionAt) {
    acc.lastInteractionAt = iso;
  }
}

function mostFrequentChannel(
  counts: Map<InquirySource, number>
): InquirySource | undefined {
  let best: InquirySource | undefined;
  let bestCount = 0;
  for (const [src, n] of counts) {
    if (n > bestCount) {
      best = src;
      bestCount = n;
    }
  }
  return best;
}

/**
 * 활동 패턴 분류:
 *   - 거래 1+   → RETURNING
 *   - 거래 0 + 진행 중 inquiry 1+ → ACTIVE_LEAD
 *   - 거래 0 + 진행 중 inquiry 0 → FIRST_TIME (휴면 문의자 포함)
 */
function computeKind(acc: CustomerAccum): CustomerKind {
  if (acc.transactionIds.size >= 1) return "RETURNING";
  if (acc.activeInquiryCount > 0) return "ACTIVE_LEAD";
  return "FIRST_TIME";
}

/**
 * Segment 분류:
 *   - 거래 0건 → PROSPECT
 *   - 거래 1건 → ONE_TIME_BUYER
 *   - 거래 2+건 → REPEAT_BUYER
 *   - 위 결과 + 마지막 활동 90일+ → DORMANT 덮어쓰기 (활동성 우선)
 *
 * 단, 진행 중 inquiry/transaction이 있으면 DORMANT 덮어쓰기 안 함 (recently
 * active 또는 active 자체이므로).
 */
function computeSegment(
  acc: CustomerAccum,
  now: number,
  dormantMs: number,
  isRecentlyActive: boolean
): CustomerSegment {
  const txCount = acc.transactionIds.size;
  const base: CustomerSegment =
    txCount >= 2 ? "REPEAT_BUYER" : txCount === 1 ? "ONE_TIME_BUYER" : "PROSPECT";

  // Active이거나 진행 중 작업 있으면 DORMANT 안 됨
  if (
    isRecentlyActive ||
    acc.activeInquiryCount > 0 ||
    acc.activeTransactionCount > 0
  ) {
    return base;
  }

  // 마지막 활동 90일+ → DORMANT
  if (acc.lastInteractionAt) {
    const last = new Date(acc.lastInteractionAt).getTime();
    if (!Number.isNaN(last) && now - last > dormantMs) {
      return "DORMANT";
    }
  }

  return base;
}

// ============================================================================
// Display helpers (UI에서 사용 — STEP 41 collector-aggregates에서 마이그레이션)
// ============================================================================

export const CUSTOMER_SIGNAL_LABEL_KR: Record<CustomerSignal, string> = {
  MULTI_DEAL: "다회 거래",
  ACTIVE_INQUIRY: "응대 필요",
  RECENT_ACTIVITY: "최근 활동",
  HIGH_VALUE: "대규모 매입",
};

export const CUSTOMER_SIGNAL_HINT_KR: Record<CustomerSignal, string> = {
  MULTI_DEAL: "거래 2건 이상",
  ACTIVE_INQUIRY: "진행 중 문의 있음",
  RECENT_ACTIVITY: `${RECENT_ACTIVITY_DAYS}일 이내 활동`,
  HIGH_VALUE: "누적 매입액 ₩100M 이상",
};

export const CUSTOMER_KIND_LABEL_KR: Record<CustomerKind, string> = {
  FIRST_TIME: "신규",
  ACTIVE_LEAD: "응대 진행",
  RETURNING: "거래 경험",
};

export const CUSTOMER_SEGMENT_LABEL_KR: Record<CustomerSegment, string> = {
  PROSPECT: "문의 단계",
  ONE_TIME_BUYER: "1회 구매",
  REPEAT_BUYER: "반복 구매",
  DORMANT: "휴면",
};

export const CUSTOMER_SEGMENT_HINT_KR: Record<CustomerSegment, string> = {
  PROSPECT: "거래 0건 — 문의 단계",
  ONE_TIME_BUYER: "거래 1건 (운영 참고)",
  REPEAT_BUYER: "거래 2건 이상 (운영 참고)",
  DORMANT: `마지막 활동 ${DORMANT_DAYS}일 이상 경과 (운영 참고)`,
};

/** Inquiry source 한국어 라벨 — channel mix 표시용. */
export const INQUIRY_SOURCE_LABEL_KR: Record<InquirySource, string> = {
  WEBSITE: "웹사이트",
  EMAIL: "이메일",
  SHOWROOM: "갤러리 방문",
  ART_FAIR: "아트페어",
  REFERRAL: "소개",
  COLLECTOR_VIEW: "Collector View",
  OTHER: "기타",
};

const KRW_FMT = new Intl.NumberFormat("ko-KR");

export function formatCustomerKRW(amount: number): string {
  return `₩${KRW_FMT.format(Math.round(amount))}`;
}

/**
 * "방금 전" / "N분 전" / "N일 전" / "YYYY-MM-DD" (30일 이상 시 절대).
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "방금 전";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}일 전`;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
