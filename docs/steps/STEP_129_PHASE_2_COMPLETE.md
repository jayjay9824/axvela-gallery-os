# STEP 129 — Invoice / Contract Write Flow + Defense in Depth — COMPLETE ✅

**완료 시점**: 2026-05-12
**Phase**: 4 — Artwork-Centric Workflow Foundation (Stage 3 진입, STEP 128 revised roadmap §7 의 첫 step)
**Risk profile**: 🟢 Medium-Low → 🟢 Low (Commit 별 분리 + 사용자 중간 검증 + briefing 정정 사이클 흡수 후)
**Baseline**: `ac81c48` (Commit 2 PrintView + Detail Drawer 완료)
**Branch**: `claude/step127-architecture-review` (STEP 127~129 연속 commit 흐름)

---

## §0 Executive Summary

사용자 spec #5 ("인보이스 / 계약서 작성 flow") 의 *Phase 2 implementation* 완료. **3 commit 으로 본 STEP 종결 (Commit 3 skip)** — Commit 3 (ContractDraftDrawer 신설) 은 briefing 정정 사이클 결과 *불필요 신설* 로 폐기 (옵션 A 사용자 결정). STEP 127 의 invoiceKind foundation 위에 *실제 사용처 + UI* 정착으로 사용자 spec 100% 충족.

**핵심 성과**:
1. **rule_3 Money Flow Separation 4-layer defense in depth 완성** — STEP 127 Phase 1 §2.4 의 🔴 CRITICAL 4-layer 방어 (a)(b)(c)(d) 모두 정착.
2. **PRE/FINAL 인보이스 분리 UI 정착** — Send button label / Payment guard / 인쇄 watermark / fiscal 집계 제외 모두.
3. **Invoice / Contract PrintView 2 신설** — STEP 87/89 패턴 답습, browser native `window.print()`, 외부 라이브러리 0.
4. **AXID display 분리** — STEP 127 Phase 1 §2.7 옵션 Z (`AXV-YYYY-NNNN` → `AX-YYYY-KR-NNNNNN`), 시스템 식별자 무손상.

**briefing 정정 사이클 2건 흡수** (STEP 127 패턴 답습):
- Commit 1 진입 시점 — STEP 127 Phase 2 의 deferred items (a)(b) 발견 → 옵션 A 채택 (defense in depth 정상화)
- Commit 3 진입 시점 — ContractDraftDrawer 신설이 ContractDetailDrawer 의 *기존 DraftContractForm 과 기능 중복* 확인 → 신설 폐기 (옵션 A)

---

## §1 Commit-별 변경 요약

### Commit 1 — Foundation + defense in depth (a)(b) (`3e28e13`)

| 영역 | 파일 | 변경 |
|------|------|------|
| Helper 신설 (a) | [src/lib/invoice-helpers.ts](src/lib/invoice-helpers.ts) | `canRegisterPaymentFor(invoice): boolean` 추가 |
| Helper 신설 | [src/lib/utils.ts](src/lib/utils.ts) | `formatAxidForDocument(axid): string` 추가 (옵션 Z) |
| PRE filter | [src/lib/fiscal-summary.ts](src/lib/fiscal-summary.ts) | `invInRange` filter 에 `getInvoiceKind === "final"` 조건 추가 |
| PRE filter | [src/lib/reporting-aggregates.ts](src/lib/reporting-aggregates.ts) | invoice for-loop 진입 시 PRE skip (continue) |
| PRE filter | [src/lib/documents-aggregates.ts](src/lib/documents-aggregates.ts) | invoice flatten 시 PRE skip — **briefing file path deviation** (drilldown-resolver.ts → documents-aggregates.ts, 사용자 명시 동의) |
| Store guard (b) | [src/store/useArtworkStore.ts](src/store/useArtworkStore.ts) | `registerPayment` 진입 직후 PRE silent reject (1 if 문, core 로직 무변경) |
| UI guard (c) | [src/components/payment/PaymentRegisterDrawer.tsx](src/components/payment/PaymentRegisterDrawer.tsx) | `isPreInvoice` 판정 + submit 차단 + 안내 banner |

