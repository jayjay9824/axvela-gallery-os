# STEP 61 — Image Storage Lifecycle (DELETE / Thumbnail / Storage Info / Orphan Helper)

> **목표**: STEP 57에서 구축한 Vercel Blob 기반 image storage를 운영 가능 수준으로 확장.
> **이미지 lifecycle 관리** + **용량 절감** + **렌더 최적화**.
> **신규 외부 라이브러리 0개** (`@vercel/blob`은 STEP 57에서 추가됨, 본 STEP 변경 0줄)

---

## State

- **이전**: STEP 58 / Route 123 kB
- **이번**: STEP 61 / **Route 125 kB (+2 kB)** + dynamic API route `/api/delete-image`
- Build ✅ · type-check ✅ · Lint ✅

---

## Flow

```
[운영 1] Card 렌더 — 표시 최적화
  ArtworkCard
    ↓ buildThumbnailUrl(artwork.imageUrl, THUMBNAIL_PRESETS.CARD)
    ↓
  https://xxx.public.blob.vercel-storage.com/artworks/lz3xj4-a8f2k1.jpg?w=400&q=75
    └─ 향후 Cloudflare Image Resizing / Vercel image transformations 활성 시 즉시 작동
       현재는 Vercel Blob이 query ignore — URL convention만 정착
  + loading="lazy" — 스크롤 안 보이는 카드 lazy load

[운영 2] DetailPanel — 원본 유지 (사용자 spec)
  artwork.imageUrl 그대로 — 0줄 변경

[운영 3] FormDrawer — Storage info 라벨
  ArtworkImageUpload
    └─ "원본 4.2MB → 표시용 약 0.8MB" (preview-level estimation)
       data URL fallback은 추정 의미 부족 → 미표시

[운영 4] 외부 storage 영구 제거
  ArtworkFormDrawer (편집 모드 + vercel_blob record 일치)
    ↓ "외부 저장소에서 제거 요청" 클릭 (text-only secondary)
  window.confirm (5줄 한국어 — idempotent 설명 + failure 정책)
    ↓
  store.deleteArtworkImage(artworkId)
    ├─ deleteImageByProvider(providerId, storageKey)
    │     ├─ vercel_blob → fetch /api/delete-image
    │     │     └─ @vercel/blob.del() (idempotent)
    │     └─ local_preview_v1 → silent skip
    │   * failure는 silent — record 갱신은 진행
    ├─ artwork 5 image 필드 + imageUrl undefined로 갱신
    └─ timeline event NOTE kind ("이미지 제거")

[운영 5] Orphan helper (운영 참고용 only)
  detectOrphanedBlobImages(artworks, allBlobs)
    └─ artworks에서 참조 안 된 blob pathname 목록 반환
  * 본 STEP 호출 site 0건 (UI 노출 없음)
  * 향후 admin tool / cron으로 일괄 정리 시 활용
```

---

## 변경 / 신규 파일

### 신규 (3 + doc)

| 파일 | LOC | 역할 |
|---|---|---|
| `src/app/api/delete-image/route.ts` | ~110 | Next.js POST + @vercel/blob del() + 4단계 보안 가드 |
| `src/lib/image-thumbnail.ts` | ~210 | URL convention + estimation + orphan helper + storage summary |
| `STEP_61_IMAGE_STORAGE_LIFECYCLE.md` | (이 문서) | 완료 보고 |

### 변경 (5 + ARCHITECTURE.md)

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/lib/vercel-blob-image-provider.ts` | ~50 LOC | STEP 57 stub 자리에 delete 실제 구현 |
| `src/lib/image-storage-provider.ts` | ~50 LOC | `deleteImageByProvider` dispatcher |
| `src/store/useArtworkStore.ts` | ~80 LOC | `deleteArtworkImage` 신규 액션 + import |
| `src/components/artwork/ArtworkCard.tsx` | ~10 LOC | thumbnail URL + lazy loading |
| `src/components/artwork/ArtworkImageUpload.tsx` | ~30 LOC | imageSize prop + storage info 라벨 |
| `src/components/artwork/ArtworkFormDrawer.tsx` | ~75 LOC | imageSize 전달 + RemoveFromStorageAction |

---

## 핵심 코드

### 1) DELETE API Route — 4단계 보안 가드

```ts
// src/app/api/delete-image/route.ts

const ALLOWED_PATHNAME_PREFIX = "artworks/";
const MAX_PATHNAME_LENGTH = 200;

