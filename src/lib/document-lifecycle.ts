// ============================================================================
// Document Lifecycle Helpers — Scoped Document Trust & Lifecycle Clarity STEP.
//
// Pure functions for deriving operational lifecycle context from existing
// Invoice / Contract / TimelineEvent data — *no new domain entities created*,
// *no Approval Workflow* (those are STEP 101+ per AXVELA_TRUST_LAYER.md).
//
// **설계 원칙**:
//   - 모든 helper는 *순수 함수* — store 접근 0건, mutation 0건.
//   - 입력은 기존 entity (Invoice / TimelineEvent) — schema 변경 0건.
//   - 출력은 UI 표현용 메타데이터 — drawer 컴포넌트가 그대로 render.
//   - "준비 중" / "STEP 101+ 예정" 라벨은 사용자 spec 일관 (Approval slot reserved).
//
// **표현 정책 (사용자 spec STEP 일관)**:
//   - 사용: "발송 필요" / "결제 등록 가능" / "정산 진행 가능" / "발송 완료" /
//     "결제 완료" / "잠금" / "새 버전 존재" / "최종 발송본"
//   - 금지: "법적 효력" / "공인 승인" / "compliance verified" / "tamper-proof"
//   - rule_4 Trust Layer + AXVELA_TRUST_LAYER.md 일관
//
// **AXVELA_AI_DIRECTION 정책 무관**: 본 helper는 AI / Market Intelligence
// 영역 무관 (document lifecycle 전용).
// ============================================================================

import type { Invoice } from "@/types/invoice";
import type { TimelineEvent, TimelineEntityType } from "@/types/artwork";
import { formatMoney } from "@/lib/utils";

// ============================================================================
// Next Required Action — drawer 최상단 1개 명시 (STEP UX-1 Action Clarity 일관)
// ============================================================================

export type NextActionTone = "primary" | "info" | "neutral";

export interface NextActionMeta {
  /** 운영자에게 표시할 1줄 라벨. */
  label: string;
  /** 보조 설명 (옵셔널). */
  description?: string;
  /** UI 톤 — primary는 검은 button, info / neutral은 작은 텍스트. */
  tone: NextActionTone;
}

/**
 * Invoice 상태로부터 *지금 해야 할 1개 행동*을 derive. STEP UX-1 정책 일관 —
 * Primary 1개만 검은 톤, 나머지는 작은 텍스트 hint.
 *
 * **상태별 매핑**:
 *   - DRAFT (active version)        → "발송 필요" (primary)
 *   - SENT  (active version)        → "결제 등록 가능" (info)
 *   - PAID  (active version)        → "정산 진행 가능" (info)
 *   - LOCKED + 새 버전 존재         → "새 버전 검토 필요" (neutral)
 *
 * `hasNewerVersion`이 true면 archived 버전이라 next action은 *upstream 안내*만.
 */
export function getInvoiceNextAction(
  invoice: Invoice,
  hasNewerVersion: boolean
): NextActionMeta {
  if (hasNewerVersion) {
    return {
      label: "새 버전 존재",
      description: "이 버전은 이전 발행본입니다. 최신 버전으로 이동하세요.",
      tone: "neutral",
    };
  }
  switch (invoice.status) {
    case "DRAFT":
      return {
        label: "발송 필요",
        description: "발송 시 자동 잠기며 이후는 새 버전으로만 수정 가능합니다.",
        tone: "primary",
      };
    case "SENT":
      return {
        label: "결제 등록 가능",
        description: "결제 확인 후 작품 상세에서 결제를 등록하세요.",
        tone: "info",
      };
    case "PAID":
      return {
        label: "정산 진행 가능",
        description: "결제가 완료되었습니다. 정산은 작품 상세에서 진행합니다.",
        tone: "info",
      };
  }
}

// ============================================================================
// Version Chain — v3 (현재) / v2 (replaced) / v1 (archived) 구조
// ============================================================================

export interface VersionChainEntry {
  invoice: Invoice;
  /** Chain 내 위치 — "current" 1개, 나머지 "replaced" / "archived". */
  role: "current" | "replaced" | "archived";
  /** UI 표시용 부가 라벨. */
  hint: string;
}

/**
 * Invoice의 전체 version chain을 *최신 → 오래된* 순으로 반환.
 *
 * **role 정책**:
 *   - 가장 최신 (parent가 없거나, 본인이 마지막) = "current"
 *   - "current"의 직전 = "replaced"
 *   - 그 외 더 오래된 = "archived"
 *
 * **알고리즘**: parentInvoiceId chain을 따라 forward / backward로 graph traversal.
 * 무한 cycle 방지 — visited Set으로 가드 (이론적으로 cycle 없지만 방어적).
 */
