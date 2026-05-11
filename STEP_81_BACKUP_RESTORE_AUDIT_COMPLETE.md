# STEP 81 — Backup / Restore Audit Integration — Completion Report

## State

**STEP 78 baseline (143 kB) → STEP 81 complete (144 kB).**
Build / type-check / lint all green.
ZIP: `axvela-step81-backup-restore-audit.zip`.

---

## Flow

```
백업 다운로드 클릭
  → downloadBackupJson() → BackupExportOutcome
       ├ ok  → markBackupCompleted()
       │     → appendAuditEvent({ category: backup, action: backup_export_success, info })
       └ !ok → appendAuditEvent({ category: backup, action: backup_export_failed, error })
                                  ↓
                  axvela.audit.v1 (별도 키) 영속

복원 업로드 클릭
  → readBackupFile()
       ├ !ok → appendAuditEvent(restore_read_failed, warning)        ← validation 실패
       └ ok  → confirm dialog
                ├ cancel → appendAuditEvent(restore_apply_cancelled, info)
                └ proceed → appendAuditEvent(restore_apply_pending, warning)   ← reload 후에도 흔적 보존
                          → applyImportedBackup()
                              ├ success → appendAuditEvent(restore_apply_success, info)
                              └ throw   → appendAuditEvent(restore_apply_failed, error)
                          → window.location.reload()

resetAllData (Sidebar 초기화 버튼)
  → adapter.clear()
  → clearBackupMetadata()
  → set({...mock 데이터, backupMetadata: null, auditEvents 보존})
  → appendAuditEvent(backup_metadata_cleared, info)
                                  ↓
              audit drilldown / AuditLogViewerDrawer 자연 등장
              ActionBreakdownRow top 5 후보 다양화
```

---

## New / Changed Files

### Modified (3)
1. **`src/lib/backup-restore.ts`** (~50 LOC 변경)
   - `downloadBackupJson()` 반환 타입: `boolean` → `BackupExportOutcome` discriminated union
   - 신규 export `BackupExportOutcome` — `{ ok: true; fileName; artworkCount; schemaVersion: typeof SCHEMA_VERSION; exportedAt } | { ok: false; reason: "empty" | "write_failed"; message? }`
   - `triggerDownload` try/catch 래핑 — `write_failed` graceful (안전 가드)
   - 헤더 주석 STEP 81 참조 추가

2. **`src/components/documents/BackupSection.tsx`** (~120 LOC 변경)
   - 헤더 주석 STEP 81 적용 — 6개 audit action 명시
   - `handleExport`: outcome 객체 분기 + STEP 81 metadata 매칭 (exportedAt / artworkCount / fileName / schemaVersion)
   - `handleFileSelected`:
     - `restore_read_failed` (warning, metadata error / errorKind)
     - `restore_apply_cancelled` (info, metadata cancelledAt / backupSavedAt)
     - **`restore_apply_pending`** (warning, metadata importedAt / detectedSchemaVersion / incomingArtworkCount / backupSavedAt) — 신규
     - `restore_apply_success` (info, metadata restoredAt / restoredArtworkCount / backupSavedAt)
     - `restore_apply_failed` (error, metadata error)
   - 모든 dotted notation (`backup.export.completed` 등) 제거 → STEP 80 `noun_verb_result` 일관

3. **`src/store/useArtworkStore.ts`** (~15 LOC 추가)
   - `resetAllData` 액션 set({...}) 직후 `get().appendAuditEvent({ action: "backup_metadata_cleared", info, metadata: { clearedAt } })` 추가
   - auditEvents 슬라이스는 set에서 의도적으로 제외 → append 자연 누적

### Added (2)
4. **`STEP_81_BACKUP_RESTORE_AUDIT_COMPLETE.md`** — 본 문서
5. **`ARCHITECTURE.md`** — STEP 81 entry append (~10 KB)

### Untouched
- Backup JSON 파일 format — **0 byte 변경** (on-disk shape 무수정, 사용자 spec 명시)
- Restore validation 로직 — `readBackupFile` / `validateV1ForImport` / `sanitizeImportedState` 5단계 검증 흐름 그대로
- Restore import behavior — `applyImportedBackup` / `window.location.reload` 흐름 그대로
- Persistence schema (`PersistedState` / `validateV1` / `SCHEMA_VERSION`) — 0줄
- AuditLogViewerDrawer (STEP 65/78) — 0줄
- STEP 78 audit drilldown (resolver / types / drawer / ClickableMetric) — 0줄
- ImageCleanup STEP 80 — 0줄
- `/api/upload-image` / `/api/delete-image` / `/api/list-images` — 0줄

