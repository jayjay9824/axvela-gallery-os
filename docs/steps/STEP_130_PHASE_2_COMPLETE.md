# STEP 130 — Internationalization Layer — Phase 2 COMPLETE ✅

**완료 시점**: 2026-05-13
**Phase**: 4 — Artwork-Centric Workflow Foundation (STEP 128 revised roadmap §7 의 두 번째 step, STEP 129 다음)
**Risk profile**: 🟢 Low (additive only, 모든 helper 호출처 0 → STEP 131+ 점진 wire, production behavior 변화 0)
**Baseline**: `8a8a667` (Commit 3 UI integration 완료)
**Branch**: `claude/step127-architecture-review` (STEP 127~130 연속 commit 흐름)
**Worktree**: `condescending-lamarr-f5022a` (canonical, cross-worktree state 발견 후 확정)

---

## §1 개요 — STEP 130 Phase 2 (Internationalization Layer 구현)

사용자 spec STEP 130 (artwork i18n storage-level multilingual data) 의 *Phase 2 implementation* 완료. **4-commit 분할 + 1 hotfix (1b)** 로 본 STEP 종결.

**핵심 성과**:

1. **Optional Slice 10회째 답습** — `Artwork.titleI18n?` + `Artist.nameI18n?` 옵셔널 슬롯 추가. `validateV1` / `SCHEMA_VERSION "v1"` 변경 0줄, 기존 Phase 1 ~ STEP 129 모든 데이터 자동 호환.
2. **DocumentLocale 재활용** — STEP 96 정착물 (`AILocale` alias, 4-locale ko/en/ja/zh) 그대로 재사용. 신설 `Locale` type 폐기 결정 (STEP 130 Phase 1 §2 + §8). UI / AI infra / storage layer 모두 같은 enum 공유 — drift 위험 0.
3. **Two-Layer Curation Model 답습** — STEP 119 의 `CurationNote` (정식 문서) vs `Artwork.curationDraft` (inline) 패턴 재사용. STEP 96 *runtime AI projection* ↔ STEP 130 *storage-level multilingual* 별도 dimension 정착.
4. **옵션 c1 병행 호환** — 기존 `Artist.nameEn?` 6 files 정착물 (useArtworkStore / ArtworkFormDrawer / types/artwork / mock-data / DetailPanel / ArtworkGrid) 무변경 보장. `getArtistName(artist, locale)` fallback chain 이 두 슬롯 자연 흡수.
5. **옵션 P1 (Persistence 0)** — `currentLocale` UI session state. `PersistedState` interface 미추가로 자연 미 persist. 브라우저 재시작 시 항상 `DEFAULT_DOCUMENT_LOCALE` ("ko") 초기화. `currentRole` 의 표준 패턴 정합.
6. **옵션 U1 (Sidebar header toggle)** — `SidebarLocaleToggle` 신규 컴포넌트. STEP 96 `TranslationLocaleSelector` 의 museum-safe minimal class 정확 답습 + `sourceLocale` prop 제거 (artwork i18n 은 source 개념 부재).
7. **사용처 wire 0건 정착** — 본 STEP 130 = *infrastructure 정착*. 사용처 wire (ArtworkGrid / DetailPanel / Drawer 의 title / artist name projection) 는 STEP 131+ 점진적 적용.

**briefing 정정 사이클 1건 흡수**:
- Commit 1 진입 시점 — Cross-worktree state 발견 (§8 책임감 있는 멈춤 패턴 7건째). 동일 commit 이 다른 worktree 에서 이미 정착 발견 → 3단계 진단으로 Case A (의미 동등) 확정 → `01a1540` 정본 채택, 본 worktree 작업 폐기.

---

## §2 5 commits 누적 chain

```
8a8a667 (HEAD) STEP 130 Phase 2 — Commit 3: UI integration (Sidebar header locale toggle)
50ab862        STEP 130 Phase 2 — Commit 2: Store layer (currentLocale + setLocale + P1)
8109d5e        STEP 130 Phase 2 — Commit 1b: i18n-helpers test scenarios (8 case)
01a1540        STEP 130 Phase 2 — Commit 1: Foundation (titleI18n? + nameI18n? + helpers)
f9b8b5f        STEP 130 Phase 1 — Architecture Review (Internationalization Layer)
278d97f        STEP 129 Phase 2 — Commit 4 (Phase 2 baseline)
```

