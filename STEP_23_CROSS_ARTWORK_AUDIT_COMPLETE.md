# STEP 23 — Cross-artwork Audit View (완료)

STEP 20에서 만든 단일 작품 audit log + STEP 21 navigation을 보존한 채,
Owner / Manager 전용 **갤러리 전체 감사 view**를 별도 진입점으로 추가.

> rule_4 trust layer 확장 · rule_7 RBAC fine-grain · rule_8 navigation 재사용.

핵심 결정:
- **별개 store 슬라이스** `globalAuditRequest` — `auditLogRequest`(단일 작품)와 독립.
- **별개 권한** `audit.view_global` (MANAGER 이상). Staff는 단일 작품 audit만 접근.
- **AuditEventCard 추출** — 두 drawer가 공유. `artworkLabel?` optional prop으로 cross-artwork rib 표시.
- **Drawer width 옵션화** — `widthClass?` prop 추가 (기본 `w-[480px]`). GlobalAuditDrawer는 `w-[800px]`. 다른 호출자 0줄 변경.
- **3-column 레이아웃 무변경** — Sidebar에 entry만 추가, Drawer overlay 1개 추가.
- **자동 컨텍스트 전환** — 다른 작품 이벤트 카드 클릭 시 `select(artworkId)` 호출. cross-artwork 드릴다운이 매끄럽게 이어짐.

---

## 1. 현재 코드 분석

| 항목 | 진입 시점 | 비고 |
|---|---|---|
| Audit Log (단일 작품) | ✅ STEP 20 + 21 완성 | navigation 포함, 5축 분류 |
| Cross-artwork view | ❌ 부재 | rule_4 trust layer의 시스템 전체 감사 누락 |
| AuditEventCard | private function | 외부에서 재사용 불가 |
| 권한 매트릭스 | 30개 permission | audit 전역 접근 권한 부재 |
| Drawer width | hardcoded 480px | 데이터 밀도 높은 view에 부적합 |
| Sidebar | Workspace / Operations / 승인 대기 | audit 진입점 부재 |

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/types/role.ts` | `audit.view_global` permission 추가 (MANAGER min) |
| `src/store/useArtworkStore.ts` | `GlobalAuditRequest` 타입 + 슬라이스 + `openGlobalAudit` / `closeGlobalAudit` 액션. RBAC 가드 포함. |
| `src/components/ui/Drawer.tsx` | optional `widthClass?` prop 추가 (기본 `w-[480px]`). 기존 호출자 0줄 변경. |
| `src/components/audit/AuditLogDrawer.tsx` | AuditEventCard + 모든 visual primitive를 외부 모듈로 이동 (사용 동작 그대로). 768 → 357 LOC. |
| `src/components/layout/Sidebar.tsx` | "전체 감사 로그" 진입점 추가 + AuditIcon. RBAC: 권한 부족 시 disabled + permissionHint. |
| `src/app/page.tsx` | `GlobalAuditDrawer` import + mount. |
| `ARCHITECTURE.md` | STEP 23 changelog 추가 |

---

## 3. 신규 파일 목록

| 파일 | 역할 |
|---|---|
| `src/components/audit/AuditEventCard.tsx` | AuditLogDrawer + GlobalAuditDrawer가 공유하는 카드 컴포넌트 + visual primitive (DomainBadge / VersionPill / ActorPill / EmphasisIcon 등). `artworkLabel?` prop으로 cross-artwork rib 지원. |
| `src/components/audit/GlobalAuditDrawer.tsx` | Cross-artwork audit view drawer. 4축 필터(작품/도메인/작성자/권한) + 카드 리스트 + 자동 컨텍스트 전환. |
| `STEP_23_CROSS_ARTWORK_AUDIT_COMPLETE.md` | 본 문서 |

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/types/artwork.ts` (TimelineEvent) | STEP 21에서 확장됨 — 추가 변경 불필요 |
| `src/lib/audit-helpers.ts` | 분류 / 필터 함수 그대로 재사용 |
| `src/lib/audit-navigation.ts` | resolveAuditEventTarget 그대로 재사용 |
| `src/lib/rbac.ts` | permissionHint은 ROLE_LABEL × ACTION_MIN_ROLE 기반이라 자동 작동 |
| 모든 도메인 store action / 도메인 타입 | 0줄 변경 |
| `mock-data.ts` | 0줄 변경 — 기존 seed timeline이 그대로 cross-artwork view에 노출됨 |
| Money Flow / Contract / Invoice / Tax / Settlement / Logistics 도메인 로직 | rule_3 / rule_4 / rule_11 — 무변경 |
| 3-column 레이아웃 (`page.tsx` 본문 / `ArtworkGrid` / `DetailPanel`) | rule_14 — 무변경 |
| 기존 Drawer 호출자 (Contract / Invoice / Settlement / 등 12개) | `widthClass?` 옵션이라 호출 시그니처 무영향 |

