# AXVELA Gallery OS — Session Handoff

> **작성**: 2026-05-12 (STEP 129 완료 시점 갱신 — Invoice/Contract Write Flow + 4-layer Defense in Depth 정착, **Phase 4 Stage 3 Implementation 진행 중**)
> **이전 갱신**: 2026-05-12 (STEP 128 Phase 1 — AXVELA PASSPORT Architecture Review doc-only) / 2026-05-08 (STEP 118 — Phase 4 Stage 2 2/3)
> **목적**: 새 채팅 세션 / VS Code 작업 환경에 컨텍스트 전달
> **다음 채팅에서**: 본 파일을 읽기 전에 `STEP_INDEX.md`를 우선 참조 — STEP 분류 / 상태 / 중복 방지 / Do Not Duplicate guard 모두 거기에. Multi-STEP 세션 진입 시 **`AXVELA_DEV_CONVENTION.md`의 §2 Partial-State Rules의 7-step checklist를 *항상* 실행**. **Phase 4 진행 중 진입 시 `AXVELA_WORKFLOW_ARCHITECTURE.md` §4 Implementation Constraints 가 1차 reference**.

---

## 🎯 현재 상태

```
Build:          ✅ green (npx next build, tsc --noEmit, next lint, 93/93 scenarios PASS)
Route:          195 kB / 282 kB First Load JS  (STEP 129 +4 kB from STEP 128 — 2 PrintView + 5 helpers + 4-layer guard 자연 비용, ±10 kB tolerance 내)
Last STEP:      STEP 129 (Invoice/Contract Write Flow + 4-layer Defense in Depth) ✅
Latest ZIP:     axvela-step129-invoice-contract-flow.zip
Phase 1 Fiscal: ✅ 6/6 frozen (foundation freeze)
Phase 3 Intel:  ✅ 5/8 (STEP 92~96)
Phase 4 WF:     🟡 8/N (STEP 113~119 + 124~128 — Stage 1 ✅ / Stage 2 ✅ / Stage 3 진행 중)
영구 정책 문서: 7개 (AXVELA_AI_DIRECTION / AXVELA_AI_INTEGRATION / AXVELA_DEV_CONVENTION / AXVELA_FISCAL_ARCHITECTURE / AXVELA_TRUST_LAYER / AXVELA_WORKFLOW_ARCHITECTURE + STEP_INDEX navigation)
UX track:       ✅ 3/3 완성

# STEP 129 완전 종결 — 사용자 spec #5 (인보이스/계약서 작성 flow) 100% 충족
# 4-Layer Defense in Depth 완성 (a)(b)(c)(d) — rule_3 Money Flow Separation 보장
# 다음 STEP 진입 — STEP 130 entry briefing (Internationalization Layer, Optional Slice 10회째 titleI18n? + getter helper)
# STEP 130+ Phase 1.0 표준 추가: §7 "이전 STEP deferred items 재검토" + §8 "신설 가정 컴포넌트가 worktree 의 기존과 기능 중복 검증" + §9 "검증 게이트 패턴은 path-specific 사용 (broad pattern false positive 회피)" — STEP 129 self-reflection 채택
# .gitattributes 정책 정착 — *.zip export-ignore (recursive bloat 영구 차단). 이전 STEP 127/128 ZIP 의 git rm --cached 정리는 별도 cleanup STEP
# STEP 127~129 commit chain (75e300b 부터 8 commits) main push 대기
# PASSPORT 디자인 자산 (docs/design/passport/PASSPORT-1.png + PASSPORT-1_SPEC.md) untracked 보존 — STEP 131 진입 시 git add
```

---

## 📋 최근 STEP 진행 흐름

```
14. STEP 93              AI Integration Protocol — Lightweight Skeleton
15. STEP 94              AI Provider Client + UI Integration
16. STEP 95              AI Document Writing UI Integration
17. STEP 96              AI Translation UI Integration (Phase 3 5/8)
18. STEP 113             Terminology Reframe + Workflow Foundation (Phase 4 entry)
19. STEP 114             ArtworkRegistrationStatus Enum Foundation (Phase 4 2/10)
20. STEP 115             Contact Structure Foundation (Phase 4 3/10)
21. STEP 119             Curation Connected Data (Phase 4 4/10, 🎉 Stage 1 완성)
22. STEP 116             Image-First Registration Hero (Phase 4 5/10, Stage 2 entry)
23. STEP 118             Registration Tabs Structure ⭐ 방금
                         (4-tab + STEP 119 functional 진입, Stage 2 2/3, +1 kB, 5 신규 scenarios)
```

