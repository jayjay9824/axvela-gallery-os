# STEP 131.5 — Phase 1 Architecture Review (Multi-Surface: Mobile + Passport Redesign)

**작성 시점**: 2026-05-13
**Baseline**: `dddebfa` (STEP 131 Phase 2 Closure HEAD — Closed Passport Card + List View 정착)
**Branch**: `claude/step127-architecture-review` (STEP 127~131 연속 commit 흐름)
**Worktree**: `condescending-lamarr-f5022a` (canonical)
**작업 성격**: doc-only Phase 1 review — 코드 0줄. Phase 2 implementation 은 별도 진입.
**리스크 평가**: 🟡 **Medium-Low** (Phase 1 자체 Low, 매니페스토 rule_14 보강 영역 Medium)
**STEP 위치**: STEP 131 (Closed Passport) ↔ STEP 132 (Server-side PDF) **사이 보강 STEP**

---

## §1 개요

### §1.1 STEP 131.5 목표 — Multi-Surface Architecture 정착

STEP 128 §7 revised roadmap 의 정식 STEP 사이에 진입하는 **보강 STEP**. 본 STEP 의 핵심 목표:

1. **AXVELA OS 정체성 재정의**: 단순 "Desktop Gallery OS" → **"Multi-Surface Cultural Asset OS"** 로의 영구 정착
2. **모바일 환경 깨짐 진단 + 정착 spec 도출** — 사용자 콜로라도 모바일 환경 확인 (2026-05-13) 으로 발견된 4건의 모바일 UX 깨짐
3. **매니페스토 rule_14 보강** — 현 rule_14 (3 Column 구조) 의 Desktop 가정 한계 → Desktop Layout Contract + Responsive Surface Layer 의 dimension 분리
4. **Passport 모바일 재설계 spec** — ChatGPT 외부 시각 통합 (Apple Wallet / unfold / swipe 메타포 정합) — Passport surface 는 모바일에서 *오히려 더 강력*

### §1.2 STEP 128 §7 revised roadmap 의 보강 위치

```
STEP 129 — Invoice/Contract Write Flow + Defense in Depth ✅ (5 commits)
STEP 130 — Internationalization Layer ✅ (5 commits + 1 hotfix)
STEP 131 — Closed Passport Card + List View ✅ (4 commits + Vision Record)
STEP 131.5 — Multi-Surface Architecture (Mobile + Passport Redesign) ← 본 STEP (보강)
STEP 132 — Server-side PDF
STEP 133 — Expanded Passport + In-Passport Navigation
STEP 134 — AI Cultural Intelligence
STEP 135 — Timeline + Provenance + Cross-link
STEP 136 — Ownership Certificate
```

본 STEP 131.5 가 정식 STEP 132 진입 전에 정착해야 하는 근거:
- STEP 132 (PDF) 의 미리보기 UI 가 데스크탑 / 모바일 정합 필요 (§9 PDF dimension 관계 참조)
- STEP 133 (Expanded Passport + In-Passport Navigation) 은 모바일 native 메타포 (unfold / swipe) 정합 시 **모바일에서 더 자연** — Multi-Surface 정착 선행 필수
- 매니페스토 rule_14 보강이 정식 STEP 132~138 spec 결정 기반

### §1.3 발견 시점 영구 기록

**발견 시점**: 2026-05-13 (사용자 콜로라도 모바일 환경 확인 + ChatGPT 외부 시각 통합)

**통합 발견 — 3-주체 합류**:
- **사용자 발견**: 콜로라도 출장 중 모바일 접속 시 Gallery OS UX 깨짐 (Sidebar 폭 강제 / ArtworkGrid 1열 카드 layout 깨짐 / Filter chip 세로 늘어남 / OWNER 라벨 중복 / 카드 텍스트 줄바꿈 부적절)
- **ChatGPT 외부 시각 (사용자 공유)**: "모바일은 축소 데스크탑이 아니다" — creative redesign 필요. PASSPORT 가 모바일에서 *더 강력* (Apple Wallet 메타포). 운영자 / 컬렉터 분리 (Gallery OS / Passport Surface). 도메인 분리 가능성 (gallery / passport / verify)
- **Claude 통합 분석**: 매니페스토 정합 절차로 수렴 — Phase 1 → Phase 2 답습, §7+§8+§9 표준 적용, dimension 분리 강제 (운영자 mode vs 컬렉터 mode)

본 STEP 131.5 = 이 3-주체 통합 발견의 **영구 정착 STEP** — 이후 STEP 132~138 spec 결정 기반 강화 + AXVELA OS 정체성 재정의 완료.

---

## §2 현 상태 진단 (사용자 스크린샷 기반)

### §2.1 모바일 환경 깨짐 4 영역

사용자 콜로라도 모바일 스크린샷 기반 진단:

| # | 깨짐 영역 | 증상 | 코드 위치 (확인됨) |
|---|----------|------|-----------------|
| 1 | **Sidebar 모바일 폭 강제** | 240px Sidebar 가 모바일 화면 폭 침해 → main 영역 squeeze | `src/components/layout/Sidebar.tsx:379` — `w-[240px] shrink-0` (반응형 미적용) |
| 2 | **햄버거 메뉴 부재** | 모바일에서 Sidebar 숨김/노출 mechanism 0 | Sidebar.tsx — `md:` / `lg:` 분기 0 |
| 3 | **ArtworkGrid 1열 강제 + 카드 layout 깨짐** | 1열 카드에 정보 밀도 폭주 ("8.2 / 억 / KRW / 콜 / 리 / 소 / 장" 형태로 줄바꿈) | `src/components/layout/ArtworkGrid.tsx:96` — `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4` (col 반응형은 적용, **카드 내부 layout 모바일 폭 비최적화**) |
| 4 | **Filter chip 세로 늘어남 / OWNER 라벨 중복 / 카드 텍스트 줄바꿈 ("묘법 No..." 잘림)** | 단일 row 가정 layout 이 모바일 폭에서 wrap 폭주 | ArtworkCard.tsx + PassportCard.tsx 내부 flex/grid (사용자 §N 결정 후 정밀 grep) |

### §2.2 원인 분석

**근본 원인** — 매니페스토 rule_14 (3 Column) 의 *Desktop 가정 한계*:

현 rule_14 본문:
```
3 Column 구조 유지: Sidebar / Artwork Grid / Detail Panel
```

→ Sidebar 폭 (240px) / Grid 영역 / DetailPanel 폭 모두 *Desktop viewport (≥1024px) 전제*. 모바일 viewport (≤768px) 에서의 dimension spec 부재.

**파생 원인**:
- Tailwind 반응형 클래스 (md: / lg: / sm:) 미적용 또는 카드 내부 layout 비최적화
- Sidebar 모바일 숨김 / 햄버거 메뉴 UI 미존재 (rule_15 ≤3 button 한계 정합 검토 필요)
- ArtworkCard / PassportCard 내부 layout 이 단일 viewport (Desktop) 가정 — 모바일 폭 wrap 폭주

### §2.3 §3 데이터 / §4 위치 / §5 locale 의 모바일 정합 사전 검증

기존 STEP 131 Phase 1 §3 / §4 / §5 정착물의 모바일 정합:
- **데이터 진입점**: `useArtworkStore` 구독 — 모바일 정합 100% (Zustand store 는 viewport 독립)
- **UI 위치 (ArtworkGrid 영역)**: 모바일에서 영역 자체는 정합, 단 *내부 layout* 모바일 비최적화
- **Locale 통합** (`getTitle` / `getArtistName` / `currentLocale`): 모바일 정합 100% (helper 는 viewport 독립)

