// ============================================================================
// AXVELA — ArtworkUploadHero (STEP 116, Phase 4 Stage 2)
// ============================================================================
//
// **본 component 의 정체**:
//   ArtworkFormDrawer 최상단의 *image-first registration entry point*.
//   사용자 spec STEP 116 (#1 IMAGE-FIRST REGISTRATION + #2 ARTWORK
//   REGISTRATION UI RESTRUCTURE) 정확 매칭.
//
//   사용자 spec 인용:
//     "텍스트 form 보다 이미지가 먼저 보이도록 hierarchy 재구성"
//     "Image Upload → Artwork Preview → Artwork Understanding → Operational Workflow"
//
// **본 component 가 *아닌* 것**:
//   - 신규 upload 엔진 (기존 ArtworkImageUpload 380 LOC 그대로 위임 — 변경 0줄)
//   - Multiple-image storage 합류 (v1 단일 image. future expansion path:
//     `Artwork.additionalImageUrls?: string[]` optional slot — 미래 STEP)
//   - Persistence schema 변경 (Phase 4 §4.3 — 0줄 변경)
//
// **Visual hierarchy**:
//   - Empty state  — 큰 dashed dropzone + "이미지를 끌어오거나 클릭" 안내 +
//                    ColorSwatchPicker fallback (이미지 부재 시 placeholder 색상)
//   - Filled state — 큰 thumbnail preview + ArtworkImageUpload 의 metadata
//                    (provider / fallback / size 라벨)
//
// **재사용 패턴**:
//   기존 ArtworkImageUpload 의 모든 props 를 forward — drag/drop / click /
//   provider / fallback / size 모두 그대로. Hero 는 *scale up + hierarchy* 만.
//
// **Phase 4 §4 Implementation Constraints 정합**:
//   §4.1 Additive only           ✓  신규 component
//   §4.2 Optional slot priority   ✓  Artwork schema 변경 0줄
//   §4.3 No persistence migration ✓  validateV1 / SCHEMA_VERSION "v1" 무영향
//   §4.5 Backward compat          ✓  기존 imageUrl 단일 image flow 보존
//   §4.6 Build green              ✓  검증 예정
//   §4.7 Worktree 금지             ✓  현재 project 만
//   §4.8 AI not priority           ✓  AI 영역 0줄 변경
// ============================================================================

"use client";

import * as React from "react";
import { ArtworkImageUpload } from "./ArtworkImageUpload";
import { ColorSwatchPicker } from "./ColorSwatchPicker";
import type { ImageUploadResult } from "@/types/image-storage-provider";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// Props — ArtworkImageUpload 의 props 를 forward + ColorSwatchPicker 통합
// ----------------------------------------------------------------------------

interface ArtworkUploadHeroProps {
  /** 현재 이미지 URL (편집 모드 기존 값 / 새 업로드 결과). undefined → empty state. */
  imageUrl: string | undefined;
  /** Image upload/replace/remove 콜백. ArtworkImageUpload 와 동일 시그니처. */
  onImageChange: (next: ImageUploadResult | undefined) => void;
  /** Placeholder 색상 (이미지 부재 시 swatch fallback). */
  fallbackColor: string;
  /** Placeholder 색상 변경 콜백. */
  onColorChange: (next: string) => void;
  /** 기존 record 의 image provider id ("local_preview_v1" / "vercel_blob" 등). */
  imageProvider?: string;
  /** 본 이미지가 fallback 으로 도달했는지 (외부 storage 실패 → LocalPreview). */
  imageWasFallback?: boolean;
  /** 원본 이미지 size (bytes). storage info 라벨 표시용. */
  imageSize?: number;
  className?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export const ArtworkUploadHero: React.FC<ArtworkUploadHeroProps> = ({
  imageUrl,
  onImageChange,
  fallbackColor,
  onColorChange,
  imageProvider,
  imageWasFallback,
  imageSize,
  className,
}) => {
  const hasImage = typeof imageUrl === "string" && imageUrl.length > 0;

  return (
    <section
      className={cn(
        // Visually clear hero zone — 미니멀, 그림자 0, 큰 padding
        "rounded-lg border border-line bg-surface p-5 mb-5",
        // Active surface highlight - 미세한 tone difference
        hasImage && "bg-surface-muted/30",
        className,
      )}
      aria-label="작품 이미지 — Artwork Image"
    >
      {/* ── Header — image-first 명시 ──────────────────────────────────── */}
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
          {hasImage ? "작품 이미지" : "이미지 업로드"}
        </h3>
        <span className="text-[10px] text-ink-subtle/70 italic">
          {hasImage ? "Image" : "끌어오기 또는 클릭"}
        </span>
      </div>

      {/* ── State-aware body ─────────────────────────────────────────── */}
      {hasImage ? (
        // Filled — 큰 preview + replace/remove (ArtworkImageUpload 자체가 처리)
        <div className="space-y-4">
          <ArtworkImageUpload
            imageUrl={imageUrl}
            onChange={onImageChange}
            fallbackColor={fallbackColor}
            imageProvider={imageProvider}
            imageWasFallback={imageWasFallback}
            imageSize={imageSize}
          />
        </div>
      ) : (
        // Empty — visual hierarchy emphasis: dropzone 가 hero 의 주인공
        <div className="space-y-4">
          {/* ArtworkImageUpload 의 dropzone 활용 (기존 component 가 empty
              state 처리 가능 — fallback color swatch + dashed dropzone) */}
          <ArtworkImageUpload
            imageUrl={undefined}
            onChange={onImageChange}
            fallbackColor={fallbackColor}
            imageProvider={imageProvider}
            imageWasFallback={imageWasFallback}
            imageSize={imageSize}
          />

          {/* Image-first hierarchy 명시 안내 — Phase 4 STEP 113 terminology */}
          <p className="text-[11px] text-ink-subtle leading-relaxed pt-2 border-t border-line/40">
            작품을 등록하기 전에 이미지를 먼저 추가하면 담당자 검토와 컬렉터
            응대가 빨라집니다.
            <span className="block text-[10px] text-ink-subtle/70 italic mt-0.5">
              Adding an image first speeds up staff review and collector response.
            </span>
          </p>

          {/* Empty state 시 fallback color picker — 이미지 미진입 시 썸네일
              swatch 로 즉시 카드 표시 가능. */}
          <ColorSwatchPicker
            label="대표 색상 (이미지 부재 시 placeholder)"
            value={fallbackColor}
            onChange={onColorChange}
          />
        </div>
      )}

      {/* Filled state 에서도 color picker 노출 — 이미지 제거 시점 fallback 보존
          (ArtworkImageUpload 가 이미지 제거 → onChange(undefined) 시 즉시 swatch
          로 회귀 가능하도록 색상은 항상 보존). */}
      {hasImage && (
        <div className="pt-4 mt-4 border-t border-line/40">
          <ColorSwatchPicker
            label="대표 색상 (이미지 제거 시 fallback)"
            value={fallbackColor}
            onChange={onColorChange}
          />
        </div>
      )}
    </section>
  );
};
