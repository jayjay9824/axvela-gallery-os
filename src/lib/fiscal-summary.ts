// ============================================================================
// fiscal-summary.ts — STEP 88 VAT Summary Aggregate Layer
//
// **본 모듈이 무엇인가**:
//   기존 Invoice / Receipt / Settlement / TaxRecord / Transaction 데이터 위에
//   *derived aggregate view*만 계산하는 pure helper. 신규 entity 0개 / 신규
//   persistence 0개 / store dependency 0개.
//
// **본 모듈이 *아닌* 것**:
//   - 회계 ledger / accountant export (STEP 91 영역)
//   - 세무 신고 시스템 (영구 out-of-scope, AXVELA_AI_DIRECTION §1)
//   - government API 통합 (영구 out-of-scope)
//   - ERP 회계 모듈
//
// **Trust language 정책 (AXVELA_AI_DIRECTION + AXVELA_TRUST_LAYER 일관)**:
//   - 사용: "운영 참고" / "운영용 세무 흐름" / "발행 / 발급 기록" / "정산 준비" /
//     "미완료 거래 흐름"
//   - 금지: "VAT 신고" / "세무 신고 완료" / "국세청 발급" / "공인 인증" /
//     "법적 효력" / "compliance verified" / "tax filing"
//
// **Period 의미론** (사용자 spec §5):
//   - monthly  : 기준일 포함 달의 1일 00:00 ~ 마지막 날 23:59:59 (local TZ)
//   - quarterly: 기준일 포함 분기 시작 ~ 분기 종료
//   - yearly   : 기준일 포함 연도의 1/1 00:00 ~ 12/31 23:59:59
//
// **rule_3 Money Flow Separation 보존**:
//   Payment / Settlement / Tax / Receipt 별개 entity / 별개 chain — 본 aggregate는
//   *각 도메인 데이터를 별도 read*하여 *다른 column*으로 표시. 절대 cross-domain
//   amount 합산 0건 (예: Payment + Settlement + Tax 단일 숫자 절대 금지).
//
// **rule_20 FX Lock 보존**:
//   각 entity의 currency 그대로 유지. KRW 환산 0건 (Reporting 영역, STEP 35).
//   본 STEP은 *currency-aware* 분리 표시 (multi-currency 운영자 환경 대응).
// ============================================================================

import type { Invoice, InvoiceStatus } from "@/types/invoice";
// STEP 129 — PRE invoice fiscal 집계 제외 (rule_3 Money Flow Separation)
import { getInvoiceKind } from "@/lib/invoice-helpers";
import type { Receipt, ReceiptStatus } from "@/types/receipt";
import type { TaxInvoice, TaxInvoiceStatus } from "@/types/tax-invoice";
import type { Settlement, SettlementStatus } from "@/types/settlement";
import type { TaxRecord, TaxRecordStatus } from "@/types/tax";
import type { Transaction, Currency, TransactionStatus } from "@/types/transaction";

// ============================================================================
// Period semantics
// ============================================================================

export type FiscalPeriodKind = "monthly" | "quarterly" | "yearly";

export const FISCAL_PERIOD_LABEL_KR: Readonly<Record<FiscalPeriodKind, string>> =
  {
    monthly: "월간",
    quarterly: "분기",
    yearly: "연간",
  } as const;

export interface FiscalPeriodSelection {
  kind: FiscalPeriodKind;
  /** ISO datetime — anchor for period range. Defaults to "now" by callers. */
  referenceDate: string;
}

export interface FiscalDateRange {
  /** ISO datetime — inclusive start. */
  start: string;
  /** ISO datetime — inclusive end (set to 23:59:59.999 of last day). */
  end: string;
  /** Human-readable label, e.g. "2026년 5월" / "2026 Q2" / "2026년". */
  label: string;
}

/**
 * Compute inclusive datetime range for the given period selection. Pure /
 * timezone-aware (uses local TZ semantics — Korean operational context).
 */
export function computeFiscalPeriodRange(
  selection: FiscalPeriodSelection
): FiscalDateRange {
  const ref = new Date(selection.referenceDate);
  if (Number.isNaN(ref.getTime())) {
    // Fallback — return zero-span "today" centered on epoch start to avoid throws.
    return {
      start: new Date(0).toISOString(),
      end: new Date(0).toISOString(),
      label: "—",
    };
  }
  const year = ref.getFullYear();
  const month = ref.getMonth(); // 0-11

  if (selection.kind === "monthly") {
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      label: `${year}년 ${month + 1}월`,
    };
  }

  if (selection.kind === "quarterly") {
    const quarterIndex = Math.floor(month / 3); // 0..3
    const startMonth = quarterIndex * 3;
    const start = new Date(year, startMonth, 1, 0, 0, 0, 0);
    const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      label: `${year} Q${quarterIndex + 1}`,
    };
  }

  // yearly
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: `${year}년`,
  };
}

