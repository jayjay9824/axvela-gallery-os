// ============================================================================
// Backup Metadata Storage — STEP 59.
//
// 백업 알림 / health indicator를 위한 가벼운 metadata layer. **도메인 데이터와
// 완전 분리** — 별도 localStorage 키 (`axvela.backup.metadata.v1`)에 저장.
//
// 분리 이유 (사용자 spec):
//   - Persistence schema (PersistedState / validateV1 / SCHEMA_VERSION) 변경 0줄
//   - 도메인 데이터(작품/거래/문서 등)와 별개의 UI metadata
//   - JSON 백업 파일에 lastBackupAt이 들어가지 않음 — 복원 시 새 디바이스의
//     백업 카운트가 자동 리셋되어 자연스럽게 "백업 미실행" 상태로 시작
//
// **표현 정책**: "최근 백업" / "백업 미실행" 사용. "데이터 보장" / "법적 효력"
// 표현 0건.
// ============================================================================

const BACKUP_METADATA_KEY = "axvela.backup.metadata.v1";

export interface BackupMetadata {
  /**
   * 가장 최근 백업 다운로드 성공 시각 (ISO datetime).
   * null = 한 번도 백업하지 않음 (또는 다른 디바이스에서 복원된 직후).
   */
  lastBackupAt: string | null;
}

const EMPTY_METADATA: BackupMetadata = { lastBackupAt: null };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Metadata 읽기. SSR-safe (`typeof window` 가드). 손상된 데이터 / parse 실패는
 * silent fallback (EMPTY_METADATA 반환) — 사용자 경험 끊김 0.
 */
export function loadBackupMetadata(): BackupMetadata {
  if (typeof window === "undefined") return EMPTY_METADATA;
  try {
    const raw = window.localStorage.getItem(BACKUP_METADATA_KEY);
    if (!raw) return EMPTY_METADATA;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "lastBackupAt" in parsed &&
      (typeof (parsed as { lastBackupAt: unknown }).lastBackupAt === "string" ||
        (parsed as { lastBackupAt: unknown }).lastBackupAt === null)
    ) {
      return {
        lastBackupAt: (parsed as BackupMetadata).lastBackupAt,
      };
    }
    return EMPTY_METADATA;
  } catch {
    return EMPTY_METADATA;
  }
}

/**
 * Metadata 저장. 실패해도 silent — 사용자 흐름 끊김 0 (storage quota 초과 등
 * 극단 케이스에서도 백업 자체 흐름은 이미 성공한 상태).
 */
export function saveBackupMetadata(metadata: BackupMetadata): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      BACKUP_METADATA_KEY,
      JSON.stringify(metadata)
    );
  } catch {
    // silent — localStorage 실패는 시스템 동작에 영향 없음
  }
}

/**
 * 백업 다운로드 성공 시 호출. 현재 시각으로 lastBackupAt 갱신.
 */
export function markBackupCompleted(): BackupMetadata {
  const next: BackupMetadata = {
    lastBackupAt: new Date().toISOString(),
  };
  saveBackupMetadata(next);
  return next;
}

/**
 * STEP 27 reset / data clear 시 함께 비우기 위한 helper.
 * 본 STEP은 reset 흐름 변경하지 않음 — 향후 STEP에서 호출 가능.
 */
export function clearBackupMetadata(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BACKUP_METADATA_KEY);
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// Backup health computation — UI에서 직접 사용
// ---------------------------------------------------------------------------

export type BackupHealthLevel = "never" | "fresh" | "stale" | "expired";

export interface BackupHealth {
  level: BackupHealthLevel;
  /** 한국어 짧은 라벨 — Sidebar indicator + BackupSection에서 노출 */
  label: string;
  /**
   * 사용자에게 추가 컨텍스트 (Sidebar tooltip / BackupSection 부가 텍스트).
   * "한 번도 백업하지 않았습니다" / "최근 백업: 12일 전 · 7일 이상 — 권장: 백업 갱신"
   */
  description: string;
  /** N일 전 — 정수 (오늘이면 0). lastBackupAt 부재 시 null. */
  daysSince: number | null;
}

/**
 * 7일 이상 → stale (amber), 30일 이상 → expired (red).
 * 사용자 spec 명시 임계값.
 */
const STALE_THRESHOLD_DAYS = 7;
const EXPIRED_THRESHOLD_DAYS = 30;

/**
 * 결정성 함수 — `lastBackupAt` + `now` (테스트 가능 — `now` 주입 가능).
 * 호출자는 보통 `computeBackupHealth(metadata.lastBackupAt)` 형태로 사용.
 */
export function computeBackupHealth(
  lastBackupAt: string | null,
  now: Date = new Date()
): BackupHealth {
  if (!lastBackupAt) {
    return {
      level: "never",
      label: "백업 미실행",
      description:
        "데이터를 보호하려면 정기적으로 백업하세요. 다른 디바이스 / 브라우저에서 복원할 때도 백업 파일이 필요합니다.",
      daysSince: null,
    };
  }

  const last = new Date(lastBackupAt);
  if (Number.isNaN(last.getTime())) {
    // 손상된 timestamp — fresh로 폴백 (사용자 흐름 끊김 0)
    return {
      level: "fresh",
      label: "최근 백업",
      description: "백업 시각 기록이 손상되었으나 백업은 수행되었습니다.",
      daysSince: null,
    };
  }

  const diffMs = now.getTime() - last.getTime();
  const daysSince = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (daysSince >= EXPIRED_THRESHOLD_DAYS) {
    return {
      level: "expired",
      label: `백업 ${daysSince}일 전`,
      description: `30일 이상 백업하지 않았습니다. 데이터 손실 위험이 큽니다 — 즉시 백업 갱신을 권장합니다.`,
      daysSince,
    };
  }

  if (daysSince >= STALE_THRESHOLD_DAYS) {
    return {
      level: "stale",
      label: `백업 ${daysSince}일 전`,
      description: `${daysSince}일 이상 백업하지 않았습니다. 백업 갱신을 권장합니다.`,
      daysSince,
    };
  }

  if (daysSince === 0) {
    return {
      level: "fresh",
      label: "백업: 오늘",
      description: "오늘 백업했습니다.",
      daysSince: 0,
    };
  }

  return {
    level: "fresh",
    label: `백업 ${daysSince}일 전`,
    description: `${daysSince}일 전 백업했습니다.`,
    daysSince,
  };
}

// ---------------------------------------------------------------------------
// Test helpers (사용자 spec 검증 항목 — 7일 / 30일 mock 상태 테스트 가능)
// ---------------------------------------------------------------------------

/**
 * 개발 / 검증용 — 임의 시점으로 lastBackupAt을 강제 설정.
 * 사용자 spec 명시: "7일 이상 mock 상태 테스트 가능 / 30일 이상 mock 상태
 * 테스트 가능". 운영 코드에서는 호출 0건. 콘솔에서 직접 호출 가능.
 *
 * 사용 예:
 *   import { _setBackupMetadataForTest } from "@/lib/backup-metadata";
 *   _setBackupMetadataForTest({ daysAgo: 10 });  // 10일 전으로 mock
 *   _setBackupMetadataForTest({ daysAgo: 35 });  // 35일 전 (expired)
 *   _setBackupMetadataForTest({ daysAgo: null }); // 미실행 상태로
 */
export function _setBackupMetadataForTest(opts: {
  daysAgo: number | null;
}): void {
  if (opts.daysAgo === null) {
    clearBackupMetadata();
    return;
  }
  const past = new Date();
  past.setDate(past.getDate() - opts.daysAgo);
  saveBackupMetadata({ lastBackupAt: past.toISOString() });
}