**7 files, +123 / -16 lines**. Risk 🟢 Low (additive-only, helper 호출처 0 / store-side core 로직 무변경).

### Commit 2 — Print + Detail Drawer (Steps 6~9 + layer (d)) (`ac81c48`)

| 영역 | 파일 | 변경 |
|------|------|------|
| PrintView 신설 | [src/components/invoice/InvoicePrintView.tsx](src/components/invoice/InvoicePrintView.tsx) | PRE/FINAL 분기 인쇄 layout, PRE watermark, formatAxidForDocument 적용 (~258 LOC) |
| PrintView 신설 | [src/components/contract/ContractPrintView.tsx](src/components/contract/ContractPrintView.tsx) | 매매 계약서 인쇄 layout, content whitespace-pre-wrap, 서명 placeholder (~257 LOC) |
| Send label (d) | [src/components/invoice/InvoiceDetailDrawer.tsx](src/components/invoice/InvoiceDetailDrawer.tsx) | DraftInvoiceForm send button label 분기 + LockedInvoiceView 에 "[인쇄/PDF 저장]" + hidden print mount (+50/-10) |
| Print mount | [src/components/contract/ContractDetailDrawer.tsx](src/components/contract/ContractDetailDrawer.tsx) | ReadOnlyContractView 의 LOCKED 시 "[인쇄/PDF 저장]" + hidden print mount (+19/-6) |

**4 files, +653 / -31 lines**. Risk 🟡 Medium-Low (UI 확장 + 패턴 답습).

### Commit 3 — **SKIPPED** (briefing 정정 사이클, 옵션 A 사용자 결정)

**근거**: ContractDraftDrawer.tsx 신설 가정과 worktree 실재 gap 발견 (정확히 STEP 127 패턴 답습):
- briefing §2.1 — "ContractDraftDrawer 신설 ~250 LOC, 4-stage UI"
- worktree 실재 — [ContractDetailDrawer.tsx:116-236](src/components/contract/ContractDetailDrawer.tsx:116) `DraftContractForm` 컴포넌트가 *완전 정착*:
  - DRAFT → REVIEW 흐름 (`submitContractForReview`)
  - AI 초안 generator wired (`createContract` store action 안에서 `generateContractDraftContent` 자동 호출)
  - rule_5 AI-Human Loop banner 정착 (line 161-169)
  - 모든 store actions 5/5 wire 정착
  - Entry point: [ContractSummary.tsx:142-150](src/components/contract/ContractSummary.tsx:142) "[계약 생성]" button

신설 시 *기능 중복 + 240 LOC 중복 코드 + 2 곳에서 같은 4-stage UI 관리 + 사용자 혼란*. 효용 0건 → **신설 폐기 결정**. 자세한 분석은 [STEP_128_PHASE_1_ARCHITECTURE_REVIEW.md](docs/steps/STEP_128_PHASE_1_ARCHITECTURE_REVIEW.md) §1 사실관계 검증 패턴 답습.

### Commit 4 — Scenarios + COMPLETE doc + ZIP (본 commit)

| 영역 | 파일 | 변경 |
|------|------|------|
| Scenarios 신설 | `src/lib/__tests__/invoice-kind-filter.scenarios.ts` | 5 scenarios — PRE filter pattern 검증 (~150 LOC) |
| Scenarios 신설 | `src/lib/__tests__/format-axid-for-document.scenarios.ts` | 5 scenarios — AXID display 변환 검증 (~130 LOC) |
| COMPLETE doc | `docs/steps/STEP_129_PHASE_2_COMPLETE.md` | 본 doc |
| INDEX 갱신 | `STEP_INDEX.md` | STEP 129 row + history line + Latest ZIP |
| HANDOFF 갱신 | `HANDOFF.md` | STEP 129 시점 baseline |
| ZIP | `axvela-step129-invoice-contract-flow.zip` | git archive HEAD |

