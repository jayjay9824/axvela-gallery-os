// ============================================================================
// System Audit Signals — STEP 84.
//
// `category: "system"` audit event를 발행하는 단일 entry point. 본 모듈은
// 다음 3가지 가드를 동시에 적용하여 *audit cap trim → 재발행 → 또 trim* 같은
// 무한 loop와 high-frequency spam을 방지함.
//
// **3-layer guard**:
//   1. Re-entry guard (`isEmitting` flag) — 동기 호출 중첩 차단.
//      예: `system_audit_capped` emit이 또 trim을 일으켜 emit을 호출하는 cycle.
//   2. Cooldown (per-action, 기본 5초 / 옵션 30초~) — 짧은 시간 내 동일 action 중복 차단.
//      예: 1분 동안 storage save가 100번 실패해도 audit는 12건 정도만 (5초 간격).
//   3. Session-once (옵션) — 환경 의존 신호 (예: BLOB env 부재) 는 device 세션
//      당 1회만 기록. env가 변하지 않는 한 반복 기록은 noise.
//
// **무한 loop 회피 핵심**: appendAuditEvent → saveAuditLog → trim 감지 →
// emitSystemAuditSignal → appendAuditEvent → saveAuditLog → 또 trim. 이 cycle은
// (A) re-entry guard가 두 번째 emit 호출 시 false 반환 + (B) `system_audit_capped`
// 의 sessionOnce 정책으로 추가 보호.
//
// **표현 정책 (사용자 spec STEP 84)**:
//   - 사용: "운영 참고" / "device-local" / "recoverable issue" /
//     "storage warning" / "fallback activated" / "system signal"
//   - 금지: "certified audit" / "tamper-proof" / "compliance guaranteed" /
//     "forensic record" / "legal audit trail"
//   - 모든 message는 부정형 disclaimer 호환 — 운영 참고용 / 신호 표현 only.
//
// **제약 (사용자 spec STEP 84)**:
//   - appendAuditEvent signature 변경 0줄 — 본 모듈은 store action을 그대로 호출.
//   - SystemAuditEvent schema 변경 0줄 — 기존 type 그대로 사용.
//   - server-side store 접근 0건 — 본 모듈은 client-side only (useArtworkStore
//     import 시점에 자연 차단). server API route는 응답 코드 / 에러 body로
//     클라이언트에 신호를 전달하면, 클라이언트(이 모듈)이 emit.
// ============================================================================

import type { AuditSeverity } from "@/types/audit-event";
import { useArtworkStore } from "@/store/useArtworkStore";

// ---------------------------------------------------------------------------
// Action names — `system_*` 접두 일관 (STEP 80 noun_verb_result convention)
// ---------------------------------------------------------------------------

export type SystemAuditAction =
  /** Audit log cap (MAX_AUDIT_EVENTS=500) trim 발생 — 가장 오래된 entry 손실 알림 */
  | "system_audit_capped"
  /** localStorage setItem 실패 (quota / 권한 / 비표준 환경) — recoverable */
  | "system_storage_save_failed"
  /** Vercel Blob env 부재 — fallback 활성, 외부 storage 미연결 신호 */
  | "system_blob_env_missing"
  /** Image upload 외부 provider 실패 → LocalPreview fallback 활성 */
  | "system_upload_fallback_activated";

// ---------------------------------------------------------------------------
// Dedup / cooldown state — module-level, session-scoped
// ---------------------------------------------------------------------------

/** Per-action 마지막 emit 시각 (ms). cooldown 비교용. */
const lastEmitTime: Map<SystemAuditAction, number> = new Map();
/** Session-once 정책 적용된 action set. emit 성공 시 add. */
const sessionOnceEmitted: Set<SystemAuditAction> = new Set();
/** Re-entry guard. true면 emit 호출 진행 중 → 중첩 호출 silent skip. */
let isEmitting = false;

