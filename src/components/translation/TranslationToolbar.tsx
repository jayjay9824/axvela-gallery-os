"use client";

// =====================================================
// AXVELA — Translation Toolbar (STEP 96)
// =====================================================
//
// **본 component 의 정체**:
//   - Single shared orchestrator. 7 surface (Invoice / Receipt / TaxInvoice /
//     ConditionReport / Settlement / Logistics / Artwork DetailPanel) 모두에서
//     동일 component 재사용 — 사용자 spec STEP 96 §Shared component 패턴 정착.
//
// **사용자 spec STEP 96 핵심 원칙 (모두 정확 매칭)**:
//   1. single semantic document → locale projection
//      (원문 source 1개, locale rendering 여러 개)
//   2. translation 실패 시 *기존 locale content 절대 overwrite 금지*
//      → architecture-level guarantee: source data 는 *closure read-only*,
//        cache 는 failure 시 *unchanged*, document entity 변경 0건.
//   3. 4-state machine: idle → translating → translated → failed
//   4. fallback copy: "Translation not available." (calm, red error UI 금지)
//
// **STEP 95 패턴 답습 (DOC-2 §3.1 anchor reuse)**:
//   - buildSourceText closure pattern (fresh evaluation on each translate click)
//   - 사용자 명시 trigger only (rule_5 AI-Human Loop) — 자동 호출 0건
//   - AI-disabled safe mode 보존 (env 부재 시 graceful fallback view)
//   - Server-side only API key (client.ts 통한 /api/ai-assist 만 호출)
//
// **Translation cache**:
//   - 같은 source 에 대해 target locale 별로 결과 1회 캐시.
//   - 캐시 invalidation: source text 가 변경되면 자동 reset (sourceText hash 비교).
//   - Failure 시 cache 미변경 (이전 성공 결과 보존).
//
// **architecture rule (사용자 spec)**:
//   - locale별 *독립 문서 구조* 절대 금지. cache 는 ephemeral session view —
//     persistence 0줄, document entity schema 변경 0줄.
// =====================================================

import * as React from "react";
import {
  requestTranslationAssist,
  isOK,
  isUnavailable,
  isValidationError,
} from "@/lib/ai/client";
import type {
  AIUnavailableReason,
  TranslationDomain,
} from "@/lib/ai/types";
import {
  type DocumentLocale,
  DEFAULT_DOCUMENT_LOCALE,
} from "@/lib/document-locale";
import { cn } from "@/lib/utils";
import { TranslationLocaleSelector } from "./TranslationLocaleSelector";
import {
  TranslationStateView,
  type TranslationViewState,
} from "./TranslationStateView";

// -----------------------------------------------------
// Props
// -----------------------------------------------------

interface TranslationToolbarProps {
  /**
   * Build canonical source text. Closure — 호출 시점에 fresh evaluation
   * (문서 편집 중에도 최신 상태 반영). STEP 95 buildSourceText 답습.
   */
  buildSourceText: () => string;
  /**
   * Source locale. Default "ko" (갤러리 baseline).
   * AILocale 타입 — DocumentLocale 과 동일 union.
   */
  sourceLocale?: DocumentLocale;
  /**
   * Translation domain — prompt builder (`buildTranslationPrompt`) 가
   * 영역별 register 조정에 사용. 기본 "general".
   */
  domain?: TranslationDomain;
  className?: string;
}

// -----------------------------------------------------
// Cache entry
// -----------------------------------------------------

interface TranslationCacheEntry {
  text: string;
  notes: string[];
}

type TranslationCache = Partial<Record<DocumentLocale, TranslationCacheEntry>>;

// -----------------------------------------------------
// Component
// -----------------------------------------------------

