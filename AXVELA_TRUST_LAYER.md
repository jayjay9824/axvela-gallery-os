# AXVELA OS — Future Approval Workflow / Trust Layer Architecture

> **상태**: Strategic Planning (PLANNING ONLY — DO NOT IMPLEMENT YET)
> **작성 시점**: 2026-05-04, mid-update phase 진행 중 (STEP UX-1 직후, baseline 150 kB)
> **본 문서 권한**: Owner only — 본 architecture 변경은 별도 STEP으로 처리
> **연관 정책**: AXVELA Manifesto rule_4 (Trust Layer) / rule_5 (AI-Human Loop) / rule_7 (RBAC) / `AXVELA_AI_DIRECTION.md` / `AXVELA_FISCAL_ARCHITECTURE.md`
> **구현 시점**: Fiscal Layer (STEP 86~91) 정착 후 — *절대 그 전에 시작 금지*

---

## ⚠️ Critical — Implementation Stance

본 문서는 **architecture proposal**이며 코드 변경 0건입니다. 

**현재 baseline (150 kB) 위에 본 문서만 추가 — 다른 변경 0건.**

본 문서가 정의하는 시스템은 향후 **STEP 86~91 Fiscal Layer 정착 후** 시작되며, 그 전에 시작 시 fiscal 도메인 entity가 부재한 상태에서 *empty approval queue*가 노출되어 *오히려 운영 혼란*을 야기합니다.

---

## 1. Future Approval Workflow Architecture Proposal

### 1.1 Core Identity 재확인

AXVELA는 다음이 **아닙니다**:
- ❌ Generic gallery CRM
- ❌ Generic ERP
- ❌ Bookkeeping dashboard
- ❌ Enterprise approval bureaucracy

AXVELA는 **"High-value Artwork Operating System"**입니다.

따라서 *high-trust operational workflows*가 필수이며, 다음을 줄여야 합니다:
- 운영 실수 (operational mistakes)
- 인보이스 오류
- 계약 불일치
- 우발적 승인
- 세무 / 문서 실수
- 책임 소재 불분명

### 1.2 PERMISSION ≠ APPROVAL — 핵심 분리 원칙

**본 architecture의 가장 중요한 통찰**:

| | RBAC (Permission) | Approval Workflow |
|---|---|---|
| **목적** | "사용자가 *접근*할 수 있는 것" | "*완료* 전 review가 필요한 것" |
| **본질** | Access control | Final operational responsibility |
| **현재 구현** | ✅ `src/lib/rbac.ts` — STAFF/MANAGER/OWNER + ROLE_RANK + hasPermission | 🟡 부분 — Contract REVIEW/APPROVED 상태 + Sidebar `승인 대기` queue placeholder |
| **예시** | "STAFF는 audit log 접근 불가" | "Contract LOCK은 OWNER 검토 후" |
| **변경 정책** | **유지** — replace 절대 금지 | **확장** — RBAC 위 추가 layer |

**미래 architecture stack**:
```
┌──────────────────────────────────────────────────┐
│  Layer 4: Trust Layer (institution-grade output) │
│            - immutable export, version chain     │
└──────────────────────────────────────────────────┘
                       ↑ derives from
┌──────────────────────────────────────────────────┐
│  Layer 3: Audit Governance (✅ STEP 78~85 완성)   │
│            - 5/5 카테고리: image / backup /      │
│              restore / permission / system        │
└──────────────────────────────────────────────────┘
                       ↑ records
┌──────────────────────────────────────────────────┐
│  Layer 2: Approval Workflow (🟡 future)           │
│            - approval_requested → granted/denied  │
│            - high_value_override / lock_confirmed │
└──────────────────────────────────────────────────┘
                       ↑ requires
┌──────────────────────────────────────────────────┐
│  Layer 1: RBAC (✅ 정착됨)                        │
│            - STAFF / MANAGER / OWNER              │
│            - ROLE_RANK + hasPermission()          │
└──────────────────────────────────────────────────┘
```

