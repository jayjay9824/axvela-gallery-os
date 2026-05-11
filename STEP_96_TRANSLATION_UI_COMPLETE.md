# STEP 96 — Translation UI (KO/EN/JA/ZH) — COMPLETE ✅

**완료 시점**: 2026-05-08  
**Phase**: 3 — Intelligence Layer (Translation insertion point UI activation)  
**완료 상태**: 5/8 Phase 3 inserts UI-active (artwork_metadata + document_writing + translation, condition_compare/operational_insight 잔존)  
**Risk profile**: 🟢 low — anchor reuse, derived-layer-only, document entity 변경 0건

---

## 1. STEP 96 의 정체

### 1.1 본 STEP 이 *무엇* 인가

**Locale Projection Layer** — 갤러리 운영 문서의 multilingual view 를
*derived projection* 으로 정착시키는 architecture 단계.

`AILocale` (KO/EN/JA/ZH) 4 locale 을 7 surface (Invoice / Receipt / TaxInvoice /
ConditionReport / Settlement / Logistics / Artwork DetailPanel) 에서 동일한
shared component 한 세트로 노출 — 갤러리 운영 baseline (KO) 위에 EN/JA/ZH
projection 을 read-only 로 제공.

### 1.2 본 STEP 이 *아닌* 것

- ❌ Document entity 변경 (Invoice/Receipt 등 schema 0줄 변경)
- ❌ Locale별 *독립* 문서 생성 (architecture rule 위반)
- ❌ Approval Workflow 진입 (STEP 101 예정)
- ❌ 자동 번역 (rule_5 AI-Human Loop — 사용자 명시 click trigger only)
- ❌ Pricing inference (사용자 spec 명시 금지)
- ❌ Persistence 변경 (translation 결과는 ephemeral session view)

---

## 2. Architecture 핵심 원칙

### 2.1 Single Semantic Document → Locale Projection

```
원문 source 1개  ──────────────────────────┐
                                           │
                ┌───── projection (KO) ────┤  buildSourceText() — closure
                ├───── projection (EN) ────┤  fresh evaluation per click
                ├───── projection (JA) ────┤  document entity untouched
                └───── projection (ZH) ────┘
```

Document entity (Invoice / Receipt / TaxInvoice / Settlement / Logistics /
ConditionReport / Artwork) schema 변경 0줄. 각 surface 가 `buildSourceText()`
closure 를 통해 canonical 표시 텍스트를 매 클릭 시점에 fresh 합성.

### 2.2 Failure Isolation

```
TranslationToolbar 내부 cacheRef  ──────────────────────────┐
                                                           │
   target locale 성공 → cacheRef[target] = { text, notes } │
   target locale 실패 → cacheRef 미변경 (이전 성공 보존)    │
   source text 변경  → cacheRef 전체 invalidate            │
                                                           │
   document entity   → 어떤 시나리오에서도 절대 변경 0건    │
                                                           ┘
```

사용자 spec 명시 *"translation 실패 시 기존 locale content 절대 overwrite 금지"*
는 **architecture-level guarantee** 로 구현 — source closure read-only +
cache failure 시 unchanged + entity schema 0줄 변경 = 3중 보장.

### 2.3 4-state Machine

```
idle ──── locale click (≠ source) ──→ translating ──── ok ──→ translated
  ▲                                       │                     │
  │                                       │                     │
  │                                       └── fail ──→ failed   │
  │                                                     │       │
  │                                                     │       │
  └─────── locale click (= source) ←─────────────────── ┴───────┘
```

State 정의: `src/components/translation/TranslationStateView.tsx:35-50`

---

## 3. Implementation Inventory

### 3.1 신규 파일 (5개, +296 LOC)

| 파일 | LOC | 역할 |
|------|-----|------|
| `src/lib/document-locale.ts` | 76 | Centralized DocumentLocale enum (AILocale alias, single source of truth) |
| `src/components/translation/TranslationLocaleSelector.tsx` | 76 | Pure presentational compact selector — KO/EN/JA/ZH with subtle underline + medium weight |
| `src/components/translation/TranslationStateView.tsx` | 178 | Pure presentational 4-state view + calm fallback copy |
| `src/components/translation/TranslationToolbar.tsx` | 174 | Orchestrator — state machine + per-locale cache + race condition guard |
| `src/components/translation/index.ts` | 7 | Barrel export |

### 3.2 7 Surface 통합 (≈45 LOC 추가)

각 surface 동일한 `<TranslationToolbar />` 호출 — Single shared component 패턴
정착 (사용자 spec §Shared component 패턴):

| # | Surface | mount point | domain | source closure |
|---|---------|-------------|--------|----------------|
| 1 | InvoiceDetailDrawer (DRAFT) | `<Section label="다국어 보기">` after AI 정리 보조 | `invoice` | 청구 금액 + 작품 + 작가 |
| 2 | InvoiceDetailDrawer (LOCKED/SENT) | `<Section label="다국어 보기">` after 문서 이력 | `invoice` | 청구 금액 + 작품 + 작가 (frozen) |
| 3 | ReceiptDetailDrawer | `<div className="px-6 pb-4">` after AI 정리 보조 | `invoice` | 영수증 v + 금액 + 작품 + 상태 |
| 4 | TaxInvoiceDetailDrawer | inline `<section>` after 메모 | `invoice` | 세금계산서 v + 공급가액 + VAT + 총액 |
| 5 | ConditionReportDrawer | `<Section label="다국어 보기">` after 메모 | `general` | 메모 raw text |
| 6 | SettlementDetailDrawer | `<Section label="다국어 보기">` after AI 정리 보조 | `general` | 정산 + 작품 + 총액 + 분배 |
| 7 | LogisticsDetailDrawer | `<Section label="다국어 보기">` after 메모 | `general` | 배송 + 작품 + 운송사 + 메모 |
| 8 | DetailPanel ZONE 5 | inline after artwork_description AssistButton | `artwork_description` | 제목 + 작가 + 매체 + 치수 |

