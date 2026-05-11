# STEP UX-2 — Sidebar Grouping & AI Reframe — Completion Report

## State

**Document Lifecycle Clarity baseline (154 kB) → STEP UX-2 (153 kB).**
Build / type-check / lint all green.
Route delta: **−1 kB** (소폭 감소 — `AuditIcon` SVG 제거 + disabled placeholder 1개 제거 + 표현 reframe; 신규 컴포넌트 0건, 신규 라이브러리 0건).
ZIP: `axvela-ux2-sidebar-grouping.zip`.

---

## 0. 사전 발견 — HANDOFF.md stale 상태

새 채팅 시작 직후, baseline ZIP 검증 단계에서 발견:

| 항목 | HANDOFF.md (stale) | 실제 baseline |
|---|---|---|
| Route 크기 | 150 kB | **154 kB** |
| 마지막 STEP | STEP UX-1 | **Document Lifecycle Clarity** |
| `src/components/document-lifecycle/` | 미존재 가정 | **5개 컴포넌트 존재** |
| `src/lib/document-lifecycle.ts` | 미존재 가정 | **284 LOC 존재** |
| `Invoice.revisionReason` | 추가 필요 가정 | **이미 schema에 존재** |
| `STEP_DOCUMENT_LIFECYCLE_CLARITY_COMPLETE.md` | 미언급 | **ZIP에 존재** |

**원인**: HANDOFF.md는 STEP UX-1 직후 작성되었으나, 그 뒤 *Document Lifecycle Clarity* STEP이 진행되었고 ZIP은 새로 묶였지만 HANDOFF.md는 갱신되지 않음.

**조치 (이번 STEP의 일부)**: HANDOFF.md를 현 baseline 기준으로 갱신 — STEP UX-2 완료 시점 반영.

---

## 1. 분석 — Sidebar 시각 hierarchy 진단

### 진단

```
[기존 구조 — 시각적으로 flat]
Logo
NavGroup("Workspace") ← 작품 / 거래 / 문서 / 고객
작품 상태 (counts)
NavGroup("Operations") ← AI 워크플로우(disabled) / 물류 운영 / 보고서 / 이미지 정리 / 운영 로그 / 설정
"감사" custom 큰 버튼 (전체 감사 로그 + 부제)
승인 대기
Footer: RoleSwitcher / Reset / BackupHealth / Sync
```

**식별된 통증**:
1. ❌ **flat hierarchy** — 일상 작업 (작품 / 거래 / 문서 / 고객) 과 governance (운영 로그 / 감사 / 설정) 와 admin tool (이미지 정리) 가 같은 시각 weight으로 혼재
2. ❌ **"AI 워크플로우" disabled placeholder** — hint "작품 상태 액션에서 접근"이 이미 다른 곳을 가리키고 있어 nav 가치 0, 그러나 시각 weight 점유
3. ❌ **"감사" custom big button** — 부제 "갤러리 전체 이벤트" 포함된 커스텀 렌더, NavGroup 컴포넌트와 시각 톤 어긋남
4. ❌ **백업 indicator footer 매장** — "GOVERNANCE 1급 항목"으로 인식되어야 할 백업 health가 footer에 묻혀 user의 mental model과 불일치
5. ❌ **AI 표현 톤** — "AI 가격 제안" / "AI 시장 분석" 등 *judgmental / authoritative* 톤이 AXVELA AI Direction §6.2에서 reframe 권장으로 명시되어 있었으나 미반영

### 사용자 spec 정렬

```
PRIMARY      ← 작품 / 거래 / 고객
OPERATIONS   ← 문서 / 물류 운영 / 보고서 / 이미지 정리
GOVERNANCE   ← 운영 로그 / 전체 감사 로그 / 설정 (+ 백업)
```

+ AI 워딩을 *operational assistance* 톤으로 reframe (시장 활동 참고 / 운영 참고 / 응답 권장 / 운영 보조).

---

## 2. 변경 파일 목록