Approval은 RBAC을 *대체*하지 않고 *그 위에 layer*됩니다. 사용자는 RBAC으로 *접근*을 얻고, Approval workflow로 *완료 책임*을 결정합니다.

### 1.3 Trust Layer Principle

AXVELA는 **institution-grade operational software**처럼 동작해야 합니다.

모든 중요 approval action은 향후 다음을 지원:
- Version history (rule_4)
- Audit linkage (STEP 78~85 governance와 통합)
- Actor tracking (누가 승인했는지)
- Timestamps (언제)
- Approval notes (왜)
- Immutable export (record가 변경 불가능하게 외부 보관 가능)

---

## 2. Suggested Data Model

### 2.1 현재 baseline (변경 0건)

기존 entity:
```typescript
// src/lib/rbac.ts
type Role = "STAFF" | "MANAGER" | "OWNER";
const ROLE_RANK: Record<Role, number> = { STAFF: 1, MANAGER: 2, OWNER: 3 };

// Contract entity (이미 부분 approval 흐름 존재)
type ContractStatus = "DRAFT" | "REVIEW" | "APPROVED" | "LOCKED" | "SENT";

// Settlement entity (이미 부분 approval 흐름 존재)
type SettlementStatus = "PENDING" | "READY" | "COMPLETED";
```

### 2.2 향후 type 진화 제안 (DO NOT IMPLEMENT NOW)

```typescript
// 신규 — Universal approval action record
interface ApprovalAction {
  id: string;                       // 예: "apr_01HZYK8N..."
  domain: "CONTRACT" | "INVOICE" | "TAX_INVOICE" | "SETTLEMENT" 
        | "INTERNATIONAL_SHIPMENT" | "DOCUMENT_LOCK";
  targetId: string;                 // contract.id / invoice.id 등
  targetVersion: string;             // 어떤 version에 대한 승인인지
  
  requestedBy: string;               // user/role label
  requestedAt: string;               // ISO datetime
  
  status: "PENDING" | "GRANTED" | "REJECTED" | "EXPIRED";
  grantedBy?: string;
  grantedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  
  approvalNote?: string;             // 검토 메모
  rejectionReason?: string;
  
  isHighValueOverride?: boolean;     // 9번 항목 정책
  highValueThresholdKRW?: number;
  
  auditEventIds: string[];           // STEP 78~85 audit 연결
  immutable: boolean;                // GRANTED 후 true (rule_4)
}

// Document status — 표준 lifecycle
type DocumentStatus = 
  | "DRAFT"        // 초기 작성 (STAFF 권한)
  | "REVIEW"       // MANAGER 검토 대기
  | "APPROVED"     // OWNER 승인 완료, LOCK 대기
  | "LOCKED"       // 변경 불가 (rule_4)
  | "SENT"         // 외부 전달 (옵셔널)
  | "ARCHIVED";    // 보관

// Approval-aware extensions
interface InvoiceWithApproval extends Invoice {
  status: DocumentStatus;
  approvalChain: ApprovalAction[];   // 승인 이력 (immutable append-only)
}

interface ContractWithApproval extends Contract {
  status: DocumentStatus;
  approvalChain: ApprovalAction[];
}
```

### 2.3 Persistence 영향 사전 분석

- 신규 slice 1개 (`approvals: ApprovalAction[]`) — PersistedState v1 호환 (옵셔널 추가)
- 기존 entity (Contract / Settlement)에 옵셔널 `approvalChain` 필드 추가 가능
- `validateV1` 보완 필요 (옵셔널 array 검증)
- SCHEMA_VERSION 유지 (옵셔널 필드 추가는 v1 호환)
- localStorage `axvela.approvals.v1` 별도 키 가능 (audit 패턴과 동일)

---

## 3. Suggested Approval Queue Structure

