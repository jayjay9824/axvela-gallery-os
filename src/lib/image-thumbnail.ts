// ============================================================================
// Image Thumbnail / Storage Utilities — STEP 61.
//
// **사용자 spec 핵심 제약**: 실제 이미지 리사이즈 라이브러리 추가 금지 (sharp /
// imagekit / cloudinary 등). query param 기반 lightweight thumbnail convention만
// 정의 — 실제 transform은 향후 Cloudflare Image Resizing / Vercel image
// transformations / 자체 server route에서 처리.
//
// **본 STEP에서 제공하는 것:**
//   1. `buildThumbnailUrl(url, opts)` — convention url builder
//   2. `estimateThumbnailSize(originalSize, w)` — preview-level 크기 추정
//   3. `formatStorageInfoLabel(...)` — UI 표시 helper ("원본 4.2MB → 표시용 0.8MB")
//   4. `detectOrphanedBlobImages(artworks, allBlobs)` — orphan 검사 helper
//      (실제 delete는 하지 않음 — 운영 참고용)
//
// **표현 정책:**
//   - 사용: "외부 저장소" / "표시 최적화" / "fallback image" / "storage usage"
//   - 금지: "영구 보관" / "완전 삭제 보장" / "무손실 보장" / "영구 복구" / "법적 보관"
// ============================================================================

import type { Artwork } from "@/types/artwork";

// ----------------------------------------------------------------------------
// Thumbnail URL builder
// ----------------------------------------------------------------------------

export interface ThumbnailOptions {
  /** 표시 폭 (px). Card / Grid 기본 400, list compact 200 등. */
  w: number;
  /** JPEG quality (0-100). 기본 75 (사용자 spec 명시 예시). */
  q?: number;
}

/**
 * Thumbnail URL convention — 원본 url에 `?w=N&q=N` query 추가.
 *
 * **현재 동작**: Vercel Blob 자체는 query param transformation을 native로 지원
 * 하지 않음. 따라서 본 함수가 만든 URL은 *원본 그대로* 응답함 (browser가 width
 * 기반 native resize). 그러나 URL convention을 지금 정착시켜두면:
 *   - 향후 Cloudflare Image Resizing / Vercel image transformations 활성화 시
 *     UI 코드 변경 없이 즉시 동작
 *   - 자체 server route (예: `/api/image/[w]/[pathname]`)로 옮길 때도 query만 매핑
 *
 * **정책**:
 *   - 빈 URL → 빈 URL 반환 (호출자가 fallback 분기 — placeholder 등)
 *   - data URL (base64 inline / local_preview_v1) → 그대로 반환 (query param
 *     의미 없음, browser가 자체 처리)
 *   - http(s) URL → query 추가
 */
export function buildThumbnailUrl(
  url: string | undefined,
  opts: ThumbnailOptions
): string | undefined {
  if (!url) return undefined;

  // data URL은 query param 무의미 — 원본 그대로
  if (url.startsWith("data:")) return url;

  // http(s)가 아니면 변형 시도하지 않음 (안전)
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return url;
  }

  // 기존 query 보존 + w / q 갱신
  try {
    const u = new URL(url);
    u.searchParams.set("w", String(Math.max(1, Math.floor(opts.w))));
    if (opts.q !== undefined) {
      const q = Math.min(100, Math.max(1, Math.floor(opts.q)));
      u.searchParams.set("q", String(q));
    }
    return u.toString();
  } catch {
    // URL 파싱 실패 — 원본 그대로 반환 (안전)
    return url;
  }
}

// ----------------------------------------------------------------------------
// Size estimation (preview-level only)
// ----------------------------------------------------------------------------

/**
 * 표시용 thumbnail 크기 추정. 실제 압축 처리 아님 — UI 라벨용 preview-level
 * estimation only (사용자 spec).
 *
 * **공식**: `originalSize * (thumbnailWidth / referenceWidth)^2 * compressionFactor`
 *   - referenceWidth = 1600 (typical 원본 가정)
 *   - compressionFactor = 0.85 (JPEG q=75 기준 경험적 ratio)
 *   - 결과는 floor — 정수 byte
 *
 * 원본 width를 모르는 환경(`Artwork`는 width 미저장)이라 1600px reference 가정.
 * UI는 "약" / "예상" 표현으로 정확성 한계 노출.
 */
export function estimateThumbnailSize(
  originalSize: number,
  thumbnailWidth: number
): number {
  if (originalSize <= 0) return 0;
  if (thumbnailWidth <= 0) return originalSize;

  const REFERENCE_WIDTH = 1600;
  const COMPRESSION_FACTOR = 0.85;
  const ratio = thumbnailWidth / REFERENCE_WIDTH;

  // ratio가 1을 넘으면 원본 그대로 (확대 가정 안 함)
  if (ratio >= 1) return originalSize;

  return Math.floor(originalSize * ratio * ratio * COMPRESSION_FACTOR);
}

