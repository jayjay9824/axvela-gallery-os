# STEP 17 — Disabled State Visual Polish (완료)

비활성 버튼·미구현 placeholder·권한 차단 UI를 단일 시각 규약으로 통합. 신규
도메인·핸들러 0, 신규 Drawer/Modal 0, Money Flow 코드 0줄 변경. Pure visual
polish.

핵심 변경 두 가지:
- **Button.tsx 의 hover/active를 `enabled:` modifier로 게이트** — disabled 상태에서
  더 이상 색이 바뀌지 않음. cursor-not-allowed 유지.
- **`<ButtonHint>` 신규 primitive로 비활성 사유의 단일 출처 확립** — 4 tone
  (permission / future / data_guard / ai)으로 의미 단위 분류, 모든 기존 inline
  paragraph/span을 이 컴포넌트로 통합.

---

## 1. 현재 코드 분석 요약

**STEP 17 진입 시점에 부족했던 것:**

| 항목 | 진입 시점 상태 | STEP 17 적용 |
|---|---|---|
| Button hover/active 게이트 | ❌ disabled여도 hover 시 색이 변함 — 인터랙티브해 보임 | ✅ `enabled:hover:` modifier로 분리 |
| Disabled hint의 단일 출처 | ❌ 11개 위치에 `<p>` 또는 `<span>` 인라인 — 정렬·여백 미세 차이 | ✅ `<ButtonHint>` 신규, 4 tone × 2 align |
| 미구현 placeholder 안내 | ❌ STEP 16에서 disabled만, 사유 표시 없음 — "버그?"로 오해 가능 | ✅ "준비 중" / 구체 hint ("작품 편집에서 변경" 등) |
| 데이터 가드 신호 | ❌ INQUIRY state + 응대 가능 inquiry 없는 edge case 시 buttonClick no-op (사일런트) | ✅ 별도 톤 `data_guard` + "응대 가능한 문의 없음" hint |
| AI affordance 안내 | ❌ Drawer 내부 banner만 — Detail Panel 단계에서 "AI는 초안만"이 명시되지 않음 | ✅ `<ButtonHint tone="ai">`로 "AI 초안 — 인간 검토 필요" 노출 |

**전수 조사 결과:**
- `permissionHint(...)` 호출 사이트 **11개** (Settlement / Tax / Contract / Curation / Inquiry / DetailPanel)
- 모두 `<p className="text-[10.5px] text-ink-subtle ...">` 또는 `<span ...>` 인라인 패턴 — 동일 의미를 두 가지 형태로 작성
- STEP 17은 11개 모두 `<ButtonHint>`로 통합 (sub-pixel 시각 차이 0)

---

## 2. 변경 파일 목록 (10)

| 파일 | 변경 |
|---|---|
| `src/components/ui/Button.tsx` | `enabled:hover:` / `enabled:active:` modifier로 hover 게이트, 주석 추가 |
| `src/components/layout/DetailPanel.tsx` | `SUPPORTING_ACTIONS` 데이터 모델을 `SupportingActionMeta` 객체로 확장 (`label / wired / isAi / futureHint`), tertiary 버튼도 ButtonHint 부착, INQUIRY 데이터 가드 (`inquiryActionableTarget`) 추가, primary 버튼 RBAC hint를 ButtonHint로 교체 |
| `src/components/contract/ContractSummary.tsx` | 2개 인라인 hint → ButtonHint |
| `src/components/contract/ContractDetailDrawer.tsx` | 2개 인라인 hint → ButtonHint inline |
| `src/components/curation/CurationDraftDrawer.tsx` | 3개 인라인 hint → ButtonHint inline (approve / lock / new-version) |
| `src/components/inquiry/InquiryResponseDrawer.tsx` | 1개 인라인 hint → ButtonHint inline |
| `src/components/settlement/SettlementSummary.tsx` | 1개 인라인 hint → ButtonHint |
| `src/components/settlement/SettlementDetailDrawer.tsx` | 1개 인라인 hint → ButtonHint inline |
| `src/components/tax/TaxSummary.tsx` | 1개 인라인 hint → ButtonHint |
| `src/components/tax/TaxDetailDrawer.tsx` | 1개 인라인 hint → ButtonHint inline |

