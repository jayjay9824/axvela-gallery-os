// ============================================================================
// artwork-registration-status.scenarios.ts — STEP 114 Test Scenarios
//
// **본 module 의 정체**:
//   STEP 114 ArtworkRegistrationStatus enum + helpers 의 7-scenario 검증.
//   본 프로젝트는 test runner (vitest / jest) 부재 — DOC-2 §4 "신규 라이브러리
//   금지" 준수, self-runnable scenario module 정착.
//
// **검증 영역**:
//   §1 Enum membership            — 10 values 정확
//   §2 Ordered list integrity     — order array length + unique values
//   §3 Korean label coverage      — 10 keys present, 빈 문자열 0건
//   §4 English label coverage     — 10 keys present, 빈 문자열 0건
//   §5 Ordering progression       — 9-step chain 정확
//   §6 Terminal state             — ARCHIVED → null
//   §7 Type guard                 — accepts/rejects 정확
//
// **Persistence v1 forward compat** 는 Artwork.registrationStatus 가 *optional
//   slot* 인 사실만으로 자연 보장 — 별도 scenario 없이 type system 이 정합 보장.
// ============================================================================

import {
  type ArtworkRegistrationStatus,
  ARTWORK_REGISTRATION_STATUSES,
  ARTWORK_REGISTRATION_STATUS_LABEL_KR,
  ARTWORK_REGISTRATION_STATUS_LABEL_EN,
  isArtworkRegistrationStatus,
  nextRegistrationStatus,
} from "@/types/artwork-registration-status";

// ============================================================================
// Tiny assert helpers — *no external library*
// ============================================================================

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtworkRegistrationStatusAssertionError";
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
  if (!cond) {
    throw new AssertionError(`[${label}] expected true`);
  }
}

function assertFalse(cond: boolean, label: string): void {
  if (cond) {
    throw new AssertionError(`[${label}] expected false`);
  }
}

// ============================================================================
// Scenario shape (consistent with fiscal-derive.scenarios)
// ============================================================================

interface RegistrationStatusScenario {
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
// Scenarios
// ============================================================================

const EXPECTED_VALUES: readonly ArtworkRegistrationStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "INQUIRY_ACTIVE",
  "DEAL_IN_PROGRESS",
  "CONTRACT_PENDING",
  "AWAITING_PAYMENT",
  "PAID",
  "PREPARING_CURATION",
  "READY_FOR_EXHIBITION",
  "ARCHIVED",
];

