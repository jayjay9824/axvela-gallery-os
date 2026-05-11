# STEP 58 — Logistics Operations 후속 (Bulk Sync + Calendar)

> **목표**: STEP 54 통합 view에 bulk provider sync + 출고 캘린더 추가. 운영자가
> "이번 주 출고 / 배송 / 검수 일정"을 한눈에 + 필터된 record들 일괄 조회.
> **STEP 50 single-record sync 흐름 0줄 변경 — 본 STEP은 orchestrator + view layer만 추가**.

---

## State

- **이전**: STEP 59 / Route 121 kB
- **이번**: STEP 58 / **Route 123 kB (+2 kB)**
- Build ✅ · type-check ✅ · Lint ✅

---

## 진행 이유

1. STEP 50 LogisticsProvider hook + STEP 54 통합 view 위에 운영 효율 향상
2. 개별 record sync (STEP 50) → 일괄 sync 필요
3. List view (STEP 54) → 시간 축 시각화 (이번 주 출고 일정) 필요
4. Provider 구조 재사용이라 신규 도메인 위험 0

---

## Flow

```
LogisticsOperationsDrawer (STEP 54)
  │
  ├─ KPI Section (변경 없음)
  ├─ BulkSyncBar  ← STEP 58 신규
  │     "현재 필터된 N건 · provider 일괄 조회 · locked는 자동 skip"
  │     [전체 Sync] 클릭
  │       ↓
  │     bulkSyncLogisticsFromProvider(ids[])
  │       ├─ Pre-classification: locked → skipped count
  │       └─ Per-record: STEP 50 syncLogisticsFromProvider 호출
  │             (provider call + state patch + timeline event)
  │       ↓
  │     { ok, skipped, failed } 결과를 BulkSyncBar에 표시
  │     "최근 조회 완료 · 성공 N · skip M · 실패 K"
  │
  ├─ FilterRow (변경 없음)
  ├─ ViewToggle  ← STEP 58 신규
  │     [리스트] [캘린더]   ← 토글
  │     캘린더 mode 시: [←] [2026년 5월] [→] [오늘] · 예정 일정 N건
  │
  └─ Body — viewMode 분기:
      ├─ "list" (기본 — 회귀 0건) → STEP 54 list 그대로
      └─ "calendar"  ← STEP 58 신규
            └─ CalendarGrid
                  ├─ Weekday header (일/월/화/수/목/금/토)
                  ├─ 6주 × 7일 = 42 cells
                  │   각 cell: 날짜 + items 카운트 + 최대 3개 item dot+제목
                  └─ Legend (status 색상 + "pickup > delivery > primary")

CalendarItem 클릭 흐름 (rule_1 자연 복귀):
  setSelectedArtwork(artworkId) → closeOps() → setTimeout(openLogisticsDetail)
  → list view와 동일
```

**STEP 50 흐름 0줄 변경** — 각 record는 기존 syncLogisticsFromProvider가 그대로 처리 (timeline event 포함). bulk action은 orchestrator일 뿐.

---

## 변경 / 신규 파일

### 신규 (1 + doc)

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/logistics-calendar.ts` | ~190 | Month grid 계산 + 날짜 우선순위 + 결정성 정렬 |
| `STEP_58_LOGISTICS_OPERATIONS_FOLLOWUP.md` | (이 문서) | 완료 보고 |

### 변경 (2 + ARCHITECTURE.md)

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/store/useArtworkStore.ts` | ~80 LOC | `bulkSyncLogisticsFromProvider` 신규 action |
| `src/components/logistics/LogisticsOperationsDrawer.tsx` | ~270 LOC | BulkSyncBar + ViewToggle + CalendarGrid + CalendarCellCard + CalendarItemRow |

---

## 핵심 코드

### 1) Month grid builder — 결정성 함수

```ts
// src/lib/logistics-calendar.ts

export function buildCalendarMonth(
  rows: LogisticsRow[],
  anchorDate: Date,
  now: Date = new Date()
): CalendarMonth {
  // 1) Grid 시작일 = anchor month 1일이 속한 주의 일요일
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startWeekday);

  // 2) 42 cells 초기화 + Map<isoDate, cell> lookup
  const cellByIso = new Map<string, CalendarCell>();
  for (let i = 0; i < 42; i++) { ... }

  // 3) Rows 한 번 순회 — O(N) row → O(1) cell lookup
  for (const row of rows) {
    const picked = pickCalendarDate(row);  // pickup > delivery > primary
    if (!picked) continue;  // skip — list view에서 보임
    const cell = cellByIso.get(toIsoDate(new Date(picked.date)));
    if (!cell) continue;
    cell.items.push({ row, pickedDate: picked.date, pickedFrom: picked.from });
    cell.countsByStatus[row.logistics.status] += 1;
  }

  // 4) Cell items 결정성 정렬 — pickedDate asc → logistics.id asc
  for (const cell of cells) cell.items.sort(...);

  return { anchorDate, cells, monthLabel, inMonthItemCount };
}
```

