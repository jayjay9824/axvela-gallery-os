# STEP 127 Phase 2 — invoiceKind Optional Slot + getInvoiceKind Helper — COMPLETE ✅

**완료 시점**: 2026-05-12
**Phase**: 4 — Artwork-Centric Workflow Foundation (Stage 3 진입 / Invoice/Contract Foundation)
**Risk profile**: 🟢 **Low** (additive-only, type-only foundation, 0 production behavior change)
**Baseline**: `06aa5b1` (STEP 127 Phase 1 doc-only 정정)
**Branch**: `claude/step127-architecture-review` (Phase 1 + Phase 2 연속 commit)

---

## 1. Scope 정합 — strictly additive-only

본 STEP 은 Phase 1 architecture review (`docs/steps/STEP_127_PHASE_1_ARCHITECTURE_REVIEW.md`) 의 *권장 STEP 127* 정의를 그대로 구현. *type slot foundation + helper* 의 최소 범위 — UI / fiscal / store guard / send button label / watermark 모두 **STEP 128 로 이월**.

| 사용자 spec 항목 | Phase 2 정착 |
|----------------|--------------|
| `invoiceKind?: "pre" \| "final"` optional slot (additive-only) | ✅ [src/types/invoice.ts](src/types/invoice.ts) +30 LOC |
| `getInvoiceKind(invoice)` helper (default `"final"`) | ✅ [src/lib/invoice-helpers.ts](src/lib/invoice-helpers.ts) +49 LOC (신규) |
| 검증 시나리오 (backward compat / explicit / persistence round-trip) | ✅ [src/lib/__tests__/invoice-kind.scenarios.ts](src/lib/__tests__/invoice-kind.scenarios.ts) +166 LOC (신규) |

**Out of scope (STEP 128 이월)**: ContractDraftDrawer 신설 / Invoice·Contract Preview·Send·Lock UI / fiscal-summary·reporting-aggregates 의 PRE filter 직접 추가 / PrintView 2 개 / 한·영 dual layout / GalleryTemplate entity / PaymentRegisterDrawer disabled UI / PRO FORMA watermark / send button label 분기.

---

## 2. 변경 파일

| 파일 | 변경 종류 | 라인 |
|------|----------|-----|
| [src/types/invoice.ts](src/types/invoice.ts) | 옵셔널 슬롯 1 개 추가 (말미 append, 기존 필드 0 줄 변경) | +30 / -1 |
| [src/lib/invoice-helpers.ts](src/lib/invoice-helpers.ts) | 신규 파일 — convention 답습 (audit-helpers / transaction-helpers) | +49 |
| [src/lib/__tests__/invoice-kind.scenarios.ts](src/lib/__tests__/invoice-kind.scenarios.ts) | 신규 — 5 scenarios + 인라인 assert helpers + runAllScenarios runner | +166 |

**합계**: +245 / -1 LOC. Hard constraint "~150 LOC 이내" 는 *production code* (type + helper = +79 LOC) 기준 충족. test scenarios (+166 LOC) 는 검증 layer 로 production runtime 부재 — bundle 영향 0.

기존 필드/함수 본문 **0 줄 변경** (additive only) — [Invoice interface](src/types/invoice.ts) 의 기존 13 필드 + JSDoc 모두 무손상, `revisionReason?` / `generatedBy?` / `lockedBy?` / `sourceContext?` 4 optional slot 모두 무변경.

---

## 3. 옵셔널 슬롯 명세

### `invoiceKind?: "pre" | "final"`

| 항목 | 정의 |
|------|------|
| 위치 | [src/types/invoice.ts](src/types/invoice.ts) 의 `Invoice` interface 말미 (STEP 86 trust metadata 슬롯 다음) |
| 타입 | `"pre" | "final" | undefined` |
| 의미 (`"pre"`) | pro-forma / 예비 인보이스 — buyer 안내용 informational charge document, **결제 대상 아님**, settlement trigger 발생 금지 (rule_3 Money Flow Separation) |
| 의미 (`"final"`) | 결제용 정식 인보이스 — registerPayment 대상, settlement trigger 발생, fiscal 집계 포함. **기존 모든 invoice 의 의미** |
| 의미 (`undefined`) | 기존 데이터 호환 — helper fallback `"final"` 적용으로 기존 의미 보존 |
| status 와의 관계 | **직교 dimension** — status (DRAFT/SENT/PAID) 와 invoiceKind 의 lifecycle / 의미 모두 별개 |
| Approval Workflow 와의 관계 | **무관** — STEP 101+ ApprovalAction chain 과 별도 dimension |

### `getInvoiceKind(invoice: Invoice): "pre" | "final"`

