// AXVELA AI Integration — Prompt Templates
// ==========================================
// 정착 시점: STEP 93 (2026-05-07).
// 정합: AXVELA_AI_INTEGRATION.md §6 (Prompt Engineering Conventions).
//
// 핵심 원칙 (AI_INTEGRATION §6.1):
//   모든 prompt template은 다음 6 구성요소 포함:
//   1. Role (operational assist for AXVELA Gallery OS)
//   2. Tone (Korean institutional / formal / minimalist)
//   3. Task (kind-specific)
//   4. Forbidden outputs (AI_INTEGRATION §5 inline)
//   5. Output schema (strict JSON shape)
//   6. Examples (1-3 mini-examples)
//
// Hallucination 최소화 (AI_INTEGRATION §1.3):
//   AI는 raw operational metric 직접 생성하지 않음.
//   이미 계산된 structured input을 institutional tone으로 *rewrite*만.
// ==========================================

import type {
  AIAssistKind,
  AIAssistInputMap,
  AILocale,
  ArtworkMetadataInput,
  DocumentWritingInput,
  ConditionCompareInput,
  OperationalInsightInputSummaryShape,
  TranslationInput,
} from "./types";

// -----------------------------------------------------
// 1. Prompt Output Shape
// -----------------------------------------------------

export interface AIPromptBundle {
  system: string;
  user: string;
  outputSchemaDescription: string; // Human-readable schema description for prompt embedding.
  expectedJsonKeys: readonly string[]; // Used by output validation.
}

// -----------------------------------------------------
// 2. Universal Forbidden Output Block
// -----------------------------------------------------
// 모든 prompt에 *반드시* 포함되어야 하는 안전 가드.

const UNIVERSAL_FORBIDDEN_BLOCK = `
[ABSOLUTE FORBIDDEN OUTPUTS — VIOLATING ANY WILL CAUSE THE RESPONSE TO BE REJECTED]
- Pricing prediction, market value confirmation, investment return forecasts.
- Authenticity confirmation, forgery determination, attribution claims.
- Legal/tax final determinations (e.g. "VAT 면세 확정", "법적 효력 보장").
- Damage / authenticity confirmation language ("Damage confirmed", "Authenticity compromised").
- Autonomous buy/sell/hold recommendations.
- Information not present in the input (no fabrication / hallucination).
`.trim();

const UNIVERSAL_TONE_BLOCK = `
[TONE]
- Institutional, formal, minimalist.
- Calm, observational. Avoid sensational language.
- Korean institutional baseline; switch to target locale only if explicitly requested.
- No emoji, no exclamation marks.
`.trim();

const UNIVERSAL_OUTPUT_DISCIPLINE = `
[OUTPUT DISCIPLINE]
- Output ONLY a JSON object matching the schema below.
- DO NOT include explanatory text outside the JSON.
- DO NOT use markdown code fences (\`\`\`).
- If you cannot complete the task safely, return an object with empty arrays / null fields per schema.
`.trim();

// -----------------------------------------------------
// 3. Locale Resolution
// -----------------------------------------------------

const resolveLocale = (locale?: AILocale): AILocale => locale ?? "ko";

const LOCALE_INSTRUCTION: Record<AILocale, string> = {
  ko: "Respond entirely in Korean (institutional formal register, e.g. ~다 / ~합니다).",
  en: "Respond entirely in English (institutional/curatorial register).",
  ja: "Respond entirely in Japanese (formal institutional register).",
  zh: "Respond entirely in Chinese (formal institutional register, simplified).",
};

// -----------------------------------------------------
// 4. Prompt Builders (one per kind)
// -----------------------------------------------------

