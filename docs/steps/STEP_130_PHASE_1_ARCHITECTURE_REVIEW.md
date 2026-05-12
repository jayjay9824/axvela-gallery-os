# STEP 130 — Phase 1 Architecture Review (Internationalization Layer)

**작성 시점**: 2026-05-13
**Baseline**: `278d97f` (STEP 129 완전 종결 — Invoice/Contract Write Flow + Defense in Depth + .gitattributes 정책)
**Branch**: `claude/step127-architecture-review` (STEP 127~130 연속 commit 흐름)
**작업 성격**: doc-only Phase 1 review — 코드 0줄. Phase 2 implementation 은 별도 진입.
**리스크 평가**: 🟢 **Low** (Optional Slice 10회째 답습, 정착물 재활용, dimension 분리 명확)

---

## §0 사실관계 사전 검증 로그 (Phase 1.0)

STEP 127/129 패턴 답습 + **STEP 130+ Phase 1.0 표준 §7+§8+§9 첫 적용**.

### §0.1 §7 — STEP 129 deferred items 재검토

| STEP 129 정착물 | 검증 결과 |
|---------------|----------|
| 4-layer defense (`invoiceKind` / `canRegisterPaymentFor`) | ✅ 11 files 무손상 |
| 2 PrintView (`InvoicePrintView` / `ContractPrintView`) | ✅ 정착 |
| PRE filter 3 곳 (`fiscal-summary` / `reporting-aggregates` / `documents-aggregates`) | ✅ 정착 |
| `formatAxidForDocument` helper | ✅ 정착 |
| `.gitattributes` 정책 (`*.zip export-ignore + binary`) | ✅ 정착 |

**STEP 129 deferred items 0건**. Phase 1.1 진입 안전.

### §0.2 §8 — 신설 가정 컴포넌트 중복 검증

| 신설 가정 | 검증 결과 |
|----------|----------|
| `titleI18n` / `nameI18n` / `getTitle` / `getArtistName` / `currentLocale` / `setLocale` | ❌ **부재 — 신설 안전** |
| `src/types/locale.ts` 신설 가정 | 🟡 **재활용 결정** — `src/lib/document-locale.ts` 의 `DocumentLocale` (STEP 96 정착, AILocale alias, 4-locale ko/en/ja/zh) 사용. 신설 폐기. |
| Translation Layer 정착 (`TranslationLocaleSelector` / `TranslationToolbar` / `TranslationStateView`) | ✅ **dimension 분리 확정** — runtime AI projection (각 drawer 별 local state, ephemeral cache). STEP 130 의 storage-level multilingual data 와 *별도 dimension*. |

**§8 발견 2건 → 정정 결정 1건** (`Locale` type 신설 폐기, `DocumentLocale` 재활용).

### §0.3 §9 — path-specific 검증 패턴 사용

본 Phase 1.0 의 grep 모두 path-specific:
- `src/types/` / `src/lib/` / `src/store/` / `src/components/translation/` directory 명시
- broad pattern 0건 (예: `*translation*` 단독, `*locale*` 단독 회피)
- exact keyword (`titleI18n`, `getTitle`, `Locale` type union) 사용

STEP 129 Commit 4 의 false positive 학습 (passport pattern) 답습 완료. ✅

### §0.4 종합 — Phase 1.1 진입 안전

| 표준 | 결과 |
|------|------|
| §7 deferred items | gap 0건 |
| §8 중복 검증 | 2건 발견 → 정정 1건 (Locale 폐기) |
| §9 path-specific | 정합 |

→ Phase 1.1 진입 승인 (사용자 명시 옵션 A 채택, 2026-05-13).

---

## §1 STEP 96 vs STEP 130 — Dimension 분리 확정

### §1.1 두 layer 의 책임