const DEFAULT_COOLDOWN_MS = 5_000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface EmitSystemAuditOptions {
  /** 임의 부가 데이터. STEP 78 audit drilldown에서 표시 + STEP 83 export 포함. */
  metadata?: Record<string, unknown>;
  /**
   * Session-once 정책. true면 device 세션 동안 본 action은 1회만 emit.
   * 환경 의존 신호 (env 부재 / cap 도달 첫 시점) 등에 권장.
   */
  sessionOnce?: boolean;
  /**
   * Per-call cooldown override. 미지정 시 `DEFAULT_COOLDOWN_MS` (5초).
   * sessionOnce=true 시 cooldown은 무시 (sessionOnce가 더 강한 정책).
   */
  cooldownMs?: number;
  /** STEP 78 audit row의 "대상" 컬럼 표시용. 시스템 신호는 보통 부재. */
  targetType?: string;
  targetRef?: string;
}

/**
 * `category: "system"` audit event 발행. 3-layer guard 적용 후 store action
 * 호출. 발행 성공 시 true, dedup/cooldown/re-entry로 skip 시 false.
 *
 * **호출자 의무**:
 *   - 본 함수는 client-side에서만 호출 (server API route는 응답 body로 신호
 *     전달, 클라이언트 컴포넌트가 받아서 본 함수 호출)
 *   - 동일 action에 sessionOnce / cooldown 정책 일관 유지 — 한 곳은 sessionOnce,
 *     다른 곳은 5초 cooldown 같은 혼용 금지.
 *
 * **반환값 활용**: 일반적으로 무시. 디버깅 / 테스트에서 dedup 여부 확인용.
 */
export function emitSystemAuditSignal(
  action: SystemAuditAction,
  severity: AuditSeverity,
  message: string,
  options: EmitSystemAuditOptions = {}
): boolean {
  // ── Layer 1: Re-entry guard ────────────────────────────────────────────
  // appendAuditEvent → trim → emit → appendAuditEvent → trim → emit ...
  // recursion 차단. 외부 호출 → emit 진입 → store.appendAuditEvent 호출 →
  // (동기적으로) saveAuditLog → trim 감지 → store가 다시 emit 호출 시도 →
  // 본 가드가 false 반환 → 재귀 종료.
  if (isEmitting) return false;

  // ── Layer 2: Session-once 정책 ──────────────────────────────────────────
  if (options.sessionOnce && sessionOnceEmitted.has(action)) return false;

  // ── Layer 3: Per-action cooldown ────────────────────────────────────────
  // sessionOnce=true 인 경우 위 가드에서 이미 차단되므로 cooldown은 무관.
  const now = Date.now();
  const last = lastEmitTime.get(action) ?? 0;
  const window = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  if (now - last < window) return false;

  // ── 모든 가드 통과 — 실제 발행 ──────────────────────────────────────────
  isEmitting = true;
  try {
    useArtworkStore.getState().appendAuditEvent({
      category: "system",
      action,
      severity,
      message,
      metadata: options.metadata,
      targetType: options.targetType,
      targetRef: options.targetRef,
    });
    lastEmitTime.set(action, now);
    if (options.sessionOnce) sessionOnceEmitted.add(action);
    return true;
  } finally {
    // 가드 해제 — finally로 catch 분기에서도 안전.
    // store.appendAuditEvent 자체가 throw할 가능성은 낮지만 (silent storage
    // failure 정책) 방어적 처리.
    isEmitting = false;
  }
}

// ---------------------------------------------------------------------------
// Test / debug only — 운영 환경에서는 호출 금지 (export는 공개되지만 의도적
// underscore prefix로 internal API 신호)
// ---------------------------------------------------------------------------

/** 테스트 / 디버그 전용 — dedup state 초기화. 운영 코드에서 호출 금지. */
export function _resetSystemAuditSignalsForTest(): void {
  lastEmitTime.clear();
  sessionOnceEmitted.clear();
  isEmitting = false;
}
