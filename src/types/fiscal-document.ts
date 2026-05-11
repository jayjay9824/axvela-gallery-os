// ============================================================================
// fiscal-document.ts — STEP 90 Fiscal Document Classification Types
//
// **본 module이 무엇인가**:
//   한국 갤러리 거래에서 *어떤 fiscal document를 어떤 구매자/정산 대상에게
//   발행할지*를 분류하는 *lightweight derive layer*의 타입 정착. Buyer type /
//   Artist type / Document type / VAT handling / Issue status / Review flag의
//   6 카테고리 enum + 각 카테고리 Korean label dictionary.
//
// **본 module이 *아닌* 것** (사용자 spec 정조준):
//   - full tax engine
//   - 국세청 자동 제출
//   - actual Hometax integration
//   - cash receipt API
//   - tax invoice issuance API
//   - legal/tax final judgment
//   - multi-country tax automation
//
// **AXVELA AI Direction §1 / Trust Layer 정책 강화**:
//   - 사용 권장: "발행 가능" / "발행 권장" / "검토 필요" / "세무 확인 필요" /
//     "증빙 서류 필요" / "운영 참고"
//   - 절대 금지: "세금계산서 발행 확정" / "영세율 확정" / "세무상 문제 없음" /
//     "세무 신고 완료" / "법적 효력 보장" / "compliance verified"
//
// **rule_3 / rule_4 / rule_11 / rule_20 모두 보존**:
//   본 STEP은 *분류 typing layer*만 정착 — entity 변경 0건, store 변경 0건,
//   persistence 변경 0건. STEP 86 anchor pattern (pure types + Korean labels +
//   forward-compat dictionary)을 정확 답습.
// ============================================================================

// ============================================================================
// Buyer type — 거래 상대방 분류 (사용자 spec §1, §2, §4)
// ============================================================================

/**
 * 거래 상대방 (buyer) 분류. 국내 / 해외 + 개인 / 사업자 / 법인 / 단체 cross.
 *
 * - **국내 개인** (`domesticIndividual`) : 일반 소비자. cashReceipt /
 *   simpleReceipt / transactionMemo eligible.
 * - **국내 사업자** (`domesticBusiness`) : 사업자등록증 보유. taxInvoice 발행
 *   가능 (사업자등록번호 필수).
 * - **국내 법인** (`domesticCorporate`) : 주식회사 / 유한회사 등. taxInvoice
 *   발행 가능 + 법인 구매로 회계 처리.
 * - **국내 재단** (`domesticFoundation`) : 미술재단 / 문화재단 등. taxInvoice
 *   또는 invoice 발행 가능 (면세 사업자 가능성).
 * - **국내 단체** (`domesticOrganization`) : NGO / 협회 / 학교 등 기타 조직.
 *   taxInvoice 또는 invoice 발행 가능.
 * - **해외 개인** (`overseasIndividual`) : 국외 거주 개인. internationalInvoice.
 * - **해외 사업자** (`overseasBusiness`) : 해외 법인 / 갤러리 외 사업자.
 *   commercialInvoice / exportInvoice + zeroRated VAT 검토 가능.
 * - **해외 갤러리** (`overseasGallery`) : 해외 갤러리 (협력 / 재판매 등).
 *   commercialInvoice + 수출 증빙.
 * - **해외 재단** (`overseasFoundation`) : 해외 미술관 / 문화재단 등.
 *   internationalInvoice + 수출 증빙.
 * - **해외 기관** (`overseasInstitution`) : 해외 학술기관 / 정부기관 등.
 *   internationalInvoice + 검토 필요.
 *
 * NOTE: 본 STEP에서는 *분류*만 — buyerType이 추론되지 않는 경우 review
 * required로 표시.
 */
export type BuyerType =
  | "domesticIndividual"
  | "domesticBusiness"
  | "domesticCorporate"
  | "domesticFoundation"
  | "domesticOrganization"
  | "overseasIndividual"
  | "overseasBusiness"
  | "overseasGallery"
  | "overseasFoundation"
  | "overseasInstitution";

export const BUYER_TYPE_LABEL_KR: Readonly<Record<BuyerType, string>> = {
  domesticIndividual: "국내 개인",
  domesticBusiness: "국내 사업자",
  domesticCorporate: "국내 법인",
  domesticFoundation: "국내 재단",
  domesticOrganization: "국내 단체",
  overseasIndividual: "해외 개인",
  overseasBusiness: "해외 사업자",
  overseasGallery: "해외 갤러리",
  overseasFoundation: "해외 재단",
  overseasInstitution: "해외 기관",
} as const;

/** Helper: domestic vs overseas grouping. */
export function isOverseasBuyer(type: BuyerType): boolean {
  return type.startsWith("overseas");
}

// ============================================================================
// Artist type — 작가 정산 대상 분류 (사용자 spec §3)
// ============================================================================