| File | Change | LOC |
|---|---|---|
| `src/components/layout/Sidebar.tsx` | PRIMARY/OPERATIONS/GOVERNANCE 재구성, NavGroup `tone="muted"` 추가, BackupHealth 위치 이동, "AI 워크플로우" 제거, AuditIcon 제거 | ~+50 / −30 |
| `src/components/artwork/ArtworkFormDrawer.tsx` | 가격 제안 패널 헤더 / 버튼 / EXT REF tooltip reframe | ~5 strings |
| `src/components/layout/DetailPanel.tsx` | "AI 시장 분석" → "AI 참고 분석" | 1 string |
| `src/components/market-analysis/MarketAnalysisDrawer.tsx` | drawer title / Pricing Confidence subtitle / badge / empty state reframe | 4 strings |
| `src/components/contract/ContractSummary.tsx` | empty-state 안내 reframe | 1 string |
| `src/lib/market-analysis-generator.ts` | commentary / note 4건 reframe | 4 strings |
| `src/lib/market-analysis-export.ts` | HTML export 2 sections reframe | 2 strings |
| `HANDOFF.md` | stale 상태 갱신 (이번 STEP 완료 반영) | 새 작성 |
| `ARCHITECTURE.md` | entry append | ~10 KB |
| `STEP_UX2_SIDEBAR_GROUPING_AI_REFRAME_COMPLETE.md` | 본 보고서 | — |

**신규 컴포넌트**: 0개
**신규 라이브러리**: 0개
**신규 도메인 entity**: 0개

---

## 3. Sidebar 변경 — 상세

### 3.1 그룹 재구성

**PRIMARY** (변경: 문서 제거)
```
작품          (active)
거래          (disabled · "작품 상세에서 접근")
고객          (RBAC: collector.view_global)
```

**OPERATIONS** (변경: 문서 추가, AI 워크플로우 제거, 운영 로그 / 설정 이동, 감사 흡수)
```
문서          (RBAC: report.view_global) ← from PRIMARY
물류 운영      (RBAC: report.view_global)
보고서        (RBAC: report.view_global)
이미지 정리    (RBAC: image.cleanup_review)
```

**GOVERNANCE** (신규 그룹, `tone="muted"`)
```
운영 로그       (RBAC: audit.view, OWNER)
전체 감사 로그  (RBAC: audit.view_global, MANAGER+) ← 이전 custom big button 흡수
설정           (disabled · "준비 중")
─────────────────
백업 health    (live indicator — 이전 footer에서 이동)
```

### 3.2 NavGroup `tone` prop

```typescript
<NavGroup label="GOVERNANCE" items={GOVERNANCE} tone="muted" />
```

- `tone="default"`: 기본 idle 색조 `text-ink-muted` (PRIMARY / OPERATIONS)
- `tone="muted"`: idle 색조 `text-ink-subtle`, hover 시 `text-ink-muted`로 lift (GOVERNANCE)

폰트 사이즈 / 패딩 / 항목 간격은 동일 — 시각적 차이는 *기본 색조*만. `text-[13px]` `tracking-tightish` `px-2.5 py-2` 모두 보존.

### 3.3 "AI 워크플로우" 제거 — 정책 근거

이전 항목:
```
{ label: "AI 워크플로우", disabled: true, hint: "작품 상태 액션에서 접근" }
```

**제거 사유 (3건)**:
1. **Nav 가치 0**: hint 자체가 "여기 말고 다른 곳으로 가세요"라고 명시 — 사용자가 클릭해도 아무 일도 일어나지 않으며, 진입은 이미 `DetailPanel` next-action / supporting-action UI를 통해 이뤄지고 있음.
2. **AI Direction 정책 정렬**: AXVELA AI Direction §10 "AI는 보조" + rule_5 AI-Human Loop — AXVELA AI는 *작품 / 거래 흐름에 임베드되는 운영 보조*이지 별도 navigation section이 아님. 별도 메뉴 항목은 "AI = 시스템 / 카테고리"라는 잘못된 mental model 유발.
3. **rule_16 minimalism**: 시각 weight 점유는 있으나 동작 없음 = 사용자에게 cognitive cost만 발생.

### 3.4 "감사" custom button 흡수

이전:
```jsx
{/* "감사" 라벨 + 별도 커스텀 큰 버튼 + 부제 "갤러리 전체 이벤트" + AuditIcon SVG */}
```

