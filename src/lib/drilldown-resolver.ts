// ============================================================================
// Drilldown Resolver — STEP 67.
//
// Pure 함수 — `DrilldownPayload` + store state subset → `DrilldownResolverResult`.
// 도메인별 분기로 적절한 columns + rows + title + context를 만들어 drawer에 주입.
//
// **결정성**: 같은 입력 → 같은 결과. 모든 sort 기준 명시 (artworkId / id 등).
// **artwork-centric**: row.artworkId가 채워지는 도메인은 row 클릭 시 작품 navigate.
// **filter sync**: payload.periodFromIso / periodToIso로 reporting 기간 inherit.
// ============================================================================

import type { Artwork, ArtworkState } from "@/types/artwork";
import type { Transaction } from "@/types/transaction";
import type { Inquiry } from "@/types/inquiry";
import type { Invoice } from "@/types/invoice";
import type { Settlement } from "@/types/settlement";
import type { TaxRecord } from "@/types/tax";
import type { Contract } from "@/types/contract";
import type { Logistics } from "@/types/logistics";
import type { ConditionReport } from "@/types/condition-report";
import {
  AUDIT_CATEGORY_LABEL_KR,
  AUDIT_SEVERITY_LABEL_KR,
  type AuditCategory,
  type AuditSeverity,
  type SystemAuditEvent,
} from "@/types/audit-event";
import { deriveCustomers } from "@/lib/customer-aggregates";
import {
  aggregateDocuments,
  type DocumentDomain,
  type DocumentStatusFilter,
} from "@/lib/documents-aggregates";
import type {
  DrilldownPayload,
  DrilldownResolverResult,
  DrilldownRow,
  DrilldownColumn,
  DrilldownTone,
} from "@/types/drilldown";

// ----------------------------------------------------------------------------
// Inline label maps (도메인 type 모듈에 export된 상수가 없으므로 본 모듈에서
// 자체 보유 — 향후 공통 const로 승격 가능)
// ----------------------------------------------------------------------------

const STATE_LABEL_KR: Record<ArtworkState, string> = {
  DRAFT: "초안",
  READY: "판매 준비",
  INQUIRY: "문의 진행",
  DEAL: "거래 진행",
  PAID: "결제 완료",
  CLOSED: "거래 종료",
  REOPENED: "재오픈",
  BROKERED: "재판매 진행",
};

const LOGISTICS_STATUS_LABEL_KR: Record<Logistics["status"], string> = {
  READY_FOR_PICKUP: "출고 대기",
  IN_TRANSIT: "배송 중",
  DELIVERED: "도착 완료",
  CONDITION_CHECKED: "검수 완료",
};

// ----------------------------------------------------------------------------
// State subset — resolver가 필요로 하는 store 슬라이스만 외부에서 주입
// ----------------------------------------------------------------------------

export interface DrilldownStateSubset {
  artworks: ReadonlyArray<Artwork>;
  /** keyed by transactionId */
  logistics: Readonly<Record<string, ReadonlyArray<Logistics>>>;
  conditionReports: ReadonlyArray<ConditionReport>;
  transactions: ReadonlyArray<Transaction>;
  inquiries: ReadonlyArray<Inquiry>;
  invoices: ReadonlyArray<Invoice>;
  settlements: ReadonlyArray<Settlement>;
  taxRecords: ReadonlyArray<TaxRecord>;
  /** STEP 72 — Documents Hub drilldown용 */
  contracts: ReadonlyArray<Contract>;
  /** STEP 78 — System Audit Log drilldown용. 본 슬라이스는 *flat array*
   *  (다른 도메인의 grouped Record와 다름) — store가 이미 flat array로
   *  유지하므로 OperationalDrilldownDrawer에서 flatten 호출 0건. */
  auditEvents: ReadonlyArray<SystemAuditEvent>;
}

// ----------------------------------------------------------------------------
// Public — 단일 진입점
// ----------------------------------------------------------------------------

export function resolveDrilldown(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  switch (payload.domain) {
    case "artwork_state":
      return resolveArtworkState(payload, state);
    case "logistics_status":
      return resolveLogisticsStatus(payload, state);
    case "logistics_calendar_day":
      return resolveLogisticsCalendarDay(payload, state);
    case "logistics_awaiting_condition":
      return resolveLogisticsAwaitingCondition(payload, state);
    case "reporting_invoices":
      return resolveReportingInvoices(payload, state);
    case "reporting_settlements":
      return resolveReportingSettlements(payload, state);
    case "reporting_tax":
      return resolveReportingTax(payload, state);
    case "reporting_fx_converted":
      return resolveReportingFxConverted(payload, state);
    case "reporting_channel_inquiries":
      return resolveReportingChannelInquiries(payload, state);
    case "reporting_channel_customers":
      return resolveReportingChannelCustomers(payload, state);
    case "reporting_channel_deals":
      return resolveReportingChannelDeals(payload, state);
    case "reporting_currency_breakdown":
      return resolveReportingCurrencyBreakdown(payload, state);
    case "documents_all":
    case "documents_invoices":
    case "documents_contracts":
    case "documents_tax_records":
    case "documents_condition_reports":
      return resolveDocumentsHub(payload, state);
    case "customer_inquiries":
      return resolveCustomerInquiries(payload, state);
    case "customer_purchases":
      return resolveCustomerPurchases(payload, state);
    case "customer_owned_artworks":
      return resolveCustomerOwnedArtworks(payload, state);
    case "customer_segment":
      return resolveCustomerSegment(payload, state);
    case "customer_channel":
      return resolveCustomerChannel(payload, state);
    case "storage_with_image":
      return resolveStorageWithImage(state);
    case "storage_external":
      return resolveStorageExternal(state);
    case "storage_fallback":
      return resolveStorageFallback(state);
    case "storage_orphan":
      return resolveStorageOrphan(payload, state);
    case "audit_events":
    case "audit_category":
    case "audit_severity":
    case "audit_action":
      return resolveAuditEvents(payload, state);
  }
}

// ----------------------------------------------------------------------------
// Helpers — 결정성 sort + lookup
// ----------------------------------------------------------------------------

function buildArtworkLookup(
  artworks: ReadonlyArray<Artwork>
): Map<string, Artwork> {
  const map = new Map<string, Artwork>();
  for (const a of artworks) map.set(a.id, a);
  return map;
}

function buildTransactionLookup(
  transactions: ReadonlyArray<Transaction>
): Map<string, Transaction> {
  const map = new Map<string, Transaction>();
  for (const t of transactions) map.set(t.id, t);
  return map;
}

function isInPeriod(
  iso: string | undefined,
  fromIso?: string,
  toIso?: string
): boolean {
  if (!iso) return false;
  if (fromIso && iso < fromIso) return false;
  if (toIso && iso > toIso) return false;
  return true;
}

function flattenLogistics(
  logistics: Readonly<Record<string, ReadonlyArray<Logistics>>>
): Logistics[] {
  const all: Logistics[] = [];
  for (const list of Object.values(logistics)) {
    for (const log of list) all.push(log);
  }
  return all;
}

function pickLogisticsCalendarDate(log: Logistics): string | undefined {
  // STEP 58 우선순위와 일관: pickup > delivery > primary fallback
  if (log.pickupDate) return log.pickupDate.slice(0, 10);
  if (log.deliveryDate) return log.deliveryDate.slice(0, 10);
  return undefined;
}

