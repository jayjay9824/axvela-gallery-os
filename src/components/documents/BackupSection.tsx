// ============================================================================
// BackupSection — STEP 52 / STEP 65 / STEP 81.
//
// 백업 다운로드 / 복원 업로드 UI. DocumentsDrawer footer 위 얇은 bar로 통합 —
// rule_15 max 3 buttons는 primary action 영역에만 적용, 본 utility bar는 별도.
//
// **STEP 81 — Backup / Restore Audit Integration**:
//   백업 / 복원 운영 활동을 system audit log (STEP 65)에 영속화. STEP 80
//   `noun_verb_result` naming convention 일관 적용.
//   - backup_export_success / backup_export_failed
//   - restore_read_failed (validation 단계 실패)
//   - restore_apply_cancelled (사용자 confirm 취소)
//   - restore_apply_pending  (apply 직전 — warning, reload 후에도 자취 보존)
//   - restore_apply_success  (apply 성공)
//   - restore_apply_failed   (apply 중 예외)
//
// **표현 정책 (사용자 spec STEP 81):**
//   - 사용: "운영 로그" / "백업 기록" / "복원 기록" / "운영 참고" / "시스템 기록"
//   - 금지: "legal archive" / "tamper-proof" / "forensic backup" /
//     "guaranteed recovery" / "certified backup"
// ============================================================================

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  downloadBackupJson,
  readBackupFile,
  applyImportedBackup,
  type BackupImportError,
} from "@/lib/backup-restore";
import { useArtworkStore } from "@/store/useArtworkStore";
import { computeBackupHealth, type BackupHealth } from "@/lib/backup-metadata";

type Status =
  | { kind: "idle" }
  | { kind: "exporting" }
  | { kind: "reading" }
  | { kind: "applying" }
  | { kind: "error"; message: string };

