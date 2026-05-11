# STEP 82 — Permission Change Audit — Completion Report

## State

**STEP 81 baseline (144 kB) → STEP 82 complete (144 kB).**
Build / type-check / lint all green.
Route delta: **+0 kB** (audit hook 매우 경량, 신규 UI 컴포넌트 0개).
ZIP: `axvela-step82-permission-audit.zip`.

---

## Flow

```
RoleSwitcher 메뉴 항목 클릭
  → setCurrentRole(role)
       ├ if (fromRole === role) → set만 (idempotent guard, audit 0건)
       └ else:
            previousLevel = ROLE_RANK[fromRole]
            nextLevel = ROLE_RANK[role]
            action 분기:
              ├ nextLevel > previousLevel → "role_promote"
              ├ nextLevel < previousLevel → "role_demote"
              └ nextLevel === previousLevel → "role_switch"   ← 향후 4번째 role 추가 시 활성
            appendAuditEvent({
              category: "permission",
              action,
              severity: "info",
              targetType: "role",
              targetRef: <new role>,
              message: "권한 변경 — {fromKR} → {toKR}",
              metadata: { fromRole, toRole, previousLevel, nextLevel,
                          deviceLocal: true, changedAt }
            })            ← actor = OLD role (RBAC convention: 누가 변경을 초래했는가)
            set({ currentRole: role })
                          ↓
            axvela.audit.v1 (별도 키) 영속
                          ↓
            AuditLogViewerDrawer / STEP 78 audit drilldown 자연 등장
              ├ CategoryChipsRow `permission` chip 활성화 (이전 항상 0건 disabled)
              ├ ActionBreakdownRow top 5에 role_promote / role_demote 합류
              └ audit_severity info card 카운트에 합류
```

---

## Role Level Mapping

```
STAFF   = 1     ← 일상 운영 (작품 / 문의 / 배송 / 컨디션 리포트)
MANAGER = 2     ← 운영 매니저 (Reporting / Documents / Logistics 통합 view)
OWNER   = 3     ← 대표 (image cleanup / audit / system reset / settlement.complete)
```

`src/lib/rbac.ts`의 `ROLE_RANK`를 단일 source of truth로 사용 — STEP 82에서 visibility를 `const` → `export const`로 격상 (다른 helper 0줄 변경).

---

## New / Changed Files

### Modified (2)
1. **`src/lib/rbac.ts`** (2 LOC)
   - `ROLE_RANK` const → **export const**
   - JSDoc 갱신 ("STEP 82 — store가 setCurrentRole 시 audit metadata 채우기 위해 export")
   - 다른 모든 helper (`hasPermission` / `requiredRole` / `ROLE_LABEL` / `ROLE_LABEL_KR` / `ROLE_DESCRIPTION_KR` / `actorLabel`) **0줄 변경**
   - RBAC 검사 로직 **무영향**

2. **`src/store/useArtworkStore.ts`** (~50 LOC 추가)
   - rbac import 라인에 `ROLE_RANK` + `ROLE_LABEL_KR` 추가
   - `setCurrentRole` 액션 — single line `(role) => set({ currentRole: role })` → audit hook 포함 형태로 확장
   - Idempotent 가드 (`if (fromRole === role)`) — 같은 role 재선택 audit 0건
   - 3분기 action 결정 (`role_promote` / `role_demote` / `role_switch`)
   - appendAuditEvent **before** set (RBAC convention: actor = 이전 role)
   - 다른 모든 store action / state slice **0줄 변경**

### Added (2)
3. **`STEP_82_PERMISSION_AUDIT_COMPLETE.md`** — 본 문서
4. **`ARCHITECTURE.md`** — STEP 82 entry append (~10 KB)

### Untouched (md5 hash 검증)
- `src/components/layout/RoleSwitcher.tsx` — md5 `3ad354a698cef5c8a692ee193f93a372` 그대로
- `src/components/layout/Sidebar.tsx` — md5 `d21f97a35784715f1dd92907c5b20786` 그대로
- `src/lib/persistence.ts` — md5 `76e4c2cf7184ba2f45d028f8a786737b` 그대로 (currentRole은 PersistedState에 부재 — session-only)
- `src/types/role.ts` — md5 `d023264330f6874f3b3e82e1a42a580a` 그대로
- `src/types/audit-event.ts` — 0줄 변경 (SystemAuditEvent type / 8 필드 그대로)
- ACTION_MIN_ROLE / hasPermission / requiredRole — 0줄 변경 (RBAC 검사 로직 무영향)

---

## Route Size Delta

```
Before STEP 82:  / 144 kB / 231 kB First Load JS
After  STEP 82:  / 144 kB / 231 kB First Load JS
                 +0 kB (audit hook ~25 LOC + 1 import line)
```

Build pipeline:
```
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (7/7)
✓ No ESLint warnings or errors
```

---

## Audit Event Behavior

### 3-action 분기 매트릭스