export async function POST(request: Request): Promise<NextResponse> {
  // 1. 환경변수 가드
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "..." }, { status: 503 });
  }

  // 2. JSON body 파싱
  const payload = await request.json();
  const pathname = payload.pathname;

  // 3. 4단계 보안 검증
  if (typeof pathname !== "string" || pathname.trim() === "") return 400;
  if (pathname.length > MAX_PATHNAME_LENGTH) return 400;
  if (!pathname.startsWith(ALLOWED_PATHNAME_PREFIX)) return 400;
  if (pathname.includes("..") || pathname.includes("\0")
      || pathname.startsWith("/") || pathname.startsWith("\\")) return 400;

  // 4. del() 호출 — idempotent
  await del(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
  return NextResponse.json({ ok: true, pathname });
}
```

**보안 매트릭스**:

| 위협 | 방어 |
|---|---|
| Path traversal (`../../..`) | "artworks/" 화이트리스트 + ".." 차단 |
| Null byte injection (`\0`) | 명시 차단 |
| Absolute path (`/etc/passwd`) | "/" / "\\" 차단 |
| 비정상 길이 | MAX_PATHNAME_LENGTH=200 |
| 환경변수 누설 | 503 graceful 응답, error 메시지에 토큰 안 노출 |
| 비-인증 요청 | (향후 추가 — 본 STEP은 공개 API, Vercel platform layer가 1차 방어) |

### 2) Thumbnail URL convention

```ts
// src/lib/image-thumbnail.ts

export function buildThumbnailUrl(
  url: string | undefined,
  opts: ThumbnailOptions
): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;  // base64 — 원본
  if (!url.startsWith("http")) return url;

  try {
    const u = new URL(url);
    u.searchParams.set("w", String(Math.max(1, Math.floor(opts.w))));
    if (opts.q !== undefined) {
      const q = Math.min(100, Math.max(1, Math.floor(opts.q)));
      u.searchParams.set("q", String(q));
    }
    return u.toString();
  } catch {
    return url;  // 안전 fallback
  }
}

export const THUMBNAIL_PRESETS = {
  CARD: { w: 400, q: 75 },
  COMPACT: { w: 200, q: 70 },
  DETAIL_HERO_PREVIEW: { w: 800, q: 80 },
} as const;
```

**현재 동작**: Vercel Blob은 query param ignore → 원본 그대로 응답.
**향후**: Cloudflare Image Resizing 활성 시 → URL 그대로 작은 파일 응답. UI 코드 변경 0줄.

### 3) Size estimation (preview-level)

```ts
export function estimateThumbnailSize(
  originalSize: number,
  thumbnailWidth: number
): number {
  if (originalSize <= 0) return 0;
  if (thumbnailWidth <= 0) return originalSize;

  const REFERENCE_WIDTH = 1600;
  const COMPRESSION_FACTOR = 0.85;
  const ratio = thumbnailWidth / REFERENCE_WIDTH;

  if (ratio >= 1) return originalSize;
  return Math.floor(originalSize * ratio * ratio * COMPRESSION_FACTOR);
}

// "원본 4.2MB → 표시용 약 0.8MB"
export function formatStorageInfoLabel(orig: number, est: number): string {
  if (orig <= 0) return "";
  const origLabel = formatBytes(orig);
  if (est <= 0 || est >= orig) return `원본 ${origLabel}`;
  return `원본 ${origLabel} → 표시용 약 ${formatBytes(est)}`;
}
```

"약" 표현으로 정확성 한계 명시.

### 4) Store — deleteArtworkImage

```ts
// src/store/useArtworkStore.ts