→ 정착물 *데이터 / 로직 layer* 무손상. 모바일 깨짐은 **presentation layer (CSS / flex / responsive class) 한정**.

---

## §3 통합 시각 — Claude + ChatGPT 합류 영구 기록

### §3.1 ChatGPT 외부 시각 핵심 통찰 (흡수)

사용자 공유 ChatGPT 분석 4 항목 — 본 STEP 영구 흡수:

1. **"모바일은 축소 데스크탑이 아니다"** — naive responsive (Desktop layout 의 modal shrinking) 대신 **creative redesign**. 모바일 native 메타포 (Apple Wallet card stack / Notion sidebar drawer / swipe-to-close) 우선.
2. **PASSPORT 가 모바일에서 *더 강력***. 이유:
   - Closed Passport Card 의 세로 비율 = 모바일 viewport 세로 비율과 자연 정합
   - 가죽 cover + emblem 시각이 모바일 카드 (Apple Wallet pass / Korean ticket 메타포) 와 정합
   - 9-row Index 가 모바일 세로 스크롤과 자연 정합
   - In-Passport Navigation (rule_17 정합) 이 모바일 swipe-between-screens 메타포와 자연
3. **운영자 모드 / 컬렉터 모드 분리** — Gallery OS (운영자) 와 Passport Surface (컬렉터/기관) 는 본질적으로 다른 사용 시나리오:
   - 운영자: 다중 작품 동시 관리 (grid density / multi-panel / queue) → **Desktop 중심**
   - 컬렉터/기관: 단일 작품 깊이 열람 (provenance / AI insight / certificate) → **Mobile 중심**
4. **도메인 분리 가능성**:
   - `gallery.axvela.com` → 운영자 OS (Desktop 중심, 로그인 필수)
   - `passport.axvela.com` → 컬렉터/기관 surface (Mobile 중심, 권한 별)
   - `verify.axvela.com` → public verification (QR 진입점)

### §3.2 Claude 통합 분석 (유지 + 보강)

ChatGPT 외부 시각의 정착 절차 — 매니페스토 정합:

1. **매니페스토 정합한 정착 절차** — ChatGPT 의 통찰을 매니페스토 rule_14 보강 spec 으로 정착 (즉시 코드 변경 회피, doc-only Phase 1 진입)
2. **Phase 1 / Phase 2 분리 답습** — STEP 127~131 정착 패턴 (사용자 §N 결정 → Phase 2 진입)
3. **STEP 132 (PDF) 와의 dimension 관계 명시** — PDF 영역은 dimension 독립 (서버 생성), 그러나 미리보기 UI 정합 영역 — §9 결정
4. **정합 진행 (긴급 수정 회피)** — ChatGPT 가 제안한 "긴급 수정 1단계" 회피, Phase 1 → Phase 2 답습 → 사용자 §N 결정 영역 (§11 항목 b)

### §3.3 통합 결과 — Multi-Surface Architecture

ChatGPT 외부 시각 + Claude 매니페스토 정합의 합류:

- AXVELA OS = **Multi-Surface Cultural Asset OS** (단순 Desktop Gallery OS 가 아님)
- 3 Surface 의 *의도적 dimension 분리*:
  - Gallery OS = Desktop 중심 운영자 surface
  - Passport Surface = Mobile-first 컬렉터/기관 surface
  - Certificate Surface = Mobile + Verify (QR 진입점)
- **같은 데이터 (rule_1 SSOT `artwork.id`), 다른 UX surface** — dimension 통합 절대 금지

---

## §4 Multi-Surface Architecture 정착

### §4.1 3-Surface 정의 (인수인계 메모 정합 강화)

STEP 131 Phase 1 §1.2 의 3-Surface 정의를 *Multi-Surface* 관점으로 보강:

| Surface | 책임 영역 | Primary viewport | 사용자 mode | STEP 위치 |
|---------|----------|----------------|------------|----------|
| **Gallery OS** | Sidebar + Grid + DetailPanel + 29 Drawers | **Desktop ≥1024px** | 운영자 (갤러리/기관 관리자) | Phase 1~4 정착 (STEP 1~131) |
| **Passport Surface** | Closed Passport + Expanded Passport + In-Passport Navigation + Timeline + AI Cultural Intelligence | **Mobile ≤768px** + Desktop fallback | 컬렉터 / 기관 / 외부 열람자 | STEP 131~135, **STEP 131.5 보강** |
| **Certificate Surface** | Ownership Certificate + QR encrypted + Resale provenance | **Mobile + Verify endpoint** | 컬렉터 + Public verifier | STEP 136 |

핵심 변화 (STEP 131 Phase 1 §1.2 대비):
- *Primary viewport* 명시 신설 (Surface 별 dimension 분리)
- *사용자 mode* 명시 (운영자 / 컬렉터 / 외부 verifier)
- Gallery OS = **Desktop 명시** (모바일 fallback 결정 영역, §11 항목 h)
- Passport Surface = **Mobile-first 명시** (Desktop fallback 영역)

### §4.2 도메인 분리 (미래 정책)

ChatGPT 제안 — 미래 정책 후보:

| 도메인 | 책임 surface | 진입 |
|--------|------------|------|
| `gallery.axvela.com` | Gallery OS | 운영자 로그인 |
| `passport.axvela.com` | Passport Surface | 권한 별 (소유자 / 위탁자 / 기관) |
| `verify.axvela.com` | Certificate Surface | Public (QR 진입) |

**본 STEP 131.5 정착 영역**:
- 도메인 분리 **사전 단계** — 같은 도메인 (`localhost` / Vercel production URL) 내 **반응형 dimension 분리**
- 도메인 분리 시점 = STEP 136 (Certificate STEP) 또는 별도 STEP (§11 항목 d 사용자 결정 영역)

→ STEP 131.5 = **반응형 dimension 분리** + **도메인 분리 사전 spec 정착**.

---

## §5 매니페스토 보강 spec — rule_14 갱신 제안

### §5.1 기존 rule_14 본문 (보존 영역)

```
3 Column 구조 유지: Sidebar / Artwork Grid / Detail Panel
```

→ Desktop 가정 명시 부재, 모바일 spec 부재.

### §5.2 보강 후 rule_14 spec (제안)

```
rule_14 (보강 제안):

Desktop Layout Contract (canonical operational, viewport ≥1024px):
  Sidebar (240px) / Artwork Grid / Detail Panel
  → 운영자 surface 의 3 Column 구조 유지 (정착물 무손상)

Responsive Surface Layer (mobile presentation, viewport ≤768px):
  Top Nav (햄버거 + 로고 + locale toggle) / Passport Stack (단일 column) / Full-screen Passport Open / In-passport navigation
  → Mobile-first Passport Surface

Tablet (769~1023px):
  Hybrid layout — Sidebar collapse-drawer + 2-col Passport Stack (사용자 §N 결정 영역, §11 항목 h)

Dimension 통합 절대 금지:
  Desktop Sidebar 폭 240px 와 Mobile Top Nav 는 별도 컴포넌트 영역 (반응형 hide/show 가 아닌 별도 dimension)
  같은 데이터 (rule_1 SSOT) / 다른 UX surface
```

### §5.3 영구 정책 추가 후보 (정책 15)

매니페스토 6 영구 정책 (현 14건) 에 정책 15 추가 후보:

```
정책 15 (제안): Desktop ↔ Mobile dimension 절대 통합 금지

Surface 별 dimension 은 별도 컴포넌트 영역 정합 — naive responsive (display:none/block) 회피.
같은 데이터 (rule_1 SSOT artwork.id) 보존, presentation layer 만 surface 별 분리.
```

→ **사용자 §N 결정 영역** (§11 항목 a) — 영구 정책 추가는 매우 신중한 결정 영역, 인용 허용 / 본문 수정 절대 금지 정책 정합.

### §5.4 매니페스토 변경 절차 — 사용자 명시 승인 필수

- AXVELA_OS_Manifesto.xml — rule 본문 변경 절대 금지 (해석 보강만 허용)
- AXVELA_*.md 6 파일 (`AXVELA_AI_DIRECTION.md` / `AXVELA_AI_INTEGRATION.md` / `AXVELA_DEV_CONVENTION.md` / `AXVELA_FISCAL_ARCHITECTURE.md` / `AXVELA_TRUST_LAYER.md` / `AXVELA_WORKFLOW_ARCHITECTURE.md`) — 본문 수정 절대 금지
- rule_14 보강 / 정책 15 추가 = **사용자 명시 승인 후만** Phase 2 commit 영역 진입

본 Phase 1 산출물에 spec 명시, Phase 2 진입 전 사용자 승인 필수.

---

## §6 영향 컴포넌트 분석

### §6.1 신설 가정 컴포넌트 list (§8 표준 사전 적용)

| 가정 컴포넌트 | 역할 | 가정 LOC |
|--------------|------|---------|
| **MobileTopNav.tsx** | 햄버거 + 로고 + locale toggle (Sidebar 대체, viewport ≤768px) | ~120 LOC |
| **MobilePassportStack.tsx** | Passport 카드 stack 표시 (Apple Wallet 메타포) | ~150 LOC |
| **ResponsiveLayoutWrapper.tsx** | viewport 감지 + Desktop/Mobile dimension 분기 | ~80 LOC |
| **PassportUnfoldView.tsx** | Mobile-native full-screen Passport open (swipe gesture) | ~150 LOC |

총 가정 신설: ~500 LOC

### §6.2 기존 정착물 (보존 영역)

| 영역 | 보존 약속 |
|------|---------|
| `src/components/layout/Sidebar.tsx` (240px 강제) | **Desktop 그대로 보존**, viewport ≤768px 에서 hide (반응형 분기 1줄 추가) |
| `src/components/layout/ArtworkGrid.tsx` | **Desktop 그대로 보존**, viewport ≤768px 에서 MobilePassportStack 분기 (분기 1줄 추가) |
| `src/components/artwork/PassportCard.tsx` (STEP 131 Commit 1 정착) | **Desktop closed view 그대로 보존**, mobile open view 는 PassportUnfoldView 신설 영역 |
| `src/components/artwork/ArtworkCard.tsx` (STEP ~ 정착) | **Desktop 그대로 보존**, mobile 영역 외 (PassportCard 우선) |
| `src/components/layout/SidebarLocaleToggle.tsx` (STEP 130 정착) | **Desktop 그대로 보존**, MobileTopNav 내부 변형 (별도 wrapper) |
| `src/components/artwork/ViewModeToggle.tsx` (STEP 131 Commit 1 정착) | **Desktop 그대로 보존**, mobile 에서 hide (모바일은 Passport-only) |

### §6.3 영향 LOC 추정

| 영역 | LOC |
|------|-----|
| 신설 코드 (Mobile 컴포넌트 4개) | ~300~500 (사용자 §N 결정 후 정밀) |
| 기존 수정 (반응형 분기) | ~50 (Sidebar / ArtworkGrid / Layout root 1줄씩) |
| 신규 doc (Phase 2 COMPLETE) | ~400 |
| 매니페스토 보강 (rule_14 + 정책 15 시) | ~30~50 (xml + AXVELA_DEV_CONVENTION.md cross-ref, 사용자 승인 후) |
| **총** | ~780~1000 |

**Bundle 영향 사전 평가**:
- Mobile 컴포넌트 (~300~500 LOC) — 호출처 1건 (ResponsiveLayoutWrapper) → +3~5 kB 예상
- 신규 dependency (framer-motion 등 gesture 라이브러리, 사용자 §N 결정 §11 항목 g) — 채택 시 +30~50 kB 추가
- 누적 bundle Δ: **+3~55 kB** (dependency 결정 후 정밀 평가)

---

## §7 모바일 Passport 재설계 — ChatGPT 통찰 반영

### §7.1 Passport 모바일 native UX spec

ChatGPT 통찰 정착:

| 단계 | 모바일 UX |
|------|----------|
| **Closed Passport** | mobile card stack — Apple Wallet 메타포. 세로 비율 자연 (mobile viewport 와 정합) |
| **Tap → Full-screen unfold** | hinge animation (Passport spec §4 정합) — drawer/modal 회피, Passport 자체가 펼쳐짐 |
| **In-passport navigation** | 9-row Index + swipe-between-rows (rule_17 정합 + In-Passport Navigation 정착) |
| **Swipe down to close** | mobile native gesture — close = Passport 닫힘 (Wallet 패턴) |

### §7.2 PASSPORT-1.png 디자인 자산 모바일 정합 검토

PASSPORT-1 spec (15 §) 의 모바일 정합도:

| § | spec | 모바일 정합도 |
|---|------|-------------|
| §1 | leather cover (institutional object) | ✅ 모바일 card 면 정합 (Apple Wallet 자연) |
| §2 | LEFT SPINE (AXID 세로) + FRONT COVER | ✅ 모바일 세로 비율 자연 정합 |
| §3 | "물리적 보관소" 느낌 | ✅ 모바일 card stack 자연 정합 (slightly stacked spacing) |
| §4 | drawer/modal 금지, Passport 자체가 펼쳐짐 | ✅ 모바일 unfold animation 정합 (hinge motion) |
| §5 | LEFT spine 고정 + RIGHT paper | 🟡 모바일은 stacked vertical 정합 (LEFT/RIGHT 가로 분할 → 모바일은 세로 stack) |
| §6 | 9-row Index | ✅ 모바일 세로 스크롤 자연 정합 |
| §7 | In-Passport Navigation (외부 modal 절대 금지) | ✅ 모바일 swipe-between-screens 자연 정합 |
| §8~11 | AI / Condition / Timeline | ✅ 모바일 full-screen 진입 자연 정합 |
| §14 | minimal / premium / institutional / calm / archival | ✅ 모바일 자연 정합 (Apple Wallet 톤) |

→ PASSPORT-1 spec 은 **모바일에서 오히려 더 자연** — ChatGPT 통찰 확증.

### §7.3 D-AXVELA-VISION-3 (QR 본질 재정의) 모바일 정합

D-AXVELA-VISION-3 (사용자 비전 영구 기록):
- QR = 전시/아트페어/갤러리 = 큐레이션 정보 진입점 (주)
- QR = 진위 검증 (부)

**모바일 정합**:
- 전시/아트페어 현장에서 *모바일로 QR 스캔* → Passport Mobile 진입 → 작품 정보 + 큐레이션 + AI Insight 자연 흐름
- Verify endpoint (`verify.axvela.com`, 미래) 도 모바일 우선 (현장 스캔 시나리오)

→ STEP 131.5 Multi-Surface 정착 = **D-AXVELA-VISION-3 의 모바일 native 진입점 spec 정착**.

### §7.4 디자인 단순화 (PASSPORT-1 정보 밀도) 모바일 흡수 가능성

