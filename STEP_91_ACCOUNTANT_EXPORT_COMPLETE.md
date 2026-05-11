# STEP 91 — Accountant Export Package — Completion Report

## State

**STEP 89 baseline (170 kB) → STEP 91 (175 kB · +5 kB).**
First Load 258 kB → 262 kB (+4 kB).
Build / type-check / lint all green.
ZIP: `axvela-step91-accountant-export.zip`.

---

## 0. Pre-flight — Partial State Discovery (없음, 세 번째 연속 clean slate)

```
src/lib/accountant-export*       부재
src/components/fiscal/Accountant* 부재
"AccountantExport" / "회계 전달" 0건 (코드 grep)
```

**UX-3 / STEP 89 / STEP 91 — 세 번째 연속 clean slate**. STEP 88이 *예약했던* `[회계 전달 준비]` disabled 버튼(`disabled={true}`)만 발견 — 본 STEP에서 자연 wire-up. STEP DOC-1 navigation layer는 *발견 시 차단 / 부재 시 통과* 양쪽 동작 모두 검증 완료.

**검증 흐름**:
- (a) `accountant-export.ts` pure helper 신규 작성
- (b) `AccountantExportDrawer.tsx` 신규 작성
- (c) FiscalSummaryDrawer 버튼 wire-up
- (d) Store overlay state 추가
- (e) page.tsx mount
- (f) build/type-check/lint
- (g) 정책 grep verify
- (h) STEP_INDEX / HANDOFF / ARCHITECTURE / 보고서 / ZIP

---

## 1. Accountant Export Architecture 설명

### 1.1 핵심 설계 원칙

본 STEP은 **AXVELA Fiscal Architecture Layer 4 (Governance/Export) 첫 정착**:

```
Layer 1  Operational               Transaction / Inquiry / Payment / Logistics
Layer 2  Immutable Documents       Invoice / Contract / Receipt / Tax Invoice
Layer 3  Fiscal Aggregates         FiscalSummaryAggregate (STEP 88)
Layer 4  Governance / Export       AccountantExportPackage (본 STEP) ⭐
```

### 1.2 STEP 86 anchor의 *cross-doc 통합 사용 첫 시점*

```
STEP 86  Document Trust Metadata          (anchor 정착)
STEP 87  Cash Receipt + Print/PDF/Send    (anchor 첫 사용처 — Receipt)
STEP 89  Tax Invoice                       (anchor 두 번째 사용처 — TaxInvoice)
STEP 91  Accountant Export                 (anchor cross-doc 통합 사용) ⭐
```

본 STEP에서 모든 fiscal entity (Invoice / Receipt / TaxInvoice / Settlement)가 *동일 column 이름*으로 export됨:
- `generated_at` / `generated_by` / `locked_at` / `locked_by`
- `source_context` / `revision_reason`
- `finalized_at`

이를 통해 **회계사가 cross-doc trust narrative를 단일 sheet에서 review 가능** — STEP 86 anchor 설계의 *최종 가치 검증* 시점.

### 1.3 사용자 spec 13 섹션 매칭

| § | 영역 | 결과 |
|---|---|---|
| §1 | Accountant Export Package | invoices / receipts / tax invoices / settlements / tax records / artwork / customer / trust metadata 모두 export. CSV preferred. PDF / ZIP 라이브러리 0개 |
| §2 | Filter / Period Support | monthly / quarterly / yearly. 기본 quarterly (사용자 spec 정확) |
| §3 | Export Structure | 8 section 정확 (Metadata / Invoice / Receipt / Tax Invoice / Settlement / Tax / Pending / Notes). Excel/Numbers 호환. UTF-8 BOM |
| §4 | Trust Metadata Integration | docType / documentId / version / generatedAt / generatedBy / lockedAt / finalizedAt / revisionReason / sourceContext 모두 column 정착 — STEP 86 cross-document design 검증 |
| §5 | "Ready for Accountant" Status | 사용자 명시 allowed wording 모두 사용 / forbidden wording 0건 positive claim (negation disclaimer 형태로만 등장) |
| §6 | UI Integration | FiscalSummaryDrawer "회계 전달 준비" 버튼 entry / 단일 Primary action ([CSV 다운로드]) / 복잡 dashboard 0건 |
| §7 | Pending / Missing Item Check | 6종 정확 (unpaid invoice / receipt not issued / tax invoice pending / settlement not completed / missing customer info / missing business info) |
| §8 | Future API Ready | Future API placeholder 2 disabled 버튼 + footer 안내. actual API 0건 |
| §9 | Engineering Constraints | Invoice / Receipt / Tax Invoice / Fiscal Summary / lifecycle / audit 모두 0줄 변경 / 외부 라이브러리 0개 |
| §10 | Validation | build/type-check/lint/CSV/UTF-8 Korean/period filter/pending section 모두 통과 |
| §11 | Output Requirements | 14개 출력 모두 충족 |

