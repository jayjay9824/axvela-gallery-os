# STEP 92 — AI Market Insight (Operational Intelligence Layer) ✅

> **완료 시점**: 2026-05-07
> **Phase**: 3 — AXVELA Intelligence Layer (1/8 진입)
> **사용자 spec 핵심**: AI pricing prediction *아닌* **real operational intelligence** 중심
> **3-Layer architecture**: Operational metrics → Pattern detection → Deterministic AI summary

---

## 🎯 STEP 92의 정체성

본 STEP은 **operational intelligence baseline** 정착입니다.

✅ behavioral / operational signal 중심
✅ Deterministic templated summary (rule_5 AI-Human Loop 강화)
✅ Honest signal principle (fake confidence 회피)
✅ STEP 86 anchor pattern Pure Derive Layer 5번째 사용처 (DOC-2 §3.5)
✅ Bloomberg Terminal + McKinsey + museum-grade calmness 톤

본 STEP은 *아닙니다*:

❌ AI artwork pricing prediction
❌ speculative valuation
❌ investment scoring
❌ fake confidence systems
❌ autonomous recommendations
❌ 외부 LLM API 호출

---

## 📊 산출물 요약

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/operational-insight.ts` | 895 | Layer 1 + 2 — 6 category derive + pattern detection |
| `src/lib/operational-insight-summary.ts` | 524 | Layer 3 — deterministic templated summary generator |
| `src/lib/__tests__/operational-insight.scenarios.ts` | 605 | 12 deterministic test scenarios (12/12 PASS) |
| `src/components/insight/MarketInsightDrawer.tsx` | 371 | Bloomberg/McKinsey/museum 톤 drawer UI |
| `src/store/useArtworkStore.ts` | +25 | `marketInsightRequest` overlay state + 2 actions |
| `src/components/layout/DetailPanel.tsx` | +15 | ZONE 5 "갤러리 운영 신호" 2nd CTA (STEP 45 보존) |
| `src/app/page.tsx` | +2 | Drawer mount |
| **합계** | **2437 LOC** | **production 1832 + scenarios 605, DOC-2 §4.1 ≤2500 budget 통과** |

---

## 🧪 Validation Results

### Build / Type / Lint / Scenarios

```
✓ npx tsc --noEmit                   0 errors
✓ npx next lint                      No warnings/errors
✓ npx next build                     ✓ Compiled successfully
✓ Route delta                        175 kB → 181 kB (+6 kB, ≤10 kB budget ✓)
✓ First Load JS                      262 kB → 268 kB (+6 kB)
✓ Operational scenarios              12/12 passed
✓ Fiscal scenarios (Phase 1 freeze)  10/10 passed (regression 0)
✓ Total scenarios                    22/22 passed
```

### 4 정책 grep verify

```
✓ AI Direction forbidden positive claim     0건 (모든 매치는 prohibition comment 또는 negation disclaimer)
✓ Approval Workflow leakage                  0건 (ApprovalAction / ApprovalQueue / reviewerAssignment / managerApproval)
✓ External LLM API calls                     0건 (fetch / axios / openai / anthropic)
✓ AI auto-trigger / setInterval              0건 (rule_5 AI-Human Loop — 사용자 명시 trigger only)
✓ package.json delta                         0줄 (외부 라이브러리 0개)
```

---

## 🔬 사용자 spec 검증 (6 categories 100% 매칭)

### §1 Inquiry Trends ✅

`InquiryTrendInsight` + `deriveInquiryTrend`:
- ✅ inquiry increase/decrease (`direction` field)
- ✅ inquiry velocity (`velocityPerDay` field)
- ✅ repeated inquiry pattern (`repeatedContacts` — 동일 contact × 동일 artwork)
- ✅ Top inquired artworks (3건 ranking)

Headline 예시: `"지난 14일간 문의 활동이 +6건 증가했습니다."`

### §2 Save / Interest Patterns ✅

`SavePatternInsight` + `deriveSavePattern`:
- ✅ repeated engagement (`repeatedEngagementCount` — 동일 collector × 동일 artwork ≥2회)
- ✅ high-interest works (`highInterestArtworks` — 복수 collector 관심)
- ✅ revisit activity (proxy from inquiry repeat)
- ⚠️ Save / Favorite entity 부재 → `saveTrackingUnavailable: true` *honest signal* (fake confidence 회피)

Headline 예시: `"선택된 작품군에서 반복 engagement 3건이 감지되었습니다."`

### §3 Artist Activity ✅

`ArtistActivityInsight` + `deriveArtistActivity`:
- ✅ artist interaction trend (`activeArtists` + `direction`)
- ✅ artwork engagement trend (`topArtists` 3건 ranking)
- ✅ category-level movement (artist별 inquiry+transaction aggregate)

Headline 예시: `"지난 14일간 작가 X 주변 활동이 증가했습니다."`

### §4 Settlement Analytics ✅

`SettlementAnalyticsInsight` + `deriveSettlementAnalytics`:
- ✅ settlement timing pattern (`avgDaysToSettle` — createdAt → settledAt)
- ✅ transaction completion flow (status counts)
- ✅ delayed settlement signal (`delayedCount` — 30+ days PENDING/READY)
- 🎯 *delayed itself IS a signal* — insufficient 분기보다 우선순위 (sig high)

Headline 예시: `"지난 30일간 30일 이상 지연된 정산 1건이 감지되었습니다."`

### §5 Transaction Flow Insight ✅

`TransactionFunnelInsight` + `deriveTransactionFunnel`:
- ✅ inquiry → hold → settlement funnel
- ✅ conversion flow visibility (`inquiryToHoldRate` / `holdToSettlementRate`)
- ✅ transaction stage distribution (4 stages: inquiry / NEGOTIATING+ / PAID+ / settled)

Headline 예시: `"지난 14일간 문의 → Hold 전환 40% · Hold → 정산 50%."`

### §6 Gallery Activity Signals ✅

`GalleryActivitySignalsInsight` + `deriveGalleryActivity`:
- ✅ engagement density (`totalEvents`)
- ✅ activity spikes (`spikeDetected` — 2× avg with abs min 5)
- ✅ repeat interaction signals (`repeatInteractionCollectors` — 동일 contact × 다른 artwork)
- ⚠️ booth/work traffic 데이터 부재 → `trafficTrackingUnavailable: true` *honest signal*

Headline 예시: `"지난 14일간 단일 day 활동 burst가 감지되었습니다."`

---

## 🏗️ 3-Layer Architecture (사용자 spec 정확 매칭)

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1 — Operational Metrics                            │
│   raw count + bucket aggregation + window 3-point       │
│   (deriveInquiryTrend / deriveSavePattern / ...)        │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2 — Pattern Detection                              │
│   direction (increase/decrease/spike/insufficient)       │
│   spike (avg×2 + abs min 5) / repeat / significance     │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3 — Deterministic Templated Summary                │
│   Korean institutional tone + 3-line overview            │
│   6 category headlines + observations + disclaimer       │
│   ⚠️ NOT real LLM call — *deterministic* baseline       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ UI Surface — MarketInsightDrawer                         │
│   Bloomberg ▲▼─◆· + McKinsey hierarchy + museum calm    │
└─────────────────────────────────────────────────────────┘
```

