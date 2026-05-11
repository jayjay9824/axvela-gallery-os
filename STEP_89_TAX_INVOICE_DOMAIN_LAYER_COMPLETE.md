# STEP 89 — Tax Invoice Domain Layer — Completion Report

## State

**STEP UX-3 baseline (165 kB) → STEP 89 (170 kB · +5 kB).**
First Load 252 kB → 258 kB (+6 kB).
Build / type-check / lint all green.
ZIP: `axvela-step89-tax-invoice-layer.zip`.

---

## 0. Pre-flight — Partial State Discovery (없음, 두 번째 clean slate)

**투명한 상태 보고**: STEP 89 시작 시점에 baseline 검증 결과:

```
src/types/tax-invoice*           부재
src/lib/tax-invoice*             부재
src/components/tax-invoice/      부재
"TaxInvoice" / "STEP 89" grep   0건 (production code)
```

**다만**: STEP 86이 미리 예약한 `TAX_INVOICE` slot 발견:
- `src/types/document-trust.ts`: `DocumentType` enum + `DOCUMENT_TYPE_LABEL_KR` 사전
- `src/lib/document-trust.ts`: `formatDocumentTypeLabel` switch case

**이는 STEP 86 anchor 설계의 forward-compat 정확성 검증 시점** — 미래 entity slot이 *완벽 fit*임을 STEP 89 시작 시 확인. anchor pattern의 가치 입증.

**STEP UX-3 이후 두 번째 clean slate** — STEP 86/87/88 partial-state 4번 연속 후 UX-3에서 끊김 → STEP 89에서 다시 clean. STEP DOC-1 navigation layer는 *발견 시 차단 / 부재 시 통과* 양 동작 모두 신뢰 가능 메커니즘 입증.

---

## 1. Tax Invoice 아키텍처 설명

### 1.1 Entity 설계 — `TaxInvoice` (~250 LOC)

```
TaxInvoice {
  // Linkage (rule_3 + rule_11)
  id, invoiceId (1:1 anchor), receiptId? (옵셔널), transactionId, artworkId, customerId?

  // Amount (Korean fiscal context)
  amount        // 공급가액 (taxable supply, VAT 제외)
  vatAmount     // 부가세 (VAT 10%, tax_exempt 시 0)
  totalAmount   // 총액 = amount + vatAmount
  currency      // Invoice mirror (rule_20)

  // Operational
  status: "DRAFT" | "ISSUED"
  businessType: "business" | "individual" | "tax_exempt" | "other"
  memo?

  // Lifecycle (rule_4)
  issuedAt, finalizedAt?, version, parentTaxInvoiceId, lockedAt, isLocked, revisionReason?

  // STEP 86 trust slots
  generatedBy?, lockedBy?, sourceContext?

  // STEP 87 print/send 패턴 (사용자 spec §7)
  lastPrintedAt?, lastPdfExportedAt?,
  deliveryStatus?, preparedForSendAt?, preparedForSendBy?, recipientContact?,
  sentAt?, sentBy?, sentChannel?  // 본 STEP에서 채움 0건

  // 외부 회계/세무 SaaS future-ready (사용자 spec §6)
  externalSyncStatus?, externalProvider?, externalReferenceId?, syncedAt?
  // 모두 옵셔널, 본 STEP에서 채움 0건
}
```

### 1.2 4-tier Business type — Korean fiscal context

| Code | 라벨 | 설명 |
|---|---|---|
| `business` | 사업자 | 사업자등록증 보유 법인/개인사업자 (정식 발급 가능) |
| `individual` | 개인 | 일반 개인 (의도적 발행 시에만) |
| `tax_exempt` | 면세 사업자 | 부가세 면세 (VAT 0원) |
| `other` | 기타 | 분류 외 (해외/기관/비영리) |

### 1.3 2-state lifecycle — Receipt 패턴 정확 일관

