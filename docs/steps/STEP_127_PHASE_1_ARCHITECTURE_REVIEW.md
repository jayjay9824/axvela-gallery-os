# STEP 127 — Phase 1 Architecture Review (사용자 spec #5)

**작성 시점**: 2026-05-12
**Baseline**: `7e30d19` (STEP 126 Phase 5 closure) on `claude/condescending-lamarr-f5022a`
**Branch**: `claude/step127-architecture-review` (Phase 1 dedicated)
**작업 성격**: 분석·설계·리스크 평가·STEP 분리 제안만 — **코드 변경 0줄**, 단일 `.md` 산출물
**검증 조건**: `git diff 7e30d19..HEAD --stat` 결과가 `.md` 파일만 포함

---

## 0. Executive Summary

사용자 spec #5 ("인보이스 / 계약서 작성 flow + 디자인 자산 한/영 매매 계약서 + Esther Schipper Korea Final Invoice 자산 반영") 의 구현을 위한 architecture review. **결론**: 본 spec 은 단일 STEP 으로 수행 시 보존 약속 4 개 (rule_3 / rule_4 / rule_14 / Phase 1 Fiscal frozen) 동시 위협 가능 → **STEP 127 / 128 / 129 의 3-step bundle 로 분리** + 5-tab 발견 사실은 STEP 130 으로 완전 격리 권장. STEP 127 (foundation, additive-only `invoiceKind?: "pre" | "final"` optional slot) 는 Optional Slice 패턴 (STEP 117 의 8 번째 답습) 으로 Phase 1 Fiscal frozen 영역 0 줄 변경 + persistence v1 boundary 무손상 가능. PDF 출력은 browser native `window.print` (STEP 87/89 receipt/tax invoice 답습) 로 신규 dependency 0 개 가능 — `@react-pdf/renderer` 등 신규 라이브러리 도입은 별도 STEP 분리 필요. 갤러리 브랜드 양식 2-tier 는 STEP 129 에서 `GalleryTemplate` 신규 entity 로 분리, AXID 형식 (`AX-YYYY-KR-NNNNNN` vs 기존 `AXV-YYYY-NNNN`) 통합 결정은 본 review 에서 *보류 + 디자인 자산을 *system fallback* 으로 흡수* 권장 (마이그레이션 위험 회피).

---

## 1. 사용자 spec #5 → 검토 항목 매핑

| 사용자 spec #5 항목 | 매핑 검토 항목 | 권장 STEP |
|--------------------|----------------|-----------|
| PRE invoice (pro-forma, 가격 확정 전 buyer 안내용) | §2.1 invoiceKind 도입 | STEP 127 |
| FINAL invoice (payment 대상, 정산 trigger 발생) | §2.1 + §2.4 settlement 영향 | STEP 127 + STEP 128 |
| 인보이스·계약서 작성 흐름 (preview / send / lock) | §2.3 Preview/Send/Lock flow | STEP 128 |
| AI 초안 → 인간 수정 → 승인 → LOCK 4-stage | §2.3 (rule_5 AI-Human Loop) | STEP 128 (Contract entity 이미 정착) |
| PDF 출력 production-quality | §2.5 PDF tech stack | STEP 128 (browser print) / 별도 STEP (신규 lib 시) |
| 갤러리 브랜드 양식 (Esther Schipper Korea 등) | §2.6 2-tier template system | STEP 129 |
| 한/영 동시 출력 (예술품 매매 계약서 한·영 자산) | §2.6 (편입) + §3 권장안 | STEP 129 (한 STEP 안 합류 권장) |
| AXID 형식 통합 (`AX-YYYY-KR-NNNNNN`) | §2.7 AXID 통합 | **보류 권장** — 별도 결정 필요 |
| 5-tab 발견 | §4 Out of Scope | **STEP 130 (별도)** |

---

## 2. 검토 항목별 분석

### 2.1 `invoiceKind: "pre" | "final"` 도입 (additive-only)

**결론**: ✅ 가능. **STEP 127 의 core deliverable**. Optional Slice 패턴 (STEP 117 답습) 으로 [src/types/invoice.ts](src/types/invoice.ts) 에 옵셔널 필드 1 개 추가 + `validateV1` 의 *required field* 검증 미포함 → persistence schema v1 boundary 무손상. 기존 state machine `DRAFT / SENT / PAID` 0 줄 변경.

**근거**:
- 현재 [Invoice schema](src/types/invoice.ts:35) 는 `status: "DRAFT" | "SENT" | "PAID"` 외 lifecycle 분기 없음. `invoiceKind` 는 *status 와 직교 dimension* — status machine 과 무관.
- STEP 86 trust metadata 슬롯 추가 패턴 (line 92~125) 그대로 답습 가능 — JSDoc `옵셔널 / 미래-prep / 기존 데이터 영향 0 / validateV1 무영향` 동일 문구.
- [persistence.ts](src/lib/persistence.ts) `validateV1` 는 *슬라이스 존재만 검증* (line 233~260, `r.invoices` 가 array 인지만 확인) — 개별 invoice 의 신규 옵셔널 필드는 forward-compat 자동.
- 기본값: undefined (호환) / 의미 부재 시 도메인 layer 가 `kind ?? "final"` fallback 로 1 회 변환 (기존 invoice 모두 FINAL 의미 — pro-forma 가 아닌 거래 invoice).

**Risk**:

| 항목 | severity | probability | mitigation |
|------|----------|-------------|------------|
| 기존 invoice 의 `kind` 부재 → fallback 모호 | low | high | helper `getInvoiceKind(inv) = inv.invoiceKind ?? "final"` 단일 derivation point — UI / settlement / tax 모두 본 helper 만 사용 |
| 신규 invoice 생성 시 kind 미지정 → 의도 혼동 | medium | medium | `createInvoice(input)` action 에 `kind?: "pre" \| "final"` 입력 슬롯 추가, 미지정 시 `"final"` 기본 (기존 의미 보존) |
| settlement 자동 trigger 와 충돌 | **high** | medium | §2.4 별도 분석 — registerPayment 의 settlement 자동 생성 guard 필요 |