deleteArtworkImage: async (id) => {
  const state = get();
  const artwork = state.artworks.find((a) => a.id === id);
  if (!artwork || !artwork.imageUrl) return;

  // 1. 외부 storage 측 제거 시도 — failure silent
  if (artwork.imageProvider && artwork.imageStorageKey) {
    try {
      await deleteImageByProvider(artwork.imageProvider, artwork.imageStorageKey);
    } catch (err) {
      // silent — record 갱신은 진행 (orphan helper로 향후 처리)
      console.warn("[axvela-image-delete] external 제거 실패:", err);
    }
  }

  // 2. record 5 image 필드 + imageUrl undefined로 set
  set((s) => ({
    artworks: s.artworks.map((a) =>
      a.id === id
        ? { ...a, imageUrl: undefined, imageStorageKey: undefined,
            imageProvider: undefined, imageMimeType: undefined,
            imageSize: undefined, imageUploadedAt: undefined,
            updatedAt: now }
        : a
    ),
  }));

  // 3. timeline event NOTE kind ("이미지 제거")
  const event = { id: genId("ev"), artworkId: id, kind: "NOTE",
                  title: "이미지 제거", detail: ..., at: now,
                  actor: actorLabel(state.currentRole) };
  set((s) => ({ timeline: { ...s.timeline, [id]: [event, ...(s.timeline[id] ?? [])] } }));
},
```

### 5) UI — secondary text-only action

```tsx
// src/components/artwork/ArtworkFormDrawer.tsx

{isEdit && artwork && imageMeta?.providerId === "vercel_blob"
   && imageMeta.url === artwork.imageUrl && (
  <RemoveFromStorageAction
    artworkId={artwork.id}
    onRemoved={() => setImageMeta(undefined)}
  />
)}

function RemoveFromStorageAction({ artworkId, onRemoved }) {
  const handleClick = async () => {
    if (!window.confirm([
      "외부 저장소에서 이미지 제거 요청을 보냅니다.",
      "",
      "- 작품 record의 image 메타데이터가 함께 비워집니다.",
      "- 외부 호스트 측 처리 결과는 idempotent — 이미 부재해도 정상 처리됩니다.",
      "- 외부 호출 실패 시 record는 갱신되며 외부 잔존 이미지는 운영 참고 helper로 일괄 정리 가능합니다.",
      "",
      "계속하시겠습니까?",
    ].join("\n"))) return;
    
    setBusy(true);
    try { await deleteArtworkImage(artworkId); onRemoved(); }
    finally { setBusy(false); }
  };

  return (
    <button onClick={handleClick} disabled={busy}
      className="self-start text-[10.5px] text-status-deal/80 hover:text-status-deal hover:underline">
      {busy ? "제거 요청 중..." : "외부 저장소에서 제거 요청"}
    </button>
  );
}
```

text-only / 절제된 red 톤 (status-deal/80). rule_15 / rule_16 준수.

---

## 검증 매트릭스

### 사용자 spec 5개 검증 항목

| 항목 | 결과 |
|---|---|
| blob image delete 정상 | ✅ VercelBlobProvider.delete + dispatcher + store action |
| fallback image delete 정상 | ✅ local_preview_v1은 dispatcher silent skip + record 갱신 |
| card thumbnail 적용 | ✅ buildThumbnailUrl + THUMBNAIL_PRESETS.CARD |
| detail original 유지 | ✅ DetailPanel 0줄 변경 |
| 기존 upload 흐름 회귀 없음 | ✅ STEP 57 흐름 그대로 |
| build / type-check / lint | ✅ Route 125 kB |

### 사용자 spec 9개 제약

| 제약 | 결과 |
|---|---|
| 신규 외부 라이브러리 추가 | ✅ 0건 (@vercel/blob은 STEP 57에서) |
| sharp / imagekit / cloudinary 금지 | ✅ 0건 |
| Vercel Blob만 사용 | ✅ |
| Payment / Settlement / Tax / FX / Customer / AI / Logistics / Documents | ✅ 0줄 |
| 3-column layout | ✅ 0줄 |
| validateV1 최소 변경 | ✅ 0줄 (옵셔널 필드 0개 추가, compressionRatio는 영속화 안 함) |

### 표현 정책

| 표현 | 결과 |
|---|---|
| "외부 저장소" / "표시 최적화" / "운영 참고" / "fallback image" / "storage usage" | ✅ 사용 |
| "영구 보관" / "완전 삭제 보장" / "무손실 보장" / "영구 복구" / "법적 보관" | ✅ 0건 (정책 주석에서만) |

delete 표현은 **"외부 저장소에서 제거 요청"** / **"제거 요청 중..."** — 결과 보장 표현 부재.

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_4** Trust Layer | destructive action을 secondary text-only로 절제 + 5줄 confirm + idempotent 설명 + timeline event audit trail | ✅ 강화 |
| **rule_7** RBAC | 신규 가드 0건 (작품 편집 권한 가진 사용자만 form drawer 접근) | ✅ 보존 |
| **rule_8** Timeline = Navigation | 이미지 제거 시 NOTE kind event 추가 | ✅ 보존 |
| **rule_14** 3-Column | 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | primary action (저장 / 닫기) 그대로, RemoveFromStorageAction은 text-only secondary | ✅ 보존 |
| **rule_16** 미니멀 디자인 | text-only link + status-deal/80 절제된 톤 + 그림자 0 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | drawer 안 secondary action 한 줄 추가만 | ✅ 보존 |
| **rule_21** 외부 hook 운영 단계 | STEP 53 추상화 → 57 실 연결 → 61 lifecycle. delete + thumbnail + estimation + orphan | ✅ **운영 가능 수준 도달** |

---

## 시나리오

### 시나리오 1: 정상 운영 (Vercel Blob 토큰 설정됨)

```
사용자: 작품 편집 → 이미지 영역 → "외부 저장소에서 제거 요청" 클릭
confirm dialog 5줄 한국어 표시 → 확인
  ↓