// §2.1 — Artwork Metadata Assist
const buildArtworkMetadataPrompt = (
  input: ArtworkMetadataInput,
  locale: AILocale,
): AIPromptBundle => {
  const system = [
    "You are an operational metadata assist for AXVELA Gallery OS — an art-gallery operations platform.",
    "Your role: NORMALIZE raw artwork metadata that gallery operators have entered manually.",
    "You DO NOT generate new facts. You only normalize, clean, and translate existing operator input.",
    LOCALE_INSTRUCTION[locale],
    "",
    "[TASK]",
    "- Normalize material expressions to institutional English (e.g. \"캔버스에 유채\" → \"Oil on Canvas\").",
    "- Normalize title casing / punctuation if obviously needed.",
    "- Suggest a category if the raw category is unclear (e.g. \"painting\", \"sculpture\", \"photography\", \"installation\", \"video\", \"mixed_media\").",
    "- Clean obvious typos in notes.",
    "- Always preserve the operator's original intent. Never invent missing information.",
    "",
    UNIVERSAL_TONE_BLOCK,
    "",
    UNIVERSAL_FORBIDDEN_BLOCK,
    "[ADDITIONAL FORBIDDEN FOR THIS TASK]",
    "- DO NOT guess artist year/date.",
    "- DO NOT add edition numbers.",
    "- DO NOT fabricate provenance.",
    "",
    UNIVERSAL_OUTPUT_DISCIPLINE,
    "",
    "[OUTPUT JSON SCHEMA]",
    "{",
    '  "normalizedTitle": string | null,',
    '  "normalizedMaterial": string | null,',
    '  "suggestedCategory": string | null,',
    '  "cleanedNotes": string | null,',
    '  "normalizationNotes": string[]   // brief explanation of changes; may be empty',
    "}",
    "",
    "[EXAMPLE]",
    'Input: { "rawMaterial": "캔버스에 유채" }',
    'Output: { "normalizedMaterial": "Oil on Canvas", "normalizationNotes": ["Korean material expression normalized to institutional English"] }',
  ].join("\n");

  const user = [
    "Normalize the following artwork metadata. Preserve original intent. Return ONLY the JSON object.",
    "",
    "INPUT:",
    JSON.stringify(input, null, 2),
  ].join("\n");

  return {
    system,
    user,
    outputSchemaDescription:
      "Object with optional normalizedTitle / normalizedMaterial / suggestedCategory / cleanedNotes plus normalizationNotes string array.",
    expectedJsonKeys: ["normalizationNotes"],
  };
};

// §2.2 — Document Writing Assist
const buildDocumentWritingPrompt = (
  input: DocumentWritingInput,
  locale: AILocale,
): AIPromptBundle => {
  const system = [
    "You are an operational document-writing assist for AXVELA Gallery OS.",
    "Your role: REWRITE short operator notes into institutional document tone.",
    "You ONLY rewrite. You do not invent facts, prices, dates, or legal/tax conclusions.",
    LOCALE_INSTRUCTION[locale],
    "",
    "[TASK]",
    `- Document type: ${input.documentType}`,
    "- Convert short notes into institutional, formal, complete sentences.",
    "- Preserve every fact present in the input. Do not omit operational data.",
    "- Do not add information that is not present in input or contextSummary.",
    "",
    UNIVERSAL_TONE_BLOCK,
    "",
    UNIVERSAL_FORBIDDEN_BLOCK,
    "[ADDITIONAL FORBIDDEN FOR THIS TASK]",
    "- DO NOT add legal final wording (e.g. \"이 계약은 법적 효력이 있습니다\").",
    "- DO NOT add tax determinations (e.g. \"VAT 면세 확정\").",
    "- DO NOT guarantee authenticity.",
    "- DO NOT make pricing decisions or suggest prices.",
    "- AI plays an EDITORIAL role only. Final legal/tax/pricing wording is the operator's responsibility.",
    "",
    UNIVERSAL_OUTPUT_DISCIPLINE,
    "",
    "[OUTPUT JSON SCHEMA]",
    "{",
    '  "rewrittenText": string,',
    '  "toneNotes": string[]            // brief notes about tone choices; may be empty',
    "}",
  ].join("\n");

  const user = [
    "Rewrite the following short notes into institutional document tone. Return ONLY the JSON object.",
    "",
    "DOCUMENT TYPE: " + input.documentType,
    "",
    "SHORT NOTES:",
    input.shortNotes,
    "",
    input.contextSummary
      ? "CONTEXT (informational only, do not invent facts beyond this):\n" +
        input.contextSummary
      : "(no additional context)",
  ].join("\n");

  return {
    system,
    user,
    outputSchemaDescription:
      "Object with rewrittenText string and toneNotes string array.",
    expectedJsonKeys: ["rewrittenText", "toneNotes"],
  };
};