---

## 🚦 Phase 4 진행 시 핵심 원칙 (절대 위반 금지)

`AXVELA_WORKFLOW_ARCHITECTURE.md §4` 의 8 영구 원칙:

```
1. Additive only                    (기존 entity schema 변경 0줄)
2. Optional slot priority           (모든 신규 field 는 ?: T)
3. Persistence schema hard migration 금지  (SCHEMA_VERSION "v1" 유지)
4. Draft-safe 구조                  (drawer 닫혀도 workflow 보존)
5. Backward compatibility           (기존 데이터 강제 변환 0건)
6. Build green at all times         (partial-state 진입 금지)
7. Worktree 생성 금지               (현재 열린 project만 직접 수정)
8. AI integration 우선순위 아님     (Phase 4 한정 — Claude API 신규 연결 금지)
```

**STEP 121 critical protection** (Phase 1 Fiscal 영향):
- 기존 invoice DRAFT/SENT/PAID state machine 절대 변경 금지
- 추가 허용: `invoiceKind?: "pre" | "final"` optional slot, UI label distinction
- 추가 금지: required field / persistence migration / state machine rewrite

---

## 🚀 AI 테스트 진입 가이드 (STEP 94 + 95 + 96 정착으로 활성 가능)

> **Phase 4 진행 중에는 AI integration 신규 작업 금지**. 단, *기존* AI infra (STEP 93~96) 는 그대로 작동 — `.env.local` 만 설정하면 활성.

`.env.local`:
```
AXVELA_AI_ENABLED=true
AXVELA_AI_PROVIDER=anthropic
AXVELA_AI_API_KEY=sk-ant-...
AXVELA_AI_ARTWORK_METADATA_ENABLED=true
AXVELA_AI_DOCUMENT_WRITING_ENABLED=true
AXVELA_AI_TRANSLATION_ENABLED=true
```

→ `npm install && npm run dev`. AI 미설정 시 graceful fallback ("담당자 검토 필요" / "Translation not available." calm copy), workflow 정상 진행.

---

## 🛡️ 영구 정책 문서 (7개)

| 문서 | 역할 | 정착 STEP |
|---|---|---|
| `STEP_INDEX.md` | navigation layer (STEP 분류 / 상태 / Do Not Duplicate) | DOC-1 |
| `AXVELA_AI_DIRECTION.md` | AI / Market Intelligence 정책 (rule_5 source) | (legacy) |
| `AXVELA_FISCAL_ARCHITECTURE.md` | Fiscal Layer 4-Tier 구조 (Phase 1 frozen 6/6) | STEP 86~91 |
| `AXVELA_TRUST_LAYER.md` | Approval Workflow / Trust Layer (Phase 6) | reserved |
| `AXVELA_DEV_CONVENTION.md` (DOC-2) | Development Operating Convention | DOC-2 |
| `AXVELA_AI_INTEGRATION.md` | AI Integration Architecture (5 insertion points) | STEP 93 |
| **`AXVELA_WORKFLOW_ARCHITECTURE.md`** ⭐ | **Phase 4 Workflow Foundation** (Identity / Single SoT / Workflow / Constraints / Terminology / Roadmap) | **STEP 113 (방금)** |

---

## 🚀 다음 작업 후보 (STEP 118 정착 후 — Stage 2 마지막 STEP 진입)

### 진행 상태
- 🎉 Stage 1 완성 (4/4): 113 ✅ → 114 ✅ → 115 ✅ → 119 ✅
- 🟡 Stage 2 진행 중 (2/3): 116 ✅ → 118 ✅ → **117** (다음)
- Stage 3 대기: 120 → 121 → 122 wrap

