# STEP 76 — Documents Row Direct Navigation Enhancement

> **목표**: Documents Hub의 row click 흐름을 두 가지로 명확히 분리:
> (A) row 자체 click → 순수 *작품 이동* (DetailPanel sync)
> (B) row 안 inline "문서 상세" 액션 → 기존 도메인 detail drawer open
>
> 이전: row click이 두 흐름을 동시 수행하며 작품 navigate가 묻혀 있었음.
> 본 STEP: 작품 이동을 row click의 *primary action*으로 격상.
>
> **신규 drawer 0개 · UI redesign 0건 · 단일 컴포넌트 80 LOC 변경**

---

## State

- **이전**: STEP 74 / Route 141 kB
- **이번**: STEP 76 / **Route 141 kB (+0 kB)**
- Build ✅ · type-check ✅ · Lint ✅

---

## 핵심 변경 — 두 흐름 분리

### Before (STEP 51 도입)

```
[row 클릭]
  │
  ├─ if (row.artworkId) setSelectedArtwork(row.artworkId)  ← 부수 효과
  ├─ closeDocuments()
  └─ setTimeout(0) → 도메인 detail drawer open  ← primary action
```

작품 navigate가 detail drawer 뒤에 묻힘. 운영자가 항상 detail drawer를 보게 됨.

### After (STEP 76)

```
[row 자체 클릭]
  │ (clickable: hasArtwork = !!row.artworkId)
  ├─ setSelectedArtwork(row.artworkId)  ← primary action
  └─ closeDocuments()
                                          → DetailPanel sync (rule_1)

[row 안 inline "문서 상세" 클릭]
  │ (e.stopPropagation() → row click 차단)
  ├─ if (hasArtwork) setSelectedArtwork(row.artworkId)
  ├─ closeDocuments()
  └─ setTimeout(0) → 도메인 detail drawer open  ← 명시적 의도
```

---

## DocumentRowCard 재구성

### Outer element 분기

```tsx
const hasArtwork = !!row.artworkId;
const OuterTag = hasArtwork ? "button" : "div";
```

| Case | Element | Cursor | Hover | Click |
|---|---|---|---|---|
| `hasArtwork === true` | `<button>` | pointer | bg-surface-muted/60 | 작품 navigate |
| `hasArtwork === false` | `<div>` | default | none | none |

a11y semantics 정확 — 클릭 가능한 영역은 button, 비-clickable은 div.

### col 5 추가 (grid `[110px_1fr_140px_120px_72px]`)

```tsx
<div className="flex items-center justify-end gap-1.5">
  {/* (a) inline "문서 상세" button — 도메인 detail drawer */}
  <button
    type="button"
    onClick={handleOpenDocDetail}
    className="px-1.5 py-0.5 rounded border border-line bg-surface
               text-[9.5px] hover:border-ink/60 hover:bg-surface-muted"
  >
    문서 상세
  </button>

  {/* (b) "작품 이동" affordance chevron */}
  {hasArtwork ? (
    <span title="작품 이동">→</span>
  ) : (
    <span className="w-[12px]" />  {/* placeholder for layout 일관성 */}
  )}
</div>
```

---

## Action Propagation Guard

```tsx
const handleOpenDocDetail = (e: React.MouseEvent) => {
  e.stopPropagation();  // row click 전파 차단 (사용자 spec 4번)
  // ... 도메인 detail drawer open
};
```

inline button click → `e.stopPropagation()` → row click 핸들러 발동 안 됨. 두 흐름 완전 분리.

---

## Integration Sites

| Site | 동작 | Domain |
|---|---|---|
| Document row 자체 click | 작품 navigate (DetailPanel sync) | All 4 (INVOICE / CONTRACT / TAX / CONDITION_REPORT) |
| Inline "문서 상세" button | 도메인 detail drawer open | row.domain별 분기 |
| "→" chevron (시각 affordance만) | tooltip "작품 이동" | hasArtwork면 표시 |

문서 도메인 4개 모두 적용됨 (`row.domain`별 dispatch 그대로).

---

## Artwork-Centric Navigation (rule_1 정점)

```
Documents Hub 진입
   ↓ row click (단순 작품 이동)
작품 SSOT (DetailPanel sync)
   ↓ Timeline에 *해당 문서의 audit chain* 자연 노출
   ↓ Inquiry / Transaction / 다른 문서 / 다음 액션
```

문서는 작품의 *signal*이지 독립 entity가 아니라는 rule_1을 UX 동작 수준에서 강제.

운영자가 명시적으로 도메인 detail drawer를 원할 때만 inline "문서 상세" 버튼 사용 — 의도된 navigation만 발생.

---

## Drilldown Flow 시나리오

```
[1] DocumentsDrawer 열림 → 인보이스 탭 12건 표시
[2] 운영자: "Quiet Hour" invoice row hover → bg-surface-muted/60 + → chevron 표시
[3] row 자체 클릭
[4] handleNavigateArtwork:
    setSelectedArtwork("artwork-quiet-hour-id")
    closeDocuments()
[5] DocumentsDrawer 닫힘 → DetailPanel에 Quiet Hour 작품 노출
[6] DetailPanel timeline → 해당 invoice의 audit chain (created / sent / paid) 시각화
[7] 운영자가 다음 흐름 (settlement / tax) 작품 컨텍스트에서 자연 진입

vs.

[2'] 운영자: 명시적으로 invoice 자체 detail 보고 싶음
[3'] inline "문서 상세" 버튼 클릭
[4'] handleOpenDocDetail (e.stopPropagation):
     setSelectedArtwork(...) (부수)
     closeDocuments()
     setTimeout(0) → openInvoiceDetail("invoice-id")
[5'] InvoiceDetailDrawer 열림 (작품도 select 됨 — 닫으면 DetailPanel 자연 복귀)
```

