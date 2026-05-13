# STEP 131 — Phase 1 Architecture Review (Closed Passport Card + List View)

**작성 시점**: 2026-05-13
**Baseline**: `631885d` (STEP 130 Phase 2 Hotfix HEAD — VISIBLE_LOCALES KO/EN 제한)
**Branch**: `claude/step127-architecture-review` (STEP 127~131 연속 commit 흐름)
**작업 성격**: doc-only Phase 1 review — 코드 0줄. Phase 2 implementation 은 별도 진입.
**리스크 평가**: 🟢 **Medium-Low** (UI 신설 + getTitle/getArtistName 첫 사용처 wire, 단 §8 표준 정합으로 ArtworkGrid 확장 채택 시 Risk Low)

---

## §1 개요

### §1.1 STEP 131 목표

STEP 128 §7 revised roadmap 의 두 번째 단계 (STEP 131 = "Closed Passport Card + List View"). STEP 130 Internationalization Layer 정착 (`getTitle` / `getArtistName` / `currentLocale`) 의 **첫 호출처 wire** 자연 진입점.

작업 본질:
- **시각 변혁**: 일반 Gallery CMS grid card → "Closed Passport" (가죽 cover, AXVELA mark, institutional archive 느낌)
- **데이터 접근 패턴 진입**: 모든 작품 표시 위치가 `artwork.title` / `artist.name` 직접 access → `getTitle(artwork, currentLocale)` / `getArtistName(artist, currentLocale)` helper 경유로 전환
- **3-Surface Architecture 의 Passport surface 시작**: 운영 surface (Sidebar+Grid+DetailPanel+Drawers) 와 별도 dimension

### §1.2 인수인계 문서 — 3-Surface Architecture 정합

| Surface | 책임 영역 | STEP 위치 |
|---------|----------|----------|
| 운영 surface | Sidebar + Grid + DetailPanel + 29 Drawers | Phase 1~4 정착 (STEP 1~129) |
| **Passport surface** | **Closed Passport Card + Expanded Passport + In-Passport Navigation + Timeline + AI Cultural Intelligence** | **STEP 131~135** |
| Certificate surface | Ownership Certificate (컬렉터 외부 발급, QR encrypted, server-side PDF) | STEP 136 |

본 STEP 131 = **Passport surface 의 첫 진입 단계** — Closed Passport Card + List View 만. Expanded Passport (STEP 133) / In-Passport Navigation (STEP 133) / AI Cultural Intelligence (STEP 134) / Timeline (STEP 135) 모두 본 STEP 영역 외.

### §1.3 rule_1 (SSOT — artwork.id) 정합 확인

3-Surface 모두 동일 `artwork.id` 기반:
- 운영 surface: `useArtworkStore.artworks` 의 `artwork.id`
- Passport surface (본 STEP+): 같은 `artworks` 구독, 같은 `artwork.id` 진입
- Certificate surface (STEP 136): 같은 `artwork.id` 의 Ownership Certificate 발급 (CLOSED 상태 자동 또는 갤러리 수동)

→ **rule_1 무손상**. Passport 는 같은 artwork 의 *다른 표시 layer* — 데이터 분기 없음.

---

## §2 PASSPORT-1 디자인 정독 결과

`docs/design/passport/PASSPORT-1_SPEC.md` (15 §) + `PASSPORT-1.png` (visual mockup) 정독.

### §2.1 SPEC 15 § 요약

| § | 제목 | 핵심 |
|---|------|------|
| 핵심 철학 | Cultural Asset Passport | artwork → 거래 객체 + 검증 자산 + 문화 자산 + AI intelligence object 통합 |
| §1 | 작품 리스트 구조 변경 | 기존 grid card → "Closed Passport" 형태 (leather cover, institutional object) |
| §2 | Closed Passport 디자인 | LEFT SPINE (AXID 세로, REGISTERED, VERIFIED, AXVELA mark) + FRONT COVER (제목, 작가, 연도, 매체, status chips). Dark navy leather + gold typography. **금지: gradients / neon / glassmorphism / floating SaaS / 과한 shadow** |
| §3 | Passport List View | 다중 Closed Passport 카드 배열, slightly stacked spacing 가능, "물리적 보관소" 느낌 |
| §4 | Passport Open Interaction | 클릭 시 **drawer/modal 금지**, Passport 자체가 펼쳐짐. physical hinge motion, slow calm institutional |
| §5 | Expanded Passport 구조 | LEFT spine 고정 + RIGHT paper (metadata, image, status, index list) |
| §6 | 우측 Index 9-row | PROVENANCE / INQUIRY / INVOICE / SETTLEMENT / TAX / LOGISTICS / CERTIFICATE / AI CULTURAL INTELLIGENCE / TRANSACTION TIMELINE |
| §7 | **In-Passport Navigation (가장 중요)** | **외부 modal / drawer / overlay 절대 금지**. 모든 detail 은 패스포트 *내부* slide transition |
| §8 | AI CULTURAL INTELLIGENCE 강조 | subtle purple accent, AI score, market trend, cultural significance, recommendation. **챗봇 느낌 금지** |
| §9 | AI Detail 화면 구조 | Overview / Market Insight / Condition / Comparables 탭. Bloomberg Terminal × Apple editorial minimalism |
| §10 | Condition Analysis | UV scan / crack analysis / restoration history / conservation score / surface condition map. "AI forensic layer" |
| §11 | Transaction Timeline | inquiry / invoice / settlement / logistics / sale / certificate issuance. 세로 archive logbook |
| §12 | Existing Drawer System 처리 | **기존 Drawer 시스템 제거 금지**. PASSPORT = 작품 중심 공식 기록 / Drawer = 운영 OS / 관리자 workflow. 의도적 역할 분리 |
| §13 | 개발 방향 | artwork card redesign / passport open animation / spine layout / in-passport navigation / paper detail / AI section / timeline / status chip 통일 |
| §14 | UI 규칙 | **필수**: minimal, premium, institutional, calm, archival, luxury trust. **금지**: startup SaaS, flashy motion, futuristic cyberpunk, gradients, glass UI, gaming UI |
| §15 | 최종 목표 | "갤러리 관리툴" → **"Cultural Asset Operating System"** |

