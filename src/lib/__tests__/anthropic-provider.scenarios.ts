// =====================================================
// AXVELA — Anthropic Provider Scenarios (STEP 94)
// =====================================================
//
// Mock-based scenarios. NO live network calls. Mock global fetch via
// vi.fn / inline fn replacement.
//
// 검증 항목:
//   §1 success path — 정상 200 + content[].text → ok=true
//   §2 timeout — AbortController.abort() → reason=timeout
//   §3 non-200 status — 401/500 → reason=non_200_status
//   §4 malformed JSON body → reason=malformed_response
//   §5 no text content blocks → reason=no_text_content
//   §6 invokeProvider dispatch — anthropic switch
//   §7 invokeProvider dispatch — openai/gemini → provider_not_implemented
//
// 외부 test 라이브러리 0개 — inline assertion + global fetch swap pattern.
// =====================================================

import {
  callAnthropic,
  type AnthropicCallResult,
} from "@/lib/ai/providers/anthropic";
import { invokeProvider } from "@/lib/ai/invoke";
import type { AIPromptBundle } from "@/lib/ai/prompts";

// -----------------------------------------------------
// Inline assertion helpers
// -----------------------------------------------------

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

const assertEqual = <T>(actual: T, expected: T, label: string): void => {
  if (actual !== expected) {
    throw new AssertionError(
      `${label}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
};

const assertTrue = (cond: boolean, label: string): void => {
  if (!cond) throw new AssertionError(label);
};

// -----------------------------------------------------
// Fetch mock helpers
// -----------------------------------------------------

type FetchSpy = {
  calls: Array<{ url: string; init?: RequestInit }>;
  restore: () => void;
};

const installFetchMock = (
  impl: (url: string, init?: RequestInit) => Promise<Response>,
): FetchSpy => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    calls.push({ url: urlStr, init });
    return impl(urlStr, init);
  }) as typeof globalThis.fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
};

const buildSuccessResponse = (jsonObject: unknown): Response => {
  return new Response(JSON.stringify(jsonObject), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const buildErrorResponse = (status: number, body: string): Response => {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain" },
  });
};

// -----------------------------------------------------
// Test fixture
// -----------------------------------------------------

const fxPromptBundle: AIPromptBundle = {
  system: "You are AXVELA's metadata assistant.",
  user: "Normalize: 캔버스에 유채",
  outputSchemaDescription: "Object with normalizedMaterial and normalizationNotes.",
  expectedJsonKeys: ["normalizationNotes"],
};

const fxOptions = {
  apiKey: "sk-ant-test-key",
  model: "claude-sonnet-4-6",
  temperature: 0.1,
  topP: 0.9,
  maxTokens: 1000,
  timeoutMs: 5000,
};

// -----------------------------------------------------
// SCENARIOS
// -----------------------------------------------------

interface ScenarioResult {
  name: string;
  ok: boolean;
  detail?: string;
}

const SCENARIOS: Array<() => Promise<ScenarioResult>> = [];

// §1 — Success path
SCENARIOS.push(async () => {
  const name = "§1 success path → ok=true with text + model";
  const spy = installFetchMock(async () =>
    buildSuccessResponse({
      id: "msg_test_01",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-6-20251001",
      content: [
        {
          type: "text",
          text: '{"normalizedMaterial":"Oil on Canvas","normalizationNotes":["한글 → 영문"]}',
        },
      ],
      usage: { input_tokens: 50, output_tokens: 30 },
      stop_reason: "end_turn",
    }),
  );
  try {
    const result = await callAnthropic(fxPromptBundle, fxOptions);
    assertTrue(result.ok, "result.ok should be true");
    if (result.ok) {
      assertTrue(
        result.text.includes("Oil on Canvas"),
        "text should contain Oil on Canvas",
      );
      assertEqual(result.model, "claude-sonnet-4-6-20251001", "model");
      assertTrue(result.tokens?.input === 50, "tokens.input should be 50");
      assertTrue(result.tokens?.output === 30, "tokens.output should be 30");
    }
    assertEqual(spy.calls.length, 1, "fetch call count");
    assertTrue(
      spy.calls[0].url === "https://api.anthropic.com/v1/messages",
      "endpoint URL",
    );
    const headers = (spy.calls[0].init?.headers ?? {}) as Record<string, string>;
    assertEqual(headers["x-api-key"], "sk-ant-test-key", "x-api-key header");
    assertEqual(headers["anthropic-version"], "2023-06-01", "version header");
    return { name, ok: true };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    spy.restore();
  }
});

// §2 — Timeout via AbortError
SCENARIOS.push(async () => {
  const name = "§2 timeout → reason=timeout";
  const spy = installFetchMock(async (_url, init) => {
    return new Promise((_resolve, reject) => {
      const sig = init?.signal as AbortSignal | undefined;
      if (sig) {
        sig.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      }
    });
  });
  try {
    const result = await callAnthropic(fxPromptBundle, {
      ...fxOptions,
      timeoutMs: 50,
    });
    assertTrue(!result.ok, "result.ok should be false");
    if (!result.ok) {
      assertEqual(result.reason, "timeout", "reason");
    }
    return { name, ok: true };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    spy.restore();
  }
});

// §3 — Non-200 status
SCENARIOS.push(async () => {
  const name = "§3 401 status → reason=non_200_status";
  const spy = installFetchMock(async () =>
    buildErrorResponse(401, "Invalid API key"),
  );
  try {
    const result = await callAnthropic(fxPromptBundle, fxOptions);
    assertTrue(!result.ok, "result.ok should be false");
    if (!result.ok) {
      assertEqual(result.reason, "non_200_status", "reason");
      assertTrue(
        (result.detail ?? "").includes("401"),
        "detail should mention 401",
      );
    }
    return { name, ok: true };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    spy.restore();
  }
});

// §4 — Malformed JSON body
SCENARIOS.push(async () => {
  const name = "§4 malformed JSON body → reason=malformed_response";
  const spy = installFetchMock(async () => {
    return new Response("not valid json {{{", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  try {
    const result = await callAnthropic(fxPromptBundle, fxOptions);
    assertTrue(!result.ok, "result.ok should be false");
    if (!result.ok) {
      assertEqual(result.reason, "malformed_response", "reason");
    }
    return { name, ok: true };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    spy.restore();
  }
});

// §5 — No text content blocks
SCENARIOS.push(async () => {
  const name = "§5 empty content → reason=no_text_content";
  const spy = installFetchMock(async () =>
    buildSuccessResponse({
      id: "msg_test_05",
      type: "message",
      model: "claude-sonnet-4-6",
      content: [],
    }),
  );
  try {
    const result = await callAnthropic(fxPromptBundle, fxOptions);
    assertTrue(!result.ok, "result.ok should be false");
    if (!result.ok) {
      assertEqual(result.reason, "no_text_content", "reason");
    }
    return { name, ok: true };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    spy.restore();
  }
});

// §6 — invokeProvider dispatch to anthropic
SCENARIOS.push(async () => {
  const name = "§6 invokeProvider(anthropic) dispatches to callAnthropic";
  const spy = installFetchMock(async () =>
    buildSuccessResponse({
      content: [{ type: "text", text: '{"normalizationNotes":[]}' }],
      model: "claude-sonnet-4-6",
    }),
  );
  try {
    const result = await invokeProvider(fxPromptBundle, {
      provider: "anthropic",
      apiKey: "sk-ant-test",
    });
    assertTrue(result.ok, "result.ok should be true");
    assertEqual(spy.calls.length, 1, "fetch call count");
    return { name, ok: true };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    spy.restore();
  }
});

// §7 — invokeProvider dispatch to openai → not_implemented
SCENARIOS.push(async () => {
  const name = "§7 invokeProvider(openai) → provider_not_implemented";
  const spy = installFetchMock(async () =>
    buildSuccessResponse({ content: [] }),
  );
  try {
    const result = await invokeProvider(fxPromptBundle, {
      provider: "openai",
      apiKey: "sk-openai-test",
    });
    assertTrue(!result.ok, "result.ok should be false");
    if (!result.ok) {
      assertEqual(result.reason, "provider_not_implemented", "reason");
    }
    assertEqual(spy.calls.length, 0, "fetch should NOT be called");
    return { name, ok: true };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    spy.restore();
  }
});

// §8 — invokeProvider dispatch to gemini → not_implemented
SCENARIOS.push(async () => {
  const name = "§8 invokeProvider(gemini) → provider_not_implemented";
  const spy = installFetchMock(async () =>
    buildSuccessResponse({ content: [] }),
  );
  try {
    const result = await invokeProvider(fxPromptBundle, {
      provider: "gemini",
      apiKey: "gem-test",
    });
    assertTrue(!result.ok, "result.ok should be false");
    if (!result.ok) {
      assertEqual(result.reason, "provider_not_implemented", "reason");
    }
    assertEqual(spy.calls.length, 0, "fetch should NOT be called");
    return { name, ok: true };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    spy.restore();
  }
});

// §9 — Body shape sanity check
SCENARIOS.push(async () => {
  const name = "§9 request body has model/system/messages/max_tokens";
  let captured: Record<string, unknown> | undefined;
  const spy = installFetchMock(async (_url, init) => {
    if (init?.body && typeof init.body === "string") {
      captured = JSON.parse(init.body) as Record<string, unknown>;
    }
    return buildSuccessResponse({
      content: [{ type: "text", text: '{"normalizationNotes":[]}' }],
      model: "claude-sonnet-4-6",
    });
  });
  try {
    await callAnthropic(fxPromptBundle, fxOptions);
    assertTrue(captured !== undefined, "body captured");
    const body = captured as Record<string, unknown>;
    assertEqual(body.model, "claude-sonnet-4-6", "body.model");
    assertEqual(body.max_tokens, 1000, "body.max_tokens");
    assertTrue(typeof body.system === "string", "body.system");
    assertTrue(Array.isArray(body.messages), "body.messages");
    const msgs = body.messages as Array<Record<string, unknown>>;
    assertEqual(msgs[0]?.role, "user", "messages[0].role");
    return { name, ok: true };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    spy.restore();
  }
});

// -----------------------------------------------------
// Runner
// -----------------------------------------------------

export const runAllScenarios = async (): Promise<{
  summary: string;
  passed: number;
  failed: number;
  failures: ScenarioResult[];
}> => {
  const results: ScenarioResult[] = [];
  for (const scenario of SCENARIOS) {
    results.push(await scenario());
  }
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const failures = results.filter((r) => !r.ok);
  return {
    summary: `${passed}/${results.length} passed`,
    passed,
    failed,
    failures,
  };
};
