# STEP 26 — Audit Trail Visualization 완료

STEP 24에서 강화한 Audit Filter 결과를 **단순 div + tailwind 기반 시각화**로
보강. 갤러리 운영 흐름 / 활동 패턴을 한눈에 — 외부 차트 라이브러리 0개,
도메인 로직 0줄 변경. AuditLogDrawer (단일) / GlobalAuditDrawer (전체) 양쪽
드로어 모두에 같은 컴포넌트 재사용.

> rule_4 (trust layer) 가시화 — 큰 audit log set의 패턴 (어떤 도메인이 활동
> 많은지, 어떤 시점에 LOCK이 발생했는지, 누가 작성했는지)을 빠르게 파악 가능.

핵심 결정:
- **컴포넌트 1개 (`AuditTrailVisualization`)** — controlled, props 3개
  (`classified` + `mode` + `artworkLookup?`). AuditLogDrawer / GlobalAuditDrawer
  공용. 새 store 슬라이스 / 액션 부재 (pure presentation).
- **데이터 = 현재 filtered audit events 그대로** — 사용자 spec "반드시 현재
  filtered audit events 기준으로 계산". STEP 24의 `applyAuditFilters` 결과를
  부모가 그대로 전달 → 본 컴포넌트가 즉시 재계산. STEP 25 export와 정확히 같은
  set이 시각화에도 사용됨.
- **외부 차트 라이브러리 0** — 모든 시각화는 `<div>` 폭/높이 비례. tailwind
  유틸 클래스만 사용. 사용자 spec "외부 차트 라이브러리 추가 금지" + "CSS div
  기반으로 구현" 준수.
- **5개 섹션** (Single 4 / Global 5):
  1. **Importance Counts** — 6 메트릭 grid (LOCK / APPROVED / CORRECTION /
     PAYMENT / SETTLEMENT / TAX_ISSUED). 큰 숫자 + 라벨, 0이면 dim 톤.
  2. **Domain bars** — 8 도메인 가로 bar. max → 100%, count 0인 도메인은 빈 bar.
  3. **Actor bars** — AI / HUMAN / SYSTEM 3 bar. broad type 분류 활용.
  4. **Day timeline** — 데이터 범위 안 매일 1개 막대 (count height). 최대 30일
     (TIMELINE_MAX_DAYS). 범위 초과 시 lastDay 기준 뒤에서 잘라 표시.
  5. **Top artworks** (Global only) — count 내림차순 Top 5. artworkLookup을
     활용해 짧은 라벨 (`작품명 · 작가`) 표시.
- **결과 0건 시 EmptyState** — "현재 필터 결과 없음 — 시각화 표시 불가" 안내.
  사용자 spec "결과 0개일 때 empty state 표시" 충족.
- **Mode 분기** — `mode="single"`일 때 Top artworks row 미렌더 (단일 작품
  view에서 의미 없음). `mode="global"`일 때만 artworkLookup으로 라벨링.
- **TimelineEvent / 도메인 로직 0줄 변경** — 본 컴포넌트는 `ClassifiedAuditEvent`
  를 입력으로만 받는 read-only presentation. STEP 20의 `classifyAuditEvent`
  결과(domain / actorType / emphasis)를 그대로 활용 — 새 분류 로직 0개.

---

## 1. 현재 코드 분석

**STEP 26 진입 시점 (v34 + STEP 24 baseline):**

| 항목 | 진입 시점 | STEP 26 종료 |
|---|---|---|
| AuditLogDrawer header | ContextLine + FilterBar + ExportBar 3개 component | + AuditTrailVisualization 4번째 |
| GlobalAuditDrawer header | SummaryLine + FilterBar + ExportBar 3개 | + AuditTrailVisualization 4번째 |
| Visualization 컴포넌트 | 부재 | 신규 `AuditTrailVisualization.tsx` (~370 LOC) |
| 통계 계산 helper | 부재 | 신규 `computeAuditStats()` pure function (컴포넌트 내부) |
| ClassifiedAuditEvent | domain / actorType / emphasis 이미 존재 | **무수정** — 그대로 활용 |
| AuditFilterBar (STEP 24) | controlled 6-axis filter | **무수정** |
| applyAuditFilters (STEP 24) | 6-axis 필터링 함수 | **무수정** |
| AuditExportBar (STEP 25) | filtered classified를 받아 JSON/CSV/PDF | **무수정** — 시각화와 같은 set |

