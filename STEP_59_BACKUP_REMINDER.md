# STEP 59 — Backup Reminder / Backup Health Indicator

> **목표**: STEP 52 JSON 백업 기능에 자동 알림 / 상태 표시 추가. 사용자가
> 백업을 잊으면 데이터 손실 위험이 큰 localStorage 기반 환경에서 운영 안전망
> 정착. **Persistence schema 변경 0줄 — validateV1 / SCHEMA_VERSION 무수정**.

---

## State

- **이전**: STEP 57 / Route 120 kB
- **이번**: STEP 59 / **Route 121 kB (+1 kB)**
- Build ✅ · type-check ✅ · Lint ✅

---

## 진행 이유

1. AXVELA OS는 localStorage 기반 — 브라우저 변경 / 캐시 삭제 / 기기 변경 시 데이터 증발
2. STEP 52에서 JSON 백업 기능을 만들었지만 사용자가 **실행하지 않으면** 무용지물
3. 따라서 운영 안전망으로 자동 알림 / 상태 표시 정착 — 사용자에게 환기

---

## Flow

```
PersistenceProvider mount
  ↓
useArtworkStore.getState().hydrateBackupMetadata()
  ↓
loadBackupMetadata() — localStorage `axvela.backup.metadata.v1` 읽기
  ↓
store.backupMetadata.lastBackupAt 갱신
  ↓
BackupSection / Sidebar indicator 자동 리렌더
  ↓
computeBackupHealth(lastBackupAt) → { level, label, description, daysSince }
  ↓
UI 분기:
  ├─ never   → "백업 미실행" (neutral)
  ├─ fresh   → "백업: 오늘" / "백업 N일 전" (neutral)
  ├─ stale   → "백업 N일 전 · 백업 갱신 권장" (amber, 7일 이상)
  └─ expired → "백업 N일 전 · 데이터 손실 위험" (red, 30일 이상)

[백업 다운로드] 클릭
  ↓
downloadBackupJson() 성공
  ↓
markBackupCompleted() ← STEP 59 신규 호출
  ├─ markBackupCompletedInStorage() — localStorage 갱신
  └─ store.backupMetadata 갱신
  ↓
모든 indicator 즉시 색상/라벨 변화
```

**다른 디바이스에서 JSON 복원 시 → 자연스럽게 "백업 미실행" 상태 시작**
(JSON 백업 파일에는 lastBackupAt이 들어가지 않음 — 디바이스별 행위 기록은 분리)

---

## 변경 / 신규 파일

### 신규 (1 + doc)

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/backup-metadata.ts` | ~180 | 별도 localStorage 키 + computeBackupHealth + test helper |
| `STEP_59_BACKUP_REMINDER.md` | (이 문서) | 완료 보고 |

### 변경 (4 + ARCHITECTURE.md)

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/store/useArtworkStore.ts` | ~50 LOC | `backupMetadata` UI slice + 2 actions + reset clear |
| `src/components/PersistenceProvider.tsx` | 4 LOC | mount 시 hydrateBackupMetadata 1줄 추가 |
| `src/components/documents/BackupSection.tsx` | ~70 LOC | markBackupCompleted hook + BackupHealthRow 추가 |
| `src/components/layout/Sidebar.tsx` | ~95 LOC | BackupHealthSidebarIndicator 추가 |

---

## 핵심 코드

### 1) Schema 분리 — 별도 localStorage 키

```ts
// src/lib/backup-metadata.ts

const BACKUP_METADATA_KEY = "axvela.backup.metadata.v1";

export interface BackupMetadata {
  lastBackupAt: string | null;
}

// SSR-safe + 손상 데이터 silent fallback
export function loadBackupMetadata(): BackupMetadata {
  if (typeof window === "undefined") return EMPTY_METADATA;
  try {
    const raw = window.localStorage.getItem(BACKUP_METADATA_KEY);
    if (!raw) return EMPTY_METADATA;
    const parsed = JSON.parse(raw);
    // shape 검증 ...
    return { lastBackupAt: parsed.lastBackupAt };
  } catch {
    return EMPTY_METADATA;  // 끊김 0
  }
}

export function markBackupCompleted(): BackupMetadata {
  const next = { lastBackupAt: new Date().toISOString() };
  saveBackupMetadata(next);
  return next;
}

export function clearBackupMetadata(): void { ... }
```