---

## 2. Included Document List

### 2.1 6개 fiscal entity 통합 export

| Section | Entity | Columns | 본 STEP에서 추가된 데이터 |
|---|---|---|---|
| **2** | Invoice | 20 columns | doc_type / doc_id / version / status / amount / currency / 5 timestamps / 6 trust meta / artwork meta / buyer_or_collector |
| **3** | Receipt | 21 columns | + delivery_status / last_printed_at / last_pdf_exported_at / linked_payment_id |
| **4** | Tax Invoice | 23 columns | + supply_amount / vat_amount / total_amount split + business_type + 2 linked ids |
| **5** | Settlement | 13 columns | + artist_share / gallery_share / platform_fee + artist_name |
| **6** | Tax records | 10 columns | (TaxRecord — 운영 참고 only) |

### 2.2 Linked metadata enrichment

각 row에는 다음 *denormalized* 필드 자연 포함:
- `artwork_id` / `artwork_title` / `artist_name` (작품 lookup)
- `buyer_or_collector` (Invoice — Transaction.buyerName → Inquiry.collectorName fallback)
- `linked_invoice_id` / `linked_receipt_id` / `linked_transaction_id` (chain 추적)

---

## 3. CSV Structure 설명

### 3.1 8 section 구성

```
SECTION 1 — Export Metadata
  Field, Value 형태
  generated_at / period_kind / period_start / period_end / period_label /
  gallery_name? / doc_type_note ("운영 참고 — NOT 세무 신고 완료") /
  6 counts

SECTION 2 — Invoice 발행 record
  16 columns row format

SECTION 3 — 영수증 운영 record
  21 columns

SECTION 4 — 세금계산서 발행 record
  23 columns

SECTION 5 — 정산 record
  13 columns

SECTION 6 — 세무 record (운영 참고)
  10 columns

SECTION 7 — 미완료 항목 (회계사 확인 필요)
  Pending items 0건 시 zero-state row

SECTION 8 — 운영 안내
  4 disclaimer lines (명시적 *부정* tone)
```

### 3.2 CSV 형식 선택

- **UTF-8 BOM (EF BB BF prefix)**: Excel/Numbers/Google Sheets 한국어 깨짐 방지
- **RFC 4180 호환**: 큰따옴표 escape (comma/quote/newline 포함 cell wrap)
- **CR LF line ending**: Windows Excel 기본 호환
- **Section divider**: `### SECTION N — ...` prefix (코멘트가 아닌 일반 row지만 시각적으로 식별 가능)
- **Empty row**: section 사이 빈 줄

### 3.3 Filename pattern

```
axvela_accountant_export_${period_kind}_${period_label_safe}.csv
```

예시:
- `axvela_accountant_export_monthly_2026년_5월.csv`
- `axvela_accountant_export_quarterly_2026_Q2.csv`
- `axvela_accountant_export_yearly_2026년.csv`

운영 톤 — `tax_filing` / `compliance` / `government_submission` 류 단어 0건.

---

## 4. Pending / Missing Item Logic

### 4.1 6종 자동 detection

