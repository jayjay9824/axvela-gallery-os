// AXVELA AI Integration — Server-Side API Route
// ================================================
// 정착 시점: STEP 93 (2026-05-07) — protocol skeleton.
// 활성 시점: STEP 94 (2026-05-07) — anthropic provider call activated.
// 정합: AXVELA_AI_INTEGRATION.md §3 (Protocol Architecture) + §4 (Safe Mode) + §7 (Provider Abstraction).
//
// 핵심 정책 (절대 위반 금지):
//   1. 본 route는 server-side ONLY. process.env 접근.
//   2. API key는 절대 response에 포함 금지.
//   3. AI 비활성 시 ai_unavailable 응답 (status 200, structured).
//   4. Forbidden phrase 검출 시 output_rejected 응답.
//   5. STEP 94: anthropic provider 활성. openai / gemini는 향후 STEP에서 동일 패턴 추가.
// ================================================

import { NextResponse } from "next/server";
import {
  AIAssistKind,
  AIAssistRequest,
  AIAssistResponse,
  detectForbiddenPhrase,
  isAIAssistKind,
  isAILocale,
  AILocale,
  AIAssistMeta,
  AIAssistInputMap,
  AIAssistOutputMap,
  AIUnavailableReason,
  DOCUMENT_WRITING_TARGETS,
} from "@/lib/ai/types";
import { readAIConfig, AI_DEFAULTS, readAIApiKey } from "@/lib/ai/config";
import {
  buildPrompt,
  tryParseJSONOutput,
  validateExpectedKeys,
} from "@/lib/ai/prompts";
import { invokeProvider } from "@/lib/ai/invoke";

// -----------------------------------------------------
// 1. Runtime / Edge config
// -----------------------------------------------------

// Use Node.js runtime — provider SDKs typically need it.
export const runtime = "nodejs";

// Disable response caching — AI calls are dynamic.
export const dynamic = "force-dynamic";

// -----------------------------------------------------
// 2. Request Body Validation
// -----------------------------------------------------

interface ValidationResult {
  ok: boolean;
  errors: string[];
  parsed?: AIAssistRequest;
}

