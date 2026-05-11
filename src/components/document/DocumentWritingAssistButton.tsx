"use client";

// =====================================================
// AXVELA — Document Writing Assist Button (STEP 95)
// =====================================================
//
// CLIENT-SIDE shared component. 6 document_writing targets 모두에서 재사용:
//   invoice / receipt / condition_report / settlement_summary /
//   shipment_summary / artwork_description.
//
// 사용자 spec STEP 95 — *AI는 정리 역할만, 확정 / 법적 / 세무 / 가격 / 감정
// 판단 절대 금지*. 4-step invocation guard + 6-state machine.
//
// 4-step invocation guard (STEP 95 §):
//   1. source document exists (sourceText non-empty)
//   2. target document type selected (target prop valid)
//   3. editable draft generated (preview state populated)
//   4. user confirms apply (explicit button click)
//
// 6-state machine:
//   idle → preparing → generating → preview → applied → failed
//
// Failure 발생 시에도 기존 문서 데이터 절대 손상되지 않음 — onApply는
// 사용자 명시 클릭 시만 호출, 자동 setter 0건.
//
// AI-disabled safe mode 보존 — server에서 ai_unavailable 응답 시 calm copy
// "AI 정리 보조를 사용할 수 없습니다" 표시, document workflow는 정상 진행.
// =====================================================

import * as React from "react";
import {
  requestDocumentWritingAssist,
  isOK,
  isUnavailable,
  isValidationError,
} from "@/lib/ai/client";
import type {
  AIUnavailableReason,
  DocumentWritingTarget,
  AILocale,
} from "@/lib/ai/types";
import { cn } from "@/lib/utils";

// -----------------------------------------------------
// Props
// -----------------------------------------------------

interface DocumentWritingAssistButtonProps {
  /** Target document type — drives prompt selection. */
  target: DocumentWritingTarget;
  /**
   * Build the raw source text from current document state.
   * 호출 시점에 즉시 evaluation — 사용자 클릭 시 fresh snapshot.
   */
  buildSourceText: () => string;
  /** Optional context summary (artwork title / customer name / amount). */
  buildContext?: () => string;
  /**
   * Apply the rewritten text. Parent decides — setState / clipboard.writeText / etc.
   * 명시적 사용자 클릭 시만 호출 (rule_5 AI-Human Loop).
   */
  onApply: (rewrittenText: string) => void;
  /** Apply button label — "적용" (default) or "복사" for read-only docs. */
  applyButtonLabel?: string;
  /** Optional explicit disabled override. */
  disabled?: boolean;
  /** Optional locale override. Default "ko". */
  locale?: AILocale;
  className?: string;
}

// -----------------------------------------------------
// 6-State machine (사용자 spec)
// -----------------------------------------------------

type AssistState =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "generating" }
  | { kind: "preview"; draft: string; toneNotes: string[] }
  | { kind: "applied" }
  | {
      kind: "failed";
      reason: AIUnavailableReason | "validation_error" | "network_error" | "empty_source";
      detail?: string;
    };

// -----------------------------------------------------
// Target → 한글 라벨 (CTA 보조 표시)
// -----------------------------------------------------

const TARGET_LABEL_KR: Record<DocumentWritingTarget, string> = {
  invoice: "인보이스",
  receipt: "영수증",
  condition_report: "컨디션 리포트",
  settlement_summary: "정산 요약",
  shipment_summary: "배송 요약",
  artwork_description: "작품 설명",
};

// -----------------------------------------------------
// Failure reason → 한글 calm copy
// -----------------------------------------------------

const FAILURE_LABEL_KR: Record<
  AIUnavailableReason | "validation_error" | "network_error" | "empty_source",
  string
> = {
  disabled: "AI 정리 보조를 사용할 수 없습니다.",
  kind_disabled: "본 영역의 AI 정리 보조가 비활성 상태입니다.",
  provider_not_configured: "AI 정리 보조를 사용할 수 없습니다 (서버 설정 필요).",
  rate_limit: "요청 속도 제한에 도달했습니다. 잠시 후 다시 시도해주세요.",
  provider_error: "AI 응답 처리에 실패했습니다.",
  output_rejected: "응답이 정책에 부합하지 않아 거부되었습니다.",
  timeout: "응답 시간이 초과되었습니다.",
  validation_error: "입력 형식을 확인해주세요.",
  network_error: "네트워크 오류가 발생했습니다.",
  empty_source: "정리할 내용이 비어 있습니다. 먼저 내용을 입력해주세요.",
};

// -----------------------------------------------------
// Component
// -----------------------------------------------------

export const DocumentWritingAssistButton: React.FC<
  DocumentWritingAssistButtonProps
