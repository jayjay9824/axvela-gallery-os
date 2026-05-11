# STEP 65 — System-Level Audit Log Layer

> **목표**: artwork-linked TimelineEvent와 별개의 **system-level 운영 기록 layer** 정착.
> STEP 62 image cleanup이 sessionLog만 사용하던 한계 해결 — orphan blob 제거처럼
> artworkId가 정의상 부재한 운영 작업도 device-local 영속 기록 가능.
>
> **artwork TimelineEvent 거동 0줄 변경 · backup-restore validation 0줄 변경 · validateV1 / SCHEMA_VERSION 0줄**

---

## State

- **이전**: STEP 62 / Route 128 kB
- **이번**: STEP 65 / **Route 131 kB (+3 kB)**
- 신규 API endpoint 0건 (모두 client-side)
- Build ✅ · type-check ✅ · Lint ✅

---

## 핵심 설계 — 두 layer의 분리

| 차원 | TimelineEvent (기존) | SystemAuditEvent (STEP 65 신규) |
|---|---|---|
| **artworkId** | 필수 | **부재** (정의적 특성) |
| **대상** | 작품 lifecycle (state / 거래 / 결제 / inquiry / 문서) | system / admin 운영 (orphan / 백업 / 권한 / 시스템) |
| **Storage** | PersistedState (validateV1 / SCHEMA_VERSION) | 별도 localStorage `axvela.audit.v1` |
| **JSON Backup 포함** | ✅ | ❌ (device-specific 운영 기록) |
| **Viewer** | DetailPanel timeline + 작품별 AuditLogDrawer | "운영 로그" drawer (OWNER 전용) |
| **권한** | 도메인 액션 RBAC | OWNER 전용 (`audit.view`) |
| **분류 체계** | TimelineEventKind (6종) | category 5종 + severity 3종 |

이 분리로 **기존 artwork timeline 거동 0줄 변경**.

---

## Flow

```
[발생] STEP 62 ImageCleanupDrawer 사용자가 [제거 요청] 클릭
  ↓ requestRemoveBlob(pathname)
  ├─ ok → setSessionLog [OK] (즉시 UI 피드백)
  │       + appendAuditEvent({ category: "image_storage", action: "orphan.remove",
  │           severity: "info", targetType: "blob", targetRef: pathname,
  │           message: "...", metadata: { pathname, size, uploadedAt, provider } })
  └─ fail → setSessionLog [FAIL] + appendAuditEvent (severity: "error")
       
[저장] appendAuditEvent action
  ├─ id / createdAt / actorRole / actorLabel 자동 채움
  ├─ appendAuditEventToList(current, event) — 신규 우선 + cap (500)
  ├─ store: set({ auditEvents: nextList })
  └─ saveAuditLog(nextList) → localStorage `axvela.audit.v1` 즉시 반영

[조회] OWNER → Sidebar "운영 로그" → AuditLogViewerDrawer
  ├─ Summary 4 cards (전체 / 정보 / 주의 / 오류 — emphasize 분기)
  ├─ FilterRow (category 6옵션 / severity 4옵션 + "운영 로그 비움" 버튼)
  └─ AuditEventRow list (severity dot + category + message + relative time)
        ↓ metadata 있는 row 클릭 → expanded JSON pre

[비움] OWNER가 "운영 로그 비움" 클릭
  ├─ window.confirm 7줄 한국어 (영향 명시 + device-local 한정)
  └─ clearAuditEvents action
        ├─ OWNER RBAC 가드 (silent no-op if 부족)
        ├─ clearAuditLogStorage() → localStorage 키 자체 제거
        └─ "audit.clear" 자기참조 entry 1개 추가 (transparent)
```

---

## 변경 / 신규 파일

### 신규 (4 + doc)

| 파일 | LOC | 역할 |
|---|---|---|
| `src/types/audit-event.ts` | ~80 | SystemAuditEvent + AuditCategory + AuditSeverity 타입 / 라벨 / cap |
| `src/lib/audit-log-storage.ts` | ~150 | 별도 localStorage adapter + FIFO trim + shape 검증 |
| `src/components/admin/AuditLogViewerDrawer.tsx` | ~470 | OWNER 전용 viewer + 필터 + clear |
| `STEP_65_SYSTEM_AUDIT_LAYER.md` | (이 문서) | 완료 보고 |

