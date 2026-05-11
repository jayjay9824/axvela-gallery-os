# STEP 90 — Settlement Tax + Fiscal Document Classification ✅

> **완료 시점**: 2026-05-07
> **Phase**: Phase 1 Fiscal — **6/6 완성, foundation freeze 진입**
> **STEP 86 anchor pattern 4-tier validation 완성**: 정착 → entity helper → cross-doc 통합 → fiscal calculation 영역 확장

---

## 🎯 STEP 90의 정체성

본 STEP은 **lightweight derive layer**입니다.

- ✅ Korean-gallery-oriented fiscal document classification
- ✅ Settlement withholding tax derive (개인 3.3% / 사업자 0% / 법인 0% / 해외 검토)
- ✅ 6 카테고리 enums + Korean labels
- ✅ Pure helpers (entity + opts → derive view)
- ✅ 10 test scenarios (10/10 PASS)

본 STEP은 *아닙니다*:

- ❌ full tax engine
- ❌ 국세청 자동 신고
- ❌ actual Hometax / cash receipt API
- ❌ tax invoice issuance API
- ❌ legal/tax final judgment
- ❌ multi-country tax automation

**핵심 원칙** (사용자 spec 명시):

> AXVELA는 세무 판단을 *최종 확정*하지 않습니다.
> AXVELA는 *recommended document type / required fields / tax estimate / review required flag*만 제공합니다.
> Final tax/legal judgment는 회계사 / 세무사 / 담당자가 확인합니다.

---

## 📊 산출물 요약

| 파일 | LOC | 역할 |
|---|---|---|
| `src/types/fiscal-document.ts` | 327 | 6 카테고리 enums + Korean labels + 임계점 상수 |
| `src/lib/settlement-tax.ts` | 220 | `deriveSettlementTax` helper + withholding rate 매핑 |
| `src/lib/fiscal-document-derive.ts` | 354 | `deriveRecommendedFiscalDocuments` helper + 4-그룹 분기 |
| `src/lib/__tests__/fiscal-derive.scenarios.ts` | 464 | 10 test scenarios + inline assert helpers + runner |
| **합계** | **1365** | **Pure derive layer / production runtime 0 kB delta** |

---

## 🧪 Validation Results

### Build / Type / Lint

```
✓ npx tsc --noEmit          0 errors
✓ npx next lint             clean (No warnings/errors)
✓ npx next build            ✓ Compiled successfully
✓ Route delta               175 kB → 175 kB (0 kB)
✓ First Load JS             262 kB → 262 kB (0 kB)
```

**Route 0 kB delta** = pure derive layer가 production runtime에 import 부재로 tree-shake out. STEP 86 패턴 정확 답습.

### Test Scenarios — **10/10 PASS** (npx tsx 실행 검증)

```json
{
  "total": 10,
  "passed": 10,
  "failed": 0,
  "failures": [],
  "summary": "10/10 passed"
}
```

| # | Scenario | 검증 항목 |
|---|---|---|
| 1 | domestic individual cash buyer 1,000,000원 | cashReceipt recommended + cashReceiptRecommended flag |
| 2 | domestic business + buyerHasBusinessRegistration=true | taxInvoice recommended + taxInvoiceEligible flag |
| 3 | individualArtist 정산 (600,000원 share) | rate 0.033 + tax 19,800 + net 580,200 |
| 4 | soleProprietorArtist | rate 0 + tax 0 + net 600,000 |
| 5 | corporateArtist | rate 0 + tax 0 + net 600,000 |
| 6 | overseasIndividual + USD 3,000 | internationalInvoice + overseasTaxReviewRequired |
| 7 | overseasBusiness + USD 10,000 | commercialInvoice + zeroRatedVATReviewRequired + exportDocumentationRequired |
| 8 | businessReg=false | businessRegistrationMissing flag + taxInvoice 비-recommended |
| 9 | vatExcluded | taxNotes에 "VAT 별도" 포함 |
| 10 | zeroRatedPossible | review required, NOT auto-confirmed |

---

## 🔬 사용자 spec 검증 (10 섹션 100% 매칭)

### §1 Domestic Individual Buyer ✅
- 4 document types: cashReceipt / cardReceipt / simpleReceipt / transactionMemo
- cash + 100,000원 이상 → cashReceipt **recommended**
- 개인 간 거래 → simpleReceipt / transactionMemo optional

