// AXVELA AI Integration Protocol — Test Scenarios
// =================================================
// 정착 시점: STEP 93 (2026-05-07).
// DOC-2 §3.1 anchor pattern 답습 (fiscal-derive / operational-insight scenarios와 동일 shape).
//
// 외부 test 라이브러리 0개 — inline assert helpers + runAllScenarios() runner.
// 향후 vitest / jest 도입 시 `for (const sc of SCENARIOS) it(sc.label, sc.run)` 1줄 wrap만으로 합류.
//
// 검증 영역:
//   §1 Config — default safe mode + full config + per-kind disable
//   §2 Prompt builders — 5 kinds 모두 정상 build + forbidden block 포함
//   §3 Output guard — forbidden phrase substring detection
//   §4 JSON parse — markdown fence strip
//   §5 Determinism — same input → same prompt
// =================================================

import { readAIConfig } from "../../lib/ai/config";
import { buildPrompt, tryParseJSONOutput, validateExpectedKeys } from "../../lib/ai/prompts";
import {
  detectForbiddenPhrase,
  isAIAssistKind,
  AI_ASSIST_KINDS,
} from "../../lib/ai/types";

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
      `[${label}] expected ${String(expected)}, got ${String(actual)}`,
    );
  }
};

const assertContains = (haystack: string, needle: string, label: string): void => {
  if (!haystack.includes(needle)) {
    throw new AssertionError(
      `[${label}] expected to contain "${needle}", got "${haystack.slice(0, 100)}..."`,
    );
  }
};

const assertTrue = (cond: boolean, label: string): void => {
  if (!cond) {
    throw new AssertionError(`[${label}] expected true`);
  }
};

const assertNonEmpty = (s: string | undefined | null, label: string): void => {
  if (!s || s.length === 0) {
    throw new AssertionError(`[${label}] expected non-empty string`);
  }
};

// -----------------------------------------------------
// Scenario shape
// -----------------------------------------------------

export interface ProtocolScenario {
  id: string;
  label: string;
  run: () => void;
}

export interface ScenarioRunResult {
  total: number;
  passed: number;
  failed: number;
  failures: { id: string; label: string; error: string }[];
  summary: string;
}

// -----------------------------------------------------
// Scenarios
// -----------------------------------------------------

