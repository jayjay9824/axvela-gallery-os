# STEP 52 — JSON Backup / Restore

> **목표**: localStorage 기반 데이터를 JSON 파일로 export / import. 노트북 변경 /
> 갤러리 직원 간 데이터 공유 / 디바이스 마이그레이션 시 서버 없이 데이터 이동
> 가능. **Persistence schema 0줄 변경 — validateV1 그대로 사용**.

---

## State

- **이전**: STEP 51 / Route 114 kB
- **이번**: STEP 52 / **Route 115 kB (+1 kB)**
- Build ✅ · type-check ✅ · Lint ✅

---

## Flow

```
DocumentsDrawer (Manager+ RBAC)
  │
  └─ BackupSection (utility bar, footer 위)
       ┌────────────────────────────────────────────────┐
       │ 데이터 백업 / 복원                             │
       │ 전체 데이터를 JSON 파일로 저장 / 복원합니다.   │
       │                  [백업 다운로드] [복원 업로드] │
       └────────────────────────────────────────────────┘

[백업 다운로드] 클릭 흐름:
  downloadBackupJson()
    ├─ adapter.load() → PersistedState
    ├─ JSON.stringify(state, null, 2)
    ├─ Blob → URL.createObjectURL
    └─ 자동 download (axvela-backup-{YYYYMMDD-HHMM}.json)

[복원 업로드] 클릭 흐름:
  click → input file dialog
    ↓ 파일 선택
  readBackupFile(file)
    ├─ FileReader text 읽기      [실패 → read_failed]
    ├─ JSON.parse                 [실패 → not_json]
    ├─ version 빠른 체크          [mismatch → version_mismatch]
    ├─ validateV1ForImport        [필수 key 누락 → schema_mismatch]
    └─ sanitizeImportedState      [예상치 못한 key 제거]
    ↓
  window.confirm (한국어 요약 + 저장 시각 + 경고)
    ↓ 사용자 확인
  applyImportedBackup(state)
    └─ adapter.save() — localStorage에 직접 영속화
    ↓
  window.location.reload()
    └─ PersistenceProvider 첫 마운트 → load → store hydrate (자연 흐름)
```

**store에 직접 접근 0건** — adapter 인터페이스를 통한 read/write만.

---

## 변경 파일 목록

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/lib/persistence.ts` | ~70 LOC | `validateV1ForImport` export wrapper + `sanitizeImportedState` 신규 (기존 schema 0줄) |
| `src/components/documents/DocumentsDrawer.tsx` | 4 LOC | BackupSection import + footer 위 mount |
| `ARCHITECTURE.md` | +1 changelog | STEP 52 추가 |

## 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/backup-restore.ts` | ~210 | Export / Import 로직 + error normalization |
| `src/components/documents/BackupSection.tsx` | ~210 | 얇은 utility bar UI + status state machine |
| `STEP_52_BACKUP_RESTORE.md` | (이 문서) | 완료 보고 |

---

## 핵심 코드

### 1) Schema 변경 0줄 — wrapper만 추가

```ts
// src/lib/persistence.ts

// 기존 validateV1 그대로 (module-private). 외부 호출용 wrapper만 추가:
export function validateV1ForImport(raw: unknown): PersistedState | null {
  return validateV1(raw);
}

// 신규: 알려진 top-level 키 화이트리스트만 통과
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
    settlements: state.settlements,
    taxRecords: state.taxRecords,
    contracts: state.contracts,
    curationNotes: state.curationNotes,
    logistics: state.logistics,
    conditionReports: state.conditionReports,
    priceSuggestions: state.priceSuggestions,
  };
}
```

**기존 PersistedState shape / SCHEMA_VERSION / validateV1 정책 0줄 변경**.

### 2) Read flow — 5단계 검증

```ts
// src/lib/backup-restore.ts

export async function readBackupFile(file: File): Promise<BackupImportResult> {
  // 1. FileReader text 읽기
  let text: string;
  try { text = await readFileAsText(file); }
  catch { return { ok: false, error: { kind: "read_failed", message: "..." } }; }

  // 2. JSON.parse — eval 0건
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { return { ok: false, error: { kind: "not_json", message: "..." } }; }

  // 3. Version 빠른 체크 — 향후 v2 backup이 v1으로 들어오는 케이스 차단
  if (typeof parsed === "object" && parsed !== null
      && "version" in parsed
      && (parsed as { version: unknown }).version !== SCHEMA_VERSION) {
    return { ok: false, error: { kind: "version_mismatch", message: "...", foundVersion: ... } };
  }

  // 4. validateV1 — 필수 key 검증
  const validated = validateV1ForImport(parsed);
  if (!validated) return { ok: false, error: { kind: "schema_mismatch", message: "..." } };

  // 5. Sanitize — 예상치 못한 top-level key 제거
  const sanitized = sanitizeImportedState(validated);

  return { ok: true, state: sanitized, summary: buildSummary(sanitized) };
}
```

