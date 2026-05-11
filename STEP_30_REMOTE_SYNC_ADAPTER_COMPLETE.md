# STEP 30 — RemoteSyncAdapter 완료

STEP 27의 `PersistenceAdapter`(local, sync) 옆에 **RemoteSyncAdapter**(remote,
async) layer 추가. 향후 Supabase / Firebase / REST API 백엔드로 교체 가능한
contract. 본 STEP은 mock 구현까지만 — **실 백엔드 연결 0줄, 외부 API 호출 0건,
외부 라이브러리 0개 추가**.

> 사용자 spec 명시: "이번 STEP에서는 실제 백엔드 연결 금지. Remote adapter
> interface + mock remote adapter까지만 구현. 기존 LocalStorageAdapter는 그대로 유지."

핵심 결정:
- **Local primary + Remote secondary** — Local은 instant write/read, Remote는
  background async. Remote 실패 시 system 동작 영향 0 (silent warn만, local
  data 그대로 유지).
- **Async 인터페이스 분리** — 기존 `PersistenceAdapter` (sync)는 무수정. 신규
  `RemoteSyncAdapter` (async)는 `push` / `pull` / `clearRemote` 3개 메서드.
  두 인터페이스는 동시에 활성 — Provider가 양쪽 모두 호출.
- **Conflict 정책 v1: last-write-wins** — `local.savedAt` vs `remote.remoteUpdatedAt`
  ISO timestamp 비교. Local newer → push, Remote newer → pull + apply.
- **Mock = 별도 localStorage 키** — `axvela.gallery.remote.v1` 슬롯에 저장.
  같은 브라우저 안이지만 contract 분리 명확. 실 백엔드 교체 시 mock의 `push` /
  `pull` / `clearRemote` 본문만 fetch 호출로 바꾸면 됨.
- **자동 활성** — PersistenceProvider mount 시 `getActiveRemoteAdapter()` null이면
  `setActiveRemoteAdapter(new MockRemoteSyncAdapter())` 자동 설치 — 사용자가 즉시
  "Remote Ready · mock_remote_v1 (mock)" 상태 표시기로 확인. 실 백엔드 도입 시
  `autoInstallMockRemote={false}` 또는 mount 전 명시적 set.
- **DeviceId 영구 식별** — `axvela.deviceId.v1` 키로 별도 보관. tabId(STEP
  27.7, ephemeral)와 차등 — 향후 multi-user 백엔드에서 device-level audit 가능.

---

## 1. 현재 코드 분석

**STEP 30 진입 시점 (v29 baseline):**

| 항목 | 진입 시점 | STEP 30 종료 |
|---|---|---|
| `PersistenceAdapter` (sync) | LocalStorageAdapter 1개 | **무수정** — 기존 그대로 |
| `RemoteSyncAdapter` (async) | 부재 | 신규 interface + mock 구현 |
| Adapter registry | local singleton만 | + remote singleton (default null) |
| DeviceId | 부재 | `axvela.deviceId.v1` 영구 |
| TabId (STEP 27.7) | provider 내부 ref | 무수정 — sync metadata에 echo |
| Sync metadata | 부재 | `SyncMetadata` 타입 (deviceId / sourceTabId / localSavedAt) |
| Mount flow | local hydrate + subscribe | + async remote pull → reconcile |
| Save flow | debounced local save | + async remote push (fire-and-forget) |
| Reset flow | `adapter.clear()` + mock 재로드 | + remote clearRemote |
| Multi-tab sync (STEP 27.7) | storage event listener | **무수정** + reset 시 remote도 clear |
| Sidebar | RoleSwitcher + reset 링크 | + sync status indicator |
| Conflict resolution | 부재 | last-write-wins (`isLocalNewerThanRemote`) |

**의존 관계:**
- `MockRemoteSyncAdapter`는 `RemoteSyncAdapter` interface + `PersistedState` /
  `SyncMetadata` / `RemoteSyncResult` / `RemoteSyncSnapshot` 타입 + `isLocalStorageAvailable`
  helper만 의존