### 변경 (5 + ARCHITECTURE.md)

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/types/role.ts` | ~3 LOC | `audit.view` permission → OWNER |
| `src/store/useArtworkStore.ts` | ~140 LOC | SystemAuditLogRequest / auditEvents slice / 4 actions + open/close + hydrate |
| `src/components/PersistenceProvider.tsx` | 4 LOC | mount 시 hydrateAuditEvents 호출 |
| `src/components/admin/ImageCleanupDrawer.tsx` | ~50 LOC | appendAuditEvent 통합 (orphan remove 성공/실패 모두) |
| `src/components/layout/Sidebar.tsx` | ~25 LOC | "운영 로그" SECONDARY 메뉴 |
| `src/app/page.tsx` | 2 LOC | `<AuditLogViewerDrawer />` mount |

---

## Audit Model

### 타입 정의

```ts
// src/types/audit-event.ts

export type AuditCategory =
  | "image_storage"   // STEP 62 orphan cleanup
  | "backup"          // 향후: STEP 52 backup export
  | "restore"         // 향후: STEP 52 restore
  | "permission"      // 향후: role 변경 등
  | "system";         // 일반 system 이벤트 (audit.clear 등)

export type AuditSeverity = "info" | "warning" | "error";

export interface SystemAuditEvent {
  id: string;                              // "aud_..." 접두
  createdAt: string;                       // ISO datetime
  actorRole: Role;
  actorLabel: string;
  category: AuditCategory;
  action: string;                          // dotted notation
  severity: AuditSeverity;
  targetType?: string;                     // "blob" / "artwork" / 등
  targetRef?: string;                      // pathname / id 등
  message: string;                         // 한국어 한 줄
  metadata?: Record<string, unknown>;      // 자유 형식 보조 정보
}

export type SystemAuditEventInput = Omit<
  SystemAuditEvent,
  "id" | "createdAt" | "actorRole" | "actorLabel"
>;