// ============================================================================
// Aggregate result
// ============================================================================

/**
 * Currency-grouped totals — rule_20 FX policy 보존 (KRW 환산 0건 in this
 * module). 운영자는 multi-currency 환경에서 *각 통화별*로 흐름을 본다.
 */
export interface FiscalSummaryCurrencyBucket {
  currency: Currency;
  /** 정산 준비 / 발행 완료 등을 무관하게, *발생한 transaction*의 currency 별 합계. */
  transactionAmount: number;
  /** 본 currency로 발행 완료된 영수증 합계. */
  receiptIssuedAmount: number;
  /** 본 currency로 발행 대기 (DRAFT) 영수증 합계. */
  receiptDraftAmount: number;
  /** 본 currency로 정산 준비 (PENDING/READY) Settlement 합계. */
  settlementReadyAmount: number;
  /**
   * STEP 89 — 본 currency로 발행 완료 (ISSUED) Tax Invoice의 *총액 합계*
   * (공급가액 + VAT). 본 STEP에서는 *기록*만 — cross-domain 합산 0건 (rule_3).
   */
  taxInvoiceIssuedAmount: number;
}

/**
 * 최근 fiscal activity event — recentActivity timeline용. *기존 store
 * timeline event*가 아니라 *fiscal aggregate 시점*의 활동만 추림.
 */
export interface FiscalActivityEntry {
  /** ISO datetime — 정렬 기준. */
  timestamp: string;
  kind:
    | "receipt_issued"
    | "receipt_send_prepared"
    | "settlement_completed"
    | "invoice_paid"
    | "tax_derived"
    | "tax_invoice_issued";
  /** Display label — Pretendard 한국어. */
  label: string;
  /** Optional amount — 금액이 의미 있는 event만. */
  amount?: number;
  currency?: Currency;
  /** Drilldown anchor — UI 클릭 시 사용. */
  relatedKind?: "receipt" | "settlement" | "invoice" | "tax" | "tax_invoice";
  relatedId?: string;
}

/**
 * **future-ready meta** (사용자 spec §4) — 본 STEP에서 의미 있는 값은 모두
 * 영구 상수. 미래 STEP (89~91)에서 fiscal entity 추가 시 본 슬롯에 *상태가
 * 변하는* 값이 들어옴. 본 STEP에서는 placeholder.
 */
export interface FiscalSummaryMeta {
  /** 운영자가 export 가능한 상태인가. v1: 항상 true (read-only aggregate). */
  exportReady: boolean;
  /**
   * 회계 sync 상태.
   * - "not_synced" (영구) — 본 STEP에서 항상 이 값
   * - 미래: STEP 91 정착 시 "synced" / "in_progress" 등 추가
   */
  accountingSyncState: "not_synced";
  /**
   * 세무 검토 상태.
   * - "operational_only" (영구) — 본 STEP은 운영 참고 only
   * - 미래: STEP 89 Tax Invoice 정착 시 "pending_review" 등 추가
   */
  vatReviewState: "operational_only";
  /**
   * Settlement Tax 상태.
   * - "not_applicable" (영구) — 본 STEP에서 항상 이 값
   * - 미래: STEP 90 정착 시 "pending" 등 추가
   */
  settlementTaxState: "not_applicable";
}

export interface FiscalSummaryAggregate {
  selection: FiscalPeriodSelection;
  range: FiscalDateRange;

  /** 상태 카운트 — *각 도메인 별 상태 분포*. cross-domain 합산 절대 0건. */
  counts: {
    transactions: {
      total: number;
      /** NEGOTIATING + AGREED — 미완료 거래 흐름 (operational pending). */
      pending: number;
      paid: number;
      settled: number;
      completed: number;
      cancelled: number;
    };
    invoices: Record<InvoiceStatus, number>;
    receipts: Record<ReceiptStatus, number>;
    settlements: Record<SettlementStatus, number>;
    taxRecords: Record<TaxRecordStatus, number>;
    /**
     * STEP 89 — Tax Invoice (전자세금계산서 운영 record) status 분포.
     * TaxRecord (운영 tax 트래킹)와 *별개 entity* — 본 카운트는 *문서 발행 상태*만.
     */
    taxInvoices: Record<TaxInvoiceStatus, number>;
  };