---

## §2 4-Layer Defense in Depth — 완성 상태

STEP 127 Phase 1 §2.4 의 🔴 CRITICAL 4-layer 방어 모두 정착:

| Layer | 정착 위치 | Commit |
|-------|---------|--------|
| (a) Type-level helper | `invoice-helpers.ts` `canRegisterPaymentFor(invoice): boolean` | **Commit 1** |
| (b) Store action guard | `useArtworkStore.ts` `registerPayment` 진입 직후 PRE silent reject (1 if 문) | **Commit 1** |
| (c) UI disabled banner | `PaymentRegisterDrawer.tsx` `isPreInvoice` 분기 + submit 차단 + 안내 banner | **Commit 1** |
| (d) Send button label 분기 | `InvoiceDetailDrawer.tsx` DraftInvoiceForm `sendButtonLabel` 동적 ("PRE 안내용" vs "결제용") | **Commit 2** |

**rule_3 Money Flow Separation 보장**: PRE invoice 가 어떤 경로로든 (UI / store / 외부 API / import) `registerPayment` 호출 trigger 발생 0건. Payment / Settlement / Tax cascade 차단.

---

## §3 검증 게이트 — 누적

| Gate | Commit 1 | Commit 2 | Commit 4 (본 commit) |
|------|---------|---------|-------|
| `npx tsc --noEmit` | 0 errors | 0 errors | 0 errors |
| `npx next lint` | clean | clean | clean |
| `npx next build` Route | 191 kB | 195 kB | 195 kB |
| `npx next build` First Load | 279 kB | 282 kB | 282 kB |
| STEP 127 scenarios (5) | 5/5 PASS | 5/5 PASS | 5/5 PASS |
| STEP 129 invoice-kind-filter (5 신규) | — | — | 5/5 PASS |
| STEP 129 format-axid (5 신규) | — | — | 5/5 PASS |
| 누적 scenarios | 83 | 83 | **93** (+10) |

**baseline `75e300b` (STEP 127 종결) 대비 누적 bundle delta**:
- Route 191 → 195 kB (**+4 kB**)
- First Load 278 → 282 kB (**+4 kB**)

briefing §5 의 ±10 kB tolerance 내. 2 PrintView + 5 helpers + 4-layer guard 의 자연 비용.

---

## §4 사용자 spec #5 충족 검증

| 사용자 spec 항목 | 정착 위치 |
|----------------|----------|
| 인보이스 PRE/FINAL 분리 | invoiceKind 슬롯 (STEP 127) + 4-layer 방어 (Commit 1-2) |
| 결제용 vs 안내용 send button label | InvoiceDetailDrawer DraftInvoiceForm (Commit 2 layer d) |
| PRE invoice settlement 차단 | rule_3 4-layer defense (Commit 1-2) |
| Invoice 인쇄 + PDF 저장 | InvoicePrintView + LockedInvoiceView footer (Commit 2) |
| PRE invoice 인쇄 시 PRO FORMA watermark | InvoicePrintView (Commit 2) |
| Contract 작성 4-stage 흐름 | ContractDetailDrawer.DraftContractForm + ReadOnlyContractView (기존 정착) |
| Contract AI 초안 + 인간 검토 | `createContract` + `generateContractDraftContent` (기존 정착) |
| Contract LOCK + 새 버전 chain | `lockContract` + `createContractVersion` (기존 정착) |
| Contract 인쇄 + PDF 저장 | ContractPrintView + ReadOnlyContractView footer (Commit 2) |
| AXID 디자인 표기 변환 | `formatAxidForDocument` helper (Commit 1) |
| fiscal-summary / reporting / documents 의 PRE 제외 | 3 파일에 직접 filter 추가 (Commit 1) |

**모든 spec 항목 100% 충족**. ContractDraftDrawer 신설 폐기에도 불구하고 *기능 완성도 무영향* (기존 정착물이 모든 기능 제공).

---

## §5 보존 약속 9 항목 — 모두 ☑

