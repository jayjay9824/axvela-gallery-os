// ============================================================================
// Backup / Restore — STEP 52.
//
// localStorage에 저장된 PersistedState를 JSON 파일로 export / import하는 helper.
// 서버 없이 다른 PC / 다른 브라우저로 데이터 이동 가능.
//
// **보안 정책 (사용자 spec):**
//   - JSON.parse만 사용 — 함수 / Symbol / undefined 자연 제거 (eval 0건)
//   - validateV1 + sanitizeImportedState 2단계 검증 — 알려진 키 화이트리스트만 통과
//   - 예상치 못한 top-level key는 자동 폐기 (sanitize에서 새 object 재구성)
//
// **제약 (사용자 spec):**
//   - Persistence schema 변경 0줄 — 기존 PersistedState shape / SCHEMA_VERSION 그대로
//   - validateV1 그대로 사용 — 본 모듈은 hydrate 검증과 같은 함수 호출
//   - 도메인 로직 0줄 — 본 모듈은 read/write adapter 호출만
//   - 외부 API 호출 0건 — Blob / FileReader / URL.createObjectURL만 사용
//   - 신규 라이브러리 0개
// ============================================================================

import {
  type PersistedState,
  validateV1ForImport,
  sanitizeImportedState,
  getActiveAdapter,
  SCHEMA_VERSION,
} from "./persistence";

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

export type BackupImportError =
  | { kind: "not_json"; message: string }
  | { kind: "schema_mismatch"; message: string }
  | { kind: "version_mismatch"; message: string; foundVersion: unknown }
  | { kind: "read_failed"; message: string };

export interface BackupImportSuccess {
  ok: true;
  state: PersistedState;
  /** 한국어 요약 — confirm dialog / toast에 표시 */
  summary: string;
}

export interface BackupImportFailure {
  ok: false;
  error: BackupImportError;
}

export type BackupImportResult = BackupImportSuccess | BackupImportFailure;

// ----------------------------------------------------------------------------
// Filename helper
// ----------------------------------------------------------------------------

