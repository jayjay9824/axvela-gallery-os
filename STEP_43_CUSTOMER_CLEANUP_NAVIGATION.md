# STEP 43 — Customer Cleanup + Detail Navigation

> **목표**: (A) STEP 41 deprecated 파일 안전 삭제 + (B) Customer Detail에서
> 보유 작품 / 문의 작품 row 클릭 시 DetailPanel로 navigation. rule_8 Timeline =
> Navigation 정신을 Customer view까지 확장.

---

## State

- **이전**: STEP 42 / Route 88.6 kB / Customer 1급 도메인 type 승격
- **이번**: STEP 43 / **Route 88.8 kB (+0.2 kB)** / Cleanup + Navigation
- Build ✅ · type-check ✅ (`tsc --noEmit` 0 error)

---

## Flow

### A) Cleanup
```
[삭제] src/lib/collector-aggregates.ts             (STEP 41 deprecated)
[삭제] src/components/collector/CollectorViewDrawer.tsx  (STEP 41 deprecated)
[삭제] src/components/collector/                   (빈 폴더)
```

### B) Customer Detail Navigation
```
CustomerViewDrawer
  └─ "보유 / 매입 작품" row (button)  ──┐
                                       ├→ select(artworkId) + closeView()
  └─ "문의 이력" row (button)         ──┘
                                       ↓
                                       DetailPanel (column 3) auto-shows artwork
```

---

## 변경 파일 목록

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/components/customer/CustomerViewDrawer.tsx` | ~80 LOC | Navigation handler + Section interactive button 분기 + `SectionRowContent` 신규 sub-component |
| `ARCHITECTURE.md` | +1 changelog | STEP 43 추가 |

---

## 삭제 파일 목록

| 파일 | LOC | 사유 |
|---|---|---|
| `src/lib/collector-aggregates.ts` | 290 | STEP 42에서 customer-aggregates.ts로 승격, deprecated |
| `src/components/collector/CollectorViewDrawer.tsx` | 470 | STEP 42에서 CustomerViewDrawer로 승격, deprecated |
| `src/components/collector/` (folder) | — | 비어있는 디렉토리 |

**Tree-shake 영향 0** — STEP 42에서 page.tsx import 교체로 이미 production bundle에서 제외되어 있던 상태.

---

## 검증 — 외부 import 0건

```bash
$ grep -rn "from.*collector-aggregates\|from.*collector/CollectorViewDrawer" src/
(0 matches)

$ grep -rn "CollectorViewDrawer" src/
src/components/customer/CustomerViewDrawer.tsx:5:// drawer. STEP 41 CollectorViewDrawer의 superset — kind / segment /
```

남은 1건은 `CustomerViewDrawer.tsx` 헤더 주석의 역사적 설명 (코드 참조 0). 정보용으로 유지.

**Backward-compat 의도적 유지** (STEP 42에서 이미 검증):
- Store 액션 `openCollectorView` / `closeCollectorView` / `selectCollector`
- 슬라이스 `collectorViewRequest`
- 타입 `CollectorViewRequest`
- 권한 `collector.view_global`

→ 모두 그대로. 재명명 시 호출자 비용 큼. CustomerViewDrawer가 이 4개를 그대로 사용 중.

---

## 핵심 코드

### B-1) Navigation handler (단일 callback에 select + close 묶음)

```tsx
// STEP 43 — Customer Detail Navigation. 작품 row 클릭 시 호출되는 핸들러.
// (1) artworkId를 select → DetailPanel + Sidebar pending approval queue가
//     해당 작품으로 전환. (2) drawer 닫기 → 사용자가 즉시 DetailPanel을 본다.
// selectedCollectorId는 store에 보존되므로 drawer 재진입 시 같은 customer로 복귀.
const handleArtworkNavigate = React.useCallback(
  (artworkId: string) => {
    selectArtwork(artworkId);
    closeView();
  },
  [selectArtwork, closeView]
);
```

### B-2) Section row interactive 분기 (button vs div)

```tsx
{items.map((item, i) => (
  <li key={item.key} className={cn(i > 0 && "border-t border-line")}>
    {item.onClick ? (
      <button
        type="button"
        onClick={item.onClick}
        aria-label={item.ariaLabel}
        className={cn(
          "w-full px-3 py-2 flex items-center gap-3 text-left",
          "hover:bg-surface-muted focus:bg-surface-muted focus:outline-none",
          "cursor-pointer transition-colors",
          "group"
        )}
      >
        <SectionRowContent item={item} interactive />
      </button>
    ) : (
      <div className="px-3 py-2 flex items-center gap-3">
        <SectionRowContent item={item} interactive={false} />
      </div>
    )}
  </li>
))}
```

### B-3) Section item에 onClick 부착 — 두 Section 모두

```tsx
{/* 보유 / 매입 작품 */}
<Section
  title="보유 / 매입 작품"
  items={myTransactions.map((t) => {
    const a = artworkById[t.artworkId];
    const title = a?.title ?? t.artworkId;
    return {
      key: t.id,
      primary: title,
      // ...
      // STEP 43 — Customer Detail Navigation
      onClick: () => onArtworkNavigate(t.artworkId),
      ariaLabel: `${title} 작품 상세로 이동`,
    };
  })}