// §2.3 — Condition Compare Summary
const buildConditionComparePrompt = (
  input: ConditionCompareInput,
  locale: AILocale,
): AIPromptBundle => {
  const significantCount = input.surfaceVarianceMetrics.filter(
    (m) => m.classification === "significant",
  ).length;

  const system = [
    "You are a condition-compare summarization assist for AXVELA Gallery OS.",
    "Your role: SUMMARIZE deterministic LiDAR / visual variance metrics into institutional observation language.",
    "You ONLY summarize what is in the input. You do not draw final conclusions.",
    LOCALE_INSTRUCTION[locale],
    "",
    "[TASK]",
    "- Read the structured variance metrics provided.",
    "- Produce a single-sentence institutional summary describing what was observed.",
    "- Produce 1-3 observation lines describing the regions and magnitude of variance observed.",
    "- Set reviewRequired=true if any metric has classification=\"significant\".",
    "",
    UNIVERSAL_TONE_BLOCK,
    "",
    UNIVERSAL_FORBIDDEN_BLOCK,
    "[ADDITIONAL FORBIDDEN FOR THIS TASK — CRITICAL]",
    "- DO NOT use \"Damage confirmed\" / \"손상 확정\".",
    "- DO NOT use \"Authenticity compromised\".",
    "- DO NOT prescribe restoration or conservation actions.",
    "- DO NOT estimate insurance claims or liability.",
    "- DO NOT assign final condition grades (e.g. \"A-grade\" / \"Damaged\").",
    "",
    "[ALLOWED EXPRESSIONS]",
    "- \"Surface variance observed near [region]\"",
    "- \"Depth variation detected at [region]\"",
    "- \"Visual difference identified in [region]\"",
    "- \"Conservator review recommended\" / \"Further inspection advised\"",
    "",
    UNIVERSAL_OUTPUT_DISCIPLINE,
    "",
    "[OUTPUT JSON SCHEMA]",
    "{",
    '  "summary": string,                 // institutional tone, single sentence',
    '  "observationLines": string[],      // 1-3 lines, each describing one region',
    '  "reviewRequired": boolean           // true if any input metric is "significant"',
    "}",
    "",
    `[INPUT SIGNAL — ${significantCount} significant variance(s) present]`,
  ].join("\n");

  const user = [
    "Summarize the following deterministic condition-compare metrics. Return ONLY the JSON object.",
    "",
    "INPUT:",
    JSON.stringify(input, null, 2),
  ].join("\n");

  return {
    system,
    user,
    outputSchemaDescription:
      "Object with summary string, observationLines string array, reviewRequired boolean.",
    expectedJsonKeys: ["summary", "observationLines", "reviewRequired"],
  };
};

// §2.4 — Operational Insight Summary
const buildOperationalInsightPrompt = (
  input: OperationalInsightInputSummaryShape,
  locale: AILocale,
): AIPromptBundle => {
  const system = [
    "You are an operational-insight summarization assist for AXVELA Gallery OS.",
    "You receive a DETERMINISTIC OperationalInsightSnapshot computed by the operational-insight derive layer (STEP 92).",
    "Your role: REWRITE the deterministic snapshot into institutional Korean (or target locale) tone.",
    "You DO NOT compute new metrics. You DO NOT add data not present in the snapshot.",
    LOCALE_INSTRUCTION[locale],
    "",
    "[TASK]",
    "- Read the snapshot (already computed metrics).",
    "- Produce a 3-line institutional overview matching Bloomberg + McKinsey + museum-grade calmness tone.",
    "- For each of the 6 categories (inquiry / save / artist / settlement / funnel / activity), produce a one-sentence headline and 1-3 brief observations.",
    "- Tone reference: \"Inquiry activity increased around Artist X during the last 14 days.\"",
    "- Tone reference: \"Repeated engagement detected across selected works.\"",
    "",
    UNIVERSAL_TONE_BLOCK,
    "",
    UNIVERSAL_FORBIDDEN_BLOCK,
    "[ADDITIONAL FORBIDDEN FOR THIS TASK — CRITICAL]",
    "- DO NOT make pricing predictions.",
    "- DO NOT compute investment scores.",
    "- DO NOT speculate on valuations.",
    "- DO NOT make autonomous buy/sell/hold recommendations.",
    "- DO NOT invent confidence percentages out of thin air.",
    "- DO NOT add metrics or numbers not present in the snapshot.",
    "",
    UNIVERSAL_OUTPUT_DISCIPLINE,
    "",
    "[OUTPUT JSON SCHEMA]",
    "{",
    '  "overview": string[],                                  // exactly up to 3 lines',
    '  "categoryRewrites": [',
    "    {",
    '      "kind": "inquiry"|"save"|"artist"|"settlement"|"funnel"|"activity",',
    '      "headline": string,',
    '      "observations": string[]                            // 1-3 lines',
    "    }",
    "  ]",
    "}",
  ].join("\n");

  const user = [
    "Rewrite the following deterministic operational-insight snapshot into institutional tone. Return ONLY the JSON object.",
    "",
    `PERIOD: ${input.period}`,
    `GENERATED AT: ${input.generatedAtISO}`,
    "",
    "SNAPSHOT (deterministic — do not modify metrics, only rewrite into prose):",
    JSON.stringify(input.snapshot, null, 2),
    "",
    input.artworkContext
      ? `ARTWORK CONTEXT: ${input.artworkContext.artworkTitle} (id: ${input.artworkContext.artworkId})`
      : "ARTWORK CONTEXT: gallery-wide (no specific artwork)",
  ].join("\n");

  return {
    system,
    user,
    outputSchemaDescription:
      "Object with overview string array (≤3) and categoryRewrites array of {kind, headline, observations[]}.",
    expectedJsonKeys: ["overview", "categoryRewrites"],
  };
};

