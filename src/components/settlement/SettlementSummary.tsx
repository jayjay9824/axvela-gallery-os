"use client";

import { useArtworkStore } from "@/store/useArtworkStore";
import { Button } from "@/components/ui/Button";
import {
  formatMoney,
  formatRelativeKR,
  SETTLEMENT_STATUS_LABEL,
  SETTLEMENT_STATUS_COLOR,
  SETTLEMENT_POLICY,
} from "@/lib/utils";
import { permissionHint, hasPermission } from "@/lib/rbac";
import { ButtonHint } from "@/components/ui/ButtonHint";
import type { SettlementStatus } from "@/types/settlement";

interface SettlementSummaryProps {
  artworkId: string;
}

export function SettlementSummary({ artworkId }: SettlementSummaryProps) {
  const transactions = useArtworkStore((s) => s.transactions);
  const payments = useArtworkStore((s) => s.payments);
  const settlements = useArtworkStore((s) => s.settlements);
  const openSettlementDetail = useArtworkStore(
    (s) => s.openSettlementDetail
  );
  const createSettlement = useArtworkStore((s) => s.createSettlement);
  const completeSettlement = useArtworkStore((s) => s.completeSettlement);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const canComplete = hasPermission(currentRole, "settlement.complete");

  const tx = (transactions[artworkId] ?? [])[0];
  const settlement = tx ? (settlements[tx.id] ?? [])[0] : undefined;
  const hasPayment = tx
    ? (payments[tx.id] ?? []).some((p) => p.status === "RECEIVED")
    : false;

  // Don't render the section at all if there's no transaction yet
  if (!tx) return null;

  return (
    <section className="px-6 py-5 border-b border-line">
      <SectionHeader
        label="Settlement"
        hint={
          settlement
            ? SETTLEMENT_STATUS_LABEL[settlement.status]
            : "내부 정산"
        }
      />

      {settlement ? (
        <>
          <div className="mt-3 rounded-md border border-line p-3.5">
            {/* Status row */}
            <div className="flex items-center justify-between mb-2.5">
              <StatusPill status={settlement.status} />
              <span className="text-[10.5px] text-ink-subtle tracking-tightish">
                {settlement.settledAt
                  ? formatRelativeKR(settlement.settledAt)
                  : formatRelativeKR(settlement.createdAt)}
              </span>
            </div>

            {/* Total — headline */}
            <div>
              <p className="text-[10px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
                총 정산액
              </p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[18px] font-semibold text-ink tracking-tight2 tabular-nums">
                  {formatMoney(settlement.totalAmount, settlement.currency)}
                </span>
                <span className="text-[10.5px] text-ink-subtle tracking-tightish font-mono">
                  {settlement.currency}
                </span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="mt-3 pt-3 border-t border-line space-y-2">
              <BreakdownRow
                label="작가"
                pct={SETTLEMENT_POLICY.artistRate}
                amount={formatMoney(
                  settlement.artistShare,
                  settlement.currency
                )}
                emphasized
              />
              <BreakdownRow
                label="갤러리"
                pct={SETTLEMENT_POLICY.galleryRate}
                amount={formatMoney(
                  settlement.galleryShare,
                  settlement.currency
                )}
              />
              {typeof settlement.platformFee === "number" &&
                settlement.platformFee > 0 && (
                  <BreakdownRow
                    label="플랫폼 수수료"
                    pct={null}
                    amount={formatMoney(
                      settlement.platformFee,
                      settlement.currency
                    )}
                    muted
                  />
                )}
            </div>
          </div>

          <div className="mt-2.5 flex flex-col gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-between"
              onClick={() => openSettlementDetail(settlement.id)}
            >
              <span>정산 상세</span>
              <ChevronRightIcon />
            </Button>
            {settlement.status !== "COMPLETED" && (
              <div className="flex flex-col gap-1">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => completeSettlement(settlement.id)}
                  disabled={!canComplete}
                  aria-disabled={!canComplete}
                >
                  정산 완료
                </Button>
                {!canComplete && (
                  <ButtonHint
                    tone="permission"
                    text={permissionHint("settlement.complete")}
                  />
                )}
              </div>
            )}
          </div>
        </>
      ) : hasPayment ? (
        // Edge case: payment exists but no settlement (legacy data / failed cascade)
        <>
          <div className="mt-3 rounded-md border border-dashed border-line p-3.5">
            <p className="text-[12px] text-ink-muted tracking-tightish">
              결제는 수령됐지만 정산 레코드가 없습니다.
            </p>
            <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1">
              아래 버튼으로 분배(작가 60% · 갤러리 40%)를 생성하세요.
            </p>
          </div>
          <div className="mt-2.5">
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() => createSettlement(tx.id)}
            >
              정산 생성
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-line p-3.5">
          <p className="text-[12px] text-ink-muted tracking-tightish">
            아직 정산할 결제가 없습니다.
          </p>
          <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1">
            결제 등록 시 자동으로 정산 초안이 생성됩니다.
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
  pct,
  amount,
  emphasized,
  muted,
}: {
  label: string;
  pct: number | null;
  amount: string;
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
        {pct !== null && (
          <span className="text-[10.5px] text-ink-subtle tracking-tightish font-mono tabular-nums">
            {Math.round(pct * 100)}%
          </span>
        )}
      </div>
      <span
        className={`text-[12.5px] tabular-nums tracking-tight2 ${
          emphasized ? "text-ink font-semibold" : "text-ink-muted"
        }`}
      >
        {amount}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: SettlementStatus }) {
  const color = SETTLEMENT_STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{SETTLEMENT_STATUS_LABEL[status]}</span>
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
