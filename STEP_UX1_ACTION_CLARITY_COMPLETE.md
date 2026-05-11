# STEP UX-1 — Action Clarity Layer — Completion Report

## State

**149 kB → 150 kB (+1 kB exactly).**
Build / type-check / lint all green.
ZIP: `axvela-step-ux1-action-clarity.zip`.

---

## Summary of UX Improvements

### Fix 1 — Ambiguous helper text 5곳 제거
| 위치 | Before | After |
|---|---|---|
| INQUIRY · 보류 | "Inquiry 상세에서 변경" | "준비 중" |
| DEAL · Contract 검토 | "다른 카드에서 진행" | "준비 중" |
| DEAL · 보류 | "Inquiry 상세에서 변경" | "준비 중" |
| PAID · 물류 배정 | "다른 카드에서 진행" | "준비 중" |
| PAID · Tax 분류 | "다른 카드에서 진행" | "준비 중" |

**유지된 명시적 hint** (어디로 가야 하는지 명확함):
- READY · 가격 조정 → "작품 편집에서 변경" ✅
- CLOSED · Document 보관 → "자동 보관 완료" ✅ (액션 아닌 상태)

### Fix 2 — Primary action hierarchy 강화
**Before**:
```
[ 다음: 결제 등록 ]   ← 검은색 primary

[Contract 검토]       [보류]            ← 둘 다 button shape (회색/투명)
"다른 카드에서 진행"   "Inquiry 상세에서 변경"
```
- 두 secondary button이 grid 2-col로 *Primary와 거의 동일한 visual weight*
- 모호한 hint로 클릭 시 어디로 가는지 불명

**After**:
```
[ 다음: 결제 등록 ]   ← 검은색 primary (유일한 button shape)
─────────────────
추가 작업
Contract 검토                              준비 중
보류                                       준비 중
```
- 작은 텍스트 링크 톤 + "추가 작업" header + divider
- "준비 중" 명시 라벨 (모호한 instructional 0건)

### Fix 3 — `REDUNDANT_LABEL` 상수 deprecate
`ButtonHint.tsx`의 `REDUNDANT_LABEL` (`"다른 카드에서 진행"`)에 `@deprecated` JSDoc 마크. 신규 코드의 사용 0건 정책 명시.

---

## Why Each Change Improves Operational Clarity

### Change 1 — 모호한 hint 제거
**Before**: 사용자가 "Contract 검토" 클릭 후 *어디서 검토하지?* 라는 의문 발생. spec의 critical UX problem ("where do I click?")
**After**: "준비 중" 명시 → 사용자가 즉시 *아직 안 만들어진 기능*임을 인지. 기능 부재가 *부재 표현 부재*로 가려지지 않음.

### Change 2 — Visual hierarchy 분리
**Before**: secondary / tertiary가 button shape으로 *Primary와 시각적 경쟁* → rule_15 위반 ("Primary 1개" 정책)
**After**: 작은 텍스트 링크 + divider + "추가 작업" header → Primary 검은 버튼이 *유일한 button shape* → 사용자가 *지금 해야 할 일*을 즉시 인지.

### Change 3 — Hint를 inline으로 이동
**Before**: button 아래 줄에 hint → 시각적으로 *button의 일부*처럼 보임
**After**: 텍스트 링크 우측 끝에 inline → *상태 라벨*로 자연스럽게 분리

---

## Affected Files

| File | LOC delta | Change |
|---|---|---|
| `src/components/layout/DetailPanel.tsx` | ~160 LOC | SUPPORTING_ACTIONS 단순화 + render 영역 변경 + SecondaryActionRow 신규 |
| `src/components/ui/ButtonHint.tsx` | ~10 LOC | `REDUNDANT_LABEL` deprecate JSDoc |
| `ARCHITECTURE.md` | +6 KB | STEP UX-1 entry |
| `STEP_UX1_ACTION_CLARITY_COMPLETE.md` | 신규 | 본 보고서 |

---

## Risk Assessment

🟢 **Low Risk**

| 측면 | 평가 |
|---|---|
| 변경 영역 범위 | DetailPanel의 supporting action UI 영역만 (격리됨) |
| 핸들러 로직 변경 | 0건 — 기존 `handleSecondary` / `isSecondaryHandlerWired` / `isSecondaryDataReady` 그대로 |
| State machine 영향 | 0건 — `getTransition()` / Primary action 흐름 무영향 |
| RBAC / Permission | 0건 — `permissionHint` 그대로 |
| Persistence schema | 0줄 — 데이터 모델 무관 |
| Store action | 0줄 — 모든 도메인 액션 그대로 |
| 회귀 영향 가능 영역 | supporting action visual rendering만 — 함수형 동작 동일 |
| Forbidden language | 0건 (verified) |
| AXVELA AI Direction 정책 | ✅ 준수 (AI 영역 무관) |

