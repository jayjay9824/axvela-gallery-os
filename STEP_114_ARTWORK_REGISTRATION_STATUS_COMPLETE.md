# STEP 114 — ArtworkRegistrationStatus Enum Foundation — COMPLETE ✅

**완료 시점**: 2026-05-08
**Phase**: 4 — Artwork-Centric Workflow Foundation (2/10)
**Stage**: 1 — Foundation (lowest risk)
**Risk profile**: 🟢 매우 낮음 — type-only addition, 0 logic, 0 persistence change, 0 UI

---

## 1. STEP 114 의 정체

### 1.1 본 STEP 의 목표

`AXVELA_WORKFLOW_ARCHITECTURE.md §3.1` spec source 의 **type-level manifestation**.

10-state operational/registration lifecycle 을 type foundation 으로 정착하여
이후 STEP 117 (Draft/Resume) / STEP 118 (Tabs) / STEP 122 (Workflow Visualization)
가 본 enum 위에 자연 합류 가능한 anchor 형성.

### 1.2 본 STEP 이 *아닌* 것

- ❌ UI surface 통합 (STEP 118 Tabs 영역)
- ❌ Transition validation logic (Phase 6 Approval 영역)
- ❌ Auto-derive from `ArtworkState` (STEP 117/122 영역)
- ❌ Existing `ArtworkState` (rule_6 sales lifecycle) 변경 — 0줄 변경
- ❌ Persistence migration (`SCHEMA_VERSION` "v1" 그대로)
- ❌ AI integration (Phase 4 §4.8 — Claude API 신규 연결 금지)

---

## 2. Two-Dimension State Model 정착

### 2.1 두 dimension 의 분리

```
┌──────────────────────────────────────────────────────────────────┐
│ Dimension 1 — Sales Lifecycle (rule_6, 기존)                      │
│ Artwork.state: ArtworkState                                       │
│   "DRAFT" | "READY" | "INQUIRY" | "DEAL" | "PAID"                 │
│         | "CLOSED" | "REOPENED" | "BROKERED"                      │
│ → 거래 측면 8-state                                                │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│ Dimension 2 — Operational/Registration Lifecycle (STEP 114, 신규)  │
│ Artwork.registrationStatus?: ArtworkRegistrationStatus            │
│   "DRAFT" | "PENDING_REVIEW" | "INQUIRY_ACTIVE"                   │
│         | "DEAL_IN_PROGRESS" | "CONTRACT_PENDING"                 │
│         | "AWAITING_PAYMENT" | "PAID"                             │
│         | "PREPARING_CURATION" | "READY_FOR_EXHIBITION"           │
│         | "ARCHIVED"                                              │
│ → 운영 측면 10-state (optional slot)                               │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 충돌 분석

`"DRAFT"` 와 `"PAID"` literal 은 두 type 에 동시 존재하나 **별도 union** —
TypeScript 가 type-distinct 처리. `Artwork.state === "DRAFT"` 과
`Artwork.registrationStatus === "DRAFT"` 는 의미적으로 *다른 dimension 의 동음이의어*.

→ 검증: `tsc --noEmit` 0 errors ✓.

### 2.3 두 dimension 의 mapping (의도적 미정착)

자동 derive (예: `ArtworkState === "PAID"` → `registrationStatus = "PAID"`) 은
**STEP 117/122 영역**. 본 STEP 114 는 *foundation only* — type 만 정착, mapping
규칙은 후속 STEP 에서 spec 정착 시 진입.

이렇게 분리한 이유:
- 운영 현실에서 두 dimension 이 *동시 다른 상태* 가능 (예: state=DEAL 인데
  registrationStatus=PREPARING_CURATION 으로 큐레이션 미리 준비)
- mapping 규칙을 본 STEP 에 강제하면 미래 운영 case 차단

---

## 3. Implementation Inventory

### 3.1 신규 파일 (2)

#### `src/types/artwork-registration-status.ts` (~155 LOC)

| Symbol | 시그니처 | 역할 |
|--------|---------|------|
| `ArtworkRegistrationStatus` | `type ... = "DRAFT" \| ... \| "ARCHIVED"` | 10-state union |
| `ARTWORK_REGISTRATION_STATUSES` | `readonly ArtworkRegistrationStatus[]` | Canonical ordered list |
| `ARTWORK_REGISTRATION_STATUS_LABEL_KR` | `Record<..., string>` | Korean labels (gallery internal) |
| `ARTWORK_REGISTRATION_STATUS_LABEL_EN` | `Record<..., string>` | English labels (international) |
| `isArtworkRegistrationStatus` | `(v: unknown) => v is ...` | Type guard for external input |
| `nextRegistrationStatus` | `(s) => s \| null` | Pure progression helper, terminal → null |

#### `src/lib/__tests__/artwork-registration-status.scenarios.ts` (~270 LOC)

7 scenarios:
1. Enum membership — 10 expected values present
2. Ordered list integrity — index order matches spec + uniqueness
3. Korean label coverage — all 10 keys non-empty + no "인간 검토" (STEP 113 정합)
4. English label coverage — all 10 keys non-empty
5. Ordering progression — 9-step canonical chain
6. Terminal state — ARCHIVED → null
7. Type guard — accepts 10 valid + rejects 13 invalid (lowercase / ArtworkState 값 / unknown / number / null / undefined / object / array 등)

### 3.2 수정 파일 (1)

#### `src/types/artwork.ts` (+~16 LOC)

```typescript
import type { ArtworkRegistrationStatus } from "./artwork-registration-status";