**모든 에러는 reject 대신 normalize** — uncaught promise 0.

### 3) UI — BackupSection (status state machine)

```tsx
// src/components/documents/BackupSection.tsx

type Status =
  | { kind: "idle" }
  | { kind: "exporting" }
  | { kind: "reading" }
  | { kind: "applying" }
  | { kind: "error"; message: string };

const handleFileSelected = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = "";  // 같은 파일 재선택 가능

  setStatus({ kind: "reading" });
  const result = await readBackupFile(file);

  if (!result.ok) {
    setStatus({ kind: "error", message: result.error.message });
    return;
  }

  // confirm dialog (사용자 spec)
  const proceed = window.confirm([
    "기존 데이터가 모두 덮어씌워집니다. 계속하시겠습니까?",
    "",
    `백업 요약: ${result.summary}`,
    `저장 시각: ${formatHumanDate(result.state.savedAt)}`,
    "",
    "이 작업은 되돌릴 수 없습니다. 현재 데이터를 먼저 백업하셨는지 확인해주세요.",
  ].join("\n"));

  if (!proceed) { setStatus({ kind: "idle" }); return; }

  setStatus({ kind: "applying" });
  applyImportedBackup(result.state);
  
  // 사용자 spec: 성공 시 reload
  window.location.reload();
};
```

### 4) 백업 요약 (한국어)

```ts
function buildSummary(state: PersistedState): string {
  return [
    `작품 ${state.artworks.length}`,
    `거래 ${countNested(state.transactions)}`,
    `인보이스 ${countNested(state.invoices)}`,
    `결제 ${countNested(state.payments)}`,
    `정산 ${countNested(state.settlements)}`,
    `세금 ${countNested(state.taxRecords)}`,
    `계약서 ${countNested(state.contracts)}`,
    `Logistics ${countNested(state.logistics)}`,
    `검수 ${countNested(state.conditionReports)}`,
  ].join(" · ");
}
```

confirm dialog 예시:
```
기존 데이터가 모두 덮어씌워집니다. 계속하시겠습니까?

백업 요약: 작품 47 · 거래 31 · 인보이스 24 · 결제 18 · 정산 12 · ...
저장 시각: 2026-05-04 14:32

이 작업은 되돌릴 수 없습니다. 현재 데이터를 먼저 백업하셨는지 확인해주세요.
```

---

## 보안 정책 매트릭스

| 위협 | 방어 |
|---|---|
| **Script injection** (eval, Function constructor) | JSON.parse만 사용 — 함수 / Symbol / undefined 자연 제거 |
| **Schema poisoning** (예상치 못한 key 추가) | sanitizeImportedState — 알려진 top-level 키 화이트리스트만 새 객체로 재구성 |
| **Prototype pollution** (`__proto__` / `constructor`) | sanitize에서 새 object 생성 — 명시 키만 복사 |
| **Cross-version 데이터** (v2 backup → v1 system) | version 빠른 체크 → version_mismatch 에러 |
| **손상된 JSON** | JSON.parse try/catch → not_json 에러 |
| **누락된 필수 슬라이스** | validateV1 — schema_mismatch 에러 |
| **읽기 실패** | FileReader try/catch → read_failed 에러 |
| **사용자 실수** (잘못된 백업 적용) | window.confirm + 백업 요약 + 저장 시각 표시 |
| **악의적 sourceTabId 주입** | sanitize 시 sourceTabId 제거 (현재 탭이 새 source가 됨) |

---

## 검증 매트릭스

### 사용자 spec 검증 항목

| 항목 | 결과 |
|---|---|
| Export → JSON 파일 생성 | ✅ buildBackupFilename + Blob download |
| Import → 데이터 완전 복원 | ✅ adapter.save + window.location.reload |
| 다른 Drawer / 기능 영향 없음 | ✅ UI는 BackupSection 신규, lib는 read-only adapter 호출만 |
| confirm dialog 표시 | ✅ window.confirm 한국어 + 백업 요약 + 저장 시각 + 경고 |
| 성공 시 window.location.reload() | ✅ |
| 실패 시 에러 메시지 | ✅ status.kind === "error" 표시 |
| build 통과 | ✅ Route 115 kB |

### 사용자 spec 제약

| 제약 | 결과 |
|---|---|
| Persistence schema 변경 금지 | ✅ PersistedState / SCHEMA_VERSION / validateV1 0줄 변경 |
| validateV1 그대로 사용 | ✅ thin wrapper만 추가 (`validateV1ForImport`) |
| 기존 도메인 로직 변경 금지 | ✅ 0줄 |
| 외부 API 사용 금지 | ✅ 0건 (FileReader / Blob만) |
| 신규 라이브러리 금지 | ✅ `package.json` 0줄 |

