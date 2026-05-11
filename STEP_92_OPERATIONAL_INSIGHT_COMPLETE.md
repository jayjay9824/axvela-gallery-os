# STEP 92 — AI Market Insight (Operational Intelligence Layer) ✅

> **완료 시점**: 2026-05-07
> **Phase**: Phase 3 Intel — **1/8 (operational intelligence baseline 정착)**
> **Trigger**: Phase 1 Fiscal foundation freeze 후 Phase 3 진입
> **사용자 핵심 spec**: *AI pricing prediction 방향이 아닌 real operational intelligence*

---

## 🎯 STEP 92의 정체성

본 STEP은 **operational intelligence layer**입니다.

- ✅ 6 insight categories (Inquiry / Save / Artist / Settlement / Funnel / Activity)
- ✅ 3-Layer architecture (operational metrics → pattern detection → AI summary)
- ✅ Bloomberg + McKinsey + museum-grade calmness 톤
- ✅ Honest Signal Principle (`unavailable` significance level이 명시적 \"데이터 부족\" 표시)
- ✅ DetailPanel ZONE 5 wire-up (UX-3 정착 zone에 실 데이터 hook 활성)

본 STEP은 *아닙니다*:

- ❌ AI artwork pricing prediction
- ❌ speculative valuation
- ❌ investment scoring
- ❌ fake confidence systems
- ❌ autonomous recommendations

**핵심 원칙** (사용자 spec 명시):

> 이 방향이 AXVELA 철학과 훨씬 맞습니다.
> speculative AI pricing이 아니라 real behavioral / operational insight 중심.
> signal visualization + operational pattern detection + AI summarization.

---

## 📊 산출물 요약

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/operational-insight.ts` | 894 | Layer 1+2 — 6 derive functions + aggregator |
| `src/lib/operational-insight-summary.ts` | 523 | Layer 3 — deterministic templated AI summary |
| `src/lib/__tests__/operational-insight.scenarios.ts` | 605 | 12 test scenarios + runner (DOC-2 anchor 답습) |
| `src/components/insight/MarketInsightDrawer.tsx` | 372 | UI surface — 600px right slide |
| `src/store/useArtworkStore.ts` | +~15 | overlay state + 2 actions |
| `src/components/layout/DetailPanel.tsx` | +~16 | ZONE 5 wire-up + selector |
| `src/app/page.tsx` | +2 | mount |
| `STEP_92_OPERATIONAL_INSIGHT_COMPLETE.md` | 신규 | 본 보고서 |
| **합계** | ~2400 | **Route +6 kB / 22/22 scenarios PASS** |

---

## 🧪 Validation Results

### Build / Type / Lint / Scenarios

```
✓ npx tsc --noEmit          0 errors
✓ npx next lint             clean (No warnings/errors)
✓ npx next build            ✓ Compiled successfully
✓ Route delta               175 kB → 181 kB (+6 kB)
✓ First Load JS             262 kB → 268 kB (+6 kB)
✓ Fiscal scenarios          10/10 passed (그대로 유지)
✓ Operational scenarios     12/12 passed (3 consecutive deterministic runs)
✓ DOC-2 §4.1 small criteria Route delta ≤ 10 kB → 통과 (+6 kB)
```

### Test Scenarios — **12/12 PASS** (npx tsx 실행 검증, 3-run deterministic)

| # | Scenario | 검증 |
|---|---|---|
| 1 | §1 Inquiry empty data | `unavailable` significance |
| 2 | §1 Inquiry single recent | `steady` direction |
| 3 | §1 Inquiry repeated pattern | repeated detected |
| 4 | §2 Save engagement | saves ≥ 2 detected |
| 5 | §2 Save empty | `unavailable` |
| 6 | §3 Artist high activity | top entry surface |
| 7 | §4 Settlement delayed | delayed signal flag |
| 8 | §4 Settlement completion | flow measurable |
| 9 | §5 Funnel distribution | stage distribution |
| 10 | §5 Funnel empty | `unavailable` |
| 11 | §6 Activity spike | spike detection |
| 12 | §6 Activity quiet | `unavailable` |

---

## 🔬 사용자 spec 검증 (6 categories 100% 매칭)

### §1 Inquiry Trends ✅
- `deriveInquiryTrend` — count + delta + velocity + repeated patterns + isUnavailable

### §2 Save / Interest Patterns ✅
- `deriveSavePattern` — frequency + revisit + repeated engagement + topInterest

### §3 Artist Activity ✅
- `deriveArtistActivity` — interaction trend + artwork engagement + category-level movement

### §4 Settlement Analytics ✅
- `deriveSettlementAnalytics` — timing pattern + transaction completion flow + delayed signal

### §5 Transaction Flow Insight ✅
- `deriveTransactionFunnel` — inquiry → hold → settlement funnel + conversion + stage distribution

### §6 Gallery Activity Signals ✅
- `deriveGalleryActivity` — booth/work traffic + engagement density + spikes + repeat interactions

### Important DO NOT 항목 모두 0건 ✅

| 금지 항목 | 검증 |
|---|---|
| AI artwork pricing prediction | grep 0건 user-facing |
| speculative valuation | grep 0건 |
| investment scoring | grep 0건 |
| fake confidence systems | `unavailable` significance level이 명시적 \"데이터 부족\" |
| autonomous recommendations | drawer는 read-only / period switcher만 |

### 추천 구조 3-Layer ✅

| Layer | 파일 | 역할 |
|---|---|---|
| 1 Operational metrics | `operational-insight.ts` | raw aggregation (count / sum / delta) |
| 2 Pattern detection | `operational-insight.ts` (동일 파일) | direction / significance / repeated detection |
| 3 AI summary generation | `operational-insight-summary.ts` | deterministic templated text — *NOT real AI call* |

### Tone (Bloomberg + McKinsey + museum-grade calmness) ✅

| 요소 | 정착 |
|---|---|
| Directional glyphs | ▲ ▼ ─ ◆ · (monochrome, no red/green) |
| Significance badges | 5-tier neutral ink tones (high / medium / low / noise / unavailable) |
| Korean institutional | \"증가\" / \"감소\" / \"안정 유지\" / \"활동 급증 감지\" / \"데이터 부족\" |
| Footer disclaimer | \"본 분석의 경계\" — 운영 보조 / 인간 판단 우선 / 가격 예측 무관 |
| Numerals | tabular-nums where signal intensity matters |
| Shadows | 0 (rule_16 minimalism) |
| Charts | 0 |

### Technical Direction ✅

- **STEP 86 anchor pattern** — Tier 5 \"new domain abstraction\" 시점 (Phase 1 Fiscal 4-tier + Phase 3 Intel 1-tier)
- **DOC-2 §3.1 validation convention** — scenarios.ts가 fiscal-derive와 동일 shape (inline assert helpers + runAllScenarios runner)
- **Derived-layer-first approach** — Layer 1+2 pure derive 우선 → Layer 3 summary → UI consumption

### 현재 개발 철학 ✅

| 원칙 | 검증 |
|---|---|
| Small | Route delta ≤ 10 kB (+6 kB) / drawer 372 LOC |
| Stable | frozen STEP 0줄 / persistence 0줄 / entity 0줄 |
| Predictable | 12 scenarios 3-run deterministic / build 명령 고정 |
| Operationally grounded | real inquiry/save/settlement/transaction data 기반, speculative 0건 |
| 새 orchestration expansion 최소화 | 외부 라이브러리 0개 |

---

## 🛡️ 5 영구 정책 정합 검증

### AXVELA AI Direction ✅
- 금지 표현 0 user-facing (verified by grep): \"AI Estimated Price\" / \"AI Pricing Engine\" / \"확정 시장가\" / \"투자 보장\" / \"예상 수익\" / \"fake confidence\" 모두 *주석 prohibition only*
- 사용 표현: \"운영 신호\" / \"참고 신호\" / \"패턴 감지\" / \"운영 보조\" / \"인간 판단이 우선\" / \"가격 예측 무관\"

### Trust Layer ✅
- Approval Workflow 본격 구현 0건 (verified by grep — `ApprovalAction` / `ApprovalQueue` / `reviewerAssignment` / `managerApproval` 모두 0건)
- RBAC 변경 0줄

### Fiscal Architecture ✅
- Phase 1 Fiscal Layer 1~4 모두 0줄 변경 / Settlement / Inquiry / Transaction entity 0줄
- 본 STEP은 *Phase 3 Intel 영역* — fiscal calculation 0건 (settlement timing 분석은 *metric 추출*만)
- rule_3 Money Flow Separation strict 보존

### Manifesto rule_3·4·11·12·15·16·17·20 ✅
- rule_3 Money Flow Separation strict (cross-domain 합산 0건)
- rule_4 Document Trust Layer (변경 0줄)
- rule_11 Transaction Core (변경 0줄)
- rule_12 Settlement formula (변경 0줄)
- rule_15 Primary 1개 (drawer는 read-only view, period switcher만 secondary)
- rule_16 Apple/OpenAI minimalism (그림자 0 / chart 0개)
- rule_17 drawer layer (3-Column 0줄 변경)
- rule_20 FX Lock (currency 0 mention — Phase 3 Intel 영역 외)

### **AXVELA_DEV_CONVENTION** (5번째) ✅
- DOC-2 §3.4 New Abstraction Path 5-Question Gate **첫 실전 통과**
- DOC-2 §3.1 anchor 4-tier validation reference로 활용 (Tier 5 시점)
- DOC-2 §3.6 Orchestration Expansion 절대 금지 정확 매칭 (외부 라이브러리 0개)
- DOC-2 §4.1 small criteria 통과 (Route delta ≤ 10 kB)

---

## 🔁 STEP 86 anchor pattern Tier 5 — \"new domain abstraction\" 시점

| Tier | STEP | 영역 | 비용 |
|---|---|---|---|
| 1 정착 | STEP 86 | Document Trust Metadata | 0 kB |
| 2 entity helper | STEP 87 + 89 | Receipt + TaxInvoice trust derive | ~70 LOC each |
| 3 cross-doc 통합 | STEP 91 | Accountant Export unified vocabulary | ~737 LOC helper |
| 4 fiscal calculation 확장 | STEP 90 | Settlement withholding + classification | 0 kB delta |
| **5 new domain abstraction** | **STEP 92** ⭐ | **Phase 3 Operational Intelligence** | **+6 kB** |

DOC-2 §3.4 New Abstraction Path 5-Question Gate 첫 실전 통과:
- ✅ 기존 anchor 표현 불가 (operational intelligence는 fiscal calculation과 다른 domain)
- ✅ minimum viable (3-layer architecture, drawer 단일 진입점)
- ✅ 후속 STEP 사용 계획 (Phase 3 STEP 93~99 본 layer 위에 build)
- ✅ Route 부담 ≤10 kB (+6 kB)
- ✅ 4 정책 정합 100%

---

## 📝 Partial-state #8 투명성 보고

본 turn 시작 시 baseline 검증으로 다음 모두 정착 발견:
- ✅ Layer 1+2 (`operational-insight.ts` 894 LOC, 6 derive functions + aggregator)
- ✅ Layer 3 (`operational-insight-summary.ts` 523 LOC, deterministic generator)
- ✅ Scenarios (`operational-insight.scenarios.ts` 605 LOC, 12 cases)
- ✅ Store layer (type + slice + 2 actions + initial + reset 모두)
- ✅ Drawer (`MarketInsightDrawer.tsx` 372 LOC, period switcher + 6 cards + disclaimer)
- ✅ page.tsx mount
- ✅ DetailPanel ZONE 5 두 번째 CTA (UX-3 정착 zone에 \"갤러리 운영 신호\" 추가)
- ⚠️ DetailPanel `openMarketInsight` selector declaration 누락 → **본 turn에서 1줄 추가**
- ⚠️ STEP_INDEX 92 row가 *legacy \"Market Signal\"* 정의 → **\"AI Market Insight Operational Intelligence\"로 갱신**
- ⚠️ ARCHITECTURE timeline entry 부재 → **본 turn 추가**
- ⚠️ HANDOFF 갱신 부재 → **이전 turn에서 정착됨 확인**
- ⚠️ 완료 보고서 부재 → **본 turn 작성**
- ⚠️ ZIP 부재 → **본 turn 패키징**

**DOC-2 §2.4 Continuation Safe Conditions 4개 모두 충족** (single bug fix 후):
1. ✅ exported API 사용자 spec 일치 (6 categories 정확 매칭)
2. ✅ internal logic 일관 (12/12 scenarios deterministic 3-run PASS)
3. ✅ 4 정책 grep verify 통과 (forbidden 0 / Approval leakage 0)
4. ✅ baseline green (tsc 0 errors / scenarios PASS)

→ **Continuation path 진행** (clean-slate rewrite 회피, 정착 코드 보존).

---

## 🎯 본 STEP의 영구 가치

1. **AXVELA Phase 3 Intel 첫 STEP 정착** — *real operational intelligence* 방향 결정 (사용자 spec)
2. **STEP 86 anchor pattern Tier 5 추가** — \"new domain abstraction\" 시점 정착 (Phase 1 Fiscal 4-tier + Phase 3 Intel 1-tier)
3. **DOC-2 §3.4 New Abstraction Path 5-Question Gate 첫 실전 통과** — 향후 Phase 6 (Approval) / Phase 7 / Phase 8 진입 시 동일 패턴 reference
4. **UX-3 정착 ZONE 5의 실 데이터 hook 활성** — placeholder가 본격 operational intelligence로 활성
5. **fake confidence systems 회피 패턴 정착** — `unavailable` significance level이 명시적 \"데이터 부족\" 표시 (Honest Signal Principle)
6. **Bloomberg + McKinsey + museum 톤 매뉴얼화** — 향후 Phase 3 STEP 93~99에서 동일 톤 reference

---

## 🚀 다음 STEP 권장

🅑 **STEP 93 (Operational Intelligence 보강)**
사용자 추가 spec 시:
- inquiry source 분류 (collector / institution / press / unknown)
- save trend 7-day vs 14-day 비교 detail
- category drilldown
- artwork-aware mode 강화 (현재는 갤러리 전체 신호와 동일, focus artwork도 가능)
- 본 layer 위에 build (DOC-2 §3.3 Extension Path)

🅒 **STEP 101 (Approval Workflow Phase 6 진입)**
- Phase 1 foundation freeze 완료 후 Trust Layer Approval 본격 활성
- STEP 86 `lockedBy` slot이 anchor로 정착되어 자연 진입 가능
- DOC-2 §3.1 anchor 4-tier validation 매뉴얼이 reference
- 본 STEP 92 정착으로 Phase 3 Intel baseline 확보 후 진입 가능

---

## 📈 Phase / Track Progress

```
UX track            ✅ 3/3 완성  (UX-1 + UX-2 + UX-3)
Phase 1 Fiscal      ✅ 6/6 frozen  (foundation freeze)
                       86 → 87 → 88 → 89 → 91 → 90
Phase 3 Intel       ✅ 1/8 (STEP 92 정착) ⭐
                       STEP 93~99 reserved
Phase 6~8 Approval  🟡 0/12  (STEP 101~112 예약)
영구 정책 문서       5개 (AI Direction / Trust Layer / Fiscal Architecture / Manifesto / DEV_CONVENTION)
```
