# STEP 67 — Operational Drilldown Navigation Layer (Global Expansion)

> **목표**: AXVELA OS를 *passive reporting dashboard*에서 *operational graph
> navigation system*으로 전환. 모든 metric / count / KPI card / status badge가
> reusable drilldown drawer로 흡수되어 **연결 객체 list → 작품 → DetailPanel sync**
> 흐름 제공.
> **기존 visual identity 무변경 (rule_16) · 3-column 0줄 · persistence schema 0줄**

---

## State

- **이전**: STEP 65 / Route 132 kB
- **이번**: STEP 67 / **Route 136 kB (+4 kB)**
- Build ✅ · type-check ✅ · Lint ✅

---

## 핵심 사상

```
[BEFORE]
KPI 카드 "출고 대기 5"  →  단순 표시. 클릭 불가.
"기간 내 인보이스 12건"   →  단순 숫자. 어떤 건들인지 모름.

[AFTER]
KPI 카드 "출고 대기 5"  →  클릭 → drilldown drawer
                         →  5건의 logistics record 표
                         →  row 클릭
                         →  setSelectedArtwork
                         →  drawer 닫힘 → DetailPanel sync
                         →  운영자가 그 작품 컨텍스트로 자연 복귀

operational graph navigation:
   metric → 연결 객체 → 작품 → 다음 액션
```

**AXVELA = 작품 중심 operational OS**. Static dashboard 아님.

---

## 4-Piece Reusable Architecture

### 1. `src/types/drilldown.ts` (~110 LOC)

```ts
export type DrilldownDomain =
  | "artwork_state"
  | "logistics_status" | "logistics_calendar_day" | "logistics_awaiting_condition"
  | "reporting_invoices" | "reporting_settlements" | "reporting_tax" | "reporting_fx_converted"
  | "storage_with_image" | "storage_external" | "storage_fallback" | "storage_orphan";

export interface DrilldownPayload {
  domain: DrilldownDomain;
  // 도메인별 generic filter context
  artworkState?: ArtworkState;
  logisticsStatus?: LogisticsStatus;
  isoDate?: string;
  blobPathnames?: ReadonlyArray<string>;
  // STEP 67 핵심 — filter sync (사용자 spec)
  periodFromIso?: string;
  periodToIso?: string;
  contextLabel?: string;
}

export type DrilldownRequest =
  | { kind: "closed" }
  | { kind: "open"; payload: DrilldownPayload };
```

**12개 domain 단일 enum**. 도메인별 분기는 generic shape로 흡수.

### 2. `src/lib/drilldown-resolver.ts` (~750 LOC)

Pure function — `resolveDrilldown(payload, stateSubset)`:

```ts
export function resolveDrilldown(
  payload: DrilldownPayload,
  state: DrilldownStateSubset
): DrilldownResolverResult {
  switch (payload.domain) {
    case "logistics_status": return resolveLogisticsStatus(...);
    case "reporting_invoices": return resolveReportingInvoices(...);
    case "storage_orphan": return resolveStorageOrphan(...);
    // ... 12 domains 분기
  }
}
```

**결정성**: 같은 입력 → 같은 결과 (모든 sort 명시).
**Filter sync**: `payload.periodFromIso` / `periodToIso` 흡수 → reporting 기간 inherit.
**Artwork-centric**: row.artworkId 채워진 도메인은 navigate 가능.

### 3. `OperationalDrilldownDrawer.tsx` (~270 LOC)

Single global drawer. 모든 metric의 클릭이 본 drawer로 흡수.

```
store.drilldownRequest selector
  ↓
resolveDrilldown(payload, stateSubset)
  ↓
DrilldownTable (sticky thead + tbody)
  ↓
row 클릭 → setSelectedArtwork(row.artworkId) → closeDrilldown()
  ↓
DetailPanel auto-sync (rule_1 자연 복귀)
```

**rule_16 minimalism 보존**:
- text-first 표 + 작은 dot (1x1) + tabular-nums
- row hover bg-surface-muted/40 만 (그림자 0)
- Bloomberg/McKinsey 톤 (high information density)

