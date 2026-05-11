// ============================================================================
// contact.scenarios.ts — STEP 115 Test Scenarios
//
// **본 module 의 정체**:
//   STEP 115 ContactInfo type foundation 의 6-scenario 검증.
//   self-runnable scenario module — DOC-2 §4 신규 라이브러리 금지 준수.
//
// **검증 영역**:
//   §1 Empty ContactInfo               — 모든 field optional, `{}` 도 valid
//   §2 KR label coverage               — 2 keys non-empty
//   §3 EN label coverage               — 2 keys non-empty
//   §4 isPreferredContactMethod        — accepts/rejects 정확
//   §5 isContactInfo                   — runtime shape 검증 (valid + invalid)
//   §6 Inquiry persistence v1 forward compat
//                                       — inquiry without contactInfo 자연 호환
// ============================================================================

import type { Inquiry } from "@/types/inquiry";
import {
  type ContactInfo,
  type PreferredContactMethod,
  PREFERRED_CONTACT_METHODS,
  PREFERRED_CONTACT_METHOD_LABEL_KR,
  PREFERRED_CONTACT_METHOD_LABEL_EN,
  isPreferredContactMethod,
  isContactInfo,
} from "@/types/contact";

// ============================================================================
// Tiny assert helpers
// ============================================================================

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactAssertionError";
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      `[${label}] expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
    );
  }
}

function assertTrue(cond: boolean, label: string): void {
  if (!cond) throw new AssertionError(`[${label}] expected true`);
}

function assertFalse(cond: boolean, label: string): void {
  if (cond) throw new AssertionError(`[${label}] expected false`);
}

// ============================================================================
// Scenario shape
// ============================================================================

interface ContactScenario {
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

export const SCENARIOS: readonly ContactScenario[] = [
  // ─────────────────────────────────────────────────────────────────────
  // §1 Empty ContactInfo — 모든 field optional 검증
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 1,
    label: "empty ContactInfo {} is valid",
    description:
      "ContactInfo 의 모든 field 는 optional — empty object 도 isContactInfo 통과",
    run: () => {
      const empty: ContactInfo = {};
      assertTrue(isContactInfo(empty), "scenario1.empty_passes");
      // partial 도 valid
      const partial: ContactInfo = { email: "collector@example.com" };
      assertTrue(isContactInfo(partial), "scenario1.partial_email_passes");
      const onlyPhone: ContactInfo = { phone: "+82-10-1234-5678" };
      assertTrue(isContactInfo(onlyPhone), "scenario1.partial_phone_passes");
      // full 도 valid
      const full: ContactInfo = {
        email: "c@example.com",
        phone: "+82-10-1234-5678",
        institution: "리움미술관",
        preferredContactMethod: "email",
        internalNotes: "VIP 응대",
        timezone: "Asia/Seoul",
      };
      assertTrue(isContactInfo(full), "scenario1.full_passes");
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §2 KR label coverage — 2 keys non-empty
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 2,
    label: "Korean label coverage — 2 keys non-empty",
    description:
      "PREFERRED_CONTACT_METHOD_LABEL_KR 는 'email'/'phone' 모두 non-empty 한국어 라벨 보유",
    run: () => {
      const keys = Object.keys(PREFERRED_CONTACT_METHOD_LABEL_KR);
      assertEqual(keys.length, 2, "scenario2.label_count");
      for (const method of PREFERRED_CONTACT_METHODS) {
        const label = PREFERRED_CONTACT_METHOD_LABEL_KR[method];
        assertTrue(
          typeof label === "string" && label.length > 0,
          `scenario2.label.${method}`,
        );
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §3 EN label coverage — 2 keys non-empty
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 3,
    label: "English label coverage — 2 keys non-empty",
    description:
      "PREFERRED_CONTACT_METHOD_LABEL_EN 는 'email'/'phone' 모두 non-empty English 라벨 보유",
    run: () => {
      const keys = Object.keys(PREFERRED_CONTACT_METHOD_LABEL_EN);
      assertEqual(keys.length, 2, "scenario3.label_count");
      for (const method of PREFERRED_CONTACT_METHODS) {
        const label = PREFERRED_CONTACT_METHOD_LABEL_EN[method];
        assertTrue(
          typeof label === "string" && label.length > 0,
          `scenario3.label.${method}`,
        );
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §4 isPreferredContactMethod — accepts/rejects 정확
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 4,
    label: "isPreferredContactMethod — accepts valid + rejects invalid",
    description:
      "v1 enum 2 values 정확 accept (case-sensitive), 외 모두 reject",
    run: () => {
      // Valid
      assertTrue(isPreferredContactMethod("email"), "scenario4.accept.email");
      assertTrue(isPreferredContactMethod("phone"), "scenario4.accept.phone");
      // Invalid — case sensitivity
      const invalidInputs: unknown[] = [
        "Email",
        "EMAIL",
        "Phone",
        "PHONE",
        "messenger",
        "kakao",
        "in_person",
        "post",
        "",
        0,
        1,
        true,
        null,
        undefined,
        {},
        [],
      ];
      for (const invalid of invalidInputs) {
        assertFalse(
          isPreferredContactMethod(invalid),
          `scenario4.reject.${JSON.stringify(invalid)}`,
        );
      }
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §5 isContactInfo — runtime shape 검증
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 5,
    label: "isContactInfo — runtime shape validation",
    description:
      "valid object accept (empty/partial/full + 알려지지 않은 field 무시), null/array/primitive/wrong-type-field reject",
    run: () => {
      // Valid — accept
      assertTrue(isContactInfo({}), "scenario5.accept.empty");
      assertTrue(isContactInfo({ email: "a@b.com" }), "scenario5.accept.email_only");
      assertTrue(
        isContactInfo({
          email: "a@b.com",
          phone: "010",
          preferredContactMethod: "email",
        }),
        "scenario5.accept.partial_full",
      );
      // Forward-compat — 알려지지 않은 field 는 무시 (accept)
      assertTrue(
        isContactInfo({ email: "a@b.com", futureField: "x" } as unknown),
        "scenario5.accept.future_field_ignored",
      );

      // Invalid — reject (non-object)
      assertFalse(isContactInfo(null), "scenario5.reject.null");
      assertFalse(isContactInfo(undefined), "scenario5.reject.undefined");
      assertFalse(isContactInfo("string"), "scenario5.reject.string");
      assertFalse(isContactInfo(42), "scenario5.reject.number");
      assertFalse(isContactInfo([]), "scenario5.reject.array");

      // Invalid — wrong field types
      assertFalse(
        isContactInfo({ email: 123 }),
        "scenario5.reject.email_not_string",
      );
      assertFalse(
        isContactInfo({ phone: true }),
        "scenario5.reject.phone_not_string",
      );
      assertFalse(
        isContactInfo({ preferredContactMethod: "invalid_method" }),
        "scenario5.reject.method_not_in_enum",
      );
      assertFalse(
        isContactInfo({ institution: { nested: "obj" } }),
        "scenario5.reject.institution_not_string",
      );
      assertFalse(
        isContactInfo({ timezone: 999 }),
        "scenario5.reject.timezone_not_string",
      );
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // §6 Inquiry persistence v1 forward compat
  // ─────────────────────────────────────────────────────────────────────
  {
    id: 6,
    label: "Inquiry persistence v1 forward compat — contactInfo 부재 자연 호환",
    description:
      "기존 mock-data.ts 형태 (contactInfo 부재) 의 inquiry 가 type-check 통과 + 신규 contactInfo? 추가도 자연 합류",
    run: () => {
      // Legacy shape — contactInfo 부재 (기존 mock-data.ts 모든 inquiry 가 이 shape)
      const legacy: Inquiry = {
        id: "inq_test_1",
        artworkId: "art_001",
        collectorName: "김컬렉터",
        contact: "collector@example.com", // 기존 free-form string
        inquiryType: "PRICE",
        message: "관심 있습니다",
        source: "EMAIL",
        status: "OPEN",
        createdAt: "2026-05-08T00:00:00Z",
        updatedAt: "2026-05-08T00:00:00Z",
        // contactInfo 부재 — undefined fallback
      };
      // contactInfo 부재 → undefined
      assertEqual(legacy.contactInfo, undefined, "scenario6.legacy_undefined");

      // New shape — contactInfo 추가 (사용자 spec future-ready 구조)
      const enhanced: Inquiry = {
        ...legacy,
        id: "inq_test_2",
        contactInfo: {
          email: "collector@example.com",
          phone: "+82-10-1234-5678",
          institution: "리움미술관",
          preferredContactMethod: "email",
          internalNotes: "VIP 응대",
          timezone: "Asia/Seoul",
        },
      };
      assertTrue(
        enhanced.contactInfo !== undefined,
        "scenario6.enhanced_present",
      );
      assertEqual(
        enhanced.contactInfo?.email,
        "collector@example.com",
        "scenario6.enhanced_email",
      );
      assertEqual(
        enhanced.contactInfo?.preferredContactMethod,
        "email" as PreferredContactMethod,
        "scenario6.enhanced_method",
      );
      // 기존 contact field 도 그대로 보존 (backward compat)
      assertEqual(enhanced.contact, "collector@example.com", "scenario6.legacy_field_preserved");
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
