// ============================================================================
// Invoice helpers — pure derivation functions for Invoice entity.
//
// **본 module 의 정체**:
//   Invoice entity 의 *type-safe derivation* layer. side effect 없음, side
//   input 없음 — 단일 invoice 만 받아 derive.
//
// **본 module 의 영역**:
//   - STEP 127 Phase 2 — `getInvoiceKind` (invoiceKind 옵셔널 슬롯의
//     fallback derivation, default "final" for backward compat)
//   - STEP 128 (out of scope) — `canRegisterPaymentFor` 등 guard helper
//     합류 예정 (PRE invoice 의 settlement non-trigger 보장)
//
// **convention 답습**:
//   `src/lib/audit-helpers.ts` / `src/lib/transaction-helpers.ts` 와 동일
//   pattern — pure / type-only derivation / external dependency 0.
// ============================================================================

import type { Invoice } from "@/types/invoice";

/**
 * Invoice 의 kind 를 derive. 미정의 (`invoice.invoiceKind === undefined`) 시
 * `"final"` fallback (backward compat 100%).
 *
 * **rationale**: 기존 모든 invoice (Phase 1 ~ STEP 126 까지의 데이터) 는 거래
 * invoice — `"final"` 의미 그대로. invoiceKind === undefined → "final"
 * fallback 으로 기존 의미 보존 + 신규 invoice 가 `"pre"` 명시 시 그대로 반환.
 *
 * **사용처** (STEP 128 활성):
 *   - registerPayment guard: `if (getInvoiceKind(inv) === "pre") return;`
 *     — PRE invoice 의 payment trigger 차단 (rule_3 Money Flow Separation)
 *   - fiscal-summary / reporting-aggregates 의 PRE filter
 *   - PaymentRegisterDrawer 의 disabled UI 분기
 *   - InvoicePrintView 의 "PRO FORMA — NOT FOR PAYMENT" watermark 분기
 *
 * **pure**: side effect 없음, single argument → single primitive return.
 * tree-shake 안전 — 호출처 없으면 production bundle 에 포함되지 않음.
 *
 * @example
 * getInvoiceKind({ ...invoice }); // → "final" (기존 데이터)
 * getInvoiceKind({ ...invoice, invoiceKind: "pre" }); // → "pre"
 * getInvoiceKind({ ...invoice, invoiceKind: "final" }); // → "final"
 */
export function getInvoiceKind(invoice: Invoice): "pre" | "final" {
  return invoice.invoiceKind ?? "final";
}