| 항목 | STEP 96 Translation | STEP 130 Internationalization |
|------|--------------------|-------------------------------|
| **본질** | runtime *AI projection* | storage-level *multilingual data slot* |
| **데이터** | 원본 (보통 한국어) 텍스트 1개 | artwork master record 의 다국어 텍스트 N개 |
| **변환 시점** | 출력 시점 동적 (AI API 호출) | schema-level static (영구 저장) |
| **state** | 각 drawer 별 local state (`React.useState<DocumentLocale>`) | global state slice (`currentLocale: DocumentLocale`) |
| **cache** | ephemeral session view (`React.useRef`), persistence 0 | 데이터 자체가 영구 (artwork entity 의 옵셔널 슬롯) |
| **schema 영향** | 0줄 (사용자 spec 명시 — "document entity schema 변경 0건") | titleI18n? / nameI18n? 옵셔널 슬롯 추가 |
| **사용 시나리오** | "이 invoice 본문을 영어로 보고 싶다" — buyer 안내용 동적 번역 | "이 작품의 영어 제목은 'Untitled Blue Garden'" — 영구 저장된 다국어 데이터 |

### §1.2 Two-Layer Curation Model (STEP 119) 패턴 답습

STEP 119 의 *formal entity ↔ inline data* dimension 분리 패턴이 STEP 96 ↔ STEP 130 에 자연 답습:

| Pattern | STEP 119 사례 | STEP 96 ↔ 130 사례 |
|---------|--------------|---------------------|
| 정착 layer (lifecycle 있음) | formal `CurationNote` entity (DRAFT/APPROVED/LOCKED, version chain) | STEP 96 `TranslationToolbar` (4-state machine idle/translating/translated/failed) |
| 신설 layer (lightweight) | inline `Artwork.curationDraft / artistNote / ...` (free-form, no lifecycle) | STEP 130 `Artwork.titleI18n? / Artist.nameI18n?` (optional slot, no lifecycle) |
| dimension 분리 | 정식 카탈로그 텍스트 ↔ 작품 마스터 라이트 노트 | AI 동적 번역 ↔ 영구 저장 다국어 데이터 |

**두 layer 공존 정합** — STEP 130 도입 시 STEP 96 변경 0줄.

### §1.3 미래 합류 가능성 (STEP 130+ 영역, 본 STEP scope 외)

- STEP 130 의 global `currentLocale` 이 정착 후, STEP 96 TranslationToolbar 가 *default source locale* 로 활용 가능 (현재 prop default `DEFAULT_DOCUMENT_LOCALE = "ko"` 대신 store 의 `currentLocale` 참조).
- 단, 이는 STEP 130 의 핵심 scope 아님 — *opt-in extension*, 별도 future STEP.

---

## §2 Multilingual Schema 정책 (Optional Slice 10회째)

### §2.1 옵셔널 슬롯 도입

[src/types/artwork.ts](src/types/artwork.ts) 에 추가:

```typescript
// 기존 (변경 0줄)
title: string;                                     // primary (보통 ko), backward compat
artist: Artist;                                    // artist.nameEn? 도 보존 (legacy)

// 신규 옵셔널 슬롯 — STEP 130
titleI18n?: Partial<Record<DocumentLocale, string>>;
// + Artist.nameI18n? — §5 옵션 결정 후 결정
```

**JSDoc 명시 (Optional Slice 패턴 답습)**:
- 기존 데이터 (Phase 1~STEP 129) 모두 호환 — undefined 시 `title` fallback
- validateV1 무변경 — slice 존재만 검증, 개별 entity field 비검증
- SCHEMA_VERSION "v1" 100% 유지
- helper layer 가 단일 derivation point (`getTitle`)

### §2.2 `title: string` 의 의미 lock

기존 `title: string` 의 의미 = *primary locale 의 텍스트* (보통 한국어, 갤러리 baseline).

JSDoc 으로 명시:
> "Primary locale title (default `ko`, gallery baseline). 다국어 표시 시 `titleI18n?[locale]` 우선, 미정의 시 본 field fallback. **rule_1 Physical Root Key 일관 — 영구 보존**."

STEP 127 Phase 1 §2.7 의 `axid.code` = internal id lock 패턴 답습.

### §2.3 Optional Slice 10회째 카운트

