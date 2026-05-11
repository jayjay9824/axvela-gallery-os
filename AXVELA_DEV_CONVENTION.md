# AXVELA Development Operating Convention

> **5번째 영구 정책 문서**
> AI Direction / Trust Layer / Fiscal Architecture / STEP_INDEX (navigation) 위에 정착된 *cross-cutting operating convention*.
>
> **이 문서는**:
> AXVELA OS의 *어떻게 만들어지는가*에 대한 영구 규칙. *무엇을 만들 것인가*가 아닌 *어떻게 안전하게 만들 것인가*.
>
> **이 문서의 정착 근거**:
> STEP 86~91 multi-STEP 세션에서 *6번 partial-state 사례* + *5번 clean-slate 사례* + *4-tier anchor validation*이 stable convention으로 굳어지면서 자연 도출. 본 문서는 *발견*이 아니라 *문서화*.
>
> **목표**:
> future development consistency + reduced architectural drift + safe incremental scaling

---

## 0. Reading Guide — 본 문서를 어떻게 사용하는가

본 문서는 *generic README가 아니다*. 새 STEP에 진입하기 전, 다음 결정점을 만났을 때 *직접 참조*하는 운영 매뉴얼:

| 결정점 | 참조 섹션 |
|---|---|
| 새 STEP을 시작해야 하는가? | §1 STEP Lifecycle |
| 작업 트리에 이전 turn의 산출물이 정착되어 있다 | §2 Partial-State Rules |
| 새 entity / helper / abstraction을 만들어야 하는가? | §3 Anchor Reuse Rules |
| 산출물이 너무 커지고 있다 | §4 Complexity Control Philosophy |
| 어떤 STEP을 다음에 할지 모르겠다 | §5 Recovery & Stabilization Patterns |

본 문서는 *길다*. 의도된 길이 — convention은 짧으면 해석 여지가 생긴다. 모호함 = drift.

---

## 1. STEP Lifecycle — 5-State Model

모든 STEP은 다음 5 상태를 *명시적*으로 가진다. 상태는 STEP_INDEX.md에 emoji로 표기된다.

### 1.1 5 States

```
🔘 draft           → 🟡 partial         → 🟢 stabilized
                                              ↓
                                        🟦 frozen
                                              ↓
                                        ⭐ phase-complete
```

#### 🔘 `draft`
- **정의**: 사용자 spec이 도착했고, 작업 시작 전 단계.
- **확인 조건**: STEP 번호가 STEP_INDEX.md `Phase 1 Fiscal Roadmap` (또는 해당 Phase) 표에 등재되어 있고 상태가 🟡 또는 🔘.
- **다음 진입**: 사용자 spec 분석 + partial-state 검증 + baseline build green 확인.

#### 🟡 `partial`
- **정의**: 코드가 작업 트리에 정착되었으나 *완료 신호 부재*. 다음 중 하나 이상:
  - build / type-check / lint 미검증
  - STEP_INDEX / ARCHITECTURE / HANDOFF 미갱신
  - 완료 보고서 (`STEP_NN_*_COMPLETE.md`) 부재
  - ZIP 미생성
- **확인 방법**: 새 turn 시작 시 *항상* 다음 7-step checklist 실행 (§2.1 참조).
- **다음 진입**: §2 Partial-State Rules에 따라 continuation safe 확인 → 정착 코드 *그대로 사용* → 미완 산출물 보강.

#### 🟢 `stabilized`
- **정의**: 다음 모두 충족:
  - build/type/lint green
  - 정책 grep verify (AI Direction 금지 표현 0건 / Trust Layer Approval leakage 0건)
  - STEP_INDEX 갱신 (Quick Reference + 해당 Phase 표 + changelog entry)
  - ARCHITECTURE.md timeline entry
  - HANDOFF.md Last STEP 갱신
  - `STEP_NN_*_COMPLETE.md` 완료 보고서 정착
  - ZIP 패키징 + `/mnt/user-data/outputs/` 출력
  - `present_files` 호출