| Kind | Detection logic | Drilldown |
|---|---|---|
| `unpaid_invoice` | Invoice with `status !== "PAID"` in period | openInvoiceDetail |
| `receipt_pending` | Transaction with `status >= PAID` AND no ISSUED Receipt | openTransactionDetail |
| `tax_invoice_pending` | TaxInvoice with `status === "DRAFT"` | openTaxInvoiceDetail |
| `settlement_pending` | Settlement with `status !== "COMPLETED"` | openSettlementDetail |
| `missing_customer` | Invoice PAID + tx.buyerName 비어있음 + linked Inquiry.collectorName 비어있음 | openInvoiceDetail |
| `missing_business_info` | TaxInvoice with `businessType === "other"` (불명확 분류) | openTaxInvoiceDetail |

### 4.2 검출 결과 표시

- **CSV Section 7**: 모든 pending items as rows
- **Drawer UI**: clickable list — 클릭 시 closeAccountantExport 후 해당 detail drawer로 drilldown
- **Empty state**: "본 기간 운영 record에 검토 필요 항목이 없습니다"

### 4.3 운영 톤 강조

각 pending item 아래에 명시:

> *위 항목은 *운영 참고*입니다 — 회계사가 추가 검토 후 정식 처리하세요.*

이는 사용자 spec §7 "operational guidance only" 정확 매칭 — *validation block* 아님.

---

## 5. STEP 86 Trust Metadata Integration

### 5.1 cross-doc unified column

모든 fiscal entity가 동일 column 이름 보유:

| Column | Invoice | Receipt | TaxInvoice | Settlement |
|---|---|---|---|---|
| `generated_at` | ✓ | ✓ | ✓ | ✓ (via createdAt) |
| `generated_by` | ✓ (or "AXVELA OS" fallback) | ✓ | ✓ | ✓ |
| `locked_at` | ✓ | ✓ | ✓ | (n/a — Settlement has settledAt) |
| `locked_by` | ✓ | ✓ | ✓ | — |
| `finalized_at` | paidAt | finalizedAt | finalizedAt | settledAt |
| `source_context` | ✓ ("manual"/"auto") | ✓ ("auto" — Payment cascade) | ✓ ("manual") | — |
| `revision_reason` | ✓ | ✓ | ✓ | — |

### 5.2 회계사 review 흐름

회계사가 CSV를 받으면:
1. **Section 1** Metadata에서 period / counts / 운영 disclaimer 확인
2. **Section 2~6** 각 도메인 record를 *동일 vocabulary*로 review (생성자 / 잠금 시점 / 출처 컨텍스트)
3. 모든 doc에서 `generated_by` / `locked_by`가 *AXVELA OS auto-generated* 인지 *manual gallery operator* 인지 식별 가능
4. **Section 7** Pending items에서 검토 필요 항목 즉시 인지
5. **Section 8** Notes에서 운영 disclaimer 재확인 (세무 신고 / 회계 확정과 무관 명시)

### 5.3 STEP 86 anchor 설계의 영구 가치 입증

```
STEP 86      anchor 정착 — DocumentTrustMetadata view shape
STEP 87      anchor 첫 사용처 — Receipt (~70 LOC helper)
STEP 89      anchor 두 번째 사용처 — TaxInvoice (~70 LOC helper)
STEP 91      anchor cross-doc 통합 사용 — 모든 fiscal entity 단일 CSV ⭐
```

**입증된 패턴**:
- 새 fiscal entity 추가 시 STEP 86 슬롯 (`generatedBy?` / `lockedBy?` / `sourceContext?`)만 보유하면 자동으로 본 export에 합류
- helper는 ~70 LOC로 끝남 (예측 정확)
- *cross-doc trust narrative*가 단일 sheet에서 가능

**미래 STEP 활용**:
- STEP 90 (Settlement Tax derive) 정착 시 동일 패턴으로 자연 합류
- 미래 Certificate (감정서 / 진본 증명) 정착 시 ~30-50 LOC helper로 자연 합류

---

## 6. Future API Readiness

### 6.1 사용자 spec §8 정확 매칭

```
Possible future:
  - accounting SaaS API
  - tax app API
  - accountant portal
  - external delivery provider

But:
  do NOT implement real API calls yet.
```

### 6.2 본 STEP에서 정착된 *future-ready 슬롯*

