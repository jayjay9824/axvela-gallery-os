// ============================================================================
// Image Storage Provider — STEP 53.
//
// 작품 이미지를 외부 storage (Vercel Blob / Cloudflare R2 / S3 등)에 업로드하기
// 위한 추상화 layer. 본 STEP은 LocalPreviewProvider 1개만 활성 — 실제 외부
// 업로드는 사용자 spec 명시로 금지. 향후 STEP에서 본 인터페이스를 그대로
// 구현해 ACTIVE_IMAGE_PROVIDERS 배열에 push하면 다른 코드 변경 0줄로 교체.
//
// **설계 원칙 (STEP 19 / 29 / 50 provider 패턴 일관):**
//   - **Async API** — 실 provider는 fetch / signed URL upload 등 IO 동반.
//     기존 STEP 50 LogisticsProvider는 sync였지만, 본 도메인은 IO 자연 도입.
//   - **결정성 fallback** — LocalPreviewProvider는 항상 base64 inline 반환 →
//     실 provider 실패 시 사용자 흐름 끊김 0건 보장.
//   - **Failure 격리** — provider throw 시 dispatcher가 다음 provider 시도.
//     LocalPreviewProvider가 마지막 fallback이라 dispatcher는 사실상 항상 성공.
//
// **표현 정책:**
//   - "Local image" / "Mock storage" / "외부 storage 미연결" 사용
//   - "법적 효력" / "데이터 보장" 표현 0건
// ============================================================================

/**
 * 단일 이미지 업로드 결과. **URL + 메타데이터 한 묶음**.
 *
 * - `url`은 카드 / hero / drawer preview에서 `<img src>`에 그대로 사용.
 *   LocalPreviewProvider는 data URL, 향후 실 provider는 외부 host URL.
 * - `storageKey`는 향후 delete / replace 호출 시 식별자. provider별 의미 다름
 *   (S3 key / R2 key / Vercel Blob id 등). LocalPreviewProvider는 client-side
 *   ad-hoc id (delete 자체는 no-op이지만 식별자는 부여 — audit 흐름 일관).
 * - `providerId` / `isReal`은 UI에 "Local image" / 실 provider 명시 분기용.
 */
export interface ImageUploadResult {
  url: string;
  storageKey: string;
  providerId: string;
  isReal: boolean;
  size: number;
  mimeType: string;
  uploadedAt: string;
  /**
   * STEP 57 — Fallback에 의해 도달했는지. dispatcher가 첫 provider 실패 후
   * 다음 provider로 넘어갔을 때 true. UI에 "(fallback)" 부가 표시용 — 운영자에게
   * 실 storage 연결이 작동하지 않음을 transparent하게 노출.
   *
   * 옵셔널 + 영속화하지 않음 (UI 시각적 정보) — Artwork 5 필드와 별개.
   */
  wasFallback?: boolean;
}

export type ImageUploadError =
  | { kind: "not_image"; message: string }
  | { kind: "too_large"; message: string; sizeBytes: number }
  | { kind: "provider_failed"; message: string }
  | { kind: "read_failed"; message: string };

export type ImageUploadOutcome =
  | { ok: true; result: ImageUploadResult }
  | { ok: false; error: ImageUploadError };

/**
 * Provider 인터페이스. 향후 실 storage 연동 시 동일 shape 구현.
 *
 * - `upload`는 throw 가능 — dispatcher가 try/catch로 흡수해 다음 provider 시도.
 * - `delete`는 옵션 — LocalPreviewProvider처럼 no-op 가능. 실 provider는
 *   storageKey로 외부 host에서 삭제.
 * - `displayName`은 UI에 "Local image" / "Vercel Blob" / "Cloudflare R2" 등
 *   표시할 짧은 라벨.
 */
export interface ImageStorageProvider {
  readonly providerId: string;
  readonly isReal: boolean;
  readonly displayName: string;
  upload(file: File): Promise<ImageUploadResult>;
  delete?(storageKey: string): Promise<void>;
}