### §2.2 PASSPORT-1.png Visual Key Element 추출

이미지 정독 결과 핵심 visual 요소:
- **AXVELA PASSPORT** title — "CULTURAL ASSET PASSPORT FOR EACH ARTWORK"
- **Closed Passport (Default)** — dark navy leather cover, golden emblem (top-right), AXVELA PASSPORT 라벨, artwork title + artist + AXID
- **Passport List View** — 다중 카드 grid (slightly stacked spacing 시각화)
- **Expanded Passport (Overview)** — 펼쳐진 상태, **9-row Index** (PROVENANCE → ... → TRANSACTION TIMELINE) 표시
- **AI CULTURAL INTELLIGENCE 섹션** — graph + AI score 시각화
- **Multiple detail screens** — Condition / AI analysis / market trend

색감: dark navy (cover) + ivory paper (expanded) + gold accents. Apple Wallet + Government Archive + Luxury Certificate 통합 톤.

### §2.3 인수인계 사용자 피드백 — "정보 밀도 높음"

PASSPORT-1.png 디자인 정착 후 사용자 피드백:
- **"정보 밀도가 높다"** — 9-row Index + AI 그래프 + 다중 detail screen 동시 노출
- **디자인 단순화** 별도 STEP 사항으로 분리 결정 (인수인계 명시)
- **본 STEP 131 영역 외**: 단순화는 별도 STEP (예: STEP 131.5 또는 별도 design polish STEP) — 본 STEP 은 PASSPORT-1 spec 그대로 첫 wire (사용자 §N 결정 항목 7 참조)

---

## §3 데이터 진입점

### §3.1 사용 데이터

본 STEP 의 Closed Passport Card + List View 는 다음 데이터만 사용:

| 데이터 | 위치 | 비고 |
|--------|------|------|
| `artwork` 전 필드 | `useArtworkStore.artworks` | 기존 store 구독, 신규 fetch 0건 |
| `artwork.id` / `artwork.axid.code` | rule_1 SSOT | 모든 surface 의 진입점 |
| `artwork.title` / `artwork.titleI18n` | STEP 130 정착물 | helper 경유 access |
| `artwork.artist.name` / `artist.nameEn` / `artist.nameI18n` | STEP 130 정착물 | helper 경유 access |
| `artwork.year` / `artwork.medium` / `artwork.dimensions` | 기존 정착 | direct access |
| `artwork.state` | rule_6 state machine | StatusBadge 정합 |
| `artwork.imageUrl` / `artwork.thumbnailColor` | STEP 50.5 / 53 | 이미지 또는 swatch fallback |
| `artwork.priceKRW` / `artwork.inquiryCount` | 기존 | 정보 밀도 영역 |
| `artwork.registrationStatus` | STEP 114 정착 | "REGISTERED" / "VERIFIED" chips 진입점 후보 |
| `currentLocale` | STEP 130 Commit 2 정착 | UI 표시 언어 결정 |

### §3.2 신규 데이터 슬롯 필요 여부

**검토 결과**: **신규 슬롯 0건 권고**.

PASSPORT-1 spec 의 모든 표시 데이터는 기존 정착물로 충당 가능:
- AXID 세로 표기 → `artwork.axid.code` direct
- REGISTERED chip → `artwork.registrationStatus` (STEP 114) 가 `"REGISTERED"` 또는 그 후속 status 일 때 표시
- VERIFIED chip → `artwork.registrationStatus` 가 `"VERIFIED"` 일 때 표시 (STEP 114 의 10-state 매핑)
- AXVELA mark → static logo (코드 0줄, SVG 인라인)
- 9-row Index 는 STEP 133 (Expanded Passport) 영역 — 본 STEP 외

### §3.3 STEP 130 정착물 첫 호출처

`getTitle` / `getArtistName` helper 의 **첫 production 호출처**:
- PassportCard.tsx (신규) — 카드 표면의 제목 / 작가명
- 향후 Phase 2 에서 ArtworkCard.tsx (기존) 도 같은 helper 로 전환 가능 (사용자 §N 결정 항목 후보)

`currentLocale` store 구독 첫 사용처 (SidebarLocaleToggle 외):
- PassportCard 가 자체 구독 vs 부모 (ArtworkGrid) 가 구독해서 prop drilling 결정 (사용자 §N 결정 항목 후보)

---

## §4 UI 위치 결정

### §4.1 위치 옵션

PASSPORT 가 표시될 위치 후보:
- **A) ArtworkGrid 안 (View Mode 토글로 Grid View ↔ Passport View 전환)** — 권고
- B) 별도 페이지/route — rule_17 (페이지 이동 금지) 위반
- C) Sidebar 별도 entry — Sidebar 영역 wire 영역 외, navigation 복잡도 증가
- D) DetailPanel 우측에 Passport 고정 — DetailPanel 의 기존 운영 정보와 충돌

