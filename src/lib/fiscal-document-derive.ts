// ============================================================================
// fiscal-document-derive.ts — STEP 90 Recommended Fiscal Documents Derive
//
// **본 module이 무엇인가**:
//   거래 컨텍스트 (buyer type / payment method / amount / business reg /
//   currency 등)를 받아 *어떤 fiscal document가 권장 / 가능 / 필요한지*를
//   분류하는 lightweight derive helper. 회계사가 최종 확정하기 전 *운영자
//   체크리스트* 역할.
//
// **본 module이 *아닌* 것** (사용자 spec 정조준):
//   - full tax engine
//   - legal/tax final judgment
//   - actual document issuance API
//   - multi-country tax automation
//
// **사용자 spec §6 \"Recommended Document Derive\" 정확 매칭**:
//   `deriveRecommendedFiscalDocuments(input)` returns:
//     - recommendedDocuments    (적극 권장)
//     - requiredDocuments       (운영 필수)
//     - optionalDocuments       (선택 가능)
//     - reviewFlags             (회계사 확인 항목)
//     - missingFields           (입력 누락 항목)
//     - taxNotes                (세무 운영 메모)
//
// **AI Direction §1 / Trust Layer 정책 강화**:
//   - 사용: "발행 가능" / "발행 권장" / "검토 필요" / "세무 확인 필요"
//   - 금지: "발행 확정" / "영세율 확정" / "세무상 문제 없음"
//   - 본 helper는 *판단*하지 않음 — *분류 + 검토 항목 표시*만.
//
// **rule_3 / rule_4 / rule_11 / rule_20 모두 보존**:
//   Money flow 합산 0건 / Document Trust 변경 0건 / Transaction core 0건 /
//   FX Lock 보존 (currency 그대로).
// ============================================================================

import type {
  BuyerType,
  FiscalDocumentType,
  FiscalReviewFlag,
  FiscalPaymentMethod,
  VATHandling,
} from "@/types/fiscal-document";
import {
  CASH_RECEIPT_HIGH_VALUE_THRESHOLD_KRW,
  isOverseasBuyer,
} from "@/types/fiscal-document";

// ============================================================================
// Input shape — 거래 컨텍스트
// ============================================================================

/**
 * 거래 컨텍스트 입력. 모든 필드 옵셔널 — 누락 시 `missingFields`에 표시.
 *
 * - `buyerType`               구매자 분류. 미지정 시 분류 불가 → review.
 * - `paymentMethod`           결제 수단. 미지정 시 cashReceipt eligibility 결정 불가.
 * - `amount`                  거래 금액 (currency 단위 그대로, 환산 0건).
 * - `currency`                통화. 외화 → 해외 거래 가능성 trigger.
 * - `buyerHasBusinessRegistration` 사업자등록번호 보유 여부. true → taxInvoice eligible.
 * - `buyerHasIdentity`        구매자 식별정보 (이름/이메일/주소) 보유 여부.
 *                              false → buyerIdentityMissing flag.
 * - `vatHandling`             VAT 처리 분류. 미지정 시 vatReviewRequired.
 * - `isExport`                수출 거래 여부. true → 수출 증빙 / 영세율 검토.
 */
export interface FiscalDocumentDeriveInput {
  buyerType?: BuyerType;
  paymentMethod?: FiscalPaymentMethod;
  amount?: number;
  currency?: string;
  buyerHasBusinessRegistration?: boolean;
  buyerHasIdentity?: boolean;
  vatHandling?: VATHandling;
  isExport?: boolean;
}

// ============================================================================
// Output shape
// ============================================================================

/**
 * `deriveRecommendedFiscalDocuments` 결과. 사용자 spec §6 정확 매칭.
 *
 * 분류 의미론:
 *   - `requiredDocuments`  : 운영자가 *발행해야* 하는 것 (예: 사업자 거래 시
 *                            taxInvoice — 단, eligible한 경우)
 *   - `recommendedDocuments` : *권장* (예: 고액 현금 거래 시 cashReceipt)
 *   - `optionalDocuments`  : *선택 가능* (예: receipt / transactionStatement)
 *   - `reviewFlags`        : 회계사 / 세무사 검토 필요 항목
 *   - `missingFields`      : 입력 누락 — 운영자가 채워야 할 정보
 *   - `taxNotes`           : 세무 운영 참고 메모 (한국어)
 *
 * **본 helper는 *판단*하지 않음** — 위 분류는 *체크리스트*. 회계사가 최종 확정.
 */
export interface RecommendedFiscalDocuments {
  recommendedDocuments: FiscalDocumentType[];
  requiredDocuments: FiscalDocumentType[];
  optionalDocuments: FiscalDocumentType[];
  reviewFlags: FiscalReviewFlag[];
  missingFields: string[];
  taxNotes: string[];
}

// ============================================================================
// Derive helper — pure function (사용자 spec §6 정조준)
// ============================================================================