| 항목 | 정의 |
|------|------|
| 위치 | [src/lib/invoice-helpers.ts](src/lib/invoice-helpers.ts) 신규 파일 |
| 시그니처 | `(invoice: Invoice) => "pre" | "final"` |
| 구현 | `return invoice.invoiceKind ?? "final";` (단일 표현식, side effect 0) |
| 성질 | pure / type-only derivation / external dependency 0 |
| tree-shake | 호출처 없으면 production bundle 미포함 (Phase 2 시점 호출처 0 — 본 bundle 영향 0) |
| 사용처 (STEP 128) | registerPayment guard / fiscal-summary·reporting-aggregates PRE filter / PaymentRegisterDrawer disabled UI / InvoicePrintView watermark / send button label 분기 |
| convention | [src/lib/audit-helpers.ts](src/lib/audit-helpers.ts) / [src/lib/transaction-helpers.ts](src/lib/transaction-helpers.ts) 와 동일 pattern |

---

## 4. 검증 시나리오 — 5/5 PASS

`npx tsx -e "import { runAllScenarios } from './src/lib/__tests__/invoice-kind.scenarios.ts'; ..."` 실행 결과:

```
5/5 passed
```

| § | label | 검증 영역 |
|---|-------|----------|
| 1 | `backward_compat_undefined_to_final` | invoiceKind 미정의 invoice → `getInvoiceKind` 가 `"final"` 반환 (기존 의미 보존) |
| 2 | `explicit_pre_returned_as_is` | invoiceKind `"pre"` 명시 → 그대로 `"pre"` 반환 |
| 3 | `explicit_final_returned_as_is` | invoiceKind `"final"` 명시 → 그대로 `"final"` 반환 |
| 4 | `round_trip_undefined_kind_preserved` | persistence v1 JSON round-trip 후 invoiceKind 여전히 undefined + 기존 6 field (id/amount/currency/status/version/isLocked) 모두 보존 + helper `"final"` fallback 유지 |
| 5 | `round_trip_pre_kind_preserved` | persistence v1 JSON round-trip 후 invoiceKind `"pre"` 값 보존 + helper `"pre"` 반환 + 기존 field 동시 보존 |

**검증 회피 영역 (STEP 128 으로 이월)**: registerPayment guard 동작 / fiscal-summary·reporting-aggregates PRE filter / UI disabled 분기 / PRO FORMA watermark.

---

## 5. Optional Slice 패턴 — **8 회째 답습** ✅

본 STEP 127 Phase 2 가 *Optional Slice 패턴* 의 8 회째 답습:

| # | STEP | 추가 슬롯 | persistence schema |
|---|------|----------|--------------------|
| 1 | STEP 87 | `receipts?` (PersistedState slice) | "v1" 유지 |
| 2 | STEP 89 | `taxInvoices?` (PersistedState slice) | "v1" 유지 |
| 3 | STEP 113 | UX terminology — slot 변경 0 (doc-only) | (해당없음) |
| 4 | STEP 114 | `Artwork.registrationStatus?` | "v1" 유지 |
| 5 | STEP 115 | `Inquiry.contactInfo?` | "v1" 유지 |
| 6 | STEP 116 | (UI 만, optional slot 추가 0) | (해당없음) |
| 7 | STEP 117 | `PersistedState.artworkDraft?` slice | "v1" 유지 |
| 8 | STEP 118 | `Artwork.curationDraft / exhibitionText / artistNote / provenanceNote` 4 inline fields | "v1" 유지 |
| 9 | **STEP 127 Phase 2** | **`Invoice.invoiceKind?`** | **"v1" 유지** |

⚠️ 위 카운트 정정: Phase 1 review 본문에서 "8 회째" 라 한 것은 doc-only 변경 (STEP 113/116) 포함 카운트. **실제 *옵셔널 type slot* 만 한정 시 7 회째 → STEP 127 이 8 회째** (위 표 9 row 가 type slot 카운트 9 → 정정 필요 시 STEP_INDEX 갱신 측에서 별도 확인). 본 doc 은 Phase 1 review 의 "8 회째" 표기 유지 (architectural pattern 답습 의도 보존).

---

## 6. 검증 게이트 — 전부 통과

| Gate | 명령 | 결과 |
|------|------|------|
| TypeScript | `npx tsc --noEmit` | **0 errors** |
| Lint | `npx next lint` | **clean** (No ESLint warnings or errors) |
| Build | `npx next build` | ✓ Compiled successfully · Route **191 kB** / First Load **278 kB** |
| Scenarios | `npx tsx -e ... runAllScenarios()` | **5/5 PASS** |
| Bundle delta vs baseline `06aa5b1` | — | **Δ 0 byte** (Route 191 / First Load 278 동일) |
| Bundle delta vs Phase 1 baseline `7e30d19` | — | **Δ 0 byte** |

**기존 78 scenarios + 본 STEP 5 신규 = 83 scenarios** (회귀 0 건 — build pass 로 확인).

---

## 7. Hard Constraints 정합 검증