| # | STEP | 추가 슬롯 | SCHEMA_VERSION |
|---|------|----------|----------------|
| 1 | STEP 87 | `PersistedState.receipts?` | "v1" |
| 2 | STEP 89 | `PersistedState.taxInvoices?` | "v1" |
| 3 | STEP 114 | `Artwork.registrationStatus?` | "v1" |
| 4 | STEP 115 | `Inquiry.contactInfo?` | "v1" |
| 5 | STEP 117 | `PersistedState.artworkDraft?` | "v1" |
| 6 | STEP 118 | `Artwork.curationDraft / exhibitionText / artistNote / provenanceNote` (4 inline) | "v1" |
| 7 | STEP 127 | `Invoice.invoiceKind?` | "v1" |
| 8 | STEP 130 (본 STEP) | `Artwork.titleI18n?` (+ optional `Artist.nameI18n?`) | "v1" |

**카운트 정정**: STEP 127 Phase 2 COMPLETE doc 에서 "8회째" 표기는 doc-only 변경 포함 카운트. 실제 *type slot* 만 한정 시 7회 → 본 STEP 130 = **8회**. 본 doc 의 카운트 정합 (실제 type slot 기준).

### §2.4 SCHEMA_VERSION "v1" 100% 유지 보장

| 변경 | persistence 영향 | SCHEMA_VERSION |
|------|-----------------|----------------|
| `titleI18n?` 추가 (Artwork) | 0줄 (validateV1 의 artworks 슬라이스 array 검증만 — 개별 entity field 비검증) | "v1" 유지 |
| `nameI18n?` 추가 (Artist) | 0줄 동일 | "v1" 유지 |
| Helper module 신설 | 0줄 (persistence 미관여) | "v1" 유지 |
| Store currentLocale state slice | 0줄 또는 optional persistence slot (§4 분석) | "v1" 유지 |

**SCHEMA_VERSION 변경 0줄 보장** — Optional Slice 10회 연속 답습 패턴 정합.

---

## §3 Helper Layer 분석

### §3.1 시그니처 결정

```typescript
// src/lib/i18n-helpers.ts (신설, ~40 LOC)
import type { Artwork, Artist } from "@/types/artwork";
import type { DocumentLocale } from "@/lib/document-locale";

export function getTitle(artwork: Artwork, locale: DocumentLocale): string {
  return artwork.titleI18n?.[locale] ?? artwork.title;
}

export function getArtistName(artist: Artist, locale: DocumentLocale): string {
  // §5 옵션 결정 후 nameI18n? 또는 nameEn? 분기
}
```

### §3.2 Fallback chain 정책

```
locale 지정 → titleI18n?[locale] → title (primary) fallback
```

**rationale**:
- 가장 가까운 데이터 우선 (locale 명시 시 그 locale 우선)
- 부재 시 primary (보통 ko) — 운영자 baseline
- locale chain 미정착 (예: `en → ja → ko`) — 단순화 우선, 미래 확장 가능

### §3.3 단일 derivation point (STEP 127 패턴 답습)

STEP 127 `getInvoiceKind` 패턴 정확 답습:
- 호출처 모두 `getTitle(artwork, locale)` 만 호출 — `artwork.titleI18n` 직접 접근 0
- 향후 schema 변경 (e.g. titleI18n shape 진화) 시 helper 만 갱신 → 호출처 무영향
- pure function, side effect 0, tree-shake 안전

### §3.4 사용처 정의 (STEP 130 외부, 미래 STEP scope)

| 사용처 | STEP |
|--------|------|
| Closed Passport / Expanded Passport | STEP 131~133 |
| Print views | STEP 130 미적용 (점진적 적용 정책 §6) |
| Drawer system | STEP 130 미적용 (점진적 적용 정책 §6) |
| `ArtworkGrid` 검색 / 표시 | STEP 130 미적용 (현재 `title` 직접 접근) |

본 STEP 130 = helper *정착만*, 사용처 wire 는 다음 STEP.

---

## §4 Locale State Slice (Store)

### §4.1 store 정착 방식

```typescript
// src/store/useArtworkStore.ts 의 ArtworkUIState 안에 추가
interface ArtworkUIState {
  // ... 기존 fields
  currentLocale: DocumentLocale;          // default "ko" (DEFAULT_DOCUMENT_LOCALE)
}

// Actions
setLocale: (next: DocumentLocale) => void;
```

### §4.2 초기값 + reset 정책

- 초기값 = `DEFAULT_DOCUMENT_LOCALE` ("ko") — `src/lib/document-locale.ts` 재활용
- resetAllData 시 → "ko" 복귀