```
DRAFT (편집 가능)
 ├─ updateTaxInvoiceDraft(id, updates)  // amount/vat/total/businessType/memo
 └─ issueTaxInvoice(id)
     ↓
ISSUED + LOCK (immutable)
 ├─ markTaxInvoicePrinted(id)
 ├─ markTaxInvoicePdfExported(id)
 ├─ prepareTaxInvoiceForSend(id, contact?)
 └─ createTaxInvoiceVersion(id, reason?)  // rule_4 fork
     ↓
새 DRAFT (parentTaxInvoiceId chain, version+1)
```

### 1.4 VAT 계산 정책 (사용자 spec §3 Korean retail 표준)

`createTaxInvoice(input)`의 `vatBasis` 옵션:

| vatBasis | 계산 |
|---|---|
| **`vat_inclusive`** (default — Korean retail 표준) | amount = invoice.amount/1.1, vat = invoice.amount-amount, total = invoice.amount |
| `vat_exclusive` | amount = invoice.amount, vat = invoice.amount * 0.1, total = amount+vat |
| `tax_exempt` | amount = invoice.amount, vat = 0, total = invoice.amount |

운영자가 DRAFT 상태에서 amount/vatAmount/totalAmount 모두 직접 편집 가능.

---

## 2. STEP 86~88 Integration 요약

### 2.1 STEP 86 Document Trust Metadata anchor — **두 번째 사용처 검증**

```typescript
// src/lib/document-trust.ts (~70 LOC append)
export function deriveTaxInvoiceTrust(
  taxInvoice: TaxInvoice,
  ctx: DocumentTrustDeriveContext
): DocumentTrustMetadata {
  // ... Receipt 패턴 정확 일관, 단 sourceContext fallback "manual" (Receipt의 "auto"와 차이)
  return {
    docType: "TAX_INVOICE",  // STEP 86이 예약한 enum slot
    version, parentDocumentId, generatedAt, generatedBy,
    sourceContext, lockedAt, lockedBy, finalizedAt, archivedAt,
    revisionReason, deviceLocal,
  };
}
```

**검증 완료**: STEP 86 anchor 설계의 *재사용 가능 패턴* 입증 (첫 번째: STEP 87 deriveReceiptTrust). 미래 STEP 90 Certificate / STEP 91 Settlement Export도 동일 ~30-50 LOC pattern 자연 합류 예상.

### 2.2 STEP 87 Receipt Lifecycle — `receiptId?` 옵셔널 mirror

```typescript
TaxInvoice.receiptId?: string  // 영수증 먼저 발행한 경우 link
```

`createTaxInvoice` 시점 자동으로 `state.receipts[transactionId]?.[0]` (latest)를 mirror — 운영자가 영수증 → 세금계산서 흐름을 자연스럽게 진행할 수 있도록.

### 2.3 STEP 88 Fiscal Summary Aggregate — 자연 합류

```typescript
// src/lib/fiscal-summary.ts (~+50 LOC)
interface FiscalSummaryInput {
  // ...existing fields
  taxInvoices?: TaxInvoice[]  // 옵셔널 (backward compat)
}

interface FiscalSummaryAggregate {
  counts: {
    // ...existing
    taxInvoices: Record<TaxInvoiceStatus, number>  // 추가
  }
}

interface FiscalSummaryCurrencyBucket {
  // ...existing
  taxInvoiceIssuedAmount: number  // 추가 (rule_3 보존 — 별도 column)
}

type FiscalActivityKind =
  | "receipt_issued" | "receipt_send_prepared"
  | "settlement_completed" | "invoice_paid" | "tax_derived"
  | "tax_invoice_issued"  // 추가
```

**STEP 88 완료 보고서 §8.1 예측 정확 매칭** — *aggregate에 case 1개*만 추가하면 자연 합류함을 입증.

### 2.4 Document Lifecycle / UX-3 ZONE — 0줄 변경

- `src/components/document-lifecycle/` 5 컴포넌트 — 0줄
- `src/components/layout/DetailPanel.tsx` (UX-3 6 zones) — 0줄
- Tax Invoice 진입점은 **TransactionSummary CTA** (UX-3 ZONE 3 "거래 & 문서" 안에 자연 합류, DetailPanel 자체는 무변경)

---

