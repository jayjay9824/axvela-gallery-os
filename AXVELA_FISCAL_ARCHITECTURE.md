# AXVELA OS — Future Fiscal / Invoice / Contract Architecture

> **상태**: Strategic Planning (PLANNING ONLY — DO NOT IMPLEMENT YET)
> **작성 시점**: 2026-05-04, mid-update 직전 baseline (149 kB, governance 100% coverage)
> **본 문서 권한**: Owner only — 본 architecture 변경은 별도 STEP으로 처리
> **연관 정책**: AXVELA Manifesto rule_4 (Trust Layer) / rule_5 (AI-Human Loop) / rule_11 (Transaction Core) / `AXVELA_AI_DIRECTION.md`

---

## ⚠️ Critical — Implementation Stance

이 문서는 **architecture proposal**이며 코드 변경 0건입니다. 모든 STEP 86~100 후보는 본 문서를 베이스로 설계되되, 각 STEP의 실 구현 spec은 *그 STEP 시작 시점에 별도 정의*합니다.

**현재 baseline (149 kB) 위에 본 문서만 추가 — 다른 변경 0건.**

---

## 1. Long-term AXVELA Fiscal Architecture Proposal

### 1.1 Core Principle 재확인

AXVELA는 다음이 **아닙니다**:
- ❌ Generic gallery CRM
- ❌ Standalone invoice / billing app
- ❌ Bookkeeping software clone
- ❌ ERP / 회계 패키지

AXVELA는 **"Artwork Operating System"**입니다.

### 1.2 단일 Lifecycle 원칙 (rule_1 + rule_11 통합)

```
Artwork (single source of truth)
   ↓
Transaction (operational state machine)
   ↓
Document (immutable trust artifacts)
   ↓
Tax / Settlement (fiscal layer)
   ↓
Audit (governance layer — STEP 65/78~85 정착됨)
```

이 흐름이 *하나로 연결된 lifecycle*이어야 합니다. 각 layer는 *독립 모듈*이지만 *작품 entity 1개를 중심*으로 묶입니다.

### 1.3 Four-Tier Separation Model

```
┌────────────────────────────────────────────────────────────────────┐
│                    LAYER 1: Operational Process                     │
│                          (Transaction)                              │
│  - State machine: INQUIRY → DEAL → PAID → SETTLED → CLOSED         │
│  - Mutable while in-flight                                          │
│  - 다음 layer로 진행하기 위한 trigger 발행                          │
└────────────────────────────────────────────────────────────────────┘
                            ↓ generates trigger
┌────────────────────────────────────────────────────────────────────┐
│                    LAYER 2: Immutable Documents                     │
│              (Contract / Invoice / Cash Receipt /                   │
│               Tax Invoice / Certificate / Condition Report)         │
│  - LOCK 후 수정 0건 (rule_4)                                        │
│  - 수정 = 새 version 생성, 이전 version 보존                       │
│  - generatedAt / generatedBy / version / status 필수 metadata      │
└────────────────────────────────────────────────────────────────────┘
                            ↓ derived computation
┌────────────────────────────────────────────────────────────────────┐
│                    LAYER 3: Fiscal Aggregates                       │
│                  (Tax / Settlement / FX)                            │
│  - 도메인 entity (Transaction / Document) 위 derived computation    │
│  - VAT summary / Artist settlement / FX conversion                  │
│  - 운영 참고 only — 법적 효력 무관 표현 (사용자 spec)              │
└────────────────────────────────────────────────────────────────────┘
                            ↓ records & audit
┌────────────────────────────────────────────────────────────────────┐
│                    LAYER 4: Governance Layer                        │
│                          (Audit) ✅ STEP 65/78~85 완성              │
│  - 5/5 카테고리 활성화: image_storage / backup / restore /          │
│                          permission / system                         │
│  - Drilldown / Export / Trend 시각화 정착                          │
└────────────────────────────────────────────────────────────────────┘
```

### 1.4 핵심 설계 원칙