---

## 5. 핵심 코드

### 5.1 권한 추가 (`src/types/role.ts`)

```ts
export type Permission =
  // ... 기존 ...
  | "inquiry.send_response"
  // STEP 23 — Cross-artwork Audit View (rule_4 trust layer 확장)
  | "audit.view_global";

export const ACTION_MIN_ROLE: Record<Permission, Role> = {
  // ...
  // STEP 23 — 갤러리 전체 감사 로그. Staff는 단일 작품 audit만 접근 가능,
  // 시스템 전체 감사는 Manager 이상 (rule_7).
  "audit.view_global":         "MANAGER",
};
```

### 5.2 Store 슬라이스 (`src/store/useArtworkStore.ts`)

```ts
export type GlobalAuditRequest =
  | { kind: "closed" }
  | { kind: "open" };

// State
globalAuditRequest: GlobalAuditRequest;

// Actions — RBAC 가드 (rule_7) — 권한 부족 시 silent no-op
openGlobalAudit: () => {
  const state = get();
  if (!hasPermission(state.currentRole, "audit.view_global")) return;
  set({ globalAuditRequest: { kind: "open" } });
},
closeGlobalAudit: () => set({ globalAuditRequest: { kind: "closed" } }),
```

### 5.3 GlobalAuditDrawer 핵심 로직

**4축 필터 + 시간순 집계:**

```tsx
const allClassified = React.useMemo(() => {
  const out: Array<{ classified, artwork, eventAt: number }> = [];
  for (const artwork of artworks) {
    const list = timeline[artwork.id] ?? [];
    for (const event of list) {
      out.push({
        classified: classifyAuditEvent(event),
        artwork,
        eventAt: new Date(event.at).getTime(),
      });
    }
  }
  out.sort((a, b) => b.eventAt - a.eventAt);  // DESC
  return out.map(({ classified, artwork }) => ({ classified, artwork }));
}, [artworks, timeline]);

const filtered = React.useMemo(() => {
  return allClassified.filter(({ classified }) => {
    if (artworkFilter !== "ALL" && classified.event.artworkId !== artworkFilter) return false;
    if (domainFilter !== "ALL" && classified.domain !== domainFilter) return false;
    if (actorFilter !== "ALL") {
      if (actorFilter === "AI" && classified.actorType !== "AI") return false;
      if (actorFilter === "SYSTEM" && classified.actorType !== "SYSTEM") return false;
      if (actorFilter === "HUMAN" && !isHumanActorType(classified.actorType)) return false;
    }
    if (roleFilter !== "ALL" && classified.event.actorRole !== roleFilter) return false;
    return true;
  });
}, [allClassified, artworkFilter, domainFilter, actorFilter, roleFilter]);
```

**Dispatch with 자동 컨텍스트 전환:**

