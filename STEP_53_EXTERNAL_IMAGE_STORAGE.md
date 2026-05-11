# STEP 53 — External Image Storage (provider 추상화)

> **목표**: 작품 이미지를 외부 storage(Vercel Blob / Cloudflare R2 / S3)에 저장하기 위한
> **provider 추상화 layer 정착**. 본 STEP은 **외부 호출 0건** — LocalPreviewProvider
> 단일 활성. 향후 실 storage 연결 시 dispatcher 배열에 push만 하면 다른 코드
> 변경 0줄.

---

## State

- **이전**: STEP 52 / Route 115 kB
- **이번**: STEP 53 / **Route 116 kB (+1 kB)**
- Build ✅ · type-check ✅ · Lint ✅

---

## 진행 이유

1. STEP 50.5 → 작품 이미지 업로드 base64 inline 방식 구현
2. STEP 52 → JSON 백업/복원 추가 → 이미지가 base64로 커지면 backup 파일 비대
3. 실 운영에서는 이미지를 별도 storage에 저장 + Artwork에 URL만 보관 필요
4. **외부 storage 연결 전, provider 구조 먼저 정착** — STEP 50 LogisticsProvider 패턴 재사용

---

## Flow

```
사용자가 이미지 선택 (drag & drop or click)
  ↓
ArtworkImageUpload.handleFiles
  ↓
uploadImage(file)  ← src/lib/image-storage-provider.ts
  ├─ 입력 가드 (file.type / file.size 3MB)
  └─ provider 순차 시도:
      ├─ ① LocalPreviewImageStorageProvider (현재 활성, fallback)
      │     readImageAsDataUrl → data URL
      │     storageKey = "local-{ts}-{random}"
      │     return ImageUploadResult
      │
      └─ (향후) VercelBlobProvider / R2Provider / S3Provider 추가 시
            → 실 provider 우선 시도, 실패 시 LocalPreview fallback
  ↓
ImageUploadResult { url, storageKey, providerId, isReal, size, mimeType, uploadedAt }
  ↓
ArtworkFormDrawer.setImageMeta(result)
  ↓ submit 시
ArtworkInput { imageUrl, imageStorageKey, imageProvider, imageMimeType, imageSize, imageUploadedAt }
  ↓
store.createArtwork / updateArtwork
  ↓
artwork.imageUrl + 5 메타 필드 영속화
  ↓
ArtworkCard / DetailPanel hero — `<img src={artwork.imageUrl}>` (0줄 변경)
```

**STEP 50.5 흐름 0줄 깨짐** — readImageAsDataUrl 그대로 재사용, ArtworkCard / DetailPanel 0줄 변경.

---

## 변경 / 신규 파일 목록

### 신규 (3 + doc)

| 파일 | LOC | 역할 |
|---|---|---|
| `src/types/image-storage-provider.ts` | ~70 | `ImageStorageProvider` interface + `ImageUploadResult` / `ImageUploadError` 타입 |
| `src/lib/local-preview-image-provider.ts` | ~70 | LocalPreviewProvider 구현 (data URL 그대로) |
| `src/lib/image-storage-provider.ts` | ~120 | Registry / dispatcher / 입력 가드 |
| `STEP_53_EXTERNAL_IMAGE_STORAGE.md` | (이 문서) | 완료 보고 + 향후 연결 가이드 |

### 변경 (4 + ARCHITECTURE.md)

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/types/artwork.ts` | ~20 LOC | 5 옵셔널 provider 메타 필드 추가 |
| `src/store/useArtworkStore.ts` | ~20 LOC | `ArtworkInput` 확장 + `createArtwork` / `updateArtwork` propagate |
| `src/components/artwork/ArtworkImageUpload.tsx` | ~70 LOC | onChange 시그니처 변경 + dispatcher 경유 + provider 라벨 UI |
| `src/components/artwork/ArtworkFormDrawer.tsx` | ~30 LOC | `imageUrl` state → bundled `imageMeta` state |

---

## 핵심 코드

### 1) Provider Interface

```ts
// src/types/image-storage-provider.ts

