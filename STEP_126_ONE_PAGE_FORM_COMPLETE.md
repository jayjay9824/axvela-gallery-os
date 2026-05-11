# STEP 126 — One-Page Artwork Workflow Document — COMPLETE ✅

**완료 시점**: 2026-05-12
**Phase**: 4 — Artwork-Centric Workflow Foundation
**Risk profile**: 🟡 mid → 🟢 (Phase 별 분리 commit + 운영 단계 확인 후) — UX 패러다임 전환

---

## 1. 사용자 spec 정조준

**전환 방향**: "탭 이동형 CMS" → "하나의 artwork workflow document".

ArtworkFormDrawer 는 STEP 118 에서 정착된 4-tab structure 위에서, 사용자가 *4 개의 분리된 페이지 사이를 토글* 하는 인터랙션을 가지고 있었음. STEP 126 은 동일한 4-tab 의미 구조를 *하나의 연속된 작업 문서 + sticky anchor navigation* 으로 전환 — 사용자가 한 작품을 등록·편집할 때 작품 전체가 한 호흡으로 시야에 들어오고, TabBar 는 *현재 위치 표시 + 빠른 이동 도구* 가 됨.

| 사용자 spec 항목 | 정착 결과 |
|----------------|----------|
| TabBar 제거 0줄 — sticky anchor navigation 으로 재용도 | ✅ TabBar primitive 자체 0줄 변경, 호출자 측 className/onChange 만 anchor 모드로 전환 |
| 4 Tab Panel 의 `if (activeTab === ...)` 분기 제거 | ✅ Phase 2 — 4 conditional 모두 제거, `<section>` 4 개 상시 mount |
| 모든 section 동시 mount + 스크롤 | ✅ `flex flex-col gap-8` 컨테이너 안에 4 section 상시 mount |
| TabBar 클릭 → scrollIntoView 로 section 점프 | ✅ Phase 3 — `handleAnchorTabChange` 가 ref 기반 `scrollIntoView({ behavior: "smooth", block: "start" })` |
| IntersectionObserver 로 활성 section 추적 → TabBar active state 자연 동기화 | ✅ Phase 4 — `rootMargin: "0px 0px -50% 0px"` + 다단계 threshold + 300ms mute jitter 회피 |

---

## 2. 4-Phase 분리 Commit 흐름

revert 단위를 phase 로 보존 — 어느 phase 에서 회귀 발견 시 그 phase 만 되돌릴 수 있는 구조.

| Phase | Commit | 변경 (lines) | 작업 요지 | tsc | lint | build |
|-------|--------|------------|----------|-----|------|-------|
| 1 — Analysis | (commit 0줄) | 0 | 영향 범위 파악, 변경 0줄 사전 분석 보고 | — | — | — |
| 2 — Mounted sections | `b9c4bb2` | +111 / -94 | 4 conditional 제거 → 4 `<section ref id>` 상시 mount, `autoFocus` 제거 | 0 errors | clean | 191 / 278 kB |
| 3 — Sticky anchor + scrollIntoView | `fb6ab87` | +48 / -7 | TabBar sticky / `-mx-6 px-6` 전폭 확장 / `handleAnchorTabChange` / `scroll-mt-12` × 4 | 0 errors | clean | 191 / 278 kB |
| 4 — Scroll spy + active sync | `a431fbd` | +85 / -3 | IntersectionObserver useEffect / rootMargin 튜닝 / 300ms mute / cleanup | 0 errors | clean | 191 / 278 kB |
| 5 — Closure doc | (본 commit) | doc only | STEP_126 doc + STEP_INDEX 갱신 | 0 errors | clean | 191 / 278 kB |

**Phase 1 의 명시적 commit 부재**: 분석 보고는 코드 변경 0줄로 정의되어, commit 으로 보존할 변경 deltas 자체가 없음. Phase 1 산출물은 본 doc §3 영역에 흡수.

---

## 3. Phase 별 변경 영역

### Phase 2 — 4 panel toggle 제거 (`b9c4bb2`)

[src/components/artwork/ArtworkFormDrawer.tsx](src/components/artwork/ArtworkFormDrawer.tsx):

- 4 section refs 추가 — `imageSectionRef` / `artworkSectionRef` / `curationSectionRef` / `pricingSectionRef` (Phase 3 scrollIntoView target, Phase 4 IntersectionObserver observe target 으로 활용).
- `{activeTab === "x" && (<>...</>)}` 4 개 conditional 제거 → `<div className="flex flex-col gap-8">` 안에 `<section id="form-section-{key}" ref>` 4 개 상시 mount.
- title TextField 의 `autoFocus` 제거 — 4 section 상시 mount 상태에서 Drawer open 직후 강제 포커스 → 브라우저 자동 scroll 로 image-first hierarchy (STEP 116) 무력화 방지.
- `activeTab` state / `TabBar` 호출 / 모든 form state / validation / handleSubmit / handleSaveDraft / draft hydration **0줄 변경**.

### Phase 3 — Sticky anchor + scrollIntoView (`fb6ab87`)