| # | 보존 약속 | 결과 |
|---|----------|------|
| 1 | Phase 1 Fiscal frozen (실제 정의 부재) | ☑ STEP 128 §11.2 검증으로 fiscal-summary/reporting-aggregates/documents-aggregates 모두 frozen 외부 확인 |
| 2 | rule_5 AI-Human Loop keyword | ☑ 무손상 — Contract DraftContractForm 의 "초안 — AI 생성 후 담당자 검토 필요 (rule_5)" 정착 그대로 |
| 3 | Persistence v1 boundary | ☑ SCHEMA_VERSION / validateV1 변경 0줄 |
| 4 | rule_14 3-column layout | ☑ Drawer / Modal layer (rule_17) 내부만 변경, 3-column 0줄 |
| 5 | STEP 117 Optional Slice 패턴 | ☑ 본 STEP type slot 추가 0 — STEP 127 의 invoiceKind 만 활용 |
| 6 | STEP 118 ArtworkFormDrawer 4-tab over-scope | ☑ ArtworkFormDrawer 0줄 |
| 7 | STEP 124/125 single-drawer policy | ☑ Print mount = drawer 외부 sibling (Fragment), single-drawer 무영향 |
| 8 | Image-First hierarchy | ☑ ArtworkFormDrawer 0줄 |
| 9 | Two-Layer Curation Model | ☑ Contract content (formal entity) vs Artwork inline curation fields 별도 layer 그대로 |

---

## §6 STEP 127~129 패턴 — 정착된 working method

본 STEP 의 진행 과정은 STEP 127 Phase 1 정정 패턴 (3 cycle) 의 안정적 답습:

| Pattern | STEP 127 사례 | STEP 129 사례 |
|---------|------------|------------|
| 사실관계 사전 검증 (Phase 1.0) | 14_PERMANENT_POLICIES.md 부재 발견 | Contract store actions 5/5 정착 확인, DraftDrawer 부재 확인 |
| 진행 중 추가 사실 발견 → 보류 | 14_PERMANENT_POLICIES.md 부재 발견 후 보류 → 사용자 결정 | Commit 1 진입 시 deferred items (a)(b) 발견 / Commit 3 진입 시 기능 중복 발견 |
| 옵션 (A)(B)(C) 비교 + 권장 | 옵션 보고 | 두 번 (Commit 1 진입 시 / Commit 3 진입 시) |
| 사용자 결정 후 transparent commit message | "STEP 127 정정" | "STEP 129 Phase 2 — Commit N: ..." 명시적 deviation 명시 |

**STEP 130+ Phase 1.0 표준 추가** (Claude self-reflection, 사용자 결정 채택):
- §7 — *이전 STEP 의 deferred items 재검토* (STEP 129 self-reflection)
- §8 — *신설 가정 컴포넌트가 다른 파일에 동일 기능으로 정착되어 있지 않은가* (Commit 3 사례 학습)

→ STEP 130 Phase 1 entry briefing 진입 시 Phase 1.0 §0 또는 §1 에 두 항목 명시.

---

## §7 명시적 금지 사항 — 모두 0건

| 금지 | 실제 |
|------|------|
| ContractDraftDrawer.tsx 신설 | **0건** (옵션 A — 신설 폐기) |
| ContractDetailDrawer.tsx 변경 (Commit 2 이후) | **0줄** |
| STEP 127 정착물 회귀 | **0건** (5/5 scenarios PASS) |
| Commit 1+2 정착물 회귀 (4-layer + 2 PrintView) | **0건** |
| persistence schema 변경 | **0건** (SCHEMA_VERSION / validateV1 무손상) |
| AXVELA_*.md 6 영구 정책 문서 본문 변경 | **0줄** |
| `docs/design/passport/` git add | **0건** (untracked 보존, STEP 131 시점에 add) |
| 신규 dependency | **0건** (package.json / package-lock.json 0줄) |
| rule_5 AI-Human Loop keyword 변경 | **0건** (기존 banner 정착물 그대로) |
| ReceiptPrintView / TaxInvoicePrintView 본문 변경 | **0줄** (참조만, 패턴 답습) |
| window.print() 4 곳 정착 위치 변경 | **0건** (STEP 132 별도 결정) |
| Receipt / TaxInvoice DetailDrawer 변경 | **0줄** |

