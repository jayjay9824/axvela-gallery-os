// ============================================================================
// Artwork Image Upload Helper — STEP 50.5.
//
// File → data URL 변환 + 크기 가드. 외부 storage 미연결 — 모든 이미지는 inline
// data URL로 store / persistence에 저장. 향후 STEP에서 외부 storage (S3 등)
// 연결 시 본 helper의 시그니처는 그대로 두고 구현만 fetch 기반 upload로 교체.
//
// **제약 (사용자 spec):**
//   - 외부 API 호출 0건 (browser FileReader API만 사용)
//   - 신규 라이브러리 0개
// ============================================================================

/**
 * 이미지 파일 한 장의 최대 size. 너무 큰 파일은 base64로 inline 보관 시
 * persistence(localStorage)에 부담 → ~3MB 제한. 향후 외부 storage 연결 시
 * 본 한도는 풀어줄 수 있음.
 */
export const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

export interface ImageReadResult {
  /** Data URL (data:image/png;base64,...) */
  dataUrl: string;
  /** Original file size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
}

export type ImageReadError =
  | { kind: "not_image"; message: string }
  | { kind: "too_large"; message: string; sizeBytes: number }
  | { kind: "read_failed"; message: string };

/**
 * `File` → data URL 변환. Promise 기반.
 *
 * **결정성**: 같은 파일 → 같은 data URL.
 * **실패 격리**: 모든 에러는 reject 대신 `ImageReadError`로 normalize → 호출자가
 * UI에 정중히 표기 가능 (uncaught promise 0).
 */
export async function readImageAsDataUrl(
  file: File
): Promise<{ ok: true; result: ImageReadResult } | { ok: false; error: ImageReadError }> {
  if (!file.type.startsWith("image/")) {
    return {
      ok: false,
      error: {
        kind: "not_image",
        message: "이미지 파일만 업로드할 수 있습니다.",
      },
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      ok: false,
      error: {
        kind: "too_large",
        message: `이미지 크기는 ${formatBytes(MAX_IMAGE_SIZE_BYTES)} 이하여야 합니다 (현재 ${formatBytes(file.size)}).`,
        sizeBytes: file.size,
      },
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        resolve({
          ok: false,
          error: {
            kind: "read_failed",
            message: "이미지를 읽을 수 없습니다.",
          },
        });
        return;
      }
      resolve({
        ok: true,
        result: {
          dataUrl: result,
          size: file.size,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = () => {
      resolve({
        ok: false,
        error: {
          kind: "read_failed",
          message: "이미지를 읽을 수 없습니다.",
        },
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Bytes → 사람이 읽을 수 있는 단위. KB / MB만 사용 (이번 STEP 한도 3MB).
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