### 3.1 현재 (이미 부분 구현)

`src/components/layout/Sidebar.tsx` 의 `approvals` array는 이미 다음 source에서 derive:
- Contracts — REVIEW (Owner approval 대기) + APPROVED (Owner LOCK 대기)
- Settlements — non-COMPLETED (PENDING / READY)

### 3.2 향후 진화 — 통합 Approval Queue

향후 sidebar `승인 대기` 섹션은 다음을 통합:
```
승인 대기 (12)
├ 계약 승인 — "선으로 부터" v1 · 검토 중            [amber]
├ 계약 LOCK — "창가와 바다" v2 · 승인 완료           [blue]
├ 인보이스 승인 — "Who's Fujiw..." v1 · 발행 대기    [amber]
├ 인보이스 LOCK — INV-2026-0123 v1 · 승인 완료       [blue]
├ 세금계산서 발행 — TAX-2026-0089 · 회계 검토 중      [amber]
├ 정산 — "선으로 부터" 정산 대기                     [grey]
├ 국제선적 승인 — DHL-INTL-7821 · 운영 검토 중       [amber]
└ 고가 거래 검토 — ₩2,500,000,000 · OWNER 검토 필요  [red, urgent]
```

### 3.3 Filter / Sort / Visibility (향후)

- **Role-based visibility**: STAFF는 자신이 요청한 항목만 / MANAGER는 review 단계 / OWNER는 모두
- **Filter**: domain (계약/인보이스/세무) / status (검토중/승인완료) / urgency (고가 거래)
- **Sort**: urgency desc → requestedAt asc (오래된 검토 우선)
- **Empty state**: 현재 message "승인 대기 항목이 없습니다." 그대로 유지 (rule_16 minimalism)
- **Approval history**: 별도 drawer (옵셔널, GOVERNANCE 영역)

---

## 4. Suggested Audit Integration (CRITICAL)

### 4.1 신규 audit category — `approval`

기존 5/5 카테고리 (image_storage / backup / restore / permission / system)에 6번째 추가 검토:
- **6. `approval`** — 승인 워크플로우 이벤트

또는 기존 `permission` 카테고리 확장 — *권장*: 별도 카테고리로 분리하여 *권한 부여(role 변경)*와 *완료 승인(approval)* 명확 구분.

### 4.2 audit action naming (STEP 80 noun_verb_result convention 일관)

```
approval_request_created     # 승인 요청 생성
approval_request_granted     # 승인 부여
approval_request_rejected    # 승인 거부
approval_request_expired     # 승인 만료 (옵셔널)
document_lock_confirmed      # LOCK 확정 (immutable 전환)
document_lock_overridden     # LOCK 해제 (높은 권한 + 강한 감사)
high_value_override_invoked  # 고가 거래 multi-step 승인
high_value_override_completed # 고가 거래 multi-step 승인 완료
invoice_verified             # 인보이스 검증 (MANAGER)
tax_issued                   # 세금계산서 발행 확정 (OWNER)
international_shipment_approved  # 국제 선적 승인
```

### 4.3 audit metadata 권장 필드

```typescript
{
  category: "approval",
  action: "approval_request_granted",
  severity: "info",  // 또는 "warning" for override / high_value
  
  metadata: {
    domain: "CONTRACT",
    targetId: "ctr_xxx",
    targetVersion: "v2",
    previousStatus: "REVIEW",
    nextStatus: "APPROVED",
    approvalNote: "조건 검토 완료",
    isHighValueOverride: false,
    
    // Trust layer chain
    requestedAt: "2026-XX-XXTXX:XX:XX.XXXZ",
    requestedBy: "STAFF · 김지은",
    grantedAt: "2026-XX-XXTXX:XX:XX.XXXZ",
    grantedBy: "OWNER · 대표"
  },
  
  targetType: "Contract",
  targetRef: "contracts/ctr_xxx"
}
```

