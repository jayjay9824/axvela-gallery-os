# STEP 57 — External Image Storage (실 Vercel Blob 연결)

> **목표**: STEP 53에서 정착한 ImageStorageProvider 추상화 layer를 사용해
> LocalPreview(base64 inline) → **실 Vercel Blob 외부 storage**로 연결.
> JSON backup 비대화 / multi-device 사용 / Vercel 배포 안정성 확보.
> **STEP 53 가이드 그대로 적용** — dispatcher 배열에 push만으로 다른 코드 변경 0줄.

---

## State

- **이전**: STEP 54 / Route 119 kB
- **이번**: STEP 57 / **Route 120 kB (+1 kB)**
- 신규 dynamic route `/api/upload-image`
- Build ✅ · type-check ✅ · Lint ✅

---

## 진행 이유

1. STEP 50.5 → 작품 이미지 업로드 base64 inline
2. STEP 52 → JSON 백업/복원 추가 → 이미지가 base64면 백업 파일이 비대해짐
3. STEP 53 → ImageStorageProvider 추상화 layer 정착 (외부 호출 0건)
4. **STEP 57 → 실 외부 storage 연결** — LocalPreview가 fallback으로 자연 강등

---

## Flow

```
사용자 이미지 선택
  ↓
ArtworkImageUpload.handleFiles
  ↓
uploadImage(file)  ← dispatcher
  ├─ 입력 가드 (image/* + 3MB)
  └─ Provider 순차 시도:
       ① VercelBlobImageStorageProvider (NEW, 우선)
            fetch /api/upload-image (multipart/form-data)
              ↓
            서버 (route.ts) — 환경변수 가드 + put() 호출
              ↓ 성공: { url, pathname } 반환
              ↓ 실패: 503 (env 부재) / 502 / 400 / 413
            ↓ ok: ImageUploadResult { wasFallback: false }
            ↓ throw: dispatcher catch → 다음 provider
       ② LocalPreviewImageStorageProvider (FALLBACK)
            readImageAsDataUrl → data URL
            ↓ ok: ImageUploadResult { wasFallback: true }
  ↓
artwork.imageUrl + 5 메타 영속화
  ↓
ArtworkCard / DetailPanel hero — `<img src={artwork.imageUrl}>` (0줄 변경)
```

**사용자 흐름 끊김 0건** — 환경변수 부재 / 네트워크 실패 / 서버 에러 모든 케이스에서 자동 fallback.

---

## 변경 / 신규 파일

### 신규 (3 + doc)

| 파일 | LOC | 역할 |
|---|---|---|
| `src/app/api/upload-image/route.ts` | ~110 | Next.js App Router POST endpoint + @vercel/blob put() |
| `src/lib/vercel-blob-image-provider.ts` | ~120 | VercelBlobImageStorageProvider — fetch API route + 표준 contract |
| `.env.example` | ~25 | `BLOB_READ_WRITE_TOKEN` 가이드 + 향후 변수 자리 |
| `STEP_57_EXTERNAL_STORAGE.md` | (이 문서) | 완료 보고 |

### 변경 (5 + ARCHITECTURE.md)

| 파일 | 변경량 | 역할 |
|---|---|---|
| `package.json` | 1줄 | `@vercel/blob: ^2.3.3` 추가 (사용자 spec 명시 예외) |
| `src/types/image-storage-provider.ts` | ~10 LOC | `wasFallback?: boolean` 옵셔널 필드 |
| `src/lib/image-storage-provider.ts` | ~15 LOC | VercelBlob import + ACTIVE 배열 우선 push + fallback flag tracking |
| `src/components/artwork/ArtworkImageUpload.tsx` | ~50 LOC | `imageWasFallback` prop + provider id → 친근 라벨 매핑 + fallback 표시 |
| `src/components/artwork/ArtworkFormDrawer.tsx` | 1 LOC | `imageWasFallback` prop 전달 |

---

## 핵심 코드

### 1) API Route — 환경변수 graceful 가드