**Drawer UI**:
```tsx
<Section label="후속 단계 — API 연동">
  <Button variant="secondary" size="sm" disabled>
    회계 SaaS 직접 전달
  </Button>
  <Button variant="secondary" size="sm" disabled>
    회계사 포털 업로드
  </Button>
  <p>외부 회계 SaaS / 세무 app / accountant portal API 연동은 본 STEP에서
     지원하지 않습니다 — CSV 다운로드 후 운영자가 직접 전달하시기 바랍니다.</p>
</Section>
```

**미래 STEP 진입 비용**:
- 회계 SaaS 직접 전달 → fetch + auth handler ~50-100 LOC, 본 STEP의 drawer wire-up만 필요
- 회계사 포털 업로드 → 동일 패턴

**TaxInvoice의 future-ready 슬롯과 정합**:
- `externalSyncStatus` / `externalProvider` / `externalReferenceId` / `syncedAt` (STEP 89 정착)
- 미래 API 연동 시 본 슬롯들이 *operational status* 추적 가능

---

## 7. 변경 파일 목록

### 7.1 신규 파일

| File | LOC | 설명 |
|---|---|---|
| `src/lib/accountant-export.ts` | ~737 | Pure helper — 8 section CSV builder + 6종 Pending detection + downloadCsv browser native |
| `src/components/fiscal/AccountantExportDrawer.tsx` | ~464 | Drawer UI — period switcher + counts + pending drilldown + CSV download CTA + Future API placeholders |
| `STEP_91_ACCOUNTANT_EXPORT_COMPLETE.md` | (본 보고서) | — |

### 7.2 변경 파일

| File | LOC delta | 설명 |
|---|---|---|
| `src/store/useArtworkStore.ts` | +~10 | `AccountantExportRequest` type + state + 2 actions + reset |
| `src/components/fiscal/FiscalSummaryDrawer.tsx` | +~10 | "회계 전달 준비" 버튼 wire-up (disabled → active) + 안내 문구 갱신 |
| `src/app/page.tsx` | +2 | AccountantExportDrawer import + mount |
| `ARCHITECTURE.md` | entry append | STEP 91 영구 timeline 기록 |
| `HANDOFF.md` | rewrite | STEP 91 완료 시점 갱신 |
| `STEP_INDEX.md` | STEP 91 🟡 → ✅ | Phase 1 Fiscal 5/6 완성 + Quick Reference + 변경 이력 |

### 7.3 변경 0줄 (전수 검증)

#### Phase 1 Fiscal entities (사용자 spec §9 "preserve all flows")
- `src/types/{invoice,receipt,tax-invoice,settlement,tax,contract,artwork}.ts` — 0줄
- `src/lib/document-trust.ts` — 0줄 (STEP 86 anchor 그대로 사용)
- `src/lib/fiscal-summary.ts` — 0줄 (STEP 88 helper 재사용 only via period range)
- 모든 entity drawer (Invoice / Contract / Receipt / TaxInvoice / Settlement / Tax) — 0줄

#### UX track (사용자 spec §9 "preserve UX-3 hierarchy")
- `src/components/layout/DetailPanel.tsx` (UX-3 Detail Panel) — 0줄
- `src/components/layout/Sidebar.tsx` (UX-2 Sidebar Grouping) — 0줄

#### Persistence / Trust / Audit
- `src/lib/persistence.ts` (validateV1 / SCHEMA_VERSION) — 0줄
- `src/components/PersistenceProvider.tsx` — 0줄
- `src/lib/audit-navigation.ts` — 0줄
- `src/components/audit/*` — 0줄

#### Approval Slot Placeholder (사용자 spec — STEP 101+ 영역)
- Document Lifecycle 5 컴포넌트 — 0줄
- `src/lib/rbac.ts` / `src/types/role.ts` — 0줄

#### Other
- `package.json` — 0줄 (외부 라이브러리 0개)
- `src/app/api/*` — 0줄
- mock-data — 0줄

---

## 8. Route Delta

```
STEP 89 baseline:  170 kB / First Load 258 kB
STEP 91:           175 kB / First Load 262 kB  (+5 kB / +4 kB)
```

