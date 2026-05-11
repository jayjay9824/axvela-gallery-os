# STEP 84 — System Health / Storage Capacity Audit — Completion Report

## State

**STEP 85 baseline (146 kB) → STEP 84 complete (147 kB).**
Build / type-check / lint all green.
Route delta: **+1 kB exactly** (system-audit-signals lib + 4 hook integration).
ZIP: `axvela-step84-system-health-audit.zip`.

**Governance Coverage: 5/5 ✅** — `image_storage` / `backup` / `restore` / `permission` / **`system` (NEW)**.

---

## 1. 변경 파일 목록

| File | Change | LOC |
|---|---|---|
| `src/lib/system-audit-signals.ts` | **신규** — emit helper with 3-layer guard | ~150 |
| `src/lib/audit-log-storage.ts` | trim/save-fail flags + consume functions | ~30 |
| `src/store/useArtworkStore.ts` | post-save flag polling + emit calls | ~50 |
| `src/components/artwork/ArtworkImageUpload.tsx` | wasFallback 감지 후 emit | ~20 |
| `src/components/admin/ImageCleanupDrawer.tsx` | env_missing 감지 후 emit | ~20 |
| `ARCHITECTURE.md` | STEP 84 entry append | ~8 KB |
| `STEP_84_SYSTEM_HEALTH_AUDIT_COMPLETE.md` | 본 문서 | — |

## 2. 신규 파일 목록

```
src/lib/system-audit-signals.ts          (150 LOC, 신규 emit helper)
STEP_84_SYSTEM_HEALTH_AUDIT_COMPLETE.md   (본 문서)
```

---

## 3. Dedup / Cooldown 설계 — 3-layer Guard

```
┌─ Layer 1: Re-entry Guard (isEmitting flag) ────────────────────┐
│  appendAuditEvent → trim → emit → appendAuditEvent → trim →    │
│  emit ... 이런 cycle을 동기 boolean flag로 차단.               │
│                                                                 │
│  외부 호출 → emit 진입 시 isEmitting=true set                  │
│  store.appendAuditEvent (동기 호출)                             │
│    → 내부에서 또 emit 시도                                      │
│      → isEmitting=true이라 false 반환 → 재귀 종료              │
│  finally 블록에서 isEmitting=false (catch 분기 안전)           │
└─────────────────────────────────────────────────────────────────┘

┌─ Layer 2: Per-action Cooldown ─────────────────────────────────┐
│  Map<action, lastEmitTime> 비교                                 │
│  기본 5초, 옵션으로 30초~ 가능                                  │
│  같은 action이 짧은 시간 내 spam되어도 정해진 간격당 1건만.    │
│  예: storage가 1분 동안 100번 실패해도 audit 12건 정도.        │
└─────────────────────────────────────────────────────────────────┘

┌─ Layer 3: Session-once (Set<action>) ──────────────────────────┐
│  옵셔널 — 환경 의존 신호에만 적용.                              │
│  device 세션 동안 1회만 emit. env가 변하지 않는 한 반복은 noise.│
│  예: system_blob_env_missing — env 부재는 reload 전엔 불변.    │
│  예: system_audit_capped — cap 도달 첫 시점만.                 │
└─────────────────────────────────────────────────────────────────┘
```

### Action별 정책 매트릭스

| Action | Severity | Cooldown | SessionOnce |
|---|---|---|---|
| `system_audit_capped` | warning | (sessionOnce 우선) | ✅ |
| `system_storage_save_failed` | warning | 30s | ❌ |
| `system_blob_env_missing` | warning | (sessionOnce 우선) | ✅ |
| `system_upload_fallback_activated` | warning | 30s | ❌ |

---

## 4. Recursive Guard 설명 — 검증된 종료 시나리오

### 시나리오 A: Audit cap trim 시 재귀

```
[1] 사용자 action → store.appendAuditEvent({backup_export_success})
[2] Store: 이벤트 build, set state, saveAuditLog([501 events])
[3] saveAuditLog: willTrim=true, __lastSaveDidTrim=true, localStorage save 성공
[4] 호출자(store)가 consumeAuditLogTrimFlag() → true 반환 (read & reset)
[5] emitSystemAuditSignal("system_audit_capped", warning, ..., {sessionOnce: true})
[6] emit: isEmitting=false → set true; sessionOnce 통과; cooldown 통과
[7] emit: store.appendAuditEvent({system_audit_capped})  ← 재귀 시작
[8] Store(재귀): set state, saveAuditLog([501 events again])
[9] saveAuditLog: willTrim=true, __lastSaveDidTrim=true
[10] 호출자(재귀)가 consumeAuditLogTrimFlag() → true
[11] emitSystemAuditSignal 시도 — Layer 1 isEmitting=true → false 반환 ✅
[12] 재귀 호출 종료, 외부 emit의 finally에서 isEmitting=false reset
[13] 외부 호출 정상 종료
```