**날짜 우선순위 (사용자 spec)**:
```ts
function pickCalendarDate(row: LogisticsRow) {
  if (log.pickupDate)   return { date, from: "pickup" };
  if (log.deliveryDate) return { date, from: "delivery" };
  if (row.primaryDate)  return { date, from: "primary" };
  return null;  // grid에서 silent skip
}
```

### 2) Bulk sync orchestrator — STEP 50 재사용

```ts
// src/store/useArtworkStore.ts

bulkSyncLogisticsFromProvider: (logisticsIds) => {
  // 1. Pre-classification (locked → skipped count)
  const candidates: string[] = [];
  let skipped = 0;
  for (const id of logisticsIds) {
    const log = lookup.get(id);
    if (!log) continue;
    if (isLogisticsLocked(log.status)) { skipped += 1; continue; }
    candidates.push(id);
  }

  // 2. Per-record sync — STEP 50 흐름 그대로
  let ok = 0, failed = 0;
  for (const id of candidates) {
    const before = lookup.get(id);
    get().syncLogisticsFromProvider(id);  // ← STEP 50 단순 호출
    const after = ...; // re-read state

    // 3. Result 추정 — providerLastSyncedAt 변경 여부로 판정
    if (after.providerLastSyncedAt !== before.providerLastSyncedAt) ok += 1;
    else failed += 1;
  }

  failed += logisticsIds.length - skipped - candidates.length;  // record not found
  return { ok, skipped, failed };
}
```

**핵심**: bulk action은 STEP 50 흐름의 **wrapper일 뿐** — 각 record가 자체적으로 timeline event 생성, locked guard 적용, provider null 시 silent return. 실패 격리 자연.

### 3) BulkSyncBar — KPI와 FilterRow 사이

```tsx
function BulkSyncBar({ rowCount, syncStatus, onBulkSync }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <span>현재 필터된 {rowCount}건에 대해 provider 일괄 조회</span>
        <span className="italic">locked record는 자동 skip</span>
      </div>
      <div>
        {syncStatus.kind === "syncing" && <span>sync 중... ({total}건)</span>}
        {syncStatus.kind === "done" && (
          <span>
            최근 조회 완료 · 성공 {ok} · skip {skipped}
            {failed > 0 && <span className="text-status-deal">· 실패 {failed}</span>}
          </span>
        )}
        <button onClick={onBulkSync} disabled={rowCount === 0 || isBusy}>
          전체 Sync
        </button>
      </div>
    </div>
  );
}
```

### 4) ViewToggle — List / Calendar + month nav

```tsx
function ViewToggle({ viewMode, onChange, calendarMonth, onShiftMonth, onResetMonth }) {
  return (
    <div className="flex justify-between">
      <div className="flex gap-1">
        <ViewToggleButton label="리스트" active={viewMode === "list"} onClick={...} />
        <ViewToggleButton label="캘린더" active={viewMode === "calendar"} onClick={...} />
      </div>
      {viewMode === "calendar" && (
        <div className="flex items-center gap-1.5">
          <button onClick={() => onShiftMonth(-1)}>←</button>
          <span>{calendarMonth.monthLabel}</span>
          <button onClick={() => onShiftMonth(1)}>→</button>
          <button onClick={onResetMonth}>오늘</button>
          <span className="italic">예정 일정 {inMonthItemCount}건</span>
        </div>
      )}
    </div>
  );
}
```

### 5) CalendarGrid — 6×7 = 42 cells

```tsx
function CalendarGrid({ month }) {
  return (
    <div className="px-6 py-4">
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {CALENDAR_WEEKDAY_LABELS_KR.map(label => <div>{label}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {month.cells.map(cell => <CalendarCellCard cell={cell} />)}
      </div>
      <Legend />
    </div>
  );
}
```

각 cell:
- **Spillover month**: bg-surface-muted/30 배경 + 흐린 day number
- **오늘**: border-line-strong + ring 강조
- **Items**: 최대 3개 표시, "+N건" overflow
- **Click**: 작품 select → close drawer → openLogisticsDetail (rule_1 자연 복귀)

---

## 검증 매트릭스

### 사용자 spec 8개 검증 항목

| 항목 | 결과 |
|---|---|
| Logistics Operations Drawer 열림 | ✅ STEP 54 그대로 |
| 전체 Sync 클릭 가능 | ✅ BulkSyncBar 우측 |
| sync 성공/실패 count 표시 | ✅ "성공 N · skip M · 실패 K" |
| List / Calendar 토글 정상 | ✅ ViewToggle |
| Calendar month grid 렌더 | ✅ 42 cells |
| 날짜 cell item 클릭 → 작품 선택 + LogisticsDetailDrawer | ✅ list와 동일 흐름 |
| 기존 list view 회귀 없음 | ✅ viewMode 기본 "list" |
| build / type-check / lint 통과 | ✅ Route 123 kB |

