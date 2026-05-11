# STEP 50 — Logistics External Provider Hook

> **목표**: STEP 29 ExternalAuctionProvider 패턴을 Logistics 도메인에 적용해
> rule_21 외부 hook 본격화. 실제 운송사 API 연결 전에도 안정적인 extension
> hook 정착. 작품 판매 이후 물류 운영까지 커버.

---

## State

- **이전**: STEP 49 / Route 106 kB
- **이번**: STEP 50 / **Route 107 kB (+1 kB)**
- Build ✅ · type-check ✅ (`tsc --noEmit` 0 error)

---

## Flow

```
LogisticsDetailDrawer (열림)
  │
  ├─ Linked artwork / transaction header
  ├─ 현재 상태 + Status select
  ├─ Carrier / Tracking / Pickup / Delivery date
  ├─ 메모
  │
  └─ ★ Provider Sync 섹션  ← STEP 50 신규
       │
       │  ┌──────────────────────────────────────┐
       │  │ 운영 참고 sync   [Mock provider]     │
       │  │                  [물류 상태 동기화]  │
       │  └──────────────────────────────────────┘
       │       ↓ (사용자 클릭)
       │
       └─ syncLogisticsFromProvider(logisticsId)
            ├─ isLogisticsLocked → silent no-op (rule_4)
            ├─ fetchLogisticsSync(input)  (registry → mock provider)
            │   └─ failure → null → silent fallback
            ├─ patch policy:
            │   • provider 메타 (lastSyncedAt / providerId / note / ETA): 항상 set
            │   • trackingNumber / carrierName: 빈 값일 때만 채움 (operator 보존)
            │   • status: forward-only non-locking 만 자동 적용
            │     → READY_FOR_PICKUP → IN_TRANSIT  ✓
            │     → DELIVERED / CONDITION_CHECKED  ✗ (operator 명시 필요)
            └─ timeline event "Logistics provider sync"
                 (kind=TRANSACTION, relatedEntityType=logistics)
```

**실제 외부 API 호출 0건** — Mock provider deterministic mock dataset.

---

## 변경 파일 목록

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/types/logistics.ts` | ~25 LOC | `Logistics` interface에 5개 옵셔널 provider 필드 추가 |
| `src/store/useArtworkStore.ts` | ~150 LOC | `syncLogisticsFromProvider` action 시그니처 + impl + import |
| `src/components/logistics/LogisticsDetailDrawer.tsx` | ~140 LOC | Provider Sync 섹션 + ProviderSyncSection / ProviderRow sub-component + sync 후 form state 동기화 |
| `ARCHITECTURE.md` | +1 changelog | STEP 50 추가 |

---

## 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/types/logistics-provider.ts` | ~85 | `LogisticsProvider` interface + `LogisticsProviderInput` / `LogisticsProviderResult` 타입 |
| `src/lib/mock-logistics-provider.ts` | ~140 | `MockLogisticsProvider` 결정성 mock 구현 |
| `src/lib/logistics-provider.ts` | ~70 | Registry / dispatcher (`fetchLogisticsSync` / `hasLogisticsProvider` / `getActiveLogisticsProviderInfo`) |
| `STEP_50_LOGISTICS_PROVIDER_HOOK.md` | (이 문서) | STEP 완료 보고 |

---

## 핵심 코드

### 1) Provider 인터페이스 (STEP 19/29 패턴 일관)

```ts
// src/types/logistics-provider.ts

export interface LogisticsProvider {
  readonly providerId: string;     // "mock_v1" / 향후 "dhl_v1" 등
  readonly isMock: boolean;
  fetchSync(input: LogisticsProviderInput): LogisticsProviderResult;
}

export interface LogisticsProviderResult {
  providerId: string;
  isMock: boolean;
  trackingId: string;              // 기존 비면 mock 생성
  carrierName: string;             // 기존 비면 sample
  suggestedStatus: LogisticsStatus; // 자동 적용은 store 정책
  estimatedDelivery: string;       // YYYY-MM-DD, 추정 — 확정 도착 아님
  fetchedAt: string;               // ISO datetime
  providerNote: string;            // 짧은 한국어 status note
}
```

