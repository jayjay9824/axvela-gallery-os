"use client";

import { useArtworkStore } from "@/store/useArtworkStore";
import { Button } from "@/components/ui/Button";
import {
  formatMoney,
  formatRelativeKR,
  TAX_RECORD_STATUS_LABEL,
  TAX_RECORD_STATUS_COLOR,
  TAX_TYPE_LABEL,
} from "@/lib/utils";
import { permissionHint, hasPermission } from "@/lib/rbac";
import { ButtonHint } from "@/components/ui/ButtonHint";
import type { TaxRecordStatus } from "@/types/tax";

interface TaxSummaryProps {
  artworkId: string;
}

export function TaxSummary({ artworkId }: TaxSummaryProps) {
  const transactions = useArtworkStore((s) => s.transactions);
  const settlements = useArtworkStore((s) => s.settlements);
  const taxRecords = useArtworkStore((s) => s.taxRecords);
  const openTaxDetail = useArtworkStore((s) => s.openTaxDetail);
  const createTaxRecord = useArtworkStore((s) => s.createTaxRecord);
  const issueTaxRecord = useArtworkStore((s) => s.issueTaxRecord);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const canIssue = hasPermission(currentRole, "tax.issue");

  const tx = (transactions[artworkId] ?? [])[0];
  const settlement = tx ? (settlements[tx.id] ?? [])[0] : undefined;
  const taxRecord = tx ? (taxRecords[tx.id] ?? [])[0] : undefined;

  // Don't render if no transaction yet
  if (!tx) return null;

  const settlementCompleted = settlement?.status === "COMPLETED";

  return (
    <section className="px-6 py-5 border-b border-line">
      <SectionHeader
        label="Tax"
        hint={
          taxRecord
            ? TAX_RECORD_STATUS_LABEL[taxRecord.status]
            : "세무 기록"
        }
      />

      {taxRecord ? (
        <>
          <div className="mt-3 rounded-md border border-line p-3.5">
            {/* Status row */}
            <div className="flex items-center justify-between mb-2.5">
              <StatusPill status={taxRecord.status} />
              <span className="text-[10.5px] text-ink-subtle tracking-tightish">
                {taxRecord.issuedAt
                  ? formatRelativeKR(taxRecord.issuedAt)
                  : formatRelativeKR(taxRecord.createdAt)}
              </span>
            </div>

            {/* Tax type label */}
            <p className="text-[12px] font-semibold text-ink tracking-tight2">
              {TAX_TYPE_LABEL[taxRecord.taxType]}
            </p>

            {/* Tax breakdown */}
            <div className="mt-3 pt-3 border-t border-line space-y-2">
              <BreakdownRow
                label="과세 기준"
                amount={formatMoney(
                  taxRecord.taxableAmount,
                  taxRecord.currency
                )}
                emphasized
              />
              <BreakdownRow
                label="부가세 (VAT)"
                amount={formatMoney(taxRecord.vatAmount, taxRecord.currency)}
                pct="10%"
              />
              <BreakdownRow
                label="원천세"
                amount={formatMoney(
                  taxRecord.withholdingAmount,
                  taxRecord.currency
                )}
                muted={taxRecord.withholdingAmount === 0}
              />
            </div>
          </div>

          <div className="mt-2.5 flex flex-col gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-between"
              onClick={() => openTaxDetail(taxRecord.id)}
            >
              <span>세무 기록 보기</span>
              <ChevronRightIcon />
            </Button>
            {taxRecord.status !== "ISSUED" && (
              <div className="flex flex-col gap-1">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => issueTaxRecord(taxRecord.id)}
                  disabled={!canIssue}
                  aria-disabled={!canIssue}
                >
                  세무 발행 완료
                </Button>
                {!canIssue && (
                  <ButtonHint
                    tone="permission"
                    text={permissionHint("tax.issue")}
                  />
                )}
              </div>
            )}
          </div>
        </>
      ) : settlementCompleted ? (
        // Edge case: settlement done but no TaxRecord (legacy data)
        <>
          <div className="mt-3 rounded-md border border-dashed border-line p-3.5">
            <p className="text-[12px] text-ink-muted tracking-tightish">
              정산은 완료됐지만 세무 기록이 없습니다.
            </p>
            <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1">
              아래 버튼으로 매출 기록 (VAT 10%)을 생성하세요.
            </p>
          </div>
          <div className="mt-2.5">
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() => createTaxRecord(settlement!.id)}
            >
              세무 기록 생성
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-line p-3.5">
          <p className="text-[12px] text-ink-muted tracking-tightish">
            아직 세무 기록이 없습니다.
          </p>
          <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1">
            정산 완료 시 매출 기록이 자동 생성됩니다.
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Local primitives
// ---------------------------------------------------------------------------

function BreakdownRow({
  label,
  amount,
  pct,
  emphasized,
  muted,
}: {
  label: string;
  amount: string;
  pct?: string;
  emphasized?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span
          className={`text-[12px] tracking-tightish ${
            emphasized
              ? "text-ink font-medium"
              : muted
              ? "text-ink-subtle"
              : "text-ink-muted"
          }`}
        >
          {label}
        </span>
        {pct && (
          <span className="text-[10.5px] text-ink-subtle tracking-tightish font-mono tabular-nums">
            {pct}
          </span>
        )}
      </div>
      <span
        className={`text-[12.5px] tabular-nums tracking-tight2 ${
          emphasized
            ? "text-ink font-semibold"
            : muted
            ? "text-ink-subtle"
            : "text-ink-muted"
        }`}
      >
        {amount}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: TaxRecordStatus }) {
  const color = TAX_RECORD_STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{TAX_RECORD_STATUS_LABEL[status]}</span>
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
