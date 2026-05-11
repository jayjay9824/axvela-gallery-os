// ============================================================================
// ImageCleanupDrawer — STEP 62 / STEP 80.
//
// OWNER 전용 admin tool. 외부 저장소(Vercel Blob) inspection + orphan candidate
// review + remove request. read-only by default — 사용자가 명시 클릭한 단일
// orphan에 대해서만 remove 요청 (사용자 spec "Do NOT create destructive bulk
// delete UX" 준수).
//
// **흐름:**
//   1. drawer 열기 → fetchListImages 호출 (loading state)
//   2. server에서 artworks/ prefix scope의 blob 목록 + 메타데이터 응답
//   3. detectOrphanedBlobImages(artworks, blobPathnames)로 orphan 추출
//   4. 요약 카드 (image count / storage usage / orphan count / last upload) 노출
//   5. orphan 목록 표시 + 각 row에 [제거 요청] 버튼
//   6. STEP 80 — 클릭 시 Modal 기반 confirmation 다이얼로그 (안전 표현)
//   7. 확인 시 POST /api/delete-image 재사용 → System Audit Event 누적 →
//      drawer-scoped sessionLog 누적 → 자동 새로고침 → orphan count 갱신
//
// **표현 정책 (사용자 spec):**
//   - "외부 저장소" / "정리 검토" / "orphan 후보" / "storage 사용량" /
//     "제거 요청" / "최근 업로드" / "요청 완료" / "요청 실패"
//   - "영구 삭제" / "완전 제거 보장" / "법적 보관" / "되돌릴 수 없는 삭제"
//     표현 0건
//
// **STEP 80 audit action 명명**:
//   - 성공: "orphan_remove_request_success" (severity: info)
//   - 실패: "orphan_remove_request_failed"  (severity: error)
//   STEP 62의 단일 "orphan.remove" + severity 분기에서, 의미를 action 자체에
//   명시하는 형태로 정련. AuditLogViewerDrawer는 action을 verbatim 표시 →
//   소비자 contract 변경 0건.
//
// **UI 원칙 (사용자 spec):**
//   - institutional minimalism
//   - text-first operational UI
//   - existing AXVELA OS visual system
//   - no visual redesign
//   - rule_17 layer UI: drawer 위 Modal layer (레이아웃 변경 없음)
// ============================================================================

"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import { hasPermission } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { ClickableMetric } from "@/components/drilldown/ClickableMetric";
// STEP 84 — env_missing 감지 시 system audit 발행
import { emitSystemAuditSignal } from "@/lib/system-audit-signals";
import {
  detectOrphanedBlobImages,
  computeImageStorageSummary,
} from "@/lib/image-thumbnail";
import {
  fetchListImages,
  requestRemoveBlob,
  type RemoteBlobSummary,
  type ListImagesResult,
  type RemoveImageResult,
} from "@/lib/image-cleanup-api";
import type { Artwork } from "@/types/artwork";

// ============================================================================
// Drawer wrapper
// ============================================================================

export function ImageCleanupDrawer() {
  const request = useArtworkStore((s) => s.imageCleanupRequest);
  const close = useArtworkStore((s) => s.closeImageCleanup);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const isAllowed = hasPermission(currentRole, "image.cleanup_review");
  const isOpen = request.kind === "open" && isAllowed;

  return (
    <Drawer
      open={isOpen}
      onClose={close}
      title="이미지 정리 검토"
      widthClass="w-[760px]"
    >
      {isOpen && <CleanupBody onClose={close} />}
    </Drawer>
  );
}

// ============================================================================
// Body
// ============================================================================

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; result: ListImagesResult; loadedAt: string }
  | { kind: "error"; message: string };

interface SessionLogEntry {
  pathname: string;
  /** 처리 결과 — UI에 작은 라벨로 누적 표시 */
  status: "ok" | "fail";
  message: string;
  at: string;
}

type ConfirmRequest =
  | { kind: "idle" }
  | { kind: "open"; blob: RemoteBlobSummary };