**Persistence schema 0줄 변경** — `PersistedState` / `validateV1` / `SCHEMA_VERSION` 무수정. JSON 백업 파일에 lastBackupAt 부재 → 디바이스별 행위 기록 분리.

### 2) Health computation — 결정성 함수

```ts
const STALE_THRESHOLD_DAYS = 7;
const EXPIRED_THRESHOLD_DAYS = 30;

export function computeBackupHealth(
  lastBackupAt: string | null,
  now: Date = new Date()  // 테스트 가능 — now 주입
): BackupHealth {
  if (!lastBackupAt) return { level: "never", label: "백업 미실행", ... };

  const daysSince = Math.floor((now - new Date(lastBackupAt)) / 86400000);

  if (daysSince >= 30) return { level: "expired", label: `백업 ${daysSince}일 전`, ... };
  if (daysSince >= 7)  return { level: "stale",   label: `백업 ${daysSince}일 전`, ... };
  if (daysSince === 0) return { level: "fresh",   label: "백업: 오늘", ... };
  return { level: "fresh", label: `백업 ${daysSince}일 전`, ... };
}
```

**결정성**: 같은 `lastBackupAt` + `now` → 같은 결과. 테스트 가능.

### 3) Store slice (PersistedState 분리)

```ts
// src/store/useArtworkStore.ts

interface ArtworkUIState {
  // ... 기존 필드
  backupMetadata: { lastBackupAt: string | null };
  hydrateBackupMetadata: () => void;
  markBackupCompleted: () => void;
}

// 초기값
backupMetadata: { lastBackupAt: null },

// Actions
hydrateBackupMetadata: () => {
  const meta = loadBackupMetadata();
  set({ backupMetadata: { lastBackupAt: meta.lastBackupAt } });
},
markBackupCompleted: () => {
  const next = markBackupCompletedInStorage();
  set({ backupMetadata: { lastBackupAt: next.lastBackupAt } });
},

// resetAllData에 추가
clearBackupMetadata();  // localStorage 별도 키 clear
```

PersistedState 직렬화 대상 아님 → `validateV1` 무영향.

### 4) PersistenceProvider — mount hydration

```tsx
// src/components/PersistenceProvider.tsx (4 LOC 추가)

// 1) Mount hydrate (local primary)
applyExternal(() => {
  useArtworkStore.getState().hydrateFromStorage();
});
// ... 기존 로직

// STEP 59 — Backup metadata hydrate
useArtworkStore.getState().hydrateBackupMetadata();
```

도메인 hydrate와 같은 시점에 1회만 — 새로고침 후에도 indicator 유지.

### 5) BackupSection — 다운로드 성공 hook

```tsx
// src/components/documents/BackupSection.tsx

const lastBackupAt = useArtworkStore((s) => s.backupMetadata.lastBackupAt);
const markBackupCompleted = useArtworkStore((s) => s.markBackupCompleted);
const health = useMemo(() => computeBackupHealth(lastBackupAt), [lastBackupAt]);

const handleExport = useCallback(() => {
  setStatus({ kind: "exporting" });
  const ok = downloadBackupJson();
  if (!ok) { setStatus({ kind: "error", ... }); return; }
  markBackupCompleted();   // ← STEP 59 추가 1줄
  setStatus({ kind: "idle" });
}, [markBackupCompleted]);

// UI: BackupHealthRow mount
<BackupHealthRow health={health} />
```

import / restore 흐름은 0줄 변경.

### 6) BackupHealthRow (BackupSection 안)

