// ============================================================================
// VercelBlobImageStorageProvider — STEP 57.
//
// 실 외부 storage (Vercel Blob) 연결 provider. STEP 53에서 정착한
// `ImageStorageProvider` interface 그대로 구현 — dispatcher는 다른 코드 변경
// 없이 본 provider를 ACTIVE_IMAGE_PROVIDERS 배열에 push만 함.
//
// **흐름:**
//   1. 클라이언트(ArtworkImageUpload) → uploadImage(file) → dispatcher
//   2. dispatcher → 본 provider.upload(file) 호출
//   3. multipart/form-data로 `/api/upload-image` POST
//   4. 서버측 (route.ts) → @vercel/blob.put() 호출 → url + pathname 반환
//   5. 본 provider → ImageUploadResult로 wrap → 호출자에게 반환
//
// **Failure 흐름:**
//   - 환경변수 부재 → 서버 503 → 본 provider throw → dispatcher catch →
//     LocalPreviewProvider fallback (사용자 흐름 끊김 0건)
//   - 네트워크 실패 / 502 / 413 → 동일 흐름으로 fallback
//
// **isReal=true** — 본 provider는 실 외부 storage 연결. 운영자에게 transparent
// 노출 ("Vercel Blob" 라벨, "Mock storage" 부재).
// ============================================================================

import type {
  ImageStorageProvider,
  ImageUploadResult,
} from "@/types/image-storage-provider";

interface VercelBlobUploadResponse {
  url: string;
  pathname: string;
}

interface VercelBlobErrorResponse {
  error?: string;
}

export class VercelBlobImageStorageProvider implements ImageStorageProvider {
  readonly providerId = "vercel_blob";
  readonly isReal = true;
  readonly displayName = "Vercel Blob";

  async upload(file: File): Promise<ImageUploadResult> {
    const formData = new FormData();
    formData.append("file", file);

    let response: Response;
    try {
      response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });
    } catch (err) {
      // 네트워크 실패 — 클라이언트 오프라인 / API route 미접근 등
      throw new Error(
        err instanceof Error
          ? `Vercel Blob 네트워크 실패: ${err.message}`
          : "Vercel Blob 네트워크 실패"
      );
    }

    if (!response.ok) {
      // 503 (env 부재) / 4xx / 5xx — dispatcher가 catch → LocalPreview fallback
      let errorMsg = `Vercel Blob 업로드 실패 (${response.status})`;
      try {
        const body = (await response.json()) as VercelBlobErrorResponse;
        if (body.error) errorMsg = `${errorMsg}: ${body.error}`;
      } catch {
        // body 파싱 실패는 무시 — status code만으로 충분
      }
      throw new Error(errorMsg);
    }

    let payload: VercelBlobUploadResponse;
    try {
      payload = (await response.json()) as VercelBlobUploadResponse;
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? `Vercel Blob 응답 파싱 실패: ${err.message}`
          : "Vercel Blob 응답 파싱 실패"
      );
    }

    if (!payload.url || !payload.pathname) {
      throw new Error("Vercel Blob 응답 누락 (url / pathname)");
    }

    return {
      url: payload.url,
      storageKey: payload.pathname,
      providerId: this.providerId,
      isReal: this.isReal,
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * STEP 61 — Vercel Blob 외부 storage에서 제거 요청. dispatcher의 optional
   * delete contract 구현. 호출자(`deleteArtworkImage` action)는 본 메서드를
   * 통해 외부 host에서 blob 제거를 요청 — 결과는 idempotent (이미 부재한 blob도
   * 정상 처리).
   *
   * **failure 정책**: throw로 호출자에게 알림. 호출자는 catch해서 silent fallback
   * (artwork.imageUrl만 제거 — 외부 host에 잔존해도 사용자 흐름은 유지). 향후
   * orphan cleanup helper(STEP 61 image-thumbnail.ts)로 일괄 제거 가능.
   */
  async delete(storageKey: string): Promise<void> {
    if (!storageKey || storageKey.trim() === "") {
      throw new Error("storageKey가 비어있습니다");
    }

    let response: Response;
    try {
      response = await fetch("/api/delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathname: storageKey }),
      });
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? `Vercel Blob 제거 요청 네트워크 실패: ${err.message}`
          : "Vercel Blob 제거 요청 네트워크 실패"
      );
    }

    if (!response.ok) {
      let errorMsg = `Vercel Blob 제거 요청 실패 (${response.status})`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) errorMsg = `${errorMsg}: ${body.error}`;
      } catch {
        // body 파싱 실패는 무시 — status code만으로 충분
      }
      throw new Error(errorMsg);
    }
  }
}
