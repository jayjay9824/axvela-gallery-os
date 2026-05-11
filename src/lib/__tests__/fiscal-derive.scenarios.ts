// ============================================================================
// fiscal-derive.scenarios.ts — STEP 90 Test Scenarios
//
// **본 module이 무엇인가**:
//   사용자 spec §10 \"Major Test Cases\" 10건 정확 매칭. 본 프로젝트는 테스트
//   runner (vitest / jest) 부재 — 사용자 spec §9 \"새 라이브러리 추가 금지\"
//   준수를 위해 *self-runnable scenario module*로 정착. 향후 vitest / jest
//   도입 시 `it(scenario.label, () => scenario.run())` wrap만으로 자연 합류.
//
// **본 module이 *아닌* 것**:
//   - production runtime 코드 (별도 import 부재 시 tree-shake out)
//   - 자동 실행 시 side-effect (호출자가 명시적 trigger)
//
// **사용 방법**:
//   ```ts
//   import { runAllScenarios } from \"@/lib/__tests__/fiscal-derive.scenarios\";
//   const result = runAllScenarios();
//   console.log(result.summary); // \"10/10 passed\"
//   ```
//
// **AI Direction §1 / Trust Layer 정책 강화**:
//   본 module은 *expected behavior 문서화* — \"세무 확정\" 표현 0건 / \"운영
//   참고\" / \"검토 필요\" 권장 표현만 사용.
// ============================================================================

import {
  deriveSettlementTax,
  type SettlementTaxBreakdown,
} from "@/lib/settlement-tax";
import {
  deriveRecommendedFiscalDocuments,
  type RecommendedFiscalDocuments,
} from "@/lib/fiscal-document-derive";
import type { Settlement } from "@/types/settlement";

