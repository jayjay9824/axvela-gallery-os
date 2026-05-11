# STEP 27.7 — Multi-tab Sync 완료

STEP 27 LocalStorage 기반 Persistence Layer에 **multi-tab 동기화**를 추가.
같은 브라우저에서 AXVELA를 여러 탭으로 열었을 때, 한 탭의 변경이 다른 탭에도
자동 반영. UI 추가 0개, 백엔드 0건, 외부 라이브러리 0개 추가.

> rule_4 trust layer 시간/공간 차원 모두 확장 — 새로고침 후에도 (STEP 27),
> 그리고 동시 다른 탭 사이에서도 (STEP 27.7) 데이터 일관성 유지.

핵심 결정:
- **`storage` 이벤트 활용** — `window.addEventListener("storage", ...)`로 다른
  탭이 emit한 localStorage 변경을 동기 수신. 같은 탭은 자체 이벤트 안 받음
  (브라우저 spec).
- **Self-write loop 3중 안전망**:
  1. `applyingExternalRef` 가드 — hydrate / reset이 트리거하는 subscribe는 save
     skip (가장 핵심적인 방어, 무한 ping-pong 차단)
  2. `tabId` 비교 — 자기 탭 sourceTabId인 storage 이벤트는 무시 (defensive)
  3. `savedAt` 비교 — 자체 write보다 오래된 데이터는 무시 (last-write-wins)
- **Reset 동기화** — `newValue===null` (다른 탭의 adapter.clear()) 감지 시
  `resetAllData()` 호출. UI 동기화 + applyingExternalRef 가드로 save skip 보장.
- **Conflict 정책 v1: last-write-wins** — savedAt timestamp 비교만. 깊은 conflict
  resolution (operational transform / CRDT 등)은 RemoteSyncAdapter 도입 시 검토.
- **Schema validation 우회 안 함** — storage 이벤트 newValue를 직접 `set()`
  하지 않고 `adapter.load()` 재호출 → migrate() / validateV1() 거침. 다른 탭이
  쓴 데이터도 본 탭의 schema 정합성 검증 통과.
- **별도 UI 추가 0** — 사용자에게는 자동 동기화처럼 보임. 사용자 spec "console.warn
  정도만 허용" 준수 (기본 모든 sync는 silent).

---

## 1. 현재 코드 분석

**STEP 27.7 진입 시점 (v27 baseline):**

| 항목 | 진입 시점 | STEP 27.7 필요 |
|---|---|---|
| `LocalStorageAdapter` (STEP 27) | load / save / clear | 무수정 — 그대로 재사용 |
| `PersistedState` shape | version / savedAt / 13개 도메인 슬라이스 | + sourceTabId? optional |
| `extractPersistedState(snap)` | 시그니처 1-arg | + sourceTabId 2번째 arg |
| `PersistenceProvider` | mount hydrate + subscribe save | + storage event listener + tabId + applyExternal 가드 + savedAt 비교 |
| `hydrateFromStorage` / `resetAllData` (store) | 액션 2개 | 무수정 — 그대로 재사용 |
| Sidebar reset 버튼 | 부재 (v26) → 푸터 링크 (v27) | 무수정 |

