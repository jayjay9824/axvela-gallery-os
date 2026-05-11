// ============================================================================
// Customer Suggest — STEP 48 (Inquiry intake / edit 지원).
//
// **Pure deterministic matching only.** Fuzzy / Levenshtein / 외부 라이브러리 0개.
// Inquiry 입력 시점에 collectorName / contact 부분 입력만으로 기존 Customer
// 후보를 좁혀 노출 — 운영자가 같은 고객 정보를 반복 입력하지 않도록 도와줌.
//
// **데이터 정책 (사용자 spec):**
//   - Customer master data slice 추가 0개 (deriveCustomers 결과만 read-only)
//   - 외부 API 호출 0건
//   - Persistence schema 변경 0줄
//   - Inquiry / Customer 타입 변경 0줄 — 본 모듈은 read-only consumer
//
// **표현 정책 (사용자 spec):**
//   - "기존 고객 후보" / "운영 참고" / "추천 후보" 사용
//   - "확정 고객 매칭" / "자동 연결됨" 표현 금지 (오직 부정형으로만 등장 가능)
// ============================================================================

import type { Customer } from "@/types/customer";

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

export type CustomerSuggestReason =
  | "name_prefix"      // 이름 접두 매치 (가장 강한 신호)
  | "name_substring"   // 이름 부분 매치
  | "contact_match"    // 연락처 부분 매치
  | "exact_name";      // 이름 완전 일치 (다중 동명이인 케이스)

export interface CustomerSuggestion {
  customer: Customer;
  reason: CustomerSuggestReason;
  /** 0~100. UI 디버그 / 정렬 검증용. 값 자체를 사용자에게 노출하지는 않음. */
  score: number;
}

export interface CustomerSuggestOptions {
  /** 반환 최대 개수. 기본 4. */
  maxResults?: number;
  /**
   * 이미 form에 채워진 정확 매치값 — 같은 customer는 추천에서 제외 (이미 같은
   * 값이 들어있으면 "이미 같은 후보" 노출은 의미 없음).
   */
  exclude?: { name: string; contact: string } | null;
}

// ----------------------------------------------------------------------------
// Public dispatcher
// ----------------------------------------------------------------------------

/**
 * Inquiry intake 시 사용하는 customer 후보 추천.
 *
 * **결정성 보장**: 같은 입력 → 같은 출력. 정렬 tiebreak는 customer.displayName
 * 알파벳 asc + 마지막 활동시각 desc.
 *
 * @param nameQuery   현재 collectorName 입력값 (raw, normalize 내부에서 처리)
 * @param contactQuery 현재 contact 입력값 (raw)
 * @param customers   deriveCustomers 결과 — read-only
 * @param options     maxResults / exclude
 * @returns 점수 내림차순으로 정렬된 후보. nameQuery / contactQuery 모두 비면 [].
 */
export function suggestCustomers(
  nameQuery: string,
  contactQuery: string,
  customers: Customer[],
  options?: CustomerSuggestOptions
): CustomerSuggestion[] {
  const nameNorm = normalize(nameQuery);
  const contactNorm = normalize(contactQuery);

  // 둘 다 비어있으면 추천 표시 의미 없음
  if (nameNorm.length === 0 && contactNorm.length === 0) return [];
  // 너무 짧은 단일 문자(이름 1자)는 noise — contact가 같이 있을 때만 허용
  if (nameNorm.length === 1 && contactNorm.length === 0) return [];

  const exclude = options?.exclude
    ? {
        name: normalize(options.exclude.name),
        contact: normalize(options.exclude.contact),
      }
    : null;

  const scored: CustomerSuggestion[] = [];

  for (const c of customers) {
    const cName = normalize(c.displayName);
    const cContacts = c.allContacts.map(normalize);

    // 이미 form에 들어있는 customer는 추천 제외
    if (
      exclude &&
      cName === exclude.name &&
      exclude.contact.length > 0 &&
      cContacts.includes(exclude.contact)
    ) {
      continue;
    }

    let score = 0;
    let reason: CustomerSuggestReason | null = null;

    // ── 이름 매칭 ─────────────────────────────────────────────────────────
    if (nameNorm.length > 0) {
      if (cName === nameNorm) {
        score = 110;
        reason = "exact_name";
      } else if (cName.startsWith(nameNorm)) {
        // 짧을수록 우선 (정확도 가까움) — 길이 패널티
        score = 100 - Math.min(40, cName.length - nameNorm.length);
        reason = "name_prefix";
      } else if (cName.includes(nameNorm) && nameNorm.length >= 2) {
        score = 60 - Math.min(30, cName.length - nameNorm.length);
        reason = "name_substring";
      }
    }

    // ── 연락처 매칭 (이름으로 못 잡았거나 보강) ────────────────────────────
    if (contactNorm.length >= 2) {
      let contactScore = 0;
      for (const ct of cContacts) {
        if (ct === contactNorm) {
          contactScore = 95; // exact contact = 강한 신호
          break;
        }
        if (ct.includes(contactNorm)) {
          contactScore = Math.max(contactScore, 50);
        }
      }
      if (contactScore > score) {
        score = contactScore;
        reason = "contact_match";
      } else if (contactScore > 0 && reason !== null) {
        // 이름 매치 + 연락처 보강 — 점수 추가 부여
        score += 10;
      }
    }

    if (score <= 0 || reason === null) continue;

    // ── Segment 보정 (반복 구매 > 거래 경험 > 잠재 / 휴면) ─────────────────
    if (c.segment === "REPEAT_BUYER") score += 5;
    else if (c.segment === "ONE_TIME_BUYER") score += 3;
    // PROSPECT / DORMANT는 보정 0 — 동등하게 취급 (휴면 고객 다시 활성화 의도)

    scored.push({ customer: c, score, reason });
  }

  // 점수 내림차순 → displayName asc → lastInteractionAt desc
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const nameCmp = a.customer.displayName.localeCompare(b.customer.displayName);
    if (nameCmp !== 0) return nameCmp;
    return b.customer.lastInteractionAt.localeCompare(
      a.customer.lastInteractionAt
    );
  });

  const limit = options?.maxResults ?? 4;
  return scored.slice(0, limit);
}

// ----------------------------------------------------------------------------
// Display helpers
// ----------------------------------------------------------------------------

/**
 * Suggestion이 어떤 신호로 매치되었는지 짧은 한국어 라벨. UI tooltip / hint용.
 * 모두 "추천 후보" / "운영 참고" 톤 — 확정 매칭 표현 0건.
 */
export const SUGGEST_REASON_LABEL_KR: Record<CustomerSuggestReason, string> = {
  name_prefix: "이름 일치",
  name_substring: "이름 부분 매치",
  contact_match: "연락처 매치",
  exact_name: "동명 후보",
};

// ----------------------------------------------------------------------------
// Internal
// ----------------------------------------------------------------------------

/**
 * 매칭 정규화. 단순 lowercase + 양쪽 공백 제거 + 내부 연속 공백 1칸 정규화.
 * 한글 / 영문 모두 동일 처리. 특수기호 제거는 하지 않음 — `john.doe@x.com`
 * 같은 이메일 부분을 정확히 매칭하기 위해.
 */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
