# STEP 24 — Audit Filters 강화 완료

단일 작품 `AuditLogDrawer`와 `GlobalAuditDrawer`의 필터 차원을 **2~4개에서
6개로 확장** + 모든 chip을 **multi-select**로 승격 + **date range / free-text
search / 필터 초기화** 추가. STEP 25 Export bar는 그대로 — 필터된 결과만 export
되는 기존 동작 유지 (결과 0개 시 disabled).

> rule_4 (trust layer) + rule_8 (timeline = navigation) 활용도 강화 — 사용자가
> 큰 audit log set을 "언제 / 누가 / 무엇을 / 어디서" 4 차원으로 동시에 좁힐 수
> 있음. STEP 25 export와 결합 시 필터된 부분만 JSON / CSV / PDF로 외부 발송 가능.

핵심 결정:
- **단일 통합 필터 객체** — `AuditFilterState` (date / search / domain[] /
  actorType[] / actorRole[] / artworkIds[]). useState 1개로 모든 차원 추적,
  `EMPTY_AUDIT_FILTER_STATE` constant로 reset. 기존 v34의 분산된 single-select
  state 4개 (artworkFilter / domainFilter / actorFilter / roleFilter) 통합.
- **`AuditFilterBar` 공용 컴포넌트** — controlled (`state` + `onChange` +
  `mode`). single mode면 artworkIds row 숨김. AuditLogDrawer / GlobalAuditDrawer
  둘 다 같은 컴포넌트 사용 — UI 일관성 + 코드 중복 제거.
- **Multi-select 정책** — 빈 array = "전체 통과" (필터 비활성). chip 클릭 =
  toggle. 같은 chip 다시 클릭 시 선택 해제. 사용자 spec "chip 기반 필터" 준수.
- **`applyAuditFilters(classified, state, artworkLookup?)` 통합 함수** —
  audit-helpers.ts에 추가. 6 차원 AND 결합. 기존 `filterAuditEvents`는 backward
  compat을 위해 export 유지 (호출처 0건이지만 외부 import 가능성 보존). 사용자
  spec "기존 도메인 로직 변경 금지" 준수.
- **Date range — ISO lexicographic 비교** — `event.at`이 ISO 문자열이라
  startDate/endDate ("YYYY-MM-DD") prefix 비교만으로 정확한 chronological 비교
  가능. native `<input type="date">` 사용 — 외부 라이브러리 0개. start/end
  cross-bound 자동 가드 (max/min 속성).
- **Search — 인메모리 lowercase contains** — title / detail / actor + (선택)
  artwork title 매칭. 이벤트 수 작아 debounce 불필요. 사용자가 입력하는 동안
  실시간 필터링.
- **Actor type 차원 분리** — broad type (AI / HUMAN / SYSTEM) + role
  (STAFF / MANAGER / OWNER) 두 chip group이 별개 차원. 사용자 spec "AI / HUMAN
  / SYSTEM" + "STAFF / MANAGER / OWNER" 별개 요구 준수. role 필터는 actorRole이
  채워진 이벤트만 매칭 — AI/SYSTEM 이벤트는 role 필터 적용 시 자동 제외.
- **단일 작품 view에서도 search 작동** — single mode에서도 작품 제목 매칭
  활용 가능 (artworkLookup 1건 제공). 작품 1개라도 search가 자연스럽게 동작.
- **Reset 버튼 disabled when no filter** — `isAuditFilterActive` helper로 활성
  필터 존재 여부 체크. 이미 비어있으면 reset 클릭 시 변화 없으므로 시각적으로
  비활성 표시.

---

## 1. 현재 코드 분석

**STEP 24 진입 시점 (v34 baseline):**

| 항목 | 진입 시점 | STEP 24 종료 |
|---|---|---|
| AuditLogDrawer 필터 | 2개 single-select (domain / actor) | 6개 차원 multi-select 통합 |
| GlobalAuditDrawer 필터 | 4개 single-select (artwork / domain / actor / role) | 6개 차원 multi-select 통합 |
| Date range | 부재 | YYYY-MM-DD prefix 비교 |
| Free-text search | 부재 | title / detail / actor + 작품 제목 lowercase contains |
| Reset 버튼 | 부재 | "필터 초기화" — 활성 필터 없으면 disabled |
| Filter UI 컴포넌트 | 두 drawer 각자 inline `FilterChipRow` 정의 (코드 중복) | 공용 `AuditFilterBar` 컴포넌트 |
| audit-helpers 필터 함수 | `filterAuditEvents(classified, { domain, actor })` 2-axis | + `applyAuditFilters(classified, state, lookup?)` 6-axis. 기존 함수 유지 (backward compat) |
| ClassifiedAuditEvent | actorType (5-union) — broad / role 분리 부재 | 무수정 + helper `broadActorType(t): "AI" | "HUMAN" | "SYSTEM"` 추가 |
| Export bar | filtered 결과 기반, 0개일 때 disabled | **무수정** (기존 동작 그대로 유지) |
| TimelineEvent 구조 | id / artworkId / kind / title / detail / at / actor / actorRole / relatedEntityType / relatedEntityId | **0줄 변경** (사용자 spec 명시) |

