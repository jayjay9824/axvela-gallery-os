// ============================================================================
// AXVELA — Contact Information Type Foundation (STEP 115)
// ============================================================================
//
// **본 모듈의 정체**:
//   Collector / Customer / Buyer 의 *contact channel* 정보를 담는 future-ready
//   struct 정착. Inquiry / Transaction / Customer 등 여러 entity 가 미래에
//   자연 합류 가능한 *별도 type*.
//
//   사용자 spec STEP 115 (#7 Contact Structure Refactor) 정확 매칭.
//
// **본 모듈이 *아닌* 것**:
//   - Identity record (이름은 entity 별 own field — `Inquiry.collectorName` /
//     `Transaction.buyerName` / `Customer.displayName` 그대로 보존)
//   - Validation engine (email regex / phone format 등은 future STEP — v1 free-form)
//   - Persistence slice (별도 store 0건, validateV1 무영향)
//
// **Why separate type**:
//   사용자 spec "future-ready 구조" 강조 — 별도 `ContactInfo` 로 분리하면
//   미래 다음 entity 들도 자연 합류 가능:
//     ContactInfo
//       ├── Inquiry.contactInfo?          ← 본 STEP 합류
//       ├── Transaction.buyerContactInfo? (미래 STEP)
//       ├── Customer.contactInfo?         (미래 — derive 합류)
//       └── 확장 가능
//
// **Phase 4 §4 Implementation Constraints 정합**:
//   §4.1 Additive only           ✓  신규 type
//   §4.2 Optional slot priority   ✓  모든 field optional, contactInfo 자체도 optional
//   §4.3 No persistence migration ✓  validateV1 / SCHEMA_VERSION 변경 0줄
//   §4.5 Backward compat          ✓  기존 Inquiry.contact: string 보존 (deprecated marker)
//
// **외부 라이브러리 0개** — pure TypeScript types + record + simple guards.
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Preferred Contact Method — 보수적 v1 union
// ----------------------------------------------------------------------------

/**
 * 선호 연락 수단. v1 은 사용자 spec 명시 2개로 시작 (email / phone).
 *
 * 미래 확장 후보 (실제 운영 need 명시 시 추가):
 *   - "messenger"  카카오톡 / WhatsApp / WeChat 등
 *   - "in_person"  대면
 *   - "post"       우편 (institutional collector)
 */
export type PreferredContactMethod = "email" | "phone";

export const PREFERRED_CONTACT_METHODS: readonly PreferredContactMethod[] = [
  "email",
  "phone",
] as const;

// ----------------------------------------------------------------------------
// 2. ContactInfo struct — 7 optional fields (모두 future-ready)
// ----------------------------------------------------------------------------

/**
 * Collector / Customer 의 contact channel 정보.
 *
 * 모든 field 가 *optional* — 운영 현실에서 일부만 보유한 contact 도 정상 case.
 * empty `{}` 도 valid (사용자가 contactInfo 객체는 만들었으나 아직 입력 전).
 *
 * 사용자 spec STEP 115 7 항목 정확 매칭:
 *   - Email
 *   - Phone Number
 *   - Institution
 *   - Preferred Contact Method
 *   - Internal Notes
 *   - Timezone
 *
 * **Identity 분리**: 본 struct 는 *contact channel* 만 담당. 이름 (collectorName /
 * buyerName / displayName) 은 entity 별 own field 로 보존 — backward compat
 * 보장 + dimension 분리 명확.
 */
export interface ContactInfo {
  /**
   * Email address. v1 은 free-form string (regex validation 은 future STEP).
   * 운영 reality: 외국식 alias / institutional alias 다양 — strict validation 보류.
   */
  email?: string;

  /**
   * Phone number. v1 은 free-form (E.164 / 국가별 format 모두 허용).
   * 예: "+82-10-1234-5678" / "010-1234-5678" / "+1 (212) 555-0100"
   */
  phone?: string;

  /**
   * 소속 기관 / 미술관 / 컬렉션. institutional collector 식별.
   * 예: "리움미술관" / "Tate Modern" / "삼성문화재단".
   */
  institution?: string;

  /**
   * 선호 연락 수단. 운영자가 사용자 응답 받기 가장 좋은 채널 명시.
   * v1 enum 은 PreferredContactMethod ("email" | "phone").
   */
  preferredContactMethod?: PreferredContactMethod;

  /**
   * 내부 운영 메모. **collector 에게 절대 노출 안됨**.
   * 예: "VIP 응대 — 작품 도착 즉시 직접 연락" / "동일 inquiry 2건 통합 처리".
   */
  internalNotes?: string;

  /**
   * IANA timezone identifier (예: "Asia/Seoul" / "America/New_York" / "Europe/London").
   * 국제 collector 응대 시점 결정 보조.
   * v1 free-form — strict validation 은 future STEP.
   */
  timezone?: string;
}

// ----------------------------------------------------------------------------
// 3. Display Labels — Korean (gallery internal)
// ----------------------------------------------------------------------------

export const PREFERRED_CONTACT_METHOD_LABEL_KR: Record<
  PreferredContactMethod,
  string
> = {
  email: "이메일",
  phone: "전화",
};

// ----------------------------------------------------------------------------
// 4. Display Labels — English (international)
// ----------------------------------------------------------------------------

export const PREFERRED_CONTACT_METHOD_LABEL_EN: Record<
  PreferredContactMethod,
  string
> = {
  email: "Email",
  phone: "Phone",
};

// ----------------------------------------------------------------------------
// 5. Type Guards — external input validation
// ----------------------------------------------------------------------------

/**
 * `PreferredContactMethod` 외부 input (URL / form / persisted state) 진입 시 검증.
 *
 * 정확 매칭 (대소문자 sensitive) — "Email" / "EMAIL" 모두 reject.
 */
export const isPreferredContactMethod = (
  value: unknown,
): value is PreferredContactMethod =>
  typeof value === "string" &&
  (PREFERRED_CONTACT_METHODS as readonly string[]).includes(value);

/**
 * `ContactInfo` runtime shape 검증.
 *
 * 정의: object (not null / array / primitive) + 알려진 field 들이 정의된 경우
 * 올바른 type 보유. 알려지지 않은 field 는 무시 (forward-compat 친화).
 *
 * empty `{}` 도 valid (모든 field optional).
 */
export const isContactInfo = (value: unknown): value is ContactInfo => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;

  // 각 알려진 field 가 *정의되어 있다면* 올바른 type 인지 확인
  if (v.email !== undefined && typeof v.email !== "string") return false;
  if (v.phone !== undefined && typeof v.phone !== "string") return false;
  if (v.institution !== undefined && typeof v.institution !== "string")
    return false;
  if (
    v.preferredContactMethod !== undefined &&
    !isPreferredContactMethod(v.preferredContactMethod)
  ) {
    return false;
  }
  if (v.internalNotes !== undefined && typeof v.internalNotes !== "string")
    return false;
  if (v.timezone !== undefined && typeof v.timezone !== "string") return false;

  return true;
};
