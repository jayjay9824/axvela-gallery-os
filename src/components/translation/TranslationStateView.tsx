"use client";

// =====================================================
// AXVELA — Translation State View (STEP 96)
// =====================================================
//
// **본 component 의 정체**:
//   - Pure presentational. 4-state machine 의 each state 에 대한 view.
//   - 사용자 spec STEP 96 §상태 구조 정확 매칭:
//     idle → translating → translated → failed
//   - 사용자 spec §Fallback copy 정확 매칭:
//     translation unavailable 상태 → "Translation not available." calm copy.
//     red error UI 절대 금지.
//
// **본 component 가 *아닌* 것**:
//   - 상태 전환 로직 (그것은 TranslationToolbar — orchestrator)
//   - source 데이터 mutation (architecture rule 위반)
//
// **Locale projection 원칙**:
//   - source locale 표시 시: 원문 그대로 (no API call, no fallback).
//   - target locale 표시 시: 번역 결과의 read-only projection.
//   - 어떤 상태에서도 source document data 는 untouched.
// =====================================================

import * as React from "react";
import type { AIUnavailableReason } from "@/lib/ai/types";
import {
  type DocumentLocale,
  DOCUMENT_LOCALE_LABEL_FULL,
} from "@/lib/document-locale";
import { cn } from "@/lib/utils";

// -----------------------------------------------------
// State (사용자 spec STEP 96 §상태 구조)
// -----------------------------------------------------

export type TranslationViewState =
  | { kind: "idle" } //                                 source locale 표시 중 — API 호출 0건
  | { kind: "translating"; target: DocumentLocale } //  fetching from /api/ai-assist
  | {
      kind: "translated";
      target: DocumentLocale;
      text: string;
      notes: string[];
    }
  | {
      kind: "failed";
      target: DocumentLocale;
      reason:
        | AIUnavailableReason
        | "validation_error"
        | "network_error"
        | "empty_source";
    };

// -----------------------------------------------------
// Failure → calm Korean copy 매핑
// -----------------------------------------------------
//
// 사용자 spec §Fallback copy:
//   "Translation not available." 정도의 calm copy 만 사용.
//   red error UI 금지.
// 다양한 reason 모두 동일 calm tone 으로 surface.
// -----------------------------------------------------

type FailureReason =
  | AIUnavailableReason
  | "validation_error"
  | "network_error"
  | "empty_source";

const FALLBACK_COPY_KR: Record<FailureReason, string> = {
  disabled: "번역 보조를 사용할 수 없습니다.",
  kind_disabled: "번역 보조가 비활성 상태입니다.",
  provider_not_configured: "번역 보조를 사용할 수 없습니다.",
  rate_limit: "잠시 후 다시 시도해주세요.",
  provider_error: "번역 결과를 가져오지 못했습니다.",
  output_rejected: "응답이 정책에 부합하지 않아 거부되었습니다.",
  timeout: "응답 시간이 초과되었습니다.",
  validation_error: "입력 형식을 확인해주세요.",
  network_error: "네트워크 오류가 발생했습니다.",
  empty_source: "번역할 내용이 비어 있습니다.",
};

const FALLBACK_COPY_EN = "Translation not available.";

// -----------------------------------------------------
// Props
// -----------------------------------------------------

interface TranslationStateViewProps {
  state: TranslationViewState;
  /** Source text — idle state 에서 그대로 표시. */
  sourceText: string;
  /** Source locale — projection 메타 표시용. */
  sourceLocale: DocumentLocale;
  /** Optional copy action — translated 상태에서만 활성. */
  onCopy?: (text: string) => void;
  className?: string;
}

// -----------------------------------------------------
// Component
// -----------------------------------------------------

