// ============================================================================
// Reporting Aggregates — STEP 35 (Multi-currency Reporting Layer)
//
// Pure aggregation over Invoice / Settlement / TaxRecord slices. KRW 통합
// 환산 리포트의 단일 source of truth. **도메인 로직 0줄 변경 — read-only**.
// 정산 / 세무 / Payment 자체 계산은 store action에서 이미 끝남, 본 모듈은
// 그 결과를 단순 합산.
//
// Manifesto 준수:
//   rule_3   Money Flow 분리 — Payment / Settlement / Tax 각자 독립 카운트
//   rule_4   Trust Layer    — fxSnapshot 기반 환산. 신고/확정 의미 없음
//   rule_20  FX             — Invoice.fxSnapshot lock 시점 환율 사용,
//                             Settlement.convertedTotalKRW / Tax.taxableAmountKRW
//                             은 Invoice의 lock된 환율을 propagate
//
// 표현 정책 (사용자 spec):
//   - "회계 확정" / "세무 신고 완료" 표현 금지
//   - "운영 참고 리포트" / "내부 정산 기준" / "FX snapshot 기준" 사용
// ============================================================================

import type { Invoice, InvoiceStatus } from "@/types/invoice";
import type { Settlement, SettlementStatus } from "@/types/settlement";
import type { TaxRecord, TaxRecordStatus } from "@/types/tax";
import type { Currency, Transaction } from "@/types/transaction";
import type { Inquiry, InquirySource } from "@/types/inquiry";
import type { Customer } from "@/types/customer";

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

/**
 * STEP 35.5 — Reporting Time Filter.
 *
 * 기간 필터 — Invoice는 `issuedAt`, Settlement는 `createdAt`, Tax는
 * `createdAt`를 기준 timestamp으로 사용. 4가지 preset:
 *   - ALL          전체 (필터 비활성)
 *   - THIS_MONTH   이번 달 (현재 시점 기준 month-start ~ month-end)
 *   - THIS_QUARTER 이번 분기 (현재 시점 기준 quarter-start ~ quarter-end)
 *   - CUSTOM       사용자 지정 — customStart/customEnd 사용 (YYYY-MM-DD)
 *
 * 본 타입은 UI state 구조이지 도메인 타입이 아님. Persistence 0.
 */
export type ReportingTimePreset =
  | "ALL"
  | "THIS_MONTH"
  | "THIS_QUARTER"
  | "CUSTOM";

export interface ReportingTimeFilter {
  preset: ReportingTimePreset;
  /** CUSTOM 모드 전용 — YYYY-MM-DD or "" */
  customStart: string;
  customEnd: string;
}

export const EMPTY_REPORTING_TIME_FILTER: ReportingTimeFilter = {
  preset: "ALL",
  customStart: "",
  customEnd: "",
};

export interface CurrencyBucket {
  currency: Currency;
  /** 해당 통화 invoice 건수 */
  count: number;
  /** 해당 통화 native 단위 합계 (예: USD면 USD amount 합) */
  total: number;
  /**
   * KRW 환산 합계. KRW 자체면 total과 동일.
   * 외화이지만 fxSnapshot 부재 (DRAFT 등)면 null — UI에서 "환산 정보 부족" 표시.
   */
  convertedKRW: number | null;
  /** 외화 invoice 중 fxSnapshot 부재 건수 (KRW invoice는 항상 0). */
  missingFxCount: number;
}

// ----------------------------------------------------------------------------
// STEP 47 — Channel Mix (유입 채널 기준 집계)
// ----------------------------------------------------------------------------

/**
 * 단일 채널의 유입 / 응대 / 거래 연결 카운트.
 *
 * Customer master data slice 추가 0개 — `inquiry.source` enum 기반 derive only.
 * Customer count는 `deriveCustomers()` 결과의 primarySource 기준 집계.
 *
 * **표현 정책**: "확정 고객 등급" / "신용 평가" / "광고 성과 확정" / "매출 기여
 * 확정" 표현 금지. inquiryShare는 단순 % 비중일 뿐 광고 성과를 의미하지 않음.
 */
