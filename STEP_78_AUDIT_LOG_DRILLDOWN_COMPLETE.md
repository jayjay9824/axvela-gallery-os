# STEP 78 — Audit Log Filter Drilldown — Completion Report

## State

**STEP 80 baseline (142 kB) → STEP 78 complete (143 kB).**
Build / type-check / lint all green.
ZIP: `axvela-step78-audit-log-drilldown.zip`.

---

## Flow

```
AuditLogViewerDrawer
  ├ SummaryRow (4 cards) ──── click ──→ audit_events / audit_severity {info|warning|error}
  ├ CategoryChipsRow (5 chips) ── click ──→ audit_category {auditCategory}
  └ ActionBreakdownRow (top 5 chips) ── click ──→ audit_action {auditAction}
                                                           │
        (closeAuditViewer → setTimeout(0) — no modal stacking)
                                                           │
                                                           ↓
                       OperationalDrilldownDrawer (STEP 67 reusable)
                       ├ filtered SystemAuditEvent list (resolveAuditEvents)
                       ├ 6 columns: 시점 / 카테고리 / 단계 / 동작 / 대상 / 메시지
                       └ row click (if row.artworkId)
                                              │
                                              ↓
                              setSelectedArtwork → close → DetailPanel sync (rule_1)
```

---

## UI Location

| Layer | Element | STEP |
|---|---|---|
| Sidebar | `운영 로그` 메뉴 (Owner 전용) | STEP 65 그대로 |
| Drawer | `AuditLogViewerDrawer` (w-[760px]) | STEP 65 외피 그대로 |
| Drawer header | `SummaryRow` 4 cards (전체 / 정보 / 주의 / 오류) — **모두 ClickableMetric** | **STEP 78** |
| Drawer header | `CategoryChipsRow` (5 카테고리) — **모두 ClickableMetric** | **STEP 78** |
| Drawer header | `ActionBreakdownRow` (top 5 actions) — **모두 ClickableMetric** | **STEP 78** |
| Drawer header | `FilterRow` (category / severity select + clear) | STEP 65 그대로 |
| Drawer body | `AuditEventRow` list (expandable metadata) | STEP 65 그대로 |
| **Layer 2** | `OperationalDrilldownDrawer` (STEP 67) — `resolveAuditEvents` 결과 표 | **STEP 78** |

3-Column 레이아웃 0줄 변경. 두 drawer는 close→setTimeout→open 패턴으로 *하나씩만 노출* (rule_17 — no modal stacking chaos).

---

## New / Changed Files

### Modified (4)
1. **`src/types/drilldown.ts`** (~30 LOC)
   - `DrilldownDomain` enum: 4 audit domains 추가 (audit_events / audit_category / audit_severity / audit_action)
   - `DrilldownPayload`: `auditCategory` / `auditSeverity` / `auditAction` 필드 추가
   - `DrilldownStateSubset`: `auditEvents: ReadonlyArray<SystemAuditEvent>` 추가

2. **`src/lib/drilldown-resolver.ts`** (~250 LOC)
   - SystemAuditEvent / AUDIT_CATEGORY_LABEL_KR / AUDIT_SEVERITY_LABEL_KR import
   - dispatch switch: 4 audit case 추가 (모두 `resolveAuditEvents`로 dispatch)
   - `AUDIT_DOMAIN_TITLE_KR` map (4 entries)
   - `auditSeverityTone(severity): DrilldownTone` helper
   - `extractAuditArtworkRef(event): string | undefined` helper
   - `buildAuditFilterContext(payload): string[]` helper
   - `formatAuditTimestamp(iso): string` helper
   - `resolveAuditEvents(payload, state): DrilldownResolverResult` 핵심 함수

3. **`src/components/drilldown/OperationalDrilldownDrawer.tsx`** (~10 LOC)
   - `auditEvents` selector + useMemo deps 갱신
   - flat array passthrough (flatten 호출 0건 — store가 이미 flat array)
   - 코어 row click / table render / EmptyState 0줄 변경

4. **`src/components/admin/AuditLogViewerDrawer.tsx`** (~150 LOC)
   - ClickableMetric / openDrilldown / closeAuditViewer hookup
   - `categoryCounts` useMemo (5 categories)
   - `actionBreakdown` useMemo (top 5, count desc → action asc)
   - `handleOpenAuditDrilldown(domain, extra)` — 4 domain + 3 extra fields
   - `SummaryRow` 4 cards: 모두 ClickableMetric wrap
   - `CategoryChipsRow` 신규 컴포넌트 (5 chips)
   - **`ActionBreakdownRow` 신규 컴포넌트** (조건부 — `entries.length >= 2` 일 때만 렌더)
   - `CategoryChip` / `ActionChip` 시각 sub-components

### Added (2)
5. **`STEP_78_AUDIT_LOG_DRILLDOWN_COMPLETE.md`** — 본 문서
6. **`ARCHITECTURE.md`** — STEP 78 entry append (~13 KB)