- `PersistenceProvider`는 `getActiveRemoteAdapter` / `setActiveRemoteAdapter` /
  `getOrCreateDeviceId` / `MockRemoteSyncAdapter` 추가 import
- 도메인 store / 액션 / 슬라이스 / mock-data 0줄 변경

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/lib/persistence.ts` | `isLocalStorageAvailable` private → public export. 파일 끝에 STEP 30 영역 추가 — `RemoteSyncAdapter` interface + `SyncMetadata` / `RemoteSyncResult` / `RemoteSyncSnapshot` types + `getOrCreateDeviceId()` + remote adapter registry (`getActiveRemoteAdapter` / `setActiveRemoteAdapter`) + `isLocalNewerThanRemote()` 비교 helper. `LocalStorageAdapter` / `PersistedState` / `extractPersistedState` / `migrate` / `validateV1` 본문 0줄 변경. |
| `src/components/PersistenceProvider.tsx` | 전면 재작성 (외부 인터페이스 무변경 + `autoInstallMockRemote?: boolean` prop 추가). Mount 시 default mock 자동 설치 + `reconcileWithRemote` async 함수 (pull → 비교 → push 또는 hydrate from remote) + 매 local save 직후 `pushToRemote` 호출. STEP 27.7 multi-tab sync 로직 무변경 — reset propagation 시 remote도 함께 clear 추가. |
| `src/components/layout/Sidebar.tsx` | `getActiveRemoteAdapter` import + `<SyncStatusIndicator />` 컴포넌트 추가 (RoleSwitcher 아래, ResetDataButton 옆). "Local Only" / "Remote Ready · {adapterId} (mock)" + status dot. ResetDataButton에 remote clearRemote 호출 추가 (silent fail). |
| `ARCHITECTURE.md` | STEP 30 changelog 항목 추가 |

---

## 3. 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/mock-remote-sync-adapter.ts` | 145 | `MockRemoteSyncAdapter implements RemoteSyncAdapter`. `push` / `pull` / `clearRemote` 3개 async 메서드. `axvela.gallery.remote.v1` 키에 envelope (state + remoteUpdatedAt + remoteDeviceId) 저장. `setTimeout` latency 시뮬레이션 (default 80ms). `failureRate` 옵션 (default 0% — 항상 성공). |
| `STEP_30_REMOTE_SYNC_ADAPTER_COMPLETE.md` | 본 문서 |

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `LocalStorageAdapter` 본문 (load / save / clear) | STEP 27 동작 그대로 유지 (사용자 spec 명시) |
| `PersistedState` shape / `extractPersistedState` / `migrate` / `validateV1` | local-first 기존 schema 그대로 |
| `useArtworkStore.ts` (`hydrateFromStorage` / `resetAllData` / 모든 도메인 액션) | 0줄 변경 |
| `mock-data.ts` / 모든 도메인 entity / Money Flow / Contract / Tax / Logistics / Curation / Inquiry | 0줄 변경 |
| Audit (STEP 20/21/23/25) — `audit-helpers` / `audit-navigation` / `audit-export` / `AuditEventCard` / `AuditLogDrawer` / `GlobalAuditDrawer` | 0줄 변경 |
| Market Data (STEP 19/29) — `market-signal` / `internal-market-provider` / `external-auction-provider` / `market-data` | 0줄 변경 |
| 3-Column 레이아웃 / 모든 Drawer | 0줄 변경 |
| RBAC matrix / 권한 / `package.json` | 0줄 변경 |

---

## 5. 핵심 코드

### 5.1 `RemoteSyncAdapter` interface