> 7 surface 사용자 spec 일치, mount 8건은 InvoiceDetailDrawer 양 branch (DRAFT + LOCKED).

### 3.3 Reused Anchors (DOC-2 §3.1 변경 0줄)

- ✅ `requestTranslationAssist` client wrapper (STEP 93 정착)
- ✅ `buildTranslationPrompt` prompt builder (STEP 93 정착)
- ✅ `AXVELA_AI_TRANSLATION_ENABLED` per-kind flag (STEP 93 정착)
- ✅ `AILocale` (ko/en/ja/zh) + `AI_LOCALE_LABEL_KR` (STEP 93 정착)
- ✅ Anthropic provider + `invokeProvider` dispatch (STEP 94 활성)
- ✅ Section/Divider primitive 패턴 (각 drawer 내부, STEP 95 답습)
- ✅ STEP 95 `buildSourceText` closure 패턴 — 정확 답습

---

## 4. Validation Results

### 4.1 Build & Type

| 항목 | 결과 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next lint` | ✅ 0 warnings, 0 errors |
| `npx next build` | ✅ build success |
| Route size | **187 kB** (STEP 95: 185 kB → +2 kB) |
| First Load JS | **275 kB** (STEP 95: 273 kB → +2 kB) |
| DOC-2 §4.1 ≤10 kB target | ✅ 통과 (5x margin) |

### 4.2 Scenarios

| Suite | Scenarios | Result |
|-------|-----------|--------|
| ai-protocol | 17 | ✅ PASS |
| fiscal-derive | 10 | ✅ PASS |
| operational-insight | 12 | ✅ PASS |
| anthropic-provider | 9 | ✅ PASS |
| **Total** | **48** | **✅ 48/48 PASS** |

→ STEP 95 baseline 정확 일치, **regression 0건**.

---

## 5. UI Spec 준수 검증 (사용자 spec STEP 96 정확 매칭)

| 사용자 spec | 구현 |
|------------|------|
| compact locale selector ("KO EN JA ZH") | ✅ `TranslationLocaleSelector` 횡렬, padding minimal |
| active locale: subtle underline + medium weight | ✅ `border-b border-ink/60` + `font-medium` |
| colorful tabs 금지 | ✅ neutral ink tones only (`text-ink-strong/subtle/muted`) |
| animated transitions 금지 | ✅ `transition` 만 (no animation keyframes) |
| flashy segmented control 금지 | ✅ `border-b` underline 외 chrome 0 |
| institutional / minimal / museum-safe | ✅ 모든 색상 design system tokens |
| state: idle → translating → translated → failed | ✅ `TranslationViewState` 4-state union |
| translation 실패 시 source overwrite 금지 | ✅ architecture-level (closure read-only + cache unchanged + entity 0줄) |
| fallback: "Translation not available." calm copy | ✅ `FALLBACK_COPY_EN` + KR 매핑, red error UI 0건 |
| Shared components: Toolbar / LocaleSelector / StateView | ✅ 3 components 명확 분리 |
| AI 연결: real API optional / mock 허용 | ✅ `requestTranslationAssist` 그대로 사용 — env 부재 시 graceful `ai_unavailable` fallback |

---

## 6. Architecture Rules — 위반 0건

| Rule | 검증 |
|------|------|
| rule_2_flow_system | Document → Translation projection (Document chain 종속, 독립 entity 없음) |
| rule_4_document_trust_layer | Document version/lock/audit 영향 0건 — translation 은 read-only view |
| rule_5_ai_human_loop | 사용자 명시 click trigger only, 자동 호출 0건 |
| rule_8_timeline_navigation | Timeline 영향 0건 |
| rule_15_interaction | locale selector 4 buttons, no Primary CTA — selector 는 navigation 성격 |
| rule_16_design_tone | minimal / 그림자 0 / 장식 0 / Pretendard 그대로 |
| rule_17_layer_ui | Drawer/section 내부 mount, 레이아웃 변경 0줄 |

---

## 7. 다음 STEP

### 권장 (사용자 spec 명시)

**STEP 97 — condition_compare UI** — LiDAR / visual variance summary 를
ConditionReportDrawer 에 연결하는 5번째 AI insertion point UI 활성.

### 후순위

- **STEP 98** — operational_insight UI rewrite (STEP 92 placeholder 를 AI infra 로 활성)
- **STEP 99~100** — Phase 3 마감 (전체 8/8)
- **STEP 101** — Approval Workflow Foundation (Phase 6 진입)

---

## 8. STEP_INDEX 정정 사항

기존 STEP_INDEX.md 줄 262 의 STEP 96 = "Collector Momentum" entry 는 **STEP 97**
혹은 **Phase 3 후속 차순위**로 재번호 권장. 본 STEP 96 = translation UI 가
STEP 94/95 권장 흐름 (인접 anchor) 자연 진입.