### 🅐 STEP 117 — Draft / Resume System (권장 자연 진입, Stage 2 마지막)
`artworkDraft` persistence slice + Sidebar "임시 저장" entry + `lastEditedAt` timestamp + Resume CTA. Drawer 닫혀도 workflow 보존 (Phase 4 §4.4 draft-safe 핵심 영역).
~250 LOC, 🟡 mid risk (persistence slice 추가 + Sidebar 변경).

### 🅑 Stage 3 직접 진입 (대안)
- STEP 120: Hold State Foundation (~200 LOC)
- STEP 121: Invoice PRE/FINAL Distinction (~150 LOC, ⚠️ Phase 1 Fiscal protection critical)
- STEP 122: Workflow Sequence Visualization (~100 LOC, Phase 4 wrap)

### 🅒 Phase 6 (STEP 101 — Approval Workflow)
Phase 4 마감 후 권장.

---

## ⚠️ 새 채팅 / VS Code 환경에서 주의할 것

1. **`STEP_INDEX.md` 우선** — Phase 4 section 추가됨, 다음 STEP 결정.
2. **`AXVELA_WORKFLOW_ARCHITECTURE.md` §4 Implementation Constraints** — Phase 4 진행 중 1차 reference.
3. **Phase 4 진행 중 AI integration 신규 작업 금지** — 위 §4.8 명시.
4. **STEP 118 정착 완료 — 재구현 금지**:
   - `src/components/ui/TabBar.tsx` (generic tab navigation primitive, N-tab 자유, aria-selected, rule_16 minimal)
   - `src/store/useArtworkStore.ts` `ArtworkInput` 의 5 optional curation fields (description? / curationDraft? / exhibitionText? / artistNote? / provenanceNote?) + create/update action pass-through
   - `src/components/artwork/ArtworkFormDrawer.tsx` 의 4-tab structure (TabKey + TAB_DEFINITIONS + activeTab state + 5 curation state hooks + 4-tab JSX 재배치 + CurationTextField helper inline component)
   - `src/lib/__tests__/artwork-input-curation-fields.scenarios.ts` (5 scenarios)
5. **STEP 116 정착 완료 — 재구현 금지**:
   - `src/components/artwork/ArtworkUploadHero.tsx` (신규 visual wrapper for ArtworkImageUpload, empty/filled state 분기, KR/EN bilingual hint)
   - `src/components/artwork/ArtworkFormDrawer.tsx` 의 hierarchy 재배치 (AXID → Hero → RemoveFromStorageAction → 기본정보 → 작품정보 → 거래, 기존 "썸네일" FormSection 제거됨)
   - 기존 `ArtworkImageUpload.tsx` (380 LOC) 변경 0줄 — Hero wrapper 가 위임만
5. **STEP 119 정착 완료 — 재구현 금지**:
   - `src/types/artwork-curation-data.ts` (5 keys union + KR/EN labels + 2 type guards + hasAnyCurationData / collectCurationData helpers)
   - `src/types/artwork.ts` 의 5 optional inline fields (description? / curationDraft? / exhibitionText? / artistNote? / provenanceNote?)
   - `src/lib/__tests__/artwork-curation-data.scenarios.ts` (6 scenarios)
6. **STEP 115 정착 완료 — 재구현 금지**:
   - `src/types/contact.ts` (ContactInfo 6 optional fields + PreferredContactMethod 보수적 v1 enum + KR/EN labels + isPreferredContactMethod / isContactInfo type guards)
   - `src/types/inquiry.ts` 의 `Inquiry.contactInfo?: ContactInfo` optional slot + `contact: string` `@deprecated` marker
   - `src/lib/__tests__/contact.scenarios.ts` (6 scenarios)
7. **STEP 114 정착 완료 — 재구현 금지**:
   - `src/types/artwork-registration-status.ts` (10-state union + KR/EN labels + type guard + nextRegistrationStatus helper)
   - `src/types/artwork.ts` 의 `Artwork.registrationStatus?: ArtworkRegistrationStatus` optional slot
   - `src/lib/__tests__/artwork-registration-status.scenarios.ts` (7 scenarios)
8. **STEP 113 정착 완료 — 재구현 금지**:
   - `AXVELA_WORKFLOW_ARCHITECTURE.md` (7번째 영구 정책)
   - 9 코드 파일의 terminology replacement (정확한 위치는 STEP 113 완료 doc 참조)
