# STEP 129 — Phase 1 Entry Briefing (Invoice/Contract Write Flow)

**작성 시점**: 2026-05-12
**Baseline**: `ece2666` (STEP 128 Phase 1 사용자 결정 + 정정 완료)
**Branch**: `claude/step127-architecture-review` (STEP 127~129 연속 commit 흐름)
**작업 성격**: 짧은 entry briefing (Phase 1) — 코드 0줄. STEP 128 §3 에서 이미 spec 대부분 정착되어 *분석 doc 짧게 작성 가능*.

---

## §0 Executive Summary

**무엇을 만들 것인가** (한 문장):
사용자가 *작품의 정식 매매 계약서 + 인보이스를 시스템 안에서 직접 작성·미리보기·인쇄·LOCK* 할 수 있는 흐름 정착.

**왜 STEP 129 가 먼저인가**:
- STEP 127 의 `invoiceKind` foundation 위에 *실제 사용처* 가 처음 등장 — 추상 spec → 동작 UI 의 첫 검증 시점.
- 사용자가 *실제 화면을 보고* STEP 130 (다국어) / STEP 131 (Passport UI) 의 우선순위를 직접 결정할 수 있게 됨 (초보자 관점에서 가장 중요한 조기 검증 포인트).
- Contract / Invoice 도메인은 *모든 store actions 이미 정착* (STEP 128 §1.4 검증) → **신설은 UI 만 필요** (~600~700 LOC, single STEP scope 정합).

**진행 흐름**:
```
Phase 1 (본 briefing) → 사용자 검토
                          ↓
Phase 2 (구현, ~600~700 LOC) → tsc/lint/build 통과
                                  ↓
                          사용자 브라우저에서 직접 사용
                                  ↓
                  다음 STEP 결정 (130 / 131 / pause)
```

---

## §1 Phase 1.0 사실관계 검증

| 항목 | 검증 결과 |
|------|----------|
| Contract store actions 5 종 | ✅ 정착 (createContract / submitContractForReview / approveContract / lockContract / createContractVersion — STEP 128 §1.4 검증 그대로) |
| `utils.ts` `generateContractClauses` (AI 초안 generator) | ✅ 정착 ([src/lib/utils.ts:323](src/lib/utils.ts:323)) |
| InvoiceDetailDrawer | ✅ 정착 753 LOC ([src/components/invoice/InvoiceDetailDrawer.tsx](src/components/invoice/InvoiceDetailDrawer.tsx)) — Preview Modal 추가 위치 식별 가능 |
| ContractDetailDrawer | ✅ 정착 586 LOC ([src/components/contract/ContractDetailDrawer.tsx](src/components/contract/ContractDetailDrawer.tsx)) |
| PaymentRegisterDrawer | ✅ 정착 298 LOC ([src/components/payment/PaymentRegisterDrawer.tsx](src/components/payment/PaymentRegisterDrawer.tsx)) — PRE invoice disabled UI 추가 위치 |
| ReceiptPrintView (STEP 87, 패턴 reference) | ✅ 226 LOC ([src/components/receipt/ReceiptPrintView.tsx](src/components/receipt/ReceiptPrintView.tsx)) |
| TaxInvoicePrintView (STEP 89, 패턴 reference) | ✅ 247 LOC ([src/components/tax-invoice/TaxInvoicePrintView.tsx](src/components/tax-invoice/TaxInvoicePrintView.tsx)) |
| `fiscal-summary.ts` invoice 집계 진입 지점 | ✅ `input.invoices.filter` line 304 ([src/lib/fiscal-summary.ts:304](src/lib/fiscal-summary.ts:304)) — PRE filter 직접 추가 위치 |
| `reporting-aggregates.ts` invoice 집계 진입 지점 | ✅ line 237~260 (invoiceStatusBreakdown / currency bucket / totalSalesKRW) |
| `ContractDraftDrawer.tsx` 부재 | ❌ git grep 0건 — **본 STEP 의 유일 신설 UI** |
| STEP 127 정착물 (`invoiceKind` / `getInvoiceKind`) | ✅ 보존 |

**Phase 1.0 결론**: 사용자 spec 의 가정과 worktree 실재 정합. **gap 0건 → Phase 2 구현 진입 안전**. STEP 128 §1.4 의 5 store actions 정착 검증이 본 STEP 의 신설 LOC 추정 (~600~700) 의 정확성 보장.

---

## §2 STEP 129 Phase 2 Scope (구체 작업 목록)

### §2.1 신설 파일 (3 개)

| # | 파일 | 추정 LOC | 패턴 reference |
|---|------|---------|---------------|
| 1 | `src/components/contract/ContractDraftDrawer.tsx` | ~250 | 신규 — 4-stage transition UI (DRAFT/REVIEW/APPROVED/LOCKED), 기존 5 store actions wire |
| 2 | `src/components/invoice/InvoicePrintView.tsx` | ~230 | ReceiptPrintView (STEP 87) 패턴 답습 — A4, `@media print`, `window.print()` 호환 |
| 3 | `src/components/contract/ContractPrintView.tsx` | ~230 | TaxInvoicePrintView (STEP 89) 패턴 답습 |