### §4.3 Persistence 정책 — 2 옵션

**옵션 (P1) — Persistence 0줄** (권장):
- `currentLocale` 은 *UI state* 영역 — STEP 27 persistence 의 *세션마다 초기화* 정책 답습 (role 등과 동일)
- 사용자가 매 세션 ko 시작 — 갤러리 운영자 baseline 일관
- persistence v1 boundary 변경 0

**옵션 (P2) — Optional persistence slot**:
- `PersistedState.currentLocale?` 옵셔널 슬라이스 추가
- 사용자 선택 영구 보존
- Optional Slice 패턴 1회 추가 (10 + 1 = 11회) 단, persistence 영역
- validateV1 unchanged (key required 아님)

**권장**: **옵션 (P1)** — 운영자 환경에서 locale 은 세션 시작 시 ko 시작이 자연. 다국어는 *임시 표시* 의도 (rule_5 AI-Human Loop 정합 — 명시적 trigger).

### §4.4 UI 토글 위치 — 2 옵션 (사용자 결정)

**옵션 (U1) — Sidebar header 토글 추가** (~40 LOC):
- 4-locale segmented selector (`DocumentLocale` 4개 KO/EN/JA/ZH)
- Sidebar 의 정착물 영향: header 영역 (rule_14 240px 안)
- 일관 UX — 모든 화면에서 visible

**옵션 (U2) — STEP 130 미진입, STEP 131 (Passport) 시점에 결정**:
- 본 STEP 130 = store + helper 만 정착
- UI 토글은 Passport mode 진입 시 자연 합류
- LOC ~40 절약

**권장**: **옵션 (U1)** — 사용자가 *store state 정착 직후 시각 검증 가능*. STEP 130 의 가치 명확.
- 단 *옵션 (U2) 채택 시* STEP 131 까지 locale 변경 UI 0건 → 기능 정착 visual 검증 어려움

→ **사용자 결정 필요** (§9 체크리스트).

---

## §5 Artist.nameI18n? 결정 — 3 옵션 분석

### §5.1 현재 `artist.nameEn?` 정착물 매트릭스

[STEP 128 §1.2 + 본 Phase 1.0 검증] — `nameEn?` 사용처:

| 파일 | 사용 |
|------|------|
| [src/types/artwork.ts:26](src/types/artwork.ts:26) | `Artist { name: string; nameEn?: string }` interface 정의 |
| [src/store/useArtworkStore.ts](src/store/useArtworkStore.ts) | `nameEn` field 처리 (createArtwork / updateArtwork) |
| [src/components/artwork/ArtworkFormDrawer.tsx](src/components/artwork/ArtworkFormDrawer.tsx) | "작가 영문명" 필드 입력 UI |
| [src/lib/mock-data.ts](src/lib/mock-data.ts) | seed data (실 artist 의 nameEn 채움) |
| [src/components/layout/DetailPanel.tsx](src/components/layout/DetailPanel.tsx) | 표시 |
| [src/components/layout/ArtworkGrid.tsx](src/components/layout/ArtworkGrid.tsx) | 검색 |

**6 files 정착 — 광범위 사용**.

### §5.2 3 옵션 비교

| 옵션 | nameEn? | nameI18n? | 6 files 영향 | LOC 추정 |
|------|---------|-----------|-------------|---------|
| **(c1) 병행** | 유지 | 신설 추가 (`Partial<Record<DocumentLocale, string>>`) | 0 (기존 nameEn 사용처 무변경) + getArtistName helper 가 두 슬롯 모두 읽음 | ~10 LOC |
| **(c2) deprecation** | `@deprecated` JSDoc 표시 + 유지 | 신설 (single SSOT) | nameEn? 사용처는 단계적으로 nameI18n.en 으로 migration — 본 STEP 0, 미래 STEP | ~12 LOC |
| **(c3) Artist 영역 미진입** | 유지 | 도입 안 함 | 0 | 0 |

### §5.3 옵션별 trade-off 분석

#### 옵션 (c1) — **병행** (권장)