### 2) MockLogisticsProvider — 결정성 mock

```ts
// src/lib/mock-logistics-provider.ts

const SAMPLE_CARRIERS = [
  "SafeArt Logistics", "Atelier Art Transport",
  "Crozier Fine Arts", "ART NOVA Express",
];

const SAMPLE_NOTES_BY_STATUS = {
  READY_FOR_PICKUP: ["픽업 대기 · 갤러리 측 출고 준비 완료", ...],
  IN_TRANSIT: ["거점 운송 중 · provider 기준 정상 진행", ...],
  DELIVERED: ["수령 확인 · condition check 단계 대기", ...],
  CONDITION_CHECKED: ["검수 단계 종료 · provider 측 추가 변경 사항 없음", ...],
};

const READY_TO_TRANSIT_DAYS = 3;

export class MockLogisticsProvider implements LogisticsProvider {
  readonly providerId = "mock_v1";
  readonly isMock = true;

  fetchSync(input: LogisticsProviderInput): LogisticsProviderResult {
    const seed = simpleHash(input.logisticsId);  // deterministic

    const trackingId = input.trackingNumber.trim()
      || `MK-${input.logisticsId.slice(-6).toUpperCase()}-${(seed % 9999).toString().padStart(4, "0")}`;
    const carrierName = input.carrierName.trim()
      || SAMPLE_CARRIERS[seed % SAMPLE_CARRIERS.length];

    // forward-only 휴리스틱 — DELIVERED 자동 추천 0건
    const daysSinceCreate = computeDaysSince(input.createdAt);
    let suggestedStatus = input.currentStatus;
    if (input.currentStatus === "READY_FOR_PICKUP" && daysSinceCreate >= READY_TO_TRANSIT_DAYS) {
      suggestedStatus = "IN_TRANSIT";
    }

    // estimatedDelivery: createdAt + 7~14일
    const offsetDays = 7 + (seed % 8);
    const baseDate = new Date(input.createdAt);
    if (Number.isNaN(baseDate.getTime())) baseDate.setTime(Date.now());
    baseDate.setDate(baseDate.getDate() + offsetDays);
    const estimatedDelivery = baseDate.toISOString().slice(0, 10);

    const providerNote = SAMPLE_NOTES_BY_STATUS[suggestedStatus][seed % ...];

    return {
      providerId: this.providerId, isMock: this.isMock,
      trackingId, carrierName, suggestedStatus, estimatedDelivery,
      fetchedAt: new Date().toISOString(),
      providerNote,
    };
  }
}
```

### 3) Dispatcher — failure 격리

```ts
// src/lib/logistics-provider.ts

const ACTIVE_LOGISTICS_PROVIDERS: LogisticsProvider[] = [
  new MockLogisticsProvider(),
];

export function fetchLogisticsSync(
  input: LogisticsProviderInput
): LogisticsProviderResult | null {
  for (const provider of ACTIVE_LOGISTICS_PROVIDERS) {
    try {
      return provider.fetchSync(input);
    } catch {
      // 다음 provider 시도. 모두 실패하면 null 반환.
    }
  }
  return null;
}
```

### 4) Logistics 타입 확장 (옵셔널 필드만 추가)

```ts
// src/types/logistics.ts

export interface Logistics {
  // ... 기존 필드 (id / artworkId / transactionId / status / carrierName /
  //                trackingNumber / pickupDate / deliveryDate / memo / createdAt / updatedAt)

  // STEP 50 — Provider sync metadata (모두 옵셔널 — backward-compat)
  providerLastSyncedAt?: string;
  providerId?: string;
  providerIsMock?: boolean;
  providerNote?: string;
  /** Provider 추정 — 운영자 기입 deliveryDate와 별개 */
  providerEstimatedDelivery?: string;
}
```

### 5) Store action — `syncLogisticsFromProvider`