| 원칙 | 설명 |
|---|---|
| **Artwork-First** (rule_1) | 모든 Document / Tax / Settlement는 *작품 1점*에서 시작 |
| **Document = Immutable** (rule_4) | 한 번 LOCK된 Document는 수정 0건, 수정 = 새 version |
| **Transaction = Mutable** | in-flight 상태에서 modification 자유 |
| **Document is generated, not uploaded** | random 파일 업로드 0건 — 모두 transaction state transition trigger |
| **Tax = derived, not entered** | TaxRecord는 입력 entity가 아니라 *Settlement.COMPLETED trigger로 derive* |
| **AI는 보조** (rule_5) | AI는 draft 생성 / 흐름 explain만, 최종 승인은 인간 |

---

## 2. Suggested Future Type Structure

### 2.1 현재 baseline (변경 0건)

이미 정착된 entity:
```typescript
Artwork
├ Transaction          (operational state machine)
├ Inquiry
├ Invoice              (one-to-many, version 부재 — 향후 추가 검토)
├ Contract             (LOCK 흐름 부분 정착)
├ Payment
├ Settlement
├ TaxRecord
├ Logistics
├ ConditionReport
└ CurationNote
```

### 2.2 향후 type 진화 제안

#### 2.2.1 Currency 분리 (multi-currency 대응)

현재 `priceKRW: number` 단일 필드 → 향후:

```typescript
// 향후 타입 (Phase 3 시점에 도입)
interface Money {
  amount: number;
  currency: "KRW" | "USD" | "EUR" | "GBP" | "JPY";
}

interface Artwork {
  // 기존:
  priceKRW: number;          // ← 그대로 유지 (legacy compat)
  // 추가 (옵셔널):
  basePrice?: Money;         // ← Phase 3 신규
  acceptedCurrencies?: ReadonlyArray<Money["currency"]>;
}

interface Transaction {
  // 추가:
  transactionCurrency?: Money["currency"];
  fxSnapshotAtClose?: FxSnapshot;
}

interface Settlement {
  // 추가:
  settlementCurrency?: Money["currency"];
  fxConvertedAmount?: Money;
}
```

**핵심**: `priceKRW` 필드는 **삭제하지 않고** 옵셔널 `basePrice` 추가 — schema breaking change 0건.

#### 2.2.2 Document Trust Metadata (rule_4 강화)

모든 Document type에 다음 필드 *옵셔널 추가*:

```typescript
interface DocumentTrustMetadata {
  /** 결정성 ID — 같은 trigger → 같은 결과 */
  documentId: string;
  /** Version 번호 — LOCK 후 수정 시 새 version 생성 */
  version: number;
  /** Status — DRAFT / READY / LOCKED / VOIDED / SUPERSEDED */
  status: DocumentStatus;
  /** ISO timestamp — generation 시점 */
  generatedAt: string;
  /** RBAC actor — 누가 생성했는가 */
  generatedBy: { role: Role; label: string };
  /** Transaction state transition trigger 식별 */
  triggeredBy?: { transactionId: string; transition: string };
  /** 이전 version 참조 (수정 시 chain 형성) */
  previousVersionId?: string;
  /** Audit linkage — STEP 78 audit drilldown에서 본 document 진입 가능 */
  auditEventIds?: ReadonlyArray<string>;
}

type DocumentStatus =
  | "DRAFT"        // 작성 중
  | "READY"        // 검토 대기
  | "LOCKED"       // 확정 — 수정 불가
  | "VOIDED"       // 무효 — 새 version으로 superseded
  | "SUPERSEDED";  // 더 이상 active 아님 (다음 version 존재)

interface Contract { ...기존..., trust?: DocumentTrustMetadata; }
interface Invoice  { ...기존..., trust?: DocumentTrustMetadata; }
// 신규 도입 시 trust는 처음부터 필수
interface CashReceipt    { ...신규..., trust: DocumentTrustMetadata; }
interface TaxInvoice     { ...신규..., trust: DocumentTrustMetadata; }
interface Certificate    { ...신규..., trust: DocumentTrustMetadata; }
interface ExportDocument { ...신규..., trust: DocumentTrustMetadata; }
```