**Commit-별 변경 요약**:

### Commit 1 — Foundation (`01a1540`)

| 영역 | 파일 | 변경 |
|------|------|------|
| Type slot | [src/types/artwork.ts](../../src/types/artwork.ts) | `Artwork.titleI18n?` + `Artist.nameI18n?` 옵셔널 슬롯 추가 + JSDoc lock |
| Helper 신설 | [src/lib/i18n-helpers.ts](../../src/lib/i18n-helpers.ts) | `getTitle(artwork, locale)` + `getArtistName(artist, locale)` pure helpers |

**2 files, +190 / -3 lines**. Risk 🟢 Low (additive, helper 호출처 0 → tree-shake out, bundle Δ 0 kB).

### Commit 1b — Test scenarios (`8109d5e`)

| 영역 | 파일 | 변경 |
|------|------|------|
| Test scenarios | [src/lib/__tests__/i18n-helpers.scenarios.ts](../../src/lib/__tests__/i18n-helpers.scenarios.ts) | 8 case (getTitle 4 + getArtistName 4), Deferred Item D-130-1 명시 |

**1 file, +346 lines**. Risk 🟢 Low (additive only, production code 변경 0). 사용자 요청 — Gate 4 의 "i18n 신규분" expectation 충족 + 회귀 방지 강화.

### Commit 2 — Store layer (`50ab862`)

| 영역 | 파일 | 변경 |
|------|------|------|
| Import | [src/store/useArtworkStore.ts](../../src/store/useArtworkStore.ts) | `DEFAULT_DOCUMENT_LOCALE` + `type DocumentLocale` from `@/lib/document-locale` |
| Interface | (위 동일) | `currentLocale: DocumentLocale` + `setLocale: (locale) => void` |
| State init | (위 동일) | `currentLocale: DEFAULT_DOCUMENT_LOCALE` (currentRole 직후) |
| Action impl | (위 동일) | `setLocale: (locale) => set({ currentLocale: locale })` |
| resetAllData | (위 동일) | `currentLocale: DEFAULT_DOCUMENT_LOCALE` baseline 복귀 |

**1 file, +86 lines**. Risk 🟢 Low (additive, 호출처 0 → bundle Δ 0 kB). **옵션 P1 자동 만족** — `PersistedState` 미추가, `partialize` 수정 불필요 (Zustand persist middleware 미사용 아키텍처).

### Commit 3 — UI integration (`8a8a667`)

| 영역 | 파일 | 변경 |
|------|------|------|
| 컴포넌트 신설 | [src/components/layout/SidebarLocaleToggle.tsx](../../src/components/layout/SidebarLocaleToggle.tsx) | "KO EN JA ZH" segmented control, store 직접 구독, museum-safe class |
| Sidebar 통합 | [src/components/layout/Sidebar.tsx](../../src/components/layout/Sidebar.tsx) | Logo header row 에 `justify-between` + `<SidebarLocaleToggle />` 인라인 |

**2 files, +151 / -2 lines**. Risk 🟢 Low (toggle UI 추가, bundle Δ 0 kB — STEP 96 정착물 + Commit 2 store fields 이미 진입).

### Commit 4 (본 commit) — Documentation closure

| 영역 | 파일 | 변경 |
|------|------|------|
| Phase 2 closure | docs/steps/STEP_130_PHASE_2_COMPLETE.md | 신규 (본 문서) |
| Phase 1 cross-ref | docs/steps/STEP_130_PHASE_1_ARCHITECTURE_REVIEW.md | +1줄 (하단 link) |

**2 files, doc 단독 commit**. Risk 🟢 Low (코드 0줄, production 영향 0).

---

## §3 검증 게이트 결과 누적 표 — 4 commits × 5 gates = 20 cells