### §2 Domestic Business / Corporate / Foundation / Organization ✅
- 5 document types: taxInvoice / invoice / receipt / transactionStatement / paymentConfirmation
- businessReg true → taxInvoice eligible
- VAT handling required flag 자동 emit

### §3 Artist Settlement ✅
- 4 artist types + 7 derive fields (사용자 spec 정확 매칭)
- individualArtist 3.3% / soleProprietorArtist 0 / corporateArtist 0 / overseasArtist review required

### §4 Overseas Transaction ✅
- 5 buyer types + 5 document types + 5 flags
- "review required" 상태 default — 자동 확정 0건

### §5 VAT Handling ✅
- 5 modes: vatIncluded / vatExcluded / vatExempt / zeroRatedPossible / vatReviewRequired
- 분류 + flag 중심, 복잡 계산 0건

### §6 deriveRecommendedFiscalDocuments helper ✅
- 6-field 결과: recommendedDocuments / requiredDocuments / optionalDocuments / reviewFlags / missingFields / taxNotes

### §7 Review Flags ✅
- 9개 모두 정착: cashReceiptRecommended / taxInvoiceEligible / vatReviewRequired / zeroRatedVATReviewRequired / overseasTaxReviewRequired / withholdingReviewRequired / businessRegistrationMissing / buyerIdentityMissing / exportDocumentationRequired

### §8 Important UX Copy ✅
- 사용 표현: "발행 가능" / "발행 권장" / "검토 필요" / "세무 확인 필요" / "증빙 서류 필요" / "운영 참고" / "회계사 확인 필요"
- 금지 표현 0 user-facing (verified by grep)

### §9 Implementation Scope ✅
- derive layer + types/enums + helpers + labels + test cases 정확 매칭
- DO NOT 항목 모두 준수: actual Hometax integration / cash receipt API / tax invoice issuance API / legal judgment / multi-country automation 모두 0건

### §10 Major Test Cases ✅
- 10/10 PASS (모든 case 100% 매칭, 위 표 참조)

---

## 🛡️ 4 영구 정책 정합 검증

### AXVELA AI Direction ✅
- 금지 표현 0 user-facing: "세금계산서 발행 확정" / "영세율 확정" / "세무상 문제 없음" / "세무 신고 완료" / "법적 효력 보장" / "compliance verified" 모두 *주석 prohibition only* 또는 scenarios.ts의 negation 검증 use case로만 등장
- AI / Market Intelligence 영역 무관 (rule_5 AI-Human Loop 일관)

### Trust Layer ✅
- Approval Workflow 본격 구현 0건 (verified by grep — `ApprovalAction` / `ApprovalQueue` / `reviewerAssignment` / `managerApproval` 모두 0건)
- "PERMISSION ≠ APPROVAL" 분리 보존

### Fiscal Architecture ✅
- Layer 1 + 2 + 3 + 4 모두 정착 활용
- 본 STEP은 Layer 3 Fiscal Aggregates의 *보강* — Settlement entity의 derive 출력에 withholding tax 분리 + Document Classification 분류 layer 추가
- fiscal calculation은 *withholding rate × settlementBeforeTax* 단일 도메인 안 (rule_3 strict)
- tax logic 0건 (분류만, 판단 0건)

### Manifesto rule_3·4·11·12·15·16·17·20 모두 보존
- **rule_3** Money Flow Separation strict — withholding은 settlementBeforeTax 안에서만 분리
- **rule_4** Document Trust Layer (변경 0줄)
- **rule_11** Transaction Core (변경 0줄)
- **rule_12** Settlement formula 정확 보존 — `netToArtist = grossAmount − galleryCommission − expenses` 그대로 / 본 STEP은 *다음 단계*만 추가 (`netAfterWithholding = settlementBeforeTax − withholdingTax`)
- **rule_15 / 16 / 17** UI 부재 (drawer 변경 0줄)
- **rule_20** FX Lock — currency mirror, KRW 환산 0건

---

## 🔁 STEP 86 anchor pattern 4-tier validation 완성