**핵심**: 기존 Contract / Invoice는 옵셔널 `trust` 필드만 추가 → schema breaking 0건. 신규 entity는 처음부터 필수.

#### 2.2.3 Tax Mode 표현

```typescript
// 향후 타입 (Phase 2 시점에 도입)
type TaxMode =
  | "VAT_INCLUDED"       // 부가세 포함
  | "VAT_EXCLUDED"       // 부가세 별도
  | "REVERSE_CHARGE"     // EU B2B 역과세
  | "EXPORT_ZERO_RATED"  // 수출 영세율
  | "CUSTOMS_PENDING"    // 수입 통관 진행
  | "TAX_EXEMPT";        // 면세

interface TaxRecord {
  // 기존 필드 그대로
  // 추가 (옵셔널):
  taxMode?: TaxMode;
  jurisdiction?: "KR" | "US" | "EU" | "JP" | "GB" | "OTHER";
  baseAmount?: Money;
  taxAmount?: Money;
  /** 신고 / 법적 효력 무관 명시 — UI에서 negative form disclaimer */
  isOperationalReference: true;
}
```

#### 2.2.4 신규 entity 후보 (Phase 2~4)

```typescript
// Phase 2
interface CashReceipt {
  id: string;
  artworkId: string;
  transactionId: string;
  trust: DocumentTrustMetadata;
  amount: Money;
  receiptType: "PERSONAL" | "BUSINESS";  // 한국 현금영수증 분류
  buyerIdentifier?: string;              // 휴대폰 번호 / 사업자번호 (식별자만)
  issuedAt: string;
}

interface TaxInvoice {  // 한국 세금계산서
  id: string;
  artworkId: string;
  transactionId: string;
  trust: DocumentTrustMetadata;
  taxMode: TaxMode;
  baseAmount: Money;
  vatAmount: Money;
  totalAmount: Money;
  // 본 entity는 *운영 참고용 데이터 보유*만 — 국세청 발행 연동 0건
  isOperationalReferenceOnly: true;
}

// Phase 3
interface ExportDocument {
  id: string;
  artworkId: string;
  transactionId: string;
  trust: DocumentTrustMetadata;
  destinationCountry: string;
  declaredValue: Money;
  customsStatus: "PENDING" | "CLEARED" | "BLOCKED";
  // 통관 정보 reference만 — 실 EDI 연동 0건
  isOperationalReferenceOnly: true;
}

// Phase 4
interface AccountantExportPackage {
  id: string;
  periodFromIso: string;
  periodToIso: string;
  trust: DocumentTrustMetadata;
  /** STEP 83 audit export 패턴 위에 build */
  contents: {
    artworkSummary: ReadonlyArray<string>;       // artwork IDs
    invoiceIds: ReadonlyArray<string>;
    settlementIds: ReadonlyArray<string>;
    taxRecordIds: ReadonlyArray<string>;
    auditEventIds: ReadonlyArray<string>;
  };
}
```

---

## 3. Suggested Sidebar Evolution

### 3.1 현재 (variations across STEP 74)
```
Sidebar
├ Artwork (메인 grid)
├ Status filter (DRAFT / READY / INQUIRY / DEAL / PAID / CLOSED)
├ Reporting          (STEP 67/70)
├ Documents Hub      (STEP 72/76)
├ Customer           (STEP 73)
├ Logistics
├ Image Cleanup     (Owner)
├ Audit Log         (Owner — STEP 65/78~85)
└ Backup / Restore  (STEP 52/59/81)
```

### 3.2 단계별 진화 (rule_15 / rule_16 minimalism 유지)

#### Phase 1 (STEP 86~88 시점)
**원칙**: 신규 sidebar 항목 0개. 기존 Documents Hub *내부*에서 sub-section 확장.

```
Documents Hub                ← 기존 항목, 클릭 시 drawer
 ├ All Documents
 ├ Contracts                 ← 기존 (정착)
 ├ Invoices                  ← 기존 (정착)
 ├ Cash Receipts             ← Phase 1 신규 sub
 ├ Tax Invoices (참고용)      ← Phase 1 신규 sub — \"운영 참고\" 라벨
 ├ Certificates
 ├ Condition Reports         ← 기존
 └ Audit Exports             ← 기존 (STEP 83)
```