---

## 🛡️ 5 영구 정책 정합 검증

### AXVELA AI Direction §1 / §10 ✅
- 금지 표현 0 user-facing positive claim
- 사용 표현: "운영 신호" / "참고 신호" / "패턴 감지" / "운영 보조" / "데이터 부족"
- rule_5 AI-Human Loop — 사용자 명시 trigger only (DetailPanel CTA 클릭 시)
- Disclaimer footer: "가격 예측 / 가치 평가 / 투자 자문 / 자동 추천과 무관합니다."

### AXVELA Trust Layer ✅
- Approval Workflow 본격 구현 0건
- "PERMISSION ≠ APPROVAL" 분리 보존
- RBAC 변경 0줄

### AXVELA Fiscal Architecture ✅
- fiscal calculation 0건 (cross-domain 단일 숫자 합산 0건)
- Phase 1 Fiscal foundation freeze 보존 (Settlement / Tax 변경 0줄)

### AXVELA DEV Convention (DOC-2) ✅
- §2 Partial-State Rules — 7-step checklist 통과 (clean slate verified, 6번째 연속)
- §3 Anchor Reuse Rules — Pure Derive Layer §3.5 정확 답습
- §4 Complexity Control — small (LOC ≤2500 budget) / stable (frozen 변경 0줄) / predictable (4 정책 grep 100%) / incremental (단일 turn = 단일 Phase 진입) / derived-layer-oriented
- §5 Recovery patterns — Clean Slate Recovery 6번째 사례 (UX-3 / 89 / 91 / 90 / DOC-2 / **92**)

