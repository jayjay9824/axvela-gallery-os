// ============================================================================
// Persistence Layer — STEP 27 (Local-first Adapter)
//
// 클라이언트-only 영속화. localStorage Adapter를 통해 페이지 새로고침 후에도
// 도메인 데이터(artworks / transactions / payments / ...)를 유지한다.
//
// 핵심 원칙:
//   - **도메인 로직 0줄 변경** — store actions는 기존 패턴 그대로. 본 모듈은
//     store 외부의 read/write helper로만 동작.
//   - **UI 상태 미저장** — drawer / filter / selectedArtworkId / 모든 *Request
//     슬라이스는 persistence 대상 아님. role도 v1에서는 미저장 (세션마다 초기화)
//     — 실험 환경에서 RoleSwitcher의 의도된 초기 상태를 보장.
//   - **Adapter 인터페이스** — `LocalStorageAdapter`는 한 구현체. 향후 STEP에서
//     `IndexedDBAdapter` / `RemoteSyncAdapter` 추가 시 같은 인터페이스 사용.
//   - **Migration hook** — `version: "v1"` 명시. v2 schema 변경 시 migrate
//     함수에 case 추가만으로 옛 데이터 보존. 알 수 없는 version은 silent fallback
//     → mock data 재로드 (사용자 영향: 한 번 데이터 사라짐, 잘못된 schema보다 나음).
//   - **결정성 / 안전성** — load는 절대 throw하지 않음. JSON.parse 실패 / shape
//     mismatch 모두 null 반환 → 호출자가 mock data로 fallback.
// ============================================================================

import type { Artwork, TimelineEvent } from "@/types/artwork";
import type { Inquiry } from "@/types/inquiry";
import type { Transaction } from "@/types/transaction";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Settlement } from "@/types/settlement";
import type { TaxRecord } from "@/types/tax";
import type { Contract } from "@/types/contract";
import type { Logistics } from "@/types/logistics";
import type { ConditionReport } from "@/types/condition-report";
import type { CurationNote } from "@/types/curation";
import type { PriceSuggestion } from "@/types/price-suggestion";
import type { Receipt } from "@/types/receipt";
import type { TaxInvoice } from "@/types/tax-invoice";
import type { ArtworkDraftState } from "@/types/artwork-draft";

// ---------------------------------------------------------------------------
// Storage key + version
// ---------------------------------------------------------------------------

export const STORAGE_KEY = "axvela.gallery.v1";
export const SCHEMA_VERSION = "v1" as const;

// ---------------------------------------------------------------------------
// PersistedState shape — 사용자 spec 명시 슬라이스 + STEP 18/19 (priceSuggestions)
// ---------------------------------------------------------------------------

/**
 * 저장 대상 슬라이스. UI 상태 / role / drawer / filter는 제외.
 *
 * priceSuggestions는 사용자 spec 직접 열거 외 항목이지만, STEP 18 일관성 보존
 * (작품 가격 제안 기록은 도메인 데이터 — UI 상태 아님).
 *
 * audit 관련 데이터는 별도 슬라이스 없음 — `timeline`이 그 자체로 audit
 * source. STEP 20/21/23/25는 모두 timeline에서 derive (audit-helpers /
 * audit-navigation / audit-export 모두 read-only).
 */
export interface PersistedState {
  version: typeof SCHEMA_VERSION;
  savedAt: string;
  /**
   * STEP 27.7 — Multi-tab sync.
   * Save를 emit한 탭의 식별자. storage event 수신 측이 자기 탭이 emit한
   * 변경을 무시할 수 있게 함 (self-write loop 방지). 본 필드 없는 legacy
   * 데이터는 "외부 탭에서 왔다"로 간주 → hydrate 수행 (안전 fallback).
   */
  sourceTabId?: string;