| Tier | STEP | 사용처 |
|---|---|---|
| 1 정착 | STEP 86 | DocumentTrustMetadata 12 필드 + 6 docType enum |
| 2 entity helper | STEP 87 | `deriveReceiptTrust` (Receipt 진입) |
| 2 entity helper | STEP 89 | `deriveTaxInvoiceTrust` (TaxInvoice 진입) |
| 3 cross-doc 통합 | STEP 91 | `buildAccountantExportPackage` (Invoice + Receipt + TaxInvoice + Settlement + Tax 통합 export) |
| **4 fiscal calculation 확장** | **STEP 90** ⭐ | **`deriveSettlementTax` (withholding 분리) + `deriveRecommendedFiscalDocuments` (분류)** |

본 STEP의 helper는 STEP 86 anchor pattern과 *동일 shape*: pure / no I/O / no store / no DOM / 입력 → 출력 view shape. anchor pattern의 *fiscal calculation 영역 확장 가능성* 입증.

---

## 📦 Phase 1 Fiscal Foundation Cycle Complete

```
STEP 86  Foundation       DocumentTrustMetadata 정착
   ↓
STEP 87  Entity Layer #1  Receipt + Print/PDF/Send
   ↓
STEP 88  Aggregate Layer  FiscalSummary derived view
   ↓
STEP 89  Entity Layer #2  TaxInvoice 도메인
   ↓
STEP 91  Cross-doc Export Accountant Export Package
   ↓
STEP 90  Derive Layer     ⭐ Settlement Tax + Document Classification
   ↓
[Phase 1 Fiscal Foundation Freeze]
   ↓
다음 Phase 진입 가능
```

---

## ⚠️ Risk Assessment — 🟢 Zero Risk

본 STEP은 *passive (read-only) infrastructure* — 호출자 부재 시 production runtime에 영향 0건.

회귀 영향 가능 영역: **0개**

회귀 영향 없는 영역 (검증 0줄 변경):
- persistence (validateV1 / SCHEMA_VERSION)
- Settlement entity (rule_12 의미론 그대로)
- Reporting / Logistics / Documents Hub / Customer / Payment / Settlement / Tax / FX
- AI Market Analysis / Image Cleanup / Backup-Restore / Permission audit / Audit Export
- System Health Audit / Audit Trend / Drilldown system
- Document Lifecycle 5 컴포넌트 + helper
- InvoiceDetailDrawer / ContractDetailDrawer / ReceiptDetailDrawer / TaxInvoiceDetailDrawer / SettlementDetailDrawer
- FiscalSummaryDrawer / AccountantExportDrawer / Approval Slot Placeholder
- Sidebar / DetailPanel / RoleSwitcher / role / rbac / 3-Column
- Artwork form / state-machine / transaction-helpers
- `/api/upload-image` / `/api/delete-image` / `/api/list-images`
- market-analysis-{generator,export} / mock-data
- `package.json` (외부 라이브러리 0개 추가)

---

## 🚀 다음 STEP 권장

🅐 **STEP DOC-2 (자동화 워크플로 documentation)** — 4번 연속 clean slate (UX-3 / STEP 89 / STEP 91 / STEP 90) + 6번 partial-state 사례에서 패턴 stable convention 입증, 자동화 가치 정착 시점.

🅑 **STEP 92 Phase 3 AI Market Insight activation** — UX-3에서 정착한 "AI Market Insight" zone에 실 데이터 hook (사용자가 STEP 90 후 권장한 순서).

🅒 **STEP 101 Approval Workflow Phase 6 진입** — Phase 1 foundation freeze 완료 후 Trust Layer Approval 본격 활성.

---

## 🎯 본 STEP의 영구 가치

1. **Phase 1 Fiscal foundation 6/6 완성** → foundation freeze 진입
2. **STEP 86 anchor pattern 4-tier validation** 완성 — fiscal calculation 영역까지 자연 확장 입증
3. **사용자 \"foundation closing phase\" 우선순위 정확 매칭** — small / stable / predictable / derived-layer completion / Route 0 kB delta
4. **AXVELA 핵심 원칙** — \"AXVELA는 세무 판단을 최종 확정하지 않는다\" 정착. 분류 + 체크리스트 + 검토 flag만 제공
5. **Future-ready infrastructure** — 향후 UI 통합 시 SettlementDetailDrawer / TransactionSummary / AccountantExport 모두 본 layer를 import만으로 자연 합류 가능