```tsx
function BackupHealthRow({ health }: { health: BackupHealth }) {
  return (
    <span
      className={cn(
        "text-[10px] tracking-tightish italic leading-snug pt-0.5",
        healthColorClass(health.level)  // text-ink-subtle / status-inquiry / status-deal
      )}
      title={health.description}
    >
      {health.label}
      {health.level === "stale"   && <span className="not-italic ml-1.5">· 백업 갱신 권장</span>}
      {health.level === "expired" && <span className="not-italic ml-1.5">· 데이터 손실 위험</span>}
    </span>
  );
}
```

### 7) Sidebar BackupHealthSidebarIndicator

```tsx
// src/components/layout/Sidebar.tsx

function BackupHealthSidebarIndicator() {
  const lastBackupAt = useArtworkStore((s) => s.backupMetadata.lastBackupAt);
  const openDocuments = useArtworkStore((s) => s.openDocuments);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const health = useMemo(() => computeBackupHealth(lastBackupAt), [lastBackupAt]);
  const canOpen = hasPermission(currentRole, "report.view_global");

  // Manager+ 권한 → button (클릭 시 DocumentsDrawer 열어 즉시 백업 가능)
  // 권한 부족 → 단순 표시
  if (canOpen) {
    return (
      <button
        onClick={openDocuments}
        title={`${health.description} · 클릭하면 백업 섹션을 엽니다.`}
        className="..."
      >
        <span className={cn("w-1 h-1 rounded-full", sidebarDotClass(health.level))} />
        <span className={sidebarLabelClass(health.level)}>{health.label}</span>
      </button>
    );
  }
  return <div>...</div>;
}
```

footer에 mount:
```tsx
<RoleSwitcher />
<ResetDataButton />
<BackupHealthSidebarIndicator />  {/* ← STEP 59 신규 */}
<SyncStatusIndicator />
```

---

## 검증 매트릭스

### 사용자 spec 6개 검증 항목

| 항목 | 결과 |
|---|---|
| 백업 다운로드 → JSON + lastBackupAt 저장 | ✅ markBackupCompleted handleExport 직후 |
| 새로고침 후 indicator 유지 | ✅ PersistenceProvider mount → hydrate 자동 |
| 처음 사용자 → "백업 미실행" | ✅ null lastBackupAt → "never" level |
| 7일 이상 mock 테스트 가능 | ✅ `_setBackupMetadataForTest({daysAgo: 10})` |
| 30일 이상 mock 테스트 가능 | ✅ `_setBackupMetadataForTest({daysAgo: 35})` |
| build 통과 | ✅ Route 121 kB / 0 error / clean lint |

### 사용자 spec 6개 제약

| 제약 | 결과 |
|---|---|
| 기존 백업/복원 기능 깨짐 | ✅ 0건 (STEP 52 흐름 그대로, markBackupCompleted 추가만) |
| validateV1 / SCHEMA_VERSION 변경 최소화 | ✅ **0줄** (별도 localStorage 키로 분리) |
| Artwork / Invoice / Customer / Logistics / Documents / AI 변경 | ✅ 0줄 |
| 외부 API 호출 | ✅ 0건 |
| 신규 라이브러리 추가 | ✅ 0개 (`package.json` 0줄) |
| 3-column layout 변경 | ✅ 0줄 |

### 표현 정책

| 표현 | 결과 |
|---|---|
| "최근 백업" / "백업 미실행" | ✅ 사용 |
| "백업 갱신 권장" | ✅ stale 시 노출 |
| "데이터 손실 위험" | ✅ expired 시 노출 |
| "데이터 보장" / "법적 효력" | ✅ 0건 (정책 주석에서만) |

---

## 테스트 가이드

### 브라우저 콘솔에서 mock 상태 만들기

```javascript
// 처음 사용자 — "백업 미실행" 상태
localStorage.removeItem('axvela.backup.metadata.v1');
location.reload();

// 7일 이상 (stale, amber) — 10일 전
localStorage.setItem('axvela.backup.metadata.v1',
  JSON.stringify({ lastBackupAt: new Date(Date.now() - 10*86400000).toISOString() })
);
location.reload();

// 30일 이상 (expired, red) — 35일 전
localStorage.setItem('axvela.backup.metadata.v1',
  JSON.stringify({ lastBackupAt: new Date(Date.now() - 35*86400000).toISOString() })
);
location.reload();

// 정상 (오늘 백업)
localStorage.setItem('axvela.backup.metadata.v1',
  JSON.stringify({ lastBackupAt: new Date().toISOString() })
);
location.reload();
```

