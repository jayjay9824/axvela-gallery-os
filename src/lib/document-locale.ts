// =====================================================
// AXVELA — Document Locale Enum (STEP 96)
// =====================================================
//
// **본 모듈의 정체**:
//   - 갤러리 운영 문서의 *projection locale* 단일 진실 원천 (Single Source of Truth).
//   - AI insertion point 의 `AILocale` 과 동일한 4 locale 을 그대로 alias —
//     UI surface 와 AI infra 가 enum 분리되어 drift 발생할 가능성 0건.
//
// **구조 원칙 (사용자 spec STEP 96)**:
//   - locale별 *독립* 문서 구조 절대 금지.
//   - single semantic document (원문 1개) → locale projection 여러 개.
//   - Document entity (Invoice / Receipt / TaxInvoice / ConditionReport /
//     Settlement / Logistics / Artwork) 는 schema 변경 0건 — 본 enum 은
//     순수 *display projection* 식별자.
//
// **외부 라이브러리 0개** — `AILocale` re-export only.
//
// **Cross-reference**:
//   - `src/lib/ai/types.ts:50` — `AILocale` 정의 (정착: STEP 93)
//   - `AXVELA_AI_INTEGRATION.md §2.5 Translation Layer`
// =====================================================

import type { AILocale } from "./ai/types";
import { AI_LOCALES, AI_LOCALE_LABEL_KR } from "./ai/types";

// -----------------------------------------------------
// 1. Type alias — single source of truth
// -----------------------------------------------------

/**
 * Document presentation locale.
 *
 * AILocale 과 *동일한 4 locale* 을 alias — UI 가 AI insertion point 의
 * locale enum 과 자연 합류. Drift 방지.
 */
export type DocumentLocale = AILocale;

// -----------------------------------------------------
// 2. Ordered locale list — UI 진입 순서
// -----------------------------------------------------

/**
 * Compact selector 표시 순서 — 한국어 first (default source), 그 다음
 * 국제 거래 frequency 순.
 */
export const DOCUMENT_LOCALES: readonly DocumentLocale[] = AI_LOCALES;

// -----------------------------------------------------
// 3. Display labels
// -----------------------------------------------------

/**
 * 풀 라벨 — 모달 / dropdown / accessibility 용.
 */
export const DOCUMENT_LOCALE_LABEL_FULL: Record<DocumentLocale, string> = {
  ...AI_LOCALE_LABEL_KR,
};

/**
 * Compact 2-letter 라벨 — segmented selector 용 ("KO EN JA ZH").
 *
 * 사용자 spec STEP 96 §UI 방향:
 *   - institutional / minimal / museum-safe / professional
 *   - flashy segmented control 금지
 *   - "KO EN JA ZH" 단순 횡렬
 */
export const DOCUMENT_LOCALE_LABEL_SHORT: Record<DocumentLocale, string> = {
  ko: "KO",
  en: "EN",
  ja: "JA",
  zh: "ZH",
};

// -----------------------------------------------------
// 4. Defaults
// -----------------------------------------------------

/**
 * 기본 source locale — 갤러리 운영 baseline.
 */
export const DEFAULT_DOCUMENT_LOCALE: DocumentLocale = "ko";

// -----------------------------------------------------
// 5. Pure helpers
// -----------------------------------------------------

/**
 * Source locale 외 target locale 후보 — selector 의 "전환 가능한 locale".
 *
 * 사용 예: source가 "ko" 일 때 ["en", "ja", "zh"] 반환.
 */
export const otherLocales = (
  source: DocumentLocale,
): readonly DocumentLocale[] =>
  DOCUMENT_LOCALES.filter((l) => l !== source);

/**
 * 안전한 locale 검증 — 외부 input (URL / persisted state / etc.) 진입 시.
 */
export const isDocumentLocale = (value: unknown): value is DocumentLocale =>
  typeof value === "string" &&
  (DOCUMENT_LOCALES as readonly string[]).includes(value);
