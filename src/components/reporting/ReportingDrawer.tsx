// ============================================================================
// ReportingDrawer — STEP 35 (Multi-currency Reporting Layer)
//
// 갤러리 운영자 (Manager 이상) 가 매출 / 정산 / 세무 / FX를 KRW 통합으로 한눈에
// 보는 운영 참고 리포트. **데이터는 invoice / settlement / tax slice를
// read-only**, 도메인 로직 0줄 변경. 모든 합계는 `computeReportingAggregates`
// pure function 결과.
//
// 표현 정책 (사용자 spec):
//   - "회계 확정" / "세무 신고 완료" 금지
//   - "운영 참고 리포트" / "내부 정산 기준" / "FX snapshot 기준" 사용
//   - mock FX provider인 경우 footer에 작게 명시
//
// UI 위치 (rule_14 + rule_17):
//   - 3-Column 레이아웃 무변경
//   - Drawer 800px width — GlobalAuditDrawer와 동일 톤
//   - Sidebar "보고서" 클릭 진입 (Manager 이상)
//
// 6개 핵심 카드 + Currency Breakdown + Status Summary:
//   1. Total Sales              (KRW 환산)
//   2. Settlement Total         (KRW 환산)
//   3. Taxable Amount           (KRW 환산)
//   4. FX Converted KRW Total   (외화 부분만)
//   5. Currency Breakdown       (KRW / USD / EUR 등 통화별)
//   6. Status Summary           (Invoice / Settlement / Tax 상태별 카운트)
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
  computeReportingAggregates,
  filterByTimeRange,
  filterChannelInputByTimeRange,
  resolveTimeRange,
  formatTimeFilterLabel,
  formatKRW,
  formatCurrencyAmount,
  EMPTY_REPORTING_TIME_FILTER,
  INVOICE_STATUS_LABEL_KR,
  SETTLEMENT_STATUS_LABEL_KR,
  TAX_STATUS_LABEL_KR,
  type CurrencyBucket,
  type ReportingAggregates,
  type ReportingTimeFilter,
  type ReportingTimePreset,
  type ChannelMixSection,
  type ChannelMixBucket,
} from "@/lib/reporting-aggregates";
import {
  exportReporting,
  type ReportExportFormat,
} from "@/lib/reporting-export";
import { deriveCustomers, INQUIRY_SOURCE_LABEL_KR } from "@/lib/customer-aggregates";
import type { InvoiceStatus } from "@/types/invoice";
import type { SettlementStatus } from "@/types/settlement";
import type { TaxRecordStatus } from "@/types/tax";
import type { InquirySource } from "@/types/inquiry";