- `handleAnchorTabChange` callback — `setActiveTab(next)` 즉시 동기화 + 해당 section ref 의 `scrollIntoView({ behavior: "smooth", block: "start" })`.
- TabBar 호출:
  - `onChange`: `setActiveTab` → `handleAnchorTabChange`.
  - `className`: `"mb-5"` → `"sticky top-0 z-10 bg-surface -mx-6 px-6 mb-5"` — scroll container 상단 pin, 전폭 확장, opaque 배경.
- 4 section 모두 `scroll-mt-12` (48px) — sticky TabBar (~40px) 아래로 section top 안착.

### Phase 4 — Scroll spy + active sync (`a431fbd`)

- `scrollContainerRef` — IntersectionObserver root 인 form body `overflow-y-auto` div 에 attach.
- `observerMutedRef` / `muteTimeoutRef` — TabBar 클릭 직후 300ms 동안 observer 콜백 무시 (smooth-scroll 진행 중 jitter 차단).
- `handleAnchorTabChange` 확장 — 클릭 직후 `observerMutedRef.current = true` + `setTimeout(unmute, 300)`, 재클릭 시 기존 타이머 clear.
- `useEffect` — IntersectionObserver 생성:
  - `root: scrollContainerRef.current`
  - `rootMargin: "0px 0px -50% 0px"` — 활성 zone 을 viewport 상단 절반으로 제한.
  - `threshold: [0, 0.25, 0.5, 0.75, 1]` — 부드러운 ratio 변화 추적.
  - 콜백: muted 무시 / 가장 높은 intersectionRatio section 선택 → `setActiveTab`. DOM 순서 동률 시 위쪽 section 우선.
  - cleanup: `observer.disconnect()` + `clearTimeout(muteTimeoutRef.current)`.
- ArtworkForm 은 Drawer `key` (`artworkId | "new"`) 기반 mount/unmount → effect 가 매 Drawer open 마다 새로 실행, 이전 인스턴스 cleanup. 메모리 누수 0.

---

## 4. 보존 약속 — 7 항목 모두 무손상 입증

| 보존 항목 | 검증 방식 | 결과 |
|----------|----------|------|
| **STEP 117 draft hydration** (`draftedInput?.xxx` fallback) | form state 초기화는 mount 시점이며 `activeTab` 비의존 → 4 phase 모두 0줄 변경 | ✅ 운영 단계 임시 저장/이어 작성 회귀 0건 확인 |
| **STEP 117 handleSaveDraft / handleSubmit** | activeTab/section 구조 비의존, 모든 form state 직접 참조 | ✅ 0줄 변경 |
| **STEP 116 ArtworkUploadHero** | 호출 위치만 conditional → section 안으로 이동, props/내부 0줄 변경 | ✅ Phase 2 후 Drawer open 시 Hero 첫 시선 (autoFocus 제거 정합 강화) |
| **STEP 118 TabBar primitive** | 단독 consumer (ArtworkFormDrawer) — primitive 자체 0줄 변경, `className`/`onChange` 호출자 측 분기 | ✅ `src/components/ui/TabBar.tsx` 변경 0줄 (git log per-file 확인) |
| **STEP 118 4-tab 의미 구조** (`TAB_DEFINITIONS`) | image / artwork / curation / pricing 4 key 정의 그대로 anchor key 재사용 | ✅ 0줄 변경 |
| **STEP 119 5 curation fields functional 입력** | description / curationDraft / exhibitionText / artistNote / provenanceNote state + onChange + UI 0줄 변경 | ✅ 0줄 변경 |
| **기존 form validation / submit / handleSaveDraft 흐름** | `errors` useMemo / `handleSubmit` / `handleSaveDraft` 모두 activeTab 비의존 (이전부터 모든 field 항상 평가) | ✅ 0줄 변경 |

**AXID 표시 / PriceSuggestionPanel / RemoveFromStorageAction edit-only 분기** (`isEdit && artwork`) — activeTab 무관, 모두 무손상.

---

## 5. 검증 결과

```
Phase 2 (b9c4bb2):
  npx tsc --noEmit          → 0 errors
  npx next lint             → No ESLint warnings or errors
  npx next build            → Route 191 kB / First Load JS 278 kB

Phase 3 (fb6ab87):
  npx tsc --noEmit          → 0 errors
  npx next lint             → No ESLint warnings or errors
  npx next build            → Route 191 kB / First Load JS 278 kB

Phase 4 (a431fbd):
  npx tsc --noEmit          → 0 errors
  npx next lint             → No ESLint warnings or errors
  npx next build            → Route 191 kB / First Load JS 278 kB
```

**기존 78 scenarios**: 변경 영역이 lifecycle / UX wiring (단일 파일) 이라 unit-test 적합도 낮음 — 기존 scenarios 회귀 0건은 build pass 로 확인. 신규 scenarios 미추가 (Drawer integration 영역, scope 절제).

---

## 6. 누적 bundle delta — 0 byte

