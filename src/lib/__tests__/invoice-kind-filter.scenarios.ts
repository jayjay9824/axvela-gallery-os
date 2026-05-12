// ============================================================================
// invoice-kind-filter.scenarios.ts — STEP 129 Test Scenarios
//
// **본 module 의 정체**:
//   STEP 129 Commit 1 에서 정착된 *PRE invoice 제외 filter pattern* 의 검증.
//   동일 filter 가 3 곳에 사용됨 — fiscal-summary.ts / reporting-aggregates.ts
//   / documents-aggregates.ts. 세 곳 모두 `getInvoiceKind(inv) === "final"`
//   단일 helper 호출이므로 *filter pattern 자체* 검증으로 3 곳 모두 커버.
//
// **검증 영역**:
//   §1 backward compat — invoiceKind 미정의 invoice 는 FINAL 의미 보존
//   §2 PRE invoice 만 array 에서 제외 — FINAL + undefined 보존
//   §3 mixed array — count 정확성
//   §4 empty array edge case
//   §5 all-PRE array edge case
// ============================================================================

import type { Invoice } from "@/types/invoice";
import { getInvoiceKind } from "@/lib/invoice-helpers";

// ============================================================================
// Tiny assert helpers (외부 라이브러리 0)
// ============================================================================

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceKindFilterAssertionError";
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
// Test fixture — 최소한의 valid Invoice
// ============================================================================

function baseInvoice(id: string, overrides: Partial<Invoice> = {}): Invoice {
  return {
    id,
    transactionId: "tx-test-001",
    amount: 1_000_000,
    currency: "KRW",
    status: "DRAFT",
    issuedAt: "2026-05-12T00:00:00Z",
    version: 1,
    parentInvoiceId: null,
    lockedAt: null,
    isLocked: false,
    ...overrides,
  };
}

// fiscal-summary / reporting-aggregates / documents-aggregates 의 공통 filter
function applyFinalOnlyFilter(invoices: Invoice[]): Invoice[] {
  return invoices.filter((i) => getInvoiceKind(i) === "final");
}

// ============================================================================
// Scenario shape
// ============================================================================

interface InvoiceFilterScenario {
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

export const SCENARIOS: readonly InvoiceFilterScenario[] = [
  {
    id: 1,
    label: "backward_compat_undefined_passes_filter",
    description: "invoiceKind 미정의 invoice (= FINAL fallback) 는 filter 통과",
    run: () => {
      const invs = [baseInvoice("inv-A")];
      const filtered = applyFinalOnlyFilter(invs);
      assertEqual(filtered.length, 1, "scenario1.length");
      assertEqual(filtered[0].id, "inv-A", "scenario1.id_preserved");
    },
  },
  {
    id: 2,
    label: "pre_invoice_excluded_final_preserved",
    description: "PRE invoice 는 filter 제외, FINAL/undefined 는 통과",
    run: () => {
      const invs = [
        baseInvoice("inv-PRE", { invoiceKind: "pre" }),
        baseInvoice("inv-FINAL", { invoiceKind: "final" }),
        baseInvoice("inv-UNDEF"), // undefined → FINAL fallback
      ];
      const filtered = applyFinalOnlyFilter(invs);
      assertEqual(filtered.length, 2, "scenario2.length_2");
      assertEqual(filtered[0].id, "inv-FINAL", "scenario2.final_kept");
      assertEqual(filtered[1].id, "inv-UNDEF", "scenario2.undef_kept");
    },
  },
  {
    id: 3,
    label: "mixed_array_count_accuracy",
    description: "PRE 2 + FINAL 3 + undefined 1 → filter 후 4 (FINAL+undef)",
    run: () => {
      const invs = [
        baseInvoice("p1", { invoiceKind: "pre" }),
        baseInvoice("f1", { invoiceKind: "final" }),
        baseInvoice("p2", { invoiceKind: "pre" }),
        baseInvoice("f2", { invoiceKind: "final" }),
        baseInvoice("u1"), // undefined
        baseInvoice("f3", { invoiceKind: "final" }),
      ];
      const filtered = applyFinalOnlyFilter(invs);
      assertEqual(filtered.length, 4, "scenario3.length_4");
      assertEqual(
        filtered.every((i) => i.id !== "p1" && i.id !== "p2"),
        true,
        "scenario3.no_pre_in_result",
      );
    },
  },
  {
    id: 4,
    label: "empty_array_edge_case",
    description: "빈 배열 → 빈 배열 그대로 (filter no-op)",
    run: () => {
      const filtered = applyFinalOnlyFilter([]);
      assertEqual(filtered.length, 0, "scenario4.empty_in_empty_out");
    },
  },
  {
    id: 5,
    label: "all_pre_array_edge_case",
    description: "모두 PRE → filter 후 빈 배열 (fiscal 집계 0)",
    run: () => {
      const invs = [
        baseInvoice("p1", { invoiceKind: "pre" }),
        baseInvoice("p2", { invoiceKind: "pre" }),
        baseInvoice("p3", { invoiceKind: "pre" }),
      ];
      const filtered = applyFinalOnlyFilter(invs);
      assertEqual(filtered.length, 0, "scenario5.all_pre_excluded");
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