**무영향 확인:**
- 도메인 타입 변경 0줄 (Payment / Settlement / Tax / Contract / Invoice / Logistics / ConditionReport / Curation / Artwork / Inquiry / Transaction)
- 스토어 액션 변경 0줄
- mock-data 변경 0줄
- state-machine.ts / rbac.ts / utils.ts 변경 0줄
- 3-Column 레이아웃 변경 0줄
- 신규 Drawer/Modal 0개

## 3. 신규 파일 목록 (1)

- `src/components/ui/ButtonHint.tsx` — 단일 컴포넌트 + 4개 라벨 상수 (`FUTURE_LABEL`, `FUTURE_LATER_LABEL`, `REDUNDANT_LABEL`, `AI_DRAFT_AFFORDANCE`)

---

## 4. 개선된 disabled UI 규칙

### 4.1 — Button 자체 (시각 layer)

Tailwind `enabled:` modifier로 hover/active를 게이트. disabled 상태에서:

```css
opacity: 40%;
cursor: not-allowed;
hover: (no effect)       /* 이전: 색이 바뀜 */
active: (no effect)      /* 이전: 색이 바뀜 */
border / bg: 그대로 유지   /* 모든 variant 일관 */
```

3개 variant (primary / secondary / ghost) 모두 동일 규칙. `disabled` prop이 true이면 자동 적용 — 호출자가 별도 클래스 추가 불필요.

### 4.2 — ButtonHint 컴포넌트 (의미 layer)

비활성 사유와 affordance 안내를 4개 톤으로 분류:

| Tone | 색조 | 의미 | 사용 예 |
|---|---|---|---|
| `permission` | `text-ink-subtle` | RBAC 차단 (`hasPermission` false) | "Owner 권한 필요" / "Manager 권한 필요" |
| `future` | `text-ink-subtle` | 미구현 placeholder | "준비 중" / "다른 카드에서 진행" / "작품 편집에서 변경" |
| `data_guard` | `text-status-inquiry/80` | 데이터 조건 미충족 (rule_7 권한 vs 데이터 가드 분리) | "응대 가능한 문의 없음" / "결제 대기 중" |
| `ai` | `text-ink-subtle italic` | AI affordance 안내 (rule_5) — disabled 아닌 활성 버튼에도 사용 | "AI 초안 — 인간 검토 필요" |

색상이 `permission` / `future` 동일한 이유는 의도적 — 둘 다 "지금은 못한다"의 같은 신호. 차이는 hint 본문이 가짐 ("권한 필요" vs "준비 중"). `data_guard`만 약간 강한 톤으로 "이건 데이터 채우면 풀린다"를 시사. `ai`는 italic로 다른 disabled 사유와 구분.

### 4.3 — Align (배치 layer)

| Align | 사용처 | 마크업 |
|---|---|---|
| `below` | DetailPanel / Summary 카드 / Drawer body — Button 아래 줄로 표시 | `<p role="note">` |
| `inline` | Drawer footer의 horizontal flex 안 — Button 옆 같은 줄 | `<span role="note">` |

### 4.4 — 우선순위 (DetailPanel secondary 버튼 케이스)

복수 disable 사유가 동시에 성립할 수 있는 경우 우선순위:

```
1. 미구현 핸들러 (wired === false)        → tone: future
2. 데이터 가드 미충족 (data_ready === false) → tone: data_guard
3. AI affordance 안내 (isAi === true)       → tone: ai (활성 상태)
```

권한 차단(`permission`)은 별도 axis — 위 3개와 직교. RBAC가 막힌 활성 wired 버튼은 별도로 `permissionHint(...)` + `tone="permission"` 노출.

### 4.5 — Placeholder 안내 문구 표준

`SUPPORTING_ACTIONS`의 미구현 entry는 다음 4개 라벨 중 하나를 사용:

| 라벨 | 의미 | 적용 예 |
|---|---|---|
| `FUTURE_LABEL` ("준비 중") | 단기 후속 STEP에서 제공 예정, 위치 미정 | READY.secondary "Collector View 공유", REOPENED.secondary "기록 보기", BROKERED.secondary "원소유자 정산 확인" |
| `FUTURE_LATER_LABEL` ("다음 단계에서 제공") | 장기, rule_19 등에 의존 | (현 시점 미사용 — 향후 가격 제안·시장 분석에서 활용 예정) |
| `REDUNDANT_LABEL` 류 | 동일 흐름이 이미 다른 카드에 존재 | "다른 카드에서 진행" — DEAL "Contract 검토" / PAID "물류 배정" "Tax 분류" |
| 구체 안내 | 실제 수행 가능한 다른 위치 명시 | "작품 편집에서 변경" — READY "가격 조정", "Inquiry 상세에서 변경" — "보류" |

---

## 5. 적용 위치

### 5.1 — DetailPanel `SUPPORTING_ACTIONS` 매트릭스

| State | secondary | wired? | tertiary | wired? |
|---|---|---|---|---|
| DRAFT | "AI 큐레이션 초안" | ✅ wired + AI hint | — | — |
| READY | "Collector View 공유" | ❌ "준비 중" | "가격 조정" | ❌ "작품 편집에서 변경" |
| INQUIRY | "AI 응대 초안" | ✅ wired + AI hint (단, 데이터 가드: actionable inquiry 없으면 disabled + "응대 가능한 문의 없음") | "보류" | ❌ "Inquiry 상세에서 변경" |
| DEAL | "Contract 검토" | ❌ "다른 카드에서 진행" | "보류" | ❌ "Inquiry 상세에서 변경" |
| PAID | "물류 배정" | ❌ "다른 카드에서 진행" | "Tax 분류" | ❌ "다른 카드에서 진행" |
| CLOSED | "Document 보관" | ❌ "자동 보관 완료" | — | — |
| REOPENED | "기록 보기" | ❌ "준비 중" | — | — |
| BROKERED | "원소유자 정산 확인" | ❌ "준비 중" | — | — |

### 5.2 — Permission hint 통합 위치

11개 사이트 모두 `<ButtonHint tone="permission" />`로 통일:

| 컴포넌트 | 권한 키 | align | 비고 |
|---|---|---|---|
| `DetailPanel` (PAID→CLOSED primary) | `artwork.transition.close` | below | OWNER 권한 |
| `ContractSummary` (REVIEW 단계) | `contract.approve` | below | OWNER 권한 |
| `ContractSummary` (APPROVED 단계) | `contract.lock` | below | OWNER 권한 |
| `ContractDetailDrawer` (REVIEW footer) | `contract.approve` | inline | OWNER 권한 |
| `ContractDetailDrawer` (APPROVED footer) | `contract.lock` | inline | OWNER 권한 |
| `CurationDraftDrawer` (DRAFT footer) | `curation.approve` | inline | MANAGER 권한 |
| `CurationDraftDrawer` (APPROVED footer) | `curation.lock` | inline | MANAGER 권한 |
| `CurationDraftDrawer` (LOCKED footer) | `curation.create_version` | inline | MANAGER 권한 |
| `InquiryResponseDrawer` (DRAFT footer) | `inquiry.send_response` | inline | STAFF 권한 |
| `SettlementSummary` (정산 완료 버튼) | `settlement.complete` | below | OWNER 권한 |
| `SettlementDetailDrawer` (footer) | `settlement.complete` | inline | OWNER 권한 |
| `TaxSummary` (세무 발행 버튼) | `tax.issue` | below | OWNER 권한 |
| `TaxDetailDrawer` (footer) | `tax.issue` | inline | OWNER 권한 |

### 5.3 — AI affordance hint 위치

| 위치 | tone | text |
|---|---|---|
| DetailPanel `DRAFT.secondary` 버튼 아래 (활성 상태) | `ai` | "AI 초안 — 인간 검토 필요" |
| DetailPanel `INQUIRY.secondary` 버튼 아래 (활성 상태) | `ai` | "AI 초안 — 인간 검토 필요" |