---

## Route Size Delta

```
Before STEP 81:  / 143 kB / 230 kB First Load JS
After  STEP 81:  / 144 kB / 231 kB First Load JS
                 +1 kB (BackupExportOutcome type + audit metadata payload)
```

```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (7/7)
✓ No ESLint warnings or errors
```

---

## Backup Audit Behavior

### `backup_export_success` (severity `info`)
| Field | Value |
|---|---|
| category | `backup` |
| action | `backup_export_success` |
| severity | `info` |
| message | `백업 JSON 파일 export 완료 ({N}점)` |
| metadata.exportedAt | new Date().toISOString() |
| metadata.artworkCount | `state.artworks.length` |
| metadata.fileName | `axvela-backup-{YYYYMMDD-HHMM}.json` |
| metadata.schemaVersion | `"v1"` (typeof SCHEMA_VERSION) |
| metadata.customerCount | **omitted** — Customer is derived; spec "if available" allows omit; avoids coupling persistence layer to customer-aggregates |

### `backup_export_failed` (severity `error`)
| Field | Value |
|---|---|
| category | `backup` |
| action | `backup_export_failed` |
| severity | `error` (사용자 spec 명시 — STEP 65의 warning에서 격상) |
| message | `백업 export 실패 — {message}` |
| metadata.reason | `"empty" \| "write_failed"` |
| metadata.error | safe message string |

발생 시나리오:
- `empty`: adapter.load() returns null (저장 데이터 부재)
- `write_failed`: Blob / URL.createObjectURL / DOM trigger 예외 (rare; storage quota / permission)

### `backup_metadata_cleared` (severity `info`)
| Field | Value |
|---|---|
| category | `backup` |
| action | `backup_metadata_cleared` |
| severity | `info` |
| message | `백업 metadata clear — 시드 reset 동반` |
| metadata.clearedAt | new Date().toISOString() |

`resetAllData()` 액션 내부에서 emit. auditEvents 슬라이스는 set({...})에서 의도적으로 제외되어 보존되므로 본 append가 자연 누적.

---

## Restore Audit Behavior

### `restore_read_failed` (severity `warning`)
Read/validation 단계 실패 (사용자 spec 명시 안 했으나 pre-pending 변종 보존):
| Field | Value |
|---|---|
| metadata.error | BackupImportError.message |
| metadata.errorKind | `"not_json" \| "schema_mismatch" \| "version_mismatch" \| "read_failed"` |

### `restore_apply_cancelled` (severity `info`)
사용자 confirm 취소 — 의도적 안전 행동:
| Field | Value |
|---|---|
| metadata.cancelledAt | new Date().toISOString() |
| metadata.backupSavedAt | result.state.savedAt |

### `restore_apply_pending` (severity `warning`) — **신규**
applyImportedBackup() 직전. 사용자 spec section 2 "Before restore apply" 매칭:
| Field | Value |
|---|---|
| metadata.importedAt | pendingAt (new Date().toISOString()) |
| metadata.detectedSchemaVersion | `result.state.version` |
| metadata.incomingArtworkCount | `result.state.artworks.length` |
| metadata.backupSavedAt | `result.state.savedAt` |

**Reload 후에도 보존**: `axvela.audit.v1`은 backup 파일이 덮어쓰는 `axvela.persist.v1`과 별도 키 → window.location.reload() 후에도 운영자가 *이 device에서 복원이 시도되었음* retrospective 확인 가능.

### `restore_apply_success` (severity `info`)
| Field | Value |
|---|---|
| metadata.restoredAt | new Date().toISOString() |
| metadata.restoredArtworkCount | `result.state.artworks.length` |
| metadata.backupSavedAt | `result.state.savedAt` |
| metadata.restoredCustomerCount | **omitted** — derived entity, 사용자 spec "if available" allows omit |

### `restore_apply_failed` (severity `error`)
| Field | Value |
|---|---|
| metadata.error | safe message string |

---

## Failure Audit Behavior Summary

| Trigger | Action | Severity | Reload 후 보존 |
|---|---|---|---|
| empty state export | `backup_export_failed` | `error` | ✓ |
| Blob/URL exception | `backup_export_failed` | `error` | ✓ |
| invalid JSON / schema_mismatch | `restore_read_failed` | `warning` | ✓ |
| version_mismatch | `restore_read_failed` | `warning` | ✓ |
| user cancel confirm | `restore_apply_cancelled` | `info` | ✓ |
| applyImportedBackup throw | `restore_apply_failed` | `error` | ✓ — pending도 함께 남음 |