## 3. Tax Invoice Lifecycle 요약

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Invoice (PAID 시점)                                              │
│    ↓                                                             │
│  Receipt (Payment cascade 자동 — STEP 87)                         │
│    ↓                                                             │
│  Tax Invoice (사업자 거래 시 운영자가 의도적 발행 — STEP 89)        │
│    │  TransactionSummary "+ 세금계산서 발급" 1 click               │
│    │     ↓                                                       │
│    │  createTaxInvoice({ invoiceId, vatBasis })                   │
│    │     ↓                                                       │
│    │  DRAFT TaxInvoice 자동 생성 + Detail Drawer 자동 open         │
│    │     ↓                                                       │
│    │  운영자 amount/VAT/총액/사업자 분류/메모 편집                   │
│    │     ↓                                                       │
│    │  [발행] Primary 1 click                                      │
│    │     ↓                                                       │
│    │  ISSUED + LOCK + finalizedAt + lockedBy = "AXVELA OS"         │
│    │     ↓                                                       │
│    │  [프린트] / [PDF 저장] / [고객 발송 준비] / [요약 복사]         │
│    │     ↓                                                       │
│    │  (필요 시) createTaxInvoiceVersion(id, reason)                │
│    │     ↓                                                       │
│    │  새 DRAFT v{N+1} (parentTaxInvoiceId chain 보존)              │
│    ↓                                                             │
│  Settlement (rule_3 — separate domain, 본 STEP에서 변경 0줄)       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**수동 발행 정책 근거**: 사업자만 대상이므로 Receipt cascade와 달리 자동 생성 0건. 운영자가 의도적 결정 (사용자 spec §3 "사업자용 세금계산서").

---

## 4. 변경 파일 목록

### 4.1 신규 파일 (3개)

| File | LOC | 설명 |
|---|---|---|
| `src/types/tax-invoice.ts` | ~250 | TaxInvoice entity + 5 enums + Korean labels + Inputs |
| `src/components/tax-invoice/TaxInvoiceDetailDrawer.tsx` | ~620 | Drawer UI (DRAFT 편집 / ISSUED Print/PDF/Send / Version chain) |
| `src/components/tax-invoice/TaxInvoicePrintView.tsx` | ~230 | A4 browser native print layout |
| `STEP_89_TAX_INVOICE_DOMAIN_LAYER_COMPLETE.md` | (본 보고서) | — |

### 4.2 변경 파일

| File | LOC delta | 설명 |
|---|---|---|
| `src/types/artwork.ts` | +1 | TimelineEntityType union에 `"tax_invoice"` 추가 |
| `src/lib/document-trust.ts` | ~+70 | `deriveTaxInvoiceTrust(taxInvoice, ctx)` helper (STEP 86 anchor 두 번째 사용처) + import |
| `src/store/useArtworkStore.ts` | ~+450 | TaxInvoiceDetailRequest type + taxInvoices slice + 7 actions + initial state + reset |
| `src/lib/persistence.ts` | ~+10 | `taxInvoices?` 옵셔널 슬라이스 + sanitizeImportedState pass-through + extractPersistedState |
| `src/components/PersistenceProvider.tsx` | +1 | PersistableStoreSnapshot에 taxInvoices |
| `src/lib/audit-navigation.ts` | ~+5 | AuditTarget union + case "tax_invoice" 라우팅 |
| `src/components/audit/AuditLogDrawer.tsx` | ~+5 | openTaxInvoiceDetail dispatcher case + selector + deps |
| `src/components/audit/GlobalAuditDrawer.tsx` | ~+5 | 동일 |
| `src/lib/fiscal-summary.ts` | ~+50 | taxInvoices? input + counts.taxInvoices + byCurrency.taxInvoiceIssuedAmount + tax_invoice_issued activity + label dict |
| `src/components/fiscal/FiscalSummaryDrawer.tsx` | ~+10 | taxInvoices selector + handleActivityClick "tax_invoice" case |
| `src/components/transaction/TransactionSummary.tsx` | ~+25 | taxInvoices selector + latestTaxInvoice + handleTaxInvoiceCTA + ghost button |
| `src/app/page.tsx` | +2 | TaxInvoiceDetailDrawer import + mount |
| `ARCHITECTURE.md` | entry append | STEP 89 영구 timeline 기록 |
| `HANDOFF.md` | rewrite | STEP 89 완료 시점 갱신 |
| `STEP_INDEX.md` | 89 🟡 → ✅ | Phase 1 Fiscal 4/6 + Quick Reference + 변경 이력 |