### 보안

| 보안 항목 | 결과 |
|---|---|
| script 삽입 방지 | ✅ JSON.parse만 (eval 0건) |
| 예상치 못한 key 제거 | ✅ sanitizeImportedState 화이트리스트 |
| validate 통과 데이터만 적용 | ✅ readBackupFile → confirm → applyImportedBackup 순서 강제 |

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_4** Trust Layer | confirm dialog + 백업 요약 + 저장 시각 + 경고 명시 | ✅ 강화 |
| **rule_7** RBAC | DocumentsDrawer 진입 권한(`report.view_global`, Manager+) 자동 적용 | ✅ 보존 |
| **rule_14** 3-Column | 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | primary action 영역(Footer)은 그대로, BackupSection은 별도 utility bar | ✅ 보존 |
| **rule_16** 미니멀 디자인 | bg-surface-muted/40 + 작은 typography + 그림자 0 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | overlay 안 utility bar 추가만 | ✅ 보존 |
| **STEP 27 Persistence** | adapter contract 그대로 사용 — 향후 IndexedDB / Remote sync 교체 시 자동 호환 | ✅ 보존 |
| **STEP 27.7 Multi-tab sync** | sourceTabId import 시 무시 — self-write loop 방지 정책 일관 | ✅ 보존 |

---

## 시나리오 검증

### 시나리오 1: 노트북 변경

```
[갤러리 노트북 A]
1. Sidebar → "문서" → DocumentsDrawer 열기
2. BackupSection → "백업 다운로드" 클릭
3. axvela-backup-20260504-1432.json 다운로드됨

[새 노트북 B]
1. Vercel URL 접속 → 빈 데이터
2. Sidebar → "문서" → DocumentsDrawer 열기
3. "복원 업로드" 클릭 → JSON 선택
4. confirm dialog: "백업 요약: 작품 47 · 거래 31 · ..." → 확인
5. window.location.reload() → 노트북 A의 모든 데이터 복원됨 ✓
```

### 시나리오 2: 직원 간 공유

```
[매니저]
1. 백업 다운로드 → JSON 파일을 Slack / 이메일로 직원에게 전송

[직원]
1. 받은 JSON 파일을 다운로드
2. 본인 노트북에서 AXVELA 열기 → "복원 업로드"
3. confirm 후 reload → 매니저와 동일 데이터 ✓
```

### 시나리오 3: 잘못된 파일 업로드

```
- 일반 JSON 파일이지만 AXVELA backup이 아님 → schema_mismatch 에러 ⚠
- TXT 파일 / PDF / PNG → not_json 에러 ⚠
- 손상된 JSON → not_json 에러 ⚠
- v2 backup을 v1 시스템에 → version_mismatch 에러 ⚠
- 어떤 경우에도 기존 데이터는 영향 없음 — confirm 단계 도달 못 함 ✓
```

### 시나리오 4: 사용자 실수 방지

```
- 잘못된 백업을 confirm 단계에서 백업 요약을 보고 취소 가능
- "현재 데이터를 먼저 백업하셨는지 확인해주세요" 경고 노출
- confirm 취소 시 status idle로 복귀, 데이터 무영향
```

---

## 다음 STEP 후보

남은 작업:

```
STEP 53  외부 storage 연결 (이미지)
         - Vercel Blob 또는 Cloudflare R2
         - 현재 inline 3MB 제한 해소

STEP 54  Logistics 통합 view
         - Customer / Reporting / Documents 패턴 일관

STEP 55  Documents Hub 후속:
         - 개별 PDF ZIP 다운로드
         - 작가 / 작품별 추가 필터

STEP 56  Backup 자동 알림
         - "마지막 백업 N일 전" 표시
         - 사이드바 작은 indicator
         - 30일 이상 미백업 시 경고
```

---

## 결과 요약

- 신규 파일 2개 (lib + component, 총 ~420 LOC)
- 수정 파일 2개 (persistence wrapper + DocumentsDrawer mount)
- 0 신규 라이브러리 / 0 외부 API / 0 schema 변경 / 0 도메인 로직 변경
- Persistence adapter contract 그대로 — 향후 IndexedDB / Remote sync 자동 호환
- 5단계 검증 흐름 (read → JSON → version → validateV1 → sanitize)
- 9가지 위협 방어 매트릭스 (script injection / schema poisoning / prototype pollution / ...)
- 한국어 confirm dialog + 백업 요약 + 저장 시각
- Route +1 kB (114 → 115 kB)

**STEP 52 완료. 노트북 / 직원 / 디바이스 간 데이터 이동 가능.**