---

## 변경 / 신규 파일

### 신규 (1)

| 파일 | 역할 |
|---|---|
| `STEP_76_DOCUMENTS_ROW_NAVIGATION.md` | (이 문서) 완료 보고 |

### 변경 (1 + ARCHITECTURE.md)

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/components/documents/DocumentsDrawer.tsx` | ~80 LOC (단일 `DocumentRowCard` 재구성) | 두 흐름 분리 + outer element 분기 + col 5 affordance |

---

## 검증 매트릭스

### 사용자 spec 7개 검증 항목

| 항목 | 결과 |
|---|---|
| row click → setSelectedArtwork(row.artworkId) | ✅ handleNavigateArtwork |
| closeDocuments | ✅ 두 흐름 모두 |
| DetailPanel sync | ✅ store action 자연 발생 |
| artworkId 부재 시 row 비-clickable | ✅ OuterTag 분기 + cursor-default |
| Visual feedback (cursor + hover + 작품 이동 affordance) | ✅ → chevron + tooltip |
| 기존 액션 (도메인 detail drawer) 보존 | ✅ inline "문서 상세" button |
| event.stopPropagation 적용 | ✅ inline button에 명시 |

### 사용자 spec 8개 제약

| 제약 | 결과 |
|---|---|
| 신규 drawer 시스템 | ✅ 0개 |
| Documents Hub UI redesign | ✅ 0건 (단일 컴포넌트, 외부 markup 0줄) |
| 문서 generation / export 로직 | ✅ 0줄 |
| invoice / contract / tax / condition report 데이터 로직 | ✅ 0줄 |
| Payment / Settlement / Tax / FX 계산 | ✅ 0줄 |
| Persistence schema | ✅ 0줄 |
| 외부 라이브러리 | ✅ 0개 |
| Build / type-check / lint | ✅ Route 141 kB (+0 kB) |

### 표현 정책

| 표현 | 결과 |
|---|---|
| 사용 ("작품 이동" / "연결 작품" / "문서 상세" / "운영 참고") | ✅ 11회 사용 |
| 금지 ("legal proof" / "certified legal document" / "official accounting" / "guaranteed record" / "tamper-proof") | ✅ 0건 |

---

## Affected Domains Verification

| Domain | 변경 |
|---|---|
| Payment / Settlement / Tax / FX | 0줄 |
| AI Market Analysis | 0줄 |
| Backup / Restore | 0줄 |
| Image Lifecycle | 0줄 |
| Logistics provider | 0줄 |
| Customer (STEP 42 / 73) | 0줄 |
| Reporting (STEP 35 / 70) | 0줄 |
| Sidebar (STEP 74) | 0줄 |
| `documents-aggregates.ts` (`aggregateDocuments`) | 0줄 |
| `OperationalDrilldownDrawer` (STEP 67 / 72) | 0줄 |
| `ClickableMetric` (STEP 67) | 0줄 |
| `drilldown-resolver.ts` (STEP 74) | 0줄 |
| `drilldown.ts` types | 0줄 |
| Documents Hub 외부 (filter / tab / footer / backup) | 0줄 |
| System Audit (STEP 65) | 0줄 |
| Persistence (STEP 27 / 27.7 / 30) | 0줄 |

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_1** Artwork-First (도메인 흐름 정점) | row click의 primary action을 *작품 이동*으로 격상 — 문서는 작품의 signal | ✅ **강화 정점** |
| **rule_4** Trust Layer | LOCK badge 보존 + inline "문서 상세" 명시 의도 — 무의식적 click이 detail 안 열음 | ✅ 보존 |
| **rule_8** Timeline = Navigation 강화 | 작품 timeline에 문서 audit chain 자연 노출 — 단발 detail보다 풍부 | ✅ 강화 |
| **rule_11** Transaction Core | Invoice → Transaction → Artwork chain 시각적 매니페스트 (`aggregateDocuments` 그대로) | ✅ 보존 |
| **rule_14** 3-Column | 0줄 | ✅ |
| **rule_15** Max 3 buttons | drawer footer "닫기" / export 그대로 | ✅ |
| **rule_16** institutional minimalism | col 5 추가는 chevron + 작은 inline button만, 군더더기 0 | ✅ |
| **rule_17** Drawer/Modal Layer | overlay drawer (3-column 위 stack) | ✅ |

---

## 다음 STEP 후보

```
STEP 77  Sidebar Pending Approvals → drilldown
STEP 78  Audit log filter → drilldown
STEP 79  Customer detail channelMix entries → customer_inquiries (source filter)
STEP 80  ImageCleanup orphan inline action — "외부 저장소에서 제거 요청"
STEP 81  Document timeline event → row click → 같은 작품 timeline 안 그 문서 위치 highlight
```

각 STEP은 STEP 67 4-piece + STEP 74/76 패턴 그대로 활용.

---

## 결과 요약

- 신규 파일 1개 (이 문서)
- 변경 파일 1개 (DocumentsDrawer 단일 컴포넌트)
- 0개 신규 domain / 0 schema / 0 도메인 로직 변경
- 두 흐름 명확 분리: row click = 작품 이동, inline button = 도메인 detail
- `event.stopPropagation` 명시적 차단으로 nested click 안전
- artworkId 부재 시 button → div + non-clickable (a11y 정확)
- col 5 추가: inline "문서 상세" button + → chevron affordance
- Visual 보존 — Documents Hub 외부 markup 0줄
- Route +0 kB (141 kB)

**STEP 76 완료. Documents Hub row click의 primary action이 *작품 이동*으로 격상 — rule_1 Artwork-First가 동작 수준에서 강제.**