```ts
// src/store/useArtworkStore.ts

syncLogisticsFromProvider: (logisticsId) => {
  const state = get();
  
  // 1. Find logistics
  let foundLog, foundTxId;
  for (const [txId, list] of Object.entries(state.logistics)) {
    const log = list.find(l => l.id === logisticsId);
    if (log) { foundLog = log; foundTxId = txId; break; }
  }
  if (!foundLog || !foundTxId) return;

  // 2. Immutability guard (rule_4)
  if (isLogisticsLocked(foundLog.status)) return;

  // 3. Provider call — failure 격리
  const result = fetchLogisticsSync({...});
  if (!result) return;  // silent fallback

  const now = new Date().toISOString();

  // 4. Status forward-only non-locking transition
  let nextStatus = foundLog.status;
  let statusChanged = false;
  if (foundLog.status === "READY_FOR_PICKUP" && result.suggestedStatus === "IN_TRANSIT") {
    nextStatus = "IN_TRANSIT";
    statusChanged = true;
  }
  // DELIVERED / CONDITION_CHECKED 자동 적용 0건

  // 5. Patch — operator 입력 보존
  const fillTracking = foundLog.trackingNumber.trim() === "" && result.trackingId.trim() !== "";
  const fillCarrier = foundLog.carrierName.trim() === "" && result.carrierName.trim() !== "";
  
  const updated: Logistics = {
    ...foundLog,
    status: nextStatus,
    trackingNumber: fillTracking ? result.trackingId : foundLog.trackingNumber,
    carrierName: fillCarrier ? result.carrierName : foundLog.carrierName,
    providerLastSyncedAt: result.fetchedAt,
    providerId: result.providerId,
    providerIsMock: result.isMock,
    providerNote: result.providerNote,
    providerEstimatedDelivery: result.estimatedDelivery,
    updatedAt: now,
  };

  // 6. Timeline event
  const event: TimelineEvent = {
    id: genId("ev"),
    artworkId: foundLog.artworkId,
    kind: "TRANSACTION",  // 기존 logistics 이벤트 컨벤션
    title: "Logistics provider sync",
    detail: [...].join(" · "),
    at: now,
    actor: actorLabel(state.currentRole),
    actorRole: state.currentRole,
    relatedEntityType: "logistics",
    relatedEntityId: foundLog.id,
  };

  set((s) => ({ logistics: ..., timeline: ... }));
}
```

### 6) UI — ProviderSyncSection

```tsx
// src/components/logistics/LogisticsDetailDrawer.tsx

function ProviderSyncSection({ log, isLocked, onSync }) {
  const hasSynced = !!log.providerLastSyncedAt;
  
  return (
    <Section label="Provider Sync">
      <div className="rounded-md border border-line bg-surface-muted/40 px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-3 mb-2.5">
          <div className="flex items-baseline gap-2">
            <span>운영 참고 sync</span>
            {log.providerIsMock && (
              <span className="...italic">Mock provider</span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onSync} disabled={isLocked}>
            물류 상태 동기화
          </Button>
        </div>
        
        {!hasSynced ? (
          <p className="italic">
            아직 provider sync 기록 없음 ... 결과는 운영 참고용이며 배송 / 도착 / 보험을 보장하지 않습니다.
          </p>
        ) : (
          <>
            <ProviderRow label="Provider" value={log.providerId ?? "—"} />
            <ProviderRow label="Tracking ID" value={log.trackingNumber} mono />
            <ProviderRow label="Carrier" value={log.carrierName} />
            <ProviderRow label="추정 인도일" value={log.providerEstimatedDelivery}
                         hint="provider 추정 · 확정 도착이 아닙니다" />
            <ProviderRow label="최근 조회 시점" value={lastSyncedRel} />
            <div className="...">
              <p>Status note (provider 기준)</p>
              <p>{log.providerNote}</p>
            </div>
          </>
        )}
        
        {isLocked && (
          <p className="italic">
            ※ 배송 완료 이후 record는 immutable — 추가 sync는 비활성화됩니다.
          </p>
        )}
      </div>
    </Section>
  );
}
```

---

## UI 예시 (실 렌더 발췌)

### 동기화 전 (empty state)