### §2.2 수정 파일 (6~7 개, 모두 *additive only* / 기존 로직 0줄 변경)

| # | 파일 | 변경 내용 |
|---|------|----------|
| 4 | `src/components/invoice/InvoiceDetailDrawer.tsx` | (a) `getInvoiceKind` import + send button label 분기 (PRE → "buyer 안내 발송", FINAL → "결제용 인보이스 발송") (b) `InvoicePrintView` 호출 mount (c) Preview Modal trigger |
| 5 | `src/components/contract/ContractDetailDrawer.tsx` | `ContractPrintView` 호출 mount + Preview Modal trigger |
| 6 | `src/components/payment/PaymentRegisterDrawer.tsx` | PRE invoice 시 disabled + `disabledHint: "PRE 인보이스는 결제 대상 아닙니다 — FINAL 인보이스 생성 후 결제 등록"` |
| 7 | `src/lib/fiscal-summary.ts` | line 304 의 `invInRange` 필터에 `getInvoiceKind(i) === "final"` 조건 추가 (PRE invoice fiscal 집계 제외) |
| 8 | `src/lib/reporting-aggregates.ts` | line 237 진입 직전에 `if (getInvoiceKind(inv) !== "final") continue;` 추가 |
| 9 | `src/lib/drilldown-resolver.ts` | `documents_invoices` resolver 의 PRE filter |
| 10 | `src/lib/utils.ts` | `formatAxidForDocument(axid, locale?)` helper 추가 (디자인 자산 표기 변환 — STEP 127 Phase 1 §2.7 옵션 Z) |

### §2.3 신규 scenarios (2 개)

| # | 파일 | scenarios |
|---|------|-----------|
| 11 | `src/lib/__tests__/invoice-kind-filter.scenarios.ts` | (1) FINAL invoice 만 fiscal 집계 / (2) PRE invoice fiscal 0 / (3) PRE invoice reporting 0 |
| 12 | `src/lib/__tests__/format-axid-for-document.scenarios.ts` | (1) 기존 `AXV-YYYY-NNNN` 변환 / (2) 미래 `displayLabel?` 우선 |

### §2.4 LOC + Risk 추정

- 신설 ~710 LOC + 수정 ~80 LOC + scenarios ~150 LOC = **~940 LOC**
- Risk **🟢 Medium-Low** — 신설 UI 가 기존 store actions 위에 wire 만, additive-only filter

---

## §3 구현 순서 권장 (안전한 dependency 순서)

```
1. utils.ts formatAxidForDocument helper           (depends: 0)
2. fiscal-summary.ts PRE filter                    (depends: STEP 127 getInvoiceKind)
3. reporting-aggregates.ts PRE filter              (depends: STEP 127 getInvoiceKind)
4. drilldown-resolver.ts PRE filter                (depends: STEP 127 getInvoiceKind)
5. PaymentRegisterDrawer PRE disabled UI           (depends: STEP 127 getInvoiceKind)
6. InvoicePrintView 신설                            (depends: 1)
7. ContractPrintView 신설                           (depends: 1)
8. InvoiceDetailDrawer 의 send button label + Print (depends: 6 + STEP 127)
9. ContractDetailDrawer 의 Print mount              (depends: 7)
10. ContractDraftDrawer 신설 — 4-stage UI           (depends: 0, 가장 큰 단일 신설)
11. scenarios × 2                                   (depends: 2, 3, 1)
```

**중간 점검 가능 지점**: 1~5 끝났을 때 (fiscal/reporting/payment 측 PRE filter 정착) — `npx tsc --noEmit` + 기존 scenarios 회귀 0건이면 OK.

---

## §4 보존 약속 9 항목 영향도 표

| # | 보존 약속 | STEP 129 영향 |
|---|----------|-------------|
| 1 | Phase 1 Fiscal frozen | ☑ STEP 128 §1.3 검증: 정책 문서에 frozen 등록 0건. `fiscal-summary.ts` / `reporting-aggregates.ts` 는 frozen 외부 → 직접 수정 허용 (STEP 128 §9 항목 6 정정 결정 그대로) |
| 2 | rule_5 AI-Human Loop keyword | ☑ ContractDraftDrawer 의 4-stage UI 가 "AI 초안 → 인간 수정 → 승인 → LOCK" keyword 정합 |
| 3 | Persistence v1 boundary | ☑ schema 변경 0줄 (SCHEMA_VERSION / validateV1 0) |
| 4 | rule_14 3-column layout | ☑ Drawer / Modal layer (rule_17) 안만 변경, 3-column 0줄 |
| 5 | STEP 117 Optional Slice 패턴 | ☑ 본 STEP 은 type slot 추가 0 (STEP 127 의 `invoiceKind` 만 사용) |
| 6 | STEP 118 ArtworkFormDrawer 4-tab over-scope | ☑ ArtworkFormDrawer 0줄 |
| 7 | STEP 124/125 single-drawer policy | ☑ Preview Modal = drawer 안 nested layer, drawer 자체 close 없음 |
| 8 | Image-First hierarchy | ☑ ArtworkFormDrawer 0줄 |
| 9 | Two-Layer Curation Model | ☑ Contract content (formal entity body) ↔ Artwork inline curation fields 별도 layer 그대로 |

