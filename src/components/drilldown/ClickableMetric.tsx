// ============================================================================
// ClickableMetric — STEP 67.
//
// 기존 KPI / count / status 시각 요소를 *그대로* 감싸 클릭 가능하게 만드는
// reusable wrapper. 시각 redesign 0건 — 기존 카드 markup은 children으로 그대로
// 들어옴, 본 컴포넌트는 button outer wrap + 미세한 hover state만 추가.
//
// **rule_16 institutional minimalism 보존**:
//   - hover: bg-surface-muted/50 (very subtle)
//   - hover ring: ring-1 ring-line (얇은 line 한 줄)
//   - cursor: pointer
//   - transition: 150ms (no flashy animation)
//
// **non-clickable graceful**: onClick prop 부재 또는 disabled면 wrapper 부재 —
// children을 그대로 반환 (DOM 부담 0).
// ============================================================================

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ClickableMetricProps {
  /** 클릭 핸들러. 부재 또는 disabled 시 children 그대로 반환 (wrapper 미부착). */
  onClick?: () => void;
  disabled?: boolean;
  /** 접근성 라벨 — screen reader가 "카드 N건 — 상세 보기" 등 읽기. */
  ariaLabel?: string;
  /** title attribute — hover tooltip ("클릭하여 상세 보기" 등). */
  title?: string;
  /** Tailwind class 확장 (필요 시 padding 등 추가) */
  className?: string;
  children: React.ReactNode;
}

export function ClickableMetric({
  onClick,
  disabled,
  ariaLabel,
  title,
  className,
  children,
}: ClickableMetricProps) {
  // wrapper 미적용 — DOM 부담 0
  if (!onClick || disabled) {
    return <>{children}</>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title ?? "상세 보기"}
      className={cn(
        "text-left rounded-md transition-all duration-150",
        "hover:bg-surface-muted/50",
        "hover:ring-1 hover:ring-line",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink",
        "cursor-pointer",
        // 기존 카드 자체 padding을 보존 — wrapper 자체는 padding 부재
        className
      )}
    >
      {children}
    </button>
  );
}
