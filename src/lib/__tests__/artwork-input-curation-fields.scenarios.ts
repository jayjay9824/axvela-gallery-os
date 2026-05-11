// ============================================================================
// artwork-input-curation-fields.scenarios.ts — STEP 118 Test Scenarios
//
// **본 module 의 정체**:
//   STEP 118 의 functional 합류 검증 — STEP 119 의 5 curation fields 가
//   `ArtworkInput` interface 에 정확 합류했고, type 시스템 차원에서 backward
//   compat 가 보장되는지 확인.
//
//   본 scenarios 는 *type-level checks* — store action 의 runtime mutation 은
//   별도 integration test 영역. 본 module 은 ArtworkInput 사용 패턴 검증.
//
// **검증 영역**:
//   §1 5 fields all optional        — 부재 시 type-check 통과 (legacy 호환)
//   §2 5 fields accept string       — 모두 string 입력 valid
//   §3 collectCurationData 호환     — Artwork (createArtwork 결과) 가 5 fields
//                                     hydrate 시 STEP 119 helper 자연 동작
//   §4 hasAnyCurationData 호환      — partial / full / empty 정확 판별
//   §5 backward compat              — STEP 118 이전 호출자 (5 fields 부재) 무손상
// ============================================================================

import type { ArtworkInput } from "@/store/useArtworkStore";
import type { Artwork } from "@/types/artwork";
import {
  hasAnyCurationData,
  collectCurationData,
} from "@/types/artwork-curation-data";

// ============================================================================
// Tiny assert helpers
// ============================================================================

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtworkInputCurationFieldsAssertionError";
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

// ============================================================================
// Scenario shape
// ============================================================================

interface ArtworkInputScenario {
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

/** Minimal valid ArtworkInput (5 curation fields 부재 — legacy shape). */
const BASE_INPUT: ArtworkInput = {
  title: "Test Work",
  artistName: "테스트 작가",
  year: 2025,
  medium: "Oil on Canvas",
  dimensions: "100 × 100 cm",
  priceKRW: 1_000_000,
  state: "DRAFT",
  thumbnailColor: "#cccccc",
};

/** Minimal Artwork base — STEP 119 helpers 호환성 검증용. */
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
};

// ============================================================================
// Scenarios
// ============================================================================

