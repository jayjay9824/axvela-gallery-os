# STEP 80 — ImageCleanup Orphan Inline Remove Action — Completion Report

## State

**STEP 76 baseline (141 kB) → STEP 80 complete (142 kB).**
Build / type-check / lint all green.
ZIP package: `axvela-step80-orphan-inline-remove.zip`.

---

## Flow

```
OrphanRow [제거 요청] click
     ↓
RemoveRequestConfirmModal (Modal primitive)
  └ mandated safe wording
  └ pathname / size / uploadedAt 명시
  └ [취소] / [제거 요청 보내기]
     ↓
executeRemove(blob)
     ↓
POST /api/delete-image  { pathname, provider: "vercel_blob" }
     ↓
appendAuditEvent (System Audit Layer — STEP 65)
  ├ success: action="orphan_remove_request_success", severity=info
  └ failure: action="orphan_remove_request_failed",  severity=error
     ↓
sessionLog (drawer-scoped 운영 참고)
     ↓
fetchListImages 자동 재조회 (성공 시만)
     ↓
SummarySection — orphanCount / orphanBlobPathnames 자연 갱신
```

---

## UI Location

| Layer | Component | Note |
|---|---|---|
| Sidebar | `이미지 정리` 메뉴 (Owner 전용) | STEP 62 그대로 |
| Drawer | `ImageCleanupDrawer` (w-[760px]) | STEP 62 외피 그대로 |
| Drawer body | `OrphanRow` 인라인 `[제거 요청]` 버튼 | STEP 80 — busy 시 disabled + opacity-60 |
| **Modal (rule_17 layer UI)** | `RemoveRequestConfirmModal` (max-w-[440px]) | **STEP 80 신규** |
| Drawer body | `SessionLogSection` (drawer-scoped) | STEP 62 그대로 |

3-Column 레이아웃 0줄 변경 — Modal은 Drawer의 descendant로 painter's algorithm + DOM 후순위 마운트로 자연스럽게 위에 paint.

---

## New / Changed Files

### Modified (3)
1. **`src/components/admin/ImageCleanupDrawer.tsx`** (~150 LOC 변경)
   - `Modal` import 추가
   - `handleRemoveOrphan` → `handleRequestRemove(blob)` (Modal open) + `executeRemove(blob)` (실 흐름) 분리
   - `confirmRequest` state slice 신설 (`{kind:"idle"} | {kind:"open", blob}`)
   - `RemoveRequestConfirmModal` sub-component 신설 (Modal primitive 기반)
   - audit action 명시화: `orphan.remove` → `orphan_remove_request_success` / `orphan_remove_request_failed`
   - 실패 metadata: `errorStatus: number?` → `error: string` (안전 message)
   - 헤더 주석 STEP 80 정책 반영

2. **`src/lib/image-cleanup-api.ts`** (~25 LOC 변경)
   - `requestRemoveBlob` POST body에 `provider: "vercel_blob"` 추가
   - `REMOVE_IMAGE_PROVIDER` const 분리

3. **`src/types/audit-event.ts`** (5 LOC 변경)
   - JSDoc action 예시를 STEP 80 명명 convention으로 갱신
   - 타입 필드는 0줄 변경 (action은 free string)

### Added (2)
4. **`STEP_80_ORPHAN_INLINE_REMOVE_COMPLETE.md`** — 본 문서
5. **`ARCHITECTURE.md`** — STEP 80 entry append (~10 KB)

### Untouched
- `/api/delete-image` route (STEP 61) — **0줄 변경**
- `/api/list-images` route (STEP 62) — 0줄 변경
- `/api/upload-image` route (STEP 57) — 0줄 변경
- Image storage provider 추상화 (STEP 53/57) — 0줄 변경
- Persistence schema / `validateV1` / `SCHEMA_VERSION` — 0줄 변경

---

## Route Size Delta

```
Before STEP 80:  / 141 kB / 228 kB First Load JS
After  STEP 80:  / 142 kB / 229 kB First Load JS
                 +1 kB (Modal-based confirm dialog JSX)
```