기존 Drawer 내부의 rule_5 banner ("초안 — AI 생성 후 인간 검토 필요" / "응대 초안 — 발송 전 검토 필요")는 **그대로 유지**. ButtonHint는 추가 안내 — Drawer 진입 전부터 AI는 초안만 생성한다는 affordance를 명시.

### 5.4 — Data guard hint 위치

| 위치 | tone | text | 발생 조건 |
|---|---|---|---|
| DetailPanel `INQUIRY.secondary` 버튼 아래 | `data_guard` | "응대 가능한 문의 없음" | INQUIRY state인데 OPEN/ESCALATED/ON_HOLD inquiry 모두 없음 (방어적 가드) |

state machine이 정상 동작하면 이 케이스는 발생하지 않으나, 시드 데이터 / 직접 store 조작 / 미래 상태 변형 등으로 발생 가능. 발생 시 사용자에게 명확한 신호 제공.

---

## 6. Build 결과

```
$ npx tsc --noEmit
(0 errors)

$ npx next build
 ✓ Compiled successfully
 ✓ Generating static pages (4/4)

Route (app)                              Size     First Load JS
┌ ○ /                                    54.5 kB         142 kB
└ ○ /_not-found                          873 B            88 kB
+ First Load JS shared by all            87.1 kB
```

| 기준 | STEP 16 | STEP 17 | 차이 |
|---|---|---|---|
| Route / | 54.1 kB | **54.5 kB** | +0.4 kB |
| TypeScript errors | 0 | 0 | — |

0.4 kB 증가는 신규 ButtonHint 컴포넌트 (~50 LOC) + SUPPORTING_ACTIONS 메타데이터 객체 확장의 minified 결과. 기존 인라인 hint 11개는 컴포넌트 호출로 대체되어 net 증가 미미.

---

## Manifesto 대조

| Rule | 적용 |
|---|---|
| rule_1 | Artwork-first 무영향 — 도메인 데이터 0줄 변경 |
| rule_2 | Flow system 무영향 — 상태 흐름 0줄 변경 |
| rule_3 | **Money flow 코드 0줄 변경** — Payment / Settlement / Tax 슬라이스 / 액션 / 컴포넌트 모두 무영향. SettlementSummary / SettlementDetailDrawer / TaxSummary / TaxDetailDrawer 변경분은 *hint 표시*뿐 — 실제 정산 / 세무 계산 / 발행 로직 0줄 |
| rule_4 | Document Trust 무영향 — Contract / Curation / Logistics / ConditionReport version chain 동작 그대로 |
| rule_5 | **AI-Human Loop 시각 강화** — DetailPanel 단계에서 이미 "AI 초안 — 인간 검토 필요" affordance 노출. Drawer 내부 banner와 합쳐 두 단계로 명시 |
| rule_6 | State machine 무영향 |
| rule_7 | **RBAC visualization 일관화** — 11개 권한 차단 위치 모두 동일한 시각 규약 (`<ButtonHint tone="permission">`)으로 통일. "권한 부족 vs 데이터 가드"의 *시각적 구분*이 처음으로 명시적 (`permission` vs `data_guard` tone) — manifesto rule_7의 "시각적으로 구분" 요구를 처음으로 실현 |
| rule_8 | Timeline 무영향 |
| rule_14 | 3-Column 레이아웃 무변경 |
| rule_15 | **버튼 ≤3 / Primary 1 / 상태 기반 UI 강화** — 비활성 버튼이 더 명확하게 "비활성"으로 보임. 활성/비활성의 시각 차이 강화로 rule_15의 의도("상태 기반 UI") 더 잘 구현 |
| rule_16 | **Apple/OpenAI 미니멀 톤 강화** — hover가 disabled에서 발화하지 않으므로 "장난스럽게 살아있는" 느낌 제거. 더 정적이고 절제된 톤 |
| rule_17 | Drawer/Modal/Overlay 무변경 |
| rule_18 | AI Layer 동작 무변경, AI affordance만 명시화 |

