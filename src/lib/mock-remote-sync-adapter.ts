// ============================================================================
// MockRemoteSyncAdapter — STEP 30
//
// RemoteSyncAdapter의 mock 구현. 실제 네트워크 호출 0줄 — 같은 브라우저의
// localStorage 별도 키 (`axvela.gallery.remote.v1`)를 "remote" 슬롯으로
// 시뮬레이션. async + latency simulation으로 실 백엔드 호출 패턴 재현.
//
// 실 백엔드 교체 시:
//   class SupabaseRemoteSyncAdapter implements RemoteSyncAdapter {
//     async push(state, metadata) { return supabase.from('gallery_state').upsert(...) }
//     async pull() { return supabase.from('gallery_state').select(...).single() }
//     async clearRemote() { return supabase.from('gallery_state').delete() }
//   }
// 본 mock의 contract / latency / failure 패턴이 그대로 가이드 역할.
//
// **실 네트워크 호출 0**, **외부 라이브러리 0**, **사용자 spec 명시 준수**.
// ============================================================================

import type {
  PersistedState,
  RemoteSyncAdapter,
  RemoteSyncResult,
  RemoteSyncSnapshot,
  SyncMetadata,
} from "@/lib/persistence";
import { isLocalStorageAvailable } from "@/lib/persistence";

const REMOTE_STORAGE_KEY = "axvela.gallery.remote.v1";

/** 실 백엔드 latency 시뮬레이션 (ms). 0 미만이면 sync 처리. */
const DEFAULT_LATENCY_MS = 80;

interface RemoteEnvelope {
  state: PersistedState;
  remoteUpdatedAt: string;
  remoteDeviceId?: string;
}

export interface MockRemoteSyncAdapterOptions {
  /**
   * Failure 시뮬레이션 — 0~1. 0 = 항상 성공 (v1 default).
   * 0.3 등으로 설정 시 push/pull/clear 호출의 30%가 throw — fallback 동작 검증용.
   */
  failureRate?: number;
  /** Latency ms. 음수면 sync (즉시). 기본 80ms. */
  latencyMs?: number;
}

export class MockRemoteSyncAdapter implements RemoteSyncAdapter {
  readonly adapterId = "mock_remote_v1";
  readonly isReal = false;

  private readonly failureRate: number;
  private readonly latencyMs: number;

  constructor(options: MockRemoteSyncAdapterOptions = {}) {
    this.failureRate = options.failureRate ?? 0;
    this.latencyMs = options.latencyMs ?? DEFAULT_LATENCY_MS;
  }

  async push(
    state: PersistedState,
    metadata: SyncMetadata
  ): Promise<RemoteSyncResult> {
    await this.simulateLatency();
    this.maybeThrow("push");

    if (!isLocalStorageAvailable()) {
      throw new Error("[MockRemoteSyncAdapter] storage unavailable");
    }

    // 실 백엔드는 server timestamp; mock은 client now (단조 증가는 보장됨)
    const remoteUpdatedAt = new Date().toISOString();
    const envelope: RemoteEnvelope = {
      state,
      remoteUpdatedAt,
      remoteDeviceId: metadata.deviceId,
    };

    try {
      window.localStorage.setItem(REMOTE_STORAGE_KEY, JSON.stringify(envelope));
    } catch (err) {
      throw new Error(
        `[MockRemoteSyncAdapter] push storage error: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    return { remoteUpdatedAt };
  }

  async pull(): Promise<RemoteSyncSnapshot | null> {
    await this.simulateLatency();
    this.maybeThrow("pull");

    if (!isLocalStorageAvailable()) return null;

    try {
      const raw = window.localStorage.getItem(REMOTE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as RemoteEnvelope;
      // Defensive — corrupt envelope면 null 반환 (호출자가 local fallback)
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !parsed.state ||
        typeof parsed.remoteUpdatedAt !== "string"
      ) {
        return null;
      }
      return {
        state: parsed.state,
        remoteUpdatedAt: parsed.remoteUpdatedAt,
        remoteDeviceId: parsed.remoteDeviceId,
      };
    } catch {
      return null;
    }
  }

  async clearRemote(): Promise<void> {
    await this.simulateLatency();
    this.maybeThrow("clear");

    if (!isLocalStorageAvailable()) return;
    try {
      window.localStorage.removeItem(REMOTE_STORAGE_KEY);
    } catch {
      // silent — clear 실패는 사용자 영향 미미
    }
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async simulateLatency(): Promise<void> {
    if (this.latencyMs <= 0) return;
    await new Promise<void>((resolve) =>
      setTimeout(resolve, this.latencyMs)
    );
  }

  private maybeThrow(operation: "push" | "pull" | "clear"): void {
    if (this.failureRate > 0 && Math.random() < this.failureRate) {
      throw new Error(
        `[MockRemoteSyncAdapter] simulated ${operation} failure (rate=${this.failureRate})`
      );
    }
  }
}