- **다음 진입**: 다음 STEP 진행 또는 Phase freeze 검토.

#### 🟦 `frozen`
- **정의**: STEP의 *어떤 후속 변경도 금지*된 상태. 변경 시 새 STEP 번호로 진행.
- **확인 조건**:
  - 정착 후 ≥ 1개의 후속 STEP에서 anchor / helper로 *실제 사용*됨 (STEP 86이 STEP 87/89/91/90에서 사용된 사례)
  - 4 영구 정책 문서 정합 100%
  - production runtime impact가 최종 측정됨 (Route delta 기록)
- **변경 정책**: frozen STEP의 entity / helper / type signature 변경 시 *반드시 새 STEP 번호*로 진행. 본 STEP에 직접 commit 금지.

#### ⭐ `phase-complete`
- **정의**: Phase의 모든 STEP이 frozen 상태이고, *foundation freeze* 선언된 상태.
- **확인 조건**:
  - 해당 Phase의 STEP 표가 모두 ✅
  - cross-STEP integration 검증 완료 (예: anchor pattern N-tier validation)
  - 다음 Phase 진입 사용자 승인
- **사례**: Phase 1 Fiscal — STEP 86+87+88+89+90+91 = 6/6 phase-complete (STEP 90 정착 시점).

### 1.2 상태 전환 조건 매트릭스

| 현재 → 다음 | 조건 |
|---|---|
| draft → partial | 작업 시작, 일부 산출물 정착 |
| draft → stabilized | 단일 turn 완성 (드물다 — 작은 STEP만) |
| partial → stabilized | 정착 코드 검증 + 누락 산출물 (docs / ZIP) 보강 |
| partial → draft | 정착 코드 폐기 결정 (rollback) — 사용자 명시적 승인 필수 |
| stabilized → frozen | 1+ 후속 STEP에서 실제 사용 + 4 정책 정합 100% |
| stabilized → 새 STEP | drift 없는 점진 진행 (대부분의 경우) |
| frozen → 변경 | **금지** — 새 STEP 번호로만 진행 |

### 1.3 Anti-pattern

❌ STEP 시작 후 *즉시* 코드 작성 — partial-state 검증 없이.
❌ ZIP 출력하지 않고 다음 STEP 진행 — 산출물 누적 → 명확성 손실.
❌ frozen STEP의 entity 직접 mutation — 새 STEP으로 분리해야 함.
❌ 단일 turn에서 다중 Phase의 STEP 동시 진행 — phase mixing.

---

## 2. Partial-State Rules

본 섹션은 AXVELA에서 가장 빈번한 시나리오를 다룬다. STEP 86~91 6개 STEP 중 *6번* partial-state가 발생했다 — 즉 표준 시나리오.

### 2.1 7-step Checklist (모든 turn 시작 시 실행)

```
1. STEP 번호 확인 (사용자 spec or HANDOFF Last STEP)
2. baseline build green 확인 (npm install + tsc --noEmit)
3. 작업 트리에서 본 STEP의 정착 흔적 검색
   → grep -rn "STEP NN\|<keyword>" src/
   → ls src/types/<domain>* src/lib/<domain>*
4. STEP_INDEX 해당 STEP 행 상태 확인 (🔘/🟡/✅)
5. 정착 코드 발견 시 → §2.2 Continuation Decision Tree
   정착 코드 부재 시 → §2.3 Clean Slate Path
6. ARCHITECTURE.md / HANDOFF.md 의 STEP NN 언급 grep
7. 출력 디렉토리 (/mnt/user-data/outputs/) 의 ZIP 존재 확인
```

### 2.2 Continuation Decision Tree (정착 코드 발견 시)