> = ({
  target,
  buildSourceText,
  buildContext,
  onApply,
  applyButtonLabel = "적용",
  disabled = false,
  locale = "ko",
  className,
}) => {
  const [state, setState] = React.useState<AssistState>({ kind: "idle" });
  // editable draft — preview 상태에서 사용자가 수정 가능 (4-step guard step 3).
  const [editableDraft, setEditableDraft] = React.useState<string>("");
  const [originalSource, setOriginalSource] = React.useState<string>("");

  // ---------------------------------------------------
  // 4-step invocation guard
  // ---------------------------------------------------
  const onClick = React.useCallback(async () => {
    if (disabled) return;
    if (state.kind === "generating" || state.kind === "preparing") return;

    // STEP 1: preparing — source document exists check
    setState({ kind: "preparing" });

    const source = buildSourceText().trim();
    if (source.length === 0) {
      setState({ kind: "failed", reason: "empty_source" });
      return;
    }
    setOriginalSource(source);

    const context = buildContext?.().trim();

    // STEP 2: target type already validated by prop typing.
    // STEP 3: generating — fetch from server.
    setState({ kind: "generating" });

    const response = await requestDocumentWritingAssist(
      {
        documentType: target,
        shortNotes: source,
        contextSummary: context && context.length > 0 ? context : undefined,
      },
      locale,
    );

    if (isOK(response)) {
      const draft = response.output.rewrittenText ?? "";
      const notes = response.output.toneNotes ?? [];
      setEditableDraft(draft);
      setState({ kind: "preview", draft, toneNotes: notes });
      return;
    }

    if (isUnavailable(response)) {
      setState({ kind: "failed", reason: response.reason });
      return;
    }

    if (isValidationError(response)) {
      setState({
        kind: "failed",
        reason: "validation_error",
        detail: response.errors[0],
      });
      return;
    }

    setState({ kind: "failed", reason: "network_error" });
  }, [
    disabled,
    state.kind,
    buildSourceText,
    buildContext,
    target,
    locale,
  ]);

  // ---------------------------------------------------
  // STEP 4: user confirms apply (explicit click)
  // ---------------------------------------------------
  const onApplyClick = React.useCallback(() => {
    if (state.kind !== "preview") return;
    const finalText = editableDraft.trim();
    if (finalText.length === 0) return;
    onApply(finalText);
    setState({ kind: "applied" });
    // applied → idle (auto-reset, 1.5s)
    setTimeout(() => {
      setState({ kind: "idle" });
      setEditableDraft("");
      setOriginalSource("");
    }, 1500);
  }, [state.kind, editableDraft, onApply]);

  const onDiscard = React.useCallback(() => {
    setState({ kind: "idle" });
    setEditableDraft("");
    setOriginalSource("");
  }, []);

  // ---------------------------------------------------
  // Render
  // ---------------------------------------------------

  const isBusy = state.kind === "preparing" || state.kind === "generating";
  const buttonLabel = isBusy
    ? state.kind === "preparing"
      ? "준비 중..."
      : "분석 중..."
    : "AI 정리 보조";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.08em] text-ink-subtle">
          AI 정리 보조 — {TARGET_LABEL_KR[target]}
        </span>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || isBusy}
          className={cn(
            "rounded-md border border-line/70 bg-surface px-3 py-1.5 text-[12px] font-medium",
            "tracking-tight text-ink-strong transition",
            "hover:border-ink/40 hover:bg-surface-muted/40",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
          aria-label={`AI 정리 보조 — ${TARGET_LABEL_KR[target]}`}
        >
          {buttonLabel}
        </button>
      </div>

      {state.kind === "preview" && (
        <div className="rounded-md border border-line/60 bg-surface-muted/20 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
              제안 — 검토 후 적용
            </span>
            <span className="text-[10px] text-ink-subtle/70">
              직접 편집 가능
            </span>
          </div>

          <details className="group">
            <summary
              className={cn(
                "cursor-pointer text-[11px] text-ink-subtle/80",
                "hover:text-ink-strong transition",
              )}
            >
              원문 (현재) 보기
            </summary>
            <div className="mt-1.5 rounded-md border border-line/40 bg-surface p-2 text-[12px] text-ink-subtle whitespace-pre-wrap">
              {originalSource}
            </div>
          </details>

          <textarea
            value={editableDraft}
            onChange={(e) => setEditableDraft(e.target.value)}
            rows={6}
            className={cn(
              "w-full rounded-md border border-line/60 bg-surface px-2.5 py-2",
              "text-[13px] text-ink-strong leading-relaxed",
              "focus:outline-none focus:border-ink/40 focus:ring-1 focus:ring-ink/10",
              "resize-y",
            )}
            aria-label="제안된 문서 초안 — 편집 가능"
          />

          {state.toneNotes.length > 0 && (
            <ul className="text-[11px] text-ink-subtle/80 space-y-0.5 pt-1 border-t border-line/40">
              {state.toneNotes.map((n, i) => (
                <li key={i}>· {n}</li>
              ))}
            </ul>
          )}

          <p className="text-[10.5px] italic text-ink-subtle/70 leading-snug">
            AI 정리 보조 결과는 사용자가 검토 후 확정해야 합니다. ·{" "}
            <span className="text-ink-subtle/60">
              AI writing assist output must be reviewed before final use.
            </span>
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onDiscard}
              className={cn(
                "rounded-md border border-line/60 bg-surface px-3 py-1.5",
                "text-[11px] font-medium tracking-tight text-ink-subtle transition",
                "hover:border-ink/30 hover:text-ink-strong",
              )}
            >
              버리기
            </button>
            <button
              type="button"
              onClick={onApplyClick}
              disabled={editableDraft.trim().length === 0}
              className={cn(
                "rounded-md border border-ink/40 bg-ink px-3 py-1.5 text-[11px] font-medium",
                "text-surface tracking-tight transition hover:opacity-80",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              {applyButtonLabel}
            </button>
          </div>
        </div>
      )}

      {state.kind === "applied" && (
        <div className="rounded-md border border-line/40 bg-surface-muted/10 px-3 py-2 text-[11px] text-ink-subtle">
          ✓ 적용되었습니다. 검토 후 저장해주세요.
        </div>
      )}

      {state.kind === "failed" && (
        <div className="rounded-md border border-line/40 bg-surface-muted/10 px-3 py-2 space-y-1">
          <p className="text-[11px] text-ink-subtle/80">
            {FAILURE_LABEL_KR[state.reason]}
          </p>
          {state.detail && (
            <p className="text-[10.5px] italic text-ink-subtle/60">
              {state.detail}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
