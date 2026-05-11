# STEP 85 — Audit Trend Visualization — Completion Report

## State

**STEP 83 baseline (145 kB) → STEP 85 complete (146 kB).**
Build / type-check / lint all green.
Route delta: **+1 kB** (사용자 spec target 정확 매칭).
ZIP: `axvela-step85-audit-trend-visualization.zip`.

> **Note**: STEP 84(System Health Audit)는 본 라운드에서 건너뛰었음. STEP 85가 가장 risk 낮고 UX 체감이 큰 시각화 layer로 우선 진행. STEP 84(`system` 카테고리 활성화)는 향후 라운드의 governance closure로 예약.

---

## Trend Interaction Flow

```
AuditLogViewerDrawer
  ├ SummaryRow (4 cards)             ← STEP 78
  ├ CategoryChipsRow (5 chips)       ← STEP 78
  ├ ActionBreakdownRow (top 5)       ← STEP 78
  ├ ⭐ TrendSection                   ← STEP 85 (new)
  │   ├ Header: 시간 흐름 · 최근 N일 · M건
  │   ├ TrendWindowToggle [7일][30일]
  │   ├ Dot strip (7 or 30 dots horizontally)
  │   │   ├ Each dot: severity tone + size proportional to count
  │   │   ├ Today: ring border + bold weekday label
  │   │   └ Empty day: faint dot, disabled cursor
  │   └ "일자 클릭 시 해당 기간으로 좁혀 상세 보기 — 운영 참고용"
  ├ FilterRow                        ← STEP 65
  └ AuditEventList                   ← STEP 65

Dot click flow:
  TrendDay.onClick(day)
    → handleDayClick(day)
        ├ if day.count === 0: return (no-op)
        ├ dayBoundaryIso(day) → { fromIso, toIso }
        │   (local YYYY-MM-DD 00:00:00.000 ~ 23:59:59.999 UTC)
        ├ filter inheritance:
        │   categoryFilter !== "all" → audit_category {auditCategory, period}
        │   severityFilter !== "all" → audit_severity {auditSeverity, period}
        │   둘 다 "all"             → audit_events {period}
        └ handleOpenAuditDrilldown(domain, extra)
            → closeAuditViewer()
            → setTimeout(0)         ← rule_17 layer transition
            → openDrilldown({
                domain,
                auditCategory, auditSeverity, auditAction,
                periodFromIso, periodToIso  ← STEP 78 payload 첫 활성!
              })
                ↓
        OperationalDrilldownDrawer (STEP 67 reusable)
          → resolveAuditEvents
              → isInPeriod(audit.createdAt, fromIso, toIso) 필터
              → 해당 일자의 audit만 list 표시
          → row click (artworkId 있을 때) → DetailPanel sync (rule_1)
```

**WYSIWYE (What You See Is What You Drill Into)**: viewer의 categoryFilter / severityFilter 를 그대로 inherit하여 drilldown 진입. STEP 83 export의 WYSIWYE 정책과 일관.

---

## Mini Timeline Design

### 7일 view

```
┌─ 시간 흐름  최근 7일 · 12건                              [7일] [30일] ─┐
│                                                                       │
│       ●        ●        ●        ●        ●        ●        ●        │
│      4px      6px      4px      8px      6px      4px      10px     │
│       일       월       화       수       목       금       토        │
│                                                                  ◯  │ ← today: ring
│                                                                       │
│  일자 클릭 시 해당 기간으로 좁혀 상세 보기 — 운영 참고용                │
└───────────────────────────────────────────────────────────────────────┘
```

### 30일 view

