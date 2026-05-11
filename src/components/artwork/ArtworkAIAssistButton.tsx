"use client";

// =====================================================
// AXVELA — Artwork AI Assist Button (STEP 94)
// =====================================================
//
// CLIENT-SIDE component. Server-side helpers (config / providers) 절대
// 접근 금지 — `@/lib/ai/client.ts`의 public client wrapper만 사용.
//
// 사용자 spec STEP 94: artwork_metadata 1개 insertion point — medium
// (재료) 필드의 한국어 입력 → 영문 normalize. 가장 단순 in/out — 사람
// 눈으로 정확성 평가 가능.
//
// 사용자 명시 trigger only (rule_5 AI-Human Loop) — 자동 호출 0건.
// 사용자가 버튼 클릭 → 재료 텍스트 server route 전송 → JSON 응답 →
// "적용" 버튼 누를 때만 부모 setter 호출.
//
// AI_INTEGRATION §4 Safe Mode 정합 — server에서 ai_unavailable 응답 시
// graceful degradation: "현재 AI 보조가 비활성 상태입니다" 표시.
// =====================================================

import * as React from "react";
import {
  requestArtworkMetadataAssist,
  isOK,
  isUnavailable,
  isValidationError,
} from "@/lib/ai/client";
import type { AIUnavailableReason } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

// -----------------------------------------------------
// Types
// -----------------------------------------------------

interface ArtworkAIAssistButtonProps {
  /** Current raw value of the medium field. */
  rawMaterial: string;
  /** Optional raw title — sent for context, not modified. */
  rawTitle?: string;
  /** Apply normalized material to parent state. */
  onApplyMaterial: (normalized: string) => void;
  /** Optional: apply normalized title too. */
  onApplyTitle?: (normalized: string) => void;
  /** Visible name for accessibility. Defaults to "AI 정리 보조". */
  label?: string;
  /** Optional className to override container layout. */
  className?: string;
}

type AssistState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "result";
      normalizedMaterial?: string;
      normalizedTitle?: string;
      notes: string[];
    }
  | { kind: "unavailable"; reason: AIUnavailableReason }
  | { kind: "validation_error"; errors: string[] }
  | { kind: "network_error"; message: string };

// -----------------------------------------------------
// Reason → Korean label
// -----------------------------------------------------

const UNAVAILABLE_LABEL_KR: Record<AIUnavailableReason, string> = {
  disabled: "AI 보조가 비활성 상태입니다.",
  kind_disabled: "본 영역의 AI 보조가 비활성 상태입니다.",
  provider_not_configured: "AI 제공자 설정이 필요합니다 (서버 환경 변수).",
  rate_limit: "요청 속도 제한에 도달했습니다. 잠시 후 다시 시도해주세요.",
  provider_error: "AI 제공자 응답 처리에 실패했습니다.",
  output_rejected: "응답이 정책에 부합하지 않아 거부되었습니다.",
  timeout: "응답 시간이 초과되었습니다.",
};

// -----------------------------------------------------
// Component
// -----------------------------------------------------