이후:
```jsx
{/* GOVERNANCE NavGroup의 정규 항목 */}
{ label: "전체 감사 로그", ..., onClick: openGlobalAudit }
```

- 부제 "갤러리 전체 이벤트"는 라벨 자체가 명확하므로 정보 가치 낮음 → 제거
- AuditIcon SVG 제거 (NavGroup은 icon-less 일관)
- `canViewGlobalAudit` 권한 / `openGlobalAudit` action / `audit.view_global` permission 모두 그대로 — 단순 *시각 통일*

### 3.5 BackupHealth 위치 이동

**변경 전 (footer)**:
```
Footer: RoleSwitcher / ResetData / BackupHealth / SyncStatus
```

**변경 후 (GOVERNANCE area sibling)**:
```
GOVERNANCE NavGroup
  운영 로그
  전체 감사 로그
  설정
└─ BackupHealth indicator (sibling)

Footer: RoleSwitcher / ResetData / SyncStatus
```

`BackupHealthSidebarIndicator` 함수 자체는 변경 0줄 — *사용 위치만 이동*. health 계산 / dot color / 클릭 동작 (Documents drawer open) / RBAC (Manager+) 모두 그대로.

**rationale**:
- 사용자 spec이 "백업"을 GOVERNANCE bucket의 1급 항목으로 명시
- Footer는 *user/data context* 영역 (RoleSwitcher / Reset / Sync) — 백업은 도메인 entity → bucket mismatch
- live status (dot + label) 가치는 보존 — 단순 위치 polish

---

## 4. AI 표현 reframe — 상세

### 4.1 표현 매트릭스

| 위치 | Before (judgmental / authoritative) | After (operational reference) |
|---|---|---|
| `ArtworkFormDrawer.tsx:523` (헤더) | "AXVELA AI 가격 제안" | **"참고 가격 신호"** |
| `ArtworkFormDrawer.tsx:526` (sub) | "AI 초안 — 인간 검토 필요" | **"AXVELA AI 운영 참고 — 인간 검토 필요"** |
| `ArtworkFormDrawer.tsx:536` (button) | "AI 가격 제안" / "다시 생성" | **"참고 신호 생성" / "다시 생성"** |
| `ArtworkFormDrawer.tsx:620` (tooltip) | "...가격 제안에 포함되었습니다" | **"...참고 신호에 포함되었습니다"** |
| `DetailPanel.tsx:521` (button) | "AI 시장 분석" | **"AI 참고 분석"** |
| `MarketAnalysisDrawer.tsx:170` (title) | "AI 시장 분석" | **"AI 참고 분석"** |
| `MarketAnalysisDrawer.tsx:249` (subtitle) | "가격 제안 신뢰도" | **"참고 가격 신호 신뢰도"** |
| `MarketAnalysisDrawer.tsx:253` (badge) | "제안 부재" | **"참고 신호 부재"** |
| `MarketAnalysisDrawer.tsx:550` (empty) | "AI 가격 제안이 아직 생성되지 않음" | **"참고 가격 신호가 아직 생성되지 않음"** |
| `ContractSummary.tsx:139` (hint) | "AI가 ... 초안을 생성합니다." | **"AXVELA AI가 ... 운영 참고 초안을 제안합니다."** |
| `market-analysis-generator.ts` (4건) | "AI 가격 제안 ..." / "최신 가격 제안의 신뢰도..." | "참고 가격 신호 ..." / "최신 참고 가격 신호의 신뢰도..." |
| `market-analysis-export.ts` (2 HTML 블록) | "가격 제안 신뢰도" / "AI 가격 제안이..." | "참고 가격 신호 신뢰도" / "참고 가격 신호가..." |

### 4.2 변경 원칙