9. **STEP 96 정착 완료 — 재구현 금지** (Translation UI):
   - `src/lib/document-locale.ts`
   - `src/components/translation/` (Toolbar / LocaleSelector / StateView / index)
   - 7 surface mounts
10. **STEP 95 정착 완료 — 재구현 금지** (Document Writing UI):
    - `src/components/document/DocumentWritingAssistButton.tsx`
11. **STEP 94 정착 완료 — 재구현 금지** (Provider activation):
    - `src/lib/ai/providers/anthropic.ts`
    - `src/lib/ai/invoke.ts`
    - `src/components/artwork/ArtworkAIAssistButton.tsx`
12. **STEP 93 정착 완료 — 재구현 금지** (AI infra protocol):
    - `src/lib/ai/types.ts` / `config.ts` / `prompts.ts` / `client.ts`
    - `src/app/api/ai-assist/route.ts`
13. **rule_5 / AI-Human Loop architectural keyword 절대 변경 금지** — STEP 113 에서 40+17 references 보존 verified. 향후 STEP 진입 시에도 동일.
14. **persistence v1 schema 보존** — `SCHEMA_VERSION = "v1"`, `validateV1` 변경 0줄. Phase 4 신규 slot 모두 optional.
15. **Phase 1 Fiscal frozen 6/6 보존** — STEP 86~91 변경 0줄 유지. STEP 121 진입 시 Phase 1 protection clause 절대 준수.
16. **Identity vs Contact channels dimension 분리 보존** — `Inquiry.collectorName` (identity, required) 와 `Inquiry.contactInfo?` (channels) 분리.
17. **Two-Layer Curation Model 보존** — `CurationNote` (formal document, lifecycle) 와 Artwork inline curation fields (free-form, 별도 lifecycle 없음) 의 dimension 분리. CurationNote entity 변경 절대 금지.
18. **Image-First Hierarchy 보존** — ArtworkFormDrawer 최상단에 ArtworkUploadHero, 기존 "썸네일" FormSection 부재. 향후 STEP 118 Tabs 진입 시에도 Tab 1 "Images" 가 본 Hero 흡수 권장.

---

## 📁 핵심 파일 위치

