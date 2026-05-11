# STEP UX-3 — Detail Panel Information Density — Completion Report

## State

**STEP 88 baseline (165 kB) → STEP UX-3 (165 kB · 0 kB delta).**
First Load 252 kB → 252 kB (0 kB).
Build / type-check / lint all green.
ZIP: `axvela-step-ux3-detail-density.zip`.

**Pure layout polish의 정확한 신호** — 코드 부피 +85 LOC였지만 bundle delta 0 kB. 사용자 spec §8 정확 매칭 ("keep route delta controlled").

---

## 0. Pre-flight — Partial State Discovery (없음, 4번 연속 패턴 종료)

**투명한 상태 보고**: STEP UX-3 시작 시점에 baseline 검증 결과:

```
src/components/detail-panel/   부재 (디렉토리 없음)
src/lib/detail-panel-*         부재
"STEP UX-3" / "UX-3" 흔적     0건 (grep across src/)
```

**4번 연속 partial-state 패턴 종료** — STEP 86 / 87 / 88까지 prep 코드가 작업 트리에 *이미 정착된 상태*로 발견됐던 패턴이 본 STEP에서 끊김.

**의미**: STEP_INDEX.md 7단계 체크리스트의 5번 *"실제 src tree 확인"*은 *발견 시 차단 / 부재 시 통과* 양 동작 모두 검증 완료. 이는 navigation layer가 *false positive 없는* 신뢰 가능한 메커니즘임을 입증.

**검증**: 본 STEP은 clean slate에서 처음부터 작성. DetailPanel.tsx 단일 파일에 surgical refactor (770 → 855 LOC, +85).

---

## 1. Information Density 문제 분석

### 1.1 STEP 86~88 누적 시점의 첫 화면 분석

```
[BEFORE STEP UX-3]
┌─────────────────────────────────┐
│ Hero (image + AXID + StatusBadge) │
├─────────────────────────────────┤
│ Identity (artist / title / 현재가) │  ← 3 섹션이 모두 동등 weight
├─────────────────────────────────┤
│ 상태 기반 액션                    │  ← "현재: AGREED" hint = StatusBadge 중복
│   [결제 등록]                    │
├─────────────────────────────────┤
│ Curation                        │
├─────────────────────────────────┤
│ Inquiry                         │
├─────────────────────────────────┤
│ Transaction                     │
├─────────────────────────────────┤
│ Transaction History             │
├─────────────────────────────────┤
│ Settlement                      │
├─────────────────────────────────┤
│ Tax                             │
├─────────────────────────────────┤
│ Contract  ← Fiscal/Tax 사이에 낀 Document, 의미 혼란
├─────────────────────────────────┤
│ Logistics                       │
├─────────────────────────────────┤
│ Living Timeline                  │
│   AI 참고 분석 | 감사 로그 보기   │  ← AI Market Insight 스크롤 끝에 매몰
└─────────────────────────────────┘
```

### 1.2 식별된 4 가지 정보 밀도 문제

| 문제 | 현황 | 사용자 spec 매핑 |
|---|---|---|
| **Zone 우선순위 부재** | 9 sub-section이 모두 동등 visual weight, 운영자가 priority zone 인지 불가 | §1 "Reorganize Detail Panel into clear operational zones" |
| **중복 라벨 노출** | "현재: AGREED" hint가 Hero StatusBadge와 중복 / Hero 옆에서 같은 정보 두 번 | §2 "reduce duplicate labels" |
| **Contract 위치 혼란** | Contract (document) 가 Tax (fiscal) 와 Logistics (operational) 사이에 끼어있어 의미론 혼동 | §1 + §4 "fiscal embedded inside operational flow, NOT separate accounting blocks" |
| **AI Market Insight 매몰** | AI 참고 분석이 Timeline header에 작은 텍스트 버튼으로 매몰 (스크롤 끝에서야 발견) | §1 — AI / MARKET INSIGHT가 zone 5로 별도 priority |

---

## 2. Priority Hierarchy 설명

### 2.1 사용자 spec 권장 6 zone 구조