  /**
   * Currency-별 흐름 (rule_20 FX policy 보존). Empty array면 본 period에
   * activity 0건.
   */
  byCurrency: FiscalSummaryCurrencyBucket[];

  /**
   * 최근 fiscal activity — 본 period 내. 최신 → 과거 순 정렬, 최대 N건.
   * 본 STEP 기본 N=10.
   */
  recentActivity: FiscalActivityEntry[];

  /** Future-ready meta. 본 STEP에서는 영구 placeholder. */
  meta: FiscalSummaryMeta;
}

// ============================================================================
// Build aggregate — pure function
// ============================================================================

export interface FiscalSummaryInput {
  transactions: Transaction[];
  invoices: Invoice[];
  receipts: Receipt[];
  settlements: Settlement[];
  taxRecords: TaxRecord[];
  /** STEP 89 — Tax Invoices (옵셔널 input — STEP 89 정착 전 호출자는 미전달 가능). */
  taxInvoices?: TaxInvoice[];
  selection: FiscalPeriodSelection;
}

const RECENT_ACTIVITY_LIMIT = 10;

/**
 * Build fiscal summary aggregate from existing entity slices. Pure / no
 * side effects / no store / no DOM.
 *
 * **rule_3 Money Flow Separation strict**: 도메인별 amount는 별도 column.
 * 절대 cross-domain 단일 숫자 합산 0건.
 *
 * **rule_20 FX Lock**: 각 entity currency 그대로 표시 — KRW 환산은 본
 * 모듈 책임 외 (Reporting / STEP 35 영역).
 *
 * **운영 톤**: "발행 완료" / "발행 대기" / "정산 준비" / "미완료 거래 흐름"
 * 라벨 사용. "VAT 신고" / "공식 발급" 등 0건.
 */
