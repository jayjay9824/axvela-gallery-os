# STEP 27 — Persistence Layer (Local-first Adapter) 완료

기존 in-memory Zustand store 위에 **localStorage 기반 영속 layer**를 adapter
패턴으로 추가. 페이지 새로고침 후에도 도메인 데이터 (artworks / transactions /
payments / contracts / invoices / settlements / taxRecords / logistics /
conditionReports / curationNotes / inquiries / timeline / priceSuggestions)
모두 유지.

> 도메인 로직 0줄 변경 · 백엔드 0건 · 외부 라이브러리 0개 추가 · UI 상태 미저장.

핵심 결정:
- **Adapter 패턴** — `PersistenceAdapter` interface + `LocalStorageAdapter`
  구현체. 향후 STEP에서 `IndexedDBAdapter` / `RemoteSyncAdapter` 추가 시 같은
  contract 사용. `getActiveAdapter()` singleton 진입점, `setActiveAdapter()`로
  test/multi-backend 시나리오 지원.
- **Hydrate-then-subscribe 패턴** — `PersistenceProvider` mount 시 1회
  `hydrateFromStorage()` 호출 → 이후 `useArtworkStore.subscribe()`로 변경 감지
  + 500ms debounced save. SSR mismatch 방지를 위해 모든 작업이 useEffect 안에서.
- **UI 상태 미저장 (rule)** — drawer / filter / selectedArtworkId / 모든
  *Request 슬라이스 / role은 persistence 대상 아님. 의도적으로 PersistedState
  shape에서 제외. role은 v1에서 미저장 — 세션마다 RoleSwitcher 초기 상태 보장
  (실험 환경에서 권한 차등 데모가 일관).
- **Migration hook 자리만 마련** — `version: "v1"` 명시. v2 schema 변경 시
  `migrate()` switch case에 `migrateV0toV1` 등 추가만으로 옛 데이터 보존.
  알 수 없는 version은 silent fallback (mock data 재로드) — 잘못된 schema보다
  깨끗한 초기화가 안전.
- **Throw 안 함 정책** — `load()` / `save()` / `clear()` 모두 에러 발생 시
  silent (console.warn만). Private mode / quota / 손상된 JSON 등 모든 실패 모드를
  graceful fallback으로 처리. 사용자에게는 "한 번 시드로 돌아간 것처럼" 보임.