export interface ChannelMixBucket {
  source: InquirySource;
  inquiryCount: number;
  customerCount: number;
  /** First-touch 어트리뷰션 — 같은 작품의 가장 이른 inquiry source 기준 */
  transactionCount: number;
  /** inquiryCount / totalInquiryCount * 100. 분모 0이면 0. */
  inquiryShare: number;
}

export interface ChannelMixSection {
  totalInquiryCount: number;
  totalCustomerCount: number;
  totalTransactionCount: number;
  /** inquiryCount 내림차순. 0 카운트 source는 제외. */
  buckets: ChannelMixBucket[];
  /** 상위 3개 source — UI 강조용. buckets 첫 3개 source. */
  topSources: InquirySource[];
  /** 같은 작품에 inquiry가 0건인 transaction (어트리뷰션 불가) */
  unattributedTransactionCount: number;
}

export interface ReportingAggregates {
  // ── KPI cards ─────────────────────────────────────────────────────────────
  /**
   * Total Sales (KRW 환산 기준). 모든 invoice (DRAFT 포함)의 KRW 환산 합계.
   * KRW invoice는 amount 그대로, 외화 invoice는 fxSnapshot으로 환산.
   * fxSnapshot이 없는 외화 invoice는 합산 제외 (missingFxCount로 별도 카운트).
   */
  totalSalesKRW: number;
  /** Total Sales 카운트 (모든 invoice). */
  totalSalesCount: number;
  /** Total Sales에서 KRW 환산 가능했던 건수 (외화 fxSnapshot 부재 제외). */
  convertibleInvoiceCount: number;

  /**
   * Settlement Total (KRW 기준). totalAmount 합계.
   * - KRW settlement: totalAmount
   * - 외화 settlement w/ convertedTotalKRW: convertedTotalKRW
   * - 외화 settlement w/o conversion: 합산 제외
   */
  settlementTotalKRW: number;
  settlementCount: number;
  settlementMissingFxCount: number;

  /**
   * Taxable Amount (KRW 기준). TaxRecord.taxableAmountKRW 합계.
   * KRW tax는 taxableAmount 그대로 사용.
   */
  taxableAmountKRW: number;
  taxRecordCount: number;
  taxMissingFxCount: number;

  /**
   * "FX Converted KRW Total" — 외화 invoice의 KRW 환산 합계.
   * Total Sales가 KRW + 외화 환산 모두 포함하는 반면, 본 metric은 외화 부분만.
   * KRW invoice는 0. 갤러리 운영자에게 "외화 매출이 KRW로 얼마인지" 즉시 노출.
   */
  fxConvertedKRWTotal: number;
  fxConvertedInvoiceCount: number;

  // ── Currency Breakdown ────────────────────────────────────────────────────
  /** Invoice currency별 합계 — currency string 알파벳 순. KRW 우선. */
  currencyBreakdown: CurrencyBucket[];

  // ── Status summary ────────────────────────────────────────────────────────
  invoiceStatusBreakdown: Record<InvoiceStatus, number>;
  settlementStatusBreakdown: Record<SettlementStatus, number>;
  taxStatusBreakdown: Record<TaxRecordStatus, number>;

  // ── STEP 47 Channel Mix (유입 채널 — Customer / Inquiry derive) ────────────
  /**
   * Customer master data slice 추가 0개 — Inquiry / Transaction에서 derive.
   * 입력 부재 시 (drawer가 channelInput을 전달하지 않으면) null. Backward-compat.
   */
  channelMix: ChannelMixSection | null;

  // ── Metadata ──────────────────────────────────────────────────────────────
  /**
   * 어떤 invoice의 fxSnapshot이라도 sourceNote에 "mock" 키워드가 있으면
   * 사용자에게 mock provider임을 작게 표시하기 위한 플래그. 단순 휴리스틱.
   */
  fxSourceIsMock: boolean;
  /** 처리된 외화 invoice 중 가장 흔한 provider id — UI footer 표시용. */
  fxProviderId: string | null;
}

