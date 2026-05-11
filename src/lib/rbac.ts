// ============================================================================
// RBAC helpers — pure functions over the Role / Permission matrix.
//
// hasPermission()은 store / 컴포넌트 양쪽에서 동일한 의미로 호출됨 — 이중
// 게이트 (rule_7). Store는 권한 부족 시 silent no-op (timeline 오염 방지),
// UI는 disabled + hint.
// ============================================================================

import { ACTION_MIN_ROLE, type Role, type Permission } from "@/types/role";

/** 등급 위계 — 큰 값이 더 높은 권한.
 *  STEP 82 — store가 setCurrentRole 시 audit metadata 채우기 위해 export. */
export const ROLE_RANK: Record<Role, number> = {
  STAFF: 1,
  MANAGER: 2,
  OWNER: 3,
};

/**
 * 현재 role이 해당 permission을 가지는지 검사.
 * Owner는 Manager/Staff 액션 모두 가능 (등급 상속).
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const required = ACTION_MIN_ROLE[permission];
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/** 해당 permission을 위해 *최소* 필요한 role을 반환 (UI 안내용). */
export function requiredRole(permission: Permission): Role {
  return ACTION_MIN_ROLE[permission];
}

// ----------------------------------------------------------------------------
// UI labels
// ----------------------------------------------------------------------------

export const ROLE_LABEL: Record<Role, string> = {
  STAFF: "Staff",
  MANAGER: "Manager",
  OWNER: "Owner",
};

export const ROLE_LABEL_KR: Record<Role, string> = {
  STAFF: "직원",
  MANAGER: "매니저",
  OWNER: "대표",
};

/** Sidebar role switcher / hover 안내용 한 줄 설명. */
export const ROLE_DESCRIPTION_KR: Record<Role, string> = {
  STAFF: "일상 운영 — 작품 / 문의 / 배송 / 컨디션 리포트",
  MANAGER: "거래 진행 — 인보이스 · 결제 · 계약 검토 · 정산 생성",
  OWNER: "최종 승인 — 계약 승인 · LOCK · 정산 완료 · 세무 발행 · 거래 종료",
};

/** Role accent color — sidebar pill용. 너무 튀지 않게 절제된 톤. */
export const ROLE_COLOR: Record<Role, string> = {
  STAFF: "#6B6B6B",   // ink-muted — 평범
  MANAGER: "#1E5FBF", // status-deal blue — 진행 중
  OWNER: "#5E3FB8",   // status-brokered purple — 권한
};

/**
 * 권한 부족 시 버튼 옆에 노출할 짧은 hint.
 * "Owner 권한 필요" / "Manager 권한 필요" — 짧게 단정적으로.
 */
export function permissionHint(permission: Permission): string {
  return `${ROLE_LABEL[ACTION_MIN_ROLE[permission]]} 권한 필요`;
}

/**
 * Timeline event actor 표기를 role-aware하게 생성. 기존 hardcoded "Manager · J. Han"
 * 패턴을 점진 교체 — role이 주어지면 그것을 우선 사용.
 *
 * v1: 단일 사용자 + role switcher 기반 시연이므로 이름은 "현재 운영자"로 통일.
 * 후속 단계에서 실제 사용자 모델이 들어가면 "{name} · {ROLE}"로 확장.
 */
export function actorLabel(role: Role): string {
  return `${ROLE_LABEL[role]} · 운영자`;
}