function formatDateOnlyKR(iso: string | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function formatKRW(amount: number): string {
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

// ----------------------------------------------------------------------------
// Common columns
// ----------------------------------------------------------------------------

const ARTWORK_COL: DrilldownColumn = {
  key: "artwork",
  label: "작품",
  align: "left",
};

// ============================================================================
// Resolver impls
// ============================================================================

// ---- Artwork status drilldown ----------------------------------------------

function resolveArtworkState(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const target: ArtworkState | undefined = payload.artworkState;
  const filtered = target
    ? state.artworks.filter((a) => a.state === target)
    : state.artworks;

  const sorted = [...filtered].sort((a, b) => {
    if (a.updatedAt !== b.updatedAt)
      return a.updatedAt < b.updatedAt ? 1 : -1; // recent first
    return a.id.localeCompare(b.id);
  });

  const rows: DrilldownRow[] = sorted.map((a) => ({
    id: a.id,
    artworkId: a.id,
    cells: {
      artwork: {
        text: a.title,
        meta: a.axid?.code,
      },
      // STEP 74 — 작가 컬럼 분리 (sidebar status drilldown 사용자 spec)
      artist: { text: a.artist.name },
      state: {
        text: STATE_LABEL_KR[a.state],
        tone: artworkStateTone(a.state),
      },
      // STEP 74 — 가격 + 통화 (priceKRW만 보유 — KRW 고정 표기)
      price: {
        text: a.priceKRW > 0
          ? `₩${Math.round(a.priceKRW).toLocaleString("ko-KR")}`
          : "—",
      },
      currency: { text: "KRW" },
      updated: { text: formatDateOnlyKR(a.updatedAt), tone: "neutral" },
    },
  }));

  const columns: DrilldownColumn[] = [
    ARTWORK_COL,
    { key: "artist", label: "작가", align: "left", widthClass: "w-32" },
    { key: "state", label: "상태", align: "left", widthClass: "w-24" },
    { key: "price", label: "가격", align: "right", widthClass: "w-32" },
    { key: "currency", label: "통화", align: "left", widthClass: "w-16" },
    { key: "updated", label: "최근 변경", align: "right", widthClass: "w-28" },
  ];

  const stateLabel = target ? STATE_LABEL_KR[target] : "전체";
  return {
    title: `작품 상태 — ${stateLabel}`,
    context: `${rows.length}건 · 최근 변경순 · 작품 이동 가능`,
    columns,
    rows,
    emptyMessage: "해당 상태의 작품이 없습니다.",
  };
}

function artworkStateTone(state: ArtworkState): DrilldownTone {
  switch (state) {
    case "DRAFT":
      return "neutral";
    case "READY":
      return "info";
    case "INQUIRY":
      return "info";
    case "DEAL":
      return "warning";
    case "PAID":
      return "success";
    case "CLOSED":
      return "neutral";
    case "REOPENED":
      return "warning";
    case "BROKERED":
      return "info";
  }
}

// ---- Logistics status drilldown --------------------------------------------

function resolveLogisticsStatus(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const target = payload.logisticsStatus;
  const all = flattenLogistics(state.logistics);
  const filtered = target ? all.filter((l) => l.status === target) : all;

  return logisticsRowsToResult(
    filtered,
    state,
    `Logistics — ${target ? LOGISTICS_STATUS_LABEL_KR[target] : "전체"}`,
    `${filtered.length}건 · 픽업일 / 인도일 우선 정렬`
  );
}

// ---- Logistics calendar day drilldown --------------------------------------

function resolveLogisticsCalendarDay(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const targetDate = payload.isoDate;
  const all = flattenLogistics(state.logistics);
  const filtered = targetDate
    ? all.filter((l) => pickLogisticsCalendarDate(l) === targetDate)
    : [];

  return logisticsRowsToResult(
    filtered,
    state,
    `예정 일정 — ${targetDate ?? "—"}`,
    `${filtered.length}건 · 해당 날짜 픽업/인도 일정`
  );
}

// ---- Logistics awaiting condition (DELIVERED + AFTER 검수 부재) ------------

function resolveLogisticsAwaitingCondition(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const all = flattenLogistics(state.logistics);
  const reportSet = new Set(
    state.conditionReports
      .filter((r) => r.reportType === "AFTER_DELIVERY")
      .map((r) => r.logisticsId)
  );
  const filtered = all.filter(
    (l) => l.status === "DELIVERED" && !reportSet.has(l.id)
  );

  return logisticsRowsToResult(
    filtered,
    state,
    "검수 대기",
    `${filtered.length}건 · 인도 완료 후 AFTER 검수 보고서 부재`
  );
}

function logisticsRowsToResult(
  list: ReadonlyArray<Logistics>,
  state: DrilldownStateSubset,
  title: string,
  context: string
): DrilldownResolverResult {
  const artworkLookup = buildArtworkLookup(state.artworks);

  const sorted = [...list].sort((a, b) => {
    const ad = pickLogisticsCalendarDate(a) ?? "";
    const bd = pickLogisticsCalendarDate(b) ?? "";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  const rows: DrilldownRow[] = sorted.map((log) => {
    const artwork = artworkLookup.get(log.artworkId);
    return {
      id: log.id,
      artworkId: log.artworkId,
      cells: {
        artwork: {
          text: artwork?.title ?? "—",
          meta: artwork?.artist?.name,
        },
        status: {
          text: LOGISTICS_STATUS_LABEL_KR[log.status],
          tone: logisticsStatusTone(log.status),
        },
        pickup: {
          text: formatDateOnlyKR(log.pickupDate),
          tone: "neutral",
        },
        delivery: {
          text: formatDateOnlyKR(log.deliveryDate),
          tone: "neutral",
        },
        carrier: {
          text: log.carrierName.trim() || "—",
          meta: log.providerIsMock ? "mock" : log.providerId,
        },
      },
    };
  });

  const columns: DrilldownColumn[] = [
    ARTWORK_COL,
    { key: "status", label: "상태", align: "left", widthClass: "w-28" },
    { key: "pickup", label: "픽업", align: "left", widthClass: "w-24" },
    { key: "delivery", label: "인도", align: "left", widthClass: "w-24" },
    { key: "carrier", label: "carrier", align: "left", widthClass: "w-28" },
  ];

  return {
    title,
    context,
    columns,
    rows,
    emptyMessage: "조건에 맞는 logistics record가 없습니다.",
  };
}

function logisticsStatusTone(status: Logistics["status"]): DrilldownTone {
  switch (status) {
    case "READY_FOR_PICKUP":
      return "info";
    case "IN_TRANSIT":
      return "warning";
    case "DELIVERED":
      return "success";
    case "CONDITION_CHECKED":
      return "success";
  }
}

// ---- Reporting drilldowns --------------------------------------------------

function resolveReportingInvoices(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const txLookup = buildTransactionLookup(state.transactions);
  const artworkLookup = buildArtworkLookup(state.artworks);

  const filtered = state.invoices.filter((inv) =>
    isInPeriod(
      inv.sentAt ?? inv.issuedAt,
      payload.periodFromIso,
      payload.periodToIso
    )
  );

  const sorted = [...filtered].sort((a, b) => {
    const ad = a.sentAt ?? a.issuedAt;
    const bd = b.sentAt ?? b.issuedAt;
    if (ad !== bd) return ad < bd ? 1 : -1; // recent first
    return a.id.localeCompare(b.id);
  });

  const rows: DrilldownRow[] = sorted.map((inv) => {
    const tx = txLookup.get(inv.transactionId);
    const artwork = tx ? artworkLookup.get(tx.artworkId) : undefined;
    return {
      id: inv.id,
      artworkId: tx?.artworkId,
      cells: {
        artwork: {
          text: artwork?.title ?? "—",
          meta: artwork?.artist?.name,
        },
        status: {
          text: inv.status,
          tone: invoiceStatusTone(inv.status),
        },
        amount: {
          text: `${inv.currency} ${Math.round(inv.amount).toLocaleString(
            "ko-KR"
          )}`,
        },
        date: {
          text: formatDateOnlyKR(inv.sentAt ?? inv.issuedAt),
        },
      },
    };
  });

  return {
    title: "인보이스 운영 흐름",
    context: buildPeriodContext(rows.length, payload),
    columns: [
      ARTWORK_COL,
      { key: "status", label: "상태", align: "left", widthClass: "w-20" },
      { key: "amount", label: "금액", align: "right", widthClass: "w-32" },
      { key: "date", label: "발행/송부", align: "right", widthClass: "w-28" },
    ],
    rows,
    emptyMessage: "기간 내 인보이스가 없습니다.",
  };
}

function invoiceStatusTone(s: Invoice["status"]): DrilldownTone {
  switch (s) {
    case "DRAFT":
      return "neutral";
    case "SENT":
      return "warning";
    case "PAID":
      return "success";
  }
}

function resolveReportingSettlements(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const artworkLookup = buildArtworkLookup(state.artworks);

  const filtered = state.settlements.filter((s) =>
    isInPeriod(
      s.settledAt ?? s.createdAt,
      payload.periodFromIso,
      payload.periodToIso
    )
  );

  const sorted = [...filtered].sort((a, b) => {
    const ad = a.settledAt ?? a.createdAt;
    const bd = b.settledAt ?? b.createdAt;
    if (ad !== bd) return ad < bd ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  const rows: DrilldownRow[] = sorted.map((stl) => {
    const artwork = artworkLookup.get(stl.artworkId);
    return {
      id: stl.id,
      artworkId: stl.artworkId,
      cells: {
        artwork: {
          text: artwork?.title ?? "—",
          meta: artwork?.artist?.name,
        },
        status: {
          text: stl.status,
          tone:
            stl.status === "COMPLETED"
              ? "success"
              : stl.status === "READY"
                ? "warning"
                : "neutral",
        },
        artist: {
          text: `${stl.currency} ${Math.round(stl.artistShare).toLocaleString(
            "ko-KR"
          )}`,
        },
        gallery: {
          text: `${stl.currency} ${Math.round(stl.galleryShare).toLocaleString(
            "ko-KR"
          )}`,
        },
        date: {
          text: formatDateOnlyKR(stl.settledAt ?? stl.createdAt),
        },
      },
    };
  });

  return {
    title: "정산 운영 흐름",
    context: buildPeriodContext(rows.length, payload),
    columns: [
      ARTWORK_COL,
      { key: "status", label: "상태", align: "left", widthClass: "w-24" },
      { key: "artist", label: "아티스트", align: "right", widthClass: "w-32" },
      { key: "gallery", label: "갤러리", align: "right", widthClass: "w-32" },
      { key: "date", label: "정산일", align: "right", widthClass: "w-28" },
    ],
    rows,
    emptyMessage: "기간 내 정산 record가 없습니다.",
  };
}

function resolveReportingTax(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const artworkLookup = buildArtworkLookup(state.artworks);

  const filtered = state.taxRecords.filter((t) =>
    isInPeriod(
      t.issuedAt ?? t.createdAt,
      payload.periodFromIso,
      payload.periodToIso
    )
  );

  const sorted = [...filtered].sort((a, b) => {
    const ad = a.issuedAt ?? a.createdAt;
    const bd = b.issuedAt ?? b.createdAt;
    if (ad !== bd) return ad < bd ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  const rows: DrilldownRow[] = sorted.map((tx) => {
    const artwork = artworkLookup.get(tx.artworkId);
    return {
      id: tx.id,
      artworkId: tx.artworkId,
      cells: {
        artwork: {
          text: artwork?.title ?? "—",
          meta: artwork?.artist?.name,
        },
        type: { text: tx.taxType },
        status: {
          text: tx.status,
          tone: tx.status === "ISSUED" ? "success" : "warning",
        },
        amount: {
          text: `${tx.currency} ${Math.round(tx.taxableAmount).toLocaleString(
            "ko-KR"
          )}`,
          meta:
            tx.taxableAmountKRW !== undefined &&
            tx.currency !== "KRW"
              ? `≈ ${formatKRW(tx.taxableAmountKRW)}`
              : undefined,
        },
        date: { text: formatDateOnlyKR(tx.issuedAt ?? tx.createdAt) },
      },
    };
  });

  return {
    title: "세무 운영 흐름",
    context: buildPeriodContext(rows.length, payload),
    columns: [
      ARTWORK_COL,
      { key: "type", label: "type", align: "left", widthClass: "w-24" },
      { key: "status", label: "상태", align: "left", widthClass: "w-20" },
      { key: "amount", label: "과세표준", align: "right", widthClass: "w-36" },
      { key: "date", label: "발행", align: "right", widthClass: "w-28" },
    ],
    rows,
    emptyMessage: "기간 내 세무 record가 없습니다.",
  };
}

function resolveReportingFxConverted(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  // FX 환산 가능한 invoice — 외화 + fxSnapshot lock된 것만 (KRW invoice는 환산 불필요)
  const txLookup = buildTransactionLookup(state.transactions);
  const artworkLookup = buildArtworkLookup(state.artworks);

  const filtered = state.invoices.filter(
    (inv) =>
      inv.currency !== "KRW" &&
      inv.fxSnapshot !== undefined &&
      isInPeriod(
        inv.sentAt ?? inv.issuedAt,
        payload.periodFromIso,
        payload.periodToIso
      )
  );

  const sorted = [...filtered].sort((a, b) => {
    const ad = a.sentAt ?? a.issuedAt;
    const bd = b.sentAt ?? b.issuedAt;
    if (ad !== bd) return ad < bd ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  const rows: DrilldownRow[] = sorted.map((inv) => {
    const tx = txLookup.get(inv.transactionId);
    const artwork = tx ? artworkLookup.get(tx.artworkId) : undefined;
    const rate = inv.fxSnapshot?.rate ?? 0;
    const krw = Math.round(inv.amount * rate);
    return {
      id: inv.id,
      artworkId: tx?.artworkId,
      cells: {
        artwork: {
          text: artwork?.title ?? "—",
          meta: artwork?.artist?.name,
        },
        original: {
          text: `${inv.currency} ${Math.round(inv.amount).toLocaleString(
            "ko-KR"
          )}`,
        },
        krw: {
          text: formatKRW(krw),
        },
        rate: {
          text: rate > 0 ? rate.toFixed(2) : "—",
          meta: "lock 환율",
        },
        date: { text: formatDateOnlyKR(inv.sentAt ?? inv.issuedAt) },
      },
    };
  });

  return {
    title: "FX 환산 운영 흐름",
    context: buildPeriodContext(rows.length, payload),
    columns: [
      ARTWORK_COL,
      { key: "original", label: "원 통화", align: "right", widthClass: "w-28" },
      { key: "krw", label: "KRW 환산", align: "right", widthClass: "w-32" },
      { key: "rate", label: "환율", align: "right", widthClass: "w-24" },
      { key: "date", label: "송부", align: "right", widthClass: "w-28" },
    ],
    rows,
    emptyMessage: "기간 내 FX 환산 인보이스가 없습니다.",
  };
}

function buildPeriodContext(
  count: number,
  payload: DrilldownPayload
): string {
  const period =
    payload.periodFromIso || payload.periodToIso
      ? `기간: ${payload.periodFromIso?.slice(0, 10) ?? "처음"} ~ ${
          payload.periodToIso?.slice(0, 10) ?? "현재"
        }`
      : "전체 기간";
  return `${count}건 · ${period}${
    payload.contextLabel ? ` · ${payload.contextLabel}` : ""
  }`;
}

// ============================================================================
// STEP 70 — Channel Mix / Currency Breakdown drilldowns
// ============================================================================

// Inquiry source 라벨 — 본 모듈 자체 보유 (resolver localized).
const INQUIRY_SOURCE_LABEL_KR: Record<string, string> = {
  WEBSITE: "웹사이트",
  EMAIL: "이메일",
  SHOWROOM: "쇼룸",
  ART_FAIR: "아트페어",
  REFERRAL: "추천",
  COLLECTOR_VIEW: "Collector View",
};

function sourceLabel(source: string | undefined): string {
  if (!source) return "전체 채널";
  return INQUIRY_SOURCE_LABEL_KR[source] ?? source;
}

// First-touch attribution helper — Transaction의 직접 inquiryId가 비어있으면
// 같은 작품의 가장 이른 inquiry를 source로 매핑. STEP 47 computeChannelMix와
// 일관되는 로직 (단순 변형 — period filter는 본 함수 호출자가 처리).
function attributeTransactionSource(
  tx: Transaction,
  inquiriesByArtwork: Map<string, Inquiry[]>
): string | undefined {
  // 1. Direct inquiryId가 있고 해당 inquiry가 inquiries pool에 있으면 그것 사용
  if (tx.inquiryId) {
    const list = inquiriesByArtwork.get(tx.artworkId) ?? [];
    const direct = list.find((i) => i.id === tx.inquiryId);
    if (direct) return direct.source;
  }
  // 2. 같은 작품의 inquiry 중 가장 이른 createdAt → first-touch attribution
  const list = inquiriesByArtwork.get(tx.artworkId) ?? [];
  if (list.length === 0) return undefined;
  const sorted = [...list].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
  );
  return sorted[0].source;
}

// ---- reporting_channel_inquiries -------------------------------------------

function resolveReportingChannelInquiries(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const artworkLookup = buildArtworkLookup(state.artworks);
  const filtered = state.inquiries.filter(
    (i) =>
      isInPeriod(i.createdAt, payload.periodFromIso, payload.periodToIso) &&
      (!payload.source || i.source === payload.source)
  );

  const sorted = [...filtered].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  const rows: DrilldownRow[] = sorted.map((inq) => {
    const artwork = artworkLookup.get(inq.artworkId);
    return {
      id: inq.id,
      artworkId: inq.artworkId,
      cells: {
        artwork: {
          text: artwork?.title ?? "—",
          meta: artwork?.artist?.name,
        },
        customer: {
          text: inq.collectorName.trim() || "—",
        },
        source: {
          text: sourceLabel(inq.source),
          tone: "info",
        },
        status: {
          text: inq.status,
          tone: inquiryStatusTone(inq.status),
        },
        date: {
          text: formatDateOnlyKR(inq.createdAt),
        },
      },
    };
  });

  return {
    title: `Channel Mix — ${sourceLabel(payload.source)} · 문의`,
    context: buildPeriodContext(rows.length, payload),
    columns: [
      ARTWORK_COL,
      { key: "customer", label: "고객", align: "left", widthClass: "w-32" },
      { key: "source", label: "채널", align: "left", widthClass: "w-28" },
      { key: "status", label: "상태", align: "left", widthClass: "w-24" },
      { key: "date", label: "접수일", align: "right", widthClass: "w-28" },
    ],
    rows,
    emptyMessage: "조건에 맞는 문의가 없습니다.",
  };
}

function inquiryStatusTone(s: Inquiry["status"]): DrilldownTone {
  switch (s) {
    case "OPEN":
      return "info";
    case "RESPONDED":
      return "success";
    case "ON_HOLD":
      return "warning";
    case "ESCALATED":
      return "error";
    case "CLOSED":
      return "neutral";
  }
}

// ---- reporting_channel_customers -------------------------------------------

function resolveReportingChannelCustomers(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  // Customer는 derive — period filter 적용된 inquiry / transaction 기준.
  const periodInquiries = state.inquiries.filter((i) =>
    isInPeriod(i.createdAt, payload.periodFromIso, payload.periodToIso)
  );
  const periodTransactions = state.transactions.filter((t) =>
    isInPeriod(t.createdAt, payload.periodFromIso, payload.periodToIso)
  );

  // deriveCustomers의 invoicesByTxId 부재 — fxRate 환산 정보는 빈 lookup
  // (drilldown은 read-only 표시 — 정확한 KRW 환산은 reporting aggregates 책임).
  const customers = deriveCustomers(periodInquiries, periodTransactions, {});

  const filtered = payload.source
    ? customers.filter((c) => c.primarySource === payload.source)
    : customers;

  const sorted = [...filtered].sort((a, b) => {
    if (a.lastInteractionAt !== b.lastInteractionAt)
      return a.lastInteractionAt < b.lastInteractionAt ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  const artworkLookup = buildArtworkLookup(state.artworks);

  const rows: DrilldownRow[] = sorted.map((c) => {
    // 첫 번째 owned artwork — DetailPanel sync용 (없으면 row non-clickable)
    const linkedArtworkId = c.ownedArtworkIds[0];
    const linkedArtwork = linkedArtworkId
      ? artworkLookup.get(linkedArtworkId)
      : undefined;

    return {
      id: c.id,
      artworkId: linkedArtworkId,
      cells: {
        customer: {
          text: c.displayName,
          meta: c.primaryContact || undefined,
        },
        segment: {
          text: c.segment,
          tone: "info",
        },
        source: {
          text: sourceLabel(c.primarySource),
          tone: "neutral",
        },
        last: {
          text: formatDateOnlyKR(c.lastInteractionAt),
        },
        inquiries: {
          text: `${c.inquiryIds.length}건`,
        },
        purchases: {
          text: `${c.transactionIds.length}건`,
          meta: linkedArtwork?.title,
        },
      },
    };
  });

  return {
    title: `Channel Mix — ${sourceLabel(payload.source)} · 고객`,
    context: buildPeriodContext(rows.length, payload),
    columns: [
      { key: "customer", label: "고객", align: "left" },
      { key: "segment", label: "segment", align: "left", widthClass: "w-28" },
      { key: "source", label: "primary 채널", align: "left", widthClass: "w-28" },
      { key: "last", label: "최근 활동", align: "right", widthClass: "w-28" },
      { key: "inquiries", label: "문의", align: "right", widthClass: "w-16" },
      {
        key: "purchases",
        label: "거래",
        align: "right",
        widthClass: "w-28",
      },
    ],
    rows,
    emptyMessage: "조건에 맞는 고객이 없습니다.",
  };
}

// ---- reporting_channel_deals -----------------------------------------------

function resolveReportingChannelDeals(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  // First-touch attribution — 같은 작품의 inquiry pool로 매핑.
  // 본 함수는 state.inquiries 전체 (period filter 무관)를 attribution pool로 사용 —
  // 채널 추정은 첫 inquiry까지 거슬러야 하므로 period 제한은 transaction에만 적용.
  const inquiriesByArtwork = new Map<string, Inquiry[]>();
  for (const inq of state.inquiries) {
    const list = inquiriesByArtwork.get(inq.artworkId) ?? [];
    list.push(inq);
    inquiriesByArtwork.set(inq.artworkId, list);
  }

  const artworkLookup = buildArtworkLookup(state.artworks);

  // Invoice lookup by transactionId — row의 invoice link 노출용.
  const invoiceByTx = new Map<string, Invoice>();
  for (const inv of state.invoices) {
    // 같은 transactionId 중 최신 (sentAt > issuedAt)을 우선 보존
    const existing = invoiceByTx.get(inv.transactionId);
    if (!existing) {
      invoiceByTx.set(inv.transactionId, inv);
    } else {
      const existingDate = existing.sentAt ?? existing.issuedAt;
      const incomingDate = inv.sentAt ?? inv.issuedAt;
      if (incomingDate > existingDate) invoiceByTx.set(inv.transactionId, inv);
    }
  }

  const filtered = state.transactions.filter((tx) => {
    if (!isInPeriod(tx.createdAt, payload.periodFromIso, payload.periodToIso))
      return false;
    if (!payload.source) return true;
    const attributed = attributeTransactionSource(tx, inquiriesByArtwork);
    return attributed === payload.source;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  const rows: DrilldownRow[] = sorted.map((tx) => {
    const artwork = artworkLookup.get(tx.artworkId);
    const attributed = attributeTransactionSource(tx, inquiriesByArtwork);
    const invoice = invoiceByTx.get(tx.id);
    return {
      id: tx.id,
      artworkId: tx.artworkId,
      cells: {
        artwork: {
          text: artwork?.title ?? "—",
          meta: artwork?.artist?.name,
        },
        customer: {
          text: tx.buyerName.trim() || "—",
        },
        amount: {
          text: `${tx.currency} ${Math.round(tx.agreedPrice).toLocaleString(
            "ko-KR"
          )}`,
        },
        source: {
          text: sourceLabel(attributed),
          tone: attributed ? "info" : "neutral",
          meta: attributed ? "first-touch" : "attribution 불가",
        },
        status: {
          text: tx.status,
          tone: transactionStatusTone(tx.status),
        },
        invoice: {
          text: invoice ? invoice.status : "—",
          tone: invoice ? invoiceStatusTone(invoice.status) : "neutral",
        },
      },
    };
  });

  return {
    title: `Channel Mix — ${sourceLabel(payload.source)} · 거래`,
    context: buildPeriodContext(rows.length, payload),
    columns: [
      ARTWORK_COL,
      { key: "customer", label: "고객", align: "left", widthClass: "w-28" },
      { key: "amount", label: "금액", align: "right", widthClass: "w-32" },
      { key: "source", label: "채널", align: "left", widthClass: "w-32" },
      { key: "status", label: "상태", align: "left", widthClass: "w-24" },
      { key: "invoice", label: "invoice", align: "left", widthClass: "w-20" },
    ],
    rows,
    emptyMessage: "조건에 맞는 거래가 없습니다.",
  };
}

function transactionStatusTone(s: Transaction["status"]): DrilldownTone {
  switch (s) {
    case "NEGOTIATING":
      return "warning";
    case "AGREED":
      return "info";
    case "PAID":
      return "success";
    case "SETTLED":
      return "success";
    case "COMPLETED":
      return "neutral";
    case "CANCELLED":
      return "error";
  }
}

// ---- reporting_currency_breakdown ------------------------------------------

function resolveReportingCurrencyBreakdown(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const txLookup = buildTransactionLookup(state.transactions);
  const artworkLookup = buildArtworkLookup(state.artworks);

  const filtered = state.invoices.filter(
    (inv) =>
      (!payload.currency || inv.currency === payload.currency) &&
      isInPeriod(
        inv.sentAt ?? inv.issuedAt,
        payload.periodFromIso,
        payload.periodToIso
      )
  );

  const sorted = [...filtered].sort((a, b) => {
    const ad = a.sentAt ?? a.issuedAt;
    const bd = b.sentAt ?? b.issuedAt;
    if (ad !== bd) return ad < bd ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  const rows: DrilldownRow[] = sorted.map((inv) => {
    const tx = txLookup.get(inv.transactionId);
    const artwork = tx ? artworkLookup.get(tx.artworkId) : undefined;
    // KRW 환산 — KRW invoice는 amount 그대로, 외화 + fxSnapshot 있으면 곱.
    let krwText = "—";
    let krwMeta: string | undefined;
    if (inv.currency === "KRW") {
      krwText = formatKRW(inv.amount);
    } else if (inv.fxSnapshot) {
      const krw = inv.amount * inv.fxSnapshot.rate;
      krwText = formatKRW(krw);
      krwMeta = `@ ${inv.fxSnapshot.rate.toFixed(2)}`;
    } else {
      krwText = "—";
      krwMeta = "환산 정보 부족";
    }
    return {
      id: inv.id,
      artworkId: tx?.artworkId,
      cells: {
        artwork: {
          text: artwork?.title ?? "—",
          meta: artwork?.artist?.name,
        },
        customer: {
          text: tx?.buyerName?.trim() || "—",
        },
        amount: {
          text: `${inv.currency} ${Math.round(inv.amount).toLocaleString(
            "ko-KR"
          )}`,
        },
        krw: {
          text: krwText,
          meta: krwMeta,
          tone: !inv.fxSnapshot && inv.currency !== "KRW" ? "warning" : "neutral",
        },
        status: {
          text: inv.status,
          tone: invoiceStatusTone(inv.status),
        },
        date: {
          text: formatDateOnlyKR(inv.sentAt ?? inv.issuedAt),
        },
      },
    };
  });

  const titleSuffix = payload.currency ? `${payload.currency}` : "전체 통화";
  return {
    title: `통화 기준 · ${titleSuffix}`,
    context: buildPeriodContext(rows.length, payload),
    columns: [
      ARTWORK_COL,
      { key: "customer", label: "고객", align: "left", widthClass: "w-28" },
      { key: "amount", label: "통화 단위", align: "right", widthClass: "w-32" },
      { key: "krw", label: "KRW 환산", align: "right", widthClass: "w-36" },
      { key: "status", label: "상태", align: "left", widthClass: "w-20" },
      { key: "date", label: "발행/송부", align: "right", widthClass: "w-28" },
    ],
    rows,
    emptyMessage: "조건에 맞는 인보이스가 없습니다.",
  };
}

// ============================================================================
// STEP 72 — Documents Hub drilldown
// ============================================================================

// Drilldown domain → DocumentDomain 매핑 (또는 "all")
function mapDocumentsDomain(
  domain: DrilldownPayload["domain"]
): DocumentDomain | "all" {
  switch (domain) {
    case "documents_invoices":
      return "INVOICE";
    case "documents_contracts":
      return "CONTRACT";
    case "documents_tax_records":
      return "TAX";
    case "documents_condition_reports":
      return "CONDITION_REPORT";
    case "documents_all":
    default:
      return "all";
  }
}

// Flat array → grouped Record<id, T[]> (aggregateDocuments 기대 형식)
function groupBy<T extends { artworkId?: string }>(
  list: ReadonlyArray<T>
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of list) {
    const key = item.artworkId ?? "__no_artwork__";
    if (!out[key]) out[key] = [];
    out[key].push(item);
  }
  return out;
}
function groupByTransactionId<T extends { transactionId: string }>(
  list: ReadonlyArray<T>
): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of list) {
    const key = item.transactionId;
    if (!out[key]) out[key] = [];
    out[key].push(item);
  }
  return out;
}

function isCompletedTone(isCompleted: boolean): DrilldownTone {
  return isCompleted ? "success" : "warning";
}

function resolveDocumentsHub(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const targetDomain = mapDocumentsDomain(payload.domain);
  const status = (payload.documentStatus ?? "all") as DocumentStatusFilter;
  const textQuery = payload.searchQuery ?? "";

  // resolver의 state subset (flat) → aggregateDocuments 기대 (grouped Record)
  // 변환. Invoice는 transactionId-keyed, others는 artworkId-keyed (관행).
  const result = aggregateDocuments(
    {
      invoices: groupByTransactionId(state.invoices),
      contracts: groupBy(state.contracts),
      taxRecords: groupBy(state.taxRecords),
      conditionReports: groupBy(state.conditionReports),
      transactions: groupBy(state.transactions),
      artworks: [...state.artworks],
    },
    {
      domainFilter: targetDomain,
      statusFilter: status,
      textQuery,
      timeRange:
        payload.periodFromIso && payload.periodToIso
          ? { start: payload.periodFromIso, end: payload.periodToIso }
          : null,
    }
  );

  // 도메인별 columns 분기 — domain 컬럼은 "all"일 때만 노출
  const showDomainCol = targetDomain === "all";
  const columns: DrilldownColumn[] = showDomainCol
    ? [
        ARTWORK_COL,
        { key: "domain", label: "구분", align: "left", widthClass: "w-24" },
        { key: "status", label: "상태", align: "left", widthClass: "w-28" },
        { key: "amount", label: "금액", align: "right", widthClass: "w-32" },
        { key: "date", label: "일자", align: "right", widthClass: "w-28" },
      ]
    : [
        ARTWORK_COL,
        { key: "status", label: "상태", align: "left", widthClass: "w-28" },
        { key: "amount", label: "금액", align: "right", widthClass: "w-32" },
        { key: "version", label: "버전", align: "left", widthClass: "w-20" },
        { key: "detail", label: "비고", align: "left", widthClass: "w-32" },
        { key: "date", label: "일자", align: "right", widthClass: "w-28" },
      ];

  const rows: DrilldownRow[] = result.rows.map((r) => ({
    id: `${r.domain}-${r.entityId}`,
    artworkId: r.artworkId,
    cells: {
      artwork: {
        text: r.artworkTitle || r.artworkAxidCode,
        meta: r.artistName,
      },
      domain: { text: r.domainLabel, tone: "info" },
      status: {
        text: r.statusLabel,
        tone: isCompletedTone(r.isCompleted),
        meta: r.isLocked ? "LOCK" : undefined,
      },
      amount: r.amountLabel ? { text: r.amountLabel } : { text: "—" },
      version: r.versionLabel ? { text: r.versionLabel } : { text: "—" },
      detail: r.detailLabel ? { text: r.detailLabel } : { text: "—" },
      date: {
        text: formatDateOnlyKR(r.primaryDate),
        meta: r.primaryDateLabel,
      },
    },
  }));

  // Title — domain별 라벨 + 컨텍스트
  const domainLabel: Record<DocumentDomain | "all", string> = {
    all: "전체",
    INVOICE: "인보이스",
    CONTRACT: "계약서",
    TAX: "세무 기록",
    CONDITION_REPORT: "검수 보고서",
  };
  const statusLabel: Record<DocumentStatusFilter, string> = {
    all: "전체",
    completed: "완료/LOCK",
    inprogress: "작업중",
  };

  const ctxBits: string[] = [];
  if (payload.periodFromIso || payload.periodToIso) {
    ctxBits.push(
      `기간: ${payload.periodFromIso?.slice(0, 10) ?? "처음"} ~ ${
        payload.periodToIso?.slice(0, 10) ?? "현재"
      }`
    );
  } else {
    ctxBits.push("전체 기간");
  }
  if (status !== "all") ctxBits.push(`상태: ${statusLabel[status]}`);
  if (textQuery.trim()) ctxBits.push(`검색: "${textQuery.trim()}"`);

  return {
    title: `문서 상세 — ${domainLabel[targetDomain]}`,
    context: `${rows.length}건 · ${ctxBits.join(" · ")}`,
    columns,
    rows,
    emptyMessage: "조건에 맞는 문서가 없습니다.",
  };
}

// ============================================================================
// STEP 73 — Customer drilldown
// ============================================================================

// Inline label — segment / kind / source 한국어 (resolver localized)
const CUSTOMER_SEGMENT_LABEL_KR: Record<string, string> = {
  PROSPECT: "문의",
  ONE_TIME_BUYER: "1회",
  REPEAT_BUYER: "반복",
  DORMANT: "휴면",
};
function segmentLabel(s: string | undefined): string {
  if (!s) return "전체 segment";
  return CUSTOMER_SEGMENT_LABEL_KR[s] ?? s;
}

function customerSegmentTone(s: string): DrilldownTone {
  switch (s) {
    case "REPEAT_BUYER":
      return "success";
    case "ONE_TIME_BUYER":
      return "info";
    case "PROSPECT":
      return "warning";
    case "DORMANT":
      return "neutral";
    default:
      return "neutral";
  }
}

// 본 store 슬라이스에서 customer를 derive — Customer는 derived entity.
// drilldown은 read-only display, 정확한 KRW 환산은 reporting 책임 — fxLookup 빈 객체.
function deriveCustomersFromState(
  state: DrilldownStateSubset
): import("@/types/customer").Customer[] {
  return deriveCustomers(
    [...state.inquiries],
    [...state.transactions],
    {}
  );
}

// 특정 customerId의 Customer 1건 lookup
function lookupCustomer(
  customerId: string,
  state: DrilldownStateSubset
): import("@/types/customer").Customer | undefined {
  const all = deriveCustomersFromState(state);
  return all.find((c) => c.id === customerId);
}

// ---- customer_inquiries ----------------------------------------------------

function resolveCustomerInquiries(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const artworkLookup = buildArtworkLookup(state.artworks);
  const customer = payload.customerId
    ? lookupCustomer(payload.customerId, state)
    : undefined;

  // 고객 식별 — id가 있으면 inquiryIds 직접 매칭, 부재 시 빈 결과
  const inquiryIdSet = new Set(customer?.inquiryIds ?? []);
  const filtered = customer
    ? state.inquiries.filter((i) => inquiryIdSet.has(i.id))
    : [];

  const sorted = [...filtered].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  const rows: DrilldownRow[] = sorted.map((inq) => {
    const artwork = artworkLookup.get(inq.artworkId);
    return {
      id: inq.id,
      artworkId: inq.artworkId,
      // STEP 124 — Entity-direct detail. 사용자 spec — "문의 클릭 → 내용
      // 확인". 작품 navigate (artworkId fallback) 보다 inquiry detail 자체가
      // 1차 의도. handleRowClick 이 detailKind 우선 처리.
      detailKind: "inquiry" as const,
      detailId: inq.id,
      cells: {
        artwork: {
          text: artwork?.title ?? "—",
          meta: artwork?.artist?.name,
        },
        source: { text: sourceLabel(inq.source), tone: "info" },
        status: { text: inq.status, tone: inquiryStatusTone(inq.status) },
        date: { text: formatDateOnlyKR(inq.createdAt) },
      },
    };
  });

  const customerLabel =
    customer?.displayName ?? payload.customerName ?? "—";
  return {
    title: `고객 상세 — ${customerLabel} · 연결 문의`,
    context: customer
      ? `${rows.length}건 · 행을 클릭하면 문의 상세 열림`
      : "고객 식별 정보 부재 — 결과 없음",
    columns: [
      ARTWORK_COL,
      { key: "source", label: "채널", align: "left", widthClass: "w-28" },
      { key: "status", label: "상태", align: "left", widthClass: "w-24" },
      { key: "date", label: "접수일", align: "right", widthClass: "w-28" },
    ],
    rows,
    emptyMessage: "연결 문의가 없습니다.",
  };
}

// ---- customer_purchases ----------------------------------------------------

function resolveCustomerPurchases(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const artworkLookup = buildArtworkLookup(state.artworks);
  const customer = payload.customerId
    ? lookupCustomer(payload.customerId, state)
    : undefined;

  const txIdSet = new Set(customer?.transactionIds ?? []);
  const filtered = customer
    ? state.transactions.filter((t) => txIdSet.has(t.id))
    : [];

  // Invoice lookup by transactionId — row의 invoice link 노출
  const invoiceByTx = new Map<string, Invoice>();
  for (const inv of state.invoices) {
    const existing = invoiceByTx.get(inv.transactionId);
    if (!existing) {
      invoiceByTx.set(inv.transactionId, inv);
    } else {
      const existingDate = existing.sentAt ?? existing.issuedAt;
      const incomingDate = inv.sentAt ?? inv.issuedAt;
      if (incomingDate > existingDate) invoiceByTx.set(inv.transactionId, inv);
    }
  }

  const sorted = [...filtered].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  const rows: DrilldownRow[] = sorted.map((tx) => {
    const artwork = artworkLookup.get(tx.artworkId);
    const invoice = invoiceByTx.get(tx.id);
    return {
      id: tx.id,
      artworkId: tx.artworkId,
      cells: {
        artwork: {
          text: artwork?.title ?? "—",
          meta: artwork?.artist?.name,
        },
        amount: {
          text: `${tx.currency} ${Math.round(tx.agreedPrice).toLocaleString(
            "ko-KR"
          )}`,
        },
        status: { text: tx.status, tone: transactionStatusTone(tx.status) },
        invoice: {
          text: invoice ? invoice.status : "—",
          tone: invoice ? invoiceStatusTone(invoice.status) : "neutral",
        },
        date: { text: formatDateOnlyKR(tx.createdAt) },
      },
    };
  });

  const customerLabel =
    customer?.displayName ?? payload.customerName ?? "—";
  return {
    title: `고객 상세 — ${customerLabel} · 연결 거래`,
    context: customer
      ? `${rows.length}건 · 작품 이동 가능`
      : "고객 식별 정보 부재 — 결과 없음",
    columns: [
      ARTWORK_COL,
      { key: "amount", label: "금액", align: "right", widthClass: "w-32" },
      { key: "status", label: "상태", align: "left", widthClass: "w-28" },
      { key: "invoice", label: "invoice", align: "left", widthClass: "w-20" },
      { key: "date", label: "거래일", align: "right", widthClass: "w-28" },
    ],
    rows,
    emptyMessage: "연결 거래가 없습니다.",
  };
}

// ---- customer_owned_artworks -----------------------------------------------

function resolveCustomerOwnedArtworks(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const artworkLookup = buildArtworkLookup(state.artworks);
  const customer = payload.customerId
    ? lookupCustomer(payload.customerId, state)
    : undefined;

  // Acquisition date 추정 — customer transactionIds 중 해당 작품 거래의 가장
  // 이른 createdAt 사용. 같은 작품 여러 거래가 있을 수 있어 first-touch 기준.
  const customerTxs = customer
    ? state.transactions.filter((t) =>
        customer.transactionIds.includes(t.id)
      )
    : [];
  const acqDateByArtwork = new Map<string, string>();
  for (const tx of customerTxs) {
    const existing = acqDateByArtwork.get(tx.artworkId);
    if (!existing || tx.createdAt < existing) {
      acqDateByArtwork.set(tx.artworkId, tx.createdAt);
    }
  }

  const owned = customer ? customer.ownedArtworkIds : [];
  // sort — 최근 acquisition 우선
  const sorted = [...owned].sort((a, b) => {
    const ad = acqDateByArtwork.get(a) ?? "";
    const bd = acqDateByArtwork.get(b) ?? "";
    if (ad !== bd) return ad < bd ? 1 : -1;
    return a.localeCompare(b);
  });

  const rows: DrilldownRow[] = sorted.map((artworkId) => {
    const artwork = artworkLookup.get(artworkId);
    const acqDate = acqDateByArtwork.get(artworkId);
    return {
      id: artworkId,
      artworkId,
      cells: {
        artwork: {
          text: artwork?.title ?? "—",
          meta: artwork?.artist?.name,
        },
        artist: { text: artwork?.artist?.name ?? "—" },
        state: artwork
          ? {
              text: STATE_LABEL_KR[artwork.state],
              tone: artworkStateTone(artwork.state),
            }
          : { text: "—" },
        acq: {
          text: acqDate ? formatDateOnlyKR(acqDate) : "—",
          meta: acqDate ? "획득 시점" : undefined,
        },
      },
    };
  });

  const customerLabel =
    customer?.displayName ?? payload.customerName ?? "—";
  return {
    title: `고객 상세 — ${customerLabel} · 보유 작품`,
    context: customer
      ? `${rows.length}점 · 거래 기준 derived`
      : "고객 식별 정보 부재 — 결과 없음",
    columns: [
      ARTWORK_COL,
      { key: "artist", label: "작가", align: "left", widthClass: "w-32" },
      { key: "state", label: "작품 상태", align: "left", widthClass: "w-28" },
      { key: "acq", label: "획득일", align: "right", widthClass: "w-28" },
    ],
    rows,
    emptyMessage: "보유 작품이 없습니다.",
  };
}

// ---- customer_segment ------------------------------------------------------

function resolveCustomerSegment(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const customers = deriveCustomersFromState(state);
  const filtered = payload.segment
    ? customers.filter((c) => c.segment === payload.segment)
    : customers;
  return customerListToResult(
    filtered,
    state,
    `고객 상세 — segment: ${segmentLabel(payload.segment)}`
  );
}

// ---- customer_channel ------------------------------------------------------

function resolveCustomerChannel(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const customers = deriveCustomersFromState(state);
  const filtered = payload.source
    ? customers.filter((c) => c.primarySource === payload.source)
    : customers;
  return customerListToResult(
    filtered,
    state,
    `고객 상세 — 채널: ${sourceLabel(payload.source)}`
  );
}

// ---- shared customer list → result -----------------------------------------

function customerListToResult(
  customers: ReadonlyArray<import("@/types/customer").Customer>,
  state: DrilldownStateSubset,
  title: string
): DrilldownResolverResult {
  const artworkLookup = buildArtworkLookup(state.artworks);
  const sorted = [...customers].sort((a, b) => {
    if (a.lastInteractionAt !== b.lastInteractionAt)
      return a.lastInteractionAt < b.lastInteractionAt ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  const rows: DrilldownRow[] = sorted.map((c) => {
    const linkedArtworkId = c.ownedArtworkIds[0];
    const linkedArtwork = linkedArtworkId
      ? artworkLookup.get(linkedArtworkId)
      : undefined;
    return {
      id: c.id,
      artworkId: linkedArtworkId,
      cells: {
        customer: {
          text: c.displayName,
          meta: c.primaryContact || undefined,
        },
        segment: {
          text: CUSTOMER_SEGMENT_LABEL_KR[c.segment] ?? c.segment,
          tone: customerSegmentTone(c.segment),
        },
        channel: { text: sourceLabel(c.primarySource), tone: "neutral" },
        inquiries: { text: `${c.inquiryIds.length}건` },
        purchases: {
          text: `${c.transactionIds.length}건`,
          meta: linkedArtwork?.title,
        },
        last: { text: formatDateOnlyKR(c.lastInteractionAt) },
      },
    };
  });

  return {
    title,
    context: `${rows.length}명 · 최근 활동순 · 작품 이동: 보유 작품 첫 항목`,
    columns: [
      { key: "customer", label: "고객", align: "left" },
      { key: "segment", label: "segment", align: "left", widthClass: "w-24" },
      { key: "channel", label: "채널", align: "left", widthClass: "w-28" },
      { key: "inquiries", label: "문의", align: "right", widthClass: "w-16" },
      { key: "purchases", label: "거래", align: "right", widthClass: "w-28" },
      { key: "last", label: "최근 활동", align: "right", widthClass: "w-28" },
    ],
    rows,
    emptyMessage: "조건에 맞는 고객이 없습니다.",
  };
}

// ---- Storage / image cleanup drilldowns ------------------------------------

function resolveStorageWithImage(
  state: DrilldownStateSubset
): DrilldownResolverResult {
  return artworkImageRowsToResult(
    state.artworks.filter((a) => !!a.imageUrl),
    "이미지 보유 작품"
  );
}

function resolveStorageExternal(
  state: DrilldownStateSubset
): DrilldownResolverResult {
  return artworkImageRowsToResult(
    state.artworks.filter(
      (a) => !!a.imageUrl && a.imageProvider === "vercel_blob"
    ),
    "외부 저장소 작품 (Vercel Blob)"
  );
}

function resolveStorageFallback(
  state: DrilldownStateSubset
): DrilldownResolverResult {
  return artworkImageRowsToResult(
    state.artworks.filter(
      (a) =>
        !!a.imageUrl &&
        (!a.imageProvider || a.imageProvider === "local_preview_v1")
    ),
    "fallback image 작품"
  );
}

function artworkImageRowsToResult(
  list: ReadonlyArray<Artwork>,
  title: string
): DrilldownResolverResult {
  const sorted = [...list].sort((a, b) => {
    const ad = a.imageUploadedAt ?? a.updatedAt;
    const bd = b.imageUploadedAt ?? b.updatedAt;
    if (ad !== bd) return ad < bd ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  const rows: DrilldownRow[] = sorted.map((a) => ({
    id: a.id,
    artworkId: a.id,
    cells: {
      artwork: { text: a.title, meta: a.artist.name },
      provider: {
        text: a.imageProvider ?? "—",
        tone: a.imageProvider === "vercel_blob" ? "success" : "neutral",
      },
      size: {
        text:
          a.imageSize !== undefined && a.imageSize > 0
            ? formatBytes(a.imageSize)
            : "—",
      },
      uploaded: {
        text: formatDateOnlyKR(a.imageUploadedAt ?? a.updatedAt),
      },
    },
  }));

  return {
    title,
    context: `${rows.length}건 · 최근 업로드/갱신순`,
    columns: [
      ARTWORK_COL,
      { key: "provider", label: "provider", align: "left", widthClass: "w-32" },
      { key: "size", label: "원본 size", align: "right", widthClass: "w-28" },
      {
        key: "uploaded",
        label: "업로드/갱신",
        align: "right",
        widthClass: "w-28",
      },
    ],
    rows,
    emptyMessage: "조건에 맞는 작품이 없습니다.",
  };
}

function resolveStorageOrphan(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  const referenced = new Set<string>();
  for (const a of state.artworks) {
    if (a.imageStorageKey && a.imageProvider === "vercel_blob") {
      referenced.add(a.imageStorageKey);
    }
  }
  const orphans = (payload.blobPathnames ?? []).filter(
    (p) => !referenced.has(p)
  );
  const sorted = [...orphans].sort((a, b) => a.localeCompare(b));

  // orphan은 작품 ref가 없으므로 row.artworkId 부재 — non-clickable
  const rows: DrilldownRow[] = sorted.map((path) => ({
    id: path,
    cells: {
      artwork: {
        text: path,
        meta: "작품 record 없음 — orphan 후보",
      },
    },
  }));

  return {
    title: "Orphan 후보",
    context: `${rows.length}건 · 외부 저장소에는 있지만 작품 record 없음`,
    columns: [{ key: "artwork", label: "pathname", align: "left" }],
    rows,
    emptyMessage:
      "orphan 후보가 없습니다. 외부 저장소의 모든 객체가 작품 record와 연결되어 있습니다.",
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// STEP 78 — System Audit Log drilldown
//
// 4개 도메인 (audit_events / audit_category / audit_severity / audit_action) 모두
// 본 함수가 처리. payload의 auditCategory / auditSeverity / auditAction /
// periodFromIso / periodToIso로 filter cascade.
//
// **Artwork navigation (사용자 spec)**:
//   row.artworkId 추출 우선순위:
//     (1) event.metadata.artworkId가 string이면 그것
//     (2) event.targetType === "artwork" + event.targetRef가 string이면 targetRef
//     (3) 그 외 부재 — row는 visible but non-clickable
//   추출 후 state.artworks에 실제 존재하는지 *방어적 검증* — 부재 시 row는
//   non-clickable (삭제된 작품으로 navigate 시 DetailPanel empty 상태 회피).
//
// **표현 정책 (사용자 spec STEP 78)**:
//   - 사용: "운영 로그" / "시스템 기록" / "운영 참고" / "상세 보기" /
//     "연결 이벤트"
//   - 금지: "legal audit" / "forensic proof" / "tamper-proof" /
//     "compliance guaranteed" / "permanent record"
// ============================================================================

const AUDIT_DOMAIN_TITLE_KR: Record<string, string> = {
  audit_events: "운영 로그",
  audit_category: "운영 로그 — 카테고리",
  audit_severity: "운영 로그 — 단계",
  audit_action: "운영 로그 — 동작",
};

function auditSeverityTone(severity: AuditSeverity): DrilldownTone {
  switch (severity) {
    case "info":
      return "info";
    case "warning":
      return "warning";
    case "error":
      return "error";
  }
}

function extractAuditArtworkRef(
  event: SystemAuditEvent
): string | undefined {
  // (1) metadata.artworkId 우선 — 향후 event 발행 시 artwork-link metadata
  //     포함 가능. 현재 STEP 80 orphan_remove_request_*는 artworkId 미포함이므로
  //     실 효과는 없음 (안전 가드). 향후 backup / permission 등에서 활용 가능.
  const meta = event.metadata;
  if (meta && typeof meta.artworkId === "string" && meta.artworkId.length > 0) {
    return meta.artworkId;
  }
  // (2) targetType === "artwork" + targetRef. 명시 패턴.
  if (
    event.targetType === "artwork" &&
    typeof event.targetRef === "string" &&
    event.targetRef.length > 0
  ) {
    return event.targetRef;
  }
  return undefined;
}

function buildAuditFilterContext(payload: DrilldownPayload): string[] {
  const parts: string[] = [];
  if (payload.auditCategory) {
    const label =
      AUDIT_CATEGORY_LABEL_KR[payload.auditCategory as AuditCategory] ??
      payload.auditCategory;
    parts.push(`카테고리: ${label}`);
  }
  if (payload.auditSeverity) {
    const label =
      AUDIT_SEVERITY_LABEL_KR[payload.auditSeverity as AuditSeverity] ??
      payload.auditSeverity;
    parts.push(`단계: ${label}`);
  }
  if (payload.auditAction) {
    parts.push(`동작: ${payload.auditAction}`);
  }
  if (payload.periodFromIso || payload.periodToIso) {
    const from = payload.periodFromIso
      ? formatDateOnlyKR(payload.periodFromIso)
      : "—";
    const to = payload.periodToIso
      ? formatDateOnlyKR(payload.periodToIso)
      : "—";
    parts.push(`기간: ${from} ~ ${to}`);
  }
  return parts;
}

function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function resolveAuditEvents(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  // Filter cascade — 각 단계는 독립 (어떤 domain이 호출했든 동일 처리).
  let filtered = state.auditEvents.filter((e) => {
    if (payload.auditCategory && e.category !== payload.auditCategory) {
      return false;
    }
    if (payload.auditSeverity && e.severity !== payload.auditSeverity) {
      return false;
    }
    if (payload.auditAction && e.action !== payload.auditAction) {
      return false;
    }
    if (
      (payload.periodFromIso || payload.periodToIso) &&
      !isInPeriod(e.createdAt, payload.periodFromIso, payload.periodToIso)
    ) {
      return false;
    }
    return true;
  });

  // 결정성 정렬 — store는 이미 신규-우선이지만, 명시적으로 createdAt desc → id asc.
  filtered = [...filtered].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  // artwork lookup — 추출된 artworkId가 실제 존재하는 작품인지 방어적 검증.
  const artworkLookup = buildArtworkLookup(state.artworks);

  const rows: DrilldownRow[] = filtered.map((event) => {
    const artworkRef = extractAuditArtworkRef(event);
    const linkedArtwork = artworkRef ? artworkLookup.get(artworkRef) : undefined;
    const categoryLabel =
      AUDIT_CATEGORY_LABEL_KR[event.category as AuditCategory] ?? event.category;
    const severityLabel =
      AUDIT_SEVERITY_LABEL_KR[event.severity] ?? event.severity;

    // target meta — 작품 link가 있으면 작품 정보 노출, 없으면 targetType + targetRef
    let targetText = "—";
    let targetMeta: string | undefined;
    if (linkedArtwork) {
      targetText = linkedArtwork.title;
      targetMeta = `${linkedArtwork.artist.name} · ${linkedArtwork.axid.code}`;
    } else if (event.targetType && event.targetRef) {
      targetText = event.targetRef;
      targetMeta = event.targetType;
    } else if (event.targetType) {
      targetText = event.targetType;
    } else if (event.targetRef) {
      targetText = event.targetRef;
    }

    return {
      id: event.id,
      // linkedArtwork 검증 통과한 경우만 row.artworkId 채움 — 그 외 non-clickable.
      artworkId: linkedArtwork ? linkedArtwork.id : undefined,
      cells: {
        time: { text: formatAuditTimestamp(event.createdAt) },
        category: { text: categoryLabel },
        severity: {
          text: severityLabel,
          tone: auditSeverityTone(event.severity),
        },
        action: {
          text: event.action,
          meta: event.actorLabel || event.actorRole,
        },
        target: {
          text: targetText,
          meta: targetMeta,
        },
        message: { text: event.message },
      },
    };
  });

  // Title — domain별 분기.
  let title = AUDIT_DOMAIN_TITLE_KR[payload.domain] ?? "운영 로그";
  if (payload.domain === "audit_category" && payload.auditCategory) {
    title = `운영 로그 — ${AUDIT_CATEGORY_LABEL_KR[payload.auditCategory as AuditCategory] ?? payload.auditCategory}`;
  } else if (payload.domain === "audit_severity" && payload.auditSeverity) {
    title = `운영 로그 — ${AUDIT_SEVERITY_LABEL_KR[payload.auditSeverity as AuditSeverity] ?? payload.auditSeverity}`;
  } else if (payload.domain === "audit_action" && payload.auditAction) {
    title = `운영 로그 — ${payload.auditAction}`;
  }

  const filterParts = buildAuditFilterContext(payload);
  const linkedCount = rows.filter((r) => r.artworkId).length;
  const navHint =
    linkedCount > 0
      ? `${linkedCount}건 작품 이동 가능`
      : "작품 link 없음 — 시스템 기록만 표시";
  const context =
    filterParts.length > 0
      ? `${rows.length}건 · ${filterParts.join(" · ")} · ${navHint}`
      : `${rows.length}건 · ${navHint}`;

  return {
    title,
    context,
    columns: [
      { key: "time", label: "시점", align: "left", widthClass: "w-[140px]" },
      { key: "category", label: "카테고리", align: "left", widthClass: "w-[100px]" },
      { key: "severity", label: "단계", align: "left", widthClass: "w-[80px]" },
      { key: "action", label: "동작", align: "left", widthClass: "w-[200px]" },
      { key: "target", label: "대상", align: "left" },
      { key: "message", label: "메시지", align: "left" },
    ],
    rows,
    emptyMessage:
      "현재 조건에 맞는 운영 로그 항목이 없습니다. 필터를 조정하거나 신규 시스템 이벤트를 기다려주세요.",
  };
}