✅ **변경**: 사용자 직접 노출 surface label / button / drawer title / commentary / HTML export
✅ **AI 시그니처는 유지**: AXVELA AI / AI 참고 분석 — *transparent disclosure of AI involvement* (rule_5 AI-Human Loop 정렬, 사용자 spec "AI 시그니처 제거 ❌"). 보강만 했지 가림 0건.
❌ **변경 안 함**:
- 내부 comment / JSDoc — 비-사용자 영역
- `axvela-price.ts` 모듈명 — internal logic file (AI Direction §6.2 권장 그대로)
- `useArtworkStore.ts` timeline event titles ("AXVELA AI 가격 제안 생성" / "AI 가격 제안 적용") — *historical data*. localStorage에 이미 영속된 이벤트들과 mixed-tone history 충돌 회피. 사용자 운영 history 일관성 유지.
- mock-data 템플릿 ("(본 초안은 AXVELA AI가 생성한 템플릿입니다...)") — AI-Human Loop disclosure 이미 calibrated, 시드 데이터 reframe 가치 낮음
- `audit-helpers.ts` `actor === "AXVELA AI"` 비교 — data layer, 표시 톤 무관

### 4.3 "operational assistance" 톤 검증

**사용자 spec good direction**:
> 시장 활동 참고 / 운영 참고 / 응답 권장 / 거래 흐름 참고 / 운영 보조

**적용 결과**:
- "참고 가격 신호" — 시장 활동 참고 ✓
- "AI 참고 분석" — 운영 참고 ✓
- "AXVELA AI 운영 참고 — 인간 검토 필요" — 운영 보조 ✓ (rule_5 AI-Human Loop 강화)
- "운영 참고 초안을 제안합니다" — 운영 보조 ✓

**사용자 spec avoid**:
> AI가 가격을 확정하는 느낌 / AI가 판단을 내리는 느낌 / speculative authority tone

**검증**:
- "가격 제안" → "참고 신호" — 확정/판단 톤 제거 ✓
- "분석" → "참고 분석" — judgment 톤 약화 ✓
- "AI가 ... 생성합니다" → "AXVELA AI가 ... 제안합니다" — 단정 → 보조 톤 ✓

---

## 5. 정책 준수 검증

### 5.1 AXVELA_AI_DIRECTION.md 정책 준수 ✓

```
✅ 금지 표현 0건 (verified):
   - "AI Estimated Price" / "AI 감정가" / "AI Appraisal"
   - "공식 가격" / "확정 시장가" / "정확한 가치"
   - "투자 보장" / "예상 수익" / "AI Pricing Engine"

✅ 권장 표현 사용:
   - "참고 가격 신호" / "AI 참고 분석" / "운영 참고" / "참고 신호"

✅ 부정형 disclaimer 보존:
   - MarketAnalysisDrawer "감정가 또는 확정 시장가가 아닙니다" 그대로

✅ rule_5 AI-Human Loop 일관:
   - "AXVELA AI 운영 참고 — 인간 검토 필요" — disclosure 강화
   - "운영 참고 초안을 제안합니다" — 인간 승인 전제

✅ rule_18 Market Intelligence 일관:
   - "참고 신호 / 보조 컨텍스트" 톤
   - 단정 → 참고 톤 시프트
```

### 5.2 AXVELA_TRUST_LAYER.md 정책 준수 ✓

```
✅ Approval Workflow 본격 구현 0건
✅ 검토자/승인자 데이터 0건 추가
✅ ApprovalSlotPlaceholder "준비 중" 표시 그대로 (Document Lifecycle 기존 그대로)
✅ RBAC 변경 0줄 (hasPermission / ROLE_RANK / ACTION_MIN_ROLE 그대로)
✅ STEP 101+ Approval Workflow 정책 영역 미진입
```

### 5.3 AXVELA_FISCAL_ARCHITECTURE.md 정책 준수 ✓

```
✅ Fiscal Layer 도메인 entity 변경 0건
✅ Receipt / Tax Invoice / Certificate 진입 0건
✅ STEP 86~91 Fiscal Phase 1 미진입
✅ Document Lifecycle Clarity 기존 구현 보존
```

### 5.4 Manifesto rule 준수