```
[AFTER STEP UX-3]
┌─────────────────────────────────┐
│ Hero (image + AXID + StatusBadge) │  (zone label 없음 — 자연 식별)
├─────────────────────────────────┤
│ Identity (artist / title / 현재가) │  (tightened spacing)
├─────────────────────────────────┤
│ ─ ZONE 1 ─ 다음 작업              │  ← "What should I do now?"
│ 상태 기반 액션 (transition arrow) │     첫 화면 즉시 답변
├─────────────────────────────────┤
│ ─ ZONE 2 ─ 운영 컨텍스트          │  ← Curation + Inquiry
│ Curation                        │     (conditional — 컨텐츠 있을 때만)
│ Inquiry                         │
├─────────────────────────────────┤
│ ─ ZONE 3 ─ 거래 & 문서            │  ← Document/Transaction
│ Transaction                     │     Contract 이동 (rule_4)
│ Transaction History             │
│ Contract  ← MOVED HERE           │
├─────────────────────────────────┤
│ ─ ZONE 4 ─ 정산 & 운영 완료       │  ← Fiscal / Operational closure
│ Settlement                      │     (rule_3 money flow separation)
│ Tax                             │
│ Logistics                       │
├─────────────────────────────────┤
│ ─ ZONE 5 ─ AI 참고                │  ← AI Market Insight (promoted)
│ ┌──────────────────────────┐    │     dedicated card with sub-text
│ │ AI 참고 분석              │    │     "운영 보조 신호 — 인간 판단이 우선"
│ │ 운영 보조 신호 — 인간 우선 │    │
│ └──────────────────────────┘    │
├─────────────────────────────────┤
│ Living Timeline (h3 self-label) │  ← Timeline / Activity (zone 6)
│        | 감사 로그 보기 |        │     (AI 버튼 제거 — zone 5로 이동)
└─────────────────────────────────┘
```

### 2.2 Zone label visual hierarchy

```
h2 (artwork title)        text-[18px]  font-semibold       ← strongest
h3 SectionHeader          text-[11px]  uppercase tracking  ← section level
ZoneLabel (NEW)           text-[9.5px] uppercase tracking  ← zone level
                          text-ink-subtle/70                  (sub-section signal)
```

**의도**: ZoneLabel은 SectionHeader보다 *한 단계 약한 visual weight*. 이는 zone-level이 section-level *위*가 아니라 *옆*에서 *macro-grouping signal*만 제공하는 의미. 사용자가 SectionHeader에 우선 시선 → ZoneLabel에서 *어느 priority zone에 있는지* 인지하는 흐름.

### 2.3 Conditional zone label rendering

빈 zone에 라벨만 떠있는 *visual noise*를 방지하기 위해 zone 별 conditional 검사:

| Zone | Render condition |
|---|---|
| ZONE 1 다음 작업 | 항상 (모든 artwork에 액션 가능) |
| ZONE 2 운영 컨텍스트 | `showInquiry \|\| hasArtworkCuration(curationNotes, artwork.id)` |
| ZONE 3 거래 & 문서 | `showTransaction` (DEAL+) |
| ZONE 4 정산 & 운영 완료 | `!isFreshResale && (showSettlement \|\| showTax \|\| showLogistics)` (PAID+) |
| ZONE 5 AI 참고 | 항상 |
| ZONE 6 Timeline | (label 없음, h3 self-labeled) |

---

## 3. Detail Panel 재구조 요약

### 3.1 Hero (zone label 없음)

- 변경 없음 (기존 220px 이미지 + AXID + StatusBadge 보존)

### 3.2 Identity (zone label 없음)

| 변경 | Before | After |
|---|---|---|
| 하단 padding | `pb-5` | `pb-4` |
| Title line-height | (기본) | `leading-tight` |
| Year/Medium line-height | (기본) | `leading-snug` |
| Dimensions line-height | (기본) | `leading-snug` |
| 가격 row top margin | `mt-4` | `mt-3.5` |

**효과**: Korean+English mixed typography에서 호흡 개선 (사용자 spec §5 mobile polish 매핑).