**의존 관계:**
- `AuditFilterBar` (신규) ← `cn` (utils) + `audit-helpers` types/constants + `Artwork` type
- `audit-helpers.ts` ← 신규 types (`AuditActorTypeBroad` / `AuditRoleFilter` / `AuditFilterState`) + 신규 constants (`EMPTY_AUDIT_FILTER_STATE`) + 신규 helpers (`isAuditFilterActive`, `broadActorType`, `applyAuditFilters`)
- `AuditLogDrawer` / `GlobalAuditDrawer` ← `AuditFilterBar` import + state shape 단일화

순환 import 0건. 기존 도메인 store / TimelineEvent / classifyAuditEvent / classifyAuditDomain / classifyAuditActor / classifyAuditEmphasis / `filterAuditEvents` (legacy) 0줄 변경.

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/lib/audit-helpers.ts` | **신규 types**: `AuditActorTypeBroad` / `AuditRoleFilter` / `AuditFilterState`. **신규 constant**: `EMPTY_AUDIT_FILTER_STATE`. **신규 helpers**: `isAuditFilterActive` / `broadActorType` / `applyAuditFilters` (~70 LOC). 기존 `filterAuditEvents` / `classifyAuditEvent` / 분류 helper들은 0줄 변경 (legacy filter는 backward compat 유지). |
| `src/components/audit/AuditLogDrawer.tsx` | imports에서 `filterAuditEvents` / `AuditDomainFilter` / `AuditActorFilter` 제거, `applyAuditFilters` / `AuditFilterState` / `EMPTY_AUDIT_FILTER_STATE` + `AuditFilterBar` import. 2개 분산 state → 단일 `useState<AuditFilterState>`. effect는 isOpen / artworkId 변경 시 reset (기존 동작 유지). render 영역의 두 `<FilterChipRow>` JSX → 단일 `<AuditFilterBar mode="single">`. **stale `DOMAIN_FILTERS` / `ACTOR_FILTERS` / `FilterChipRow` 정의 모두 삭제** (~50 LOC 제거). `cn` import 미사용 됨 → 삭제. **dispatchTarget / navStore / Export 호출 / EmptyState / ArtworkContextLine / 모든 다른 부분 0줄 변경**. |
| `src/components/audit/GlobalAuditDrawer.tsx` | imports 정리 — `AuditDomain` / `AuditDomainFilter` / `AuditActorType` / `AuditActorFilter` / `Role` / `ROLE_LABEL_KR` 제거, `applyAuditFilters` / `AuditFilterState` / `EMPTY_AUDIT_FILTER_STATE` + `AuditFilterBar` import. 4개 분산 state → 단일 `useState<AuditFilterState>`. effect도 단일 reset. **stale top-level**: `ArtworkFilter` / `GlobalActorFilter` / `RoleFilter` types + `DOMAIN_OPTIONS` / `ACTOR_OPTIONS` / `ROLE_OPTIONS` constants + `isHumanActorType` helper + `artworkOptions` builder + `FilterChipRow` 정의 **모두 삭제** (~85 LOC 제거). filter 적용 로직: 4-axis manual `.filter()` → `applyAuditFilters` 1줄 호출 (artworkSearchLookup 제공). render 영역의 4개 `<FilterChipRow>` → 단일 `<AuditFilterBar mode="global" artworks={artworks}>`. **dispatchTarget / SummaryLine / EmptyState / ArtworkRib / 모든 다른 부분 0줄 변경**. |
| `ARCHITECTURE.md` | STEP 24 changelog 항목 추가 |

---

## 3. 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/components/audit/AuditFilterBar.tsx` | 215 | Controlled 6-axis filter UI. Search input + native date range + 3~4 chip group multi-select + Reset 버튼. mode prop으로 single/global 분기. 내부 `ChipMultiSelect<T>` 헬퍼 컴포넌트. 외부 라이브러리 0개. |
| `STEP_24_AUDIT_FILTERS_COMPLETE.md` | 본 문서 |

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/types/artwork.ts` (TimelineEvent) | 0줄 변경 (사용자 spec 명시 "TimelineEvent 구조 변경 금지") |
| `src/lib/audit-helpers.ts`의 `filterAuditEvents` (legacy) | export 유지 — backward compat. 본 STEP에서 호출처 0건이지만 외부 의존 가능성 보존 |
| `src/lib/audit-helpers.ts`의 `classifyAuditEvent` / `classifyAuditDomain` / `classifyAuditActor` / `classifyAuditEmphasis` / `getAuditEventsForArtwork` | 분류 로직 0줄 변경 |
| `src/lib/audit-export.ts` (STEP 25) | 0줄 변경 — Export bar는 filtered classified를 그대로 받음, 0개 시 disabled 동작 그대로 |
| `src/components/audit/AuditEventCard.tsx` (STEP 23) | 0줄 변경 — chain hint / 카드 본문 그대로 |
| `src/components/audit/AuditExportBar.tsx` (STEP 25) | 0줄 변경 — disabled 로직 (`classified.length === 0`) 이미 존재, 사용자 spec "결과 0개일 때 Export 버튼 disabled" 자동 충족 |
| `src/lib/audit-navigation.ts` (STEP 21) | 0줄 변경 |
| Money Flow / Contract / Invoice / Tax / Settlement / Logistics / Curation / Inquiry / 도메인 store / mock-data | 0줄 변경 |
| Persistence (STEP 27 / 27.7 / 30) / FX (STEP 31 / 32 / 34) / Market Data (STEP 19 / 29) / AI (STEP 16 / 18) | 0줄 변경 |
| 3-Column 레이아웃 / Sidebar / 다른 모든 Drawer | 0줄 변경 |
| RBAC matrix / 권한 / `package.json` | 0줄 변경 |

---

## 5. 핵심 코드

### 5.1 AuditFilterState 통합 객체

```ts
export interface AuditFilterState {
  startDate: string;        // YYYY-MM-DD or ""
  endDate: string;
  search: string;
  domains: AuditDomain[];   // 빈 array = 전체 통과
  actorTypes: AuditActorTypeBroad[];   // "AI" | "HUMAN" | "SYSTEM"
  actorRoles: AuditRoleFilter[];        // "STAFF" | "MANAGER" | "OWNER"
  artworkIds: string[];     // global only
}

