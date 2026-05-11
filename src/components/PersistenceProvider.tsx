// ============================================================================
// PersistenceProvider — STEP 27 + 27.7 + STEP 30 (Remote Sync Layer)
//
// App root wrapper. 책임 5가지:
//   1) Mount 시 1회 hydrateFromStorage() (local) — STEP 27
//   2) Store change subscribe → 500ms debounced save (sourceTabId 포함) — STEP 27
//   3) `storage` 이벤트 listen → 다른 탭이 emit한 변경 감지 → hydrate — STEP 27.7
//   4) Mount 시 remote pull → reconcile (last-write-wins) — STEP 30
//   5) 매 local save 직후 remote push (async, fire-and-forget) — STEP 30
//
// Remote sync는 secondary — local이 항상 primary. Remote 실패 시 system 동작
// 영향 0 (silent warn만, local data 그대로 유지). 본 STEP에서 default로
// MockRemoteSyncAdapter 자동 활성 — 사용자가 "Local Only / Remote Ready"
// 상태 표시기로 즉시 확인 가능.
//
// 향후 실 백엔드 도입 시: Provider mount 전에 `setActiveRemoteAdapter(new
// SupabaseRemoteSyncAdapter(...))` 호출 — Provider 코드는 어떤 adapter든 동일
// contract로 다룸.
// ============================================================================

"use client";

import * as React from "react";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  getActiveAdapter,
  getActiveRemoteAdapter,
  setActiveRemoteAdapter,
  getOrCreateDeviceId,
  isLocalNewerThanRemote,
  extractPersistedState,
  STORAGE_KEY,
  type PersistableStoreSnapshot,
  type PersistedState,
  type SyncMetadata,
} from "@/lib/persistence";
import { MockRemoteSyncAdapter } from "@/lib/mock-remote-sync-adapter";

const DEBOUNCE_MS = 500;

