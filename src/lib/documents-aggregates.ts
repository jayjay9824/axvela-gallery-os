// ============================================================================
// Documents Aggregates — STEP 51 (Documents Hub).
//
// 4개 문서 도메인 (Invoice / Contract / TaxRecord / ConditionReport)을 하나의
// 통합 검색 view로 묶기 위한 read-only flatten + filter helper.
//
// **설계 원칙:**
//   - rule_1 Artwork-First 보존: 문서는 여전히 작품 → 거래 흐름에서만 *생성/편집*.
//     본 모듈은 검색/조회 utility — 신규 생성 0건.
//   - 도메인 store / type 0줄 변경 — 모두 read-only consumer.
//   - 결정성 보장: 같은 입력 → 같은 출력.
//   - 시간 필터는 STEP 35.5 `ReportingTimeFilter` / `resolveTimeRange` 재사용.
//
// **표현 정책:**
//   - "문서 검색" / "운영 참고" 톤
//   - 항목 클릭 = 기존 detail drawer 재사용 — 신규 편집 UI 0개
// ============================================================================

import type { Invoice, InvoiceStatus } from "@/types/invoice";
// STEP 129 — PRE invoice drilldown 제외 (rule_3 Money Flow Separation)
import { getInvoiceKind } from "@/lib/invoice-helpers";
import type { Contract, ContractStatus } from "@/types/contract";
import type { TaxRecord, TaxRecordStatus } from "@/types/tax";
import type { ConditionReport, ConditionStatus, ReportType } from "@/types/condition-report";
import type { Artwork } from "@/types/artwork";
import type { Currency, Transaction } from "@/types/transaction";

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

export type DocumentDomain = "INVOICE" | "CONTRACT" | "TAX" | "CONDITION_REPORT";

/**
 * Document Hub의 단일 status 필터 옵션. 각 도메인의 status는 다르지만, 사용자
 * 관점에서는 "완료된 것만" / "작업중" / "전체" 3가지 view로 충분.
 *
 * - **completed**: LOCKED / SENT+ / PAID / ISSUED / signed=true 등 (immutable)
 * - **inprogress**: DRAFT / REVIEW / PENDING / READY (편집 가능)
 * - **all**: 모두
 */
export type DocumentStatusFilter = "all" | "completed" | "inprogress";

export interface DocumentRow {
  /** 도메인 식별 */
  domain: DocumentDomain;
  /** 원본 entity id (각 도메인 detail drawer 호출 시 사용) */
  entityId: string;
  /** UI 표시용 도메인 라벨 ("인보이스" / "계약서" / ...) */
  domainLabel: string;
  /** UI 표시용 status 라벨 (한국어) */
  statusLabel: string;
  /** rule_4 Document Trust — LOCKED / SENT 이상 → true */
  isLocked: boolean;
  /**
   * Status가 사용자 spec의 "완료" 카테고리에 속하는지. completed 필터 매칭용.
   */
  isCompleted: boolean;

  /** 시간 필터 + 정렬용 정렬 키 (ISO datetime). 도메인별 최적 필드 매핑. */
  primaryDate: string;
  /** UI 표시용 한국어 시점 라벨 ("발행일" / "서명일" / ...) */
  primaryDateLabel: string;

  /** 작품 컨텍스트 — 검색 / 라벨 표시용 */
  artworkId: string;
  artworkTitle: string;
  artistName: string;
  artworkAxidCode: string;

  /** 상위 거래 — 일부 도메인은 직접 보유, condition report는 logistics 경유 */
  transactionId: string;

  /** UI 표시용 부가 정보 — 도메인별 의미가 다름 */
  amountLabel: string | null;  // INVOICE/TAX 금액 (KRW 환산)
  versionLabel: string | null; // INVOICE/CONTRACT의 v1 / v2 / ...
  detailLabel: string | null;  // 기타 1줄 보조 정보 (e.g. tax type / report type)
}

export interface DocumentsAggregateInput {
  invoices: Record<string, Invoice[]>;
  contracts: Record<string, Contract[]>;
  taxRecords: Record<string, TaxRecord[]>;
  conditionReports: Record<string, ConditionReport[]>;
  /** Transaction lookup용 — Invoice는 artworkId 부재, transaction 경유 필요. */
  transactions: Record<string, Transaction[]>;
  artworks: Artwork[];
}

