// ============================================================================
// Audit Log Helpers — STEP 20 (rule_7 follow-through, rule_8 reuse)
//
// 기존 TimelineEvent 구조를 *수정 없이* 재사용한다. AXVELA의 timeline 이벤트는
// `kind` 필드만으로 도메인을 명확히 구분하지 않음 (예: Settlement / Tax 이벤트는
// kind="TRANSACTION"으로 emit됨). 이 모듈은 (kind / title / actor)의 조합으로
// 부터 도메인·작성자 유형·강조 분류를 *유추*한다.
//
// 향후 도메인 정비 시 TimelineEvent에 explicit `domain?: AuditDomain` 필드를
// 추가하면 이 분류기는 단순화 가능. 현재는 store action 코드 0줄 변경 정책 하에
// heuristic 매칭으로 동작.
//
// Classifier가 store actions의 title 문자열에 의존하므로, 신규 timeline title을
// 추가할 때 반드시 이 파일의 매칭 패턴도 갱신해야 일관성 유지.
// ============================================================================

import type { TimelineEvent } from "@/types/artwork";

// ----------------------------------------------------------------------------
// Classification axes
// ----------------------------------------------------------------------------

/**
 * Audit 도메인 — 사용자가 필터로 선택할 수 있는 의미 카테고리.
 * Money / Logistics / Document / AI / Inquiry / Transaction / State / Note.
 */
export type AuditDomain =
  | "AI"
  | "DOCUMENT"
  | "MONEY"
  | "LOGISTICS"
  | "INQUIRY"
  | "TRANSACTION"
  | "STATE"
  | "NOTE";

/**
 * Audit 작성자 유형.
 * - AI:     AXVELA AI 자동 생성 이벤트 (rule_18)
 * - SYSTEM: 시스템 cascade / Collector 외부 입력 — actorRole 부재
 * - STAFF/MANAGER/OWNER: 인간 운영자 (rule_7 RBAC actorRole 기록)
 */
export type AuditActorType = "AI" | "SYSTEM" | "STAFF" | "MANAGER" | "OWNER";

/**
 * 강조 표시 — 신뢰 시스템에서 특별히 가시화해야 하는 이벤트들 (rule_4).
 * LOCK / APPROVED / CORRECTION / PAYMENT / SETTLEMENT / TAX_ISSUED.
 */
export type AuditEmphasis =
  | "LOCK"
  | "APPROVED"
  | "CORRECTION"
  | "PAYMENT"
  | "SETTLEMENT"
  | "TAX_ISSUED"
  | null;

/**
 * Classified audit event — 원본 TimelineEvent + 유추된 분류 메타데이터.
 */
export interface ClassifiedAuditEvent {
  event: TimelineEvent;
  domain: AuditDomain;
  actorType: AuditActorType;
  emphasis: AuditEmphasis;
  /** title 또는 detail에서 추출한 버전 번호 (Contract/Curation/Invoice 체인). */
  version: number | null;
  /** 수정본 (correction) 체인 일부인지. */
  isCorrection: boolean;
  /** "v1 → v2" / "원본 → 수정본" 형태로 표시할 chain hint. null이면 표시 안 함. */
  chainHint: string | null;
}

// ----------------------------------------------------------------------------
// Filter inputs
// ----------------------------------------------------------------------------

export type AuditDomainFilter = "ALL" | AuditDomain;
export type AuditActorFilter = "ALL" | AuditActorType;

/**
 * STEP 24 — Broad actor type for filtering. ClassifiedAuditEvent.actorType은
 * 5-union (AI / SYSTEM / STAFF / MANAGER / OWNER)이지만, 사용자 spec은
 * "AI / HUMAN / SYSTEM" 3-tier 차원과 "STAFF / MANAGER / OWNER" role 차원을
 * 별개로 다룸. 본 타입은 broad 분류 — role 차원은 별도 filter로.
 */
export type AuditActorTypeBroad = "AI" | "HUMAN" | "SYSTEM";

export type AuditRoleFilter = "STAFF" | "MANAGER" | "OWNER";