```ts
export interface RemoteSyncAdapter {
  readonly adapterId: string;
  readonly isReal: boolean;  // mock = false, Supabase = true

  push(state: PersistedState, metadata: SyncMetadata): Promise<RemoteSyncResult>;
  pull(): Promise<RemoteSyncSnapshot | null>;
  clearRemote(): Promise<void>;
}

export interface SyncMetadata {
  deviceId: string;
  sourceTabId?: string;       // STEP 27.7 echo
  localSavedAt: string;
}

export interface RemoteSyncResult {
  remoteUpdatedAt: string;
  remoteVersion?: string;
}

export interface RemoteSyncSnapshot {
  state: PersistedState;
  remoteUpdatedAt: string;
  remoteDeviceId?: string;
}
```

### 5.2 `MockRemoteSyncAdapter` 핵심

```ts
const REMOTE_STORAGE_KEY = "axvela.gallery.remote.v1";

export class MockRemoteSyncAdapter implements RemoteSyncAdapter {
  readonly adapterId = "mock_remote_v1";
  readonly isReal = false;

  async push(state, metadata): Promise<RemoteSyncResult> {
    await this.simulateLatency();
    this.maybeThrow("push");
    if (!isLocalStorageAvailable()) throw new Error("storage unavailable");

    const remoteUpdatedAt = new Date().toISOString();
    window.localStorage.setItem(REMOTE_STORAGE_KEY, JSON.stringify({
      state, remoteUpdatedAt, remoteDeviceId: metadata.deviceId
    }));
    return { remoteUpdatedAt };
  }

  async pull(): Promise<RemoteSyncSnapshot | null> {
    await this.simulateLatency();
    this.maybeThrow("pull");
    const raw = window.localStorage.getItem(REMOTE_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.state || typeof parsed?.remoteUpdatedAt !== "string") return null;
      return { state: parsed.state, remoteUpdatedAt: parsed.remoteUpdatedAt, remoteDeviceId: parsed.remoteDeviceId };
    } catch { return null; }
  }

  async clearRemote(): Promise<void> {
    await this.simulateLatency();
    this.maybeThrow("clear");
    window.localStorage.removeItem(REMOTE_STORAGE_KEY);
  }
}
```

### 5.3 Registry (persistence.ts)

```ts
let _remoteAdapter: RemoteSyncAdapter | null = null;

export function getActiveRemoteAdapter(): RemoteSyncAdapter | null {
  return _remoteAdapter;
}

export function setActiveRemoteAdapter(adapter: RemoteSyncAdapter | null): void {
  _remoteAdapter = adapter;
}

export function isLocalNewerThanRemote(localSavedAt: string, remoteUpdatedAt: string): boolean {
  return localSavedAt > remoteUpdatedAt; // ISO datetime lexicographic = chronological
}
```

### 5.4 PersistenceProvider — Mount reconcile flow

```ts
async function reconcileWithRemote() {
  const remote = getActiveRemoteAdapter();
  if (!remote) return; // Local-only

  try {
    const snapshot = await remote.pull();
    if (cancelled) return;

    if (!snapshot) {
      // Remote 비어 있음 — 첫 push로 seed
      if (initialPersisted) await pushToRemote(initialPersisted);
      return;
    }

    const localSavedAt = lastSyncedAtRef.current ?? "";
    if (localSavedAt && isLocalNewerThanRemote(localSavedAt, snapshot.remoteUpdatedAt)) {
      // Local newer → push
      if (initialPersisted) await pushToRemote(initialPersisted);
    } else if (snapshot.remoteUpdatedAt && (!localSavedAt || snapshot.remoteUpdatedAt > localSavedAt)) {
      // Remote newer → write to local + hydrate store
      applyExternal(() => {
        localAdapter.save(snapshot.state);
        useArtworkStore.getState().hydrateFromStorage();
      });
      lastSyncedAtRef.current = snapshot.remoteUpdatedAt;
    }
  } catch (err) {
    console.warn("[axvela-persistence] remote pull failed:", err);
  }
}
```

