# AXVELA Workflow Architecture

> **정착 시점**: 2026-05-08 (STEP 113 — Phase 4 진입)
> **위치**: 7번째 영구 정책 문서 (Manifesto rule_1 / rule_4 / rule_5 와 정합)
> **변경 정책**: 본 문서는 *영구* — 삭제 금지. 새 항목 추가는 §6 Roadmap 만 갱신, 다른 섹션은 freeze.

---

## §1 Identity Statement

**AXVELA = Artwork-Centric Operating System.**

본 시스템은 다음 *아닙니다*:

| 잘못된 정체 | AXVELA 의 거부 사유 |
|---|---|
| ❌ SaaS gallery CMS | 일반 컨텐츠 입력기 아님 — 운영 흐름 중심 |
| ❌ CRM | 고객 관리 보조 아님 — Artwork 가 주인공 |
| ❌ AI App | AI 가 product 아님, 운영 흐름의 *얇은 보조 layer* |
| ❌ 회계 ERP | 회계 시스템 대체 아님 — Phase 1 Fiscal 은 회계 *전달* layer |

**AXVELA 의 정체**: *작품 1점이 갤러리 운영에 진입한 순간부터 모든 거래/계약/문서/정산/물류/큐레이션/검증이 그 작품 master record 위에 누적되는 운영 OS*.

→ Manifesto rule_1 (artwork_first) 의 architectural manifestation.

---

## §2 Single Source of Truth Principle

모든 운영 entity 는 *반드시* 1개의 Artwork master record 에 연결됩니다:

```
                   Artwork (Single Source of Truth)
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    ┌───┴───┐        ┌───┴───┐        ┌───┴───┐
    Inquiry        Hold              Contract
        │             │                  │
        │             │                  ├─→ Invoice
        │             │                  │      ├─→ Payment
        │             │                  │      └─→ Settlement
        │             │                  │
        │             │                  └─→ Curation
        │             │                          ├─→ Exhibition
        │             │                          └─→ Logistics
        │             │
    ┌───┴────┐    ┌───┴────┐
    Condition  Verification
    Report     (AXID)
```

### 2.1 Connected, Not Independent

- ❌ Locale별 *독립* 문서 생성 금지 (STEP 96 정착 원칙)
- ❌ Artwork 외 *고립된* customer record 금지 (Inquiry → Customer 도 Artwork 경유)
- ❌ Artwork 무관 transaction 생성 금지

### 2.2 AXID — Physical Root Key

실물 작품 → 디지털 system 합류 진입점. 본 문서는 AXID 의 *operational binding* 정의 — 데이터/거래/문서/검증의 모든 surface 가 AXID 를 통해 실물과 trust chain 형성.

---

## §3 Operational Workflow Sequence (Phase 4 진입 정의)

### 3.1 Registration Status (10-state 표준)

본 sequence 는 STEP 114 에서 enum 으로 정착 예정. 아래는 *spec foundation*:

```
Draft
  ↓ (담당자 검토 요청)
Pending Review
  ↓ (검토 완료, 거래 진입 준비)
Inquiry Active
  ↓ (collector 응답, 협상 진입)
Deal In Progress
  ↓ (계약 시작)
Contract Pending
  ↓ (계약 완료, 인보이스 발행)
Awaiting Payment
  ↓ (입금 완료)
Paid
  ↓ (큐레이션 / 출고 준비)
Preparing Curation
  ↓ (전시 / 출고 가능)
Ready For Exhibition
  ↓ (workflow 완료)
Archived
```

### 3.2 Workflow Sub-sequence (Transaction 영역)

```
Inquiry
  ├── Availability 확인
  └── 가격 협의
      ↓
Hold
  ├── Soft Hold
  ├── Deposit 여부
  └── Hold Expiration  (STEP 120 정착 예정)
      ↓
Contract
  ├── 계약서 생성 / Collector 전달
  ├── e-sign tracking
  └── 완료 상태 추적
      ↓
PRE-INVOICE  (STEP 121 — additive label only)
  └── 견적성 invoice (생성 / 저장 / 수정 / 전달)
      ↓
FINAL-INVOICE  (STEP 121 — additive label only)
  └── 발행 / 전달 / 입금 대기 / 입금 완료
      ↓
Payment / Settlement
      ↓
Curation / Logistics / Exhibition
```