```
┌─────────────────────────────────────────────────────────┐
│ Provider Sync                                           │
│                                                         │
│ 운영 참고 sync  [Mock provider]    [물류 상태 동기화]   │
│                                                         │
│ 아직 provider sync 기록 없음. 운송사 측 상태 / tracking을│
│ 가져오려면 상단 버튼을 누르세요. 결과는 운영 참고용이며 │
│ 배송 / 도착 / 보험을 보장하지 않습니다.                 │
└─────────────────────────────────────────────────────────┘
```

### 동기화 후 (READY_FOR_PICKUP — 3일 미경과)

```
┌─────────────────────────────────────────────────────────┐
│ Provider Sync                                           │
│                                                         │
│ 운영 참고 sync  [Mock provider]    [물류 상태 동기화]   │
│                                                         │
│ PROVIDER       mock_v1                                  │
│ TRACKING ID    MK-LOG003-7821                           │
│ CARRIER        SafeArt Logistics                        │
│ 추정 인도일    2026-05-12                               │
│                provider 추정 · 확정 도착이 아닙니다     │
│ 최근 조회 시점 방금 전                                  │
│ ───────────────────────                                 │
│ STATUS NOTE (PROVIDER 기준)                             │
│ 픽업 대기 · 갤러리 측 출고 준비 완료                    │
└─────────────────────────────────────────────────────────┘
```

### 잠긴 상태 (DELIVERED / CONDITION_CHECKED)

```
┌─────────────────────────────────────────────────────────┐
│ Provider Sync                                           │
│                                                         │
│ 운영 참고 sync  [Mock provider]    [물류 상태 동기화]   │
│                                            (disabled)   │
│                                                         │
│ ... (이전 sync 결과 readonly 표시) ...                  │
│                                                         │
│ ※ 배송 완료 이후 record는 immutable — 추가 sync는       │
│ 비활성화됩니다.                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 정책 매트릭스

### 자동 적용 정책 (provider suggestedStatus)

| 현재 status | provider suggestedStatus | 동작 |
|---|---|---|
| READY_FOR_PICKUP | READY_FOR_PICKUP | 무변경 (동일) |
| **READY_FOR_PICKUP** | **IN_TRANSIT** | **자동 전환 ✓ (forward-only non-locking)** |
| READY_FOR_PICKUP | DELIVERED | **무변경** (locking transition — operator 명시 필요) |
| IN_TRANSIT | IN_TRANSIT | 무변경 |
| IN_TRANSIT | DELIVERED | **무변경** (locking transition) |
| DELIVERED | * | **silent no-op** (immutable rule_4) |
| CONDITION_CHECKED | * | **silent no-op** (immutable rule_4) |

### 필드 patch 정책

| 필드 | 동작 |
|---|---|
| `providerLastSyncedAt` / `providerId` / `providerIsMock` / `providerNote` / `providerEstimatedDelivery` | 항상 set |
| `trackingNumber` | 기존 빈 값일 때만 채움 (operator 입력 보존) |
| `carrierName` | 기존 빈 값일 때만 채움 (operator 입력 보존) |
| `pickupDate` / `deliveryDate` | **무수정** — operator 도메인 |
| `memo` | **무수정** — operator 도메인 |

### 실패 정책

| 상황 | 동작 |
|---|---|
| provider throw | dispatcher try/catch → 다음 provider 시도 |
| 모든 provider 실패 | dispatcher null 반환 → store action silent fallback |
| timeline 오염 | **0건** — 실패 시 timeline event 0 |

---

## Build 결과

```
> npm run build

Route (app)                              Size     First Load JS
┌ ○ /                                    107 kB          194 kB
└ ○ /_not-found                          873 B            88 kB