```
정착 코드 발견
    ↓
사용자 spec과 정착 코드의 entity / helper / type signature가 *일치*하는가?
    ├─ YES → continuation safe
    │        → 정착 코드 *그대로 사용*
    │        → 누락 산출물 (docs / ZIP / verify) 보강
    │        → §1.1 stabilized 진입 조건 충족 시 완료 처리
    │
    └─ NO  → 사용자에게 명시적 확인 요청
             → 정착 코드 폐기 OR 사용자 spec 재해석
             → *재구현 / 덮어쓰기 / 중복 정의 절대 금지*
```

### 2.3 Clean Slate Path (정착 코드 부재 시)

```
정착 코드 부재
    ↓
사용자 spec 분석 → 새 산출물 작성
    ↓
중간 build/type-check 자주 (대규모 entity 추가 시 file-by-file)
    ↓
4 정책 정합 grep verify
    ↓
완료 산출물 정착 (§1.1 stabilized 조건)
```

### 2.4 Continuation Safe Conditions

다음 모두 충족 시 *continuation safe*:
- 정착 코드의 *exported API*가 사용자 spec과 100% 일치 (entity 필드 / helper 시그니처 / enum 멤버)
- 정착 코드의 *internal logic*이 사용자 spec의 결정 흐름과 일관 (그룹별 분기 / 우선순위 / fallback chain)
- 4 정책 문서 grep verify 통과 (AI Direction 금지 표현 / Trust Layer Approval leakage)
- baseline build green

다음 중 하나라도 발견 시 *unsafe* — 사용자에게 명시적 확인:
- 정착 코드가 사용자 spec의 *forbidden list* 항목 포함 (예: external API 호출, 새 라이브러리)
- entity 필드 / helper 시그니처 *불일치* (사용자 spec과 다른 이름 / 타입)
- 4 정책 문서 위반 (user-facing 금지 표현)

### 2.5 Rollback Conditions

*rollback 필요* (정착 코드 폐기 + 새로 시작) 결정 조건:
- 정착 코드가 frozen STEP의 entity를 *직접 mutation*함 (frozen 위반)
- 정착 코드가 사용자 spec의 *DO NOT* 항목을 위반함 (예: AI Market Insight activation, government API)
- 정착 코드가 *cross-Phase mixing*임 (예: Phase 1 STEP에 Phase 6 Approval Workflow 코드)

rollback 결정은 *사용자 명시적 승인 필수*. AI 단독 결정 금지.

### 2.6 Multi-STEP Session에서 Partial Detection Rule

multi-STEP 세션 (단일 conversation에서 여러 STEP 진행)에서 partial-state는 *기본 가정*:

```
turn N+1 시작
    ↓
turn N에서 ZIP 출력 + present_files 호출이 *명시적으로* 완료되었는가?
    ├─ YES → turn N의 STEP은 stabilized
    │        → turn N+1은 새 STEP 진행 가능
    │
    └─ NO  → turn N의 STEP은 partial
             → turn N+1은 §2.1 7-step checklist 실행
             → 정착 코드 발견 가능성 高 → §2.2 Continuation Decision Tree
```

**핵심 원리**: turn 경계는 *완료 신호*가 아니다. 명시적 ZIP 출력 + present_files가 *유일한* 완료 신호.

### 2.7 Freeze 진입 조건

partial → frozen 직접 전환 *금지*. 반드시 stabilized 경유.

frozen 진입은:
- 1+ 후속 STEP에서 anchor / helper로 *실제 import + 사용*됨
- production runtime에 deployed (Route delta 기록됨)
- 4 정책 문서 정합 100% verify
- *시간*이 흐른 후 — 즉각 frozen 선언 금지 (premature optimization 회피)

---

## 3. Anchor Reuse Rules — STEP 86 Pattern 기준

본 섹션의 *기준 사례*: STEP 86 `DocumentTrustMetadata`. 4-tier validation 입증된 anchor pattern.

### 3.1 STEP 86 Anchor 4-Tier Validation 사례

