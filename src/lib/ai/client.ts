// AXVELA AI Integration — Client-Side Typed Wrapper
// ====================================================
// 정착 시점: STEP 93 (2026-05-07).
// 정합: AXVELA_AI_INTEGRATION.md §3.1 (UI → backend route).
//
// 핵심 원칙:
//   - Client 코드는 본 wrapper만 사용. 외부 provider 직접 호출 절대 금지.
//   - API key는 server-side only (config.ts).
//   - 본 파일은 client component에서 import 가능.
//
// Type-safe per kind (AI_INTEGRATION §3.3):
//   const r = await requestAIAssist({ kind: "artwork_metadata", input: {...} });
//   r.output → ArtworkMetadataOutput (auto-inferred)
// ====================================================

import type {
  AIAssistKind,
  AIAssistRequest,
  AIAssistResponse,
  AIAssistInputMap,
  AIAssistOutputMap,
  AILocale,
} from "./types";

// -----------------------------------------------------
// 1. Endpoint
// -----------------------------------------------------

const AI_ASSIST_ENDPOINT = "/api/ai-assist";

// -----------------------------------------------------
// 2. Request Helper (overloaded for type-safety per kind)
// -----------------------------------------------------

export interface RequestAIAssistOptions {
  signal?: AbortSignal;
  timeoutMs?: number; // client-side timeout; defaults 30s
}

const DEFAULT_CLIENT_TIMEOUT_MS = 30_000;

const buildFallback = <K extends AIAssistKind>(
  kind: K,
): AIAssistOutputMap[K] | undefined => {
  // Per-kind structured fallback. Returns the *minimum viable empty shape*
  // so UI can render gracefully without further checks.
  // Generic narrowing inside switch loses kind specificity → use unknown bridge.
  switch (kind) {
    case "artwork_metadata":
      return { normalizationNotes: [] } as unknown as AIAssistOutputMap[K];
    case "document_writing":
      return { rewrittenText: "", toneNotes: [] } as unknown as AIAssistOutputMap[K];
    case "condition_compare":
      return {
        summary: "",
        observationLines: [],
        reviewRequired: false,
      } as unknown as AIAssistOutputMap[K];
    case "operational_insight":
      return {
        overview: [],
        categoryRewrites: [],
      } as unknown as AIAssistOutputMap[K];
    case "translation":
      return { translatedText: "", notes: [] } as unknown as AIAssistOutputMap[K];
    default:
      return undefined;
  }
};

// Discriminated union narrowing helper.
// Note: TypeScript's structural matching makes generic return inference
// with `AIAssistRequest<K>` slightly tricky — we use an explicit shape build.
const buildRequestBody = <K extends AIAssistKind>(args: {
  kind: K;
  input: AIAssistInputMap[K];
  locale?: AILocale;
  meta?: { gallerySlug?: string; userId?: string };
}): AIAssistRequest => {
  return {
    kind: args.kind,
    input: args.input,
    ...(args.locale ? { locale: args.locale } : {}),
    ...(args.meta ? { meta: args.meta } : {}),
  } as AIAssistRequest;
};

export const requestAIAssist = async <K extends AIAssistKind>(args: {
  kind: K;
  input: AIAssistInputMap[K];
  locale?: AILocale;
  meta?: { gallerySlug?: string; userId?: string };
  options?: RequestAIAssistOptions;
}): Promise<AIAssistResponse<K>> => {
  const { kind, options } = args;

  // Build local AbortController with timeout to combine with caller's signal.
  const localCtrl = new AbortController();
  const externalSignal = options?.signal;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_CLIENT_TIMEOUT_MS;

  if (externalSignal) {
    if (externalSignal.aborted) {
      localCtrl.abort();
    } else {
      externalSignal.addEventListener("abort", () => localCtrl.abort(), {
        once: true,
      });
    }
  }

  const timeoutId = setTimeout(() => localCtrl.abort(), timeoutMs);

  try {
    const response = await fetch(AI_ASSIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRequestBody(args)),
      signal: localCtrl.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Server error (5xx / 4xx). Return structured ai_unavailable so UI
      // can render fallback path without throwing.
      return {
        status: "ai_unavailable",
        kind,
        reason:
          response.status === 429 ? "rate_limit" : "provider_error",
        fallback: buildFallback(kind),
      };
    }

    const json = (await response.json()) as AIAssistResponse<K>;
    return json;
  } catch (err) {
    clearTimeout(timeoutId);

    // Determine cause: aborted / network error.
    const aborted =
      (err instanceof Error && err.name === "AbortError") ||
      localCtrl.signal.aborted;

    return {
      status: "ai_unavailable",
      kind,
      reason: aborted ? "timeout" : "provider_error",
      fallback: buildFallback(kind),
    };
  }
};

// -----------------------------------------------------
// 3. Convenience: per-kind helpers (better DX in UI)
// -----------------------------------------------------

export const requestArtworkMetadataAssist = (
  input: AIAssistInputMap["artwork_metadata"],
  locale?: AILocale,
  options?: RequestAIAssistOptions,
) => requestAIAssist({ kind: "artwork_metadata", input, locale, options });

export const requestDocumentWritingAssist = (
  input: AIAssistInputMap["document_writing"],
  locale?: AILocale,
  options?: RequestAIAssistOptions,
) => requestAIAssist({ kind: "document_writing", input, locale, options });

export const requestConditionCompareAssist = (
  input: AIAssistInputMap["condition_compare"],
  locale?: AILocale,
  options?: RequestAIAssistOptions,
) => requestAIAssist({ kind: "condition_compare", input, locale, options });

export const requestOperationalInsightAssist = (
  input: AIAssistInputMap["operational_insight"],
  locale?: AILocale,
  options?: RequestAIAssistOptions,
) => requestAIAssist({ kind: "operational_insight", input, locale, options });

export const requestTranslationAssist = (
  input: AIAssistInputMap["translation"],
  locale?: AILocale,
  options?: RequestAIAssistOptions,
) => requestAIAssist({ kind: "translation", input, locale, options });

// -----------------------------------------------------
// 4. Response narrowing helpers (UI consumption)
// -----------------------------------------------------

export const isOK = <K extends AIAssistKind>(
  res: AIAssistResponse<K>,
): res is Extract<AIAssistResponse<K>, { status: "ok" }> =>
  res.status === "ok";

export const isUnavailable = <K extends AIAssistKind>(
  res: AIAssistResponse<K>,
): res is Extract<AIAssistResponse<K>, { status: "ai_unavailable" }> =>
  res.status === "ai_unavailable";

export const isValidationError = <K extends AIAssistKind>(
  res: AIAssistResponse<K>,
): res is Extract<AIAssistResponse<K>, { status: "validation_error" }> =>
  res.status === "validation_error";