export const SCENARIOS: ProtocolScenario[] = [
  // §1 Config Tests ----------------------------------------------------
  {
    id: "1.1",
    label: "Config: default safe mode (empty env) → enabled=false, provider=null",
    run: () => {
      const cfg = readAIConfig({});
      assertEqual(cfg.enabled, false, "1.1 enabled");
      assertEqual(cfg.provider, null, "1.1 provider");
      assertEqual(cfg.model, null, "1.1 model");
      assertEqual(cfg.apiKeyConfigured, false, "1.1 apiKeyConfigured");
      // All per-kind should also be disabled
      for (const k of AI_ASSIST_KINDS) {
        assertEqual(cfg.perKindEnabled[k], false, `1.1 perKind.${k}`);
      }
    },
  },
  {
    id: "1.2",
    label: "Config: master flag only (no provider/key) → still disabled",
    run: () => {
      const cfg = readAIConfig({ AXVELA_AI_ENABLED: "true" });
      assertEqual(cfg.enabled, false, "1.2 enabled");
      assertEqual(cfg.provider, null, "1.2 provider");
    },
  },
  {
    id: "1.3",
    label: "Config: full env (enabled + provider + key) → enabled=true",
    run: () => {
      const cfg = readAIConfig({
        AXVELA_AI_ENABLED: "true",
        AXVELA_AI_PROVIDER: "anthropic",
        AXVELA_AI_API_KEY: "sk-test-1234567890",
      });
      assertEqual(cfg.enabled, true, "1.3 enabled");
      assertEqual(cfg.provider, "anthropic", "1.3 provider");
      assertNonEmpty(cfg.model, "1.3 model");
      assertEqual(cfg.apiKeyConfigured, true, "1.3 apiKeyConfigured");
      // All per-kind default true when master enabled
      for (const k of AI_ASSIST_KINDS) {
        assertEqual(cfg.perKindEnabled[k], true, `1.3 perKind.${k}`);
      }
    },
  },
  {
    id: "1.4",
    label: "Config: per-kind explicit disable when master enabled",
    run: () => {
      const cfg = readAIConfig({
        AXVELA_AI_ENABLED: "true",
        AXVELA_AI_PROVIDER: "anthropic",
        AXVELA_AI_API_KEY: "sk-test-1234567890",
        AXVELA_AI_TRANSLATION_ENABLED: "false",
      });
      assertEqual(cfg.enabled, true, "1.4 master enabled");
      assertEqual(cfg.perKindEnabled.translation, false, "1.4 translation disabled");
      assertEqual(cfg.perKindEnabled.artwork_metadata, true, "1.4 other kinds still enabled");
    },
  },
  {
    id: "1.5",
    label: "Config: invalid provider value → enabled=false",
    run: () => {
      const cfg = readAIConfig({
        AXVELA_AI_ENABLED: "true",
        AXVELA_AI_PROVIDER: "totally-not-a-real-provider",
        AXVELA_AI_API_KEY: "sk-test-1234567890",
      });
      assertEqual(cfg.enabled, false, "1.5 enabled");
      assertEqual(cfg.provider, null, "1.5 provider");
    },
  },

  // §2 Prompt Builder Tests --------------------------------------------
  {
    id: "2.1",
    label: "Prompt: artwork_metadata builds with forbidden block + tone block",
    run: () => {
      const p = buildPrompt(
        "artwork_metadata",
        { rawMaterial: "캔버스에 유채" },
        "ko",
      );
      assertNonEmpty(p.system, "2.1 system");
      assertNonEmpty(p.user, "2.1 user");
      assertContains(p.system, "FORBIDDEN OUTPUTS", "2.1 forbidden block");
      assertContains(p.system, "TONE", "2.1 tone block");
      assertContains(p.system, "OUTPUT DISCIPLINE", "2.1 output discipline");
      assertContains(p.user, "캔버스에 유채", "2.1 user contains input");
      assertTrue(
        p.expectedJsonKeys.includes("normalizationNotes"),
        "2.1 expected key normalizationNotes",
      );
    },
  },
  {
    id: "2.2",
    label: "Prompt: document_writing includes documentType in instructions",
    run: () => {
      const p = buildPrompt(
        "document_writing",
        {
          documentType: "condition_report",
          shortNotes: "오른쪽 하단 작은 흠집 발견",
        },
        "ko",
      );
      assertContains(p.system, "condition_report", "2.2 doc type in system");
      assertContains(p.system, "EDITORIAL role only", "2.2 editorial role caveat");
      assertContains(p.user, "오른쪽 하단", "2.2 short notes in user");
    },
  },
  {
    id: "2.3",
    label: "Prompt: condition_compare bans 'Damage confirmed' explicitly",
    run: () => {
      const p = buildPrompt(
        "condition_compare",
        {
          baselineCapturedAt: "2026-05-01T00:00:00Z",
          currentCapturedAt: "2026-05-07T00:00:00Z",
          surfaceVarianceMetrics: [
            { region: "lower-right-edge", deltaMM: 0.4, classification: "minor" },
          ],
        },
        "en",
      );
      assertContains(p.system, "Damage confirmed", "2.3 damage confirmed banned");
      assertContains(p.system, "Surface variance observed near", "2.3 allowed phrase");
      assertContains(p.system, "Conservator review recommended", "2.3 review allowed");
    },
  },
  {
    id: "2.4",
    label: "Prompt: operational_insight bans pricing/valuation/recommendations",
    run: () => {
      const p = buildPrompt(
        "operational_insight",
        {
          period: "14d",
          generatedAtISO: "2026-05-07T00:00:00Z",
          snapshot: { mock: true },
        },
        "ko",
      );
      assertContains(p.system, "pricing predictions", "2.4 pricing banned");
      assertContains(p.system, "investment scores", "2.4 investment banned");
      assertContains(p.system, "buy/sell/hold", "2.4 autonomous reco banned");
      assertContains(p.system, "Bloomberg + McKinsey", "2.4 tone reference");
    },
  },
  {
    id: "2.5",
    label: "Prompt: translation preserves source/target locales + operational data warning",
    run: () => {
      const p = buildPrompt(
        "translation",
        {
          sourceText: "이 작품은 2024년에 제작되었습니다.",
          sourceLocale: "ko",
          targetLocale: "en",
          domain: "artwork_description",
        },
        "en",
      );
      assertContains(p.system, "ko", "2.5 source locale");
      assertContains(p.system, "en", "2.5 target locale");
      assertContains(p.system, "Preserve all operational data", "2.5 preservation warning");
      assertContains(p.user, "2024년", "2.5 source text in user");
    },
  },

  // §3 Output Guard Tests ---------------------------------------------
  {
    id: "3.1",
    label: "Output guard: forbidden phrase positive (case-insensitive)",
    run: () => {
      const r1 = detectForbiddenPhrase("This work has its DAMAGE CONFIRMED by experts.");
      assertEqual(r1, "damage confirmed", "3.1 detect damage");

      const r2 = detectForbiddenPhrase("작품의 손상 확정 결과 보고");
      assertEqual(r2, "손상 확정", "3.1 detect Korean damage");

      const r3 = detectForbiddenPhrase("Estimated PRICE: 500,000 USD.");
      assertEqual(r3, "estimated price", "3.1 detect estimated price");
    },
  },
  {
    id: "3.2",
    label: "Output guard: clean operational text returns null",
    run: () => {
      const r = detectForbiddenPhrase(
        "Surface variance observed near the lower-right edge. Conservator review recommended.",
      );
      assertEqual(r, null, "3.2 clean text returns null");
    },
  },
  {
    id: "3.3",
    label: "Output guard: institutional summary tone is allowed",
    run: () => {
      const r = detectForbiddenPhrase(
        "지난 14일간 작가 X에 대한 문의가 증가했습니다. 운영 참고 신호입니다.",
      );
      assertEqual(r, null, "3.3 Korean institutional clean");
    },
  },

  // §4 JSON Parse + Validation -----------------------------------------
  {
    id: "4.1",
    label: "tryParseJSONOutput: strips markdown code fence ```json...```",
    run: () => {
      const raw = '```json\n{"normalizationNotes": ["test"]}\n```';
      const r = tryParseJSONOutput(raw);
      assertEqual(r.ok, true, "4.1 parse ok");
      if (r.ok) {
        const v = r.value as { normalizationNotes?: string[] };
        assertTrue(Array.isArray(v.normalizationNotes), "4.1 array preserved");
      }
    },
  },
  {
    id: "4.2",
    label: "validateExpectedKeys: missing keys reported",
    run: () => {
      const r = validateExpectedKeys({ rewrittenText: "text" }, ["rewrittenText", "toneNotes"]);
      assertEqual(r.ok, false, "4.2 not ok");
      if (!r.ok) {
        assertEqual(r.missing.length, 1, "4.2 missing length");
        assertEqual(r.missing[0], "toneNotes", "4.2 missing key");
      }
    },
  },

  // §5 Determinism + Type Guards ---------------------------------------
  {
    id: "5.1",
    label: "Determinism: same input two builds produce identical prompts",
    run: () => {
      const input = { rawMaterial: "캔버스에 유채", rawTitle: "Untitled" };
      const a = buildPrompt("artwork_metadata", input, "ko");
      const b = buildPrompt("artwork_metadata", input, "ko");
      assertEqual(a.system, b.system, "5.1 system identical");
      assertEqual(a.user, b.user, "5.1 user identical");
    },
  },
  {
    id: "5.2",
    label: "isAIAssistKind: positive + negative type guards",
    run: () => {
      assertEqual(isAIAssistKind("artwork_metadata"), true, "5.2 positive");
      assertEqual(isAIAssistKind("totally-fake-kind"), false, "5.2 negative");
      assertEqual(isAIAssistKind(undefined), false, "5.2 undefined");
      assertEqual(isAIAssistKind(42), false, "5.2 non-string");
    },
  },
];

// -----------------------------------------------------
// Runner
// -----------------------------------------------------

export const runAllScenarios = (): ScenarioRunResult => {
  const failures: { id: string; label: string; error: string }[] = [];
  let passed = 0;

  for (const sc of SCENARIOS) {
    try {
      sc.run();
      passed++;
    } catch (err) {
      failures.push({
        id: sc.id,
        label: sc.label,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const total = SCENARIOS.length;
  const failed = failures.length;
  return {
    total,
    passed,
    failed,
    failures,
    summary: failed === 0
      ? `${passed}/${total} passed`
      : `${passed}/${total} passed (${failed} failed)`,
  };
};