**보존 약속 영향도**:

| 보존 약속 | 영향 | 비고 |
|----------|------|------|
| Phase 1 Fiscal frozen 6 files | **영향 없음** | invoice.ts 는 Phase 1 frozen 영역 (STEP 89 TaxInvoice/STEP 87 Receipt 등) 외부 — Invoice 는 STEP 7 정착 후 STEP 32 FX lock 까지 진화. STEP 127 추가 1 필드는 frozen 정의에 미포함 |
| Persistence schema v1 boundary | **영향 없음** | SCHEMA_VERSION "v1" 변경 0, validateV1 0 줄 변경 |
| STEP 117 Optional Slice 패턴 | **답습 (8 회째)** | STEP 87/89 + 113~119/116/118 + 117 + 본 STEP 127 = 8 회 연속 |
| rule_4 Document Trust Layer | **무손상** | LOCK / Versioning 흐름 0 줄 변경. kind 는 metadata dimension |
| rule_5 AI-Human Loop keyword | **무손상** | 본 STEP 은 type-only foundation. AI 초안 흐름은 STEP 128 |

---

### 2.2 Contract entity (신설? 기존 확장?)

**결론**: ✅ **Contract entity 이미 정착**. [src/types/contract.ts](src/types/contract.ts) 가 4-stage approval (DRAFT/REVIEW/APPROVED/LOCKED) + Versioning + STEP 86 trust metadata 슬롯 모두 보유. **STEP 127 / 128 에서 신설 0 줄** — 기존 entity 의 *UI surface activation* 만 STEP 128 영역.

**근거**:
- Contract schema 의 JSDoc (line 6~15) 이 이미 AI-Human Loop 4-stage 명시: `createContract → updateContract → submitContractForReview → approveContract → lockContract`.
- `transactionId` + `artworkId` denormalized → rule_11 Transaction core chain 정합 (line 29~31).
- LOCK + Versioning 패턴 Invoice 와 동일 — `version` + `parentContractId` + `lockedAt`.
- Invoice 와의 **분리 정합**: Contract = legal agreement body (free-form `content`), Invoice = charge document (`amount` + `currency` + FX snapshot). **Two-Layer Curation Model 분리 원칙과 동형** — 두 entity 는 별도 layer 로 공존, transactionId 만 공통 anchor.

**Risk**:

| 항목 | severity | probability | mitigation |
|------|----------|-------------|------------|
| STEP 128 Contract UI 구현 시 Invoice UI 와 layout 혼동 | low | medium | Drawer layer (rule_17) 분리 — `ContractDetailDrawer` (이미 정착, line 439 에 axid.code 표시) / `InvoiceDetailDrawer` (이미 정착, line 518 에 axid.code 표시) 별개 |
| LOCK 이후 새 버전 생성 시 buyer 혼란 | medium | medium | Contract 의 `parentContractId` chain + Invoice 의 `parentInvoiceId` chain 모두 timeline (rule_8) 에 자연 노출 — 신규 logic 추가 0 줄 |

**보존 약속 영향도**:

| 보존 약속 | 영향 | 비고 |
|----------|------|------|
| Two-Layer Curation Model 분리 원칙 | **답습** | Contract (legal body) ↔ Invoice (charge document) 별도 layer 보존 |
| rule_11 Transaction core | **무손상** | 두 entity 모두 transactionId 종속, Transaction 자체 0 줄 변경 |
| rule_4 Document Trust Layer | **답습** | LOCK + Versioning + Audit 패턴 그대로 |
| rule_5 AI-Human Loop | **STEP 128 활성** | Contract JSDoc 의 4-stage 흐름 UI 활성 — keyword immutable, 행동만 추가 |

---

### 2.3 Preview / Send / Lock flow (rule_5 AI-Human Loop UI 활성)

**결론**: ✅ Drawer layer (rule_17) 안에서 가능. **STEP 128 의 core deliverable**. AI 생성 → 인간 수정 → 승인 → LOCK 4-stage 가 Invoice (3-stage DRAFT/SENT/PAID) + Contract (4-stage DRAFT/REVIEW/APPROVED/LOCKED) 양쪽에 자연 합류. UI 는 Drawer 안 Modal preview + Primary action button (rule_15).

**근거**:
- 현재 Invoice / Contract Drawer 가 이미 존재 — [InvoiceDetailDrawer](src/components/invoice/InvoiceDetailDrawer.tsx) (~753 LOC) / [ContractDetailDrawer](src/components/contract/ContractDetailDrawer.tsx) (~586 LOC).
- AI 초안 생성 도구 [utils.ts:323](src/lib/utils.ts:323) `generateContractClauses` (Korean 매매 계약 본문) + [utils.ts:383](src/lib/utils.ts:383) `generateCurationNote` (작품 해설) 이미 정착 — STEP 16 AI Layer 시점 합류.
- Preview Modal 은 [Modal.tsx](src/components/ui/Modal.tsx) primitive 그대로 재사용 (rule_17 — drawer 안 modal 허용 layer).
- Send 는 기존 `sendInvoice` action (store line 2495) 정확 답습 — STEP 127 추가 후 `if (invoiceKind === "pre") {...}` 분기 도입 가능 (PRE 도 SENT/LOCK 진입 가능 — pro-forma 도 buyer 에게 lock 된 형태로 전달).

**Risk**:

| 항목 | severity | probability | mitigation |
|------|----------|-------------|------------|
| Preview Modal 이 drawer 위 z-index 충돌 | medium | low | STEP 124 single-drawer policy 답습 — Preview Modal 은 drawer 안 nested layer, drawer 자체 close 안 함 (Modal 만 open/close) |
| AI 초안 → 인간 수정 시 텍스트 분실 | medium | medium | STEP 117 Draft / Resume System 패턴 답습 — Contract.content 자체가 draft (DRAFT status 가 곧 unsaved 의미), 부분 입력 보존 |
| LOCK 후 buyer 재발송 요청 시 새 버전 생성 의도 모호 | medium | medium | `createInvoiceVersion / createContractVersion` 의 `revisionReason` (이미 정착 — invoice.ts:90) 사용 강제, 사유 입력 modal |

**보존 약속 영향도**:

| 보존 약속 | 영향 | 비고 |
|----------|------|------|
| STEP 124/125 single-drawer policy | **답습** | Drawer 위 Modal 은 drawer close 없이 nested layer — 충돌 0 |
| rule_5 AI-Human Loop keyword | **답습 + UI 활성** | "AI 초안" / "AI 자동 생성" / "AI-Human Loop" / "검토 필요" / "담당자 검토" 등 STEP 113 terminology 보존 |
| rule_15 Primary 1 개 | **답습** | drawer 당 1 primary action ("발송 / 승인 / LOCK") |
| rule_17 Drawer Layer UI | **답습** | drawer 안 modal preview, 3-Column layout 0 줄 변경 |
| STEP 117 Draft / Resume System | **답습** | DRAFT status 자체가 draft 의미, 별도 슬라이스 추가 불필요 |

---

### 2.4 Settlement 영향도 — 🔴 CRITICAL

**결론**: ⚠️ **PRE invoice 는 settlement trigger 발생 절대 금지**. FINAL invoice 만 settlement 발생. 현재 [store.registerPayment](src/store/useArtworkStore.ts:2735) 가 invoice PAID 전환 + settlement 자동 생성 (line 1305 코멘트 "Auto-created when registerPayment runs") 을 묶어 수행 — PRE invoice 가 등장하면 본 흐름에 *분기 가드 필수*.

**근거**:
- rule_3 Money Flow Separation: Payment / Settlement / Tax 세 dimension 절대 통합 금지. PRE invoice 는 *informational charge document* — 실제 money flow 없음.
- 현재 `registerPayment(input)` 의 input.invoiceId 가 PRE invoice 를 가리키면:
  1. invoice PAID 잘못 마킹 (PRE invoice 는 payable 아님)
  2. settlement 잘못 생성 (실제 정산 trigger 아님)
  3. Tax record 잘못 생성 (실제 거래 아님)
  4. **결과: 회계 흐름 distorted, rule_3 위반**.
- 사용자 spec 의 "정산 시점이 PRE→FINAL 전환으로 바뀌는 위험" 직접 적중.

**방어 전략** (STEP 127 + STEP 128 양쪽 책임 분담):

| 방어 layer | 책임 STEP | 구현 위치 |
|-----------|----------|----------|
| **Type-level guard** (PRE invoice 에 payment 입력 자체 막기) | STEP 127 | helper `canRegisterPaymentFor(invoice): boolean = getInvoiceKind(inv) === "final"` |
| **Store action guard** | STEP 127 | `registerPayment` 진입 직후 `if (!canRegisterPaymentFor(invoice)) return; // PRE invoice — silent reject` |
| **UI guard** | STEP 128 | PaymentRegisterDrawer 에서 PRE invoice 는 disabled — `disabledHint: "PRE 인보이스는 결제 대상 아닙니다 — FINAL 인보이스 생성 후 결제 등록"` |
| **Send button label 분리** | STEP 128 | PRE 의 send button = "buyer 안내 발송" / FINAL = "결제용 인보이스 발송" |
| **createInvoice flow** | STEP 127 | PRE → FINAL 전환은 *createInvoiceVersion* 의 별도 ramp (PRE 도 lock 가능, FINAL 은 new version 으로 생성) |

**Risk**:

| 항목 | severity | probability | mitigation |
|------|----------|-------------|------------|
| 기존 invoice 데이터 (모두 kind 부재) 의 fallback 이 잘못 → 기존 settlement 회귀 | **high** | low | 기존 invoice 부재 시 `"final"` fallback (기존 의미 보존) — 회귀 0 보장 |
| PRE invoice 가 timeline / drilldown / aggregate 에서 잘못 집계 | **high** | medium | `documents_invoices` resolver / fiscal aggregate / reporting 모두 `getInvoiceKind(inv)` filter — STEP 128 의 별도 task |
| `Auto-created when registerPayment` 의 silent assumption 이 PRE invoice 진입 후 깨짐 | **high** | **medium** | **STEP 127 의 store guard 필수** — guard 누락 시 즉시 production data corruption |
| PRE invoice 의 send 후 buyer 가 FINAL 으로 오해 → 결제 시도 | medium | medium | UI label / PDF watermark "PRO FORMA — NOT FOR PAYMENT" (STEP 128 영역) |

**보존 약속 영향도**:

| 보존 약속 | 영향 | 비고 |
|----------|------|------|
| **rule_3 Money Flow Separation** | **🔴 핵심 보존 대상** | PRE invoice 도입은 본 rule 의 *test 시점* — guard 누락 시 rule 위반. STEP 127 에서 guard 명시 정착 |
| **Phase 1 Fiscal frozen 6 files** | **영향 없음** | `settlement-tax.ts` / `accountant-export.ts` / `fiscal-document-derive.ts` 등 모두 0 줄. fiscal aggregate 만 PRE filter 합류 (STEP 128 의 별도 task — frozen 영역 외부) |
| rule_4 Document Trust Layer | **답습** | LOCK + Versioning 그대로 — PRE 도 lock 가능, FINAL 은 다음 버전 |
| Persistence schema v1 boundary | **영향 없음** | invoice 의 옵셔널 필드 1 추가 외 schema 변경 0 |

---

### 2.5 PDF 출력 — production-quality