// ----------------------------------------------------------------------------
// Pure aggregator
// ----------------------------------------------------------------------------

const ZERO_INVOICE_STATUS: Record<InvoiceStatus, number> = {
  DRAFT: 0,
  SENT: 0,
  PAID: 0,
};

const ZERO_SETTLEMENT_STATUS: Record<SettlementStatus, number> = {
  PENDING: 0,
  READY: 0,
  COMPLETED: 0,
};

const ZERO_TAX_STATUS: Record<TaxRecordStatus, number> = {
  PENDING: 0,
  READY: 0,
  ISSUED: 0,
};

export function computeReportingAggregates(
  invoices: Invoice[],
  settlements: Settlement[],
  taxRecords: TaxRecord[],
  /**
   * STEP 47 — Channel Mix 입력. 호출자가 이미 time-filter한 inquiries +
   * transactions + customers를 전달. 미전달 시 channelMix는 null로 반환
   * (backward-compat — STEP 35.6 이전 호출자 영향 0줄).
   */
  channelInput?: {
    inquiries: Inquiry[];
    transactions: Transaction[];
    customers: Customer[];
  }
): ReportingAggregates {
  // KPI accumulators
  let totalSalesKRW = 0;
  let convertibleInvoiceCount = 0;
  let fxConvertedKRWTotal = 0;
  let fxConvertedInvoiceCount = 0;

  let settlementTotalKRW = 0;
  let settlementMissingFxCount = 0;

  let taxableAmountKRW = 0;
  let taxMissingFxCount = 0;

  const invoiceStatusBreakdown = { ...ZERO_INVOICE_STATUS };
  const settlementStatusBreakdown = { ...ZERO_SETTLEMENT_STATUS };
  const taxStatusBreakdown = { ...ZERO_TAX_STATUS };

  const buckets = new Map<Currency, CurrencyBucket>();
  const providerCount = new Map<string, number>();
  let fxSourceIsMock = false;

  // ── Invoices ──────────────────────────────────────────────────────────────
  for (const inv of invoices) {
    invoiceStatusBreakdown[inv.status] += 1;

    let bucket = buckets.get(inv.currency);
    if (!bucket) {
      bucket = {
        currency: inv.currency,
        count: 0,
        total: 0,
        convertedKRW: 0,
        missingFxCount: 0,
      };
      buckets.set(inv.currency, bucket);
    }
    bucket.count += 1;
    bucket.total += inv.amount;

    if (inv.currency === "KRW") {
      totalSalesKRW += inv.amount;
      convertibleInvoiceCount += 1;
      if (bucket.convertedKRW !== null) bucket.convertedKRW += inv.amount;
    } else {
      // 외화 invoice — fxSnapshot 있으면 환산, 없으면 missing 카운트
      if (inv.fxSnapshot && inv.fxSnapshot.quoteCurrency === "KRW") {
        const krw = Math.round(inv.amount * inv.fxSnapshot.rate);
        totalSalesKRW += krw;
        fxConvertedKRWTotal += krw;
        fxConvertedInvoiceCount += 1;
        convertibleInvoiceCount += 1;
        if (bucket.convertedKRW !== null) bucket.convertedKRW += krw;

        // Provider tracking
        const pid = inv.fxSnapshot.provider;
        providerCount.set(pid, (providerCount.get(pid) ?? 0) + 1);
        if (
          pid.toLowerCase().includes("mock") ||
          (inv.fxSnapshot.sourceNote ?? "").toLowerCase().includes("mock")
        ) {
          fxSourceIsMock = true;
        }
      } else {
        bucket.missingFxCount += 1;
        bucket.convertedKRW = null; // 부분적이라도 누락 발생 시 통화 수준 환산 불가
      }
    }
  }

  // ── Settlements ───────────────────────────────────────────────────────────
  for (const s of settlements) {
    settlementStatusBreakdown[s.status] += 1;
    if (s.currency === "KRW") {
      settlementTotalKRW += s.totalAmount;
    } else if (s.convertedTotalKRW !== undefined) {
      settlementTotalKRW += s.convertedTotalKRW;
    } else {
      settlementMissingFxCount += 1;
    }
  }

  // ── TaxRecords ────────────────────────────────────────────────────────────
  for (const t of taxRecords) {
    taxStatusBreakdown[t.status] += 1;
    if (t.currency === "KRW") {
      taxableAmountKRW += t.taxableAmount;
    } else if (t.taxableAmountKRW !== undefined) {
      taxableAmountKRW += t.taxableAmountKRW;
    } else {
      taxMissingFxCount += 1;
    }
  }

  // ── Currency breakdown 정렬 ──────────────────────────────────────────────
  const currencyBreakdown = Array.from(buckets.values()).sort((a, b) => {
    if (a.currency === "KRW") return -1;
    if (b.currency === "KRW") return 1;
    return a.currency.localeCompare(b.currency);
  });

  // ── Provider 빈도 1위 ─────────────────────────────────────────────────────
  let fxProviderId: string | null = null;
  let maxCount = 0;
  for (const [pid, count] of providerCount) {
    if (count > maxCount) {
      maxCount = count;
      fxProviderId = pid;
    }
  }

  // STEP 47 — Channel Mix derive (input 전달 시에만)
  const channelMix = channelInput
    ? computeChannelMix(
        channelInput.inquiries,
        channelInput.transactions,
        channelInput.customers
      )
    : null;

  return {
    totalSalesKRW,
    totalSalesCount: invoices.length,
    convertibleInvoiceCount,
    settlementTotalKRW,
    settlementCount: settlements.length,
    settlementMissingFxCount,
    taxableAmountKRW,
    taxRecordCount: taxRecords.length,
    taxMissingFxCount,
    fxConvertedKRWTotal,
    fxConvertedInvoiceCount,
    currencyBreakdown,
    invoiceStatusBreakdown,
    settlementStatusBreakdown,
    taxStatusBreakdown,
    channelMix,
    fxSourceIsMock,
    fxProviderId,
  };
}

