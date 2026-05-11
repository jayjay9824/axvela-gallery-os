# STEP 113 — Terminology Reframe + Workflow Architecture Foundation — COMPLETE ✅

**완료 시점**: 2026-05-08
**Phase**: 4 — Artwork-Centric Workflow Foundation (1/10 진입)
**Stage**: 1 — Foundation (lowest risk)
**Risk profile**: 🟢 매우 낮음 — text-replacement only + new doc, code-logic 변경 0줄

---

## 1. STEP 113 의 정체

### 1.1 Two-Track Work

```
Track A — UI Terminology Reframe (text replacement only)
Track B — Phase 4 Foundation Document (7번째 영구 정책 신규)
```

본 STEP 의 핵심: **AXVELA 가 *AI demo* 가 아닌 *실제 gallery internal workflow* 도구임을 UI tone 과 정책 문서로 동시 정착**.

### 1.2 본 STEP 이 *아닌* 것

- ❌ Code logic 변경 (state machine / transitions / persistence 모두 0줄)
- ❌ AI integration 진입 (Phase 4 §4.8 — Claude API 신규 연결 절대 금지)
- ❌ rule_5 / AI-Human Loop architectural keyword 변경 (보존 대상)
- ❌ 기존 STEP 96 architecture 영향 (translation / document writing UI 무손상)
- ❌ Persistence migration / forced data conversion

---

## 2. Track A — Terminology Reframe

### 2.1 Replacement Inventory (12 lines, 9 files)

| # | 파일 | 변경 유형 | 내용 |
|---|------|----------|------|
| 1 | `src/components/ui/ButtonHint.tsx` | const + comment | `AI_DRAFT_AFFORDANCE = "AI 초안 — 담당자 검토 필요"` (전파 source) + 헤더 docstring |
| 2 | `src/components/contract/ContractDetailDrawer.tsx` | UI banner | `초안 — AI 생성 후 담당자 검토 필요 (rule_5)` |
| 3 | `src/components/curation/CurationDraftDrawer.tsx` | UI banner | 동일 banner phrase |
| 4 | `src/components/artwork/ArtworkFormDrawer.tsx` | UI text + comment | `AXVELA AI 운영 참고 — 담당자 검토 필요` + `AI 초안 → 담당자 승인(클릭)` |
| 5 | `src/components/layout/DetailPanel.tsx` | doc-comment | `"AI 초안 — 담당자 검토 필요"` annotation |
| 6 | `src/types/contract.ts` | docstring | `REVIEW 검토 요청 — 담당자에게 제출됨` |
| 7 | `src/store/useArtworkStore.ts` | JSDoc × 2 | `Submit DRAFT for staff review` (interface + impl) |
| 8 | `src/lib/utils.ts` | mock seed × 3 | `담당자 검토 후 승인/발송하세요` |
| 9 | `src/lib/mock-data.ts` | mock seed + comment | seed string + `AI 생성 → 담당자 승인 → LOCK` |

### 2.2 Verification Grep Results

```
✅ '인간 검토'    in src/  →  0 matches
✅ '인간 승인'    in src/  →  0 matches
✅ 'human review' in src/  →  0 matches (case-insensitive)

✅ 'rule_5'       in src/  →  40 references preserved
✅ 'AI-Human Loop' in src/ →  17 references preserved

✅ '담당자 검토/승인/...'  →  19 references (10 replace + 9 reuse propagation)
```

### 2.3 보존 정책 keyword (절대 변경 안됨 — 검증됨)

- `rule_5` (Manifesto rule keyword) — 40건 보존
- `AI-Human Loop` (Architectural policy term) — 17건 보존
- `(rule_5)` 표기 — 모든 inline reference 보존
- `Human-in-the-Loop` 영문 architectural term — 보존 대상 (현 코드 내 검색 0건이지만 보존 정책)

### 2.4 Reuse Propagation 효과

`AI_DRAFT_AFFORDANCE` const 1줄 변경 → 다음 9 surface 자동 전파:

```
src/components/inquiry/InquiryDetailDrawer.tsx
src/components/inquiry/InquiryResponseDrawer.tsx
src/components/contract/ContractDetailDrawer.tsx
src/components/curation/CurationDraftDrawer.tsx
src/components/artwork/ArtworkFormDrawer.tsx
src/components/layout/DetailPanel.tsx
... etc.
```

→ DOC-2 §3.1 Anchor Reuse Tier 7 — *single source 1줄 변경 = N surface 자동 합류*.

---

## 3. Track B — `AXVELA_WORKFLOW_ARCHITECTURE.md` (7번째 영구 정책)

### 3.1 8-Section 구조 (~440 LOC)

| § | 제목 | 영구 가치 |
|---|------|----------|
| §1 | Identity Statement | AXVELA = Artwork-Centric OS, NOT SaaS/CMS/CRM/AI App |
| §2 | Single Source of Truth | Artwork 위에 모든 운영 entity 합류 (rule_1 architectural manifestation) + AXID Physical Root Key |
| §3 | Operational Workflow Sequence | 10-state registration + Inquiry→Hold→Contract→PRE→FINAL→Payment 흐름 + STEP 121 protection clause |
| §4 | Implementation Constraints | 8 영구 원칙 (additive only / optional slot / no migration / draft-safe / backward compat / build green / no worktree / AI not priority Phase 4 한정) |
| §5 | Terminology Standards | 사용 권장/금지 매핑 + 보존 keyword 명시 + reframe rationale |
| §6 | Phase 4 Roadmap | STEP 113~122 status table + Stage 1/2/3 + STEP 121 critical protection |
| §7 | Cross-Reference | 6 다른 영구 정책 + STEP_INDEX.md 와의 관계 |
| §8 | Permanent Value | 본 문서가 영구 보존되는 5 이유 |