→ **A 권고** — ArtworkGrid 영역 내 view mode 전환 (기존 Grid 와 공존).

### §4.2 매니페스토 정합 검증

| Rule | 정합 검증 |
|------|----------|
| **rule_14** (3 Column 구조: Sidebar 240px / Grid / DetailPanel) | ✅ ArtworkGrid 영역 내 변경, 폭 / 컬럼 수 무손상 |
| **rule_15** (≤3 button 단일 명령 = 단일 결과) | ⚠️ View Mode 토글 추가 — 1 button (Grid/Passport 2-state 또는 segmented control 2-state). 추가 button 영향 1 (Grid header 내 "작품 추가" + 신규 1 = 총 2 button, 한계 내) |
| **rule_16** (museum-safe minimal) | ✅ PASSPORT-1 spec 자체가 museum-safe / archival / institutional 톤 명시 (gradients / neon / glassmorphism 금지) |
| **rule_17** (페이지 이동 금지, Drawer/Modal/Overlay 만) | ✅ Closed Passport 클릭 시 기존 select pattern (DetailPanel 갱신). Expanded Passport 의 "Passport 자체가 펼쳐짐" 은 STEP 133 영역. **단**: STEP 133 의 "외부 modal 금지" 정착이 본 STEP rule_17 보강 (Drawer 도 의도적 회피, In-Passport Navigation 우선) |
| **rule_18** (rule_18 (a) Curation, (c) Pricing, (d) Inquiry — drawer 영역) | ✅ 본 STEP 무관 (Drawer 시스템 보존, PASSPORT spec §12 정합) |

### §4.3 Sidebar 폭 240px 무손상 검증

본 STEP 변경 영역:
- ArtworkGrid 영역 (main flex-1) — Sidebar 폭 영향 0
- 만약 ViewModeToggle 위치를 Sidebar header 로 결정 시 (사용자 §N 결정 항목 1):
  - 현 SidebarLocaleToggle 옆 추가 검토 — 240px 폭 안에 KO EN + Grid Passport 2 toggle 동시 수용 가능성 확인 필요 (Phase 2 Commit 진입 시점 측정)
  - Grid header 위치 시 (권고) — Sidebar 무영향

---

## §5 Locale 통합 — getTitle / getArtistName 첫 호출처 wire

### §5.1 호출 패턴 사전 설계

```ts
// PassportCard.tsx (신규, 가정)
import { useArtworkStore } from "@/store/useArtworkStore";
import { getTitle, getArtistName } from "@/lib/i18n-helpers";

export function PassportCard({ artwork, ... }: PassportCardProps) {
  const currentLocale = useArtworkStore((s) => s.currentLocale);

  // STEP 130 정착물 첫 호출처
  const displayTitle = getTitle(artwork, currentLocale);
  const displayArtistName = getArtistName(artwork.artist, currentLocale);

  return (
    <button>
      {/* ... leather cover 시각 ... */}
      <span>{displayTitle}</span>
      <span>{displayArtistName}</span>
    </button>
  );
}
```

→ **데이터 access 패턴 변경**: `artwork.title` 직접 → `getTitle(artwork, currentLocale)` helper. 같은 패턴이 ArtworkCard 에도 적용 가능 (사용자 §N 결정 항목 후보).

### §5.2 currentLocale 구독 위치 결정

**옵션**:
- A) **각 PassportCard 가 자체 구독** — 카드 컴포넌트 self-contained, 호출처 단순
- B) **ArtworkGrid 가 구독 + prop drilling** — 한 번 구독, 모든 카드 props 전달
- C) **Context 신설** — overengineering, 본 규모 부적절

→ **A 권고** (자체 구독). Zustand selector pattern 의 자연 동작 — 같은 selector 다중 구독은 dedup 자동.

### §5.3 D-130-1 첫 재검토 — 빈 문자열 fallback 의미

**상황**: Passport 표시 시 운영자가 `titleI18n.en = ""` 빈 문자열 입력했을 경우:
- 현 거동 (nullish `??`): 영문 모드에서 Passport 의 "Title" 영역이 **공란**
- 대안 (truthy 체크): 다음 fallback (`title` = 한국어) 진입

**결정 가능 시점인가**?
- 본 STEP 131 시점에는 운영자가 빈 문자열 입력하는 *Form UI 가 wire 0건* (다국어 입력 form 신설은 별도 STEP)
- 따라서 빈 문자열 입력 케이스가 production 데이터에 *존재하지 않을 가능성* 높음
- 결정 보류 가능 — **사용자 §N 결정 항목 5 으로 명시**

### §5.4 D-130-2 첫 재검토 — KO/EN 만 노출 상태

**상황**: SidebarLocaleToggle 이 KO/EN 만 노출 (Hotfix 631885d). Passport 표시 시:
- currentLocale 은 항상 "ko" 또는 "en" — JA/ZH 진입 불가 (UI 레벨)
- Passport 의 fallback chain 은 4 locale 모두 정합 — 향후 D-130-2 단기 복귀 시 자연 흡수
- **본 STEP 별도 변경 0건** — D-130-2 복귀 결정 시점 (STEP 134 또는 별도) 까지 보류 정합

---

## §6 §7+§8+§9 표준 적용

STEP 129 Phase 2 §12.4 정착 + STEP 130 Phase 1.0 적용 첫 사례 답습.

### §6.1 §7 — 이전 STEP deferred items 재검토

