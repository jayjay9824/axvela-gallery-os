// ============================================================================
// AXVELA — TabBar (STEP 118)
// ============================================================================
//
// **본 component 의 정체**:
//   AXVELA 미니멀 톤의 tab navigation primitive. Generic — 4-tab 강제 아닌
//   호출자가 N tab 자유 정의.
//
//   Apple/OpenAI tone (rule_16): 그림자 0, 큰 padding, 점선/박스 fluffy 장식
//   금지, active state 는 ink-strong + bottom-line 만.
//
// **본 component 가 *아닌* 것**:
//   - 라우팅 합류 (URL hash 등) — 호출자 state 책임
//   - Lazy mount (모든 tab panel 의 children 은 호출자가 conditional render)
//   - Animation framework — 단순 className transition only
// ============================================================================

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabDefinition<TKey extends string = string> {
  key: TKey;
  label: string;
  /** 현재 tab 의 *진행 상태* 시각 표시 (예: "5", "•", undefined). */
  badge?: React.ReactNode;
  /** Disabled tab — disabled 시 클릭 무반응. */
  disabled?: boolean;
}

interface TabBarProps<TKey extends string = string> {
  tabs: readonly TabDefinition<TKey>[];
  activeKey: TKey;
  onChange: (next: TKey) => void;
  className?: string;
  /** Aria label for the tablist (screen readers). */
  ariaLabel?: string;
}

export function TabBar<TKey extends string>({
  tabs,
  activeKey,
  onChange,
  className,
  ariaLabel,
}: TabBarProps<TKey>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        // Single horizontal row, bottom-line separator (rule_16 minimal)
        "flex items-stretch gap-0 border-b border-line",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={tab.disabled}
            disabled={tab.disabled}
            onClick={() => {
              if (!tab.disabled && tab.key !== activeKey) onChange(tab.key);
            }}
            className={cn(
              // Layout — 큰 padding, 일관 높이
              "px-3.5 py-2.5 text-[12px] font-medium tracking-tight",
              "transition-colors duration-150 outline-none",
              // Bottom-line for active — visually clear 활성 표시
              "border-b-2 -mb-px",
              isActive
                ? "border-ink text-ink"
                : "border-transparent text-ink-subtle hover:text-ink",
              tab.disabled && "opacity-40 cursor-not-allowed hover:text-ink-subtle",
              // Focus ring (subtle, rule_16)
              "focus-visible:ring-1 focus-visible:ring-ink/30 focus-visible:ring-offset-0",
            )}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.badge !== undefined && tab.badge !== null && (
                <span
                  className={cn(
                    "text-[10px] tabular-nums",
                    isActive ? "text-ink-subtle" : "text-ink-subtle/60",
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