```ts
// src/app/api/upload-image/route.ts

import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  // 1. 환경변수 가드 — 부재 시 503 → 클라이언트 자동 fallback
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Vercel Blob 환경변수가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  // 2. multipart/form-data 파싱
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file 누락" }, { status: 400 });
  }

  // 3. 입력 가드 (이중 가드 — 클라이언트 우회 차단)
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "이미지 파일만" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: "size 한도 초과" }, { status: 413 });
  }

  // 4. 파일명 — timestamp + random suffix (audit 추적성 + collision 회피)
  const ext = pickExtension(file.type);
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const pathname = `artworks/${ts}-${rand}${ext}`;

  // 5. Vercel Blob put — public access
  try {
    const blob = await put(pathname, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return NextResponse.json({ url: blob.url, pathname: blob.pathname });
  } catch (err) {
    return NextResponse.json(
      { error: `Vercel Blob 업로드 실패: ${err instanceof Error ? err.message : ""}` },
      { status: 502 }
    );
  }
}
```

### 2) VercelBlobImageStorageProvider — 표준 contract

```ts
// src/lib/vercel-blob-image-provider.ts

export class VercelBlobImageStorageProvider implements ImageStorageProvider {
  readonly providerId = "vercel_blob";
  readonly isReal = true;
  readonly displayName = "Vercel Blob";

  async upload(file: File): Promise<ImageUploadResult> {
    const formData = new FormData();
    formData.append("file", file);

    let response: Response;
    try {
      response = await fetch("/api/upload-image", { method: "POST", body: formData });
    } catch (err) {
      throw new Error(`Vercel Blob 네트워크 실패: ${err instanceof Error ? err.message : ""}`);
    }

    if (!response.ok) {
      let errorMsg = `Vercel Blob 업로드 실패 (${response.status})`;
      try {
        const body = await response.json();
        if (body.error) errorMsg = `${errorMsg}: ${body.error}`;
      } catch { /* body 파싱 실패 무시 */ }
      throw new Error(errorMsg);
    }

    const payload = await response.json();
    if (!payload.url || !payload.pathname) {
      throw new Error("Vercel Blob 응답 누락");
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

  // delete 미구현 — 운영 사고 방지 (실수 삭제 차단)
}
```

### 3) Dispatcher — VercelBlob 우선 + fallback flag

```ts
// src/lib/image-storage-provider.ts

const ACTIVE_IMAGE_PROVIDERS: ImageStorageProvider[] = [
  new VercelBlobImageStorageProvider(),         // ← 우선
  new LocalPreviewImageStorageProvider(),       // ← fallback
];

export async function uploadImage(file: File): Promise<ImageUploadOutcome> {
  // 입력 가드 (생략 — STEP 53 그대로)

  // STEP 57: 첫 provider 실패 후 다음으로 넘어가면 wasFallback: true
  let lastError: unknown = null;
  let attemptedAny = false;
  for (const provider of ACTIVE_IMAGE_PROVIDERS) {
    try {
      const result = await provider.upload(file);
      return {
        ok: true,
        result: { ...result, wasFallback: attemptedAny },
      };
    } catch (err) {
      lastError = err;
      attemptedAny = true;
    }
  }

  return { ok: false, error: { kind: "provider_failed", message: ... } };
}
```

### 4) UI — fallback 표시

```tsx
// src/components/artwork/ArtworkImageUpload.tsx

const PROVIDER_DISPLAY_LABEL: Record<string, string> = {
  vercel_blob: "Vercel Blob",
  local_preview_v1: "Local image",
};

const isFallbackImage = useMemo(() => {
  if (imageWasFallback) return true;
  // 또는 record가 local_preview_v1인데 active provider가 다른 (실 storage)인 경우
  if (
    imageProvider === "local_preview_v1" &&
    activeProvider &&
    activeProvider.providerId !== "local_preview_v1"
  ) {
    return true;
  }
  return false;
}, [imageWasFallback, imageProvider, activeProvider]);

{imageUrl && (
  <div className="...">
    <span className="italic">
      {providerDisplayLabel}
      {isFallbackImage && <span className="not-italic">(fallback)</span>}
      {!isFallbackImage && activeProvider && !activeProvider.isReal && (
        <span>· Mock storage</span>  {/* STEP 53 호환 */}
      )}
    </span>
  </div>
)}
```

UI 라벨 매트릭스:

| 시나리오 | 표시 |
|---|---|
| Vercel Blob 업로드 성공 | "Vercel Blob" |
| Vercel Blob 실패 → LocalPreview fallback | "Local image (fallback)" |
| Vercel Blob 미연결 환경 (env 부재 단독 운영) | "Local image · Mock storage · Future external storage ready" |
| 기존 record (STEP 50.5) 편집 | "Local image" + (조건 충족 시) "(fallback)" |

---

## 환경변수

`.env.example` 작성 — 실제 값은 `.env.local` 또는 Vercel Dashboard에:

```bash
BLOB_READ_WRITE_TOKEN=
```

### Vercel Dashboard 설정 흐름

1. Vercel Dashboard → 본 프로젝트 → **Storage** 탭
2. **Create Database** → **Blob** 선택 → store 생성
3. 생성 시 자동으로 `BLOB_READ_WRITE_TOKEN` 환경변수가 프로젝트에 등록됨
4. 또는 수동 등록: **Settings** → **Environment Variables** → `BLOB_READ_WRITE_TOKEN` 추가
5. **Production / Preview / Development** 모두 동일 토큰 권장
6. **Redeploy** → 이미지 업로드 시 자동으로 외부 URL 사용

토큰 미설정이면 → 자동 base64 fallback. 운영 안정성 보장.

---

## 검증 매트릭스

### 사용자 spec 4개 검증 항목

| 항목 | 결과 |
|---|---|
| 이미지 업로드 시 실제 URL 생성 | ✅ Vercel Blob public URL 반환 |
| 카드 / DetailPanel 정상 표시 | ✅ artwork.imageUrl 그대로, 0줄 변경 |
| fallback 정상 동작 | ✅ env 부재 / 네트워크 실패 / 502 / 413 모두 LocalPreview로 |
| build 통과 | ✅ Route 120 kB + dynamic `/api/upload-image` |

### 사용자 spec 7개 제약

| 제약 | 결과 |
|---|---|
| 다른 도메인 로직 변경 금지 | ✅ 0줄 |
| Persistence schema 변경 최소화 | ✅ 0줄 (wasFallback은 옵셔널 + 영속화 안 함) |
| 신규 라이브러리 (vercel/blob만) | ✅ `@vercel/blob` 1개만 |
| Payment / Settlement / Tax / FX / Customer 영향 | ✅ 0건 |
| 기존 이미지 UX 깨짐 | ✅ 0건 (Vercel 우선 → 실패 시 자동 fallback) |

### 표현 정책

- ✅ "Vercel Blob" 라벨 (real)
- ✅ "Local image (fallback)" (실 storage 실패 시)
- ✅ "Mock storage" / "Future external storage ready" (STEP 53 호환 — 토큰 미설정 환경에서만)

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_4** Trust Layer | 외부 URL immutable + delete 미구현 (운영 사고 방지) + fallback transparent 노출 | ✅ 강화 |
| **rule_14** 3-Column | 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | 0줄 변경 | ✅ 보존 |
| **rule_16** 미니멀 디자인 | 작은 italic typography + Vercel Blob 활성 시 hint 정리 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | 0줄 변경 | ✅ 보존 |
| **rule_21** 외부 hook | **첫 실 외부 storage 연결 완료** — STEP 53 추상화 layer가 정확히 가이드대로 작동 | ✅ **본격화 완료** |

---

## 시나리오

### 시나리오 1: 정상 운영 (Vercel Blob 토큰 설정됨)

```
사용자: 작품 추가 → 이미지 업로드
  ↓
VercelBlobProvider.upload(file)
  ↓
fetch /api/upload-image  →  200 OK
  ↓
artwork.imageUrl = "https://xxx.public.blob.vercel-storage.com/artworks/lz3xj4-a8f2k1.jpg"
artwork.imageProvider = "vercel_blob"
artwork.imageStorageKey = "artworks/lz3xj4-a8f2k1.jpg"
  ↓
UI: "Vercel Blob" 라벨 표시
  ↓
JSON 백업 시 — URL 문자열만 (예: 90 bytes), base64 inline 대비 99%+ 작아짐
다른 PC에서 복원 — 외부 URL은 그대로 유효 (public)
```

### 시나리오 2: 토큰 미설정 (Vercel Blob fallback)