---

## 검증 시나리오

### 1. Button hover 게이트 (시각 변화)

- art_002 (INQUIRY) 선택 → DetailPanel "보류" tertiary 버튼 (disabled)
- ✓ 마우스 hover → 색이 바뀌지 않음 (이전: `bg-surface-muted`로 살짝 변함)
- ✓ cursor: not-allowed
- ✓ 버튼 아래 "Inquiry 상세에서 변경" hint 노출

### 2. AI affordance 안내 (active 버튼에 정보성 hint)

- art_006 (DRAFT) 선택
- ✓ "AI 큐레이션 초안" 버튼 활성 (clickable)
- ✓ 버튼 바로 아래 italic "AI 초안 — 인간 검토 필요" 안내 (tone: ai)
- art_002 (INQUIRY) 선택
- ✓ "AI 응대 초안" 버튼 활성 (Sarah Lim OPEN inquiry 존재)
- ✓ 동일 italic AI 안내 노출

### 3. Data guard 발생 시나리오 (방어적)

가설적 상황 — INQUIRY state인데 inquiry 배열이 빈 경우:

- 콘솔: `useArtworkStore.setState((s) => ({ inquiries: { ...s.inquiries, art_002: [] } }))`
- art_002 (여전히 INQUIRY state) → DetailPanel
- ✓ "AI 응대 초안" 버튼 disabled
- ✓ tone: data_guard, "응대 가능한 문의 없음" hint (status-inquiry/80 색조)

이 케이스는 정상 흐름에서 발생하지 않으나, 사용자가 이상 상태에 빠졌을 때 즉각적인 신호 제공.

### 4. RBAC permission hint (11개 사이트)

- Sidebar role switcher → STAFF로 전환
- art_004 (PAID) 선택 → "거래 종료" primary 버튼
- ✓ disabled, 아래 below "Owner 권한 필요" (permission tone)
- art_003 (DEAL) 선택 → ContractSummary 카드 → "REVIEW" 단계 가정
- ✓ "승인" 버튼 disabled, 아래 below "Owner 권한 필요"
- ContractSummary "계약 상세" 클릭 → drawer
- ✓ footer에 "승인" 버튼 옆 inline "Owner 권한 필요"
- art_006 (DRAFT) → CurationDraftDrawer 열기 (STAFF로 v1 DRAFT 생성 가능)
- ✓ footer "승인" 옆 inline "Manager 권한 필요"

11개 위치 모두 동일한 시각 규약 — `text-[10.5px] tracking-tightish text-ink-subtle` (below는 `text-center` 추가, inline은 `text-center` 없음). MANAGER로 전환 → 모든 hint 사라짐, 버튼 활성.

### 5. Placeholder 안내 (미구현 buttons)

- art_001 (READY) → "Collector View 공유" / "가격 조정"
- ✓ 둘 다 disabled, hint: "준비 중" / "작품 편집에서 변경"
- art_004 (PAID) → "물류 배정" / "Tax 분류"
- ✓ 둘 다 disabled, hint: "다른 카드에서 진행" / "다른 카드에서 진행" — 사용자가 LogisticsSummary / TaxSummary 카드를 보도록 자연 유도
- art_005 (CLOSED) → "Document 보관"
- ✓ disabled, hint: "자동 보관 완료" — 액션 불필요함을 명시

### 6. 기존 기능 동작 유지 (regression check)

- art_006 (DRAFT) → "AI 큐레이션 초안" → drawer 열림 + v1 DRAFT 자동 생성 (STEP 16 동작)
- art_002 (INQUIRY) → "AI 응대 초안" → drawer 열림 + AI 응답 초안 자동 생성 (STEP 16 동작)
- art_001 (READY) → Curation 카드 → drawer → LOCKED v1 read-only (STEP 16 동작)
- art_003 (DEAL) → ContractSummary → "계약 상세" → REVIEW 단계 drawer (기존 동작)
- ContractSummary REVIEW 상태에서 OWNER로 "승인" → APPROVED → "LOCK" → LOCKED (rule_4 chain 정상)
- art_004 (PAID) → SettlementSummary → "정산 상세" → drawer → OWNER로 "정산 완료" → SETTLED cascade (rule_3, rule_12 정상)
- art_004 (PAID) → TaxSummary → "세무 발행 완료" (OWNER) → ISSUED 영구 기록 (rule_3 정상)

