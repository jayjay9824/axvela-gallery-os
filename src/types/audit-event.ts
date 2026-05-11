// ============================================================================
// SystemAuditEvent — STEP 65.
//
// **artwork-linked TimelineEvent와의 구분**:
//
//   `TimelineEvent` (src/types/artwork.ts):
//     - artworkId 필수
//     - 작품 lifecycle 추적 (state 전이 / 거래 / 결제 / inquiry / 문서 등)
//     - DetailPanel timeline + AuditLog drawer (작품별)에서 표시
//     - 도메인 변경의 trust trail
//
//   `SystemAuditEvent` (본 타입):
//     - artworkId 부재 — system / admin 운영 이벤트
//     - 작품과 무관한 활동: orphan blob 제거 / 백업 export / 권한 변경 / 시스템
//       경고 등
//     - "운영 로그" 별도 drawer에서 OWNER 전용 조회
//     - 운영 참고용 — *법적 증거 / forensic 등의 과대 해석 금지* (표현 정책)
//
// **persistence 전략**: 별도 localStorage 키 (`axvela.audit.v1`) — STEP 59
// backup-metadata 패턴 답습. PersistedState / validateV1 / SCHEMA_VERSION 무관 —
// 본 STEP은 schema 변경 0줄.
//
// **표현 정책**: "운영 로그" / "시스템 기록" / "운영 참고" / "storage event" /
// "cleanup request" / "orphan candidate" 사용. "legal audit" / "compliance
// guaranteed" / "permanent record" / "forensic proof" / "tamper-proof" 표현 0건.
// ============================================================================

import type { Role } from "./role";

// ----------------------------------------------------------------------------
// Category — system 운영 이벤트의 큰 분류
// ----------------------------------------------------------------------------

export type AuditCategory =
  | "image_storage"
  | "backup"
  | "restore"
  | "permission"
  | "system";

export const AUDIT_CATEGORY_LABEL_KR: Record<AuditCategory, string> = {
  image_storage: "이미지 저장소",
  backup: "백업",
  restore: "복원",
  permission: "권한",
  system: "시스템",
};

// ----------------------------------------------------------------------------
// Severity — UI 톤 분기 (info: neutral / warning: amber / error: red)
// ----------------------------------------------------------------------------

export type AuditSeverity = "info" | "warning" | "error";

export const AUDIT_SEVERITY_LABEL_KR: Record<AuditSeverity, string> = {
  info: "정보",
  warning: "주의",
  error: "오류",
};

// ----------------------------------------------------------------------------
// Event shape
// ----------------------------------------------------------------------------

/**
 * System-level 운영 기록.
 *
 * - **artworkId 부재** — 본 타입의 정의적 특성. 작품 lifecycle 이벤트는
 *   기존 `TimelineEvent` 사용.
 * - **id** — `aud_` 접두 + timestamp + random suffix (genId 패턴)
 * - **action** — 짧은 dotted notation. 예시:
 *     "orphan_remove_request_success" — orphan blob 제거 요청 성공 (STEP 80)
 *     "orphan_remove_request_failed"  — orphan blob 제거 요청 실패 (STEP 80)
 *     "backup.export"        — JSON 백업 export
 *     "backup.import"        — JSON 백업 import
 *     "audit.clear"          — 본 audit log 자체를 OWNER가 비움
 * - **targetType / targetRef** — 선택적 — 이벤트 대상의 약식 좌표.
 *     image_storage 의 경우: targetType="blob", targetRef=pathname
 * - **message** — 한국어 한 줄 — UI list에서 즉시 노출
 * - **metadata** — 자유 형식 보조 정보 (UI 노출 X by default — 필요 시 detail
 *   영역에 JSON으로 보여줄 수 있음). 예: { size, uploadedAt, provider }
 */
export interface SystemAuditEvent {
  id: string;
  createdAt: string;
  actorRole: Role;
  actorLabel: string;
  category: AuditCategory;
  action: string;
  severity: AuditSeverity;
  targetType?: string;
  targetRef?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * `appendAuditEvent` 액션 입력 — id / createdAt / actorRole / actorLabel은
 * store가 자동 채움. 호출자는 의미적 필드만 제공.
 */
export type SystemAuditEventInput = Omit<
  SystemAuditEvent,
  "id" | "createdAt" | "actorRole" | "actorLabel"
>;

// ----------------------------------------------------------------------------
// Storage cap — localStorage quota 안전선
// ----------------------------------------------------------------------------

/**
 * 본 device의 audit log가 저장하는 최대 이벤트 수. 초과 시 oldest부터 FIFO
 * trim. 500 × ~300 bytes ≈ 150 KB — localStorage 5MB quota 대비 충분히 여유.
 *
 * 장기 보관이 필요한 환경에서는 향후 STEP에서 server-side audit log layer로
 * 별도 mirror — 본 STEP은 device-local 운영 기록만 다룸.
 */
export const MAX_AUDIT_EVENTS = 500;