### 3.2 정책 우선순위

```
Manifesto rule_1  (artwork_first)
       ↓
AXVELA_WORKFLOW_ARCHITECTURE.md §1 §2  (architectural manifestation)
       ↓
STEP_INDEX.md  (navigation)
       ↓
각 STEP 진입 (§4 Implementation Constraints 1차 reference)
```

### 3.3 STEP 121 Protection Clause 정착

§6.3 에 명시:
- Phase 1 Fiscal frozen 6/6 보존 (STEP 86~91 변경 0줄)
- 기존 invoice state machine 변경 0줄
- 추가 허용: `invoiceKind?: "pre" | "final"` optional slot, UI label
- 추가 금지: required field / persistence migration / state machine rewrite

→ Phase 1 Fiscal frozen 위반 가능성을 *문서 layer 에서 차단*.

---

## 4. Architecture Impact

| 영역 | 변경 |
|---|---|
| Build | ✅ green |
| TypeScript | 0 errors (text only, identifier 변경 0건) |
| Lint | 0 warnings/errors |
| Persistence | 0 (mock seed 도 v1 schema 동일) |
| State machine | 0 |
| Routes | 0 |
| Stores | 0 logic (JSDoc 만 변경) |
| Public API | 0 |
| 외부 lib | 0 |
| Phase 1 Fiscal frozen | 0 (격리 보존) |
| AI infra (STEP 93~96) | 0 (rule_5 / AI-Human Loop 보존) |
| Translation UI (STEP 96) | 0 (영향 없음) |
| Document Writing UI (STEP 95) | 0 (영향 없음) |

---

## 5. Validation Results

| 항목 | 결과 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next lint` | ✅ 0 warnings, 0 errors |
| `npx next build` | ✅ build success |
| Route size | **187 kB** (STEP 96 → 변동 0 kB, 정확한 text-only 신호) |
| First Load JS | **275 kB** (변동 0 kB) |
| DOC-2 §4.1 ≤10 kB target | ✅ 통과 (0 kB delta — 정확한 text-only) |

| Scenario Suite | Result |
|----------------|--------|
| ai-protocol | ✅ 17/17 |
| fiscal-derive | ✅ 10/10 |
| operational-insight | ✅ 12/12 |
| anthropic-provider | ✅ 9/9 |
| **Total** | **✅ 48/48 PASS** (회귀 0건) |

---

## 6. 정책 정합 검증

| 영구 정책 | 보존 verified |
|---|---|
| Manifesto rule_5 (AI-Human Loop) | ✅ 40 keyword references intact |
| AXVELA_AI_DIRECTION.md §10 | ✅ AI-Human Loop term 17건 보존 |
| AXVELA_FISCAL_ARCHITECTURE.md | ✅ Phase 1 frozen 6/6 무손상 |
| AXVELA_TRUST_LAYER.md | ✅ Phase 6 reserved 무영향 |
| AXVELA_AI_INTEGRATION.md | ✅ 5 insertion points 무수정 |
| AXVELA_DEV_CONVENTION.md | ✅ DOC-2 §4 Complexity 정확 매칭 (small / stable / predictable / incremental / minimum viable) |

---

## 7. 영구 정책 문서 7개 (정착 완료)

| # | 문서 | 정착 STEP |
|---|------|----------|
| 1 | `STEP_INDEX.md` | DOC-1 |
| 2 | `AXVELA_AI_DIRECTION.md` | (legacy) |
| 3 | `AXVELA_FISCAL_ARCHITECTURE.md` | STEP 86~91 |
| 4 | `AXVELA_TRUST_LAYER.md` | reserved |
| 5 | `AXVELA_DEV_CONVENTION.md` (DOC-2) | DOC-2 |
| 6 | `AXVELA_AI_INTEGRATION.md` | STEP 93 |
| 7 | **`AXVELA_WORKFLOW_ARCHITECTURE.md`** ⭐ | **STEP 113 (본 STEP)** |

---

## 8. 다음 STEP

### 권장 자연 진입: **STEP 114 — ArtworkRegistrationStatus Enum Foundation**

- Phase 4 Stage 1 진행 (113 → 114 → 115 → 119)
- 10-state union 정착 (`Draft / Pending Review / Inquiry Active / ... / Archived`)
- Risk: 🟢 낮음 — type foundation only, optional slot, persistence v1 호환
- 의존성: 본 STEP 113 의 `AXVELA_WORKFLOW_ARCHITECTURE.md` §3.1 spec
- 후속 의존: STEP 117 Draft/Resume System 이 본 enum 위에 합류

---

## 9. 본 STEP 의 영구 가치

1. **Phase 4 entry establishment** — `AXVELA_WORKFLOW_ARCHITECTURE.md` 7번째 영구 정책 정착, 향후 모든 Phase 4 STEP 의 1차 reference.
2. **AXVELA Identity 방어막** — SaaS / CRM / AI App 으로 흐를 가능성 차단.
3. **Terminology canonical reference** — gallery internal workflow tone 정착, AI demo tone 제거.
4. **STEP 121 critical protection clause** — Phase 1 Fiscal frozen 위반 가능성 시점 사전 차단.
5. **Single source of terminology** — `AI_DRAFT_AFFORDANCE` const 1줄 변경 = 9 surface 자동 전파 (DOC-2 §3.1 anchor reuse 효과 입증).
6. **Code-logic 변경 0줄로 강력한 architectural reframing** — text + doc 만으로 phase shift 달성, DOC-2 §4 Complexity Control 의 *minimum viable* 정확 매칭.
