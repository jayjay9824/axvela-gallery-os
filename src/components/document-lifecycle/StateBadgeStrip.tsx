"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
  DocumentStateBadge,
  DocumentStateBadgeKind,
} from "@/lib/document-lifecycle";

// ============================================================================
// StateBadgeStrip — Document state badge 모음 (monochrome / 절제 / rule_16).
//
// **사용자 spec (State Badge Refinement 항목 6)**:
//   "Refine existing badges: 초안 / 발송 완료 / 결제 완료 / 잠금 / 새 버전 존재"
//   "Rules: monochrome / restrained / elegant / no rainbow enterprise UI"
//
// **시각 정책**:
//   - 모든 badge는 ink / ink-muted / ink-subtle 톤만 사용 — 채도 있는 색조 0건
//   - 작은 dot 표시 (의미 있는 상태일 때만 — locked / current sent / paid)
//   - 그림자 0 / 둥근 모서리 / 절제된 padding
//
// 기존 InvoiceDetailDrawer의 `StatusPill` (status별 색조)는 그대로 두고, 본
// 컴포넌트는 *복수 상태 표시* 용도로 추가. 두 시스템 공존 — StatusPill은 single
// status, 본 strip은 multi-badge composition (locked + sent + new_version 등).
// ============================================================================

interface StateBadgeStripProps {
  badges: ReadonlyArray<DocumentStateBadge>;
  className?: string;
}

const BADGE_TONE: Record<
  DocumentStateBadgeKind,
  { container: string; dot?: string }
> = {
  draft: {
    container: "bg-surface border-line text-ink-subtle",
  },
  sent: {
    container: "bg-surface border-line-strong text-ink",
    dot: "bg-ink-muted",
  },
  paid: {
    container: "bg-surface border-line-strong text-ink",
    dot: "bg-ink",
  },
  locked: {
    container: "bg-ink/[0.04] border-line text-ink-muted",
  },
  newer_version_exists: {
    container: "bg-surface-muted/60 border-line/60 text-ink-subtle italic",
  },
};

export function StateBadgeStrip({ badges, className }: StateBadgeStripProps) {
  if (badges.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {badges.map((badge) => (
        <StateBadge key={badge.kind} badge={badge} />
      ))}
    </div>
  );
}

function StateBadge({ badge }: { badge: DocumentStateBadge }) {
  const tone = BADGE_TONE[badge.kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-tightish border",
        tone.container
      )}
    >
      {tone.dot && (
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 rounded-full", tone.dot)}
        />
      )}
      <span>{badge.label}</span>
    </span>
  );
}
