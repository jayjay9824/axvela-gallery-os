// ============================================================================
// Settlement — internal money distribution (rule_3, rule_12).
//
// Settlement ≠ Payment. Money flow separation:
//   - Payment    = 고객이 갤러리에 입금 (외부 → 내부)
//   - Settlement = 갤러리가 작가/파트너에게 분배 (내부 → 내부)
//
// One Settlement belongs to one Transaction (rule_11). totalAmount is the
// sum of received Payments for that Transaction; the breakdown follows the
// gallery's commission policy. v1 uses a hardcoded 60/40 artist/gallery
// split — promoted to a configurable policy in a later step.
//
// netToArtist == artistShare (rule_12: net = gross − commission − expenses;
// expenses are not modelled in v1, so net == artistShare directly).
//
// FX reference (STEP 34 — rule_20):
//   외화 거래의 경우 Settlement는 Invoice.fxSnapshot을 read-only 참조하여
//   KRW 환산 정보를 함께 보관. fxSnapshot 자체는 복사하지 않고 (Invoice가
//   single source of truth) reference id + rate 메타만 spread. KRW 거래는
//   모든 fx* 필드 undefined (기존 v1 동작 그대로).
// ============================================================================

import type { Currency } from "./transaction";

/**
 * Settlement lifecycle.
 * - PENDING    대기 중   — 자동 생성 직후, 검토 전
 * - READY      준비 완료 — 분배액 검토 완료, 송금 실행 대기 (v1 UI 미노출, forward-compat)
 * - COMPLETED  정산 완료 — 작가·파트너 송금 완료, immutable
 */
export type SettlementStatus = "PENDING" | "READY" | "COMPLETED";

export interface Settlement {
  id: string;
  transactionId: string;
  /** Denormalized for direct lookup (rule_11 chain). */
  artworkId: string;

  /** Sum of received Payments for the parent Transaction at creation time. */
  totalAmount: number;
  /** Portion paid to the artist. v1 default: 60% of total. */
  artistShare: number;
  /** Portion retained by the gallery. v1 default: 40% of total. */
  galleryShare: number;
  /** Optional fee paid to a third-party platform / partner. */
  platformFee?: number;
  /** Snapshotted from Payment / Transaction at creation. */
  currency: Currency;

  status: SettlementStatus;
  /** ISO datetime when status flipped to COMPLETED. Filled by completeSettlement(). */
  settledAt?: string;

  // ── FX reference (STEP 34 — rule_20) ────────────────────────────────────
  /**
   * Invoice.fxSnapshot을 참조한 invoice의 id. KRW 거래면 undefined.
   * Settlement는 Invoice를 single source of truth로 두고 fxSnapshot을 복사하지
   * 않음 — invoice를 lookup하면 lock 시점 환율 + provider + sourceNote 등
   * 전체 metadata 재조회 가능.
   */
  fxReferenceInvoiceId?: string;
  /** 참조 invoice의 fxSnapshot.rate 복사 (read-only audit, 변경 불가). */
  fxRateUsed?: number;
  fxBaseCurrency?: Currency;
  fxQuoteCurrency?: Currency;
  /**
   * KRW 환산 총액 (Math.round(totalAmount * fxRateUsed)). 외화 거래에서
   * Settlement net 계산을 KRW 기준으로 보고할 때 사용. 정산 net 계산 자체는
   * 무수정 — 본 필드는 reporting / audit metadata.
   */
  convertedTotalKRW?: number;

  // Audit
  createdAt: string;
  updatedAt: string;
}