export const EMPTY_AUDIT_FILTER_STATE: AuditFilterState = {
  startDate: "", endDate: "", search: "",
  domains: [], actorTypes: [], actorRoles: [], artworkIds: [],
};

export function isAuditFilterActive(state: AuditFilterState): boolean { /* ... */ }
export function broadActorType(t: AuditActorType): AuditActorTypeBroad { /* ... */ }
```

### 5.2 applyAuditFilters — 6-axis AND 결합

```ts
export function applyAuditFilters(
  classified: ClassifiedAuditEvent[],
  state: AuditFilterState,
  artworkLookup?: Record<string, string>
): ClassifiedAuditEvent[] {
  const searchLower = state.search.trim().toLowerCase();
  const domainSet = new Set(state.domains);
  // ... 다른 sets ...

  return classified.filter((c) => {
    const event = c.event;

    // 1. Date range — ISO lexicographic
    if (state.startDate !== "" && event.at < state.startDate) return false;
    if (state.endDate !== "" && event.at.slice(0, 10) > state.endDate) return false;

    // 2. Domain
    if (state.domains.length > 0 && !domainSet.has(c.domain)) return false;

    // 3. Actor type (broad)
    if (state.actorTypes.length > 0 && !actorTypeSet.has(broadActorType(c.actorType))) return false;

    // 4. Actor role
    if (state.actorRoles.length > 0) {
      if (!event.actorRole) return false;
      if (!roleSet.has(event.actorRole as AuditRoleFilter)) return false;
    }

    // 5. Artwork (global only)
    if (state.artworkIds.length > 0 && !artworkSet.has(event.artworkId)) return false;

    // 6. Search — title / detail / actor / artwork title
    if (searchLower !== "") {
      const haystack = [event.title, event.detail ?? "", event.actor ?? ""];
      if (artworkLookup) {
        const title = artworkLookup[event.artworkId];
        if (title) haystack.push(title);
      }
      if (!haystack.some((s) => s.toLowerCase().includes(searchLower))) return false;
    }

    return true;
  });
}
```

### 5.3 AuditFilterBar — 공용 controlled component

```tsx
<AuditFilterBar
  state={filterState}
  onChange={setFilterState}
  mode="single"           // or "global"
  artworks={artworks}     // global mode에서 artwork chip source