const validateBody = (body: unknown): ValidationResult => {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { ok: false, errors: ["Request body must be a JSON object."] };
  }

  const b = body as Record<string, unknown>;

  // Kind validation
  if (!isAIAssistKind(b.kind)) {
    errors.push(
      `kind must be one of: artwork_metadata | document_writing | condition_compare | operational_insight | translation. Received: ${String(b.kind)}`,
    );
  }

  // Input presence
  if (!b.input || typeof b.input !== "object") {
    errors.push("input must be a non-null object.");
  }

  // Locale (optional)
  if (b.locale !== undefined && !isAILocale(b.locale)) {
    errors.push(
      `locale must be one of: ko | en | ja | zh. Received: ${String(b.locale)}`,
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Per-kind shape sanity
  const kind = b.kind as AIAssistKind;
  const input = b.input as Record<string, unknown>;

  switch (kind) {
    case "document_writing": {
      const dt = input.documentType;
      if (
        typeof dt !== "string" ||
        !(DOCUMENT_WRITING_TARGETS as readonly string[]).includes(dt)
      ) {
        errors.push(
          `document_writing.input.documentType must be one of: ${DOCUMENT_WRITING_TARGETS.join(" | ")}`,
        );
      }
      if (typeof input.shortNotes !== "string" || input.shortNotes.length === 0) {
        errors.push("document_writing.input.shortNotes must be a non-empty string.");
      }
      break;
    }
    case "translation": {
      if (!isAILocale(input.sourceLocale)) {
        errors.push("translation.input.sourceLocale must be one of: ko | en | ja | zh.");
      }
      if (!isAILocale(input.targetLocale)) {
        errors.push("translation.input.targetLocale must be one of: ko | en | ja | zh.");
      }
      if (typeof input.sourceText !== "string" || input.sourceText.length === 0) {
        errors.push("translation.input.sourceText must be a non-empty string.");
      }
      break;
    }
    case "condition_compare": {
      if (typeof input.baselineCapturedAt !== "string") {
        errors.push("condition_compare.input.baselineCapturedAt must be ISO datetime string.");
      }
      if (typeof input.currentCapturedAt !== "string") {
        errors.push("condition_compare.input.currentCapturedAt must be ISO datetime string.");
      }
      if (!Array.isArray(input.surfaceVarianceMetrics)) {
        errors.push("condition_compare.input.surfaceVarianceMetrics must be an array.");
      }
      break;
    }
    case "operational_insight": {
      if (typeof input.period !== "string" || !["7d", "14d", "30d"].includes(input.period)) {
        errors.push("operational_insight.input.period must be one of: 7d | 14d | 30d.");
      }
      if (typeof input.generatedAtISO !== "string") {
        errors.push("operational_insight.input.generatedAtISO must be ISO datetime string.");
      }
      if (input.snapshot === undefined || input.snapshot === null) {
        errors.push("operational_insight.input.snapshot must be present.");
      }
      break;
    }
    case "artwork_metadata":
      // All fields optional — but at least one must be present.
      if (
        !input.rawTitle &&
        !input.rawMaterial &&
        !input.rawCategory &&
        !input.rawNotes
      ) {
        errors.push(
          "artwork_metadata.input must include at least one of: rawTitle | rawMaterial | rawCategory | rawNotes.",
        );
      }
      break;
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors: [],
    parsed: b as unknown as AIAssistRequest,
  };
};

// -----------------------------------------------------
// 3. Fallback shapes (mirror client.ts buildFallback)
// -----------------------------------------------------

const buildFallback = <K extends AIAssistKind>(
  kind: K,
): AIAssistOutputMap[K] | undefined => {
  // Per-kind structured fallback. Generic narrowing inside switch loses
  // kind specificity → use unknown bridge to satisfy TS.
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
      return { overview: [], categoryRewrites: [] } as unknown as AIAssistOutputMap[K];
    case "translation":
      return { translatedText: "", notes: [] } as unknown as AIAssistOutputMap[K];
    default:
      return undefined;
  }
};

// -----------------------------------------------------
// 4. Output Guard (forbidden phrase scan)
// -----------------------------------------------------

const scanOutputForForbidden = (output: unknown): string | null => {
  // Recursively flatten string values from output object, then run detector.
  const collected: string[] = [];

  const visit = (value: unknown) => {
    if (typeof value === "string") {
      collected.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(visit);
    }
  };

  visit(output);
  for (const s of collected) {
    const found = detectForbiddenPhrase(s);
    if (found) return found;
  }
  return null;
};

// -----------------------------------------------------
// 5. POST Handler
// -----------------------------------------------------