✓ Compiled successfully
✓ type-check 통과 (tsc --noEmit, 0 error)
```

**Δ Route**: 106 kB → **107 kB (+1 kB)** vs STEP 49 baseline.

증분 분석:
- types/logistics-provider (~85 LOC) — type 정의만, 런타임 0 byte
- mock-logistics-provider (~140 LOC) — 결정성 mock + sample dataset
- logistics-provider (~70 LOC) — registry / dispatcher
- store +150 LOC — action impl
- LogisticsDetailDrawer +140 LOC — Provider Sync 섹션 + 2 sub-component
- types/logistics +25 LOC — 옵셔널 필드만

---

## 검증 매트릭스

| 사용자 spec | 검증 결과 |
|---|---|
| **Logistics Provider 타입 정의** | |
| LogisticsProvider interface | ✅ `src/types/logistics-provider.ts` |
| MockLogisticsProvider 구현 | ✅ `src/lib/mock-logistics-provider.ts` |
| 향후 DHL / FedEx / 국내 미술 운송사 API 교체 가능 | ✅ Registry pattern (push만 하면 됨) |
| **Provider 제공 정보** | |
| trackingId | ✅ `result.trackingId` (mock 생성 또는 보존) |
| carrierName | ✅ `result.carrierName` |
| currentStatus (suggestedStatus) | ✅ forward-only non-locking |
| estimatedDeliveryDate | ✅ `result.estimatedDelivery` (createdAt + 7~14일) |
| lastCheckedAt (fetchedAt) | ✅ ISO datetime |
| providerNote | ✅ status별 sample 풀에서 결정성 선택 |
| **Store / Action** | |
| 기존 logistics record 직접 깨지 않음 | ✅ 옵셔널 필드만 추가 + operator 입력 보존 |
| `syncLogisticsFromProvider(logisticsId)` 추가 | ✅ |
| Provider sync 성공 시 logistics status 업데이트 | ✅ forward-only non-locking only |
| trackingId / carrierName / estimatedDelivery 저장 | ✅ |
| timeline event 추가 | ✅ "Logistics provider sync" |
| 실패 시 silent fallback + timeline 오염 금지 | ✅ result null → return, timeline 0 |
| **UI** | |
| LogisticsDetailDrawer에 Provider Sync 섹션 | ✅ 메모 다음 |
| "물류 상태 동기화" 버튼 | ✅ 우상단 ghost size=sm |
| Provider / Tracking ID / Carrier / Last checked / Estimated delivery / Status note 표시 | ✅ 5-row ProviderRow + Status note 분리 영역 |
| Mock provider 작은 표시 | ✅ italic 배지 "Mock provider" |
| **표현 정책** | |
| "운영 참고" | ✅ "운영 참고 sync" / "운영 참고용" |
| "provider 기준" | ✅ "Status note (provider 기준)" |
| "최근 조회 시점" | ✅ ProviderRow 라벨 |
| "배송 보장" 금지 | ✅ "배송 / 도착 / 보험을 보장하지 않습니다" 부정형만 |
| "보험 보장" 금지 | ✅ 부정형만 |
| "확정 도착" 금지 | ✅ "확정 도착이 아닙니다" 부정형만 |
| "법적 효력" 금지 | ✅ 0건 |
| **제약** | |
| 실제 외부 API 호출 금지 | ✅ deterministic mock only |
| 외부 라이브러리 추가 금지 | ✅ `package.json` 0줄 변경 |
| Payment / Settlement / Tax / FX / Customer / AI 로직 변경 금지 | ✅ 0줄 |
| Persistence schema 변경 최소화 | ✅ 옵셔널 필드만 추가, validateV1 무영향 |
| 기존 Logistics / ConditionReport immutable rule 무수정 | ✅ `isLogisticsLocked` 그대로 + ConditionReport 0줄 변경 |
| 3-column layout 변경 금지 | ✅ 0줄 변경 |
| **검증** | |
| Logistics record가 있는 작품에서 Drawer 열기 | ✅ 기존 LogisticsSummary → openLogisticsDetail 흐름 |
| "물류 상태 동기화" 클릭 | ✅ handleSync → syncLogisticsFromProvider |
| mock provider 결과 표시 | ✅ 5-row + Status note + 배지 |
| timeline에 "Logistics provider sync" 이벤트 추가 | ✅ kind=TRANSACTION + relatedEntityType=logistics |
| DELIVERED / CONDITION_CHECKED 이후 immutable rule 유지 | ✅ store + UI 양쪽 가드 |
| build 통과 | ✅ Route 107 kB |

---

## Manifesto rule 정합성

| Rule | STEP 50 영향 | 상태 |
|---|---|---|
| **rule_4** Trust Layer | provider 결과는 추정 정보로 명시 + immutable rule 그대로 (sync 자체도 locked record 무영향) | ✅ 강화 |
| **rule_5** AI-Human Loop | 자동 적용 1개 경로(READY_FOR_PICKUP → IN_TRANSIT) 만 — DELIVERED / CONDITION_CHECKED는 operator 명시 | ✅ 핵심 적용 |
| **rule_6** State Machine | DELIVERED / CONDITION_CHECKED 자동 트리거 0건 — canonical 흐름 보존 | ✅ 보존 |
| **rule_7** RBAC | 명시 가드 없음 (drawer 진입 권한 = sync 권한, audit / market analysis 정책과 일관) | ✅ 보존 |
| **rule_8** Timeline = Navigation | 신규 timeline event는 relatedEntityType="logistics" + id로 audit log navigation 가능 | ✅ 강화 |
| **rule_14** 3-Column | 레이아웃 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | drawer footer "닫기" / "저장" + Provider Sync 보조 버튼 (primary 영역 외) | ✅ 보존 |
| **rule_16** 미니멀 디자인 | 절제된 회색 + italic disclaimer + 그림자 0 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | overlay 안 섹션 추가만 | ✅ 보존 |
| **rule_21** | **본 STEP에서 처음으로 외부 hook 정착** — 향후 실 운송사 API 연결 시 Mock 클래스만 교체 | ✅ **본격화** |

---

## 향후 실 provider 연결 가이드

```ts
// 향후: src/lib/dhl-logistics-provider.ts
import type { LogisticsProvider, LogisticsProviderInput, LogisticsProviderResult } from "@/types/logistics-provider";