/**
 * STEP 24 — 통합 필터 상태. AuditFilterBar / AuditLogDrawer / GlobalAuditDrawer
 * 가 공유하는 단일 구조. 모든 필드 비활성 = 모든 이벤트 통과.
 *
 * Multi-select 필드는 빈 array가 "전체 통과" (= 필터 비활성). 한 항목이라도
 * 선택되면 그 set에 속한 이벤트만 통과.
 */
export interface AuditFilterState {
  /** 시작일 (YYYY-MM-DD, 포함). 빈 문자열이면 비활성. */
  startDate: string;
  /** 종료일 (YYYY-MM-DD, 포함). 빈 문자열이면 비활성. */
  endDate: string;
  /** title / detail / actor / artwork title 검색. 빈 문자열이면 비활성. */
  search: string;
  /** 빈 array면 모든 도메인 통과. */
  domains: AuditDomain[];
  /** 빈 array면 모든 actor type 통과. */
  actorTypes: AuditActorTypeBroad[];
  /** 빈 array면 모든 role 통과. AI / SYSTEM 이벤트는 role 필터 적용 시 제외. */
  actorRoles: AuditRoleFilter[];
  /** GlobalAuditDrawer 전용. 빈 array면 모든 작품 통과. */
  artworkIds: string[];
}

/** 모든 필터 비활성 상태 — Reset 버튼이 이 값으로 set. */
export const EMPTY_AUDIT_FILTER_STATE: AuditFilterState = {
  startDate: "",
  endDate: "",
  search: "",
  domains: [],
  actorTypes: [],
  actorRoles: [],
  artworkIds: [],
};

/** 활성 필터가 하나라도 있는지 — Reset 버튼 enabled 판정 + UI 표시 */
export function isAuditFilterActive(state: AuditFilterState): boolean {
  return (
    state.startDate !== "" ||
    state.endDate !== "" ||
    state.search.trim() !== "" ||
    state.domains.length > 0 ||
    state.actorTypes.length > 0 ||
    state.actorRoles.length > 0 ||
    state.artworkIds.length > 0
  );
}

/**
 * actorType의 broad 분류. STAFF/MANAGER/OWNER → HUMAN, 그 외 그대로.
 */
export function broadActorType(t: AuditActorType): AuditActorTypeBroad {
  if (t === "AI") return "AI";
  if (t === "SYSTEM") return "SYSTEM";
  return "HUMAN"; // STAFF / MANAGER / OWNER
}

// ----------------------------------------------------------------------------
// Public helpers
// ----------------------------------------------------------------------------

/**
 * Get all timeline events for a single artwork, sorted newest-first.
 * Store mutations already prepend events so they're sorted by insertion order;
 * this defensive sort guarantees correctness regardless of how events were
 * seeded (mock-data may not strictly maintain prepend order).
 */