> **STEP 121 protection clause**: Phase 1 Fiscal frozen — `invoiceKind: "pre" | "final"` optional slot 만 추가. 기존 DRAFT/SENT/PAID state machine 절대 변경 금지.

---

## §4 Implementation Constraints (Phase 4 영구 원칙)

본 8개 원칙은 Phase 4 (STEP 113~122) 모든 STEP 진입 시 *항상 적용*. DOC-2 §4 Complexity Control 보강 layer.

### 4.1 Additive Only

- 신규 entity 추가 시 *기존 entity schema 변경 0줄*.
- 신규 field 는 **모두 optional** (`field?: T` 패턴).
- Enum 확장 시 기존 값 보존 + 신규 값 append.

### 4.2 Optional Slot Priority

- Required field 추가 = persistence migration 발생 = ❌ 금지.
- Mutable required → Optional → 신규 required (단, 신규 entity 한정).

### 4.3 Persistence Schema Hard Migration 금지

- `SCHEMA_VERSION = "v1"` 유지.
- `validateV1` 변경 0줄.
- 기존 localStorage 데이터 **forced migration 금지**.
- 신규 slot 미존재 → undefined fallback 자연 동작 보장.

### 4.4 Draft-Safe 구조

- Drawer 닫혀도 workflow 보존 (STEP 117 정착 예정).
- 모든 multi-step form 은 *partial state 저장 가능* 해야 함.
- 사용자 의도하지 않은 데이터 손실 0건.

### 4.5 Backward Compatibility

- 기존 데이터는 *언제나* 새 코드에서 정상 동작.
- 새 코드에서 기존 데이터 변환 강제 ❌.
- `lastEditedAt` 등 신규 timestamp 는 missing 허용.

### 4.6 Build Green at All Times

- 매 STEP 완료 시 `tsc --noEmit` / `next lint` / `next build` / scenarios 모두 ✅.
- partial-state 진입 금지 (DOC-2 §2 매뉴얼 적용).

### 4.7 Worktree 생성 금지

- *현재 열린 project 만* 직접 수정.
- Git worktree / 별도 clone 금지 (사용자 spec 명시).
- Multiple-STEP 동시 진행 금지.

### 4.8 AI Integration 우선순위 아님 (Phase 4 한정 절제)

- Phase 4 (STEP 113~122) 진행 중 *Claude API 신규 연결 금지*.
- 기존 STEP 93~96 AI infra 보존 (수정 금지).
- Phase 4 목표 = **Operational Workflow Foundation 안정화**, AI 가 아님.
- 예외: Phase 4 마감 후 Phase 3 잔여 (STEP 97~100) 재개 시 자연 복귀.

---

## §5 Terminology Standards

### 5.1 User-facing UI 표현 (STEP 113 정착)

| 사용 권장 | 사용 금지 | 이유 |
|---|---|---|
| `담당자 검토` | `인간 검토`, `Human Review` | gallery internal workflow tone |
| `담당자 확인` | `인간 확인`, `Human Confirmation` | 동상 |
| `담당자 승인` | `인간 승인` | 동상 |
| `담당자에게 제출` | `인간 검토자에게 제출` | docstring 도 동상 |

### 5.2 보존 keywords (절대 변경 금지)

| 보존 keyword | 보존 사유 |
|---|---|
| `rule_5` | Manifesto rule keyword |
| `AI-Human Loop` | Architectural policy term (AXVELA_AI_DIRECTION.md §10) |
| `(rule_5)` 표기 | Policy reference 표기 |
| `Human-in-the-Loop` (영문 architectural term) | 동상 |

### 5.3 Reframe Rationale

> *"AI demo 느낌이 아니라 실제 gallery internal workflow 느낌"*  
> — 사용자 spec STEP 113 #6

본 reframe 은 architectural 변경이 아니라 *UI tone normalization*. 정책 keyword (rule_5 / AI-Human Loop) 는 architectural reference 로 그대로 보존.

