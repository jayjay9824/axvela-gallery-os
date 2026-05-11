// ============================================================================
// CustomerViewDrawer — STEP 42 (Customer / Collector Domain Promotion).
//
// 갤러리 운영자 (Manager 이상) 가 Customer를 1급 단위로 보는 master-detail
// drawer. STEP 41 CollectorViewDrawer의 superset — kind / segment /
// firstInteractionAt / channelMix / contact dedup 추가.
//
// **데이터 정책 (사용자 spec):**
//   - 신규 도메인 store 0개 · pure read-only aggregation
//   - Money Flow / Settlement / Tax / FX 계산 무수정
//   - 외부 API 호출 0건
//   - "확정 고객 등급" / "VIP" / "골드/실버" 표현 0건
//
// **UI 위치 (rule_14 + rule_17):**
//   - 3-Column 레이아웃 무변경
//   - Drawer 880px width — 좌측 list (260px) + 우측 detail
//   - Sidebar "고객" 클릭 진입 (Manager 이상)
//
// **Store 액션 호환:**
//   STEP 41의 collectorViewRequest / openCollectorView / closeCollectorView /
//   selectCollector를 그대로 재사용 (semantic은 customer로 확장 — store 액션
//   이름 변경 시 가져오는 코드 비용 큼). 이 호환은 의도적.
// ============================================================================

"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import { hasPermission } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { ClickableMetric } from "@/components/drilldown/ClickableMetric";
import {
  deriveCustomers,
  formatCustomerKRW,
  formatRelativeTime,
  CUSTOMER_SIGNAL_LABEL_KR,
  CUSTOMER_SIGNAL_HINT_KR,
  CUSTOMER_KIND_LABEL_KR,
  CUSTOMER_SEGMENT_LABEL_KR,
  CUSTOMER_SEGMENT_HINT_KR,
  INQUIRY_SOURCE_LABEL_KR,
} from "@/lib/customer-aggregates";
import {
  exportCustomers,
  type CustomerExportFormat,
} from "@/lib/customer-export";
import type {
  Customer,
  CustomerSignal,
  CustomerSegment,
} from "@/types/customer";