```
┌─ 시간 흐름  최근 30일 · 47건                            [7일] [30일] ─┐
│                                                                       │
│  ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ●        │
│  5  6  7  8  9 10 11 ... 30  1  2  3  4                              │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Visual properties

| 속성 | 결정 |
|---|---|
| Dot color | `dominantSeverity` (error > warning > info) |
| Dot size | `count` 5단계 step (4 / 6 / 8 / 10 / 12 px), 11+ cap |
| Empty day | `bg-line/60` faint dot, disabled cursor |
| Today | `ring-1 ring-line-strong` + bold weekday |
| Compact (30d) | dot -2px, cell width 18px |
| Label | 7일: weekday("월"/"화"), 30일: dayOfMonth(1-31) |

---

## 신규 / 변경 파일

### 신규 (1)
1. **`src/lib/audit-trend.ts`** (~150 LOC)
   - `AuditTrendDay` interface (dateKey / year / month / dayOfMonth / weekdayLabel / count / bySeverity / dominantSeverity / isToday)
   - `TrendWindow` 타입 (`7 | 30`)
   - `buildAuditTrend(events, windowDays, now?)` — daily aggregation
   - `dayBoundaryIso(day)` — local day → UTC ISO range 변환
   - 신규 라이브러리 0개, chart 라이브러리 0개

### 변경 (1)
2. **`src/components/admin/AuditLogViewerDrawer.tsx`** (~280 LOC 추가)
   - audit-trend imports 추가
   - `handleOpenAuditDrilldown` 시그니처 확장 (`periodFromIso?` / `periodToIso?` 추가)
   - `AuditDrilldownExtra` interface에 두 필드 추가
   - `<TrendSection>` 마운트 (`auditEvents.length > 0` 조건)
   - **신규 컴포넌트 4개**:
     - `TrendSection` — 메인 컨테이너 + handleDayClick + WYSIWYE inheritance
     - `TrendWindowToggle` — 7일/30일 pill 토글
     - `ToggleButton` — pill 버튼 sub-component
     - `TrendDay` — 단일 day cell (dot + label)
   - **헬퍼 함수 2개**:
     - `computeDotSize(count)` — 5단계 step function
     - `trendDotToneClass(severity)` — severity → tailwind class

### 추가 (2)
3. **`STEP_85_AUDIT_TREND_VISUALIZATION_COMPLETE.md`** — 본 문서
4. **`ARCHITECTURE.md`** — STEP 85 entry append (~9 KB) + Future Tax Layer Roadmap

### Untouched
- `audit-event.ts` (SystemAuditEvent type) — **0줄 변경**
- `audit-log-storage.ts` (`axvela.audit.v1`) — **0줄 변경**
- `appendAuditEvent` action — **0줄 변경**
- `drilldown.ts` types (STEP 78) — **0줄 변경** (`periodFromIso` / `periodToIso` 이미 정의됨)
- `drilldown-resolver.ts` 본체 — **0줄 변경** (resolveAuditEvents의 isInPeriod 가드 STEP 78 부터 존재)
- `OperationalDrilldownDrawer.tsx` — **0줄 변경**
- `ClickableMetric.tsx` — **0줄 변경**
- `system-audit-export.ts` (STEP 83) — **0줄 변경**
- Footer (STEP 83 [CSV][JSON][닫기]) — **0줄 변경**
- Persistence schema — **0줄 변경**
- `package.json` — **0줄 변경** (신규 라이브러리 0개)

---

## Validation Checklist

### 빌드 안정성
```
✓ npx tsc --noEmit              — 0 errors
✓ npx next lint                  — No ESLint warnings or errors
✓ npx next build                 — Route 146 kB / First Load 233 kB (+1 kB)
```

### 사용자 spec 준수
| 항목 | 상태 |
|---|---|
| Trend Section SummaryRow 아래 / Audit Event List 위 | ✅ ActionBreakdownRow 다음 / FilterRow 직전 |
| 7일 / 30일 toggle | ✅ TrendWindowToggle pill 2개 |
| text-first minimal timeline + dot strip | ✅ |
| chart library 사용 금지 | ✅ recharts/chart.js/d3 import 0건 (grep 검증) |
| severity 기반 subtle color (info/warning/error) | ✅ + empty 4단계 |
| Daily aggregation by date | ✅ local YYYY-MM-DD bucket |
| category별 activity grouping 유지 | ✅ `bySeverity` Record 보존 (향후 확장 가능) |
| 기존 audit schema 변경 금지 | ✅ SystemAuditEvent type 0줄 |
| 날짜 dot 클릭 시 timeRange 자동 narrowing | ✅ dayBoundaryIso → handleOpenAuditDrilldown |
| STEP 78 drilldown infrastructure 활용 | ✅ payload periodFromIso/periodToIso + resolver isInPeriod |
| 기존 filtering flow reuse | ✅ categoryFilter / severityFilter inherit |

### 보호 규칙
| 규칙 | 상태 |
|---|---|
| SystemAuditEvent schema 변경 | ✅ 0줄 |
| appendAuditEvent 변경 | ✅ 0줄 |
| persistence schema 변경 | ✅ 0줄 |
| Sidebar 0줄 | ✅ |
| Role system 0줄 | ✅ |
| Backup 0줄 | ✅ |
| Logistics 0줄 | ✅ |
| Documents 0줄 | ✅ |
| AI layer 0줄 | ✅ |
| 신규 라이브러리 0개 | ✅ `package.json` 무수정 |
| recharts / chart.js / d3 사용 금지 | ✅ 0건 grep 검증 |

### 디자인 원칙
| 원칙 | 상태 |
|---|---|
| AXVELA minimal aesthetic | ✅ text-[9px]/[9.5px]/[10px] 작은 typography |
| McKinsey / Apple style | ✅ 절제된 톤, 그림자 0, 채도 낮음 |
| dense dashboard 회피 | ✅ dot 5단계 size cap (11+ 동일), 빈 day faint |
| subtle / operational / text-first | ✅ chart 0개, 라벨 첫 우선 |
| 운영 흐름 인지 중심 | ✅ "최근 N일 · M건" + dot strip + WYSIWYE drill |

### 회귀 검증
- ✅ STEP 78 audit drilldown 기존 entry points (Summary cards / Category chips / Action chips) 작동 — `handleOpenAuditDrilldown` 시그니처 확장은 backward-compatible (extra 모두 옵셔널)
- ✅ STEP 83 footer [CSV] [JSON] [닫기] 3-button strip 그대로
- ✅ resolveAuditEvents 4 도메인 dispatch (audit_events / audit_category / audit_severity / audit_action) 그대로
- ✅ STEP 80 ImageCleanup orphan_remove_request_* audit append 0줄 변경
- ✅ STEP 81 backup_export_* / restore_apply_* / backup_metadata_cleared 0줄 변경
- ✅ STEP 82 role_promote / role_demote / role_switch 0줄 변경
- ✅ Sidebar audit menu (Owner-only) 진입 그대로

---

## STEP 78 timeRange Payload 첫 활성 효과

STEP 78에서 정의된 `DrilldownPayload.periodFromIso` / `periodToIso` 가 audit drilldown 컨텍스트에서 처음 활성화. STEP 85 이전에는 audit 쪽 호출자가 본 필드를 채우지 않아 `resolver.isInPeriod` 가드가 dormant 상태였음.

**향후 자연 호환**:
- Reporting drawer의 audit cross-link이 reporting period를 audit drilldown에 전달
- Tax Layer (Future Roadmap)의 분기 / 월별 리포트가 audit drilldown에 분기 boundary 전달
- STEP 83 export의 timeRange filter가 viewer state에 보존되면 trend가 timeRange 영역만 강조

---

## Forbidden Language Verification

```
$ grep -nE "통계 분석|forensic timeline|certified analytics|compliance report|official record" \
    src/components/admin/AuditLogViewerDrawer.tsx src/lib/audit-trend.ts