---

## §6 Phase 4 Roadmap (STEP 113~122)

### 6.1 Status Table

| STEP | Status | 1-line | Stage |
|---|---|---|---|
| **113** | ✅ | Terminology Reframe + Workflow Architecture Foundation (본 문서) | 1 |
| **114** | 🟡 | ArtworkRegistrationStatus enum (10-state foundation) | 1 |
| **115** | 🟡 | Contact Structure Foundation (email/phone/institution/timezone optional slots) | 1 |
| **116** | 🟡 | Image-First Registration Hero (large drop zone + thumbnail) | 2 |
| **117** | 🟡 | Draft / Resume System (persistence slice + Sidebar entry) | 2 |
| **118** | 🟡 | Registration Tabs Structure (9-tab restructure) | 2 |
| **119** | 🟡 | Curation Connected Data (artwork-attached optional slots) | 1 |
| **120** | 🟡 | Hold State Foundation (transaction state expansion) | 3 |
| **121** | 🟡 | Invoice PRE/FINAL Distinction (additive label only — Fiscal protect) | 3 |
| **122** | 🟡 | Workflow Sequence Visualization (Living Timeline integration, Phase 4 wrap) | 3 |

### 6.2 Stage Sequence

**Stage 1 — Foundation (lowest risk)**: 113 → 114 → 115 → 119  
**Stage 2 — UI Restructure**: 116 → 118 → 117  
**Stage 3 — Transaction Flow**: 120 → 121 → 122

### 6.3 STEP 121 Critical Protection

⚠️ STEP 121 진입 시 **반드시** 다음 격리:

- Phase 1 Fiscal frozen 6/6 보존 (STEP 86~91 변경 0줄)
- 기존 invoice DRAFT/SENT/PAID/VOIDED state machine 변경 0줄
- 기존 invoice transition rules 변경 0줄
- 추가 허용: `invoiceKind?: "pre" | "final"` optional slot, UI label distinction
- 추가 금지: required field, persistence migration, state machine rewrite

---

## §7 Cross-Reference

| 영구 정책 | 본 문서와의 관계 |
|---|---|
| `AXVELA_AI_DIRECTION.md` | §10 AI-Human Loop / rule_5 — 본 문서 §5.2 보존 keyword 의 source |
| `AXVELA_FISCAL_ARCHITECTURE.md` | Phase 1 frozen 6/6 — 본 문서 §6.3 STEP 121 protection 의 protected layer |
| `AXVELA_TRUST_LAYER.md` | Phase 6 reserved (STEP 101~112) — Phase 4 진행과 *parallel*, 진입 시점 별도 |
| `AXVELA_AI_INTEGRATION.md` | 5 insertion points — Phase 4 진행 중 *수정 금지* (§4.8) |
| `AXVELA_DEV_CONVENTION.md` (DOC-2) | §1 STEP Lifecycle / §3 Anchor Reuse / §4 Complexity — 본 문서 §4 Implementation Constraints 의 보강 |
| `STEP_INDEX.md` | navigation layer — Phase 4 entry section 본 문서 진입 시 추가 |

---

## §8 Permanent Value

본 문서가 영구적으로 보존되는 이유:

1. **Identity 방어막**: AXVELA 가 SaaS / CRM / AI App 으로 흘러가는 것을 방지하는 architectural boundary.
2. **Single Source of Truth 원칙 수문장**: Artwork 외 entity 가 master 행세하는 흐름 차단.
3. **Phase 4 entry charter**: STEP 113~122 모든 진입 시 본 문서 §4 Implementation Constraints 가 1차 reference.
4. **Terminology canonical reference**: STEP 113 이후 신규 STEP 진입 시 §5 Terminology Standards 가 source of truth.
5. **STEP 121 protect mechanism**: Phase 1 Fiscal frozen 위반 가능성 시점에 §6.3 가 명시적 차단.

→ Phase 4 마감 (STEP 122 완료) 이후에도 본 문서는 *영구 보존* — 향후 모든 신규 도메인 (Hold expansion / Verification / Exhibition / Provenance) 진입 시 §1 Identity Statement 에 따라 self-validate.