export interface DocumentsAggregateOptions {
  /** 도메인별 카운트는 항상 전체에서 — 탭 전환 UX */
  domainFilter: DocumentDomain | "all";
  statusFilter: DocumentStatusFilter;
  /** 작품 / 작가 / axid 부분 매칭 (lowercase substring) */
  textQuery: string;
  /** STEP 35.5 패턴 — null이면 전체 기간 */
  timeRange: { start: string; end: string } | null;
}

export interface DocumentsAggregateResult {
  /** 필터 통과한 row들 — primaryDate desc 정렬 */
  rows: DocumentRow[];
  /** 도메인별 전체 카운트 (탭 배지용 — 필터 전 / 후 모두 제공) */
  totalCountByDomain: Record<DocumentDomain, number>;
  filteredCountByDomain: Record<DocumentDomain, number>;
  /** 전체 row 수 (status / 텍스트 / 시간 필터 적용 후) — 탭 전환 무관 */
  totalFilteredCount: number;
}

// ----------------------------------------------------------------------------
// Public dispatcher
// ----------------------------------------------------------------------------

/**
 * 4 도메인을 flatten + filter + sort. 모든 도메인 store / type 0줄 변경.
 */
export function aggregateDocuments(
  input: DocumentsAggregateInput,
  options: DocumentsAggregateOptions
): DocumentsAggregateResult {
  const artworkLookup = new Map(input.artworks.map((a) => [a.id, a]));

  // Transaction → artworkId lookup (Invoice는 artworkId 부재 — 경유 필요)
  const txArtworkLookup = new Map<string, string>();
  for (const list of Object.values(input.transactions)) {
    for (const tx of list) {
      txArtworkLookup.set(tx.id, tx.artworkId);
    }
  }

  const allRows: DocumentRow[] = [];

  // 1. Flatten 4 domains → uniform rows
  // STEP 129 — PRE invoice (pro-forma) drilldown 행 제외. FINAL 만 노출.
  // rule_3 Money Flow Separation — PRE 는 informational, 운영 흐름 view 와 분리.
  // (briefing §2.2 file path deviation: drilldown-resolver.ts → documents-
  //  aggregates.ts 채택. resolveDocumentsHub 이 본 함수 호출하므로 동일 효과.)
  for (const list of Object.values(input.invoices)) {
    for (const inv of list) {
      if (getInvoiceKind(inv) !== "final") continue;
      const row = buildInvoiceRow(inv, artworkLookup, txArtworkLookup);
      if (row) allRows.push(row);
    }
  }
  for (const list of Object.values(input.contracts)) {
    for (const c of list) {
      const row = buildContractRow(c, artworkLookup);
      if (row) allRows.push(row);
    }
  }
  for (const list of Object.values(input.taxRecords)) {
    for (const t of list) {
      const row = buildTaxRow(t, artworkLookup);
      if (row) allRows.push(row);
    }
  }
  for (const list of Object.values(input.conditionReports)) {
    for (const cr of list) {
      const row = buildConditionReportRow(cr, artworkLookup);
      if (row) allRows.push(row);
    }
  }

  // 2. 도메인별 전체 카운트 (필터 전)
  const totalCountByDomain: Record<DocumentDomain, number> = {
    INVOICE: 0,
    CONTRACT: 0,
    TAX: 0,
    CONDITION_REPORT: 0,
  };
  for (const r of allRows) totalCountByDomain[r.domain] += 1;

  // 3. status / 텍스트 / 시간 필터 적용 — 도메인 필터는 별도 (탭 카운트 보존)
  const statusTimeTextFiltered = allRows.filter((r) => {
    if (options.statusFilter === "completed" && !r.isCompleted) return false;
    if (options.statusFilter === "inprogress" && r.isCompleted) return false;
    if (options.timeRange && !inRange(r.primaryDate, options.timeRange)) return false;
    if (options.textQuery.trim()) {
      const q = options.textQuery.trim().toLowerCase();
      const haystack = [
        r.artworkTitle,
        r.artistName,
        r.artworkAxidCode,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // 4. 도메인별 필터 후 카운트 (탭 배지 + "12 / 35"용)
  const filteredCountByDomain: Record<DocumentDomain, number> = {
    INVOICE: 0,
    CONTRACT: 0,
    TAX: 0,
    CONDITION_REPORT: 0,
  };
  for (const r of statusTimeTextFiltered) filteredCountByDomain[r.domain] += 1;

  // 5. 도메인 탭 필터 적용 (탭 클릭 시에만)
  const finalRows =
    options.domainFilter === "all"
      ? statusTimeTextFiltered
      : statusTimeTextFiltered.filter((r) => r.domain === options.domainFilter);

  // 6. 정렬 — primaryDate desc, tiebreak: domain 알파벳 asc → entityId asc
  finalRows.sort((a, b) => {
    if (b.primaryDate !== a.primaryDate)
      return b.primaryDate.localeCompare(a.primaryDate);
    if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
    return a.entityId.localeCompare(b.entityId);
  });

  return {
    rows: finalRows,
    totalCountByDomain,
    filteredCountByDomain,
    totalFilteredCount: statusTimeTextFiltered.length,
  };
}

// ----------------------------------------------------------------------------
// Public labels (UI 직접 사용)
// ----------------------------------------------------------------------------

export const DOCUMENT_DOMAIN_LABEL_KR: Record<DocumentDomain, string> = {
  INVOICE: "인보이스",
  CONTRACT: "계약서",
  TAX: "세금계산서",
  CONDITION_REPORT: "Condition Report",
};

export const DOCUMENT_STATUS_FILTER_LABEL_KR: Record<DocumentStatusFilter, string> = {
  all: "전체",
  completed: "완료 / LOCK",
  inprogress: "작업중",
};

// ----------------------------------------------------------------------------
// Internal — domain-specific row builders
// ----------------------------------------------------------------------------

const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "DRAFT",
  SENT: "발행 (SENT)",
  PAID: "지불 완료 (PAID)",
};

const INVOICE_COMPLETED: ReadonlySet<InvoiceStatus> = new Set(["SENT", "PAID"]);

function buildInvoiceRow(
  inv: Invoice,
  artworkLookup: Map<string, Artwork>,
  txArtworkLookup: Map<string, string>
): DocumentRow | null {
  const artworkId = txArtworkLookup.get(inv.transactionId) ?? "";
  const artwork = artworkId ? artworkLookup.get(artworkId) : undefined;
  const isCompleted = INVOICE_COMPLETED.has(inv.status);
  const primaryDate =
    inv.status === "PAID" && inv.paidAt
      ? inv.paidAt
      : inv.sentAt ?? inv.issuedAt;
  return {
    domain: "INVOICE",
    entityId: inv.id,
    domainLabel: DOCUMENT_DOMAIN_LABEL_KR.INVOICE,
    statusLabel: INVOICE_STATUS_LABEL[inv.status],
    isLocked: inv.isLocked,
    isCompleted,
    primaryDate,
    primaryDateLabel:
      inv.status === "PAID" ? "지불일" : inv.status === "SENT" ? "발행일" : "작성일",
    artworkId,
    artworkTitle: artwork?.title ?? "—",
    artistName: artwork?.artist.name ?? "—",
    artworkAxidCode: artwork?.axid.code ?? "—",
    transactionId: inv.transactionId,
    amountLabel: formatCurrency(inv.amount, inv.currency),
    versionLabel: `v${inv.version}`,
    detailLabel: null,
  };
}

const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  DRAFT: "DRAFT",
  REVIEW: "REVIEW",
  APPROVED: "APPROVED",
  LOCKED: "LOCKED",
};

const CONTRACT_COMPLETED: ReadonlySet<ContractStatus> = new Set([
  "APPROVED",
  "LOCKED",
]);

function buildContractRow(
  c: Contract,
  lookup: Map<string, Artwork>
): DocumentRow | null {
  const artwork = lookup.get(c.artworkId);
  const isCompleted = CONTRACT_COMPLETED.has(c.status);
  const primaryDate = c.lockedAt ?? c.updatedAt;
  return {
    domain: "CONTRACT",
    entityId: c.id,
    domainLabel: DOCUMENT_DOMAIN_LABEL_KR.CONTRACT,
    statusLabel: CONTRACT_STATUS_LABEL[c.status],
    isLocked: c.status === "LOCKED",
    isCompleted,
    primaryDate,
    primaryDateLabel: c.status === "LOCKED" ? "LOCK" : "최근 수정",
    artworkId: c.artworkId,
    artworkTitle: artwork?.title ?? "—",
    artistName: artwork?.artist.name ?? "—",
    artworkAxidCode: artwork?.axid.code ?? "—",
    transactionId: c.transactionId,
    amountLabel: null,
    versionLabel: `v${c.version}`,
    detailLabel: null,
  };
}

const TAX_STATUS_LABEL: Record<TaxRecordStatus, string> = {
  PENDING: "PENDING",
  READY: "READY",
  ISSUED: "ISSUED (발행)",
};

const TAX_COMPLETED: ReadonlySet<TaxRecordStatus> = new Set(["ISSUED"]);

function buildTaxRow(
  t: TaxRecord,
  lookup: Map<string, Artwork>
): DocumentRow | null {
  const artwork = lookup.get(t.artworkId);
  const isCompleted = TAX_COMPLETED.has(t.status);
  // tax는 발행일이 핵심 timestamp — fallback은 createdAt
  type WithIssued = TaxRecord & { issuedAt?: string; createdAt: string };
  const tw = t as WithIssued;
  const primaryDate = tw.issuedAt ?? tw.createdAt;
  return {
    domain: "TAX",
    entityId: t.id,
    domainLabel: DOCUMENT_DOMAIN_LABEL_KR.TAX,
    statusLabel: TAX_STATUS_LABEL[t.status],
    isLocked: t.status === "ISSUED",
    isCompleted,
    primaryDate,
    primaryDateLabel: t.status === "ISSUED" ? "발행일" : "작성일",
    artworkId: t.artworkId,
    artworkTitle: artwork?.title ?? "—",
    artistName: artwork?.artist.name ?? "—",
    artworkAxidCode: artwork?.axid.code ?? "—",
    transactionId: t.transactionId,
    amountLabel: formatCurrency(t.taxableAmount, t.currency),
    versionLabel: null,
    detailLabel: t.taxType,
  };
}

const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  BEFORE_SHIPMENT: "출고 전 검수",
  AFTER_DELIVERY: "도착 후 검수",
};

const CONDITION_STATUS_LABEL: Record<ConditionStatus, string> = {
  GOOD: "GOOD",
  WATCH: "WATCH",
  DAMAGED: "DAMAGED",
};

function buildConditionReportRow(
  cr: ConditionReport,
  lookup: Map<string, Artwork>
): DocumentRow | null {
  const artwork = lookup.get(cr.artworkId);
  // ConditionReport는 항상 immutable record (rule_4) — 모두 "completed"
  type WithMeta = ConditionReport & {
    isLocked?: boolean;
    lockedAt?: string;
    reportedAt?: string;
    createdAt: string;
  };
  const crw = cr as WithMeta;
  const primaryDate = crw.lockedAt ?? crw.reportedAt ?? crw.createdAt;
  return {
    domain: "CONDITION_REPORT",
    entityId: cr.id,
    domainLabel: DOCUMENT_DOMAIN_LABEL_KR.CONDITION_REPORT,
    statusLabel: CONDITION_STATUS_LABEL[cr.conditionStatus],
    isLocked: crw.isLocked ?? true,
    isCompleted: true,
    primaryDate,
    primaryDateLabel: "기록일",
    artworkId: cr.artworkId,
    artworkTitle: artwork?.title ?? "—",
    artistName: artwork?.artist.name ?? "—",
    artworkAxidCode: artwork?.axid.code ?? "—",
    transactionId: cr.transactionId,
    amountLabel: null,
    versionLabel: null,
    detailLabel: REPORT_TYPE_LABEL[cr.reportType],
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function inRange(at: string, range: { start: string; end: string }): boolean {
  return at >= range.start && at <= range.end;
}

const KRW_FMT = new Intl.NumberFormat("ko-KR");
const FX_FMT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function formatCurrency(amount: number, currency: Currency): string {
  if (currency === "KRW") return `₩${KRW_FMT.format(Math.round(amount))}`;
  return `${currency} ${FX_FMT.format(Math.round(amount))}`;
}