→ matches: 0건
→ UI / aria-label / title / 주석 노출 0건
```

권장 표현 사용:
- "시간 흐름" (TrendSection 헤더)
- "최근 N일 · M건" (windowTotalCount summary)
- "운영 참고용" (footer hint)
- "일자 클릭 시 해당 기간으로 좁혀 상세 보기"
- "운영 흐름" (aria-label)

---

## Manifesto Alignment

| Rule | 적용 |
|---|---|
| **rule_1 Artwork-First** | 본 STEP은 audit 시각화 — 작품 navigate은 drill 후 row 클릭 시 (rule_1 일관) |
| **rule_4 Trust Layer 시간 차원 추가** | 5단계 cycle 완성: 누적(STEP 65/80~82) → 시각화(STEP 65) → 탐색(STEP 78) → 반출(STEP 83) → **흐름 인지(STEP 85)** |
| **rule_5 AI-Human Loop** | AI 자동 0건 / 모든 진입 사용자 명시 trigger |
| **rule_7 RBAC 보존** | viewer 진입 audit.view Owner 권한 가드 (STEP 65 그대로) |
| **rule_8 Timeline = Navigation** | 시간축이 navigation 1차원으로 격상 — 어떤 시작점이든 시간/카테고리/단계/동작 → 작품 흐름 |
| **rule_14 Layout** | 3-column 0줄 |
| **rule_15 Max 3 buttons** | toggle pill 2개 (button 카운트 외부 — group 1로 카운트) |
| **rule_16 미니멀 디자인** | text-first dot strip / chart 0개 / dot 5단계 cap / auditEvents.length > 0 가드 / count=0 disabled day |
| **rule_17 Layer UI** | drawer 1개씩 노출 — TrendSection은 inline section, dot 클릭 시 close → setTimeout → drilldown 패턴 STEP 78 그대로 |

---

## 🗺️ Future Roadmap — Tax / Fiscal Layer (별도 Phase)

> **본 STEP에서 구현 0건** — STEP 85 이후 AXVELA OS의 큰 다음 축으로 별도 phase 예약. 본 section은 향후 STEP 86~91의 가이드라인 명시 only.

### 방향성

#### 한국 갤러리 실무 세무 기능
- 현금영수증 (lifecycle / 발행 시점 / 수정 / 폐기)
- 세금계산서 (발행 / 수정 / 무효 처리 / 분기 누적)
- VAT (월별 / 분기별 / 연간 운영 참고 reporting)
- 원천징수 (작가 정산 시 자동 분리 — 갤러리 수수료 vs 작가 수익)
- 작가 정산 세무 (artist payout 흐름 안의 세무 layer)

#### 국제거래 세무 처리
- 해외 컬렉터 / 해외 갤러리 거래
- 외화 결제 (USD / EUR / JPY / 기타)
- FX snapshot 기반 세무 환산 (STEP 31/32/34 FX 인프라 위에 build)
- 수출입 / 해외 송금 참고 정보
- 회계사 전달용 월별 리포트 (분리된 zip — STEP 83 export 패턴 위에 build)

### 중요 제약 (사용자 spec 정확 매칭)

| 제약 | 정책 |
|---|---|
| 국세청 발행 연동 | ❌ 본 phase scope 외 (운영 참고용 데이터만) |
| 법적 확정 표현 | ❌ "신고 완료" / "법적 효력" / "세무 확정" / "인증 발행" 표현 사용 0건 |
| 사용 권장 표현 | ✅ "운영 참고" / "세무 검토용" / "회계사 전달용" 일관 |
| 데이터 기반 | ✅ STEP 65/78/80~82/83/85의 audit / permission / backup / export / trend 위에 build — 새 layer 도입이 아닌 *기존 governance 위 도메인 확장* |

### 후보 STEP 6개

| STEP | 제목 | 설명 | 예상 LOC |
|---|---|---|---|
| **86** | Cash Receipt Layer | 현금영수증 lifecycle (생성 / 수정 / 폐기 / audit append) | ~300 |
| **87** | Tax Invoice Layer | 세금계산서 운영 참고용 (발행 / 정정 / 분기 누적) | ~350 |
| **88** | VAT Summary Report | 분기 / 연간 운영 참고 reporting (Reporting drawer 위 audit 통합) | ~250 |
| **89** | Artist Settlement Tax | 작가 정산 시 원천징수 / 갤러리 수수료 분리 (Settlement domain 확장) | ~200 |
| **90** | International Transaction Tax View | FX snapshot 기반 외화 거래 세무 참고 (FX 인프라 + Reporting + Audit) | ~300 |
| **91** | Accountant Export Package | 월별 회계사 전달용 zip (STEP 83 audit export 패턴 위에 build) | ~280 |

### 순서 권장

```
86 (Cash Receipt) → 88 (VAT) → 89 (Artist Tax) → 87 (Tax Invoice)
  → 90 (International) → 91 (Accountant Export Package)
