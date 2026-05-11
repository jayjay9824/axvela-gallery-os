# STEP 83 — Audit Event Export — Completion Report

## State

**STEP 82 baseline (144 kB) → STEP 83 complete (145 kB).**
Build / type-check / lint all green.
Route delta: **+1 kB** (system-audit-export lib + ExportButton + footer rewire).
ZIP: `axvela-step83-audit-export.zip`.

---

## 1. Current Audit Architecture (분석)

| Layer | STEP | 역할 |
|---|---|---|
| Data accumulation | STEP 65 + STEP 80~82 | SystemAuditEvent localStorage `axvela.audit.v1` cap=500 |
| Visualization | STEP 65 | AuditLogViewerDrawer (Owner-only) — list + filter + clear |
| Navigation | STEP 78 | 4 drilldown domains (audit_events / category / severity / action) |
| **Portability** | **STEP 83** ← **본 STEP** | **CSV / JSON export — \"What you see is what you export\"** |

이전 STEP까지의 한계: **device-local에 갇힌 audit log** — 운영자가 분기 보고 / 인수인계 / 외부 검토 시 데이터를 가져갈 방법 0건. STEP 83에서 portability layer 추가.

### 분리 정책 명확
- **STEP 25 `src/lib/audit-export.ts`** → artwork-scoped (`ClassifiedAuditEvent` / TimelineEvent + 분류 메타) — \"이 작품의 audit history\"
- **STEP 83 `src/lib/system-audit-export.ts`** → system-level (`SystemAuditEvent` — artworkId 부재) — \"이 device의 시스템 운영 history\"

두 모듈은 의도적으로 별개 — STEP 65 핵심 설계 (artwork-scoped vs system-level audit 분리)가 export layer까지 일관 적용.

---

## 2. New Files

### `src/lib/system-audit-export.ts` (~280 LOC) ← **신규**

```typescript
// Public types
export type SystemAuditExportFormat = "csv" | "json";

export interface SystemAuditExportFilters {
  category: AuditCategory | "all";
  severity: AuditSeverity | "all";
  timeRange?: { fromIso: string; toIso: string } | null;  // 향후 viewer 확장 시 호환
  searchQuery?: string;                                    // 향후 viewer 확장 시 호환
}

export interface SystemAuditExportContext {
  generatedAt: string;
  filters: SystemAuditExportFilters;
  totalEventCount: number;
}

// Public API
export function buildSystemAuditFilename(format, generatedAt): string
export function exportSystemAudit(format, events, ctx): void  // 단일 dispatcher
```

**내부 helpers**: `csv()` (RFC 4180 quote escape), `triggerDownload()`, `formatHumanDate()`, `pad2()`, `filterLabelCategory()` / `filterLabelSeverity()` / `filterLabelTimeRange()` (한국어 라벨 매핑).

### `STEP_83_AUDIT_EXPORT_COMPLETE.md` ← **신규** (본 문서)

---

## 3. Changed Files

### `src/components/admin/AuditLogViewerDrawer.tsx` (~70 LOC 추가)
- import `exportSystemAudit` from `@/lib/system-audit-export`
- **`handleExport(format)` callback** — filtered events + viewer state를 ctx에 매핑하여 export 호출
- **footer 확장**: `[span][닫기]` → `[span][CSV][JSON][닫기]` (rule_15 한도 내)
- **신규 sub-component `ExportButton`** — Button primitive 변형 대신 작은 outlined button (rule_16 minimalism)
- 헤더 주석 STEP 83 정책 추가 (language policy 부정형 only / portability 정착 / What-you-see-is-what-you-export)

### `ARCHITECTURE.md`
STEP 83 entry append (~10 KB).

### Untouched
- `src/types/audit-event.ts` (SystemAuditEvent type) — **0줄**
- `src/lib/audit-log-storage.ts` — **0줄**
- `src/lib/audit-export.ts` (STEP 25 artwork-scoped) — **0줄** (별개 모듈)
- `appendAuditEvent` action — **0줄**
- Persistence schema (`validateV1` / `SCHEMA_VERSION` / `PersistedState`) — **0줄**
- STEP 78 drilldown system — **0줄**
- 모든 도메인 / Sidebar / 3-Column 레이아웃 — **0줄**

---

## 4. CSV Structure

### Filename
```
axvela-audit-{YYYYMMDD-HHMM}.csv
```

### File contents
```
\uFEFF# AXVELA 운영 감사 로그 export\r\n
# exportedAt,2026-05-04 14:30\r\n
# category,전체\r\n
# severity,전체\r\n
# timeRange,전체\r\n
# totalEvents,42 / 전체 87\r\n
# 운영 참고용 — device-local 기록 · 회계 확정 / 외부 신고 / 법적 효력과 무관합니다.\r\n
\r\n
createdAt,category,severity,action,message,actorRole,targetType,targetRef\r\n
"2026-05-04T14:25:33.123Z","이미지 저장소","정보","orphan_remove_request_success","orphan candidate 제거 요청 완료 — artworks/...","OWNER","blob","artworks/abc-def.jpg"\r\n
"2026-05-04T14:20:11.456Z","권한","정보","role_promote","권한 변경 — 매니저 → 대표","MANAGER","role","OWNER"\r\n
...
```