  // 도메인 슬라이스 — 저장 대상 (사용자 spec 그대로)
  artworks: Artwork[];
  timeline: Record<string, TimelineEvent[]>;
  inquiries: Record<string, Inquiry[]>;
  transactions: Record<string, Transaction[]>;
  invoices: Record<string, Invoice[]>;
  payments: Record<string, Payment[]>;
  /**
   * STEP 87 — Cash Receipts. **옵셔널 슬라이스** — legacy v1 데이터(STEP 87 이전)
   * 호환성을 위해 부재 가능. validateV1은 본 키를 *required*로 검증하지 않으며,
   * hydrateFromStorage가 부재 시 빈 객체로 fallback (forward-only policy).
   * SCHEMA_VERSION "v1" 유지.
   */
  receipts?: Record<string, Receipt[]>;
  /**
   * STEP 89 — Tax Invoices (전자세금계산서 운영 record). **옵셔널 슬라이스** —
   * legacy v1 데이터(STEP 89 이전) 호환성을 위해 부재 가능. validateV1은 본
   * 키를 required로 검증하지 않으며, hydrateFromStorage가 부재 시 빈 객체로
   * fallback (forward-only policy). SCHEMA_VERSION "v1" 유지.
   */
  taxInvoices?: Record<string, TaxInvoice[]>;
  settlements: Record<string, Settlement[]>;
  taxRecords: Record<string, TaxRecord[]>;
  contracts: Record<string, Contract[]>;
  curationNotes: Record<string, CurationNote[]>;
  logistics: Record<string, Logistics[]>;
  conditionReports: Record<string, ConditionReport[]>;
  // STEP 18 — 도메인 데이터로 취급 (UI 상태 아님)
  priceSuggestions: Record<string, PriceSuggestion[]>;
  /**
   * STEP 117 — Artwork registration draft (작품 등록 임시 저장 단일 record).
   * **옵셔널 슬라이스** — legacy v1 데이터(STEP 117 이전) 호환성을 위해 부재
   * 가능. validateV1 은 본 키를 *required* 로 검증하지 않으며, hydrateFromStorage
   * 가 부재 시 undefined fallback (forward-only policy). SCHEMA_VERSION "v1"
   * 변경 0줄.
   *
   * `AXVELA_WORKFLOW_ARCHITECTURE.md §4.4 Draft-safe` 의 핵심 정착 — 사용자
   * 의도하지 않은 데이터 손실 0건 보장. 단일 draft 정책 (v1) — 한 시점에 하나.
   * future expansion 시 `additionalDrafts?: ...` 추가 가능 (현 슬롯 보존).
   */
  artworkDraft?: ArtworkDraftState;
}

// ---------------------------------------------------------------------------
// Adapter interface — STEP 27+ 다른 backend (IndexedDB / Remote sync) 추가 시
//                     같은 contract 사용
// ---------------------------------------------------------------------------

export interface PersistenceAdapter {
  /** 저장된 상태 읽기. 없거나 invalid면 null 반환 (절대 throw 안 함). */
  load(): PersistedState | null;
  /** 상태 저장. failure는 console.warn으로만 보고 (storage quota / disabled mode 대비). */
  save(state: PersistedState): void;
  /** 저장된 상태 삭제. resetAllData 액션에서 호출. */
  clear(): void;
  /** Adapter 식별 — debug / future telemetry용 */
  readonly adapterId: string;
}

// ---------------------------------------------------------------------------
// LocalStorageAdapter 구현
// ---------------------------------------------------------------------------

export class LocalStorageAdapter implements PersistenceAdapter {
  readonly adapterId = "localStorage:v1";
  private readonly key: string;

  constructor(key: string = STORAGE_KEY) {
    this.key = key;
  }