export function buildFiscalSummaryAggregate(
  input: FiscalSummaryInput
): FiscalSummaryAggregate {
  const range = computeFiscalPeriodRange(input.selection);
  const startMs = new Date(range.start).getTime();
  const endMs = new Date(range.end).getTime();

  // ── 1. Transactions ────────────────────────────────────────────────────
  const txInRange = input.transactions.filter((t) => {
    // Use dealStartedAt → fall back to createdAt for ranging.
    const refIso = pickTransactionRangeAnchor(t);
    if (!refIso) return false;
    const ms = new Date(refIso).getTime();
    return ms >= startMs && ms <= endMs;
  });

  const txCounts = {
    total: txInRange.length,
    /** 협상 중 / 합의 완료 — 거래 흐름 진행 중 (operational pending). */
    pending: txInRange.filter(
      (t) => t.status === "NEGOTIATING" || t.status === "AGREED"
    ).length,
    /** 결제 수령 완료. */
    paid: txInRange.filter((t) => t.status === "PAID").length,
    /** 정산 완료. */
    settled: txInRange.filter((t) => t.status === "SETTLED").length,
    /** 거래 완료. */
    completed: txInRange.filter((t) => t.status === "COMPLETED").length,
    /** 취소. */
    cancelled: txInRange.filter((t) => t.status === "CANCELLED").length,
  };

  // ── 2. Invoices ────────────────────────────────────────────────────────
  // STEP 129 — PRE invoice (pro-forma) fiscal 집계 제외. FINAL 만 집계.
  // rule_3 Money Flow Separation — PRE 는 informational charge document
  // 이며 실제 money flow 부재.
  const invInRange = input.invoices.filter((i) => {
    if (getInvoiceKind(i) !== "final") return false;
    const refIso = i.paidAt ?? i.sentAt ?? i.issuedAt;
    if (!refIso) return false;
    const ms = new Date(refIso).getTime();
    return ms >= startMs && ms <= endMs;
  });

  const invCounts: Record<InvoiceStatus, number> = {
    DRAFT: 0,
    SENT: 0,
    PAID: 0,
  };
  invInRange.forEach((i) => {
    invCounts[i.status] = (invCounts[i.status] ?? 0) + 1;
  });

  // ── 3. Receipts ────────────────────────────────────────────────────────
  const receiptsInRange = input.receipts.filter((r) => {
    const refIso = r.finalizedAt ?? r.issuedAt;
    if (!refIso) return false;
    const ms = new Date(refIso).getTime();
    return ms >= startMs && ms <= endMs;
  });

  const receiptCounts: Record<ReceiptStatus, number> = {
    DRAFT: 0,
    ISSUED: 0,
  };
  receiptsInRange.forEach((r) => {
    receiptCounts[r.status] = (receiptCounts[r.status] ?? 0) + 1;
  });

  // ── 4. Settlements ─────────────────────────────────────────────────────
  const settlementsInRange = input.settlements.filter((s) => {
    const refIso = s.settledAt ?? s.createdAt;
    if (!refIso) return false;
    const ms = new Date(refIso).getTime();
    return ms >= startMs && ms <= endMs;
  });

  const settlementCounts: Record<SettlementStatus, number> = {
    PENDING: 0,
    READY: 0,
    COMPLETED: 0,
  };
  settlementsInRange.forEach((s) => {
    settlementCounts[s.status] = (settlementCounts[s.status] ?? 0) + 1;
  });

  // ── 5. Tax records ─────────────────────────────────────────────────────
  const taxInRange = input.taxRecords.filter((t) => {
    const refIso = t.issuedAt ?? t.createdAt;
    if (!refIso) return false;
    const ms = new Date(refIso).getTime();
    return ms >= startMs && ms <= endMs;
  });

  const taxCounts: Record<TaxRecordStatus, number> = {
    PENDING: 0,
    READY: 0,
    ISSUED: 0,
  };
  taxInRange.forEach((t) => {
    taxCounts[t.status] = (taxCounts[t.status] ?? 0) + 1;
  });

  // ── 5b. Tax invoices (STEP 89) ─────────────────────────────────────────
  // *옵셔널* input — STEP 89 정착 전 호출자는 미전달 가능.
  const taxInvoiceList = input.taxInvoices ?? [];
  const taxInvoicesInRange = taxInvoiceList.filter((ti) => {
    const refIso = ti.finalizedAt ?? ti.issuedAt;
    if (!refIso) return false;
    const ms = new Date(refIso).getTime();
    return ms >= startMs && ms <= endMs;
  });
  const taxInvoiceCounts: Record<TaxInvoiceStatus, number> = {
    DRAFT: 0,
    ISSUED: 0,
  };
  taxInvoicesInRange.forEach((ti) => {
    taxInvoiceCounts[ti.status] = (taxInvoiceCounts[ti.status] ?? 0) + 1;
  });

  // ── 6. Currency breakdown ──────────────────────────────────────────────
  const currencyMap = new Map<Currency, FiscalSummaryCurrencyBucket>();

  txInRange.forEach((t) => {
    const bucket = ensureBucket(currencyMap, t.currency);
    bucket.transactionAmount += t.agreedPrice ?? 0;
  });

  receiptsInRange.forEach((r) => {
    const bucket = ensureBucket(currencyMap, r.currency);
    if (r.status === "ISSUED") bucket.receiptIssuedAmount += r.amount;
    else if (r.status === "DRAFT") bucket.receiptDraftAmount += r.amount;
  });

  settlementsInRange.forEach((s) => {
    if (s.status === "COMPLETED") return; // "정산 준비"는 PENDING/READY만
    const bucket = ensureBucket(currencyMap, s.currency);
    bucket.settlementReadyAmount += s.totalAmount;
  });

  // STEP 89 — Tax Invoice 발행 완료 (ISSUED) totalAmount 누적. rule_3 보존
  // (별도 column으로만 표시, 다른 도메인과 합산 절대 0건).
  taxInvoicesInRange.forEach((ti) => {
    if (ti.status !== "ISSUED") return;
    const bucket = ensureBucket(currencyMap, ti.currency);
    bucket.taxInvoiceIssuedAmount += ti.totalAmount;
  });

  // Stable currency ordering — KRW first, USD second, 알파벳 순
  const byCurrency = [...currencyMap.values()].sort((a, b) => {
    if (a.currency === "KRW") return -1;
    if (b.currency === "KRW") return 1;
    if (a.currency === "USD") return -1;
    if (b.currency === "USD") return 1;
    return a.currency.localeCompare(b.currency);
  });

  // ── 7. Recent activity ─────────────────────────────────────────────────
  const activity: FiscalActivityEntry[] = [];

  receiptsInRange.forEach((r) => {
    if (r.status === "ISSUED" && r.finalizedAt) {
      activity.push({
        timestamp: r.finalizedAt,
        kind: "receipt_issued",
        label: "영수증 발행 완료",
        amount: r.amount,
        currency: r.currency,
        relatedKind: "receipt",
        relatedId: r.id,
      });
    }
    if (r.preparedForSendAt) {
      const prepMs = new Date(r.preparedForSendAt).getTime();
      if (prepMs >= startMs && prepMs <= endMs) {
        activity.push({
          timestamp: r.preparedForSendAt,
          kind: "receipt_send_prepared",
          label: "영수증 고객 발송 준비",
          amount: r.amount,
          currency: r.currency,
          relatedKind: "receipt",
          relatedId: r.id,
        });
      }
    }
  });

  settlementsInRange.forEach((s) => {
    if (s.status === "COMPLETED" && s.settledAt) {
      activity.push({
        timestamp: s.settledAt,
        kind: "settlement_completed",
        label: "정산 완료",
        amount: s.totalAmount,
        currency: s.currency,
        relatedKind: "settlement",
        relatedId: s.id,
      });
    }
  });

  invInRange.forEach((i) => {
    if (i.status === "PAID" && i.paidAt) {
      activity.push({
        timestamp: i.paidAt,
        kind: "invoice_paid",
        label: "인보이스 결제 완료",
        amount: i.amount,
        currency: i.currency,
        relatedKind: "invoice",
        relatedId: i.id,
      });
    }
  });

  taxInRange.forEach((t) => {
    if (t.createdAt) {
      const cMs = new Date(t.createdAt).getTime();
      if (cMs >= startMs && cMs <= endMs) {
        activity.push({
          timestamp: t.createdAt,
          kind: "tax_derived",
          label: "세무 record 생성",
          amount: t.taxableAmount,
          currency: t.currency,
          relatedKind: "tax",
          relatedId: t.id,
        });
      }
    }
  });

  // STEP 89 — Tax Invoice 발행 완료 activity
  taxInvoicesInRange.forEach((ti) => {
    if (ti.status === "ISSUED" && ti.finalizedAt) {
      activity.push({
        timestamp: ti.finalizedAt,
        kind: "tax_invoice_issued",
        label: "세금계산서 발행 완료",
        amount: ti.totalAmount,
        currency: ti.currency,
        relatedKind: "tax_invoice",
        relatedId: ti.id,
      });
    }
  });

  activity.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const recentActivity = activity.slice(0, RECENT_ACTIVITY_LIMIT);

  // ── 8. Meta ────────────────────────────────────────────────────────────
  const meta: FiscalSummaryMeta = {
    exportReady: true,
    accountingSyncState: "not_synced",
    vatReviewState: "operational_only",
    settlementTaxState: "not_applicable",
  };

  return {
    selection: input.selection,
    range,
    counts: {
      transactions: txCounts,
      invoices: invCounts,
      receipts: receiptCounts,
      settlements: settlementCounts,
      taxRecords: taxCounts,
      taxInvoices: taxInvoiceCounts,
    },
    byCurrency,
    recentActivity,
    meta,
  };
}