```tsx
const dispatchTarget = React.useCallback(
  (target: AuditTarget, artworkId: string) => {
    closeGlobalAudit();
    if (artworkId) select(artworkId);  // ← STEP 23 신규: cross-artwork 점프 시 컨텍스트 동기화
    switch (target.kind) {
      case "contract":         openContractDetail(target.id); break;
      case "curation":         openCurationDraft(target.artworkId); break;
      case "invoice":          openInvoiceDetail(target.id); break;
      case "settlement":       openSettlementDetail(target.id); break;
      case "tax":              openTaxDetail(target.id); break;
      case "logistics":        openLogisticsDetail(target.id); break;
      case "conditionReport":  openConditionReportEdit(target.id); break;
      case "inquiry":          openInquiryDetail(target.id); break;
      case "inquiryResponse":  openInquiryResponse(target.id); break;
    }
  },
  [/* deps */]
);
```

**권한 가드 (defensive):**

```tsx
React.useEffect(() => {
  if (globalAuditRequest.kind === "open" && !isAllowed) {
    closeGlobalAudit();
  }
}, [globalAuditRequest.kind, isAllowed, closeGlobalAudit]);
```

### 5.4 AuditEventCard의 cross-artwork rib

```tsx
{artworkLabel && (
  <div className="mb-2 -mt-0.5">
    <span className="text-[10.5px] tracking-tightish text-ink-subtle font-medium">
      {artworkLabel}
    </span>
  </div>
)}
```

### 5.5 Sidebar 진입점 (RBAC + 시각 분리)

```tsx
const canViewGlobalAudit = hasPermission(currentRole, "audit.view_global");

<button
  type="button"
  onClick={canViewGlobalAudit ? openGlobalAudit : undefined}
  disabled={!canViewGlobalAudit}
  className={cn(
    canViewGlobalAudit
      ? "text-ink-muted hover:text-ink hover:bg-surface-muted cursor-pointer"
      : "text-ink-subtle cursor-not-allowed opacity-60"
  )}
  title={canViewGlobalAudit ? undefined : permissionHint("audit.view_global")}
>
  <span>전체 감사 로그</span>
  <span>{canViewGlobalAudit ? "갤러리 전체 이벤트" : permissionHint("audit.view_global")}</span>
</button>
```

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    60.8 kB         148 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 17 baseline | 54.5 kB | — |
| STEP 20 (Audit Log) | 57.2 kB | +2.7 |
| STEP 21 (Audit Navigation) | 59.0 kB | +1.8 |
| **STEP 23 (Cross-artwork Audit)** | **60.8 kB** | **+1.8** |

`tsc --noEmit` 0 error, `next build` 0 error / 0 warning.

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_1** Artwork-First | ✅ | 모든 이벤트는 artwork 종속. cross-artwork 카드는 artwork rib을 통해 출처 명시. |
| **rule_2** Flow System | ✅ | Sidebar → drawer → filter → card → drawer 흐름. 기능 나열 아님. |
| **rule_3** Money Flow Separation | ✅ | Payment / Settlement / Tax 0줄 변경. audit view는 read-only. |
| **rule_4** Document Trust Layer | ✅ **확장** | trust layer가 작품 단위 → 갤러리 단위로 확장. Manager가 시스템 전체 audit 흐름을 한눈에 파악. |
| **rule_5** AI-Human Loop | ✅ | AI 카드 클릭 시 4-mode drawer로 진입 — 동일 흐름 유지. |
| **rule_6** State Machine | ✅ | 영향 없음 — read-only view. |
| **rule_7** RBAC | ✅ **fine-grain** | Staff(단일 작품 audit만) ↔ Manager+(전역) 차등. permissionHint 시각 분리 — 권한 부족 vs 데이터 가드 구분 (rule_7 핵심 약속). |
| **rule_8** Timeline = Navigation | ✅ | STEP 21 navigation 그대로 재사용. cross-artwork에서도 카드 클릭 → drawer 진입 일관. |
| **rule_9** Work Queue | ✅ | "승인 대기" Sidebar 섹션 그대로. Audit은 별도 영역. |
| **rule_10** Not Dashboard | ✅ | 홈 = 작품 리스트. Audit은 overlay drawer. |
| **rule_14** Layout 3-Column | ✅ | 무변경. Sidebar에 entry만 추가. |
| **rule_17** Layer UI | ✅ | Drawer만 사용. 두 audit drawer는 별개 슬라이스이지만 한 번에 하나만 의미있게 열림. |
| **rule_18** AI Role | ✅ | AI 이벤트 분류 / 카드 표시 일관. |