| Commit | Gate 1 (tsc) | Gate 2 (lint) | Gate 3 (build) | Gate 4 (tests) | Gate 5 (diff stat) |
|--------|--------------|---------------|----------------|----------------|--------------------|
| 1 `01a1540` | ✅ 0 errors | ✅ clean | ✅ 195/282 kB | ✅ 12/12 PASS | ✅ 2 files |
| 1b `8109d5e` | ✅ 0 errors | ✅ clean | ✅ 195/282 kB (Δ 0) | ✅ 13/13 PASS (i18n 신규) | ✅ 1 file |
| 2 `50ab862` | ✅ 0 errors | ✅ clean | ✅ 195/282 kB (Δ 0) | ✅ 13/13 PASS | ✅ 1 file |
| 3 `8a8a667` | ✅ 0 errors | ✅ clean | ✅ 195/282 kB (Δ 0) | ✅ 13/13 PASS | ✅ 2 files |
| 4 (본 commit) | ✅ 0 errors | ✅ clean | ✅ 195/282 kB (Δ 0) | ✅ 13/13 PASS | ✅ 2 files (doc only) |

**전체 결과**: 20/20 cells PASS, 0 fail. **production bundle 영향 0 kB** (5 commits 누적, Commit 1 베이스라인 대비). 회귀 0건.

**Bundle Δ 0 의 근거**:
- Commit 1 — helper 호출처 0 → tree-shake out
- Commit 1b — 테스트 파일, production bundle 미포함
- Commit 2 — store fields, 호출처 0 → 자연 dead code 제거
- Commit 3 — UI component, STEP 96 정착물 (DOCUMENT_LOCALES / LABEL_SHORT) + Commit 2 store fields 이미 진입, 신규 markup 압축 후 measurable 미만
- Commit 4 — 문서 단독

---

## §4 보존 약속 변경 0줄 확인 누적 표

| 보존 약속 영역 | Commit 1 | Commit 1b | Commit 2 | Commit 3 | Commit 4 |
|-----------|----------|-----------|----------|----------|----------|
| `src/types/artwork.ts` (Commit 1 정착물) | — (정착) | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 |
| `src/lib/i18n-helpers.ts` (Commit 1 정착물) | — (정착) | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 |
| `src/lib/__tests__/i18n-helpers.scenarios.ts` (Commit 1b 정착물) | n/a | — (정착) | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 |
| `src/store/useArtworkStore.ts` (Commit 2 정착물) | ✅ 0줄 | ✅ 0줄 | — (정착) | ✅ 0줄 | ✅ 0줄 |
| `src/components/layout/SidebarLocaleToggle.tsx` (Commit 3 정착물) | n/a | n/a | n/a | — (정착) | ✅ 0줄 |
| `src/components/layout/Sidebar.tsx` (Commit 3 wire) | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | +11/-2 | ✅ 0줄 |
| `src/lib/persistence.ts` (SCHEMA_VERSION v1) | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 |
| `src/lib/document-locale.ts` (STEP 96 정착물) | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 |
| `package.json` (tsx devDep 미등록 유지) | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 |
| STEP 96 Translation Layer 10 files | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 |
| STEP 127/129 정착물 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 |
| AXVELA_*.md 6 영구 정책 문서 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 | ✅ 0줄 |
| docs/design/passport/ + certificate/ git add 0건 | ✅ untracked | ✅ untracked | ✅ untracked | ✅ untracked | ✅ untracked |
| 신규 dependency | ✅ 0건 | ✅ 0건 | ✅ 0건 | ✅ 0건 | ✅ 0건 |

**결과**: 14 보존 영역 × 5 commits = 70 cells, **모두 ☑** (정착물이 그 commit 작업 영역이면 — 표기, 그 외 모두 0줄 확인).

---

## §5 사용자 §9 결정 5 항목 정합 확인