export function CustomerViewDrawer() {
  // STEP 41 store slice — semantic은 customer로 확장하되 액션 이름 그대로
  const collectorViewRequest = useArtworkStore((s) => s.collectorViewRequest);
  const closeView = useArtworkStore((s) => s.closeCollectorView);
  const selectCustomer = useArtworkStore((s) => s.selectCollector);
  const currentRole = useArtworkStore((s) => s.currentRole);

  // STEP 43 — Customer Detail Navigation (rule_8 Timeline = Navigation 정신).
  // 작품 row 클릭 시 해당 artworkId를 select하고 drawer를 닫아 사용자가 즉시
  // DetailPanel에서 그 작품을 보도록.
  const selectArtwork = useArtworkStore((s) => s.select);
  // STEP 124 — Inquiry item 클릭 시 *작품 navigate* 가 아닌 *문의 상세* 가
  // 사용자 의도. customer drawer 자동 close (single-drawer policy, z-index
  // 충돌 방어 — 모든 drawer 가 z-50 동일).
  const openInquiryDetail = useArtworkStore((s) => s.openInquiryDetail);

  const inquiries = useArtworkStore((s) => s.inquiries);
  const transactions = useArtworkStore((s) => s.transactions);
  const invoices = useArtworkStore((s) => s.invoices);
  const artworks = useArtworkStore((s) => s.artworks);

  const isAllowed = hasPermission(currentRole, "collector.view_global");
  const isOpen = collectorViewRequest.kind === "open" && isAllowed;
  const selectedId =
    collectorViewRequest.kind === "open"
      ? collectorViewRequest.selectedCollectorId
      : null;

  // Invoice fxRate lookup — STEP 32 fxSnapshot.rate read-only 참조
  const invoiceFxLookup = React.useMemo(() => {
    const lookup: Record<string, { fxRate?: number }> = {};
    for (const invList of Object.values(invoices)) {
      for (const inv of invList) {
        const existing = lookup[inv.transactionId];
        if (!existing || inv.isLocked) {
          lookup[inv.transactionId] = { fxRate: inv.fxSnapshot?.rate };
        }
      }
    }
    return lookup;
  }, [invoices]);

  const customers = React.useMemo(() => {
    const flatInq = Object.values(inquiries).flat();
    const flatTx = Object.values(transactions).flat();
    return deriveCustomers(flatInq, flatTx, invoiceFxLookup);
  }, [inquiries, transactions, invoiceFxLookup]);

  // ── Search + segment filter ─────────────────────────────────────────────
  const [search, setSearch] = React.useState("");
  const [segmentFilter, setSegmentFilter] =
    React.useState<CustomerSegment | "ALL">("ALL");
  React.useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setSegmentFilter("ALL");
    }
  }, [isOpen]);

  const filteredCustomers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (segmentFilter !== "ALL" && c.segment !== segmentFilter) return false;
      if (!q) return true;
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.allContacts.some((ct) => ct.toLowerCase().includes(q))
      );
    });
  }, [customers, search, segmentFilter]);

  const selected = React.useMemo<Customer | null>(
    () =>
      selectedId
        ? customers.find((c) => c.id === selectedId) ?? null
        : null,
    [customers, selectedId]
  );

  // Selected가 filter에서 사라지면 자동 deselect
  React.useEffect(() => {
    if (!isOpen || !selectedId) return;
    const stillExists = filteredCustomers.some((c) => c.id === selectedId);
    if (!stillExists) selectCustomer(null);
  }, [filteredCustomers, selectedId, isOpen, selectCustomer]);

  // STEP 43 — Customer Detail Navigation. 작품 row 클릭 시 호출되는 핸들러.
  // (1) artworkId를 select → DetailPanel + Sidebar pending approval queue가
  //     해당 작품으로 전환. (2) drawer 닫기 → 사용자가 즉시 DetailPanel을 본다.
  // selectedCollectorId는 store에 보존되므로 drawer 재진입 시 같은 customer로 복귀.
  const handleArtworkNavigate = React.useCallback(
    (artworkId: string) => {
      selectArtwork(artworkId);
      closeView();
    },
    [selectArtwork, closeView]
  );

  // STEP 124 — Inquiry item navigate. 사용자 spec — "문의 클릭 → 내용 확인".
  // null/empty inquiryId 방어 (resolver 가 보호하지만 한 번 더 guard).
  // single-drawer policy: customer view 자동 close → inquiry detail 단독 표시
  // (z-index 동일 z-50 drawer 두 개 동시 표시 시 painter's order 의존 회피).
  const handleInquiryNavigate = React.useCallback(
    (inquiryId: string) => {
      if (!inquiryId) return;
      openInquiryDetail(inquiryId);
      closeView();
    },
    [openInquiryDetail, closeView]
  );

  // STEP 44 — Customer Export. 현재 적용된 필터 (segment chip + 검색어) 결과를
  // 그대로 export. UI에 노출 중인 데이터 = export 대상의 invariant 보장.
  const filterLabel = React.useMemo(() => {
    const segLabel =
      segmentFilter === "ALL"
        ? "전체"
        : `Segment: ${CUSTOMER_SEGMENT_LABEL_KR[segmentFilter]}`;
    const q = search.trim();
    return q ? `${segLabel} · 검색: "${q}"` : segLabel;
  }, [segmentFilter, search]);

  const handleExport = React.useCallback(
    (format: CustomerExportFormat) => {
      if (filteredCustomers.length === 0) return;
      exportCustomers(format, filteredCustomers, {
        filterLabel,
        totalCount: customers.length,
        filteredCount: filteredCustomers.length,
      });
    },
    [filteredCustomers, customers.length, filterLabel]
  );

  const artworkById = React.useMemo(() => {
    const m: Record<string, { title: string; artist: string }> = {};
    for (const a of artworks) {
      m[a.id] = { title: a.title, artist: a.artist.name };
    }
    return m;
  }, [artworks]);

  // Counts for filter chips
  const segmentCounts = React.useMemo(() => {
    const c: Record<string, number> = {
      ALL: customers.length,
      PROSPECT: 0,
      ONE_TIME_BUYER: 0,
      REPEAT_BUYER: 0,
      DORMANT: 0,
    };
    for (const cust of customers) {
      c[cust.segment] = (c[cust.segment] ?? 0) + 1;
    }
    return c;
  }, [customers]);

  // STEP 73 — Master segment chip count drilldown. "ALL" → segment 미지정
  // (전체 고객), 그 외는 해당 segment 한정.
  const openDrilldown = useArtworkStore((s) => s.openDrilldown);
  const handleDrillSegment = React.useCallback(
    (seg: CustomerSegment | "ALL") => {
      openDrilldown({
        domain: "customer_segment",
        segment: seg === "ALL" ? undefined : seg,
      });
    },
    [openDrilldown]
  );

  return (
    <Drawer
      open={isOpen}
      onClose={closeView}
      title="고객 (Customer)"
      widthClass="w-[880px]"
    >
      {isOpen && (
        <div className="flex flex-col h-full">
          {/* Disclaimer */}
          <div className="border-b border-line px-6 py-3 shrink-0 bg-surface">
            <p className="text-[11px] text-ink-muted tracking-tightish leading-relaxed">
              <span className="text-ink font-medium">운영 참고 신호 · derive view</span> ·
              Inquiry / Transaction에서 자동 derive — 확정 고객 등급 또는 영구
              마스터 데이터 아닙니다.
            </p>
          </div>

          {/* Body — master-detail */}
          <div className="flex-1 min-h-0 flex">
            {/* Master — list */}
            <aside className="w-[260px] shrink-0 border-r border-line flex flex-col bg-surface">
              {/* Search */}
              <div className="px-3 py-3 border-b border-line shrink-0 flex flex-col gap-2">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="이름 / 이메일 검색"
                  className="w-full h-7 px-2.5 rounded border border-line bg-surface text-[11.5px] text-ink tracking-tightish placeholder:text-ink-subtle focus:outline-none focus:border-line-strong"
                />
                <SegmentFilterChips
                  current={segmentFilter}
                  counts={segmentCounts}
                  onChange={setSegmentFilter}
                  onDrillSegment={handleDrillSegment}
                />
                <p className="text-[10px] text-ink-subtle tracking-tightish">
                  {filteredCustomers.length} / {customers.length} 명
                </p>
              </div>
              <ul className="flex-1 overflow-y-auto scroll-clean py-1.5">
                {filteredCustomers.length === 0 ? (
                  <li className="px-3 py-4 text-center text-[11px] text-ink-subtle tracking-tightish">
                    {customers.length === 0
                      ? "고객 데이터 없음"
                      : "검색 결과 없음"}
                  </li>
                ) : (
                  filteredCustomers.map((c) => (
                    <li key={c.id}>
                      <CustomerListRow
                        customer={c}
                        active={c.id === selectedId}
                        onClick={() => selectCustomer(c.id)}
                      />
                    </li>
                  ))
                )}
              </ul>
            </aside>

            {/* Detail */}
            <div className="flex-1 overflow-y-auto scroll-clean">
              {selected ? (
                <CustomerDetail
                  customer={selected}
                  inquiries={Object.values(inquiries).flat()}
                  transactions={Object.values(transactions).flat()}
                  artworkById={artworkById}
                  onArtworkNavigate={handleArtworkNavigate}
                  onInquiryNavigate={handleInquiryNavigate}
                />
              ) : (
                <EmptyDetailState />
              )}
            </div>
          </div>

          {/* Footer — STEP 44 Export + close (STEP 35.6 ReportingDrawer 패턴 차용) */}
          <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-between bg-surface">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase mr-1">
                내보내기
              </span>
              <ExportButton
                label="CSV"
                onClick={() => handleExport("csv")}
                disabled={filteredCustomers.length === 0}
              />
              <ExportButton
                label="PDF"
                onClick={() => handleExport("pdf")}
                disabled={filteredCustomers.length === 0}
              />
            </div>
            <Button type="button" variant="ghost" onClick={closeView}>
              닫기
            </Button>
          </footer>
        </div>
      )}
    </Drawer>
  );
}