이 단계에서는 **Sidebar 자체 변경 0줄** — DocumentsDrawer 내부 navigation만 확장.

#### Phase 2 (STEP 89~91 시점)

`Tax / Settlement` 별도 항목 검토 — *invoice flow 정착 + transaction architecture 정착 후에만*.

```
Sidebar (변경 검토 시점)
├ Artwork
├ Status filter
├ Reporting
├ Documents Hub
├ Tax / Settlement       ⭐ Phase 2 신규 (검토)
│  ├ Cash Receipts
│  ├ Tax Invoices (참고용)
│  ├ Settlement Tracking
│  ├ Artist Settlement Tax
│  └ Accountant Export
├ Customer
├ Logistics
├ Image Cleanup
├ Audit Log
└ Backup / Restore
```

**가드레일**: Sidebar는 *최대 11개 항목*까지. 그 이상은 sub-grouping 또는 collapsible section 도입 필요. 절대 dense dashboard 방향 금지 (rule_16).

#### Phase 3 (STEP 92+ 시점)

International transaction layer 활성화 시 — 별도 sub-section 추가하지 않고 *기존 Transaction / Settlement에 currency / FX 컬럼 추가*. Sidebar 변경 0건.

#### Phase 4

`Accountant Export Package`는 Documents Hub 내부 → 별도 sidebar 항목 격상 검토. 단, *실 사용 빈도 검증 후*에만.

---

## 4. Recommended Implementation Order

### Phase 1 (Safe Foundation) — STEP 86~88
**목표**: Document trust layer 정착, transaction-linked document 흐름 본격화. 신규 라이브러리 0개, persistence schema 옵셔널 add only.

| STEP | 제목 | LOC | Risk | Persistence 영향 |
|---|---|---|---|---|
| 86 | **Document Trust Metadata** — 기존 Contract / Invoice에 옵셔널 `trust` 필드 추가 + LOCK 흐름 정밀화 | ~200 | 🟢 낮음 | 옵셔널 add only |
| 87 | **Cash Receipt Layer** — 신규 entity + DocumentsDrawer 내부 sub-section | ~300 | 🟡 중간 | 신규 slice |
| 88 | **Document Generation Triggers** — Transaction state transition → Document generate hook (random upload 0건) | ~250 | 🟡 중간 | 0줄 |

### Phase 2 (Korean Fiscal Layer) — STEP 89~91
**목표**: 한국 갤러리 실무 세무 (운영 참고용 only).

| STEP | 제목 | LOC | Risk | 비고 |
|---|---|---|---|---|
| 89 | **Korean Tax Invoice (참고용)** — 신규 entity, 국세청 발행 연동 0건 | ~350 | 🟡 중간 | \"운영 참고\" / \"세무 검토용\" 라벨 일관 |
| 90 | **Settlement Tracking 정밀화** — 기존 Settlement 위 audit + version | ~250 | 🟡 중간 | 옵셔널 trust 추가 |
| 91 | **VAT Summary Report (운영 참고용)** — Reporting drawer 위 derived view | ~200 | 🟢 낮음 | 0줄 (derived) |

### Phase 3 (International Layer) — STEP 92~94
**목표**: Multi-currency + FX + 수출입 reference. AXVELA AI Direction 정책 정확 적용.

| STEP | 제목 | LOC | Risk | 비고 |
|---|---|---|---|---|
| 92 | **Multi-currency Foundation** — `Money` type 도입, Artwork 옵셔널 `basePrice` | ~400 | 🟠 중간~높음 | persistence 옵셔널 add (validateV1 보완) |
| 93 | **FX Snapshot Layer** — STEP 31/32/34 위 lightweight helper, deterministic fallback | ~300 | 🟠 중간 | 0줄 (snapshot은 separate slice) |
| 94 | **Export / Customs Reference** — 신규 ExportDocument entity, EDI 연동 0건 | ~350 | 🟠 중간~높음 | 신규 slice |