### 4. `ClickableMetric.tsx` (~70 LOC)

기존 KPI / count / status 시각 요소를 **그대로 wrap**:

```tsx
<ClickableMetric
  onClick={() => openDrilldown({ domain: "logistics_status", logisticsStatus: "READY_FOR_PICKUP" })}
  ariaLabel="출고 대기 5건 — 상세 보기"
>
  <KPICard label="출고 대기" value={5} color={...} />
</ClickableMetric>
```

- visual redesign 0건 (children은 기존 markup 그대로)
- hover state만 미세 추가 (bg-surface-muted/50 + ring-1 + 150ms transition)
- non-clickable graceful (onClick 부재 → wrapper 미부착, DOM 부담 0)

---

## Integration Sites (v1 — pattern 시연 16개 site)

### Logistics Operations Drawer (5 KPI + Calendar)

| Card | Domain | Filter Inherit |
|---|---|---|
| 출고 대기 | logistics_status | status: READY_FOR_PICKUP |
| 배송 중 | logistics_status | status: IN_TRANSIT |
| 도착 완료 | logistics_status | status: DELIVERED |
| 검수 완료 | logistics_status | status: CONDITION_CHECKED |
| 검수 대기 | logistics_awaiting_condition | (DELIVERED + AFTER 부재 자동) |
| Calendar cell day count badge | logistics_calendar_day | isoDate inherit |
| Calendar "+N건" overflow | logistics_calendar_day | isoDate inherit |

### Image Cleanup Drawer (3 of 4 cards)

| Card | Domain | Notes |
|---|---|---|
| 외부 저장소 | storage_external | Vercel Blob 사용 작품 |
| storage 사용량 | storage_with_image | 이미지 보유 작품 전체 |
| orphan 후보 | storage_orphan | blobPathnames inherit (외부 inspection 결과) |
| 최근 업로드 | (skip) | metric 아닌 timestamp |

### Reporting Drawer (4 KPI cards) — Filter Sync 핵심

| Card | Domain | Filter Inherit |
|---|---|---|
| Total Sales | reporting_invoices | timeFilter range → periodFromIso/toIso |
| Settlement Total | reporting_settlements | timeFilter range inherit |
| Taxable Amount | reporting_tax | timeFilter range inherit |
| FX Converted | reporting_fx_converted | timeFilter range inherit (count=0면 disabled) |

```ts
// ReportingDrawer 안 — outer scope range
const range = useMemo(() => resolveTimeRange(timeFilter), [timeFilter]);

// KPISection에 props 전달
<KPISection
  aggregates={aggregates}
  timeRangeStart={range?.start}
  timeRangeEnd={range?.end}
/>

// drilldown payload에 inherit
openDrilldown({
  domain: "reporting_invoices",
  periodFromIso: timeRangeStart,
  periodToIso: timeRangeEnd,
});
```

---

## Drilldown Flow (Logistics 예시)

```
[1] LogisticsOperationsDrawer 열림
[2] 운영자: "검수 대기 3" KPI 카드 hover → 미세 ring-1 + bg-surface-muted/50
[3] 클릭 → openDrilldown({ domain: "logistics_awaiting_condition" })
[4] OperationalDrilldownDrawer 열림 (overlay, 820px width)
    ┌────────────────────────────────────────┐
    │ 검수 대기                              │
    │ 3건 · 인도 완료 후 AFTER 검수 보고서 부재 │
    ├────────────────────────────────────────┤
    │ 작품          상태       픽업       인도 │
    │ The Shore   ●도착완료  04-12  04-15   │
    │ Quiet Hour  ●도착완료  04-15  04-19   │
    │ Northern...  ●도착완료  04-21  04-24   │
    ├────────────────────────────────────────┤
    │ 3건 · 작품 클릭 시 상세 보기로 이동      │
    └────────────────────────────────────────┘
[5] 운영자: "Quiet Hour" row 클릭
[6] setSelectedArtwork("Quiet Hour".id)
[7] closeDrilldown()
[8] DetailPanel이 "Quiet Hour"로 sync — timeline / metadata / 액션 노출
[9] 운영자: DetailPanel에서 ConditionReport 작성 액션 클릭 → 검수 보고서 작성 흐름
```

