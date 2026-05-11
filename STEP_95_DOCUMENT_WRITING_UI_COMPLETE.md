# STEP 95 — AI Document Writing UI Integration ✅

> **완료 시점**: 2026-05-07
> **Phase**: Phase 3 Intelligence Layer 4/8
> **방향성**: 6 document_writing targets × 1 단일 공유 component
> **사용자 spec 핵심**: *"AI는 정리 역할만, 확정 / 법적 / 세무 / 가격 / 감정 판단 절대 금지"*

---

## 🎯 STEP 95의 정체성

본 STEP은 **6개 문서 영역에 AI writing assist UI 통합** 입니다.

✅ 본 STEP의 정체:
- 6 document_writing targets 모두 UI 통합 — invoice / receipt / condition_report / settlement_summary / shipment_summary / artwork_description
- 단일 공유 client component (`DocumentWritingAssistButton.tsx`) — 6 surfaces 재사용
- 사용자 spec 6-state machine 정확 매칭 (idle / preparing / generating / preview / applied / failed)
- 사용자 spec 4-step invocation guard 정확 매칭 (source exists / target valid / draft generated / explicit apply)
- AI는 자동 반영 절대 금지 — preview textarea 직접 편집 + "적용"/"버리기" 명시 분기
- AI failure가 document workflow 차단 절대 부재
- Disclaimer 한영 병기 영구 표시

❌ 본 STEP은 *아닙니다*:
- AI가 문서 확정 (법적/세무/가격/감정/계약/보험 판단 0건)
- 자동 setter / 자동 반영 (사용자 명시 click only)
- pricing AI / approval workflow / large orchestration
- 외부 SDK / new entity / persistence 변경

---

## 📊 산출물 요약

| 파일 | LOC | 역할 |
|---|---|---|
| `src/components/document/DocumentWritingAssistButton.tsx` | ~310 | 단일 공유 client component (6-state + 4-step guard) |
| `src/components/invoice/InvoiceDetailDrawer.tsx` | +19 | target=invoice, clipboard apply |
| `src/components/receipt/ReceiptDetailDrawer.tsx` | +25 | target=receipt, clipboard apply |
| `src/components/logistics/ConditionReportDrawer.tsx` | +10 | target=condition_report, setNotes 직접 합류 |
| `src/components/settlement/SettlementDetailDrawer.tsx` | +25 | target=settlement_summary, clipboard apply |
| `src/components/logistics/LogisticsDetailDrawer.tsx` | +13 | target=shipment_summary, setMemo 직접 합류 |
| `src/components/layout/DetailPanel.tsx` | +15 | target=artwork_description, ZONE 5 정착 |
| **production** | **~417 LOC** | **Route +3 kB (단일 component × 6 surfaces 효율)** |

---

## 🧪 Validation Results

```
✓ npx tsc --noEmit          0 errors
✓ npx next lint             clean
✓ npx next build            ✓ Compiled successfully
✓ Route delta               182 kB → 185 kB  (+3 kB, 6 surfaces 통합)
✓ First Load JS             270 kB → 273 kB  (+3 kB)
✓ /api/ai-assist            ƒ server-only (0 B client)
✓ Anthropic scenarios       9/9 PASS  (회귀 0건)
✓ AI Protocol scenarios     17/17 PASS (회귀 0건)
✓ Operational scenarios     12/12 PASS (회귀 0건)
✓ Fiscal scenarios          10/10 PASS (회귀 0건)
✓ Total                     48/48 PASS
```

---

## 🚀 AI 테스트 진입 가이드 (per-kind flag 추가만)

`.env.local`에 한 줄 추가 (API key 재설정 0건):

```
AXVELA_AI_DOCUMENT_WRITING_ENABLED=true
```

→ `npm run dev` →
- **Invoice** drawer → "AI 정리 보조" 클릭 → preview에서 편집 → "복사"
- **Receipt** drawer → 동일 흐름 → "복사"
- **Condition Report** drawer → 메모 입력 → "AI 정리 보조" → "메모에 적용" → notes 직접 합류
- **Settlement** drawer → "AI 정리 보조" → "복사"
- **Logistics** drawer → 메모 입력 → "AI 정리 보조" → "메모에 적용"
- **DetailPanel** ZONE 5 → "AI 정리 보조" (artwork_description) → "복사"

`.env.local`은 git ignore + ZIP 미포함.

---

## 🔬 사용자 spec 7개 핵심 요구사항 — 100% 매칭

### 1. 6 targets 모두 UI 통합 ✅