**의존 관계:**
- `AuditTrailVisualization` ← `ClassifiedAuditEvent` / `AuditDomain` / `AuditEmphasis` / `broadActorType` (audit-helpers, STEP 20/24)
- ← `cn` (utils)
- 기존 도메인 store / mock-data / 모든 도메인 액션 / TimelineEvent / 분류 helper / `audit-export` / `audit-navigation` 0줄 변경.

순환 import 0건. 본 STEP은 신규 컴포넌트 1개 + 두 drawer에 1줄씩 mount.

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/components/audit/AuditLogDrawer.tsx` | `AuditTrailVisualization` import 1줄 추가. header 영역 FilterBar ↔ ExportBar 사이에 `<AuditTrailVisualization classified={filtered} mode="single" />` 1줄 삽입. 다른 모든 부분 (filter state / dispatchTarget / navStore / Header context / 모든 분류 helpers / EmptyState / footer) 0줄 변경. |
| `src/components/audit/GlobalAuditDrawer.tsx` | `AuditTrailVisualization` import 1줄 추가. header 영역 FilterBar ↔ ExportBar 사이에 `<AuditTrailVisualization classified={filteredClassified} mode="global" artworkLookup={artworkSearchLookup} />` 삽입 (artworkSearchLookup은 STEP 24에서 이미 정의됨, 재사용). 다른 모든 부분 0줄 변경. |
| `ARCHITECTURE.md` | STEP 26 changelog 항목 추가 |

---

## 3. 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/components/audit/AuditTrailVisualization.tsx` | 370 | Pure presentation 컴포넌트. `computeAuditStats()` 내부 helper로 6 차원 (emphasis / domain / actor / dayBuckets / topArtworks / dateSpanLabel) 통계 즉석 계산. `ImportanceCountsRow` / `DomainBars` / `ActorBars` / `DayTimeline` / `TopArtworks` 5개 sub-component. `Bar` / `BarSection` / `EmptyVizState` 헬퍼 컴포넌트. 외부 라이브러리 0개 — `<div>` + tailwind. |
| `STEP_26_AUDIT_VISUALIZATION_COMPLETE.md` | 본 문서 |

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/lib/audit-helpers.ts` | 0줄 변경 — `ClassifiedAuditEvent` / `AuditDomain` / `AuditEmphasis` / `broadActorType` 등 기존 export 그대로 활용 |
| `src/lib/audit-export.ts` (STEP 25) | 0줄 — 시각화와 export는 같은 filtered classified set 받음, 별개 모듈 |
| `src/lib/audit-navigation.ts` (STEP 21) | 0줄 — navigation 흐름 독립 |
| `src/components/audit/AuditFilterBar.tsx` (STEP 24) | 0줄 — controlled 6-axis filter 그대로 |
| `src/components/audit/AuditExportBar.tsx` (STEP 25) | 0줄 — disabled 0건 로직 그대로 |
| `src/components/audit/AuditEventCard.tsx` (STEP 23) | 0줄 — 카드 렌더 그대로 |
| TimelineEvent 구조 (`src/types/artwork.ts`) | 0줄 변경 (사용자 spec 명시) |
| Money Flow / Contract / Invoice / Tax / Settlement / Logistics / Curation / Inquiry / 모든 도메인 store / mock-data | 0줄 변경 |
| Persistence (STEP 27 / 27.7 / 30) / FX (STEP 31 / 32 / 34) / Market Data (STEP 19 / 29) / AI (STEP 16 / 18) | 0줄 변경 |
| 3-Column 레이아웃 / Sidebar / 다른 모든 Drawer | 0줄 변경 |
| RBAC matrix / 권한 / `package.json` | 0줄 변경 |

---

## 5. 핵심 코드

### 5.1 컴포넌트 인터페이스

```tsx
export interface AuditTrailVisualizationProps {
  classified: ClassifiedAuditEvent[];
  mode: "single" | "global";
  /** Global mode 전용 — artworkId → 짧은 라벨. */
  artworkLookup?: Record<string, string>;
}