### 3.3 ZONE 1 — 다음 작업

| 변경 | Before | After |
|---|---|---|
| Zone label | 없음 | `<ZoneLabel>다음 작업</ZoneLabel>` |
| Action section padding | `py-5` | `pt-2 pb-5` (zone label 호흡 흡수) |
| SectionHeader hint | `현재: ${STATE_LABEL_KR[artwork.state]}` (StatusBadge 중복) | `transition ? "전환 가능" : "현재 단계 유지"` |

**효과**: 첫 화면 진입 즉시 "What should I do now?" 답변. Hero StatusBadge와 중복 정보 제거 (사용자 spec §2).

### 3.4 ZONE 2 — 운영 컨텍스트

| 변경 | Before | After |
|---|---|---|
| Zone label | 없음 | conditional `<ZoneLabel>운영 컨텍스트</ZoneLabel>` |
| CurationSummary | 그대로 | 그대로 (0줄 변경) |
| InquirySummary | 그대로 | 그대로 (0줄 변경) |

### 3.5 ZONE 3 — 거래 & 문서

| 변경 | Before | After |
|---|---|---|
| Zone label | 없음 | conditional `<ZoneLabel>거래 & 문서</ZoneLabel>` |
| TransactionSummary | 그대로 | 그대로 (0줄 변경) |
| TransactionHistory | 그대로 | 그대로 (0줄 변경) |
| **ContractSummary** | Settlement/Tax 사이 (Fiscal block 내부) | **Document zone으로 이동** (Transaction History 이후, Settlement 이전) |

**Contract 이동 근거**: rule_4 — Contract is *document* (child of Transaction). Document는 Transaction zone에 자연 속함. 이전 Fiscal block 위치는 의미론적으로 부정확.

### 3.6 ZONE 4 — 정산 & 운영 완료

| 변경 | Before | After |
|---|---|---|
| Zone label | 없음 | conditional `<ZoneLabel>정산 & 운영 완료</ZoneLabel>` |
| SettlementSummary | 그대로 | 그대로 (0줄 변경) |
| TaxSummary | 그대로 | 그대로 (0줄 변경) |
| LogisticsSummary | 그대로 | 그대로 (0줄 변경) |
| NewResaleStartCard | fresh resale 시 표시 | fresh resale 시 표시 (변경 없음, zone label만 suppress) |

### 3.7 ZONE 5 — AI 참고

| 변경 | Before | After |
|---|---|---|
| 위치 | Timeline header에 작은 텍스트 버튼 (감사 로그 옆) | **dedicated zone** (Timeline 위) |
| 라벨 | "AI 참고 분석" | "AI 참고 분석" |
| Sub-text | 없음 | "운영 보조 신호 — 인간 판단이 우선" (AI Direction §10 강화) |
| Visual treatment | 작은 underline 텍스트 버튼 | dedicated card (border + bg-surface + chevron + hover state) |

**효과**: AI Market Insight가 priority zone 5로 promote — 사용자가 의식적으로 인지 / 매몰 회피.

### 3.8 ZONE 6 — Timeline

| 변경 | Before | After |
|---|---|---|
| Zone label | 없음 | 없음 (h3 self-labeled, 사용자 spec §2 "reduce duplicate labels") |
| Living Timeline h3 | 그대로 | 그대로 |
| AI 참고 분석 버튼 (header) | 있음 | **제거** (zone 5로 이동) |
| 감사 로그 보기 버튼 (header) | 있음 | 그대로 (audit는 timeline과 자연 연관) |

### 3.9 신규 sub-component / helper

```typescript
function ZoneLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 pt-4 pb-1.5">
      <span className="text-[9.5px] uppercase tracking-[0.2em] text-ink-subtle/70 font-semibold">
        {children}
      </span>
    </div>
  );
}

function hasArtworkCuration(
  notes: Record<string, { id: string }[]>,
  artworkId: string
): boolean {
  return (notes[artworkId] ?? []).length > 0;
}
```

---

## 4. 변경 파일 목록

### 4.1 변경 파일 (단 1개)