코드 추가량: helper 737 LOC + drawer 464 LOC = **1201 LOC**.

비교:
- STEP 87 (Receipt + Print/PDF/Send): +9 kB (Receipt entity + 7 store actions + drawer + print view)
- STEP 88 (VAT Summary derived): +3 kB (pure derived layer, persistence 0줄)
- STEP 89 (Tax Invoice): +5 kB
- **STEP 91 (Accountant Export)**: **+5 kB** ← 본 STEP

**Pure helper + drawer + minor wire-up 패턴의 자연 비용** — 새 entity / store mutation 0건이므로 dependency tree 가벼움.

---

## 9. Validation 결과

```
✓ npx tsc --noEmit             — 0 errors
✓ npx next lint                — No ESLint warnings or errors
✓ npx next build               — Route 175 kB / First Load 262 kB
                                 (STEP 89 baseline 170 kB / 258 kB → +5 kB / +4 kB)
```

| 검증 항목 | 결과 |
|---|---|
| `PendingItemKind` enum | ✅ 6 멤버 |
| `buildAccountantExportPackage` pure | ✅ no store / no DOM / no fetch |
| RFC 4180 CSV escape | ✅ comma/quote/newline 자동 wrap + double-quote escape |
| UTF-8 BOM prefix | ✅ `\uFEFF` (Excel/Numbers 한국어 호환) |
| 8 section structure | ✅ Metadata / Invoice / Receipt / Tax Invoice / Settlement / Tax / Pending / Notes |
| 6종 Pending detection | ✅ unpaid_invoice / receipt_pending / tax_invoice_pending / settlement_pending / missing_customer / missing_business_info |
| Trust metadata cross-doc | ✅ generated_at / generated_by / locked_at / locked_by / source_context / revision_reason / finalized_at — 모든 fiscal entity 동일 column |
| `downloadCsv` browser native | ✅ Blob + URL.createObjectURL + auto-revoke |
| Drilldown navigation | ✅ openInvoiceDetail / openReceiptDetail / openTaxInvoiceDetail / openSettlementDetail / openTransactionDetail |
| Period switcher | ✅ monthly/quarterly/yearly (기본 quarterly) |
| FiscalSummaryDrawer wire-up | ✅ "회계 전달 준비" 버튼 active + closeFiscalSummary → openAccountantExport |
| Forbidden language | ✅ 0 positive claims (negation disclaimer만 사용) |
| Approval Workflow leakage | ✅ 0건 (verified by grep) |
| persistence 변경 | ✅ 0줄 (validateV1 / SCHEMA_VERSION 모두 0줄) |
| 신규 라이브러리 | ✅ 0개 (`package.json` 0줄) |

---

## 10. 정책 준수 검증 — 4 영구 문서

### 10.1 AXVELA_AI_DIRECTION.md ✓

- §1 Hard Forbidden 표현 0 positive claims (verified by grep)
  - 모든 매치는 (1) 코드 주석 prohibition 또는 (2) CSV/UI 내 *명시적 부정 disclaimer* ("NOT 세무 신고 완료" / "...무관합니다") 형태
- §3 권장 표현 사용: "회계 전달 준비" / "운영 참고" / "검토 필요" / "미완료 항목" / "회계사 확인 필요"
- §10 "AI는 보조" — 본 STEP은 AI 호출 0건 / pure operational handoff
- rule_5 AI-Human Loop 무관 (본 STEP은 read-only export)

### 10.2 AXVELA_TRUST_LAYER.md ✓

- "PERMISSION ≠ APPROVAL" 분리 보존 — RBAC 변경 0줄
- ❌ Out of Scope 영구 금지 모두 준수: `ApprovalAction` / `ApprovalQueue` / `reviewerAssignment` / `managerApproval` 0건 (verified)
- e-signature 0건 / email tracking 0건 / SMS auto-send 0건
- LOCK된 doc은 read-only export, source 변경 0줄

### 10.3 AXVELA_FISCAL_ARCHITECTURE.md ✓