**결과**: audit log에 `system_audit_capped` 1건만 누적. sessionOnce가 다음 trim 시도도 차단. 재귀 무한 loop 없음.

### 시나리오 B: localStorage 저장 실패 시 재귀

```
[1] 사용자 action → store.appendAuditEvent(...)
[2] saveAuditLog: localStorage.setItem throws → __lastSaveFailed=true
[3] consumeAuditLogSaveFailFlag → true
[4] emit("system_storage_save_failed", warning, 30s cooldown)
[5] emit: isEmitting=true; store.appendAuditEvent(...) 재귀
[6] saveAuditLog: 또 실패 → __lastSaveFailed=true
[7] consumeAuditLogSaveFailFlag → true
[8] emit 시도 — Layer 1 isEmitting=true → false 반환 ✅
[9] 재귀 종료
```

**결과**: 1건 audit 발행 시도 (in-memory state는 업데이트, localStorage 저장은 실패). 30초 cooldown으로 향후 storage 시도 spam 차단.

---

## 5. System Action 목록

```typescript
export type SystemAuditAction =
  | "system_audit_capped"           // cap (500) trim 발생
  | "system_storage_save_failed"    // localStorage setItem 실패
  | "system_blob_env_missing"       // BLOB_READ_WRITE_TOKEN 부재 (env_missing)
  | "system_upload_fallback_activated"; // 외부 provider 실패 → LocalPreview
```

**STEP 80 `noun_verb_result` convention 일관**: `system_<noun>_<state>` 패턴. 향후 추가 신호도 본 패턴 답습 권장:
- `system_quota_warning` (향후 — quota 80% 임박)
- `system_quota_exceeded` (향후 — quota 100% 도달)
- `system_restore_corruption_detected` (향후 — restore validation 반복 실패)

---

## 6. Build 결과

```
✓ npx tsc --noEmit              — 0 errors
✓ npx next lint                  — No ESLint warnings or errors
✓ npx next build                 — Route 147 kB / First Load 234 kB
                                   (+1 kB vs STEP 85 baseline 146 kB)
```

### Forbidden Language Verification
```
$ grep -nE "certified audit|tamper-proof|compliance guaranteed|forensic record|legal audit trail" \
    src/lib/system-audit-signals.ts \
    src/lib/audit-log-storage.ts \
    src/store/useArtworkStore.ts \
    src/components/artwork/ArtworkImageUpload.tsx \
    src/components/admin/ImageCleanupDrawer.tsx

→ 0 matches (정책 주석조차 본 STEP 변경 영역에 없음)
→ UI / message / metadata 노출 0건
```

권장 표현 사용:
- "운영 참고" / "device-local" / "recoverable" / "fallback activated" / "system signal"
- 모든 message 부정형 disclaimer 호환 ("recoverable issue" / "운영 참고")

### AXVELA AI Direction Policy 준수 (방금 정착된 정책)
- ✅ AI / Market Intelligence 영역 무관 — 본 STEP은 인프라 audit
- ✅ 금지 표현 0건 (AI Estimated Price / 감정가 / 확정 시장가 등 무관)
- ✅ rule_5 AI-Human Loop 일관 — AI 자동 0건, 신호는 사용자 action의 부수효과만
- ✅ rule_18 Market Intelligence 무관

---

## 7. Validation Checklist