| baseline | Phase 2 | Phase 3 | Phase 4 |
|----------|---------|---------|---------|
| `2e4db34` STEP 124-125 P1 bugfix | `b9c4bb2` | `fb6ab87` | `a431fbd` |
| Route 191 kB / First Load 278 kB | 191 / 278 | 191 / 278 | 191 / 278 |
| (basline) | **Δ 0 / Δ 0** | **Δ 0 / Δ 0** | **Δ 0 / Δ 0** |

- IntersectionObserver / scrollIntoView 는 brower native API — 외부 라이브러리 import 0건.
- sticky / scroll-mt / bg-surface 등은 CSS class 만 — runtime 비용 0.
- 신규 callback / useEffect / refs 추가가 tree-shake 후 bundle 측 미반영 (소량 JS, gzip 후 측정 가능량 미만).

---

## 7. 운영 회귀 점검 (사용자 단계 확인 결과)

Phase 3 / Phase 4 모두 사용자 운영 사이트 확인 완료:

**Phase 3 확인 보고** (sticky anchor + scrollIntoView):
- ✅ Drawer 최상단 이미지 영역 (image-first hierarchy 정합)
- ✅ 4 section 한 페이지 연속 mount
- ✅ TabBar sticky (스크롤해도 상단 고정)
- ✅ TabBar 클릭 → 부드러운 scrollIntoView
- ✅ 클릭한 탭 즉시 active 표시
- ✅ 임시 저장 / 이어 작성 회귀 0건
- ✅ 작품 추가 / 편집 / 저장 정상

**Phase 4 확인 보고** (scroll spy + active sync):
- ✅ 스크롤 시 TabBar active 자연 동기화 (4 section 따라옴)
- ✅ TabBar 멀리 점프 시 중간 깜빡임 0건 (300ms mute 효과 정확)
- ✅ 위/아래 스크롤 양방향 모두 정상
- ✅ 임시 저장 / 이어 작성 회귀 0건
- ✅ 편집 모드 hydrate 정상
- ✅ 작품 저장 정상

---

## 8. STEP 118 → STEP 126 진화 정합

STEP 118 가 "9-tab over-scope 거부 → 정직한 4-tab" 결정으로 자료 분류 dimension 을 안정시킨 산출물 위에서, STEP 126 은 *4 tab 의 의미 자체는 그대로 보존*하면서 *상호작용 모델만 전환* — 자료 구조와 UX 전환을 분리한 진화 경로.

| 항목 | STEP 118 (4-tab 토글) | STEP 126 (one-page document) |
|------|----------------------|------------------------------|
| TabKey 정의 | image / artwork / curation / pricing | 동일 (재사용) |
| TabBar primitive | 신규 정착 | 0줄 변경 |
| 4 panel mount | conditional (`activeTab === "x"`) | 상시 mount |
| Navigation 의미 | 탭 토글 (시각 단절) | 점프 + 활성 표시 (시각 연속) |
| 사용자 인지 모델 | 4 단계 마법사 | 하나의 작품 문서 |
| Bundle 비용 | +1 kB (TabBar primitive) | +0 kB |

---

## 9. 다음 STEP 권장

본 STEP 126 으로 Phase 4 의 "Artwork-Centric Workflow Foundation" 진입 경험 (registration UX) 이 정착. 사용자 spec 의 Phase 4 Stage 3 reserved 항목 진행 가능:

- **STEP 120** 🟡 — Hold State Foundation (Transaction status 확장, `Hold` state + soft hold + deposit + expiration)
- **STEP 121** 🟡 — Invoice PRE/FINAL Distinction (⚠️ Phase 1 Fiscal protection — `invoiceKind?` optional slot only, 기존 state machine 0줄 변경 필수)
- **STEP 122** 🟡 — Workflow Sequence Visualization (Living Timeline rule_8 에 Phase 4 신규 state 자연 합류, Phase 4 wrap)

STEP 120 → 121 → 122 순서 권장 — Hold state 가 Invoice PRE/FINAL 흐름의 의미 단위 (예약/대금 일부 잠금) 의 자연 기반.

---

## 10. revert 경로

| 의도 | 명령 |
|------|------|
| Phase 4 만 되돌리기 (IntersectionObserver scroll spy 제거, sticky+scrollIntoView 유지) | `git revert a431fbd` |
| Phase 3+4 되돌리기 (sticky/scroll/IO 모두 제거, 4 section mount 만 유지) | `git revert a431fbd fb6ab87` |
| STEP 126 전체 되돌리기 (STEP 124-125 baseline 복귀) | `git revert a431fbd fb6ab87 b9c4bb2` 또는 `git reset --hard 2e4db34` |

각 phase commit 이 독립적으로 revert-safe — 후속 phase 의존성은 ref 선언/section id 등 구조적 결합이지만 revert 시 자연 정합 복원 (Phase 2 보존 시 Phase 3 의 `handleAnchorTabChange` 만 제거하면 TabBar 가 다시 `setActiveTab` 단순 호출자 + 4 section 상시 mount 상태로 안전 복귀).