모든 STEP 1~16 시나리오 회귀 없음.

---

## 알려진 한계 (정직)

1. **`<ButtonHint>`의 `data_guard` tone은 현재 1곳에서만 사용** — INQUIRY 데이터 가드. Settlement / Tax / Logistics에 데이터 조건 미충족 케이스가 더 있을 수 있으나 (예: settlement 생성 전 tax 발행 시도), STEP 17은 RBAC와 명시 placeholder만 통합. 추가 data_guard 적용은 STEP 18+ 후보.

2. **AI affordance hint는 DetailPanel 두 곳에만** — 다른 AI 관련 진입점 (Drawer 내부의 "AI 재생성" 버튼 등)에는 부착하지 않음. Drawer 내부에는 이미 rule_5 banner가 있어 중복 방지. 다만 "AI 재생성" 버튼 자체에 대한 visual marker는 부재 — italic 라벨 등으로 보강 가능 (STEP 18 후보).

3. **`text-status-inquiry/80` (data_guard)는 status-inquiry 색상 토큰을 차용** — 별도 "warning/guard" 색상 토큰을 만들지 않음. 의미상 "주의 환기"는 status-inquiry (amber)와 겹치는 면이 있어 차용해도 무방하나, 향후 디자인 시스템 정비 시 별도 토큰 후보.

4. **Tertiary 버튼의 secondary와 시각 차등 미흡** — 둘 다 disabled에서 같은 fade. ghost variant라 약간 더 미묘하나, 사용자가 "primary는 큰 액션, secondary는 보조, tertiary는 더 보조" 우선순위를 명확히 인지하기는 어려움. 디자인 시스템 정비의 별도 과제.

5. **Inline align의 정렬 미세 차이** — `<span role="note">`로 footer flex 안에 들어갈 때 baseline 정렬이 버튼과 약간 어긋날 수 있음. flex container가 `items-center`이므로 큰 문제는 아니나, 픽셀 단위 정밀도 필요시 추가 조정 가능.

6. **`role="note"`는 ARIA semantic으로 약함** — disabled 버튼의 사유 안내라면 `aria-describedby`로 버튼과 명시 연결하는 것이 더 정확. 현 구현은 시각만 통일하고 ARIA 연결은 미수행. 접근성 강화 STEP 후보.

7. **Mobile 반응형 미고려** — DetailPanel의 secondary/tertiary 2-column grid가 좁은 화면에서 hint와 함께 어떻게 보일지 미검증. v1은 desktop 갤러리 운영 환경 가정이므로 큰 이슈 아님.

---

## 다음 STEP 후보

1. **STEP 18 — 가격 제안 (rule_18 (c))** (1-2시간): Artwork edit drawer 안 inline button "AI 가격 제안". STEP 17에서 만든 ButtonHint `tone="ai"` 그대로 활용 가능.

2. **STEP 19 — Market Data (rule_19)**: rule_18 (b) 시장 분석의 선행 의존성. Artwork에 거래 기록 / 관심도 / 유동성 metric 도메인 추가.

3. **STEP 20 — Audit Log Panel** (rule_7 follow-through): actorRole 기반 timeline 필터링 + correction/version 체인 시각화.

4. **STEP 21 — 접근성 강화**: disabled 버튼의 `aria-describedby` 연결, 키보드 navigation, focus ring 정비. STEP 17의 ButtonHint를 ARIA-aware로 확장.

5. **STEP 22 — 디자인 토큰 정비**: warning / guard 색상 별도 토큰, tertiary 버튼 시각 차등, mobile 반응형 검토.