**의존 관계:**
- `PersistenceProvider`만 변경 — 외부 인터페이스 그대로 (`<PersistenceProvider enabled={true}>{children}</>`)
- `persistence.ts`는 type 1개 + 함수 1개 시그니처 확장 — 기존 호출자 backward-compatible (sourceTabId 미지정 시 undefined로 저장 → legacy v1 데이터 호환)
- 새 npm 의존성 0개. browser native API (`window.addEventListener("storage")`)만 사용.

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/lib/persistence.ts` | `PersistedState`에 optional `sourceTabId?: string` 필드 추가 (v1 데이터 backward-compatible — `validateV1`에서 required 목록 무변경). `extractPersistedState(snap, sourceTabId?)` 시그니처 확장 (2번째 arg optional → 기존 호출자 영향 0). |
| `src/components/PersistenceProvider.tsx` | 전면 재작성 — tabId 생성 + applyingExternalRef 가드 + lastSyncedAtRef + storage event listener + reset propagation + savedAt 비교. 외부 인터페이스 (`{ children, enabled? }`) 무변경. |
| `ARCHITECTURE.md` | STEP 27.7 changelog 항목 추가 |

---

## 3. 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `STEP_27_7_MULTI_TAB_SYNC_COMPLETE.md` | 본 문서 |

코드 신규 파일 0개 — STEP 27.7은 **순수 patch** (기존 모듈 확장).

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `LocalStorageAdapter` 본문 (load / save / clear) | sourceTabId는 PersistedState 안에 embed — adapter는 JSON 그대로 저장/읽기 |
| 모든 store 도메인 액션 / 슬라이스 / `hydrateFromStorage` / `resetAllData` | 0줄 변경 — multi-tab sync는 Provider layer에서만 |
| `migrate()` / `validateV1()` | sourceTabId는 optional — required 목록 영향 없음 |
| `mock-data.ts` / 모든 도메인 entity 타입 | 0줄 변경 |
| Audit (STEP 20/21/23/25) / Market Data (STEP 19) / Money Flow / Contract / Tax / Logistics / Curation / Inquiry | 0줄 변경 |
| 3-Column 레이아웃 / Sidebar / 모든 Drawer | 0줄 변경 |
| RBAC matrix / 권한 | 0줄 변경 |
| `package.json` | 외부 라이브러리 0개 추가 |

---

## 5. 핵심 코드

### 5.1 `PersistedState`에 sourceTabId 추가

```ts
export interface PersistedState {
  version: typeof SCHEMA_VERSION;
  savedAt: string;
  /**
   * STEP 27.7 — Multi-tab sync.
   * Save를 emit한 탭의 식별자. 본 필드 없는 legacy 데이터는 "외부 탭에서 왔다"로
   * 간주 → hydrate 수행 (안전 fallback).
   */
  sourceTabId?: string;
  artworks: Artwork[];
  // ... 13개 도메인 슬라이스
}
```

`validateV1` required 목록은 무변경 (15개 그대로) — sourceTabId 없는 기존 v1 데이터도 정상 통과.

### 5.2 `extractPersistedState` 확장

```ts
export function extractPersistedState(
  snap: PersistableStoreSnapshot,
  sourceTabId?: string
): PersistedState {
  return {
    version: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    sourceTabId,                       // ★ STEP 27.7
    ...snap
  };
}
```

### 5.3 `tabId` 생성 (PersistenceProvider mount 시 1회)

```ts
function generateTabId(): string {
  return `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const tabIdRef = React.useRef<string>("");
if (!tabIdRef.current) tabIdRef.current = generateTabId();
```

### 5.4 `applyExternal` 헬퍼 — Self-write loop 핵심 방어

```ts
const applyingExternalRef = React.useRef(false);

function applyExternal(callback: () => void) {
  applyingExternalRef.current = true;
  try {
    callback();
  } finally {
    // Zustand subscribe는 set() 시점에 동기적으로 fire — 콜백 반환 직후 flag 해제 안전
    applyingExternalRef.current = false;
  }
}
```

Subscribe 측에서 가드:

```ts
const unsub = useArtworkStore.subscribe((state) => {
  if (!hydratedRef.current) return;
  if (applyingExternalRef.current) return;   // ★ 외부 sync면 save skip
  // ... debounced save ...
});
```

### 5.5 `storage` 이벤트 리스너 — 3-branch 처리

```ts
function handleStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return;
  if (e.storageArea !== window.localStorage) return;

  // (A) Reset propagation — 다른 탭에서 adapter.clear()
  if (e.newValue === null) {
    applyExternal(() => {
      useArtworkStore.getState().resetAllData();
    });
    lastSyncedAtRef.current = null;
    return;
  }

  // (B) New data
  let parsed: PersistedState | null = null;
  try { parsed = JSON.parse(e.newValue) as PersistedState; }
  catch { return; }
  if (!parsed || typeof parsed !== "object") return;

  // (B-1) Self-write 방어
  if (parsed.sourceTabId && parsed.sourceTabId === tabIdRef.current) return;

  // (B-2) Stale write 방어 (last-write-wins)
  if (lastSyncedAtRef.current &&
      typeof parsed.savedAt === "string" &&
      parsed.savedAt <= lastSyncedAtRef.current) {
    return;
  }

  // (B-3) Hydrate — adapter.load() 재호출 (schema validation 거침)
  applyExternal(() => {
    useArtworkStore.getState().hydrateFromStorage();
  });
  if (typeof parsed.savedAt === "string") {
    lastSyncedAtRef.current = parsed.savedAt;
  }
}

window.addEventListener("storage", handleStorage);
```

### 5.6 자체 save 시 tabId / savedAt 추적

```ts
timer = setTimeout(() => {
  const payload = extractPersistedState(snap, tabIdRef.current);
  adapter.save(payload);
  // 자체 save 시점도 lastSyncedAt 갱신
  lastSyncedAtRef.current = payload.savedAt;
}, DEBOUNCE_MS);
```

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    69.4 kB         157 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 25 (Audit Export) | 67.7 kB | — |
| STEP 27 (Persistence Layer) | 69.1 kB | +1.4 |
| **STEP 27.7 (Multi-tab Sync)** | **69.4 kB** | **+0.3** |

매우 가벼운 patch — 2개 파일 변경, 1개 신규 LOC ~70 lines (Provider 확장).
`tsc --noEmit` 0 error, `next build` 0 error 0 warning. 외부 npm 의존성 0개 추가.

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_1** Artwork-First | ✅ | 동기화 대상은 도메인 슬라이스 — artwork 중심 그대로 |
| **rule_4** Document Trust Layer | ✅ **공간 확장** | 새로고침 후 (STEP 27) + 다중 탭 사이 (STEP 27.7) 일관성 |
| **rule_5** AI-Human Loop | ✅ | AI 생성 / LOCK 흐름이 다른 탭에서도 즉시 보임 |
| **rule_6** State Machine | ✅ | 상태 전환 timeline이 다른 탭에서도 동기화됨 |
| **rule_7** RBAC | ✅ | role은 미저장 — 각 탭이 독립 role (의도된 동작 그대로) |
| **rule_8** Timeline = Navigation | ✅ | timeline 동기화 → audit log도 다른 탭에서 즉시 갱신 |
| **rule_14 / rule_17** Layout / Layer | ✅ | UI 추가 0개 |
| Backend 추가 | ✅ 0건 | 클라이언트-only multi-tab sync |
| 외부 라이브러리 | ✅ 0개 | `window.addEventListener("storage")` browser native |
| 도메인 액션 변경 | ✅ 0줄 | `hydrateFromStorage` / `resetAllData` 그대로 재사용 |
| Zustand 구조 재작성 | ✅ 0줄 | subscribe API만 사용 |
| 3-Column 레이아웃 | ✅ 무변경 | |

---

## 8. 검증 시나리오

### A — 탭 간 작품 생성 sync

1. 같은 브라우저로 같은 origin 두 탭(A, B) 열기
2. 탭 A에서 ArtworkGrid "+" → 신규 작품 추가 → 저장
3. **기대**: 500ms (debounce) + storage 이벤트 dispatch → 탭 B의 ArtworkGrid에 새 작품 자동 표시. 탭 B는 추가 사용자 액션 없음.

### B — 탭 간 timeline 이벤트 sync (audit log 동기화)

1. 탭 A에서 어떤 작품에 inquiry 추가 / contract 생성 / payment 등록
2. 탭 B에서 같은 작품 audit log drawer 미리 열어둠
3. **기대**: 탭 A 액션 후 ~500ms 안에 탭 B의 audit log에 새 이벤트 노출. 탭 B audit drawer 그대로 열린 상태에서 갱신.

### C — Reset 양방향 sync

1. 탭 A에서 데이터 변경 → 두 탭 모두 동기화 확인
2. 탭 A의 Sidebar 푸터 "저장 데이터 초기화" 클릭 → confirm "확인"
3. **기대**: 탭 A는 mock data로 즉시 복구. 탭 B는 storage 이벤트 (newValue=null) 수신 → resetAllData 호출 → 동시에 mock data로 복구. 두 탭 모두 동일 시드 상태.

### D — Self-write loop 차단 확인

1. 두 탭 모두 정상 동작 상태
2. DevTools Network 또는 localStorage write count 모니터
3. 탭 A에서 단일 변경 1회 (작품 1개 생성)
4. **기대**: 탭 A의 save 1회 + 탭 B의 hydrate 1회 + 탭 B의 save **0회** (applyingExternalRef 가드). 무한 ping-pong 발생 안 함.

### E — Stale write 무시 (last-write-wins)

1. 탭 A에서 변경 1 → save (savedAt=T1, sourceTabId=A)
2. 탭 B는 정상 동기화 (lastSyncedAt=T1)
3. 탭 A에서 변경 2 → save (savedAt=T2, sourceTabId=A)
4. (이론상 가능한 race) 탭 B가 T1 기반의 stale 이벤트 수신
5. **기대**: T1 ≤ T1 비교 → skip. UI 무영향.
6. 탭 B는 T2 이벤트 수신 → T2 > T1 → hydrate.

### F — 단일 탭 동작 보존 (regression check)

1. 탭 1개만 열고 STEP 27 검증 시나리오 모두 재수행
2. **기대**: 모든 STEP 27 동작 그대로 (mount hydrate / debounced save / reset / 깨진 JSON fallback / private mode 등). storage 이벤트는 단일 탭에서는 fire 안 됨 (브라우저 spec).

### G — Schema validation 유지

1. 탭 A에서 (해킹 시나리오) localStorage에 직접 invalid JSON 쓰기
2. 탭 B의 storage handler 트리거
3. **기대**: try/catch + adapter.load() 안의 migrate / validateV1 거쳐 silent fallback. 탭 B는 mock data로 reset (또는 기존 hydrated state 유지). 콘솔 warn 1건.

### H — Tab close & reopen

1. 탭 A 작업 후 닫기
2. 새 탭에서 같은 origin 다시 열기
3. **기대**: 새 탭의 새 tabId 생성 + mount hydrate로 마지막 데이터 복원. 이전 탭의 sourceTabId는 무관 (새 탭이 본 첫 lastSyncedAt 기준).

### I — `enabled={false}` 비활성

1. `<PersistenceProvider enabled={false}>` 사용 (테스트 / SSR-safe 시나리오)
2. **기대**: 모든 effect skip — hydrate 안 함, subscribe 안 함, storage listener 안 등록. 도메인 store는 mock data 그대로.

### J — 빠른 연속 변경 debounce 보존

1. 탭 A에서 짧은 시간 안에 여러 변경 (작품 5개 연달아 추가)
2. **기대**: 마지막 액션 후 500ms 대기 → save 1회 + storage 이벤트 1회 dispatch. 탭 B는 hydrate 1회만.

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| Last-write-wins만 지원 | 두 탭이 거의 동시에 다른 변경 시 늦은 쪽이 이김 — 일찍 쓴 쪽 변경 손실 가능 | RemoteSyncAdapter (STEP 30) 도입 시 server-side timestamp / OT / CRDT 검토 |
| Race window during reset | 한 탭이 reset하는 순간 다른 탭이 편집 시 race 가능 (~10ms window) | 사용자 spec "단순 정책 last-write-wins" 명시 — 의도된 trade-off |
| sourceTabId leak | localStorage는 같은 origin의 다른 페이지에서 읽힘 — tabId 노출 가능 | tabId는 ephemeral (매번 새 생성), 영구 식별자 아님 — privacy 영향 미미 |
| 다중 origin 지원 부재 | iframe / cross-origin 시나리오 미고려 | postMessage 기반 sync layer 별도 설계 필요 |
| Concurrent debounce | 두 탭이 매우 빠르게 번갈아 쓰면 양쪽 다 자기 변경이 우선되었다고 판단할 수 있음 | last-write-wins로 결국 1쪽으로 수렴 — UI는 자동 갱신되지만 사용자가 "내가 쓴 게 사라졌다" 느낄 수 있음. 실시간 collaborative editing은 v1 범위 밖. |
| Storage event ordering | 브라우저가 이벤트 순서를 지연/재배치하면 stale 데이터가 latest로 오인될 수 있음 (이론적) | savedAt이 monotonic increasing이므로 실무상 영향 없음. ISO timestamp 비교로 충분. |
| Bandwidth | 13개 슬라이스 통째로 매번 write — 작품 1개 변경에도 전체 직렬화 | IndexedDB 도입 시 부분 갱신 가능 |
| Encryption 부재 | localStorage 평문 — sourceTabId / 도메인 데이터 노출 | Web Crypto API 도입 가능 (별도 STEP) |

---

## 10. 다음 STEP 후보

1. **STEP 27.5 — IndexedDBAdapter** — localStorage 5MB 한계 해소.
   같은 `PersistenceAdapter` interface 사용 → `setActiveAdapter()` 1줄 변경.
   `storage` 이벤트는 IndexedDB에 없으므로 `BroadcastChannel` API로 sync 채널
   재설계 필요 (또는 hybrid: IndexedDB 데이터 + localStorage 알림 토큰).
2. **STEP 30 — RemoteSyncAdapter** — REST / Supabase / Firebase 등 서버 sync.
   server-side timestamp + OT/CRDT 도입 검토.
3. **STEP 26 — Audit Trail Visualization** — timeline graph / heatmap.
4. **STEP 24 — Audit Filters 강화** — date range / multi-select.
5. **STEP 29 — External Auction Market Reference** — STEP 19 외부 connector.
6. **STEP 28 — Real AI Integration** — Curation / Inquiry / Price suggestion AI API.
