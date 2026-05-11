"use client";

import * as React from "react";
import { useArtworkStore } from "@/store/useArtworkStore";
import { Button } from "@/components/ui/Button";
import {
  formatRelativeKR,
  LOGISTICS_STATUS_LABEL,
  LOGISTICS_STATUS_COLOR,
  CONDITION_STATUS_LABEL,
  CONDITION_STATUS_COLOR,
  REPORT_TYPE_LABEL,
} from "@/lib/utils";
import type {
  Logistics,
  LogisticsStatus,
} from "@/types/logistics";
import type {
  ConditionReport,
  ConditionStatus,
  ReportType,
} from "@/types/condition-report";

interface LogisticsSummaryProps {
  artworkId: string;
}

export function LogisticsSummary({ artworkId }: LogisticsSummaryProps) {
  const transactions = useArtworkStore((s) => s.transactions);
  const logistics = useArtworkStore((s) => s.logistics);
  const conditionReports = useArtworkStore((s) => s.conditionReports);
  const createLogistics = useArtworkStore((s) => s.createLogistics);
  const openLogisticsDetail = useArtworkStore((s) => s.openLogisticsDetail);
  const openConditionReportCreate = useArtworkStore(
    (s) => s.openConditionReportCreate
  );
  const openConditionReportEdit = useArtworkStore(
    (s) => s.openConditionReportEdit
  );

  const tx = (transactions[artworkId] ?? [])[0];
  const log = tx ? (logistics[tx.id] ?? [])[0] : undefined;
  const reports = tx ? conditionReports[tx.id] ?? [] : [];
  const beforeReport = log
    ? reports.find(
        (r) => r.logisticsId === log.id && r.reportType === "BEFORE_SHIPMENT"
      )
    : undefined;
  const afterReport = log
    ? reports.find(
        (r) => r.logisticsId === log.id && r.reportType === "AFTER_DELIVERY"
      )
    : undefined;

  if (!tx) return null;

  // Determine which condition report (if any) the contextual primary button
  // should target. Logic:
  //   - No BEFORE yet (any non-CONDITION_CHECKED status): create BEFORE
  //   - status === DELIVERED + no AFTER yet: create AFTER
  //   - otherwise: hide button
  const nextReportToCreate: ReportType | null = (() => {
    if (!log) return null;
    if (log.status === "CONDITION_CHECKED") return null;
    if (!beforeReport) return "BEFORE_SHIPMENT";
    if (log.status === "DELIVERED" && !afterReport) return "AFTER_DELIVERY";
    return null;
  })();

  return (
    <section className="px-6 py-5 border-b border-line">
      <SectionHeader
        label="Logistics"
        hint={log ? LOGISTICS_STATUS_LABEL[log.status] : "배송 / 컨디션"}
      />

      {log ? (
        <>
          <div className="mt-3 rounded-md border border-line p-3.5">
            {/* Status row */}
            <div className="flex items-center justify-between mb-3">
              <StatusPill status={log.status} />
              <span className="text-[10.5px] text-ink-subtle tabular-nums tracking-tightish">
                {formatRelativeKR(log.updatedAt)}
              </span>
            </div>

            {/* Carrier / tracking — compact rows */}
            <dl className="space-y-1.5 text-[12px] tracking-tightish">
              <Row
                label="운송사"
                value={log.carrierName || "—"}
                muted={!log.carrierName}
              />
              <Row
                label="운송장"
                value={log.trackingNumber || "—"}
                muted={!log.trackingNumber}
                mono
              />
              {(log.pickupDate || log.deliveryDate) && (
                <Row
                  label="일정"
                  value={
                    [
                      log.pickupDate ? `픽업 ${log.pickupDate}` : null,
                      log.deliveryDate ? `인도 ${log.deliveryDate}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"
                  }
                />
              )}
            </dl>

            {/* Condition reports — clickable rows */}
            <div className="mt-3 pt-3 border-t border-line space-y-1.5">
              <ReportRow
                label="출고 전"
                report={beforeReport}
                onEdit={openConditionReportEdit}
              />
              <ReportRow
                label="인도 후"
                report={afterReport}
                onEdit={openConditionReportEdit}
              />
            </div>
          </div>

          <div className="mt-2.5 flex flex-col gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-between"
              onClick={() => openLogisticsDetail(log.id)}
            >
              <span>배송 관리</span>
              <ChevronRightIcon />
            </Button>
            {nextReportToCreate && (
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={() =>
                  openConditionReportCreate(log.id, nextReportToCreate)
                }
              >
                {nextReportToCreate === "BEFORE_SHIPMENT"
                  ? "출고 전 컨디션 작성"
                  : "인도 후 컨디션 작성"}
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 rounded-md border border-dashed border-line p-3.5">
            <p className="text-[12px] text-ink-muted tracking-tightish">
              아직 배송 정보가 없습니다.
            </p>
            <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1">
              결제가 완료된 작품의 출고 절차를 시작합니다.
            </p>
          </div>
          <div className="mt-2.5">
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() => createLogistics(tx.id)}
            >
              배송 준비
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Local primitives
// ---------------------------------------------------------------------------

function Row({
  label,
  value,
  muted,
  mono,
}: {
  label: string;
  value: string;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[10.5px] text-ink-subtle tracking-tightish uppercase font-semibold w-14 shrink-0">
        {label}
      </dt>
      <dd
        className={`text-right tracking-tightish min-w-0 truncate ${
          muted ? "text-ink-subtle" : "text-ink-muted"
        } ${mono ? "font-mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function ReportRow({
  label,
  report,
  onEdit,
}: {
  label: string;
  report: ConditionReport | undefined;
  onEdit: (reportId: string) => void;
}) {
  if (!report) {
    return (
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10.5px] text-ink-subtle tracking-tightish uppercase font-semibold w-14 shrink-0">
          {label}
        </span>
        <span className="text-[12px] text-ink-subtle tracking-tightish">
          미작성
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onEdit(report.id)}
      className="w-full flex items-center justify-between gap-3 -mx-1 px-1 py-0.5 rounded hover:bg-surface-muted transition-colors"
    >
      <span className="text-[10.5px] text-ink-subtle tracking-tightish uppercase font-semibold w-14 shrink-0 text-left">
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        <ConditionPill status={report.conditionStatus} />
        <ChevronRightIcon />
      </span>
    </button>
  );
}

function StatusPill({ status }: { status: LogisticsStatus }) {
  const color = LOGISTICS_STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{LOGISTICS_STATUS_LABEL[status]}</span>
    </span>
  );
}

function ConditionPill({ status }: { status: ConditionStatus }) {
  const color = CONDITION_STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{CONDITION_STATUS_LABEL[status]}</span>
    </span>
  );
}

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="text-[11px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
        {label}
      </h3>
      {hint && (
        <span className="text-[10.5px] text-ink-subtle tracking-tightish">
          {hint}
        </span>
      )}
    </div>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