### 사용자 spec 7개 제약

| 제약 | 결과 |
|---|---|
| Logistics / ConditionReport immutable rule | ✅ 0줄 변경 |
| Payment / Settlement / Tax / FX / Customer / AI / Documents | ✅ 0줄 |
| Persistence schema 변경 | ✅ 0줄 |
| 외부 API 호출 | ✅ 0건 |
| 신규 라이브러리 | ✅ 0개 |

### 표현 정책

| 표현 | 결과 |
|---|---|
| "운영 참고" / "provider 기준" / "최근 조회" / "예정 일정" | ✅ 사용 |
| "배송 보장" / "도착 확정" / "보험 보장" / "법적 효력" | ✅ 0건 (정책 주석에서만) |

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_1** Artwork-First | Calendar item 클릭은 list와 똑같이 setSelectedArtwork → 자연 복귀 | ✅ 보존 |
| **rule_4** Trust Layer | bulkSync는 timeline 압축하지 않고 STEP 50 single-record가 N개 이벤트 각자 생성 | ✅ 보존 |
| **rule_7** RBAC | STEP 54의 `report.view_global` 자연 적용 | ✅ 보존 |
| **rule_8** Timeline = Navigation | bulkSync 결과 N개 이벤트 모두 audit log에 기록 | ✅ 강화 |
| **rule_14** 3-Column | 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | drawer footer "닫기" 1개 그대로, BulkSyncBar/ViewToggle은 별도 utility | ✅ 보존 |
| **rule_16** 미니멀 디자인 | text-[9px]/[9.5px]/[10px] + 작은 dot + 그림자 0 + 과도한 그래프 0 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | drawer 안 view mode toggle만 | ✅ 보존 |
| **rule_21** logistics 1급 view | STEP 54 정착 → STEP 58 calendar / bulk action 심화 | ✅ **심화** |

---

## 시나리오

### 시나리오 1: 매주 월요일 운영자 일과

```
Manager: Sidebar → "물류 운영" → drawer 열림
KPI: 출고 대기 5 · 배송 중 7 · 도착 완료 3 · 검수 완료 12 · 검수 대기 2
필터: "이번 주" + 상태 "전체"
[전체 Sync] 클릭 → 5초 내 결과:
  "최근 조회 완료 · 성공 8 · skip 2 · 실패 0"
  (DELIVERED 2건은 locked로 skip, 나머지 8건 provider 조회)

[캘린더] 토글 → 이번 주 grid에 출고 일정 시각화:
  월: 픽업 2건 (점)
  화: 배송 중 3건 + 픽업 1건
  수: ...
운영자가 화요일 픽업 1건 클릭 → LogisticsDetailDrawer → 출고 처리
```

### 시나리오 2: "이번 달 인도 일정 확인"

```
[캘린더] 모드 → 이번 5월 grid
status 필터: "인도 완료" 선택 → DELIVERED 행만 calendar에 점으로
인도 완료된 작품들이 날짜별 분포로 보임
운영자가 5월 12일 클릭 가능한 cell의 item 클릭 → detail
```

### 시나리오 3: "한 record 실패해도 나머지는 진행"

```
[전체 Sync] 클릭
- record A: provider null 반환 → failed 카운트 +1
- record B: locked → 사실 candidates에 안 들어감 (pre-classification)
- record C: 정상 sync → ok +1
- record D: not found → failed (마지막에 보정)
결과: ok 1 · skip 0 · 실패 2 (정확히 표시)
```

---

## 다음 STEP 후보

```
STEP 60  Documents Hub 후속 — 개별 PDF ZIP / 추가 필터
STEP 61  Image storage 후속 — DELETE / 압축 / thumbnail
STEP 62  Backup auto-download 알림 — 30일 이상 시 banner
STEP 63  Logistics Calendar 심화 — 드래그 status 전환 / multi-select
```

---

## 결과 요약

- 신규 파일 1개 (lib ~190 LOC) + 문서
- 수정 파일 2개 (store + drawer)
- 0 신규 라이브러리 / 0 외부 API / 0 schema 변경 / 0 immutable rule 변경
- STEP 50 single-record sync 흐름 0줄 변경 (orchestrator로 재사용)
- STEP 54 list view 회귀 0건 (viewMode 기본 "list")
- 결정성 month grid (같은 입력 → 같은 grid)
- pickup > delivery > primary 우선순위 + UI에 from 라벨
- bulkSync 결과 카운트 (ok / skipped / failed)
- failure 격리 (한 record 실패해도 다음 진행)
- Calendar item 클릭 = list와 동일 흐름 (rule_1)
- Route +2 kB (121 → 123 kB)

**STEP 58 완료. rule_21 logistics 1급 view 심화 — 운영자 일과 시작 화면 후보 1순위 강화.**
