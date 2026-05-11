// ============================================================================
// ArtworkImageUpload — STEP 50.5.
//
// ArtworkFormDrawer의 "썸네일" 섹션 안에서 사용되는 이미지 업로드 UI. 기본
// click-to-upload + drag&drop 지원. 외부 라이브러리 0개 — `<input type="file">`
// + native HTML5 drag/drop API.
//
// 미니멀 톤 일관 (rule_16): 점선 dropzone + 회색 hint + preview는 작은 정사각형
// 컨테이너에 object-cover.
// ============================================================================

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatBytes, MAX_IMAGE_SIZE_BYTES } from "@/lib/artwork-image";
import {
  estimateThumbnailSize,
  formatStorageInfoLabel,
  THUMBNAIL_PRESETS,
} from "@/lib/image-thumbnail";
import {
  uploadImage,
  getActiveImageStorageInfo,
} from "@/lib/image-storage-provider";
import type { ImageUploadResult } from "@/types/image-storage-provider";
// STEP 84 — system audit 신호 (upload fallback 활성 시 emit)
import { emitSystemAuditSignal } from "@/lib/system-audit-signals";

interface ArtworkImageUploadProps {
  /** 현재 이미지 URL (편집 모드 기존 값) — undefined면 placeholder */
  imageUrl: string | undefined;
  /**
   * STEP 53 — 시그니처 확장. URL + 메타데이터 한 묶음으로 전달.
   * undefined 전달 시 이미지 제거 의도. 호출자(ArtworkFormDrawer)는 result를
   * 펼쳐 ArtworkInput의 5 옵셔널 필드에 매핑.
   */
  onChange: (next: ImageUploadResult | undefined) => void;
  /** 썸네일 placeholder 색상 (이미지 부재 시 미리보기) */
  fallbackColor: string;
  /**
   * STEP 53 — 기존 record(STEP 50.5에서 imageUrl만 있는 데이터)의 provider
   * 정보. UI에 "Local image" 등 표시용. 부재 시 active provider 라벨 사용.
   */
  imageProvider?: string;
  /**
   * STEP 57 — 본 이미지가 fallback에 의해 도달했는지. record가 외부 storage
   * 실패 후 LocalPreview로 fallback된 경우 UI에 "(fallback)" 부가 표시.
   * 기존 record (STEP 50.5)는 부재 → false 동작.
   */
  imageWasFallback?: boolean;
  /**
   * STEP 61 — 원본 이미지 size (bytes). 표시 최적화 라벨 노출용.
   * "원본 4.2MB → 표시용 약 0.8MB" — preview-level estimation.
   */
  imageSize?: number;
}

// STEP 57 — providerId → 사람이 읽을 수 있는 라벨 매핑.
// active provider 이외의 id (record가 다른 provider로 업로드됨)도 친근하게 표시.
const PROVIDER_DISPLAY_LABEL: Record<string, string> = {
  vercel_blob: "Vercel Blob",
  local_preview_v1: "Local image",
};