### Manifesto rules ✅
rule_3 / rule_4 / rule_5 / rule_8 / rule_11 / rule_12 / rule_15 / rule_16 / rule_17 / rule_18 / rule_20 모두 보존

---

## ⚠️ Risk Assessment — 🟢 Low Risk

| Area | Risk | Reason |
|---|---|---|
| Pure derive helpers | 🟢 Zero | entity / store / persistence 0줄, pure functions, 결정성 |
| Drawer UI | 🟢 Low | read-only consumption, 기존 drawer 패턴 답습 |
| Store overlay state | 🟢 Low | 1개 추가 (비-persisted), pattern STEP 88/91 답습 |
| DetailPanel ZONE 5 | 🟢 Low | 기존 CTA 보존 + 신규 CTA 추가 (UX-3 hierarchy 보존) |
| page.tsx mount | 🟢 Zero | 1줄 mount, 다른 drawer 옆 정렬 |

회귀 영향 가능 영역: DetailPanel ZONE 5 layout (1 CTA → 2 CTA stack, padding 자연 보존)
회귀 영향 없는 영역 전수 검증: persistence / Reporting / Logistics / Customer / Payment / Settlement / Tax / FX / Document Lifecycle 5컴포넌트 / Sidebar / RoleSwitcher / RBAC / 3-Column / state-machine / market-analysis-{generator,export} / package.json — 모두 0줄.

---

## 🎨 UX 톤 매칭

### Bloomberg Terminal ✅
- ▲▼─◆· directional glyphs (single character)
- tabular-nums typography
- border-only emphasis (그림자 0)
- monospace numerals
- factual headline (no hype)

### McKinsey Operational Dashboard ✅
- 3-line institutional overview (01/02/03 enumeration)
- 6 category structured sections
- significance hierarchy (high/medium/low/noise)
- "·" prefixed observation list

### Museum-grade Calmness ✅
- 색상 minimum (ink/surface/line만)
- 그림자 0
- disclaimer footer (3-line, factual negation)
- "운영 보조" 톤 / 인간 판단 우선 명시

---

## 🎯 본 STEP의 영구 가치

1. **Phase 3 첫 정착** — AXVELA Intelligence Layer baseline (1/8). 향후 STEP 93~99 자연 확장 가능
2. **STEP 86 anchor 5번째 사용처** — Pure Derive Layer 패턴 정확 답습 (entity 0줄 / store overlay만 / persistence 0줄 / pure 함수 / 결정성)
3. **Honest Signal Principle 영구 정착** — `saveTrackingUnavailable` / `trafficTrackingUnavailable` / `insufficient` direction이 *fake confidence 회피*의 institutional pattern
4. **Deterministic Templated Summary 정착** — 향후 실 LLM hook 시 fallback baseline으로 자연 합류 (사용자 명시 trigger 시만 LLM 호출, AI Direction §1 정합)
5. **AXVELA OS 정체성 강화** — "Art Market Intelligence Infrastructure" (NOT AI Pricing Engine) 사용자 spec 정조준

---

## 🚀 다음 STEP 권장 (사용자 권장 순서)

🅒 **STEP 101 — Approval Workflow / Trust Layer activation (Phase 6 진입)**
사용자 명시: "STEP 101은 STEP 92 operational insight 안정화 이후 진입"
- Phase 1 foundation freeze + Phase 3 baseline 정착으로 진입 조건 충족
- STEP 86 `lockedBy` slot이 anchor로 정착되어 자연 진입
- DOC-2 §3.1 anchor 4-tier validation reference

🅑 **STEP 93~99 Phase 3 확장 (선택)**
- STEP 93 — Behavioral signal collection (scan / dwell / save 실 데이터 hook → `saveTrackingUnavailable: false` 전환)
- STEP 94 — Cultural Positioning
- STEP 95 — Collector Momentum
- STEP 97 — Real LLM hook (사용자 명시 trigger 시만)