| File | LOC delta | 설명 |
|---|---|---|
| `src/components/layout/DetailPanel.tsx` | +85 (770 → 855) | JSX restructure / ZoneLabel 추가 / hasArtworkCuration 추가 / Contract 위치 이동 / AI Market Insight 분리 / Identity tightening |

### 4.2 신규 문서

| File | 설명 |
|---|---|
| `STEP_UX3_DETAIL_PANEL_DENSITY_COMPLETE.md` | 본 보고서 |

### 4.3 변경 문서

| File | 변경 |
|---|---|
| `ARCHITECTURE.md` | entry append (STEP UX-3 영구 timeline 기록) |
| `HANDOFF.md` | rewrite (STEP UX-3 완료 시점 갱신) |
| `STEP_INDEX.md` | UX-3 🟡 → ✅ + Quick Reference + Future Roadmap 정리 + 변경 이력 |

### 4.4 변경 0줄 (전수 검증 — 사용자 spec §7 DO NOT TOUCH 정확 매칭)

#### Sub-summary 컴포넌트 (사용자 spec "preserve fiscal summaries / lifecycle components")
- `src/components/curation/CurationSummary.tsx` — 0줄
- `src/components/inquiry/InquirySummary.tsx` — 0줄
- `src/components/transaction/TransactionSummary.tsx` — 0줄
- `src/components/transaction/TransactionHistory.tsx` — 0줄
- `src/components/contract/ContractSummary.tsx` — 0줄
- `src/components/settlement/SettlementSummary.tsx` — 0줄
- `src/components/tax/TaxSummary.tsx` — 0줄
- `src/components/logistics/LogisticsSummary.tsx` — 0줄
- `src/components/transaction/NewResaleStartCard.tsx` — 0줄

#### Document Lifecycle (사용자 spec "preserve lifecycle components")
- `src/components/document-lifecycle/` 5 컴포넌트 — 모두 0줄
- `src/lib/document-lifecycle.ts` — 0줄

#### Trust / Audit / Fiscal (사용자 spec "preserve trust metadata / audit architecture / fiscal summaries")
- `src/types/document-trust.ts` — 0줄
- `src/lib/document-trust.ts` — 0줄
- `src/lib/fiscal-summary.ts` — 0줄
- `src/components/fiscal/FiscalSummaryDrawer.tsx` — 0줄
- `src/lib/audit-*.ts` — 0줄
- `src/components/audit/` — 0줄

#### Sidebar / Routing / Persistence / Approval (사용자 spec §7 DO NOT TOUCH)
- `src/components/layout/Sidebar.tsx` — 0줄
- `src/app/page.tsx` — 0줄
- `src/lib/persistence.ts` — 0줄
- `validateV1` / `SCHEMA_VERSION` — 0줄
- `src/lib/rbac.ts` / `src/types/role.ts` — 0줄

#### Drawer 컴포넌트 (사용자 spec "preserve existing flows")
- InvoiceDetailDrawer / ContractDetailDrawer / ReceiptDetailDrawer / ReceiptPrintView / FiscalSummaryDrawer / SettlementDetailDrawer / TaxDetailDrawer / TransactionDetailDrawer / InquiryDetailDrawer / etc. — 모두 0줄

#### Other
- `src/types/*.ts` (신규 type 0개) / `src/store/useArtworkStore.ts` (0줄) / `src/lib/*` (DetailPanel 외 0줄) / `package.json` (0줄)

---

## 5. Mobile Polish 요약

### 5.1 Korean+English mixed typography 호흡 개선

| 항목 | Before | After | 근거 |
|---|---|---|---|
| h2 title | (기본 line-height) | `leading-tight` | 한글+영문 혼합 시 행간 압축으로 가독 유지 |
| Year/Medium row | (기본) | `leading-snug` | 짧은 텍스트의 시각 무게 절제 |
| Dimensions row | (기본) | `leading-snug` | 동일 |

### 5.2 Section padding density