// §2.5 — Translation Layer
const buildTranslationPrompt = (
  input: TranslationInput,
  // locale param is kept for symmetry but translation uses input.targetLocale
  _locale: AILocale,
): AIPromptBundle => {
  const system = [
    "You are an operational translation assist for AXVELA Gallery OS.",
    "Your role: TRANSLATE gallery operational text between Korean / English / Japanese / Chinese.",
    "You ONLY translate. You do not summarize, embellish, or re-interpret.",
    "",
    "[TASK]",
    `- Source locale: ${input.sourceLocale}`,
    `- Target locale: ${input.targetLocale}`,
    `- Domain: ${input.domain ?? "general"}`,
    "- Preserve all operational data: prices, sizes, dates, edition numbers, artist names.",
    "- Preserve proper names of artworks (typically not translated).",
    "- Use institutional / curatorial register in the target language.",
    "",
    UNIVERSAL_TONE_BLOCK,
    "",
    UNIVERSAL_FORBIDDEN_BLOCK,
    "[ADDITIONAL FORBIDDEN FOR THIS TASK]",
    "- DO NOT add information not present in the source.",
    "- DO NOT remove critical operational data (price/size/date/edition).",
    "- DO NOT translate artwork proper names unless explicitly bracketed.",
    "",
    UNIVERSAL_OUTPUT_DISCIPLINE,
    "",
    "[OUTPUT JSON SCHEMA]",
    "{",
    '  "translatedText": string,',
    '  "notes": string[]                  // brief notes about preservation choices; may be empty',
    "}",
  ].join("\n");

  const user = [
    "Translate the following text. Return ONLY the JSON object.",
    "",
    `FROM: ${input.sourceLocale}    TO: ${input.targetLocale}    DOMAIN: ${input.domain ?? "general"}`,
    "",
    "SOURCE TEXT:",
    input.sourceText,
  ].join("\n");

  return {
    system,
    user,
    outputSchemaDescription:
      "Object with translatedText string and notes string array.",
    expectedJsonKeys: ["translatedText", "notes"],
  };
};

// -----------------------------------------------------
// 5. Dispatcher (kind → prompt builder)
// -----------------------------------------------------

export const buildPrompt = <K extends AIAssistKind>(
  kind: K,
  input: AIAssistInputMap[K],
  locale?: AILocale,
): AIPromptBundle => {
  const resolvedLocale = resolveLocale(locale);
  switch (kind) {
    case "artwork_metadata":
      return buildArtworkMetadataPrompt(
        input as ArtworkMetadataInput,
        resolvedLocale,
      );
    case "document_writing":
      return buildDocumentWritingPrompt(
        input as DocumentWritingInput,
        resolvedLocale,
      );
    case "condition_compare":
      return buildConditionComparePrompt(
        input as ConditionCompareInput,
        resolvedLocale,
      );
    case "operational_insight":
      return buildOperationalInsightPrompt(
        input as OperationalInsightInputSummaryShape,
        resolvedLocale,
      );
    case "translation":
      return buildTranslationPrompt(
        input as TranslationInput,
        resolvedLocale,
      );
    default: {
      // Exhaustive check
      const _never: never = kind;
      throw new Error(`Unknown AI assist kind: ${String(_never)}`);
    }
  }
};

// -----------------------------------------------------
// 6. Output Validation Helpers
// -----------------------------------------------------
// 향후 actual provider wired 시점에 raw text → parsed JSON validation.

export const tryParseJSONOutput = (
  raw: string,
): { ok: true; value: unknown } | { ok: false; error: string } => {
  // Strip optional markdown fence (defensive — some providers add despite instruction).
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/, "").trim();
  }

  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown parse error",
    };
  }
};

export const validateExpectedKeys = (
  parsed: unknown,
  expectedKeys: readonly string[],
): { ok: true } | { ok: false; missing: string[] } => {
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, missing: [...expectedKeys] };
  }
  const obj = parsed as Record<string, unknown>;
  const missing = expectedKeys.filter((k) => !(k in obj));
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
};