| 항목 | 결정 | 정착 결과 |
|------|------|----------|
| 1. Artist 다국어 정책 | (c1) `nameEn?` 유지 + `nameI18n?` 추가 병행 | ✅ Commit 1 — 기존 `nameEn?` 6 files 무변경. fallback chain `nameI18n[locale] → nameI18n.en → nameEn → name` 으로 자연 흡수. Commit 1b §7 시나리오 명시 검증 |
| 2. Persistence 정책 | (P1) Persistence 0 | ✅ Commit 2 — `PersistedState` interface 미추가, `partialize` 수정 0건, 브라우저 재시작 시 "ko" 초기화 자동 보장 |
| 3. UI 진입점 | (U1) Sidebar header locale toggle | ✅ Commit 3 — `SidebarLocaleToggle` 신규 컴포넌트, 로고 header row `justify-between` 통합 |
| 4. Commit 분할 | 4 commit 분할 (Foundation / Store / UI / Closure) | ✅ Phase 2 4-commit + 1 hotfix (1b) 정합 |
| 5. Risk 인지 | 🟢 Low | ✅ 모든 commit Risk 🟢 Low 유지, additive only, 회귀 0건 |

**5/5 항목 정합 100%**. 사용자 spec 충족.

---

## §6 Deferred Item D-130-1 영구 기록 ⚠️

**Deferred Item D-130-1**: `titleI18n.en = ""` 빈 문자열 fallback 의미 결정 보류

### §6.1 발견 위치
- Commit 1 (`01a1540`) — `getTitle` 구현이 nullish coalescing (`??`) chain 채택
- Commit 1b (`8109d5e`) — i18n-helpers.scenarios §4 case 가 *현 거동* 만 lock (의미 결정 회피)

### §6.2 현 거동 (Commit 1 정착)
```ts
export function getTitle(artwork: Artwork, locale: DocumentLocale): string {
  return artwork.titleI18n?.[locale] ?? artwork.titleI18n?.en ?? artwork.title;
}
```

→ `artwork.titleI18n = { en: "" }` 이고 `locale = "en"` 인 경우 **`""` 빈 문자열 반환** (디스플레이 공란).
`??` 은 nullish (null/undefined) 만 fallback 진입 — 빈 문자열은 통과.

### §6.3 대안 거동 (미채택, 의미 결정 보류)
```ts
export function getTitle(artwork: Artwork, locale: DocumentLocale): string {
  const direct = artwork.titleI18n?.[locale];
  if (direct) return direct;
  const en = artwork.titleI18n?.en;
  if (en) return en;
  return artwork.title;
}
```

→ truthy 체크, 빈 문자열도 falsy 처리 → 다음 fallback 진입.

### §6.4 의미 분기점
- 운영자가 `titleI18n.en = ""` 명시 입력한 경우:
  - **현 거동 (nullish)**: "공란 표시 의도" 로 해석 (예: 작품 영문 제목 부재 명시)
  - **대안 (truthy)**: "다음 fallback 진입 의도" 로 해석 (예: 빈 값 = 실수 입력)
- spec 미명시 — 사용자 결정 보류 (STEP 131 또는 STEP 134 진입 시점 재검토).

### §6.5 재검토 시점
- **STEP 131 (Closed Passport Card + List View)** — 영문 표기 운영 시작. Passport List 에서 영문 작가명 / 제목 표시 시 빈 문자열 처리 필요성 발생 가능.
- **STEP 134 (AI Cultural Intelligence)** — 영문 노출 본격화. AI 가 영문 콘텐츠 생성 시 사용자가 영문을 *명시적 비활성* 처리하는 케이스 등장 가능.

### §6.6 전환 결정 시 영향 범위
- **현 시점 결정 시점에서 코드 변경 비용**: ~1줄 (`src/lib/i18n-helpers.ts` 의 `getTitle` 본문, 6줄로 확장)
- **테스트 갱신**: `i18n-helpers.scenarios.ts §4` 한 case 갱신
- **production behavior 회귀**: 가능 (이미 빈 문자열 입력한 운영자가 있다면 표시 변화) — 마이그레이션 도구 미필요 (빈 문자열 == 사용자가 명시 입력한 경우 극히 드묾)

본 결정은 **STEP 131 진입 시 §0 사실관계 사전 검증 로그 — STEP 130 deferred items 재검토** 항목으로 명시 진입.

---

## §7 다음 STEP 진입 준비

### §7.1 사용처 wire 0건 정착 — 의도된 상태