// ----------------------------------------------------------------------------
// Footer — Export button (STEP 35.6 ReportingDrawer 패턴 그대로)
// ----------------------------------------------------------------------------

function ExportButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </Button>
  );
}

// ----------------------------------------------------------------------------
// Master — segment filter chips
// ----------------------------------------------------------------------------

function SegmentFilterChips({
  current,
  counts,
  onChange,
  onDrillSegment,
}: {
  current: CustomerSegment | "ALL";
  counts: Record<string, number>;
  onChange: (seg: CustomerSegment | "ALL") => void;
  /** STEP 73 — chip의 count 클릭 시 해당 segment drilldown */
  onDrillSegment: (seg: CustomerSegment | "ALL") => void;
}) {
  const items: Array<{ key: CustomerSegment | "ALL"; label: string }> = [
    { key: "ALL", label: "전체" },
    { key: "PROSPECT", label: "문의" },
    { key: "ONE_TIME_BUYER", label: "1회" },
    { key: "REPEAT_BUYER", label: "반복" },
    { key: "DORMANT", label: "휴면" },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => {
        const active = current === it.key;
        const count = counts[it.key] ?? 0;
        const countDisabled = count === 0;
        return (
          // STEP 73 — chip을 div + 내부 두 button (필터 변경 + count drilldown).
          // DOM nesting 안전성을 위해 두 button 형제 분리. visual 거의 동일.
          <div
            key={it.key}
            className={cn(
              "inline-flex items-center rounded-full border text-[10.5px] tracking-tightish transition-colors overflow-hidden",
              active
                ? "border-ink bg-ink text-white"
                : "border-line bg-surface text-ink-muted hover:text-ink"
            )}
          >
            <button
              type="button"
              onClick={() => onChange(it.key)}
              className="pl-2 pr-1 py-0.5 flex items-center"
            >
              <span>{it.label}</span>
            </button>
            <button
              type="button"
              onClick={() => onDrillSegment(it.key)}
              disabled={countDisabled}
              title={
                countDisabled
                  ? undefined
                  : `${it.label} segment ${count}명 — 상세 보기`
              }
              className={cn(
                "pl-1 pr-2 py-0.5 transition-opacity",
                countDisabled
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:opacity-90"
              )}
            >
              <span className="tabular-nums opacity-70">{count}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Master — list row
// ----------------------------------------------------------------------------

function CustomerListRow({
  customer,
  active,
  onClick,
}: {
  customer: Customer;
  active: boolean;
  onClick: () => void;
}) {
  const hasSignal = customer.signals.length > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2 transition-colors flex flex-col gap-0.5",
        active
          ? "bg-surface-muted"
          : "hover:bg-surface-muted/60 cursor-pointer"
      )}
      aria-pressed={active}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "text-[12.5px] tracking-tightish truncate",
            active ? "text-ink font-medium" : "text-ink-muted"
          )}
        >
          {customer.displayName}
        </span>
        {hasSignal && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-ink shrink-0"
            aria-label={`${customer.signals.length}개 신호`}
          />
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2 text-[10px] text-ink-subtle tracking-tightish">
        <span className="truncate">
          {CUSTOMER_SEGMENT_LABEL_KR[customer.segment]} · 거래 {customer.transactionIds.length} · 문의 {customer.inquiryIds.length}
        </span>
        <span className="tabular-nums shrink-0">
          {formatRelativeTime(customer.lastInteractionAt)}
        </span>
      </div>
    </button>
  );
}