### 4.4 STEP 78 audit drilldown 확장

기존 4 drilldown domain (audit_category / audit_action / audit_severity / audit_events)이 자연 통합 — `approval` 카테고리가 활성화되면 chip 자동 등장, action breakdown 자동 표시.

### 4.5 STEP 83 audit export 확장

기존 CSV / JSON export는 `approval` 카테고리 자연 포함 — 별도 변경 0건. 단, audit 회계 / 감리 export는 *immutable approval chain 전체*를 포함하는 별도 export option 추가 권장 (Phase 5).

---

## 5. Role vs Approval Separation Strategy

### 5.1 분리 핵심 — "Two-key system"

```
┌─────────────────────────────────────────────────────────┐
│  KEY 1: RBAC (현재 정착)                                 │
│  → 사용자가 그 화면 / 버튼에 접근할 수 있는가?           │
│  → STAFF / MANAGER / OWNER + ROLE_RANK + hasPermission   │
│  → 권한 부족 시 disabled + permission hint              │
└─────────────────────────────────────────────────────────┘
                         +
┌─────────────────────────────────────────────────────────┐
│  KEY 2: Approval Workflow (미래 추가)                    │
│  → 그 action이 *지금 완료*되어도 되는가?                 │
│  → DocumentStatus + ApprovalAction chain                 │
│  → status에 따라 buttons enabled/disabled               │
│  → Owner의 "approval"이 있어야 LOCK으로 전환             │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Role 별 미래 행동 매트릭스

| Action | STAFF | MANAGER | OWNER |
|---|---|---|---|
| Draft 작성 | ✅ | ✅ | ✅ |
| Inquiry 등록 | ✅ | ✅ | ✅ |
| Contract 작성 | ✅ | ✅ | ✅ |
| Contract REVIEW 요청 | ✅ | ✅ | ✅ |
| Contract APPROVED 부여 | ❌ | ❌ | ✅ |
| Contract LOCK 확정 | ❌ | ❌ | ✅ |
| Invoice 작성 | ✅ | ✅ | ✅ |
| Invoice VERIFY | ❌ | ✅ | ✅ |
| Invoice 발행 (LOCK) | ❌ | ❌ | ✅ |
| Tax Invoice 발행 | ❌ | ❌ | ✅ (회계 검토 후) |
| Settlement COMPLETED | ❌ | ❌ | ✅ |
| 국제선적 승인 | ❌ | 🟡 (조건부 — 금액 한도) | ✅ |
| 고가 거래 (>X억) | ❌ | ❌ | ✅ + multi-step |
| Document LOCK 해제 | ❌ | ❌ | ✅ + override audit |

### 5.3 Manager 한도 정책 (옵셔널 — Phase 5)

MANAGER의 일부 approval은 *금액 한도* 적용 가능:
- 고가 거래 (예: ≥ ₩500,000,000) → MANAGER 승인 불가, OWNER 직접
- 국제 거래 → MANAGER 운영 승인 가능, 단 OWNER 최종 LOCK 필요

이는 현재 `ACTION_MIN_ROLE` matrix에 없으며, 향후 `HIGH_VALUE_THRESHOLD_KRW` constant 추가 검토.

---

## 6. Minimal UX Approach

### 6.1 절대 금지 — "Enterprise Bureaucracy" 패턴

❌ **금지 UI 패턴**:
- ERP-like 다단계 modal 체인
- noisy approval dashboard
- excessive approval popup confirmation
- enterprise tab clutter (15개 sub-tab)
- "approval workflow editor" UI (자체로 복잡)
- 대규모 chart / graph dashboard

### 6.2 권장 UX — "Calm Operational Trust"

✅ **권장 UI 패턴 (rule_15 / rule_16 / rule_17 일관)**:

#### 6.2.1 Sidebar `승인 대기` 섹션 (이미 부분 구현)
- count badge (≤2자리)
- 클릭 시 해당 detail drawer 직접 open (rule_9 — 즉시 동작)
- 빈 상태 "승인 대기 항목이 없습니다." (rule_16)

#### 6.2.2 Detail Panel approval row (Drawer 내부)
```
계약서 v2                                        [LOCK 대기]
─────────────────────────────────────────────────────────
요청: STAFF · 김지은 · 2시간 전
검토: MANAGER · 박매니저 · 1시간 전 (승인 완료)