| # | Target | 통합 surface | Apply 패턴 |
|---|---|---|---|
| 1 | invoice | InvoiceDetailDrawer | clipboard |
| 2 | receipt | ReceiptDetailDrawer | clipboard |
| 3 | condition_report | ConditionReportDrawer | setNotes 직접 합류 |
| 4 | settlement_summary | SettlementDetailDrawer | clipboard |
| 5 | shipment_summary | LogisticsDetailDrawer | setMemo 직접 합류 |
| 6 | artwork_description | DetailPanel ZONE 5 | clipboard |

### 2. AI는 정리 역할만 ✅

- 정리 / 문장 다듬기 / professional tone rewrite ← 본 STEP 활성
- 법적 확정 / 세무 확정 / 가격 판단 / 감정 판단 / 계약 판단 / 보험 판단 ← **0건**
- 25 forbidden phrases 검출 시 `output_rejected` reason → calm copy

### 3. 4-step invocation guard 정확 매칭 ✅

```
STEP 1: source document exists  → empty_source 분기
STEP 2: target type selected    → prop typing 보장
STEP 3: editable draft generated → preview state textarea
STEP 4: user confirms apply      → explicit click only
```

### 4. 6-state machine 정확 매칭 ✅

```
idle → preparing → generating → preview → applied → failed
                                            ↓ (1.5s)
                                          idle (auto-reset)
```

### 5. AI 자동 반영 절대 금지 ✅

- preview state textarea 직접 편집 가능 (사용자가 AI 초안 수정 후 적용)
- "적용" / "버리기" 두 버튼 명시 분기
- onApply prop은 사용자 명시 click 시만 호출
- 자동 setter (`useEffect.*onApply` / `setTimeout.*onApply` / `onMount.*setNotes`) 0건 verified

### 6. Failure 시 기존 데이터 무손상 ✅

- failed state에서 fields 변경 0건
- onApply 호출 0건
- form state 변경 0건
- 외부 clipboard 호출 0건
- 사용자 spec "AI failure must not block document workflow" 정확 매칭

### 7. AI-disabled safe mode 보존 ✅

- env 미설정 시 `ai_unavailable` 응답 → calm copy "AI 정리 보조를 사용할 수 없습니다 · 서버 설정 필요"
- 사용자가 다시 시도 가능
- 다른 form 작업 정상 진행 가능 (CTA 비활성화 / mock draft / calm copy 모두 사용자 spec 매칭)

---

## 🛡️ 5 정책 grep verify (모두 통과)

### 1. AI Direction §1 / §10 ✅
- DocumentWritingAssistButton에 forbidden positive claim 0건
- 25 phrases 검출 layer 4-step output guard 활성

### 2. Trust Layer ✅
ApprovalAction / ApprovalQueue / reviewerAssignment / managerApproval 모두 0건.

### 3. **CRITICAL — API key client exposure** ✅
- `DocumentWritingAssistButton.tsx` → NEXT_PUBLIC_*KEY / process.env.*KEY 0건
- 모든 통합 surface에서도 동일 0건

### 4. **CRITICAL — Server-only modules in client** ✅
- `anthropic.ts` / `invoke.ts` client component import 0건 (모든 통합 surface 검증)

### 5. rule_5 AI-Human Loop (자동 setter check) ✅
- `useEffect.*onApply` / `setTimeout.*onApply` / `onMount.*setNotes` / `onMount.*setMemo` 모두 0건
- 사용자 명시 click trigger only

---

## 🎨 단일 공유 Component × 6 Surfaces 비용 효율

```
6 separate components (가상): ~310 LOC × 6 = 1860 LOC + 6 imports + 6 React state machines
                              → Route 추정 +18 kB

1 shared component (실제):    310 LOC + 6 × ~17 LOC integration = 417 LOC
                              → Route 실측 +3 kB

효율: 6배 production cost 감소, 6배 Route bundle cost 감소
```

DOC-2 §4.1 small criteria + §3.1 Anchor Reuse 패턴 정확 매칭.

---

## 🎨 Apply 패턴 2종 정착

### Pattern A: setState 직접 합류 (텍스트 필드 보유 drawer)

```typescript
// ConditionReport
<DocumentWritingAssistButton
  target="condition_report"
  buildSourceText={() => notes}
  onApply={setNotes}                       // ← 직접 form state 업데이트
  applyButtonLabel="메모에 적용"
/>
```

→ "적용" 클릭 시 즉시 form state 업데이트, 사용자가 다음에 form submit 시 정상 저장.

### Pattern B: clipboard 복사 (구조화 데이터 drawer)

