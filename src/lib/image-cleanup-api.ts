// ============================================================================
// Image Cleanup API — STEP 62.
//
// 클라이언트(ImageCleanupDrawer)가 server endpoint들과 통신하기 위한 fetcher
// + result shape. 모든 에러는 reject 대신 normalize → 호출자는 ok 분기 단일
// 처리.
//
// **endpoint 목록:**
//   - GET  /api/list-images   — read-only storage inspection
//   - POST /api/delete-image  — STEP 61에서 이미 구현 (재사용)
//
// **표현 정책 (사용자 spec):**
//   - 사용: "external storage" / "storage inspection" / "remove request" /
//     "orphan candidate" / "cleanup review"
//   - 금지: "permanent delete" / "guaranteed deletion" / "법적 보관" 등
// ============================================================================

// ---------------------------------------------------------------------------
// Types — server contract와 매칭
// ---------------------------------------------------------------------------

export interface RemoteBlobSummary {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: string;
}

export interface ListImagesSuccess {
  ok: true;
  blobs: RemoteBlobSummary[];
  totalCount: number;
  totalSizeBytes: number;
  truncated: boolean;
  fetchedAt: string;
}

export type ListImagesError =
  | { kind: "env_missing"; message: string }
  | { kind: "network"; message: string }
  | { kind: "server"; message: string; status: number }
  | { kind: "parse"; message: string };

export interface ListImagesFailure {
  ok: false;
  error: ListImagesError;
}

export type ListImagesResult = ListImagesSuccess | ListImagesFailure;

export type RemoveImageResult =
  | { ok: true; pathname: string }
  | { ok: false; error: { message: string; status?: number } };

// ---------------------------------------------------------------------------
// fetchListImages — GET /api/list-images
// ---------------------------------------------------------------------------

/**
 * 외부 저장소 storage inspection 호출. 모든 에러는 normalize.
 *
 * 503 (env_missing)은 운영 안내용 — 호출자가 UI에 "Vercel Blob 미연결" 표시
 * 가능. 401/4xx/5xx는 server 분류.
 */
export async function fetchListImages(): Promise<ListImagesResult> {
  let response: Response;
  try {
    response = await fetch("/api/list-images", {
      method: "GET",
      // admin 도구는 캐시 회피 — 운영자가 항상 최신 상태 확인
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "network",
        message:
          err instanceof Error
            ? `네트워크 실패: ${err.message}`
            : "네트워크 실패",
      },
    };
  }

  // 503은 env 부재 — 별도 분류로 호출자가 운영 안내 가능
  if (response.status === 503) {
    let msg = "Vercel Blob 환경변수가 설정되지 않았습니다.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      // body 파싱 실패는 무시
    }
    return { ok: false, error: { kind: "env_missing", message: msg } };
  }

  if (!response.ok) {
    let msg = `Vercel Blob 조회 실패 (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) msg = `${msg}: ${body.error}`;
    } catch {
      // body 파싱 실패 무시
    }
    return {
      ok: false,
      error: { kind: "server", message: msg, status: response.status },
    };
  }

  // success body parse
  let payload: ListImagesSuccess;
  try {
    payload = (await response.json()) as ListImagesSuccess;
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "parse",
        message:
          err instanceof Error
            ? `응답 파싱 실패: ${err.message}`
            : "응답 파싱 실패",
      },
    };
  }

  if (!payload || payload.ok !== true || !Array.isArray(payload.blobs)) {
    return {
      ok: false,
      error: { kind: "parse", message: "응답 형식이 올바르지 않습니다." },
    };
  }

  return payload;
}

// ---------------------------------------------------------------------------
// requestRemoveBlob — POST /api/delete-image (STEP 61 endpoint 재사용)
// ---------------------------------------------------------------------------

/**
 * 외부 저장소 provider 태그 — STEP 80에서 payload에 명시.
 *
 * 현재 server route(`/api/delete-image`)는 `pathname`만 사용하지만 client
 * payload에 provider를 함께 보내 contract를 명시. 향후 다중 provider 지원 시
 * routing 키로 활용 가능 (server route 수정은 별도 STEP).
 */
const REMOVE_IMAGE_PROVIDER = "vercel_blob" as const;

/**
 * 외부 저장소에서 단일 blob 제거 요청. STEP 61의 `/api/delete-image`를 그대로
 * 재사용 — 본 STEP은 신규 endpoint 추가 0건.
 *
 * **idempotent**: 이미 부재한 blob도 정상 처리됨 (Vercel Blob `del()` 자체가
 * idempotent). 운영자 재시도 안전.
 *
 * **STEP 80 — payload contract**:
 *   { pathname, provider: "vercel_blob" }
 *   server는 현재 pathname만 소비하지만 provider 명시는 향후 호환성 + audit
 *   trail의 의미적 정합성 확보용.
 */
export async function requestRemoveBlob(
  pathname: string
): Promise<RemoveImageResult> {
  let response: Response;
  try {
    response = await fetch("/api/delete-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pathname,
        provider: REMOVE_IMAGE_PROVIDER,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error: {
        message:
          err instanceof Error
            ? `네트워크 실패: ${err.message}`
            : "네트워크 실패",
      },
    };
  }

  if (!response.ok) {
    let msg = `Vercel Blob 제거 요청 실패 (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) msg = `${msg}: ${body.error}`;
    } catch {
      // body 파싱 실패 무시
    }
    return {
      ok: false,
      error: { message: msg, status: response.status },
    };
  }

  return { ok: true, pathname };
}
