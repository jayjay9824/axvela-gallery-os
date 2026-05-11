"use client";

import * as React from "react";
import { cn, formatMoney } from "@/lib/utils";
import type { VersionChainEntry } from "@/lib/document-lifecycle";

// ============================================================================
// VersionHistoryStrip — Invoice version chain 시각화.
//
// **데이터 source**: `buildInvoiceVersionChain(targetInvoice, allInvoicesForTx)`
//   - 최신 → 오래된 순 (current 1개, replaced 1개, archived n개)
//   - role 별 시각 차등 — current 강조 / replaced 흐림 / archived 더 흐림
//
// **사용자 spec 일관**:
//   - "current visually emphasized"
//   - "old versions collapsed/subtle"
//   - "instant understanding of official version"
//
// **rule_16 minimalism**:
//   - 작은 typography
//   - 그림자 0
//   - rainbow / 강한 색조 0
//   - 채도 낮은 monochrome 톤
// ============================================================================

interface VersionHistoryStripProps {
  chain: ReadonlyArray<VersionChainEntry>;
  /** 현재 drawer가 표시 중인 invoice id — 본 entry는 outline 추가. */
  currentlyViewingId?: string;
  /** version row 클릭 시 해당 invoice drawer 전환 (옵셔널). */
  onJumpToVersion?: (invoiceId: string) => void;
  className?: string;
}

export function VersionHistoryStrip({
  chain,
  currentlyViewingId,
  onJumpToVersion,
  className,
}: VersionHistoryStripProps) {
  if (chain.length === 0) return null;

  // 단일 version (chain head 본인뿐) → 표시 생략 (정보 가치 0)
  if (chain.length === 1) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[9px] uppercase tracking-[0.16em] text-ink-subtle font-semibold mb-1">
        버전 이력
      </span>
      {chain.map((entry, index) => (
        <VersionRow
          key={entry.invoice.id}
          entry={entry}
          isViewing={entry.invoice.id === currentlyViewingId}
          isLast={index === chain.length - 1}
          onClick={
            onJumpToVersion
              ? () => onJumpToVersion(entry.invoice.id)
              : undefined
          }
        />
      ))}
    </div>
  );
}

// ============================================================================
// Single version row
// ============================================================================

function VersionRow({
  entry,
  isViewing,
  isLast,
  onClick,
}: {
  entry: VersionChainEntry;
  isViewing: boolean;
  isLast: boolean;
  onClick?: () => void;
}) {
  const { invoice, role, hint } = entry;

  // role 별 톤 설정
  const isCurrent = role === "current";
  const isReplaced = role === "replaced";

  const labelTone = isCurrent
    ? "text-ink font-semibold"
    : isReplaced
      ? "text-ink-muted"
      : "text-ink-subtle";

  const hintTone = isCurrent
    ? "text-ink-muted"
    : "text-ink-subtle/80";

  const containerTone = isCurrent
    ? "bg-surface border border-line-strong"
    : isReplaced
      ? "bg-surface-muted/40 border border-line/60"
      : "bg-transparent border border-line/40";

  const Wrapper: "button" | "div" = onClick && !isCurrent ? "button" : "div";

  return (
    <>
      <Wrapper
        type={Wrapper === "button" ? "button" : undefined}
        onClick={onClick && !isCurrent ? onClick : undefined}
        className={cn(
          "flex items-baseline justify-between gap-2 px-2.5 py-1.5 rounded text-left",
          containerTone,
          isViewing && "ring-1 ring-ink/15",
          Wrapper === "button" && "hover:bg-surface-muted transition-colors cursor-pointer"
        )}
      >
        <div className="flex items-baseline gap-2 min-w-0 flex-1">
          <span
            className={cn(
              "text-[11.5px] tracking-tightish tabular-nums",
              labelTone
            )}
          >
            v{invoice.version}
            {isCurrent && (
              <span className="ml-1.5 text-[9px] uppercase tracking-[0.14em] text-ink-subtle font-semibold">
                현재
              </span>
            )}
          </span>
          <span
            className={cn(
              "text-[10px] tracking-tightish truncate",
              hintTone
            )}
          >
            {hint}
          </span>
        </div>
        <span
          className={cn(
            "text-[9.5px] tracking-tightish shrink-0 tabular-nums",
            hintTone
          )}
        >
          {formatMoney(invoice.amount, invoice.currency)}
        </span>
      </Wrapper>
      {!isLast && (
        <span aria-hidden className="ml-2 text-[9px] text-ink-subtle/60 leading-none">
          ↓
        </span>
      )}
    </>
  );
}