STEP 131 Phase 1 §2.3 인수인계 사용자 피드백: "PASSPORT-1 정보 밀도 높음" → 단순화 별도 STEP.

**모바일 unfold 시 자연 해소 가능성**:
- 모바일 full-screen unfold = 9-row Index 가 세로 스크롤 (정보 동시 노출 부담 감소)
- AI / Condition / Timeline 각 화면이 swipe-between (단일 screen = 단일 정보 영역)
- → "정보 밀도" 부담은 *Desktop multi-panel 동시 노출* 의 부담, 모바일 swipe navigation 에서는 자연 해소

→ 디자인 단순화 결정 영역의 **모바일 정합 검토** = STEP 131.5 영역 자연 흡수 가능성 (§11 항목 c 사용자 결정 영역).

---

## §8 §7 + §8 + §9 표준 적용

STEP 129 Phase 2 §12.4 정착 + STEP 130/131/132 Phase 1.0 적용 답습.

### §8.1 §7 — 이전 STEP deferred items 재검토

| Item | STEP 131.5 진입 시 결과 |
|------|--------------------|
| **D-130-1** (titleI18n.en = "" fallback) | Mobile Passport 표시 시점 결정 가능? — Mobile 도 동일 정합 (helper 는 viewport 독립). STEP 134 또는 별도 STEP 까지 **결정 보류 유지** |
| **D-130-2** (UI locale KO/EN 제한) | Mobile 도 동일 정합 (Hotfix `631885d` 답습). 본 STEP 영역 외 |
| **D-AXVELA-VISION-1/2/3** | 모바일 영역에서 *더 강력* 작동 가능성 발견 — D-AXVELA-VISION-3 (QR 본질) 의 모바일 정합 sup (§7.3) 정착 |
| **디자인 단순화 보류** | Mobile unfold 시 자연 해소 가능성 (§7.4) — 단순화 결정 영역의 **모바일 정합 흡수** 결정 가능 (§11 항목 c) |
| **STEP 131 Phase 2 deferred 외** | 0건 — STEP 131 결정사항 모두 정착 (4 commits + Vision Record) |

→ STEP 131.5 진입 시점 미해결 의무 0건, 단 D-AXVELA-VISION-3 의 *모바일 정합 sup 추가* 가능성 (§11 항목 e Phase 2 commit 영역).

### §8.2 §8 — 신설 가정 컴포넌트 vs 기존 정착물 중복 검증

**중요 단계 — Phase 1.0 표준의 핵심 학습 (STEP 130 의 `DocumentLocale` 재활용 / STEP 131 의 PassportListView 신설 폐기 패턴 답습)**.

#### (a) MobileTopNav vs Sidebar

**기존 정착물**: `src/components/layout/Sidebar.tsx` (450 LOC 추정, 240px 폭 Desktop 운영자 navigation).

**중복 검증**:
- Sidebar 기능: workspace title + 작품 추가 button + filter + locale toggle + role switcher + 7 view tabs
- MobileTopNav 가정 기능: 햄버거 + 로고 + locale toggle (운영자 mode 진입 시 햄버거 → drawer 로 Sidebar 일부 영역 노출)
- **데이터 영역**: 100% 동일 (같은 store 구독)
- **시각 영역**: 별도 dimension (Desktop 240px sidebar vs Mobile top horizontal nav)

**결정**: **별도 컴포넌트 정합** — Surface 분리 본질 (§5.2 rule_14 보강 spec 정합), dimension 통합 절대 금지. 단 *데이터 / 핸들러 layer* 재활용 (store / locale state).

→ ~120 LOC 신설 정합.

#### (b) MobilePassportStack vs ArtworkGrid (viewMode 분기 패턴 답습 가능?)

**기존 정착물**: `src/components/layout/ArtworkGrid.tsx` (Commit 2 확장 정착) — viewMode `grid` vs `passport` 분기.

**중복 검증**:
- ArtworkGrid 의 viewMode 분기 패턴: `viewMode === "passport" ? <PassportCard /> : <ArtworkCard />` (Commit 2 정착, 1줄 분기)
- MobilePassportStack 가정: viewport ≤768px 시 PassportCard 단일 column + slightly stacked spacing

**결정 후보**:
- (A) **MobilePassportStack 신설** — Desktop ArtworkGrid 와 별도 컴포넌트, viewport 분기는 Layout root 영역
- (B) **ArtworkGrid 의 추가 분기** — viewMode + viewport 2-축 분기 (`viewMode === "passport" && viewport === "mobile" ? <MobilePassportStack /> : ...`)
- (C) **ArtworkGrid 자체 반응형 확장** — 별도 컴포넌트 0건, Tailwind 반응형 클래스만 추가 (~30 LOC)

**Trade-off**:
- (A): Surface 분리 명확, 단 ArtworkGrid 와 거의 동일 store 구독 영역 복제 (STEP 131 §6.2 PassportListView 신설 폐기 패턴 위반)
- (B): 2-축 분기 복잡도 (viewMode × viewport = 4 케이스)
- (C): ArtworkGrid 단일 진실 원천 유지 (~30 LOC 절약), 단 §5.2 rule_14 dimension 분리 정신 약화

→ **§11 항목 f 사용자 결정 영역** (Phase 2 commit 분할과 합류).

**Claude 잠정 추천**: **(C) ArtworkGrid 자체 반응형 확장** — STEP 131 §6.2 PassportListView 신설 폐기 패턴 답습, ~30 LOC 절약, dimension 분리는 *내부 분기* 로 정합. Mobile-native UX 영역 (unfold animation 등) 만 별도 컴포넌트 (PassportUnfoldView) 신설.

#### (c) PassportUnfoldView vs Drawer (rule_17 정합 검토)

**기존 정착물**: 29 Drawer 시스템 (rule_18 정합) — DetailPanel 우측 drawer 영역.

**중복 검증**:
- Drawer 패턴: 우측 slide-in, modal-like, ESC/backdrop 닫기
- PassportUnfoldView 가정: Mobile full-screen, hinge animation, swipe-down 닫기

**rule_17 정합 검증**:
- rule_17: 페이지 이동 금지, Drawer/Modal/Overlay 만
- PASSPORT spec §4: drawer/modal 금지, Passport 자체가 펼쳐짐
- PASSPORT spec §7: 외부 modal 절대 금지, In-Passport Navigation

→ **rule_17 ↔ PASSPORT spec §4/§7 의 표면적 충돌**:
- rule_17 = 페이지 이동 회피 → Drawer/Modal/Overlay **허용**
- PASSPORT spec = Drawer/Modal 회피 → Passport 자체가 펼쳐짐

**해석 통합** (STEP 131 Phase 1 §4.2 정착):
- rule_17 = *외부 modal 회피 본질* (페이지 이동의 더 약한 형태)
- PASSPORT spec = Passport surface 의 *In-Passport Navigation* 채택 (rule_17 보강)
- → PassportUnfoldView 는 *Passport surface 내부 unfold* — Drawer/Modal 영역 외 (Passport 자체가 surface)

**결정**: **신설 정합** — Mobile-native unfold animation 본질 (Drawer 패턴 답습 불가). 단 *데이터 / 닫기 핸들러* 재활용 (selectedArtworkId state 영역).

→ ~150 LOC 신설 정합.

#### (d) ResponsiveLayoutWrapper vs 기존 layout root

**기존 정착물**: `src/app/layout.tsx` (또는 page root) — Desktop 단일 layout.

**중복 검증**:
- ResponsiveLayoutWrapper 가정: viewport 감지 (CSS media query 또는 useEffect resize listener) + Desktop/Mobile dimension 분기
- 기존 layout root: 단일 dimension (Desktop)