```
영구 정책 문서 (7개):
  STEP_INDEX.md
  AXVELA_AI_DIRECTION.md
  AXVELA_FISCAL_ARCHITECTURE.md
  AXVELA_TRUST_LAYER.md
  AXVELA_DEV_CONVENTION.md
  AXVELA_AI_INTEGRATION.md
  AXVELA_WORKFLOW_ARCHITECTURE.md  ⭐ (STEP 113 신규)

STEP 118 산출물:
  src/components/ui/TabBar.tsx                                          (~85 LOC, generic tab primitive)
  src/store/useArtworkStore.ts                                          (+~25, ArtworkInput 5 optional curation fields + create/update pass-through)
  src/components/artwork/ArtworkFormDrawer.tsx                          (+~150, 4-tab + activeTab state + 5 curation state + JSX 재배치 + CurationTextField helper, logic 0줄)
  src/lib/__tests__/artwork-input-curation-fields.scenarios.ts          (~245 LOC, 5 scenarios)
  STEP_118_REGISTRATION_TABS_STRUCTURE_COMPLETE.md

STEP 116 산출물:
  src/components/artwork/ArtworkUploadHero.tsx                          (~165 LOC, visual wrapper, empty/filled state, KR/EN bilingual hint)
  src/components/artwork/ArtworkFormDrawer.tsx                          (-40/+40, JSX hierarchy 재배치, logic 0줄)
  STEP_116_IMAGE_FIRST_REGISTRATION_HERO_COMPLETE.md

STEP 119 산출물:
  src/types/artwork-curation-data.ts                                     (~155 LOC, 5 keys union + KR/EN labels + type guard + hasAnyCurationData / collectCurationData helpers)
  src/types/artwork.ts                                                    (+~30 LOC, 5 optional inline fields flatten)
  src/lib/__tests__/artwork-curation-data.scenarios.ts                   (~310 LOC, 6 scenarios)
  STEP_119_CURATION_CONNECTED_DATA_COMPLETE.md

STEP 115 산출물:
  src/types/contact.ts                                                   (~165 LOC, ContactInfo + PreferredContactMethod + KR/EN labels + 2 type guards)
  src/types/inquiry.ts                                                   (+~30 LOC, contactInfo? optional slot + @deprecated marker on contact)
  src/lib/__tests__/contact.scenarios.ts                                 (~280 LOC, 6 scenarios)
  STEP_115_CONTACT_STRUCTURE_FOUNDATION_COMPLETE.md

STEP 114 산출물:
  src/types/artwork-registration-status.ts                              (~155 LOC, 10-state enum + KR/EN labels + type guard + nextRegistrationStatus helper)
  src/types/artwork.ts                                                   (+~16 LOC, registrationStatus? optional slot)
  src/lib/__tests__/artwork-registration-status.scenarios.ts            (~270 LOC, 7 scenarios)
  STEP_114_ARTWORK_REGISTRATION_STATUS_COMPLETE.md

STEP 113 산출물:
  AXVELA_WORKFLOW_ARCHITECTURE.md (~440 LOC, 8 sections)
  STEP_113_TERMINOLOGY_AND_WORKFLOW_FOUNDATION_COMPLETE.md
  + 9 코드 파일 텍스트 reframe (12 lines):
    src/components/ui/ButtonHint.tsx               (AI_DRAFT_AFFORDANCE const + comment)
    src/components/contract/ContractDetailDrawer.tsx (DRAFT banner)
    src/components/curation/CurationDraftDrawer.tsx  (DRAFT banner)
    src/components/artwork/ArtworkFormDrawer.tsx    (text + comment)
    src/components/layout/DetailPanel.tsx           (doc-comment)
    src/types/contract.ts                            (REVIEW status docstring)
    src/store/useArtworkStore.ts                    (2 JSDocs)
    src/lib/utils.ts                                 (3 mock seed strings)
    src/lib/mock-data.ts                            (mock seed + comment)

STEP 96 산출물 (재확인용):
  src/lib/document-locale.ts
  src/components/translation/* (4 files)

STEP 95 산출물:
  src/components/document/DocumentWritingAssistButton.tsx

STEP 93~94 산출물:
  src/lib/ai/types.ts / config.ts / prompts.ts / client.ts / invoke.ts
  src/lib/ai/providers/anthropic.ts
  src/app/api/ai-assist/route.ts
  src/components/artwork/ArtworkAIAssistButton.tsx
```

---

## 🧭 Phase / Track Progress

```
UX track          ✅ 3/3 완성  (UX-1 + UX-2 + UX-3)
Phase 1 Fiscal    ✅ 6/6 완성  (STEP 86 + 87 + 88 + 89 + 90 + 91, foundation freeze)
Phase 3 Intel     🟡 5/8       (STEP 92~96 정착, 97~100 reserved)
Phase 4 Workflow  🟡 6/10      (STEP 113 + 114 + 115 + 119 + 116 + 118 — 🎉 Stage 1 + Stage 2 진행 중 2/3)
  🟡 STEP 117  Draft / Resume System (~250 LOC, 🟡 mid) — Stage 2 마지막 (권장)
  🟡 STEP 120  Hold State Foundation (~200 LOC) — Stage 3
  🟡 STEP 121  Invoice PRE/FINAL Distinction (~150 LOC) — Stage 3, ⚠️ Phase 1 protection
  🟡 STEP 122  Workflow Sequence Visualization (~100 LOC) — Phase 4 wrap
Phase 6 Approval  🟡 0/12      (STEP 101~112 reserved)
```

**Phase 4 Stage 진행 권장 순서**:
```
Stage 1 (Foundation, lowest risk):  113 ✅ → 114 ✅ → 115 ✅ → 119 ✅  🎉 완성 (4/4)
Stage 2 (UI Restructure):           116 ✅ → 118 ✅ → 117                ← 진행 중 (2/3)
Stage 3 (Transaction Flow):         120 → 121 → 122 wrap
```

**Phase 3 AI insertion points (참고)**:
```
92  operational_insight (deterministic placeholder)
93  protocol skeleton + 5 insertion points
94  artwork_metadata UI (anthropic provider 활성)
95  document_writing UI (1 component × 6 surfaces)
96  translation UI (1 component × 7 surfaces, KO/EN/JA/ZH locale projection)
```

