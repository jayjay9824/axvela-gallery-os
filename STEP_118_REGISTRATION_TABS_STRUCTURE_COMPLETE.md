# STEP 118 — Registration Tabs Structure — COMPLETE ✅

**완료 시점**: 2026-05-08
**Phase**: 4 — Artwork-Centric Workflow Foundation (6/10)
**Stage**: 2 — UI Restructure (2/3)
**Risk profile**: 🟡 mid → 🟢 (검증 후) — 신규 UI primitive + 큰 JSX 재배치 + STEP 119 functional 진입

---

## 1. STEP 118 의 정체

### 1.1 본 STEP 의 목표

ArtworkFormDrawer 의 *4-tab structure* 정착 + STEP 119 의 5 curation fields *functional 입력 surface* 진입.

### 1.2 9-tab over-scope 거부 — 정직한 4-tab

이전 STEP 116 보고에서 9-tab 제안 (Images / Basic / Description / Curation / Inquiry / Documents / Condition / Contract+Invoice / Verification) 이었으나 검토 결과 **over-scope**:

- ❌ Inquiry / Documents / Condition / Contract+Invoice / Verification 은 *외부 entity* — ArtworkFormDrawer scope (작품 *create/edit*) 외
- ❌ 이 entity 들은 별도 흐름 / drawer 에서 관리 (단일 form 통합 시 architectural confusion)

→ **정직한 4-tab 채택**: Artwork *own data* 만 담당.

| # | Tab | 합류 |
|---|-----|------|
| 1 | **이미지** | STEP 116 Hero |
| 2 | **작품 정보** | 기존 "기본 정보" + "작품 정보" 통합 |
| 3 | **큐레이션** | **STEP 119 5 inline fields functional 진입** ⭐ |
| 4 | **거래** | 기존 "거래" |

### 1.3 본 STEP 이 *아닌* 것

- ❌ 9-tab over-scope (외부 entity tab 미진입)
- ❌ STEP 115 contactInfo 합류 (Inquiry entity scope, ArtworkFormDrawer 외)
- ❌ Persistence schema 변경 (`SCHEMA_VERSION` "v1" 그대로)
- ❌ AI integration (Phase 4 §4.8)
- ❌ Validation engine (5 curation fields free-form, future STEP)

---

## 2. Architecture 결정 핵심

### 2.1 Generic TabBar primitive

| 결정 | 채택 |
|------|------|
| Tab navigation | 신규 `src/components/ui/TabBar.tsx` 신규 — generic primitive (4-tab 강제 아닌 N-tab 자유) |
| Active state | `border-b-2 border-ink` (rule_16 minimal, 그림자 0) |
| Tab definition | `TabDefinition<TKey>` — key + label + optional badge / disabled |
| Aria | role="tablist" / role="tab" / aria-selected — 접근성 정착 |

→ TabBar 는 future STEP 에서도 재사용 가능 (예: DetailPanel 의 sub-section tab).

### 2.2 STEP 119 Functional 진입

STEP 119 에서 type-only foundation (5 optional fields on Artwork) 정착, 본 STEP 에서 *처음으로* 입력 surface 진입:

```
STEP 119 (type-only)        STEP 118 (functional surface)
─────────────────────       ───────────────────────────────
Artwork.description?        ArtworkInput.description?  ⭐
Artwork.curationDraft?  +   ArtworkInput.curationDraft?  ⭐
Artwork.exhibitionText?     ArtworkInput.exhibitionText?  ⭐
Artwork.artistNote?         ArtworkInput.artistNote?  ⭐
Artwork.provenanceNote?     ArtworkInput.provenanceNote?  ⭐
                            +
                            createArtwork / updateArtwork
                            pass-through  ⭐
                            +
                            Tab 3 textarea inputs  ⭐
```

`description.trim() || undefined` 패턴 — STEP 119 의 collectCurationData helper 정책과 정확 매칭 (whitespace-only → undefined).

### 2.3 Backward compat 100%