---

## §8 STEP 130~135 Roadmap — 본 STEP 후 진행 권장 순서

[STEP 128 Phase 1 §7 revised roadmap](docs/steps/STEP_128_PHASE_1_ARCHITECTURE_REVIEW.md) 그대로 유효. STEP 129 의 *실제 진행 경험* 으로 일정 재조정:

| STEP | scope | 예상 turn 수 (Phase 1 + Phase 2 분리, briefing 정정 사이클 포함) |
|------|-------|----------------------------------------------------|
| 130 | Internationalization Layer (Locale + getter helper + titleI18n? 슬롯) | 3~5 turn |
| 131 | Closed Passport Card + List View (design 자산 git add) | 5~8 turn (UI 광범위) |
| 132 | Server-side PDF Architecture (라이브러리 결정 + Vercel 호환 검증) | 4~6 turn |
| 133 | Expanded Passport + In-Passport Navigation + AXID 옵셔널 슬롯 | 6~10 turn |
| 134 | AI Cultural Intelligence Section (STEP 92 재사용) | 3~5 turn |
| 135 | Transaction Timeline + Provenance + Cross-link | 4~7 turn |

**총 25~41 turn** (STEP 128 §7.3 의 "14 turn 추정" 보다 보수적, 사용자 인지 항목과 정합). 각 STEP STEP 127~129 패턴 답습 — 사실관계 사전 검증 → 분석 doc → 사용자 결정 → implementation → 중간 분기점 보고.

---

## §9 STEP 129 완전 종결 + 다음 진입

**STEP 129 완전 종결 선언** — 사용자 spec #5 의 인보이스/계약서 작성 flow 모든 핵심 기능 production-ready 정착.

**main push 안내**:
- branch: `claude/step127-architecture-review` (STEP 127~129 누적 commit)
- 사용자 측 push 후 main fast-forward / merge / squash 결정 가능
- 사용 명령 예: `git push origin claude/step127-architecture-review` → GitHub 에서 PR 또는 fast-forward

**STEP 130 entry briefing 진입 대기** — 사용자 신호 (예: "STEP 130 진행") 시 *Phase 1.0 §7 + §8 표준 추가* 적용한 새 entry briefing 작성 시작.

---

## §10 revert / rollback 시나리오

| 의도 | 명령 |
|------|------|
| Commit 4 만 되돌리기 (scenarios + doc + ZIP) — Commit 1+2 production 정착 보존 | `git revert <Commit 4 hash>` |
| Commit 2 만 되돌리기 (PrintView × 2 + DetailDrawer 수정) — Commit 1 4-layer 보존 | `git revert <Commit 4> <Commit 2>` |
| STEP 129 전체 되돌리기 (Commit 1+2+4) — STEP 128 baseline 복귀 | `git revert <Commit 4> <Commit 2> <Commit 1>` 또는 `git reset --hard ae3185b` |
| STEP 127 baseline 까지 되돌리기 | `git reset --hard 75e300b` (force-push 필요한 분기에서) |

Commit 분리 정책 (사용자 spec) 으로 *세밀한 revert 가능* — 4-layer 만 보존 / PrintView 만 제거 / 전체 폐기 모두 안전.

---

## §11 `.gitattributes` 정책 결정 — recursive ZIP bloat 영구 차단

본 STEP 129 Commit 4 진행 중 path-specific 검증 시 발견 → 사용자 결정 옵션 (C) 채택으로 즉시 정착.

### §11.1 배경

STEP 127 부터 누적 사안:
- STEP 127 `axvela-step127-phase2.zip` (2.95 MB) — git tracked binary
- STEP 128 `axvela-step128-passport-architecture-review.zip` (5.90 MB) — git tracked binary
- STEP 129 시점 `axvela-step129-invoice-contract-flow.zip` 생성 시 이전 2개를 binary entry 로 포함 → 11.8 MB
- STEP 130~135 진행 시 무한 grow 예상

