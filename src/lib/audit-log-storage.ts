// ============================================================================
// Audit Log Storage — STEP 65.
//
// 별도 localStorage 키 (`axvela.audit.v1`)에 SystemAuditEvent[]를 영속화.
// **PersistedState 무관** — STEP 59 backup-metadata와 동일 정책 (분리 키 패턴):
//   - validateV1 / SCHEMA_VERSION 무영향
//   - JSON backup (STEP 52)에 포함되지 않음 — audit는 device-specific 운영 기록
//
// **운영 정책**:
//   - SSR-safe (`typeof window` 가드)
//   - 손상 데이터 silent fallback (빈 배열 반환) — 사용자 흐름 끊김 0
//   - storage quota 초과 등 극단 케이스 silent — 사용자 작업 영향 0
//   - cap (`MAX_AUDIT_EVENTS=500`) 초과 시 oldest FIFO trim
//   - 저장 순서: 최신이 배열 앞쪽 (index 0이 가장 최근)
//
// **device 간 동기화 안 됨** — STEP 30 remote sync는 PersistedState만 다룸.
// 본 audit는 *device-local 운영 기록*이라는 정확한 의미론.
// ============================================================================

import type { SystemAuditEvent } from "@/types/audit-event";
import { MAX_AUDIT_EVENTS } from "@/types/audit-event";

const AUDIT_STORAGE_KEY = "axvela.audit.v1";

// ----------------------------------------------------------------------------
// Public — load / save / append / clear
// ----------------------------------------------------------------------------

/**
 * Audit log 전체 load. SSR-safe. 손상 시 빈 배열 반환.
 *
 * shape 검증:
 *   - 배열인지
 *   - 각 entry가 최소 필수 필드 가지는지 (id / createdAt / category / severity)
 *   - 알 수 없는 category / severity는 통과시키되 UI에서 default 톤 적용
 *     (forward-compat — 향후 추가될 카테고리 무시 안 함)
 */
export function loadAuditLog(): SystemAuditEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const events: SystemAuditEvent[] = [];
    for (const item of parsed) {
      if (!isValidEventShape(item)) continue;
      events.push(item as SystemAuditEvent);
    }
    return events;
  } catch {
    return [];
  }
}

/**
 * Audit log 전체 저장. cap을 넘으면 앞쪽(최신) MAX_AUDIT_EVENTS만 유지.
 * 실패는 silent (storage quota 등) — 사용자 작업 흐름 영향 0.
 *
 * **STEP 84 — system audit 신호 hook**:
 *   - cap trim 발생 시 `__lastSaveDidTrim` 플래그 set.
 *   - localStorage setItem 실패 시 `__lastSaveFailed` 플래그 set.
 *   호출자(store.appendAuditEvent)가 저장 직후 `consume*Flag()` 로 폴링하여
 *   `system-audit-signals.emitSystemAuditSignal`을 호출. 본 모듈이 직접
 *   store/signals를 import하지 않는 이유는 *순환 의존성 회피*:
 *   `useArtworkStore → saveAuditLog (this)` 흐름 + `system-audit-signals →
 *   useArtworkStore` 흐름이 있어 본 모듈이 signals를 import하면 cycle.
 *   플래그 기반 inversion으로 cycle을 본 모듈에서 차단.
 */
export function saveAuditLog(events: SystemAuditEvent[]): void {
  if (typeof window === "undefined") return;
  const willTrim = events.length > MAX_AUDIT_EVENTS;
  const trimmed = willTrim ? events.slice(0, MAX_AUDIT_EVENTS) : events;
  try {
    window.localStorage.setItem(
      AUDIT_STORAGE_KEY,
      JSON.stringify(trimmed)
    );
    // STEP 84 — 저장 성공 + trim 발생 → 호출자가 system_audit_capped 발행
    if (willTrim) __lastSaveDidTrim = true;
  } catch {
    // STEP 84 — 저장 실패 → 호출자가 system_storage_save_failed 발행
    __lastSaveFailed = true;
    // 사용자 작업 흐름 영향 0 — 본 함수는 silent 유지 (rule_4 trust layer
    // graceful degradation). 단순 플래그 set으로 호출자가 후속 처리.
  }
}

// STEP 84 — 다음 두 플래그는 saveAuditLog 직후 consumer (store action) 가
// 폴링하여 system audit 신호 발행 결정. 단일 read & reset 패턴 — 같은 사건이
// 두 번 신호되지 않음.
let __lastSaveDidTrim = false;
let __lastSaveFailed = false;

/**
 * STEP 84 — `saveAuditLog` 직후 호출자가 trim 발생 여부 확인. read & reset.
 * 호출자(store.appendAuditEvent)가 true 응답 시 `system_audit_capped` 발행.
 */
export function consumeAuditLogTrimFlag(): boolean {
  if (__lastSaveDidTrim) {
    __lastSaveDidTrim = false;
    return true;
  }
  return false;
}

/**
 * STEP 84 — `saveAuditLog` 직후 호출자가 storage save 실패 여부 확인.
 * read & reset. 호출자(store.appendAuditEvent)가 true 응답 시
 * `system_storage_save_failed` 발행.
 */
export function consumeAuditLogSaveFailFlag(): boolean {
  if (__lastSaveFailed) {
    __lastSaveFailed = false;
    return true;
  }
  return false;
}

/**
 * 신규 event를 *최신* 위치 (index 0)에 추가하고 cap 적용. 결과 배열 반환 —
 * 호출자(store)가 그대로 set하면 됨.
 */
export function appendAuditEventToList(
  current: ReadonlyArray<SystemAuditEvent>,
  event: SystemAuditEvent
): SystemAuditEvent[] {
  const next = [event, ...current];
  if (next.length > MAX_AUDIT_EVENTS) {
    next.length = MAX_AUDIT_EVENTS;
  }
  return next;
}

/**
 * Audit log 전체 비우기. localStorage에서 키 자체 제거.
 * STEP 27 resetAllData와는 별개 (사용자가 명시적으로 "운영 로그 비움" 요청 시).
 */
export function clearAuditLog(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUDIT_STORAGE_KEY);
  } catch {
    // silent
  }
}

// ----------------------------------------------------------------------------
// Internal validation
// ----------------------------------------------------------------------------

function isValidEventShape(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  if (typeof obj.id !== "string" || obj.id === "") return false;
  if (typeof obj.createdAt !== "string" || obj.createdAt === "") return false;
  if (typeof obj.category !== "string") return false;
  if (typeof obj.severity !== "string") return false;
  if (typeof obj.action !== "string") return false;
  if (typeof obj.message !== "string") return false;
  // actorRole / actorLabel은 비어있어도 통과 (forward-compat — pre-RBAC seed)
  return true;
}