// ============================================================================
// Tiny assert helpers — *no external library*
// ============================================================================

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalDeriveAssertionError";
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      `[${label}] expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
    );
  }
}

function assertContains<T>(arr: readonly T[], value: T, label: string): void {
  if (!arr.includes(value)) {
    throw new AssertionError(
      `[${label}] array ${JSON.stringify(arr)} does not contain ${JSON.stringify(value)}`
    );
  }
}

function assertNotContains<T>(arr: readonly T[], value: T, label: string): void {
  if (arr.includes(value)) {
    throw new AssertionError(
      `[${label}] array ${JSON.stringify(arr)} should not contain ${JSON.stringify(value)}`
    );
  }
}

// ============================================================================
// Settlement test fixture — minimal shape (rule_12 derive 값 반영)
// ============================================================================

function fixtureSettlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    id: "set-test",
    transactionId: "tx-test",
    artworkId: "art-test",
    totalAmount: 1_000_000,
    artistShare: 600_000, // 60% (default v1) — netToArtist alias (rule_12)
    galleryShare: 400_000, // 40% (default v1)
    currency: "KRW",
    status: "PENDING",
    createdAt: "2026-05-07T00:00:00.000Z",
    updatedAt: "2026-05-07T00:00:00.000Z",
    ...overrides,
  };
}

// ============================================================================
// Scenario shape
// ============================================================================

export interface FiscalScenario {
  id: number;
  label: string;
  description: string;
  run: () => void;
}

// ============================================================================
// 10 Major Test Cases (사용자 spec §10 정확 매칭)
// ============================================================================

export const SCENARIOS: readonly FiscalScenario[] = [
  // ─────────────────────────────────────────────────────────────────────
  // §10.1 domestic individual cash buyer → cashReceipt recommended
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 1,
    label: "domestic individual cash buyer → cashReceipt recommended",
    description:
      "국내 개인 + 현금 결제 + 100,000원 이상 → cashReceipt recommended + flag",
    run: () => {
      const result = deriveRecommendedFiscalDocuments({
        buyerType: "domesticIndividual",
        paymentMethod: "cash",
        amount: 1_000_000,
        currency: "KRW",
        buyerHasIdentity: true,
      });
      assertContains(
        result.recommendedDocuments,
        "cashReceipt",
        "scenario1.recommended"
      );
      assertContains(
        result.reviewFlags,
        "cashReceiptRecommended",
        "scenario1.flag"
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §10.2 domestic business buyer with registration → taxInvoice eligible
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 2,
    label: "domestic business with registration → taxInvoice eligible",
    description:
      "국내 사업자 + 사업자등록번호 보유 → taxInvoice recommended + flag",
    run: () => {
      const result = deriveRecommendedFiscalDocuments({
        buyerType: "domesticBusiness",
        paymentMethod: "transfer",
        amount: 5_000_000,
        currency: "KRW",
        buyerHasBusinessRegistration: true,
        buyerHasIdentity: true,
        vatHandling: "vatIncluded",
      });
      assertContains(
        result.recommendedDocuments,
        "taxInvoice",
        "scenario2.recommended"
      );
      assertContains(
        result.reviewFlags,
        "taxInvoiceEligible",
        "scenario2.flag"
      );
      assertNotContains(
        result.reviewFlags,
        "businessRegistrationMissing",
        "scenario2.no-missing"
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §10.3 individual artist settlement → 3.3% withholding
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 3,
    label: "individual artist → 3.3% withholding",
    description: "개인 작가 정산 → 3.3% 원천징수 자동 적용",
    run: () => {
      const breakdown = deriveSettlementTax(
        fixtureSettlement(),
        "individualArtist"
      );
      assertEqual(breakdown.withholdingRate, 0.033, "scenario3.rate");
      assertEqual(
        breakdown.withholdingTax,
        Math.round(600_000 * 0.033),
        "scenario3.tax"
      );
      assertEqual(
        breakdown.netToArtist,
        600_000 - Math.round(600_000 * 0.033),
        "scenario3.net"
      );
      assertEqual(
        breakdown.withholdingReviewRequired,
        false,
        "scenario3.no-review"
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §10.4 sole proprietor artist → no withholding
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 4,
    label: "sole proprietor artist → no withholding",
    description: "개인사업자 작가 정산 → 원천징수 미적용 (사업소득 본인 신고)",
    run: () => {
      const breakdown = deriveSettlementTax(
        fixtureSettlement(),
        "soleProprietorArtist"
      );
      assertEqual(breakdown.withholdingRate, 0, "scenario4.rate");
      assertEqual(breakdown.withholdingTax, 0, "scenario4.tax");
      assertEqual(breakdown.netToArtist, 600_000, "scenario4.net");
      assertEqual(
        breakdown.withholdingReviewRequired,
        false,
        "scenario4.no-review"
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §10.5 corporate artist → no withholding
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 5,
    label: "corporate artist → no withholding",
    description: "법인 작가 정산 → 원천징수 미적용 (법인세 본인 신고)",
    run: () => {
      const breakdown = deriveSettlementTax(
        fixtureSettlement(),
        "corporateArtist"
      );
      assertEqual(breakdown.withholdingRate, 0, "scenario5.rate");
      assertEqual(breakdown.withholdingTax, 0, "scenario5.tax");
      assertEqual(breakdown.netToArtist, 600_000, "scenario5.net");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §10.6 overseas individual → internationalInvoice + taxReviewRequired
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 6,
    label: "overseas individual → internationalInvoice + tax review",
    description: "해외 개인 → 국제 인보이스 권장 + 해외 세무 검토 flag",
    run: () => {
      const result = deriveRecommendedFiscalDocuments({
        buyerType: "overseasIndividual",
        paymentMethod: "transfer",
        amount: 3_000,
        currency: "USD",
        buyerHasIdentity: true,
      });
      assertContains(
        result.recommendedDocuments,
        "internationalInvoice",
        "scenario6.recommended"
      );
      assertContains(
        result.reviewFlags,
        "overseasTaxReviewRequired",
        "scenario6.flag"
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §10.7 overseas business → commercial/export invoice + zeroRated review
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 7,
    label: "overseas business → commercialInvoice + zeroRatedVATReview",
    description:
      "해외 사업자 → 상업 송장 권장 + 영세율 검토 + 수출 증빙 flag",
    run: () => {
      const result = deriveRecommendedFiscalDocuments({
        buyerType: "overseasBusiness",
        paymentMethod: "transfer",
        amount: 10_000,
        currency: "USD",
        buyerHasIdentity: true,
      });
      assertContains(
        result.recommendedDocuments,
        "commercialInvoice",
        "scenario7.recommended"
      );
      assertContains(
        result.optionalDocuments,
        "exportInvoice",
        "scenario7.optional"
      );
      assertContains(
        result.reviewFlags,
        "zeroRatedVATReviewRequired",
        "scenario7.zerorated"
      );
      assertContains(
        result.reviewFlags,
        "exportDocumentationRequired",
        "scenario7.export"
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §10.8 missing buyer business registration → flag
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 8,
    label: "missing buyer business registration → flag",
    description:
      "사업자 거래 + 사업자등록번호 false → businessRegistrationMissing flag",
    run: () => {
      const result = deriveRecommendedFiscalDocuments({
        buyerType: "domesticBusiness",
        paymentMethod: "transfer",
        amount: 1_000_000,
        currency: "KRW",
        buyerHasBusinessRegistration: false,
        buyerHasIdentity: true,
        vatHandling: "vatIncluded",
      });
      assertContains(
        result.reviewFlags,
        "businessRegistrationMissing",
        "scenario8.flag"
      );
      // 발행 차단 — taxInvoice는 *optional*에만 (recommended 아님)
      assertNotContains(
        result.recommendedDocuments,
        "taxInvoice",
        "scenario8.no-recommend"
      );
      assertContains(
        result.missingFields,
        "buyerBusinessRegistrationNumber",
        "scenario8.missing"
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §10.9 VAT excluded transaction → VAT calculation note
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 9,
    label: "VAT excluded transaction → VAT note emitted",
    description: "VAT 별도 표기 거래 → 운영 참고 note 자동 합성",
    run: () => {
      const result = deriveRecommendedFiscalDocuments({
        buyerType: "domesticBusiness",
        paymentMethod: "transfer",
        amount: 2_000_000,
        currency: "KRW",
        buyerHasBusinessRegistration: true,
        buyerHasIdentity: true,
        vatHandling: "vatExcluded",
      });
      const hasVATNote = result.taxNotes.some((n) => n.includes("VAT 별도"));
      if (!hasVATNote) {
        throw new AssertionError(
          `[scenario9.note] taxNotes does not mention "VAT 별도": ${JSON.stringify(result.taxNotes)}`
        );
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §10.10 zeroRatedPossible → reviewRequired, not auto-confirmed
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 10,
    label: "zeroRatedPossible → review required (not auto-confirmed)",
    description:
      "영세율 적용 가능성 → 자동 확정 0건, zeroRatedVATReviewRequired flag 표시",
    run: () => {
      const result = deriveRecommendedFiscalDocuments({
        buyerType: "overseasBusiness",
        paymentMethod: "transfer",
        amount: 50_000,
        currency: "USD",
        buyerHasIdentity: true,
        vatHandling: "zeroRatedPossible",
      });
      assertContains(
        result.reviewFlags,
        "zeroRatedVATReviewRequired",
        "scenario10.flag"
      );
      // \"영세율 확정\" / \"자동 적용\" 표현 절대 0건 — note에 \"검토 필요\" 포함
      const hasReviewNote = result.taxNotes.some(
        (n) => n.includes("검토") || n.includes("회계사")
      );
      if (!hasReviewNote) {
        throw new AssertionError(
          `[scenario10.note] taxNotes does not mention 검토 / 회계사: ${JSON.stringify(result.taxNotes)}`
        );
      }
    },
  },
] as const;

// ============================================================================
// Runner
// ============================================================================

export interface ScenarioRunResult {
  total: number;
  passed: number;
  failed: number;
  failures: Array<{ id: number; label: string; error: string }>;
  summary: string;
}

/**
 * 모든 scenario 실행 + 결과 요약 반환. 호출자가 결과를 console.log /
 * Jest assertion / future runner에 자유 전달 가능.
 */
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

/**
 * Scenario module의 기본 사용처 — 향후 future test runner (vitest / jest 등)
 * 도입 시 자연 합류 예시:
 *
 *   describe(\"STEP 90 fiscal derive\", () => {
 *     for (const sc of SCENARIOS) {
 *       it(sc.label, () => sc.run());
 *     }
 *   });
 */

// Type-only re-exports for downstream consumers
export type { SettlementTaxBreakdown, RecommendedFiscalDocuments };