### Sidebar indicator 색상 확인

| 상태 | dot 색상 | 라벨 색상 |
|---|---|---|
| 백업 미실행 | bg-ink-subtle (회색) | text-ink-subtle |
| 백업: 오늘 | bg-ink-muted (어두운 회색) | text-ink-subtle |
| 백업 N일 전 (1~6일) | bg-ink-muted | text-ink-subtle |
| 백업 N일 전 (7~29일) | bg-status-inquiry (amber) | text-status-inquiry |
| 백업 N일 전 (30일+) | bg-status-deal (red) | text-status-deal |

### 정상 시나리오

1. Sidebar 하단 → "백업 미실행" 회색 dot 확인
2. Sidebar의 indicator 클릭 → DocumentsDrawer 자동 열림 (Manager+)
3. BackupSection → "백업 다운로드" 클릭 → JSON 다운로드
4. 즉시 indicator가 "백업: 오늘" 어두운 회색 dot으로 변경
5. 페이지 새로고침 → 상태 그대로 유지
6. 콘솔에서 mock 35일 전 설정 → reload → 빨간 dot + "백업 35일 전 · 데이터 손실 위험"

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_4** Trust Layer | **본 STEP의 핵심** — 데이터 손실 위험을 transparent 노출, 운영 안전망 | ✅ **강화** |
| **rule_7** RBAC | indicator 클릭은 Manager+만 (DocumentsDrawer 진입 권한과 일관) | ✅ 보존 |
| **rule_14** 3-Column | 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | primary action 영역 그대로, indicator는 별도 utility | ✅ 보존 |
| **rule_16** 미니멀 디자인 | text-[9.5px] / [10px] + 1x1 dot + 그림자 0 + italic 절제된 톤 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | 0줄 변경 | ✅ 보존 |

---

## 분리 정책의 부수적 이점

JSON 백업 파일에 lastBackupAt **미포함**:

```
디바이스 A에서 백업 (5월 4일)
  ↓ 백업 파일 전송
디바이스 B에서 복원
  ↓
디바이스 B의 lastBackupAt = null (자동)
  ↓
indicator: "백업 미실행"
  ↓
사용자가 즉시 새 디바이스에서 백업 환기 받음 ✓
```

→ 백업 metadata는 **그 디바이스의 행위 기록**이지 데이터 자체가 아니라는 정확한 의미론.
→ 다른 디바이스로 옮겨도 새 환경에서 즉시 백업 행위를 환기.

---

## 다음 STEP 후보

```
STEP 58  Logistics 후속 — bulk provider sync / 출고 캘린더
STEP 60  Documents Hub 후속 — 개별 PDF ZIP / 추가 필터
STEP 61  Image storage 후속 — DELETE / 압축 / thumbnail
STEP 62  Backup 자동 download 알림
         - browser notification API (선택적)
         - 30일 이상 시 brewer banner
```

---

## 결과 요약

- 신규 파일 1개 (lib ~180 LOC)
- 수정 파일 4개 (store + Provider + BackupSection + Sidebar)
- 0 신규 라이브러리 / 0 외부 API / 0 schema 변경 / 0 도메인 로직
- Persistence schema 변경 0줄 — 별도 localStorage 키 분리 정책
- 4단계 health level (never / fresh / stale / expired)
- 임계값 7일 / 30일 (사용자 spec)
- 절제된 톤 (text-[9.5px] / [10px] + 1x1 dot + italic)
- Sidebar indicator 클릭 시 DocumentsDrawer 자동 열림 (즉시 백업 가능)
- 다른 디바이스 복원 시 자연 reset (의미론 정확)
- 콘솔 mock helper로 7일/30일 상태 테스트 가능
- Route +1 kB (120 → 121 kB)

**STEP 59 완료. 운영 안전망 정착 — rule_4 Trust Layer 강화.**
