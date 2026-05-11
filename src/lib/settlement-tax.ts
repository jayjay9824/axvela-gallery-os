// ============================================================================
// settlement-tax.ts — STEP 90 Settlement Tax Derive Layer (Phase 1 Fiscal 6/6)
//
// **본 module이 무엇인가**:
//   Settlement (정산)에 *원천징수 (withholding tax)*를 derive하는 lightweight
//   helper. Settlement.netToArtist (rule_12 derive 값)에서 작가 type에 따라
//   원천징수세를 분리하여 *실 수령액*과 *원천징수세 amount*를 계산.
//
// **본 module이 *아닌* 것** (사용자 spec 정조준):
//   - full tax engine
//   - 국세청 자동 신고
//   - actual withholding remittance
//   - tax filing automation
//
// **STEP 86 anchor pattern 재사용** (사용자 명시):
//   - Pure helper, no I/O, no DOM, no store, no persistence
//   - 입력 (entity + opts) → 출력 (derive view shape)
//   - Receipt / TaxInvoice의 `deriveXxxTrust` 패턴과 동일 shape
//
// **rule_12 Settlement formula 보존**:
//   netToArtist = grossAmount - galleryCommission - expenses
//   본 STEP은 *netToArtist 다음 단계*만 추가 (rule_12 자체 변경 0건):
//   netAfterWithholding = netToArtist - withholdingTaxAmount
//
// **AI Direction §1 / Trust Layer**:
//   - 사용: "원천징수 적용 가능" / "원천징수 검토 필요" / "운영 참고"
//   - 금지: "원천징수 신고 완료" / "세무 확정" / "법적 효력 보장"
//
// **금액 단위**: 본 helper는 *Settlement entity와 동일 통화 단위*만 다룸.
//   KRW 환산 0건 (rule_20 FX Lock — Reporting / STEP 35 영역).
// ============================================================================

import type { Settlement } from "@/types/settlement";
import type { ArtistType } from "@/types/fiscal-document";

// ============================================================================
// Withholding rate — 작가 type별 원천징수율 (사용자 spec §3)
// ============================================================================

/**
 * 작가 type → 원천징수율 매핑.
 *
 * - **개인 작가** : 3.3% (3% 소득세 + 0.3% 지방소득세, 한국 일반 기준)
 * - **개인사업자 작가** : 0% (사업소득 본인 신고)
 * - **법인 작가** : 0% (법인세 본인 신고)
 * - **해외 작가** : `null` 표시 — 조세조약 / 비거주자 분류 검토 필요. 본
 *   STEP에서는 자동 적용 0건, `withholdingReviewRequired = true`로만 표시.
 *   회계사 / 세무사가 case-by-case 처리.
 *
 * NOTE: 본 비율은 *AXVELA 운영 default*. 고소득 / 특수 사례 (예: 8.8% 적용)는
 * 운영자가 manual override 가능 — 본 STEP에서는 default rate만 정착.
 */
export const SETTLEMENT_WITHHOLDING_RATE: Readonly<
  Record<ArtistType, number | null>
> = {
  individualArtist: 0.033,
  soleProprietorArtist: 0,
  corporateArtist: 0,
  overseasArtist: null,
} as const;

/** 작가 type별 원천징수 mode 한국어 라벨 (UI 표시용). */
export const SETTLEMENT_WITHHOLDING_MODE_LABEL_KR: Readonly<
  Record<ArtistType, string>
> = {
  individualArtist: "원천징수 3.3% 적용",
  soleProprietorArtist: "원천징수 미적용 (사업소득)",
  corporateArtist: "원천징수 미적용 (법인)",
  overseasArtist: "원천징수 검토 필요 (비거주자)",
} as const;

// ============================================================================
// Output shape
// ============================================================================

/**
 * Settlement Tax Breakdown — `deriveSettlementTax` 결과.
 *
 * **rule_12 일관 의미론**:
 *   - grossAmount             : Settlement.totalAmount (rule_12 입력)
 *   - galleryCommission       : Settlement.galleryShare (운영 사용 라벨)
 *   - settlementBeforeTax     : Settlement.artistShare (== netToArtist, rule_12 derive)
 *   - withholdingTax          : settlementBeforeTax × withholdingRate
 *   - netToArtist             : settlementBeforeTax - withholdingTax (실 수령액)
 *   - withholdingRate         : 작가 type별 비율 (소수점, 예: 0.033)
 *   - withholdingReviewRequired : 해외 작가 / 분류 불명확 시 true
 *
 * **사용자 spec §3 derive fields 정확 매칭**:
 *   grossAmount / galleryCommission / settlementBeforeTax / withholdingTax /
 *   netToArtist / withholdingRate / withholdingReviewRequired
 */