export const TranslationStateView: React.FC<TranslationStateViewProps> = ({
  state,
  sourceText,
  sourceLocale,
  onCopy,
  className,
}) => {
  // -------------------------------------------------
  // idle — source locale projection (no translation in flight)
  // -------------------------------------------------
  if (state.kind === "idle") {
    return (
      <div
        className={cn(
          "rounded-md border border-line/50 bg-surface px-3 py-2.5",
          className,
        )}
      >
        <ProjectionMeta
          locale={sourceLocale}
          isSource
          rightSlot={null}
        />
        <p className="mt-1.5 text-[12.5px] text-ink-strong leading-relaxed whitespace-pre-wrap">
          {sourceText.trim().length > 0 ? sourceText : "—"}
        </p>
      </div>
    );
  }

  // -------------------------------------------------
  // translating — calm "번역 중..." indicator (no spinner animation)
  // -------------------------------------------------
  if (state.kind === "translating") {
    return (
      <div
        className={cn(
          "rounded-md border border-line/50 bg-surface px-3 py-2.5",
          className,
        )}
        aria-live="polite"
      >
        <ProjectionMeta
          locale={state.target}
          isSource={false}
          rightSlot={
            <span className="text-[10px] text-ink-subtle/80">번역 중...</span>
          }
        />
        <p className="mt-1.5 text-[12.5px] text-ink-subtle italic leading-relaxed">
          잠시만 기다려주세요.
        </p>
      </div>
    );
  }

  // -------------------------------------------------
  // translated — read-only projection of source
  // -------------------------------------------------
  if (state.kind === "translated") {
    const handleCopy = () => {
      if (!onCopy) return;
      onCopy(state.text);
    };
    return (
      <div
        className={cn(
          "rounded-md border border-line/60 bg-surface px-3 py-2.5",
          className,
        )}
      >
        <ProjectionMeta
          locale={state.target}
          isSource={false}
          rightSlot={
            onCopy ? (
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  "rounded border border-line/60 bg-surface px-2 py-0.5",
                  "text-[10px] font-medium tracking-tight text-ink-subtle transition",
                  "hover:border-ink/30 hover:text-ink-strong",
                )}
                aria-label="번역 결과 복사"
              >
                복사
              </button>
            ) : null
          }
        />
        <p className="mt-1.5 text-[12.5px] text-ink-strong leading-relaxed whitespace-pre-wrap">
          {state.text.trim().length > 0 ? state.text : "—"}
        </p>
        {state.notes.length > 0 && (
          <ul className="mt-2 pt-2 border-t border-line/40 space-y-0.5">
            {state.notes.map((n, i) => (
              <li
                key={i}
                className="text-[10.5px] text-ink-subtle/80 leading-snug"
              >
                · {n}
              </li>
            ))}
          </ul>
        )}
        {/* 영구 disclaimer — STEP 95 패턴 답습. AI Direction §1 / §10. */}
        <p className="mt-2 pt-2 border-t border-line/40 text-[10px] italic text-ink-subtle/70 leading-snug">
          번역 결과는 사용자가 검토 후 사용해야 합니다. ·{" "}
          <span className="text-ink-subtle/60">
            Translated output must be reviewed before use.
          </span>
        </p>
      </div>
    );
  }

  // -------------------------------------------------
  // failed — calm fallback copy. red error UI 절대 금지 (사용자 spec).
  // -------------------------------------------------
  return (
    <div
      className={cn(
        "rounded-md border border-line/40 bg-surface-muted/10 px-3 py-2.5",
        className,
      )}
    >
      <ProjectionMeta
        locale={state.target}
        isSource={false}
        rightSlot={
          <span className="text-[10px] text-ink-subtle/70">불가</span>
        }
      />
      <p className="mt-1.5 text-[11.5px] text-ink-subtle leading-relaxed">
        {FALLBACK_COPY_KR[state.reason]}{" "}
        <span className="text-ink-subtle/70 italic">— {FALLBACK_COPY_EN}</span>
      </p>
    </div>
  );
};

// -----------------------------------------------------
// Internal — projection meta header
// -----------------------------------------------------

const ProjectionMeta: React.FC<{
  locale: DocumentLocale;
  isSource: boolean;
  rightSlot: React.ReactNode;
}> = ({ locale, isSource, rightSlot }) => {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-[0.1em] text-ink-subtle">
        {DOCUMENT_LOCALE_LABEL_FULL[locale]}
        {isSource && (
          <span className="ml-1.5 text-[9.5px] not-italic text-ink-subtle/60">
            · 원문
          </span>
        )}
      </span>
      {rightSlot}
    </div>
  );
};