**결정 후보**:
- (A) **ResponsiveLayoutWrapper.tsx 신설** (~80 LOC) — viewport 감지 컴포넌트
- (B) **CSS 단독 분기** (Tailwind `md:` `lg:` 클래스만) — JS 0줄, 컴포넌트 신설 0건
- (C) **next/headers 의 user-agent sniffing** (Server Component) — initial render 정확도 ↑

**Trade-off**:
- (A): viewport 감지 정확, 단 컴포넌트 1건 추가 + SSR hydration mismatch 위험
- (B): CSS-only, hydration 안전, 단 viewport 감지 JS layer 부재 (gesture / animation 영역 결정 어려움)
- (C): SSR 정확, 단 user-agent sniffing 비추 (Next.js 권고 회피)

**Claude 잠정 추천**: **(B) CSS 단독 분기** — 가장 minimal, hydration 안전. Gesture / animation 영역은 PassportUnfoldView 내부에서 `window.matchMedia` (client-side) 또는 framer-motion (사용자 §N 결정) 활용.

→ **ResponsiveLayoutWrapper 신설 폐기** 가능성 (~80 LOC 절약). §11 항목 f 사용자 결정 영역.

#### §8.2.5 §8 검증 결과 요약

| 가정 컴포넌트 | 검증 결과 | 결정 |
|--------------|---------|------|
| MobileTopNav.tsx | Surface 분리 본질, 데이터 layer 재활용 | ✅ 신설 (~120 LOC) |
| MobilePassportStack.tsx | ArtworkGrid 자체 확장으로 흡수 가능 | 🟡 **(C) 반응형 확장 권고** (~30 LOC 절약, 사용자 §N 결정) |
| ResponsiveLayoutWrapper.tsx | CSS 단독 분기로 흡수 가능 | 🔴 **신설 폐기 권고** (~80 LOC 절약, 사용자 §N 결정) |
| PassportUnfoldView.tsx | Mobile-native unfold 본질 | ✅ 신설 (~150 LOC) |

**잠정 누적 절약**: ~110 LOC (MobilePassportStack 흡수 + ResponsiveLayoutWrapper 폐기 시).

→ STEP 130/131 §8 패턴 답습 강화 (각각 ~50/~150 LOC 절약).

### §8.3 §9 — 검증 게이트 path-specific 설계

Phase 2 Commit 별 검증 게이트 사전 설계:

| Commit | 검증 게이트 | path-specific |
|--------|------------|--------------|
| Commit 1 (Foundation — Mobile 컴포넌트 신설) | tsc / lint / build / diff (3 files) | `git grep "MobileTopNav\|PassportUnfoldView" src/` |
| Commit 2 (Sidebar / TopNav 반응형 wire) | + Sidebar Desktop 무손상 검증 | `git grep "w-\[240px\]" src/components/layout/` |
| Commit 3 (ArtworkGrid 반응형 + MobilePassportStack 또는 흡수) | + ArtworkGrid viewMode 분기 회귀 0 검증 | `git grep "viewMode === \"passport\"" src/components/layout/` |
| Commit 4 (PassportUnfoldView mobile-native) | + rule_17 / PASSPORT spec §4/§7 정합 검증 | `git grep "PassportUnfoldView\|unfold" src/` |
| Commit 5 (Closure) | tsc / lint / build / diff | `git grep -l "STEP 131.5" docs/steps/` |

**신설 검증 게이트** — **모바일 / 데스크탑 dimension 정합 검증 grep 패턴**:

```bash
# Desktop Sidebar 240px 무손상 검증
git grep "w-\[240px\] shrink-0" src/components/layout/Sidebar.tsx
# → 결과 1건 (Sidebar 정착물 보존)

# Mobile viewport 감지 wire 검증
git grep "matchMedia\|md:hidden\|lg:hidden\|sm:" src/components/

# rule_14 보강 spec 정착 검증 (Phase 2 commit 5 시점)
git grep -l "Desktop Layout Contract\|Responsive Surface Layer" docs/
```

**broad pattern 회피** — `grep -r ... .` 대신 `git grep ... src/` 또는 단일 파일 검증 (false positive 0).

---

## §9 STEP 132 (PDF) 와의 dimension 관계

### §9.1 PDF 영역 dimension 독립성

STEP 132 Phase 1 §1.1 정착물 정합:
- PDF 출력 = 서버 생성 (Vercel serverless function 또는 client-side @react-pdf/renderer)
- PDF artifact 자체는 **browser 무관** (PDF viewer 가 dimension 결정)
- → STEP 132 의 *PDF 생성 로직* 은 STEP 131.5 모바일 정합과 dimension 독립

### §9.2 PDF 미리보기 UI 의 정합 필요 영역

STEP 132 Phase 1 §8.6 (사용자 §N 결정 항목 6 — PDF 미리보기 UI 위치) 의 모바일 정합:

| STEP 132 §8.6 선택지 | 모바일 정합 |
|---------------------|----------|
| (A) Drawer 내부 미리보기 (PrintView 패턴 답습) | 🟡 Desktop drawer 패턴 — Mobile 에서는 full-screen 자연 |
| (B) Modal expansion | 🟡 Mobile 에서 OK |
| (C) 별도 페이지 | 🔴 rule_17 위반 |
| (D) 다운로드 link 만 (미리보기 0) | ✅ Mobile / Desktop 정합 minimal |

**STEP 131.5 정착 후 영향**: STEP 132 §8.6 결정이 *모바일 정합 layer 흡수* 가능 — 본 STEP 131.5 의 PassportUnfoldView 패턴 답습 시 Mobile PDF preview = full-screen unfold view.

### §9.3 STEP 132 ↔ STEP 131.5 순서 결정

**결정 후보**:
- (A) **STEP 131.5 (모바일) 우선 → STEP 132 (PDF)** — Multi-Surface 정착 선행, STEP 132 PDF 미리보기 UI 가 모바일 정합 자연 흡수
- (B) STEP 132 (PDF) 우선 → STEP 131.5 (모바일) — PDF 인프라 먼저, 모바일 정착 후행
- (C) 동시 (별도 worktree)

**Trade-off**:
- (A): Multi-Surface 정착 spec 이 STEP 132 PDF 미리보기 UI 결정 영역 자연 흡수, 단 STEP 132 진입 지연
- (B): PDF 인프라 우선 정착, 단 PDF 미리보기 UI 가 Desktop 가정 → STEP 131.5 후 retrofit 필요
- (C): worktree 2개 분기 (현 `condescending-lamarr-f5022a` + 별도) — 복잡도 증가

**Claude 추천**: **(A) STEP 131.5 → STEP 132** — Multi-Surface 정착 선행이 STEP 132 spec 결정 기반 강화. Phase 1 자체 doc-only (Risk Low) → Phase 2 진입은 사용자 §N 결정 후.

→ §11 항목 e 사용자 결정 영역.

---

## §10 Phase 2 Commit 분할 사전 계획

### §10.1 권고 분할 안 — 5 commits