```
Tier 1 — 정착 (STEP 86)
    DocumentTrustMetadata 12 필드 + 6 docType enum 정착
    code: src/types/document-trust.ts + src/lib/document-trust.ts
    Route delta: 0 kB (production import 부재 → tree-shake)

    ↓

Tier 2 — Entity Helper 사용 (STEP 87 + STEP 89)
    deriveReceiptTrust(receipt, ctx)        — Receipt 진입
    deriveTaxInvoiceTrust(taxInvoice, ctx)  — TaxInvoice 진입
    각 helper ~70 LOC만 추가 → anchor pattern의 *예측 정확도* 입증

    ↓

Tier 3 — Cross-Doc 통합 사용 (STEP 91)
    buildAccountantExportPackage(input)
    → Invoice + Receipt + TaxInvoice + Settlement + Tax 모두
       *동일 column vocabulary* (generated_at / generated_by / locked_at /
        locked_by / source_context / revision_reason)로 export
    → STEP 86의 cross-document design 검증 시점

    ↓

Tier 4 — Fiscal Calculation 영역 확장 (STEP 90)
    deriveSettlementTax(settlement, artistType?)
    deriveRecommendedFiscalDocuments(input)
    → anchor pattern과 *동일 shape* (pure / no I/O / 입력 → 출력 view)
    → fiscal calculation 영역까지 자연 확장 입증
```

### 3.2 Anchor Extension vs New Abstraction 결정 트리

```
새 entity / helper / type 필요
    ↓
기존 anchor에 자연 합류 가능한가?
    ├─ YES → §3.3 Extension Path
    │        예: TaxInvoice → DocumentTrustMetadata enum에 "TAX_INVOICE" 추가
    │
    └─ NO  → 새 abstraction 필요한 *충분 근거*가 있는가?
             ├─ YES → §3.4 New Abstraction Path
             │        예: STEP 88 FiscalSummaryAggregate (cross-domain aggregate
             │             이라 Document Trust와 별개 layer)
             │
             └─ NO  → derive layer만 추가 (§3.5)
                      예: STEP 90 SettlementTaxBreakdown
                          (Settlement entity 변경 0줄, 단순 derive)
```

### 3.3 Extension Path — 기존 Anchor 확장

**언제 사용**:
- 새 도메인 entity가 기존 anchor의 view shape에 *natural fit* (Receipt → DocumentTrustMetadata)
- enum 확장 (DocumentType에 새 멤버) 만으로 표현 가능
- helper ~30-100 LOC 추가만으로 자연 합류

**필수 조건**:
- 기존 anchor의 *exported signature 0줄 변경* (forward-compat 유지)
- 기존 anchor의 *internal logic 0줄 변경* (helper만 추가)
- 새 helper는 *동일 shape* (pure / no I/O / 입력 → 출력 view)

**사례**:
- STEP 87 `deriveReceiptTrust` (~70 LOC)
- STEP 89 `deriveTaxInvoiceTrust` (~70 LOC)
- STEP 90 `deriveSettlementTax` (220 LOC, 더 큰 derive view지만 동일 shape)

### 3.4 New Abstraction Path — 새 추상화 생성

**언제 사용**:
- 기존 anchor와 *근본적으로 다른 layer*에 위치 (예: aggregate vs entity)
- 다른 dimension의 cross-cutting 정보 필요 (예: time period filter)
- 본 STEP을 끝낸 후 후속 STEP 1+ 에서 *anchor*로 사용될 가능성

**필수 조건**:
- 기존 anchor와의 *경계 명시화* (어떤 영역은 anchor에, 어떤 영역은 새 추상화에)
- 4-tier validation 가능성 *사전 검토* (entity helper / cross-doc 통합 / 영역 확장 시나리오 가정)
- production runtime 부담 최소화 (Route delta 측정)

**사례**:
- STEP 86 `DocumentTrustMetadata` 자체 (Tier 1 시점)
- STEP 88 `FiscalSummaryAggregate` (cross-domain aggregate, Document Trust와 별개 layer)