[ 승인 (OWNER) ]                          ← Primary 검은 button
                                           STEP UX-1 정책 일관
검토 거절 (메모 필수)                       ← 작은 텍스트 링크
이전 버전 보기                              ← 작은 텍스트 링크
```

#### 6.2.3 고가 거래 override (multi-step, rule_17 layer UI)
```
고가 거래 — ₩2,500,000,000

이 거래는 한도(₩500,000,000) 초과로 추가 검토가 필요합니다.

체크 1: ☑ 거래 조건 확인했음
체크 2: ☑ 가격 / 통화 검증했음
체크 3: ☑ 수취인 / 송장 확인했음

검토 메모 (필수)
[                                  ]

[ 최종 승인 ]                              ← Primary, 모두 체크되어야 활성
취소                                        ← 작은 텍스트
```

### 6.3 표현 정책

✅ **사용 권장**:
- "승인 대기"
- "검토 중"
- "승인 완료"
- "LOCK 확정"
- "운영 책임"
- "고가 거래 검토"

❌ **금지 표현**:
- "법적 효력" / "공인 승인" / "certified approval"
- "compliance verified" / "tamper-proof"
- "forensic record" / "legal audit trail"
- "감정 완료" / "공식 인증"

(AXVELA_AI_DIRECTION.md 정책과 일관)

---

## 7. Risk Analysis

### 7.1 High-Risk Areas

| Risk | 영향 | 완화 |
|---|---|---|
| **Persistence schema migration** | 기존 사용자 데이터 마이그레이션 필요 | 옵셔널 필드만 추가, validateV1 점진적 보완 |
| **Approval queue empty state 노출** | fiscal layer 부재 시 queue 항상 비어 어색 | **Fiscal Layer (STEP 86~91) 정착 후**에만 시작 |
| **Audit integration cycle** | approval audit이 또 audit emit 트리거 가능 | STEP 84 system-audit-signals 패턴 (3-layer guard) 답습 |
| **RBAC와 approval 혼동** | 사용자가 disabled 이유를 헷갈림 | hint 분리 — `permission` tone vs `approval-pending` tone |
| **High-value override 남용** | OWNER 부재 시 운영 정체 가능 | "임시 위임" 정책 X (operationally safe), 단 emergency_lock 별도 STEP 검토 |

### 7.2 Medium-Risk Areas

| Risk | 영향 | 완화 |
|---|---|---|
| ApprovalAction immutability | GRANTED 후 수정 불가 정책 위반 가능 | rule_4 LOCK 정책 코드 enforcement |
| Approval queue 무한 증가 | 오래된 expired 항목 누적 | TTL / 자동 만료 정책 (Phase 5) |
| Manager 한도 hardcode | 갤러리별 한도 다름 | 향후 `Settings` 도메인에 한도 설정 (Phase 5+) |

### 7.3 Low-Risk Areas

| 영역 | 이유 |
|---|---|
| Sidebar approval queue 확장 | 이미 부분 구현 — 자연 진화 |
| Audit category 추가 | STEP 78 drilldown 자연 통합 |
| Document status enum 확장 | 옵셔널 필드 — v1 호환 |
| RBAC 변경 | **0건** — RBAC은 *유지*, approval이 *위에 layer* |

---

## 8. Recommended Future STEP Roadmap

### 8.1 전체 시퀀스 — 의존성 그래프

```
[현재]      STEP UX-1 (Action Clarity) 완료 + 150 kB baseline
   ↓