### Phase 4 (Accountant Workflow) — STEP 95~97
**목표**: 회계사 전달 흐름. STEP 83 audit export 패턴 재사용.

| STEP | 제목 | LOC | Risk | 비고 |
|---|---|---|---|---|
| 95 | **Artist Settlement Tax Workflow** — 원천징수 / 갤러리 수수료 분리 | ~300 | 🟡 중간 | Settlement 위 derived |
| 96 | **International VAT Summary** — EU reverse charge / export zero-rated 분류 | ~250 | 🟠 중간 | 운영 참고 only |
| 97 | **Accountant Export Package** — 월별 zip (STEP 83 패턴 위) | ~280 | 🟢 낮음 | STEP 83 helper 재사용 |

### Phase 5 (Reserved — Phase 3 AI Intelligence와 병행)
| STEP | 제목 |
|---|---|
| 98 | Document AI Draft Assistant (rule_5 — draft only, 인간 승인 필수) |
| 99 | Gallery-Controlled Visibility (`pricingVisibility` 옵셔널 — AXVELA AI Direction 사전) |
| 100 | Audit Round-trip Import (STEP 83 export의 reverse — historical record consolidation) |

---

## 5. Risk Analysis

### 5.1 High-Risk Areas

#### 🔴 Persistence Schema Migration
**위험**: Multi-currency 도입 시 `priceKRW` → `basePrice: Money` 전환은 schema breaking change 발생 가능. 옵셔널 add only로 처리해도 *consumer code가 어느 쪽 우선*인지 결정 필요 → 실수 시 mock data / production data 불일치.

**완화**:
- 옵셔널 add only 정책 (Phase 1~3 모두)
- v1 schema 그대로 유지, v2 migration plan은 별도 STEP (Phase 5+)
- 모든 consumer는 fallback 명시 (`artwork.basePrice ?? { amount: artwork.priceKRW, currency: \"KRW\" }`)

#### 🔴 Document Immutability 위반
**위험**: Document LOCK 후 수정 시도 — 운영자가 \"실수로 잘못 입력\" 했다면? rule_4 위반 vs UX 충돌.

**완화**:
- LOCK 후 수정은 **새 version 생성** only (이전 version 보존)
- VOIDED status로 이전 version 무효 표시
- audit linkage로 모든 version 추적 가능
- UI는 \"수정\" 버튼 대신 \"새 version 생성\" 버튼 명시

#### 🔴 Tax Layer Legal Misinterpretation
**위험**: 운영자 / 외부인이 AXVELA Tax 데이터를 *법적 효력 있는 신고 자료*로 오인.

**완화**:
- 모든 Tax UI에 부정형 disclaimer 의무: \"운영 참고용 — 외부 신고 / 법적 효력과 무관합니다\"
- \"운영 참고\" / \"세무 검토용\" / \"회계사 전달용\" 표현 일관
- 국세청 / 외부 EDI 연동은 *Phase 5 이후* 별도 검토 (현 phase scope 외)
- export 파일 metadata에 disclaimer 명시 (STEP 83 패턴)

#### 🟠 AI Tax/Legal Conclusion 회피
**위험**: AI가 자동으로 \"이 거래는 면세\" / \"수출 영세율 적용\" 같은 *법적 결정*을 내리는 것처럼 보일 수 있음.

**완화** (rule_5 + AXVELA AI Direction 정확 적용):
- AI는 *draft 제안*만 — 최종 결정은 인간 승인 필수
- 모든 AI 결과에 \"AI 제안 — 회계사 / 세무사 검토 필요\" 라벨
- \"AI Tax Conclusion\" / \"AI 세무 판단\" 표현 0건
- AI는 \"missing workflow steps\" / \"document relationship explain\" 보조만

### 5.2 Medium-Risk Areas

#### 🟡 Sidebar Bloat
**위험**: Tax / Settlement / International / Accountant 각각 sidebar 항목 추가 → 11+ 항목 → dense dashboard 방향.

**완화**: Documents Hub 내부 sub-section 우선, sidebar 추가는 *실 사용 빈도 검증 후*.