모든 audit는 `axvela.audit.v1` 별도 localStorage 키에 즉시 저장 — backup 데이터 (`axvela.persist.v1`)와 분리되어 device-local 운영 기록 무손실.

---

## Audit Naming Convention (STEP 80/81 일관)

**Pattern**: `noun_verb_result`

| Pre-STEP 81 (dotted) | Post-STEP 81 (snake) | Severity |
|---|---|---|
| `backup.export.completed` | `backup_export_success` | info |
| `backup.export.failed` | `backup_export_failed` | warning → **error** |
| `restore.read.failed` | `restore_read_failed` | warning |
| `restore.apply.cancelled` | `restore_apply_cancelled` | info |
| (없음) | **`restore_apply_pending`** | warning |
| `restore.apply.completed` | `restore_apply_success` | warning → **info** |
| `restore.apply.failed` | `restore_apply_failed` | error |
| (없음) | **`backup_metadata_cleared`** | info |

총 **8개 audit action** 모두 `noun_verb_result` 일관. STEP 80 (`orphan_remove_request_*`)과 같은 패턴. 향후 permission audit (`role_promote` / `role_demote`) / system 경고 등 확장 시 동일 convention 자연 적용.

---

## Regression Verification

| 영역 | 검증 결과 |
|---|---|
| Backup JSON file format | ✅ **0 byte 변경** (on-disk shape 무수정) |
| Restore validation 로직 (readBackupFile / validateV1ForImport / sanitizeImportedState) | ✅ 0줄 변경 |
| Restore import behavior (applyImportedBackup / window.location.reload) | ✅ 0줄 변경 |
| `PersistedState` / `validateV1` / `SCHEMA_VERSION` | ✅ 0줄 변경 |
| `BackupHealthRow` / `markBackupCompleted` / lastBackupAt 흐름 (STEP 59) | ✅ 0줄 변경 |
| `clearBackupMetadata` (STEP 59) | ✅ 0줄 변경 |
| `axvela.audit.v1` localStorage 키 / `audit-log-storage.ts` | ✅ 0줄 변경 |
| `SystemAuditEvent` type (STEP 65) | ✅ 0줄 변경 |
| `appendAuditEvent` action signature | ✅ 0줄 변경 |
| `AuditLogViewerDrawer` (STEP 65/78) | ✅ 0줄 변경 — action verbatim 표시 자연 호환 |
| STEP 78 audit drilldown (resolver / types / drawer) | ✅ 0줄 변경 — 새 action 자연 등장 |
| `ClickableMetric` / `OperationalDrilldownDrawer` (STEP 67) | ✅ 0줄 변경 |
| ImageCleanupDrawer / image-cleanup-api.ts (STEP 80) | ✅ 0줄 변경 |
| `/api/upload-image` (STEP 57) / `/api/delete-image` (STEP 61) / `/api/list-images` (STEP 62) | ✅ 0줄 변경 |
| `BackupSection` UI markup (button / status / BackupHealthRow) | ✅ 0줄 변경 — audit 호출 정련만 |
| `DocumentsDrawer` body | ✅ 0줄 변경 (BackupSection mount만 보존) |
| Sidebar (STEP 74 status drilldown) | ✅ 0줄 변경 |
| 3-Column 레이아웃 / Drawer / Modal primitive | ✅ 0줄 변경 |

---

## Affected Domains Verification

| 도메인 | 변경 |
|---|---|
| Reporting | **0줄** |
| Logistics | **0줄** |
| Documents Hub (drawer body) | **0줄** |
| Customer | **0줄** |
| Payment | **0줄** |
| Settlement | **0줄** |
| Tax | **0줄** |
| FX | **0줄** |
| AI Market Analysis | **0줄** |
| Image Cleanup (STEP 80) | **0줄** |
| Inquiry / Transaction / Invoice / Contract / Curation | **0줄** |
| 작품 TimelineEvent | **0줄** |
| artwork-scoped AuditLogDrawer | **0줄** |
| DetailPanel | **0줄** |
| Sidebar (STEP 74) | **0줄** |
| Drilldown system (resolver / drawer / types) | **0줄** |
| Persistence schema | **0줄** |
| 3-Column 레이아웃 | **0줄** |
| `package.json` | **0줄** |

---

## Validation

```
✓ npx tsc --noEmit              — 0 errors
✓ npx next lint                  — No ESLint warnings or errors
✓ npx next build                 — Route 144 kB / First Load 231 kB
```

---

## Forbidden Language Verification

```
$ grep -nE "legal archive|tamper-proof|forensic backup|guaranteed recovery|certified backup" \
    src/components/documents/BackupSection.tsx \
    src/lib/backup-restore.ts \
    src/store/useArtworkStore.ts

→ matches: 정책 주석 내부 forbidden list만 ("// - 금지: ...")
→ UI 텍스트 / message / metadata / aria-label / title 노출 0건
```