### 4.3 변경 0줄 (전수 검증 — 사용자 spec §10 정확 매칭)

#### Sub-summary 컴포넌트 (사용자 spec "preserve Invoice/Receipt flow")
- `src/components/curation/CurationSummary.tsx` — 0줄
- `src/components/inquiry/InquirySummary.tsx` — 0줄
- `src/components/contract/ContractSummary.tsx` — 0줄
- `src/components/settlement/SettlementSummary.tsx` — 0줄
- `src/components/tax/TaxSummary.tsx` — 0줄 (TaxRecord, 별개 entity)
- `src/components/logistics/LogisticsSummary.tsx` — 0줄
- `src/components/transaction/TransactionHistory.tsx` — 0줄
- `src/components/transaction/NewResaleStartCard.tsx` — 0줄

#### Document Lifecycle (사용자 spec "preserve lifecycle components")
- `src/components/document-lifecycle/` 5 컴포넌트 — 모두 0줄
- `src/lib/document-lifecycle.ts` — 0줄

#### Trust / Approval / DetailPanel (사용자 spec §10 DO NOT TOUCH)
- `src/types/document-trust.ts` — 0줄 (STEP 86 정착 enum 그대로 사용)
- `src/components/layout/DetailPanel.tsx` — 0줄 (UX-3 6 zones 보존)
- `src/components/layout/Sidebar.tsx` — 0줄

#### Fiscal Summary 4-card grid (사용자 spec "preserve Fiscal Summary layer")
- `src/components/fiscal/FiscalSummaryDrawer.tsx`의 4 MetricCard — 0줄 변경 (선택자 + drilldown만 추가)

#### Drawer 컴포넌트 (사용자 spec "preserve Receipt flow")
- ReceiptDetailDrawer / ReceiptPrintView — 0줄
- InvoiceDetailDrawer / ContractDetailDrawer — 0줄
- 모든 다른 drawer — 0줄

#### Other
- `src/types/{invoice,contract,receipt}.ts` — 0줄
- `src/lib/persistence.ts` validateV1 / SCHEMA_VERSION — 0줄
- `package.json` — 0줄 (외부 라이브러리 0개)

---

## 5. Print/Send Preparation 요약

### 5.1 Print/PDF (사용자 spec §7)

| 액션 | 구현 | 외부 라이브러리 |
|---|---|---|
| 프린트 | `markTaxInvoicePrinted(id)` + `window.print()` | 0개 (browser native) |
| PDF 저장 | `markTaxInvoicePdfExported(id)` + `window.print()` (사용자가 dialog에서 *PDF로 저장* 선택) | 0개 |

**TaxInvoicePrintView**의 `@media print` CSS 격리:
```css
body * { visibility: hidden; }
.tax-invoice-print-area, .tax-invoice-print-area * { visibility: visible; }
```
→ 인쇄 시 *유일하게 본 영역만* 출력. drawer chrome / sidebar / detail panel 모두 print:hidden.

### 5.2 Customer-send-ready (사용자 spec §7)

```typescript
TaxInvoice {
  deliveryStatus?: "not_prepared" | "prepared" | "pending_external"
  preparedForSendAt?, preparedForSendBy?, recipientContact?
  sentAt?, sentBy?, sentChannel?  // 본 STEP에서 채움 0건
}
```

**inline modal**:
- 수신자 contact 입력 (이메일 / 사업자번호 / 식별 메모)
- "발송 준비 기록" 버튼 → `prepareTaxInvoiceForSend(id, contact)`
- "*실제 외부 발송은 본 시스템에서 지원하지 않습니다*" disclaimer

### 5.3 요약 복사