export function AuditTrailVisualization({
  classified, mode, artworkLookup,
}: AuditTrailVisualizationProps) {
  const stats = React.useMemo(
    () => computeAuditStats(classified, mode, artworkLookup),
    [classified, mode, artworkLookup]
  );
  // ... 5 섹션 render or empty state
}
```

### 5.2 통계 계산 (pure)

```ts
interface AuditStats {
  emphasis: Record<Exclude<AuditEmphasis, null>, number>; // 6 keys
  domain: Record<AuditDomain, number>;                     // 8 keys
  actor: Record<ActorTypeBroad, number>;                   // 3 keys
  dayBuckets: DayBucket[];                                  // YYYY-MM-DD 별 count
  topArtworks: ArtworkCountRow[];                           // global only, Top 5
  totalNonZero: number;                                     // bar normalization 분모
  dateSpanLabel: string;                                    // 헤더에 노출
}

function computeAuditStats(classified, mode, artworkLookup): AuditStats {
  // 0으로 초기화한 record 3개 (emphasis / domain / actor)
  // for each event: 카운트 증가 + dayMap, artworkMap 누적
  // dayBuckets: enumerateDays(rangeStart, lastDay) → count 0인 날도 채움
  // topArtworks: artworkMap 정렬 → Top 5
  // totalNonZero: bar height 비율 정규화 max
}
```

### 5.3 Day timeline — 데이터 범위 자동 감지

```ts
const TIMELINE_MAX_DAYS = 30;

function clampDateRange(firstDay, lastDay): string {
  const dayDiff = Math.floor((last - first) / 86_400_000) + 1;
  if (dayDiff <= TIMELINE_MAX_DAYS) return firstDay;
  // 범위 초과 → lastDay 기준 30일 전으로 clip
  return formatISODate(new Date(last - 29 * 86_400_000));
}

function enumerateDays(start, end): string[] {
  // [start, end] 모든 날짜 (UTC 기반, DST 영향 차단)
}
```

### 5.4 Bar — 단순 div 폭 비례

```tsx
function Bar({ label, count, maxCount }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div className="grid grid-cols-[5.5rem_1fr_2.25rem] gap-2 items-center">
      <span>{label}</span>
      <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
        <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
      <span>{count}</span>
    </div>
  );
}
```

### 5.5 Day timeline — flex bars

```tsx
function DayTimeline({ buckets }) {
  const max = Math.max(1, ...buckets.map(b => b.count));
  return (
    <div className="flex items-end gap-[2px] h-12">
      {buckets.map(b => (
        <div key={b.date} className="flex-1 min-w-[2px] flex items-end">
          <div
            className={cn(b.count === 0 ? "bg-line" : "bg-ink", "w-full rounded-sm")}
            style={{ height: `${b.count === 0 ? 4 : (b.count / max) * 100}%` }}
            title={`${b.date} · ${b.count}건`}
          />
        </div>
      ))}
    </div>
  );
}
```

### 5.6 AuditLogDrawer mount

```tsx
<AuditFilterBar state={filterState} onChange={setFilterState} mode="single" />
<AuditTrailVisualization classified={filtered} mode="single" />
<AuditExportBar classified={filtered} scope={exportScope} ctx={exportCtx} />
```

### 5.7 GlobalAuditDrawer mount (artworkLookup 재활용)

```tsx
<AuditFilterBar state={filterState} onChange={setFilterState} mode="global" artworks={artworks} />
<AuditTrailVisualization
  classified={filteredClassified}
  mode="global"
  artworkLookup={artworkSearchLookup}    // STEP 24에서 정의된 것 재활용