**현 시점 상태**:
- Sidebar header `<SidebarLocaleToggle />` 작동 — 클릭 시 `useArtworkStore.currentLocale` 실제 set 호출
- `getTitle` / `getArtistName` helper 호출처 **0건** — 정착만, 사용 안함
- ArtworkGrid / ArtworkDetailPanel / Drawers 모두 `artwork.title` / `artist.name` 그대로 직접 접근 — locale 무관

**사용자가 보게 될 현상**:
- ✅ Sidebar header 의 "KO EN JA ZH" 토글이 화면에 표시됨
- ✅ 다른 locale 클릭 시 active 표시 즉시 전환 (medium weight + border-ink/60)
- ❌ 화면의 작품 제목 / 작가명 표시는 **변화 없음** — 항상 한국어 baseline 그대로

→ **정상 동작**. STEP 130 = *infrastructure 정착*. UI 표시 효과는 STEP 131+ 사용처 wire 시점부터 발생.

### §7.2 STEP 131+ 점진적 적용 방침

**적용 순서 권고**:
1. **STEP 131 — ArtworkGrid + Sidebar 표시 layer**
   - Sidebar `approvals` 카드의 `titleOf(artworkId)` (line 287-288) → `getTitle(art, currentLocale)` 전환
   - ArtworkGrid 카드 제목 + 작가명 표시 — locale-aware
   - STEP 131 의 Closed Passport Card + List View 자체에 `getTitle` / `getArtistName` 첫 wire
2. **STEP 132~133 — DetailPanel + Drawer 표시 layer**
   - ArtworkDetailPanel 제목 / 작가명 — locale-aware
   - 모든 Drawer 의 artwork 제목 referencing 위치 — locale-aware
3. **STEP 134 — AI Cultural Intelligence + Print/PDF**
   - PrintView (Invoice / Contract / Passport) — locale-aware
   - Passport PDF 의 다국어 표시 운영
   - Deferred Item D-130-1 재검토 시점

**Risk**: 각 단계 🟢 Low — 호출처 1줄 치환 (`artwork.title` → `getTitle(artwork, currentLocale)`).

### §7.3 사용자 행동 가이드 (STEP 131+ 진입 전)

- 본 시점에서 Sidebar locale toggle 클릭은 store state 만 변경. 화면 표시 변화 없음 = 정상.
- 작품 마스터 record 에 `titleI18n` / `nameI18n` 데이터 미입력 — STEP 131+ wire 시점에 ArtworkFormDrawer 다국어 입력 UI 신설 가능 (별도 STEP).

---

## §8 책임감 있는 멈춤 패턴 7건째 영구 기록 — Cross-worktree State 발견

**발생 시점**: STEP 130 Phase 2 Commit 1 진입 시점 (2026-05-13)

### §8.1 패턴 발견
- 작업 시작 위치: `trusting-ptolemy-b61055` worktree (사용자 인수인계 spec 의 baseline `f9b8b5f` 미반영)
- baseline `f9b8b5f` 검증 시 `STEP_130_PHASE_1_ARCHITECTURE_REVIEW.md` (483 줄) 의 unexpected deletion 발생
- 3단계 진단 (`git branch --contains f9b8b5f` / `git worktree list` / `git merge-base`) 으로 **두 worktree 동시 존재** 확인:
  - `condescending-lamarr-f5022a` — `claude/step127-architecture-review` branch, baseline 정합 worktree
  - `trusting-ptolemy-b61055` — `claude/trusting-ptolemy-b61055` branch, 사용자 spec 미반영 worktree

### §8.2 추가 발견 — 동일 commit 이미 정착
- `condescending-lamarr-f5022a` 의 HEAD 가 `01a1540` ("STEP 130 Phase 2 — Commit 1: Foundation (titleI18n? + nameI18n? + helpers)") 였음
- 본 작업 의도 commit 의 **제목과 변경 영역이 완전 일치** — 이미 정착된 상태

### §8.3 3단계 비교 진단
- `git show --stat 01a1540` — 변경 영역 일치 확인
- `git show 01a1540 -- src/types/artwork.ts` — schema 100% 동일
- `git show 01a1540 -- src/lib/i18n-helpers.ts` — helper signature 100% 동일, minor 구현 차이 (nullish `??` vs truthy `if`) — 의미 무영향 수준