clipboard helper — `navigator.clipboard.writeText(...)` 외부 도구 발송용 텍스트 요약:
```
세금계산서 v1
발행번호: TI-A1B2C3D4
상태: 발행 완료
공급가액: ₩909,091
부가세: ₩90,909
총액: ₩1,000,000
수신자 분류: 사업자
```

---

## 6. Future Accounting/API Compatibility 요약

### 6.1 사용자 spec §6 — Future API Ready

| TaxInvoice 슬롯 | 본 STEP 값 | 미래 STEP 활용 |
|---|---|---|
| `externalSyncStatus` | `"not_synced"` 영구 | STEP 91+ Accountant Export 시 `"pending"` → `"synced"` |
| `externalProvider` | undefined | STEP 91+ "Hometax" / "Bizmeka" / 회계 SaaS 식별자 |
| `externalReferenceId` | undefined | STEP 91+ 외부 시스템의 reference id |
| `syncedAt` | undefined | STEP 91+ 외부 동기화 시점 |
| `sentAt` / `sentBy` / `sentChannel` | undefined | future email/SMS API 통합 시점 |

**본 STEP 정책**: 슬롯만 정의 / 실제 외부 API 0건 (사용자 spec §6 "do NOT implement actual APIs yet" 정확 매칭).

### 6.2 미래 STEP 통합 비용 예상

| STEP | LOC | 패턴 |
|---|---|---|
| STEP 90 Settlement Tax derive | ~150 | derived layer / 신규 entity 0개 / 본 TaxInvoice의 vatAmount aggregate |
| STEP 91 Accountant Export | ~250-350 | TaxInvoice + Invoice + Receipt + Settlement cross-doc CSV/JSON export |
| 미래 회계 SaaS 통합 | ~200/provider | externalSyncStatus 동적화 / API client wrapper |

**STEP 86 anchor 설계의 영구 가치**: 미래 fiscal entity 추가 시 *deriveXxxTrust* helper ~70 LOC만 추가하면 자연 합류 — STEP 87 (Receipt) + STEP 89 (TaxInvoice) 두 번 입증.

---

## 7. Build / Validation 결과

```
✓ npx tsc --noEmit             — 0 errors
✓ npx next lint                — No ESLint warnings or errors
✓ npx next build               — Route 170 kB / First Load 258 kB
                                 (STEP UX-3 baseline 165 kB / 252 kB → +5 kB / +6 kB)
```

| 검증 항목 | 결과 |
|---|---|
| TaxInvoice entity 250 LOC | ✅ DRAFT/ISSUED 2-state + 4-tier businessType + future send/sync slots |
| 7 store actions | ✅ open/close/create/updateDraft/issue/createVersion/markPrinted/markPdfExported/prepareForSend |
| 수동 발행 cascade 0건 | ✅ Receipt와 차이, Korean fiscal context 정확 매칭 |
| `deriveTaxInvoiceTrust` | ✅ ~70 LOC, STEP 86 anchor 두 번째 사용처 |
| TaxInvoiceDetailDrawer | ✅ 620 LOC, DRAFT 편집 / ISSUED Print/PDF/Send / Version chain / Send-prepare modal |
| TaxInvoicePrintView | ✅ 230 LOC, A4 + @media print visibility 격리 |
| browser native window.print() | ✅ 외부 라이브러리 0개 |
| persistence v1 호환 | ✅ taxInvoices? 옵셔널, validateV1 변경 0줄 |
| audit drilldown | ✅ AuditTarget kind="taxInvoice" + 두 dispatcher (AuditLogDrawer/GlobalAuditDrawer) |
| TimelineEntityType | ✅ artwork.ts union "tax_invoice" 추가 |
| FiscalSummary aggregate | ✅ counts + currency + activity 자연 합류 (STEP 88 예측 정확 매칭) |
| TransactionSummary CTA | ✅ "+ 세금계산서 발급" / "세금계산서 v{N}" ghost button |
| Forbidden language | ✅ 0 user-facing (verified by grep) |
| Approval Workflow leakage | ✅ 0건 (verified by grep) |
| 신규 라이브러리 | ✅ 0개 (`package.json` 0줄) |
| Route delta | +5 kB |