---

## 8. 검증 시나리오

### A — Owner 전역 audit 접근
1. RoleSwitcher → OWNER
2. Sidebar의 "감사 → 전체 감사 로그" 클릭
3. **기대**: GlobalAuditDrawer 열림(`w-[800px]`). 5개 작품의 모든 timeline 이벤트가 시간순(DESC) 정렬. 각 카드 상단에 "작품명 · 작가" rib.

### B — Manager 접근
1. RoleSwitcher → MANAGER
2. "전체 감사 로그" 활성 (cursor-pointer + hover)
3. 클릭 → 정상 진입.

### C — Staff 접근 차단 (rule_7 시각 분리)
1. RoleSwitcher → STAFF
2. "전체 감사 로그" disabled (opacity-60, cursor-not-allowed)
3. Hint 텍스트 "Manager 권한 필요" 표시 (subline 자리)
4. 클릭해도 액션 불발 (`onClick={undefined}`)
5. 직접 store action 호출해도 RBAC 가드로 silent no-op

### D — 4축 필터링
OWNER로 GlobalAuditDrawer 열림.
1. 작품 필터 → "Aurora #14" → 해당 작품 이벤트만
2. 도메인 필터 → "정산·결제·세무" → Money 도메인만 추가 필터링
3. 작성자 필터 → "AI" → AI emit 이벤트만
4. 권한 필터 → "Owner" → Owner 권한 행위만
5. 카운터 "이벤트 N / M건 · 작품 X / Y점" 실시간 갱신
6. 빈 결과 시 EmptyState

### E — Cross-artwork navigation
1. GlobalAuditDrawer에서 art_004의 "Settlement 자동 생성" 카드 클릭
2. **기대**:
   - GlobalAuditDrawer 닫힘
   - `select("art_004")` → Sidebar 강조 / DetailPanel이 art_004 컨텍스트로 전환
   - SettlementDetailDrawer (stl_001) 열림
3. SettlementDetailDrawer 닫으면 art_004 DetailPanel 상태로 잔류

### F — STATE_CHANGE non-clickable 일관
1. GlobalAuditDrawer에서 "READY → INQUIRY" / "DEAL → PAID" / "Resale 시작" 카드
2. **기대**: cursor-default + "연결된 객체 없음" italic + chevron 부재 (STEP 21 일관)

### G — 빌드 / 타입 안전성
1. `npx tsc --noEmit` 0 error
2. `npx next build` 0 error / 0 warning
3. Route / 60.8 kB

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| Date range filter 미구현 | v1 spec에서 optional로 명시 | 다음 STEP 후보 — date picker chip |
| 두 audit drawer 동시 오픈 가능 | 슬라이스 분리 → 동시 가능. UX는 한 번에 하나 권장 | sidebar 클릭 시 단일 audit auto-close 정책 추가 가능 |
| 페이지네이션 없음 | 현재 ~50건 정도. virtualized list 미적용 | 100+ 시 react-window 도입 검토 |
| Export 미구현 | JSON / CSV / PDF 출력 부재 | STEP 25 후보 — 외부 감사 / 규제 대응 |
| Multi-select filter 부재 | 한 축에서 여러 값 동시 선택 불가 | 데이터 늘어나면 multi-select 도입 |
| Drill-down 후 GlobalAudit 자동 재오픈 부재 | 사이드바 재클릭 필요 | "다시 열기" persistent 버튼 가능 |

---

## 10. 다음 STEP 후보

1. **STEP 24 — Date range filter** + multi-select. cross-artwork view 실용 강화.
2. **STEP 25 — Audit Log Export** (JSON / CSV / PDF). rule_4 trust layer의 종착점 — 외부 감사 / 규제 대응.
3. **STEP 26 — Audit Trail visualization** (timeline graph / heatmap). 갤러리 활동 패턴 가시화.
4. **STEP 27 — Persistence + sync layer**. v1 메모리 스토어 → 백엔드 (Money Flow 코드 변경 없이 어댑터 추가).