권장 표현 사용: "운영 로그" / "백업 기록" / "복원 기록" / "운영 참고" / "시스템 기록".

---

## Migration Note

실 사용자 device의 `axvela.audit.v1`에 STEP 65 시절 dotted notation audit (`backup.export.completed` / `restore.apply.completed` 등)이 잔존할 수 있음.
- STEP 78 viewer는 action verbatim mono 표시 → 두 명명이 함께 표시되어도 시각적 충돌 없음
- ActionBreakdownRow는 정확 일치 grouping이라 dotted와 snake가 별도 entry로 누적
- historical record로 자연 분리 — 향후 일괄 migration 옵션은 별도 STEP scope

---

## Manifesto Alignment

| Rule | 적용 |
|---|---|
| **rule_4 Trust Layer 정밀화** | 백업 / 복원 destructive-adjacent 운영 작업의 audit 명명 정밀화 + `restore_apply_pending` 신규로 *복원 시도 자체*가 reload 후 흔적 보존 |
| **rule_5 AI-Human Loop** | 모든 audit append는 명시적 사용자 행동 trigger / AI 자동 0건 |
| **rule_7 RBAC** | DocumentsDrawer 진입 `report.view_global` / resetAllData OWNER 가드 (STEP 27 그대로) |
| **rule_8 Timeline = Navigation 확장** | 8개 audit action이 STEP 78 ActionBreakdownRow에 누적 → audit_action drilldown 진입점 다양화 |
| **rule_14 Layout** | 3-Column 0줄 변경 |
| **rule_15 Max 3 buttons** | DocumentsDrawer footer 그대로 / BackupSection utility bar 무변경 |
| **rule_16 미니멀 디자인** | BackupSection markup / 색상 / typography 0줄 변경 — audit 호출 정련만 |
| **rule_17 Layer UI** | drawer 추가/제거 0건 |

---

## 다음 STEP 후보 3가지 (STEP 81 완료 시점)

### 🅰️ STEP 82 — Permission Change Audit
**Why now**: STEP 81로 backup/restore audit이 정착. 이제 STEP 78 ActionBreakdownRow + CategoryChipsRow의 `permission` chip이 미사용 — RoleSwitcher의 권한 전환이 audit 미기록 상태. 가장 작은 변경으로 governance coverage 마무리.
- `setCurrentRole(role)` 액션에 `category: "permission"`, `action: "role_promote"` / `role_demote`, severity `info`, metadata `{ from, to }` audit hook
- RoleSwitcher markup 0줄 변경 — store 액션 내부에서만
- 예상: useArtworkStore.ts ~20 LOC, Route 0~1 kB

### 🅲️ STEP 83 — Audit Event Export (CSV / JSON)
**Why now**: 8개 audit action이 누적되기 시작했지만 device 외부로 옮길 방법이 부재. STEP 25 Artwork Audit Export, STEP 44 Customer Export, STEP 51 Documents Export와 일관 패턴 — audit governance portability.
- 신규 `src/lib/audit-export.ts` (CSV UTF-8 BOM + RFC 4180 + JSON pretty)
- AuditLogViewerDrawer footer에 export button (rule_15: 닫기 + CSV + JSON 3개 한도 내)
- 현재 카테고리 / 단계 / 기간 필터 inherit (STEP 51 패턴)
- 예상: audit-export.ts ~280 LOC, Route +2 kB

### 🅳️ STEP 84 — System Health / Storage Capacity Audit
**Why now**: STEP 78 audit_category enum의 `system` 카테고리가 미사용. localStorage quota 임계 도달 / `axvela.audit.v1` MAX_AUDIT_EVENTS=500 trim 발생 / Vercel Blob env 부재 등 *시스템 신호*가 audit에 없음. governance가 사용자 행동 + 데이터 행동만 cover하고 인프라 신호는 빈 칸.
- `audit-log-storage.ts`의 cap trim 발생 시 `system_audit_capped` audit append
- 503 / quota / token 부재 등 graceful 케이스에 `system_*` audit append (BackupSection / ImageCleanupDrawer / list-images route 등)
- 예상: 다소 분산된 변경 — 신중한 scope 설계 필요. Route +1~2 kB

**추천 순서**: 🅰️ STEP 82 → 🅲️ STEP 83 → 🅳️ STEP 84.
STEP 82가 최소 변경으로 governance coverage를 완성하고, 그 후 export로 portability를 더하고, 마지막에 system 신호 통합이 자연스럽습니다.