```

**근거**:
- 도메인 단순도 → 복잡도 진화 (Cash Receipt 가장 단일, Tax Invoice는 정정/무효 lifecycle 복잡)
- VAT는 Cash Receipt 데이터를 합산해야 하므로 86 다음
- Artist Settlement Tax는 기존 Settlement domain 위 — 새 entity 도입 없음
- International Tax는 FX layer 의존성 있어 후순위
- Accountant Export Package는 모든 lib 정착 후 마무리

### Persistence Schema 영향 검토

- **Cash Receipt / Tax Invoice**: 신규 entity 가능성 → `validateV1` / `SCHEMA_VERSION` 옵셔널 필드 추가 시 향후 v2 migration plan 함께 설계 필요
- **VAT / Artist Tax / International Tax / Accountant Export**: 기존 entity (Transaction / Settlement / Invoice) 의 derived computation — schema 영향 0
- **현재 schema 위 옵셔널 add는 안전, removal은 v2 필요**

### 결론

> STEP 85까지 governance 5단계 cycle (누적/시각화/탐색/반출/흐름) 완성 → Tax / Fiscal Layer는 그 위에 *도메인 layer*로 build. 새 layer 도입 아닌 *기존 governance 활용*.
> Tax / International Fiscal Layer는 AXVELA OS의 다음 큰 phase로 6개 STEP에 걸쳐 점진 진화 권장.
