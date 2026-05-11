"use client";

import * as React from "react";
import { useArtworkStore } from "@/store/useArtworkStore";
import { Button } from "@/components/ui/Button";
import {
  formatRelativeKR,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_COLOR,
} from "@/lib/utils";
import { permissionHint, hasPermission } from "@/lib/rbac";
import { ButtonHint } from "@/components/ui/ButtonHint";
import type { ContractStatus } from "@/types/contract";

interface ContractSummaryProps {
  artworkId: string;
}

export function ContractSummary({ artworkId }: ContractSummaryProps) {
  const transactions = useArtworkStore((s) => s.transactions);
  const contracts = useArtworkStore((s) => s.contracts);
  const openContractDetail = useArtworkStore((s) => s.openContractDetail);
  const createContract = useArtworkStore((s) => s.createContract);
  const approveContract = useArtworkStore((s) => s.approveContract);
  const lockContract = useArtworkStore((s) => s.lockContract);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const tx = (transactions[artworkId] ?? [])[0];
  const list = tx ? contracts[tx.id] ?? [] : [];
  const latest = list[0];

  if (!tx) return null;

  const canApprove = hasPermission(currentRole, "contract.approve");
  const canLock = hasPermission(currentRole, "contract.lock");

  return (
    <section className="px-6 py-5 border-b border-line">
      <SectionHeader
        label="Contract"
        hint={
          latest
            ? `v${latest.version} · ${CONTRACT_STATUS_LABEL[latest.status]}`
            : "AI-Human loop"
        }
      />

      {latest ? (
        <>
          <div className="mt-3 rounded-md border border-line p-3.5">
            {/* Status row */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <StatusPill status={latest.status} />
                {latest.status === "LOCKED" && <LockMiniIcon />}
              </div>
              <span className="text-[10.5px] text-ink-subtle font-mono tabular-nums tracking-tightish">
                v{latest.version}
              </span>
            </div>

            {/* Content preview — first non-empty line */}
            <p className="text-[12px] text-ink-muted leading-relaxed tracking-tightish line-clamp-2">
              {firstNonEmptyLine(latest.content)}
            </p>

            {/* Timestamps */}
            <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
              <span className="text-[10.5px] text-ink-subtle tracking-tightish">
                마지막 수정
              </span>
              <span className="text-[10.5px] text-ink-muted tabular-nums tracking-tightish">
                {formatRelativeKR(latest.updatedAt)}
              </span>
            </div>
          </div>

          <div className="mt-2.5 flex flex-col gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-between"
              onClick={() => openContractDetail(latest.id)}
            >
              <span>계약 상세</span>
              <ChevronRightIcon />
            </Button>

            {/* State-conditional inline actions (rule_15: max 3 actions) */}
            {latest.status === "REVIEW" && (
              <div className="flex flex-col gap-1">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => approveContract(latest.id)}
                  disabled={!canApprove}
                  aria-disabled={!canApprove}
                >
                  승인
                </Button>
                {!canApprove && (
                  <ButtonHint
                    tone="permission"
                    text={permissionHint("contract.approve")}
                  />
                )}
              </div>
            )}
            {latest.status === "APPROVED" && (
              <div className="flex flex-col gap-1">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => lockContract(latest.id)}
                  disabled={!canLock}
                  aria-disabled={!canLock}
                >
                  LOCK
                </Button>
                {!canLock && (
                  <ButtonHint
                    tone="permission"
                    text={permissionHint("contract.lock")}
                  />
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 rounded-md border border-dashed border-line p-3.5">
            <p className="text-[12px] text-ink-muted tracking-tightish">
              아직 계약서가 없습니다.
            </p>
            <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1">
              AXVELA AI가 작품·거래 정보를 바탕으로 운영 참고 초안을 제안합니다.
            </p>
          </div>
          <div className="mt-2.5">
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() => createContract(tx.id)}
            >
              계약 생성
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

function firstNonEmptyLine(content: string): string {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return "(빈 계약서)";
}

function StatusPill({ status }: { status: ContractStatus }) {
  const color = CONTRACT_STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{CONTRACT_STATUS_LABEL[status]}</span>
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

function LockMiniIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 text-ink-subtle shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="잠김"
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