export const MAX_AUDIT_EVENTS = 500;
```

### action naming convention

| action | category | severity 분기 |
|---|---|---|
| `orphan.remove` | image_storage | ok→info / fail→error |
| `audit.clear` | system | warning |
| `backup.export` (향후) | backup | info |
| `backup.import` (향후) | restore | info |

---

## Persistence / Schema Impact

**변경량: 0줄**

| 항목 | 영향 |
|---|---|
| `PersistedState` interface | 0줄 변경 |
| `validateV1` 함수 | 0줄 변경 |
| `SCHEMA_VERSION` | 0줄 변경 |
| `backup-restore.ts` | 0줄 변경 |
| JSON backup 파일 포맷 | 0줄 변경 (audit 미포함) |

**핵심 이유**: 별도 localStorage 키 `axvela.audit.v1` 분리 — STEP 59 backup-metadata 패턴 답습.

**부수 효과**: 다른 device로 backup 복원 시 새 device의 audit는 자연스럽게 비어있음 — *device-specific 운영 기록*이라는 정확한 의미론.

---

## Image Cleanup Integration

### Before (STEP 62)
```tsx
// drawer-scoped sessionLog만 — drawer 닫으면 reset
setSessionLog((prev) => [entry, ...prev]);
```

### After (STEP 65)
```tsx
// 즉시 UI 피드백 (sessionLog) + device-local 영속 (audit)
setSessionLog((prev) => [entry, ...prev]);
appendAuditEvent({
  category: "image_storage",
  action: "orphan.remove",
  severity: result.ok ? "info" : "error",
  targetType: "blob",
  targetRef: pathname,
  message: result.ok
    ? `orphan candidate 제거 요청 완료 — ${pathname}`
    : `orphan candidate 제거 요청 실패 — ${result.error.message}`,
  metadata: {
    pathname,
    size: blob.size,
    uploadedAt: blob.uploadedAt,
    provider: "vercel_blob",
    ...(result.ok ? {} : { errorStatus: result.error.status }),
  },
});
```

**두 layer 공존**:
- `sessionLog`: 즉시 UI 피드백 (drawer 안 운영자 화면)
- `auditEvents`: device-local 영속 운영 기록 (운영 로그 drawer로 조회)

---

## RBAC

| Permission | Min Role | 사용처 |
|---|---|---|
| `audit.view` | OWNER | Sidebar 메뉴 / drawer open / clearAuditEvents |
| `image.cleanup_review` | OWNER (STEP 62) | image cleanup → audit append은 부수효과 |

이중 가드:
- store action `openSystemAuditLog` / `clearAuditEvents` — 권한 부족 시 silent no-op
- drawer wrapper — UI에서 `isAllowed` 분기 (만약 store 우회 호출되어도 drawer 안 열림)

`appendAuditEvent`는 **자체 RBAC 가드 부재** — 호출하는 도메인 액션이 이미 권한 체크 통과한 후 부수효과로 audit 기록하는 패턴.

---

## 검증 매트릭스

### 사용자 spec 7개 검증 항목

| 항목 | 결과 |
|---|---|
| Data Model 정의 | ✅ 8 필수 + 2 옵셔널 + Input variant |
| Store actions | ✅ append / clear / getByCategory / getRecent + open/close + hydrate |
| Image cleanup 통합 | ✅ orphan remove 성공/실패 모두 append |
| UI 운영 로그 viewer | ✅ OWNER 전용 + category/severity 필터 + clear 보호 |
| 표현 정책 | ✅ 사용 가능 표현만 / 금지 표현 0건 |
| ARCHITECTURE.md | ✅ 두 layer 분리 정확 설명 |
| build / type-check / lint | ✅ Route 131 kB |

### 사용자 spec 6개 제약

| 제약 | 결과 |
|---|---|
| Payment / Settlement / Tax / FX / Customer / AI / Logistics / Documents | ✅ 0줄 |
| 3-column layout | ✅ 0줄 |
| 기존 artwork TimelineEvent 거동 | ✅ 0줄 (별개 SystemAuditEvent로 분리) |
| backup/restore validation | ✅ 0줄 |
| Persistence schema 변경 | ✅ 0줄 (별도 localStorage 키) |
| 신규 외부 라이브러리 | ✅ 0개 |

### 표현 정책

| 표현 | 결과 |
|---|---|
| "운영 로그" / "시스템 기록" / "운영 참고" / "storage event" / "cleanup request" / "orphan candidate" | ✅ 사용 |
| "legal audit" / "compliance guaranteed" / "permanent record" / "forensic proof" / "tamper-proof" | ✅ 0건 (정책 주석에서만 등장) |

---

## Affected Domains Verification

| 도메인 | 변경량 |
|---|---|
| Payment | **0줄** |
| Settlement | **0줄** |
| Tax | **0줄** |
| FX | **0줄** |
| Customer | **0줄** |
| AI Market Analysis | **0줄** |
| Logistics | **0줄** |
| Documents Hub | **0줄** |
| Inquiry / Transaction / Invoice / Contract / Curation | **0줄** |
| 작품 TimelineEvent type | **0줄** |
| artwork-scoped AuditLogDrawer | **0줄** |
| DetailPanel timeline | **0줄** |
| 3-Column 레이아웃 | **0줄** |
| backup-restore.ts | **0줄** |
| persistence.ts (validateV1 / SCHEMA_VERSION) | **0줄** |
| `/api/upload-image` / `/api/delete-image` / `/api/list-images` | **0줄** |

---

## Manifesto rule 정합성

| Rule | 영향 | 상태 |
|---|---|---|
| **rule_4** Trust Layer | **본 STEP의 핵심** — artwork-linked로 표현 불가능했던 system 운영 작업도 device-local 영속 기록 + clearAuditEvents 자기참조 transparent | ✅ **강화** |
| **rule_7** RBAC | audit.view OWNER 전용 + 이중 가드 | ✅ 강화 |
| **rule_8** Timeline = Navigation | system audit는 별도 viewer (artwork-scoped TimelineEvent와 분리) | ✅ 보존 |
| **rule_14** 3-Column | 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | drawer footer "닫기" 1개 + filter row "운영 로그 비움" 1개 (확인 보호) | ✅ 보존 |
| **rule_16** 미니멀 디자인 | text-first / 작은 typography / severity 톤 분기 / 그림자 0 / 그래프 0 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | drawer 안에서만 처리 | ✅ 보존 |
| **rule_21** governance | 53 추상화 → 57 실 연결 → 61 lifecycle → 62 admin → **65 audit governance** | ✅ **운영 단계 심화** |

---

## 시나리오

### 시나리오 1: orphan 제거 → audit 누적

```
OWNER: "이미지 정리" → drawer → orphan 3건 → [제거 요청] 클릭
  ↓ confirm → 외부 host del() → 200 OK
  ↓ 즉시 sessionLog [OK] artworks/lz3xj4-a8f2k1.jpg
  ↓ appendAuditEvent (image_storage / orphan.remove / info)