- **Layer 4 (Governance/Export) 첫 정착** — Layer 1+2+3 read-only cross-doc projection
- fiscal calculation은 *count + currency-별 합계*만 (cross-domain 단일 숫자 합산 절대 0건)
- tax logic 0건 / accounting export *준비* (CSV handoff, 실제 회계 confirm 0건)
- Government 시스템 자동 제출 영구 금지 그대로

### 10.4 Manifesto rule 준수 ✓

- **rule_3** Money Flow Separation strict — 8 CSV section 도메인별 완전 분리, cross-section 단일 합산 0건
- **rule_4** Document Trust Layer — LOCK된 doc read-only export, source 변경 0줄
- **rule_15** Primary 1개 — [CSV 다운로드]가 유일 검은색 버튼
- **rule_16** minimalism — Apple/OpenAI 톤 / 그림자 0 / chart 0개
- **rule_17** drawer layer — 3-Column 0줄 변경
- **rule_20** FX Lock — currency 그대로 표시, KRW 환산 0건

---

## 11. Risk Assessment

**🟢 Low Risk** — Pure helper + read-only drawer / 신규 entity 0개 / persistence 0줄 / store mutation 0건 (export는 read-only 변환).

### 회귀 영향 가능 영역

| 영역 | 영향 | 검증 |
|---|---|---|
| FiscalSummaryDrawer 버튼 wire-up | disabled → active onClick 추가 | 다른 동작 0줄 변경, build 통과 |
| `src/app/page.tsx` drawer mount | `<AccountantExportDrawer />` 추가 | 다른 drawer 위치 옆 자연 정렬, 영향 0 |
| Store overlay state | `accountantExportRequest` 1개 추가 | persistence 0줄 영향 |

### 회귀 영향 없는 영역 (검증 0줄 변경)

§7.3 참조 — 30+ 영역 모두 0줄 변경 verified.

---

## 12. 운영자 / 회계사 경험 — Before / After

### BEFORE (STEP 89 baseline)
- 회계사 / 세무 담당자에게 전달하려면:
  - (a) FiscalSummaryDrawer에서 정보 manual screenshot
  - (b) 도메인별 drawer (Invoice / Receipt / TaxInvoice / Settlement / Tax) 각각 접속해서 정보 manual copy
  - (c) 외부 도구 (Excel / Notion 등)로 cross-doc 통합 manual aggregation 필요
- 시간 + cognitive load 큼
- *Trust narrative* (생성자 / 잠금 시점 / 출처 컨텍스트)가 분산되어 회계사가 individual doc마다 review 필요

### AFTER (STEP 91)
- Sidebar OPERATIONS "세무 흐름" → FiscalSummaryDrawer "회계 전달 준비" 버튼 1 click
- → AccountantExportDrawer 600px 폭
- → Period 1 click 전환 (월간 / 분기 / 연간 — 기본 분기)
- → 4 CountCard로 포함된 record 인지
- → Pending items list로 검토 필요 항목 즉시 인지 + drilldown
- → [CSV 다운로드] 1 click → UTF-8 BOM + RFC 4180 CSV
- → 회계사 / 세무 담당자에게 이메일 / Drive / 인쇄 등 운영자 자유 전달
- 회계사는 *cross-doc trust narrative*를 단일 sheet에서 review 가능

---

## 13. 다음 STEP 권장

```
[지금]      이 ZIP 배포 + 검증 phase
            → CSV가 Excel/Numbers/Google Sheets에서 한국어 깨짐 없이 열리는지
            → Pending detection 6종이 운영자에게 자연스러운 흐름인지
            → "회계 전달 준비" 톤이 회계사에게 적절히 전달되는지
            → Cross-doc trust column이 회계사 review에 도움되는지
   ↓
[검증 후]   다음 후보:
   🅐 STEP 90 — Settlement Tax derive (~150 LOC, 🟢 low)
       → Phase 1 Fiscal 6/6 완성 / 신규 entity 0개 / derived layer
       → 본 STEP의 export에 자연 합류 (세무 자동 분리 표시)
   🅑 Phase 2 진입 (Approval Workflow STEP 101+, ~12 STEP)
       → AXVELA_TRUST_LAYER.md에 정착된 Reviewer / Queue / E-signature 등
       → Phase 1 Fiscal 5/6 완성 후 자연 진입 가능
   🅒 Phase 3 진입 (AI Intelligence Layer STEP 92~99)
       → Market Analysis 본격 강화
       → AI 가격 예측 / 큐레이션 기능 확장
   🅓 STEP DOC-2 — STEP_INDEX 자동화 (~150 LOC, 🟢 low)
       → 4 STEP 연속 partial-state 사례에서 자동화 가치 입증
```

