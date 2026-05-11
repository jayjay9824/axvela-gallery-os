# STEP DOC-2 — AXVELA Development Operating Convention ✅

> **완료 시점**: 2026-05-07
> **5번째 영구 정책 문서 정착** — AXVELA 운영 헌법 완성
> **Code 0줄, doc-only** — Production runtime 0 kB delta

---

## 🎯 STEP DOC-2의 정체성

본 STEP은 **AXVELA Development Operating Convention** 정착입니다.

- ✅ STEP lifecycle 5-state model
- ✅ Partial-state rules (7-step checklist + Decision Tree)
- ✅ Anchor reuse rules (STEP 86 4-tier validation 매뉴얼화)
- ✅ Complexity control philosophy
- ✅ Recovery & stabilization patterns
- ✅ 5번째 영구 정책 문서 (4 → 5)
- ✅ 6 partial-state + 5 clean-slate 사례 stable convention 코드화

본 STEP은 *아닙니다*:

- ❌ generic README
- ❌ workflow automation script
- ❌ commit hook / CI 정착
- ❌ 코드 변경 (production runtime 영향 0건)

**핵심 가치** (사용자 spec 명시):

> 이제 AXVELA 개발 방식 자체가 충분히 stable convention으로 굳어졌습니다.
> 단순 iterative coding이 아니라 *AXVELA Development Operating Convention 수준*으로 문서화할 시점.
> 목표는: **future development consistency + reduced architectural drift + safe incremental scaling**.

---

## 📊 산출물 요약

| 파일 | LOC | 역할 |
|---|---|---|
| `AXVELA_DEV_CONVENTION.md` | ~600 | 5번째 영구 정책 문서 (운영 헌법) |
| `STEP_INDEX.md` | +1 row | DOC-2 ✅ 갱신 + Quick Reference + changelog |
| `ARCHITECTURE.md` | +1 entry | Timeline append |
| `HANDOFF.md` | edited | Last STEP / 영구 정책 4 → 5 / 다음 STEP 권장 |
| `STEP_DOC_2_DEV_CONVENTION_COMPLETE.md` | (본 파일) | 완료 보고서 |
| **합계** | **0줄 production code** | **Pure governance documentation** |

---

## 🧪 Validation Results

```
✓ npx tsc --noEmit          0 errors (STEP 90 검증 그대로)
✓ npx next lint             clean (STEP 90 검증 그대로)
✓ npx next build            175 kB / 262 kB (0 kB delta)
✓ 10/10 scenarios pass      (STEP 90 검증 그대로)
✓ 4 영구 정책 grep verify   AI Direction / Trust Layer / Fiscal Architecture / 본 문서 모두 정합
✓ Approval Workflow leakage 0건
```

**code 변경 0줄** = STEP 90의 모든 검증이 그대로 유지됩니다. doc-only STEP의 정확한 특성.

---

## 🔬 사용자 spec 검증 (5 핵심 항목 100% 매칭)

### §1 STEP Lifecycle ✅
- 5-state model: draft / partial / stabilized / frozen / phase-complete
- 각 상태 정의 + 확인 조건 + 다음 진입 조건
- 7-path 상태 전환 매트릭스
- 4 anti-pattern 명시

### §2 Partial-state Rules ✅
- 7-step checklist (모든 turn 시작 시 실행)
- Continuation Decision Tree (정착 코드 발견 시 safe vs unsafe 분기)
- Continuation Safe Conditions (4개 모두 충족 vs 1개라도 위반)
- Rollback Conditions (3가지)
- Multi-STEP Session detection rule (turn 경계 ≠ 완료 신호)
- Freeze 진입 조건 (4가지)

### §3 Anchor Reuse Rules ✅
- STEP 86 4-tier validation 매뉴얼화 (Tier 1 정착 / Tier 2 entity helper / Tier 3 cross-doc 통합 / Tier 4 fiscal 확장)
- Extension vs New Abstraction Decision Tree
- Extension Path / New Abstraction Path / Pure Derive Layer 3 path
- Orchestration Expansion 절대 금지 (5가지)
- 5-Question Gate (새 abstraction 5 질문 모두 yes 시에만 추가)

### §4 Complexity Control Philosophy ✅
- small / stable / predictable / incremental / derived-layer-oriented
- 4 anti-pattern 명시 (premature infrastructure / phase mixing / speculative architecture / scope creep)

### §5 Recovery & Stabilization Patterns ✅
- Clean Slate Recovery procedure (7-step)
- Partial Continuation procedure (4-step)
- Freeze Validation checklist (5-item)
- Safe Next-Step Selection decision tree
- Low-Risk STEP Prioritization (6-criteria)
- Recovery Decision Hierarchy (5 priority order)

---

## 🛡️ 4 영구 정책 정합 검증

### AXVELA AI Direction ✅
- 본 문서가 AI Direction의 \"AI 자동 트리거 0건\" 원칙을 §3.6 orchestration 금지 + §4.7 phase mixing 금지에 명시 cross-reference

### Trust Layer ✅
- 본 문서의 §1.1 frozen 조건이 Trust Layer의 \"PERMISSION ≠ APPROVAL\" 분리 원칙과 정합 명시