export function ReportingDrawer() {
  const reportingRequest = useArtworkStore((s) => s.reportingRequest);
  const closeReporting = useArtworkStore((s) => s.closeReporting);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const invoices = useArtworkStore((s) => s.invoices);
  const settlements = useArtworkStore((s) => s.settlements);
  const taxRecords = useArtworkStore((s) => s.taxRecords);
  // STEP 47 — Channel Mix derive 입력 (모든 슬라이스 read-only)
  const inquiries = useArtworkStore((s) => s.inquiries);
  const transactions = useArtworkStore((s) => s.transactions);

  const isAllowed = hasPermission(currentRole, "report.view_global");
  const isOpen = reportingRequest.kind === "open" && isAllowed;

  // STEP 35.5 — Time filter (drawer-local state, drawer 닫혔다 열면 reset)
  const [timeFilter, setTimeFilter] = React.useState<ReportingTimeFilter>(
    EMPTY_REPORTING_TIME_FILTER
  );
  React.useEffect(() => {
    if (!isOpen) return;
    setTimeFilter(EMPTY_REPORTING_TIME_FILTER);
  }, [isOpen]);

  // STEP 47 — Invoice fxRate lookup (deriveCustomers용 — STEP 32 fxSnapshot.rate
  // read-only 참조). 패턴은 CustomerViewDrawer와 동일.
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

  // Slice는 artworkId별 grouped Record. Aggregator는 flat array를 기대 — flatten.
  // STEP 35.5 — flatten 후 time filter 적용. STEP 47 — channel input도 동일
  // time filter 적용 후 deriveCustomers로 channelMix 계산.
  const aggregates = React.useMemo<ReportingAggregates>(() => {
    const flatInv = Object.values(invoices).flat();
    const flatSet = Object.values(settlements).flat();
    const flatTax = Object.values(taxRecords).flat();
    const flatInq = Object.values(inquiries).flat();
    const flatTx = Object.values(transactions).flat();
    const range = resolveTimeRange(timeFilter);
    const filtered = filterByTimeRange(flatInv, flatSet, flatTax, range);
    const channelFiltered = filterChannelInputByTimeRange(
      flatInq,
      flatTx,
      range
    );
    // Customer는 filtered inquiries+transactions에서 derive — time filter
    // 자동 반영 (이번 달 활성 고객만 등).
    const filteredCustomers = deriveCustomers(
      channelFiltered.inquiries,
      channelFiltered.transactions,
      invoiceFxLookup
    );
    return computeReportingAggregates(
      filtered.invoices,
      filtered.settlements,
      filtered.taxRecords,
      {
        inquiries: channelFiltered.inquiries,
        transactions: channelFiltered.transactions,
        customers: filteredCustomers,
      }
    );
  }, [
    invoices,
    settlements,
    taxRecords,
    inquiries,
    transactions,
    invoiceFxLookup,
    timeFilter,
  ]);

  // STEP 35.6 — Export handler. 현재 적용된 time filter 기준 aggregates를
  // 그대로 export — 사용자 spec "Export는 필터 적용 결과 기준" 충족.
  const timeLabel = React.useMemo(
    () => formatTimeFilterLabel(timeFilter),
    [timeFilter]
  );
  // STEP 67 — Drilldown은 현재 time filter range를 inherit (filter sync).
  const range = React.useMemo(
    () => resolveTimeRange(timeFilter),
    [timeFilter]
  );
  const handleExport = React.useCallback(
    (format: ReportExportFormat) => {
      exportReporting(format, aggregates, { timeFilterLabel: timeLabel });
    },
    [aggregates, timeLabel]
  );

  return (
    <Drawer
      open={isOpen}
      onClose={closeReporting}
      title="운영 참고 리포트"
      widthClass="w-[840px]"
    >
      {isOpen && (
        <div className="flex flex-col h-full">
          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
            <DisclaimerBanner />
            <div className="h-3" />
            <TimeFilterBar state={timeFilter} onChange={setTimeFilter} />
            <div className="h-4" />
            <KPISection
              aggregates={aggregates}
              timeRangeStart={range?.start}
              timeRangeEnd={range?.end}
            />
            <div className="h-6" />
            <CurrencyBreakdownSection
              buckets={aggregates.currencyBreakdown}
              fxConvertedKRWTotal={aggregates.fxConvertedKRWTotal}
              fxConvertedInvoiceCount={aggregates.fxConvertedInvoiceCount}
              timeRangeStart={range?.start}
              timeRangeEnd={range?.end}
            />
            <div className="h-6" />
            <StatusSummarySection aggregates={aggregates} />
            <div className="h-6" />
            {/* STEP 47 — Channel Mix (유입 채널 기준). aggregates.channelMix가
                null이 아닐 때만 렌더 — 입력이 없으면 자연스럽게 숨김.
                STEP 70 — timeRange inherit (drilldown filter sync). */}
            {aggregates.channelMix && (
              <>
                <ChannelMixSectionView
                  channelMix={aggregates.channelMix}
                  timeRangeStart={range?.start}
                  timeRangeEnd={range?.end}
                />
                <div className="h-6" />
              </>
            )}
            <FootnoteSection
              fxSourceIsMock={aggregates.fxSourceIsMock}
              fxProviderId={aggregates.fxProviderId}
            />
          </div>

          {/* Footer — STEP 35.6 Export + close */}
          <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-between bg-surface">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase mr-1">
                내보내기
              </span>
              <ExportButton
                label="CSV"
                onClick={() => handleExport("csv")}
                disabled={aggregates.totalSalesCount === 0 && aggregates.settlementCount === 0 && aggregates.taxRecordCount === 0}
              />
              <ExportButton
                label="PDF"
                onClick={() => handleExport("pdf")}
                disabled={aggregates.totalSalesCount === 0 && aggregates.settlementCount === 0 && aggregates.taxRecordCount === 0}
              />
            </div>
            <Button type="button" variant="ghost" onClick={closeReporting}>
              닫기
            </Button>
          </footer>
        </div>
      )}
    </Drawer>
  );
}