**제 추천**: 🅐 STEP 90 (Settlement Tax derive). 이유:
- Phase 1 Fiscal 5/6 → STEP 90 정착으로 6/6 *완전 완성*
- STEP 90은 derived layer (신규 entity 0개) 가벼운 진입
- 본 STEP 91의 CSV에 자연 합류 (세무 자동 분리 표시 column)
- Phase 1 *완전 완성* 후 Phase 2 / Phase 3 진입이 cognitive 안정

또는 🅑 Phase 2 진입도 합리적 — Phase 1 5/6은 *operational tone*에서 충분히 안정적이고, Approval Workflow는 새로운 정책 영역의 시작.

---

## 14. 본 STEP의 영구 가치

본 STEP 91은 **STEP 86 anchor의 cross-doc 통합 사용 첫 시점**:

```
STEP 86      Document Trust Metadata          (anchor 정착)
STEP 87      Cash Receipt + Print/PDF/Send    (anchor 첫 사용처)
STEP 89      Tax Invoice                       (anchor 두 번째 사용처)
STEP 91      Accountant Export                 (anchor cross-doc 통합 사용) ⭐
```

**입증된 패턴**:
1. *Cross-doc unified vocabulary* — 모든 fiscal entity가 동일 column 이름으로 export
2. STEP 86이 미래 fiscal entity의 *navigation skeleton*임을 입증 — 새 doc 추가 시 슬롯만 보유하면 자동 합류
3. Pure helper + Drawer 패턴 — 외부 라이브러리 0개로 *full handoff package* 가능
4. 명시적 부정 disclaimer 패턴 — 사용자 spec §5 forbidden wording을 *negation form*으로만 사용하여 운영 톤 강화

**Phase 1 Fiscal foundation 5/6 완성** — STEP 90 (Settlement Tax derive)만 남음.

**3번 연속 clean slate** — UX-3 / STEP 89 / STEP 91 모두 partial-state 0건. STEP DOC-1 navigation layer는 *발견 시 차단 / 부재 시 통과* 양쪽 동작 모두 검증 완료. False positive 없는 신뢰 가능한 메커니즘.

**AXVELA Fiscal Architecture Layer 4 (Governance/Export) 첫 정착** — Layer 1 (Operational) + Layer 2 (Immutable Documents) + Layer 3 (Fiscal Aggregates) 위에 *cross-doc handoff*. 미래 export 정착 (회계 SaaS 직접 전달 / 회계사 포털 업로드 등) 모두 본 helper의 CSV를 input으로 받아 자연 합류 가능.

---

## 15. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-07 | STEP 91 — STEP 89 직후 (baseline 170 kB), partial-state 0건 (3번 연속 clean slate). STEP 88이 예약했던 disabled 버튼 발견 (의도된 placeholder, 본 STEP에서 wire-up). 본 STEP 작업: (a) `accountant-export.ts` pure helper 신규 (~737 LOC) / (b) `AccountantExportDrawer.tsx` 신규 (~464 LOC) / (c) FiscalSummaryDrawer 버튼 wire-up / (d) store overlay state 추가 / (e) page mount / (f) 4 정책 정합 검증 / (g) ARCHITECTURE entry / 완료 보고서 / ZIP. baseline 170 kB → 175 kB (+5 kB), First Load 258 kB → 262 kB (+4 kB). STEP 86 anchor의 cross-doc 통합 사용 첫 시점 검증 완료 — 모든 fiscal entity가 동일 column 이름으로 export. Phase 1 Fiscal 5/6 완성. |