#### 🟡 Multi-currency Edge Cases
**위험**: KRW로 입력된 작품을 USD로 거래 → settlement는 EUR로 → 어느 시점 환율 적용?

**완화** (FX Snapshot Layer — STEP 93):
- Invoice 발행 시점에 FX rate Lock (rule_20)
- Settlement 시 FX 계산 (rule_20)
- 모든 환산 결과에 \"snapshot 시점\" 명시
- 실시간 환율 mandatory 0건 — fallback 보장

#### 🟡 Document Generation Failure Recovery
**위험**: Transaction state transition trigger → Document generate 시도 → 실패 시 어떻게?

**완화**:
- Generation 실패는 transaction state는 *그대로 진행* (document 부재로 진행 차단 없음)
- Audit log에 `system_document_generation_failed` 기록 (STEP 84 system-audit-signals 패턴)
- 사용자 명시 \"document 재생성\" 버튼 제공
- LOCK 흐름은 *명시적 클릭*으로만, 자동 LOCK 0건

### 5.3 Low-Risk Areas

#### 🟢 Document Trust Metadata 옵셔널 add
- 기존 Contract / Invoice에 옵셔널 `trust` 필드 추가
- consumer code는 fallback (`doc.trust?.version ?? 1`)
- Schema migration 0건

#### 🟢 STEP 83 Export Pattern 재사용 (Accountant Package)
- 이미 검증된 helper 재사용
- Filter inheritance 패턴 그대로
- 부정형 disclaimer 정책 그대로

---

## 6. Separation Strategy — Transaction vs Document vs Tax

### 6.1 핵심 separation matrix

| Aspect | Transaction | Document | Tax |
|---|---|---|---|
| **Mutability** | Mutable while in-flight | Immutable after LOCK | Derived (always recomputed) |
| **Lifecycle** | State machine progress | One-shot generation + version chain | Trigger-based emission |
| **Storage** | Single record per artwork-buyer pair | One record per generation event | One record per fiscal event |
| **AI 역할** | State suggestion (rule_5 draft) | Draft generation (rule_5 draft) | Summary / explain only — 결정 0건 |
| **Audit linkage** | State transition audit | Generation audit + version audit | Aggregation audit |
| **사용자 행동** | progress / cancel / hold | generate / lock / supersede | review / export (확정 0건) |

### 6.2 흐름 separation

```
[Transaction state transition]
  INQUIRY → DEAL → PAID → SETTLED → CLOSED
       ↓        ↓        ↓        ↓        ↓
   Inquiry   Contract  Invoice  Settlement  Closure
   record   generated  generated  computed   recorded
       │        │        │        │        │
       └────────┴────────┴────────┴────────┘
                         ↓
                    Document Layer
                    (immutable artifacts with
                     version + LOCK + audit linkage)
                         ↓
                    Tax Layer (derived)
                    (CashReceipt / TaxInvoice / VAT Summary —
                     모두 derive from Documents, 입력 entity 0건)
```

### 6.3 절대 통합 금지 (rule_3 강화)

다음은 **절대 같은 entity로 통합 금지**:
1. **Payment** (결제 — Transaction layer)
2. **Settlement** (갤러리↔작가 분배 — Fiscal layer)
3. **Tax** (세무 — Fiscal layer, derived)

각각 **독립된 데이터 구조 + UI + 권한**.

### 6.4 Document is generated, NOT uploaded

**금지**:
- ❌ \"Upload contract\" 버튼 (random PDF 업로드)
- ❌ \"Upload tax invoice\" 버튼

**권장**:
- ✅ \"Generate contract from transaction\" — Transaction state가 trigger
- ✅ \"Generate cash receipt\" — Payment registered가 trigger
- ✅ \"Generate tax invoice\" — Settlement completed가 trigger

**예외** (Phase 1+ 검토):
- Condition Report는 외부 작성 가능 (사진 + 텍스트 입력) — \"upload\" 형태 허용
- Certificate of Authenticity는 외부 PDF upload 가능 — 단, trust metadata 별도 입력 필수

---