export interface ImageUploadResult {
  url: string;              // <img src>로 사용
  storageKey: string;       // delete/replace 식별자
  providerId: string;       // "local_preview_v1" / "vercel_blob_v1" / ...
  isReal: boolean;          // mock vs real
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export interface ImageStorageProvider {
  readonly providerId: string;
  readonly isReal: boolean;
  readonly displayName: string;     // "Local image" / "Vercel Blob" / ...
  upload(file: File): Promise<ImageUploadResult>;
  delete?(storageKey: string): Promise<void>;
}
```

### 2) LocalPreviewProvider (default fallback)

```ts
// src/lib/local-preview-image-provider.ts

export class LocalPreviewImageStorageProvider implements ImageStorageProvider {
  readonly providerId = "local_preview_v1";
  readonly isReal = false;
  readonly displayName = "Local image";

  async upload(file: File): Promise<ImageUploadResult> {
    // STEP 50.5의 readImageAsDataUrl 재사용 — 같은 검증 / 같은 base64
    const outcome = await readImageAsDataUrl(file);
    if (!outcome.ok) throw new Error(outcome.error.message);

    return {
      url: outcome.result.dataUrl,
      storageKey: `local-${Date.now().toString(36)}-${randomSuffix()}`,
      providerId: this.providerId,
      isReal: this.isReal,
      size: outcome.result.size,
      mimeType: outcome.result.mimeType,
      uploadedAt: new Date().toISOString(),
    };
  }
  // delete 의도적 미구현 — local data URL은 별도 storage에 없음
}
```

### 3) Dispatcher (STEP 50 LogisticsProvider 패턴)

```ts
// src/lib/image-storage-provider.ts

const ACTIVE_IMAGE_PROVIDERS: ImageStorageProvider[] = [
  new LocalPreviewImageStorageProvider(),
];

export async function uploadImage(file: File): Promise<ImageUploadOutcome> {
  // 1. 입력 가드 (dispatcher 책임)
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: { kind: "not_image", message: "..." } };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, error: { kind: "too_large", message: "...", sizeBytes: file.size } };
  }

  // 2. provider 순차 시도 — try/catch로 throw 흡수, fallback 보장
  let lastError: unknown = null;
  for (const provider of ACTIVE_IMAGE_PROVIDERS) {
    try {
      const result = await provider.upload(file);
      return { ok: true, result };
    } catch (err) {
      lastError = err;  // 다음 provider 시도
    }
  }

  // 3. 모두 실패 — normalize된 에러
  return {
    ok: false,
    error: {
      kind: "provider_failed",
      message: lastError instanceof Error
        ? `이미지 업로드 실패: ${lastError.message}`
        : "이미지 업로드 중 알 수 없는 오류가 발생했습니다.",
    },
  };
}
```

### 4) Artwork 5 옵셔널 필드

```ts
// src/types/artwork.ts

export interface Artwork {
  // ... 기존 필드 (id / title / artist / ... / imageUrl)

  // ── STEP 53 — Image storage provider 메타 (5 옵셔널) ──────
  imageStorageKey?: string;
  imageProvider?: string;
  imageMimeType?: string;
  imageSize?: number;
  imageUploadedAt?: string;
}
```

**Persistence 무영향** — validateV1은 슬라이스 *존재*만 검증, 필드 단위 강제 없음.

### 5) Form drawer — bundled imageMeta state

```tsx
// src/components/artwork/ArtworkFormDrawer.tsx

// STEP 53 — single imageUrl state → bundled imageMeta
const [imageMeta, setImageMeta] = useState<ImageUploadResult | undefined>(
  () => {
    if (!artwork?.imageUrl) return undefined;
    // 편집 모드 hydration — 기존 record의 5 필드 복원
    return {
      url: artwork.imageUrl,
      storageKey: artwork.imageStorageKey ?? "",
      providerId: artwork.imageProvider ?? "",
      isReal: false,  // 기존 record는 isReal 알 수 없음 — false 가정
      size: artwork.imageSize ?? 0,
      mimeType: artwork.imageMimeType ?? "",
      uploadedAt: artwork.imageUploadedAt ?? "",
    };
  }
);

const handleSubmit = (e) => {
  // ...
  const input: ArtworkInput = {
    // ...
    imageUrl: imageMeta?.url,
    imageStorageKey: imageMeta?.storageKey || undefined,
    imageProvider: imageMeta?.providerId || undefined,
    imageMimeType: imageMeta?.mimeType || undefined,
    imageSize: imageMeta?.size || undefined,
    imageUploadedAt: imageMeta?.uploadedAt || undefined,
  };
};