**결론**: ✅ **browser native `window.print()` + Print-friendly CSS** 로 신규 dependency 0 개 가능. STEP 87 (`ReceiptPrintView.tsx` ~226 LOC) + STEP 89 (`TaxInvoicePrintView.tsx` ~247 LOC) 의 검증된 패턴 직접 답습. 신규 PDF 라이브러리 도입 시 **별도 STEP 분리 필수** (고정 tech stack 정책 위반).

**근거**:
- 현재 [package.json](package.json) dependencies: `next 14.2.15 / react 18.3.1 / @vercel/blob / clsx / tailwind-merge / zustand` + devDeps: `typescript / tailwind / eslint`. **PDF 라이브러리 0 개**.
- STEP 87 Cash Receipt + STEP 89 Tax Invoice 모두 `window.print()` + Tailwind `@media print` 로 A4 출력 production 정착 — 사용자 spec "production-quality" 충족 사례 존재.
- 한·영 동시 출력은 Tailwind grid 2-col layout (좌측 한 / 우측 영) + `@media print` 으로 자연 처리 가능.

**대안 비교** (사용자 spec 항목 정확 매칭):

| 옵션 | dependency 추가 | quality | bundle | 한·영 처리 | 권장 |
|------|---------------|---------|--------|----------|------|
| **browser `window.print`** (STEP 87/89 답습) | **0 개** | A4 1:1 (Chrome/Edge), 매우 양호 | 0 kB | Tailwind grid 자연 | ✅ **STEP 128 채택** |
| `jsPDF` + `html2canvas` | 2 개 (~300 kB minified) | font 깨짐 / 한글 글리프 누락 다발 | +300 kB | font 별도 임베드 필요 | ❌ 위험 |
| `@react-pdf/renderer` | 1 개 (~500 kB) | React-DOM 별개 tree, layout 재작성 필요 | +500 kB | font registration 별도 | ❌ 별도 STEP 필요 |
| `html-to-image` (canvas) | 1 개 | raster 이미지 — 검색·텍스트 추출 불가 | +200 kB | n/a | ❌ 검색·접근성 손실 |
| 서버사이드 (`puppeteer`) | 1 개 (~250MB chromium) | 완벽, 서버 비용 | n/a | 완벽 | ❌ deployment 영향 |

**Risk**:

| 항목 | severity | probability | mitigation |
|------|----------|-------------|------------|
| browser print 환경 (Safari / 모바일) 별 layout 차이 | medium | high | Chrome 우선 권장 (운영자 환경 가정) + Safari fallback 시각 검증 — 사용자 운영 단계 |
| 페이지 분리 control 제한적 (large invoice / contract) | medium | medium | CSS `page-break-inside: avoid` + 충분한 print preview 검증 |
| PDF 저장 시 파일명 사용자 지정 불가 (브라우저 의존) | low | high | `document.title` 임시 변경 trick — STEP 87/89 와 동일 |
| 신규 dependency 추가 유혹 (PDF lib) | **high** | medium | **본 review 의 명시적 결정** — 신규 PDF 라이브러리 도입은 STEP 127~129 *밖* 의 별도 STEP 으로 분리 |

**보존 약속 영향도**:

| 보존 약속 | 영향 | 비고 |
|----------|------|------|
| 고정 tech stack 정책 | **무손상** | next/react/TS/Tailwind/Zustand/@vercel/blob/clsx/tailwind-merge 모두 0 변경, 신규 dependency 0 |
| STEP 87/89 PrintView 패턴 | **답습 (3 회째)** | Receipt → TaxInvoice → 본 STEP 128 (Invoice / Contract) |

---

### 2.6 갤러리 브랜드 양식 2-tier 시스템

**결론**: ✅ 신규 `GalleryTemplate` entity (또는 `gallerySettings` 슬라이스 안 subfield) 정착 권장 — **STEP 129 의 core deliverable**. **Settings 슬라이스 안 흡수 vs 신규 entity 두 옵션 비교 후 신규 entity 권장** (SSOT 원칙 정합).

**근거**:
- Tier 1 (System default — ARTENA 브랜드): 시스템에 hard-coded — 모든 갤러리 fallback. 변경 빈도 0.
- Tier 2 (Gallery custom — Esther Schipper Korea 등): 갤러리별 다르고 변경 가능 (로고 / footer 문구 / 주소 / 사업자 등록번호 / 대표 / 인감 위치 등). *persistence 대상*.
- Two-Layer Curation Model (STEP 119) 의 *분리 원칙* 직접 답습 — formal entity (CurationNote) ↔ inline data (Artwork.curationDraft 등) 의 dimension 분리.

**옵션 비교**:

| 옵션 | 위치 | persistence | SSOT 정합 | 권장 |
|------|------|-------------|----------|------|
| (A) `GalleryTemplate` 신규 entity | `src/types/gallery-template.ts` 신설 + persistence 옵셔널 슬라이스 | optional slice (STEP 117 패턴) | ✅ 명시적 entity = 단일 source of truth | **권장** |
| (B) `gallerySettings` 슬라이스 안 subfield | 기존 settings 안 nested object | settings 슬라이스 확장 | ⚠️ settings = general config 와 template = legal-document brand 의 dimension 혼합 | 비권장 |
| (C) Hard-coded conditional | `if (galleryId === "esther-schipper-kr") {...}` | 0 줄 | ❌ 확장 불가, scale 불가능 | 절대 비권장 |

**`GalleryTemplate` 권장 schema** (Phase 1 review 차원 — 실제 정의는 STEP 129):