**기술 사양**:
- UTF-8 BOM (`\uFEFF` prefix) — Excel 한글 자동 인식
- CRLF (`\r\n`) line ending — RFC 4180 + Windows 호환
- `csv()` quote escape — `"` 포함 / 쉼표 / 줄바꿈 시 자동 quote, 내부 `"`는 `""`로 escape
- 5-row metadata header (`#` 접두) + disclaimer 1행 + 빈 행 (Excel 시각 분리) + column header + data rows
- 한국어 라벨 매핑 — `AUDIT_CATEGORY_LABEL_KR` / `AUDIT_SEVERITY_LABEL_KR`

### Columns (사용자 spec section 4)
| # | Column | Source |
|---|---|---|
| 1 | createdAt | `event.createdAt` (ISO) |
| 2 | category | 한국어 라벨 (이미지 저장소 / 백업 / 복원 / 권한 / 시스템) |
| 3 | severity | 한국어 라벨 (정보 / 주의 / 오류) |
| 4 | action | `event.action` verbatim (snake_case mono) |
| 5 | message | `event.message` 한국어 |
| 6 | actorRole | `STAFF` / `MANAGER` / `OWNER` |
| 7 | targetType | `event.targetType ?? ""` |
| 8 | targetRef | `event.targetRef ?? ""` |

---

## 5. JSON Structure

### Filename
```
axvela-audit-{YYYYMMDD-HHMM}.json
```

### Shape (`{ metadata, filters, events }` — 사용자 spec section 5)
```json
{
  "metadata": {
    "exportedAt": "2026-05-04T14:30:00.000Z",
    "filteredEventCount": 42,
    "totalEventCount": 87,
    "schemaVersion": "v1",
    "deviceLocal": true,
    "disclaimer": "운영 참고용 — device-local 기록 · 회계 확정 / 외부 신고 / 법적 효력과 무관합니다."
  },
  "filters": {
    "category": "all",
    "severity": "all",
    "timeRange": null,
    "searchQuery": null
  },
  "events": [
    {
      "id": "aud_xxx",
      "createdAt": "2026-05-04T14:25:33.123Z",
      "category": "image_storage",
      "severity": "info",
      "action": "orphan_remove_request_success",
      "message": "orphan candidate 제거 요청 완료 — artworks/...",
      "actorRole": "OWNER",
      "actorLabel": "Owner",
      "targetType": "blob",
      "targetRef": "artworks/abc-def.jpg",
      "metadata": {
        "pathname": "artworks/abc-def.jpg",
        "size": 1234567,
        "uploadedAt": "2026-05-01T...",
        "provider": "vercel_blob"
      }
    },
    ...
  ]
}
```

**기술 사양**:
- `JSON.stringify(payload, null, 2)` — 2-space pretty (사용자 spec)
- `events`는 `SystemAuditEvent` raw shape 그대로 (11 필드: id / createdAt / category / severity / action / message / actorRole / actorLabel / targetType / targetRef / metadata) — 향후 import flow 가능성 열어 둠 (본 STEP scope 외)
- `targetType` / `targetRef` / `metadata` 부재 시 `null` (JSON undefined 회피)

---

## 6. Validation 결과

```
✓ npx tsc --noEmit              — 0 errors
✓ npx next lint                  — No ESLint warnings or errors
✓ npx next build                 — Route 145 kB / First Load 232 kB
                                   (+1 kB delta vs STEP 82 baseline 144 kB)
```

### Forbidden Language Verification
```
$ grep -nE "법적 감사 기록|certified audit|tamper-proof|compliance guaranteed|forensic evidence" \
    src/lib/system-audit-export.ts \
    src/components/admin/AuditLogViewerDrawer.tsx

→ matches: 정책 주석 forbidden list만 ("// - 금지: ...")
→ UI 텍스트 / message / metadata / filename / column header / disclaimer 노출 0건
```

### 권장 표현 사용
- "운영 참고" / "운영 참고용" / "device-local" / "audit event" / "운영 감사 로그 export"
- 모든 disclaimer 부정형 only — "회계 확정 / 외부 신고 / 법적 효력과 **무관합니다**"

### Filter Inheritance 검증
- ctx.filters.category ← `categoryFilter` (viewer state)
- ctx.filters.severity ← `severityFilter` (viewer state)
- ctx.filters.timeRange ← `null` (viewer 미구현 — 향후 호환)
- ctx.filters.searchQuery ← `undefined` (viewer 미구현 — 향후 호환)
- events ← `filtered` (이미 categoryFilter / severityFilter 적용된 배열)