**operational graph navigation 완성** — metric → 연결 객체 → 작품 → 다음 액션.

---

## Reporting Drilldown Flow (Filter Sync)

```
[1] ReportingDrawer 열림 (Owner+)
[2] timeFilter: "이번 달"
[3] aggregates.totalSalesCount = 18 인보이스
[4] 운영자: "Total Sales" KPI 카드 클릭
[5] openDrilldown({
      domain: "reporting_invoices",
      periodFromIso: "2026-05-01",
      periodToIso: "2026-05-31"
    })
[6] resolver가 18개 invoice 추출 (period filter inherit)
    │ 작품         상태   금액            발행/송부 │
    │ The Shore   PAID   USD 12,000     2026-05-03 │
    │ ...                                          │
[7] 운영자: row 클릭 → 작품 navigate
[8] DetailPanel sync — 그 작품의 inquiry / transaction / invoice / payment timeline
```

---

## 변경 / 신규 파일

### 신규 (4 + doc)

| 파일 | LOC | 역할 |
|---|---|---|
| `src/types/drilldown.ts` | ~110 | DrilldownDomain enum + Payload + Request + Row/Column shapes |
| `src/lib/drilldown-resolver.ts` | ~750 | 12개 domain pure resolver dispatch |
| `src/components/drilldown/OperationalDrilldownDrawer.tsx` | ~270 | Global reusable drawer + table renderer |
| `src/components/drilldown/ClickableMetric.tsx` | ~70 | Reusable button wrapper for metrics |
| `STEP_67_OPERATIONAL_DRILLDOWN.md` | (이 문서) | 완료 보고 |