```typescript
interface GalleryTemplate {
  id: string;
  galleryId: string;          // 1 galleryId 당 N templates (한/영 분리 가능)
  kind: "invoice" | "contract";
  locale: "ko" | "en" | "ko_en_dual";
  // Brand identity
  galleryName: string;
  galleryAddress: string;
  businessRegistrationNo?: string;  // 사업자 등록번호
  representativeName?: string;       // 대표자
  logoUrl?: string;
  // Layout slots
  headerText?: string;
  footerText?: string;
  termsBoilerplate?: string;
  // STEP 86 trust metadata 슬롯 답습
  generatedBy?: string;
  sourceContext?: "manual" | "auto" | "imported";
}
```

**Risk**:

| 항목 | severity | probability | mitigation |
|------|----------|-------------|------------|
| 신규 entity → persistence schema 확장 → v1 boundary 의심 | low | low | optional slice 패턴 (STEP 117 답습, 9 회째) — SCHEMA_VERSION 변경 0 |
| galleryId 부재 시 fallback (Tier 1) 미존재 → render 실패 | medium | medium | system default template `getDefaultTemplate(kind, locale)` helper 정착 (Tier 1) |
| 한/영 dual template 시 layout 복잡도 | medium | high | locale="ko_en_dual" 시 2-col grid layout 분리 (STEP 128 PrintView 안 처리, STEP 129 는 data 만) |
| 사업자 등록번호 등 민감 정보 노출 | low | low | template = public 출력 문서 — 사업자 번호는 공개 정보, 위험 없음 |

**보존 약속 영향도**:

| 보존 약속 | 영향 | 비고 |
|----------|------|------|
| SSOT 원칙 | **답습** | template = 단일 source of truth, 갤러리별 별개 record |
| Two-Layer Curation Model 분리 원칙 | **답습** | template (brand layer) ↔ invoice/contract (record layer) 별도 dimension |
| Persistence schema v1 boundary | **무손상** | optional slice (STEP 117 패턴) |
| Phase 1 Fiscal frozen 6 files | **영향 없음** | template = 신규 entity, 기존 fiscal entity (Receipt/TaxInvoice/Settlement/Tax/Invoice/Contract) 0 줄 변경 |

---

### 2.7 AXID 통합 — 기존 `AXV-YYYY-NNNN` vs 디자인 자산 `AX-YYYY-KR-NNNNNN`

**결론**: 🟡 **본 review 에서 결정 보류 + 디자인 자산을 *system fallback* 으로 흡수 권장**. 즉 STEP 127~129 에서는 기존 형식 `AXV-${year}-${seq:0000}` 유지, 디자인 자산은 *system default template Tier 1* 안에 변환 helper 로 표시. 형식 마이그레이션은 별도 의사결정 STEP (예: STEP 131 AXID Format Decision).

**근거**:
- 현재 [AXID interface](src/types/artwork.ts:33) 의 `code: string` 은 *free-form string slot* — schema 자체는 형식 강제 0 줄. 형식은 [store generator](src/store/useArtworkStore.ts:1277) `\`AXV-${year}-${String(seq).padStart(4, "0")}\`` 단일 지점.
- 디자인 자산 형식 `AX-YYYY-KR-NNNNNN` 의 차이:
  - prefix: `AXV` (3 chars) → `AX` (2 chars)
  - region segment: 없음 → `KR` (2 chars)
  - sequence: 4-digit → 6-digit
- 기존 데이터 호환:

| 옵션 | 기존 데이터 | 신규 데이터 | 마이그레이션 |
|------|-----------|-----------|------------|
| (X) 즉시 전환 | regenerate 필요 — *모든* axid 재발급 + 외부 reference 깨짐 | 신규 형식 | 위험 high, persistence 마이그레이션 필요 |
| (Y) 병행 (parallel) | 기존 그대로 | 신규 형식 (`AX-YYYY-KR-NNNNNN`) | mixed format DB — 검색·정렬 혼란 |
| (Z) **디자인 표기만 분리** | 기존 그대로 | 기존 형식 | **0 마이그레이션** — 디자인 자산은 *PDF 표기 변환* level 에서 처리 |

**옵션 Z 권장 근거**:
- AXID 의 정체성 = *physical root key* (rule_1 Artwork-First). 시스템 내부 식별자.
- 디자인 자산의 `AX-YYYY-KR-NNNNNN` 는 *invoice / contract PDF 의 표기 convention* — internal id 와 별개 dimension.
- 변환 함수 `formatAxidForDocument(axid: AXID, locale: Locale): string` 가 STEP 128 / 129 의 PrintView 안에서 `AXV-2026-0001` → `AX-2026-KR-000001` 출력 변환 — schema / persistence / 기존 데이터 0 줄 변경.

**Risk**:

| 항목 | severity | probability | mitigation |
|------|----------|-------------|------------|
| 변환 함수가 외부 reference 와 mismatch (buyer 가 PDF 본 후 system search 시 `AX-` 검색해도 0 hit) | medium | medium | ArtworkGrid search [line 26](src/components/layout/ArtworkGrid.tsx:26) 에 *both formats* substring match 추가 (STEP 128 영역) |
| 미래 region 확장 시 (`KR` → `JP` 등) helper 수정 필요 | low | low | helper 안 region default `"KR"` 고정 — 미래 GalleryTemplate.region slot 도입 시 자연 합류 |
| 사용자가 통합 마이그레이션 의도 시 본 review 결정과 충돌 | medium | low | **본 review 의 명시적 결정**: 통합 마이그레이션 원할 시 STEP 131 (또는 별도 데이터 마이그레이션 STEP) 으로 분리 — STEP 127~129 본 bundle 외부 |

**보존 약속 영향도**:

| 보존 약속 | 영향 | 비고 |
|----------|------|------|
| STEP 113 AXID 형식 (`AXV-YYYY-NNNN`) | **무손상** | 시스템 내부 식별자 변경 0 |
| Persistence schema v1 boundary | **무손상** | axid.code free-form string — format 강제 없음 |
| rule_1 Artwork-First (physical root key) | **답습** | 시스템 내부 정체성 보존, 디자인 표기는 별도 dimension |