### 5.5 PersistenceProvider — Save subscribe (debounced + remote push)

```ts
const unsub = useArtworkStore.subscribe((state) => {
  if (!hydratedRef.current) return;
  if (applyingExternalRef.current) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const payload = extractPersistedState(snap, tabIdRef.current);
    // 1. Local instant
    localAdapter.save(payload);
    lastSyncedAtRef.current = payload.savedAt;
    // 2. Remote async fire-and-forget
    void pushToRemote(payload);
  }, DEBOUNCE_MS);
});

async function pushToRemote(state: PersistedState): Promise<void> {
  const remote = getActiveRemoteAdapter();
  if (!remote) return;
  const metadata: SyncMetadata = {
    deviceId: deviceIdRef.current,
    sourceTabId: tabIdRef.current,
    localSavedAt: state.savedAt,
  };
  try {
    await remote.push(state, metadata);
  } catch (err) {
    console.warn("[axvela-persistence] remote push failed:", err);
  }
}
```

### 5.6 SyncStatusIndicator (Sidebar)

```tsx
function SyncStatusIndicator() {
  const remote = typeof window !== "undefined" ? getActiveRemoteAdapter() : null;
  const label = remote
    ? `Remote Ready · ${remote.adapterId}${remote.isReal ? "" : " (mock)"}`
    : "Local Only";
  const dotColor = remote ? "bg-status-deal" : "bg-ink-subtle";
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 text-[9.5px] text-ink-subtle">
      <span className={cn("w-1 h-1 rounded-full shrink-0", dotColor)} aria-hidden />
      <span className="truncate">{label}</span>
    </div>
  );
}
```

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    71.8 kB         159 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 27 (Persistence) | 69.1 kB | — |
| STEP 27.7 (Multi-tab Sync) | 69.4 kB | +0.3 |
| STEP 29 (External Auction) | 70.6 kB | +1.2 |
| **STEP 30 (Remote Sync)** | **71.8 kB** | **+1.2** |

`tsc --noEmit` 0 error / `next build` 0 warning. **외부 npm 의존성 0개 추가**.

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_4** Trust Layer | ✅ **공간 확장** | 새로고침 후 (STEP 27) + 다중 탭 (STEP 27.7) + 다중 device potential (STEP 30) — adapter contract만 마련, 실 백엔드는 후속 STEP |
| **rule_5** AI-Human Loop | ✅ | sync는 데이터 layer — AI/인간 흐름 무영향 |
| **rule_6** State Machine | ✅ | 상태 전환 timeline이 remote에도 동기화 (mock) |
| **rule_7** RBAC | ✅ | role은 미저장 정책 그대로 — sync에도 미포함 |
| **rule_8** Timeline = Navigation | ✅ | timeline 동기화 → audit log 보존 |
| 도메인 / Money Flow / Audit / Market Data 변경 | ✅ 0줄 | 사용자 spec 명시 준수 |
| 실 Supabase / Firebase / REST 연결 | ✅ 0건 | mock만, 사용자 spec 명시 준수 |
| Backend 추가 | ✅ 0건 | client-only mock |
| 외부 라이브러리 추가 | ✅ 0개 | browser native + setTimeout만 |
| 3-Column 레이아웃 | ✅ 무변경 | Sidebar 푸터에 status 1줄만 |
| LocalStorageAdapter 기존 동작 유지 | ✅ 본문 0줄 변경 | |
| Multi-tab sync (STEP 27.7) | ✅ 보존 + reset 시 remote도 clear |

---

## 8. 검증 시나리오

### A — LocalStorageAdapter 기존 동작 유지

1. 작품 생성 / 편집 / Curation 등 임의 변경
2. F5 새로고침
3. **기대**: STEP 27 동작 그대로 — local에서 hydrate, 모든 도메인 데이터 유지.
   STEP 30 추가 layer는 background에서 동작하지만 local-first 흐름 무영향.

### B — Mock remote push 동작