### 3.5 Pure Derive Layer — 가장 안전한 옵션

**언제 사용**:
- 새 entity 0개, store 0줄, persistence 0줄, UI 0줄 정착 가능
- 입력 (기존 entity + opts) → 출력 (derive view shape)만 정의
- production runtime tree-shake 가능 (호출자 부재 시 0 kB)

**필수 조건**:
- *pure*: no I/O / no store / no DOM / no fetch / no localStorage
- 결정성 (같은 입력 → 같은 출력)
- 4 정책 문서 정합 100%

**사례**:
- STEP 88 `buildFiscalSummaryAggregate` (Route +3 kB — drawer 동반)
- STEP 90 `deriveSettlementTax` + `deriveRecommendedFiscalDocuments` (Route 0 kB — drawer 부재)

### 3.6 금지 — Orchestration Expansion

**absolute 금지 항목**:
- 새 store middleware 추가 (Zustand middleware / Redux saga 등)
- 새 lifecycle hook (React custom hook을 *cross-cutting*으로 만드는 것)
- 새 messaging layer (event bus / pub-sub / observable)
- 새 background sync logic (interval / setTimeout 기반 polling)
- 새 외부 라이브러리 (charting / state-management / form / animation)

**판단 기준**:
> "이 추상화 없이 본 STEP의 핵심 가치를 *완전히* 달성할 수 있는가?"
> 대답이 *yes* 라면 추상화 추가 금지.

### 3.7 새 Abstraction 생성 기준 — 5-Question Gate

새 abstraction 추가 전 다음 5 질문 *모두 yes*여야 함:

1. 기존 anchor / pattern으로 *완전히* 표현 불가능한가?
2. 본 추상화는 *minimum viable* 형태인가? (필드 / 메서드 절제)
3. 본 추상화는 후속 STEP 1+ 에서 *실제 사용 계획*이 있는가?
4. production runtime 부담이 *최소*인가? (Route delta 측정 가능)
5. 4 정책 문서 정합 100%인가?

하나라도 *no* → 추상화 보류, 더 가벼운 path (Extension or Pure Derive) 재검토.

---

## 4. Complexity Control Philosophy

AXVELA의 *영구* 개발 방향:

```
small / stable / predictable / incremental / derived-layer-oriented
```

다음 방향은 *최대한 억제*:

```
premature infrastructure expansion
unnecessary orchestration
phase mixing
speculative architecture growth
```

### 4.1 Small — 작게

- 단일 STEP의 LOC 상한 *목표*: production code ≤ 1500 LOC, doc/test 포함 ≤ 2500 LOC
- 단일 PR (단일 STEP) Route delta *목표*: ≤ 10 kB
- 초과 시 *반드시* 더 작은 STEP으로 분할 (예: Tax Invoice 도메인을 entity-only / drawer / print-view 3 STEP으로 가능)

**사례**:
- STEP 86: production 0 kB, 600 LOC types/helper — 가장 안전
- STEP 87: +9 kB Route, ~1500 LOC — 도메인 entity 추가 (entity 정착의 자연 비용)
- STEP 88: +3 kB Route, ~1000 LOC — derived layer (entity 부재로 효율적)
- STEP 89: +5 kB Route, ~1500 LOC — 두 번째 entity, audit-navigation 재사용으로 효율적
- STEP 90: 0 kB Route, ~1365 LOC — pure derive, future-ready infrastructure
- STEP 91: +5 kB Route, ~1200 LOC — cross-doc projection (drawer 동반)

### 4.2 Stable — 안정

- *frozen STEP의 entity / helper signature 변경 절대 금지*
- backward-compat: persistence schema는 옵셔널 필드만 추가 (validateV1 변경 0줄)
- forward-compat: 새 STEP에서 사용할 anchor 슬롯 *사전 정착* (STEP 86이 TAX_INVOICE / RECEIPT / CERTIFICATE / SETTLEMENT_EXPORT enum 멤버 사전 등재)