function CleanupBody({ onClose }: { onClose: () => void }) {
  const artworks = useArtworkStore((s) => s.artworks);

  const [loadState, setLoadState] = React.useState<LoadState>({ kind: "idle" });
  // session log — drawer가 닫혔다 열리면 reset (의도 — 매 inspection이 독립)
  const [sessionLog, setSessionLog] = React.useState<SessionLogEntry[]>([]);
  // 진행 중인 pathname (중복 클릭 방어)
  const [busyPaths, setBusyPaths] = React.useState<Set<string>>(new Set());
  // STEP 80 — Modal 기반 confirmation 상태. native window.confirm 대체.
  const [confirmRequest, setConfirmRequest] = React.useState<ConfirmRequest>({
    kind: "idle",
  });

  // mount 시 1회 자동 fetch
  React.useEffect(() => {
    void runFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runFetch = React.useCallback(async () => {
    setLoadState({ kind: "loading" });
    const result = await fetchListImages();
    setLoadState({
      kind: "loaded",
      result,
      loadedAt: new Date().toISOString(),
    });
    // STEP 84 — env_missing은 인프라 설정 누락 신호. sessionOnce로 device 세션
    // 동안 1회만 기록 — env가 변하지 않는 한 반복 기록은 noise. severity warning
    // (recoverable issue — Vercel Blob 미연결이지만 LocalPreview fallback 보장).
    if (!result.ok && result.error.kind === "env_missing") {
      emitSystemAuditSignal(
        "system_blob_env_missing",
        "warning",
        "외부 storage 미연결 — Vercel Blob 환경변수 부재 (LocalPreview fallback 활성)",
        {
          sessionOnce: true,
          metadata: {
            detectedAt: new Date().toISOString(),
            errorMessage: result.error.message,
          },
        }
      );
    }
  }, []);

  const appendAuditEvent = useArtworkStore((s) => s.appendAuditEvent);

  // STEP 80 — row 클릭 → Modal open. 실제 API 호출은 executeRemove에서 수행.
  const handleRequestRemove = React.useCallback(
    (blob: RemoteBlobSummary) => {
      if (busyPaths.has(blob.pathname)) return;
      setConfirmRequest({ kind: "open", blob });
    },
    [busyPaths]
  );

  const handleCloseConfirm = React.useCallback(() => {
    setConfirmRequest({ kind: "idle" });
  }, []);

  // STEP 80 — confirm 후 실제 remove 요청 처리. STEP 62의 핵심 흐름을 보존하고
  // 다음만 정련:
  //   - audit action: "orphan_remove_request_success" / "orphan_remove_request_failed"
  //   - 실패 metadata: errorStatus → error (안전한 message 문자열)
  const executeRemove = React.useCallback(
    async (blob: RemoteBlobSummary) => {
      const { pathname } = blob;
      if (busyPaths.has(pathname)) return;

      // confirm 닫기 — 진행 중 indicator는 row의 disabled 상태로 표현
      setConfirmRequest({ kind: "idle" });

      setBusyPaths((prev) => {
        const next = new Set(prev);
        next.add(pathname);
        return next;
      });

      const result = await requestRemoveBlob(pathname);
      const at = new Date().toISOString();
      const entry: SessionLogEntry = result.ok
        ? {
            pathname,
            status: "ok",
            message: "외부 저장소에서 제거 요청 완료",
            at,
          }
        : {
            pathname,
            status: "fail",
            message: result.error.message,
            at,
          };

      setSessionLog((prev) => [entry, ...prev]);

      // STEP 65 / STEP 80 — System audit event 추가.
      // - 성공: action="orphan_remove_request_success", severity="info"
      // - 실패: action="orphan_remove_request_failed",  severity="error"
      // sessionLog는 즉시 UI 피드백, audit event는 device-local 영속 운영 기록.
      if (result.ok) {
        appendAuditEvent({
          category: "image_storage",
          action: "orphan_remove_request_success",
          severity: "info",
          targetType: "blob",
          targetRef: pathname,
          message: `orphan candidate 제거 요청 완료 — ${pathname}`,
          metadata: {
            pathname,
            size: blob.size,
            uploadedAt: blob.uploadedAt,
            provider: "vercel_blob",
          },
        });
      } else {
        appendAuditEvent({
          category: "image_storage",
          action: "orphan_remove_request_failed",
          severity: "error",
          targetType: "blob",
          targetRef: pathname,
          message: `orphan candidate 제거 요청 실패 — ${result.error.message}`,
          metadata: {
            pathname,
            error: result.error.message,
            provider: "vercel_blob",
          },
        });
      }

      setBusyPaths((prev) => {
        const next = new Set(prev);
        next.delete(pathname);
        return next;
      });

      // 성공 시 자동 재조회 — orphan 목록 즉시 갱신 (사용자 흐름 자연스러움)
      if (result.ok) {
        await runFetch();
      }
    },
    [busyPaths, runFetch, appendAuditEvent]
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Header summary + actions ────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-3 border-b border-line shrink-0 flex flex-col gap-3">
        <SummarySection
          loadState={loadState}
          artworks={artworks}
          onRefresh={runFetch}
        />
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean">
        <BodyView
          loadState={loadState}
          artworks={artworks}
          busyPaths={busyPaths}
          onRemove={handleRequestRemove}
          sessionLog={sessionLog}
        />
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-line px-6 py-3 shrink-0 flex items-center justify-between bg-surface">
        <span className="text-[10.5px] text-ink-subtle italic tracking-tightish">
          Owner 전용 · 외부 저장소 inspection · read-only by default
        </span>
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </footer>

      {/* ── STEP 80 — Confirmation Modal (rule_17 layer UI) ───────────────── */}
      <RemoveRequestConfirmModal
        request={confirmRequest}
        onCancel={handleCloseConfirm}
        onConfirm={executeRemove}
      />
    </div>
  );
}

// ============================================================================
// STEP 80 — Remove Request Confirmation Modal
//
// 외부 저장소 제거 요청에 대한 안전 confirmation. 다음 표현 정책 준수:
//   - 사용: "외부 저장소" / "제거 요청" / "orphan 후보" / "운영 참고"
//   - 금지: "영구 삭제" / "완전 삭제" / "되돌릴 수 없는" / "guaranteed"
//
// 본 다이얼로그는 결과 보장 표현을 사용하지 않고, "외부 저장소에 보내는
// 요청"임을 명시 — 외부 시스템의 응답에 대한 과대 약속을 회피.
// ============================================================================

function RemoveRequestConfirmModal({
  request,
  onCancel,
  onConfirm,
}: {
  request: ConfirmRequest;
  onCancel: () => void;
  onConfirm: (blob: RemoteBlobSummary) => void;
}) {
  const isOpen = request.kind === "open";
  const blob = request.kind === "open" ? request.blob : null;

  return (
    <Modal
      open={isOpen}
      onClose={onCancel}
      title="제거 요청 확인"
      footer={
        blob ? (
          <>
            <Button variant="ghost" size="md" onClick={onCancel}>
              취소
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => onConfirm(blob)}
            >
              제거 요청 보내기
            </Button>
          </>
        ) : null
      }
    >
      {blob ? (
        <div className="flex flex-col gap-4">
          {/* 안전 표현 — 사용자 spec mandated wording */}
          <p className="text-[12.5px] text-ink leading-relaxed tracking-tightish">
            외부 저장소에서 제거 요청을 보냅니다. 이 작업은 현재 작품 레코드와
            연결되지 않은 orphan 후보에 대해서만 수행됩니다.
          </p>

          {/* 대상 식별 */}
          <div className="rounded-md border border-line bg-surface-muted px-3 py-2.5 flex flex-col gap-1">
            <span className="text-[9.5px] uppercase tracking-[0.12em] text-ink-subtle font-semibold">
              대상 — orphan 후보
            </span>
            <span className="text-[11.5px] font-mono text-ink tracking-tightish break-all">
              {blob.pathname}
            </span>
            <span className="text-[10px] text-ink-subtle tracking-tightish tabular-nums">
              {formatBytes(blob.size)} · 업로드 {formatHumanDate(blob.uploadedAt)}
            </span>
          </div>

          {/* 운영 참고 — 결과 보장 표현 없음 */}
          <ul className="flex flex-col gap-1.5 text-[11.5px] text-ink-muted leading-relaxed tracking-tightish">
            <li className="flex items-start gap-2">
              <span aria-hidden className="text-ink-subtle mt-0.5 shrink-0">·</span>
              <span>요청 처리는 idempotent — 이미 부재한 객체에도 안전합니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="text-ink-subtle mt-0.5 shrink-0">·</span>
              <span>요청 결과는 운영 로그에 기록되며 다음 새로고침 시 목록에 반영됩니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <span aria-hidden className="text-ink-subtle mt-0.5 shrink-0">·</span>
              <span>외부 저장소 응답 실패 시에도 시스템 동작에는 영향이 없습니다.</span>
            </li>
          </ul>

          <p className="text-[10px] text-ink-subtle italic tracking-tightish pt-1 border-t border-line">
            운영 참고용 — Owner 권한으로 실행됩니다.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}

// ============================================================================
// Summary Section
// ============================================================================

function SummarySection({
  loadState,
  artworks,
  onRefresh,
}: {
  loadState: LoadState;
  artworks: ReadonlyArray<Artwork>;
  onRefresh: () => void;
}) {
  const openDrilldown = useArtworkStore((s) => s.openDrilldown);
  const internalSummary = React.useMemo(
    () => computeImageStorageSummary(artworks),
    [artworks]
  );

  const remoteSummary = React.useMemo(() => {
    if (loadState.kind !== "loaded" || !loadState.result.ok) return null;
    return loadState.result;
  }, [loadState]);

  const orphanCount = React.useMemo(() => {
    if (!remoteSummary) return null;
    const orphans = detectOrphanedBlobImages(
      artworks,
      remoteSummary.blobs.map((b) => b.pathname)
    );
    return orphans.length;
  }, [artworks, remoteSummary]);

  const lastUpload = React.useMemo(() => {
    if (!remoteSummary || remoteSummary.blobs.length === 0) return null;
    let latest = remoteSummary.blobs[0].uploadedAt;
    for (const b of remoteSummary.blobs) {
      if (b.uploadedAt > latest) latest = b.uploadedAt;
    }
    return latest;
  }, [remoteSummary]);

  const isLoading = loadState.kind === "loading";
  const refreshDisabled = isLoading;

  // STEP 67 — orphan blob pathnames (drilldown payload용)
  const orphanBlobPathnames = React.useMemo(() => {
    if (!remoteSummary) return undefined;
    return remoteSummary.blobs.map((b) => b.pathname);
  }, [remoteSummary]);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Summary cards — 4종 grid. STEP 67 — 각 카드는 ClickableMetric으로 wrap +
          drilldown 호출. orphan 후보는 외부 inspection 결과의 blobPathnames를
          payload에 inherit (filter sync). */}
      <div className="grid grid-cols-4 gap-2">
        <ClickableMetric
          onClick={() => openDrilldown({ domain: "storage_external" })}
          ariaLabel="외부 저장소 작품 — 상세 보기"
        >
          <SummaryCard
            label="외부 저장소"
            value={
              remoteSummary
                ? `${remoteSummary.totalCount}건`
                : isLoading
                  ? "..."
                  : "—"
            }
            hint={
              remoteSummary
                ? `Vercel Blob · artworks/ scope`
                : "조회 필요"
            }
          />
        </ClickableMetric>
        <ClickableMetric
          onClick={() => openDrilldown({ domain: "storage_with_image" })}
          ariaLabel="이미지 보유 작품 — 상세 보기"
        >
          <SummaryCard
            label="storage 사용량"
            value={
              remoteSummary
                ? formatBytes(remoteSummary.totalSizeBytes)
                : isLoading
                  ? "..."
                  : "—"
            }
            hint="외부 호스트 기준"
          />
        </ClickableMetric>
        <ClickableMetric
          onClick={
            orphanBlobPathnames
              ? () =>
                  openDrilldown({
                    domain: "storage_orphan",
                    blobPathnames: orphanBlobPathnames,
                  })
              : undefined
          }
          disabled={orphanCount === null}
          ariaLabel="orphan 후보 — 상세 보기"
        >
          <SummaryCard
            label="orphan 후보"
            value={
              orphanCount === null
                ? isLoading
                  ? "..."
                  : "—"
                : `${orphanCount}건`
            }
            hint="작품 미연결 blob"
            emphasized={orphanCount !== null && orphanCount > 0}
          />
        </ClickableMetric>
        <SummaryCard
          label="최근 업로드"
          value={lastUpload ? formatRelativeShort(lastUpload) : "—"}
          hint={lastUpload ? formatHumanDate(lastUpload) : "조회 필요"}
        />
      </div>

      {/* Internal context + refresh */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10.5px] text-ink-subtle tracking-tightish">
          작품 record 연결 이미지 ·{" "}
          <span className="text-ink">
            {internalSummary.totalArtworksWithImage}건
          </span>
          {" "}({internalSummary.externalStorageCount} external ·{" "}
          {internalSummary.fallbackImageCount} fallback)
        </span>
        <button
          type="button"
          onClick={refreshDisabled ? undefined : onRefresh}
          disabled={refreshDisabled}
          aria-disabled={refreshDisabled || undefined}
          className={cn(
            "h-7 px-3 rounded-md text-[11px] tracking-tightish border transition-colors",
            refreshDisabled
              ? "bg-surface text-ink-subtle border-line cursor-not-allowed opacity-50"
              : "bg-surface text-ink border-line hover:bg-surface-muted hover:border-line-strong"
          )}
        >
          {isLoading ? "조회 중..." : "다시 조회"}
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  emphasized,
}: {
  label: string;
  value: string;
  hint: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-surface px-2.5 py-2 flex flex-col gap-0.5",
        emphasized ? "border-line-strong" : "border-line"
      )}
      title={hint}
    >
      <span className="text-[9.5px] uppercase tracking-[0.1em] text-ink-subtle font-medium truncate">
        {label}
      </span>
      <span
        className={cn(
          "text-[15px] font-semibold tabular-nums tracking-tight",
          emphasized ? "text-status-deal" : "text-ink"
        )}
      >
        {value}
      </span>
      <span className="text-[9px] text-ink-subtle truncate tracking-tightish">
        {hint}
      </span>
    </div>
  );
}