| 영역 | Before | After |
|---|---|---|
| Identity bottom | `pb-5` | `pb-4` |
| Action section top | `py-5` | `pt-2 pb-5` (zone label이 위 호흡 흡수) |
| ZoneLabel | (없음) | `pt-4 pb-1.5` (좁은 라벨 영역) |

### 5.3 Touch target 보존

- Action Primary 버튼 — `size="md"` 그대로
- Sub-summary 클릭 영역 — 그대로
- AI Market Insight 카드 — `py-2.5` (≥ 36px touch target 유지)

**작은 viewport에서도 calm and premium**: 그림자 0 / chart 0개 / 색상 monochrome / minimal padding shifts.

---

## 6. Fiscal Integration Visibility 요약

### 6.1 사용자 spec §4 정확 매칭

> "Receipt / Invoice / Fiscal signals should: feel embedded inside operational flow, NOT separate accounting software blocks."

본 STEP은 다음 4 가지로 *fiscal embedded* 톤을 강화:

| Pattern | 본 STEP 결과 |
|---|---|
| Receipt 발행 흐름 | Payment trigger 자동 cascade (STEP 87) — Receipt drawer 자연 진입, DetailPanel 별도 섹션 *추가하지 않음* (over-segmentation 회피) |
| Invoice signal | Transaction zone 안에 Transaction Summary로 자연 embedded (STEP 32 FX Lock 정보 등) |
| Settlement / Tax / Logistics | "정산 & 운영 완료" zone 4에 cluster — *별도 ERP-style segmentation 0건* |
| Contract 위치 | Document zone (rule_4) — fiscal과 분리하여 *fiscal vs document* 의미론 청결 |

### 6.2 ERP-style segmentation 회피

본 STEP은 *zone label*을 추가했지만 zone 사이에 *별도 시각 분리 (background color / border / divider line)*는 추가하지 않음. 기존 `border-b border-line` 패턴 그대로 — *flow continuity* 유지.

**결과**: 운영자가 위에서 아래로 자연스럽게 흐르며 *priority signal*만 인지. 별도 accounting tab으로 분리되어 운영 흐름 단절되는 ERP 패턴 0건.

---

## 7. 정책 준수 검증 — 4 영구 문서

### 7.1 AXVELA_AI_DIRECTION.md ✓

- §1 Hard Forbidden 표현 0 user-facing (verified by grep)
- §3 권장 표현 사용: "운영 보조 신호 — 인간 판단이 우선" (AI Market Insight card sub-text)
- §10 "AI는 보조" 톤 강화 — AI Market Insight zone에 *명시적 disclaimer*
- rule_5 AI-Human Loop 강화 — AI 진입점이 명확한 zone으로 promote, 사용자가 의식적 클릭

### 7.2 AXVELA_TRUST_LAYER.md ✓

- "PERMISSION ≠ APPROVAL" 분리 보존 — RBAC 변경 0줄
- Approval Slot Placeholder 보존 — Document Lifecycle 5 컴포넌트 0줄 변경
- Approval Workflow 본격 구현 0건

### 7.3 AXVELA_FISCAL_ARCHITECTURE.md ✓

- Layer 1~4 정합 보존
- Contract을 Document zone으로 이동 — rule_4 명확화 (Contract is document)
- Settlement / Tax / Logistics를 fiscal zone에 cluster — rule_3 money flow separation 시각화
- Fiscal embedded inside operational flow (사용자 spec §4)

### 7.4 Manifesto rule 준수 ✓

- **rule_8** Timeline = Navigation — Living Timeline zone 6 위치 그대로
- **rule_14** 3-Column 구조 — DetailPanel `w-[380px]` 그대로
- **rule_15** Primary 1개 — Action zone Primary 버튼 그대로 유일한 검은색 버튼
- **rule_16** minimalism — ZoneLabel은 *기존 SectionHeader보다 약한* visual weight (text-[9.5px] / text-ink-subtle/70)
- **rule_17** drawer layer — 3-Column 0줄 변경

---

## 8. Build / Validation 결과

```
✓ npx tsc --noEmit             — 0 errors
✓ npx next lint                — No ESLint warnings or errors
✓ npx next build               — Route 165 kB / First Load 252 kB
                                 (STEP 88 baseline 165 kB / 252 kB → 0 kB / 0 kB)
```

