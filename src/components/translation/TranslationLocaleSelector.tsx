"use client";

// =====================================================
// AXVELA — Translation Locale Selector (STEP 96)
// =====================================================
//
// **본 component 의 정체**:
//   - Pure presentational. KO EN JA ZH 4 locale 의 compact horizontal selector.
//   - 활성 locale 은 *medium weight + subtle 하단 underline* 으로 구분.
//   - 사용자 spec STEP 96 §UI 방향 정확 매칭:
//     * institutional / minimal / museum-safe / professional
//     * colorful tabs 금지 / animated transitions 금지 / flashy segmented control 금지
//     * 권장: compact selector + subtle underline 또는 medium weight
//
// **본 component 가 *아닌* 것**:
//   - 번역 로직 / state machine 보유 (그것은 TranslationToolbar)
//   - Document entity 변경 (그것은 architecture rule 위반)
//
// **재사용**: 7 surface (Invoice / Receipt / TaxInvoice / ConditionReport /
//   Settlement / Logistics / DetailPanel) 모두 동일 component 사용.
// =====================================================

import * as React from "react";
import {
  type DocumentLocale,
  DOCUMENT_LOCALES,
  DOCUMENT_LOCALE_LABEL_SHORT,
  DOCUMENT_LOCALE_LABEL_FULL,
} from "@/lib/document-locale";
import { cn } from "@/lib/utils";

// -----------------------------------------------------
// Props
// -----------------------------------------------------

interface TranslationLocaleSelectorProps {
  /** Currently active locale (source 또는 선택된 target). */
  value: DocumentLocale;
  /** Source locale — 시각적 distinction 용 (subtle dot prefix). */
  sourceLocale: DocumentLocale;
  /** User clicks a locale. */
  onChange: (next: DocumentLocale) => void;
  /** While translating — 모든 locale 클릭 차단 (race condition 방지). */
  disabled?: boolean;
  className?: string;
}

// -----------------------------------------------------
// Component
// -----------------------------------------------------

export const TranslationLocaleSelector: React.FC<
  TranslationLocaleSelectorProps
> = ({ value, sourceLocale, onChange, disabled = false, className }) => {
  return (
    <div
      role="tablist"
      aria-label="Document locale"
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {DOCUMENT_LOCALES.map((locale) => {
        const isActive = locale === value;
        const isSource = locale === sourceLocale;
        return (
          <button
            key={locale}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-label={`${DOCUMENT_LOCALE_LABEL_FULL[locale]}${
              isSource ? " (원문)" : ""
            }`}
            onClick={() => {
              if (disabled || isActive) return;
              onChange(locale);
            }}
            disabled={disabled}
            className={cn(
              // Base — minimal padding, monospace-ish tracking for locale codes
              "px-2 py-1 text-[11px] tracking-[0.08em] transition",
              "border-b border-transparent",
              // Active — medium weight + subtle bottom border (사용자 spec)
              isActive &&
                "font-medium text-ink-strong border-ink/60",
              // Inactive — subtle, hoverable
              !isActive &&
                !disabled &&
                "text-ink-subtle hover:text-ink-strong hover:border-line",
              // Disabled
              disabled && "cursor-not-allowed opacity-40",
              // Source — subtle dot indicator (절대 강조 아님)
              isSource && !isActive && "text-ink-muted",
            )}
          >
            {DOCUMENT_LOCALE_LABEL_SHORT[locale]}
          </button>
        );
      })}
    </div>
  );
};