/>
<AuditExportBar classified={filteredClassified} scope={exportScope} ctx={exportCtx} />
```

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    76.2 kB         163 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 24 (Audit Filters 강화) | 74.5 kB | — |
| **STEP 26 (Audit Visualization)** | **76.2 kB** | **+1.7** |

`tsc --noEmit` 0 error / `next build` 0 warning. **외부 npm 의존성 0개**.

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_4** Trust Layer | ✅ **가시화 강화** | LOCK / APPROVED / CORRECTION / PAYMENT / SETTLEMENT / TAX_ISSUED 6 메트릭이 카드 grid로 즉시 표시 — trust evidence 패턴 시각화 |
| **rule_8** Timeline = Navigation | ✅ | day timeline + emphasis count로 navigation 효율 ↑ (시각적으로 활동 spike 즉시 인지) |
| **rule_14 / rule_17** Layout / Layer | ✅ | 3-Column 무변경, drawer 내부 UI만 |
| 도메인 로직 변경 | ✅ 0줄 | 시각화는 read-only presentation |
| TimelineEvent 구조 변경 | ✅ 0줄 | 기존 필드만 활용 |
| Money Flow / Contract / Invoice / Tax / Settlement / Logistics 변경 | ✅ 0줄 | |
| Backend 추가 | ✅ 0건 | |
| 외부 라이브러리 추가 | ✅ 0개 | div + tailwind만 |
| 3-Column 레이아웃 변경 | ✅ 0줄 | |
| Drawer 내부 UI만 변경 | ✅ | header 영역에 1줄 삽입 |
| 복잡한 차트 금지 / chip / mini timeline / heatmap | ✅ | 모두 단순 div bar 또는 flex height |
| 결과 0개 empty state | ✅ | "현재 필터 결과 없음 — 시각화 표시 불가" |
| Single에서 domain/actor/timeline 표시 | ✅ | 4 섹션 |
| Global에서 artwork별 count | ✅ | Top 5 |
| Export 결과와 동일 filtered set | ✅ | 부모 drawer가 같은 변수 (`filtered` / `filteredClassified`) 전달 |

---

## 8. 검증 시나리오

### A — AuditLogDrawer 단일 작품 시각화

1. art_002 등 timeline이 풍부한 작품 선택 → AuditLogDrawer 열기
2. **기대**:
   - Importance Counts 6 카드 (LOCK / APPROVED / CORRECTION / PAYMENT / SETTLEMENT / TAX_ISSUED)
   - 유형별 8 도메인 가로 bar
   - 작성자별 3 actor type bar
   - 일별 활동 timeline (데이터 범위 안)
   - **Top artworks 미노출** (single mode)
3. 헤더 "120건 · 2026-04-21 ~ 2026-05-04" 형태

### B — GlobalAuditDrawer 전체 시각화

1. RoleSwitcher → Manager → 사이드바 "전체 감사 로그" 클릭
2. **기대**:
   - 4 섹션 + Top artworks (Top 5)
   - 각 작품 라벨 "작품명 · 작가"

### C — 필터 변경 시 즉시 반영

1. AuditFilterBar에서 search="발송" 입력
2. **기대**: filtered 결과 갱신 → 시각화도 즉시 재계산
3. Importance Counts에 LOCK 카드 (Invoice 발송 = lock 이벤트) 비례 증가
4. Day timeline 막대도 갱신

### D — 0건 시 EmptyState

1. AuditFilterBar에 매칭 안 되는 검색어 입력 (예: "zzzzzz")
2. **기대**:
   - 헤더 "결과 없음"
   - 시각화 영역에 "현재 필터 결과 없음 — 시각화 표시 불가"
   - AuditExportBar disabled (STEP 25 그대로)

### E — Date range 시각화 동기화

1. AuditFilterBar에서 시작일 / 종료일 입력
2. **기대**: day timeline이 그 범위 안 데이터만 표시. 빈 날도 막대 표시 (count=0).

### F — 30일 초과 데이터 자동 clip

1. 데모 + 실험으로 timeline 이벤트가 30일 이상 분포
2. **기대**: lastDay 기준 30일 전부터 표시. 헤더 "X건 · 2026-04-04 ~ 2026-05-04" 형태.

### G — Domain bar 분포 정확

1. AI 신호 자주 emit (가격 제안 다회 generate)
2. **기대**: 유형별 "AI" bar가 가장 길어짐. 카운트 숫자도 정확.

### H — Top artworks 정렬

1. Global view, 다양한 작품 활동
2. **기대**: count 내림차순. 동률 시 입력 순서 (Map iteration 순).

### I — Export 결과와 동일 set 검증

1. 어떤 필터 적용 후 시각화에서 Total 17건 확인
2. JSON Export → 17건 확인
3. **기대**: 두 숫자 정확히 일치 — 같은 `filtered` / `filteredClassified` 변수 공유

### J — Importance counts 0인 카드 시각

1. AI 도메인만 필터 적용 → SETTLEMENT / TAX_ISSUED / PAYMENT 등 0건
2. **기대**: 0 카드는 dim 톤 (text-ink-subtle, bg-surface), 활성 카드만 강조 (text-ink, bg-surface-muted)

### K — Day timeline 단일 날짜 케이스

1. 특정 하루만 데이터 (시작일=종료일)
2. **기대**: 헤더 "X건 · 2026-05-04" 단일 날짜 표시. timeline에 막대 1개.

### L — Persistence (STEP 27 / 27.7 / 30) 호환

1. 시각화 표시 상태에서 F5 새로고침
2. **기대**: timeline 데이터 영속 → 시각화 같은 결과 재현

### M — RBAC 호환

1. STAFF 권한으로 GlobalAuditDrawer 진입 시도
2. **기대**: 사이드바 진입점 disabled (STEP 23 그대로). 시각화 컴포넌트 영향 없음.

### N — 도메인 흐름 무영향

1. invoice 발송 / payment / settlement 등 임의 도메인 액션
2. **기대**: 모든 흐름 v34 baseline과 동일. timeline 이벤트 emit 즉시 시각화도 갱신 (drawer 열려 있다면).

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| Day timeline 30일 cap | 그 이상 분포는 잘림 — lastDay 기준 뒤에서 30일 | 향후 zoom / pagination 추가 가능 |
| Heatmap 부재 | 사용자 spec엔 "heatmap 느낌"이 후보로 언급되었지만 v1은 막대 timeline만 | 7일 × N주 grid heatmap 후속 STEP에서 추가 가능 |
| Top artworks limit 5 | 갤러리 전체 작품이 많으면 5건만 노출 | "Top N" 토글 추가 가능 |
| Visualization collapse 부재 | 항상 노출 — 헤더 공간 차지 | "차트 접기/펼치기" 토글 후속 STEP |
| 작품 활동 비교 미지원 | Top artworks는 단순 카운트만 — 도메인별 분포 같은 deep-dive 부재 | 향후 drill-down 추가 가능 |
| Bar 정확도 | totalNonZero를 max로 사용 (가장 큰 카테고리 기준 100%) — 절대값보다 상대 비교 강조 | 의도된 동작 |
| 시각화 export 부재 | PDF로 시각화 자체 export 안 됨 — 텍스트 기반 export만 | SVG/Canvas 변환 + audit-export.ts 통합 후속 STEP |
| Empty bar dim 처리 | count=0 도메인은 빈 bar 표시 (시각적 일관성) — 일부 사용자는 미렌더 선호 가능 | 토글 옵션 추가 가능 |
| 단일 시점 비교 부재 | "어제 대비 오늘 활동 변화" 같은 trend metric 없음 | 후속 STEP — moving average / sparkline |
| RTL 미지원 | tailwind 기본 LTR | 향후 i18n 작업 시 동일 처리 |

---

## 10. 다음 STEP 후보

1. **STEP 38 — Saved Filter Preset** — 본 STEP 24의 자주 쓰는 필터 조합을
   사용자별 저장. 시각화도 preset과 함께 즉시 복원.
2. **STEP 35 — Multi-currency Reporting Layer** — 갤러리 전체 매출 / 정산 /
   과세 KRW 통일 환산 리포트.
3. **STEP 36 — Settlement Currency-aware Net** — splitSettlement / splitTax
   helper에 currency 파라미터.
4. **STEP 33 — Real FX Provider** — OpenExchangeRatesProvider 실 구현.
5. **STEP 28 — Real AI Integration** — Curation / Inquiry response / Price
   suggestion 실 AI API.
6. **STEP 27.5 — IndexedDBAdapter** — localStorage 5MB 한계 해소.
7. **STEP 30.5 — Periodic Pull / Polling** — multi-device 자동 갱신.
8. **STEP 37 — Document Approval Workflow** — Contract / Curation multi-step
   approval.
9. **STEP 39 — Audit Heatmap** — 7일 × N주 grid heatmap 추가.