[Phase 0]   STEP UX-2 / UX-3 (UX 정련 — 옵셔널)
   ↓
[Phase 1]   STEP 86~91 — Fiscal Foundation (필수 선행)
   ↓        - Document Trust Metadata
            - Cash Receipt / Tax Invoice
            - Settlement / VAT Summary
            - Multi-currency / FX
   ↓
[현재 본 문서가 정의하는 영역 시작]
   ↓
[Phase 6]   STEP 101~104 — Approval Workflow Foundation
   ↓
[Phase 7]   STEP 105~108 — Trust Layer & High-Value Safety
   ↓
[Phase 8]   STEP 109~112 — Approval Queue Maturity
```

### 8.2 STEP별 1줄 spec (STEP 101~112 예약 범위)

#### Phase 6 — Approval Workflow Foundation (STEP 101~104)

- **STEP 101 — ApprovalAction Type Foundation** (~250 LOC, 🟡 medium)
  - `ApprovalAction` interface 추가 / `DocumentStatus` enum 표준화 / persistence slice 1개 추가 / validateV1 보완
  - 코드 변경: `src/types/approval.ts` (신규) / `src/store/useArtworkStore.ts` (slice 추가) / `src/lib/persistence.ts` (validateV1 옵셔널 확장)
  - **Risk**: 🟡 — persistence schema 옵셔널 확장 (v1 호환, breaking change 0)

- **STEP 102 — Approval Audit Category** (~150 LOC, 🟢 low)
  - `audit-event.ts`에 `category: "approval"` 추가 / 6/6 카테고리 도달
  - audit action 8개 추가 (approval_request_created/granted/rejected/expired, document_lock_confirmed/overridden, high_value_override_invoked/completed)
  - STEP 78 drilldown 자연 통합 (코드 변경 0줄)

- **STEP 103 — Contract Approval Activation** (~300 LOC, 🟠 medium)
  - 기존 Contract REVIEW/APPROVED/LOCKED 상태에 `ApprovalAction` chain 연결
  - "검토 거절 (메모 필수)" UI 추가 / 검토 history drawer
  - STEP UX-1 패턴 일관 — Primary 검은 button 1개

- **STEP 104 — Invoice Approval Activation** (~300 LOC, 🟠 medium)
  - Invoice DRAFT → VERIFIED → APPROVED → SENT → PAID 흐름
  - MANAGER VERIFY 권한 / OWNER LOCK 권한 분리

#### Phase 7 — Trust Layer & High-Value Safety (STEP 105~108)

- **STEP 105 — Document LOCK Immutability Enforcement** (~200 LOC, 🟠 medium)
  - LOCKED 상태 entity 변경 시 *항상 새 version 생성* (rule_4)
  - 모든 도메인 mutation 가드

- **STEP 106 — High-Value Override Workflow** (~350 LOC, 🟠 medium)
  - `HIGH_VALUE_THRESHOLD_KRW` constant 도입
  - multi-step modal (3-checkbox + 메모 필수)
  - high_value_override_invoked / completed audit

- **STEP 107 — Tax Invoice Approval Layer** (~250 LOC, 🟠 medium)
  - 세금계산서 발행 = ACCOUNTING_REVIEW → ISSUED → LOCKED
  - **운영 참고용** disclaimer 명시 (AXVELA_AI_DIRECTION 정책)
  - 외부 정부 시스템 자동 제출 0건 (정책)

- **STEP 108 — International Transaction Approval** (~250 LOC, 🟠 medium)
  - 국제 선적 / 세관 검토 approval chain
  - Manager 운영 승인 + OWNER 최종 LOCK 분리

#### Phase 8 — Approval Queue Maturity (STEP 109~112)

- **STEP 109 — Approval Queue Filtering & Sorting** (~200 LOC, 🟢 low)
  - Sidebar `승인 대기` 확장: domain filter / urgency sort / role-based visibility

- **STEP 110 — Approval History Drawer** (~250 LOC, 🟢 low)
  - 도메인 entity 별 approval chain 전체 viewer
  - read-only, immutable, audit linkage

- **STEP 111 — Approval Notes Standardization** (~150 LOC, 🟢 low)
  - 거절 사유 / 검토 메모 표준 필드
  - 옵셔널 template 제공 (예: "조건 검토 완료" / "가격 재확인 필요")

- **STEP 112 — Trust Export Package** (~300 LOC, 🟠 medium)
  - 회계 / 감리용 immutable export (CSV/JSON/PDF reference)
  - approval chain 전체 + audit linkage 포함

### 8.3 STEP별 권장 시작 시점

| STEP | 권장 시작 조건 |
|---|---|
| STEP 101 | Fiscal Layer (STEP 86~91) 모두 완료 + 며칠 검증 |
| STEP 102 | STEP 101 완료 + audit category 활성 검증 |
| STEP 103 | STEP 102 완료 + Contract entity 안정 |
| STEP 104 | STEP 103 + Invoice entity 안정 (STEP 87/89 의존) |
| STEP 105 | STEP 103 + STEP 104 + LOCK 동작 검증 |
| STEP 106 | STEP 105 + 갤러리 운영자 high-value 정책 정의 |
| STEP 107 | STEP 89 (Tax Invoice 도메인) 완료 후 |
| STEP 108 | STEP 92~94 (International Layer) 완료 후 |
| STEP 109~112 | STEP 103~108 모두 완료 후 (성숙도 layer) |

### 8.4 절대 금지 STEP 방향

- ❌ Approval Workflow를 Fiscal Layer 정착 *전에* 시작
- ❌ AI 자동 approval (사용자 spec 12번 — Human approval mandatory)
- ❌ Government 시스템 자동 제출 (legal liability)
- ❌ ERP-like dashboard / approval workflow editor UI
- ❌ RBAC 대체 / 변경 (RBAC은 *유지*, approval은 *위에 layer*)
- ❌ AI가 "이 거래는 안전합니다" 단정 (Human responsibility)

---

## 🛡️ Architectural Guardrails

### ❌ 절대 금지

- RBAC 대체 — `hasPermission()` / `ROLE_RANK` / `ACTION_MIN_ROLE` 모두 유지
- ERP-like 복잡 dashboard / workflow editor UI
- AI 자동 approval / 자동 LOCK / 자동 발행
- Government 시스템 자동 제출
- "법적 효력" / "공인 승인" / "compliance verified" 표현
- LOCK 후 entity 직접 수정 (rule_4 위반)

### ✅ 항상 준수

- Approval은 RBAC 위에 *layer* (대체 아님)
- audit governance (STEP 78~85) 완전 통합
- rule_4 Trust Layer (version / status / approval / lock)
- rule_5 AI-Human Loop (AI assists, never approves)
- rule_15 Primary 1개 / rule_16 minimalism / rule_17 layer UI
- AXVELA_AI_DIRECTION 표현 정책
- 운영 참고 / device-local / immutable export 톤

---

## 📅 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-04 | 본 문서 작성 — STEP UX-1 직후 / STEP 86~91 Fiscal Layer 정착 후 시작 권장. 코드 변경 0줄. |

---

## 🔗 관련 문서

- `AXVELA_AI_DIRECTION.md` — AI / Market Intelligence 정책 (표현 / UI / 데이터)
- `AXVELA_FISCAL_ARCHITECTURE.md` — Fiscal Layer 4-Tier 구조 (STEP 86~100)
- `ARCHITECTURE.md` — 전체 STEP timeline + 도메인 정착 history
- `src/lib/rbac.ts` — 현재 RBAC 정착 코드
- `src/components/layout/Sidebar.tsx` (line 224~270, 449~500) — 현재 approval queue 부분 구현