### Untouched
- `audit-event.ts` type (STEP 65) — **0줄 변경**
- `audit-log-storage.ts` (`axvela.audit.v1`) — 0줄 변경
- `appendAuditEvent` / `clearAuditEvents` actions — 0줄 변경
- `ImageCleanupDrawer` (STEP 80) — 0줄 변경
- `/api/upload-image` / `/api/delete-image` / `/api/list-images` — 0줄 변경
- Persistence schema (`validateV1` / `SCHEMA_VERSION`) — 0줄 변경

---

## Route Size Delta

```
Before STEP 78:  / 142 kB / 229 kB First Load JS
After  STEP 78:  / 143 kB / 230 kB First Load JS
                 +1 kB (resolver helpers + ActionBreakdownRow + extended types)
```

Build pipeline:
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (7/7)
✓ No ESLint warnings or errors
```

---

## New Drilldown Domains

| Domain | Trigger | Filter Inherited |
|---|---|---|
| `audit_events` | SummaryRow "전체" card | (none — 전체 운영 로그) |
| `audit_severity` | SummaryRow info / warning / error cards (×3) | `auditSeverity` |
| `audit_category` | CategoryChipsRow 5 chips (image_storage / backup / restore / permission / system) | `auditCategory` |
| `audit_action` | ActionBreakdownRow top 5 chips | `auditAction` (free string) |

All 4 domains dispatch to single `resolveAuditEvents(payload, state)` — title + filter parsing 분기만 차이.

---

## Resolver Logic Summary

```
resolveAuditEvents(payload, state):
  1. Filter cascade — auditCategory / auditSeverity / auditAction / period 각 독립
  2. 결정성 정렬 — createdAt desc → id asc
  3. artworkLookup으로 artworkRef 방어적 검증
     → row.artworkId 채워진 경우만 navigate 가능
  4. row.cells 6 column:
     - time      : YYYY-MM-DD HH:MM
     - category  : 한국어 라벨 (이미지 저장소 / 백업 / 복원 / 권한 / 시스템)
     - severity  : 한국어 라벨 + DrilldownTone (info / warning / error)
     - action    : verbatim mono + actor meta
     - target    : linkedArtwork 있으면 작품 title + axid.code
                   없으면 targetType + targetRef 분리 노출
     - message   : audit message verbatim
  5. Title — 4 도메인별 + 필터 inherit
     (예: "운영 로그 — 이미지 저장소" / "운영 로그 — 오류" / "운영 로그 — orphan_remove_request_failed")
  6. Context — "{N}건 · {filter parts} · N건 작품 이동 가능"
                                          또는 "작품 link 없음 — 시스템 기록만 표시"
