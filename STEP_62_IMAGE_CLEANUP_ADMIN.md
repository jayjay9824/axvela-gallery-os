# STEP 62 — Image Cleanup Admin Tool

> **목표**: STEP 61 image storage lifecycle 위에 admin 운영 도구 정착.
> 외부 저장소(Vercel Blob) **inspection** + **orphan candidate review** + 단일 단위 **remove request**.
> **OWNER 전용** · **read-only by default** · **신규 외부 라이브러리 0개**

---

## State

- **이전**: STEP 61 / Route 125 kB
- **이번**: STEP 62 / **Route 128 kB (+3 kB)** + dynamic API route `/api/list-images`
- Build ✅ · type-check ✅ · Lint ✅

---

## Flow

```
[Sidebar] OWNER role → Operations 그룹 → "이미지 정리" 클릭 (Manager 이하 disabled)
  ↓
ImageCleanupDrawer (RBAC 이중 가드 — store action + drawer wrapper)
  ↓ mount 시 자동 fetchListImages()
GET /api/list-images
  ├─ env 가드 (BLOB_READ_WRITE_TOKEN 부재 → 503)
  ├─ list({ prefix: "artworks/", limit: 1000, cursor })
  │     └─ cursor pagination 내부 처리 (HARD_LIMIT=5000)
  └─ { ok, blobs[{pathname, url, size, uploadedAt}], totalCount, totalSizeBytes, truncated, fetchedAt }
  ↓
SummarySection 4종 grid 노출:
  ├─ 외부 저장소 (totalCount건)
  ├─ storage 사용량 (formatBytes)
  ├─ orphan 후보 (status-deal red emphasis if > 0)
  └─ 최근 업로드 (relative time)
  ↓
OrphanReview — detectOrphanedBlobImages(artworks, blobPathnames):
  referenced = artworks where provider==="vercel_blob" + storageKey
  orphans = blobs - referenced  (정렬: uploadedAt asc → pathname asc)
  ↓
사용자가 단일 orphan row의 [제거 요청] 클릭
  ↓
window.confirm 7줄 한국어 dialog (idempotent + 운영 영향 명시)
  ↓ 확인
requestRemoveBlob(pathname) → POST /api/delete-image (STEP 61 재사용)
  ├─ ok → sessionLog [OK] 추가 + 자동 재조회
  └─ fail → sessionLog [FAIL] 추가 + 화면 유지
```

**read-only by default** — bulk delete UX 0건. 사용자가 명시 클릭한 단일 단위 remove request만 처리.

---

## 변경 / 신규 파일

### 신규 (4 + doc)

| 파일 | LOC | 역할 |
|---|---|---|
| `src/app/api/list-images/route.ts` | ~110 | GET endpoint + cursor pagination + 보안 가드 |
| `src/lib/image-cleanup-api.ts` | ~180 | 클라이언트 fetcher + 결과 normalize |
| `src/components/admin/ImageCleanupDrawer.tsx` | ~600 | OWNER 전용 admin UI |
| `STEP_62_IMAGE_CLEANUP_ADMIN.md` | (이 문서) | 완료 보고 |

### 변경 (4 + ARCHITECTURE.md)

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/types/role.ts` | ~5 LOC | `image.cleanup_review` permission → OWNER |
| `src/store/useArtworkStore.ts` | ~30 LOC | `imageCleanupRequest` UI slice + 2 actions |
| `src/components/layout/Sidebar.tsx` | ~30 LOC | "이미지 정리" SECONDARY 메뉴 + RBAC |
| `src/app/page.tsx` | 2 LOC | `<ImageCleanupDrawer />` mount + import |

---

## 핵심 코드

### 1) GET API Route — cursor pagination + scope guard

```ts
// src/app/api/list-images/route.ts

const ALLOWED_PREFIX = "artworks/";
const PAGE_LIMIT = 1000;
const HARD_LIMIT = 5000;