---

## 📝 STEP 113 핵심 변경 요약

### Track A — Terminology (UI tone reframe)
- `인간 검토` → `담당자 검토` (UI banner, mock seed)
- `인간 승인` → `담당자 승인` (mock seed, comment)
- `Submit DRAFT for human review` → `Submit DRAFT for staff review` (JSDoc)
- `인간 검토자에게 제출됨` → `담당자에게 제출됨` (docstring)

### Track B — 7번째 영구 정책 문서
- `AXVELA_WORKFLOW_ARCHITECTURE.md` 신규 (~440 LOC, 8 sections)
- AXVELA = Artwork-Centric OS, NOT SaaS/CMS/CRM/AI App
- Single Source of Truth: Artwork master record
- 8 영구 implementation constraints
- STEP 113~122 Phase 4 roadmap
- STEP 121 Phase 1 Fiscal protection clause

### 보존 (절대 변경 안됨)
- `rule_5` — 40 references intact
- `AI-Human Loop` — 17 references intact
- Phase 1 Fiscal frozen 6/6 — 0줄 변경
- AI infra (STEP 93~96) — 0줄 변경
- Persistence schema v1 — 0줄 변경

---

## 🚨 정책 예외 적용 기록

> 14_PERMANENT_POLICIES.md §10.3 정합 — frozen STEP 또는 영구 정책에 대한 명시 승인 예외를 영구 보존하는 영역.
> 새 예외는 본 섹션 상단에 시간순 역순으로 추가 (가장 최신이 위).

---

### STEP 132.6 — Box 14.2: AI_DEFAULTS.topP 추가 예외 (route caller-side chain)

- **적용 일시**: 2026-05-15
- **STEP**: STEP 132.6 Box 14.2 — frozen §8 추가 예외 (route caller-side chain 정합화)
- **위반 정책**: 14_PERMANENT_POLICIES.md §8 영구 정착 STEP 목록 — "AI Protocol — config.ts (AI_DEFAULTS 상수)" frozen
- **수정 위치**: `src/lib/ai/config.ts`
  - line 169: `AI_DEFAULTS.topP: 0.9` → `topP: undefined` + 주석 1줄
  - 합계: 순 +1 LOC, `AI_DEFAULTS` 객체 shape 무변경 (`as const` 보존)
- **위반 사유**: Box 11 의 `callAnthropic` conditional 패턴 fix 가 production AI 호출 path 에서 무력화됨. `route.ts:347` 의 `topP: AI_DEFAULTS.topP` 명시 전달 + `invoke.ts:76` 의 destructuring default `topP = AI_DEFAULTS.topP` 로 인해 caller chain (route → invoke → callAnthropic) 이 `top_p=0.9` 를 강제 전송 → `claude-sonnet-4-6` HTTP 400 invalid_request_error 재발 예상.
- **위반 영향 분석**:
  - 시스템 정체성: ❌ 0 (단순 default 상수 값 변경, AI 의도 / 4 역할 / fail-close 정책 무변경)
  - 호출자 (caller) 영향: ❌ 0 (`AnthropicCallOptions.topP?: number` 와 `undefined` literal 호환)
  - `AI_DEFAULTS` shape: ✅ 무변경 (`as const`, 4 fields 그대로)
  - 함수 signature / export: ❌ 0 변경
  - Backward Compatibility (§9.1): ✅ 100% 정합
  - Build Green (§9.4): ✅ `npx tsc --noEmit` 0 errors
- **승인 경로**: STEP 132.6 Box 14.1 정찰 발견 → Box 14.2 박진휘 분 명시 승인 (옵션 B — AI_DEFAULTS.topP 단일 fix)
- **대안 검토 (각 옵션과 기각 사유)**:
  - (A) `route.ts:347` + `invoke.ts:76` 두 곳 fix: 2 곳 추가 예외 필요, 동일 효과
  - (B) `AI_DEFAULTS.topP = undefined` 단일 fix: ✅ 채택 — single source of truth, 가장 깨끗
  - (C) 시연 우회 (ping 직접 호출): UI 시연 불가능
  - (D) 보류: STEP 132.6 본 목표 (라이브 시연) 진입 불가