| 전환 | previousLevel | nextLevel | action | severity |
|---|---|---|---|---|
| STAFF → MANAGER | 1 | 2 | `role_promote` | info |
| STAFF → OWNER | 1 | 3 | `role_promote` | info |
| MANAGER → OWNER | 2 | 3 | `role_promote` | info |
| OWNER → MANAGER | 3 | 2 | `role_demote` | info |
| OWNER → STAFF | 3 | 1 | `role_demote` | info |
| MANAGER → STAFF | 2 | 1 | `role_demote` | info |
| 같은 role 재선택 | n | n | (audit 0건 — idempotent guard) | — |
| 동일 level 다른 role | n | n | `role_switch` | info |

`role_switch`는 현 3-role 환경에서는 사실상 발생 불가 — 향후 4번째 role이 동일 level에 추가되거나 (예: STAFF level에 "INTERN" 추가) Permission union이 확장될 때 자연 활성. 사용자 spec "if same level or cannot determine" 정확 매칭.

### Metadata 정확 매칭 (사용자 spec)

```typescript
{
  fromRole: "MANAGER",        // 이전 role
  toRole: "OWNER",            // 새 role
  previousLevel: 2,           // ROLE_RANK[fromRole]
  nextLevel: 3,               // ROLE_RANK[toRole]
  deviceLocal: true,          // device-local audit 정책 transparent 노출
  changedAt: "2026-05-04T..." // ISO timestamp
}
```

추가 필드:
- `targetType: "role"` — STEP 78 audit drilldown 표 "대상" 컬럼 노출용
- `targetRef: <new role>` — 동일 컬럼의 식별자
- `message: "권한 변경 — {fromKR} → {toKR}"` — `ROLE_LABEL_KR` 매핑 ("직원" / "매니저" / "대표")

### 순서 정책 — append BEFORE set

```typescript
// audit append 시점:
//   appendAuditEvent → state.currentRole 읽기 → actorRole = OLD role
//   set({ currentRole: role }) → 이후 모든 호출은 NEW role 사용
//
// RBAC convention: "X (with permission Y) performed action Z"
//   → actor는 변경을 *초래한* 이전 role
//   → audit 본문 "권한 변경 — 매니저 → 대표"의 actor도 매니저 (변경 직전)
```

이 순서를 뒤집으면 actorRole = NEW role이 되어 \"대표가 자기 자신을 대표로 승급함\" 같은 의미 혼동 발생. 의도적 회피.

---

## Audit Category / Action Visibility

### STEP 78 통합 효과 (자동 활성)

| Drilldown 진입점 | 변화 |
|---|---|
| `CategoryChipsRow` `permission` chip | 이전: 항상 0건 disabled (enum만 정의) → STEP 82 후: 실 데이터 누적 시 enabled, 클릭으로 audit_category drilldown 진입 |
| `ActionBreakdownRow` top 5 | `role_promote` / `role_demote`가 누적 빈도 따라 등장 — count desc → action asc 결정성 정렬 |
| `audit_severity` info card | `role_*` 이벤트가 info 카운트에 합류 (image_storage / backup audit과 함께) |
| `audit_events` 전체 list | 권한 변경 entry가 시간 순서로 다른 도메인 entry와 interleave |
| Drilldown row | `extractAuditArtworkRef` 검사 → metadata.artworkId / targetType="artwork" 둘 다 미해당 → row visible but **non-clickable** (rule_1 일관 — permission은 작품 무관 system 활동) |

### 5-카테고리 governance coverage 달성

| AuditCategory | 활성 STEP | 상태 |
|---|---|---|
| `image_storage` | STEP 80 | ✅ orphan_remove_request_* |
| `backup` | STEP 81 | ✅ backup_export_* / backup_metadata_cleared |
| `restore` | STEP 81 | ✅ restore_apply_* / restore_read_failed |
| `permission` | **STEP 82** | ✅ **role_promote / role_demote / role_switch** |
| `system` | (미사용) | 향후 STEP 84 system health audit |

**5종 중 4종 활성** — `system`만 빈 칸. STEP 78 `CategoryChipsRow`의 5 chip이 데이터 누적 후 4개 활성 + system 1개는 향후.

---

## Regression Verification