// ============================================================================
// Body view — error / empty / orphan list / session log
// ============================================================================

function BodyView({
  loadState,
  artworks,
  busyPaths,
  onRemove,
  sessionLog,
}: {
  loadState: LoadState;
  artworks: ReadonlyArray<Artwork>;
  busyPaths: Set<string>;
  onRemove: (blob: RemoteBlobSummary) => void;
  sessionLog: SessionLogEntry[];
}) {
  if (loadState.kind === "idle" || loadState.kind === "loading") {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-[12px] text-ink-muted tracking-tightish">
          외부 저장소 조회 중...
        </p>
        <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1.5">
          Vercel Blob의 artworks/ scope object 목록을 가져오는 중입니다.
        </p>
      </div>
    );
  }

  if (loadState.kind === "error") {
    return <ErrorView message={loadState.message} />;
  }

  // loaded
  if (!loadState.result.ok) {
    const err = loadState.result.error;
    if (err.kind === "env_missing") {
      return (
        <div className="px-6 py-10 text-center max-w-md mx-auto">
          <p className="text-[12px] text-ink-muted tracking-tightish">
            Vercel Blob 미연결 환경입니다.
          </p>
          <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1.5 leading-relaxed">
            BLOB_READ_WRITE_TOKEN 환경변수가 설정되지 않아 외부 저장소
            inspection이 비활성 상태입니다. 설정 후 다시 조회해주세요.
          </p>
        </div>
      );
    }
    return <ErrorView message={err.message} />;
  }

  // ok 응답 — orphan 추출
  return (
    <OrphanReview
      blobs={loadState.result.blobs}
      truncated={loadState.result.truncated}
      artworks={artworks}
      busyPaths={busyPaths}
      onRemove={onRemove}
      sessionLog={sessionLog}
    />
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="px-6 py-10 text-center max-w-md mx-auto">
      <p className="text-[12px] text-status-deal tracking-tightish">
        ⚠ 조회 실패
      </p>
      <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1.5 leading-relaxed">
        {message}
      </p>
    </div>
  );
}