## 7. International Transaction Readiness Analysis

### 7.1 현재 상태 (149 kB baseline)

#### ✅ 이미 정착된 인프라
- FX layer (STEP 31/32/34) — `axvela-price.ts` / FX rate snapshot 보유
- Currency type — `Currency` enum (transaction.ts)
- `MoneyAmount` shared component
- Artwork.priceKRW 단일 통화 baseline

#### ❌ 부재 / 부족
- Multi-currency Artwork base price
- Transaction currency separate from Artwork
- Settlement currency separate from Invoice
- Tax mode enum (VAT_INCLUDED / EXPORT_ZERO_RATED 등)
- Jurisdiction enum (KR / US / EU / JP / GB)
- Export / customs document type
- International invoice formatting (EU B2B reverse charge UI)

### 7.2 단계별 readiness

#### Phase 1 (현재) — Korean-only operation
- Single currency (KRW) 가정
- 한국 갤러리 운영 흐름에 최적
- International collector 거래는 *수동 처리* (Artwork.priceKRW를 KRW로 입력, FX는 별도 노트)

#### Phase 2 (STEP 89~91) — Korean fiscal precision
- 한국 세금계산서 / 현금영수증 / VAT (운영 참고용)
- 여전히 single currency
- International은 후순위

#### Phase 3 (STEP 92~94) — International foundation
- `Money` type 도입 (옵셔널 `basePrice`)
- FX snapshot layer 정착 (Invoice 발행 시 lock)
- `acceptedCurrencies` 필드로 갤러리가 거래 통화 제어
- Export document reference (EDI 연동 0건)

#### Phase 4 (STEP 95~97) — International workflow
- Reverse charge UI (EU B2B)
- Export zero-rated 분류
- Multi-jurisdiction Tax mode
- International accountant export package

### 7.3 readiness gating

각 phase는 다음 조건 충족 후에만 진행:

```
Phase 2 시작 조건:
  - Phase 1 STEP 86~88 모두 정착 (mid-update 후 검증)
  - Document trust metadata 운영 검증

Phase 3 시작 조건:
  - Phase 2 STEP 89~91 모두 정착
  - Korean fiscal layer 운영 검증
  - persistence schema v1 안정성 확인 (옵셔널 필드 추가만으로 v1 유지)

Phase 4 시작 조건:
  - Phase 3 STEP 92~94 모두 정착
  - Multi-currency + FX layer 운영 검증
  - 실 international 거래 케이스 존재 시
```

---

## 8. Future STEP Roadmap (STEP 86~100)

### 8.1 전체 roadmap 시각

```
[현재 baseline 149 kB / governance 100% / mid-update 직전]

Phase 1 — Document Trust Foundation
├ STEP 86 — Document Trust Metadata
├ STEP 87 — Cash Receipt Layer
└ STEP 88 — Document Generation Triggers
     ↓ Phase 1 검증 완료
Phase 2 — Korean Fiscal Layer
├ STEP 89 — Korean Tax Invoice (참고용)
├ STEP 90 — Settlement Tracking 정밀화
└ STEP 91 — VAT Summary Report (운영 참고용)
     ↓ Phase 2 검증 완료
Phase 3 — International Foundation
├ STEP 92 — Multi-currency Foundation (Money type)
├ STEP 93 — FX Snapshot Layer
└ STEP 94 — Export / Customs Reference
     ↓ Phase 3 검증 완료
Phase 4 — Accountant Workflow
├ STEP 95 — Artist Settlement Tax Workflow
├ STEP 96 — International VAT Summary
└ STEP 97 — Accountant Export Package
     ↓ Phase 4 검증 완료
Phase 5 — AI Intelligence + Reserved
├ STEP 98 — Document AI Draft Assistant (rule_5 draft only)
├ STEP 99 — Gallery-Controlled Visibility
└ STEP 100 — Audit Round-trip Import (STEP 83 reverse)
```

### 8.2 STEP별 1줄 spec