// ----------------------------------------------------------------------------
// Disclaimer banner (사용자 spec — 회계 확정 금지 표현)
// ----------------------------------------------------------------------------

function DisclaimerBanner() {
  return (
    <div className="rounded-md border border-line bg-surface-muted px-3 py-2.5">
      <p className="text-[11.5px] text-ink-muted tracking-tightish leading-relaxed">
        <span className="text-ink font-medium">운영 참고 리포트</span> · 내부
        정산 기준 / FX snapshot 기준 — 회계 확정 또는 세무 신고와 무관합니다.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// KPI Section — 4 cards
// ----------------------------------------------------------------------------

function KPISection({
  aggregates,
  timeRangeStart,
  timeRangeEnd,
}: {
  aggregates: ReportingAggregates;
  /** STEP 67 — drilldown payload에 inherit (filter sync) */
  timeRangeStart?: string;
  timeRangeEnd?: string;
}) {
  const openDrilldown = useArtworkStore((s) => s.openDrilldown);
  return (
    <section>
      <SectionHeader title="핵심 지표" />
      <div className="grid grid-cols-2 gap-3">
        <ClickableMetric
          onClick={() =>
            openDrilldown({
              domain: "reporting_invoices",
              periodFromIso: timeRangeStart,
              periodToIso: timeRangeEnd,
            })
          }
          ariaLabel={`Total Sales ${aggregates.totalSalesCount}건 — 인보이스 상세 보기`}
        >
          <KPICard
            label="Total Sales"
            subLabel="총 매출 · KRW 환산"
            value={formatKRW(aggregates.totalSalesKRW)}
            hint={`${aggregates.convertibleInvoiceCount} / ${aggregates.totalSalesCount} 인보이스`}
            warn={
              aggregates.totalSalesCount > aggregates.convertibleInvoiceCount
                ? `${
                    aggregates.totalSalesCount - aggregates.convertibleInvoiceCount
                  }건 환산 정보 부족`
                : null
            }
          />
        </ClickableMetric>
        <ClickableMetric
          onClick={() =>
            openDrilldown({
              domain: "reporting_settlements",
              periodFromIso: timeRangeStart,
              periodToIso: timeRangeEnd,
            })
          }
          ariaLabel={`Settlement Total ${aggregates.settlementCount}건 — 정산 상세 보기`}
        >
          <KPICard
            label="Settlement Total"
            subLabel="총 정산 · KRW 환산"
            value={formatKRW(aggregates.settlementTotalKRW)}
            hint={`${aggregates.settlementCount}건`}
            warn={
              aggregates.settlementMissingFxCount > 0
                ? `${aggregates.settlementMissingFxCount}건 환산 정보 부족`
                : null
            }
          />
        </ClickableMetric>
        <ClickableMetric
          onClick={() =>
            openDrilldown({
              domain: "reporting_tax",
              periodFromIso: timeRangeStart,
              periodToIso: timeRangeEnd,
            })
          }
          ariaLabel={`Taxable Amount ${aggregates.taxRecordCount}건 — 세무 상세 보기`}
        >
          <KPICard
            label="Taxable Amount"
            subLabel="과세 표준액 · KRW 환산"
            value={formatKRW(aggregates.taxableAmountKRW)}
            hint={`${aggregates.taxRecordCount}건`}
            warn={
              aggregates.taxMissingFxCount > 0
                ? `${aggregates.taxMissingFxCount}건 환산 정보 부족`
                : null
            }
          />
        </ClickableMetric>
        <ClickableMetric
          onClick={
            aggregates.fxConvertedInvoiceCount > 0
              ? () =>
                  openDrilldown({
                    domain: "reporting_fx_converted",
                    periodFromIso: timeRangeStart,
                    periodToIso: timeRangeEnd,
                  })
              : undefined
          }
          disabled={aggregates.fxConvertedInvoiceCount === 0}
          ariaLabel={`FX Converted ${aggregates.fxConvertedInvoiceCount}건 — 외화 환산 상세 보기`}
        >
          <KPICard
            label="FX Converted"
            subLabel="외화 매출 · KRW 환산 합계"
            value={formatKRW(aggregates.fxConvertedKRWTotal)}
            hint={
              aggregates.fxConvertedInvoiceCount > 0
                ? `${aggregates.fxConvertedInvoiceCount}건 외화 인보이스`
                : "외화 인보이스 없음"
            }
            warn={null}
            dim={aggregates.fxConvertedInvoiceCount === 0}
          />
        </ClickableMetric>
      </div>
    </section>
  );
}

function KPICard({
  label,
  subLabel,
  value,
  hint,
  warn,
  dim = false,
}: {
  label: string;
  subLabel: string;
  value: string;
  hint: string;
  warn: string | null;
  dim?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-line px-4 py-3.5 flex flex-col gap-1",
        dim ? "bg-surface" : "bg-surface"
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-ink-subtle">
          {label}
        </span>
        <span className="text-[10px] text-ink-subtle tracking-tightish truncate">
          {subLabel}
        </span>
      </div>
      <p
        className={cn(
          "text-[20px] tabular-nums tracking-tight font-medium mt-1",
          dim ? "text-ink-subtle" : "text-ink"
        )}
      >
        {value}
      </p>
      <div className="flex items-baseline justify-between gap-2 mt-0.5">
        <span className="text-[10.5px] text-ink-muted tracking-tightish tabular-nums">
          {hint}
        </span>
        {warn && (
          <span className="text-[10px] text-amber-700 tracking-tightish">
            ⚠ {warn}
          </span>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Currency Breakdown
// ----------------------------------------------------------------------------

function CurrencyBreakdownSection({
  buckets,
  fxConvertedKRWTotal,
  fxConvertedInvoiceCount,
  timeRangeStart,
  timeRangeEnd,
}: {
  buckets: CurrencyBucket[];
  fxConvertedKRWTotal: number;
  fxConvertedInvoiceCount: number;
  /** STEP 70 — drilldown payload에 inherit (filter sync) */
  timeRangeStart?: string;
  timeRangeEnd?: string;
}) {
  const openDrilldown = useArtworkStore((s) => s.openDrilldown);
  return (
    <section>
      <SectionHeader
        title="통화별 매출 분포"
        hint="인보이스 base currency 기준"
      />
      {buckets.length === 0 ? (
        <EmptyRow text="인보이스 데이터 없음" />
      ) : (
        <div className="rounded-md border border-line overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-muted">
                <Th align="left">통화</Th>
                <Th align="right">건수</Th>
                <Th align="right">통화 단위 합계</Th>
                <Th align="right">KRW 환산</Th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => {
                // STEP 70 — 통화 row 전체 클릭 시 reporting_currency_breakdown
                // drilldown. 빈 통화 (count=0)은 disabled — 사실상 발생 안 하지만
                // 안전 가드.
                const handleClick = () =>
                  openDrilldown({
                    domain: "reporting_currency_breakdown",
                    currency: b.currency,
                    periodFromIso: timeRangeStart,
                    periodToIso: timeRangeEnd,
                  });
                const clickable = b.count > 0;
                return (
                  <tr
                    key={b.currency}
                    onClick={clickable ? handleClick : undefined}
                    role={clickable ? "button" : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleClick();
                            }
                          }
                        : undefined
                    }
                    title={
                      clickable
                        ? `${b.currency} ${b.count}건 — 상세 보기`
                        : undefined
                    }
                    className={cn(
                      "border-t border-line transition-colors",
                      clickable
                        ? "cursor-pointer hover:bg-surface-muted/40 focus-visible:bg-surface-muted/40 focus-visible:outline-none"
                        : "cursor-default"
                    )}
                  >
                    <Td align="left">
                      <span className="font-mono text-[11.5px] tracking-tightish text-ink">
                        {b.currency}
                      </span>
                    </Td>
                    <Td align="right">{b.count}</Td>
                    <Td align="right">
                      <span className="tabular-nums">
                        {formatCurrencyAmount(b.total, b.currency)}
                      </span>
                    </Td>
                    <Td align="right">
                      {b.convertedKRW !== null ? (
                        <span
                          className={cn(
                            "tabular-nums",
                            b.currency === "KRW"
                              ? "text-ink-muted"
                              : "text-ink"
                          )}
                        >
                          {formatKRW(b.convertedKRW)}
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-amber-700 tracking-tightish">
                          ⚠ {b.missingFxCount}건 누락
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {fxConvertedInvoiceCount > 0 && (
        <p className="mt-2 text-[10.5px] text-ink-subtle tracking-tightish">
          외화 합계 {formatKRW(fxConvertedKRWTotal)} · FX snapshot 기준 (lock
          시점 환율)
        </p>
      )}
    </section>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-3 py-2 text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-subtle",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "left" | "right";
}) {
  return (
    <td
      className={cn(
        "px-3 py-2 text-[12px] tracking-tightish text-ink-muted",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      {children}
    </td>
  );
}

// ----------------------------------------------------------------------------
// Status Summary
// ----------------------------------------------------------------------------

function StatusSummarySection({
  aggregates,
}: {
  aggregates: ReportingAggregates;
}) {
  return (
    <section>
      <SectionHeader title="상태별 분포" hint="현재 시스템 내 카운트" />
      <div className="grid grid-cols-3 gap-3">
        <StatusCard
          title="Invoice"
          subTitle="인보이스"
          breakdown={aggregates.invoiceStatusBreakdown}
          labels={INVOICE_STATUS_LABEL_KR as Record<string, string>}
          orderedKeys={["DRAFT", "SENT", "PAID"] as InvoiceStatus[]}
        />
        <StatusCard
          title="Settlement"
          subTitle="정산"
          breakdown={aggregates.settlementStatusBreakdown}
          labels={SETTLEMENT_STATUS_LABEL_KR as Record<string, string>}
          orderedKeys={["PENDING", "READY", "COMPLETED"] as SettlementStatus[]}
        />
        <StatusCard
          title="Tax Record"
          subTitle="세무 기록"
          breakdown={aggregates.taxStatusBreakdown}
          labels={TAX_STATUS_LABEL_KR as Record<string, string>}
          orderedKeys={["PENDING", "READY", "ISSUED"] as TaxRecordStatus[]}
        />
      </div>
    </section>
  );
}

function StatusCard<T extends string>({
  title,
  subTitle,
  breakdown,
  labels,
  orderedKeys,
}: {
  title: string;
  subTitle: string;
  breakdown: Record<T, number>;
  labels: Record<string, string>;
  orderedKeys: T[];
}) {
  const total = orderedKeys.reduce((acc, k) => acc + (breakdown[k] ?? 0), 0);
  return (
    <div className="rounded-md border border-line bg-surface px-3.5 py-3 flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-ink-subtle">
          {title}
        </span>
        <span className="text-[10px] text-ink-subtle tracking-tightish">
          {subTitle}
        </span>
      </div>
      <p className="text-[16px] tabular-nums tracking-tight font-medium text-ink">
        {total}
        <span className="ml-1 text-[10.5px] text-ink-subtle font-normal">건</span>
      </p>
      <div className="flex flex-col gap-1 mt-0.5">
        {orderedKeys.map((k) => {
          const n = breakdown[k] ?? 0;
          return (
            <div
              key={k}
              className="flex items-center justify-between text-[11px] tracking-tightish"
            >
              <span
                className={cn(
                  "tracking-tightish",
                  n > 0 ? "text-ink-muted" : "text-ink-subtle"
                )}
              >
                {labels[k] ?? k}
              </span>
              <span
                className={cn(
                  "tabular-nums",
                  n > 0 ? "text-ink" : "text-ink-subtle"
                )}
              >
                {n}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Footnote (mock provider 표시 + 데이터 신뢰성)
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// STEP 47 — Channel Mix Section View (유입 채널 분포)
//
// 외부 차트 라이브러리 0개 — 모든 bar는 CSS div(width %). Top 3 채널은
// border-ink로 강조. Customer master slice 0개 — read-only ChannelMixSection
// 결과를 그대로 렌더.
// ----------------------------------------------------------------------------

function ChannelMixSectionView({
  channelMix,
  timeRangeStart,
  timeRangeEnd,
}: {
  channelMix: ChannelMixSection;
  /** STEP 70 — drilldown payload에 inherit (filter sync) */
  timeRangeStart?: string;
  timeRangeEnd?: string;
}) {
  const openDrilldown = useArtworkStore((s) => s.openDrilldown);
  const isEmpty = channelMix.totalInquiryCount === 0 && channelMix.buckets.length === 0;
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2.5">
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
          Channel Mix
        </h3>
        <span className="text-[10.5px] text-ink-subtle tracking-tightish">
          유입 채널 기준 · 문의 / 거래 연결 신호
        </span>
      </div>

      {/* Top-line counts (3 stat cards). STEP 70 — 각 카드 ClickableMetric으로
          wrap. source 미지정 → 모든 채널 합계 drilldown. */}
      <div className="grid grid-cols-3 gap-2 mb-3.5">
        <ClickableMetric
          onClick={() =>
            openDrilldown({
              domain: "reporting_channel_inquiries",
              periodFromIso: timeRangeStart,
              periodToIso: timeRangeEnd,
            })
          }
          ariaLabel={`문의 총 ${channelMix.totalInquiryCount}건 — 채널별 상세 보기`}
        >
          <StatCard
            label="문의 (총)"
            value={`${channelMix.totalInquiryCount}건`}
            hint="현재 기간 inquiry"
          />
        </ClickableMetric>
        <ClickableMetric
          onClick={() =>
            openDrilldown({
              domain: "reporting_channel_customers",
              periodFromIso: timeRangeStart,
              periodToIso: timeRangeEnd,
            })
          }
          ariaLabel={`고객 ${channelMix.totalCustomerCount}명 — 채널별 상세 보기`}
        >
          <StatCard
            label="고객 (derive)"
            value={`${channelMix.totalCustomerCount}명`}
            hint="primarySource 기준 분포"
          />
        </ClickableMetric>
        <ClickableMetric
          onClick={() =>
            openDrilldown({
              domain: "reporting_channel_deals",
              periodFromIso: timeRangeStart,
              periodToIso: timeRangeEnd,
            })
          }
          ariaLabel={`거래 총 ${channelMix.totalTransactionCount}건 — 채널별 상세 보기`}
        >
          <StatCard
            label="거래 (총)"
            value={`${channelMix.totalTransactionCount}건`}
            hint={
              channelMix.unattributedTransactionCount > 0
                ? `${channelMix.unattributedTransactionCount}건 attribution 불가`
                : "first-touch 어트리뷰션"
            }
          />
        </ClickableMetric>
      </div>

      {isEmpty ? (
        <div className="rounded-md border border-dashed border-line bg-surface px-4 py-5 text-center">
          <p className="text-[11px] text-ink-subtle tracking-tightish">
            현재 기간에 inquiry / transaction 기록이 없습니다.
          </p>
        </div>
      ) : (
        <ChannelMixTable
          buckets={channelMix.buckets}
          topSources={new Set(channelMix.topSources)}
          timeRangeStart={timeRangeStart}
          timeRangeEnd={timeRangeEnd}
        />
      )}

      {channelMix.unattributedTransactionCount > 0 && (
        <p className="mt-2 text-[10px] text-ink-subtle tracking-tightish">
          ※ {channelMix.unattributedTransactionCount}건의 거래는 동일 작품의
          inquiry 기록 부재로 채널 attribution 불가 — 기간 필터 영향일 수 있음.
        </p>
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-[9.5px] uppercase tracking-[0.1em] text-ink-subtle font-medium">
        {label}
      </span>
      <span className="text-[14px] tabular-nums tracking-tight text-ink font-medium mt-0.5">
        {value}
      </span>
      <span className="text-[9.5px] tracking-tightish text-ink-subtle mt-0.5">
        {hint}
      </span>
    </div>
  );
}

function ChannelMixTable({
  buckets,
  topSources,
  timeRangeStart,
  timeRangeEnd,
}: {
  buckets: ChannelMixBucket[];
  topSources: Set<InquirySource>;
  /** STEP 70 — drilldown payload에 inherit (filter sync) */
  timeRangeStart?: string;
  timeRangeEnd?: string;
}) {
  const openDrilldown = useArtworkStore((s) => s.openDrilldown);
  return (
    <div className="rounded-md border border-line bg-surface overflow-hidden">
      {/* Column header */}
      <div className="grid grid-cols-[1fr_2fr_60px_60px_60px] gap-3 items-center px-3.5 py-2 border-b border-line bg-surface-muted">
        <span className="text-[9.5px] uppercase tracking-[0.08em] text-ink-subtle font-medium">
          채널
        </span>
        <span className="text-[9.5px] uppercase tracking-[0.08em] text-ink-subtle font-medium">
          inquiry 비중
        </span>
        <span className="text-[9.5px] uppercase tracking-[0.08em] text-ink-subtle font-medium text-right">
          문의
        </span>
        <span className="text-[9.5px] uppercase tracking-[0.08em] text-ink-subtle font-medium text-right">
          고객
        </span>
        <span className="text-[9.5px] uppercase tracking-[0.08em] text-ink-subtle font-medium text-right">
          거래
        </span>
      </div>
      {/* Rows */}
      {buckets.map((b) => {
        const isTop = topSources.has(b.source);
        return (
          <div
            key={b.source}
            className={cn(
              "grid grid-cols-[1fr_2fr_60px_60px_60px] gap-3 items-center px-3.5 py-2.5",
              "border-b border-line last:border-b-0",
              isTop && "bg-surface-muted/40"
            )}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={cn(
                  "text-[11.5px] tracking-tightish truncate",
                  isTop ? "text-ink font-medium" : "text-ink-muted"
                )}
              >
                {INQUIRY_SOURCE_LABEL_KR[b.source]}
              </span>
              {isTop && (
                <span className="shrink-0 px-1.5 py-0.5 rounded-full border border-ink text-[9px] tracking-tightish text-ink">
                  TOP
                </span>
              )}
            </div>
            <ChannelBar share={b.inquiryShare} isTop={isTop} />
            {/* STEP 70 — 3 metric cells 모두 ClickableMetric으로 wrap. source는
                bucket source inherit. count 0이면 disabled. */}
            <ClickableMetric
              onClick={
                b.inquiryCount > 0
                  ? () =>
                      openDrilldown({
                        domain: "reporting_channel_inquiries",
                        source: b.source,
                        periodFromIso: timeRangeStart,
                        periodToIso: timeRangeEnd,
                      })
                  : undefined
              }
              disabled={b.inquiryCount === 0}
              ariaLabel={`${INQUIRY_SOURCE_LABEL_KR[b.source]} 채널 문의 ${b.inquiryCount}건 — 상세 보기`}
              className="block px-1 py-0.5 -my-0.5"
            >
              <span className="block text-[11px] tabular-nums text-right text-ink">
                {b.inquiryCount}
              </span>
            </ClickableMetric>
            <ClickableMetric
              onClick={
                b.customerCount > 0
                  ? () =>
                      openDrilldown({
                        domain: "reporting_channel_customers",
                        source: b.source,
                        periodFromIso: timeRangeStart,
                        periodToIso: timeRangeEnd,
                      })
                  : undefined
              }
              disabled={b.customerCount === 0}
              ariaLabel={`${INQUIRY_SOURCE_LABEL_KR[b.source]} 채널 고객 ${b.customerCount}명 — 상세 보기`}
              className="block px-1 py-0.5 -my-0.5"
            >
              <span className="block text-[11px] tabular-nums text-right text-ink-muted">
                {b.customerCount}
              </span>
            </ClickableMetric>
            <ClickableMetric
              onClick={
                b.transactionCount > 0
                  ? () =>
                      openDrilldown({
                        domain: "reporting_channel_deals",
                        source: b.source,
                        periodFromIso: timeRangeStart,
                        periodToIso: timeRangeEnd,
                      })
                  : undefined
              }
              disabled={b.transactionCount === 0}
              ariaLabel={`${INQUIRY_SOURCE_LABEL_KR[b.source]} 채널 거래 ${b.transactionCount}건 — 상세 보기`}
              className="block px-1 py-0.5 -my-0.5"
            >
              <span className="block text-[11px] tabular-nums text-right text-ink-muted">
                {b.transactionCount}
              </span>
            </ClickableMetric>
          </div>
        );
      })}
    </div>
  );
}

function ChannelBar({ share, isTop }: { share: number; isTop: boolean }) {
  // 외부 차트 라이브러리 0개 — CSS div의 width % 기반 단순 bar.
  const widthPct = Math.max(2, Math.min(100, share));
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-2 rounded-full bg-surface-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isTop ? "bg-ink" : "bg-ink-muted/60"
          )}
          style={{ width: `${widthPct}%` }}
          aria-hidden
        />
      </div>
      <span className="shrink-0 w-12 text-right text-[10.5px] tabular-nums text-ink-subtle">
        {share.toFixed(1)}%
      </span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Footnote (mock provider 표시 + 데이터 신뢰성)
// ----------------------------------------------------------------------------

function FootnoteSection({
  fxSourceIsMock,
  fxProviderId,
}: {
  fxSourceIsMock: boolean;
  fxProviderId: string | null;
}) {
  return (
    <div className="rounded-md border border-dashed border-line bg-surface px-3.5 py-2.5 flex flex-col gap-1">
      <p className="text-[10.5px] text-ink-subtle tracking-tightish leading-relaxed">
        FX 환산은 각 인보이스의 lock 시점 환율 (Invoice.fxSnapshot)을 기준으로
        합니다. Settlement / Tax는 해당 invoice의 환율을 propagate합니다.
      </p>
      {fxSourceIsMock && (
        <p className="text-[10.5px] text-amber-700 tracking-tightish">
          ⚠ 현재 FX provider는 mock 데이터입니다
          {fxProviderId && (
            <span className="ml-1 font-mono text-[10px]">({fxProviderId})</span>
          )}{" "}
          — 실 환율과 차이가 있을 수 있습니다.
        </p>
      )}
      <p className="text-[10.5px] text-ink-subtle tracking-tightish">
        본 리포트는 <span className="text-ink-muted">운영 참고용</span>이며 회계
        확정 / 세무 신고 권한 / 외부 보고와 무관합니다.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Shared sub-components
// ----------------------------------------------------------------------------

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-2.5">
      <h3 className="text-[12px] font-semibold tracking-tightish text-ink">
        {title}
      </h3>
      {hint && (
        <span className="text-[10.5px] text-ink-subtle tracking-tightish">
          {hint}
        </span>
      )}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-line px-3.5 py-3.5 text-center">
      <p className="text-[12px] text-ink-subtle tracking-tightish">{text}</p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// STEP 35.6 — Export button
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
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      title={disabled ? "내보낼 데이터 없음" : `${label}로 내보내기`}
      className={cn(
        "h-7 px-3 rounded-md text-[11px] tracking-tightish border transition-colors",
        disabled
          ? "border-line text-ink-subtle opacity-50 cursor-not-allowed"
          : "border-line text-ink-muted hover:bg-surface-muted hover:text-ink cursor-pointer"
      )}
    >
      {label}
    </button>
  );
}

// ----------------------------------------------------------------------------
// STEP 35.5 — Time Filter Bar
// ----------------------------------------------------------------------------

const PRESET_CHIPS: Array<{ value: ReportingTimePreset; label: string }> = [
  { value: "ALL",          label: "전체" },
  { value: "THIS_MONTH",   label: "이번 달" },
  { value: "THIS_QUARTER", label: "이번 분기" },
  { value: "CUSTOM",       label: "사용자 지정" },
];

function TimeFilterBar({
  state,
  onChange,
}: {
  state: ReportingTimeFilter;
  onChange: (next: ReportingTimeFilter) => void;
}) {
  const label = formatTimeFilterLabel(state);
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase mr-1">
            기간
          </span>
          {PRESET_CHIPS.map((opt) => {
            const active = state.preset === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  onChange({
                    preset: opt.value,
                    customStart:
                      opt.value === "CUSTOM" ? state.customStart : "",
                    customEnd: opt.value === "CUSTOM" ? state.customEnd : "",
                  })
                }
                className={cn(
                  "h-6 px-2.5 rounded-full text-[11px] tracking-tightish border transition-colors",
                  active
                    ? "bg-ink text-white border-ink"
                    : "bg-surface text-ink-muted border-line hover:bg-surface-muted hover:text-ink"
                )}
                aria-pressed={active}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <span className="text-[10.5px] tabular-nums tracking-tightish text-ink-subtle truncate max-w-[18rem]">
          {label}
        </span>
      </div>
      {state.preset === "CUSTOM" && (
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold w-12 shrink-0">
            범위
          </span>
          <input
            type="date"
            value={state.customStart}
            onChange={(e) =>
              onChange({ ...state, customStart: e.target.value })
            }
            max={state.customEnd || undefined}
            className="h-7 px-2 rounded border border-line bg-surface text-[11.5px] text-ink tracking-tightish focus:outline-none focus:border-line-strong"
            aria-label="시작일"
          />
          <span className="text-[10.5px] text-ink-subtle">~</span>
          <input
            type="date"
            value={state.customEnd}
            onChange={(e) => onChange({ ...state, customEnd: e.target.value })}
            min={state.customStart || undefined}
            className="h-7 px-2 rounded border border-line bg-surface text-[11.5px] text-ink tracking-tightish focus:outline-none focus:border-line-strong"
            aria-label="종료일"
          />
        </div>
      )}
    </div>
  );
}