| Item | 영역 | STEP 131 진입 시 결과 |
|------|------|--------------------|
| **D-130-1** (titleI18n.en = "" fallback 의미) | i18n-helpers `getTitle` 거동 | **Passport 표시 시점 결정 가능 여부 검토** → 운영자 빈 문자열 입력 form 미존재로 *결정 보류 정합* (사용자 §N 결정 항목 5) |
| **D-130-2** (UI locale KO/EN 제한) | SidebarLocaleToggle VISIBLE_LOCALES | **본 STEP 영역 외** — Passport 는 fallback chain 4 locale 그대로 정합. 별도 변경 0건 |
| STEP 130 Phase 2 deferred 외 | — | **0건** — STEP 129 결정사항 모두 정착 (방어 4-layer / PrintView 2건 / `.gitattributes` 정책) |

→ STEP 131 진입 시점 미해결 의무 0건 (D-130-1 / D-130-2 모두 본 STEP 영역 외 또는 보류 정합).

### §6.2 §8 — 신설 가정 컴포넌트 vs 기존 정착물 중복 검증

**중요 단계 — Phase 1.0 표준의 핵심 학습 (STEP 130 Phase 1 §2 의 `DocumentLocale` 재활용 패턴 답습)**.

#### 신설 가정 컴포넌트 list

| 가정 컴포넌트 | 역할 | 가정 LOC |
|--------------|------|---------|
| **PassportCard.tsx** | Closed Passport 카드 시각 (leather cover, AXID 세로, emblem) | ~150 LOC |
| **PassportListView.tsx** | 다중 PassportCard 표시 + filter + grid | ~120 LOC |
| **ViewModeToggle.tsx** | Grid View / Passport View 전환 | ~50 LOC |
| **AxidVerticalDisplay** (가정) | AXID 세로 표기 helper component | ~30 LOC |

총 가정 신설: ~350 LOC

#### 각 가정 컴포넌트의 기존 정착물 grep 검증

##### (a) PassportCard vs ArtworkCard

**기존 정착물**: `src/components/artwork/ArtworkCard.tsx` (93 LOC)

```
ArtworkCard 정착 기능:
- thumbnail (image or color swatch fallback)
- AXID code 표시 (top-left badge)
- inquiryCount badge (top-right if > 0)
- artist.name + artwork.title (직접 access — locale-aware 아님)
- StatusBadge (state)
- priceKRW (formatKRW)
- updatedAt relative time
```

**중복 영역**:
- 데이터 접근 패턴 (artwork prop, onSelect callback): **동일**
- StatusBadge 진입: **동일**
- formatKRW / formatRelativeKR 사용: **동일**
- thumbnail / image fallback: **동일** (PassportCard 도 leather cover 외 이미지 영역 가질 가능성)

**차이 영역**:
- 시각: 일반 grid card vs 가죽 패스포트 (본질 differentiation)
- title/artist access: direct vs `getTitle/getArtistName(artwork, currentLocale)` 경유 (helper layer)
- AXID 표시: top-left badge vs 세로 spine
- 추가 PassportCard: AXVELA mark, REGISTERED/VERIFIED chips, emblem, leather grain

**결론**: **별도 컴포넌트 정합** — 시각 differentiation 본질, 다만 데이터 access 패턴 답습 + locale wire 적용. ArtworkCard 도 향후 같은 helper 전환 가능 (사용자 §N 결정 항목).

##### (b) PassportListView vs ArtworkGrid

**기존 정착물**: `src/components/layout/ArtworkGrid.tsx` (135 LOC)

```
ArtworkGrid 정착 기능:
- artworks store 구독
- search/filter (query + stateFilter)
- header (workspace title, total count, "작품 추가" button)
- SearchBar 통합
- grid layout (1/2/3/4 col responsive)
- map → ArtworkCard
- EmptyState
```

**중복 영역** (PassportListView 가정 시):
- store 구독 (`artworks`, `selectedArtworkId`, `query`, `stateFilter`): **100% 동일**
- filter 로직 (query + stateFilter): **100% 동일**
- header (workspace title, count, 작품 추가): **100% 동일**
- SearchBar 통합: **100% 동일**
- grid layout: **거의 동일** (PASSPORT spec §3 의 "slightly stacked spacing" 만 추가 가능성)
- EmptyState: **100% 동일**

**차이 영역**:
- 카드 컴포넌트: ArtworkCard ↔ PassportCard (1줄 분기)
- grid spacing: 약간 다른 padding (스타일 분기)

→ **🔴 PassportListView 신설은 ArtworkGrid 의 거의 100% 복제**. **신설 폐기 + ArtworkGrid 확장 (view mode 분기)** 권고.

**예상 절약**: ~120 LOC (PassportListView 신설 회피) + 향후 search/filter 변경 시 단일 진실 원천 (drift 위험 0).

→ **사용자 §N 결정 항목 3 으로 명시** (PassportListView 신설 vs ArtworkGrid 확장).

##### (c) ViewModeToggle vs SidebarLocaleToggle / RoleSwitcher

**기존 정착물 패턴**:
- `RoleSwitcher.tsx` (174 LOC) — popover 패턴, 3-role
- `SidebarLocaleToggle.tsx` (140 LOC) — segmented control, 2~4 locale

**중복 검증**:
- 두 toggle 모두 *사용자 명시 클릭 → store action* 패턴 정합
- segmented control 시각 패턴 정착 (museum-safe class 답습)

**차이 영역**:
- 신설 ViewModeToggle: 2-state (Grid / Passport), 매우 단순
- 위치 결정 (사용자 §N 결정 항목 1): Sidebar header 옆 vs Grid header 옆 vs 별도