Build pipeline:
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (7/7)
✓ No ESLint warnings or errors
```

---

## Inline Action Behavior

| Condition | OrphanRow `[제거 요청]` 버튼 |
|---|---|
| 정상 orphan candidate | enabled — `bg-surface text-status-deal/80 border-line` (절제 톤) |
| 진행 중 (busyPaths.has) | **disabled** — opacity-60 + cursor-not-allowed + text "처리 중..." |
| 비-orphan (linked blob) | **렌더 자체 안 됨** — `OrphanReview`가 referenced set으로 사전 필터 |
| Bulk action | **부재** — 단일 row 단위만 (사용자 spec "no bulk destructive action" 준수) |

중복 클릭 방어:
- `handleRequestRemove`: `busyPaths.has(pathname)` 즉시 return
- `executeRemove`: 동일 가드 재적용 (방어적 이중 가드)

---

## Confirmation Text

**Modal title**: `제거 요청 확인`

**본문 (mandated safe wording — 사용자 spec 정확 매칭)**:
> 외부 저장소에서 제거 요청을 보냅니다. 이 작업은 현재 작품 레코드와 연결되지 않은 orphan 후보에 대해서만 수행됩니다.

**대상 식별 영역**:
- `대상 — orphan 후보` (uppercase 라벨)
- `pathname` (mono)
- `{formatBytes(size)} · 업로드 {formatHumanDate(uploadedAt)}`

**운영 참고 ul 3개** (결과 보장 표현 부재):
- 요청 처리는 idempotent — 이미 부재한 객체에도 안전합니다.
- 요청 결과는 운영 로그에 기록되며 다음 새로고침 시 목록에 반영됩니다.
- 외부 저장소 응답 실패 시에도 시스템 동작에는 영향이 없습니다.

**Footnote**: `운영 참고용 — Owner 권한으로 실행됩니다.`

**Footer**: `[취소]` (variant ghost) + `[제거 요청 보내기]` (variant primary).

**Forbidden language 0건 검증**:
```
$ grep -nE "영구 삭제|완전 삭제|되돌릴 수 없는|permanent delete|guaranteed deletion|irreversible|legal archive|tamper-proof" \
    src/components/admin/ImageCleanupDrawer.tsx src/lib/image-cleanup-api.ts