→ **Case A (의미 동등) 확정**. 본 worktree 작업 폐기 + `01a1540` 정본 채택.

### §8.4 재발 방지 정책 — 새 채팅 진입 시 표준 검증 절차

```bash
# 1. 인수인계 spec 의 worktree 경로 명시 시
pwd  # 현재 worktree 확인

# 2. git worktree 전체 list 확인 (다른 worktree 존재 여부)
git worktree list

# 3. spec 의 baseline commit hash 가 현재 HEAD 의 ancestor 인지 확인
git merge-base --is-ancestor <baseline> HEAD && echo "OK" || echo "DIVERGED"

# 4. baseline 이 다른 branch 에 있는 경우 → 즉시 사용자 확인 요청 (책임감 있는 멈춤)
```

**핵심 학습**: 사용자 인수인계 spec 의 worktree 경로 = `git worktree list` 결과 검증 표준. 인수인계 시점의 worktree 가 *유일한 작업 worktree* 라는 가정은 위험.

### §8.5 누적 책임감 있는 멈춤 패턴 — 7건째

1. STEP 127 — invoiceKind deferred items (a)(b) 발견
2. STEP 128 — fiscal-summary path deviation 발견
3. STEP 129 Commit 1 — defense in depth 4 layer 정상화 정정 사이클
4. STEP 129 Commit 3 — ContractDraftDrawer 신설 가정 vs DraftContractForm 정착 발견 → Commit 3 skip
5. STEP 130 Phase 1 — STEP 96 정착물 `DocumentLocale` 발견 → 신설 `Locale` type 폐기
6. STEP 130 Phase 1 — 옵션 c1 vs c2 결정 보류 → 사용자 결정 대기
7. **STEP 130 Phase 2 — Cross-worktree state 발견 → 정본 채택 + 본 worktree 작업 폐기 (본 건)**

---

## §9 STEP 130 Phase 1.0 §7+§8+§9 표준 검증 결과

STEP 129 Phase 2 §12.4 에서 정착된 **Phase 1.0 검증 3 표준** 의 STEP 130 적용 결과.

### §9.1 §7 — 이전 STEP deferred items 재검토

| STEP | deferred items | STEP 130 진입 시 결과 |
|------|---------------|--------------------|
| STEP 127 | (a) `canRegisterPaymentFor` 누락 / (b) registerPayment guard 누락 | STEP 129 Commit 1 에서 모두 정착 — STEP 130 진입 시 0건 잔존 ✅ |
| STEP 128 | path deviation (`documents-aggregates.ts` 실제 위치) | STEP 129 Commit 1 진입 시점 정정 흡수 — 0건 잔존 ✅ |
| STEP 129 | Commit 3 skip (ContractDraftDrawer 신설 폐기) | 의도된 skip, 잔존 의무 0건 ✅ |

**STEP 130 진입 시점 deferred items 0건**. Phase 1.1 진입 안전.

### §9.2 §8 — 신설 가정 컴포넌트가 기존 정착물과 기능 중복 검증

| 신설 가정 (Phase 1 review §) | 기존 정착물 검증 | 결과 |
|----------------------------|--------------|------|
| `src/types/locale.ts` 신설 (Phase 1 §2 첫 가정) | STEP 96 `src/lib/document-locale.ts:37` `DocumentLocale = AILocale` 발견 | **신설 폐기** (~10 LOC 절약 + drift 위험 0 + bundle Δ 0 kB) |
| `Artist.nameEn?` deprecation | 6 files 정착물 (useArtworkStore / ArtworkFormDrawer / types/artwork / mock-data / DetailPanel / ArtworkGrid) | **옵션 c1 병행 호환 채택** (변경 0줄 보장) |
| Zustand `persist` middleware 도입 | 본 프로젝트 미사용 — `PersistedState` interface + 외부 `PersistenceProvider` 패턴 정착 | **partialize 수정 무관** (P1 자동 만족) |

**중복 검증 3건 모두 정착물 재활용 결정** — 누적 ~50 LOC 절약 + drift 위험 0 + bundle Δ 0 kB.

