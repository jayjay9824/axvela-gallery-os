// ============================================================================
// invoice-kind.scenarios.ts — STEP 127 Phase 2 Test Scenarios
//
// **본 module 의 정체**:
//   STEP 127 Phase 2 `invoiceKind?: "pre" | "final"` optional slot +
//   `getInvoiceKind` helper 의 5-scenario 검증. self-runnable scenario
//   module — DOC-2 §4 신규 라이브러리 금지 준수.
//
// **검증 영역**:
//   §1 backward compat — invoiceKind 미정의 → "final" fallback
//   §2 explicit "pre" → "pre" 그대로 반환
//   §3 explicit "final" → "final" 그대로 반환
//   §4 persistence v1 JSON round-trip — invoiceKind 미정의 invoice 무손상
//   §5 persistence v1 JSON round-trip — invoiceKind "pre" 명시 invoice 무손상
//
// **검증 회피 영역** (STEP 128 으로 이월):
//   - registerPayment guard 동작
//   - fiscal-summary / reporting-aggregates PRE filter
//   - UI disabled 분기
//   - PRO FORMA watermark
// ============================================================================

import type { Invoice } from "@/types/invoice";
import { getInvoiceKind } from "@/lib/invoice-helpers";

// ============================================================================
// Tiny assert helpers (외부 라이브러리 0)
// ============================================================================

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceKindAssertionError";
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
// Test fixture — 최소한의 valid Invoice (STEP 127 Phase 2 type 검증에 필요)
// ============================================================================

function baseInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-test-001",
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

// ============================================================================
// Scenario shape
// ============================================================================

interface InvoiceKindScenario {
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

export const SCENARIOS: readonly InvoiceKindScenario[] = [
  // ─────────────────────────────────────────────────────────────────────
  // §1 — backward compat: invoiceKind 미정의 → "final" fallback
  // 기존 모든 invoice (Phase 1 ~ STEP 126 까지의 데이터) 의 의미 보존.
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 1,
    label: "backward_compat_undefined_to_final",
    description: "invoiceKind 미정의 invoice 는 getInvoiceKind 가 'final' 반환 (기존 의미 보존)",
    run: () => {
      const inv = baseInvoice();
      // type 검증: undefined 허용
      assertEqual(inv.invoiceKind, undefined, "scenario1.invoiceKind_is_undefined");
      // helper fallback
      assertEqual(getInvoiceKind(inv), "final", "scenario1.fallback_to_final");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §2 — explicit "pre" → "pre" 그대로 반환
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 2,
    label: "explicit_pre_returned_as_is",
    description: "invoiceKind 가 'pre' 명시된 invoice 는 그대로 'pre' 반환",
    run: () => {
      const inv = baseInvoice({ invoiceKind: "pre" });
      assertEqual(inv.invoiceKind, "pre", "scenario2.invoiceKind_is_pre");
      assertEqual(getInvoiceKind(inv), "pre", "scenario2.helper_returns_pre");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §3 — explicit "final" → "final" 그대로 반환
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 3,
    label: "explicit_final_returned_as_is",
    description: "invoiceKind 가 'final' 명시된 invoice 는 그대로 'final' 반환",
    run: () => {
      const inv = baseInvoice({ invoiceKind: "final" });
      assertEqual(inv.invoiceKind, "final", "scenario3.invoiceKind_is_final");
      assertEqual(getInvoiceKind(inv), "final", "scenario3.helper_returns_final");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §4 — persistence v1 round-trip: invoiceKind 미정의 invoice 무손상
  // JSON.stringify + JSON.parse 후에도 모든 기존 field 보존, invoiceKind
  // 여전히 undefined → helper "final" fallback 유지.
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 4,
    label: "round_trip_undefined_kind_preserved",
    description: "JSON round-trip 후에도 invoiceKind 미정의 상태 그대로 + getInvoiceKind 'final' fallback 유지",
    run: () => {
      const before = baseInvoice();
      const after = JSON.parse(JSON.stringify(before)) as Invoice;
      // 기존 field 모두 보존
      assertEqual(after.id, before.id, "scenario4.id_preserved");
      assertEqual(after.amount, before.amount, "scenario4.amount_preserved");
      assertEqual(after.currency, before.currency, "scenario4.currency_preserved");
      assertEqual(after.status, before.status, "scenario4.status_preserved");
      assertEqual(after.version, before.version, "scenario4.version_preserved");
      assertEqual(after.isLocked, before.isLocked, "scenario4.isLocked_preserved");
      // invoiceKind 여전히 undefined
      assertEqual(after.invoiceKind, undefined, "scenario4.invoiceKind_still_undefined");
      // helper fallback 유지
      assertEqual(getInvoiceKind(after), "final", "scenario4.helper_still_final_fallback");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §5 — persistence v1 round-trip: invoiceKind "pre" 명시 invoice 무손상
  // 명시된 "pre" 값이 JSON serialize/deserialize 후에도 보존.
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 5,
    label: "round_trip_pre_kind_preserved",
    description: "JSON round-trip 후에도 invoiceKind 'pre' 명시 값 보존 + getInvoiceKind 'pre' 반환",
    run: () => {
      const before = baseInvoice({ invoiceKind: "pre" });
      const after = JSON.parse(JSON.stringify(before)) as Invoice;
      assertEqual(after.invoiceKind, "pre", "scenario5.invoiceKind_pre_preserved");
      assertEqual(getInvoiceKind(after), "pre", "scenario5.helper_returns_pre");
      // 기존 field 도 보존 (backward compat 동시 검증)
      assertEqual(after.id, before.id, "scenario5.id_preserved");
      assertEqual(after.status, before.status, "scenario5.status_preserved");
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