<ArtworkImageUpload
  imageUrl={imageMeta?.url}
  onChange={setImageMeta}              // ← ImageUploadResult | undefined
  fallbackColor={thumbnailColor}
  imageProvider={imageMeta?.providerId || undefined}
/>
```

### 6) UI provider 라벨

```tsx
// src/components/artwork/ArtworkImageUpload.tsx

const activeProvider = useMemo(() => getActiveImageStorageInfo(), []);

const providerDisplayLabel = useMemo(() => {
  if (imageProvider) {
    if (activeProvider && imageProvider === activeProvider.providerId) {
      return activeProvider.displayName;  // "Local image"
    }
    return imageProvider;  // 외부 record id 그대로
  }
  return activeProvider?.displayName ?? "Local image";
}, [imageProvider, activeProvider]);

{imageUrl && (
  <div className="flex items-baseline justify-between gap-2 text-[9.5px] tracking-tightish text-ink-subtle">
    <span className="italic truncate">
      {providerDisplayLabel}
      {activeProvider && !activeProvider.isReal && (
        <span className="ml-1 not-italic">· Mock storage</span>
      )}
    </span>
    {activeProvider && !activeProvider.isReal && (
      <span className="not-italic shrink-0">
        Future external storage ready
      </span>
    )}
  </div>
)}
```

UI 라벨 노출:
- ✅ **Local image** — 기본 표시
- ✅ **Mock storage** — mock provider 시 부가 표기
- ✅ **Future external storage ready** — mock 시 우측 hint

---

## 향후 외부 Storage 연결 가이드

### A. Vercel Blob 연결 시

```ts
// 신규 파일: src/lib/vercel-blob-image-provider.ts

import type { ImageStorageProvider, ImageUploadResult } from "@/types/image-storage-provider";

export class VercelBlobImageStorageProvider implements ImageStorageProvider {
  readonly providerId = "vercel_blob_v1";
  readonly isReal = true;
  readonly displayName = "Vercel Blob";

  async upload(file: File): Promise<ImageUploadResult> {
    const response = await fetch("/api/upload-image", {
      method: "POST",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!response.ok) throw new Error(`Vercel Blob upload failed: ${response.status}`);
    const { url, pathname } = await response.json();

    return {
      url,
      storageKey: pathname,  // Vercel Blob의 pathname을 storageKey로
      providerId: this.providerId,
      isReal: this.isReal,
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
    };
  }

  async delete(storageKey: string): Promise<void> {
    await fetch(`/api/delete-image?pathname=${storageKey}`, { method: "DELETE" });
  }
}

// 변경: src/lib/image-storage-provider.ts (한 줄)
const ACTIVE_IMAGE_PROVIDERS: ImageStorageProvider[] = [
  new VercelBlobImageStorageProvider(),  // ← 추가 (실 provider 우선)
  new LocalPreviewImageStorageProvider(),  // ← fallback 유지
];

// 신규: app/api/upload-image/route.ts (Next.js API route)
import { put } from "@vercel/blob";
export async function POST(request: Request) {
  const blob = await put(`artworks/${Date.now()}.jpg`, request.body!, {
    access: "public",
  });
  return Response.json({ url: blob.url, pathname: blob.pathname });
}
```

**다른 코드 변경 0줄** — store / type / Card / DetailPanel / Form / ImageUpload 모두 그대로 재사용.

환경변수 (Vercel Dashboard):
```
BLOB_READ_WRITE_TOKEN=<token>
```

### B. Cloudflare R2 연결 시

```ts
// 신규: src/lib/r2-image-provider.ts

export class CloudflareR2ImageStorageProvider implements ImageStorageProvider {
  readonly providerId = "r2_v1";
  readonly isReal = true;
  readonly displayName = "Cloudflare R2";