export function ArtworkImageUpload({
  imageUrl,
  onChange,
  fallbackColor,
  imageProvider,
  imageWasFallback,
  imageSize,
}: ArtworkImageUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isReading, setIsReading] = React.useState(false);

  const activeProvider = React.useMemo(
    () => getActiveImageStorageInfo(),
    []
  );

  // Provider 라벨 결정 — record의 imageProvider 우선, 부재 시 active provider
  const providerDisplayLabel = React.useMemo(() => {
    if (imageProvider) {
      // STEP 57 — 알려진 provider id는 친근한 라벨로 매핑
      if (PROVIDER_DISPLAY_LABEL[imageProvider]) {
        return PROVIDER_DISPLAY_LABEL[imageProvider];
      }
      // 알 수 없는 id (향후 추가될 provider 또는 외부) → id 그대로
      return imageProvider;
    }
    // STEP 50.5 호환: imageUrl만 있는 기존 record는 provider 부재 → "Local image"
    return activeProvider?.displayName ?? "Local image";
  }, [imageProvider, activeProvider]);

  // STEP 57 — 현재 record가 LocalPreview로 fallback되었는지. providerId가
  // local_preview_v1이고 active provider가 다른 (실 storage)면 fallback 상태.
  // 추가로 imageWasFallback prop도 체크 (방금 업로드한 결과의 명시 mark).
  const isFallbackImage = React.useMemo(() => {
    if (imageWasFallback) return true;
    if (
      imageProvider === "local_preview_v1" &&
      activeProvider &&
      activeProvider.providerId !== "local_preview_v1"
    ) {
      return true;
    }
    return false;
  }, [imageWasFallback, imageProvider, activeProvider]);

  const handleFiles = React.useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);
      setIsReading(true);
      // STEP 53 — provider dispatcher 경유. LocalPreviewProvider가 fallback이라
      // 사용자 흐름 끊김 0건 (FileReader 자체 실패가 아닌 한).
      const outcome = await uploadImage(files[0]);
      setIsReading(false);
      if (outcome.ok) {
        // STEP 84 — fallback 활성 신호. 외부 provider(예: Vercel Blob) 실패 후
        // LocalPreview로 자동 전환된 상태를 system audit에 기록. cooldown 30초로
        // 다중 업로드 시 spam 방지. message는 부정형 톤 ("recoverable issue").
        if (outcome.result.wasFallback) {
          emitSystemAuditSignal(
            "system_upload_fallback_activated",
            "warning",
            "이미지 업로드 fallback 활성 — 외부 provider 실패 후 LocalPreview로 자동 전환됨 (recoverable)",
            {
              cooldownMs: 30_000,
              metadata: {
                providerId: outcome.result.providerId,
                fileSizeBytes: files[0].size,
                fileName: files[0].name,
              },
            }
          );
        }
        onChange(outcome.result);
      } else {
        setError(outcome.error.message);
      }
    },
    [onChange]
  );

  const handleClickUpload = () => {
    inputRef.current?.click();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    onChange(undefined);
    if (inputRef.current) inputRef.current.value = "";
  };

  // Drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    void handleFiles(e.dataTransfer?.files ?? null);
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {imageUrl ? (
        <ImagePreview
          imageUrl={imageUrl}
          onReplace={handleClickUpload}
          onRemove={handleRemove}
          isReading={isReading}
        />
      ) : (
        <DropZone
          onClick={handleClickUpload}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          isDragging={isDragging}
          isReading={isReading}
          fallbackColor={fallbackColor}
        />
      )}

      {/* STEP 53 — Provider 라벨. 이미지가 있을 때만 노출.
          STEP 57 — 실 storage(Vercel Blob) 연결 시 "Mock storage" / "Future external
          storage ready" 부재. fallback 발생 시 "(fallback)" 표시. */}
      {imageUrl && (
        <div className="flex items-baseline justify-between gap-2 text-[9.5px] tracking-tightish text-ink-subtle">
          <span className="italic truncate">
            {providerDisplayLabel}
            {/* fallback 발생 — 실 storage가 실패해 LocalPreview로 떨어진 경우 */}
            {isFallbackImage && (
              <span className="ml-1 not-italic">(fallback)</span>
            )}
            {/* mock provider 단독 운영 (STEP 53 호환) — Vercel Blob 미연결 환경 */}
            {!isFallbackImage && activeProvider && !activeProvider.isReal && (
              <span className="ml-1 not-italic">· Mock storage</span>
            )}
          </span>
          {/* mock provider 단독일 때만 "Future external storage ready" hint */}
          {!isFallbackImage && activeProvider && !activeProvider.isReal && (
            <span className="not-italic shrink-0">
              Future external storage ready
            </span>
          )}
        </div>
      )}

      {/* STEP 61 — Storage usage info. 원본 size + thumbnail estimation 표시.
          preview-level estimation only — 실제 압축 처리는 향후 server-side
          transform 활성 시 작동. data URL은 추정 의미 부족하므로 미표시. */}
      {imageUrl &&
        imageSize !== undefined &&
        imageSize > 0 &&
        !imageUrl.startsWith("data:") && (
          <span className="text-[9.5px] tracking-tightish text-ink-subtle italic">
            {formatStorageInfoLabel(
              imageSize,
              estimateThumbnailSize(imageSize, THUMBNAIL_PRESETS.CARD.w)
            )}
          </span>
        )}

      {error && (
        <p
          role="alert"
          className="text-[10.5px] text-status-deal tracking-tightish"
        >
          {error}
        </p>
      )}
      <p className="text-[10px] text-ink-subtle tracking-tightish">
        JPG / PNG / WEBP · 최대 {formatBytes(MAX_IMAGE_SIZE_BYTES)} · 이미지가
        없으면 색상 placeholder가 표시됩니다.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function DropZone({
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragging,
  isReading,
  fallbackColor,
}: {
  onClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
  isReading: boolean;
  fallbackColor: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative w-full h-32 rounded-md border border-dashed transition-colors",
        "flex flex-col items-center justify-center gap-1.5",
        "focus:outline-none focus:ring-2 focus:ring-ink/30",
        isDragging
          ? "border-ink bg-surface-muted"
          : "border-line bg-surface hover:bg-surface-muted/60 hover:border-ink/60"
      )}
      aria-label="이미지 업로드"
    >
      {/* fallback color preview tile (작게 좌측 상단) */}
      <span
        aria-hidden
        className="absolute top-2 left-2 h-3 w-3 rounded border border-line shrink-0"
        style={{ backgroundColor: fallbackColor }}
      />
      <UploadIcon />
      <p className="text-[11.5px] text-ink-muted tracking-tightish">
        {isDragging
          ? "이미지를 놓으면 업로드됩니다"
          : "클릭하거나 이미지를 끌어 놓으세요"}
      </p>
      <p className="text-[10px] text-ink-subtle tracking-tightish">
        {isReading ? "읽는 중..." : "JPG / PNG / WEBP · 최대 3MB"}
      </p>
    </button>
  );
}

function ImagePreview({
  imageUrl,
  onReplace,
  onRemove,
  isReading,
}: {
  imageUrl: string;
  onReplace: () => void;
  onRemove: (e: React.MouseEvent) => void;
  isReading: boolean;
}) {
  return (
    <div className="relative rounded-md border border-line bg-surface overflow-hidden">
      {/* 16:10 비율 컨테이너 — object-cover로 작품 비율 유지 */}
      <div className="relative w-full aspect-[16/10] bg-canvas">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="작품 이미지"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      </div>
      <div className="flex items-center justify-end gap-1.5 px-2 py-1.5 border-t border-line bg-surface-muted/40">
        <button
          type="button"
          onClick={onReplace}
          disabled={isReading}
          className="text-[10.5px] text-ink-muted hover:text-ink tracking-tightish px-2 py-1 rounded hover:bg-surface transition-colors disabled:opacity-50"
        >
          {isReading ? "읽는 중..." : "교체"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={isReading}
          className="text-[10.5px] text-ink-muted hover:text-status-deal tracking-tightish px-2 py-1 rounded hover:bg-surface transition-colors disabled:opacity-50"
        >
          제거
        </button>
      </div>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 text-ink-subtle"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}