---

## 8. Risk Assessment

**🟡 Medium-Low Risk** — 새 도메인 entity 정착 / store extensive integration / Drawer + Print View 신규 / TransactionSummary 1 button 추가.

### 회귀 영향 가능 영역

| 영역 | 영향 | 검증 |
|---|---|---|
| TransactionSummary 액션 footer | "+ 세금계산서 발급" / "세금계산서 v{N}" ghost button 1개 추가 | 기존 "거래 상세" / "Invoice 보기" 흐름 보존 |
| localStorage hydrate | 옵셔널 taxInvoices 슬라이스 | `?? {}` fallback / legacy 데이터 영향 0 |
| Multi-tab sync | PersistableStoreSnapshot에 taxInvoices 추가 | BroadcastChannel 호환 |
| FiscalSummary aggregate | taxInvoices? 옵셔널 input | 기존 호출자 영향 0 (옵셔널 input) |
| Audit dispatchers | AuditLogDrawer + GlobalAuditDrawer에 case "taxInvoice" 추가 | 기존 case 0줄 변경 |

### 회귀 영향 없는 영역 (검증 0줄 변경)

§4.3 참조 — 30+ 영역 모두 0줄 변경 verified.

---

## 9. 운영자 / 다음 STEP 작성자 경험 — Before / After

### BEFORE (STEP UX-3 baseline)
- Invoice / Receipt / Settlement 흐름은 정착됐으나 *전자세금계산서*는 *시스템 외부* 작업 (워드/엑셀/회계 SaaS 등 운영자 ad-hoc 처리)
- 사업자 거래 시 별도 도구로 세금계산서 발급 후 운영 메모로만 추적 가능
- Tax Invoice 발행 record 시스템 부재

### AFTER (STEP 89)
- TransactionSummary "+ 세금계산서 발급" 1 click → DRAFT TaxInvoice 자동 생성 + Detail Drawer 자동 open
- 운영자 공급가액 / VAT / 총액 / 사업자 분류 / 메모 즉시 편집 가능
- "발행" Primary 1 click → ISSUED 진입 + LOCK + finalizedAt
- ISSUED 후 [프린트] (Primary) / [PDF 저장] / [고객 발송 준비] / [요약 복사] 즉시 사용
- 발송 준비 inline modal — recipientContact 메모 + deliveryStatus 추적 (실제 외부 API 발송 0건)
- 정정 필요 시 "+ 새 버전 생성" — sibling versions chain 보존
- TaxInvoicePrintView A4 layout — 인쇄 시 *세금계산서 1장*만 출력
- 톤: "세금계산서" / "발행 대기" / "발행 완료" / "갤러리 운영 참고용 발급 record" / "사업자 거래 확인용" — NOT government software / NOT ERP

---

## 10. 다음 STEP 권장

```
[지금]      이 ZIP 배포 + 검증 phase
            → 사업자 거래 시 "+ 세금계산서 발급" 흐름이 자연스러운지
            → DRAFT 편집 → 발행 → 프린트 흐름이 매끄러운지
            → VAT 계산 default ("vat_inclusive")가 한국 갤러리 retail 표준에 맞는지
            → Version chain / 정정 사유 흐름이 운영자에게 명확한지
   ↓
[검증 후]   다음 후보:
   🅐 STEP 91 — Accountant Export (~250-350 LOC, 🟡 medium) ★ 강추
       → 본 STEP 88의 [PDF 저장 준비] / [회계 전달 준비] 버튼 활성
       → cross-document export (Invoice + Receipt + Tax Invoice + Settlement + Tax)
       → STEP 86 anchor의 cross-doc 통합 사용 시점
       → Phase 1 Fiscal 5번째
   🅑 STEP 90 — Settlement Tax derive (~150 LOC, 🟢 low)
       → Phase 1 Fiscal 5번째 alternative
       → derived layer / 신규 entity 0개
       → 본 TaxInvoice의 vatAmount aggregate
   🅒 STEP DOC-2 — STEP_INDEX 자동화 (~150 LOC, 🟢 low)
       → clean slate 패턴 두 번 연속 (UX-3 + STEP 89) — 자동화 가치 추가 입증
       → 새 STEP 완료 시 INDEX 자동 동기 hook / script
```