export const SCENARIOS: readonly ArtworkInputScenario[] = [
  // ─────────────────────────────────────────────────────────────────────
  // §1 5 fields all optional — legacy 호출자 (5 fields 부재) 자연 호환
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 1,
    label: "5 curation fields all optional — legacy ArtworkInput 자연 호환",
    description:
      "STEP 118 이전 호출자의 ArtworkInput shape (5 fields 부재) 가 type-check 통과 + runtime 정상",
    run: () => {
      // 5 fields 부재한 BASE_INPUT 가 type 시스템 통과 (compile-time guarantee)
      // runtime check — 모든 curation field 가 undefined
      assertEqual(BASE_INPUT.description, undefined, "scenario1.description");
      assertEqual(BASE_INPUT.curationDraft, undefined, "scenario1.curationDraft");
      assertEqual(BASE_INPUT.exhibitionText, undefined, "scenario1.exhibitionText");
      assertEqual(BASE_INPUT.artistNote, undefined, "scenario1.artistNote");
      assertEqual(BASE_INPUT.provenanceNote, undefined, "scenario1.provenanceNote");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §2 5 fields accept string — partial / full 모두 valid
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 2,
    label: "5 curation fields accept string — partial + full",
    description:
      "ArtworkInput 에 5 fields 입력 시 string 모두 통과 — partial / full 모두 valid type",
    run: () => {
      // Partial — description 만
      const partial: ArtworkInput = {
        ...BASE_INPUT,
        description: "한 점의 회화",
      };
      assertEqual(partial.description, "한 점의 회화", "scenario2.partial.description");
      assertEqual(partial.curationDraft, undefined, "scenario2.partial.others");

      // Full — 5 fields 모두
      const full: ArtworkInput = {
        ...BASE_INPUT,
        description: "회화",
        curationDraft: "초안",
        exhibitionText: "전시 컨텍스트",
        artistNote: "작가 메모",
        provenanceNote: "1990년 작가 직접 매입",
      };
      assertEqual(full.description, "회화", "scenario2.full.description");
      assertEqual(full.curationDraft, "초안", "scenario2.full.curationDraft");
      assertEqual(full.exhibitionText, "전시 컨텍스트", "scenario2.full.exhibitionText");
      assertEqual(full.artistNote, "작가 메모", "scenario2.full.artistNote");
      assertEqual(full.provenanceNote, "1990년 작가 직접 매입", "scenario2.full.provenanceNote");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §3 STEP 119 collectCurationData 호환
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 3,
    label: "STEP 119 collectCurationData 호환 — 입력 → Artwork → helper 추출",
    description:
      "ArtworkInput 의 5 fields 가 (가상) Artwork 로 hydrate 후 collectCurationData 가 정확 추출",
    run: () => {
      // 시뮬레이션: createArtwork 가 input 의 curation fields 를 Artwork 로 합류
      const artworkAfterCreate: Artwork = {
        ...BASE_ARTWORK,
        id: "art_simulation_1",
        description: "회화 설명",
        curationDraft: "큐레이션 메모",
        // exhibitionText / artistNote / provenanceNote 는 부재
      };

      const collected = collectCurationData(artworkAfterCreate);
      assertEqual(Object.keys(collected).length, 2, "scenario3.collected_keys_count");
      assertEqual(collected.description, "회화 설명", "scenario3.description");
      assertEqual(collected.curationDraft, "큐레이션 메모", "scenario3.curationDraft");
      assertEqual(collected.exhibitionText, undefined, "scenario3.exhibition_absent");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §4 STEP 119 hasAnyCurationData 호환
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 4,
    label: "STEP 119 hasAnyCurationData 호환 — empty/partial/full 정확 판별",
    description:
      "ArtworkInput → Artwork hydration 후 hasAnyCurationData 가 5 fields 보유 여부 정확 판별",
    run: () => {
      // Empty — 5 fields 모두 부재
      const emptyArtwork: Artwork = { ...BASE_ARTWORK, id: "art_empty_1" };
      assertFalse(hasAnyCurationData(emptyArtwork), "scenario4.empty");

      // Partial — provenanceNote 만 보유
      const provenanceOnly: Artwork = {
        ...BASE_ARTWORK,
        id: "art_provenance_1",
        provenanceNote: "1990년 매입",
      };
      assertTrue(hasAnyCurationData(provenanceOnly), "scenario4.partial");

      // Full — 5 fields 모두
      const fullArtwork: Artwork = {
        ...BASE_ARTWORK,
        id: "art_full_1",
        description: "회화",
        curationDraft: "초안",
        exhibitionText: "전시",
        artistNote: "메모",
        provenanceNote: "이력",
      };
      assertTrue(hasAnyCurationData(fullArtwork), "scenario4.full");

      // Whitespace-only edge — STEP 119 hasAnyCurationData 가 trim 검사
      const whitespaceArtwork: Artwork = {
        ...BASE_ARTWORK,
        id: "art_whitespace_1",
        description: "   ",
        curationDraft: "\n\t",
      };
      assertFalse(hasAnyCurationData(whitespaceArtwork), "scenario4.whitespace_only");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §5 Backward compat — STEP 118 이전 호출자 (5 fields 부재) 무손상
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 5,
    label: "Backward compat — STEP 118 이전 ArtworkInput 호출자 무손상",
    description:
      "ArtworkInput 의 9 required + 6 image optional fields 만 보유한 legacy 호출자가 본 STEP 이후에도 type-check 통과",
    run: () => {
      // Legacy shape — STEP 118 이전 호출자가 사용했을 정확한 shape
      const legacy: ArtworkInput = {
        title: "T",
        artistName: "A",
        year: 2024,
        medium: "Oil",
        dimensions: "100 × 100 cm",
        priceKRW: 100_000,
        state: "DRAFT",
        thumbnailColor: "#000",
      };
      // 5 curation fields 부재 → 모두 undefined
      assertEqual(legacy.description, undefined, "scenario5.description");
      assertEqual(legacy.curationDraft, undefined, "scenario5.curationDraft");
      assertEqual(legacy.exhibitionText, undefined, "scenario5.exhibitionText");
      assertEqual(legacy.artistNote, undefined, "scenario5.artistNote");
      assertEqual(legacy.provenanceNote, undefined, "scenario5.provenanceNote");

      // Optional image fields 도 부재 — 기존 schema 보존 verified
      assertEqual(legacy.imageUrl, undefined, "scenario5.imageUrl");
      assertEqual(legacy.imageStorageKey, undefined, "scenario5.imageStorageKey");
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