ArtworkInput 의 5 신규 fields 모두 *optional*. STEP 118 이전 호출자 (5 fields 부재) 는:
- Type 시스템 자연 호환 (compile-time guarantee)
- Runtime undefined fallback
- createArtwork / updateArtwork 의 5 신규 pass-through 도 undefined → optional fields 모두 미진입

검증: scenarios §1, §5.

---

## 3. Implementation Inventory

### 3.1 신규 파일 (2)

#### `src/components/ui/TabBar.tsx` (~85 LOC)

Generic tab navigation primitive. 그림자 0, bottom-line active marker, aria-selected, focus ring (rule_16 minimal).

#### `src/lib/__tests__/artwork-input-curation-fields.scenarios.ts` (~245 LOC)

5 scenarios:
1. 5 fields all optional — legacy ArtworkInput 자연 호환
2. 5 fields accept string — partial / full
3. STEP 119 collectCurationData 호환 (Artwork hydration 후 추출)
4. STEP 119 hasAnyCurationData 호환 (empty/partial/full/whitespace edge)
5. Backward compat — STEP 118 이전 호출자 무손상

### 3.2 수정 파일 (2)

#### `src/store/useArtworkStore.ts` (+~25 LOC)

```typescript
export interface ArtworkInput {
  // ... 기존 16 fields ...
  // STEP 118 합류 — STEP 119 5 fields functional surface
  description?: string;
  curationDraft?: string;
  exhibitionText?: string;
  artistNote?: string;
  provenanceNote?: string;
}
```

`createArtwork` / `updateArtwork` actions 에서 5 fields pass-through 추가.

#### `src/components/artwork/ArtworkFormDrawer.tsx` (+~150 LOC, logic 0줄 outside curation tab)

| 변경 | 내용 |
|------|------|
| Imports | TabBar 추가 |
| Constants | `TabKey` type + `TAB_DEFINITIONS` (4 items) |
| State hooks | activeTab + 5 curation field state hooks (description / curationDraft / exhibitionText / artistNote / provenanceNote) |
| Submit body | 5 fields trim → undefined pass-through |
| JSX body | TabBar mount + 4 conditional tab panels (image / artwork / curation / pricing) |
| Curation tab | 5 CurationTextField components (textarea 기반) |
| 기존 4 FormSection logic | **0줄 변경** — JSX wrap 위치만 변경 (Tab Panel 안으로 이동) |
| `CurationTextField` helper | 신규 inline component (~40 LOC, textarea + label + hint) |

### 3.3 절대 변경 안된 영역 (검증됨)

- ❌ `src/types/artwork.ts` — Artwork schema 무손상 (STEP 119 fields 그대로)
- ❌ `src/types/artwork-curation-data.ts` — STEP 119 산출물 0줄 변경
- ❌ `src/components/artwork/ArtworkUploadHero.tsx` — STEP 116 산출물 0줄 변경
- ❌ `src/components/artwork/ArtworkImageUpload.tsx` — 380 LOC 무손상
- ❌ `src/lib/persistence.ts` — `validateV1` / `SCHEMA_VERSION` 0줄 변경
- ❌ Phase 1 Fiscal frozen 6/6 — 0줄 변경
- ❌ AI infra (STEP 93~96) — 0줄 변경
- ❌ STEP 113/114/115 산출물 — 0줄 변경

---

## 4. Validation Results