**결론**: **신설 정합** — 신설 자체는 정합 (기존 ViewMode toggle 0건). 패턴은 SidebarLocaleToggle 의 minimal segmented control 답습. 위치는 사용자 결정 영역.

##### (d) AxidVerticalDisplay vs 기존 AXID 표시

**기존 정착물**: ArtworkCard 의 `<span>{artwork.axid.code}</span>` (단순 inline)

**중복 검증**:
- AXID 세로 표기는 *시각 분리 영역* (가로 vs 세로) — 단순 CSS `writing-mode: vertical-rl` 또는 character-by-character span 으로 PassportCard 내부 inline 가능
- 별도 helper component 신설 가치 낮음 (재사용 0건 예상 — Passport spine 단일 위치)

→ **AxidVerticalDisplay 신설 폐기** 권고. PassportCard 내부 inline 처리.

#### §8 검증 결과 요약

| 가정 컴포넌트 | 검증 결과 | 결정 |
|--------------|---------|------|
| PassportCard.tsx | 시각 differentiation 본질 | ✅ 신설 |
| PassportListView.tsx | ArtworkGrid 거의 100% 복제 | 🔴 **신설 폐기, ArtworkGrid 확장** (~120 LOC 절약) |
| ViewModeToggle.tsx | 신설 정합 | ✅ 신설 |
| AxidVerticalDisplay | PassportCard 내부 inline 가능 | 🔴 **신설 폐기** (~30 LOC 절약) |

**누적 절약**: ~150 LOC (PassportListView + AxidVerticalDisplay 신설 회피).

→ **STEP 130 Phase 1 §8 (~50 LOC 절약, DocumentLocale 재활용) 패턴 답습 + 더 큰 절약 (~150 LOC)**.

### §6.3 §9 — 검증 게이트 path-specific 설계

Phase 2 Commit 별 검증 게이트 사전 설계:

| Commit | 검증 게이트 | path-specific |
|--------|------------|--------------|
| Commit 1 (PassportCard 신설) | tsc / lint / build (≤+5 kB) / tests (13/13) / diff (1 file) | `git grep "TranslationLocaleSelector\|getTitle\|getArtistName" src/` |
| Commit 2 (ArtworkGrid 확장 + ViewModeToggle) | + view mode persist 정합 검증 | `git grep "useArtworkStore" src/components/layout/` |
| Commit 3 (Phase 2 Closure doc) | tsc / lint / build / diff | `git grep -l "STEP 131" docs/steps/` |

**broad pattern 회피**:
- ❌ `grep -r ... .` (root) — `node_modules` / `.next` / `.git` 잡음
- ✅ `grep -rn ... src/` 또는 `git grep -n ... src/` — repo 영역 한정
- ✅ 단일 파일 검증: `grep -nE "..." src/lib/persistence.ts` — false positive 0

→ **5 commits 누적 0 false positive 정합 답습** (STEP 130 §9 표준 정착).

---

## §7 Phase 2 Commit 분할 사전 계획

### §7.1 권고 분할 안 — 4 commits

| # | Commit | 작업 범위 | 예상 LOC | Risk |
|---|--------|----------|---------|------|
| 1 | **Foundation** — PassportCard 신설 | `src/components/artwork/PassportCard.tsx` (신규) — 시각 + 데이터 wire (`getTitle`/`getArtistName` 첫 호출) + StatusBadge + thumbnail 정착물 활용 | +180 | 🟢 Low (신설, 호출처 0) |
| 2 | **Integration** — ArtworkGrid 확장 + ViewModeToggle | `src/components/layout/ArtworkGrid.tsx` (확장 +30/-5), `src/components/layout/ViewModeToggle.tsx` (신규 +60), `useArtworkStore.ts` (currentViewMode + setViewMode +25, P1 정합) | +110 / -5 | 🟡 Medium-Low (store + UI 동시 변경) |
| 3 | **Test scenarios** | `src/lib/__tests__/...` 또는 `src/components/...` (passport/grid 표시 회귀 검증) — option | +120~200 | 🟢 Low (test 단독) |
| 4 | **Closure** — `STEP_131_PHASE_2_COMPLETE.md` + 본 Phase 1 doc cross-ref | doc only | +400 / +2 | 🟢 Low |

### §7.2 대안 분할 안

**3 commits (간소화)**: Commit 1 + Commit 2 합침. 분할 가치 낮음 (Foundation/Integration 두 영역의 Risk profile 다름) → **권장 X**.

**5 commits (세분화)**: Commit 2 를 Grid 확장 / ViewModeToggle / store 분리. 과세분화 — 회귀 위험 미미 (store 변경 단순).

→ **4 commits 분할 권고** (Foundation + Integration + Test + Closure).

### §7.3 누적 LOC 예상

| 영역 | LOC |
|------|-----|
| 신설 코드 (PassportCard + ViewModeToggle) | ~240 |
| 기존 코드 확장 (ArtworkGrid + useArtworkStore) | ~55 |
| 신규 doc (Phase 2 COMPLETE) | ~400 |
| 기존 doc 갱신 (cross-ref) | ~2 |
| Test scenarios (선택) | ~120~200 |
| **총** | ~700~900 |