export const ArtworkAIAssistButton: React.FC<ArtworkAIAssistButtonProps> = ({
  rawMaterial,
  rawTitle,
  onApplyMaterial,
  onApplyTitle,
  label = "AI 정리 보조",
  className,
}) => {
  const [state, setState] = React.useState<AssistState>({ kind: "idle" });

  const trimmedMaterial = rawMaterial.trim();
  const canRequest = trimmedMaterial.length > 0 && state.kind !== "loading";

  const onClick = React.useCallback(async () => {
    if (!canRequest) return;
    setState({ kind: "loading" });

    const response = await requestArtworkMetadataAssist(
      {
        rawTitle: rawTitle?.trim() || undefined,
        rawMaterial: trimmedMaterial,
      },
      "ko",
    );

    if (isOK(response)) {
      const out = response.output;
      setState({
        kind: "result",
        normalizedMaterial: out.normalizedMaterial,
        normalizedTitle: out.normalizedTitle,
        notes: out.normalizationNotes ?? [],
      });
      return;
    }

    if (isUnavailable(response)) {
      setState({ kind: "unavailable", reason: response.reason });
      return;
    }

    if (isValidationError(response)) {
      setState({ kind: "validation_error", errors: response.errors });
      return;
    }

    setState({ kind: "network_error", message: "요청 중 오류 발생" });
  }, [canRequest, trimmedMaterial, rawTitle]);

  const reset = React.useCallback(() => {
    setState({ kind: "idle" });
  }, []);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.08em] text-ink-subtle">
          AI 보조 — 재료 표기 정리
        </span>
        <button
          type="button"
          onClick={onClick}
          disabled={!canRequest}
          className={cn(
            "rounded-md border border-line/70 bg-surface px-3 py-1.5 text-[12px] font-medium",
            "tracking-tight text-ink-strong transition",
            "hover:border-ink/40 hover:bg-surface-muted/40",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
          aria-label={label}
        >
          {state.kind === "loading" ? "분석 중..." : label}
        </button>
      </div>

      {state.kind === "result" && (
        <div className="rounded-md border border-line/60 bg-surface-muted/20 p-3 space-y-2">
          {state.normalizedMaterial && (
            <ResultRow
              fieldLabel="재료(Material)"
              before={trimmedMaterial}
              after={state.normalizedMaterial}
              onApply={() => {
                onApplyMaterial(state.normalizedMaterial!);
                reset();
              }}
            />
          )}
          {state.normalizedTitle && onApplyTitle && rawTitle && (
            <ResultRow
              fieldLabel="제목(Title)"
              before={rawTitle.trim()}
              after={state.normalizedTitle}
              onApply={() => {
                onApplyTitle(state.normalizedTitle!);
                reset();
              }}
            />
          )}
          {!state.normalizedMaterial && !state.normalizedTitle && (
            <p className="text-[12px] italic text-ink-subtle/80">
              정규화할 변경 사항이 없습니다.
            </p>
          )}
          {state.notes.length > 0 && (
            <ul className="text-[11px] text-ink-subtle/80 space-y-0.5 pt-1 border-t border-line/40">
              {state.notes.map((note, i) => (
                <li key={i}>· {note}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={reset}
              className="text-[11px] text-ink-subtle hover:text-ink"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {state.kind === "unavailable" && (
        <div className="rounded-md border border-line/40 bg-surface-muted/10 px-3 py-2 text-[11px] text-ink-subtle/80">
          {UNAVAILABLE_LABEL_KR[state.reason]}
        </div>
      )}

      {state.kind === "validation_error" && (
        <div className="rounded-md border border-line/40 bg-surface-muted/10 px-3 py-2 text-[11px] text-ink-subtle/80">
          입력을 다시 확인해주세요. {state.errors[0] ?? ""}
        </div>
      )}

      {state.kind === "network_error" && (
        <div className="rounded-md border border-line/40 bg-surface-muted/10 px-3 py-2 text-[11px] text-ink-subtle/80">
          네트워크 오류가 발생했습니다. {state.message}
        </div>
      )}
    </div>
  );
};

// -----------------------------------------------------
// Result Row
// -----------------------------------------------------

const ResultRow: React.FC<{
  fieldLabel: string;
  before: string;
  after: string;
  onApply: () => void;
}> = ({ fieldLabel, before, after, onApply }) => {
  const isSame = before === after;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
          {fieldLabel}
        </span>
        {!isSame && (
          <button
            type="button"
            onClick={onApply}
            className={cn(
              "rounded-md border border-ink/40 bg-ink px-2.5 py-1 text-[11px] font-medium",
              "text-surface tracking-tight transition hover:opacity-80",
            )}
          >
            적용
          </button>
        )}
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[12px]">
        <span className="text-ink-subtle/70">현재</span>
        <span className="text-ink-subtle/80 line-through decoration-line/60">
          {before}
        </span>
        <span className="text-ink-subtle/70">제안</span>
        <span className={cn("font-medium", isSame ? "text-ink-subtle" : "text-ink-strong")}>
          {isSame ? "(변경 없음)" : after}
        </span>
      </div>
    </div>
  );
};