// ============================================================================
// Internal helpers
// ============================================================================

function ensureBucket(
  map: Map<Currency, FiscalSummaryCurrencyBucket>,
  currency: Currency
): FiscalSummaryCurrencyBucket {
  let bucket = map.get(currency);
  if (!bucket) {
    bucket = {
      currency,
      transactionAmount: 0,
      receiptIssuedAmount: 0,
      receiptDraftAmount: 0,
      settlementReadyAmount: 0,
      taxInvoiceIssuedAmount: 0,
    };
    map.set(currency, bucket);
  }
  return bucket;
}

function pickTransactionRangeAnchor(t: Transaction): string | null {
  // Transaction has only `createdAt` as the canonical anchor — `dealStartedAt`
  // does not exist on the entity. Future STEPs may add additional anchors;
  // for STEP 88 we use createdAt consistently for period filtering.
  return t.createdAt ?? null;
}

// ============================================================================
// Display helpers — purely formatting, no I/O
// ============================================================================

export const FISCAL_ACTIVITY_KIND_LABEL_KR: Readonly<
  Record<FiscalActivityEntry["kind"], string>
> = {
  receipt_issued: "영수증 발행",
  receipt_send_prepared: "영수증 발송 준비",
  settlement_completed: "정산 완료",
  invoice_paid: "결제 완료",
  tax_derived: "세무 record 생성",
  tax_invoice_issued: "세금계산서 발행",
} as const;

/**
 * 합계 표시용 — *Amount + Currency code*. KRW 환산 0건 (rule_20).
 *
 * 큰 자릿수에 콤마 분리 + 공백 + currency code (UI에서 secondary 톤).
 */
export function formatFiscalAmount(
  amount: number,
  currency: Currency
): string {
  const formatted = new Intl.NumberFormat("ko-KR").format(Math.round(amount));
  return `${formatted} ${currency}`;
}
