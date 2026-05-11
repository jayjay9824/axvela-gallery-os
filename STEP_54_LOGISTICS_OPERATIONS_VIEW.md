# STEP 54 — Logistics Operations View

> **목표**: 갤러리 전체 logistics를 한 화면에서 KPI / 필터 / 검색하는 1급 운영 view.
> Customer / Reporting / Documents 패턴을 logistics에도 적용. **rule_21 1급 view
> 정착** — read-only 검색 utility, row 클릭 시 기존 LogisticsDetailDrawer 재사용.

---

## State

- **이전**: STEP 53 / Route 116 kB
- **이번**: STEP 54 / **Route 119 kB (+3 kB)**
- Build ✅ · type-check ✅ · Lint ✅

---

## Flow

```
Sidebar Operations 그룹 → "물류 운영" (Manager+ RBAC)
  │
  ↓ openLogisticsOperations()
  │
  LogisticsOperationsDrawer (w-[800px])
    │
    ├─ KPI Section (5종, 시간 필터 적용)
    │   ┌───────────┬─────────┬───────────┬─────────┬───────────┐
    │   │ 출고 대기  │ 배송 중 │ 도착 완료 │ 검수 완료│ 검수 대기 │
    │   │ READY...  │ IN_TRAN.│ DELIVERED │ CONDITI.│ DELIVERED│
    │   │           │         │           │         │ +!AFTER  │
    │   └───────────┴─────────┴───────────┴─────────┴───────────┘
    │
    ├─ Filter row 1: 상태 chip (전체/4 status) + 검색 input
    ├─ Filter row 2: 기간 chip (STEP 35.5 재사용) + summary
    │
    ├─ Row list (primaryDate desc):
    │   각 row 4-col grid:
    │     col 1: status dot + label + condition badges (BEFORE / AFTER + 검수 대기)
    │     col 2: 작품 + 작가 + axid + 구매자 + carrier/tracking + provider
    │     col 3: 최근 조회 시점 (provider sync 정보)
    │     col 4: primaryDate + 종류
    │       │
    │       ↓ 클릭
    │       ├─ setSelectedArtwork(artworkId)  ← rule_1 자연 복귀
    │       ├─ closeLogisticsOperations()
    │       └─ openLogisticsDetail(logisticsId)
    │
    └─ Footer: "{N건 표시 · 기간 M건} · 운영 참고 · provider 기준" + [닫기]
```

**도메인 신규 생성/편집 0건** — 본 drawer는 검색 utility, LogisticsDetailDrawer로 진입해 rule_1 자연 복귀.

---

## 변경 / 신규 파일

### 신규 (2 + doc)

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/logistics-aggregates.ts` | ~270 | Flatten + KPI 계산 + 필터 + LogisticsRow 타입 |
| `src/components/logistics/LogisticsOperationsDrawer.tsx` | ~470 | KPI 카드 + 필터 + row list + provider info |
| `STEP_54_LOGISTICS_OPERATIONS_VIEW.md` | (이 문서) | 완료 보고 |

### 변경 (3 + ARCHITECTURE.md)

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/store/useArtworkStore.ts` | ~30 LOC | `LogisticsOperationsRequest` UI slice + 2 actions |
| `src/components/layout/Sidebar.tsx` | ~25 LOC | "물류 운영" Operations 그룹에 추가 + RBAC 가드 |
| `src/app/page.tsx` | 2 LOC | Drawer mount |

---

## 핵심 코드

### 1) Aggregator — KPI + 필터 + 정렬

```ts
// src/lib/logistics-aggregates.ts

export interface LogisticsKPIs {
  readyForPickupCount: number;
  inTransitCount: number;
  deliveredCount: number;
  conditionCheckedCount: number;
  /** DELIVERED but no AFTER_DELIVERY report yet — 운영자 행동 필요 */
  awaitingConditionCheckCount: number;
}

export function aggregateLogistics(
  input: LogisticsAggregateInput,
  options: LogisticsAggregateOptions
): LogisticsAggregateResult {
  // 1. Lookup tables (artwork / tx / CR by logisticsId)
  // 2. flatten logistics → LogisticsRow
  // 3. 시간 필터 (KPI는 시간만 적용)
  // 4. KPI 계산:
  //    switch on status, DELIVERED + !hasAfterReport → awaitingConditionCheck
  // 5. status + 텍스트 필터
  // 6. primaryDate desc 정렬
  return { rows, kpis, totalCountInRange, filteredCount };
}
```

### 2) Primary date 정책

| Status | primaryDate | 라벨 |
|---|---|---|
| READY_FOR_PICKUP | `updatedAt` | "최근 수정" |
| IN_TRANSIT | `pickupDate` > `updatedAt` | "픽업일" / "최근 수정" |
| DELIVERED | `deliveryDate` > `updatedAt` | "인도일" / "최근 수정" |
| CONDITION_CHECKED | `updatedAt` | "검수 완료" |

### 3) KPI Section