| 항목 | 결과 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next lint` | ✅ 0 warnings, 0 errors |
| `npx next build` | ✅ build success |
| Route size | **189 kB** (STEP 116 → +1 kB, TabBar + curation textarea + state) |
| First Load JS | **276 kB** (STEP 116 → +1 kB) |
| DOC-2 §4.1 ≤10 kB | ✅ 통과 |

| Scenario Suite | Result |
|----------------|--------|
| ai-protocol | ✅ 17/17 |
| fiscal-derive | ✅ 10/10 |
| operational-insight | ✅ 12/12 |
| anthropic-provider | ✅ 9/9 |
| artwork-registration-status | ✅ 7/7 |
| contact | ✅ 6/6 |
| artwork-curation-data | ✅ 6/6 |
| **artwork-input-curation-fields** ⭐ | **✅ 5/5 (신규)** |
| **Total** | **✅ 72/72 PASS** (회귀 0건, +5 신규) |

---

## 5. Phase 4 §4 Implementation Constraints 정합 검증

| §4 원칙 | 검증 |
|---------|------|
| §4.1 Additive only | ✅ 5 fields ArtworkInput 확장 (optional), 신규 component, 기존 logic 0줄 |
| §4.2 Optional slot priority | ✅ 5 fields 모두 optional |
| §4.3 No persistence migration | ✅ Artwork schema 무손상, SCHEMA_VERSION "v1" |
| §4.4 Draft-safe | ✅ form state 추가만, 기존 흐름 무영향 |
| §4.5 Backward compat | ✅ STEP 118 이전 ArtworkInput 호출자 무손상 (scenarios §5 verified) |
| §4.6 Build green | ✅ tsc / lint / build / 72 scenarios 모두 통과 |
| §4.7 Worktree 금지 | ✅ |
| §4.8 AI not priority | ✅ AI 영역 0줄 |

---

## 6. Stage 2 진행 (2/3)

| Stage 2 STEP | Status | 1-line |
|-------------|--------|--------|
| STEP 116 | ✅ | Image-First Hero (Stage 2 entry) |
| **STEP 118** | **✅** | **Registration Tabs Structure (4-tab + STEP 119 functional)** |
| STEP 117 | 🟡 | Draft / Resume System (Stage 2 마지막) |

**Stage 2 누적 효과 (2/3)**:
- Route delta: +1 kB (116) + 1 kB (118) = **+2 kB**
- 신규 scenarios: +5 (118) — 67 → 72
- 신규 UI components: 2 (Hero + TabBar)
- 신규 functional surface: STEP 119 5 fields 입력 진입

---

## 7. 다음 STEP

### 권장 자연 진입: **STEP 117 — Draft / Resume System**

Phase 4 Stage 2 마지막 (116 ✅ → 118 ✅ → **117**).

- spec: `artworkDraft` persistence slice + Sidebar "임시 저장" entry + `lastEditedAt` timestamp + Resume CTA. Drawer 닫혀도 workflow 보존.
- Risk: 🟡 mid — persistence slice 추가 + Sidebar 변경
- ~250 LOC 예상
- Phase 4 7/10 진입

### 🅑 대안 — Stage 3 진입 (STEP 120 → 121 → 122)

Stage 2 의 STEP 117 는 *큰 작업* (persistence slice 추가). 사용자 우선순위에 따라 Stage 3 부터 진행 가능 — 단 STEP 121 (Invoice PRE/FINAL) 는 ⚠️ Phase 1 Fiscal protection 영역.

---

## 8. 본 STEP 의 영구 가치

1. **Generic TabBar primitive 정착** — DetailPanel / DocumentDrawer / 미래 다른 multi-section UI 가 자연 합류 가능. AXVELA UI 라이브러리 1차 확장.
2. **9-tab over-scope 거부 의사결정 매뉴얼화** — 사용자 spec 의 표면 의도 (9-tab 언급) 보다 *architectural scope* (ArtworkFormDrawer = 작품 own data) 우선. 정직한 4-tab 채택의 reasoning 영구 reference.
3. **STEP 119 → STEP 118 합류 패턴 입증** — type-only foundation (Stage 1) → functional surface (Stage 2) 의 자연 합류 흐름. 미래 type-only STEP 후속 functional STEP 의 reference.
4. **Backward compat 6회 연속 입증** — STEP 113/114/115/119/116/118 모두 기존 호출자 무손상.
5. **Stage 2 진행 가속 (2/3)** — Route delta +2 kB 만으로 image-first hierarchy + tab structure + curation functional surface 모두 정착.
6. **CurationTextField helper 정착** — 5 fields 동일 패턴 입력 — 미래 다른 free-form text input surface 의 reference.