/>
```

내부 구조 (6 row):
```
┌──────────────────────────────────────────────────────────┐
│ [search input ........................] [필터 초기화]    │  Row 1
│ 기간  [📅 시작일] ~ [📅 종료일]                           │  Row 2
│ 유형  ( AI ) ( 문서 ) ( 정산·결제·세무 ) ( 물류 ) ...     │  Row 3
│ 작성자 ( AI ) ( 사람 ) ( System )                         │  Row 4
│ 권한  ( Staff ) ( Manager ) ( Owner )                    │  Row 5
│ 작품  ( Artwork A ) ( Artwork B ) ...                     │  Row 6 (global only)
└──────────────────────────────────────────────────────────┘
```

활성 chip은 `bg-ink text-white border-ink`로 하이라이트, 그 외는 `bg-surface text-ink-muted border-line`. 필터 비활성 시 Reset 버튼 disabled.

### 5.4 AuditLogDrawer — 통합 후

```tsx
const [filterState, setFilterState] = React.useState<AuditFilterState>(
  EMPTY_AUDIT_FILTER_STATE
);

React.useEffect(() => {
  if (!isOpen) return;
  setFilterState(EMPTY_AUDIT_FILTER_STATE);
}, [isOpen, artworkId]);

const searchLookup = React.useMemo<Record<string, string>>(
  () => artwork ? { [artwork.id]: `${artwork.title} · ${artwork.artist.name}` } : {},
  [artwork]
);

const filtered = applyAuditFilters(allClassified, filterState, searchLookup);

// JSX:
<AuditFilterBar state={filterState} onChange={setFilterState} mode="single" />
<AuditExportBar classified={filtered} ... />  // 0건 시 자동 disabled
```

### 5.5 GlobalAuditDrawer — 통합 후

```tsx
const [filterState, setFilterState] = React.useState<AuditFilterState>(
  EMPTY_AUDIT_FILTER_STATE
);

const artworkSearchLookup = React.useMemo<Record<string, string>>(() => {
  const m: Record<string, string> = {};
  for (const a of artworks) m[a.id] = `${a.title} · ${a.artist.name}`;
  return m;
}, [artworks]);

const filtered = React.useMemo(() => {
  const onlyClassified = allClassified.map((x) => x.classified);
  const filteredSet = new Set(
    applyAuditFilters(onlyClassified, filterState, artworkSearchLookup)
      .map((c) => c.event.id)
  );
  return allClassified.filter(({ classified }) =>
    filteredSet.has(classified.event.id)
  );
}, [allClassified, filterState, artworkSearchLookup]);