export function BackupSection() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });

  // STEP 59 — 백업 health computation. lastBackupAt 변경 시 자동 갱신.
  const lastBackupAt = useArtworkStore((s) => s.backupMetadata.lastBackupAt);
  const markBackupCompleted = useArtworkStore((s) => s.markBackupCompleted);
  // STEP 65 — System audit log integration. 백업 export / restore 운영 활동을
  // 시스템 운영 로그에 영속화. artwork timeline과는 별개 (artwork 무관 운영 이벤트).
  const appendAuditEvent = useArtworkStore((s) => s.appendAuditEvent);
  const health = React.useMemo(
    () => computeBackupHealth(lastBackupAt),
    [lastBackupAt]
  );

  // ── Export ───────────────────────────────────────────────────────────────
  // STEP 81 — `downloadBackupJson()` 이 outcome 객체를 반환하도록 확장됨.
  // ok=true 시 audit metadata (artworkCount / fileName / schemaVersion) 포함.
  const handleExport = React.useCallback(() => {
    setStatus({ kind: "exporting" });
    const outcome = downloadBackupJson();
    if (!outcome.ok) {
      const message =
        outcome.reason === "empty"
          ? "저장된 데이터가 없어 백업을 생성할 수 없습니다."
          : (outcome.message ??
            "백업 파일 생성 중 알 수 없는 오류가 발생했습니다.");
      setStatus({ kind: "error", message });
      // STEP 81 — 실패도 audit. severity error (사용자 spec 명시).
      appendAuditEvent({
        category: "backup",
        action: "backup_export_failed",
        severity: "error",
        message: `백업 export 실패 — ${message}`,
        metadata: {
          reason: outcome.reason,
          error: message,
        },
      });
      return;
    }
    // STEP 59 — 다운로드 성공 시 lastBackupAt 갱신 (store + localStorage 동시).
    markBackupCompleted();
    // STEP 81 — 운영 기록 추가. 사용자 spec metadata 정확 매칭.
    //   exportedAt / artworkCount / fileName / schemaVersion.
    //   customerCount는 의도적으로 omit (spec "if available" — Customer는
    //   derived entity, persistence layer를 derived domain logic에 결합시키지
    //   않기 위해 backup-restore.ts에 customer-aggregates 의존성 추가 회피).
    appendAuditEvent({
      category: "backup",
      action: "backup_export_success",
      severity: "info",
      message: `백업 JSON 파일 export 완료 (${outcome.artworkCount}점)`,
      metadata: {
        exportedAt: outcome.exportedAt,
        artworkCount: outcome.artworkCount,
        fileName: outcome.fileName,
        schemaVersion: outcome.schemaVersion,
      },
    });
    setStatus({ kind: "idle" });
  }, [markBackupCompleted, appendAuditEvent]);

  // ── Import ───────────────────────────────────────────────────────────────
  const handleClickImport = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // 같은 파일 다시 선택 가능하도록 input 초기화 (선택 자체를 trigger하기 위함)
      e.target.value = "";

      setStatus({ kind: "reading" });
      const result = await readBackupFile(file);

      if (!result.ok) {
        setStatus({ kind: "error", message: errorMessage(result.error) });
        // STEP 81 — 파일 검증 실패 운영 기록.
        // pending 단계 이전 read 실패라 별도 action 사용 (apply_pending과 분리).
        // severity warning — 사용자가 잘못된 파일을 고른 통상 케이스 (system error 아님).
        appendAuditEvent({
          category: "restore",
          action: "restore_read_failed",
          severity: "warning",
          message: `백업 파일 검증 실패: ${errorMessage(result.error)}`,
          metadata: {
            error: errorMessage(result.error),
            errorKind: result.error.kind,
          },
        });
        return;
      }

      // confirm dialog (사용자 spec 명시)
      const proceed = window.confirm(
        [
          "기존 데이터가 모두 덮어씌워집니다. 계속하시겠습니까?",
          "",
          `백업 요약: ${result.summary}`,
          `저장 시각: ${formatHumanDate(result.state.savedAt)}`,
          "",
          "이 작업은 되돌릴 수 없습니다. 현재 데이터를 먼저 백업하셨는지 확인해주세요.",
        ].join("\n")
      );

      if (!proceed) {
        setStatus({ kind: "idle" });
        // STEP 81 — 사용자 cancel은 의도적 안전 행동. info 톤 유지.
        appendAuditEvent({
          category: "restore",
          action: "restore_apply_cancelled",
          severity: "info",
          message: "복원 confirm 취소 — 기존 데이터 유지",
          metadata: {
            cancelledAt: new Date().toISOString(),
            backupSavedAt: result.state.savedAt,
          },
        });
        return;
      }

      // STEP 81 — 사용자 spec "Before restore apply" 이벤트.
      // applyImportedBackup 직전에 pending audit 영속화 — window.location.reload()
      // 후에도 운영 기록에 그대로 남아 운영자가 *이 device에서 복원이 시도되었음*을
      // retrospective 확인 가능. saveAuditLog는 axvela.audit.v1 별도 키라 backup
      // 파일이 덮어쓰는 axvela.persist.v1과 분리 — pending 이벤트는 reload 후에도
      // 안전 보존.
      const pendingAt = new Date().toISOString();
      appendAuditEvent({
        category: "restore",
        action: "restore_apply_pending",
        severity: "warning",
        message: `복원 적용 시작 — ${result.summary}`,
        metadata: {
          importedAt: pendingAt,
          detectedSchemaVersion: result.state.version,
          incomingArtworkCount: result.state.artworks.length,
          backupSavedAt: result.state.savedAt,
        },
      });

      setStatus({ kind: "applying" });
      try {
        applyImportedBackup(result.state);
        // STEP 81 — 복원 적용 성공 audit. severity info, 사용자 spec metadata 매칭.
        appendAuditEvent({
          category: "restore",
          action: "restore_apply_success",
          severity: "info",
          message: `백업 복원 적용 완료 — ${result.summary}`,
          metadata: {
            restoredAt: new Date().toISOString(),
            restoredArtworkCount: result.state.artworks.length,
            backupSavedAt: result.state.savedAt,
          },
        });
      } catch (err) {
        const errMessage =
          err instanceof Error ? err.message : "알 수 없는 오류";
        setStatus({
          kind: "error",
          message: `복원 적용 중 오류가 발생했습니다: ${errMessage}`,
        });
        // STEP 81 — 복원 실패 audit. severity error.
        appendAuditEvent({
          category: "restore",
          action: "restore_apply_failed",
          severity: "error",
          message: `복원 적용 중 오류 발생: ${errMessage}`,
          metadata: {
            error: errMessage,
          },
        });
        return;
      }

      // 사용자 spec: 성공 시 window.location.reload()
      // PersistenceProvider가 마운트 시 load → store 동기화하는 흐름 자연 활용.
      // STEP 65/81 audit는 axvela.audit.v1 별도 키라 reload 후에도 보존 — 운영자가
      // pending + success 두 이벤트로 복원 흐름 retrospective 확인 가능.
      window.location.reload();
    },
    [appendAuditEvent]
  );

  const isBusy =
    status.kind === "exporting" ||
    status.kind === "reading" ||
    status.kind === "applying";

  return (
    <div className="border-t border-line bg-surface-muted/40 px-6 py-2.5 shrink-0">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
            데이터 백업 / 복원
          </span>
          <span className="text-[10.5px] text-ink-subtle tracking-tightish">
            전체 데이터를 JSON 파일로 저장 / 복원합니다. 다른 PC / 브라우저로
            이동 시 사용.
          </span>
          {/* STEP 59 — 백업 health indicator. 절제된 톤으로 노출. */}
          <BackupHealthRow health={health} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status.kind === "error" && (
            <span
              role="alert"
              className="text-[10.5px] text-status-deal tracking-tightish max-w-[280px] truncate"
              title={status.message}
            >
              ⚠ {status.message}
            </span>
          )}
          {(status.kind === "reading" ||
            status.kind === "applying" ||
            status.kind === "exporting") && (
            <span className="text-[10.5px] text-ink-subtle tracking-tightish italic">
              {statusLabel(status)}
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void handleFileSelected(e)}
          />
          <BackupButton
            label="백업 다운로드"
            onClick={handleExport}
            disabled={isBusy}
          />
          <BackupButton
            label="복원 업로드"
            onClick={handleClickImport}
            disabled={isBusy}
          />
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function BackupButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={cn(
        "h-7 px-2.5 rounded-md text-[11px] tracking-tightish border transition-colors",
        disabled
          ? "bg-surface text-ink-subtle border-line cursor-not-allowed opacity-50"
          : "bg-surface text-ink border-line hover:bg-canvas hover:border-line-strong"
      )}
    >
      {label}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function statusLabel(status: Status): string {
  switch (status.kind) {
    case "exporting":
      return "백업 생성 중...";
    case "reading":
      return "파일 읽는 중...";
    case "applying":
      return "복원 적용 중...";
    default:
      return "";
  }
}

function errorMessage(err: BackupImportError): string {
  return err.message;
}

function formatHumanDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

// ----------------------------------------------------------------------------
// BackupHealthRow — STEP 59
//
// 절제된 톤의 인라인 indicator. health.level별 색상 분기:
//   - never   : neutral muted (사용자에게 권장 환기)
//   - fresh   : neutral (정상 — 강조 부재)
//   - stale   : status-inquiry (amber, 7일 이상)
//   - expired : status-deal (red, 30일 이상 — 데이터 손실 위험)
// 사용자 spec: "경고 색상은 절제된 톤으로" — 모두 작은 typography + 밑줄 부재.
// ----------------------------------------------------------------------------

function BackupHealthRow({ health }: { health: BackupHealth }) {
  const colorClass = healthColorClass(health.level);
  return (
    <span
      className={cn(
        "text-[10px] tracking-tightish italic leading-snug pt-0.5",
        colorClass
      )}
      title={health.description}
    >
      {health.label}
      {health.level === "stale" && (
        <span className="not-italic ml-1.5">· 백업 갱신 권장</span>
      )}
      {health.level === "expired" && (
        <span className="not-italic ml-1.5">· 데이터 손실 위험</span>
      )}
    </span>
  );
}

function healthColorClass(level: BackupHealth["level"]): string {
  switch (level) {
    case "never":
      return "text-ink-subtle";
    case "fresh":
      return "text-ink-subtle";
    case "stale":
      return "text-status-inquiry";
    case "expired":
      return "text-status-deal";
  }
}