export const TranslationToolbar: React.FC<TranslationToolbarProps> = ({
  buildSourceText,
  sourceLocale = DEFAULT_DOCUMENT_LOCALE,
  domain = "general",
  className,
}) => {
  // Active selected locale — defaults to source (idle state).
  const [activeLocale, setActiveLocale] =
    React.useState<DocumentLocale>(sourceLocale);

  // 4-state machine view state.
  const [viewState, setViewState] = React.useState<TranslationViewState>({
    kind: "idle",
  });

  // Per-target cache. Failure 시 unchanged → 이전 성공 결과 보존
  // (사용자 spec: 기존 locale content 절대 overwrite 금지).
  const cacheRef = React.useRef<TranslationCache>({});

  // Source snapshot for cache invalidation. 새 source 면 cache 자동 reset.
  const lastSourceRef = React.useRef<string>("");

  // Latest request token — race condition 가드 (이전 in-flight 응답이
  // 새 요청 결과를 덮어쓰는 것 방지).
  const requestTokenRef = React.useRef<number>(0);

  // ---------------------------------------------------
  // Source change detection — 새 source 진입 시 cache invalidate
  // ---------------------------------------------------
  const checkAndInvalidateCache = React.useCallback((currentSource: string) => {
    if (currentSource !== lastSourceRef.current) {
      cacheRef.current = {};
      lastSourceRef.current = currentSource;
    }
  }, []);

  // ---------------------------------------------------
  // Locale change handler — 사용자 명시 click (rule_5 AI-Human Loop)
  // ---------------------------------------------------
  const onLocaleChange = React.useCallback(
    async (next: DocumentLocale) => {
      setActiveLocale(next);

      // 1) Source locale 선택 → idle (no API call ever).
      if (next === sourceLocale) {
        setViewState({ kind: "idle" });
        return;
      }

      // 2) Empty source guard.
      const source = buildSourceText().trim();
      if (source.length === 0) {
        setViewState({ kind: "failed", target: next, reason: "empty_source" });
        return;
      }

      // 3) Cache invalidation if source changed since last translation.
      checkAndInvalidateCache(source);

      // 4) Cache hit → instant projection.
      const cached = cacheRef.current[next];
      if (cached) {
        setViewState({
          kind: "translated",
          target: next,
          text: cached.text,
          notes: cached.notes,
        });
        return;
      }

      // 5) Generate request token for race-condition guard.
      const token = ++requestTokenRef.current;

      // 6) Translating state.
      setViewState({ kind: "translating", target: next });

      // 7) Server call (AI-disabled safe mode 보존).
      const response = await requestTranslationAssist(
        {
          sourceText: source,
          sourceLocale,
          targetLocale: next,
          domain,
        },
        next, // locale arg for AI infra (output locale)
      );

      // 8) Stale response guard — 사용자가 그 사이 다른 locale 클릭 시 무시.
      if (token !== requestTokenRef.current) return;

      if (isOK(response)) {
        const text = response.output.translatedText ?? "";
        const notes = response.output.notes ?? [];
        cacheRef.current[next] = { text, notes };
        setViewState({ kind: "translated", target: next, text, notes });
        return;
      }

      // ---------------------------------------------------
      // Failure path — cache 미변경 (이전 결과 보존)
      // ---------------------------------------------------
      let reason:
        | AIUnavailableReason
        | "validation_error"
        | "network_error"
        | "empty_source" = "network_error";

      if (isUnavailable(response)) {
        reason = response.reason;
      } else if (isValidationError(response)) {
        reason = "validation_error";
      }

      setViewState({ kind: "failed", target: next, reason });
    },
    [
      sourceLocale,
      buildSourceText,
      domain,
      checkAndInvalidateCache,
    ],
  );

  // ---------------------------------------------------
  // Copy handler (translated state only)
  // ---------------------------------------------------
  const onCopy = React.useCallback((text: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  // ---------------------------------------------------
  // Render
  // ---------------------------------------------------
  const isBusy = viewState.kind === "translating";

  // Source for idle render — read fresh at render time.
  // (buildSourceText 는 closure — 사용자가 source 편집 시에도 최신 반영)
  const liveSource = React.useMemo(
    () => buildSourceText(),
    // 의도적 매 render 호출 — 편집 중인 textarea 등 dynamic source 대응.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buildSourceText, viewState.kind],
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.08em] text-ink-subtle">
          다국어 보기 — Multilingual View
        </span>
        <TranslationLocaleSelector
          value={activeLocale}
          sourceLocale={sourceLocale}
          onChange={onLocaleChange}
          disabled={isBusy}
        />
      </div>
      <TranslationStateView
        state={viewState}
        sourceText={liveSource}
        sourceLocale={sourceLocale}
        onCopy={viewState.kind === "translated" ? onCopy : undefined}
      />
    </div>
  );
};