// ============================================================================
// Orphan Review
// ============================================================================

function OrphanReview({
  blobs,
  truncated,
  artworks,
  busyPaths,
  onRemove,
  sessionLog,
}: {
  blobs: RemoteBlobSummary[];
  truncated: boolean;
  artworks: ReadonlyArray<Artwork>;
  busyPaths: Set<string>;
  onRemove: (blob: RemoteBlobSummary) => void;
  sessionLog: SessionLogEntry[];
}) {
  // 작품에 연결된 storageKey 집합
  const referenced = React.useMemo(() => {
    const set = new Set<string>();
    for (const a of artworks) {
      if (
        a.imageProvider === "vercel_blob" &&
        a.imageStorageKey
      ) {
        set.add(a.imageStorageKey);
      }
    }
    return set;
  }, [artworks]);

  // orphan + linked 분리. orphan 정렬: uploadedAt asc → pathname asc
  const { orphans, linkedCount } = React.useMemo(() => {
    const o: RemoteBlobSummary[] = [];
    let linked = 0;
    for (const b of blobs) {
      if (referenced.has(b.pathname)) linked += 1;
      else o.push(b);
    }
    o.sort((a, b) => {
      if (a.uploadedAt !== b.uploadedAt)
        return a.uploadedAt.localeCompare(b.uploadedAt);
      return a.pathname.localeCompare(b.pathname);
    });
    return { orphans: o, linkedCount: linked };
  }, [blobs, referenced]);

  return (
    <div className="flex flex-col">
      {/* Section header */}
      <div className="px-6 py-2.5 border-b border-line bg-surface-muted/30 flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
          정리 검토 — orphan 후보
        </span>
        <span className="text-[10.5px] text-ink-subtle tracking-tightish">
          전체 {blobs.length}건 · 작품 연결 {linkedCount}건 · orphan 후보{" "}
          <span
            className={cn(
              orphans.length > 0 ? "text-status-deal font-medium" : "text-ink"
            )}
          >
            {orphans.length}건
          </span>
        </span>
      </div>

      {truncated && (
        <div className="px-6 py-2 bg-status-inquiry/10 border-b border-line text-[10.5px] text-ink tracking-tightish">
          ⚠ 응답이 5000건 hard cap에 도달했습니다. 일부 객체가 누락되었을 수
          있습니다. 향후 server-side pagination UI로 분할 처리 예정.
        </div>
      )}

      {orphans.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-[12px] text-ink-muted tracking-tightish">
            현재 orphan 후보가 없습니다.
          </p>
          <p className="text-[10.5px] text-ink-subtle tracking-tightish mt-1.5 leading-relaxed">
            모든 외부 저장소 객체가 작품 record와 연결되어 있습니다.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {orphans.map((blob) => (
            <OrphanRow
              key={blob.pathname}
              blob={blob}
              busy={busyPaths.has(blob.pathname)}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}

      {sessionLog.length > 0 && <SessionLogSection log={sessionLog} />}
    </div>
  );
}

function OrphanRow({
  blob,
  busy,
  onRemove,
}: {
  blob: RemoteBlobSummary;
  busy: boolean;
  onRemove: (blob: RemoteBlobSummary) => void;
}) {
  return (
    <li className="border-b border-line">
      <div className="px-6 py-3 grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[11.5px] font-mono text-ink tracking-tightish truncate">
            {blob.pathname}
          </span>
          <a
            href={blob.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9.5px] text-ink-subtle hover:text-ink-muted underline-offset-2 hover:underline truncate tracking-tightish"
            title="외부 저장소 URL 새 창에서 확인"
          >
            {blob.url}
          </a>
        </div>
        <span className="text-[10.5px] tabular-nums text-ink-muted tracking-tightish text-right">
          {formatBytes(blob.size)}
        </span>
        <span
          className="text-[10.5px] tabular-nums text-ink-subtle tracking-tightish text-right"
          title={formatHumanDate(blob.uploadedAt)}
        >
          {formatRelativeShort(blob.uploadedAt)}
        </span>
        <button
          type="button"
          onClick={busy ? undefined : () => onRemove(blob)}
          disabled={busy}
          aria-disabled={busy || undefined}
          className={cn(
            "h-7 px-2.5 rounded-md text-[10.5px] tracking-tightish border transition-colors",
            busy
              ? "bg-surface text-ink-subtle border-line cursor-not-allowed opacity-60"
              : "bg-surface text-status-deal/80 border-line hover:bg-surface-muted hover:border-line-strong hover:text-status-deal"
          )}
        >
          {busy ? "처리 중..." : "제거 요청"}
        </button>
      </div>
    </li>
  );
}

// ============================================================================
// Session log
// ============================================================================

function SessionLogSection({ log }: { log: SessionLogEntry[] }) {
  return (
    <div className="border-t border-line">
      <div className="px-6 py-2.5 bg-surface-muted/30 border-b border-line">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
          세션 로그
        </span>
        <span className="text-[10px] text-ink-subtle italic tracking-tightish ml-2">
          (drawer 닫으면 초기화 — 운영 참고용)
        </span>
      </div>
      <ul className="flex flex-col">
        {log.map((entry) => (
          <li
            key={`${entry.at}-${entry.pathname}`}
            className="px-6 py-2 border-b border-line/60 grid grid-cols-[auto_1fr_auto] gap-3 items-baseline"
          >
            <span
              className={cn(
                "text-[10px] uppercase tracking-[0.1em] font-semibold",
                entry.status === "ok"
                  ? "text-ink-muted"
                  : "text-status-deal"
              )}
            >
              {entry.status === "ok" ? "OK" : "FAIL"}
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[11px] font-mono text-ink-muted tracking-tightish truncate">
                {entry.pathname}
              </span>
              <span className="text-[10px] text-ink-subtle tracking-tightish truncate">
                {entry.message}
              </span>
            </div>
            <span className="text-[9.5px] tabular-nums text-ink-subtle tracking-tightish">
              {formatHumanDate(entry.at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Helpers (지역 — STEP 51 / 52 패턴 일관)
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatHumanDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatRelativeShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const day = 1000 * 60 * 60 * 24;
  const days = Math.floor(diffMs / day);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