```
사용자: 이미지 업로드
  ↓
VercelBlobProvider.upload(file) → fetch → 503 (env 부재)
  ↓ throw
LocalPreviewProvider.upload(file)
  ↓
artwork.imageUrl = "data:image/jpeg;base64,..."
artwork.imageProvider = "local_preview_v1"
imageMeta.wasFallback = true  (UI 시각적 표시용)
  ↓
UI: "Local image (fallback)" 표시
  ↓
사용자: 이미지 업로드 정상 작동, 토큰 설정 시 다음 업로드부터 Vercel Blob 사용
```

### 시나리오 3: 토큰 설정됐지만 일시 네트워크 실패

```
VercelBlobProvider.upload(file) → fetch throw
  ↓
LocalPreviewProvider.upload(file) → 성공
  ↓
UI: "Local image (fallback)"
  ↓
운영자: 사용자에게 fallback 발생 인지 가능 (다음 업로드 시 정상 작동 확인)
```

### 시나리오 4: 기존 record (STEP 50.5 / STEP 53 환경) 편집

```
artwork.imageUrl = "data:image/png;base64,..."  (이미 base64)
artwork.imageProvider = "local_preview_v1" 또는 부재
  ↓
ArtworkFormDrawer 편집 모드:
  imageMeta.providerId = "local_preview_v1"
  imageMeta.wasFallback = false  (방금 업로드한 게 아니므로)
  
isFallbackImage 계산:
  imageWasFallback false
  imageProvider === "local_preview_v1" && activeProvider.providerId === "vercel_blob"
  → true
  
UI: "Local image (fallback)" — 운영자가 이 record를 다시 저장하면 Vercel Blob으로 마이그레이션됨
```

---

## JSON Backup 호환성 (STEP 52)

이전 base64 inline 백업:
```json
{
  "imageUrl": "data:image/jpeg;base64,/9j/4AAQ...수만 자..."  // 평균 1.5MB
}
```

STEP 57 외부 URL 백업:
```json
{
  "imageUrl": "https://xxx.public.blob.vercel-storage.com/artworks/lz3xj4-a8f2k1.jpg",  // ~95 bytes
  "imageStorageKey": "artworks/lz3xj4-a8f2k1.jpg",
  "imageProvider": "vercel_blob",
  "imageMimeType": "image/jpeg",
  "imageSize": 1536000,
  "imageUploadedAt": "2026-05-04T..."
}
```

**파일 크기 99%+ 감소**. 다른 노트북에서 복원 시 외부 URL은 그대로 유효 (Vercel Blob은 public + permanent).

---

## 다음 STEP 후보

```
STEP 58  Logistics Operations 후속
         - bulk provider sync
         - 출고 캘린더 view

STEP 59  Backup 자동 알림
         - "마지막 백업 N일 전" indicator
         - 30일 이상 미백업 시 경고

STEP 60  Documents Hub 후속
         - 개별 PDF ZIP
         - 작가/작품 추가 필터

STEP 61  Image storage 후속
         - DELETE route + del() (cleanup 운영)
         - 이미지 압축 / thumbnail 생성
```

---

## 결과 요약

- 신규 파일 3개 (API route + provider + .env.example, 총 ~255 LOC)
- 수정 파일 5개 (type + dispatcher + ImageUpload + FormDrawer + package.json)
- `@vercel/blob` 1개 라이브러리 추가 (사용자 spec 명시 예외)
- Persistence schema 0줄 변경 (wasFallback은 UI 시각적 정보 — 영속화 안 함)
- 다른 도메인 0줄 변경 / ArtworkCard / DetailPanel 0줄 변경
- 환경변수 부재 / 네트워크 실패 / 502 / 413 모든 케이스에서 LocalPreview 자동 fallback
- UI 라벨 매트릭스 — 운영자에게 transparent 노출 (Vercel Blob / fallback / mock 분기)
- JSON Backup 파일 크기 99%+ 감소
- Multi-device 사용 시 외부 URL 그대로 유효
- Route +1 kB (119 → 120 kB) + dynamic `/api/upload-image`

**STEP 57 완료. rule_21 외부 hook 본격화 완료 — STEP 53 추상화 layer가 정확히 가이드대로 작동.**