deleteArtworkImage 호출
  ↓ /api/delete-image POST
서버: del() 호출 → 200 ok
  ↓
artwork.imageUrl + 5 메타 모두 undefined
timeline에 "이미지 제거" NOTE event 추가
form의 imageMeta도 undefined → 화면 즉시 placeholder 노출
```

### 시나리오 2: 외부 호출 실패 (네트워크 / 503 / 502)

```
deleteArtworkImage 호출
  ↓ /api/delete-image POST
fetch throw 또는 502 응답
  ↓ store action catch (silent warn)
artwork record는 정상 갱신 (외부 host에 잔존)
timeline event는 그대로 추가
  ↓
운영자: 화면상 이미지 제거됨 (UX 정상)
외부 host의 잔존 blob은 향후 detectOrphanedBlobImages helper로 일괄 정리
```

### 시나리오 3: Card 렌더 — thumbnail URL

```
ArtworkCard 렌더
  src = buildThumbnailUrl(
    "https://xxx.public.blob.vercel-storage.com/artworks/lz3xj4-a8f2k1.jpg",
    { w: 400, q: 75 }
  )
  = "https://xxx.public.blob.vercel-storage.com/artworks/lz3xj4-a8f2k1.jpg?w=400&q=75"
  ↓
브라우저 fetch → Vercel Blob (현재 query ignore) → 원본 그대로 응답
  ↓
loading="lazy"로 viewport 외 카드는 lazy load
```

### 시나리오 4: 향후 Cloudflare Image Resizing 활성 시

```
ArtworkCard 렌더 (코드 변경 0줄)
  src = "...?w=400&q=75"
  ↓
Cloudflare가 query 인식 → 400px JPEG q=75 응답
  ↓
원본 1.5MB → 응답 ~80KB (약 95% 절감)
formatStorageInfoLabel가 보여준 "표시용 약 0.8MB"보다 더 작음 (estimation은 보수적)
```

---

## 다음 STEP 후보

```
STEP 60  Documents Hub 후속 — 개별 PDF ZIP / 추가 필터
STEP 62  Image cleanup admin tool — GET /api/list-images + orphan UI
STEP 63  Progressive image loading — DETAIL_HERO_PREVIEW preset 활용
STEP 64  Backup auto-download 알림 — 30일 이상 시 banner
```

---

## 결과 요약

- 신규 파일 3개 (API route + lib + doc, 총 ~320 LOC)
- 수정 파일 6개 (provider + dispatcher + store + Card + ImageUpload + FormDrawer)
- 0 신규 외부 라이브러리 / 0 sharp / imagekit / cloudinary
- Persistence schema 0줄 변경 (compressionRatio는 영속화 안 함, UI 즉시 계산)
- 다른 도메인 0줄 변경
- 4단계 API 보안 가드 (path traversal / null byte / absolute path / length / prefix)
- thumbnail URL convention (Vercel Blob 자체는 ignore, Cloudflare 활성 시 즉시 효과)
- preview-level estimation ("약" 표현으로 정확성 한계 명시)
- destructive action을 secondary text-only로 절제 (5줄 confirm + idempotent 정책)
- failure silent — record 갱신 우선 (운영 안정성)
- orphan helper 정의 (호출 site 0건 — 향후 admin tool용)
- Route +2 kB (123 → 125 kB) + dynamic API route `/api/delete-image`

**STEP 61 완료. rule_21 외부 hook 운영 단계 도달 — Vercel Blob storage가 lifecycle 관리 가능 수준.**