```tsx
<KPISection kpis={result.kpis} />

<div className="grid grid-cols-5 gap-2">
  <KPICard label="출고 대기"   value={kpis.readyForPickupCount}     color={...} />
  <KPICard label="배송 중"     value={kpis.inTransitCount}          color={...} />
  <KPICard label="도착 완료"   value={kpis.deliveredCount}          color={...} />
  <KPICard label="검수 완료"   value={kpis.conditionCheckedCount}   color={...} />
  <KPICard label="검수 대기"   value={kpis.awaitingConditionCheckCount}
           emphasized={kpis.awaitingConditionCheckCount > 0}
           hint="인도 후 AFTER 검수 보고서 부재" />
</div>
```

각 카드:
- LOGISTICS_STATUS_COLOR (utils.ts) 재사용
- 검수 대기 카드: `awaitingConditionCheckCount > 0` 시 `border-line-strong` emphasized

### 4) Row 클릭 — rule_1 자연 복귀

```tsx
function LogisticsRowCard({ row }) {
  const handleOpen = () => {
    if (row.artworkId) setSelectedArtwork(row.artworkId);  // 1. DetailPanel 활성화
    closeOps();                                            // 2. 본 drawer 닫음
    setTimeout(() => {
      openLogisticsDetail(row.logistics.id);               // 3. 기존 detail drawer 재사용
    }, 0);
  };

  return (
    <li>
      <button onClick={handleOpen} className="...4-col grid...">
        {/* col 1: status + condition badges */}
        {/* col 2: artwork + artist + axid + buyer + carrier/tracking */}
        {/* col 3: provider sync info ("최근 조회") */}
        {/* col 4: primaryDate + 종류 */}
      </button>
    </li>
  );
}
```

### 5) Condition badges (BEFORE / AFTER)

```tsx
{row.hasBeforeReport && <ConditionBadge label="BEFORE" status={null} />}
{row.hasAfterReport && (
  <ConditionBadge label="AFTER" status={row.latestConditionStatus} />
)}
{/* DELIVERED + !AFTER → "검수 대기" 시각 강조 */}
{log.status === "DELIVERED" && !row.hasAfterReport && (
  <span className="...italic">검수 대기</span>
)}
```

`latestConditionStatus`:
- DAMAGED → status-deal red
- WATCH → status-inquiry amber
- GOOD → neutral
- null → outline only

### 6) Provider sync 정보

```tsx
{log.providerLastSyncedAt ? (
  <div>
    <span>최근 조회</span>
    <span>{formatDate(log.providerLastSyncedAt)}</span>
  </div>
) : (
  <span className="italic">sync 기록 없음</span>
)}
```

추가로 carrier/tracking 줄에 provider 라벨:
```
SafeArt Logistics  MK-LOG003-7821  · mock_v1 · mock
```

### 7) Sidebar 진입점

```tsx
// src/components/layout/Sidebar.tsx — Operations 그룹 (SECONDARY)
const SECONDARY = [
  { label: "AI 워크플로우", disabled: true, hint: "작품 상태 액션에서 접근" },
  {
    label: "물류 운영",  // ← STEP 54 신규
    disabled: !canViewReporting,
    hint: canViewReporting ? undefined : permissionHint("report.view_global"),
    onClick: canViewReporting ? openLogisticsOperations : undefined,
  },
  { label: "보고서", ...},
  { label: "설정", disabled: true, hint: "준비 중" },
];
```

RBAC: `report.view_global` (Reporting / Documents와 일관 Manager+).

---

## 검증 매트릭스

### 사용자 spec 8개 검증 항목

| 항목 | 결과 |
|---|---|
| Sidebar/Operations에서 Logistics Operations 열림 | ✅ "물류 운영" 메뉴 활성 |
| status별 KPI 정상 | ✅ 5종 KPI 카드 (출고 대기 / 배송 중 / 도착 완료 / 검수 완료 / 검수 대기) |
| 기간 필터 정상 | ✅ STEP 35.5 ReportingTimeFilter 재사용 |
| 검색 정상 | ✅ 작품 / 작가 / carrier / trackingId 부분 매칭 |
| row 클릭 → 작품 선택 + LogisticsDetailDrawer | ✅ 3단계 흐름 (select → close → setTimeout open) |
| ConditionReport badge 정상 | ✅ BEFORE / AFTER + DAMAGED/WATCH 색상 + 검수 대기 시각 |
| provider 상태 표시 | ✅ providerId / mock 라벨 + 최근 조회 시점 |
| build 통과 | ✅ Route 119 kB |

### 사용자 spec 7개 제약

| 제약 | 결과 |
|---|---|
| Logistics / ConditionReport immutable rule 변경 금지 | ✅ `isLogisticsLocked` 0줄 변경 |
| Payment / Settlement / Tax / FX / Customer / AI / Documents 변경 금지 | ✅ 0줄 |
| Persistence schema 변경 금지 | ✅ UI 슬라이스만, validateV1 무영향 |
| 외부 API 호출 금지 | ✅ 0건 |
| 신규 라이브러리 추가 금지 | ✅ `package.json` 0줄 |
| 3-column layout 변경 금지 | ✅ 0줄 |
| bulk sync 이번 STEP 제외 | ✅ 미구현 (개별 sync는 기존 LogisticsDetailDrawer STEP 50) |