### §9.3 §9 — 검증 게이트 path-specific 사용 (broad pattern false positive 회피)

STEP 129 §12.3 표준 답습. 모든 5 commits 에서 path-specific grep 만 사용:
- `git grep -l "TranslationLocaleSelector\|DocumentLocale" src/lib/` ← `src/` 한정
- `git grep -n "invoiceKind\|getInvoiceKind\|canRegisterPaymentFor" src/` ← STEP 127/129 정착물 검증
- `grep -nE "SCHEMA_VERSION = \"" src/lib/persistence.ts` ← 단일 파일 한정

**false positive 0건** — `node_modules/` / `.next/` / `dist/` 등 빌드 결과물 잡음 0.

**5 commits 모두 §7+§8+§9 표준 정합** ✅.

---

## §10 STEP 131 진입 권고

### §10.1 다음 STEP 권고 — STEP 131 (Closed Passport Card + List View)

STEP 128 §7 revised roadmap (STEP 131 ~ 136) 의 첫 단계. STEP 130 정착물 (`getTitle` / `getArtistName` / `currentLocale`) 의 **첫 호출처 wire** 자연 진입점.

### §10.2 STEP 131 작업 범위 예고

1. **Closed Passport Card 컴포넌트 신설** (운영 surface)
2. **Passport List View 컴포넌트 신설** (filterable list, CLOSED state 작품 전용)
3. **첫 호출처 wire — `getTitle` / `getArtistName`**:
   - ArtworkGrid card title — locale-aware
   - Passport List 작가명 / 제목 표시 — locale-aware
   - Sidebar approvals 카드 (`titleOf(artworkId)`) — locale-aware
4. **AXVELA Passport 디자인 자산 활용 시점**:
   - `docs/design/passport/PASSPORT-1.png ~ PASSPORT-5.png` (untracked 상태로 보존됨, STEP 131 진입 시 git add)
5. **Deferred Item D-130-1 첫 재검토 시점** — 빈 문자열 운영 시작 검증

### §10.3 STEP 131 Risk 평가 (사전 예상)

🟢 **Medium-Low** (사용처 wire 첫 commit, but additive — 기존 호출자 1줄 치환 패턴, 회귀 위험 낮음). Phase 1 review 시 정확 평가 가능.

### §10.4 Phase 1.0 검증 시점 준비
- §7 — STEP 130 deferred items 재검토: D-130-1 (빈 문자열 fallback) — STEP 131 / 134 재검토 시점 명시
- §8 — Closed Passport Card 신설 가정 vs 기존 ArtworkGrid card 정착물 비교 — Phase 1 review 영역
- §9 — path-specific grep 검증 standard 그대로 답습

### §10.5 다음 단계 trigger
- 사용자 명시 신호: "STEP 131 Phase 1 진입" 또는 별도 우선순위 STEP 지시
- 그 외 별도 작업 (예: D-130-1 별도 hotfix / `tsx` devDep 등록 / STEP 137 등) 우선 진입 가능

---

## 부록 — STEP 130 Phase 2 ZIP 패키지 안내

사용자 워크플로 메모 (ZIP 다운로드 → 로컬 npm install/dev 흐름) 정합 시 ZIP 패키지 생성 가능:

```bash
# 권고 패키지 명
AXVELA_STEP_130_PHASE_2_COMPLETE_<commit hash>.zip

# 생성 위치 (예시)
docs/releases/AXVELA_STEP_130_PHASE_2_COMPLETE_<hash>.zip
```

ZIP 생성은 **사용자 별도 지시 대기** — Commit 4 자체 작업 (본 문서 + cross-reference) 과 독립.

`.gitattributes` 정책 (STEP 129 Commit 4 정착) 의 `*.zip export-ignore + binary` 가 향후 ZIP recursive bloat 자동 차단.

---

**STEP 130 Phase 2 Internationalization Layer — COMPLETE ✅**

Risk 🟢 Low 종결. 5 commits / 20 gates PASS / 회귀 0건 / 보존 약속 70 cells ☑ / 사용자 §9 결정 5/5 정합.