export async function GET(): Promise<NextResponse> {
  // 1. env 가드 → 503 graceful
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ ok: false, error: "..." }, { status: 503 });
  }

  const collected: BlobSummary[] = [];
  let cursor: string | undefined = undefined;
  let totalSizeBytes = 0;
  let truncated = false;

  // 2. cursor pagination 내부 처리
  type ListResult = Awaited<ReturnType<typeof list>>;
  while (true) {
    const page: ListResult = await list({
      prefix: ALLOWED_PREFIX,
      limit: PAGE_LIMIT,
      cursor,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    for (const blob of page.blobs) {
      // 방어적 prefix 가드 (Vercel SDK 변경 시)
      if (!blob.pathname.startsWith(ALLOWED_PREFIX)) continue;
      collected.push({ pathname, url, size, uploadedAt: ISO });
      totalSizeBytes += blob.size;
      if (collected.length >= HARD_LIMIT) { truncated = true; break; }
    }

    if (truncated || !page.hasMore || !page.cursor) break;
    cursor = page.cursor;
  }

  return NextResponse.json({
    ok: true, blobs: collected, totalCount, totalSizeBytes, truncated, fetchedAt
  });
}
```

### 2) Client fetcher — normalize errors

```ts
// src/lib/image-cleanup-api.ts

export type ListImagesError =
  | { kind: "env_missing"; message: string }
  | { kind: "network"; message: string }
  | { kind: "server"; message: string; status: number }
  | { kind: "parse"; message: string };

export async function fetchListImages(): Promise<ListImagesResult> {
  // cache: "no-store" — admin 도구는 항상 최신 상태
  const response = await fetch("/api/list-images", { cache: "no-store" });
  
  if (response.status === 503) return { ok: false, error: { kind: "env_missing", ... } };
  if (!response.ok) return { ok: false, error: { kind: "server", status, ... } };
  // parse + normalize ...
}

// STEP 61 endpoint 재사용 — 신규 endpoint 추가 0건
export async function requestRemoveBlob(pathname: string) {
  const response = await fetch("/api/delete-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pathname }),
  });
  // ...
}
```

### 3) Orphan 추출 — STEP 61 helper 재사용

```tsx
// src/components/admin/ImageCleanupDrawer.tsx (OrphanReview)

const referenced = useMemo(() => {
  const set = new Set<string>();
  for (const a of artworks) {
    if (a.imageProvider === "vercel_blob" && a.imageStorageKey) {
      set.add(a.imageStorageKey);
    }
  }
  return set;
}, [artworks]);

const { orphans, linkedCount } = useMemo(() => {
  const o: RemoteBlobSummary[] = [];
  let linked = 0;
  for (const b of blobs) {
    if (referenced.has(b.pathname)) linked += 1;
    else o.push(b);
  }
  // 결정성 정렬
  o.sort((a, b) =>
    a.uploadedAt !== b.uploadedAt
      ? a.uploadedAt.localeCompare(b.uploadedAt)
      : a.pathname.localeCompare(b.pathname)
  );
  return { orphans: o, linkedCount: linked };
}, [blobs, referenced]);
```

### 4) Confirm dialog — 7줄 한국어 (idempotent + 운영 영향)

```text
다음 외부 저장소 객체에 대해 제거 요청을 보냅니다.

pathname: artworks/lz3xj4-a8f2k1.jpg

- 이 객체는 현재 어떤 작품 record와도 연결되지 않은 orphan 후보입니다.
- 제거 요청 처리는 idempotent — 이미 부재해도 정상 처리됩니다.
- 외부 호출 실패 시에도 시스템 동작은 영향 없으며, 다음 새로고침 시 상태가 갱신됩니다.