export function buildInvoiceVersionChain(
  targetInvoice: Invoice,
  allInvoicesForTransaction: ReadonlyArray<Invoice>
): VersionChainEntry[] {
  // 같은 transaction의 invoice들에서 chain head (children이 없는) 찾기
  const byId = new Map(allInvoicesForTransaction.map((inv) => [inv.id, inv]));
  const childOf = new Map<string, Invoice>(); // parentId → child invoice
  for (const inv of allInvoicesForTransaction) {
    if (inv.parentInvoiceId) {
      childOf.set(inv.parentInvoiceId, inv);
    }
  }

  // target에서 시작해 chain head (자식 없는 가장 최신)까지 forward 추적
  let head: Invoice = targetInvoice;
  const visited = new Set<string>([head.id]);
  while (true) {
    const child = childOf.get(head.id);
    if (!child || visited.has(child.id)) break;
    head = child;
    visited.add(head.id);
  }

  // head에서 시작해 parent 따라 backward로 모든 version 수집 (최신 → 오래된)
  const chain: Invoice[] = [head];
  let cursor: Invoice | undefined = head;
  const seen = new Set<string>([head.id]);
  while (cursor && cursor.parentInvoiceId) {
    const parent = byId.get(cursor.parentInvoiceId);
    if (!parent || seen.has(parent.id)) break;
    chain.push(parent);
    seen.add(parent.id);
    cursor = parent;
  }

  // role + hint 조립
  return chain.map((inv, index) => {
    if (index === 0) {
      return {
        invoice: inv,
        role: "current",
        hint:
          inv.status === "PAID"
            ? "결제 완료"
            : inv.status === "SENT"
              ? "발송 완료"
              : "초안",
      };
    }
    if (index === 1) {
      return {
        invoice: inv,
        role: "replaced",
        hint: `→ v${chain[0].version}로 대체됨`,
      };
    }
    return {
      invoice: inv,
      role: "archived",
      hint: "이전 발행본",
    };
  });
}

// ============================================================================
// State Badges — monochrome / 절제 (rule_16 minimalism)
// ============================================================================

export type DocumentStateBadgeKind =
  | "draft"
  | "sent"
  | "paid"
  | "locked"
  | "newer_version_exists";

export interface DocumentStateBadge {
  kind: DocumentStateBadgeKind;
  label: string;
}

/**
 * Invoice 상태로부터 표시할 badge들을 derive. 여러 badge 동시 표시 가능
 * (예: "발송 완료" + "잠금" + "새 버전 존재").
 *
 * **monochrome 정책**: 모든 badge는 ink-subtle / ink-muted 톤 — rainbow 금지.
 */
export function getInvoiceStateBadges(
  invoice: Invoice,
  hasNewerVersion: boolean
): DocumentStateBadge[] {
  const badges: DocumentStateBadge[] = [];

  // 기본 상태 badge
  if (invoice.status === "DRAFT") {
    badges.push({ kind: "draft", label: "초안" });
  } else if (invoice.status === "SENT") {
    badges.push({ kind: "sent", label: "발송 완료" });
  } else if (invoice.status === "PAID") {
    badges.push({ kind: "paid", label: "결제 완료" });
  }

  // Lock badge (SENT / PAID는 자동 lock — 중복 방지 위해 isLocked 자체 검사)
  if (invoice.isLocked) {
    badges.push({ kind: "locked", label: "잠금" });
  }

  // 새 버전 존재 badge (current가 아닌 archived 버전인 경우만)
  if (hasNewerVersion) {
    badges.push({ kind: "newer_version_exists", label: "새 버전 존재" });
  }

  return badges;
}

// ============================================================================
// Document Activity Timeline — TimelineEvent filter + actor formatting
// ============================================================================

/**
 * 도메인 entity (invoice / contract / payment / settlement / tax / 등)에
 * 직접 연관된 TimelineEvent들만 추출.
 *
 * **필터 정책**:
 *   - relatedEntityType이 일치 + relatedEntityId가 일치
 *   - 또는 entityType이 "invoice"이고 invoice version chain 중 하나에 매칭 (chain 전체 활동)
 *
 * **정렬**: 최신 → 오래된 순 (배열 자체는 store에서 이미 정렬되어 있으나 안전 차원).
 */
export function filterTimelineForEntity(
  events: ReadonlyArray<TimelineEvent>,
  entityType: TimelineEntityType,
  entityIds: ReadonlyArray<string>
): TimelineEvent[] {
  const idSet = new Set(entityIds);
  return events
    .filter(
      (e) =>
        e.relatedEntityType === entityType &&
        e.relatedEntityId !== undefined &&
        idSet.has(e.relatedEntityId)
    )
    .slice() // copy before sort
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/**
 * Timeline event의 actor 라인 포맷 — "직원 · 김민수" / "매니저 · 박수진" /
 * "대표 · Jaeson Park" / "AXVELA AI" / fallback "(actor 미기록)"
 *
 * actorRole이 있으면 한국어 라벨을 prefix, actor 텍스트를 그대로 sep로 연결.
 * actor만 있고 role이 없으면 actor만 표시. 둘 다 없으면 fallback.
 */
export function formatTimelineActorLine(event: TimelineEvent): string {
  const roleLabel: Record<NonNullable<TimelineEvent["actorRole"]>, string> = {
    STAFF: "직원",
    MANAGER: "매니저",
    OWNER: "대표",
  };
  const role = event.actorRole ? roleLabel[event.actorRole] : null;
  const actor = event.actor?.trim();

  if (role && actor) return `${role} · ${actor}`;
  if (actor) return actor;
  if (role) return role;
  return "(기록 없음)";
}

/**
 * Internal use only. `formatMoney`을 import 가능 표시용 — tree-shaking 회피.
 * 실제로는 호출자가 import 시 사용. (compiler-friendly side-effect 0건)
 */
const _MONEY_FORMAT_AVAILABLE: typeof formatMoney = formatMoney;
export const _DOCUMENT_LIFECYCLE_HELPERS_LOADED = true;
void _MONEY_FORMAT_AVAILABLE;