```
✅ rule_1 Artwork-First — 변경 0건
✅ rule_2 Flow System — 변경 0건
✅ rule_3 Money Flow Separation — 변경 0건
✅ rule_4 Document Trust Layer — 변경 0건 (Document Lifecycle 기존 그대로)
✅ rule_5 AI-Human Loop — 강화 ("AXVELA AI 운영 참고 — 인간 검토 필요")
✅ rule_6 State Machine — 변경 0건
✅ rule_7 RBAC — 변경 0건
✅ rule_8 Timeline Navigation — 변경 0건
✅ rule_9 Work Queue — 변경 0건 (승인 대기 그대로)
✅ rule_10 Not Dashboard — 보강 ("작품 리스트 + Work Queue" 시각 hierarchy 명료화)
✅ rule_14 Layout 3-Column — 변경 0건
✅ rule_15 Buttons (max 3 / Primary 1) — 변경 0건
✅ rule_16 Minimalism — 강화 (placeholder 제거, AuditIcon 제거)
✅ rule_17 Layer UI — 변경 0건
✅ rule_18 AI Role — 표현 톤 정렬
```

---

## 6. Build / Validation 결과

```
✓ npx tsc --noEmit             — 0 errors
✓ npx next lint                 — No ESLint warnings or errors
✓ npx next build                — Route 153 kB / First Load 241 kB (−1 kB)
```

| 검증 항목 | 결과 |
|---|---|
| Sidebar PRIMARY / OPERATIONS / GOVERNANCE 그룹 재구성 | ✅ |
| NavGroup `tone="muted"` GOVERNANCE 적용 | ✅ |
| "AI 워크플로우" placeholder 제거 | ✅ |
| 감사 custom button → NavGroup item 흡수 | ✅ |
| BackupHealth footer → GOVERNANCE area 이동 | ✅ |
| AI 표현 reframe (사용자 surface) | ✅ |
| 금지 표현 0건 (positive form) | ✅ |
| 신규 컴포넌트 0개 | ✅ |
| 신규 라이브러리 0개 | ✅ |
| Persistence schema 변경 0건 | ✅ |
| RBAC 변경 0줄 | ✅ |
| Document Lifecycle Clarity 기존 구현 보존 | ✅ |
| Build / type-check / lint 모두 통과 | ✅ |

---

## 7. Before / After 운영자 경험

### BEFORE — 현재 production
```
[Sidebar]
WORKSPACE
  작품               ← active
  거래               ← disabled
  문서               ← Manager+
  고객               ← Manager+

작품 상태 (counts)

OPERATIONS
  AI 워크플로우      ← disabled "작품 상태 액션에서 접근"  ← noise
  물류 운영
  보고서
  이미지 정리
  운영 로그          ← OWNER (governance와 ops 혼재)
  설정               ← "준비 중" (governance인데 ops 위치)

감사
  📄 전체 감사 로그
     갤러리 전체 이벤트       ← custom big button, 시각 weight 큼

승인 대기

[Footer]
  RoleSwitcher
  Reset
  • 백업 12일 전              ← governance인데 footer 매장
  • Local Only
```

운영자 통증: *"일상 작업 / governance / admin 항목 시각 weight 동일 → 우선순위 모호"* / *"AI 워크플로우 클릭해도 동작 안 함"* / *"백업이 governance 같은데 footer에 있어 찾기 어려움"*

### AFTER — STEP UX-2
```
[Sidebar]
PRIMARY                       ← 일상 작업 1급
  작품               ← active
  거래               ← disabled
  고객               ← Manager+

작품 상태 (counts)

OPERATIONS                    ← 일상 운영
  문서               ← Manager+ (PRIMARY → OPERATIONS 이동)
  물류 운영
  보고서
  이미지 정리

GOVERNANCE                    ← quieter 톤 (text-ink-subtle 기본)
  운영 로그          ← OWNER
  전체 감사 로그     ← MANAGER+ (이전 custom button 흡수)
  설정               ← "준비 중"
  • 백업 오늘                  ← live health indicator (이전 footer)

승인 대기

[Footer]                      ← user/data context만
  RoleSwitcher
  Reset
  • Local Only
```

운영자 즉시 인지: *"PRIMARY = 지금 다루는 것 / OPERATIONS = 운영 view / GOVERNANCE = 책임 추적·시스템 항목"* / *"시각 hierarchy = 우선순위"* / *"AI는 작품 흐름에 임베드, 별도 메뉴 아님"* / *"백업 health 즉시 인지 (GOVERNANCE 1급)"*.

### AI 표현 reframe — 사용자 인식 변화