| STEP | 제목 | 핵심 변경 | Phase |
|---|---|---|---|
| 86 | Document Trust Metadata | Contract/Invoice 옵셔널 `trust` 필드 + LOCK UX | 1 |
| 87 | Cash Receipt Layer | 신규 CashReceipt entity + DocumentsDrawer sub-section | 1 |
| 88 | Document Generation Triggers | Transaction state → Document generate hook | 1 |
| 89 | Korean Tax Invoice (참고용) | 신규 TaxInvoice entity (운영 참고 only) | 2 |
| 90 | Settlement Tracking 정밀화 | Settlement 위 trust + audit + version | 2 |
| 91 | VAT Summary Report | Reporting drawer 위 derived view | 2 |
| 92 | Multi-currency Foundation | `Money` type 도입, Artwork 옵셔널 `basePrice` | 3 |
| 93 | FX Snapshot Layer | Invoice / Settlement FX rate lock | 3 |
| 94 | Export / Customs Reference | 신규 ExportDocument (EDI 연동 0건) | 3 |
| 95 | Artist Settlement Tax Workflow | 원천징수 / 갤러리 수수료 분리 | 4 |
| 96 | International VAT Summary | EU reverse charge / export zero-rated | 4 |
| 97 | Accountant Export Package | 월별 zip (STEP 83 패턴) | 4 |
| 98 | Document AI Draft Assistant | rule_5 draft only, 인간 승인 필수 | 5 |
| 99 | Gallery-Controlled Visibility | `Artwork.pricingVisibility?` 옵셔널 | 5 |
| 100 | Audit Round-trip Import | STEP 83 export의 reverse | 5 |

### 8.3 STEP별 dependency graph

```
86 ──┬──→ 87 ──→ 88
     │            ↓
     │           [Phase 1 완료]
     │            ↓
     └──→ 89 ──→ 90 ──→ 91
                       ↓
                  [Phase 2 완료]
                       ↓
                 92 ──→ 93 ──→ 94
                              ↓
                         [Phase 3 완료]
                              ↓
                        95 ──→ 96 ──→ 97
                                     ↓
                              [Phase 4 완료]
                                     ↓
                               98 / 99 / 100
                              (병행 진행 가능)
```

### 8.4 STEP별 권장 시작 시점

| STEP | 권장 시작 시점 |
|---|---|
| 86 | mid-update 후 검증 완료 시 |
| 87~88 | STEP 86 정착 후 |
| 89~91 | Phase 1 완료 + 한국 갤러리 운영 검증 |
| 92~94 | International 거래 케이스 발생 시 |
| 95~97 | Phase 3 정착 + 회계사 협업 시점 |
| 98 | AXVELA AI Direction 정책 정착 검증 후 |
| 99 | Phase 3 직전 (Visibility는 Multi-currency 사전 작업) |
| 100 | STEP 83 export 운영 검증 후 |

---

## 🛡️ Architectural Guardrails

본 architecture를 진화시킬 때 절대 금지 사항:

### ❌ 절대 금지
- AXVELA를 generic ERP / 회계 software로 변환
- Tax / Legal 결정을 AI가 자동 finalize
- Transaction과 Document를 같은 entity로 통합
- Payment / Settlement / Tax를 같은 entity로 통합
- LOCK된 Document 직접 수정 (수정 = 새 version)
- Random PDF upload만으로 Document 인정
- 국세청 / EDI / 외부 정부 시스템에 자동 신고

### ✅ 항상 준수
- Artwork-First (rule_1) — 모든 Document는 작품 1점에서 출발
- Document = Immutable + Version + LOCK (rule_4)
- AI = Draft + Human Approval (rule_5)
- Money flow separation (rule_3) — Payment / Settlement / Tax 독립
- 부정형 disclaimer 일관 — \"운영 참고\" / \"~과 무관합니다\"
- Audit linkage — 모든 Document / Tax / Settlement는 STEP 65/78~85 audit governance에 통합
- Persistence schema 옵셔널 add only (Phase 1~4) — breaking change는 v2 migration STEP 별도

---

## 📅 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-04 | Phase 1~5 초안 작성 — STEP 86~100 roadmap 정착 (코드 변경 0건, planning only) |
