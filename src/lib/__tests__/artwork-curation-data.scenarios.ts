// ============================================================================
// artwork-curation-data.scenarios.ts — STEP 119 Test Scenarios
//
// **본 module 의 정체**:
//   STEP 119 ArtworkCurationData type foundation 의 6-scenario 검증.
//   self-runnable scenario module — DOC-2 §4 신규 라이브러리 금지 준수.
//
// **검증 영역**:
//   §1 Key union integrity        — 5 keys + ordered list match + uniqueness
//   §2 KR label coverage          — 5 keys non-empty
//   §3 EN label coverage          — 5 keys non-empty
//   §4 isArtworkCurationDataKey   — accepts/rejects 정확
//   §5 hasAnyCurationData helper  — empty / partial / full / whitespace-only edge
//   §6 collectCurationData helper — compact projection + Artwork persistence v1 forward compat
// ============================================================================

import type { Artwork } from "@/types/artwork";
import {
  type ArtworkCurationDataKey,
  ARTWORK_CURATION_DATA_KEYS,
  ARTWORK_CURATION_DATA_LABEL_KR,
  ARTWORK_CURATION_DATA_LABEL_EN,
  isArtworkCurationDataKey,
  hasAnyCurationData,
  collectCurationData,
} from "@/types/artwork-curation-data";

// ============================================================================
// Tiny assert helpers
// ============================================================================

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtworkCurationDataAssertionError";
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      `[${label}] expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
    );
  }
}

function assertTrue(cond: boolean, label: string): void {
  if (!cond) throw new AssertionError(`[${label}] expected true`);
}

function assertFalse(cond: boolean, label: string): void {
  if (cond) throw new AssertionError(`[${label}] expected false`);
}

function assertDeepEqual<T>(actual: T, expected: T, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new AssertionError(
      `[${label}] expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
    );
  }
}

// ============================================================================
// Scenario shape
// ============================================================================

interface ArtworkCurationDataScenario {
  id: number;
  label: string;
  description: string;
  run: () => void;
}

export interface ScenarioRunResult {
  total: number;
  passed: number;
  failed: number;
  failures: Array<{ id: number; label: string; error: string }>;
  summary: string;
}

// ============================================================================
// Test fixtures
// ============================================================================

const EXPECTED_KEYS: readonly ArtworkCurationDataKey[] = [
  "description",
  "curationDraft",
  "exhibitionText",
  "artistNote",
  "provenanceNote",
];

/** Minimal Artwork base for fixture spread. */
const BASE_ARTWORK: Artwork = {
  id: "art_test_1",
  axid: { code: "AXV-TEST-0001", issuedAt: "2026-05-08T00:00:00Z" },
  title: "Test Work",
  artist: { id: "artist_test_1", name: "테스트 작가" },
  year: 2025,
  medium: "Oil on Canvas",
  dimensions: "100 × 100 cm",
  priceKRW: 1_000_000,
  state: "READY",
  thumbnailColor: "#cccccc",
  inquiryCount: 0,
  updatedAt: "2026-05-08T00:00:00Z",
  // 5 curation fields 부재 → undefined fallback (legacy shape)
};

// ============================================================================
// Scenarios
// ============================================================================