**Bundle 영향 사전 평가**:
- PassportCard (~180 LOC) — 호출처 1건 (ArtworkGrid 확장 시) → bundle +1~3 kB 예상
- ViewModeToggle (~60 LOC) — 호출처 1건 → +0.5~1 kB 예상
- ArtworkGrid 확장 (~30 LOC 추가) → +0.3~0.5 kB
- 누적 bundle Δ: **+2~5 kB** (사용자 spec 의 ≤+5 kB tolerance 정합 가능성)

---

## §8 사용자 §N 결정 항목

Phase 2 진입 전 사용자 결정 필요 — 8 항목.

### §8.1 항목 1 — View Mode 토글 위치

**선택지**:
- (A) **Sidebar header** (현 SidebarLocaleToggle 옆) — symmetric placement
- (B) **Grid header** (작품 추가 버튼 옆) — view 결정이 영역 내부 자연
- (C) 별도 floating button / fab — overengineering

**Trade-off**:
- (A): Sidebar header 폭 240px 안 KO+EN+Grid+Passport 4 toggle 동시 수용 — 매우 tight, 폭 측정 필요
- (B): Grid header 영역 자연, 폭 여유. 단 Sidebar 접근성 약함 (사용자 시선 흐름)
- (C): rule_15 ≤3 button + rule_16 minimal 위반 가능

**Claude 추천**: **(B) Grid header** — view mode 는 Grid 영역 결정사항이라 의미상 자연. Sidebar 폭 240px 제약 회피.

### §8.2 항목 2 — ArtworkCard ↔ PassportCard 공존 방식

**선택지**:
- (A) **둘 다 보존 + ViewMode 토글로 전환** (사용자가 선택)
- (B) PassportCard 가 ArtworkCard 대체 (점진 deprecate)
- (C) PassportCard 만 신설, ArtworkCard 점진 사용 중단 + 향후 STEP 에서 제거

**Trade-off**:
- (A): 운영자 선호 차이 + Phase 별 안정성. ArtworkCard 정착물 무손상.
- (B): 점진 deprecation — 회귀 위험 (Form 등 ArtworkCard 사용처 영향)
- (C): A + 의도적 deprecation 신호. 본 STEP 영역 외 (STEP 131 은 추가만)

**Claude 추천**: **(A) 둘 다 보존 + ViewMode 토글** — 운영자 선호 차이 존중 + 정착물 무손상. 향후 사용 데이터 누적 후 deprecation 결정.

### §8.3 항목 3 — PassportListView vs ArtworkGrid 확장

**선택지**:
- (A) **PassportListView.tsx 신설** (~120 LOC, ArtworkGrid 의 100% 복제 + 카드 분기)
- (B) **ArtworkGrid 확장 (view mode 분기)** — §8 표준 정합

**Trade-off**:
- (A): 두 컴포넌트 분리, 향후 PassportListView 만 변경 가능. 단 search/filter 로직 drift 위험 (수정 시 두 곳 동시 갱신 필요)
- (B): 단일 진실 원천 (search/filter), ~120 LOC 절약 (DocumentLocale 재활용 패턴 답습)

**Claude 추천**: **(B) ArtworkGrid 확장** — §8 표준 정합 (DocumentLocale 재활용 패턴), drift 위험 0, ~120 LOC 절약. 카드 분기는 1줄 (`viewMode === "passport" ? PassportCard : ArtworkCard`).

### §8.4 항목 4 — Passport Card 클릭 시 동작

**선택지**:
- (A) **기존 select 그대로 (DetailPanel 갱신)** — 운영 surface 와 동일 동작
- (B) Drawer 신설 (passport detail) — PASSPORT spec §4 의 "drawer/modal 금지" 위반
- (C) Modal expansion — PASSPORT spec §7 의 "외부 modal 금지" 위반
- (D) Passport 자체가 펼쳐짐 (In-Passport Navigation) — **STEP 133 영역**

**Trade-off**:
- (A): 본 STEP 131 = Closed Passport 만, 즉시 정합. Expanded Passport 는 STEP 133 영역
- (D): PASSPORT spec §4 정합 본질이지만 STEP 131 작업 범위 밖

**Claude 추천**: **(A) 기존 select** — 본 STEP 영역 정합. STEP 133 진입 시 (D) 로 전환 (spec §4 정착물).

### §8.5 항목 5 — D-130-1 빈 문자열 fallback 의미 결정

**선택지**:
- (A) 현 거동 (nullish `??`) 유지 — 빈 문자열은 "공란 표시" 의도로 해석
- (B) truthy 체크로 전환 — 빈 문자열은 다음 fallback 진입
- (C) **결정 보류** (STEP 134 또는 별도) — 운영자 form UI 미존재로 빈 문자열 입력 케이스 부재

**Trade-off**:
- (A): 현 정착물 0줄 변경, "공란 = 운영자 명시 의도" 일관성
- (B): i18n-helpers 1줄 변경 + scenarios §4 갱신, "공란 = 사용자 실수" 일관성
- (C): STEP 131 진입 시점 결정 데이터 부재

**Claude 추천**: **(C) 결정 보류** — Form UI 미존재 → 빈 문자열 production 데이터 발생 가능성 0. STEP 134 (AI Cultural Intelligence) 또는 별도 STEP (Form UI 신설 시점) 자연 재검토.

### §8.6 항목 6 — View Mode 선택값 persist 여부

**선택지**:
- (A) **P1 (Persistence 0)** — 세션마다 default ("grid" 또는 "passport")
- (B) Pn (localStorage persist via PersistedState 통합)
- (C) Pmid (별도 localStorage 키 — `axvela.viewmode.v1`, backupMetadata 패턴)