export interface SettlementTaxBreakdown {
  /** 거래 총액 (= Settlement.totalAmount). */
  grossAmount: number;
  /** 갤러리 수수료 (= Settlement.galleryShare). */
  galleryCommission: number;
  /**
   * 원천징수 *전* 작가 정산 amount (= Settlement.artistShare). rule_12 의미론
   * 그대로 — `netToArtist == artistShare` (v1: expenses 미모델링).
   */
  settlementBeforeTax: number;
  /**
   * 원천징수세 amount. 자동 적용된 경우 `Math.round(settlementBeforeTax × rate)`,
   * `withholdingReviewRequired = true`인 경우 0 (회계사 결정 전).
   */
  withholdingTax: number;
  /**
   * 작가가 실제 수령하는 amount = settlementBeforeTax - withholdingTax.
   * `withholdingReviewRequired = true`인 경우 settlementBeforeTax와 동일
   * (검토 후 조정 가능).
   */
  netToArtist: number;
  /**
   * 적용된 원천징수율 (소수점, 예: 0.033 = 3.3%). 검토 필요 케이스
   * (해외 작가)에서는 0.
   */
  withholdingRate: number;
  /**
   * 회계사 / 세무사 검토 필요 여부. 해외 작가 (비거주자) 또는 분류 불명확
   * 케이스에서 true. 본 STEP에서는 자동 결정 — UI는 review badge로 표시.
   */
  withholdingReviewRequired: boolean;
  /** 작가 type 그대로 (drawer 표시 / export column에서 mirror 용). */
  artistType: ArtistType;
  /** Settlement.currency 그대로 (rule_20 FX Lock 보존). */
  currency: Settlement["currency"];
}

// ============================================================================
// deriveSettlementTax — pure helper (사용자 spec §5 helper 정조준)
// ============================================================================

/**
 * Settlement → SettlementTaxBreakdown projection.
 *
 * Pure / no I/O / no store / no DOM / no persistence — STEP 86 anchor pattern
 * 정확 답습 (Receipt `deriveReceiptTrust` / TaxInvoice `deriveTaxInvoiceTrust`
 * 와 동일 shape).
 *
 * **결정 흐름**:
 *   1. SETTLEMENT_WITHHOLDING_RATE[artistType] 조회
 *   2. rate === null → review required, withholding 자동 적용 0
 *   3. rate === 0 → 적용 없음, settlementBeforeTax 그대로 netToArtist
 *   4. rate > 0 → withholdingTax = round(settlementBeforeTax × rate)
 *
 * **사용자 spec §3 \"derive fields\" 7개 모두 출력**.
 *
 * **rule_3 보존**: Money flow 도메인 *분리*. 본 helper는 *Settlement 안에서만*
 * 분리 — 다른 도메인 (Tax / Invoice / Payment)과 합산 0건.
 *
 * @param settlement  Settlement entity (rule_12 derive 값 보유)
 * @param artistType  작가 분류. 미지정 시 "individualArtist" 기본 (한국 갤러리
 *                    가장 일반 케이스 — 사용자 spec §3 default)
 *
 * @example
 *   // 개인 작가 정산: 1,000,000원 거래, 60% 작가 share
 *   const breakdown = deriveSettlementTax(settlement, "individualArtist");
 *   // → { grossAmount: 1000000, galleryCommission: 400000,
 *   //     settlementBeforeTax: 600000, withholdingTax: 19800,
 *   //     netToArtist: 580200, withholdingRate: 0.033,
 *   //     withholdingReviewRequired: false, artistType, currency }
 *
 * @example
 *   // 해외 작가: 자동 적용 0, 검토 필요 표시만
 *   const breakdown = deriveSettlementTax(settlement, "overseasArtist");
 *   // → { ... withholdingTax: 0, netToArtist: settlementBeforeTax (그대로),
 *   //     withholdingRate: 0, withholdingReviewRequired: true, ... }
 */
export function deriveSettlementTax(
  settlement: Settlement,
  artistType: ArtistType = "individualArtist"
): SettlementTaxBreakdown {
  const grossAmount = settlement.totalAmount;
  const galleryCommission = settlement.galleryShare;
  const settlementBeforeTax = settlement.artistShare;

  const rateRaw = SETTLEMENT_WITHHOLDING_RATE[artistType];
  const reviewRequired = rateRaw === null;
  const rate = rateRaw ?? 0;

  // 검토 필요 케이스: 자동 withholding 0, settlementBeforeTax 그대로 net
  // (회계사 case-by-case 결정 후 조정)
  const withholdingTax = reviewRequired
    ? 0
    : Math.round(settlementBeforeTax * rate);
  const netToArtist = settlementBeforeTax - withholdingTax;

  return {
    grossAmount,
    galleryCommission,
    settlementBeforeTax,
    withholdingTax,
    netToArtist,
    withholdingRate: rate,
    withholdingReviewRequired: reviewRequired,
    artistType,
    currency: settlement.currency,
  };
}

// ============================================================================
// formatWithholdingNote — UI helper (premium minimalism, AI Direction 정합)
// ============================================================================

/**
 * SettlementTaxBreakdown → 운영자에게 표시할 *한 줄 요약* 한국어 문자열.
 *
 * 사용 표현: "원천징수 N.N% 적용 / 미적용 / 검토 필요" (AI Direction §1).
 * 금지 표현 0건 — "신고 완료" / "확정" / "법적 효력" 사용 0건.
 */
export function formatWithholdingNote(breakdown: SettlementTaxBreakdown): string {
  if (breakdown.withholdingReviewRequired) {
    return "원천징수 검토 필요 (회계사 확인 필요)";
  }
  if (breakdown.withholdingRate === 0) {
    return SETTLEMENT_WITHHOLDING_MODE_LABEL_KR[breakdown.artistType];
  }
  const pct = Math.round(breakdown.withholdingRate * 1000) / 10; // 0.033 → 3.3
  return `원천징수 ${pct}% 적용`;
}