**제 추천**: 🅐 STEP 91 (Accountant Export). 이유:
- STEP 86 anchor의 *cross-doc 통합 사용* 시점 — Invoice + Receipt + Tax Invoice + Settlement + Tax 5종 entity가 모두 STEP 86 view shape에 자연 합류함을 입증
- STEP 88의 disabled buttons ([PDF 저장 준비] / [회계 전달 준비]) 활성 — feedback loop closure
- Phase 1 Fiscal 5번째 + STEP 90을 derived layer로 묶으면 6/6 완성 빠른 진입 가능

---

## 11. 본 STEP의 영구 가치

본 STEP 89는 **STEP 86 anchor 설계의 두 번째 사용처 검증** + **STEP 88 fiscal aggregate 자연 합류 입증**:

```
STEP 86  Document Trust Metadata          (anchor 정착)
STEP 87  Cash Receipt + Print/PDF/Send    (anchor 첫 사용처 — deriveReceiptTrust)
STEP 88  VAT Summary Aggregate Layer      (Layer 3 첫 정착)
STEP 89  Tax Invoice Domain Layer         (anchor 두 번째 사용처 — deriveTaxInvoiceTrust) ⭐
                                          + STEP 88 aggregate 자연 합류 입증
STEP 90  Settlement Tax derive            (다음 — derived layer)
STEP 91  Accountant Export                (cross-doc 통합 — STEP 86 anchor 다중 사용)
```

**입증된 패턴**:
1. STEP 86 anchor — *각 새 fiscal entity에 자연 fit* + helper ~70 LOC만으로 자연 합류 (Receipt + TaxInvoice 두 번 입증)
2. STEP 88 aggregate — *aggregate에 case 1개*만 추가하면 새 entity 자연 합류 (counts + currency + activity)
3. *수동 발행 정책* (Tax Invoice) vs *자동 발행 정책* (Receipt) — 정책을 sourceContext fallback으로 helper에서 구분 가능
4. Sub-summary 컴포넌트 *0줄 변경* 정책에서 *유일한 변경*은 새 entity의 entry point (TransactionSummary CTA) — UX-3 zones 보존하면서도 새 도메인 진입 가능

**Phase 1 Fiscal foundation 4/6 완성** — STEP 90 (Settlement Tax) / STEP 91 (Accountant Export) 진행 가능. 두 번째 clean slate 입증 — STEP DOC-1 navigation layer는 *발견 시 차단 / 부재 시 통과* 양 동작 모두 신뢰 가능.

---

## 12. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-07 | STEP 89 — STEP UX-3 직후 (baseline 165 kB), partial-state 0건 (UX-3 이후 두 번째 clean slate). 다만 STEP 86이 미리 예약한 `TAX_INVOICE` slot 발견 — anchor 설계의 forward-compat 정확성 검증 시점. 본 STEP 작업: (a) `src/types/tax-invoice.ts` (~250 LOC) 신규 / (b) `deriveTaxInvoiceTrust` helper (~70 LOC) 추가 / (c) store 7 actions + slice + initial state + reset / (d) persistence v1 호환 옵셔널 슬라이스 / (e) audit-navigation + 두 dispatcher 통합 / (f) FiscalSummary aggregate 자연 합류 / (g) TransactionSummary "+ 세금계산서 발급" CTA / (h) `TaxInvoiceDetailDrawer` (~620 LOC) + `TaxInvoicePrintView` (~230 LOC) 신규 / (i) page.tsx mount / (j) 빌드/타입/lint/4 정책/Approval leakage 검증 / (k) STEP_INDEX/HANDOFF/ARCHITECTURE/완료 보고서/ZIP 패키징. baseline 165 kB → 170 kB (+5 kB), First Load 252 kB → 258 kB (+6 kB). 외부 라이브러리 0개. Phase 1 Fiscal 4/6 완성. |
