// AXVELA AI Integration — Configuration & Feature Flags
// ======================================================
// 정착 시점: STEP 93 (2026-05-07).
// 정합: AXVELA_AI_INTEGRATION.md §4 (AI-Disabled Safe Mode) + §7 (Provider Abstraction).
//
// 핵심 원칙 (AI_INTEGRATION §4.1):
//   AXVELA의 AI 기능은 default DISABLED.
//   3 env var (AXVELA_AI_ENABLED + AXVELA_AI_PROVIDER + AXVELA_AI_API_KEY) 모두 set 필요.
//
// Server-side only (AI_INTEGRATION §7.2):
//   API key는 process.env로만 접근.
//   NEXT_PUBLIC_ prefix 절대 금지.
// ======================================================

import type { AIAssistKind, AIProvider } from "./types";
import { AI_ASSIST_KINDS } from "./types";

// -----------------------------------------------------
// 1. Environment Variables (AI_INTEGRATION §4.1 + §4.2)
// -----------------------------------------------------

// Top-level master switch.
const ENV_AI_ENABLED = "AXVELA_AI_ENABLED";
const ENV_AI_PROVIDER = "AXVELA_AI_PROVIDER";
const ENV_AI_API_KEY = "AXVELA_AI_API_KEY";
const ENV_AI_MODEL = "AXVELA_AI_MODEL";

// Per-kind granular flags (AI_INTEGRATION §4.2).
// Each defaults to enabled when master AI is enabled.
const ENV_AI_KIND_FLAG: Record<AIAssistKind, string> = {
  artwork_metadata: "AXVELA_AI_ARTWORK_METADATA_ENABLED",
  document_writing: "AXVELA_AI_DOCUMENT_WRITING_ENABLED",
  condition_compare: "AXVELA_AI_CONDITION_COMPARE_ENABLED",
  operational_insight: "AXVELA_AI_OPERATIONAL_INSIGHT_ENABLED",
  translation: "AXVELA_AI_TRANSLATION_ENABLED",
};

// -----------------------------------------------------
// 2. Provider Defaults
// -----------------------------------------------------

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-7",
  openai: "gpt-4-turbo",
  gemini: "gemini-1.5-pro",
};

const VALID_PROVIDERS: readonly AIProvider[] = [
  "anthropic",
  "openai",
  "gemini",
] as const;

// -----------------------------------------------------
// 3. Safe Lookup Helpers (server-side only)
// -----------------------------------------------------
// Note: Client components must NEVER import these — server-only API.

const readEnv = (key: string): string | undefined => {
  // process.env is read-only; missing keys → undefined.
  // typeof process check guards client-side accidental import.
  if (typeof process === "undefined" || !process.env) return undefined;
  const value = process.env[key];
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const isTruthyFlag = (value: string | undefined): boolean => {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower === "true" || lower === "1" || lower === "yes";
};

// -----------------------------------------------------
// 4. Configuration State Read (deterministic per env)
// -----------------------------------------------------

export interface AIConfigSnapshot {
  enabled: boolean;
  provider: AIProvider | null;
  model: string | null;
  apiKeyConfigured: boolean;
  perKindEnabled: Record<AIAssistKind, boolean>;
}

export const readAIConfig = (
  envOverride?: Record<string, string | undefined>,
): AIConfigSnapshot => {
  // Override 가능 — test scenarios에서 inject 가능.
  // Production 시점에서는 envOverride 없이 호출 → process.env 직접 read.
  const env = (key: string) => envOverride?.[key] ?? readEnv(key);

  const masterEnabled = isTruthyFlag(env(ENV_AI_ENABLED));
  const providerRaw = env(ENV_AI_PROVIDER);
  const apiKey = env(ENV_AI_API_KEY);
  const modelOverride = env(ENV_AI_MODEL);

  // Provider validation
  const provider: AIProvider | null =
    providerRaw && (VALID_PROVIDERS as readonly string[]).includes(providerRaw)
      ? (providerRaw as AIProvider)
      : null;

  // Model resolution
  const model = provider ? modelOverride ?? DEFAULT_MODELS[provider] : null;

  // API key configured (presence only, never expose value)
  const apiKeyConfigured = !!apiKey && apiKey.length > 8;

  // Effective enabled = master + provider valid + api key present
  const effectivelyEnabled = masterEnabled && provider !== null && apiKeyConfigured;

  // Per-kind: each defaults to enabled when master is enabled,
  // but can be individually disabled via per-kind env flag (set to "false" / "0").
  // If per-kind env is unset → inherits master.
  const perKindEnabled = AI_ASSIST_KINDS.reduce(
    (acc, kind) => {
      const flagEnv = env(ENV_AI_KIND_FLAG[kind]);
      if (flagEnv === undefined) {
        acc[kind] = effectivelyEnabled;
      } else {
        // Explicit per-kind flag — use its value (master must also be on).
        acc[kind] = effectivelyEnabled && isTruthyFlag(flagEnv);
      }
      return acc;
    },
    {} as Record<AIAssistKind, boolean>,
  );

  return {
    enabled: effectivelyEnabled,
    provider,
    model,
    apiKeyConfigured,
    perKindEnabled,
  };
};

// -----------------------------------------------------
// 5. Per-Kind Check (route 진입 시점에 사용)
// -----------------------------------------------------

export const isKindEnabled = (
  kind: AIAssistKind,
  envOverride?: Record<string, string | undefined>,
): boolean => readAIConfig(envOverride).perKindEnabled[kind];

// -----------------------------------------------------
// 6. API Key Read (server-side only)
// -----------------------------------------------------
// 절대 client에 노출 금지. 본 함수는 API route 안에서만 호출.
// 본 함수의 return 값은 *절대* response body에 포함 금지.

export const readAIApiKey = (
  envOverride?: Record<string, string | undefined>,
): string | null => {
  const env = (key: string) => envOverride?.[key] ?? readEnv(key);
  const key = env(ENV_AI_API_KEY);
  return key && key.length > 8 ? key : null;
};

// -----------------------------------------------------
// 7. Reasonable Defaults (AI_INTEGRATION §6.3 — determinism)
// -----------------------------------------------------

export const AI_DEFAULTS = {
  temperature: 0.1,
  topP: 0.9,
  maxTokens: 1000,
  timeoutMs: 30_000,
} as const;

// -----------------------------------------------------
// 8. Const exports
// -----------------------------------------------------

export const AI_CONFIG_ENV_KEYS = {
  enabled: ENV_AI_ENABLED,
  provider: ENV_AI_PROVIDER,
  apiKey: ENV_AI_API_KEY,
  model: ENV_AI_MODEL,
  perKind: ENV_AI_KIND_FLAG,
} as const;
