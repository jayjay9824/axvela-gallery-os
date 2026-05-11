// ============================================================================
// Customer — STEP 42 (Customer / Collector Domain Promotion).
//
// AXVELA Gallery OS의 1급 도메인 entity. 갤러리 운영자가 한 인물(매수자 /
// 문의자)을 작품 단위가 아닌 인물 단위로 인지하기 위한 단일 모델.
//
// **데이터 정책 — 사용자 spec 준수:**
//   - 신규 store slice 0개 (Persistence 구조 변경 금지)
//   - 새 핵심 계산 로직 0개 (Money Flow / Settlement / Tax / FX 무수정)
//   - Single source of truth는 여전히 Inquiry.collectorName + Transaction.buyerName
//   - Customer는 customer-aggregates.ts의 deriveCustomers() 결과로 view 시점에
//     동적 derive — 즉, type/도메인 위치는 1급, 데이터는 read-only aggregation
//
// **Inquiry / Transaction과의 관계 (rule_1 + rule_11):**
//   Artwork ─┬→ Inquiry (collectorName) ─┐
//            └→ Transaction (buyerName) ─┴→ Customer (derived)
//   Customer는 Artwork 흐름의 *결과 view*이며, Artwork-First 원칙은 보존됨.
//
// **표현 정책 (사용자 spec):**
//   - "확정 고객 등급" / "VIP" / "골드/실버" / "블루칩" / "평점" 표현 금지
//   - "운영 참고 신호" / "운영 참고 segment" 사용
//   - kind / segment / signals 모두 휴리스틱 derive 결과 — 영구 마스터 데이터 아님
// ============================================================================

import type { InquirySource } from "./inquiry";

/**
 * Customer의 활동 패턴 분류. 거래 / 문의 카운트 기반 단순 휴리스틱.
 *
 * - FIRST_TIME    문의 1+ / 거래 0 (휴면 문의 포함)
 * - ACTIVE_LEAD   문의 1+ / 거래 0 / 진행 중 inquiry 1+ (응대 진행 중)
 * - RETURNING     거래 1+ (구매 경험 있음)
 *
 * `ACTIVE_LEAD`와 `FIRST_TIME`은 거래 0건 동일하지만 진행 중 응대 여부로 구분.
 * 거래 1건 이상이면 진행 중 inquiry 여부와 무관하게 RETURNING.
 */
export type CustomerKind = "FIRST_TIME" | "ACTIVE_LEAD" | "RETURNING";

/**
 * 운영 참고 segment. 거래 횟수 + 활동 시점 기반.
 *
 * - PROSPECT          거래 0건 (문의만)
 * - ONE_TIME_BUYER    거래 1건
 * - REPEAT_BUYER      거래 2건 이상 (STEP 41의 "Collector" 의미와 가장 가까움)
 * - DORMANT           마지막 활동 90일 이상 경과 (위 세 segment에 직교 적용)
 *
 * `DORMANT`는 PROSPECT/ONE_TIME/REPEAT 위에 덮어쓰지 않고 별도 신호로 표현될
 * 수도 있으나, v1은 단일 segment 라벨로 통일 (활동성이 우선 판단 기준).
 */
export type CustomerSegment =
  | "PROSPECT"
  | "ONE_TIME_BUYER"
  | "REPEAT_BUYER"
  | "DORMANT";

/**
 * 운영 참고 신호. 한 customer가 여러 신호를 동시에 가질 수 있음.
 * STEP 41의 CollectorSignal 4종을 그대로 계승 (호환).
 *
 * - MULTI_DEAL        거래 2건 이상 (재구매 가능성)
 * - ACTIVE_INQUIRY    진행 중 inquiry 1+ (응대 필요)
 * - RECENT_ACTIVITY   마지막 활동 30일 이내 (활성 컨택)
 * - HIGH_VALUE        누적 매입액 ₩100M 이상 (대규모 매수)
 *
 * 모두 휴리스틱 — 확정 등급 아님.
 */
export type CustomerSignal =
  | "MULTI_DEAL"
  | "ACTIVE_INQUIRY"
  | "RECENT_ACTIVITY"
  | "HIGH_VALUE";

/**
 * Customer 1급 entity. View 시점에 derive되는 read-only 객체.
 *
 * 식별 정책 (`id`):
 *   - `name (lowercase trim)` 기반 hash
 *   - 동명이인 분리는 v1에서 미지원 (mock data 단순화) — STEP 41 정책 계승
 *   - `id`는 deterministic — 같은 입력 → 같은 id (audit / link 안정성)
 */
export interface Customer {
  /** 안정 식별자 — name lowercase trim. */
  id: string;
  /** 표시 이름. */
  displayName: string;

  /** 가장 자주 등장한 contact (email/phone). 부재 시 빈 문자열. */
  primaryContact: string;
  /** 등장한 모든 contact (dedup). primaryContact 포함. */
  allContacts: string[];

  // -------- Activity refs --------
  /** 본 customer가 등장한 inquiry id 목록 (artwork-keyed slice flatten 결과). */
  inquiryIds: string[];
  /** 본 customer가 등장한 transaction id 목록. */
  transactionIds: string[];
  /** 본 customer가 buyer였던 작품 id 목록 (transaction 기준 unique). */
  ownedArtworkIds: string[];

  // -------- Aggregated metrics --------
  /** 누적 매입 KRW. KRW 거래 직접합 + 외화는 invoice fxSnapshot 환산. */
  totalPurchaseKRW: number;
  /** 누적 매입 KRW에 환산되지 못한 거래 수 (fxSnapshot 부재). */
  missingFxCount: number;
  /** 진행 중 inquiry 카운트 (OPEN / RESPONDED / ESCALATED). */
  activeInquiryCount: number;
  /** 진행 중 transaction 카운트 (NEGOTIATING / AGREED). */
  activeTransactionCount: number;

  // -------- Time --------
  /**
   * 첫 활동 시각 ISO. inquiry/transaction의 createdAt 중 가장 오래된 것.
   * 없으면 빈 문자열.
   * (STEP 41의 Collector에는 부재 — STEP 42 신규 필드)
   */
  firstInteractionAt: string;
  /** 마지막 활동 시각 ISO. inquiry/transaction의 createdAt/updatedAt 중 가장 최근. */
  lastInteractionAt: string;

  // -------- Channel intelligence (운영 참고) --------
  /** 가장 자주 등장한 inquiry 출처. inquiry 0건이면 undefined. */
  primarySource?: InquirySource;
  /** 출처별 카운트 — InquirySource 키. inquiry 0건이면 빈 객체. */
  channelMix: Partial<Record<InquirySource, number>>;

  // -------- Segmentation (운영 참고) --------
  /** 활동 패턴 분류 (휴리스틱 derive). */
  kind: CustomerKind;
  /** 운영 참고 segment 라벨 (휴리스틱 derive). */
  segment: CustomerSegment;
  /** 동시 부여 가능한 운영 참고 신호. */
  signals: CustomerSignal[];
}