→ 정책 주석 (// - 금지: ...) 내부에서만 등장
→ UI / message / metadata 노출 0건
```

---

## API Reuse Verification

```typescript
// src/lib/image-cleanup-api.ts — STEP 80
const REMOVE_IMAGE_PROVIDER = "vercel_blob" as const;

await fetch("/api/delete-image", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    pathname,
    provider: REMOVE_IMAGE_PROVIDER,
  }),
});
```

- ✅ `POST /api/delete-image` — STEP 61 endpoint 그대로
- ✅ payload `{ pathname, provider: "vercel_blob" }` — 사용자 spec 3번 정확 매칭
- ✅ 신규 endpoint 추가 0건
- ✅ 서버 route 변경 0줄 — 서버는 현재 `pathname`만 소비, 추가 필드는 무시 → backward-compat 보장
- ✅ STEP 61의 `RemoveImageResult` (ok / error union) 응답 분기 그대로 — idempotent, 503/4xx/5xx normalize

---

## Audit Event Behavior

### Success
```typescript
{
  category: "image_storage",
  action: "orphan_remove_request_success",
  severity: "info",
  targetType: "blob",
  targetRef: pathname,
  message: `orphan candidate 제거 요청 완료 — ${pathname}`,
  metadata: {
    pathname,
    size: blob.size,
    uploadedAt: blob.uploadedAt,
    provider: "vercel_blob",
  },
}
```

### Failure
```typescript
{
  category: "image_storage",
  action: "orphan_remove_request_failed",
  severity: "error",
  targetType: "blob",
  targetRef: pathname,
  message: `orphan candidate 제거 요청 실패 — ${result.error.message}`,
  metadata: {
    pathname,
    error: result.error.message,
    provider: "vercel_blob",
  },
}
```

**Migration from STEP 62**:
| | STEP 62 | STEP 80 |
|---|---|---|
| action | `"orphan.remove"` (단일) | `"orphan_remove_request_success"` / `"orphan_remove_request_failed"` |
| severity | `result.ok ? "info" : "error"` | 동일 — 단 action 자체에서 의미 판독 가능 |
| 실패 metadata | `errorStatus: number?` | `error: string` (안전 message) |
| 성공 metadata | `{pathname, size, uploadedAt, provider}` | **동일** |

`AuditLogViewerDrawer` (STEP 65)는 `action`을 verbatim mono 표시 — 신규 string도 자연 호환, 렌더 흐름 0줄 변경.

---

## Refresh Behavior

```typescript
// 성공 시에만 자동 재조회
if (result.ok) {
  await runFetch();
}
```

- ✅ `fetchListImages()` 재호출 → server `/api/list-images` 재조회 (cache: "no-store")
- ✅ `loadState` 갱신 → `OrphanReview`의 `referenced` set + orphan 추출 재계산
- ✅ `SummarySection`의 `orphanCount` / `orphanBlobPathnames` useMemo 자연 갱신
- ✅ 외부 저장소 카드 / storage 사용량 카드 / orphan 후보 카드 모두 즉시 반영
- ✅ 실패 시 미재조회 — orphan은 아직 외부 저장소에 잔존, 다음 수동 재조회 시 정확 표시

---

## Regression Verification

| 영역 | 검증 결과 |
|---|---|
| STEP 62 `SummarySection` (4 cards) | ✅ 0줄 변경 |
| STEP 62 `OrphanReview` (referenced set 추출) | ✅ 0줄 변경 |
| STEP 62 `OrphanRow` (button + size + relative time) | ✅ 0줄 변경 (button text "제거 요청" 그대로) |
| STEP 62 `SessionLogSection` (drawer-scoped) | ✅ 0줄 변경 |
| STEP 62 `busyPaths` 중복 클릭 방어 | ✅ 보존 + Modal open 단계에도 가드 추가 |
| STEP 62 RBAC (`image.cleanup_review` Owner-only) | ✅ 0줄 변경 |
| STEP 65 `SystemAuditEvent` type | ✅ 0줄 변경 (action은 free string) |
| STEP 65 `appendAuditEvent` action signature | ✅ 0줄 변경 |
| STEP 65 `AuditLogViewerDrawer` 렌더 | ✅ 0줄 변경 (action verbatim mono 표시) |
| STEP 67 storage drilldown 3종 | ✅ 0줄 변경 (`storage_external` / `storage_with_image` / `storage_orphan`) |
| STEP 61 `/api/delete-image` route | ✅ 0줄 변경 |
| STEP 62 `/api/list-images` route | ✅ 0줄 변경 |
| STEP 57 `/api/upload-image` route | ✅ 0줄 변경 |
| STEP 53/57 image storage provider 추상화 | ✅ 0줄 변경 |
| Persistence schema (`validateV1` / `SCHEMA_VERSION`) | ✅ 0줄 변경 |
| Drawer / Modal primitive | ✅ 재사용 only — 0줄 변경 |

---

## Affected Domains Verification

| 도메인 | 변경 |
|---|---|
| Reporting | **0줄** |
| Logistics | **0줄** |
| Documents Hub | **0줄** |
| Customer | **0줄** |
| Payment | **0줄** |
| Settlement | **0줄** |
| Tax | **0줄** |
| FX | **0줄** |
| AI Market Analysis | **0줄** |
| Backup-Restore | **0줄** |
| Inquiry | **0줄** |
| Transaction | **0줄** |
| Invoice | **0줄** |
| Contract | **0줄** |
| Curation | **0줄** |
| Drilldown 시스템 | **0줄** |
| Sidebar | **0줄** |
| 작품 TimelineEvent | **0줄** |
| artwork-scoped AuditLogDrawer | **0줄** |
| DetailPanel | **0줄** |
| 3-Column 레이아웃 | **0줄** |
| `package.json` | **0줄** |

---

## Validation

```
✓ npx tsc --noEmit              — 0 errors
✓ npx next lint                  — No ESLint warnings or errors
✓ npx next build                 — Route 142 kB / First Load 229 kB
```

---

## Manifesto Alignment

| Rule | 적용 |
|---|---|
| **rule_4 Trust Layer 정밀화** | governance 표현 + audit naming 명시화 — 결과 보장 표현 0건 |
| **rule_5 AI-Human Loop** | AI 자동 0건 / 명시 클릭 + 명시 confirm + Owner-only 실행 |
| **rule_7 RBAC** | `image.cleanup_review` Owner 전용 (이중 가드 — store action + drawer wrapper) |
| **rule_14 Layout** | 3-Column 0줄 변경 |
| **rule_15 Max 3 buttons** | Modal footer 2 (취소 / 제거 요청 보내기) + Drawer footer 1 (닫기) |
| **rule_16 미니멀 디자인** | text-first / 작은 typography (text-[9.5px] / [10px] / [11.5px] / [12.5px]) / 그림자 최소 / 그래프 0 |
| **rule_17 Layer UI** | Drawer 위 Modal layer — 레이아웃 변경 없이 layer 추가 |