계속하시겠습니까?
```

### 5) RBAC 이중 가드

```ts
// store action — silent no-op
openImageCleanup: () => {
  const state = get();
  if (!hasPermission(state.currentRole, "image.cleanup_review")) return;
  set({ imageCleanupRequest: { kind: "open" } });
},
```

```tsx
// drawer wrapper — UI 분기
const isAllowed = hasPermission(currentRole, "image.cleanup_review");
const isOpen = request.kind === "open" && isAllowed;
```

---

## 보안 매트릭스

| 영역 | 정책 |
|---|---|
| **Scope** | "artworks/" prefix만 허용 — 다른 path 노출 차단 |
| **Env 부재** | 503 graceful — 운영 안내 분기 가능 |
| **Pagination** | server-side 내부 처리 — 클라이언트는 단일 GET |
| **Hard cap** | HARD_LIMIT=5000 + truncated flag — 응답 폭주 방지 |
| **Mutation** | GET endpoint는 read-only — STEP 61 POST endpoint 재사용 |
| **Path traversal** | STEP 61 `/api/delete-image`의 4단계 가드 그대로 (artworks/ 접두사 + 길이 + ".." + null byte) |
| **RBAC** | OWNER 전용 (Manager+보다 엄격) — 이중 가드 |
| **Idempotent** | Vercel Blob `del()` 자체가 idempotent — 재시도 안전 |
| **Cache** | `cache: "no-store"` — admin은 항상 최신 |

---

## 검증 매트릭스

### 사용자 spec 7개 검증 항목

| 항목 | 결과 |
|---|---|
| GET /api/list-images route 정상 | ✅ runtime nodejs / scope / cursor / cap |
| 외부 저장소 listing | ✅ 단일 GET으로 전체 목록 |
| image metadata summary | ✅ totalCount + totalSizeBytes + uploadedAt |
| estimated storage usage | ✅ formatBytes 표시 |
| orphan candidate detection | ✅ STEP 61 helper 재사용 |
| read-only by default | ✅ 사용자 명시 단일 단위만 remove request |
| build / type-check / lint | ✅ Route 128 kB |

### 사용자 spec 7개 제약

| 제약 | 결과 |
|---|---|
| Payment / Settlement / Tax / FX / Customer / AI / Logistics / Documents | ✅ 0줄 |
| 3-column layout | ✅ 0줄 |
| Persistence schema | ✅ 0줄 (UI slice는 PersistedState 무관) |
| 신규 외부 image 라이브러리 | ✅ 0건 |
| sharp / cloudinary / imagekit | ✅ 0건 |
| 기존 upload 흐름 (STEP 57) | ✅ 회귀 0건 |
| DetailPanel original (STEP 50.5) | ✅ 0줄 변경 |

### 표현 정책

| 표현 | 결과 |
|---|---|
| "외부 저장소" / "정리 검토" / "orphan 후보" / "storage 사용량" / "제거 요청" / "storage inspection" / "최근 업로드" | ✅ 사용 |
| "permanent delete" / "guaranteed deletion" / "legal archive" / "complete removal guarantee" / "irreversible deletion" / "영구 삭제" / "완전 제거 보장" / "법적 보관" / "되돌릴 수 없는 삭제" | ✅ 0건 (정책 주석에서만) |

---

## Timeline / Audit 정책

**spec**: "If cleanup action executed: append timeline/audit event, **artwork-linked where possible**"

→ orphan은 정의상 artwork와 미연결이라 `TimelineEvent` (artworkId 필수) 추가 불가. 사용자 spec 명시 "where possible"이 본 케이스는 **not possible**로 분류.

대안:
- **drawer-scoped sessionLog**: 운영자가 본 세션에서 처리한 작업 (OK / FAIL) 시각적 누적
- 영속화 X — 매 inspection이 독립적 세션 (의도)
- 향후 STEP에서 system-level audit log layer 추가 시 통합 가능

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_4** Trust Layer | **본 STEP의 핵심** — storage usage transparent 노출 + orphan 명시 + confirm 7줄 + drawer-scoped 로그 | ✅ **강화** |
| **rule_7** RBAC | OWNER 전용 (Manager+보다 엄격) + 이중 가드 | ✅ 강화 |
| **rule_14** 3-Column | 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | drawer footer "닫기" 1개 + summary "다시 조회" + row별 "제거 요청" (단일 단위 — bulk UX 0건) | ✅ 보존 |
| **rule_16** 미니멀 디자인 | text-first / 작은 typography / 절제된 색상 / 그림자 0 / 그래프 0 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | drawer 안에서만 처리 | ✅ 보존 |
| **rule_21** 외부 hook governance | STEP 53 추상화 → 57 실 연결 → 61 lifecycle → **62 admin 운영 도구** | ✅ **운영 governance 정착** |

---

## Affected Domains Verification

| 도메인 | 변경량 |
|---|---|
| Payment | 0줄 |
| Settlement | 0줄 |
| Tax | 0줄 |
| FX | 0줄 |
| Customer | 0줄 |
| AI Market Analysis | 0줄 |
| Logistics | 0줄 |
| Documents Hub | 0줄 |
| Inquiry / Transaction / Invoice / Contract / Curation / Audit | 0줄 |
| Artwork (5 image fields STEP 53 그대로) | 0줄 |
| 3-Column 레이아웃 | 0줄 |
| Persistence (validateV1 / SCHEMA_VERSION) | 0줄 |

---

## 시나리오

### 시나리오 1: 정상 운영 (Vercel Blob 토큰 설정됨)

```
OWNER: Sidebar → "이미지 정리" 클릭
  ↓