**9/9 ☑ 무손상** — 본 STEP 도입으로 보존 약속 위반 0건.

---

## §5 Phase 2 검증 게이트

Phase 2 commit 직전 다음 cumulative gate 모두 통과 필수:

| Gate | 명령 | 기준 |
|------|------|------|
| TypeScript | `npx tsc --noEmit` | 0 errors |
| Lint | `npx next lint` | clean |
| Build | `npx next build` | ✓ Compiled successfully |
| Bundle | (build 출력) | Route +5~8 kB / First Load +5~8 kB **이내** 권장 (STEP 128 §3 §7.1 estimate) |
| Scenarios (기존) | `npx tsx -e "..." invoice-kind.scenarios` | 5/5 PASS (STEP 127) |
| Scenarios (신규) | `npx tsx -e "..." invoice-kind-filter.scenarios + format-axid-for-document.scenarios` | 신규 ~5~7 PASS |
| 누적 scenarios | 83 → ~88~90 | 회귀 0건 |
| **사용자 수동 검증** | 브라우저에서 직접 사용 | (사용자 spec — 초보자 시점에서 가장 중요) |

### §5.1 사용자 수동 검증 체크리스트 (Phase 2 후)

- [ ] 작품 선택 → Contract 새로 만들기 → AI 초안 자동 생성 확인
- [ ] DRAFT 상태에서 본문 편집 가능 확인
- [ ] REVIEW 제출 → APPROVED 승인 → LOCK 흐름 정상
- [ ] LOCK 된 Contract 미리보기 (Preview Modal) 표시 확인
- [ ] Print 버튼 → 브라우저 인쇄 dialog 진입 + ContractPrintView 만 표시
- [ ] PRE invoice 생성 → send button 라벨 "buyer 안내 발송" 확인
- [ ] PRE invoice 의 결제 등록 시도 → 비활성 + disabledHint 표시
- [ ] FINAL invoice → 정상 결제 등록 + settlement 자동 생성
- [ ] FiscalSummary / Reporting 에서 PRE invoice 미포함 확인 (PRE invoice 만들어도 통계 영향 0)

---

## §6 사용자 결정 대기 항목

본 briefing 의 *유일한 사용자 결정 사항*:

- [ ] §2 scope 그대로 진행 (single STEP, ~940 LOC, 12 files) **승인**
   - 또는 splitting 원하시면:
     - STEP 129a: PRE filter + payment guard (가장 작음, ~150 LOC)
     - STEP 129b: ContractDraftDrawer (~250 LOC)
     - STEP 129c: PrintView × 2 + DetailDrawer 수정 (~540 LOC)
   - **권장**: 단일 STEP — 사용자가 *한 번에 작품-인보이스-계약서 흐름 전체 사용해보기* 가 검증 가치 큼.
- [ ] §3 구현 순서 그대로 진행 승인 (안전한 dependency 순서)
- [ ] §5.1 사용자 수동 검증 체크리스트 — Phase 2 후 직접 9 항목 검증 수행 동의

---

## §7 다음 단계

**사용자 승인 후 즉시 Phase 2 implementation 진입**:
1. §3 구현 순서 그대로 11 단계 진행
2. 각 단계 끝에 `npx tsc --noEmit` 가벼운 sanity check
3. 전체 끝나면 build + scenarios runner + commit
4. 사용자 `npm run dev` → 브라우저에서 §5.1 체크리스트 직접 검증
5. 검증 OK 시 STEP 129 완전 종결 → STEP 130 / 131 / pause 중 다음 선택

**예상 turn 수**: Phase 2 implementation = 단일 turn (~940 LOC, 12 files) 또는 2 turn (단계 1~5 + 단계 6~11 분리, 더 안전한 옵션).

**Phase 1 본 briefing**: doc-only, code 0줄, ZIP 재생성 0건 (recursive bloat 회피).

---

## §8 revert / rollback

| 의도 | 명령 |
|------|------|
| 본 entry briefing 자체 폐기 | doc 갱신 또는 `git revert <commit>` — 코드 0줄 영향 |
| STEP 129 Phase 2 후 회귀 발견 시 | Phase 2 commit revert — Phase 1 briefing 보존 |
| STEP 127 baseline 으로 완전 복귀 | `git revert <129 Phase 2> <128 정정> <128> <127 zip>` 또는 `git reset --hard 75e300b` |