export const SCENARIOS: readonly RegistrationStatusScenario[] = [
  // ─────────────────────────────────────────────────────────────────────
  // §1 Enum membership — 10 values 정확
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 1,
    label: "enum membership — 10 expected values present",
    description:
      "ARTWORK_REGISTRATION_STATUSES 는 사용자 spec 의 10-state 와 정확히 일치",
    run: () => {
      assertEqual(
        ARTWORK_REGISTRATION_STATUSES.length,
        10,
        "scenario1.length",
      );
      for (const expected of EXPECTED_VALUES) {
        assertTrue(
          (ARTWORK_REGISTRATION_STATUSES as readonly string[]).includes(
            expected,
          ),
          `scenario1.contains.${expected}`,
        );
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §2 Ordered list integrity — order matches expected progression
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 2,
    label: "ordered list integrity — index order matches spec",
    description:
      "ARTWORK_REGISTRATION_STATUSES[i] 는 사용자 spec progression 순서와 일치, unique values",
    run: () => {
      for (let i = 0; i < EXPECTED_VALUES.length; i++) {
        assertEqual(
          ARTWORK_REGISTRATION_STATUSES[i],
          EXPECTED_VALUES[i],
          `scenario2.order[${i}]`,
        );
      }
      // Uniqueness check — Set size === array length
      const uniqueSize = new Set(ARTWORK_REGISTRATION_STATUSES).size;
      assertEqual(
        uniqueSize,
        ARTWORK_REGISTRATION_STATUSES.length,
        "scenario2.unique",
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §3 Korean label coverage — 10 keys, 빈 문자열 0건
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 3,
    label: "Korean label coverage — all 10 keys present + non-empty",
    description:
      "ARTWORK_REGISTRATION_STATUS_LABEL_KR 는 10 enum value 모두 매핑, 빈 문자열 0건. STEP 113 terminology 정합 (담당자 사용)",
    run: () => {
      const keys = Object.keys(ARTWORK_REGISTRATION_STATUS_LABEL_KR);
      assertEqual(keys.length, 10, "scenario3.label_count");
      for (const status of ARTWORK_REGISTRATION_STATUSES) {
        const label = ARTWORK_REGISTRATION_STATUS_LABEL_KR[status];
        assertTrue(
          typeof label === "string" && label.length > 0,
          `scenario3.label.${status}`,
        );
      }
      // STEP 113 terminology guard — 라벨 내 "인간 검토" / "Human Review" 0건
      const allLabels = Object.values(
        ARTWORK_REGISTRATION_STATUS_LABEL_KR,
      ).join(" ");
      assertFalse(
        allLabels.includes("인간 검토"),
        "scenario3.no_human_review_kr",
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §4 English label coverage — 10 keys, 빈 문자열 0건
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 4,
    label: "English label coverage — all 10 keys present + non-empty",
    description:
      "ARTWORK_REGISTRATION_STATUS_LABEL_EN 는 10 enum value 모두 매핑, 빈 문자열 0건",
    run: () => {
      const keys = Object.keys(ARTWORK_REGISTRATION_STATUS_LABEL_EN);
      assertEqual(keys.length, 10, "scenario4.label_count");
      for (const status of ARTWORK_REGISTRATION_STATUSES) {
        const label = ARTWORK_REGISTRATION_STATUS_LABEL_EN[status];
        assertTrue(
          typeof label === "string" && label.length > 0,
          `scenario4.label.${status}`,
        );
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §5 Ordering progression — 9-step chain 정확
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 5,
    label: "ordering progression — 9-step canonical chain",
    description:
      "nextRegistrationStatus 는 canonical order 정확 traversal — DRAFT → PENDING_REVIEW → ... → READY_FOR_EXHIBITION",
    run: () => {
      const expectedChain: Array<
        [ArtworkRegistrationStatus, ArtworkRegistrationStatus]
      > = [
        ["DRAFT", "PENDING_REVIEW"],
        ["PENDING_REVIEW", "INQUIRY_ACTIVE"],
        ["INQUIRY_ACTIVE", "DEAL_IN_PROGRESS"],
        ["DEAL_IN_PROGRESS", "CONTRACT_PENDING"],
        ["CONTRACT_PENDING", "AWAITING_PAYMENT"],
        ["AWAITING_PAYMENT", "PAID"],
        ["PAID", "PREPARING_CURATION"],
        ["PREPARING_CURATION", "READY_FOR_EXHIBITION"],
        ["READY_FOR_EXHIBITION", "ARCHIVED"],
      ];
      for (const [from, expectedNext] of expectedChain) {
        assertEqual(
          nextRegistrationStatus(from),
          expectedNext,
          `scenario5.chain.${from}→${expectedNext}`,
        );
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §6 Terminal state — ARCHIVED → null
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 6,
    label: "terminal state — ARCHIVED has no next",
    description:
      "nextRegistrationStatus(ARCHIVED) 는 null 반환 — terminal sentinel",
    run: () => {
      assertEqual(
        nextRegistrationStatus("ARCHIVED"),
        null,
        "scenario6.terminal",
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §7 Type guard — accepts valid, rejects invalid
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 7,
    label: "type guard — accepts valid + rejects invalid input",
    description:
      "isArtworkRegistrationStatus 는 10 valid 모두 accept, unknown / number / undefined / null 모두 reject",
    run: () => {
      // Valid — 10 enum values 모두 accept
      for (const valid of ARTWORK_REGISTRATION_STATUSES) {
        assertTrue(
          isArtworkRegistrationStatus(valid),
          `scenario7.accept.${valid}`,
        );
      }
      // Invalid — 다양한 타입 모두 reject
      const invalidInputs: unknown[] = [
        "draft", // lowercase
        "READY", // ArtworkState 값 — registration enum 에 없음
        "INQUIRY", // 동상 — ArtworkState 값
        "UNKNOWN_STATE",
        "",
        0,
        1,
        true,
        false,
        null,
        undefined,
        {},
        [],
      ];
      for (const invalid of invalidInputs) {
        assertFalse(
          isArtworkRegistrationStatus(invalid),
          `scenario7.reject.${JSON.stringify(invalid)}`,
        );
      }
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