export class DhlLogisticsProvider implements LogisticsProvider {
  readonly providerId = "dhl_v1";
  readonly isMock = false;
  
  constructor(private apiKey: string) {}
  
  fetchSync(input: LogisticsProviderInput): LogisticsProviderResult {
    // 실제 DHL API 호출 (sync wrapper 또는 향후 async 전환)
    // ...
  }
}

// src/lib/logistics-provider.ts — registry에 추가만
const ACTIVE_LOGISTICS_PROVIDERS: LogisticsProvider[] = [
  new DhlLogisticsProvider(process.env.DHL_API_KEY ?? ""),  // 우선순위 높음
  new MockLogisticsProvider(),  // fallback
];
```

**다른 코드 변경 0줄** — store action / UI / 타입 모두 그대로 재사용.

---

## 다음 STEP 후보

남은 Track 후보:

1. **Market Analysis history slice** — Persistence schema v2 migration (시간 추이 비교용 — STEP 50과 같은 패턴이지만 schema 본격 변경)
2. **Channel Mix cross-tab 확장** — 작가별 / 상태별 세분화
3. **ConditionReport provider hook** — STEP 50과 같은 외부 hook 패턴을 검수 도메인에 적용 (보험사 / 검수 평가사 연결)
4. **Logistics 다중 provider 우선순위 UI** — Settings 페이지에서 provider 활성/비활성 토글

---

## 결과 요약

- 신규 파일 3개 (type 1 + lib 2, 총 ~295 LOC)
- 수정 파일 3개 (logistics type / store / drawer)
- 0 신규 라이브러리 / 0 외부 API / 0 schema validation 변경
- Persistence schema는 옵셔널 필드 5개만 추가 (validateV1 무영향)
- 기존 immutable rule (DELIVERED / CONDITION_CHECKED) 0줄 변경
- ConditionReport 도메인 0줄 변경
- forward-only non-locking transition만 자동 (1개 경로) — operator 결정권 보존
- STEP 19/29 ExternalAuctionProvider 패턴 100% 일관 (registry / failure 격리 / 결정성)
- Route +1 kB (106 → 107 kB)

**STEP 50 완료. rule_21 외부 hook 본격화 — 운영 후반부(배송) provider 구조 완성.**