```

### `extractAuditArtworkRef(event)` Priority
```
(1) event.metadata.artworkId  (string + length > 0)   ← 향후 forward-compat
(2) event.targetType === "artwork" + event.targetRef  ← 명시 패턴
(3) undefined                                         ← non-clickable row
```

현재 STEP 80 `orphan_remove_request_*`는 (1)/(2) 모두 미해당 — orphan은 정의상 작품 미연결 → row visible but non-clickable. 안전 가드.

---

## AuditLogViewerDrawer Integration Sites

| # | Site | Component | Drilldown |
|---|---|---|---|
| 1 | 전체 카운트 | `SummaryRow` 4 cards 첫 번째 | `audit_events` |
| 2 | 정보 카운트 | `SummaryRow` 두 번째 | `audit_severity` `{info}` |
| 3 | 주의 카운트 | `SummaryRow` 세 번째 (warning > 0 시 emphasized) | `audit_severity` `{warning}` |
| 4 | 오류 카운트 | `SummaryRow` 네 번째 (error > 0 시 emphasized) | `audit_severity` `{error}` |
| 5 | 카테고리 chip × 5 | `CategoryChipsRow` (image_storage / backup / restore / permission / system) | `audit_category` `{cat}` |
| 6 | 동작 chip × 1~5 | `ActionBreakdownRow` (top 5, length ≥ 2 시만 렌더) | `audit_action` `{action}` |

**Total: 1 + 3 + 5 + (up to 5) = up to 14 click sites.** 모두 `ClickableMetric` only — 기존 visual style 보존 (rule_16 minimalism).

---

## Artwork Navigation Behavior

| 상황 | row | UX |
|---|---|---|
| metadata.artworkId 있는 audit | clickable | row click → `setSelectedArtwork(artworkId)` → close drawer → DetailPanel sync (rule_1) |
| targetType="artwork" + targetRef | clickable | 동일 |
| 둘 다 부재 (예: STEP 80 orphan_remove_request_*) | **non-clickable** | row visible · cursor-default · hover 0 |
| metadata.artworkId가 store에 없음 | **non-clickable** | artworkLookup 검증 실패 → row.artworkId undefined |

context line의 `N건 작품 이동 가능` 라벨로 운영자에게 navigate 가능 row 카운트 transparent 노출.

---

## Regression Verification

| 영역 | 검증 결과 |
|---|---|
| STEP 65 `SystemAuditEvent` type | ✅ 0줄 변경 |
| STEP 65 `audit-log-storage.ts` (`axvela.audit.v1`) | ✅ 0줄 변경 |
| STEP 65 `appendAuditEvent` / `clearAuditEvents` actions | ✅ 0줄 변경 |
| STEP 65 AuditLogViewerDrawer 외피 (Drawer wrapper / RBAC / EmptyState / FilterRow / `AuditEventRow` 본체) | ✅ 보존 — 새 SummaryRow / CategoryChipsRow / ActionBreakdownRow 추가만 |
| STEP 80 `orphan_remove_request_success` / `_failed` audit append | ✅ 0줄 변경 |
| STEP 80 ImageCleanupDrawer / RemoveRequestConfirmModal | ✅ 0줄 변경 |
| STEP 67 OperationalDrilldownDrawer 코어 (table render / row click / EmptyState / footer) | ✅ 0줄 — auditEvents selector 1줄 + useMemo deps만 |
| STEP 67 ClickableMetric | ✅ 0줄 변경 — 재사용 only |
| STEP 67/70/72/73/74 의 24개 다른 drilldown 도메인 | ✅ 0줄 변경 |
| `/api/upload-image` (STEP 57) | ✅ 0줄 변경 |
| `/api/delete-image` (STEP 61) | ✅ 0줄 변경 |
| `/api/list-images` (STEP 62) | ✅ 0줄 변경 |
| Persistence schema (`validateV1` / `SCHEMA_VERSION`) | ✅ 0줄 변경 |
| Drawer / Modal / Button primitive | ✅ 재사용 only |
| 3-Column 레이아웃 | ✅ 0줄 변경 |
| Sidebar (STEP 74 status drilldown) | ✅ 0줄 변경 |
| artwork-scoped AuditLogDrawer (timeline 별개 drawer) | ✅ 0줄 변경 |

---

## Affected Domains Verification

| 도메인 | 변경 |
|---|---|
| Reporting | **0줄** |
| Logistics | **0줄** |
| Documents Hub | **0줄** |
| Customer | **0줄** |
| Payment | **0줄** |
| Settlement | **0줄** |
| Tax | **0줄** |
| FX | **0줄** |
| AI Market Analysis | **0줄** |
| Backup-Restore | **0줄** |
| Image Cleanup (STEP 80) | **0줄** |
| Inquiry / Transaction / Invoice / Contract / Curation | **0줄** |
| 작품 TimelineEvent | **0줄** |
| artwork-scoped AuditLogDrawer | **0줄** |
| DetailPanel | **0줄** |
| Sidebar (STEP 74) | **0줄** |
| 3-Column 레이아웃 | **0줄** |
| `package.json` | **0줄** |

---

## Validation

```
✓ npx tsc --noEmit              — 0 errors
✓ npx next lint                  — No ESLint warnings or errors
✓ npx next build                 — Route 143 kB / First Load 230 kB
```

---

## Forbidden Language Verification

```
$ grep -nE "legal audit|forensic proof|tamper-proof|compliance guaranteed|permanent record" \
    src/components/admin/AuditLogViewerDrawer.tsx \
    src/lib/drilldown-resolver.ts \
    src/types/drilldown.ts

→ matches: 정책 주석 내부 forbidden list만 ("// - 금지: ...")
→ UI 텍스트 / message / metadata / aria-label / title 노출 0건
```

권장 표현 사용 11+ 회: "운영 로그" / "시스템 기록" / "운영 참고" / "상세 보기" / "연결 이벤트" / "작품 이동 가능" / "작품 link 없음".

---

## Manifesto Alignment

| Rule | 적용 |
|---|---|
| **rule_1 Artwork-First** | row.artworkId 추출 시 작품 navigate; 부재 시 visible but non-clickable |
| **rule_4 Trust Layer 강화** | audit가 단순 기록물 → 운영 graph의 일부로 격상 |
| **rule_5 AI-Human Loop** | AI 자동 0건 / 모든 진입은 운영자 명시 클릭 |
| **rule_7 RBAC** | AuditLogViewerDrawer 진입 시 `audit.view` Owner-only 가드 (STEP 65 그대로) |
| **rule_8 Timeline = Navigation 완전성** | 본 STEP으로 system-level governance까지 operational graph navigation cover |
| **rule_14 Layout** | 3-Column 0줄 변경 |
| **rule_15 Max 3 buttons** | 두 drawer 각각 footer "닫기" 1개 — 한도 내 |
| **rule_16 미니멀 디자인** | text-first chip strip / 작은 typography / 그림자 0 / actionBreakdown은 length ≥ 2 가드 |
| **rule_17 Layer UI** | closeAuditViewer → setTimeout(0) → openDrilldown 패턴 — modal stacking chaos 0건 |