| # | Commit | 작업 범위 | 예상 LOC | Risk |
|---|--------|----------|---------|------|
| 1 | **Foundation** — Mobile 컴포넌트 신설 (wire 0) | `src/components/mobile/MobileTopNav.tsx` (신설), `src/components/mobile/PassportUnfoldView.tsx` (신설). MobilePassportStack 신설 여부는 §8.2 (b) 결정 영역 | +270~420 | 🟢 Low (additive, 호출처 0) |
| 2 | **Sidebar / TopNav 반응형 wire** | `src/app/layout.tsx` 또는 page root (~5 LOC 분기), `Sidebar.tsx` (`md:flex hidden md:hidden` 1줄 추가, **본문 0줄**), `MobileTopNav` 호출처 진입 | +10~30 / -0 | 🟡 Medium-Low (정착물 첫 wire) |
| 3 | **ArtworkGrid 반응형 확장 또는 MobilePassportStack 진입** | (C) 채택 시 Tailwind 분기만 (~30 LOC) / (A) 채택 시 MobilePassportStack wire (~50 LOC) | +30~50 | 🟢 Low |
| 4 | **PassportUnfoldView mobile-native wire** | `PassportCard.tsx` onClick → mobile viewport 시 PassportUnfoldView 진입 (rule_17 정합), swipe-down 닫기 | +30~50 | 🟡 Medium (gesture 영역 + 사용자 §N 결정 g 의존) |
| 5 | **Closure** — `STEP_131_5_PHASE_2_COMPLETE.md` + Phase 1 cross-ref + (사용자 승인 시) 매니페스토 rule_14 보강 | doc + 매니페스토 보강 (xml + AXVELA_DEV_CONVENTION.md cross-ref) | +400~450 / +2~30 | 🟡 Medium (매니페스토 영역) |

### §10.2 대안 분할 안

**3 commits (간소화)**: Foundation + Integration (Commit 2+3 합침) + Closure. 단 Risk profile 분리 약화 (반응형 wire 와 정착물 분기 동시 진입).

**4 commits**: PassportUnfoldView 를 Foundation 에 합침. 단 gesture 영역 사용자 §N 결정 (framer-motion 의존) 의존성으로 Commit 1 Risk 상승.

→ **5 commits 권고** (Risk profile 명확 분리).

### §10.3 누적 LOC 예상

| 영역 | LOC |
|------|-----|
| 신설 코드 (Mobile 컴포넌트) | ~270~420 |
| 기존 코드 분기 (반응형) | ~70~100 |
| 신규 doc (Phase 2 COMPLETE) | ~400~450 |
| 매니페스토 보강 (사용자 승인 시) | ~30~50 |
| **총** | ~770~1020 |

**Bundle 영향 사전 평가**:
- 신설 컴포넌트 (~270~420 LOC) — 호출처 1건 (page root) → +3~5 kB 예상
- framer-motion 도입 시 (사용자 §N 결정 §11 항목 g): +30~50 kB
- 누적 bundle Δ: **+3~55 kB** (dependency 결정 영역)

---

## §11 사용자 §N 결정 항목

Phase 2 진입 전 사용자 결정 필요 — **8 항목**.

### §11.1 항목 (a) — 매니페스토 rule_14 보강 범위

**상황**: §5 에서 rule_14 보강 spec 도출 (Desktop Layout Contract + Responsive Surface Layer + dimension 통합 금지).

**선택지**:
- (A) **rule_14 보강 (XML rule 본문 갱신 + AXVELA_DEV_CONVENTION.md cross-ref)** — 매니페스토 정착 정합
- (B) 영구 정책 15 추가 ("Desktop ↔ Mobile dimension 절대 통합 금지") — 더 강력한 정책 영역 정착
- (C) 인수인계 메모만 (매니페스토 본문 0줄, doc-only 정착) — 보수적 접근

**Trade-off**:
- (A): rule_14 영구 정착, 영향 범위 명확 (Desktop/Mobile dimension), 사용자 명시 승인 후 진입
- (B): 영구 정책 추가 (현 14건 → 15건), 매우 강력한 정착 but 신중한 결정 필요
- (C): doc-only 정착, 매니페스토 무손상 but 후속 STEP 에서 매니페스토 미참조 위험

**Claude 추천**: **(A) rule_14 보강** — STEP 128 §7 revised roadmap 의 Multi-Surface 정착 정합. 영구 정책 15 (B) 는 사용 데이터 누적 후 별도 결정 영역.

### §11.2 항목 (b) — 진행 방식 (긴급 수정 vs Phase 1→2 정합)

**상황**: ChatGPT 제안 — "긴급 수정 1단계 (Sidebar 모바일 hide + ArtworkGrid 카드 layout 분기)".

**선택지**:
- (A) **Phase 1 → Phase 2 정합 진행** (긴급 수정 0건, 매니페스토 정착 절차 답습)
- (B) 긴급 수정 ChatGPT 1단계 (즉시 Sidebar `md:hidden` 추가) + Phase 1 영역 외 hotfix
- (C) 둘 다 (긴급 수정 hotfix + Phase 1 → Phase 2 정착)

**Trade-off**:
- (A): 매니페스토 정합, doc-only Phase 1 진입 후 사용자 §N 결정 → Phase 2 정착. 단 모바일 깨짐 상태 일시 유지
- (B): 즉시 모바일 정합, but Phase 1 영역 외 hotfix → STEP 130 Hotfix `631885d` 패턴 답습 (이번 STEP 131.5 진입 자체가 STEP 131 의 Phase 2 후속이라 hotfix 정합 가능성 검토 필요)
- (C): 즉시 모바일 정합 + Phase 1 → Phase 2 정착, but commit chain 복잡도 증가

**Claude 추천**: **(A) Phase 1 → Phase 2 정합** — 매니페스토 정착 절차 답습, 사용자 §N 결정 영역 보호. 모바일 깨짐 자체는 production 영향 한정 (운영자 = Desktop 중심이라 일상 운영 무영향, 컬렉터 access = 도메인 분리 STEP 136 영역).

### §11.3 항목 (c) — Mobile Passport unfold 인터랙션 우선순위

**상황**: §7.1 의 unfold UX (hinge animation + swipe-down 닫기) 는 STEP 133 (In-Passport Navigation) 의 본격 영역.

**선택지**:
- (A) **이번 STEP 131.5 에서 mobile unfold 진입 (PassportUnfoldView 신설)** — STEP 133 영역 일부 사전 진입
- (B) **STEP 133 까지 보류** — STEP 131.5 는 반응형 wire 만 (Sidebar hide + Grid 분기), unfold 는 STEP 133 영역
- (C) 부분 진입 — PassportUnfoldView 컴포넌트 신설만 (wire 0), 본격 in-passport navigation 은 STEP 133

**Trade-off**:
- (A): Mobile-native UX 즉시 정착, but STEP 133 spec 일부 사전 정착 (영역 분리 약화)
- (B): STEP 133 영역 보호, 단 STEP 131.5 모바일 UX = naive Sidebar hide + Grid 1-col (Apple Wallet 메타포 부재)
- (C): Foundation 정착 + STEP 133 영역 보호

**Claude 추천**: **(C) 부분 진입** — PassportUnfoldView 신설 (Foundation), 실 wire 는 STEP 133 영역. Phase 2 Commit 4 영역에서 *최소 wire* (`PassportCard.tsx onClick → 모바일 시 PassportUnfoldView 진입 boilerplate`) 만 정착, In-Passport Navigation (swipe-between-rows) 은 STEP 133.

### §11.4 항목 (d) — 도메인 분리 시점

**상황**: §4.2 의 도메인 분리 (`gallery.axvela.com` / `passport.axvela.com` / `verify.axvela.com`) 시점 결정 영역.