→ **What you see is what you export** 정확 매칭

### Disabled state 검증
- `filtered.length === 0` → CSV / JSON 둘 다 disabled (opacity-50 + cursor-not-allowed)
- `auditEvents.length === 0` (viewer 빈 상태) → 자동으로 filtered도 빈 배열 → 두 button disabled
- `handleExport`에 안전 가드 — disabled 우회 호출 시 early return

---

## 7. Manifesto Alignment

| Rule | 적용 |
|---|---|
| **rule_4 Trust Layer portability 정착** | device-local audit이 외부 반출 가능해짐. 결과 보장 표현 0건, 부정형 disclaimer만 |
| **rule_5 AI-Human Loop** | AI 자동 0건 / 사용자 명시 클릭 (CSV / JSON 버튼) trigger |
| **rule_7 RBAC** | AuditLogViewerDrawer 진입 자체에 `audit.view` Owner-only 가드 — export button은 그 안에서만 |
| **rule_14 Layout** | 3-Column 0줄 변경 |
| **rule_15 Max 3 buttons** | footer [CSV][JSON][닫기] 정확히 3개 — 한도 내 |
| **rule_16 미니멀 디자인** | ExportButton 작은 outlined / 절제된 톤 / 그림자 0 / text-first |
| **rule_17 Layer UI** | Modal / Drawer 추가 0개 — 기존 viewer footer 안에서만 |

---

## 8. Affected Domains Verification

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
| Image Cleanup (STEP 80) | **0줄** |
| Backup-Restore (STEP 81) | **0줄** |
| Permission audit (STEP 82) | **0줄** |
| Inquiry / Transaction / Invoice / Contract / Curation | **0줄** |
| 작품 TimelineEvent | **0줄** |
| artwork-scoped audit-export.ts (STEP 25) | **0줄** (별개 모듈) |
| Drilldown system (STEP 67/78) | **0줄** |
| Sidebar (STEP 74) | **0줄** |
| RoleSwitcher | **0줄** |
| 3-Column 레이아웃 | **0줄** |
| `package.json` | **0줄** |

---

## 9. STEP 83 — Stable Cut-off Point 평가

### Governance Layer 4단계 완성도

| # | 단계 | STEP | 상태 |
|---|---|---|---|
| 1 | **데이터 누적** (audit append 통합) | STEP 65 / 80 / 81 / 82 | ✅ 4/5 카테고리 활성 |
| 2 | **시각화** (viewer + filter) | STEP 65 | ✅ AuditLogViewerDrawer |
| 3 | **Navigation** (drilldown) | STEP 78 | ✅ 4 audit drilldown domains |
| 4 | **Portability** (export) | **STEP 83** | ✅ **CSV / JSON 반출 경로** |

→ **governance loop closure 도달**. STEP 65부터 18 STEP에 걸쳐 정착된 audit governance가 \"기록 → 보기 → 탐색 → 반출\" 4단계 모두 cover.

### Stable Cut-off 적격성

✅ **빌드 안정성**: STEP 76(141 kB) → STEP 80(142 kB) → STEP 81(144 kB) → STEP 82(144 kB) → STEP 83(145 kB) — 5 STEP 누적 +4 kB, 모두 type-check / lint / build 연속 green
✅ **결합도 안전성**: STEP 80~83 모두 *기존 도메인 0줄* 변경, audit layer 단독 진화 (Reporting / Logistics / Documents / Customer / Payment / Settlement / Tax / FX / AI / Image / Backup 모두 무관)
✅ **사용자 가치**: device-local audit이 외부 반출 가능해진 시점 — 운영자가 실 사용 시 \"분기 보고서 작성\" / \"인수인계\" / \"외부 검토\" 등 즉시 활용 가능
✅ **회귀 risk 낮음**: STEP 83은 신규 lib 1개 + drawer footer 70 LOC로 변경 범위 작음
✅ **manifesto 적합**: rule_4 Trust Layer portability 정착, rule_15/16/17 모두 보존

### 미완 영역 (향후 STEP)

❎ **`system` 카테고리 미사용** — STEP 78 CategoryChipsRow 5번째 chip 영구 disabled (STEP 84 system health audit으로 향후 활성)
❎ **시각적 trend** — 시간축 흐름 표시 (STEP 85 audit trend visualization)
❎ **Import flow** — STEP 83에서 export-only, JSON shape는 import 가능 구조이지만 별도 STEP 필요

### **결론**

**STEP 83은 stable cut-off point로 적합합니다.**

- governance 4단계 cover 완료 → 의미 있는 milestone
- 누적 위험 낮음 (STEP 80~83 모두 audit layer 단독, 도메인 0줄)
- 즉시 운영 가치 (실 사용 시 외부 반출 가능)
- 향후 확장 path 명확 (STEP 84/85 모두 본 STEP 위에 자연 add-on)

**중간 업데이트 cut**으로 권장합니다.