- **Reset 진입점** — Sidebar 푸터 `RoleSwitcher` 아래 작은 텍스트 링크 ("저장
  데이터 초기화"). 클릭 시 `window.confirm()` 1회 → `resetAllData()`. 사용자 spec
  "개발용으로만 숨김 or debug 영역" 준수 — 눈에 띄지만 강조하지 않음.

---

## 1. 현재 코드 분석

**STEP 27 진입 시점 (v26 baseline):**

| 항목 | 진입 시점 | STEP 27 필요 |
|---|---|---|
| Store 초기화 | mock data 직접 (artworks: MOCK_ARTWORKS 등) | hydrate hook 추가 |
| 데이터 영속화 | 부재 — refresh 시 초기화 | localStorage adapter |
| Adapter 인터페이스 | 부재 | 신규 |
| Migration | 부재 | version field + migrate() hook |
| Reset 액션 | 부재 | resetAllData |
| Provider | 부재 | PersistenceProvider 신규 |
| Sidebar reset 진입점 | 부재 | 푸터에 작은 링크 |
| 도메인 슬라이스 13종 | 모두 mock 시드만 | 모두 persisted |
| UI 슬라이스 16종 (drawer / request / filter) | mock 시드 | **미저장** (사용자 spec) |
| RBAC role | MANAGER | **미저장** (세션마다 초기) |

**의존 관계:**
- `persistence.ts`는 store 미지(無知) — 도메인 entity 타입만 import. Pure module.
- `PersistenceProvider`는 `useArtworkStore`만 의존. mount 시점에 외부에서
  hydrate 호출 → store는 직접 adapter를 모름 (decoupled).
- Store 액션 `hydrateFromStorage` / `resetAllData` 2개만 추가 — 기존 도메인
  액션 0줄 수정.

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/store/useArtworkStore.ts` | `hydrateFromStorage` + `resetAllData` 2개 액션 추가 (interface + impl). `getActiveAdapter` / `extractPersistedState` import. 기존 도메인 액션 / 슬라이스 / 초기 상태 0줄 수정. |
| `src/app/page.tsx` | `<PersistenceProvider>` import + 최외곽 wrap. 3-Column 레이아웃 / drawer mount 그대로. |
| `src/components/layout/Sidebar.tsx` | 푸터에 `<ResetDataButton />` 추가 (RoleSwitcher 아래). 작은 텍스트 링크 + window.confirm 1회 + resetAllData 호출. |
| `ARCHITECTURE.md` | STEP 27 changelog 항목 추가 |

---

## 3. 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/persistence.ts` | 195 | `PersistenceAdapter` interface + `LocalStorageAdapter` 구현체 + `PersistedState` shape + `migrate()` hook + v1 validator + `getActiveAdapter` singleton + `extractPersistedState` helper. localStorage SSR/private-mode 가드 포함. |
| `src/components/PersistenceProvider.tsx` | 80 | App root wrapper. mount 시 `hydrateFromStorage()` 1회 호출 + `useArtworkStore.subscribe()`로 변경 감지 + 500ms debounce save + cleanup. SSR-safe (모든 작업 useEffect 안). |
| `STEP_27_PERSISTENCE_COMPLETE.md` | 본 문서 |

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| 모든 도메인 entity 타입 (artwork / transaction / payment / invoice / settlement / tax / contract / logistics / condition-report / curation / inquiry / price-suggestion / market-signal) | 0줄 변경 — adapter는 read-only로 사용 |
| 모든 도메인 store 액션 (createArtwork / registerPayment / completeSettlement / 등 ~50개) | 0줄 변경 — persistence는 outer layer |
| `mock-data.ts` | 0줄 변경 — reset 시 그대로 재로드 |
| Money Flow / Contract / Tax / Logistics 도메인 코드 | 0줄 변경 (사용자 spec 명시) |
| Audit (STEP 20/21/23/25) — `audit-helpers` / `audit-navigation` / `audit-export` | 0줄 변경 |
| Market Data (STEP 19) — `market-signal` / `internal-market-provider` / `market-data` | 0줄 변경 |
| 3-Column 레이아웃 (Sidebar / ArtworkGrid / DetailPanel 본문) | 0줄 변경 (Sidebar는 푸터에 reset 버튼만 추가) |
| 모든 Drawer 컴포넌트 | 0줄 변경 |
| RBAC matrix / 권한 권한 | 0줄 변경 — persistence는 시스템 layer |
| `package.json` | 외부 라이브러리 0개 추가 |

---

## 5. 핵심 코드

### 5.1 PersistenceAdapter interface

```ts
export interface PersistenceAdapter {
  load(): PersistedState | null;
  save(state: PersistedState): void;
  clear(): void;
  readonly adapterId: string;
}
```

### 5.2 PersistedState shape (사용자 spec + STEP 18 일관성)

```ts
export const SCHEMA_VERSION = "v1" as const;

export interface PersistedState {
  version: typeof SCHEMA_VERSION;
  savedAt: string;
  artworks: Artwork[];
  timeline: Record<string, TimelineEvent[]>;
  inquiries: Record<string, Inquiry[]>;
  transactions: Record<string, Transaction[]>;
  invoices: Record<string, Invoice[]>;
  payments: Record<string, Payment[]>;
  settlements: Record<string, Settlement[]>;
  taxRecords: Record<string, TaxRecord[]>;
  contracts: Record<string, Contract[]>;
  curationNotes: Record<string, CurationNote[]>;
  logistics: Record<string, Logistics[]>;
  conditionReports: Record<string, ConditionReport[]>;
  priceSuggestions: Record<string, PriceSuggestion[]>;  // STEP 18 도메인 데이터
}
```

### 5.3 LocalStorageAdapter — defensive load/save/clear

```ts
export class LocalStorageAdapter implements PersistenceAdapter {
  readonly adapterId = "localStorage:v1";
  private readonly key: string;

  constructor(key: string = STORAGE_KEY) { this.key = key; }

  load(): PersistedState | null {
    if (!isLocalStorageAvailable()) return null;
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return migrate(parsed);
    } catch {
      return null;  // JSON parse / corrupt / quota — silent fallback
    }
  }

  save(state: PersistedState): void {
    if (!isLocalStorageAvailable()) return;
    try {
      window.localStorage.setItem(this.key, JSON.stringify(state));
    } catch (err) {
      console.warn("[axvela-persistence] save failed:", err);
    }
  }

  clear(): void { /* ... */ }
}
```

### 5.4 SSR / private mode 가드

```ts
function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const probe = "__axvela_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
```

### 5.5 Migration hook (STEP 27.5+ 확장 지점)

```ts
function migrate(raw: unknown): PersistedState | null {
  if (!isPlainObject(raw)) return null;
  const version = raw.version;
  switch (version) {
    case "v1":
      return validateV1(raw);
    // case "v0":
    //   return migrateV0toV1(raw);  // 향후 STEP에서 추가
    default:
      console.warn(`unknown schema version "${version}" — discarding`);
      return null;
  }
}
```

### 5.6 Store actions — hydrateFromStorage / resetAllData

```ts
hydrateFromStorage: () => {
  const adapter = getActiveAdapter();
  const persisted = adapter.load();
  if (!persisted) return;  // 저장 없거나 invalid — mock data 그대로

  set({
    artworks: persisted.artworks,
    timeline: persisted.timeline,
    inquiries: persisted.inquiries,
    transactions: persisted.transactions,
    invoices: persisted.invoices,
    payments: persisted.payments,
    settlements: persisted.settlements,
    taxRecords: persisted.taxRecords,
    contracts: persisted.contracts,
    curationNotes: persisted.curationNotes,
    logistics: persisted.logistics,
    conditionReports: persisted.conditionReports,
    priceSuggestions: persisted.priceSuggestions,
  });
},

resetAllData: () => {
  const adapter = getActiveAdapter();
  adapter.clear();
  set({
    // 도메인 슬라이스 — mock 재로드
    artworks: MOCK_ARTWORKS, timeline: MOCK_TIMELINE, /* ... */
    priceSuggestions: {},
    // UI 슬라이스 — closed/default
    selectedArtworkId: "art_002", query: "", stateFilter: "ALL",
    editor: { kind: "closed" }, /* ... 모든 *Request closed */
  });
},
```

### 5.7 PersistenceProvider — Hydrate-then-subscribe

```tsx
export function PersistenceProvider({ children, enabled = true }) {
  const hydratedRef = React.useRef(false);

  React.useEffect(() => {
    if (!enabled) return;

    // 1) Hydrate
    useArtworkStore.getState().hydrateFromStorage();
    hydratedRef.current = true;

    // 2) Subscribe — debounced save (500ms)
    const adapter = getActiveAdapter();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsub = useArtworkStore.subscribe((state) => {
      if (!hydratedRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        adapter.save(extractPersistedState({
          artworks: state.artworks,
          timeline: state.timeline,
          /* ... 13개 슬라이스 */
        }));
      }, 500);
    });

    return () => { unsub(); if (timer) clearTimeout(timer); };
  }, [enabled]);

  return <>{children}</>;
}
```

### 5.8 Sidebar reset 버튼 (개발/데모용)

```tsx
function ResetDataButton() {
  const resetAllData = useArtworkStore((s) => s.resetAllData);
  const handleClick = () => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "저장된 모든 데이터를 초기화하고 데모 시드로 되돌립니다. 계속하시겠습니까?"
    );
    if (!ok) return;
    resetAllData();
  };
  return (
    <button onClick={handleClick} className="text-[10.5px] text-ink-subtle hover:text-ink-muted">
      저장 데이터 초기화
    </button>
  );
}
```

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    69.1 kB         156 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 25 (Audit Export) | 67.7 kB | — |
| **STEP 27 (Persistence Layer)** | **69.1 kB** | **+1.4** |

`tsc --noEmit` 0 error / `next build` 0 error 0 warning. **외부 라이브러리 0개 추가** (zustand의 built-in `subscribe()` API만 사용 — `zustand/middleware/persist`도 미사용).

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_1** Artwork-First | ✅ | persistence는 데이터 보존만 — artwork 중심 구조 무영향 |
| **rule_4** Document Trust Layer | ✅ **강화** | timeline / contract / invoice immutability가 새로고침 후에도 유지 — trust layer 시간 차원 확장 |
| **rule_5** AI-Human Loop | ✅ | AI 생성 / 인간 승인 / LOCK 흐름 모두 영속 |
| **rule_6** State Machine | ✅ | 상태 전환 기록 timeline에 보존 → 영속 |
| **rule_7** RBAC | ✅ | role은 미저장 — 세션마다 초기. 권한 차등 데모 일관성 보장 |
| **rule_8** Timeline = Navigation | ✅ | timeline 영속 → STEP 21 navigation도 영속 |
| **rule_14 / rule_17** Layout / Layer | ✅ | 3-Column 무변경. PersistenceProvider는 wrapper, drawer 추가 0 |
| Money Flow / Contract / Tax / Logistics 0줄 변경 | ✅ | 사용자 spec 명시 준수 |
| Audit 0줄 변경 | ✅ | STEP 20/21/23/25 모듈 무수정 |
| 백엔드 추가 | ✅ 0건 | 클라이언트-only |
| 외부 라이브러리 추가 | ✅ 0개 | zustand built-in subscribe 활용 |

---

## 8. 검증 시나리오

### A — 새로고침 후 데이터 유지

1. art_004 편집 → 가격 수정 → 저장
2. F5 새로고침
3. **기대**: art_004의 새 가격 그대로. 0.5초 후 자동 저장됐던 상태.

### B — 신규 작품 생성 + refresh

1. ArtworkGrid 헤더 "+" → 신규 작품 추가 → 저장
2. F5
3. **기대**: 새 작품 ArtworkGrid에 그대로 표시.

### C — Audit log 영속

1. 어떤 작품에 새 timeline 이벤트 발생 (Curation 생성 / Inquiry 추가 / 등)
2. F5
3. AuditLogDrawer 열기
4. **기대**: 모든 이벤트 보존. STEP 21 navigation 정상 작동.

### D — STEP 18 PriceSuggestion 영속

1. art_007 편집 → "AI 가격 제안" → 생성
2. Mid 적용 → 저장
3. F5
4. art_007 편집 다시 열기
5. **기대**: 이전 SuggestionCard 그대로 노출 (latest suggestion + appliedAt 마킹).

### E — STEP 25 Audit Export 호환

1. F5 후 Audit Log 진입
2. JSON / CSV / PDF export
3. **기대**: persisted timeline + classification 모두 export payload에 포함.

### F — 깨진 JSON → 안전 fallback

1. 브라우저 DevTools → Application → Local Storage → `axvela.gallery.v1` 값을 `{ broken json }` 같은 invalid JSON으로 수정
2. F5
3. **기대**: silent fallback → mock data 재로드. 사용자에게는 "초기 상태"처럼 보임. console.warn 1건.

### G — Schema version mismatch

1. localStorage에서 `version: "v99"`로 수정
2. F5
3. **기대**: migrate() switch default → null 반환 → mock data 재로드. console.warn 1건.

### H — Reset 버튼

1. 데이터 다수 변경 후 F5 (영속 확인)
2. Sidebar 푸터 "저장 데이터 초기화" 클릭
3. **기대**: confirm 다이얼로그 → "확인" → mock data 재로드 + 모든 drawer close. localStorage `axvela.gallery.v1` 키 삭제됨 (DevTools 확인).

### I — Reset 취소

1. 같은 시나리오, confirm에서 "취소"
2. **기대**: silent no-op. 데이터 그대로.

### J — Private mode (Safari / Firefox)

1. 시크릿 / private window에서 앱 진입
2. **기대**: 정상 작동. localStorage 접근 실패 시 silent fallback. save도 silent skip.

### K — Quota exceeded

1. localStorage가 가득 찬 환경 (대량 데이터 / 브라우저 limit hit)
2. save 호출
3. **기대**: console.warn `[axvela-persistence] save failed: ...` 1건. 앱 동작 정상 (in-memory state 그대로).

### L — Debounce 동작

1. 빠른 연속 액션 (작품 5개 연달아 생성)
2. **기대**: 마지막 액션 후 500ms 대기 → save 1회만 호출 (DevTools Network / localStorage write 횟수 확인).

### M — Role 미저장 확인

1. RoleSwitcher → STAFF 선택
2. F5
3. **기대**: 다시 MANAGER로 초기화 (v1 의도된 동작).

### N — UI 상태 미저장 확인

1. AuditLogDrawer 열기 → F5
2. **기대**: drawer 닫힌 상태로 시작. 도메인 데이터는 그대로.

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| LocalStorage 5MB 제한 | 대량 timeline 누적 시 quota 도달 가능 | IndexedDBAdapter 추가 (50MB+) |
| Multi-tab 동기화 부재 | 한 탭 변경이 다른 탭에 자동 반영 안 됨 | `storage` 이벤트 listen으로 cross-tab sync 추가 가능 |
| Concurrent write 안전성 | 같은 탭 내 빠른 변경은 debounce로 처리되지만, 동시 편집 시나리오는 미고려 | RemoteSyncAdapter 도입 시 conflict resolution layer 필요 |
| Schema migration 자동화 부재 | v2 도입 시 `migrateV1toV2` 직접 작성 필요 | migration framework 도입 가능 (json-patch 기반 등) |
| Hydration 깜빡임 | SSR mock data → 첫 effect에서 persisted로 교체 (수십~수백 ms) | Skeleton / loading state로 가릴 수 있지만 v1 spec 우선순위 낮음 |
| Role 미저장 | 의도적 — 세션마다 초기 | 사용자 spec 변경 시 role도 PersistedState에 추가 가능 |
| Reset 시 진행 중 작업 손실 | 편집 중인 drawer / 미저장 폼 모두 loss | confirm 메시지에 명시 — UI 경고 1단계 |
| Encryption 부재 | localStorage 평문 저장 — 민감 데이터 (buyer 이름 / 가격) 노출 가능 | 향후 Web Crypto API로 at-rest encryption 도입 가능 |
| Server-side persistence 부재 | 클라이언트-only — 다른 device / browser와 공유 안 됨 | RemoteSyncAdapter (REST / Supabase / Firebase) — 별도 STEP |

---

## 10. 다음 STEP 후보

1. **STEP 27.5 — IndexedDBAdapter** — localStorage 5MB 제한 해소. 같은
   `PersistenceAdapter` interface 사용 → `setActiveAdapter()` 1줄 변경.
2. **STEP 27.7 — Multi-tab sync** — `window.addEventListener("storage", ...)`로
   다른 탭 변경 자동 반영.
3. **STEP 30 — RemoteSyncAdapter** — REST / Supabase / Firebase 등 백엔드 연동.
   Money Flow / 도메인 코드 0줄 변경 원칙으로 같은 adapter contract 활용.
4. **STEP 26 — Audit Trail Visualization** (timeline graph / heatmap).
5. **STEP 29 — External Auction Market Reference** (STEP 19 외부 connector).
6. **STEP 24 — Audit Filters 강화** (date range / multi-select).
7. **STEP 28 — Real AI Integration** — Curation / Inquiry / Price suggestion에
   실제 AI API 옵션 layer.