// ----------------------------------------------------------------------------
// STEP 47 — Channel Mix pure aggregator
// ----------------------------------------------------------------------------

/**
 * Inquiry / Transaction / Customer 입력에서 채널 분포 derive.
 *
 * **휴리스틱 모델 (사용자 spec — "광고 성과 확정" 표현 금지):**
 *   - inquiry count: `inquiry.source` enum 직접 카운트
 *   - customer count: `customer.primarySource` 카운트 (deriveCustomers 결과 활용)
 *   - transaction count: First-touch 어트리뷰션 — 같은 작품의 *가장 이른*
 *     inquiry source를 attribution channel로. 같은 작품에 inquiry 0건이면
 *     `unattributedTransactionCount` 카운터로 별도 보관.
 *
 * **결정성 보장**: 모든 입력이 동일하면 결과도 동일. tiebreak는 source name
 * 알파벳 순.
 *
 * **표현 정책**: 본 결과는 "유입 채널 기준 운영 참고"로만 표시 — 광고 성과
 * 또는 매출 기여 확정과 무관.
 */
export function computeChannelMix(
  inquiries: Inquiry[],
  transactions: Transaction[],
  customers: Customer[]
): ChannelMixSection {
  // 1. Inquiry count by source
  const inquiryCountBySource: Record<string, number> = {};
  for (const i of inquiries) {
    inquiryCountBySource[i.source] = (inquiryCountBySource[i.source] ?? 0) + 1;
  }

  // 2. Customer count by primarySource — primarySource 부재면 제외
  const customerCountBySource: Record<string, number> = {};
  for (const c of customers) {
    if (c.primarySource) {
      customerCountBySource[c.primarySource] =
        (customerCountBySource[c.primarySource] ?? 0) + 1;
    }
  }

  // 3. First-touch 어트리뷰션 — artwork별 가장 이른 inquiry source
  const earliestInquiryByArtwork: Map<string, Inquiry> = new Map();
  for (const i of inquiries) {
    const prev = earliestInquiryByArtwork.get(i.artworkId);
    if (!prev || i.createdAt < prev.createdAt) {
      earliestInquiryByArtwork.set(i.artworkId, i);
    }
  }

  const transactionCountBySource: Record<string, number> = {};
  let unattributedTransactionCount = 0;
  for (const t of transactions) {
    const earliest = earliestInquiryByArtwork.get(t.artworkId);
    if (!earliest) {
      unattributedTransactionCount += 1;
      continue;
    }
    transactionCountBySource[earliest.source] =
      (transactionCountBySource[earliest.source] ?? 0) + 1;
  }

  // 4. Buckets — union of all source sets
  const allSources = new Set<string>([
    ...Object.keys(inquiryCountBySource),
    ...Object.keys(customerCountBySource),
    ...Object.keys(transactionCountBySource),
  ]);

  const totalInquiries = inquiries.length;
  const buckets: ChannelMixBucket[] = [];
  for (const src of allSources) {
    const inq = inquiryCountBySource[src] ?? 0;
    const cus = customerCountBySource[src] ?? 0;
    const tx = transactionCountBySource[src] ?? 0;
    if (inq === 0 && cus === 0 && tx === 0) continue;
    buckets.push({
      source: src as InquirySource,
      inquiryCount: inq,
      customerCount: cus,
      transactionCount: tx,
      inquiryShare: totalInquiries > 0 ? (inq / totalInquiries) * 100 : 0,
    });
  }

  // 5. Sort: inquiryCount desc → customerCount desc → source name asc
  buckets.sort((a, b) => {
    if (b.inquiryCount !== a.inquiryCount)
      return b.inquiryCount - a.inquiryCount;
    if (b.customerCount !== a.customerCount)
      return b.customerCount - a.customerCount;
    return a.source.localeCompare(b.source);
  });

  return {
    totalInquiryCount: totalInquiries,
    totalCustomerCount: customers.length,
    totalTransactionCount: transactions.length,
    buckets,
    topSources: buckets.slice(0, 3).map((b) => b.source),
    unattributedTransactionCount,
  };
}