---

## Route Delta

```
149 kB → 150 kB        Route             +1 kB
236 kB → 237 kB        First Load JS     +1 kB
```

신규 sub-component (`SecondaryActionRow`)가 인라인 추가되어 minimal.

---

## Before/After Operational Reasoning

### Before
```
사용자 시나리오:
1. 작품 카드 클릭
2. Detail Panel에서 "거래 진행" 상태 확인
3. 검은색 [다음: 결제 등록] 버튼 보임
4. 그 옆에 [Contract 검토] [보류] 두 button이 *primary와 비슷한 무게*로 보임
5. "Contract 검토" 클릭 → ... 안 됨
6. hint 읽어보니 "다른 카드에서 진행"
7. 사용자: "어느 카드? 어디 눌러?" 혼란
```

### After
```
사용자 시나리오:
1. 작품 카드 클릭
2. Detail Panel에서 "거래 진행" 상태 확인
3. 검은색 [다음: 결제 등록] 버튼이 *유일한 button shape*
4. 그 아래 divider + "추가 작업" header
5. 작은 텍스트 "Contract 검토 · 준비 중" / "보류 · 준비 중"
6. 사용자: "지금 해야 할 일은 결제 등록. Contract / 보류는 아직 준비 중."
7. 명확.
```

---

## DO NOT 항목 모두 준수

| spec 금지 항목 | 결과 |
|---|---|
| redesign entire app | ✅ 0건 |
| rebuild layout systems | ✅ 0건 (3-column 0줄) |
| add new backend infrastructure | ✅ 0건 |
| implement fiscal systems | ✅ 0건 |
| implement work queue system yet | ✅ 0건 |
| redesign sidebar completely | ✅ 0건 |
| add lifecycle engine | ✅ 0건 |
| add heavy animation | ✅ 0건 |
| add dashboard complexity | ✅ 0건 |

---

## Manifesto Alignment

| Rule | 적용 |
|---|---|
| **rule_2 Flow System** | "추가 작업" header 도입으로 *지금 흐름의 단계* 명확화 |
| **rule_5 AI-Human Loop** | AI 영역 변경 0건 — light reframe spec 준수 |
| **rule_9 Work Queue** | "준비 중" 명시 → 사용자가 *클릭 즉시 동작 가능한 것 / 미구현*을 분리 인지 |
| **rule_14 Layout** | 3-Column 0줄 변경 |
| **rule_15 Primary Action Clarity** | ⭐ Primary 검은 버튼이 *유일한 button shape* — 정책 강화 |
| **rule_16 미니멀 디자인** | 작은 typography (9px header / 11.5px label / 9.5px hint) / 그림자 0 / chart 0 |
| **rule_17 Layer UI** | drawer / modal 추가 0건 |
| **AXVELA AI Direction** | AI / Market Intelligence 무관 영역 |

---

## Validation

```
✓ npx tsc --noEmit             — 0 errors
✓ npx next lint                 — No ESLint warnings or errors
✓ npx next build                — Route 150 kB / First Load 237 kB (+1 kB)
```

### 모호한 문자열 잔재 검증
```
$ grep -rE "다른 카드에서 진행|Inquiry 상세에서 변경" src/

→ 정책 주석 / @deprecated JSDoc / SecondaryActionRow JSDoc에만 잔재
→ UI 노출 0건 (verified)
→ 사용자 시나리오에서 보일 수 없음
```

### Forbidden language (AXVELA AI Direction 정책)
```
$ grep -rE "AI Estimated Price|확정 시장가|투자 보장" \
    src/components/layout/DetailPanel.tsx \
    src/components/ui/ButtonHint.tsx
→ 0 hits (verified)
```

---

## 🎯 Mid-update phase 진행 중 추가된 STEP

이 STEP은 *mid-update 시작 직후 발견된 사용성 문제*를 즉시 정조준한 STEP입니다. spec strict scope ("focused / safe / incremental / low-risk / production-oriented") 모두 준수.

### 다음 단계 권장
1. **현재 ZIP 배포 + 며칠 검증**
2. 검증 후 다음 결정:
   - 🅐 STEP UX-2 (Sidebar Grouping & AI light reframe) — UX 정련 계속
   - 🅑 STEP 86 (Document Trust Metadata) — Phase 1 Fiscal 시작
   - 🅒 그 외 — 사용 검증 결과에 따라

UX-1 만으로도 *"지금 뭐 해야 하지?"* 통증의 70% 해결되었을 것으로 예상. 검증 후 UX-2가 정말 필요한지 결정하시면 됩니다.
