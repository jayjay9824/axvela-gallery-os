"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { NextActionMeta } from "@/lib/document-lifecycle";

// ============================================================================
// NextActionBanner — Document drawer 최상단의 *지금 해야 할 1개* 표시.
//
// **설계 원칙**:
//   - STEP UX-1 Action Clarity 정책 일관: Primary 1개만 강조, 나머지는 작은 톤.
//   - rule_16 minimalism — 작은 typography / 절제된 색조 / 그림자 0.
//   - 사용자 spec: "show ONE operational next action only" / "black button only
//     for highest-priority action".
//
// **tone 정책**:
//   - primary  → 검은 left-border accent + 검은 텍스트 (가장 강한 신호)
//   - info     → 회색 left-border accent + 검은 텍스트 (정보형, 행동 가능 단 권유 아님)
//   - neutral  → 라인만 + 흐린 텍스트 (archived / 부가 안내)
//
// 본 컴포넌트는 *button이 아닌 banner* — 클릭 가능한 액션은 drawer 본문의
// 검은 button이 담당하고, 본 banner는 *지금 어떤 행동이 권장되는지* 시각 신호만.
// ============================================================================

interface NextActionBannerProps {
  meta: NextActionMeta;
  /** 옵셔널 — banner 우측 끝에 표시할 작은 텍스트 (예: 마지막 활동 시각). */
  rightHint?: string;
  className?: string;
}

const TONE_CLASS: Record<
  NextActionMeta["tone"],
  { border: string; bg: string; label: string; desc: string }
> = {
  primary: {
    border: "border-l-2 border-ink",
    bg: "bg-surface",
    label: "text-ink",
    desc: "text-ink-muted",
  },
  info: {
    border: "border-l-2 border-line-strong",
    bg: "bg-surface",
    label: "text-ink",
    desc: "text-ink-muted",
  },
  neutral: {
    border: "border-l border-line",
    bg: "bg-surface-muted/50",
    label: "text-ink-subtle",
    desc: "text-ink-subtle/80",
  },
};

export function NextActionBanner({
  meta,
  rightHint,
  className,
}: NextActionBannerProps) {
  const tone = TONE_CLASS[meta.tone];
  return (
    <div
      role="status"
      className={cn(
        "flex items-start justify-between gap-3 px-3 py-2.5 mb-4 rounded-r-md",
        tone.border,
        tone.bg,
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[9px] uppercase tracking-[0.16em] text-ink-subtle font-semibold">
            다음 작업
          </span>
          <span
            className={cn(
              "text-[12.5px] tracking-tightish font-semibold",
              tone.label
            )}
          >
            {meta.label}
          </span>
        </div>
        {meta.description && (
          <p
            className={cn(
              "text-[10.5px] tracking-tightish mt-1 leading-snug",
              tone.desc
            )}
          >
            {meta.description}
          </p>
        )}
      </div>
      {rightHint && (
        <span className="text-[9.5px] text-ink-subtle/80 tracking-tightish shrink-0 italic mt-0.5">
          {rightHint}
        </span>
      )}
    </div>
  );
}
