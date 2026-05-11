# STEP 116 — Image-First Registration Hero — COMPLETE ✅

**완료 시점**: 2026-05-08
**Phase**: 4 — Artwork-Centric Workflow Foundation (5/10)
**Stage**: 2 — UI Restructure (entry point)
**Risk profile**: 🟡 mid → 🟢 (검증 후) — 신규 UI component + ArtworkFormDrawer hierarchy 재배치, logic 0줄

---

## 1. STEP 116 의 정체

### 1.1 본 STEP 의 목표

사용자 spec STEP 116 (#1 IMAGE-FIRST REGISTRATION + #2 ARTWORK REGISTRATION UI RESTRUCTURE) 정확 매칭. ArtworkFormDrawer 의 image-first hierarchy 정착.

핵심 인용:
> *"텍스트 form 보다 이미지가 먼저 보이도록 hierarchy 재구성"*
> *"Image Upload → Artwork Preview → Artwork Understanding → Operational Workflow"*

### 1.2 본 STEP 이 *아닌* 것

- ❌ 신규 upload 엔진 (기존 `ArtworkImageUpload` 380 LOC 변경 0줄 — visual wrapper 만)
- ❌ Multiple-image storage 합류 (v1 단일 image 보존, future expansion path 명시)
- ❌ Persistence schema 변경 (`SCHEMA_VERSION` "v1", validateV1 0줄 변경)
- ❌ Form submit logic / state 흐름 변경 (JSX hierarchy 재배치만)
- ❌ AI integration (Phase 4 §4.8 — Claude API 신규 연결 금지)

---

## 2. Architecture 결정

### 2.1 Hero = ArtworkImageUpload 의 Visual Wrapper

기존 `ArtworkImageUpload` 380 LOC 가 이미 drag/drop + click upload + preview + provider info 모두 핸들. 신규 Hero 는 *visual wrapper* 만:

```
ArtworkUploadHero (신규)
  ├── Empty state  — 큰 dropzone + "이미지 업로드" 안내 + ColorSwatchPicker fallback
  └── Filled state — "작품 이미지" 라벨 + ArtworkImageUpload preview + ColorSwatchPicker (이미지 제거 시 fallback)
```

→ 신규 upload logic 0줄 / ArtworkImageUpload 변경 0줄. 안전한 wrapper 패턴.

### 2.2 Multiple Image — 정직한 v1 진입

사용자 spec "Multiple Image Upload" 언급되나 v1 schema 단일 (`Artwork.imageUrl?: string`). 가짜 multiple slot 표시 ❌.

→ 단일 hero 정직 진입. Future expansion path: `Artwork.additionalImageUrls?: string[]` optional 추가 — 미래 STEP. Hero docstring 에 명시.

### 2.3 새 hierarchy

| 위치 | Before | After |
|------|--------|-------|
| 1 | (편집 모드) AXID badge | (편집 모드) AXID badge |
| 2 | 기본 정보 | **🎨 ArtworkUploadHero ⭐** |
| 3 | 작품 정보 | (편집 모드) RemoveFromStorageAction |
| 4 | 거래 | 기본 정보 |
| 5 | **썸네일 (가장 마지막)** | 작품 정보 |
| 6 | — | 거래 |

→ "썸네일" FormSection 제거 (Hero 가 흡수). AXID badge 위치 그대로 (식별자 → 이미지 → 정보의 자연 흐름).

---

## 3. Implementation Inventory

### 3.1 신규 파일 (1)

#### `src/components/artwork/ArtworkUploadHero.tsx` (~165 LOC)

| Section | 역할 |
|---------|------|
| Props interface | ArtworkImageUpload props forward + ColorSwatchPicker integration |
| Empty state | 큰 hero dropzone + "이미지 업로드" / "끌어오기 또는 클릭" 안내 + Phase 4 STEP 113 terminology ("담당자 검토") + ColorSwatchPicker fallback |
| Filled state | "작품 이미지" label + ArtworkImageUpload (변경/제거 자체 처리) + ColorSwatchPicker (이미지 제거 fallback) |
| Visual differentiation | hasImage 분기 — `bg-surface` (empty) vs `bg-surface-muted/30` (filled) |
| Tone | rule_16 minimal, 그림자 0, Pretendard, KR/EN bilingual hint |

### 3.2 수정 파일 (1)

#### `src/components/artwork/ArtworkFormDrawer.tsx` (-40/+40 줄, logic 0줄)

| 변경 | 위치 |
|------|------|
| Import | `ColorSwatchPicker` / `ArtworkImageUpload` 제거 (Hero 안으로 이전), `ArtworkUploadHero` 추가 |
| AXID 다음 | `<ArtworkUploadHero ...>` mount + `RemoveFromStorageAction` (편집 + vercel_blob 조건) |
| Body 끝 | 기존 "썸네일" FormSection 전체 제거 |

state / submit 흐름 / RBAC / form validation 모두 변경 0줄. JSX hierarchy 재배치만.

### 3.3 절대 변경 안된 영역 (검증됨)

- ❌ `src/components/artwork/ArtworkImageUpload.tsx` (380 LOC 무손상)
- ❌ `src/components/artwork/ColorSwatchPicker.tsx` (무손상)
- ❌ `src/types/artwork.ts` (Artwork schema 무손상, STEP 114/119 fields 그대로)
- ❌ `src/lib/persistence.ts` (validateV1 / SCHEMA_VERSION 무손상)
- ❌ `src/store/useArtworkStore.ts` (form submit 흐름 무손상)
- ❌ Phase 1 Fiscal frozen 6/6
- ❌ AI infra (STEP 93~96)
- ❌ STEP 113/114/115/119 산출물

---

## 4. Validation Results

| 항목 | 결과 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next lint` | ✅ 0 warnings, 0 errors |
| `npx next build` | ✅ build success |
| Route size | **188 kB** (STEP 119 → +1 kB, 신규 UI component 정확한 비용) |
| First Load JS | **275 kB** (변동 0 kB — Hero 가 lazy-load 영역 효율 입증) |
| DOC-2 §4.1 ≤10 kB target | ✅ 통과 |
| Scenarios | ✅ **67/67 PASS** (회귀 0건 — UI 위주 변경, scenario 추가 0건이 자연) |

---

## 5. Phase 4 §4 Implementation Constraints 정합 검증

| §4 원칙 | 검증 |
|---------|------|
| §4.1 Additive only | ✅ 신규 component, 기존 component 변경 0줄 |
| §4.2 Optional slot priority | ✅ Artwork schema 변경 0줄 |
| §4.3 No persistence migration | ✅ validateV1 / SCHEMA_VERSION 무영향 |
| §4.4 Draft-safe | ✅ form state 흐름 무영향 |
| §4.5 Backward compat | ✅ 기존 imageUrl 단일 image flow 보존 |
| §4.6 Build green | ✅ tsc / lint / build / 67 scenarios 모두 통과 |
| §4.7 Worktree 금지 | ✅ 현재 project 만 |
| §4.8 AI not priority | ✅ AI 영역 0줄 변경 |

---

## 6. Stage 1 vs Stage 2 차이 정착

| 측면 | Stage 1 (113~119) | Stage 2 (116~) |
|------|-------------------|----------------|
| 영역 | type-only foundation | UI restructure |
| Route delta | +0 kB × 4회 | +1 kB (Hero) |
| 신규 scenarios | +19 (48→67) | +0 (UI 위주) |
| Risk | 🟢 매우 낮음 | 🟡 mid (검증 후 🟢) |
| 산출물 | type modules + helpers | UI components + JSX 재배치 |

→ Stage 2 진입은 *type-only 흐름 종료, UI 작업 진입*. 본 STEP 116 가 Stage 2 의 entry point.

---

## 7. 다음 STEP

### 권장 자연 진입: **STEP 118 — Registration Tabs Structure**

Stage 2 다음 STEP (116 ✅ → **118** → 117).

- spec: ArtworkFormDrawer 9-tab 재구성 (Images / Basic Info / Description / Curation / Inquiry / Documents / Condition / Contract+Invoice / Verification)
- Risk: 🟡 mid — 큰 UI 재구성, 단 기존 fields 재배치만 (logic 0줄)
- ~200 LOC 예상
- Tab 1 "Images" 는 본 STEP 의 Hero 자연 합류
- Tab 3 "Description" / Tab 4 "Curation" 은 STEP 119 의 5 inline fields 자연 합류
- Phase 4 6/10 진입

### 🅑 대안 — STEP 117 (Draft / Resume System)

Stage 2 의 가장 큰 작업. ~250 LOC. STEP 118 정착 후 진입 권장.

---

## 8. 본 STEP 의 영구 가치

1. **Image-first registration hierarchy 정착** — 사용자 spec 의 "Image Upload → Artwork Preview → Artwork Understanding" 흐름 영구 reference. 미래 다른 entity 등록 form 에도 동일 패턴 답습 가능.
2. **Visual wrapper 패턴 매뉴얼화** — 기존 component (ArtworkImageUpload 380 LOC) 변경 0줄로 hierarchy 재구성 달성. 안전한 UI restructure 패턴 영구 매뉴얼.
3. **Stage 2 entry point** — type-only foundation 흐름 종료, UI 작업 진입. Stage 1 vs Stage 2 의 risk profile / Route delta 패턴 차이 입증 (0 kB → +1 kB).
4. **정직한 v1 진입 패턴** — "Multiple Image Upload" 사용자 spec 언급에도 v1 schema 한계 정직 인정, 가짜 multiple slot 회피, future expansion path 만 docstring 에 명시. 사용자 trust 보존.
5. **Backward compat 5회 연속 입증** — STEP 113/114/115/119/116 모두 기존 코드 변경 최소 (text + JSX 재배치).