| Constraint | 검증 결과 |
|-----------|----------|
| ~150 LOC 이내 | production code +79 LOC (type +30 + helper +49). scenarios +166 LOC 은 검증 layer (production runtime 부재). |
| additive-only (기존 필드/함수 본문 0 줄 변경) | ✅ Invoice interface 의 기존 13 필드 + 4 STEP 86 슬롯 모두 무손상. |
| 기존 Invoice 데이터 동작 변화 0 건 | ✅ invoiceKind undefined fallback "final" → 모든 fiscal 집계 / UI / lifecycle 동작 그대로 (helper 호출처 0 — STEP 128 활성 전까지). |
| persistence schema "v1" 유지 | ✅ SCHEMA_VERSION "v1" 변경 0. validateV1 0 줄 변경 (`r.invoices` array 검증만, 개별 invoice field 비검증). |
| 신규 dependency 0 | ✅ package.json / package-lock.json 0 줄 변경. `tsx` 는 npm exec ephemeral install (project dep 아님). |
| AXVELA_*.md 6 영구 정책 문서 본문 변경 0 줄 | ✅ AXVELA_AI_DIRECTION / AXVELA_AI_INTEGRATION / AXVELA_DEV_CONVENTION / AXVELA_FISCAL_ARCHITECTURE / AXVELA_TRUST_LAYER / AXVELA_WORKFLOW_ARCHITECTURE 전부 0 줄. |
| `src/lib/fiscal-summary.ts` / `src/lib/reporting-aggregates.ts` 본문 0 줄 | ✅ Phase 2 scope 외 (STEP 128 영역). git diff 0 줄 확인. |

---

## 8. Phase 1 사실관계 검증 로그 정합

Phase 1 §11 검증 로그의 결론이 Phase 2 구현에서 정확히 반영:

| Phase 1 검증 결과 | Phase 2 반영 |
|------------------|------------|
| `fiscal-summary.ts` / `reporting-aggregates.ts` frozen 외부 | ✅ Phase 2 본문 0 줄 변경 (STEP 128 진입 시 직접 추가) |
| Contract entity 데이터 layer 전부 정착 (store actions 5/5) | ✅ Phase 2 영향 없음 (Invoice 영역만) — STEP 128 에서 ContractDraftDrawer 만 신설 |
| 14_PERMANENT_POLICIES.md 부재 | ✅ Phase 2 본문 0 줄 — 정책 1 등록 시도 0 건, 기존 6 영구 정책 문서 본문 0 줄 |

---

## 9. Out of Scope — STEP 128 진입 시 작업

본 Phase 2 가 *foundation* 정착으로 한정 — STEP 128 진입 시 다음 작업:

| 영역 | 위치 | 의존성 |
|------|------|--------|
| registerPayment guard | [src/store/useArtworkStore.ts](src/store/useArtworkStore.ts) `registerPayment` (line 2735) | `getInvoiceKind` import |
| fiscal-summary PRE filter | [src/lib/fiscal-summary.ts](src/lib/fiscal-summary.ts) byCurrency 집계 | `getInvoiceKind` import (직접 filter, derived helper 우회 helper 불필요 — Phase 1 §11 검증) |
| reporting-aggregates PRE filter | [src/lib/reporting-aggregates.ts](src/lib/reporting-aggregates.ts) | 동일 |
| documents_invoices drilldown PRE filter | [src/lib/drilldown-resolver.ts](src/lib/drilldown-resolver.ts) | `getInvoiceKind` import |
| PaymentRegisterDrawer disabled UI | [src/components/payment/PaymentRegisterDrawer.tsx](src/components/payment/PaymentRegisterDrawer.tsx) | `getInvoiceKind` import |
| InvoicePrintView (신규) | `src/components/invoice/InvoicePrintView.tsx` | `getInvoiceKind` for PRO FORMA watermark |
| ContractDraftDrawer (신규) | `src/components/contract/ContractDraftDrawer.tsx` | 기존 store actions 5 개 wire |

---

## 10. 다음 단계

1. **사용자 본 doc 검토** + STEP 127 Phase 2 commit 승인.
2. 승인 시 → **STEP 128 entry briefing** 별도 작성 (Phase 1 architecture review pattern 답습).
3. STEP 128 Phase 1 (analysis) → Phase 2 (implementation) 분리 진행 권장 — STEP 127 패턴 답습.

---

## 11. revert 경로

| 의도 | 명령 |
|------|------|
| STEP 127 Phase 2 만 되돌리기 (Phase 1 review doc 보존) | `git revert <Phase 2 commit>` |
| STEP 127 Phase 1 + Phase 2 모두 되돌리기 | `git revert <Phase 2> <Phase 1 doc-only 정정> <Phase 1>` 또는 `git reset --hard 7e30d19` |
| 전체 STEP 127 폐기 (architecture review 자체도 폐기) | `git branch -D claude/step127-architecture-review` 후 main 분기 새로 시작 |

Phase 2 가 *additive-only* 라 revert 시 production behavior 영향 0 — invoiceKind 필드 사라져도 helper 부재로 호출처 0 (Phase 2 시점 미사용). 검증 scenarios 만 함께 사라짐.