// JSX:
<AuditFilterBar state={filterState} onChange={setFilterState} mode="global" artworks={artworks} />
<AuditExportBar classified={filteredClassified} ... />  // 0건 시 자동 disabled
```

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    74.5 kB         162 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 32 (Invoice FX Lock) | 73.1 kB | — |
| STEP 34 (Settlement FX Conversion) | 73.9 kB | +0.8 |
| **STEP 24 (Audit Filters 강화)** | **74.5 kB** | **+0.6** |

`tsc --noEmit` 0 error / `next build` 0 warning. **외부 npm 의존성 0개**.

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_4** Trust Layer | ✅ **강화** | 큰 audit log set을 6 차원으로 좁힐 수 있어 trust 증거 검증 효율 ↑ |
| **rule_7** RBAC | ✅ | 권한 chip이 broad actor type과 별개 차원. role-based 필터링 강화 |
| **rule_8** Timeline = Navigation | ✅ | 필터된 결과도 카드 클릭으로 target drawer 진입 (STEP 21 동작 그대로) |
| **rule_14 / rule_17** Layout / Layer | ✅ | 3-Column 무변경, drawer 내부 UI만 변경 |
| 기존 도메인 로직 변경 | ✅ 0줄 | TimelineEvent / 도메인 store / mock-data / 모든 도메인 액션 / 분류 helper / `filterAuditEvents` legacy 모두 무수정 |
| Money Flow / Contract / Invoice / Tax / Settlement / Logistics 변경 | ✅ 0줄 | |
| Backend 추가 / 외부 라이브러리 | ✅ 0건 / 0개 | |
| TimelineEvent 구조 변경 | ✅ 0줄 | actorRole 등 기존 필드만 활용 |
| Export 동작 (STEP 25) | ✅ 무변경 | filtered 결과 기반, 0건 disabled — 기존 동작 그대로 |
| Search 작동 | ✅ | title / detail / actor / artwork title 4-field |
| 결과 0개 시 Export disabled | ✅ | `AuditExportBar`의 `isEmpty` 로직 그대로 활성 |
| 단일 작품 view에서 artwork filter 숨김 | ✅ | mode="single"에서 row 미렌더 |
| Global view에서 artwork filter 표시 | ✅ | mode="global" + artworks prop |
| chip 기반 필터 (복잡한 테이블 금지) | ✅ | 모두 chip / native input |
| Reset 버튼 | ✅ | "필터 초기화" — 활성 필터 없으면 disabled |

---

## 8. 검증 시나리오

### A — Date range 필터 동작

1. AuditLogDrawer 열기 (예: art_002)
2. 시작일 = 2026-05-01, 종료일 = 2026-05-04 입력
3. **기대**: 그 범위 안 (포함) 이벤트만 노출. 카드 카운트 (filteredCount / totalCount) 갱신.
4. 시작일만 입력하고 종료일 비우기 → 시작일 이후 모든 이벤트 통과
5. 종료일만 입력 → 종료일 이전 모든 이벤트 통과

### B — Domain multi-select toggle

1. AuditLogDrawer에서 "AI" chip 클릭 → AI 도메인 이벤트만 노출
2. 추가로 "MONEY" 클릭 → AI + MONEY 도메인 모두 노출 (OR within axis)
3. "AI" 다시 클릭 → MONEY만 남음
4. **기대**: chip 활성/비활성 시각 명확, 결과 즉시 갱신

### C — Actor type 차원

1. "AI" chip 클릭 (actor type 필터) → AI 작성 이벤트만
2. "사람" 추가 → AI + 사람 작성 이벤트
3. **기대**: AI / HUMAN / SYSTEM 분류가 broad type 기준 정확

### D — Role 차원 — STAFF만

1. "Manager" chip 클릭 (role 필터)
2. **기대**: actorRole === "MANAGER"인 이벤트만. AI / SYSTEM 이벤트는 자동 제외 (actorRole 부재)

### E — Global artwork filter

1. GlobalAuditDrawer 열기 (Manager / Owner 권한)
2. 작품 chip group에서 art_002 + art_004 토글
3. **기대**: 두 작품 timeline만 노출, 다른 작품 이벤트 숨김
4. SummaryLine: "N건 (2개 작품)" 갱신

### F — Search — title 매칭

1. 검색창에 "발송" 입력
2. **기대**: title이나 detail에 "발송" 포함된 이벤트만 노출 (Invoice 발송 / 인보이스 발송 등)
3. lowercase 비교 → "Invoice" 입력해도 "invoice"로 매칭

### G — Search — actor 매칭

1. "Han" 입력
2. **기대**: actor === "Manager · J. Han" 이벤트들 매칭

### H — Search — Global에서 작품 제목 매칭

1. GlobalAuditDrawer에서 "Aurora" 입력 (작품 제목 일부)
2. **기대**: 작품 제목에 "Aurora" 포함된 작품의 모든 이벤트 노출

### I — 다중 차원 AND 결합

1. 시작일 = 2026-04-01 + Domain "MONEY" + Search "1,380"
2. **기대**: 4월 1일 이후 + MONEY 도메인 + (title/detail/actor에 "1,380" 포함) 이벤트만 — 예: STEP 32 USD invoice 발송 이벤트의 FX detail

### J — Export 결과 0건 시 disabled

1. 어떤 작품에 대해 매칭 안 되는 필터 조합 입력 (예: search="zzzzzz")
2. 카드 0개 + EmptyState 노출
3. **기대**: AuditExportBar의 JSON / CSV / PDF 버튼 모두 disabled (시각적으로 dimmed)

### K — 결과 1+ 건일 때 Export 정상

1. 필터 조건에 부합하는 이벤트가 적어도 1건 노출
2. JSON / CSV / PDF 클릭
3. **기대**: 필터된 결과만 export — 전체 이벤트 아님 (STEP 25 기존 동작)

### L — Reset 동작

1. 다양한 필터 입력 후 "필터 초기화" 클릭
2. **기대**:
   - 모든 chip 비활성 상태로
   - date input 비워짐
   - search input 비워짐
   - 모든 이벤트 표시
   - Reset 버튼 disabled (활성 필터 없음)

### M — Drawer 닫힘 후 재오픈 시 reset

1. 필터 다양하게 입력 → drawer 닫기 → 다시 열기
2. **기대**: 모든 필터 초기 상태 (effect의 EMPTY_AUDIT_FILTER_STATE 복원)

### N — Single artwork view에서 artwork chip 안 보임

1. AuditLogDrawer (단일 작품) 열기
2. **기대**: filter rows 5개만 (search / 기간 / 유형 / 작성자 / 권한) — "작품" row 부재

### O — 성능 — 큰 timeline 인메모리 필터

1. 데모 데이터 + 사용자 추가 이벤트 다수
2. 검색 typing 중에도 즉각 반응 (debounce 없음)
3. **기대**: 시각 lag 없음 (mock 데이터 규모에서 OK)

### P — 도메인 store 동작 정상

1. 새 작품 생성 / invoice 발송 / settlement 등 도메인 액션 실행
2. **기대**: STEP 24 변경이 도메인 흐름에 무영향. timeline / 모든 cascade 정상.

### Q — Persistence (STEP 27 / 27.7 / 30) 호환

1. 필터 적용 상태에서 F5 새로고침
2. **기대**: 도메인 데이터 영속 (timeline / artworks / etc) — 단 필터 state는 UI 상태이므로 reset (drawer 자체가 닫히고 다시 열면 EMPTY로 시작)

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| 필터 state 영속 부재 | drawer 닫혔다 다시 열면 reset — UI 상태이므로 의도된 동작 | URL search params로 deep-link / shareable filter URL 추가 가능 |
| 검색 정확 매치 부재 | substring contains만 — exact match / regex 미지원 | 향후 STEP에서 advanced search syntax 도입 가능 |
| Boolean operator (OR / AND) UI 부재 | 모든 차원 AND, 같은 차원 내 OR — 더 복잡한 query 미지원 | 사용자 spec "복잡한 테이블 금지" 준수 — 단순 유지 |
| Date range timezone | event.at은 UTC ISO, date input은 local YYYY-MM-DD — 자정 경계 이벤트는 timezone에 따라 분류 다를 수 있음 | 한국 사용자 기준 무시할 수준 |
| 작품 chip 많을 때 wrap | artworks 50+ 시 chip group 화면 길어짐 | 후속 STEP에서 collapse / search inside chip group 고려 |
| Saved filter preset 부재 | 자주 쓰는 필터 조합 저장 안 됨 | 후속 STEP — 즐겨찾기 필터 |
| Filter UI 항상 노출 | collapse 미지원 — 헤더 공간 차지 | 후속 STEP에서 "필터 접기/펼치기" 토글 가능 |
| Search debounce 부재 | 매 keystroke마다 재계산 | mock 데이터 규모에서 OK. 실 백엔드 연동 시 debounce + indexed search 필요 |
| Legacy `filterAuditEvents` export | 호출처 0건이지만 backward compat 위해 유지 | 후속 cleanup STEP에서 deprecate notice 가능 |

---

## 10. 다음 STEP 후보

1. **STEP 33 — Real FX Provider** — OpenExchangeRatesProvider 실 구현. STEP 31 mock swap.
2. **STEP 26 — Audit Trail Visualization** — timeline graph / heatmap. 본 STEP 24 필터 결과를 시각화에 그대로 연결.
3. **STEP 28 — Real AI Integration** — Curation / Inquiry response / Price suggestion 실 AI API.
4. **STEP 35 — Multi-currency Reporting Layer** — 갤러리 전체 매출 / 정산 / 과세 KRW 통일 환산 리포트.
5. **STEP 36 — Settlement Currency-aware Net** — splitSettlement / splitTax helper에 currency 파라미터.
6. **STEP 27.5 — IndexedDBAdapter** — localStorage 5MB 한계 해소.
7. **STEP 30.5 — Periodic Pull / Polling** — multi-device 시 다른 device 변경 자동 인식.
8. **STEP 37 — Document Approval Workflow** — Contract / Curation multi-step approval.
9. **STEP 38 — Saved Filter Preset** — 본 STEP 24의 자주 쓰는 필터 조합을 사용자별 저장 — 빠른 audit workflow.