// ----------------------------------------------------------------------------
// Detail — selected customer
// ----------------------------------------------------------------------------

function CustomerDetail({
  customer,
  inquiries,
  transactions,
  artworkById,
  onArtworkNavigate,
  onInquiryNavigate,
}: {
  customer: Customer;
  inquiries: Array<{
    id: string;
    artworkId: string;
    inquiryType: string;
    status: string;
    message: string;
    source: string;
  }>;
  transactions: Array<{
    id: string;
    artworkId: string;
    status: string;
    agreedPrice: number;
    currency: string;
    isResale?: boolean;
  }>;
  artworkById: Record<string, { title: string; artist: string }>;
  /** STEP 43 — 작품 row 클릭 시 호출. select + drawer close가 묶여 있음. */
  onArtworkNavigate: (artworkId: string) => void;
  /**
   * STEP 124 — 문의 row 클릭 시 호출. openInquiryDetail + customer drawer
   * close 가 묶여 있음 (single-drawer policy). 사용자 spec — "문의 클릭 →
   * 내용 확인" 이 1차 의도, 작품 navigate 는 별도 surface 통해 가능.
   */
  onInquiryNavigate: (inquiryId: string) => void;
}) {
  // STEP 73 — drilldown selector. KPI cards + Section headers 클릭 시 호출.
  const openDrilldown = useArtworkStore((s) => s.openDrilldown);
  const myInquiries = inquiries.filter((i) =>
    customer.inquiryIds.includes(i.id)
  );
  const myTransactions = transactions.filter((t) =>
    customer.transactionIds.includes(t.id)
  );

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      {/* Identity */}
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h3 className="text-[18px] font-medium text-ink tracking-tight">
            {customer.displayName}
          </h3>
          <span
            className="px-2 py-0.5 rounded-full border border-line bg-surface text-[10px] text-ink-muted tracking-tightish"
            title={CUSTOMER_SEGMENT_HINT_KR[customer.segment]}
          >
            {CUSTOMER_SEGMENT_LABEL_KR[customer.segment]}
          </span>
          <span className="px-2 py-0.5 rounded-full border border-dashed border-line bg-surface text-[10px] text-ink-subtle tracking-tightish">
            {CUSTOMER_KIND_LABEL_KR[customer.kind]}
          </span>
        </div>
        {customer.primaryContact && (
          <p className="text-[11.5px] font-mono tracking-tightish text-ink-subtle">
            {customer.primaryContact}
            {customer.allContacts.length > 1 && (
              <span className="ml-2 text-[10px] text-ink-subtle">
                (+{customer.allContacts.length - 1})
              </span>
            )}
          </p>
        )}
      </header>

      {/* Signals */}
      {customer.signals.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase mb-1.5">
            운영 참고 신호
          </p>
          <div className="flex flex-wrap gap-1.5">
            {customer.signals.map((s) => (
              <SignalChip key={s} signal={s} />
            ))}
          </div>
        </div>
      )}

      {/* KPI grid — 4 metrics (STEP 41 3개 → 4개로 확장)
          STEP 73 — "누적 매입" / "보유 작품" KPI는 ClickableMetric으로 wrap →
          customer_purchases / customer_owned_artworks drilldown. 첫/마지막 활동
          은 timestamp라 wrap하지 않음. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ClickableMetric
          onClick={
            customer.transactionIds.length > 0
              ? () =>
                  openDrilldown({
                    domain: "customer_purchases",
                    customerId: customer.id,
                    customerName: customer.displayName,
                  })
              : undefined
          }
          disabled={customer.transactionIds.length === 0}
          ariaLabel={`${customer.displayName} 연결 거래 ${customer.transactionIds.length}건 — 상세 보기`}
        >
          <Stat
            label="누적 매입"
            value={formatCustomerKRW(customer.totalPurchaseKRW)}
            hint={
              customer.missingFxCount > 0
                ? `${customer.missingFxCount}건 환산 정보 부족`
                : "KRW 환산"
            }
            warn={customer.missingFxCount > 0}
          />
        </ClickableMetric>
        <ClickableMetric
          onClick={
            customer.ownedArtworkIds.length > 0
              ? () =>
                  openDrilldown({
                    domain: "customer_owned_artworks",
                    customerId: customer.id,
                    customerName: customer.displayName,
                  })
              : undefined
          }
          disabled={customer.ownedArtworkIds.length === 0}
          ariaLabel={`${customer.displayName} 보유 작품 ${customer.ownedArtworkIds.length}점 — 상세 보기`}
        >
          <Stat
            label="보유 작품"
            value={`${customer.ownedArtworkIds.length}점`}
            hint={`총 거래 ${customer.transactionIds.length}건`}
          />
        </ClickableMetric>
        <Stat
          label="첫 활동"
          value={formatRelativeTime(customer.firstInteractionAt)}
          hint={customer.firstInteractionAt.slice(0, 10) || "—"}
        />
        <Stat
          label="마지막 활동"
          value={formatRelativeTime(customer.lastInteractionAt)}
          hint={customer.lastInteractionAt.slice(0, 10) || "—"}
        />
      </div>

      {/* Channel mix */}
      {Object.keys(customer.channelMix).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase mb-1.5">
            문의 채널 분포
          </p>
          <div className="rounded-md border border-line bg-surface px-3 py-2.5 flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(customer.channelMix)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
              .map(([src, n]) => (
                <span
                  key={src}
                  className="text-[11px] text-ink-muted tracking-tightish"
                >
                  {INQUIRY_SOURCE_LABEL_KR[src as keyof typeof INQUIRY_SOURCE_LABEL_KR] ?? src}{" "}
                  <span className="tabular-nums text-ink">{n}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Owned artworks */}
      <Section
        title="보유 / 매입 작품"
        emptyText="거래 기록 없음"
        onCountClick={
          customer.transactionIds.length > 0
            ? () =>
                openDrilldown({
                  domain: "customer_purchases",
                  customerId: customer.id,
                  customerName: customer.displayName,
                })
            : undefined
        }
        countTitle={`${customer.displayName} 연결 거래 — 상세 보기`}
        items={myTransactions.map((t) => {
          const a = artworkById[t.artworkId];
          const title = a?.title ?? t.artworkId;
          return {
            key: t.id,
            primary: title,
            secondary: a?.artist ?? "—",
            meta: (
              <span className="tabular-nums">
                {formatCustomerKRW(
                  t.currency === "KRW" ? t.agreedPrice : 0
                )}
                {t.currency !== "KRW" && (
                  <span className="ml-1 font-mono text-[10px] text-ink-subtle">
                    ({t.currency} {t.agreedPrice.toLocaleString("en-US")})
                  </span>
                )}
              </span>
            ),
            tag: TX_STATUS_LABEL_KR[t.status] ?? t.status,
            tagAccent: TX_STATUS_ACCENT[t.status] ?? "neutral",
            // STEP 43 — Customer Detail Navigation
            onClick: () => onArtworkNavigate(t.artworkId),
            ariaLabel: `${title} 작품 상세로 이동`,
          };
        })}
      />

      {/* Inquiry history */}
      <Section
        title="문의 이력"
        emptyText="문의 이력 없음"
        onCountClick={
          customer.inquiryIds.length > 0
            ? () =>
                openDrilldown({
                  domain: "customer_inquiries",
                  customerId: customer.id,
                  customerName: customer.displayName,
                })
            : undefined
        }
        countTitle={`${customer.displayName} 연결 문의 — 상세 보기`}
        items={myInquiries.map((i) => {
          const a = artworkById[i.artworkId];
          const title = a?.title ?? i.artworkId;
          return {
            key: i.id,
            primary: title,
            secondary: i.message ? truncate(i.message, 60) : "—",
            meta: null,
            tag: INQ_STATUS_LABEL_KR[i.status] ?? i.status,
            tagAccent: INQ_STATUS_ACCENT[i.status] ?? "neutral",
            // STEP 124 — 문의 클릭 → 문의 상세 (작품 navigate 아님). 사용자
            // spec — "문의 클릭 → 내용 확인". customer drawer 자동 close.
            onClick: () => onInquiryNavigate(i.id),
            ariaLabel: `${title} 작품의 문의 — 상세 열기`,
          };
        })}
      />
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

// ----------------------------------------------------------------------------
// Sub-components (STEP 41과 동일 — display-only)
// ----------------------------------------------------------------------------

function Stat({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.12em] text-ink-subtle font-semibold">
        {label}
      </span>
      <span className="text-[15px] tabular-nums tracking-tight text-ink font-medium mt-0.5">
        {value}
      </span>
      <span
        className={cn(
          "text-[10px] tracking-tightish mt-0.5",
          warn ? "text-amber-700" : "text-ink-subtle"
        )}
      >
        {hint}
      </span>
    </div>
  );
}

function SignalChip({ signal }: { signal: CustomerSignal }) {
  return (
    <span
      title={CUSTOMER_SIGNAL_HINT_KR[signal]}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-line bg-surface text-[10.5px] text-ink-muted tracking-tightish"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />
      {CUSTOMER_SIGNAL_LABEL_KR[signal]}
    </span>
  );
}

interface SectionItem {
  key: string;
  primary: string;
  secondary: string;
  meta: React.ReactNode;
  tag: string;
  tagAccent: "neutral" | "active" | "completed" | "muted";
  /**
   * STEP 43 — Customer Detail Navigation. row 클릭 시 호출되는 핸들러.
   * 부재 시 row는 non-interactive (정보 표시만).
   */
  onClick?: () => void;
  /** STEP 43 — accessibility 라벨. onClick 부재 시 무의미. */
  ariaLabel?: string;
}

function Section({
  title,
  emptyText,
  items,
  onCountClick,
  countTitle,
}: {
  title: string;
  emptyText: string;
  items: SectionItem[];
  /** STEP 73 — header count 클릭 시 호출. drilldown 호출자 측에서 정의. */
  onCountClick?: () => void;
  /** STEP 73 — count tooltip ("연결 거래 N건 — 상세 보기" 등) */
  countTitle?: string;
}) {
  const countLabel = `${items.length}건`;
  const isClickable = !!onCountClick && items.length > 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <h4 className="text-[12px] font-semibold tracking-tightish text-ink">
          {title}
        </h4>
        {isClickable ? (
          <button
            type="button"
            onClick={onCountClick}
            title={countTitle ?? `${countLabel} — 상세 보기`}
            className="text-[10.5px] text-ink-subtle tracking-tightish tabular-nums hover:text-ink hover:underline transition-colors"
          >
            {countLabel}
          </button>
        ) : (
          <span className="text-[10.5px] text-ink-subtle tracking-tightish tabular-nums">
            {countLabel}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-line px-3 py-3 text-center">
          <p className="text-[11px] text-ink-subtle tracking-tightish">
            {emptyText}
          </p>
        </div>
      ) : (
        <ul className="rounded-md border border-line overflow-hidden">
          {items.map((item, i) => (
            <li
              key={item.key}
              className={cn(i > 0 && "border-t border-line")}
            >
              {item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  aria-label={item.ariaLabel}
                  className={cn(
                    "w-full px-3 py-2 flex items-center gap-3 text-left",
                    "hover:bg-surface-muted focus:bg-surface-muted focus:outline-none",
                    "cursor-pointer transition-colors",
                    "group"
                  )}
                >
                  <SectionRowContent item={item} interactive />
                </button>
              ) : (
                <div className="px-3 py-2 flex items-center gap-3">
                  <SectionRowContent item={item} interactive={false} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * STEP 43 — Section row의 내부 콘텐츠. interactive 여부에 따라 텍스트 hover
 * 색상만 살짝 차등 (button/div 둘 다 같은 layout 보장).
 */
function SectionRowContent({
  item,
  interactive,
}: {
  item: SectionItem;
  interactive: boolean;
}) {
  return (
    <>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-[12px] tracking-tightish truncate",
            interactive
              ? "text-ink group-hover:text-ink"
              : "text-ink"
          )}
        >
          {item.primary}
        </p>
        <p className="text-[10.5px] text-ink-subtle tracking-tightish truncate mt-0.5">
          {item.secondary}
        </p>
      </div>
      {item.meta && (
        <div className="text-[11px] text-ink-muted tracking-tightish shrink-0">
          {item.meta}
        </div>
      )}
      <StatusTag accent={item.tagAccent}>{item.tag}</StatusTag>
    </>
  );
}

function StatusTag({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent: "neutral" | "active" | "completed" | "muted";
}) {
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded-full border text-[9.5px] uppercase tracking-[0.08em] shrink-0",
        accent === "active" && "border-ink text-ink",
        accent === "completed" &&
          "border-line text-ink-subtle bg-surface-muted",
        accent === "muted" && "border-line text-ink-subtle",
        accent === "neutral" && "border-line text-ink-muted"
      )}
    >
      {children}
    </span>
  );
}

function EmptyDetailState() {
  return (
    <div className="h-full flex items-center justify-center px-8">
      <div className="text-center max-w-sm">
        <p className="text-[12.5px] text-ink-muted tracking-tightish">
          왼쪽에서 고객을 선택하세요
        </p>
        <p className="mt-2 text-[10.5px] text-ink-subtle tracking-tightish leading-relaxed">
          본 view는 Inquiry / Transaction에서 자동 derive되는 운영 참고용
          정보를 표시합니다.
        </p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Status labels (customer view 한정 — STEP 41과 동일)
// ----------------------------------------------------------------------------

const TX_STATUS_LABEL_KR: Record<string, string> = {
  NEGOTIATING: "협상",
  AGREED: "합의",
  PAID: "결제",
  SETTLED: "정산",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

const TX_STATUS_ACCENT: Record<
  string,
  "neutral" | "active" | "completed" | "muted"
> = {
  NEGOTIATING: "active",
  AGREED: "active",
  PAID: "completed",
  SETTLED: "completed",
  COMPLETED: "completed",
  CANCELLED: "muted",
};

const INQ_STATUS_LABEL_KR: Record<string, string> = {
  OPEN: "응대 대기",
  RESPONDED: "응답",
  ON_HOLD: "보류",
  ESCALATED: "에스컬레이션",
  CLOSED: "종료",
};

const INQ_STATUS_ACCENT: Record<
  string,
  "neutral" | "active" | "completed" | "muted"
> = {
  OPEN: "active",
  RESPONDED: "neutral",
  ON_HOLD: "muted",
  ESCALATED: "active",
  CLOSED: "completed",
};
