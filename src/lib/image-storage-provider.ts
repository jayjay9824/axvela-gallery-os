// ============================================================================
// Image Storage Provider Registry — STEP 53.
//
// STEP 50 logistics-provider.ts 패턴 답습. Provider 집합을 한 곳에서 관리,
// 호출자(ArtworkImageUpload)는 단일 dispatcher 함수만 사용.
//
// **본 STEP은 ACTIVE_IMAGE_PROVIDERS에 LocalPreviewProvider 1개만**.
// 외부 호출 0줄. 향후 Vercel Blob / Cloudflare R2 / S3 연결 시 본 배열에
// 새 provider를 push하면 다른 코드 변경 0건.
//
// **입력 가드는 dispatcher가 담당** — provider는 순수 업로드만. 사용자 spec
// 명시 (3MB guard 유지) → MAX_IMAGE_SIZE_BYTES 본 모듈에서 사전 차단.
//
// **Fallback 보장** — LocalPreviewProvider가 항상 마지막 fallback이라
// dispatcher는 사실상 항상 성공 (FileReader 자체 실패가 아닌 한). 사용자
// 흐름 끊김 0건.
// ============================================================================

import type {
  ImageStorageProvider,
  ImageUploadOutcome,
} from "@/types/image-storage-provider";
import { LocalPreviewImageStorageProvider } from "./local-preview-image-provider";
import { VercelBlobImageStorageProvider } from "./vercel-blob-image-provider";
import { MAX_IMAGE_SIZE_BYTES, formatBytes } from "./artwork-image";

// ---------------------------------------------------------------------------
// Active provider registry
// ---------------------------------------------------------------------------

/**
 * 활성 provider 목록. 순서 = 우선순위 (앞쪽이 first-try).
 *
 * v2 (STEP 57): VercelBlobProvider 우선 + LocalPreviewProvider fallback.
 * 향후 STEP에서: + CloudflareR2Provider / S3Provider 등.
 *
 * **provider 추가 시 가이드:**
 *   1. `ImageStorageProvider` 인터페이스 구현
 *   2. 본 배열 맨 앞에 push (실 provider 우선 시도)
 *   3. LocalPreviewProvider는 마지막 fallback으로 유지 — 실 provider 실패 시
 *      사용자 흐름 끊김 0건 보장
 *   4. 환경변수 부재 시 서버측 graceful 503 반환 → 클라이언트 catch → fallback
 *      (provider 자체에서 환경변수 검증할 필요 없음 — 서버 책임)
 */
const ACTIVE_IMAGE_PROVIDERS: ImageStorageProvider[] = [
  new VercelBlobImageStorageProvider(),
  new LocalPreviewImageStorageProvider(),
];

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

/**
 * 이미지 업로드. 첫 성공 provider 결과 반환, 모두 실패 시 normalize된 error.
 *
 * 호출 흐름:
 *   1. 입력 가드 (file.type / file.size) — dispatcher 책임
 *   2. provider 순차 시도 — try/catch로 throw 흡수
 *   3. 모두 실패 시 normalize된 ImageUploadError
 *
 * **모든 에러는 reject 대신 normalize** — 호출자는 ok 분기로 단일 처리.
 */
export async function uploadImage(file: File): Promise<ImageUploadOutcome> {
  // 1. Input gates — provider 호출 전 빠른 차단
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

  // 2. Provider 순차 시도 — STEP 57: 첫 provider 실패 후 다음으로 넘어가면
  //    `wasFallback: true` mark → UI에 "(fallback)" 부가 표시.
  let lastError: unknown = null;
  let attemptedAny = false;
  for (const provider of ACTIVE_IMAGE_PROVIDERS) {
    try {
      const result = await provider.upload(file);
      return {
        ok: true,
        result: {
          ...result,
          wasFallback: attemptedAny,
        },
      };
    } catch (err) {
      lastError = err;
      attemptedAny = true;
      // 다음 provider 시도. LocalPreviewProvider가 마지막에 있으므로
      // 보통 첫 provider가 실패해도 fallback이 성공함.
    }
  }

  // 3. 모든 provider 실패 — 사용자에게 일관된 메시지로 통보
  return {
    ok: false,
    error: {
      kind: "provider_failed",
      message:
        lastError instanceof Error
          ? `이미지 업로드 실패: ${lastError.message}`
          : "이미지 업로드 중 알 수 없는 오류가 발생했습니다.",
    },
  };
}

/**
 * UI에 "Local image" / "Vercel Blob" 등 제공자 라벨 표시용. 활성 provider
 * 목록의 첫 번째 (가장 우선순위 높은) provider 정보 반환.
 *
 * 향후 다중 provider 환경에서는 실 provider가 첫 번째로 배치되어 있으므로
 * 자연스럽게 "Vercel Blob" 등 표시됨. 현재는 "Local image" 단독.
 */
export function getActiveImageStorageInfo(): {
  providerId: string;
  isReal: boolean;
  displayName: string;
} | null {
  const first = ACTIVE_IMAGE_PROVIDERS[0];
  if (!first) return null;
  return {
    providerId: first.providerId,
    isReal: first.isReal,
    displayName: first.displayName,
  };
}

/**
 * 실 외부 storage provider 보유 여부. UI 분기용 — 향후 "Future external
 * storage ready" hint 노출 결정에 사용.
 */
export function hasRealImageStorage(): boolean {
  return ACTIVE_IMAGE_PROVIDERS.some((p) => p.isReal);
}

// ---------------------------------------------------------------------------
// STEP 61 — Image deletion dispatcher
// ---------------------------------------------------------------------------

/**
 * 외부 storage 측 이미지 제거 요청. providerId로 적절한 provider를 찾아
 * `delete()` 호출 — provider가 delete를 구현하지 않으면 silent no-op (true 반환).
 *
 * **호출자 policy** (deleteArtworkImage store action):
 *   1. local_preview_v1 (base64 inline) → 본 함수 호출하지 않음 (artwork에서
 *      제거하면 자동 GC). 호출자가 사전 분기.
 *   2. vercel_blob 등 실 storage → 본 함수 호출 → /api/delete-image POST →
 *      del() 호출. 실패 시 throw, 호출자가 catch해서 fallback.
 *
 * **idempotent 보장**: 이미 부재한 blob도 정상 처리 (Vercel Blob `del()` 자체가
 * idempotent). 운영자 재시도 / 동시 호출 안전.
 *
 * **failure isolation**: provider 실패는 throw — 호출자가 결정. 보통 store
 * action은 catch해서 silent (artwork.imageUrl만 제거 — 외부 host에 잔존해도
 * 사용자 흐름은 유지, 향후 orphan cleanup helper로 일괄 제거).
 */
export async function deleteImageByProvider(
  providerId: string,
  storageKey: string
): Promise<void> {
  if (!storageKey || storageKey.trim() === "") {
    // storageKey 부재 = local fallback record — 외부 호출 의미 없음
    return;
  }

  const provider = ACTIVE_IMAGE_PROVIDERS.find(
    (p) => p.providerId === providerId
  );

  // provider not found — STEP 53 호환: 과거 record가 다른 provider로 업로드되어
  // 현재 active 배열에 없는 경우. silent skip (운영자 책임 영역으로 위임).
  if (!provider) return;

  // delete 미구현 provider (LocalPreview 등) — silent skip
  if (!provider.delete) return;

  // 실 provider delete 호출 — failure 시 throw, 호출자가 catch
  await provider.delete(storageKey);
}