```
BEFORE
  "AXVELA AI 가격 제안"
  "AI 초안 — 인간 검토 필요"
  [AI 가격 제안] 버튼

  → 운영자 인식: "AI가 가격을 결정해주는 시스템"

AFTER
  "참고 가격 신호"
  "AXVELA AI 운영 참고 — 인간 검토 필요"
  [참고 신호 생성] 버튼

  → 운영자 인식: "AXVELA AI는 운영 보조, 결정은 내가 한다"
```

---

## 8. Risk Assessment

**🟢 Low Risk** — 변경 영역이 *시각 hierarchy + 표현 톤*에 한정.

| 영역 | 변경 |
|---|---|
| Sidebar nav 시각 / NavGroup tone prop | 기존 동작 보존, idle 색조만 분기 |
| AI 표현 surface labels | 사용자 인식 surface만, internal 동작 0건 |
| BackupHealth 위치 | 컴포넌트 본체 변경 0줄, 사용 위치만 이동 |
| Sidebar 모든 RBAC / store action / 권한 | **0줄 변경** |
| Document Lifecycle (5개 컴포넌트 + helper) | **0줄 변경** — 기존 구현 그대로 보존 |
| Persistence schema / SCHEMA_VERSION / validateV1 | **0줄 변경** |
| 모든 도메인 (Inquiry/Transaction/Settlement/Tax/FX/Customer/Logistics/Image/Audit/Backup-Restore/Permission/Export/Trend/Drilldown) | **0줄 변경** |
| 3-Column 레이아웃 / DetailPanel STEP UX-1 / Approval Slot Placeholder | **0줄 변경** (DetailPanel은 라벨 1건만) |
| `package.json` | **0줄** |
| Timeline event titles (historical data 일관성) | **0줄** |

**회귀 영향 가능 영역**:
- (a) Sidebar 시각 — 사용자가 PRIMARY/OPERATIONS/GOVERNANCE 새 그룹 라벨 인식 변화 (positive)
- (b) AI 표현 — 사용자가 익숙한 "AI 가격 제안" → "참고 가격 신호"로 라벨 변화 (mental model adjustment 필요할 수 있음, ~1-2 사용 후 자연 적응 예상)

---

## 9. 다음 STEP 권장 (mid-update 검증 후)

```
[지금]      이 ZIP 배포 + 며칠 사용 검증
            → PRIMARY/OPERATIONS/GOVERNANCE 시각 hierarchy 자연스러운지
            → 백업 GOVERNANCE area에서 발견 잘 되는지
            → AI 표현 reframe 톤 어색함 0건인지
   ↓
[검증 후]   다음 후보:
   🅐 STEP 86 — Document Trust Metadata (Phase 1 Fiscal 시작, ~250 LOC, 🟡)
   🅑 STEP UX-3 — Detail Panel Reordering (~300 LOC, 🟠) — 옵셔널 polish
```

**제 추천**: 🅐 STEP 86 — UX 정련 layer (UX-1 + Document Lifecycle + UX-2)가 정착했으니 다음은 *fiscal entity* 정착으로 이동. AXVELA_FISCAL_ARCHITECTURE.md Phase 1 (STEP 86~91) 시작 시점.

---

## 10. Summary

본 STEP은 **scoped UX polish** — daily-use action 가시화 + governance 시각적 quieter화 + AI 톤을 *operational assistance* 정렬.

- **변경 영역**: Sidebar 시각 hierarchy + AI 표현 surface labels
- **변경 LOC**: ~80 LOC delta + ~12 string reframe
- **신규 컴포넌트**: 0
- **신규 라이브러리**: 0
- **신규 도메인 entity**: 0
- **Persistence 영향**: 0
- **RBAC 영향**: 0
- **Document Lifecycle 보존**: ✓ (5 컴포넌트 + helper 그대로)
- **Route delta**: 154 kB → 153 kB (−1 kB, AuditIcon SVG + placeholder + 표현 reframe net 약감)
- **3개 정책 문서 위반**: 0건 (AI Direction / Trust Layer / Fiscal Architecture)
- **Manifesto 위반**: 0건

본 STEP은 *redesign이 아닌 visual polish* — 사용자 spec strict scope 일관 유지.