---

## 3. 권장 STEP 분리안

### STEP 127 — invoiceKind PRE/FINAL Foundation (additive-only)

**Scope**:
- `invoiceKind?: "pre" | "final"` optional slot 추가 (Optional Slice 8 회 답습)
- helper `getInvoiceKind(inv) = inv.invoiceKind ?? "final"` 단일 derivation point
- helper `canRegisterPaymentFor(invoice): boolean` (🔴 critical guard)
- store `registerPayment` 진입 직후 PRE invoice silent reject guard
- `ArtworkInput` / `createInvoice` 의 `kind?` 입력 슬롯
- 신규 scenarios — PRE invoice settlement non-trigger + getInvoiceKind fallback (~5~7 scenarios)

**규모**: ~150 LOC (type ~10 + helper ~30 + store guard ~20 + scenarios ~90)
**Risk**: 🟢 Low (additive-only, fallback 보장, frozen 영역 0 줄)
**bundle delta 예상**: 0 kB (type-only + 1 guard branch, tree-shake 영향)
**보존 약속**: §2.1 / §2.4 의 영향도 표 그대로

### STEP 128 — Invoice / Contract Preview + Send + Lock + PDF UI

**Scope**:
- InvoiceDetailDrawer / ContractDetailDrawer 안 Preview Modal 활성
- AI 초안 생성 (utils.ts `generateContractClauses` 기존 호출) → 인간 수정 → 승인 → LOCK 4-stage UI
- PRE invoice 의 send button label 분기 + watermark "PRO FORMA — NOT FOR PAYMENT"
- PaymentRegisterDrawer disabled UI for PRE invoice
- `InvoicePrintView.tsx` / `ContractPrintView.tsx` 신설 (STEP 87/89 PrintView 답습)
- `documents_invoices` resolver / fiscal aggregate / reporting 에 PRE filter 합류
- `formatAxidForDocument` helper (디자인 자산 표기 변환)

**규모**: ~700~900 LOC (Drawer 확장 ~200 + 2 PrintView ~250 each + AI assist UI ~100 + payment guard UI ~50 + filter 합류 ~50 + helper ~30)
**Risk**: 🟡 Medium (UI 확장 + flow 활성, drawer / modal layer 충돌 가능성)
**bundle delta 예상**: +5~8 kB (2 PrintView 정착)
**보존 약속**: §2.3 / §2.5 의 영향도 표 그대로

### STEP 129 — Gallery Template 2-tier + 한/영

**Scope**:
- `GalleryTemplate` entity 신설 + optional persistence slice
- `getDefaultTemplate(kind, locale)` system fallback (Tier 1, ARTENA 브랜드)
- Gallery custom template (Tier 2, Esther Schipper Korea 등) CRUD UI — Settings drawer 안 신설
- 한·영 동시 출력 (locale="ko_en_dual"): 2-col grid `@media print` layout
- 디자인 자산 의 한·영 매매 계약서 본문 boilerplate Tier 1 default 흡수

**규모**: ~600~800 LOC (entity ~150 + persistence slice ~30 + Settings drawer ~200 + dual layout ~150 + boilerplate ~100)
**Risk**: 🟡 Medium (신규 entity + multi-locale, persistence schema 신규 슬라이스)
**bundle delta 예상**: +3~5 kB (Settings drawer + boilerplate)
**보존 약속**: §2.6 의 영향도 표 그대로

### STEP 130 (별도) — 5-tab Main Navigation Review

**Scope**: §4 Out of Scope 참조.

**STEP 127 / 128 / 129 와 절대 묶지 않음** — rule_14 3-column layout 변경 가능성, 모바일/데스크탑 분기, 별도 architecture review 필요.

---

## 4. Out of Scope — Phase 1 review 에서 별도 분리 권고

### 4.1 🟡 5-tab Main Navigation 발견

**상태**: 디자인 자산 / 사용자 spec preview 에서 발견된 *별도 architecture 영향 항목*.

**별도 STEP 130 분리 권장 근거**:
- **rule_14 3-Column Layout (Sidebar 240px / Grid flex-1 / Detail 380px) 와 직접 충돌 가능**. 현재 [Sidebar.tsx](src/components/layout/Sidebar.tsx) 가 단일 sidebar — tab navigation 의 *최상위 정체성* 자체가 다름.
- **모바일 / 데스크탑 분기 전략 부재**. 현재 시스템은 데스크탑 전용 가정 (3-column fixed). 5-tab 은 모바일 hint — 분기 architecture review 별도 필요.
- **본 STEP 127~129 와 결합 시 부가 위험**: invoice/contract flow 의 UX 결정이 layout paradigm 변경에 발목 잡힘.

**STEP 130 진입 시 검토 필요 항목** (본 review 에서는 *기록만*):
- Sidebar 와 5-tab 의 정체성 충돌: 둘 다 navigation primary?
- 5-tab content area 가 Grid (flex-1) 자리를 차지하는가, Detail (380px) 자리를 차지하는가, 또는 전면 교체?
- 모바일 viewport 진입 시 3-column → 5-tab 전환 trigger?
- Detail Panel 의 ZONE 5 (UX-3 정착) 와 5-tab content 간 관계?

### 4.2 🟡 한·영 동시 출력 — STEP 129 합류 권장 (별도 다국어 STEP 분리 비권장)

**판단**: STEP 129 의 `GalleryTemplate` 안 `locale` 슬롯으로 자연 흡수 → 별도 다국어 STEP 분리 불필요.

**근거**:
- 디자인 자산 (예술품 매매 계약서 한·영) 의 dual layout 은 *legal document tier 의 표기 convention* — 시스템 i18n 과 별개 dimension.
- 시스템 전반 i18n (UI label / hint 한·영 전환) 은 STEP 96 Translation UI 에서 이미 별도 layer 로 정착. 디자인 자산 의 dual layout 과 분리.
- 한·영 dual layout 추가 LOC 추정 ~150 — STEP 129 600~800 LOC 안 자연 합류 가능, 별도 STEP 의 overhead 보다 효율.

