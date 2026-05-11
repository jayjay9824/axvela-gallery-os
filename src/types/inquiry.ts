// ============================================================================
// Inquiry — the operational beginning of a Transaction (rule_11).
// Belongs to one Artwork (rule_1, Artwork = SSOT).
// ============================================================================

import type { ContactInfo } from "./contact";

/**
 * Inquiry lifecycle.
 * - OPEN       문의 접수, 응대 대기
 * - RESPONDED  1차 응대 완료 (메일/전화 등)
 * - ON_HOLD    보류 (추가 의사 결정 대기)
 * - ESCALATED  매니저 검토 필요
 * - CLOSED     종결 (거래로 진행되었거나 무산)
 */
export type InquiryStatus =
  | "OPEN"
  | "RESPONDED"
  | "ON_HOLD"
  | "ESCALATED"
  | "CLOSED";

/**
 * Where the inquiry came from. Useful for attribution / channel analysis.
 */
export type InquirySource =
  | "WEBSITE"        // 웹사이트
  | "EMAIL"          // 이메일
  | "SHOWROOM"       // 갤러리 방문
  | "ART_FAIR"       // 아트페어
  | "REFERRAL"       // 소개
  | "COLLECTOR_VIEW" // Collector View 공유 링크
  | "OTHER";         // 기타

/**
 * Nature of the inquiry — drives suggested response templates and routing.
 */
export type InquiryType =
  | "PRICE"          // 가격 문의
  | "AVAILABILITY"   // 가용성 문의
  | "VIEWING"        // 실견 요청
  | "DOCUMENTATION"  // 도큐먼트 요청 (Condition Report 등)
  | "GENERAL"        // 일반 문의
  | "RESALE";        // 재판매 — startResale()이 자동 생성하는 표식 (rule_13)

export interface Inquiry {
  id: string;
  artworkId: string;
  /** Collector identity — may be empty for auto-created inquiries pending intake. */
  collectorName: string;
  /**
   * @deprecated STEP 115 — 새 코드는 `contactInfo` (ContactInfo struct) 사용 권장.
   *
   * 기존: free-form email/phone 단일 string ("collector@example.com" 또는
   * "010-1234-5678" 등). 본 field 는 backward compat 보장을 위해 *required 유지* —
   * persistence v1 schema 변경 0줄, 기존 데이터 모두 자연 호환.
   *
   * 신규 데이터 입력 시 `contactInfo.email` + `contactInfo.phone` 분리 권장
   * (구조화 + future-ready). UI 전환은 STEP 118 Tabs 영역.
   */
  contact: string;

  /**
   * STEP 115 — Collector contact channel 정보 (future-ready 구조).
   *
   * **Optional slot — backward compat 보장**:
   *   - validateV1 / SCHEMA_VERSION "v1" 변경 0줄
   *   - 기존 inquiry (contactInfo 부재) 자동 호환 (undefined fallback)
   *   - 모든 sub-field 도 optional → empty `{}` 도 valid
   *
   * **Identity 분리**: 본 slot 은 *contact channel* 만 담당. 이름은 위
   * `collectorName` field 가 담당 — backward compat + dimension separation.
   *
   * **Spec source**: AXVELA_WORKFLOW_ARCHITECTURE.md §3.1 + 사용자 spec STEP 115 #7.
   */
  contactInfo?: ContactInfo;
  inquiryType: InquiryType;
  /** Original message from the collector. */
  message: string;
  source: InquirySource;
  status: InquiryStatus;
  /** Internal note — not visible to the collector. */
  memo?: string;
  /**
   * Reverse pointer to the Transaction this Inquiry seeded (rule_13.5 sync).
   * Set automatically by the store when an Inquiry produces a Transaction
   * (INQUIRY→DEAL cascade) or when a Transaction's resale auto-creates a
   * RESALE Inquiry. Optional — historical inquiries pre-dating the sync
   * layer may leave it undefined; the buyer-sync code is no-op in that case.
   *
   * Single source of truth for tx↔inquiry pairing remains Transaction.inquiryId.
   * This field is a cached forward-pointer for O(1) sync lookup.
   */
  transactionId?: string;

  // --- AI Response Layer (STEP 16, rule_5 + rule_18) -----------------------
  // 단순 응답 모델: DRAFT(편집 가능) → SENT(immutable). Contract 같은 version
  // chain은 두지 않음 — Inquiry 응답은 한 번 발송되면 끝나는 단일 텍스트이며,
  // 재응대 필요 시 별도 Inquiry 또는 memo를 통해 처리.

  /**
   * AI 응대 초안 / 발송 본문. responseStatus가 "SENT"이면 발송된 영구 기록.
   * undefined = 아직 응대 시작 안 함.
   */
  responseDraft?: string;
  /**
   * 응대 lifecycle. undefined = 응대 미생성. DRAFT = AI 초안 생성 후 편집 중.
   * SENT = 발송 완료 (immutable, rule_4).
   */
  responseStatus?: "DRAFT" | "SENT";
  /** AI가 초안을 마지막으로 생성/재생성한 시각. */
  responseGeneratedAt?: string;
  /** 인간이 발송 처리를 완료한 시각. SENT 상태에서만 의미 있음. */
  respondedAt?: string;

  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}
