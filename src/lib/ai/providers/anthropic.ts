// =====================================================
// AXVELA — Anthropic Provider Client (STEP 94)
// =====================================================
//
// SERVER-SIDE ONLY. Do NOT import from client components.
//
// 본 모듈은 Anthropic Messages API와의 실제 HTTP 통신을 담당하는
// 유일한 위치. STEP 93의 protocol skeleton (types / config / prompts /
// route)에서 deferred 상태였던 actual provider call을 본 STEP 94에서 활성.
//
// AI_INTEGRATION §3.3 (Provider Abstraction) — anthropic / openai / gemini는
// 동일 protocol로 추상화. 본 파일은 anthropic 단일 provider 구현.
//
// rule_5 (AI-Human Loop) 준수 — 자동 호출 0건, route handler에서 사용자
// 명시 trigger 시만 호출. AI Direction §1 — provider response는 route
// handler의 scanOutputForForbidden 검사를 거쳐야만 client에 도달.
//
// API key는 process.env에서 server-side만 접근. NEXT_PUBLIC_* 사용 금지.
// =====================================================

import type { AIPromptBundle } from "@/lib/ai/prompts";

// -----------------------------------------------------
// 1. Constants
// -----------------------------------------------------

const ANTHROPIC_MESSAGES_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

// -----------------------------------------------------
// 2. Result Shape
// -----------------------------------------------------

export type AnthropicCallResult =
  | {
      ok: true;
      text: string;
      model: string;
      tokens?: { input: number; output: number };
    }
  | {
      ok: false;
      reason:
        | "timeout"
        | "network_error"
        | "non_200_status"
        | "malformed_response"
        | "no_text_content";
      detail?: string;
    };

export interface AnthropicCallOptions {
  apiKey: string;
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

// -----------------------------------------------------
// 3. Anthropic API Response Shape (subset, defensive)
// -----------------------------------------------------

interface AnthropicTextContentBlock {
  type: "text";
  text: string;
}

interface AnthropicResponseBody {
  id?: string;
  type?: string;
  role?: string;
  model?: string;
  content?: Array<AnthropicTextContentBlock | { type: string; [k: string]: unknown }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  stop_reason?: string;
}

// -----------------------------------------------------
// 4. callAnthropic — single API request
// -----------------------------------------------------

/**
 * Server-side Anthropic Messages API call.
 * NEVER call this from client code — API key 노출 위험.
 *
 * 본 함수는 raw text 반환만 담당. JSON 파싱 / 검증 / forbidden 검사는
 * route handler (api/ai-assist/route.ts)에서 수행.
 */
export const callAnthropic = async (
  promptBundle: AIPromptBundle,
  options: AnthropicCallOptions,
): Promise<AnthropicCallResult> => {
  const {
    apiKey,
    model,
    temperature = 0.1,
    // 기본값 미전송 — 신모델 (4.6+) 은 temperature 와 동시 사용 거부, conditional 분기로 제어
    topP = undefined,
    maxTokens = 1000,
    timeoutMs = 30000,
  } = options;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    system: promptBundle.system,
    messages: [
      {
        role: "user",
        content: promptBundle.user,
      },
    ],
  };
  // top_p 는 caller 가 명시한 경우에만 전송 (Anthropic 신모델 4.6+ 은 temperature 와 동시 사용 거부)
  if (topP !== undefined && topP !== null) {
    requestBody.top_p = topP;
  }

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_MESSAGES_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, reason: "timeout" };
    }
    return {
      ok: false,
      reason: "network_error",
      detail: err instanceof Error ? err.message : "unknown",
    };
  }

  clearTimeout(timeoutHandle);

  if (!response.ok) {
    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch {
      // ignore
    }
    return {
      ok: false,
      reason: "non_200_status",
      detail: `HTTP ${response.status}: ${bodyText.slice(0, 200)}`,
    };
  }

  let body: AnthropicResponseBody;
  try {
    body = (await response.json()) as AnthropicResponseBody;
  } catch (err) {
    return {
      ok: false,
      reason: "malformed_response",
      detail: err instanceof Error ? err.message : "json parse failed",
    };
  }

  // Extract concatenated text from content blocks (defensive — Anthropic may
  // return multiple text blocks; we join them with newlines).
  const textBlocks = (body.content ?? []).filter(
    (block): block is AnthropicTextContentBlock =>
      typeof block === "object" &&
      block !== null &&
      (block as { type?: unknown }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string",
  );

  if (textBlocks.length === 0) {
    return { ok: false, reason: "no_text_content" };
  }

  const text = textBlocks.map((b) => b.text).join("\n");

  return {
    ok: true,
    text,
    model: body.model ?? model,
    tokens:
      typeof body.usage?.input_tokens === "number" &&
      typeof body.usage?.output_tokens === "number"
        ? {
            input: body.usage.input_tokens,
            output: body.usage.output_tokens,
          }
        : undefined,
  };
};