**조건부 별도 STEP 분리 신호** (다음 중 1 개라도 충족 시 STEP 129 에서 분리):
- locale 종류가 3 개 이상 (`ko / en / zh / ja`) 으로 확장
- 본문 boilerplate 가 갤러리별 (Tier 2) + locale 별 (~ko_en_dual / ko / en) 곱해져 N × M 관리 부담 발생
- AI 기반 자동 번역 도입 필요 (외부 API)

---

## 5. 영향 받는 파일 목록 (추정 — 실제 변경은 각 STEP Phase 2 에서)

### STEP 127 예상 변경 (~5 files)

| 파일 | 변경 종류 | 추정 LOC |
|------|----------|---------|
| [src/types/invoice.ts](src/types/invoice.ts) | `invoiceKind?` 옵셔널 슬롯 추가 + JSDoc | +10 |
| [src/lib/invoice-helpers.ts](src/lib/invoice-helpers.ts) (신규 또는 기존 helper 합류) | `getInvoiceKind` / `canRegisterPaymentFor` helper | +30 |
| [src/store/useArtworkStore.ts](src/store/useArtworkStore.ts) | `registerPayment` guard (PRE silent reject) + `createInvoice` 의 `kind?` 입력 | +20 |
| `src/lib/__tests__/invoice-kind.scenarios.ts` | 신규 scenarios (~5~7) | +120 |
| [src/types/artwork-input-or-invoice-input].ts (해당 if any) | `kind?` field | +5 |

### STEP 128 예상 변경 (~12~15 files)

| 파일 | 변경 종류 |
|------|----------|
| [src/components/invoice/InvoiceDetailDrawer.tsx](src/components/invoice/InvoiceDetailDrawer.tsx) | Preview Modal + PRE label 분기 + watermark |
| [src/components/contract/ContractDetailDrawer.tsx](src/components/contract/ContractDetailDrawer.tsx) | Preview Modal + 4-stage UI |
| `src/components/invoice/InvoicePrintView.tsx` (신규) | A4 PrintView (STEP 87/89 패턴) |
| `src/components/contract/ContractPrintView.tsx` (신규) | 매매 계약서 PrintView |
| [src/components/payment/PaymentRegisterDrawer.tsx](src/components/payment/PaymentRegisterDrawer.tsx) | PRE invoice disabled UI |
| [src/lib/drilldown-resolver.ts](src/lib/drilldown-resolver.ts) | `documents_invoices` resolver 의 PRE filter |
| [src/lib/fiscal-summary.ts](src/lib/fiscal-summary.ts) | byCurrency 집계의 PRE 제외 (frozen 검토 필요 — §6 참조) |
| [src/lib/reporting-aggregates.ts](src/lib/reporting-aggregates.ts) | reporting 의 PRE filter |
| [src/lib/utils.ts](src/lib/utils.ts) | `formatAxidForDocument` helper |
| [src/components/layout/ArtworkGrid.tsx](src/components/layout/ArtworkGrid.tsx) | search 의 dual format substring match |

⚠️ **fiscal-summary.ts / reporting-aggregates.ts 가 Phase 1 Fiscal frozen 검토 대상**. STEP 128 진입 시 *frozen 영역 식별 + 필요 시 derived layer 분리* 우선 수행. §6 보존 약속 검증표 참조.

### STEP 129 예상 변경 (~10 files)

| 파일 | 변경 종류 |
|------|----------|
| `src/types/gallery-template.ts` (신규) | entity + labels + helper |
| [src/lib/persistence.ts](src/lib/persistence.ts) | `galleryTemplates?` 옵셔널 슬라이스 + validateV1 0 줄 변경 |
| `src/store/useArtworkStore.ts` | galleryTemplates slice + CRUD actions |
| `src/components/settings/GalleryTemplateDrawer.tsx` (신규) | Tier 2 CRUD UI |
| `src/lib/default-gallery-template.ts` (신규) | Tier 1 system default + ARTENA 브랜드 |
| `src/components/invoice/InvoicePrintView.tsx` (STEP 128 산출물 확장) | template 적용 + 한/영 dual layout |
| `src/components/contract/ContractPrintView.tsx` (STEP 128 산출물 확장) | template 적용 + 한/영 dual layout |
| `src/lib/__tests__/gallery-template.scenarios.ts` | 신규 scenarios |

---

## 6. 보존 약속 무손상 보장 검증표

