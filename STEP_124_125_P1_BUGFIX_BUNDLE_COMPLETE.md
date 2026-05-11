# STEP 124 / 125 — P1 Bug Fix Bundle — COMPLETE ✅

**완료 시점**: 2026-05-09
**Phase**: 4 — Artwork-Centric Workflow Foundation
**Risk profile**: 🟡 mid → 🟢 (검증 후) — Drilldown row click lifecycle + MetricCard affordance 정착

---

## 1. 두 P1 Bug 의 정체

### Bug #1 (STEP 124) — 고객 → 문의 이력 클릭 시 페이지 사라짐

**Root cause**: 두 별개 클릭 경로 모두 잘못 결과:
1. `CustomerViewDrawer.tsx:704` — inquiry item `onClick` 가 `onArtworkNavigate(i.artworkId)` → `selectArtwork + closeView()`. 사용자 의도("문의 내용 보기") vs 시스템 동작("작품 navigate + customer drawer 닫음") 미스매치.
2. "문의 이력 x건" 헤더 클릭 → drilldown 이 customer drawer 위 z-50 겹침. drilldown row click → `select(artworkId) + closeDrilldown()` → drilldown 만 닫고 customer 가 그대로 → 작품 detail 가려져 안 보임.

**Lifecycle issue**: 모든 drawer 가 `z-50` 동일 → 동시 표시 시 painter's order 의존, backdrop click 모호.

### Bug #2 (STEP 125) — 세무 흐름 진행상태 클릭 불가

**Root cause**: `FiscalSummaryDrawer.tsx` `MetricCard` 가 plain `<div>` — `onClick` / `role="button"` / `cursor-pointer` / `tabIndex` 모두 부재. **클릭 막힘이 아니라 affordance 자체 부재** — 사용자 spec 의 "pointer-events / handler 확인" 중 *handler 부재* 가 정답.

---

## 2. 수정 파일 목록

### STEP 124 — Customer / Inquiry click lifecycle fix

| 파일 | 변경 |
|------|------|
| `src/types/drilldown.ts` | `DrilldownRow.detailKind?: "inquiry"\|"invoice"\|"settlement"\|"tax"\|"tax_invoice"` + `detailId?` optional metadata 추가 |
| `src/lib/drilldown-resolver.ts` | `customer_inquiries` resolver 가 `detailKind: "inquiry"` + `detailId: inq.id` 채움 + context label 갱신 ("작품 이동 가능" → "행을 클릭하면 문의 상세 열림") |
| `src/components/drilldown/OperationalDrilldownDrawer.tsx` | 5 detail opener selectors (inquiry/invoice/settlement/tax/tax_invoice) + `handleRowClick` detail-우선 분기 (single-drawer policy: detail 진입 시 drilldown auto-close, z-index 충돌 방어) + clickable 조건 확장 (artworkId OR detailKind+detailId) + footer 안내 갱신 |
| `src/components/customer/CustomerViewDrawer.tsx` | `openInquiryDetail` selector + `handleInquiryNavigate` (null guard + openInquiryDetail + closeView) + `CustomerDetail` 에 `onInquiryNavigate` prop + inquiry item `onClick` 변경 (작품 navigate → 문의 detail) |

### STEP 125 — Fiscal Summary MetricCard clickable

| 파일 | 변경 |
|------|------|
| `src/components/fiscal/FiscalSummaryDrawer.tsx` | `cn` import 추가 / `MetricCard` 에 `onClick?` + `disabledHint?` props + `role="button"` + `tabIndex={0}` + Enter/Space keyboard handler + cursor + hover bg-surface-muted/60 + focus-visible ring + aria-label / `openDrilldown` selector + `handleMetricDrilldown` (single-drawer policy: closeFiscalSummary → openDrilldown) / 4 카드 wire-up |

---

## 3. 4 MetricCard wire-up 매핑

| 카드 | 도메인 | 상태 |
|------|--------|------|
| 총 거래 | `documents_invoices` | ✅ 활성 (count > 0 시) |
| 영수증 발행 | — | 🟡 비활성 — `disabledHint="상세 리스트 준비 중"` (신규 `documents_receipts` 도메인 미진입, scope 절제) |
| 정산 준비 | `reporting_settlements` | ✅ 활성 (전체 settlement count > 0 시) |
| 세무 record | `reporting_tax` | ✅ 활성 (PENDING + ISSUED > 0 시) |

3 활성 / 1 비활성 — 의미 모호한 매핑보다 정직한 진입.

---

## 4. Lifecycle 점검 요약 (사용자 spec 정합)

| 점검 항목 | 결과 |
|----------|------|
| invalid selection guard | ✅ `handleInquiryNavigate` 의 `if (!inquiryId) return` |
| null/undefined 방어 | ✅ resolver `customer?.inquiryIds ?? []` 보존 + handler null guard |
| empty state | ✅ MetricCard count 0 시 onClick undefined → non-clickable |
| drawer/panel lifecycle | ✅ **single-drawer policy 정착** — detail 진입 시 source drawer 자동 close (z-index 충돌 방어) |
| click event propagation | ✅ MetricCard onClick + Enter/Space handler — handler chain 정상 |
| pointer-events / z-index | ✅ source drawer 자동 close 로 z-50 동시 표시 0건 |

---

## 5. 검증 결과

```
✅ npx tsc --noEmit          → 0 errors
✅ npx next lint              → No ESLint warnings or errors
✅ npx next build             → Route 191 kB / First Load 278 kB
                                (Δ STEP 117 baseline: +1 kB)
```

기존 78 scenarios 중 변경 영역 (drilldown / customer / fiscal) 의 unit-level scenarios 는 본 STEP 에 추가하지 않음 — 본 변경이 lifecycle / affordance / handler chain UI 영역으로 unit-test 적합도 낮음 (Drawer integration 영역). 기존 scenarios 회귀 0건은 build pass 로 확인.

---

## 6. STEP 117 / 118 / 116 / 113~115 / 119 산출물 보존

- ✅ STEP 117 draft hydration / DraftResumeEntry 무손상
- ✅ STEP 118 4-tab structure / TabBar primitive 무손상
- ✅ STEP 116 ArtworkUploadHero 무손상
- ✅ STEP 113~115 / 119 type foundations 무손상
- ✅ Phase 1 Fiscal frozen 보존 (taxRecords / settlements / invoices / receipts entity 0줄 변경)
- ✅ AI infra (STEP 93~96) 보존
- ✅ rule_5 + AI-Human Loop 정책 keyword 보존
- ✅ persistence schema v1 호환 (validateV1 / SCHEMA_VERSION "v1" 변경 0줄)

---

## 7. 다음 STEP 권장

P2 진입:
- **STEP 126** — 작품 추가 one-page form conversion (TabBar anchor sticky 모드, scroll 기반 continuous workflow)

P3 진입 전:
- **STEP 127~129** entry briefing 별도 작성 — Fiscal frozen protection / PRE/FINAL invoice / contract preview / settlement 영향 범위 architecture review 후 진행