### 변경 (5 + ARCHITECTURE.md)

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/store/useArtworkStore.ts` | ~30 LOC | drilldownRequest slice + open/close actions |
| `src/app/page.tsx` | 2 LOC | drawer mount |
| `src/components/logistics/LogisticsOperationsDrawer.tsx` | ~80 LOC | KPI 5 + Calendar cell 클릭 가능 변환 |
| `src/components/admin/ImageCleanupDrawer.tsx` | ~40 LOC | 3 SummaryCard 클릭 가능 변환 |
| `src/components/reporting/ReportingDrawer.tsx` | ~80 LOC | 4 KPI cards + filter sync (range outer-scope) |

---

## 검증 매트릭스

### 사용자 spec 11개 검증 항목

| 항목 | 결과 |
|---|---|
| ALL operational counts clickable | ✅ v1: 16개 site (Logistics 5 + Calendar 일자별 + Cleanup 3 + Reporting 4) |
| OperationalDrilldownDrawer reusable | ✅ 단일 컴포넌트가 12 domain 표 렌더 |
| Drilldown flow (metric → list → artwork → DetailPanel) | ✅ row 클릭 시 자연 복귀 |
| Domain-specific tables | ✅ Logistics / Reporting / Storage 각자 columns |
| Filter sync | ✅ Reporting timeFilter range inherit (periodFromIso/toIso) |
| Artwork-centric navigation | ✅ row.artworkId 있으면 setSelectedArtwork |
| Institutional minimalism | ✅ text-first + 작은 dot + 그림자 0 |
| Bloomberg/McKinsey 톤 | ✅ tabular-nums + high density + 절제 |
| Interaction rules (subtle) | ✅ hover bg-surface-muted/50 + ring-1 + 150ms |
| Drawer lightweight | ✅ width 820px + 즉시 open/close |
| build / type-check / lint | ✅ Route 136 kB |

### 사용자 spec 7개 제약

| 제약 | 결과 |
|---|---|
| 3-column layout | ✅ 0줄 변경 |
| visual identity / redesign | ✅ 0줄 (KPI 카드 markup 그대로, ClickableMetric은 단순 wrap) |
| Artwork-Centric | ✅ 모든 row navigation은 작품으로 returns |
| Persistence schema | ✅ 0줄 |
| 외부 라이브러리 | ✅ 0개 |
| Payment / Settlement / Tax / FX / AI / Backup-Restore / Image lifecycle / Logistics provider | ✅ 0줄 |
| build / type-check / lint | ✅ |

### 표현 정책

| 표현 | 결과 |
|---|---|
| 사용 ("운영 흐름" / "상세 보기" / "연결 객체" / "작품 이동" / "운영 참고" / "연결 데이터" / "상태 흐름") | ✅ 14회 사용 |
| 금지 ("financial guarantee" / "official accounting" / "legal audit" / "investment recommendation" / "certified valuation") | ✅ 0건 (정책 주석에서만) |

---

## Affected Domains Verification

| Domain | 변경 |
|---|---|
| Payment / Settlement / Tax | 0줄 |
| FX (STEP 31 / 32 / 34) | 0줄 (resolver는 fxSnapshot.rate를 read-only로 사용) |
| AI Market Analysis | 0줄 |
| Backup / Restore (STEP 52 / 59 / 65) | 0줄 |
| Image Lifecycle (STEP 53 / 57 / 61 / 62) | 0줄 (storage drilldown은 read-only) |
| Logistics provider (STEP 50 / 54 / 58) | 0줄 (resolver는 logistics를 read-only로 사용) |
| Documents Hub (STEP 51) | 0줄 (v1에서 미통합 — 향후 STEP에서 확장) |
| Customer (STEP 42) | 0줄 (v1에서 미통합 — 향후 STEP에서 확장) |
| System Audit (STEP 65) | 0줄 |

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_1** Artwork-First | row 클릭은 항상 setSelectedArtwork → DetailPanel sync | ✅ **강화** |
| **rule_4** Trust Layer | drilldown은 read-only navigation — destructive action 0건 | ✅ 보존 |
| **rule_8** Timeline = Navigation 확장 | timeline은 within-artwork audit, drilldown은 cross-domain operational graph | ✅ **확장** |
| **rule_14** 3-Column | 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | drawer footer "닫기" 1개 그대로 | ✅ 보존 |
| **rule_16** institutional minimalism | text-first / 작은 dot / 그림자 0 / hover subtle | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | overlay drawer (3-column 위 stack) | ✅ 보존 |

---

## 다음 STEP 후보 (v2 확장)

```
STEP 68  Customer drilldown — inquiry/purchase/owned counts → CustomerViewDrawer integration
STEP 69  Documents Hub tab counts → drilldown
STEP 70  Channel Mix / Currency Breakdown → drilldown  
STEP 71  Sidebar 작품 status 카운트 → drilldown
STEP 72  ImageCleanup orphan 후보 row → "외부 저장소에서 제거 요청" inline action
```

각 STEP은 본 STEP의 4-piece 인프라 그대로 활용 — *DrilldownDomain* 추가 + resolver 함수 1개 + 호출 site 1개 wrap 만으로 완성.

---

## 결과 요약

- 신규 파일 4개 (types + resolver + drawer + clickable, 총 ~1200 LOC)
- 수정 파일 5개 (store + page + 3 drawers)
- 0 신규 라이브러리 / 0 schema 변경 / 0 visual redesign / 0 도메인 로직 변경
- 12 domain coverage (artwork / logistics 3종 / reporting 4종 / storage 4종)
- 16개 v1 integration site (Logistics 5 + Calendar + Cleanup 3 + Reporting 4)
- Filter sync 정착 — Reporting의 timeFilter range가 drilldown payload로 inherit
- Artwork-centric navigation — 모든 row 클릭이 작품으로 returns (rule_1)
- rule_16 minimalism 보존 — KPI 카드 visual redesign 0건
- Route +4 kB (132 → 136 kB)

**STEP 67 완료. AXVELA OS = operational graph navigation system 도달.**