1. 탭 1개로 진입 → Sidebar 푸터 "Remote Ready · mock_remote_v1 (mock)" 확인
2. 작품 생성
3. **기대**: 500ms (local debounce) + ~80ms (mock latency) 후 `axvela.gallery.remote.v1` 키에 envelope 저장. DevTools Application → Local Storage에서 확인 가능.

### C — Remote pull 우선 (remote가 더 새로움)

1. DevTools에서 `axvela.gallery.remote.v1`을 직접 수정 (`remoteUpdatedAt`을 미래 timestamp로, state.artworks에 가짜 작품 추가)
2. F5 새로고침
3. **기대**: Mount 시 mock remote pull → remote가 더 newer → applyExternal 가드 안에서 local에 write + store hydrate → UI에 가짜 작품 표시 (Remote → Local 흐름).

### D — Local 우선 (local이 더 새로움)

1. 정상 상태에서 작품 생성 (local 갱신, savedAt = now)
2. (이 시점에 remote는 이전 push 결과 보유)
3. F5 새로고침
4. **기대**: Mount pull → remote 있지만 local newer → push remote (덮어쓰기). Local 데이터 그대로 표시.

### E — Remote 비어 있음 (첫 push seed)

1. DevTools에서 `axvela.gallery.remote.v1` 삭제
2. F5
3. **기대**: pull → null → initial push (seed) → 다음 보기에서 `axvela.gallery.remote.v1` 존재 확인.

### F — Remote 실패 시 fallback

1. PersistenceProvider 안에서 `setActiveRemoteAdapter(new MockRemoteSyncAdapter({ failureRate: 1 }))` 강제 실패 모드 (코드 수정 필요 — 임시)
2. 작품 생성 / F5
3. **기대**:
   - console.warn `[axvela-persistence] remote push failed: ...` (또는 pull failed)
   - **Local 동작 정상** — 데이터 유지, UI 무영향
   - "Remote Ready" 표시는 그대로 (adapter 활성 상태) — 향후 STEP에서 health check + 표시 추가 가능

### G — Multi-tab sync (STEP 27.7) 보존

1. 두 탭 (A, B) 열기
2. 탭 A에서 작품 생성
3. **기대**: 탭 B에 `storage` 이벤트 → STEP 27.7 hydrate. 추가로 탭 A는 mock remote에도 push (background).

### H — Reset 시 remote도 clear

1. 탭 A에서 데이터 변경 → mock remote에 저장 확인
2. Sidebar "저장 데이터 초기화" → confirm
3. **기대**:
   - Local clear (STEP 27)
   - Mock remote도 clear (`axvela.gallery.remote.v1` 키 삭제)
   - 탭 B (만약 열려 있다면) STEP 27.7 propagation으로 함께 reset
   - mock data 재로드

### I — DeviceId 영구성

1. F5 여러 번
2. DevTools에서 `axvela.deviceId.v1` 키 확인
3. **기대**: 같은 deviceId 유지. 새 브라우저 / 시크릿 모드는 새 deviceId.

### J — `autoInstallMockRemote={false}` 비활성

1. `<PersistenceProvider autoInstallMockRemote={false}>` 사용
2. **기대**: SyncStatusIndicator "Local Only" 표시. push / pull 호출 안 됨. STEP 27 동작만.

### K — 실 백엔드 swap-ready 검증 (개발자 view)

