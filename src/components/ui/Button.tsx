"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/**
 * STEP 17 — Disabled state polish (rule_15 / rule_16).
 *
 * Hover와 active 효과는 `enabled:` modifier로 게이트되어 disabled 상태에서는
 * 발화하지 않는다. 이전에는 disabled여도 hover 시 색이 바뀌어 인터랙티브하게
 * 보이는 문제가 있었음.
 *
 * Disabled 시각:
 *   - opacity-40 (기존 유지) — fade 강도
 *   - cursor-not-allowed — 마우스 지점에서 즉시 신호
 *   - hover/active 스타일 미발화 — 더 이상 살아있는 듯 반응하지 않음
 *
 * "비활성 이유"는 이 컴포넌트가 직접 제공하지 않음. 호출자가 ButtonHint를
 * 사용해 버튼 아래(또는 옆)에 명시적으로 표시한다.
 */
const variantClasses: Record<Variant, string> = {
  primary:
    "bg-ink text-white border border-ink enabled:hover:bg-black enabled:active:bg-black",
  secondary:
    "bg-surface text-ink border border-line enabled:hover:bg-surface-muted",
  ghost:
    "bg-transparent text-ink-muted border border-transparent enabled:hover:text-ink enabled:hover:bg-surface-muted",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md font-medium tracking-tightish transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