// ----------------------------------------------------------------------------
// Display helpers
// ----------------------------------------------------------------------------

const KRW_FORMATTER = new Intl.NumberFormat("ko-KR");

export function formatKRW(amount: number): string {
  return `₩${KRW_FORMATTER.format(Math.round(amount))}`;
}

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

export function formatCurrencyAmount(amount: number, currency: Currency): string {
  if (currency === "KRW") return formatKRW(amount);
  // 외화는 currency code prefix + 천단위 — 환율 컨텍스트가 별도 표기되므로
  // 여기서는 amount만 명확히.
  return `${currency} ${NUMBER_FORMATTER.format(Math.round(amount))}`;
}

/**
 * Status 한국어 라벨. "회계 확정" / "세무 신고 완료" 표현 금지 — 모두 시스템
 * 내부 상태 그대로의 의미만.
 */
export const INVOICE_STATUS_LABEL_KR: Record<InvoiceStatus, string> = {
  DRAFT: "초안",
  SENT: "발송",
  PAID: "결제 완료",
};

export const SETTLEMENT_STATUS_LABEL_KR: Record<SettlementStatus, string> = {
  PENDING: "대기",
  READY: "검토 중",
  COMPLETED: "정산 완료",
};

export const TAX_STATUS_LABEL_KR: Record<TaxRecordStatus, string> = {
  PENDING: "대기",
  READY: "검토 중",
  ISSUED: "발행",
};

// ----------------------------------------------------------------------------
// Time filter (STEP 35.5)
// ----------------------------------------------------------------------------

/**
 * Filter preset → resolved [startISO, endISO] range. ALL이면 null. CUSTOM이면
 * customStart/customEnd가 채워졌을 때만 range 반환, 미입력이면 null.
 *
 * THIS_MONTH / THIS_QUARTER는 `now` 기준. now는 옵션 (테스트용); 미입력 시
 * `new Date()`. 결과는 [start, end] 모두 포함 (inclusive).
 */
