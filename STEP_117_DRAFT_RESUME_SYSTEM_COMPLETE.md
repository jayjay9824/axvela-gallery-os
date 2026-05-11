# STEP 117 — Draft / Resume System — COMPLETE ✅

**완료 시점**: 2026-05-09
**Phase**: 4 — Artwork-Centric Workflow Foundation (7/10)
**Stage**: 2 — UI Restructure (3/3) 🎉 완성
**Risk profile**: 🟡 mid → 🟢 (검증 후) — Optional persistence slice + 다중 surface (Form / Sidebar / Store) 통합 + 사용자 흐름 정착

---

## 1. STEP 117 의 정체

### 1.1 본 STEP 의 목표

`AXVELA_WORKFLOW_ARCHITECTURE.md §4.4 Draft-safe` 의 minimum viable 구현:

> *"Drawer 닫혀도 workflow 보존. 모든 multi-step form 은 partial state 저장 가능. 사용자 의도하지 않은 데이터 손실 0건."*

### 1.2 본 STEP 의 영역 (MVP scope 정조준)

| 항목 | 채택 |
|------|------|
| 명시적 "임시 저장" 버튼 | ✅ |
| Sidebar "이어 작성" entry | ✅ |
| Resume CTA (draft hydrate) | ✅ |
| Submit 성공 시 draft auto-clear | ✅ |
| **Cancel 시 자동 silent save** | ❌ **거부** (future STEP — 사용자 의도 모호) |
| **Auto-save (debounce)** | ❌ **거부** (future STEP — UX/race-condition 별도 검토) |
| **Multiple drafts** | ❌ Single draft v1, future expansion path 명확 |
| **편집 모드 draft** | ❌ — 신규 등록만 (편집은 직접 update, draft 의미 0) |

### 1.3 사용자 흐름 (정착)

```
[새 작품 추가] 클릭 (ArtworkGrid · ArtworkFormDrawer 열림)
   ↓
사용자 4-tab 입력 진행 — 이미지 → 작품 정보 → 큐레이션 → 거래
   ↓
[임시 저장] 클릭 ──→ saveArtworkDraft(input) → drawer 닫힘
   ↓
사용자 다른 작업 진행
   ↓
Sidebar "이어 작성" entry 표시 ("흐름의 조각 / 2시간 전")
   ↓
클릭 ──→ openCreate() → ArtworkForm mount → 4 tab fields 모두 hydrate
   ↓
[작품 추가] 클릭 → createArtwork(input) 성공 → store.artworkDraft = undefined → entry 사라짐
```

---

## 2. Architecture 결정 핵심

### 2.1 Optional Slice 패턴 — STEP 87/89 정확 답습

7번째 연속 답습 — Phase 4 backward compat 100% 정착:

```typescript
// PersistedState (src/lib/persistence.ts)
interface PersistedState {
  // ... 기존 ...
  artworkDraft?: ArtworkDraftState;  // ⭐ 옵셔널 슬라이스
}

// validateV1 의 required 미추가 (legacy 호환 핵심)
// SCHEMA_VERSION "v1" 변경 0줄
// hydrateFromStorage 부재 시 undefined fallback (forward-only)
```

### 2.2 단일 Draft 정책 (v1)

한 시점에 하나의 draft. 새 임시 저장은 기존 draft 를 덮어씀. `startedAt` 보존, `lastEditedAt` 갱신. Future expansion path:

```typescript
// 향후 확장 시 (현 슬롯 그대로 보존)
interface PersistedState {
  artworkDraft?: ArtworkDraftState;
  additionalDrafts?: ArtworkDraftState[];   // 미래 추가 가능
}
```

### 2.3 Submit 성공 시 auto-clear

`createArtwork` action 의 set 안에서 `artworkDraft: undefined` 통합. 작품이 정식 record 로 promote 되면 임시 저장 의미 0 — 사용자가 명시적 폐기 호출 불필요.

### 2.4 Sidebar zero-state pattern

`DraftResumeEntry` 가 `draft === undefined` 시 `null` return. mount 점에서 unconditional 렌더 가능 — 별도 wrapper 분기 불필요. *미래 다른 sidebar entry 들에도 답습 가능한 패턴*.

---

## 3. 인벤토리

### 3.1 신규 파일 (3)

| 파일 | LOC | 역할 |
|------|-----|------|
| `src/types/artwork-draft.ts` | 145 | `ArtworkDraftState` interface + `extractDraftPreviewLabel` + `formatDraftRelativeTime` helpers |
| `src/lib/__tests__/artwork-draft.scenarios.ts` | ~395 | 6 scenarios (preview label / relative time / save round-trip / clear / submit auto-clear / persist forward compat) |
| `STEP_117_DRAFT_RESUME_SYSTEM_COMPLETE.md` | — | 본 doc |

### 3.2 수정 파일 (5)

| 파일 | 변경 |
|------|------|
| `src/lib/persistence.ts` | `PersistedState.artworkDraft?` optional slice + import + `PersistableStoreSnapshot.artworkDraft?` + `extractPersistedState` echo + `sanitizeImportedState` echo (~+25줄) |
| `src/store/useArtworkStore.ts` | `ArtworkUIState.artworkDraft?` slice + 2 actions (`saveArtworkDraft` / `clearArtworkDraft`) signatures + initial state + createArtwork 성공 시 auto-clear + hydrateFromStorage / resetAllData 합류 (~+50줄) |
| `src/components/PersistenceProvider.tsx` | snapshot 빌딩 시 `artworkDraft: state.artworkDraft` 동봉 (3줄) |
| `src/components/artwork/ArtworkFormDrawer.tsx` | `draftedInput` derive + 모든 form state 의 hydration fallback (artistName / artistNameEn / year / medium / size / price / state / thumbnailColor / imageMeta / 5 curation 동시 합류) + `handleSaveDraft` function + footer "임시 저장" 버튼 (~+90줄) |
| `src/components/layout/Sidebar.tsx` | `DraftResumeEntry` 컴포넌트 정의 + PRIMARY 다음 mount + helper imports (~+70줄) |