export function buildBackupFilename(generatedAt: string): string {
  const d = new Date(generatedAt);
  const stamp = Number.isNaN(d.getTime())
    ? "unknown"
    : `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
  return `axvela-backup-${stamp}.json`;
}

// ----------------------------------------------------------------------------
// Export — current PersistedState → JSON file download
//
// **STEP 81 — return type 확장**:
// 단순 `boolean` → 풍부한 outcome 객체. 호출자(BackupSection)가 이 outcome으로
// system audit event metadata를 채울 수 있게 함. JSON 파일 자체는 한 byte도
// 변경되지 않음 (사용자 spec "Do NOT change backup file format" 준수).
// ----------------------------------------------------------------------------

/**
 * STEP 81 — export 결과 outcome.
 *
 * - **ok=true**: 파일 download 트리거 성공. metadata는 audit append용 풍부 정보.
 *   `customerCount`는 의도적으로 미포함 — Customer는 derived entity (STEP 42)이며
 *   본 모듈에 customer-aggregates 의존성을 추가하면 persistence layer를 derived
 *   domain logic에 결합시키게 됨. 사용자 spec의 "if available" 조건에 맞게 omit.
 * - **ok=false, reason="empty"**: adapter.load()가 null (저장된 데이터 부재).
 * - **ok=false, reason="write_failed"**: Blob / URL.createObjectURL / DOM trigger
 *   중 예외 발생. 운영 환경에서는 거의 일어나지 않는 케이스 (브라우저 storage
 *   quota, 권한 거부 등) — 안전 가드.
 */
export type BackupExportOutcome =
  | {
      ok: true;
      fileName: string;
      artworkCount: number;
      schemaVersion: typeof SCHEMA_VERSION;
      exportedAt: string;
    }
  | {
      ok: false;
      reason: "empty" | "write_failed";
      message?: string;
    };

/**
 * 현재 localStorage에 저장된 PersistedState를 JSON 파일로 다운로드.
 *
 * **호출 시점**: 사용자가 "백업 다운로드" 클릭. 호출자는 store에 직접 접근하지
 * 않고 active adapter를 통해 가장 최근 저장 state를 그대로 사용.
 *
 * **결과 없음 (저장 자체가 빈 상태)일 경우 silent no-op** — 호출자가 alert.
 *
 * @returns BackupExportOutcome — STEP 81 audit append용 metadata 포함.
 */
export function downloadBackupJson(): BackupExportOutcome {
  const state = getActiveAdapter().load();
  if (!state) return { ok: false, reason: "empty" };

  const exportedAt = new Date().toISOString();
  const fileName = buildBackupFilename(exportedAt);

  try {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    triggerDownload(blob, fileName);
  } catch (err) {
    return {
      ok: false,
      reason: "write_failed",
      message:
        err instanceof Error
          ? err.message
          : "백업 파일 생성 중 알 수 없는 오류",
    };
  }

  return {
    ok: true,
    fileName,
    artworkCount: state.artworks.length,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
  };
}

// ----------------------------------------------------------------------------
// Import — JSON file → validated PersistedState (NOT yet applied)
// ----------------------------------------------------------------------------

/**
 * 사용자가 선택한 파일을 읽고 검증. **여기서는 영속화하지 않음** — 호출자가
 * confirm dialog 후 `applyImportedBackup()`을 별도 호출.
 *
 * 단계:
 *   1. FileReader로 text 읽기 (실패 → read_failed)
 *   2. JSON.parse (실패 → not_json)
 *   3. version 필드 빠른 체크 (mismatch → version_mismatch)
 *   4. validateV1ForImport (필수 key 누락 → schema_mismatch)
 *   5. sanitizeImportedState (예상치 못한 key 제거)
 *
 * **모든 에러는 reject 대신 normalize된 BackupImportError로** — uncaught
 * promise 0.
 */
export async function readBackupFile(file: File): Promise<BackupImportResult> {
  // 1. Read text
  let text: string;
  try {
    text = await readFileAsText(file);
  } catch {
    return {
      ok: false,
      error: { kind: "read_failed", message: "파일을 읽을 수 없습니다." },
    };
  }

  // 2. JSON.parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: {
        kind: "not_json",
        message:
          "JSON 형식이 아니거나 손상된 파일입니다. AXVELA backup 파일이 맞는지 확인해주세요.",
      },
    };
  }

  // 3. Version 빠른 체크 — 향후 v2 backup이 v1으로 들어오는 케이스 차단
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "version" in parsed &&
    (parsed as { version: unknown }).version !== SCHEMA_VERSION
  ) {
    return {
      ok: false,
      error: {
        kind: "version_mismatch",
        message: `백업 schema 버전이 현재 시스템과 다릅니다 (현재: ${SCHEMA_VERSION}). 마이그레이션이 필요합니다.`,
        foundVersion: (parsed as { version: unknown }).version,
      },
    };
  }

  // 4. Required keys validation
  const validated = validateV1ForImport(parsed);
  if (!validated) {
    return {
      ok: false,
      error: {
        kind: "schema_mismatch",
        message:
          "필수 데이터 슬라이스가 누락되었거나 손상되었습니다. AXVELA backup 파일이 맞는지 확인해주세요.",
      },
    };
  }

  // 5. Sanitize — 예상치 못한 top-level key 제거
  const sanitized = sanitizeImportedState(validated);

  return {
    ok: true,
    state: sanitized,
    summary: buildSummary(sanitized),
  };
}

/**
 * 검증된 state를 영속화. 호출자가 `readBackupFile()` 결과의 ok=true를 확인하고
 * confirm dialog를 거친 뒤에만 호출해야 함.
 *
 * 이 함수는 **store와 무관** — adapter에 직접 save. 호출자는 적용 후
 * `window.location.reload()`로 새 상태 hydrate하는 흐름 권장 (PersistenceProvider
 * 가 첫 마운트에서 load → store 동기화).
 */
export function applyImportedBackup(state: PersistedState): void {
  getActiveAdapter().save(state);
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("not text"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsText(file);
  });
}

function buildSummary(state: PersistedState): string {
  const counts = [
    `작품 ${state.artworks.length}`,
    `거래 ${countNested(state.transactions)}`,
    `인보이스 ${countNested(state.invoices)}`,
    `결제 ${countNested(state.payments)}`,
    `정산 ${countNested(state.settlements)}`,
    `세금 ${countNested(state.taxRecords)}`,
    `계약서 ${countNested(state.contracts)}`,
    `Logistics ${countNested(state.logistics)}`,
    `검수 ${countNested(state.conditionReports)}`,
  ];
  return counts.join(" · ");
}

function countNested<T>(record: Record<string, T[]>): number {
  let total = 0;
  for (const list of Object.values(record)) total += list.length;
  return total;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