export function resolveTimeRange(
  filter: ReportingTimeFilter,
  now: Date = new Date()
): { start: string; end: string } | null {
  if (filter.preset === "ALL") return null;

  if (filter.preset === "CUSTOM") {
    if (!filter.customStart || !filter.customEnd) return null;
    return { start: filter.customStart, end: filter.customEnd };
  }

  // THIS_MONTH / THIS_QUARTER — local time month/quarter boundaries
  const y = now.getFullYear();
  const m = now.getMonth();

  if (filter.preset === "THIS_MONTH") {
    const start = formatLocalISODate(new Date(y, m, 1));
    const end = formatLocalISODate(new Date(y, m + 1, 0));
    return { start, end };
  }

  // THIS_QUARTER — Q1: 0-2, Q2: 3-5, Q3: 6-8, Q4: 9-11
  const qStart = Math.floor(m / 3) * 3;
  const start = formatLocalISODate(new Date(y, qStart, 1));
  const end = formatLocalISODate(new Date(y, qStart + 3, 0));
  return { start, end };
}

function formatLocalISODate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 라벨 — UI에 노출할 짧은 한국어. CUSTOM이고 양 날짜 비어 있으면 "사용자 지정"
 * 만 표시 (효력 없음).
 */
export function formatTimeFilterLabel(
  filter: ReportingTimeFilter,
  now: Date = new Date()
): string {
  if (filter.preset === "ALL") return "전체 기간";
  const range = resolveTimeRange(filter, now);
  if (!range) return "사용자 지정 (입력 필요)";
  if (filter.preset === "THIS_MONTH") {
    return `이번 달 · ${range.start} ~ ${range.end}`;
  }
  if (filter.preset === "THIS_QUARTER") {
    return `이번 분기 · ${range.start} ~ ${range.end}`;
  }
  return `${range.start} ~ ${range.end}`;
}

/**
 * Generic timestamp-based filter — `at`이 [start, end] 안이면 통과.
 * `at`은 ISO datetime ("2026-05-04T12:00:00Z"). start/end는 "YYYY-MM-DD".
 * Lexicographic 비교 — `at < start` 차단, `at.slice(0,10) > end` 차단.
 */
function inRange(at: string, start: string, end: string): boolean {
  if (at < start) return false;
  if (at.slice(0, 10) > end) return false;
  return true;
}

/**
 * Filter the three slices by time range. range가 null이면 그대로 반환 (no-op).
 */
export function filterByTimeRange(
  invoices: Invoice[],
  settlements: Settlement[],
  taxRecords: TaxRecord[],
  range: { start: string; end: string } | null
): { invoices: Invoice[]; settlements: Settlement[]; taxRecords: TaxRecord[] } {
  if (range === null) return { invoices, settlements, taxRecords };
  return {
    invoices: invoices.filter((i) => inRange(i.issuedAt, range.start, range.end)),
    settlements: settlements.filter((s) =>
      inRange(s.createdAt, range.start, range.end)
    ),
    taxRecords: taxRecords.filter((t) =>
      inRange(t.createdAt, range.start, range.end)
    ),
  };
}

/**
 * STEP 47 — Channel mix 입력의 time filter helper. inquiries / transactions
 * 모두 `createdAt` 기준 (Customer 도메인은 derive view라 별도 timestamp 없음).
 * range null이면 no-op.
 */
export function filterChannelInputByTimeRange(
  inquiries: Inquiry[],
  transactions: Transaction[],
  range: { start: string; end: string } | null
): { inquiries: Inquiry[]; transactions: Transaction[] } {
  if (range === null) return { inquiries, transactions };
  return {
    inquiries: inquiries.filter((i) =>
      inRange(i.createdAt, range.start, range.end)
    ),
    transactions: transactions.filter((t) =>
      inRange(t.createdAt, range.start, range.end)
    ),
  };
}