**장점**:
- 기존 6 files 무변경 (회귀 위험 0)
- `nameEn?` 사용자가 form 에 직접 입력하던 워크플로 그대로 보존
- `getArtistName(artist, "en")` helper 가 `nameI18n.en ?? nameEn ?? name` chain 으로 정합
- 미래 ja/zh 추가 시 자연 확장 (nameI18n.ja / .zh)

**단점**:
- `Artist` interface 에 2 가지 영문명 path (nameEn 과 nameI18n.en) — 약간의 redundancy
- 운영자 mental model: "어디에 입력하지?" — JSDoc 명시 필요 ("새 nameI18n? 가 priority, legacy nameEn 은 fallback")

#### 옵션 (c2) — **deprecation**

**장점**:
- Single Source of Truth — 미래 단일 path
- nameI18n.en + nameI18n.ja + nameI18n.zh 일관

**단점**:
- `@deprecated` 후 사용처 migration 필요 — *부분 정착 상태* 위험 (STEP 130 = nameI18n 도입 + 일부 사용처 미migration)
- form 의 "작가 영문명" input 이 nameI18n.en 으로 wire 변경 — 6 files 중 일부 영향
- 사용자 입력 워크플로 변경 위험

#### 옵션 (c3) — **artist 영역 미진입**

**장점**:
- LOC 0, 위험 0
- STEP 130 = artwork.titleI18n 만 핵심
- 미래 별도 STEP 에서 artist 영역 결정 가능

**단점**:
- nameI18n? 부재 → ja/zh 작가 영문명 입력 불가 (현재도 nameEn 만이라 ja/zh 미지원, 단 STEP 130 의 자연 확장 기회 손실)
- Passport UI (STEP 131) 진입 시 artist 의 다국어 표시 미지원 — 후속 STEP 추가 부담

### §5.4 권장 — **옵션 (c1) 병행**

이유:
1. 기존 6 files 무변경 (회귀 위험 0, STEP 129 Commit 1 패턴 답습 — additive only)
2. getArtistName helper 가 *단일 derivation point* 로 두 슬롯 chain 흡수
3. 미래 점진적 SSOT 마이그레이션 가능 (STEP 130 = 도입, 미래 STEP = nameEn deprecation)
4. ja/zh 자연 확장 — Passport 디자인 자산 (한·영 매매 계약서) + 미래 다국어 확장 대응

**chain**: `nameI18n?[locale] ?? (locale === "en" ? nameEn : undefined) ?? name`

→ **사용자 결정 필요** (§9 체크리스트).

---

## §6 UI 적용 범위 — 점진적 적용 정책

### §6.1 STEP 130 적용 범위

| 영역 | STEP 130 적용 |
|------|--------------|
| `titleI18n? / nameI18n?` 옵셔널 슬롯 | ✅ 정착 |
| `getTitle / getArtistName` helper 신설 | ✅ 정착 |
| Locale state slice (`currentLocale + setLocale`) | ✅ 정착 |
| Sidebar header locale toggle UI | 🟡 **옵션 결정** (§4.4 + §9) |

### §6.2 STEP 130 미적용 (미래 STEP)

| 영역 | 적용 STEP |
|------|----------|
| Drawer system 의 title / artist 표시 wire | STEP 131+ (점진적) |
| Print view 의 다국어 출력 | STEP 132+ (한·영 dual layout, STEP 128 §3 hybrid) |
| `ArtworkGrid` 검색 + 표시 | STEP 131+ |
| `DetailPanel` 표시 | STEP 131+ |
| Closed Passport / Expanded Passport | STEP 131~135 |
| `ArtworkFormDrawer` 다국어 입력 UI | STEP 131+ (form 영역 분리 결정 필요) |

### §6.3 적용 정책 — 보존 약속

**점진적 적용**:
- STEP 130 = **infrastructure 정착만** (data slot + helper + state)
- 각 사용처 wire 는 *해당 영역의 STEP* 에서 결정 (Drawer wire = STEP 131+, Print wire = STEP 132+)
- 단일 STEP 의 광범위 변경 회피 (STEP 129 Commit 3 패턴 답습 — *단일 STEP scope 제어*)

**STEP 130 직후 visible 변화** (옵션 U1 채택 시):
- Sidebar header 의 KO/EN/JA/ZH segmented selector
- 클릭 시 `currentLocale` 변경 — but UI 자체는 변경 없음 (사용처 미 wire)
- 향후 STEP 의 *visible 확장* 안내 — "지금은 selector 만 정착, 사용처는 다음 STEP"