  async upload(file: File): Promise<ImageUploadResult> {
    // 1. signed URL 발급 (서버 API route)
    const presigned = await fetch("/api/r2-presigned").then(r => r.json());
    // 2. PUT to R2
    await fetch(presigned.url, { method: "PUT", body: file });
    // 3. 결과 URL 반환
    return {
      url: presigned.publicUrl,
      storageKey: presigned.key,
      providerId: this.providerId,
      isReal: true,
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
    };
  }
}
```

서버 API에서 `@aws-sdk/client-s3` (R2는 S3 API 호환) 또는 Cloudflare Workers Bindings 사용.

### C. AWS S3 연결 시

R2와 사실상 동일 — endpoint만 변경. `@aws-sdk/client-s3` 사용.

### D. 기타

- **Supabase Storage**: REST API + signed URL — R2와 같은 패턴
- **Firebase Storage**: SDK 사용 — `uploadBytes` + `getDownloadURL`
- **자체 서버**: signed URL pattern 또는 multipart/form-data POST

---

## 검증 매트릭스

### 사용자 spec 검증 항목

| 항목 | 결과 |
|---|---|
| 이미지 업로드 정상 | ✅ uploadImage dispatcher → LocalPreviewProvider |
| 카드에 이미지 표시 | ✅ ArtworkCard 0줄 변경 (artwork.imageUrl 그대로) |
| DetailPanel hero 이미지 표시 | ✅ DetailPanel 0줄 변경 |
| provider metadata 저장 | ✅ Artwork 5 필드 영속화 |
| provider 실패 시 fallback | ✅ LocalPreviewProvider가 마지막 fallback |
| build 통과 | ✅ Route 116 kB |

### 사용자 spec 제약

| 제약 | 결과 |
|---|---|
| 실제 Vercel Blob / R2 / S3 연결 | ✅ 0건 (LocalPreviewProvider만) |
| 외부 API 호출 | ✅ 0건 (FileReader API만) |
| 신규 라이브러리 | ✅ 0개 (`package.json` 0줄) |
| Payment / Settlement / Tax / FX / Customer / AI / Documents | ✅ 0줄 변경 |
| Persistence schema 변경 최소화 | ✅ 옵셔널 필드 5개만, validateV1 무영향 |
| 기존 이미지 업로드 UX 깨짐 | ✅ 0줄 (STEP 50.5 흐름 그대로) |

### 사용자 spec UI 라벨 노출

| 라벨 | 노출 위치 | 결과 |
|---|---|---|
| Local image | ImagePreview 아래 | ✅ italic 텍스트 |
| Mock storage | ImagePreview 아래 | ✅ "· Mock storage" 부가 |
| Future external storage ready | ImagePreview 아래 우측 | ✅ mock 시 hint |

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_4** Trust Layer | provider 메타 영속화 + UI에 mock 여부 transparent 노출 | ✅ 강화 |
| **rule_14** 3-Column | 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | 0줄 변경 | ✅ 보존 |
| **rule_16** 미니멀 디자인 | 작은 italic typography + 그림자 0 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | FormDrawer 안 작은 라벨 추가만 | ✅ 보존 |
| **rule_21** 외부 hook | STEP 50 Logistics에 이어 두 번째 외부 hook 정착 | ✅ **본격화** |

---

## 다음 STEP 후보

```
STEP 54  Logistics 통합 view
         - Customer / Reporting / Documents 패턴 일관
         - "이번 주 출고 / 배송 / 검수" 한 화면

STEP 55  실 외부 storage 연결 (Vercel Blob)
         - 본 STEP의 가이드 그대로 적용
         - 환경변수 + API route + provider class 추가만

STEP 56  Documents Hub 후속:
         - 개별 PDF ZIP 다운로드
         - 작가 / 작품별 추가 필터

STEP 57  Backup 자동 알림
         - "마지막 백업 N일 전" 표시
         - 30일 이상 미백업 시 경고
```

---

## 결과 요약

- 신규 파일 3개 (type 1 + lib 2, 총 ~260 LOC)
- 수정 파일 4개 (type / store / ImageUpload / FormDrawer)
- 0 신규 라이브러리 / 0 외부 API / 0 외부 storage 연결
- Persistence schema 옵셔널 필드 5개만 (validateV1 무영향)
- STEP 50.5 흐름 0줄 깨짐 (readImageAsDataUrl 그대로 재사용)
- ArtworkCard / DetailPanel 0줄 변경 (artwork.imageUrl 그대로 사용)
- 향후 실 storage 연결 시 dispatcher 배열에 push만으로 교체 가능
- UI에 "Local image · Mock storage · Future external storage ready" 모두 노출
- Route +1 kB (115 → 116 kB)

**STEP 53 완료. 외부 storage 연결을 위한 provider 추상화 layer 정착.**