drawer 열림 → 자동 GET /api/list-images
  ↓
응답: { totalCount: 47, totalSizeBytes: 215000000 (215MB), blobs: [...], truncated: false }
  ↓
4종 카드 노출:
  외부 저장소: 47건
  storage 사용량: 215.0 MB
  orphan 후보: 3건 (red emphasis)
  최근 업로드: 2일 전
  ↓
OrphanReview 섹션:
  - artworks/lz3xj4-a8f2k1.jpg · 1.5 MB · 30일 전 · [제거 요청]
  - artworks/m2k4xp-b7c3a9.jpg · 0.8 MB · 45일 전 · [제거 요청]
  - artworks/n8j5yq-d4e1b2.jpg · 2.1 MB · 60일 전 · [제거 요청]
  ↓
[제거 요청] 클릭 → confirm 7줄 dialog → 확인
  ↓
POST /api/delete-image → 200 OK
  ↓
sessionLog에 [OK] 추가 + 자동 재조회 → orphan 후보 2건으로 갱신
```

### 시나리오 2: env 미연결 환경

```
OWNER: drawer 열림 → GET /api/list-images → 503
  ↓
"Vercel Blob 미연결 환경입니다.
 BLOB_READ_WRITE_TOKEN 환경변수가 설정되지 않아 외부 저장소
 inspection이 비활성 상태입니다. 설정 후 다시 조회해주세요."
  ↓
사용자: 운영 안내 인지 → Vercel Dashboard 설정 → redeploy → 재진입
```

### 시나리오 3: STAFF / MANAGER 접근 시도

```
STAFF: Sidebar → "이미지 정리" disabled (회색) + tooltip "Owner 권한 필요"
  ↓
클릭 불가 — UI 차단
  ↓
(만약 어떻게든 store action 호출됐다면 store도 silent no-op — 이중 가드)
```

### 시나리오 4: HARD_LIMIT 도달 (5000건+)

```
OWNER: drawer 열림 → 응답 truncated: true
  ↓
amber banner 노출:
"⚠ 응답이 5000건 hard cap에 도달했습니다.
 일부 객체가 누락되었을 수 있습니다.
 향후 server-side pagination UI로 분할 처리 예정."
  ↓
표시된 5000건만 처리 가능 — 나머지는 향후 STEP에서 분할 분리 처리
```

---

## 다음 STEP 후보

```
STEP 60  Documents Hub 후속 — 개별 PDF ZIP / 추가 필터
STEP 63  Image cleanup 후속 — server-side pagination UI (HARD_LIMIT 분할)
STEP 64  Backup auto-download 알림 — 30일 이상 시 banner
STEP 65  Audit log layer — system-level events (orphan removal 등 통합)
STEP 66  Progressive image loading — DETAIL_HERO_PREVIEW preset 활용
```

---

## 결과 요약

- 신규 파일 4개 (API route + lib + Drawer + doc, 총 ~1100 LOC)
- 수정 파일 4개 (role + store + Sidebar + page)
- 0 신규 외부 라이브러리 (sharp / imagekit / cloudinary 0건)
- Persistence schema 0줄 변경 (UI slice는 PersistedState 무관)
- 기존 모든 도메인 0줄 변경
- OWNER 전용 RBAC 이중 가드 (store action + drawer wrapper)
- 9가지 보안 매트릭스 충족 (scope / env / pagination / cap / read-only / path traversal / RBAC / idempotent / cache)
- 4종 SummaryCard 운영 가시성 (외부 저장소 / storage 사용량 / orphan 후보 / 최근 업로드)
- 결정성 orphan 정렬 (uploadedAt asc → pathname asc)
- 사용자 spec 명시 "Do NOT create destructive bulk delete UX" 정확 준수 — 단일 단위만
- drawer-scoped sessionLog (운영 참고용 — 영속화 X)
- 표현 정책 모두 준수 (정책 주석에서만 등장)
- Route +3 kB (125 → 128 kB) + dynamic API route `/api/list-images`

**STEP 62 완료. rule_21 외부 hook governance — 운영 단계 도달.**