/>

{/* 문의 이력 */}
<Section
  title="문의 이력"
  items={myInquiries.map((i) => {
    const a = artworkById[i.artworkId];
    const title = a?.title ?? i.artworkId;
    return {
      key: i.id,
      // ...
      onClick: () => onArtworkNavigate(i.artworkId),
      ariaLabel: `${title} 작품 상세로 이동`,
    };
  })}
/>
```

### B-4) SectionItem interface 확장 (backward-compat — optional fields만 추가)

```tsx
interface SectionItem {
  key: string;
  primary: string;
  secondary: string;
  meta: React.ReactNode;
  tag: string;
  tagAccent: "neutral" | "active" | "completed" | "muted";
  /**
   * STEP 43 — Customer Detail Navigation. row 클릭 시 호출되는 핸들러.
   * 부재 시 row는 non-interactive (정보 표시만).
   */
  onClick?: () => void;
  /** STEP 43 — accessibility 라벨. onClick 부재 시 무의미. */
  ariaLabel?: string;
}
```

---

## Build 결과

```
> npm run build

Route (app)                              Size     First Load JS
┌ ○ /                                    88.8 kB         176 kB
└ ○ /_not-found                          873 B            88 kB
+ First Load JS shared by all            87.1 kB

✓ Compiled successfully
✓ type-check 통과 (tsc --noEmit, 0 error)
```

**Δ Route**: 88.6 kB → **88.8 kB (+0.2 kB)** vs STEP 42 baseline.

증분 분석:
- Cleanup (A): 0 byte 영향 — STEP 42에서 이미 tree-shake로 deprecated 파일 제외 중
- Navigation (B): +0.2 kB — `useCallback` + `<button>` branch + `SectionRowContent` sub-component + ARIA props

---

## 검증 매트릭스

| 사용자 spec | 검증 결과 |
|---|---|
| **A. Cleanup** | |
| `src/lib/collector-aggregates.ts` 삭제 | ✅ |
| `src/components/collector/CollectorViewDrawer.tsx` 삭제 | ✅ |
| `/collector` 폴더 비면 삭제 | ✅ |
| 사용되지 않는 import / reference 확인 | ✅ 외부 import 0건, 헤더 주석 1건 (정보용) |
| build에서 tree-shake 영향 여부 확인 | ✅ Route 변동 0 — 이미 tree-shake로 제외 중이었음 |
| **B. Navigation** | |
| 작품 row 클릭 시 artworkId select | ✅ `selectArtwork(artworkId)` |
| Customer drawer 닫기/유지 — 닫기 권장 | ✅ `closeView()` 호출 → DetailPanel 자동 노출 |
| Customer list / detail의 row에 hover / cursor / aria-label | ✅ `hover:bg-surface-muted` + `cursor-pointer` + `aria-label="{title} 작품 상세로 이동"` |
| Staff/Manager 권한 흐름 유지 | ✅ drawer 진입 권한 `collector.view_global` 그대로, select 자체는 unguarded (read action) |
| 기존 3-column layout 변경 금지 | ✅ Drawer overlay만 |
| **제약** | |
| Customer master data slice 도입 금지 | ✅ store slice 0개 추가 |
| Persistence schema 변경 금지 | ✅ PersistedState / validateV1 / SCHEMA_VERSION 0줄 변경 |
| Payment / Settlement / Tax / Invoice / FX 로직 변경 금지 | ✅ 0줄 변경 |
| AI 로직 변경 금지 | ✅ 0줄 변경 |
| 외부 API 호출 금지 | ✅ fetch / axios 0건 |
| 신규 라이브러리 추가 금지 | ✅ `package.json` 0줄 변경 |

---

## Manifesto rule 정합성

| Rule | STEP 43 영향 | 상태 |
|---|---|---|
| **rule_1** Artwork-First | Customer view 안 작품 row → Artwork 회귀 흐름 | ✅ 강화 |
| **rule_4** Document Trust | 변경 없음 | ✅ 보존 |
| **rule_7** RBAC | drawer 진입 권한 그대로, select는 read action | ✅ 보존 |
| **rule_8** Timeline = Navigation | STEP 21 패턴 (audit → 도메인 객체 진입)을 Customer → Artwork에 확장 | ✅ 강화 |
| **rule_9** Work Queue | Sidebar pending approval queue도 select 액션 사용 — 같은 패턴 | ✅ 일관성 |
| **rule_10** No dashboard | "고객" PRIMARY 항목 그대로, 작품 진입은 결국 작품 중심 | ✅ 보존 |
| **rule_14** 3-Column | 레이아웃 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | Drawer footer "닫기" 1개만, row interaction은 1차 액션 영역 외 | ✅ 보존 |
| **rule_16** 미니멀 디자인 | hover/cursor 미세 보강만, 그림자 추가 0 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | overlay만, drawer close → 이미 마운트된 column 3 노출 | ✅ 보존 |

---

## UX 흐름 — Before/After

### Before (STEP 42)
1. Customer drawer 열기
2. 컬렉터 선택 → 보유 작품 목록 보기
3. 그 작품의 상세를 보려면? **drawer 닫고 → ArtworkGrid에서 검색해서 클릭**
4. 단절된 흐름.

### After (STEP 43)
1. Customer drawer 열기
2. 컬렉터 선택 → 보유 작품 목록 보기
3. **작품 row 클릭** → drawer 자동 닫힘 → DetailPanel이 그 작품으로 전환
4. 같은 컬렉터로 돌아가려면? 사이드바 "고객" 다시 클릭 → 같은 컬렉터 선택 상태 유지 (store에 보존)
5. 연속 흐름 완성.

---

## 다음 STEP 후보

사용자 제시 우선순위:
1. **Customer Export (CSV / PDF)** — STEP 25 / 35.6 패턴 답습. 새 lib 1개 (`customer-export.ts`).
2. **AI 시장 분석 view** (rule_18 (b) 본격화) — STEP 29 외부 데이터 토대 위 commentary layer.

기타 후보:
- Channel mix → Reporting Drawer 통합
- Inquiry 신규 생성 시 Customer suggest

---

## 결과 요약

- 삭제 파일 2개 (760 LOC) + 빈 폴더 1개
- 수정 파일 1개 (~80 LOC)
- 0 신규 라이브러리 / 0 외부 API / 0 store slice / 0 schema 변경
- Tree-shake 검증으로 cleanup 안전성 확인
- rule_8 Timeline = Navigation 정신을 Customer 도메인까지 확장
- Route +0.2 kB (88.6 → 88.8 kB)

**STEP 43 완료.**