export interface Artwork {
  // ... 기존 fields 모두 그대로 ...
  inquiryCount: number;
  updatedAt: string;
  registrationStatus?: ArtworkRegistrationStatus;  // ⭐ STEP 114 추가
}
```

JSDoc 으로 *Two-Dimension State Model* 명시 + Phase 4 §4 정합 확인 + spec source
(AXVELA_WORKFLOW_ARCHITECTURE.md §3.1) cross-reference.

### 3.3 절대 변경 안된 영역 (검증됨)

- ❌ `src/lib/persistence.ts` — `validateV1` / `SCHEMA_VERSION` "v1" 0줄 변경
- ❌ `src/lib/state-machine.ts` — rule_6 transition 0줄 변경
- ❌ 기존 `ArtworkState` — 8-state 무손상
- ❌ 기존 mock-data.ts artwork — `registrationStatus` 부재 자연 호환 (optional)
- ❌ Phase 1 Fiscal entity 6/6 — 0줄 변경
- ❌ AI infra (STEP 93~96) — 0줄 변경
- ❌ Translation UI (STEP 96) — 0줄 변경
- ❌ Document Writing UI (STEP 95) — 0줄 변경

---

## 4. Validation Results

| 항목 | 결과 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next lint` | ✅ 0 warnings, 0 errors |
| `npx next build` | ✅ build success |
| Route size | **187 kB** (STEP 113 → 변동 0 kB, type-only signal) |
| First Load JS | **275 kB** (변동 0 kB) |
| DOC-2 §4.1 ≤10 kB target | ✅ 통과 (0 kB delta) |

| Scenario Suite | Result |
|----------------|--------|
| ai-protocol | ✅ 17/17 |
| fiscal-derive | ✅ 10/10 |
| operational-insight | ✅ 12/12 |
| anthropic-provider | ✅ 9/9 |
| **artwork-registration-status** ⭐ | **✅ 7/7 (신규)** |
| **Total** | **✅ 55/55 PASS** (회귀 0건, +7 신규) |

---

## 5. Phase 4 §4 Implementation Constraints 정합 검증

| §4 원칙 | 검증 |
|---------|------|
| §4.1 Additive only | ✅ 신규 type + optional slot |
| §4.2 Optional slot priority | ✅ `registrationStatus?` |
| §4.3 No persistence migration | ✅ `validateV1` / `SCHEMA_VERSION` 변경 0줄 |
| §4.4 Draft-safe | ✅ 영향 없음 (저장 흐름 미변경) |
| §4.5 Backward compat | ✅ 기존 mock Artwork 자연 호환 (optional 부재 → undefined) |
| §4.6 Build green | ✅ tsc / lint / build / 55 scenarios 모두 통과 |
| §4.7 Worktree 금지 | ✅ 현재 project 만 직접 수정 |
| §4.8 AI not priority | ✅ AI infra 0줄 변경, Claude API 신규 연결 0건 |

---

## 6. Anchor Pattern 정착 (DOC-2 §3.1)

본 STEP 의 산출물은 **다음 STEP 들이 합류할 anchor** 가 됩니다:

| 후속 STEP | 본 anchor 사용처 |
|----------|-----------------|
| STEP 117 (Draft/Resume) | `Artwork.registrationStatus = "DRAFT"` 가 자동 진입점 |
| STEP 118 (Tabs) | Tab 진행도 표시 (현재 status 강조) |
| STEP 119 (Curation Connected) | `PREPARING_CURATION` 상태에서 Tab 4 자연 활성 |
| STEP 120 (Hold State) | `INQUIRY_ACTIVE` ↔ `DEAL_IN_PROGRESS` 사이 hold transition |
| STEP 122 (Workflow Viz) | Living Timeline 위에 10-state 진행 시각화 |

→ DOC-2 §3.1 anchor reuse Tier 7+ 의 *foundation source* 정착.

---

## 7. 다음 STEP

### 권장 자연 진입: STEP 115 — Contact Structure Foundation

Phase 4 Stage 1 진행 (113 ✅ → 114 ✅ → **115** → 119).

- spec: Inquiry/Customer 에 `email?`, `phone?`, `institution?`, `preferredContactMethod?`, `internalNotes?`, `timezone?` optional 추가
- Risk: 🟢 낮음 — type-level 만, 기존 `연락처` field 보존 (deprecated marker)
- ~120 LOC 예상
- 의존성: 없음 (병렬 진입 가능)
- Phase 4 1/3 → 3/10 진입

또는 **STEP 119** (Curation Connected Data, ~150 LOC) 도 의존성 없이 즉시 진입 가능 — 사용자 우선순위에 따라 선택.

---

## 8. 본 STEP 의 영구 가치

1. **Two-Dimension State Model 정착** — `ArtworkState` (sales) / `ArtworkRegistrationStatus` (operational) 의 분리가 영구 reference. 미래 신규 dimension 추가 시 동일 패턴 답습 가능.
2. **Phase 4 anchor source** — STEP 117/118/119/120/122 가 본 enum 위에 합류, DOC-2 §3.1 anchor reuse 효과 확장.
3. **Type-only foundation pattern 매뉴얼화** — code-logic 0줄 + 0 kB delta + 7 scenarios 만으로 Phase 4 진행 가속.
4. **Multilingual label foundation** — KR/EN 동시 정착 (STEP 96 multilingual projection 정합).
5. **Persistence v1 forward compat 입증** — optional slot 만으로 schema migration 0건 달성.