auditEvents 배열에 추가 + localStorage 즉시 저장
```

### 시나리오 2: 운영 로그 조회

```
OWNER: Sidebar "운영 로그" → drawer
  Summary: 전체 47건 · 정보 42 · 주의 1 · 오류 4 (red emphasis)
  Filter: category="image_storage" + severity="error" 선택
  → 필터된 4건만 표시 (red dot + truncated message + relative time)
  Row 클릭 → metadata expanded (pathname / size / uploadedAt / errorStatus 502)
```

### 시나리오 3: 운영 로그 비움 (OWNER 전용)

```
OWNER: drawer → [운영 로그 비움]
  → confirm 7줄 dialog (device-local 한정 명시)
  → 확인
  → clearAuditEvents:
      ├─ localStorage `axvela.audit.v1` 키 제거
      └─ "audit.clear" 자기참조 entry 추가 (warning severity)
  → drawer 즉시 갱신: 1건 (audit.clear) 표시 — transparent 기록
```

### 시나리오 4: STAFF / MANAGER 접근 시도

```
STAFF: Sidebar "운영 로그" disabled (회색) + tooltip "Owner 권한 필요"
  ↓ 클릭 불가
(만약 store action 호출되더라도 RBAC 가드로 silent no-op — 이중 가드)
```

### 시나리오 5: JSON backup 복원 후 audit 거동

```
[Device A] orphan 5개 제거 → audit 5개 누적
[Device A] BackupSection → JSON backup 다운로드 (audit 미포함)
[Device B] BackupSection → import JSON
  → PersistedState만 복원 (artwork / customer / 거래 등 도메인)
  → audit (별도 키)는 영향 없음 → device B 자체의 audit만 표시
  → device A의 운영 흔적은 device A에만 남음 (정확한 의미론)
```

---

## 다음 STEP 후보

```
STEP 60  Documents Hub 후속 — 개별 PDF ZIP / 추가 필터
STEP 63  Image cleanup pagination UI (HARD_LIMIT 분할)
STEP 66  Audit auto-emission 확대 — backup export / restore / role 변경 시 자동 audit
STEP 67  Audit export — JSON / CSV (운영 보고용)
STEP 68  Progressive image loading — DETAIL_HERO_PREVIEW preset 활용
```

---

## 결과 요약

- 신규 파일 4개 (types + lib + drawer + doc, 총 ~700 LOC)
- 수정 파일 6개 (role + store + provider + ImageCleanup + Sidebar + page)
- 0 신규 외부 라이브러리
- Persistence schema **0줄 변경** (별도 localStorage 키 분리)
- 기존 artwork TimelineEvent 거동 **0줄 변경**
- backup-restore validation **0줄 변경**
- 5개 카테고리 + 3개 severity 분류
- MAX_AUDIT_EVENTS=500 cap + FIFO trim (~150KB max)
- OWNER 전용 RBAC 이중 가드
- ImageCleanupDrawer에 appendAuditEvent 통합 (sessionLog와 공존)
- "운영 로그" drawer — Summary + Filter + List + Clear (확인 보호)
- 표현 정책 모두 준수 (정책 주석에서만 등장)
- Route +3 kB (128 → 131 kB)

**STEP 65 완료. rule_4 Trust Layer 강화 — system-level 운영 governance 정착.**
