# STEP 132 Phase 2 — Complete

**완료일:** 2026-05-15
**범위:** PDF 인프라 구축 + Invoice/Contract PDF 발급 시스템
**최종 commit:** Commit 3 (Closure)

---

## 영역 재정의 (Phase 2 진행 중 발견)

원래 Phase 1 Architecture Review에서는 다음 Commit 구성 계획:
- Commit 1: Foundation (@react-pdf/renderer + Invoice PDF)
- Commit 2: Contract PDF + Drawer 미리보기
- Commit 3: Passport PDF + QR 첫 wire
- Commit 4: Closure

**중간 발견:** Passport는 도메인 엔티티가 아닌 Artwork의 시각 표현임이 확인됨. Invoice/Contract 답습 패턴이 적용되지 않음. 박진휘 분 결정으로 Passport PDF 영역은 별도 STEP (132.5 또는 136)으로 분리.

**조정된 Phase 2 구성:**
- ✅ Commit 1: Foundation
- ✅ Commit 2: Contract PDF + Drawer wire
- ✅ Commit 3: Closure (본 문서 + ZIP)

---

## Commit 1 — Foundation (457821f)

**산출물:**
- @react-pdf/renderer@4.5.1 (+1 dep)
- Pretendard v1.3.9 (5.14 MB ttf)
- `src/lib/pdf/{fonts.ts, styles.ts, client.ts}` (인프라 3 모듈)
- `src/components/invoice/InvoicePDFDocument.tsx` (~250 LOC)
- `src/app/api/pdf/invoice/[id]/route.tsx` (~180 LOC)
- 합계: 944 LOC

**rule 정합:**
- rule_3 Money Flow Separation: Invoice는 독립 PDF
- rule_4 Trust Layer: server route에서 `isLocked === true` 가드
- rule_16 minimalism: @react-pdf/renderer + 정착 helpers만 사용

---

## Commit 2 — Contract PDF (aed3a80)

**산출물 (4 files / +435 LOC):**
- `src/components/contract/ContractPDFDocument.tsx` (~160 LOC, NEW) — Invoice 답습, Pre/Final 분기 없음, 금액 블록 없음, content free-form 영역 추가
- `src/app/api/pdf/contract/[id]/route.tsx` (~145 LOC, NEW) — Invoice route 답습, G-1 정책 `status === "LOCKED"` 가드
- `src/lib/pdf/client.ts` (+69 LOC, 수정) — `downloadContractPDF` + `DownloadContractPDFResult` 추가 (Invoice Result 패턴 통일)
- `src/components/contract/ContractDetailDrawer.tsx` (+35 LOC, 수정) — LOCKED 한정 "PDF 다운로드" 버튼 wire, 기존 "인쇄 / PDF 저장" 보존 (additive-only)

**rule 정합:**
- rule_4 Trust Layer: defense-in-depth (server route 가드 + client UI `isLocked` 가드)
- rule_15 Interaction: Drawer 버튼 2개 분리 (인쇄 / PDF 다운로드)
- rule_16 minimalism: 추가 dep 0
- 영구 정책 #8 (가칭): additive-only — 기존 InvoicePrintView/ContractPrintView 정착물 0줄 변경

---

## 검증 결과

모든 commit에서 검증 3건 통과:
- `npx tsc --noEmit` ✅ (출력 0)
- `npm run lint` ✅ (0 warnings / 0 errors)
- `npm run build` ✅ (Compiled successfully, 7/7 static pages)

새로 등록된 dynamic routes:
- ƒ /api/pdf/invoice/[id]
- ƒ /api/pdf/contract/[id]

---

## 4 Layer 백업 완성

| Layer | 상태 |
|---|---|
| Working tree | ✅ clean |
| Local .git | ✅ |
| GitHub remote | ✅ origin/claude/step127-architecture-review |
| ZIP archive | ✅ AXVELA_STEP_132_PHASE_2_COMPLETE_<commit>.zip |

---

## 책임감 있는 멈춤 패턴 누적

이번 STEP 132 Phase 2에서 정착된 학습:
- 패턴 19: Buffer→BodyInit 변환 (TS lib 비호환 acknowledge)
- 패턴 20: Cascading oversight 차단 (변수명 충돌 사전 grep)
- 패턴 21: TS lib 비호환 = bug acknowledge
- 패턴 22: Claude 자체 도구 학습 (bash vs PowerShell syntax)
- 패턴 23: Passport 도메인 재해석 발견 (답습 불가 영역 식별)

---

## Deferred Items (Phase 2 발견 + 작업자 피드백)

- **STEP 132.5 또는 STEP 136**: Passport PDF + QR (해석 A 확정, 남은 4개 결정 영역)
- **STEP 133**: Document Hub (작품 클릭 → 모든 문서 통합 뷰, 외부 첨부 자료 영역 포함)
- **STEP 134**: i18n KO/EN 정적 + JA/ZH AI 동적 번역
- **STEP 135**: Invoice 진입점 UX 잔여 개선
- **D-COMMIT-1-1**: InvoicePrintView i18n migration
- **D-SECURITY-1**: next/glob/postcss 보안 패치 (별도 STEP)

---

## 다음 STEP

박진휘 분 결정에 따라:
- STEP 132.5 (Passport PDF 영역)
- STEP 133 (Document Hub) — 우선순위 최상위 후보
- STEP 134 / 135