function generateTabId(): string {
  return `tab_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

interface PersistenceProviderProps {
  children: React.ReactNode;
  /** 초기 hydrate / sync 활성 여부 (기본 true). 테스트 시 비활성 가능. */
  enabled?: boolean;
  /**
   * Default mock remote auto-install 여부 (기본 true).
   * false면 PersistenceProvider가 직접 remote adapter 설치 안 함 — 호출자가
   * 명시적으로 setActiveRemoteAdapter() 호출. 실 백엔드 도입 시 false 유용.
   */
  autoInstallMockRemote?: boolean;
}

export function PersistenceProvider({
  children,
  enabled = true,
  autoInstallMockRemote = true,
}: PersistenceProviderProps) {
  const hydratedRef = React.useRef(false);
  const applyingExternalRef = React.useRef(false);

  // STEP 27.7 — Tab id (per mount)
  const tabIdRef = React.useRef<string>("");
  if (!tabIdRef.current) tabIdRef.current = generateTabId();

  // STEP 27.7 — savedAt 추적 (storage event stale write 비교용)
  const lastSyncedAtRef = React.useRef<string | null>(null);

  // STEP 30 — Device id (per browser, persisted)
  const deviceIdRef = React.useRef<string>("");

  React.useEffect(() => {
    if (!enabled) return;

    const localAdapter = getActiveAdapter();

    // STEP 30 — Remote adapter default install (mock)
    if (autoInstallMockRemote && !getActiveRemoteAdapter()) {
      setActiveRemoteAdapter(new MockRemoteSyncAdapter());
    }

    // Device id 첫 access — 같은 effect 안에서만 사용 (state 미동기화 OK)
    if (!deviceIdRef.current) deviceIdRef.current = getOrCreateDeviceId();

    // ----------------------------------------------------------------------
    // Helper — 외부 source의 변경 적용 시 save를 skip하도록 가드 안에서 실행
    // ----------------------------------------------------------------------
    function applyExternal(callback: () => void) {
      applyingExternalRef.current = true;
      try {
        callback();
      } finally {
        applyingExternalRef.current = false;
      }
    }

    // ----------------------------------------------------------------------
    // 1) Mount hydrate (local primary)
    // ----------------------------------------------------------------------
    applyExternal(() => {
      useArtworkStore.getState().hydrateFromStorage();
    });
    const initialPersisted = localAdapter.load();
    if (initialPersisted) lastSyncedAtRef.current = initialPersisted.savedAt;
    hydratedRef.current = true;

    // STEP 59 — Backup metadata hydrate. PersistedState와 별도 localStorage
    // 키에서 lastBackupAt 1회 load. SSR-safe (action 내부 window guard).
    useArtworkStore.getState().hydrateBackupMetadata();

    // STEP 65 — System audit log hydrate. 별도 localStorage 키
    // `axvela.audit.v1`에서 SystemAuditEvent[] 1회 load. SSR-safe.
    useArtworkStore.getState().hydrateAuditEvents();

    // ----------------------------------------------------------------------
    // 2) Mount remote pull → reconcile (STEP 30)
    //
    // Async, fire-and-forget. 실패 시 silent warn — local 그대로 유지.
    // ----------------------------------------------------------------------
    let cancelled = false;

    async function reconcileWithRemote() {
      const remote = getActiveRemoteAdapter();
      if (!remote) return; // Local-only mode

      try {
        const snapshot = await remote.pull();
        if (cancelled) return;

        if (!snapshot) {
          // Remote 비어 있음 — 첫 push로 seed
          if (initialPersisted) {
            await pushToRemote(initialPersisted);
          }
          return;
        }

        // Reconcile — last-write-wins
        const localSavedAt = lastSyncedAtRef.current ?? "";
        if (
          localSavedAt &&
          isLocalNewerThanRemote(localSavedAt, snapshot.remoteUpdatedAt)
        ) {
          // Local이 더 최신 — push 필요
          if (initialPersisted) {
            await pushToRemote(initialPersisted);
          }
        } else if (
          snapshot.remoteUpdatedAt &&
          (!localSavedAt || snapshot.remoteUpdatedAt > localSavedAt)
        ) {
          // Remote가 더 최신 — local에 write + store hydrate
          if (cancelled) return;
          applyExternal(() => {
            // Remote state를 local에도 같은 형태로 저장 (다음 mount의 hydrate가
            // 즉시 새 data 인식하도록)
            localAdapter.save(snapshot.state);
            useArtworkStore.getState().hydrateFromStorage();
          });
          lastSyncedAtRef.current = snapshot.remoteUpdatedAt;
        }
        // else: 동일 timestamp — no-op
      } catch (err) {
        // Remote pull 실패 — silent. Local 그대로 유지.
        // eslint-disable-next-line no-console
        console.warn("[axvela-persistence] remote pull failed:", err);
      }
    }

    // Push helper — push 실패는 silent warn
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
        // eslint-disable-next-line no-console
        console.warn("[axvela-persistence] remote push failed:", err);
      }
    }

    // 시작
    void reconcileWithRemote();

    // ----------------------------------------------------------------------
    // 3) Subscribe — debounced save (local) + remote push
    // ----------------------------------------------------------------------
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useArtworkStore.subscribe((state) => {
      if (!hydratedRef.current) return;
      if (applyingExternalRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const snap: PersistableStoreSnapshot = {
          artworks: state.artworks,
          timeline: state.timeline,
          inquiries: state.inquiries,
          transactions: state.transactions,
          invoices: state.invoices,
          payments: state.payments,
          receipts: state.receipts,
          taxInvoices: state.taxInvoices,
          settlements: state.settlements,
          taxRecords: state.taxRecords,
          contracts: state.contracts,
          curationNotes: state.curationNotes,
          logistics: state.logistics,
          conditionReports: state.conditionReports,
          priceSuggestions: state.priceSuggestions,
          // STEP 117 — Artwork registration draft (옵셔널 슬라이스). 진행 중
          // 임시 저장 부재 시 undefined → extractPersistedState 가 그대로 echo.
          artworkDraft: state.artworkDraft,
        };
        const payload = extractPersistedState(snap, tabIdRef.current);
        // 1. Local save (instant, primary)
        localAdapter.save(payload);
        lastSyncedAtRef.current = payload.savedAt;
        // 2. Remote push (async, fire-and-forget)
        void pushToRemote(payload);
      }, DEBOUNCE_MS);
    });

    // ----------------------------------------------------------------------
    // 4) Storage event listener — multi-tab sync (STEP 27.7) — 무수정
    // ----------------------------------------------------------------------
    function handleStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      if (e.storageArea !== window.localStorage) return;

      // (A) Reset propagation — 다른 탭에서 adapter.clear()
      if (e.newValue === null) {
        applyExternal(() => {
          useArtworkStore.getState().resetAllData();
        });
        lastSyncedAtRef.current = null;
        // STEP 30 — remote도 clear (다른 탭이 reset 시 본 탭이 remote 동기화)
        const remote = getActiveRemoteAdapter();
        if (remote) {
          remote.clearRemote().catch((err) => {
            // eslint-disable-next-line no-console
            console.warn("[axvela-persistence] remote clear failed:", err);
          });
        }
        return;
      }

      // (B) New data from another tab
      let parsed: PersistedState | null = null;
      try {
        parsed = JSON.parse(e.newValue) as PersistedState;
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object") return;

      // (B-1) Self-write 방어
      if (parsed.sourceTabId && parsed.sourceTabId === tabIdRef.current) return;

      // (B-2) Stale write 방어 (last-write-wins)
      if (
        lastSyncedAtRef.current &&
        typeof parsed.savedAt === "string" &&
        parsed.savedAt <= lastSyncedAtRef.current
      ) {
        return;
      }

      // (B-3) Hydrate via adapter.load() — schema validation 거침
      applyExternal(() => {
        useArtworkStore.getState().hydrateFromStorage();
      });
      if (typeof parsed.savedAt === "string") {
        lastSyncedAtRef.current = parsed.savedAt;
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      cancelled = true;
      unsub();
      window.removeEventListener("storage", handleStorage);
      if (timer) clearTimeout(timer);
    };
  }, [enabled, autoInstallMockRemote]);

  return <>{children}</>;
}