---

## §7 보존 약속 검증표 (9 항목)

본 STEP 130 의 결정이 9 보존 약속에 미치는 영향 정량:

| # | 보존 약속 | 영향 | 비고 |
|---|----------|------|------|
| 1 | Phase 1 Fiscal frozen (실제 정의 부재) | ☑ 영향 없음 | fiscal entity 0줄 변경 |
| 2 | rule_5 AI-Human Loop keyword | ☑ 무손상 | i18n 은 *사용자 명시 trigger* 영역 (현재 ko default, 사용자가 명시적으로 토글) |
| 3 | Persistence v1 boundary | ☑ 무손상 | SCHEMA_VERSION "v1" 변경 0, validateV1 0줄 (옵션 P1 채택 시) |
| 4 | rule_14 3-column layout | ☑ 무손상 (옵션 U2) / 🟡 sidebar header 변경 (옵션 U1) | 옵션 U1 채택 시 Sidebar 의 header 영역 작은 추가 — 240px 폭 내, 3-column layout 정합 보존 |
| 5 | STEP 117 Optional Slice 패턴 | ☑ **답습 (10회째)** | titleI18n? (+ optional nameI18n?) 정착 |
| 6 | STEP 118 ArtworkFormDrawer 4-tab over-scope | ☑ 무손상 | ArtworkFormDrawer 변경 0 (form wire 는 미래 STEP) |
| 7 | STEP 124/125 single-drawer policy | ☑ 무손상 | drawer 변경 0 |
| 8 | Image-First hierarchy (STEP 116) | ☑ 무손상 | ArtworkFormDrawer / ArtworkUploadHero 변경 0 |
| 9 | Two-Layer Curation Model (STEP 119) | ☑ **답습 (dimension 분리)** | STEP 96 runtime translation ↔ STEP 130 storage multilingual 별도 dimension 정합 |

**9/9 ☑** — 본 STEP 130 도입으로 보존 약속 위반 0건.

추가 보존 (STEP 127~129 산출물):
- STEP 127/129 4-layer defense in depth: ☑ 무손상
- STEP 96 Translation Layer: ☑ 무손상 (별도 dimension 공존)
- STEP 128 §7 revised roadmap: ☑ 정합 (본 STEP = STEP 130 첫 단계)
- STEP 130+ Phase 1.0 §7+§8+§9 표준: ☑ 첫 적용 + 자연 정착

---

## §8 Phase 2 작업 범위 (정정 후)

### §8.1 신설 파일 (2개)

| 파일 | 추정 LOC | 비고 |
|------|---------|------|
| `src/lib/i18n-helpers.ts` | ~40 | `getTitle / getArtistName` + JSDoc |
| `src/lib/__tests__/i18n-helpers.scenarios.ts` | ~90 | 5~7 scenarios (backward compat / locale 우선 / fallback chain / undefined / artist 분기 §5 옵션 별) |

### §8.2 수정 파일 (3~4개, 모두 additive only)

| 파일 | 변경 종류 | 추정 LOC |
|------|----------|---------|
| `src/types/artwork.ts` | `Artwork.titleI18n?` + (§5 옵션 c1/c2 시) `Artist.nameI18n?` 옵셔널 슬롯 + JSDoc | +15 |
| `src/store/useArtworkStore.ts` | `ArtworkUIState.currentLocale` slot + `setLocale` action + initial value + resetAllData 정합 | +25 |
| `src/lib/persistence.ts` | (옵션 P2 채택 시) `PersistedState.currentLocale?` 옵셔널 슬라이스. 옵션 P1 채택 시 0줄 | 0 or +5 |
| `src/components/layout/Sidebar.tsx` | (옵션 U1 채택 시) header 영역에 4-locale selector + setLocale wire. 옵션 U2 채택 시 0줄 | 0 or +40 |

### §8.3 LOC 추정