| # | 보존 약속 | STEP 127 | STEP 128 | STEP 129 | STEP 130 |
|---|----------|----------|----------|----------|----------|
| 1 | 🔴 **Phase 1 Fiscal frozen 6 files / 0-line change rule** | ☑ 영향 없음 — `invoice.ts` 는 Phase 1 frozen 외부, fiscal helpers 0 줄 | ⚠️ **frozen 영역 식별 필요** — fiscal-summary.ts / reporting-aggregates.ts 가 STEP 88 정착물. *derived filter layer* 분리 필요 (frozen 직접 수정 금지) | ☑ 영향 없음 — 신규 entity, fiscal 0 줄 | ☑ 영향 없음 (별도 STEP) |
| 2 | 🔴 **rule_5 AI-Human Loop keyword immutability** | ☑ 키워드 0 변경 | ☑ "AI 초안" / "담당자 검토" / "rule_5" / "AI-Human Loop" 모두 보존, 추가만 | ☑ 키워드 0 변경 | n/a |
| 3 | 🔴 **Persistence schema v1 boundary** | ☑ SCHEMA_VERSION 변경 0, validateV1 0 줄, invoiceKind 옵셔널 | ☑ schema 변경 0 | ☑ optional slice (STEP 117 패턴, validateV1 0 줄) | ☑ 영향 없음 |
| 4 | 🔴 **rule_14 3-column layout (Sidebar 240px / Grid flex-1 / Detail 380px)** | ☑ UI 0 변경 | ☑ Drawer / Modal layer 안 (rule_17), 3-column 0 줄 | ☑ Settings drawer (rule_17) | 🔴 **STEP 130 가 본 rule 검토 대상** — STEP 127~129 와 분리 보장 |
| 5 | 🔴 **STEP 117 Draft / Resume System 구조 + Optional Slice 패턴** | ☑ Optional Slice 8 회째 답습 | ☑ Contract.content = DRAFT status 자체가 draft 의미 | ☑ Optional Slice 9 회째 답습 (galleryTemplates) | n/a |
| 6 | 🔴 **STEP 118 ArtworkFormDrawer 4-tab over-scope rejection** | ☑ 영향 없음 — ArtworkFormDrawer 0 줄 | ☑ ArtworkFormDrawer 0 줄 (Invoice/Contract drawer 와 별개) | ☑ ArtworkFormDrawer 0 줄 | n/a |
| 7 | 🔴 **STEP 124/125 single-drawer policy + detailKind/detailId metadata** | ☑ drilldown 0 줄 | ☑ Preview Modal = drawer 안 nested layer, drawer close 없음 | ☑ drilldown 0 줄 | n/a |
| 8 | 🔴 **Image-First hierarchy in ArtworkFormDrawer** | ☑ 영향 없음 | ☑ 영향 없음 | ☑ 영향 없음 | n/a |
| 9 | 🔴 **Two-Layer Curation Model 분리 원칙** | ☑ 답습 (Contract vs Invoice 별도 layer) | ☑ 답습 | ☑ 답습 (template brand layer vs record layer) | n/a |

⚠️ **검증표의 단 1 개 경고 (#1 STEP 128)**: fiscal-summary.ts / reporting-aggregates.ts 의 invoice 집계가 PRE 를 포함하면 안 됨 → STEP 128 진입 시 *derived filter layer* 추가 (frozen 파일 직접 수정 금지). 구체 방식: helper `filterFinalInvoices(invoices) = invoices.filter(inv => getInvoiceKind(inv) === "final")` 를 *호출 측에서 사용* — frozen 함수 body 0 줄 변경, 호출자가 filtered list 전달.

---

## 7. STEP 127 Phase 2 Implementation 진입 전제 조건 체크리스트

Phase 2 (실제 구현) 진입 전 다음 모두 충족 확인:

- [ ] 본 architecture review 사용자 승인
- [ ] STEP 127 / 128 / 129 분리 방안 사용자 승인
- [ ] STEP 130 별도 분리 합의 (5-tab navigation 본 bundle 미포함)
- [ ] AXID 형식 결정 — 옵션 Z (디자인 표기 분리, 마이그레이션 0) 사용자 승인
- [ ] STEP 128 진입 시 fiscal-summary.ts / reporting-aggregates.ts 의 PRE filter 를 *derived layer 호출 측* 에서 수행 (frozen 0 줄) 합의
- [ ] PDF 출력 = browser native `window.print()` 채택 (신규 dependency 0) 합의
- [ ] PRE invoice settlement non-trigger 의 4-layer 방어 (type / store / UI / label) 합의
- [ ] 한·영 dual layout 은 STEP 129 안 흡수 (별도 다국어 STEP 분리 비권장) 합의
- [ ] gallery template 2-tier — `GalleryTemplate` 신규 entity (옵션 A) 합의
- [ ] 본 review 의 7 검토 항목 × 9 보존 약속 = 63 cell 검증표 사용자 확인

---

## 8. 검증

```
git diff 7e30d19..HEAD --stat
→ docs/steps/STEP_127_PHASE_1_ARCHITECTURE_REVIEW.md (신규 1 file, .md only)

코드 / 컴포넌트 / 타입 정의 신규 작성: 0
schema 수정: 0
Phase 1 Fiscal frozen 6 files 변경: 0
5-tab navigation 을 STEP 127~129 에 포함시키는 시도: 0
```

본 review 산출물 = 단일 `.md` 파일. 코드 / 타입 / 컴포넌트 / 스키마 변경 0 줄.

---

## 9. 다음 단계

1. **사용자 본 review 검토** — §7 체크리스트의 10 항목 승인 여부 결정.
2. 승인 시 → **STEP 127 Phase 2 implementation 진입** (Optional Slice 8 회째 답습, ~150 LOC, 🟢 Low risk).
3. STEP 127 closure 후 → STEP 128 entry briefing 별도 작성 (architecture review 동일 패턴, 분리 commit).
4. STEP 129 진입 전 → 갤러리 브랜드 자산 (Esther Schipper Korea 등) 의 실제 boilerplate 텍스트 / 로고 / 사업자 정보 수집 (사용자 → Phase 1 산출물 별도).
5. STEP 130 (5-tab navigation) 은 STEP 129 완료 후 별도 architecture review 진입.

---

## 10. revert / rollback 시나리오

본 review 자체는 doc-only — revert 비용 0. 만약 본 review 의 분리안 자체에 사용자 이의 시:

| 의도 | 액션 |
|------|------|
| 분리안 재설계 (예: 127+128 통합) | 본 doc 갱신 후 사용자 재승인 — 코드 0 줄 영향 |
| 본 review 자체 폐기 | `git reset --hard 7e30d19` (branch 폐기) 또는 `git revert <commit>` |
| AXID 옵션 Z → 옵션 X (즉시 전환) 변경 | 본 doc §2.7 갱신, 별도 STEP 131 추가 신설, STEP 127~129 의존성 재평가 |
| 신규 PDF lib 도입 결정 | 본 doc §2.5 갱신, STEP 128 와 별도 dependency-introduction STEP 분리 (예: STEP 128.5) |