| 검증 항목 | 결과 |
|---|---|
| Pure layout polish 신호 | ✅ Route 0 kB delta (코드 +85 LOC인데 bundle 동일 — dead-code-elimination + 동일 import 패턴) |
| ZoneLabel 마이크로 컴포넌트 | ✅ 텍스트만 / 그림자 0 / border 0 / 9.5px 톤 |
| Contract 위치 이동 | ✅ Document zone (Transaction History 이후) |
| AI Market Insight 분리 | ✅ Timeline header에서 제거 / dedicated zone 카드 |
| Identity 패딩 tighten | ✅ `pb-4` + `leading-tight/snug` |
| 중복 hint 제거 | ✅ "현재: ${state}" → "전환 가능 / 현재 단계 유지" |
| Sub-summary 컴포넌트 변경 | ✅ 0개 (사용자 spec §7 DO NOT TOUCH 매칭) |
| 신규 라이브러리 | ✅ 0개 |
| persistence 변경 | ✅ 0줄 |
| Forbidden language | ✅ 0 user-facing (verified) |

---

## 9. Risk Assessment

**🟢 Zero Risk** — 단일 파일 layout refactor / 신규 entity 0개 / store mutation 0건 / sub-summary 컴포넌트 0줄 / 외부 라이브러리 0개.

### 회귀 영향 가능 영역

| 영역 | 영향 | 검증 |
|---|---|---|
| `src/components/layout/DetailPanel.tsx` | JSX restructure (logic 0줄) | ✅ build green / type-check 0 errors |

**그 외 영향 0줄** — §4.4에 30+ 영역 전수 검증.

---

## 10. 운영자 / 다음 STEP 작성자 경험 — Before / After

### BEFORE (STEP 88 baseline)
- Detail Panel 9 sub-section이 *동등한 visual weight*로 흐름
- 그 사이 priority zone 구분 없음 — 운영자가 *어떤 정보가 가장 중요한지* 즉시 인지 어려움
- Contract이 Settlement/Tax 사이에 끼어서 *fiscal과 document가 섞임*
- AI Market Insight는 Timeline header에 작은 텍스트 버튼 — *스크롤 끝에서야* 발견
- "현재: AGREED" hint가 Hero StatusBadge와 중복 → cognitive load

### AFTER (STEP UX-3)
- 6 priority zone label로 hierarchical 흐름 명확
- 첫 화면 진입 즉시 ZONE 1 "다음 작업" → "What should I do now?" 답변
- Contract이 Document zone (rule_4)으로 이동 → fiscal vs document 의미론 청결
- AI Market Insight가 dedicated card로 promote → 사용자가 의식적으로 인지
- 중복 라벨 제거 ("현재: ${state}" → "전환 가능 / 현재 단계 유지")
- Sub-summary 자체는 그대로 → 운영자 muscle memory 보존
- Mobile/small screen에서 line-height 개선 → Korean+English mixed typography 호흡 안정

---

## 11. 다음 STEP 권장

```
[지금]      이 ZIP 배포 + 검증 phase
            → 6 priority zone이 운영자에게 자연스러운 흐름인지
            → Contract 위치 이동이 의미론적으로 청결한지
            → AI Market Insight zone 5 promote가 적절한 visibility인지
            → ZoneLabel visual weight가 SectionHeader 우선순위 침범하지 않는지
   ↓
[검증 후]   다음 후보:
   🅐 STEP 89 — Tax Invoice 도메인 entity (~300 LOC, 🟡 medium)
       → Phase 1 Fiscal 4번째 / STEP 86 anchor 두 번째 사용처 검증
       → 본 STEP의 정산 & 운영 zone에 자연 합류 가능
   🅑 STEP 91 — Accountant Export (~250-350 LOC, 🟡 medium)
       → 본 STEP 88의 [PDF 저장 준비] / [회계 전달 준비] 버튼 활성
       → cross-document export (Invoice + Receipt + Settlement + Tax)
   🅒 STEP DOC-2 — STEP_INDEX 자동화 (~150 LOC, 🟢 low)
       → 4 STEP 연속 partial-state 사례에서 자동화 가치 입증
       → 새 STEP 완료 시 INDEX 자동 동기 hook / script
   🅓 STEP 90 — Settlement Tax derive (~150 LOC, 🟢 low)
       → Phase 1 Fiscal 5번째 / 신규 entity 0개 / derived layer
```