**선택지**:
- (A) **STEP 136 (Certificate STEP) 시점** — Certificate Surface 정착과 도메인 분리 동시
- (B) 지금 (STEP 131.5) — Multi-Surface 정착과 동시 분리, but 인프라 변경 (Vercel 도메인 설정 + DNS) 영역 큼
- (C) 별도 STEP (예: STEP 137 — Domain Separation)

**Trade-off**:
- (A): Certificate (외부 발급, QR 진입) 의 도메인 분리 자연 정합 (verify endpoint 의존성)
- (B): Multi-Surface 정착과 동시 분리, but 인프라 영역 (STEP 131.5 자체 LOC 영역 초과)
- (C): 도메인 분리 영역만 별도 STEP — 사용자 결정 명확화

**Claude 추천**: **(A) STEP 136 시점** — Certificate Surface 정착과 도메인 분리 자연 정합. STEP 131.5 = 반응형 dimension 분리 (도메인 분리 *사전 단계*) 정착.

### §11.5 항목 (e) — STEP 132 (PDF) 와의 순서

**상황**: §9.3 의 순서 결정 영역.

**선택지**:
- (A) **STEP 131.5 (모바일) → STEP 132 (PDF)** — Multi-Surface 정착 선행
- (B) STEP 132 → STEP 131.5 — PDF 인프라 우선
- (C) 동시 (worktree 2개 분기)

**Trade-off**: §9.3 참조.

**Claude 추천**: **(A) STEP 131.5 → STEP 132** — Multi-Surface 정착이 STEP 132 PDF 미리보기 UI 결정 기반 강화. Phase 1 doc-only Risk Low → 진입 지연 비용 낮음.

### §11.6 항목 (f) — Phase 2 commit 분할 안

**상황**: §10 의 commit 분할 영역.

**선택지**:
- (A) **5 commits** (Foundation / Sidebar 반응형 / ArtworkGrid 반응형 / PassportUnfoldView / Closure) — Claude 권고
- (B) 4 commits (PassportUnfoldView 를 Foundation 에 합침)
- (C) 3 commits (Foundation + Integration + Closure)

**Trade-off**: §10.2 참조.

**Claude 추천**: **(A) 5 commits** — Risk profile 명확 분리, 정착 패턴 답습 (STEP 130/131 5/4 commits).

**추가 영역**: §8.2 (b) MobilePassportStack 신설 여부 + §8.2 (d) ResponsiveLayoutWrapper 신설 여부 합류 결정 영역.

### §11.7 항목 (g) — 신규 dependency 허용 여부

**상황**: Mobile gesture (swipe-down 닫기 / hinge animation) 영역 라이브러리 필요.

**선택지**:
- (A) **신규 dependency 0건** — CSS transition / native touch event 단독 (browser native API)
- (B) **framer-motion 도입** (~50 kB gzipped) — gesture / animation 표준 라이브러리
- (C) **`@use-gesture/react`** (~10 kB) — gesture 전용 minimal 라이브러리
- (D) **react-spring** (~30 kB) — animation 라이브러리

**Trade-off**:
- (A): 0 비용, but gesture 영역 boilerplate ~150 LOC 추가 (touch start/move/end handler)
- (B): 표준 라이브러리, 풍부 기능, but ~50 kB bundle
- (C): minimal, gesture 영역 충분
- (D): animation 표준, but gesture 영역 별도 처리 필요

**Claude 추천**: **(C) `@use-gesture/react`** — minimal bundle (~10 kB), gesture 전용. 단 Phase 2 commit 4 (PassportUnfoldView mobile-native wire) 진입 시점 사용자 §N 재확인 영역.

### §11.8 항목 (h) — 모바일 viewport 우선순위 (Tablet 영역)

**상황**: §5.2 보강 rule_14 의 Tablet (769~1023px) 영역 spec.

**선택지**:
- (A) **Smartphone 우선** (≤768px) — Tablet 은 Desktop fallback (현 정착물 그대로)
- (B) Smartphone + Tablet 둘 다 — Tablet 별도 dimension (Sidebar collapse-drawer + 2-col Passport Stack)
- (C) Smartphone 만 (Tablet 영역 보류)

**Trade-off**:
- (A): 사용자 콜로라도 발견 영역 정합 (mobile primary), Tablet 은 자연 (Desktop layout 으로 fallback) — Tablet 사용자 = 운영자 가능성 높음
- (B): Tablet 별도 dimension, but LOC + 복잡도 증가
- (C): Tablet 보류, but 사용자 데이터 부재 (Tablet 사용 시나리오 미정)

**Claude 추천**: **(A) Smartphone 우선** — 사용자 발견 정합 + Tablet 은 Desktop fallback 자연. Tablet 별도 spec 은 사용 데이터 누적 후 별도 STEP 영역.

---

## §12 Risk 평가

### §12.1 영역별 Risk

| 영역 | 사전 Risk | 근거 |
|------|----------|------|
| **매니페스토 보강 (rule_14 + 정책 15)** | 🟡 Medium | 영구 정책 영향 영역, 사용자 명시 승인 필수. Phase 2 Commit 5 영역 한정 (사용자 §N 승인 후) |
| **Mobile 컴포넌트 신설 (MobileTopNav / PassportUnfoldView)** | 🟢 Low | additive 신설, 호출처 0건 (Foundation 단계). Wire 진입은 별도 commit |
| **기존 정착물 영향 (Sidebar / ArtworkGrid)** | 🟢 Low | additive only — Sidebar 본문 0줄 (반응형 분기 클래스만), ArtworkGrid Tailwind 클래스만 (사용자 §N 결정 (C) 채택 시) |
| **신규 dependency (gesture 라이브러리)** | 🟡 Medium | 사용자 §N 결정 영역 (g). 0건 채택 시 Low, 도입 시 bundle +10~50 kB |
| **rule_17 ↔ PASSPORT spec §4/§7 정합** | 🟢 Low | STEP 131 §4.2 정착 패턴 답습 — PassportUnfoldView 는 Passport surface 내부 unfold (Drawer/Modal 영역 외) |
| **§8 표준 적용** | 🟢 Low | ~110 LOC 절약 가능성 (MobilePassportStack 흡수 + ResponsiveLayoutWrapper 폐기) |
| **SSR / hydration mismatch** | 🟡 Medium-Low | CSS-only 분기 채택 시 Low, JS viewport 감지 채택 시 Medium |

### §12.2 종합 Risk 🟡 Medium-Low (사전 평가)

영역별 Risk 누적:
- 매니페스토 보강 (Medium) + 신규 dependency (Medium, 사용자 §N 결정) + SSR hydration (Medium-Low)
- 그 외 영역 Low

→ **🟡 Medium-Low** 사전 평가 — Phase 1 자체는 doc-only Risk Low. Phase 2 commit 진입 시 사용자 §N 결정 (특히 항목 a / g) 후 정확 평가.

### §12.3 책임감 있는 멈춤 패턴 진입 조건

다음 발견 시 **즉시 진행 보류 + 사용자 확인 요청** (STEP 127~131/132 패턴 답습):