### Fiscal Architecture ✅
- 본 문서의 §3.1 STEP 86 anchor 4-tier validation이 Fiscal Architecture Layer 1~4 cycle과 정합 명시

### Manifesto rule_3·4·11·12·15·16·17·20 모두 보존
- *production code 0줄 변경*, 모든 정책 정합 자동 유지

---

## 📚 6 partial-state + 5 clean-slate 사례 영구 보존

본 문서가 *명시 인용*하는 사례:

### Partial-state 사례 (6건)
- STEP UX-2 → STEP 86 prep 발견 (timestamps 21:47-21:48)
- STEP 86 → STEP 87 prep 발견
- STEP 87 → STEP 88 prep 발견
- STEP 88 → STEP 89 prep (FiscalSummary integration)
- STEP 89 → STEP 91 prep (Accountant Export full stack)
- STEP 91 → 본 turn STEP 검증 + ZIP only

### Clean-slate 사례 (5건)
- UX-3 — Detail Panel polish
- STEP 89 — TaxInvoice entity
- STEP 91 — (사실상 partial 발견, 검증으로 종료)
- STEP 90 — Settlement Tax derive
- DOC-2 — 본 STEP (5번째)

---

## 🔁 STEP 86 Anchor 4-Tier Validation 영구 매뉴얼화

```
Tier 1 — 정착 (STEP 86)
    DocumentTrustMetadata 12 필드 + 6 docType enum
    Route delta: 0 kB (production import 부재 → tree-shake)

    ↓

Tier 2 — Entity Helper 사용 (STEP 87 + STEP 89)
    deriveReceiptTrust(receipt, ctx)        ~70 LOC
    deriveTaxInvoiceTrust(taxInvoice, ctx)  ~70 LOC

    ↓

Tier 3 — Cross-Doc 통합 사용 (STEP 91)
    buildAccountantExportPackage(input)
    → 모든 fiscal entity unified vocabulary export

    ↓

Tier 4 — Fiscal Calculation 영역 확장 (STEP 90)
    deriveSettlementTax(settlement, artistType?)
    deriveRecommendedFiscalDocuments(input)
    → anchor pattern과 동일 shape (pure / no I/O)
```

본 4-tier가 §3.1에 명시 매뉴얼화되어, 향후 Phase 3 / Phase 6 진입 시 동일 패턴 적용 가능.

---

## ⚠️ Risk Assessment — 🟢 Zero Risk

본 STEP은 *pure governance documentation* — production code 0줄 변경.

회귀 영향 가능 영역: **0개**

회귀 영향 없는 영역 (검증 0줄 변경 — 전체):
- 모든 src/types / src/lib / src/components / src/store / src/app
- 4 기존 정책 문서 (AI Direction / Trust Layer / Fiscal Architecture / STEP_INDEX)
- persistence / Settlement entity / fiscal-document types / settlement-tax helper
- Reporting / Logistics / Documents Hub / Customer / Payment / Settlement / Tax / FX
- AI Market Analysis / Image Cleanup / Backup-Restore / Permission audit / Audit Export
- Document Lifecycle 5 컴포넌트 + helper
- 모든 Drawer / Sidebar / DetailPanel / 3-Column
- `package.json` (외부 라이브러리 0개 추가)

---

## 🚀 다음 STEP 권장 (사용자 권장 순서)

🅑 **STEP 92 — AI Market Insight activation (Phase 3 진입)** ★ 사용자 권장
- 사용자 spec preview 명시: AI pricing prediction *아닌* **real operational intelligence** 중심
- 대상 도메인: inquiry trends / save+interest patterns / artist activity / settlement analytics / transaction flow insight / gallery activity signals
- UX-3에서 정착한 \"AI Market Insight\" zone에 실 데이터 hook
- Phase 3 첫 STEP

🅒 **STEP 101 — Approval Workflow Activation (Phase 6 진입)**
- Trust Layer 본격 활성. Reviewer / Queue / E-signature
- STEP 86 `lockedBy` slot이 anchor로 사전 정착되어 자연 진입 가능
- 본 DOC-2 §3.1 anchor 4-tier validation 매뉴얼이 reference

---

## 🎯 본 STEP의 영구 가치

1. **AXVELA 운영 헌법 완성** — 4 → 5 영구 정책 문서 + 1 navigation layer 구조 정착
2. **6번 partial-state + 5번 clean-slate 사례 stable convention 코드화** — 향후 multi-STEP 세션에서 동일 패턴 재현 가능
3. **STEP 86 anchor 4-tier validation 영구 매뉴얼화** — 향후 Phase 3 / Phase 6 진입 시 동일 패턴 적용 reference
4. **Phase 1 Fiscal foundation freeze 결정 근거 영구 보존**
5. **사용자 spec 3 목표 모두 정착** — future development consistency + reduced architectural drift + safe incremental scaling

---

## 8️⃣ AXVELA Development Operating Convention 한 문장 요약

> *작고, 안정적이고, 예측 가능하고, 점진적이며, derived-layer 우선의 정착*만이 AXVELA의 진화 방식이다. 새 abstraction은 5-Question Gate를 통과한 minimum viable 형태로만 추가하며, frozen STEP은 변경하지 않고 새 STEP 번호로 분리한다. partial-state는 표준 시나리오이며, 7-step checklist가 유일한 안전 진입점이다.