1. `setActiveRemoteAdapter(new SupabaseRemoteSyncAdapter(...))` 가상 호출 (코드 추가 안 해도 됨, 컴파일 가능 여부만 확인)
2. **기대**: `RemoteSyncAdapter` interface 만족하면 PersistenceProvider 코드 무수정으로 동작. push / pull / clearRemote 시그니처가 contract.

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| Mock = 같은 브라우저 localStorage | 실 multi-device sync 안 됨 — 같은 브라우저에서만 시뮬 | 실 SupabaseRemoteSyncAdapter / FirebaseRemoteSyncAdapter 추가 |
| Periodic pull 부재 | mount 시 1회만 pull. 다른 device가 push해도 본 device는 자동 갱신 안 됨 | setInterval 기반 periodic pull 추가 (별도 STEP — 30.5) |
| WebSocket / realtime 부재 | push만 하고 다른 client에 broadcast 안 됨 | Supabase Realtime / Firebase listener 도입 |
| Conflict resolution v1 단순 | savedAt 비교만 — 동시 편집 시 한 쪽 변경 손실 가능 | OT / CRDT (operational transform / conflict-free replicated data type) 도입 검토 |
| Schema validation 우회 가능 | remote pull 시 validateV1 거치지 않음 (mock localStorage니까 단순화) | 실 백엔드 도입 시 server-side schema 검증 |
| Encryption 부재 | mock state 평문. 실 백엔드도 도입 시 at-rest encryption 필요 | Web Crypto API + server-side TLS |
| Auth / user 식별 부재 | deviceId만 — multi-user 미지원 | 실 백엔드 도입 시 auth layer 결합 |
| Bandwidth (전체 state push) | 매 변경마다 13개 슬라이스 전체 직렬화 | 실 백엔드는 delta sync (변경 부분만) 검토 |
| Status indicator 정적 | "Remote Ready" / "Local Only" — 실시간 health 반영 안 됨 | push / pull 결과 store UI 슬라이스에 반영 + 실시간 표시 |

---

## 10. 향후 실 백엔드 교체 가이드 (예시)

### Supabase 도입 시

```ts
// src/lib/supabase-remote-sync-adapter.ts (신규)
import { createClient } from "@supabase/supabase-js";

export class SupabaseRemoteSyncAdapter implements RemoteSyncAdapter {
  readonly adapterId = "supabase_v1";
  readonly isReal = true;
  private readonly client;

  constructor(opts: { url: string; anonKey: string; userId: string }) {
    this.client = createClient(opts.url, opts.anonKey);
  }

  async push(state, metadata): Promise<RemoteSyncResult> {
    const { data, error } = await this.client.from("gallery_state")
      .upsert({ user_id: this.userId, state, device_id: metadata.deviceId })
      .select("updated_at")
      .single();
    if (error) throw error;
    return { remoteUpdatedAt: data.updated_at };
  }

  async pull(): Promise<RemoteSyncSnapshot | null> { ... }
  async clearRemote(): Promise<void> { ... }
}

// 앱 mount 전:
setActiveRemoteAdapter(new SupabaseRemoteSyncAdapter({ url, anonKey, userId }));
```

PersistenceProvider 코드 무수정. SyncStatusIndicator는 자동으로 "Remote Ready ·
supabase_v1" 표시 (isReal=true이므로 "(mock)" 라벨 없음).

### Firebase / REST 도입 시

같은 패턴. `RemoteSyncAdapter` interface 구현 → registry에 set.

---

## 11. 다음 STEP 후보

1. **STEP 30.5 — Periodic Pull / Polling** — setInterval 기반 주기 pull. multi-device 시 다른 device의 변경을 본 device가 자동 인식.
2. **STEP 30.7 — Realtime Sync** — WebSocket / Supabase Realtime listener. push 없이 변경 자동 broadcast.
3. **STEP 31 — Real FX Rate System (rule_20 완성)** — STEP 29 정적 환율 → 실시간 feed.
4. **STEP 28 — Real AI Integration** — Curation / Inquiry response / Price suggestion AI API.
5. **STEP 24 — Audit Filters 강화** — date range / multi-select.
6. **STEP 26 — Audit Trail Visualization** — timeline graph / heatmap.
7. **STEP 27.5 — IndexedDBAdapter** — localStorage 5MB 한계 해소.
8. **STEP 32 — Document Approval Workflow** — Contract / Curation multi-step approval.
