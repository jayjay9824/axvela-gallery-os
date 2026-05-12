// ============================================================================
// format-axid-for-document.scenarios.ts — STEP 129 Test Scenarios
//
// **본 module 의 정체**:
//   STEP 129 Commit 1 에서 정착된 `formatAxidForDocument` helper 의 검증.
//   STEP 127 Phase 1 §2.7 옵션 Z — internal `AXV-YYYY-NNNN` → document
//   display `AX-YYYY-KR-NNNNNN` 변환. 시스템 식별자 무손상, 디자인 표기 분리.
//
// **검증 영역**:
//   §1 표준 변환 — "AXV-2025-0001" → "AX-2025-KR-000001"
//   §2 짧은 seq padding — "AXV-2025-3" → "AX-2025-KR-000003"
//   §3 긴 seq 보존 — "AXV-2024-12345" → "AX-2024-KR-012345" (6자리 padding)
//   §4 non-standard format fallback — 그대로 원본 반환
//   §5 empty string fallback
// ============================================================================

import { formatAxidForDocument } from "@/lib/utils";

// ============================================================================
// Tiny assert helpers (외부 라이브러리 0)
// ============================================================================

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormatAxidForDocumentAssertionError";
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      `[${label}] expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
    );
  }
}

// ============================================================================
// Scenario shape
// ============================================================================

interface FormatAxidScenario {
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

export const SCENARIOS: readonly FormatAxidScenario[] = [
  {
    id: 1,
    label: "standard_format_conversion",
    description: "AXV-2025-0001 → AX-2025-KR-000001 (옵션 Z 정확 변환)",
    run: () => {
      const result = formatAxidForDocument({ code: "AXV-2025-0001" });
      assertEqual(result, "AX-2025-KR-000001", "scenario1.standard");
    },
  },
  {
    id: 2,
    label: "short_seq_padding",
    description: "seq 짧을 시 6자리 zero-padding (AXV-2025-3 → AX-2025-KR-000003)",
    run: () => {
      const result = formatAxidForDocument({ code: "AXV-2025-3" });
      assertEqual(result, "AX-2025-KR-000003", "scenario2.short_seq_padded");
    },
  },
  {
    id: 3,
    label: "longer_seq_preserved",
    description: "seq 가 5자리면 5자리 그대로 + 6자리 padding (AXV-2024-12345 → AX-2024-KR-012345)",
    run: () => {
      const result = formatAxidForDocument({ code: "AXV-2024-12345" });
      assertEqual(result, "AX-2024-KR-012345", "scenario3.longer_seq");
    },
  },
  {
    id: 4,
    label: "non_standard_format_fallback",
    description: "비표준 format → 원본 그대로 반환 (legacy seed data 호환)",
    run: () => {
      const result1 = formatAxidForDocument({ code: "CUSTOM-FORMAT" });
      assertEqual(result1, "CUSTOM-FORMAT", "scenario4.custom_preserved");

      const result2 = formatAxidForDocument({ code: "AX-2025-001" });
      // AX- prefix 만으로는 매칭 안 됨 (AXV- 필요)
      assertEqual(result2, "AX-2025-001", "scenario4.alt_prefix_fallback");
    },
  },
  {
    id: 5,
    label: "empty_string_fallback",
    description: "빈 문자열 → 빈 문자열 그대로 (no match, fallback)",
    run: () => {
      const result = formatAxidForDocument({ code: "" });
      assertEqual(result, "", "scenario5.empty_preserved");
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