| 영역 | 검증 결과 |
|---|---|
| RoleSwitcher UI markup / handleSelect / 시각 | ✅ md5 검증 — 0줄 변경 |
| Sidebar | ✅ md5 검증 — 0줄 변경 |
| `src/types/role.ts` (Role union / Permission union / ACTION_MIN_ROLE) | ✅ md5 검증 — 0줄 변경 |
| `src/lib/persistence.ts` (PersistedState / validateV1 / SCHEMA_VERSION) | ✅ md5 검증 — 0줄 변경 (currentRole은 session-only) |
| `hasPermission` / `requiredRole` 검사 로직 | ✅ rbac.ts에서 `ROLE_RANK` export visibility만 변경, 함수 본체 0줄 |
| RBAC 가드 (store action 안의 hasPermission 호출) | ✅ 모두 무수정 — STEP 82는 RBAC을 *기록*만 추가 |
| SystemAuditEvent type / appendAuditEvent action signature | ✅ 0줄 변경 |
| `audit-event.ts` / `audit-log-storage.ts` | ✅ 0줄 변경 |
| AuditLogViewerDrawer (STEP 65/78) | ✅ 0줄 변경 — viewer는 신규 UI 추가 0건, audit event 누적이 자연 등장 |
| STEP 78 audit drilldown (resolver / types / drawer / ClickableMetric) | ✅ 0줄 변경 |
| ImageCleanupDrawer (STEP 80) / BackupSection (STEP 81) | ✅ 0줄 변경 |
| `/api/upload-image` / `/api/delete-image` / `/api/list-images` | ✅ 0줄 변경 |
| Persistence schema (`PersistedState` / `validateV1` / `SCHEMA_VERSION`) | ✅ 0줄 변경 |
| Drawer / Modal primitive | ✅ 0줄 변경 |
| 3-Column 레이아웃 | ✅ 0줄 변경 |

### Hydrate / Restore spurious audit 검증

`currentRole`은 **session-only** (PersistedState에 부재):
- 새로고침 → MANAGER 기본값 fresh start, hydrate가 setCurrentRole 호출 0건 → spurious audit 0건
- Backup 복원 → applyImportedBackup → window.location.reload() → MANAGER 기본값 fresh start → spurious audit 0건
- resetAllData → currentRole 슬라이스를 set에서 제외 → 변경 0건 → spurious audit 0건

---

## Affected Domains Verification

| 도메인 | 변경 |
|---|---|
| Reporting | **0줄** |
| Logistics | **0줄** |
| Documents Hub | **0줄** |
| Customer | **0줄** |
| Payment | **0줄** |
| Settlement | **0줄** |
| Tax | **0줄** |
| FX | **0줄** |
| AI Market Analysis | **0줄** |
| Image Cleanup (STEP 80) | **0줄** |
| Backup-Restore (STEP 81) | **0줄** |
| Inquiry / Transaction / Invoice / Contract / Curation | **0줄** |
| 작품 TimelineEvent | **0줄** |
| artwork-scoped AuditLogDrawer | **0줄** |
| DetailPanel | **0줄** |
| Sidebar (STEP 74) | **0줄** |
| RoleSwitcher | **0줄** |
| 3-Column 레이아웃 | **0줄** |
| `package.json` | **0줄** |

---

## Validation

```
✓ npx tsc --noEmit              — 0 errors
✓ npx next lint                  — No ESLint warnings or errors
✓ npx next build                 — Route 144 kB / First Load 231 kB (+0 kB delta)
```

---

## Forbidden Language Verification

```
$ grep -nE "legal audit|certified permission|tamper-proof|compliance guaranteed|forensic record" \
    src/store/useArtworkStore.ts src/lib/rbac.ts

→ matches: 0건 (정책 주석 forbidden list조차 본 STEP 변경 영역에 등장 안 함)
→ UI 텍스트 / message / metadata 노출 0건
```

권장 표현 사용:
- "권한 변경 — {fromKR} → {toKR}" (audit message)
- "권한 기록" / "운영 로그" / "시스템 기록" / "운영 참고" / "권한 변경" — ARCHITECTURE.md 및 코드 주석에서 사용

---

## Manifesto Alignment

| Rule | 적용 |
|---|---|
| **rule_1 Artwork-First** | permission 변경은 작품 무관 system 활동 — STEP 78 drilldown row visible but non-clickable (extractAuditArtworkRef 둘 다 미해당) |
| **rule_4 Trust Layer 완성** | device-local audit governance가 image (STEP 80) + backup (STEP 81) + restore (STEP 81) + **permission (STEP 82)** 4종 cover. 5-카테고리 중 system 1종만 향후 |
| **rule_5 AI-Human Loop** | AI 자동 0건 / 모든 audit는 사용자 명시 클릭 (RoleSwitcher 메뉴) trigger |
| **rule_7 RBAC 보존** | ACTION_MIN_ROLE / hasPermission / requiredRole 0줄 변경 — STEP 82는 RBAC을 *기록*만, 검사 흐름 무영향 |
| **rule_8 Timeline = Navigation 완전 cycle** | Sidebar (74) / Reporting (67/70) / Logistics (67) / Documents (72/76) / Customer (73) / ImageCleanup (67) / Audit Log (78) → governance 5종 카테고리 중 4종 활성, system은 향후 |
| **rule_14 Layout** | 3-Column 0줄 변경 |
| **rule_15 Max 3 buttons** | 추가 버튼 0개 |
| **rule_16 미니멀 디자인** | UI 시각 0줄 변경 — audit hook은 전적으로 store 내부 |
| **rule_17 Layer UI** | Modal / Drawer 추가 0개 |