- **검증 결과**:
  - ping v5 (route caller-side chain 재현) — HTTP 200 + "PONG" ✅
  - 라이브 시연 (Box 15.x) — `POST /api/ai-assist` 4회 연속 HTTP 200 OK ✅
  - 응답 시간: 4~5 초 (Material 정규화 시연)
  - **Commit reference: `c19ecab`**
- **재발 방지**:
  - `AI_DEFAULTS` 의 다른 필드도 신모델 정책 변경 시 동일 §10.3 절차 적용 (옵션 제시 → 박진휘 분 승인 → 영구 기록).

---

### STEP 132.6 — frozen §8 "AI Provider" 예외 적용

- **적용 일시**: 2026-05-15
- **STEP**: STEP 132.6 AI-ACTIVATE-1
- **위반 정책**: 14_PERMANENT_POLICIES.md §8 영구 정착 STEP 목록 — "AI Provider — anthropic.ts / invoke.ts / 4-step guard" frozen
- **수정 위치**: `src/lib/ai/providers/anthropic.ts`
  - line 101-103: destructuring default `topP = 0.9` → `topP = undefined` + 주석 1줄
  - line 110-126: request body 를 const 분리 + `if (topP !== undefined && topP !== null)` conditional 분기 (5 LOC 추가)
  - line 137: `body: JSON.stringify(requestBody)` 변수 참조로 전환
  - 합계: 순 +5 LOC, 함수 외부 영향 0
- **위반 사유**: Anthropic Messages API 가 신모델 (claude-sonnet-4-6+) 부터 `temperature` 와 `top_p` 동시 전송 거부 (HTTP 400 invalid_request_error). AI Provider STEP frozen 시점의 정책과 Anthropic API 현행 정책 불일치. STEP 132.6 의 AI 활성화 검증 (ping PONG) 진입 불가 상태.
- **위반 영향 분석**:
  - 시스템 정체성: ❌ 0 (단순 API 정합성 fix, 4 역할 / 4 단계 파이프라인 / fail-close 정책 모두 무변경)
  - 호출자 (caller) 영향: ❌ 0 (AnthropicCallOptions.topP 가 이미 `?: number` optional, 기존 호출자 무손상)
  - 함수 signature / export: ❌ 0 변경
  - 함수 외부 동작 (성공/실패 path): ❌ 0 변경
  - Backward Compatibility (§9.1): ✅ 100% 정합
  - Build Green (§9.4): ✅ `npx tsc --noEmit` 0 errors
- **승인 경로**: STEP 132.6 박스 11 — 박진휘 분 명시 승인 (옵션 2 — conditional 패턴, ~5줄 backward-compatible fix)
- **대안 검토 (각 옵션과 기각 사유)**:
  - (A) `top_p` 단순 제거 (1줄): backward compatibility 깨짐 — 구모델에서 top_p 사용 caller 무력화
  - (B) `temperature` 제거: 결정성 손실, 큐레이션 일관성 저하
  - (C) conditional 패턴 (~5줄): ✅ 채택 — 신/구 모델 양립
  - (D) 보존 + 이월: STEP 132.6 본 목표 (라이브 시연) 진입 불가
- **검증 결과**:
  - ping v4 — HTTP 200 ✅
  - response text "PONG" 정확 수신 ✅
  - usage tokens 31 in / 6 out ✅
  - elapsed 1,313ms ✅
  - 5/5 검증 포인트 통과
- **잔존 정책 부채 (후속 STEP 권장)**:
  - `src/lib/ai/config.ts:43` DEFAULT_MODELS.anthropic = "claude-sonnet-4-7" 부정확 (실재 모델 부재) — 현재 .env.local 의 AXVELA_AI_MODEL override 로 우회. config 정합화는 별도 STEP 132.7 "AI default model alignment" 로 분리 권장.
- **재발 방지**:
  - Anthropic API 정책 변경 detect 시 (예: 다른 frozen 영역에서 4xx) 동일 §10.3 절차 (옵션 제시 → 박진휘 분 승인 → 영구 기록) 반복.

---

새 채팅에서 만나요 🙂