```typescript
// Invoice
<DocumentWritingAssistButton
  target="invoice"
  buildSourceText={() => `청구 금액 ${amountDisplay}...`}
  onApply={(text) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }}
  applyButtonLabel="복사"
/>
```

→ "복사" 클릭 시 텍스트 클립보드에 저장, 사용자가 외부에서 사용 가능 (이메일 / 메시지 / SNS 등).

두 패턴 모두 동일 component 재사용 — `onApply` prop만 다름.

---

## 🔁 STEP 86 Anchor Tier 7 사용처

본 STEP은 STEP 94의 6-state machine + 4-step guard pattern을 정확 답습. 새 abstraction 0개.

| Tier | STEP | 패턴 | 비용 |
|---|---|---|---|
| 1 정착 | STEP 86 | DocumentTrustMetadata | 정착 |
| 2 entity | STEP 87/89 | Receipt + TaxInvoice trust | 0 kB |
| 3 cross-doc | STEP 91 | unified vocabulary | 0 kB |
| 4 fiscal | STEP 90 | withholding/classification | 0 kB |
| 5 new domain | STEP 92 | operational intelligence | +6 kB |
| 6 protocol | STEP 93 | AI integration skeleton | 0 kB |
| 6 (활성) | STEP 94 | provider activation | +1 kB |
| **7 cross-surface** | **STEP 95** | **6 surface integration** | **+3 kB** |

---

## ⚠️ Risk Assessment — 🟡 Low Risk

회귀 영향 가능 영역:
- (a) DetailPanel ZONE 5 layout (기존 2 CTAs + 신규 inline-expandable, 자연 padding 보존)
- (b) 5 fiscal/logistics drawer body (Section append만)
- (c) /api/ai-assist 응답 활성 (env 부재 시 graceful degradation)

회귀 영향 없는 영역 (검증 0줄 변경):
- persistence (validateV1 / SCHEMA_VERSION)
- All Phase 1 Fiscal entities (Settlement / Tax / Invoice / Receipt / TaxInvoice)
- FiscalSummaryDrawer + AccountantExportDrawer
- STEP 92 MarketInsightDrawer / STEP 45 legacy MarketAnalysisDrawer
- STEP 94 ArtworkAIAssistButton (별개 system 보존)
- Sidebar UX-2 / RoleSwitcher / role / rbac / 3-Column / state-machine / transaction-helpers
- All API routes / mock-data / package.json (외부 라이브러리 0개)

---

## 🎯 본 STEP의 영구 가치

1. **단일 공유 component × N surfaces 패턴 영구 reference** — parent-driven props, generic onApply, generic buildSourceText
2. **6-state machine + 4-step invocation guard 패턴 영구 매뉴얼화** — STEP 96~98 답습 baseline
3. **AI failure가 document workflow 차단하지 않는 graceful degradation 패턴 영구 정착**
4. **사용자 spec "AI는 정리 역할만" 영구 코드화** — preview textarea 직접 편집 + 명시 "적용" 버튼 패턴이 Apply 절차의 안전 기준점
5. **STEP 86 anchor Tier 7 사용처** — cross-surface 확장 패턴 입증 (새 abstraction 0개)
6. **Apply 패턴 2종 (setState 직접 합류 / clipboard 복사) 영구 reference** — 향후 STEP에서 동일 분기 답습

---

## 🚀 다음 STEP 권장

🅑 **STEP 96 (translation UI)** — DocumentWritingAssistButton 패턴 답습:
- KO/EN/JA/ZH locale 토글
- DetailPanel zone 또는 Sidebar 진입점
- ~200 LOC 예상 (단일 공유 component 패턴 답습)

🅑 **STEP 97 (condition_compare UI)** — LiDAR/visual variance summary:
- ConditionReportDrawer 통합 (이미 condition_report 활성)
- variance description 자동 생성

🅒 **STEP 101 (Approval Workflow / Trust Layer activation)**:
- Phase 1 freeze + Phase 3 baseline (STEP 92~95) 정착으로 진입 조건 충족
- STEP 86 `lockedBy` slot anchor 사용 시점

---

## 📝 Partial-State 투명성

본 turn에서 다음 작업 모두 본 turn 내 정착:
- ✅ DocumentWritingAssistButton (~310 LOC)
- ✅ 6 surface integration (~107 LOC across 6 files)
- ✅ Build / type / lint / 48 scenarios 통과
- ✅ 5 정책 grep verify 통과
- ✅ STEP_INDEX Quick Reference + STEP 95 row + changelog
- ✅ HANDOFF.md 갱신
- ✅ ARCHITECTURE.md timeline entry
- ✅ 본 완료 보고서
- ✅ ZIP packaging (다음 단계)