  load(): PersistedState | null {
    if (!isLocalStorageAvailable()) return null;
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return migrate(parsed);
    } catch {
      // JSON parse error / quota error / corrupt data — silent fallback.
      // 호출자는 null을 받아 mock data로 진행.
      return null;
    }
  }

  save(state: PersistedState): void {
    if (!isLocalStorageAvailable()) return;
    try {
      const payload = JSON.stringify(state);
      window.localStorage.setItem(this.key, payload);
    } catch (err) {
      // QuotaExceededError 등 — 사용자 알림 없이 silent.
      // 향후 STEP에서 toast로 알림 가능.
      // eslint-disable-next-line no-console
      console.warn("[axvela-persistence] save failed:", err);
    }
  }

  clear(): void {
    if (!isLocalStorageAvailable()) return;
    try {
      window.localStorage.removeItem(this.key);
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// SSR / 비활성 환경 가드 — public (mock remote adapter도 재사용)
// ---------------------------------------------------------------------------

export function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false; // SSR
  try {
    // 일부 브라우저는 private mode에서 localStorage 접근 시 throw — probe 한 번
    const probe = "__axvela_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Migration hook — STEP 27.5+ schema 변경 시 case 추가
// ---------------------------------------------------------------------------

function migrate(raw: unknown): PersistedState | null {
  if (!isPlainObject(raw)) return null;
  const version = (raw as { version?: unknown }).version;

  switch (version) {
    case "v1":
      return validateV1(raw);
    // case "v0":
    //   return migrateV0toV1(raw);  // 향후 STEP에서 추가
    default:
      // 알 수 없는 버전 — silent fallback (mock data 재로드).
      // 사용자에게는 "초기 상태로 돌아간 것처럼" 보임. 콘솔 경고만 출력.
      // eslint-disable-next-line no-console
      console.warn(
        `[axvela-persistence] unknown schema version "${String(version)}" — discarding`
      );
      return null;
  }
}

/**
 * v1 shape 검증 — 필수 키만 확인하고, 각 슬라이스의 *내용*은 신뢰
 * (domain entity validation은 너무 무거움 — 사용자가 직접 corrupt 시도하지 않는 한
 * 본 갤러리 OS가 직접 쓴 데이터는 일관 유지). 키가 빠지면 fallback.
 */
/**
 * STEP 52 — 외부에서 import된 JSON 검증용 export. 기존 hydrate 흐름이 사용하는
 * 동일 검증 함수를 그대로 노출. 호출자는 이 결과를 받은 뒤 `sanitizeImportedState`
 * 로 한 번 더 좁혀 안전한 PersistedState만 영속화.
 */
export function validateV1ForImport(raw: unknown): PersistedState | null {
  return validateV1(raw);
}

function validateV1(raw: unknown): PersistedState | null {
  if (!isPlainObject(raw)) return null;
  const r = raw as Record<string, unknown>;
  const required = [
    "version",
    "savedAt",
    "artworks",
    "timeline",
    "inquiries",
    "transactions",
    "invoices",
    "payments",
    "settlements",
    "taxRecords",
    "contracts",
    "curationNotes",
    "logistics",
    "conditionReports",
    "priceSuggestions",
  ];
  for (const key of required) {
    if (!(key in r)) {
      // eslint-disable-next-line no-console
      console.warn(`[axvela-persistence] v1 missing key "${key}" — discarding`);
      return null;
    }
  }
  return r as unknown as PersistedState;
}

/**
 * STEP 52 — Import 전용 sanitizer. validateV1 통과 데이터를 받아 **알려진 키만**
 * 골라 새 객체로 재구성. 외부 JSON에 포함된 예상치 못한 key를 제거 (예: 향후
 * 추가될 schema 필드, 악의적 prototype 오염 시도, script payload). 본 함수는
 * 단순 키 화이트리스트 — 각 도메인 entity 내부의 deep validation은 v1 정책상
 * 수행하지 않음 (validateV1과 동일 strictness 유지).
 *
 * **보안 정책 (사용자 spec):**
 *   - JSON.parse 결과만 받음 — 함수 / Symbol / undefined 자연 제거
 *   - top-level 알려진 키 화이트리스트만 통과
 *   - sourceTabId는 import 시 무시 (현재 탭이 새 source가 됨)
 */
export function sanitizeImportedState(state: PersistedState): PersistedState {
  return {
    version: SCHEMA_VERSION,
    savedAt: typeof state.savedAt === "string" ? state.savedAt : new Date().toISOString(),
    // sourceTabId는 의도적으로 누락 — import 후 첫 save에서 현재 탭 id로 채워짐
    artworks: state.artworks,
    timeline: state.timeline,
    inquiries: state.inquiries,
    transactions: state.transactions,
    invoices: state.invoices,
    payments: state.payments,
    // STEP 87 — receipts 옵셔널 슬라이스. legacy 백업 (STEP 87 이전) 부재 시
    // 빈 객체로 정착 — backward compat.
    receipts: state.receipts ?? {},
    // STEP 89 — taxInvoices 옵셔널 슬라이스. STEP 89 이전 백업 호환.
    taxInvoices: state.taxInvoices ?? {},
    settlements: state.settlements,
    taxRecords: state.taxRecords,
    contracts: state.contracts,
    curationNotes: state.curationNotes,
    logistics: state.logistics,
    conditionReports: state.conditionReports,
    priceSuggestions: state.priceSuggestions,
    // STEP 117 — artworkDraft 옵셔널 슬라이스. legacy 백업 (STEP 117 이전) 부재
    // 시 undefined 그대로 (빈 객체 fallback 부적절 — 단일 record 의미).
    artworkDraft: state.artworkDraft,
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Singleton adapter — 호출자 편의 (PersistenceProvider / store init)
// ---------------------------------------------------------------------------

let _adapter: PersistenceAdapter | null = null;

/**
 * 활성 adapter 인스턴스. 첫 호출 시 LocalStorageAdapter 생성 (싱글톤).
 * 향후 다른 adapter로 교체 가능 — `setActiveAdapter()` 사용.
 */
export function getActiveAdapter(): PersistenceAdapter {
  if (_adapter) return _adapter;
  _adapter = new LocalStorageAdapter();
  return _adapter;
}

/**
 * Test / future migration / multi-backend 시나리오용. 일반 호출자는 사용 X.
 */
export function setActiveAdapter(adapter: PersistenceAdapter): void {
  _adapter = adapter;
}

// ---------------------------------------------------------------------------
// Snapshot helper — store state에서 PersistedState를 만든다 (UI 슬라이스 제거)
// ---------------------------------------------------------------------------

/**
 * Store snapshot에서 도메인 데이터만 추출. 호출자는 store의 Selector / subscribe
 * 결과를 그대로 패스. UI / role / drawer 필드는 자동으로 누락됨 (필요한 키만
 * 명시적으로 골라 담음).
 *
 * `state`의 타입을 store 자체 타입(`ArtworkUIState`)으로 좁히지 않고 ad-hoc
 * shape 받음 — 순환 import 방지 + persistence 모듈을 store 무지(無知) 상태로 유지.
 */
export interface PersistableStoreSnapshot {
  artworks: PersistedState["artworks"];
  timeline: PersistedState["timeline"];
  inquiries: PersistedState["inquiries"];
  transactions: PersistedState["transactions"];
  invoices: PersistedState["invoices"];
  payments: PersistedState["payments"];
  /** STEP 87 — Receipts (옵셔널 호환). */
  receipts: NonNullable<PersistedState["receipts"]>;
  /** STEP 89 — Tax Invoices (옵셔널 호환). */
  taxInvoices: NonNullable<PersistedState["taxInvoices"]>;
  settlements: PersistedState["settlements"];
  taxRecords: PersistedState["taxRecords"];
  contracts: PersistedState["contracts"];
  curationNotes: PersistedState["curationNotes"];
  logistics: PersistedState["logistics"];
  conditionReports: PersistedState["conditionReports"];
  priceSuggestions: PersistedState["priceSuggestions"];
  /**
   * STEP 117 — Artwork registration draft. 옵셔널 슬라이스 — store 측 부재 시
   * undefined 그대로 패스. extractPersistedState 가 본 키를 그대로 echo back.
   */
  artworkDraft?: PersistedState["artworkDraft"];
}

export function extractPersistedState(
  snap: PersistableStoreSnapshot,
  sourceTabId?: string
): PersistedState {
  return {
    version: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    sourceTabId,
    artworks: snap.artworks,
    timeline: snap.timeline,
    inquiries: snap.inquiries,
    transactions: snap.transactions,
    invoices: snap.invoices,
    payments: snap.payments,
    receipts: snap.receipts,
    taxInvoices: snap.taxInvoices,
    settlements: snap.settlements,
    taxRecords: snap.taxRecords,
    contracts: snap.contracts,
    curationNotes: snap.curationNotes,
    logistics: snap.logistics,
    conditionReports: snap.conditionReports,
    priceSuggestions: snap.priceSuggestions,
    // STEP 117 — artworkDraft 옵셔널 슬라이스 echo back. store 측 undefined 면
    // 그대로 undefined (validateV1 required 미수정 정합).
    artworkDraft: snap.artworkDraft,
  };
}

// ============================================================================
// STEP 30 — Remote Sync Adapter Layer
//
// LocalStorageAdapter (sync, instant) 옆에 추가되는 비동기 sync layer. 향후
// Supabase / Firebase / REST API로 교체 가능한 contract. 본 STEP은 mock
// 구현만 (실 백엔드 연동 0).
//
// 아키텍처:
//   - Local은 항상 primary (instant write/read)
//   - Remote는 secondary, async push/pull. 실패해도 시스템 동작에 영향 0.
//   - Conflict 정책 v1: last-write-wins via savedAt vs remoteUpdatedAt 비교.
//   - PersistenceProvider가 mount 시 pull → reconcile → 이후 매 save마다 push.
//
// 향후 실 백엔드 교체:
//   class SupabaseRemoteSyncAdapter implements RemoteSyncAdapter { ... }
//   setActiveRemoteAdapter(new SupabaseRemoteSyncAdapter({ url, anonKey }));
//   PersistenceProvider 다른 코드 변경 0.
// ============================================================================

/**
 * Sync metadata — push 호출 시 동반 정보. 향후 백엔드가 row-level metadata로
 * 저장하거나 audit 용도로 활용. v1 mock은 deviceId / sourceTabId만 echo back.
 */
export interface SyncMetadata {
  /** 영구 device 식별자 (브라우저 단위) — 다른 키에 별도 보관 */
  deviceId: string;
  /** 현재 탭 식별자 (STEP 27.7) — multi-tab 디버그용 */
  sourceTabId?: string;
  /** push 직전 local PersistedState.savedAt */
  localSavedAt: string;
}

/**
 * Push 결과 — remote가 할당한 timestamp 등. 본 값은 local의 lastSyncedAt 갱신에 사용.
 */
export interface RemoteSyncResult {
  /**
   * Remote 측이 기록한 시점. 실 백엔드는 server timestamp, mock은 client now.
   * Conflict 비교 시 local.savedAt와 이 값을 비교 (last-write-wins).
   */
  remoteUpdatedAt: string;
  /** 향후 ETag / version 등 (선택) */
  remoteVersion?: string;
}

/**
 * Pull 결과 snapshot — remote에 저장된 state + meta. null이면 remote에 데이터 없음.
 */
export interface RemoteSyncSnapshot {
  state: PersistedState;
  remoteUpdatedAt: string;
  remoteDeviceId?: string;
}

/**
 * Async sync contract. LocalStorageAdapter (sync)와 별개 — 두 adapter는 동시에
 * 활성 (local primary + remote secondary).
 *
 * 모든 메서드는 Promise — 향후 실 백엔드 fetch로 교체될 자리. v1 mock은
 * setTimeout으로 latency 시뮬.
 *
 * **실패 정책**: throw 가능. 호출자(PersistenceProvider)가 catch — 시스템 동작
 * 무영향, console.warn만 발화. local data는 그대로 유지.
 */
export interface RemoteSyncAdapter {
  /** Adapter 식별자 — debug / status UI에 노출 */
  readonly adapterId: string;
  /** 실 네트워크 호출 여부. mock = false. 실 Supabase/Firebase = true. */
  readonly isReal: boolean;

  /** Local state를 remote로 push. Returns server-side metadata. */
  push(state: PersistedState, metadata: SyncMetadata): Promise<RemoteSyncResult>;

  /** Remote state pull. 데이터 없으면 null. */
  pull(): Promise<RemoteSyncSnapshot | null>;

  /** Remote state 삭제 — resetAllData에서 호출. */
  clearRemote(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Device ID — 브라우저 단위 영구 식별자
// ---------------------------------------------------------------------------

const DEVICE_ID_KEY = "axvela.deviceId.v1";

/**
 * Device 식별자. localStorage에 영구 저장 — 같은 브라우저에서 새로고침해도
 * 일관. 첫 호출 시 생성.
 *
 * 실 백엔드 도입 시 user 식별과 결합 (deviceId per user). v1은 single-user
 * 가정으로 device-only.
 */
export function getOrCreateDeviceId(): string {
  if (!isLocalStorageAvailable()) return generateDeviceId();
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length > 0) return existing;
    const id = generateDeviceId();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return generateDeviceId();
  }
}

function generateDeviceId(): string {
  return `dev_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Remote adapter registry — null = "Local Only", instance = "Remote Ready"
// ---------------------------------------------------------------------------

let _remoteAdapter: RemoteSyncAdapter | null = null;

/**
 * 현재 활성 remote adapter. null이면 remote sync 비활성 (local-only 모드).
 * PersistenceProvider는 이 값을 mount 시점에 확인 — null이면 default mock 설치.
 */
export function getActiveRemoteAdapter(): RemoteSyncAdapter | null {
  return _remoteAdapter;
}

/**
 * Remote adapter 교체. null 전달 시 sync 비활성. 호출 시점:
 *   - 앱 mount 전: 실 백엔드 adapter 설치 (production)
 *   - PersistenceProvider mount 시: default mock 설치 (개발 / 데모)
 *   - 사용자가 명시 비활성화: setActiveRemoteAdapter(null)
 */
export function setActiveRemoteAdapter(adapter: RemoteSyncAdapter | null): void {
  _remoteAdapter = adapter;
}

/**
 * 두 timestamp 비교 — "local이 더 새로운가?" 판단 (last-write-wins).
 * ISO datetime 문자열 비교 (lexicographic = chronological).
 */
export function isLocalNewerThanRemote(
  localSavedAt: string,
  remoteUpdatedAt: string
): boolean {
  return localSavedAt > remoteUpdatedAt;
}