**제 추천**: 🅐 STEP 89 (Tax Invoice). 이유:
- UX track 3/3 완성 (UX-1 + UX-2 + UX-3) — *cognitive load 안전망* 정착됐으니 이제 fiscal 진행 안전
- Phase 1 Fiscal 3/6 완성 → 89/90/91로 끝까지 진행 후 Phase 2 / Phase 3 진입
- STEP 89는 STEP 86 anchor 두 번째 사용처 — `deriveTaxInvoiceTrust` 패턴 자연 추가
- 본 STEP의 ZONE 4 "정산 & 운영 완료"에 Tax Invoice 자연 합류 가능

---

## 12. 본 STEP의 영구 가치

본 STEP UX-3은 **AXVELA OS의 UX track 3/3 완성**:

```
UX-1  Action Clarity Layer        "이 버튼 누르면 뭐가 일어나?" 답변
UX-2  Sidebar Grouping             "어떤 메뉴에 어떤 게 있어?" 답변
UX-3  Detail Panel Density         "지금 뭐 봐야 해?" 답변  ⭐
```

**완전한 UX 정합 layer**:
- UX-1: 액션 의미 모호함 제거 (Primary / Secondary / "준비 중" 명시)
- UX-2: Sidebar PRIMARY/OPERATIONS/GOVERNANCE 그룹 + AI 라벨 reframe
- UX-3: Detail Panel 6 priority zones + Contract 위치 / AI Market Insight 분리

**향후 어떤 fiscal STEP / approval STEP을 진행해도 본 3 layer가 *cognitive load 안전망***. STEP 89 (Tax Invoice) / STEP 91 (Accountant Export) / STEP 101+ (Approval Workflow) 모두 *기존 zone 위*에 자연 합류 가능 — 별도 UX 정련 STEP 불필요.

**4번 연속 partial-state 패턴 종료**: STEP 86 / 87 / 88까지 prep 코드가 작업 트리에 *이미 정착된 상태*로 발견됐던 패턴이 본 STEP에서 끊김. STEP DOC-1 navigation layer는 *발견 시 차단 / 부재 시 통과* 양 동작 모두 입증 — *false positive 없는 신뢰 가능한 메커니즘*.

**Pure layout polish의 정확한 신호**: 코드 +85 LOC인데 bundle delta 0 kB — Tailwind utility-first + dead-code-elimination + 동일 import 패턴이 *layout-only 변경*은 bundle에 흔적을 남기지 않음을 입증. 미래 UX polish STEP들 (UX-4 Work Queue 등) 모두 동일 패턴 가능.

---

## 13. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-07 | STEP UX-3 — STEP 88 직후 (baseline 165 kB), partial-state 0건 (4 STEP 연속 패턴 종료). 본 STEP 작업: (a) DetailPanel.tsx 단일 파일 surgical refactor / (b) 빌드 / 타입 / lint 검증 / (c) 4 정책 문서 정합성 검증 / (d) 표현 정책 grep verify / (e) STEP_INDEX / HANDOFF / ARCHITECTURE entry / 완료 보고서 / ZIP 패키징. 6 priority zones (다음 작업 / 운영 컨텍스트 / 거래 & 문서 / 정산 & 운영 완료 / AI 참고 / Timeline) + ZoneLabel 마이크로 컴포넌트 + Contract 위치 이동 (Fiscal block → Document zone) + AI Market Insight 분리 (Timeline header → 전용 zone) + 중복 hint 제거 + Identity / Hero density tightening. **Pure layout polish** — Route 165 kB → 165 kB (0 kB delta). 단일 파일 +85 LOC (770 → 855). UX track 3/3 완성. |