### 4.3 Predictable — 예측 가능

- 4 정책 문서 grep verify는 *반복 가능*해야 함 (구체적 키워드 list)
- build / type-check / lint / scenario 검증 명령어 *고정*
- Route delta 측정 방법 *고정* (`npx next build` 출력의 `Route (app)` 행)

### 4.4 Incremental — 점진

- 단일 turn에서 *단일 Phase*만 진행 (phase mixing 금지)
- 단일 STEP에서 *단일 도메인 entity*만 추가 (예: Receipt + TaxInvoice 동시 추가 금지 — 별 STEP)
- 단일 STEP에서 *단일 cross-cutting concern*만 정착 (예: Audit + Fiscal 동시 변경 금지)

### 4.5 Derived-Layer-Oriented — 파생 우선

새 정보 표시 / 새 view 필요 시 우선순위:

```
1. Pure derive layer (helper만, entity 변경 0줄)        ← 가장 우선
2. Derive layer + drawer (UI 추가, entity 변경 0줄)
3. Aggregate layer (cross-domain read-only projection)
4. New entity + lifecycle (도메인 추가)                  ← 가장 마지막
```

### 4.6 Anti-Pattern — Premature Infrastructure Expansion

❌ "나중에 필요할 것 같으니 미리 만들자" — speculative
❌ "이왕 하는 김에 같이 정리하자" — scope creep
❌ "다른 STEP에서 쓸 수도 있으니 generic하게 만들자" — over-abstraction

✅ *지금 본 STEP의 사용자 spec이 명시한 것만* 정착. 나중 STEP은 그때 결정.

### 4.7 Anti-Pattern — Phase Mixing

| Phase | 도메인 |
|---|---|
| Phase 1 Fiscal | Document Trust / Receipt / FiscalSummary / TaxInvoice / Accountant Export / Settlement Tax |
| Phase 3 Intel | AI Market Insight / pricing / market analysis |
| Phase 6 Approval | Approval Workflow / reviewer / queue / e-signature |

**phase mixing 금지 사례**:
- Phase 1 Fiscal STEP에서 Approval Workflow 코드 정착 (STEP 101+ 영역)
- Phase 3 Intel STEP에서 Trust Layer 변경
- 단일 STEP에서 multiple Phase의 entity 추가

**예외**: anchor slot 사전 등재 (STEP 86이 TAX_INVOICE enum 멤버 사전 등재)는 phase mixing 아님 — *anchor의 forward-compat 슬롯*은 정착 시점에 모두 미리 표기 가능.

### 4.8 Anti-Pattern — Speculative Architecture Growth

❌ "future RBAC를 위한 generic permission system" (STEP 101+ 진입 전)
❌ "future i18n을 위한 message bundle 추출" (사용자 요청 전)
❌ "future test runner를 위한 vitest config 정착" (실제 도입 전)

✅ 현재 사용자 spec이 *명시*한 것만. 미래 추측 0.

---

## 5. Recovery & Stabilization Patterns

본 섹션은 STEP 86~91 6개 STEP에서 *경험적*으로 정착된 회복 패턴.

### 5.1 Clean Slate Recovery

**상황**: 새 turn 시작, 작업 트리에 정착 코드 부재.

**procedure**:
```
1. baseline build green 확인
2. 사용자 spec 정독 (forbidden list 우선 식별)
3. 산출물 path plan
   - src/types/<domain>.ts
   - src/lib/<domain>.ts
   - src/components/<domain>/<Component>.tsx
   - test scenarios (필요 시)
4. file-by-file 작성 + 중간 type-check
5. 4 정책 grep verify
6. STEP_INDEX / ARCHITECTURE / HANDOFF 갱신
7. 완료 보고서 + ZIP + present_files
```

