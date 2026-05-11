// =====================================================
// AXVELA — AI Provider Dispatch (STEP 94)
// =====================================================
//
// SERVER-SIDE ONLY.
//
// 본 모듈은 config.provider 값에 따라 provider client를 dispatch.
// AI_INTEGRATION §3.3 (Provider Abstraction) — 단일 진입점.
//
// STEP 94 범위: anthropic 1개 provider 활성. openai / gemini는
// "provider_not_implemented" reason으로 graceful 거부 — 향후 STEP에서
// 동일 패턴으로 추가 가능.
//
// 본 모듈의 역할은 *raw text 호출*만. JSON 파싱 / forbidden 검사는
// route handler가 수행 — separation of concerns 명확.
// =====================================================

import type { AIPromptBundle } from "@/lib/ai/prompts";
import type { AIProvider } from "@/lib/ai/types";
import { AI_DEFAULTS, DEFAULT_MODELS } from "@/lib/ai/config";
import {
  callAnthropic,
  type AnthropicCallResult,
} from "@/lib/ai/providers/anthropic";

// -----------------------------------------------------
// 1. Result Shape
// -----------------------------------------------------

export type InvokeProviderResult =
  | {
      ok: true;
      text: string;
      model: string;
      tokens?: { input: number; output: number };
    }
  | {
      ok: false;
      reason:
        | "provider_not_implemented"
        | "timeout"
        | "network_error"
        | "non_200_status"
        | "malformed_response"
        | "no_text_content";
      detail?: string;
    };

export interface InvokeProviderOptions {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

// -----------------------------------------------------
// 2. invokeProvider — dispatch entry
// -----------------------------------------------------

/**
 * Server-side dispatch — raw text completion only.
 * Output validation / forbidden detection은 route handler 책임.
 */
export const invokeProvider = async (
  promptBundle: AIPromptBundle,
  options: InvokeProviderOptions,
): Promise<InvokeProviderResult> => {
  const {
    provider,
    apiKey,
    model = DEFAULT_MODELS[provider],
    temperature = AI_DEFAULTS.temperature,
    topP = AI_DEFAULTS.topP,
    maxTokens = AI_DEFAULTS.maxTokens,
    timeoutMs = AI_DEFAULTS.timeoutMs,
  } = options;

  switch (provider) {
    case "anthropic": {
      const result = await callAnthropic(promptBundle, {
        apiKey,
        model,
        temperature,
        topP,
        maxTokens,
        timeoutMs,
      });
      return mapAnthropicResult(result);
    }
    case "openai":
    case "gemini": {
      // STEP 94 범위 외. 동일 패턴으로 향후 STEP에서 추가 가능.
      // graceful 거부 — route handler는 ai_unavailable("provider_error")로 변환.
      return {
        ok: false,
        reason: "provider_not_implemented",
        detail: `${provider} provider client not implemented in STEP 94`,
      };
    }
    default: {
      // exhaustive narrowing
      const _exhaustive: never = provider;
      void _exhaustive;
      return {
        ok: false,
        reason: "provider_not_implemented",
        detail: "unknown provider",
      };
    }
  }
};

// -----------------------------------------------------
// 3. mapAnthropicResult — narrow to InvokeProviderResult
// -----------------------------------------------------

const mapAnthropicResult = (
  result: AnthropicCallResult,
): InvokeProviderResult => {
  if (result.ok) {
    return {
      ok: true,
      text: result.text,
      model: result.model,
      tokens: result.tokens,
    };
  }
  return {
    ok: false,
    reason: result.reason,
    detail: result.detail,
  };
};