**Trade-off**:
- (A): currentLocale 패턴 답습 (Commit 2 정착), `PersistedState` 0줄 변경, 세션마다 default
- (B): SCHEMA_VERSION "v1" → "v2" migration 필요 (Optional Slice 패턴 적용 시 v1 유지 가능). 운영자 선호 보존
- (C): 별도 키 패턴 (backupMetadata 답습) — Persistence 정착물 무손상 + 운영자 선호 보존

**Claude 추천**: **(A) P1** — currentLocale 표준 패턴 답습 (UI session state 표준), default = "grid" (기존 정착물 우선). 향후 사용 데이터 누적 후 Pn/Pmid 로 승격 가능.

### §8.7 항목 7 — 디자인 단순화 적용 시점

**상황**: 인수인계 명시 — PASSPORT-1 디자인 정착 후 사용자 피드백 "정보 밀도 높음", 단순화 별도 STEP.

**선택지**:
- (A) 본 STEP 131 에서 단순화 적용 — 사용자 spec 위반 (별도 STEP 명시)
- (B) 별도 STEP (예: STEP 131.5) 으로 분리 — 사전 분리, Phase 2 작업 범위 안정
- (C) **PASSPORT-1 그대로 첫 wire 후 사용 후 결정** — 사용 데이터 기반 단순화 결정

**Trade-off**:
- (A): 인수인계 spec 위반 (디자인 결정 영역 사전 분리 의도)
- (B): 사전 분리, but 단순화 영역 미정 (어떤 정보를 줄일지 사용 데이터 부재 시 결정 어려움)
- (C): 사용자 피드백 기반 자연 의사결정, but 본 STEP 정착물이 단순화 시점에 변경 영향

**Claude 추천**: **(C) PASSPORT-1 그대로 첫 wire 후 사용 후 결정** — 사용 데이터 기반 자연 의사결정. 단순화는 미래 STEP 영역.

### §8.8 항목 8 — Phase 2 commit 분할 안 승인

**선택지**:
- (A) **4 commits** (Foundation / Integration / Test / Closure) — Claude 권고
- (B) 3 commits (Foundation/Integration 합침) — 과간소화
- (C) 5 commits (Integration 세분화) — 과세분화

**Trade-off**: §7.1 / §7.2 참조.

**Claude 추천**: **(A) 4 commits** — Foundation/Integration Risk profile 다름 (신설 vs 기존 확장) 분리 정합, Closure doc 정착 패턴 (STEP 130 답습).

---

## §9 Risk 평가

### §9.1 영역별 Risk

| 영역 | 사전 Risk | 근거 |
|------|----------|------|
| **UI 신설** (PassportCard) | 🟡 Medium-Low | 신설 컴포넌트 ~180 LOC, 호출처 1건 (ArtworkGrid). 회귀 위험 낮음 (additive) |
| **Data wire** (getTitle/getArtistName 첫 호출) | 🟢 Low | helper 정착물 무손상, 첫 호출처 진입 — 기존 동작 (artwork.title direct) 그대로 ArtworkCard 보존 |
| **Locale 통합** | 🟢 Low | currentLocale 구독 self-contained, currentLocale = "ko" 시 fallback chain 통과 → primary title 반환 (정합 보장) |
| **Persistence (View Mode)** | 🟢 Low (P1 채택 시) | PersistedState 0줄 변경. (B) Pn 채택 시 🟡 Medium (migration) |
| **ArtworkGrid 확장** | 🟡 Medium-Low | 기존 정착물 (135 LOC) 확장 +30 LOC, view mode 분기 1줄. 회귀 위험 낮음 (filter / store 구독 무손상) |
| **§8 표준 적용** | 🟢 Low | PassportListView 신설 폐기 + AxidVerticalDisplay 신설 폐기 (~150 LOC 절약). drift 위험 0 |

### §9.2 종합 Risk 🟢 Medium-Low (사전 평가)

영역별 Risk 누적:
- 신설 컴포넌트 1건 (PassportCard) + 신설 toggle 1건 (ViewModeToggle) — additive
- 기존 정착물 확장 1건 (ArtworkGrid +30 LOC) — minor
- helper 첫 호출처 wire — Risk Low (정착물 무손상)

→ **🟢 Medium-Low** 사전 평가 — 사용자 §N 8 항목 결정 후 Phase 2 commit 별 진입 시 정확 평가.

### §9.3 책임감 있는 멈춤 패턴 진입 조건

다음 발견 시 **즉시 진행 보류 + 사용자 확인 요청** (STEP 127~130 패턴 답습):

1. **Phase 2 Commit 진입 시 §8 표준 추가 발견** — 신설 가정 컴포넌트가 다른 정착물과 추가 중복 발견
2. **Bundle 영향 +5 kB 초과** — 사용자 spec tolerance 위반
3. **scenarios test 회귀** — 13/13 → 12/13 등
4. **신설 dependency 필요 발견** — `package.json` 변경 영역
5. **PASSPORT-1 spec 의 in-passport navigation (§7) 등 STEP 131 영역 외 의도적 wire 필요 발견**
6. **Cross-worktree state 발견** (STEP 130 패턴 답습 — 다른 worktree 에서 동일 작업 정착 발견)

→ 책임감 있는 멈춤 패턴 8 건째 누적 가능성.

---

## §10 보존 약속 (Phase 2 진입 시점)