**clean slate 사례** (STEP 86~91 5번):
- UX-3 — Detail Panel polish
- STEP 89 — TaxInvoice entity
- STEP 91 — (사실상 partial 발견, 검증으로 종료)
- STEP 90 — Settlement Tax derive
- STEP DOC-2 — 본 문서 (5번째)

### 5.2 Partial Continuation

**상황**: 새 turn 시작, 작업 트리에 정착 코드 발견.

**procedure**:
```
1. §2.1 7-step checklist 실행
2. §2.2 Continuation Decision Tree
3. continuation safe 확인 시:
   - 정착 코드 그대로 유지 (재구현 금지)
   - 누락 산출물만 보강
   - 검증 + ZIP
4. unsafe 시:
   - 사용자 명시적 확인 요청
   - rollback OR 사용자 spec 재해석 결정
```

**partial-state 사례** (STEP 86~91 6번):
- STEP UX-2 → STEP 86 prep 발견 (timestamps 21:47-21:48)
- STEP 86 → STEP 87 prep 발견
- STEP 87 → STEP 88 prep 발견
- STEP 88 → STEP 89 prep (FiscalSummary integration)
- STEP 89 → STEP 91 prep (Accountant Export full stack)
- STEP 91 → 본 turn STEP 검증 + ZIP only

### 5.3 Freeze Validation

Phase freeze 선언 전 다음 모두 검증:

```
☐ 해당 Phase의 모든 STEP 표가 ✅
☐ cross-STEP integration 검증 (anchor pattern N-tier validation)
☐ 4 정책 문서 정합 100% (Phase 전체 grep verify)
☐ production runtime impact 측정 (총 Route delta 기록)
☐ 후속 Phase 진입 사용자 승인
```

**Phase 1 Fiscal freeze 사례** (STEP 90 정착 시점):
- STEP 86 ✅ + 87 ✅ + 88 ✅ + 89 ✅ + 90 ✅ + 91 ✅ (6/6)
- STEP 86 anchor 4-tier validation 완성
- AI Direction 금지 표현 0 user-facing (모든 STEP grep verify)
- Trust Layer Approval leakage 0건 (모든 STEP grep verify)
- production runtime: 153 kB → 175 kB (+22 kB total, 6 STEP 평균 +3.7 kB)
- foundation freeze 진입 사용자 승인 (STEP 90 spec)

### 5.4 Safe Next-Step Selection

**상황**: 한 STEP 완료 후 다음 STEP 선택.

**우선순위 결정 트리**:

```
현재 Phase가 phase-complete인가?
    ├─ YES → 사용자 권장 다음 Phase 진입
    │        OR doc-only STEP (DOC-N)으로 stabilization
    │
    └─ NO  → 같은 Phase 내 STEP 우선
              ↓
              현재 Phase 내 dependency 만족된 STEP 중에서
                ├─ 🟢 low-risk (pure derive / doc-only)
                ├─ 🟡 medium-low risk (extension / drawer)
                └─ 🟠 medium risk (entity 추가)
              우선순위: 🟢 → 🟡 → 🟠
              (사용자 명시 우선순위 있을 시 그것 우선)
```

### 5.5 Low-Risk STEP Prioritization

다음 특성을 가진 STEP은 *low-risk* 분류 — 우선 진행:

- 신규 entity 0개
- store 변경 0줄
- persistence 변경 0줄
- UI 변경 0줄
- production runtime delta ≤ 3 kB
- 후속 STEP에서 *anchor*로 사용될 가능성 高

**사례**:
- STEP 86 (Document Trust foundation, 0 kB)
- STEP 88 (FiscalSummary aggregate, +3 kB)
- STEP 90 (Settlement Tax derive, 0 kB)
- STEP DOC-2 (본 문서, 0 kB code)

### 5.6 Recovery Decision Hierarchy

문제 발생 시 결정 순서:

```
1. 사용자 spec 재확인
   → 모호한 부분이 있으면 ask_user_input_v0로 명시화 요청

2. 4 정책 문서 정합 검증
   → AI Direction / Trust Layer / Fiscal Architecture / 본 문서 (DEV_CONVENTION)

3. STEP_INDEX 7-step checklist 실행
   → 정착 코드 발견 / 부재 결정

4. baseline build green 확인
   → 환경 / dependency 문제 사전 차단

5. 진행 결정 (continuation / clean slate / rollback)
```

본 우선순위는 *역순으로 사용 금지*. 즉 "build green 확인 → 사용자 spec 안 보고 진행"은 잘못된 순서.

---

## 6. Cross-Reference — 4 영구 정책 문서와의 관계

| 문서 | 영역 | 본 문서와의 관계 |
|---|---|---|
| `AXVELA_AI_DIRECTION.md` | AI / Market Intelligence 정책 | 본 문서의 §3.6 orchestration 금지 + §4.7 phase mixing 금지가 AI Direction의 \"AI 자동 트리거 0건\" 원칙과 정합 |
| `AXVELA_TRUST_LAYER.md` | Approval Workflow 정책 | 본 문서의 §1.1 frozen 조건이 Trust Layer의 \"PERMISSION ≠ APPROVAL\" 분리 원칙과 정합 |
| `AXVELA_FISCAL_ARCHITECTURE.md` | Fiscal Layer 4-Tier | 본 문서의 §3.1 STEP 86 anchor 4-tier validation이 Fiscal Architecture Layer 1~4 cycle과 정합 |
| `STEP_INDEX.md` | STEP navigation | 본 문서의 §2.1 7-step checklist + §1.2 상태 전환 매트릭스가 STEP_INDEX의 분류 / 상태 표기 / Do Not Duplicate guard와 정합 |

본 문서 (DEV_CONVENTION) 추가로 4 → 5 영구 정책 문서 + 1 navigation layer (STEP_INDEX) 구조 완성.

---

## 7. Convention Versioning

본 문서는 *영구 정책*이지만, AXVELA OS의 진화에 따라 *추가*만 허용된다.

**허용**:
- 새 §섹션 추가 (예: Phase 6 Approval Workflow 정착 후 §8 Approval Lifecycle)
- 기존 섹션 내 *사례 추가* (새 STEP 정착 시)
- §6 Cross-Reference 갱신

**금지**:
- 기존 섹션 *삭제*
- 기존 rule의 *완화* (strict → loose 변경)
- 기존 사례의 *수정* (역사적 정확성 보존)

**버전 표기**:
- 초판: STEP DOC-2 정착 (2026-05-07)
- 갱신 시: 본 문서 마지막에 `## Changelog` 섹션 append (DOC-2 후속 STEP에서)

---

## 8. AXVELA Development Operating Convention 한 문장 요약

> *작고, 안정적이고, 예측 가능하고, 점진적이며, derived-layer 우선의 정착*만이 AXVELA의 진화 방식이다. 새 abstraction은 5-Question Gate를 통과한 minimum viable 형태로만 추가하며, frozen STEP은 변경하지 않고 새 STEP 번호로 분리한다. partial-state는 표준 시나리오이며, 7-step checklist가 유일한 안전 진입점이다.

---

## 9. 본 문서의 영구 가치

1. **6번 partial-state + 5번 clean-slate 사례를 stable convention으로 코드화** — 향후 multi-STEP 세션에서 동일 패턴 재현 가능
2. **STEP 86 anchor 4-tier validation을 *명시적 매뉴얼*로 문서화** — 향후 Phase 3 / Phase 6 진입 시 동일 패턴 적용 가능
3. **Phase 1 Fiscal foundation freeze의 *결정 근거* 영구 보존** — 후속 Phase에서 freeze 결정 시 동일 기준 적용
4. **5번째 영구 정책 문서로서 4 기존 정책과 cross-reference 정착** — AXVELA OS 운영 헌법 완성
5. **future development consistency + reduced architectural drift + safe incremental scaling** 사용자 spec의 3 목표 모두 정착