/**
 * 압축 비율 (0.0 ~ 1.0) — UI 라벨용. originalSize == 0 시 0 반환.
 */
export function computeCompressionRatio(
  originalSize: number,
  estimatedSize: number
): number {
  if (originalSize <= 0) return 0;
  return Math.min(1, Math.max(0, estimatedSize / originalSize));
}

// ----------------------------------------------------------------------------
// Storage info label helper (UI 표시)
// ----------------------------------------------------------------------------

/**
 * UI 라벨 — "원본 4.2MB → 표시용 0.8MB".
 * estimatedSize 부재(0) 시 원본만 노출 — "원본 4.2MB".
 */
export function formatStorageInfoLabel(
  originalSize: number,
  estimatedSize: number
): string {
  if (originalSize <= 0) return "";

  const orig = formatBytes(originalSize);
  if (estimatedSize <= 0 || estimatedSize >= originalSize) {
    return `원본 ${orig}`;
  }
  const est = formatBytes(estimatedSize);
  return `원본 ${orig} → 표시용 약 ${est}`;
}

/**
 * Bytes → human-readable. STEP 50.5 `artwork-image.ts`의 `formatBytes`와 동일
 * 정책이지만 본 모듈은 별도 import 회피 (cyclic 안전).
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ----------------------------------------------------------------------------
// Orphan blob detection (운영 참고용)
// ----------------------------------------------------------------------------

/**
 * Orphaned blob — artworks에 연결되지 않은 storageKey 목록 detect.
 *
 * **사용자 spec 명시**: "실제 delete는 하지 않음. 운영 참고용 only."
 *   - 본 함수는 pure helper — server-side blob list와 비교 가능
 *   - 본 STEP에서는 호출 site 0건 (UI 노출 없음)
 *   - 향후 STEP에서 admin tool / cron job으로 orphan 정리 시 활용
 *
 * @param artworks 현재 artwork list
 * @param blobPathnames Vercel Blob `list()` 결과의 pathname 배열
 * @returns artwork에서 참조하지 않는 blob pathname 목록 (정렬된 결정성 결과)
 */
export function detectOrphanedBlobImages(
  artworks: ReadonlyArray<Artwork>,
  blobPathnames: ReadonlyArray<string>
): string[] {
  const referenced = new Set<string>();
  for (const a of artworks) {
    if (a.imageStorageKey && a.imageProvider === "vercel_blob") {
      referenced.add(a.imageStorageKey);
    }
  }

  const orphans: string[] = [];
  for (const path of blobPathnames) {
    if (!referenced.has(path)) orphans.push(path);
  }
  // 결정성 보장 — 같은 입력 → 같은 결과 순서
  orphans.sort((a, b) => a.localeCompare(b));
  return orphans;
}

/**
 * Storage usage summary — UI 운영 참고용 (현재 미노출, helper만 정의).
 * artwork list만으로 계산 가능한 부분 — Vercel Blob 측 실제 usage는 server-side
 * 측정 필요.
 */
export interface ImageStorageSummary {
  totalArtworksWithImage: number;
  externalStorageCount: number;
  fallbackImageCount: number;
  totalKnownSizeBytes: number;
}

export function computeImageStorageSummary(
  artworks: ReadonlyArray<Artwork>
): ImageStorageSummary {
  let withImage = 0;
  let external = 0;
  let fallback = 0;
  let totalSize = 0;

  for (const a of artworks) {
    if (!a.imageUrl) continue;
    withImage += 1;
    if (a.imageProvider === "vercel_blob") external += 1;
    else fallback += 1;
    if (a.imageSize && a.imageSize > 0) totalSize += a.imageSize;
  }

  return {
    totalArtworksWithImage: withImage,
    externalStorageCount: external,
    fallbackImageCount: fallback,
    totalKnownSizeBytes: totalSize,
  };
}

// ----------------------------------------------------------------------------
// Default thumbnail dimensions (UI 일관성)
// ----------------------------------------------------------------------------

/**
 * 표준 thumbnail 크기 const — UI 컴포넌트에서 일관 사용.
 *
 * - CARD: ArtworkCard / Grid (400px width @ 75q)
 * - COMPACT: 차후 list view용 작은 thumbnail (200px @ 70q)
 * - DETAIL_HERO_PREVIEW: 향후 progressive loading용 (800px placeholder)
 *
 * **DetailPanel은 본 const 사용하지 않고 원본 사용** (사용자 spec —
 * "DetailPanel → original"). UploadPreview도 원본 유지.
 */
export const THUMBNAIL_PRESETS = {
  CARD: { w: 400, q: 75 },
  COMPACT: { w: 200, q: 70 },
  DETAIL_HERO_PREVIEW: { w: 800, q: 80 },
} as const;