/**
 * 거래 컨텍스트 → 권장 / 필수 / 선택 fiscal document 분류 + 검토 flag.
 *
 * Pure / no I/O / no store / no DOM / no persistence. STEP 86 anchor pattern
 * 정확 답습.
 *
 * **결정 흐름** (사용자 spec §1~§4 4 그룹 분기):
 *
 * 1. **필수 정보 검증** → missingFields 채움 + 일부 reviewFlag emit
 *    (buyerType / paymentMethod / buyerIdentity / amount 누락 등)
 *
 * 2. **국내 개인** (`domesticIndividual`):
 *    - cash + amount >= 100,000원 → cashReceipt **recommended** +
 *      `cashReceiptRecommended` flag
 *    - cash → cashReceipt optional (eligible)
 *    - card → cardReceipt recommended
 *    - simpleReceipt / transactionMemo → optional (low-stakes)
 *
 * 3. **국내 사업자/법인/재단/단체**:
 *    - businessReg true → taxInvoice **recommended** + `taxInvoiceEligible`
 *    - businessReg false / undefined → `businessRegistrationMissing` flag +
 *      taxInvoice optional (사업자등록번호 채우면 가능)
 *    - 항상 invoice / receipt / transactionStatement / paymentConfirmation
 *      optional
 *    - vatHandling 미지정 / vatReviewRequired → `vatReviewRequired` flag
 *
 * 4. **해외 거래** (overseasIndividual / overseasBusiness / overseasGallery /
 *    overseasFoundation / overseasInstitution):
 *    - 항상 `overseasTaxReviewRequired` flag emit
 *    - overseasBusiness / overseasGallery → commercialInvoice / exportInvoice
 *      recommended + `exportDocumentationRequired` + `zeroRatedVATReviewRequired`
 *    - overseasIndividual / overseasFoundation / overseasInstitution →
 *      internationalInvoice recommended
 *    - vatHandling === "zeroRatedPossible" → `zeroRatedVATReviewRequired` 추가
 *    - 본 그룹은 자동 확정 0건 — *review required* 상태 default (사용자 spec §4)
 *
 * 5. **공통 후처리** : taxNotes 합성 (UI에서 그대로 표시).
 */
export function deriveRecommendedFiscalDocuments(
  input: FiscalDocumentDeriveInput
): RecommendedFiscalDocuments {
  const recommended = new Set<FiscalDocumentType>();
  const required = new Set<FiscalDocumentType>();
  const optional = new Set<FiscalDocumentType>();
  const flags = new Set<FiscalReviewFlag>();
  const missing: string[] = [];
  const notes: string[] = [];

  // ── 1. 필수 정보 검증 ─────────────────────────────────────────────────
  if (!input.buyerType) {
    missing.push("buyerType");
    flags.add("buyerIdentityMissing");
    notes.push("구매자 분류 미지정 — 발행 가능 문서 결정 보류.");
  }
  if (input.buyerHasIdentity === false) {
    flags.add("buyerIdentityMissing");
    missing.push("buyerIdentity");
  }
  if (input.amount === undefined) {
    missing.push("amount");
  }
  if (!input.paymentMethod) {
    missing.push("paymentMethod");
  }

  // 분류 불가 — 조기 반환 (사용자 spec: AXVELA는 확정하지 않음)
  if (!input.buyerType) {
    return {
      recommendedDocuments: [],
      requiredDocuments: [],
      optionalDocuments: [],
      reviewFlags: [...flags],
      missingFields: missing,
      taxNotes: notes,
    };
  }

  // ── 2. 그룹별 derive ─────────────────────────────────────────────────
  const isOverseas = isOverseasBuyer(input.buyerType);

  if (input.buyerType === "domesticIndividual") {
    deriveDomesticIndividual(input, recommended, optional, flags, notes);
  } else if (!isOverseas) {
    // domesticBusiness / domesticCorporate / domesticFoundation / domesticOrganization
    deriveDomesticBusiness(input, recommended, optional, flags, missing, notes);
  } else {
    deriveOverseas(input, recommended, optional, flags, notes);
  }

  // ── 3. VAT note 후처리 ──────────────────────────────────────────────
  if (input.vatHandling) {
    notes.push(buildVATNote(input.vatHandling));
    if (input.vatHandling === "vatReviewRequired") {
      flags.add("vatReviewRequired");
    }
    if (input.vatHandling === "zeroRatedPossible") {
      flags.add("zeroRatedVATReviewRequired");
    }
  } else if (!isOverseas && input.buyerType !== "domesticIndividual") {
    // 사업자/법인 거래에서 VAT 미지정 → 검토 필요
    flags.add("vatReviewRequired");
    notes.push("VAT 처리 분류 미지정 — 회계사 확인 필요.");
  }

  return {
    recommendedDocuments: [...recommended],
    requiredDocuments: [...required],
    optionalDocuments: [...optional],
    reviewFlags: [...flags],
    missingFields: missing,
    taxNotes: notes,
  };
}

// ============================================================================
// Group helpers — 사용자 spec §1~§4 분기
// ============================================================================