/**
 * 작가 (정산 대상) 분류. 원천징수 (withholding tax) 적용 여부 결정.
 *
 * - **개인 작가** (`individualArtist`) : 사업자등록 미보유 일반 작가.
 *   *원천징수 3.3% 기본*.
 * - **개인사업자 작가** (`soleProprietorArtist`) : 사업자등록 보유 개인.
 *   세금계산서 / 사업소득 신고 본인 처리. *원천징수 0%*.
 * - **법인 작가** (`corporateArtist`) : 법인 형태로 활동 (스튜디오 등).
 *   세금계산서 발행. *원천징수 0%*.
 * - **해외 작가** (`overseasArtist`) : 비거주자 작가. 원천징수율 / 조세조약
 *   적용 / 외화 송금 등 복합 — *withholdingReviewRequired = true*.
 */
export type ArtistType =
  | "individualArtist"
  | "soleProprietorArtist"
  | "corporateArtist"
  | "overseasArtist";

export const ARTIST_TYPE_LABEL_KR: Readonly<Record<ArtistType, string>> = {
  individualArtist: "개인 작가",
  soleProprietorArtist: "개인사업자 작가",
  corporateArtist: "법인 작가",
  overseasArtist: "해외 작가",
} as const;

// ============================================================================
// Fiscal document type — 발행 가능 문서 분류
// ============================================================================

/**
 * 거래 시점에 발행 가능 / 권장되는 fiscal document type.
 *
 * **국내 개인 그룹** (사용자 spec §1):
 *   - `cashReceipt`        현금영수증 (cash payment / 고액 현금)
 *   - `cardReceipt`        카드 영수증 (card payment)
 *   - `simpleReceipt`      간이 영수증
 *   - `transactionMemo`    거래 메모 / 비공식 record
 *
 * **국내 사업자/법인 그룹** (사용자 spec §2):
 *   - `taxInvoice`         세금계산서 (사업자등록번호 필수)
 *   - `invoice`            인보이스 (일반 청구서)
 *   - `receipt`            영수증 (수령 확인)
 *   - `transactionStatement` 거래 명세서
 *   - `paymentConfirmation`  지급 확인서
 *
 * **해외 거래 그룹** (사용자 spec §4):
 *   - `internationalInvoice` 국제 인보이스
 *   - `commercialInvoice`    상업 송장 (수출 / 통관용)
 *   - `exportInvoice`        수출 인보이스
 *   (`receipt` / `paymentConfirmation` 공유 가능)
 */
export type FiscalDocumentType =
  // Domestic individual
  | "cashReceipt"
  | "cardReceipt"
  | "simpleReceipt"
  | "transactionMemo"
  // Domestic business / corporate / foundation / organization
  | "taxInvoice"
  | "invoice"
  | "receipt"
  | "transactionStatement"
  | "paymentConfirmation"
  // Overseas
  | "internationalInvoice"
  | "commercialInvoice"
  | "exportInvoice";

export const FISCAL_DOCUMENT_TYPE_LABEL_KR: Readonly<
  Record<FiscalDocumentType, string>
> = {
  cashReceipt: "현금영수증",
  cardReceipt: "카드 영수증",
  simpleReceipt: "간이 영수증",
  transactionMemo: "거래 메모",
  taxInvoice: "세금계산서",
  invoice: "인보이스",
  receipt: "영수증",
  transactionStatement: "거래 명세서",
  paymentConfirmation: "지급 확인서",
  internationalInvoice: "국제 인보이스",
  commercialInvoice: "상업 송장",
  exportInvoice: "수출 인보이스",
} as const;

// ============================================================================
// VAT handling — 부가가치세 처리 (사용자 spec §5)
// ============================================================================

/**
 * VAT 처리 분류. 본 STEP에서는 *분류 + flag*만 — 실제 VAT 계산은 derive 결과의
 * note로만 표시 (사용자 spec §5: "초기에는 계산을 너무 복잡하게 하지 말고...").
 *
 * - `vatIncluded`         가격에 VAT 포함 (한국 retail 표준)
 * - `vatExcluded`         VAT 별도 (B2B 표기 일반)
 * - `vatExempt`           면세 (미술품 일부 / 면세 사업자)
 * - `zeroRatedPossible`   영세율 적용 가능성 — *검토 필요*
 * - `vatReviewRequired`   분류 불명확 — 회계사 확인 필요
 */
export type VATHandling =
  | "vatIncluded"
  | "vatExcluded"
  | "vatExempt"
  | "zeroRatedPossible"
  | "vatReviewRequired";

export const VAT_HANDLING_LABEL_KR: Readonly<Record<VATHandling, string>> = {
  vatIncluded: "VAT 포함",
  vatExcluded: "VAT 별도",
  vatExempt: "면세",
  zeroRatedPossible: "영세율 적용 가능 (검토 필요)",
  vatReviewRequired: "VAT 분류 검토 필요",
} as const;

// ============================================================================
// Document Issue Status — 문서 발행 진행 상태
// ============================================================================