### 3.3 절대 변경 안된 영역

- ❌ `validateV1` (legacy 호환 핵심)
- ❌ `SCHEMA_VERSION "v1"`
- ❌ STEP 113~119 산출물
- ❌ 기존 ArtworkFormDrawer 4-tab 흐름 logic 변경 0줄
- ❌ Phase 1 Fiscal frozen / AI infra
- ❌ `ArtworkInput` 타입 변경 0줄 — draft 는 ArtworkInput 그대로 사용

---

## 4. 검증 결과

### 4.1 정합성 — Phase 4 §4 8 원칙

| 원칙 | 결과 |
|------|------|
| §4.1 Additive only | ✅ 신규 type + optional slice + 신규 actions + 신규 buttons (기존 변경 0) |
| §4.2 Optional slot | ✅ artworkDraft? optional, sub-fields 모두 optional |
| §4.3 No migration | ✅ validateV1 미수정, SCHEMA_VERSION "v1" |
| §4.4 **Draft-safe** | ✅ **본 STEP 의 핵심 영역 — 사용자 의도하지 않은 데이터 손실 0건 정착** |
| §4.5 Backward compat | ✅ legacy 데이터 (artworkDraft 부재) 자연 호환 — scenario §6 검증 |
| §4.6 Build green | ✅ tsc / lint / build / scenarios 모두 통과 |
| §4.7 Worktree 금지 | ✅ |
| §4.8 AI not priority | ✅ AI 미포함, pure data |

### 4.2 Build / TS / Lint / Scenarios

```
✅ npx tsc --noEmit          → 0 errors
✅ npx next lint              → No ESLint warnings or errors
✅ npx next build             → Route 190 kB / First Load 277 kB
                                (Δ STEP 118 baseline: +1 kB)
✅ Scenarios                  → 78/78 PASS across 9 suites
                                (STEP 117: 6 신규, 기존 72 회귀 0건)
```

### 4.3 6 신규 Scenario 검증 영역

| # | Scenario | 검증 |
|---|----------|------|
| 1 | `extractDraftPreviewLabel` | title 우선 → artistName fallback → "(제목 없음)" + 24자 cap + ellipsis |
| 2 | `formatDraftRelativeTime` | 방금 / N분 전 / N시간 전 / 어제 / N일 전 / 30일+ ISO date / future fallback |
| 3 | save → load round-trip | `saveArtworkDraft(input)` 후 store.artworkDraft.data === input + startedAt 보존 + lastEditedAt 갱신 |
| 4 | save → clear | `clearArtworkDraft()` 후 store.artworkDraft === undefined + idempotent |
| 5 | createArtwork submit auto-clear | 저장된 draft 가 createArtwork 성공 시 자동 undefined |
| 6 | persistence v1 forward compat | 기존 PersistedState (artworkDraft 부재) 가 validateV1 + sanitize 통과 |

### 4.4 Bundle delta 분석

```
STEP 118 baseline:  Route 189 kB / First Load 276 kB
STEP 117 정착:      Route 190 kB / First Load 277 kB  (+1 kB)

Entry briefing 예상: +5~10 kB
실제: +1 kB → tree-shaking 효과 + helpers compact
```

---

## 5. UI 위치 (Manifesto 정합)

| 위치 | 변경 |
|------|------|
| **Sidebar** | 신규 `DraftResumeEntry` (PRIMARY 다음 mount, draft 부재 시 자연 비표시) |
| **Detail Panel** > Drawer footer | 신규 `[임시 저장]` ghost button (신규 등록 모드만) |
| **Drawer 본문** | 변경 0줄 (4-tab 흐름 완전 보존) |
| **Artwork Grid** | 변경 0줄 |

---

## 6. 본 STEP 의 영구 가치

1. **Phase 4 §4.4 Draft-safe 의 영구 정착** — 사용자 의도하지 않은 데이터 손실 0건 보장 패턴 매뉴얼화. 이후 모든 multi-step form 의 reference 가 됨.
2. **Phase 4 Stage 2 완성 (3/3)** — 116 ✅ → 118 ✅ → 117 ✅. Phase 4 7/10 진입, 마지막 Stage 3 (Tx Flow) 진입 준비 완료.
3. **Optional slice 패턴 7회 연속 답습** — STEP 87/89 + 113~119/116/118 + 117. Phase 4 모든 STEP 이 backward compat 100%.
4. **Single draft → Multiple drafts future expansion path 명확화** — `additionalDrafts?: ...` future-ready, 현 슬롯 보존 정책.
5. **Sidebar zero-state pattern 정착** — `DraftResumeEntry` 가 draft 부재 시 자연 비표시. 미래 다른 entry 들에도 동일 패턴 답습 가능 (work queue, pending review, etc.).
6. **rule_9 Work Queue 정합 강화** — "이어 작성" entry 가 알림이 아닌 *실행 가능 액션*. 클릭 즉시 동작 (drawer 진입 + form hydrate 동시).

---

## 7. 다음 STEP

Phase 4 Stage 3 (Tx Flow): STEP 120 → 121 → 122 wrap. Stage 2 완성 → Tx 흐름 정착으로 Phase 4 마무리.