function deriveDomesticIndividual(
  input: FiscalDocumentDeriveInput,
  recommended: Set<FiscalDocumentType>,
  optional: Set<FiscalDocumentType>,
  flags: Set<FiscalReviewFlag>,
  notes: string[]
): void {
  const isHighValue =
    input.amount !== undefined &&
    input.amount >= CASH_RECEIPT_HIGH_VALUE_THRESHOLD_KRW;

  if (input.paymentMethod === "cash") {
    if (isHighValue) {
      recommended.add("cashReceipt");
      flags.add("cashReceiptRecommended");
      notes.push(
        `현금 결제 ${input.amount?.toLocaleString("ko-KR")}원 — 현금영수증 발행 권장 (운영 참고).`
      );
    } else {
      optional.add("cashReceipt");
      notes.push("현금 결제 — 현금영수증 발행 가능.");
    }
  } else if (input.paymentMethod === "card") {
    recommended.add("cardReceipt");
    notes.push("카드 결제 — 카드 영수증 자동 발행.");
  } else if (input.paymentMethod === "transfer") {
    optional.add("simpleReceipt");
    notes.push("계좌이체 거래 — 간이 영수증 또는 거래 메모 가능.");
  }

  // 개인 거래는 simpleReceipt / transactionMemo 항상 optional
  optional.add("simpleReceipt");
  optional.add("transactionMemo");
}

function deriveDomesticBusiness(
  input: FiscalDocumentDeriveInput,
  recommended: Set<FiscalDocumentType>,
  optional: Set<FiscalDocumentType>,
  flags: Set<FiscalReviewFlag>,
  missing: string[],
  notes: string[]
): void {
  // 사업자등록번호 보유 → 세금계산서 발행 가능
  if (input.buyerHasBusinessRegistration === true) {
    recommended.add("taxInvoice");
    flags.add("taxInvoiceEligible");
    notes.push("사업자등록번호 확인됨 — 세금계산서 발행 가능.");
  } else if (input.buyerHasBusinessRegistration === false) {
    flags.add("businessRegistrationMissing");
    missing.push("buyerBusinessRegistrationNumber");
    optional.add("taxInvoice");
    notes.push(
      "사업자등록번호 누락 — 세금계산서 발행 차단. 사업자등록증 확인 후 발행 가능."
    );
  } else {
    // 미지정 — 입력 누락
    missing.push("buyerHasBusinessRegistration");
    optional.add("taxInvoice");
    notes.push(
      "사업자등록번호 보유 여부 미확인 — 사업자등록증 확인 후 발행 가능."
    );
  }

  // 사업자/법인 거래 공통 optional
  optional.add("invoice");
  optional.add("receipt");
  optional.add("transactionStatement");
  optional.add("paymentConfirmation");

  // 결제 수단별 보조 권장
  if (input.paymentMethod === "card") {
    optional.add("cardReceipt");
  }
}

function deriveOverseas(
  input: FiscalDocumentDeriveInput,
  recommended: Set<FiscalDocumentType>,
  optional: Set<FiscalDocumentType>,
  flags: Set<FiscalReviewFlag>,
  notes: string[]
): void {
  // 해외 거래는 *항상* 세무 검토 필요 (사용자 spec §4)
  flags.add("overseasTaxReviewRequired");
  notes.push("해외 거래 — 세무 / 외환 / 통관 영역 회계사 확인 필요.");

  // Buyer type별 권장 문서 분기
  if (
    input.buyerType === "overseasBusiness" ||
    input.buyerType === "overseasGallery"
  ) {
    recommended.add("commercialInvoice");
    optional.add("exportInvoice");
    flags.add("exportDocumentationRequired");
    flags.add("zeroRatedVATReviewRequired");
    notes.push(
      "수출 거래 — 상업 송장 / 수출 인보이스 / 통관 증빙 / 영세율 적용 검토 필요."
    );
  } else {
    // overseasIndividual / overseasFoundation / overseasInstitution
    recommended.add("internationalInvoice");
    notes.push("해외 비-사업자 거래 — 국제 인보이스 권장.");
  }

  // 해외 거래 공통 optional
  optional.add("receipt");
  optional.add("paymentConfirmation");

  // 외화 거래 → 환율 / 외환 송금 메모
  if (input.currency && input.currency !== "KRW") {
    notes.push(
      `외화 거래 (${input.currency}) — 외환 송금 / 환율 lock 시점 회계사 확인 필요.`
    );
  }
}

function buildVATNote(handling: VATHandling): string {
  switch (handling) {
    case "vatIncluded":
      return "VAT 포함 거래 — 가격에 부가세 포함됨 (운영 참고).";
    case "vatExcluded":
      return "VAT 별도 거래 — 부가세 별도 청구 (B2B 일반).";
    case "vatExempt":
      return "면세 거래 — 부가세 적용 외 (회계사 확인 필요).";
    case "zeroRatedPossible":
      return "영세율 적용 가능 — 수출 / 외화 거래 등 회계사 검토 필요.";
    case "vatReviewRequired":
      return "VAT 분류 검토 필요 — 회계사 확인 필요.";
  }
}