| 보존 영역 | 약속 |
|----------|------|
| `src/types/artwork.ts` (Commit 1 정착) | 0줄 |
| `src/lib/i18n-helpers.ts` (Commit 1 정착) | 0줄 |
| `src/lib/__tests__/i18n-helpers.scenarios.ts` (Commit 1b 정착) | 0줄 |
| `src/store/useArtworkStore.ts` — `currentLocale` / `setLocale` 슬라이스 | 0줄 (View mode 슬라이스 추가는 별도 영역) |
| `src/lib/document-locale.ts` (STEP 96 정착) | 0줄 |
| `src/components/translation/*` 10 files (STEP 96) | 0줄 |
| `src/components/layout/SidebarLocaleToggle.tsx` (Commit 3 + Hotfix 정착) | 0줄 |
| `src/components/artwork/ArtworkCard.tsx` (Foundation 정착) | 0줄 (선택지 항목 2-(A) 채택 시) |
| `src/lib/persistence.ts` (SCHEMA_VERSION v1) | 0줄 |
| `package.json` (tsx devDep 미등록 유지) | 0줄 |
| AXVELA_*.md 6 영구 정책 본문 | 0줄 (인용 허용, 본문 수정 절대 금지) |
| `docs/steps/STEP_130_PHASE_2_COMPLETE.md` (Commit 4 정착) | 0줄 |
| `docs/steps/STEP_131_PHASE_1_ARCHITECTURE_REVIEW.md` (본 doc) | 0줄 (Phase 2 진입 후) |
| docs/design/passport/ git add | 0건 → **STEP 131 Phase 2 진입 시점에 git add 결정** (현 untracked 자산 정착) |

---

## §11 명시적 작업 범위 외 (STEP 131 에서 절대 금지)

| 영역 | 영역 STEP | 본 STEP 131 진입 절대 금지 |
|------|----------|-------------------------|
| **Server-side PDF 렌더링** | STEP 132 | 0건 — Closed Passport 카드만, PDF 0 |
| **Expanded Passport + In-Passport Navigation** | STEP 133 | 0건 — Closed Passport 만, 펼쳐진 상태 0 |
| **AI Cultural Intelligence** | STEP 134 | 0건 — AI 영역 진입 0, AI button / score 표시 0 |
| **Transaction Timeline + Provenance + Cross-link** | STEP 135 | 0건 — Timeline 표시 0, Provenance chain 0 |
| **Certificate surface (Ownership Certificate, QR encrypted)** | STEP 136 | 0건 — Certificate 발급 / 표시 / 진입점 0 |
| **PASSPORT spec §6 9-row Index** | STEP 133 (Expanded) | 0건 — 인덱스 9-row 정착 0 (Closed 카드 표면에 Index 표시 0) |
| **Passport open animation (hinge motion)** | STEP 133 | 0건 — 클릭 시 기존 select 패턴 (DetailPanel 갱신) 만 |

→ STEP 131 = **Closed Passport Card + List View 만** — Passport surface 첫 진입 단계, 후속 STEP 영역 모두 의도적 회피.

---

## §12 Phase 2 진입 권고

### §12.1 진입 조건

1. 본 review doc 사용자 검토 완료
2. **사용자 §8 (8 항목) 결정 완료**
3. Risk 🟢 Medium-Low 동의
4. Phase 2 commit 분할 안 승인 (§8 항목 8)
5. PASSPORT-1 spec 의 디자인 단순화 시점 결정 (§8 항목 7)

### §12.2 Phase 2 진입 후 작업 흐름

1. Phase 2 Commit 1 (Foundation) 진입 — PassportCard 신설
2. Phase 2 Commit 2 (Integration) — ArtworkGrid 확장 + ViewModeToggle + store 슬라이스
3. Phase 2 Commit 3 (Test scenarios) — 선택 (사용자 결정)
4. Phase 2 Commit 4 (Closure) — `STEP_131_PHASE_2_COMPLETE.md` + 본 doc cross-ref
5. (선택) ZIP 패키지 생성 — `AXVELA_STEP_131_PHASE_2_COMPLETE_<hash>.zip`

### §12.3 추가 사실 발견 시 책임감 있는 멈춤 패턴

각 commit 진입 시점:
- §7+§8+§9 표준 재적용 — 신규 deferred items / 신규 정착물 중복 / 신규 false positive 영역 검증
- 발견 시 즉시 진행 보류 + 사용자 확인 (STEP 127~130 패턴 답습)
- 책임감 있는 멈춤 패턴 8건째 누적 가능성

### §12.4 다음 세션 진입 가능 시점

본 Phase 1 doc commit 완료 + 사용자 §8 결정 완료 후:
- 같은 turn 에 Phase 2 Commit 1 진입 가능
- 또는 별도 turn 에 진입 (사용자 명시 신호)

---

**STEP 131 Phase 1 Architecture Review — COMPLETE ✅ (Phase 1.1 doc-only commit)**

핵심 산출:
- PASSPORT-1 디자인 정독 완료 (15 §)
- §6.2 §8 표준 적용 — **PassportListView 신설 폐기 + AxidVerticalDisplay 신설 폐기 결정 (~150 LOC 절약)**
- 사용자 §N 결정 항목 **8건** 도출
- Phase 2 commit 분할 권고 — **4 commits** (Foundation / Integration / Test / Closure)
- Risk 🟢 Medium-Low 사전 평가

Phase 2 는 사용자 §8 결정 5 항목 (위치 / 공존 / View / Persist / 분할) 이상 결정 후 별도 turn 진입.

→ **Phase 2 구현 완료**: [STEP_131_PHASE_2_COMPLETE.md](STEP_131_PHASE_2_COMPLETE.md)