STEP 127 Phase 1 §11.3 / STEP 128 부수 사실 / STEP 129 Commit 4 검증 발견 — 모두 같은 architectural 사안 *플래그* 됐으나 매번 보류. 본 STEP 129 에서 결정 즉시 정착.

### §11.2 결정 내용

신설 파일: `.gitattributes` (worktree root)

```
*.zip export-ignore
*.zip binary
```

- `export-ignore` — `git archive` 출력에서 `*.zip` 자동 배제. 신규 STEP 의 ZIP 안에 이전 ZIP 포함 0건.
- `binary` — git diff 가 binary 로 표시 (text diff 시도 방지).

### §11.3 효과

- 본 STEP 129 ZIP 부터 신규 정책 적용 — 이전 ZIP 자동 배제
- ZIP 크기 11.8 MB → ~3 MB 예상 (이전 누적 8.85 MB 배제)
- STEP 130~135 마다 정책 결정 반복 0건
- commit history 의 이전 ZIP 보존 (history 손상 0)

### §11.4 Out of scope (별도 STEP 분리)

- **이전 STEP 127/128 ZIP 의 `git rm --cached`** — history 영향 + 별도 작업. 본 STEP 129 scope 외, 별도 cleanup STEP 권장.
- **GitHub Releases / git-LFS** — 외부 distribution 채널 전환은 향후 architecture decision.

---

## §12 검증 패턴 학습 — Phase 1.0 §9 표준 추가

본 STEP 129 Commit 4 path-specific 검증 시점에 발견 — Claude self-reflection 채택.

### §12.1 발견

이전 ZIP 검증 (STEP 127/128/129 broad pattern):
```powershell
Where-Object { $_.FullName -like "*passport*" -or ... }
```

이 패턴이 **false positive** 발생:
- 의도: `docs/design/passport/` directory 의 PASSPORT-1.png + PASSPORT-1_SPEC.md 배제 검증
- 실제 매칭: `axvela-step128-passport-architecture-review.zip` 파일명 안 "passport" 단어
- 결과: 의미상 충족 / spec 패턴 미충족 (false positive 1건)

### §12.2 정정 — path-specific 검증 패턴

```powershell
Where-Object {
  $_.FullName -like "docs/design/passport/*" -or   # path-specific, 의도 명확
  $_.FullName -like "*Add-Content*" -or
  $_.FullName -like "===*" -or                      # prefix-specific
  $_.FullName -eq "axvela-stepXXX-...zip" -or       # exact match (자기 자신)
  $_.FullName -like "*.zip"                         # recursive bloat 차단
}
```

### §12.3 Phase 1.0 §9 표준 추가 (STEP 130+)

**§9 검증 게이트 패턴은 path-specific 사용** — broad pattern (예: `*passport*`, `*content*`) false positive 회피. directory-prefix 또는 exact-match 우선.

본 STEP 130+ Phase 1 entry briefing 진입 시 Phase 1.0 §9 명시.

### §12.4 STEP 130+ Phase 1.0 표준 종합

본 STEP 129 self-reflection 결과 — STEP 130+ Phase 1 entry briefing 의 Phase 1.0 §0 또는 §1 에 다음 3 항목 표준 명시:

| § | 항목 | 출처 |
|---|------|------|
| 7 | 이전 STEP 의 deferred items 재검토 | STEP 129 Commit 1 시점 발견 (defense in depth (a)(b) deferred) |
| 8 | 신설 가정 컴포넌트가 다른 파일에 동일 기능으로 정착되어 있지 않은가 | STEP 129 Commit 3 시점 발견 (ContractDraftDrawer 기능 중복) |
| 9 | 검증 게이트 패턴은 path-specific 사용 (broad pattern false positive 회피) | STEP 129 Commit 4 시점 발견 (passport pattern false positive) |