### 표현 정책

| 금지 표현 | 결과 |
|---|---|
| 배송 보장 | ✅ 0건 (정책 주석에서만) |
| 도착 확정 | ✅ 0건 |
| 보험 보장 | ✅ 0건 |
| 법적 효력 | ✅ 0건 |

권장 표현 정착:
- ✅ **"운영 참고"** — Footer
- ✅ **"provider 기준"** — Footer
- ✅ **"최근 조회"** — Row col 3
- ✅ **"sync 기록 없음"** — provider 부재 표시

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_1** Artwork-First | row 클릭 시 setSelectedArtwork → DetailPanel 자연 활성화 → 도메인 drawer 진입 | ✅ 보존 |
| **rule_4** Trust Layer | ConditionReport BEFORE/AFTER 배지 + 검수 대기 시각 + provider mock transparency | ✅ 강화 |
| **rule_7** RBAC | Reporting / Documents와 같은 권한 (Manager+) | ✅ 보존 |
| **rule_8** Timeline = Navigation | 본 STEP은 Operations view 자체, timeline은 LogisticsDetailDrawer가 노출 | ✅ 보존 |
| **rule_14** 3-Column | 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | drawer footer "닫기" 1개 (검색 view라 primary action 없음) | ✅ 보존 |
| **rule_16** 미니멀 디자인 | 절제된 회색 + chip 패턴 일관 + 그림자 0 + emphasized border 1px 차이만으로 강조 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | overlay 안 view 추가만 | ✅ 보존 |
| **rule_21** 1급 view | logistics가 처음으로 1급 운영 view로 승격 | ✅ **본격화** |

---

## 시나리오

### 시나리오 1: "이번 주 출고 / 도착 확인"

```
Manager: Sidebar → "물류 운영" 클릭
KPI 카드 5종 즉시 노출:
  출고 대기 3 · 배송 중 7 · 도착 완료 12 · 검수 완료 8 · 검수 대기 4

기간 필터 → "이번 분기" 클릭
KPI 자동 갱신.

검수 대기 4건 확인 → 상태 칩 "인도 완료" 클릭
→ 4건의 row + "검수 대기" 빨간 배지 노출
→ row 클릭 → 작품 선택 + LogisticsDetailDrawer → ConditionReport AFTER 작성
→ 닫으면 DetailPanel에 작품 노출 (rule_1 자연 복귀)
```

### 시나리오 2: "carrier 측 상태 확인"

```
Manager: 검색 input "DHL" 입력 → carrier 매칭 row만 노출
각 row col 3에 "최근 조회" 시점 표시 (STEP 50 provider sync 결과)
"sync 기록 없음" 표시된 row가 있으면 → 클릭 → LogisticsDetailDrawer →
"물류 상태 동기화" 버튼 (STEP 50 LogisticsProvider hook)
```

### 시나리오 3: "특정 작가 작품의 물류 상태"

```
Manager: 검색 input "김민지"
→ 그 작가의 모든 logistics row 노출
status 필터 "배송 중" → IN_TRANSIT만 노출
buyer 정보 노출 ("→ Lee Collection") → 운영자가 수령처 확인
```

---

## 다음 STEP 후보

```
STEP 55  Documents Hub 후속
         - 개별 PDF ZIP 다운로드 (STEP 51 명시 후속)
         - 작가 / 작품별 추가 필터
         - 컬럼 커스터마이징

STEP 56  Backup 자동 알림 (사용자 안전)
         - "마지막 백업 N일 전" 사이드바 indicator
         - 30일 이상 미백업 시 경고

STEP 57  실 외부 storage 연결 (Vercel Blob)
         - STEP 53 가이드 그대로 적용
         - 환경변수 + API route + provider class 추가

STEP 58  Logistics Operations 후속
         - bulk provider sync (STEP 54 명시 후속)
         - 출고 캘린더 view
         - 운영자 일괄 status 전환
```

---

## 결과 요약

- 신규 파일 2개 (lib + component, 총 ~740 LOC)
- 수정 파일 3개 (store + Sidebar + page.tsx)
- 0 신규 라이브러리 / 0 외부 API / 0 도메인 타입 변경 / 0 schema 변경 / 0 immutable rule 변경
- 5종 KPI 카드 (사용자 spec 5종 모두) — 검수 대기는 DELIVERED + !hasAfterReport 자동 검출
- 기간 / 상태 / 텍스트 필터 (STEP 35.5 / 51 패턴 재사용)
- ConditionReport BEFORE / AFTER 배지 + condition status 색상
- Provider sync 정보 (STEP 50 메타 그대로 노출 — "최근 조회" + mock 라벨)
- row 클릭 = setSelectedArtwork → close → 기존 LogisticsDetailDrawer 재사용 (rule_1 자연 복귀)
- Sidebar "물류 운영" Operations 그룹에 자연 통합
- Route +3 kB (116 → 119 kB)

**STEP 54 완료. rule_21 logistics 1급 운영 view 정착 — 갤러리 운영자 일과 시작 화면 후보 1순위.**