export function getAuditEventsForArtwork(
  timeline: Record<string, TimelineEvent[]>,
  artworkId: string
): TimelineEvent[] {
  const list = timeline[artworkId] ?? [];
  return [...list].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

/**
 * Classify a single TimelineEvent.
 */
export function classifyAuditEvent(
  event: TimelineEvent
): ClassifiedAuditEvent {
  const domain = classifyAuditDomain(event);
  const actorType = classifyAuditActor(event);
  const emphasis = classifyAuditEmphasis(event);
  const version = extractVersion(event);
  const isCorrection = detectCorrection(event);
  const chainHint = buildChainHint(event, version, isCorrection);

  return {
    event,
    domain,
    actorType,
    emphasis,
    version,
    isCorrection,
    chainHint,
  };
}

/**
 * Filter a list of classified events by domain + actor type.
 * "ALL" disables that axis. Both filters AND together.
 */
export function filterAuditEvents(
  classified: ClassifiedAuditEvent[],
  filters: {
    domain?: AuditDomainFilter;
    actor?: AuditActorFilter;
  }
): ClassifiedAuditEvent[] {
  return classified.filter((c) => {
    if (
      filters.domain &&
      filters.domain !== "ALL" &&
      c.domain !== filters.domain
    ) {
      return false;
    }
    if (
      filters.actor &&
      filters.actor !== "ALL" &&
      c.actorType !== filters.actor
    ) {
      return false;
    }
    return true;
  });
}

/**
 * STEP 24 — 통합 필터. AuditFilterState 6개 차원을 AND로 결합.
 *
 * `artworkLookup`: artworkId → artwork title. Search 필터에서 작품 제목까지
 * 매칭하기 위함. AuditLogDrawer (단일)는 비워도 OK (artworkIds 필터 미사용 +
 * search는 detail/title/actor만 매칭).
 */
export function applyAuditFilters(
  classified: ClassifiedAuditEvent[],
  state: AuditFilterState,
  artworkLookup?: Record<string, string> // artworkId → artwork title
): ClassifiedAuditEvent[] {
  const searchLower = state.search.trim().toLowerCase();
  const hasDomainFilter = state.domains.length > 0;
  const hasActorTypeFilter = state.actorTypes.length > 0;
  const hasRoleFilter = state.actorRoles.length > 0;
  const hasArtworkFilter = state.artworkIds.length > 0;
  const domainSet = new Set<AuditDomain>(state.domains);
  const actorTypeSet = new Set<AuditActorTypeBroad>(state.actorTypes);
  const roleSet = new Set<AuditRoleFilter>(state.actorRoles);
  const artworkSet = new Set<string>(state.artworkIds);

  return classified.filter((c) => {
    const event = c.event;

    // 1. Date range — at은 ISO string, lexicographic 비교 = chronological
    //    startDate "YYYY-MM-DD" → 그날 00:00:00 이후 통과.
    //    endDate "YYYY-MM-DD" → 그날 23:59:59 이전 통과 (즉 다음날 0시 미만).
    if (state.startDate !== "") {
      // event.at "2026-05-04T..." vs "2026-05-04" — 시작 비교
      if (event.at < state.startDate) return false;
    }
    if (state.endDate !== "") {
      // 다음날 0시 미만 == endDate + "T24" 미만 == endDate가 prefix면 통과
      // 안전한 비교: endDate + "T99" 보다 작거나 같음 (event.at < endDate + "T99")
      // 더 단순: substring(0, 10) <= endDate
      if (event.at.slice(0, 10) > state.endDate) return false;
    }

    // 2. Domain
    if (hasDomainFilter && !domainSet.has(c.domain)) return false;

    // 3. Actor type (broad)
    if (hasActorTypeFilter) {
      const broad = broadActorType(c.actorType);
      if (!actorTypeSet.has(broad)) return false;
    }

    // 4. Actor role (STAFF/MANAGER/OWNER) — AI/SYSTEM 이벤트는 role 필터 적용 시 제외
    if (hasRoleFilter) {
      if (!event.actorRole) return false;
      if (!roleSet.has(event.actorRole as AuditRoleFilter)) return false;
    }

    // 5. Artwork (Global only)
    if (hasArtworkFilter && !artworkSet.has(event.artworkId)) return false;

    // 6. Search — title / detail / actor / (optional) artwork title
    if (searchLower !== "") {
      const haystack: string[] = [
        event.title,
        event.detail ?? "",
        event.actor ?? "",
      ];
      if (artworkLookup) {
        const title = artworkLookup[event.artworkId];
        if (title) haystack.push(title);
      }
      const found = haystack.some((s) =>
        s.toLowerCase().includes(searchLower)
      );
      if (!found) return false;
    }

    return true;
  });
}

// ----------------------------------------------------------------------------
// Internal classifiers
// ----------------------------------------------------------------------------

/**
 * Domain heuristic. 우선순위 (위에서 아래로 매칭):
 *   1. actor === "AXVELA AI"          → AI
 *   2. kind === "PAYMENT"              → MONEY
 *   3. title 키워드 — 결제/정산/세무/Invoice/Settlement → MONEY
 *   4. title 키워드 — 배송/Condition/Logistics/물류 → LOGISTICS
 *   5. kind === "DOCUMENT"             → DOCUMENT (Contract / Curation)
 *   6. kind === "INQUIRY"              → INQUIRY
 *   7. kind === "TRANSACTION"          → TRANSACTION
 *   8. kind === "STATE_CHANGE"         → STATE
 *   9. otherwise                       → NOTE
 *
 * 주의: Settlement / TaxRecord 이벤트는 store에서 kind="TRANSACTION"으로
 * emit되지만 의미상 MONEY 도메인에 속하므로 (3)에서 키워드 매칭으로 잡는다.
 */
function classifyAuditDomain(event: TimelineEvent): AuditDomain {
  if (event.actor === "AXVELA AI") return "AI";
  if (event.kind === "PAYMENT") return "MONEY";

  const t = event.title;
  if (
    t.includes("결제") ||
    t.includes("Settlement") ||
    t.includes("정산") ||
    t.includes("TaxRecord") ||
    t.includes("세무") ||
    t.includes("Invoice")
  ) {
    return "MONEY";
  }

  if (
    t.includes("Logistics") ||
    t.includes("배송") ||
    t.includes("Condition Report") ||
    t.includes("물류") ||
    t.includes("컨디션") ||
    t.includes("검수")
  ) {
    return "LOGISTICS";
  }

  if (event.kind === "DOCUMENT") return "DOCUMENT";
  if (event.kind === "INQUIRY") return "INQUIRY";
  if (event.kind === "TRANSACTION") return "TRANSACTION";
  if (event.kind === "STATE_CHANGE") return "STATE";
  return "NOTE";
}

/**
 * Actor heuristic.
 *   - actor === "AXVELA AI"    → AI
 *   - actorRole 존재            → 그대로 (STAFF / MANAGER / OWNER)
 *   - 그 외 (System / Collector / 미지정) → SYSTEM
 */
function classifyAuditActor(event: TimelineEvent): AuditActorType {
  if (event.actor === "AXVELA AI") return "AI";
  if (event.actorRole) return event.actorRole;
  return "SYSTEM";
}

/**
 * Emphasis heuristic — title + detail 결합 매칭.
 */
function classifyAuditEmphasis(event: TimelineEvent): AuditEmphasis {
  const t = event.title;
  const d = event.detail ?? "";

  // LOCK — Contract / Curation / Invoice 모두 "잠금" 또는 "LOCK"
  if (t.includes("LOCK") || t.includes("잠금") || d.includes("잠금")) {
    return "LOCK";
  }

  // CORRECTION — Condition Report 수정본
  if (t.includes("수정본") || d.includes("원본:")) {
    return "CORRECTION";
  }

  // APPROVED — Contract / Curation 승인
  if (t.includes("승인")) {
    return "APPROVED";
  }

  // PAYMENT — 결제 등록 (kind="PAYMENT")
  if (event.kind === "PAYMENT") {
    return "PAYMENT";
  }

  // SETTLEMENT — Settlement 완료
  if (t.includes("Settlement 완료") || t.includes("정산 완료")) {
    return "SETTLEMENT";
  }

  // TAX_ISSUED — TaxRecord 발행 완료
  if (t.includes("발행 완료")) {
    return "TAX_ISSUED";
  }

  return null;
}

const VERSION_PATTERN = /\bv(\d+)\b/;

function extractVersion(event: TimelineEvent): number | null {
  const titleMatch = event.title.match(VERSION_PATTERN);
  if (titleMatch) return parseInt(titleMatch[1], 10);
  if (event.detail) {
    const detailMatch = event.detail.match(VERSION_PATTERN);
    if (detailMatch) return parseInt(detailMatch[1], 10);
  }
  return null;
}

function detectCorrection(event: TimelineEvent): boolean {
  return (
    event.title.includes("수정본") ||
    (event.detail?.includes("원본:") ?? false)
  );
}

/**
 * Build a short chain visualization hint:
 *   - "v1 → v2" 형태  (새 버전 생성, detail에 "이전 v{N}는 영구 보존" 포함)
 *   - "원본 → 수정본"  (Condition Report correction)
 *   - null            (chain 정보 없음 — 표시 안 함)
 *
 * detail 문자열을 신뢰해서 추출. fragile하지만 도메인 변경 없이 가능한 최소 구현
 * (rule_2 — flow는 기존 구조 재사용).
 */
function buildChainHint(
  event: TimelineEvent,
  currentVersion: number | null,
  isCorrection: boolean
): string | null {
  // Correction chain
  if (isCorrection) return "원본 → 수정본";

  // Version chain — detail이 "이전 v{N}는 영구 보존" 형태일 때만
  if (
    event.detail &&
    currentVersion !== null &&
    /이전 v(\d+)/.test(event.detail)
  ) {
    const match = event.detail.match(/이전 v(\d+)/);
    if (match) {
      const prev = match[1];
      return `v${prev} → v${currentVersion}`;
    }
  }

  return null;
}