| 옵션 조합 | 신설 | 수정 | 합계 |
|----------|------|------|------|
| c1 + P1 + U2 (최소) | ~130 | ~40 | **~170 LOC** |
| c1 + P1 + U1 (권장) | ~130 | ~80 | **~210 LOC** |
| c2 + P1 + U1 | ~130 | ~90 | ~220 LOC |
| c3 + P1 + U1 | ~120 | ~65 | ~185 LOC |

### §8.4 Commit 분할 전략 (Phase 2)

| Commit | 작업 |
|--------|------|
| **Commit 1** Foundation | `i18n-helpers.ts` + `i18n-helpers.scenarios.ts` + Artwork.titleI18n? 슬롯 추가 + (§5 결정 따라) Artist.nameI18n? |
| **Commit 2** Store + persistence | `useArtworkStore.ts` 의 currentLocale + setLocale + (§4.3 결정 따라) persistence slot |
| **Commit 3** (옵션 U1) UI toggle | Sidebar header 의 4-locale selector wire |
| **Commit 4** Closure | scenarios runner 검증 + STEP_INDEX/HANDOFF 갱신 + ZIP (`*.zip export-ignore` 자동 적용) |

### §8.5 Risk 평가

- **🟢 Low** — additive only, 정착물 재활용, 점진적 적용 정책, helper 호출처 0 (STEP 130 시점)
- 사용처 wire 는 *미래 STEP* — STEP 130 의 production behavior 변화 0건

---

## §9 사용자 결정 필요 체크리스트

본 review 의 사용자 결정 항목:

- [ ] **§5 Artist.nameI18n? 옵션**:
  - (c1) **병행** (권장) — nameEn? 유지 + nameI18n? 신설
  - (c2) deprecation — nameEn? @deprecated + nameI18n? single SSOT
  - (c3) artist 영역 미진입 — nameEn? 만 유지

- [ ] **§4.3 Persistence 정책**:
  - (P1) **persistence 0** (권장) — UI state, 세션마다 ko 시작
  - (P2) optional persistence slot — 사용자 선택 영구 보존

- [ ] **§4.4 UI 토글 위치**:
  - (U1) Sidebar header 토글 추가 (권장) — 정착 직후 visible 검증 가능
  - (U2) STEP 130 미진입 — STEP 131 (Passport) 시점에 결정

- [ ] **§8.4 Commit 분할 전략 승인**:
  - Commit 1 Foundation / Commit 2 Store / (선택) Commit 3 UI / Commit 4 Closure
  - 또는 합쳐서 2 commit (Foundation + Store / UI + Closure)

- [ ] **§8.5 LOC 추정 + Risk 🟢 Low 인지** — Phase 2 진입 동의

---

## §10 revert / rollback 시나리오

본 review 자체는 doc-only — revert 비용 0.

| 의도 | 명령 |
|------|------|
| 본 review doc 폐기 | `git revert <commit>` 또는 doc 재작성 후 사용자 재승인 |
| 결정 옵션 변경 (예: c1 → c3) | 본 doc §5/§9 갱신, Phase 2 작업 범위 §8 재추정 |
| STEP 130 자체 보류 | STEP 128 §7 revised roadmap 의 다음 단계 (STEP 131 Closed Passport) 우선 진입 가능 |
| Phase 2 진입 후 회귀 발견 시 | Commit 별 분리 (§8.4) → 세밀 revert 가능 |

본 STEP 130 = *infrastructure 정착*, 사용처 wire 0 → Phase 2 commit 후에도 production behavior 변화 0 (helper 호출처 0). 따라서 사용자 spec 의 "추가 사실 발견 시 즉시 보류" 패턴 그대로 진입 안전.

---

## §11 다음 단계 — Phase 2 진입 조건

본 review doc 완료 + 사용자 §9 체크리스트 5 항목 결정 후:

1. Phase 2 implementation 진입 — Foundation Commit 1 부터 순차
2. 각 Commit 별 중간 분기점 보고 (STEP 129 패턴 답습)
3. 추가 사실 발견 시 즉시 진행 보류 + 사용자 확인 (STEP 127~129 패턴 답습)

**예상 turn 수**: 3~5 turn (briefing 정정 사이클 1~2건 흡수 가능성).

본 review doc 자체 = Phase 1.1 doc-only commit 으로 종결. Phase 2 는 사용자 명시 신호 후 별도 turn.