export const SCENARIOS: readonly ArtworkCurationDataScenario[] = [
  // ─────────────────────────────────────────────────────────────────────
  // §1 Key union integrity — 5 keys + ordered list + uniqueness
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 1,
    label: "key union integrity — 5 keys + ordered + unique",
    description:
      "ARTWORK_CURATION_DATA_KEYS 는 사용자 spec 5 keys 정확 일치, 순서 보존, 중복 0건",
    run: () => {
      assertEqual(
        ARTWORK_CURATION_DATA_KEYS.length,
        5,
        "scenario1.length",
      );
      for (let i = 0; i < EXPECTED_KEYS.length; i++) {
        assertEqual(
          ARTWORK_CURATION_DATA_KEYS[i],
          EXPECTED_KEYS[i],
          `scenario1.order[${i}]`,
        );
      }
      const uniqueSize = new Set(ARTWORK_CURATION_DATA_KEYS).size;
      assertEqual(
        uniqueSize,
        ARTWORK_CURATION_DATA_KEYS.length,
        "scenario1.unique",
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §2 KR label coverage — 5 keys non-empty
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 2,
    label: "Korean label coverage — all 5 keys non-empty",
    description:
      "ARTWORK_CURATION_DATA_LABEL_KR 는 5 key 모두 non-empty 한국어 라벨",
    run: () => {
      const keys = Object.keys(ARTWORK_CURATION_DATA_LABEL_KR);
      assertEqual(keys.length, 5, "scenario2.label_count");
      for (const key of ARTWORK_CURATION_DATA_KEYS) {
        const label = ARTWORK_CURATION_DATA_LABEL_KR[key];
        assertTrue(
          typeof label === "string" && label.length > 0,
          `scenario2.label.${key}`,
        );
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §3 EN label coverage — 5 keys non-empty
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 3,
    label: "English label coverage — all 5 keys non-empty",
    description:
      "ARTWORK_CURATION_DATA_LABEL_EN 는 5 key 모두 non-empty English 라벨",
    run: () => {
      const keys = Object.keys(ARTWORK_CURATION_DATA_LABEL_EN);
      assertEqual(keys.length, 5, "scenario3.label_count");
      for (const key of ARTWORK_CURATION_DATA_KEYS) {
        const label = ARTWORK_CURATION_DATA_LABEL_EN[key];
        assertTrue(
          typeof label === "string" && label.length > 0,
          `scenario3.label.${key}`,
        );
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §4 isArtworkCurationDataKey — accepts/rejects
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 4,
    label: "isArtworkCurationDataKey — accepts valid + rejects invalid",
    description:
      "5 valid keys 모두 accept (case-sensitive), 외 모두 reject",
    run: () => {
      // Valid
      for (const valid of ARTWORK_CURATION_DATA_KEYS) {
        assertTrue(
          isArtworkCurationDataKey(valid),
          `scenario4.accept.${valid}`,
        );
      }
      // Invalid — case sensitivity / typo / non-string
      const invalidInputs: unknown[] = [
        "Description", // case variant
        "DESCRIPTION",
        "curation_draft", // snake_case 아님
        "exhibition", // truncated
        "artist", // truncated
        "provenance", // truncated
        "title", // 다른 Artwork field
        "medium",
        "",
        0,
        true,
        null,
        undefined,
        {},
        [],
      ];
      for (const invalid of invalidInputs) {
        assertFalse(
          isArtworkCurationDataKey(invalid),
          `scenario4.reject.${JSON.stringify(invalid)}`,
        );
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §5 hasAnyCurationData — empty / partial / full / whitespace edge
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 5,
    label: "hasAnyCurationData — empty/partial/full + whitespace edge",
    description:
      "5 fields 부재 → false / 하나라도 non-empty trim → true / whitespace-only → false (trim 검사)",
    run: () => {
      // Empty — 모든 fields 부재
      assertFalse(
        hasAnyCurationData(BASE_ARTWORK),
        "scenario5.empty_artwork",
      );

      // Partial — description 만
      const withDescription: Artwork = {
        ...BASE_ARTWORK,
        description: "한 점의 회화",
      };
      assertTrue(
        hasAnyCurationData(withDescription),
        "scenario5.with_description",
      );

      // Partial — provenanceNote 만
      const withProvenance: Artwork = {
        ...BASE_ARTWORK,
        provenanceNote: "1990년 작가 직접 매입",
      };
      assertTrue(
        hasAnyCurationData(withProvenance),
        "scenario5.with_provenance",
      );

      // Full — 5 fields 모두 있음
      const full: Artwork = {
        ...BASE_ARTWORK,
        description: "회화",
        curationDraft: "초안",
        exhibitionText: "전시 컨텍스트",
        artistNote: "작가 메모",
        provenanceNote: "소장 이력",
      };
      assertTrue(hasAnyCurationData(full), "scenario5.full");

      // Edge — whitespace only (trim 검사 — empty 로 간주)
      const whitespaceOnly: Artwork = {
        ...BASE_ARTWORK,
        description: "   ",
        curationDraft: "\n\t  ",
      };
      assertFalse(
        hasAnyCurationData(whitespaceOnly),
        "scenario5.whitespace_only",
      );

      // Edge — empty string
      const emptyStrings: Artwork = {
        ...BASE_ARTWORK,
        description: "",
        artistNote: "",
      };
      assertFalse(
        hasAnyCurationData(emptyStrings),
        "scenario5.empty_strings",
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §6 collectCurationData — compact projection + persistence v1 forward compat
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 6,
    label: "collectCurationData — compact projection + v1 forward compat",
    description:
      "non-empty fields 만 결과 record 에 포함 / legacy artwork (5 fields 부재) 는 empty record / enhanced artwork 는 정확 추출",
    run: () => {
      // Legacy artwork — 5 fields 부재 → empty record
      const legacyResult = collectCurationData(BASE_ARTWORK);
      assertDeepEqual(legacyResult, {}, "scenario6.legacy_empty");

      // Partial — description + artistNote 만
      const partial: Artwork = {
        ...BASE_ARTWORK,
        description: "한 점의 회화",
        artistNote: "작가 statement",
      };
      const partialResult = collectCurationData(partial);
      assertDeepEqual(
        partialResult,
        { description: "한 점의 회화", artistNote: "작가 statement" },
        "scenario6.partial",
      );

      // Full — 5 fields 모두
      const full: Artwork = {
        ...BASE_ARTWORK,
        description: "회화",
        curationDraft: "초안",
        exhibitionText: "전시",
        artistNote: "메모",
        provenanceNote: "이력",
      };
      const fullResult = collectCurationData(full);
      assertEqual(Object.keys(fullResult).length, 5, "scenario6.full_keys_count");
      assertEqual(fullResult.description, "회화", "scenario6.full_description");
      assertEqual(fullResult.provenanceNote, "이력", "scenario6.full_provenance");

      // Whitespace-only fields → 결과에서 제외 (compact projection)
      const whitespaceMix: Artwork = {
        ...BASE_ARTWORK,
        description: "유효한 설명",
        curationDraft: "   ",
        exhibitionText: "",
      };
      const whitespaceResult = collectCurationData(whitespaceMix);
      assertEqual(
        Object.keys(whitespaceResult).length,
        1,
        "scenario6.whitespace_excluded_count",
      );
      assertEqual(
        whitespaceResult.description,
        "유효한 설명",
        "scenario6.whitespace_only_valid_kept",
      );

      // Persistence v1 forward compat — BASE_ARTWORK 가 5 fields 부재로 type-check
      // 통과한 사실 자체가 v1 backward compat 검증.
      assertEqual(
        BASE_ARTWORK.description,
        undefined,
        "scenario6.legacy_description_undefined",
      );
      assertEqual(
        BASE_ARTWORK.curationDraft,
        undefined,
        "scenario6.legacy_curationDraft_undefined",
      );
      assertEqual(
        BASE_ARTWORK.provenanceNote,
        undefined,
        "scenario6.legacy_provenanceNote_undefined",
      );
    },
  },
];

// ============================================================================
// Runner
// ============================================================================

export function runAllScenarios(): ScenarioRunResult {
  const failures: ScenarioRunResult["failures"] = [];
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

  const failed = SCENARIOS.length - passed;
  return {
    total: SCENARIOS.length,
    passed,
    failed,
    failures,
    summary: `${passed}/${SCENARIOS.length} passed${failed > 0 ? ` (${failed} failed)` : ""}`,
  };
}
