// ============================================================================
// LocalPreviewImageStorageProvider — STEP 53.
//
// `ImageStorageProvider`의 default 구현. 실제 외부 host 없이 **data URL inline**
// 반환 — 사용자 spec "실제 Vercel Blob / Cloudflare R2 / S3 연결 금지" 준수.
//
// **STEP 50.5 호환**:
//   - 기존 base64 inline 흐름 그대로 유지 (dataUrl이 곧 url)
//   - 기존 데이터 (`artwork.imageUrl`만 있는 record)는 본 provider 결과와
//     자연 호환 — providerId만 부재 (UI에서 "Local image" 라벨 표시)
//
// **결정성 보장**: 같은 file → 같은 url (FileReader는 deterministic).
// `storageKey`만 timestamp 기반이라 호출 시점마다 달라짐 (audit / 추적용).
//
// **표현 정책**: displayName "Local image" — "외부 storage 미연결" 의미.
// ============================================================================

import type {
  ImageStorageProvider,
  ImageUploadResult,
} from "@/types/image-storage-provider";
import { readImageAsDataUrl } from "./artwork-image";

export class LocalPreviewImageStorageProvider implements ImageStorageProvider {
  readonly providerId = "local_preview_v1";
  readonly isReal = false;
  readonly displayName = "Local image";

  async upload(file: File): Promise<ImageUploadResult> {
    // STEP 50.5의 readImageAsDataUrl 재사용 — 같은 검증 / 같은 base64 결과
    const outcome = await readImageAsDataUrl(file);
    if (!outcome.ok) {
      // dispatcher가 catch — 다음 provider로 fallback
      throw new Error(outcome.error.message);
    }

    return {
      url: outcome.result.dataUrl,
      // delete 자체는 no-op이지만 storageKey는 부여 — 향후 replace 흐름에서
      // 이전 이미지 식별자로 활용 가능.
      storageKey: `local-${Date.now().toString(36)}-${randomSuffix()}`,
      providerId: this.providerId,
      isReal: this.isReal,
      size: outcome.result.size,
      mimeType: outcome.result.mimeType,
      uploadedAt: new Date().toISOString(),
    };
  }

  // delete 의도적 미구현 — local data URL은 별도 storage에서 삭제할 게 없음.
  // artwork.imageUrl이 undefined가 되면 GC됨. dispatcher의 delete?.()도
  // optional이라 LocalPreview의 부재 자연 허용.
}

function randomSuffix(): string {
  // 외부 라이브러리 0개 — Math.random + base36 (audit / replace 시 unique 식별만 필요)
  return Math.random().toString(36).slice(2, 8);
}