/**
 * 모든 fiscal document가 가질 수 있는 진행 상태 (사용자 spec).
 *
 * - `notRequired`        본 거래에 본 문서 발행 *불필요*
 * - `recommended`        발행 *권장* (eligible + 운영 흐름상 적절)
 * - `readyToIssue`       발행 *준비 완료* (필수 필드 모두 채워짐)
 * - `issued`             발행 *완료* (실 발행됨, AXVELA OS 안 / 외)
 * - `reissueRequired`    *재발행 필요* (정정 / 오류 등)
 * - `cancelled`          *취소* (발행 후 무효 처리)
 * - `reviewRequired`     *검토 필요* (회계사 / 세무사 확인 필요)
 *
 * NOTE: STEP 90에서는 *상태 enum + 한국어 라벨*만 정착. 실제 상태 transition
 * 로직 / persistence 0줄 (사용자 spec "derive layer까지만").
 */
export type FiscalDocumentIssueStatus =
  | "notRequired"
  | "recommended"
  | "readyToIssue"
  | "issued"
  | "reissueRequired"
  | "cancelled"
  | "reviewRequired";

export const FISCAL_DOCUMENT_ISSUE_STATUS_LABEL_KR: Readonly<
  Record<FiscalDocumentIssueStatus, string>
> = {
  notRequired: "발행 불필요",
  recommended: "발행 권장",
  readyToIssue: "발행 준비 완료",
  issued: "발행 완료",
  reissueRequired: "재발행 필요",
  cancelled: "취소",
  reviewRequired: "검토 필요",
} as const;

// ============================================================================
// Review Flag — 회계사/세무사 확인 필요 항목 (사용자 spec)
// ============================================================================

/**
 * 거래에서 *운영 참고 / 회계 확인이 필요한* 항목 분류. 본 flag는 *경고*가 아닌
 * *체크리스트* — 운영자가 회계사 / 세무 담당자에게 전달 시 미리 인지하는 용도.
 *
 * - `cashReceiptRecommended`         현금영수증 발행 권장 (현금 + 일정 금액 이상)
 * - `taxInvoiceEligible`             세금계산서 발행 가능 (사업자등록번호 보유)
 * - `vatReviewRequired`              VAT 분류 회계 확인 필요
 * - `zeroRatedVATReviewRequired`     영세율 적용 검토 필요 (수출 거래)
 * - `overseasTaxReviewRequired`      해외 거래 세무 검토 필요
 * - `withholdingReviewRequired`      원천징수 검토 필요 (해외 작가 등)
 * - `businessRegistrationMissing`    사업자등록번호 누락 — 세금계산서 발행 차단
 * - `buyerIdentityMissing`           구매자 식별정보 누락 — 모든 영수증 발행 차단
 * - `exportDocumentationRequired`    수출 증빙 서류 필요 (통관 / 송금 등)
 */
export type FiscalReviewFlag =
  | "cashReceiptRecommended"
  | "taxInvoiceEligible"
  | "vatReviewRequired"
  | "zeroRatedVATReviewRequired"
  | "overseasTaxReviewRequired"
  | "withholdingReviewRequired"
  | "businessRegistrationMissing"
  | "buyerIdentityMissing"
  | "exportDocumentationRequired";

export const FISCAL_REVIEW_FLAG_LABEL_KR: Readonly<
  Record<FiscalReviewFlag, string>
> = {
  cashReceiptRecommended: "현금영수증 발행 권장",
  taxInvoiceEligible: "세금계산서 발행 가능",
  vatReviewRequired: "VAT 분류 검토 필요",
  zeroRatedVATReviewRequired: "영세율 적용 검토 필요",
  overseasTaxReviewRequired: "해외 거래 세무 확인 필요",
  withholdingReviewRequired: "원천징수 검토 필요",
  businessRegistrationMissing: "사업자등록번호 누락",
  buyerIdentityMissing: "구매자 식별정보 누락",
  exportDocumentationRequired: "수출 증빙 서류 필요",
} as const;

// ============================================================================
// Payment method (subset for derive helper) — 거래 결제 수단
// ============================================================================

/**
 * 결제 수단 — derive helper의 입력. AXVELA의 기존 `PaymentMethod`와 일관 + 본
 * STEP의 분류 로직에 직접 사용되는 4-tier subset.
 *
 * - `cash`     현금 — cashReceipt eligibility trigger
 * - `card`     카드 — cardReceipt 자연 매핑
 * - `transfer` 계좌이체 — transactionMemo / receipt 자연 매핑
 * - `other`    기타 — review 필요 가능성
 */
export type FiscalPaymentMethod = "cash" | "card" | "transfer" | "other";

export const FISCAL_PAYMENT_METHOD_LABEL_KR: Readonly<
  Record<FiscalPaymentMethod, string>
> = {
  cash: "현금",
  card: "카드",
  transfer: "계좌이체",
  other: "기타",
} as const;

// ============================================================================
// High-value cash threshold — 현금영수증 의무 발행 임계점
// ============================================================================

/**
 * *운영 참고 임계점*. 한국 현행 기준 거래 1건 10만원 이상 현금 결제 시 사업자가
 * 현금영수증 발행 *의무*. 본 STEP에서는 *권장* level — `cashReceiptRecommended`
 * flag trigger.
 *
 * 본 임계점은 운영 참고 default — 실제 의무 기준은 회계사 확인 필요. AXVELA는
 * *법적 확정*하지 않음.
 */
export const CASH_RECEIPT_HIGH_VALUE_THRESHOLD_KRW = 100_000;