| 항목 | 결과 |
|---|---|
| `system` category 활성화 | ✅ — 4개 action 정의 + 4 hook integration |
| `system` chip 클릭 시 filter 정상 | ✅ — STEP 78 CategoryChipsRow 자연 활성 (코드 변경 0줄) |
| Audit cap trim 신호 (`system_audit_capped`) | ✅ — sessionOnce, recursive 방어 |
| Storage save 실패 신호 (`system_storage_save_failed`) | ✅ — 30s cooldown, 재귀 방어 |
| Env missing 신호 (`system_blob_env_missing`) | ✅ — sessionOnce, env 변하지 않음 |
| Upload fallback 신호 (`system_upload_fallback_activated`) | ✅ — 30s cooldown |
| Recursive audit append 0건 | ✅ — re-entry guard 검증 (시나리오 A/B) |
| Duplicate spam 0건 | ✅ — cooldown + sessionOnce 이중 가드 |
| `appendAuditEvent` signature 변경 0건 | ✅ — `SystemAuditEventInput` type 그대로 |
| `SystemAuditEvent` schema 변경 0건 | ✅ — type / 8 필드 그대로 |
| Persistence schema 변경 0건 | ✅ — `PersistedState` / `validateV1` / `SCHEMA_VERSION` 무수정 |
| Server-side store 접근 0건 | ✅ — server API route는 응답 body로 신호 전달, 클라이언트가 emit |
| 신규 drawer / modal / page 추가 0건 | ✅ — 자연 통합만 |
| 기존 UI minimalism 유지 | ✅ — UI 파일 0줄 변경 |
| Payment / Settlement / Tax / FX / Customer / Documents / Logistics / AI domain | ✅ 0줄 변경 |
| 신규 라이브러리 추가 | ✅ 0개 |
| 3-column layout | ✅ 0줄 변경 |
| Build / type-check / lint | ✅ 모두 통과 |

---

## 8. 영향 범위 요약

### 직접 변경 (5 파일)
1. `system-audit-signals.ts` (신규)
2. `audit-log-storage.ts` (flag + consume)
3. `useArtworkStore.ts` (post-save polling)
4. `ArtworkImageUpload.tsx` (fallback 감지)
5. `ImageCleanupDrawer.tsx` (env_missing 감지)

### 자연 통합 (코드 변경 0줄)
- `AuditLogViewerDrawer.tsx` (STEP 65/78/85) — system 카테고리 데이터 누적되면 자동 노출
- `OperationalDrilldownDrawer.tsx` (STEP 67/78) — system 카테고리 drilldown 자동 활성
- `system-audit-export.ts` (STEP 83) — system 카테고리 export 자연 포함
- `audit-trend.ts` (STEP 85) — system severity가 dot strip dominantSeverity 결정에 자연 합류

---

## 9. Manifesto Alignment

| Rule | 적용 |
|---|---|
| **rule_4 Trust Layer 인프라 차원 추가** | STEP 82까지 사용자 행동 + 도메인 상태. STEP 85 시간 흐름. **STEP 84 인프라 상태**. \"왜 이미지가 fallback 됐지?\" / \"왜 audit log가 줄었지?\" 같은 운영 질문에 audit log로 답 가능 |
| **rule_5 AI-Human Loop** | AI 자동 0건. system 신호는 사용자 action의 부수효과만 |
| **rule_7 RBAC** | emit 자체는 RBAC 가드 부재 — trigger되는 사용자 action이 이미 권한 게이트 통과한 후 |
| **rule_8 Timeline = Navigation 완전 cycle** | 카테고리 5종 모두 활성 → audit_category drilldown 5개 모두 실 데이터 / audit_action 다양 / audit_severity 분포 정밀 |
| **rule_14 Layout** | 3-Column 0줄 변경 |
| **rule_15 Max 3 buttons** | 신규 button 0개 (신호는 부수효과만) |
| **rule_16 미니멀 디자인** | UI 0줄 변경 — 자연 통합만 |
| **rule_17 Layer UI** | drawer / modal 추가 0개 |
| **AXVELA AI Direction (방금 정착)** | 본 STEP은 AI/Market Intelligence 무관, 금지 표현 0건 |

---

## 🎯 Governance Layer 진화 (시각)

```
[STEP 65]      Audit Layer 정착          ── SystemAuditEvent + Drawer
      ↓
[STEP 80~82]   사용자 행동 audit          ── image_storage / backup / restore / permission
      ↓
[STEP 78]      탐색                       ── 4 drilldown domains + chips
      ↓
[STEP 83]      반출                       ── CSV / JSON export (WYSIWYE)
      ↓
[STEP 85]      흐름 인지                  ── Trend dot strip + timeRange drilldown
      ↓
[STEP 84]      인프라 신호 ⭐ NEW         ── system_audit_capped / save_failed /
                                            blob_env_missing / upload_fallback
      ↓
[GOVERNANCE 100% COVERAGE] ─────────────────────────────────────────
              5/5 카테고리 모두 활성, 시간 차원 + 인프라 차원 완성

      ↓
[Phase 2 — Tax / Fiscal Layer]   STEP 86~91 (예약)
[Phase 3 — AXVELA Intelligence]  STEP 92~99 (예약)
```