export async function POST(request: Request) {
  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        status: "validation_error",
        kind: "artwork_metadata", // placeholder — kind unknown at this point
        errors: ["Invalid JSON body."],
      } satisfies AIAssistResponse,
      { status: 400 },
    );
  }

  // Validate
  const validation = validateBody(body);
  if (!validation.ok || !validation.parsed) {
    const inferKind = (body as { kind?: unknown })?.kind;
    return NextResponse.json(
      {
        status: "validation_error",
        kind: isAIAssistKind(inferKind) ? inferKind : "artwork_metadata",
        errors: validation.errors,
      } satisfies AIAssistResponse,
      { status: 400 },
    );
  }

  const req = validation.parsed;
  const kind = req.kind as AIAssistKind;
  const locale: AILocale = (req as { locale?: AILocale }).locale ?? "ko";

  // Check AI configuration
  const config = readAIConfig();

  if (!config.enabled) {
    return NextResponse.json(
      {
        status: "ai_unavailable",
        kind,
        reason: config.apiKeyConfigured ? "disabled" : "provider_not_configured",
        fallback: buildFallback(kind),
      } satisfies AIAssistResponse,
      { status: 200 },
    );
  }

  if (!config.perKindEnabled[kind]) {
    return NextResponse.json(
      {
        status: "ai_unavailable",
        kind,
        reason: "kind_disabled",
        fallback: buildFallback(kind),
      } satisfies AIAssistResponse,
      { status: 200 },
    );
  }

  // Build prompt — verifies template exists for this kind.
  // (Errors here would indicate a programming mistake; we surface as provider_error.)
  let promptBundle;
  try {
    promptBundle = buildPrompt(
      kind,
      req.input as AIAssistInputMap[typeof kind],
      locale,
    );
  } catch {
    return NextResponse.json(
      {
        status: "ai_unavailable",
        kind,
        reason: "provider_error",
        fallback: buildFallback(kind),
      } satisfies AIAssistResponse,
      { status: 200 },
    );
  }

  // -----------------------------------------------------
  // 6. Provider Call (STEP 94: activated — anthropic provider client)
  // -----------------------------------------------------
  //
  // STEP 93 protocol skeleton 위에 실제 provider 호출 활성. anthropic 단일
  // provider 구현 (openai / gemini는 향후 STEP에서 동일 패턴 추가).
  //
  // Flow:
  //   1. readAIApiKey (server-side env)
  //   2. invokeProvider (raw text)
  //   3. tryParseJSONOutput (markdown fence strip + JSON.parse)
  //   4. validateExpectedKeys (required keys present)
  //   5. scanOutputForForbidden (25 forbidden phrases)
  //   6. ok response with output + meta
  //
  // 본 위치 이후 모든 분기는 ai_unavailable 또는 ok 응답 — graceful 보장.

  const apiKey = readAIApiKey();
  if (!apiKey) {
    // env-loaded config.apiKeyConfigured 통과했지만 read 시점에 부재 가능 — 방어 분기.
    return NextResponse.json(
      {
        status: "ai_unavailable",
        kind,
        reason: "provider_not_configured",
        fallback: buildFallback(kind),
      } satisfies AIAssistResponse,
      { status: 200 },
    );
  }

  const invokeResult = await invokeProvider(promptBundle, {
    provider: config.provider!,
    apiKey,
    model: config.model ?? undefined,
    temperature: AI_DEFAULTS.temperature,
    topP: AI_DEFAULTS.topP,
    maxTokens: AI_DEFAULTS.maxTokens,
    timeoutMs: AI_DEFAULTS.timeoutMs,
  });

  if (!invokeResult.ok) {
    const reason: AIUnavailableReason =
      invokeResult.reason === "timeout"
        ? "timeout"
        : invokeResult.reason === "provider_not_implemented"
          ? "provider_not_configured"
          : "provider_error";
    return NextResponse.json(
      {
        status: "ai_unavailable",
        kind,
        reason,
        fallback: buildFallback(kind),
      } satisfies AIAssistResponse,
      { status: 200 },
    );
  }

  // -----------------------------------------------------
  // 7. Output Guard + Response Construction
  // -----------------------------------------------------

  const parsed = tryParseJSONOutput(invokeResult.text);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        status: "ai_unavailable",
        kind,
        reason: "provider_error",
        fallback: buildFallback(kind),
      } satisfies AIAssistResponse,
      { status: 200 },
    );
  }

  const keyCheck = validateExpectedKeys(parsed.value, promptBundle.expectedJsonKeys);
  if (!keyCheck.ok) {
    return NextResponse.json(
      {
        status: "ai_unavailable",
        kind,
        reason: "provider_error",
        fallback: buildFallback(kind),
      } satisfies AIAssistResponse,
      { status: 200 },
    );
  }

  const forbiddenHit = scanOutputForForbidden(parsed.value);
  if (forbiddenHit) {
    return NextResponse.json(
      {
        status: "ai_unavailable",
        kind,
        reason: "output_rejected",
        fallback: buildFallback(kind),
      } satisfies AIAssistResponse,
      { status: 200 },
    );
  }

  const meta: AIAssistMeta = {
    provider: config.provider!,
    model: invokeResult.model,
    generatedAtISO: new Date().toISOString(),
    locale,
    inputTokens: invokeResult.tokens?.input,
    outputTokens: invokeResult.tokens?.output,
  };

  return NextResponse.json(
    {
      status: "ok",
      kind,
      output: parsed.value as AIAssistOutputMap[typeof kind],
      meta,
    } satisfies AIAssistResponse,
    { status: 200 },
  );
}