1. **Phase 2 Commit 진입 시 §8 표준 추가 발견** — 신설 가정 컴포넌트가 다른 정착물과 추가 중복
2. **Bundle 영향 +5 kB 초과** (dependency 미도입 시) 또는 +60 kB 초과 (도입 시) — 사용자 spec tolerance 초과
3. **Sidebar / ArtworkGrid Desktop 정착물 회귀** — `w-[240px] shrink-0` 무손상 검증 실패 또는 viewMode 분기 회귀
4. **rule_17 / PASSPORT spec §4/§7 정합 위반 가능성 발견** — PassportUnfoldView 가 Drawer/Modal 패턴 답습 시
5. **SSR hydration mismatch 발생** — viewport 감지 JS layer 채택 시 next/dev 경고
6. **매니페스토 변경 사용자 명시 승인 부재 발견** — Phase 2 Commit 5 진입 시 rule_14 보강 부분이 사용자 §N 결정 (a) 미수렴 상태
7. **신규 dependency 사용자 §N 결정 (g) 부재 진입** — Phase 2 Commit 4 진입 시 gesture 라이브러리 결정 미수렴
8. **Cross-worktree state 발견** (STEP 130 패턴 답습) — `trusting-ptolemy-b61055` 등 다른 worktree 에서 동일 작업 정착 발견
9. **D-AXVELA-VISION-3 모바일 정합 sup 영역 spec 추가 발견** — Phase 1 미수렴 영역

→ 책임감 있는 멈춤 패턴 **9건째 누적 가능성** (STEP 131 Phase 1 §9.3 의 8건째 + 본 STEP 1건).

---

## §13 보존 약속 (Phase 2 진입 시점)

| 보존 영역 | 약속 |
|----------|------|
| `src/types/artwork.ts` (STEP 130 정착) | 0줄 |
| `src/lib/i18n-helpers.ts` (STEP 130) | 0줄 |
| `src/lib/__tests__/i18n-helpers.scenarios.ts` (STEP 130) | 0줄 |
| `src/store/useArtworkStore.ts` (STEP 130/131 정착) | 0줄 |
| `src/lib/document-locale.ts` (STEP 96 정착) | 0줄 |
| `src/components/translation/*` 10 files (STEP 96) | 0줄 |
| `src/components/layout/SidebarLocaleToggle.tsx` (STEP 130) | 0줄 (또는 MobileTopNav 에서 별도 wrapper 활용, 본문 0줄) |
| `src/components/artwork/PassportCard.tsx` (STEP 131 Commit 1) | 0줄 (또는 onClick 모바일 분기 1줄 추가, 사용자 §N 결정 (c) 채택 시) |
| `src/components/artwork/ViewModeToggle.tsx` (STEP 131 Commit 1) | 0줄 (mobile 에서 hide, 본문 0줄) |
| `src/components/layout/ArtworkGrid.tsx` (STEP 131 Commit 2) | 0줄 또는 Tailwind 반응형 클래스만 추가 (사용자 §N 결정 (f) §8.2 (b) 채택 시) |
| `src/components/layout/Sidebar.tsx` (240px Desktop 정착물) | 본문 0줄, 반응형 hide 분기 1줄 (`hidden md:flex` 등) — Desktop 무손상 |
| `src/components/artwork/ArtworkCard.tsx` (STEP ~ 정착) | 0줄 (mobile 영역 외) |
| `src/lib/persistence.ts` (SCHEMA_VERSION v1) | **0줄 (무손상)** |
| `package.json` | **신규 dependency 사용자 §N 결정 (g) 후만** — 0건 채택 시 0줄, gesture 라이브러리 도입 시 +1 dep |
| **AXVELA_*.md 6 영구 정책 본문** | **0줄 (사용자 명시 승인 후만 Phase 2 Commit 5 영역 진입, 인용 허용 / 본문 수정 절대 금지)** |
| **AXVELA_OS_Manifesto.xml** | **rule 본문 변경 절대 금지 (해석 보강만 허용)** — rule_14 보강 시 사용자 §N (a) 결정 후 *해석 보강* 영역만 진입 |
| **영구 정책 1 (Phase 1 Fiscal frozen)** | **0줄 (fiscal 영역 schema / 로직 변경 절대 금지)** |
| STEP 127/129/130/131 정착물 | 0줄 (전체 영역, 본 STEP 은 *반응형 layer 추가* 만) |
| `docs/steps/STEP_131_PHASE_2_COMPLETE.md` | 0줄 (cross-ref 추가는 Phase 2 Commit 5 영역) |
| `docs/steps/STEP_131_5_PHASE_1_ARCHITECTURE_REVIEW.md` (본 doc) | 0줄 (Phase 2 진입 후) |

---

## §14 Phase 2 진입 권고

### §14.1 진입 조건

1. 본 review doc 사용자 검토 완료
2. **사용자 §11 (8 항목) 결정 완료** — 특히 항목 (a) 매니페스토 rule_14 보강 / 항목 (g) 신규 dependency
3. Risk 🟡 Medium-Low 동의
4. Phase 2 commit 분할 안 승인 (§11 항목 f)
5. STEP 132 와의 순서 결정 (§11 항목 e) — (A) 채택 시 본 STEP 131.5 우선

### §14.2 Phase 2 진입 후 작업 흐름

1. **Phase 2 Commit 1 (Foundation)** — MobileTopNav + PassportUnfoldView 신설 (호출처 0)
2. **Phase 2 Commit 2 (Sidebar / TopNav 반응형 wire)** — page root + Sidebar 반응형 분기 (본문 0줄, 클래스만)
3. **Phase 2 Commit 3 (ArtworkGrid 반응형 확장 또는 MobilePassportStack)** — §8.2 (b) 결정 후 (C) 또는 (A)
4. **Phase 2 Commit 4 (PassportUnfoldView mobile-native wire)** — gesture 라이브러리 §11 (g) 결정 후
5. **Phase 2 Commit 5 (Closure)** — `STEP_131_5_PHASE_2_COMPLETE.md` + Phase 1 cross-ref + (§11 (a) 승인 시) 매니페스토 rule_14 보강

### §14.3 추가 사실 발견 시 책임감 있는 멈춤 패턴

각 commit 진입 시점:
- §7+§8+§9 표준 재적용
- 발견 시 즉시 진행 보류 + 사용자 확인 (STEP 127~131/132 패턴 답습)
- 책임감 있는 멈춤 패턴 9건째 누적 가능성

### §14.4 다음 세션 진입 가능 시점

본 Phase 1 doc commit 완료 + 사용자 §11 결정 완료 후:
- 같은 turn 에 Phase 2 Commit 1 진입 가능
- 또는 별도 turn 에 진입 (사용자 명시 신호)

---

**STEP 131.5 Phase 1 Architecture Review — COMPLETE ✅ (Phase 1.1 doc-only commit)**

핵심 산출:
- **AXVELA OS 정체성 재정의** — "Desktop Gallery OS" → "Multi-Surface Cultural Asset OS" 영구 정착 spec
- **모바일 깨짐 4건 진단 + 원인 (rule_14 Desktop 가정)** — 코드 위치 확인 (`Sidebar.tsx:379`, `ArtworkGrid.tsx:96`)
- **Multi-Surface Architecture 명시** — Gallery OS (Desktop) / Passport Surface (Mobile-first) / Certificate Surface (Mobile + Verify)
- **매니페스토 rule_14 보강 spec** — Desktop Layout Contract + Responsive Surface Layer + dimension 통합 금지
- **§6.2 §8 표준 적용** — MobilePassportStack 흡수 + ResponsiveLayoutWrapper 신설 폐기 결정 가능성 (**~110 LOC 잠정 절약**)
- **사용자 §N 결정 항목 8건** 도출 (특히 (a) 매니페스토 / (g) dependency / (e) STEP 132 순서)
- **Phase 2 commit 분할 권고 — 5 commits** (Foundation / Sidebar / Grid / PassportUnfold / Closure)
- **Risk 🟡 Medium-Low 사전 평가**

Phase 2 는 사용자 §11 결정 (최소 항목 a / e / f / g 결정) 후 별도 turn 진입.
