# STEP 20 — Audit Log Panel (완료)

기존 TimelineEvent 슬라이스를 *0줄 변경*으로 재사용하면서, 분류·필터·강조·체인
시각화를 추가한 read-only 감사 로그 drawer 구현. rule_7 RBAC follow-through +
rule_8 (Living Timeline) 보강.

핵심 결정:
- **TimelineEvent 타입 무수정** — 도메인/작성자 유형/강조는 모두 (kind / title /
  actor / detail) 조합의 *heuristic 분류*로 유추. 향후 도메인 정비 시 explicit
  field 추가하면 분류기 단순화 가능.
- **분류 로직은 lib/audit-helpers.ts의 순수 함수** — 컴포넌트는 표시만 담당.
- **Drawer 1개만 추가** — 3-column 레이아웃·기존 Living Timeline 무변경.

---

## 1. 현재 코드 분석

**STEP 20 진입 시점 상태:**

| 항목 | 진입 시점 | 비고 |
|---|---|---|
| TimelineEvent 슬라이스 | ✅ 존재 — 36종 title 패턴 emit | `kind` enum 6개 (STATE_CHANGE / DOCUMENT / INQUIRY / TRANSACTION / PAYMENT / NOTE) |
| actorRole 기록 | ✅ 일부 존재 — RBAC 게이트 액션은 모두 `actorRole: state.currentRole` 기록 | System cascades / AI는 `actorRole` 부재 |
| 도메인 단위 분류 | ❌ 없음 — `kind`는 너무 거친 분류 (예: Settlement / Tax 이벤트가 모두 `TRANSACTION` 으로 emit) | 키워드 매칭으로 도메인 유추 필요 |
| Chain 정보 | ⚠️ detail 문자열에만 인코딩 — `"v1 · AI 초안 생성"`, `"이전 v1는 영구 보존"`, `"원본: rep_004"` | 정규식 추출로 사용 |
| 전체 audit view | ❌ 없음 — Living Timeline은 chronological feed only, 필터/강조 없음 | 본 STEP에서 추가 |

**store action emit 패턴 (검증 끝):**

| 도메인 | 대표 title 키워드 | kind enum | actorRole |
|---|---|---|---|
| 큐레이션 (AI) | "큐레이션 노트 생성/승인/LOCK/새 버전/AI 재생성" | DOCUMENT | AI=AXVELA AI / 인간=actorRole 기록 |
| Inquiry response (AI) | "AI 응대 초안 생성/재생성", "Inquiry 응대 발송" | INQUIRY | 동일 |
| Contract | "Contract 생성/수정/검토 요청/승인/LOCK/새 버전" | DOCUMENT | actor=AI(생성) / 인간(나머지) |
| Invoice | "Invoice 자동 생성/발송 · 잠금/새 버전 생성" | DOCUMENT | System(자동) / 인간(나머지) |
| Payment | "결제 등록" | PAYMENT | 인간 |
| Settlement | "Settlement 자동 생성/생성/완료" | TRANSACTION (!) | System(자동) / 인간 |
| Tax | "TaxRecord 자동 생성/생성/발행 완료" | TRANSACTION (!) | System(자동) / 인간 |
| Logistics | "Logistics 생성", "배송 상태 변경" | DOCUMENT | 인간 |
| ConditionReport | "Condition Report 생성/수정본 생성" | DOCUMENT | 인간 |
| Inquiry | "Inquiry 자동 생성/업데이트" | INQUIRY | System(자동) / 인간 |
| Transaction | "Transaction 자동 생성/업데이트", "구매자 갱신", "가격 갱신" | TRANSACTION | System(자동) / 인간 |
| Resale (rule_13) | "Resale 시작", "New Transaction 생성", "Ownership 전환 준비" | STATE_CHANGE / TRANSACTION / INQUIRY | 인간 |
| State change | "{from} → {to}" | STATE_CHANGE | System(자동 cascade) |

**`kind=TRANSACTION`이 너무 거침**: Settlement / Tax / Transaction state 변경이 모두
같은 `kind`로 emit됨. 도메인 분류는 title 키워드 매칭으로 유추해야 함.

---

## 2. 변경 파일 목록 (3)

| 파일 | 변경 |
|---|---|
| `src/store/useArtworkStore.ts` | `AuditLogRequest` 타입 + `auditLogRequest` 슬라이스 + `openAuditLog/closeAuditLog` 액션 2개 (총 ~25 LOC 추가). 도메인 슬라이스/액션 0줄 변경 |
| `src/components/layout/DetailPanel.tsx` | `openAuditLog` 셀렉터 + Living Timeline 섹션 헤더에 "감사 로그 보기" 인라인 버튼 (기존 `<SectionHeader>` 호출 → 인라인 헤더로 약간 확장). 기존 Living Timeline 렌더링 무변경 |
| `src/app/page.tsx` | `<AuditLogDrawer />` 마운트 (1줄 import + 1줄 placement) |

**무영향 확인:**
- TimelineEvent 타입 0줄 변경
- 모든 도메인 타입 (Artwork / Inquiry / Transaction / Invoice / Payment / Settlement / Tax / Contract / Curation / Logistics / ConditionReport) 0줄 변경
- 기존 store actions 0줄 변경 — emit 패턴 동일
- mock-data 0줄 변경
- state-machine / rbac / utils 0줄 변경
- ButtonHint / Button (STEP 17) 0줄 변경
- 3-column 레이아웃 0줄 변경

## 3. 신규 파일 목록 (2)

| 파일 | 라인 | 역할 |
|---|---|---|
| `src/lib/audit-helpers.ts` | 240 | 순수 분류 함수: `getAuditEventsForArtwork`, `classifyAuditEvent` (`AuditDomain` / `AuditActorType` / `AuditEmphasis` 분류, version + correction 추출, chain hint 생성), `filterAuditEvents` (domain × actor 2축 필터) |
| `src/components/audit/AuditLogDrawer.tsx` | 440 | Drawer with filter chips + classified event card list. Sub-components: `ArtworkContextLine`, `FilterChipRow`, `EmptyState`, `AuditEventCard`, `DomainBadge`, `VersionPill`, `CorrectionPill`, `ActorPill`, `EmphasisIcon` (LockIcon/CheckIcon/RevisionIcon/MoneyIcon), `ChainIcon` |

---

## 4. 핵심 코드

### 분류 alphabet — 3-axis taxonomy

```ts
type AuditDomain      = "AI" | "DOCUMENT" | "MONEY" | "LOGISTICS"
                      | "INQUIRY" | "TRANSACTION" | "STATE" | "NOTE";
type AuditActorType   = "AI" | "SYSTEM" | "STAFF" | "MANAGER" | "OWNER";
type AuditEmphasis    = "LOCK" | "APPROVED" | "CORRECTION"
                      | "PAYMENT" | "SETTLEMENT" | "TAX_ISSUED" | null;
```

각 axis는 독립적으로 평가됨:
- **Domain**: 무엇에 관한 이벤트인가 (Money / Document / Logistics / AI / ...)
- **ActorType**: 누가 발생시켰나 (AI / System / 인간 + RBAC role)
- **Emphasis**: 신뢰 시스템에서 특별히 가시화할 이벤트인가 (LOCK / 승인 / 수정본 / 머니 플로우)

### Domain classifier — 우선순위 매칭

```ts
function classifyAuditDomain(event: TimelineEvent): AuditDomain {
  // 1. AI는 최상위 — actor가 kind보다 우선
  if (event.actor === "AXVELA AI") return "AI";

  // 2. PAYMENT kind → MONEY
  if (event.kind === "PAYMENT") return "MONEY";

  // 3. Money 키워드 (Settlement / Tax는 kind="TRANSACTION"으로 emit되므로
  //    title 매칭으로 잡음)
  const t = event.title;
  if (t.includes("결제") || t.includes("Settlement") || t.includes("정산") ||
      t.includes("TaxRecord") || t.includes("세무") || t.includes("Invoice")) {
    return "MONEY";
  }

  // 4. Logistics 키워드
  if (t.includes("Logistics") || t.includes("배송") ||
      t.includes("Condition Report") || t.includes("물류") ||
      t.includes("컨디션") || t.includes("검수")) {
    return "LOGISTICS";
  }

  // 5-9. Fallback to kind enum
  if (event.kind === "DOCUMENT")     return "DOCUMENT";
  if (event.kind === "INQUIRY")      return "INQUIRY";
  if (event.kind === "TRANSACTION")  return "TRANSACTION";
  if (event.kind === "STATE_CHANGE") return "STATE";
  return "NOTE";
}
```

### Emphasis classifier — title + detail 결합 매칭

```ts
function classifyAuditEmphasis(event: TimelineEvent): AuditEmphasis {
  const t = event.title, d = event.detail ?? "";

  if (t.includes("LOCK") || t.includes("잠금") || d.includes("잠금"))
    return "LOCK";
  if (t.includes("수정본") || d.includes("원본:"))
    return "CORRECTION";
  if (t.includes("승인"))
    return "APPROVED";
  if (event.kind === "PAYMENT")
    return "PAYMENT";
  if (t.includes("Settlement 완료") || t.includes("정산 완료"))
    return "SETTLEMENT";
  if (t.includes("발행 완료"))
    return "TAX_ISSUED";
  return null;
}
```

### Version + chain hint 추출

```ts
const VERSION_PATTERN = /\bv(\d+)\b/;

function extractVersion(event: TimelineEvent): number | null {
  // title 우선, detail fallback. 첫 매칭만.
  const titleMatch = event.title.match(VERSION_PATTERN);
  if (titleMatch) return parseInt(titleMatch[1], 10);
  if (event.detail) {
    const detailMatch = event.detail.match(VERSION_PATTERN);
    if (detailMatch) return parseInt(detailMatch[1], 10);
  }
  return null;
}

function buildChainHint(event, currentVersion, isCorrection): string | null {
  if (isCorrection) return "원본 → 수정본";

  // detail이 "이전 v{N}는 영구 보존" 형태일 때만 v(N) → v(M) 표시
  if (event.detail && currentVersion !== null) {
    const m = event.detail.match(/이전 v(\d+)/);
    if (m) return `v${m[1]} → v${currentVersion}`;
  }
  return null;
}
```

### 2-axis filter

```ts
function filterAuditEvents(
  classified: ClassifiedAuditEvent[],
  filters: { domain?: AuditDomainFilter; actor?: AuditActorFilter }
): ClassifiedAuditEvent[] {
  return classified.filter((c) => {
    if (filters.domain && filters.domain !== "ALL" && c.domain !== filters.domain) return false;
    if (filters.actor && filters.actor !== "ALL" && c.actorType !== filters.actor) return false;
    return true;
  });
}
```

domain × actor 2축 모두 AND. "ALL"은 해당 축 disable.

### Store 진입점

```ts
// 단순 open/close — 신규 데이터 슬라이스 0, RBAC 게이트 0 (read-only)
openAuditLog: (artworkId) => set({ auditLogRequest: { kind: "open", artworkId } }),
closeAuditLog: () => set({ auditLogRequest: { kind: "closed" } }),
```

### DetailPanel 진입점 — Living Timeline 섹션 헤더 인라인 버튼

```tsx
<section className="px-6 py-5 flex-1">
  <div className="flex items-baseline justify-between">
    <h3 className="...">Living Timeline</h3>
    <button
      type="button"
      onClick={() => openAuditLog(artwork.id)}
      className="text-[10.5px] text-ink-muted enabled:hover:text-ink ..."
    >
      감사 로그 보기
    </button>
  </div>
  {/* 기존 Living Timeline 렌더링 그대로 — 변경 0줄 */}
  ...
</section>
```

기존 Living Timeline은 chronological feed로 유지. 분류·필터·강조는 별도 drawer에서 제공 — 두 view는 *상호 보완*적 관계.

### Event card UI 구조

```
┌──────────────────────────────────────────────┐
│ [DOC] [v1]                          방금 전  │  ← Domain badge + Version pill + 시각
│                                               │
│ 🔒  큐레이션 노트 LOCK                          │  ← Emphasis icon + title (강조 시 semibold)
│ v1 · 잠금 (영구 보존)                          │  ← detail
│                                               │
│ ┌─ 🔗 v1 → v2 ─┐  (chain hint, 있을 때만)      │
│                                               │
│ ─────────────────────────────────────────────│
│ Manager · 운영자                  [MANAGER]  │  ← actor + actor type pill
└──────────────────────────────────────────────┘
```

강조 이벤트는 `border-line-strong`으로 일반 이벤트(`border-line`)와 시각 차등.
title도 강조 시 `font-semibold`, 일반 시 `font-medium`.

---

## 5. Build 결과

```
$ npx tsc --noEmit
(0 errors)

$ npx next build
 ✓ Compiled successfully
 ✓ Generating static pages (4/4)

Route (app)                              Size     First Load JS
┌ ○ /                                    57.2 kB         144 kB
└ ○ /_not-found                          873 B            88 kB
+ First Load JS shared by all            87.1 kB
```

| 기준 | STEP 17 | STEP 20 | 차이 |
|---|---|---|---|
| Route / | 54.5 kB | **57.2 kB** | +2.7 kB |
| TypeScript errors | 0 | 0 | — |

2.7 kB 증가 분포 추정:
- audit-helpers (~240 LOC source) ~1.5 KB
- AuditLogDrawer (~440 LOC source) ~7.5 KB raw
- DetailPanel / page.tsx 마이크로 변경 ~0.2 KB
- minify + tree-shake 후 ~2.7 KB net

---

## Manifesto 대조

| Rule | 적용 |
|---|---|
| rule_1 | Artwork-first 무영향 — 도메인 데이터 0줄 변경 |
| rule_2 | Flow system 무영향 — 상태 흐름 / cascade 0줄 변경 |
| rule_3 | **Money flow 코드 0줄 변경** — Payment / Settlement / Tax 슬라이스 / 액션 / 컴포넌트 모두 무영향. Audit Log은 *읽기*만 — Money flow의 신뢰 기록(LOCK / SETTLEMENT 완료 / TAX 발행 완료)을 강조 표시로 가시화함으로써 rule_3의 신뢰성 시각화 |
| rule_4 | **Document Trust Layer 시각화 강화** — Contract / Curation / Invoice version chain ("v1 → v2") + ConditionReport correction chain ("원본 → 수정본")이 audit 카드의 chain pill로 명시화. LOCK 이벤트는 강조 표시로 부각 |
| rule_5 | AI-Human Loop 무영향 — `actor: "AXVELA AI"` 이벤트는 분류기에서 AI 도메인으로 명시 분류, 인간 후속 액션은 actorType (STAFF/MANAGER/OWNER)으로 분류. AI 필터 / Manager 필터 등으로 lifecycle 단계별 추적 가능 |
| rule_6 | State machine 무영향 — STATE_CHANGE 이벤트는 STATE 도메인으로 분류, 별도 필터 |
| rule_7 | **RBAC follow-through 완성** — `actorRole`이 처음으로 1급 시민으로 가시화. STAFF/MANAGER/OWNER actorPill로 누가 어떤 액션을 했는지 한눈에 확인. SYSTEM (cascade / AI 외 자동) / AI (AXVELA AI) / 인간 3-tier 구분 명시 |
| rule_8 | **Timeline = Navigation 유지 + 보강** — Living Timeline은 그대로 chronological feed (rule_8의 원래 의미: 탐색/이동의 entry point). Audit Log Panel은 *분류·필터·강조* 관점의 상호 보완적 view. 같은 데이터 소스, 다른 lens |
| rule_11 | Transaction core 무영향 |
| rule_13 | Resale loop 이벤트 (Resale 시작 / New Transaction / Ownership 전환 준비) — STATE / TRANSACTION / INQUIRY 도메인으로 자연스럽게 분류 |
| rule_14 | **3-Column 레이아웃 무변경** |
| rule_15 | 버튼 ≤3 / Primary 1 — Drawer footer는 [닫기]만 (read-only) |
| rule_16 | Apple/OpenAI 미니멀 톤 — 카드형, 작은 chip filters, 색조 절제 |
| rule_17 | **Drawer만 추가** — 새 Modal/Overlay 없음. 기존 패턴 정합성 |
| rule_18 | AI Layer 동작 무변경 — AI 도메인 필터로 AXVELA AI 액션 분리 추적 가능 (큐레이션 생성/재생성/새 버전 + Inquiry 응답 초안 생성/재생성) |

---

## 검증 시나리오

### 1. art_001 (READY) — 큐레이션 라이프사이클 풀 검증

- art_001 선택 → DetailPanel 우측 → "Living Timeline" 섹션 → "감사 로그 보기" 클릭
- ✓ AuditLogDrawer 열림, "큐레이션 노트 LOCK" / "큐레이션 노트 승인" / "큐레이션 노트 생성" 3건 노출
- 필터 "AI" → ✓ "큐레이션 노트 생성" (AXVELA AI) 1건만
- 필터 "Manager" → ✓ "큐레이션 노트 LOCK" + "큐레이션 노트 승인" 2건
- ✓ 모두 카드에 v1 pill 노출
- ✓ "큐레이션 노트 LOCK" 카드: `border-line-strong`, 잠금 아이콘, semibold title
- ✓ "큐레이션 노트 승인" 카드: 체크 아이콘, semibold title

### 2. art_004 (PAID) — Money Flow + Logistics + Document 다양성

art_004는 Invoice 발송 / 결제 등록 / Settlement 자동 생성 / TaxRecord 자동 생성 /
Logistics IN_TRANSIT 등의 이벤트가 누적된 시드.

- art_004 선택 → 감사 로그 열기
- 필터 "Money Flow" → ✓ Invoice / 결제 / Settlement / TaxRecord 관련 이벤트만
- ✓ "결제 등록" 카드: PAYMENT 강조 (머니 아이콘)
- ✓ "Invoice 발송 · 잠금" 카드: LOCK 강조 + v1 pill
- 필터 "Logistics" → ✓ Logistics / Condition Report 관련만
- 필터 "System" → ✓ 자동 생성 이벤트 (Settlement 자동 / TaxRecord 자동 / Invoice 자동)

### 3. ConditionReport correction chain (art_004 또는 시드 추가 후)

- 사용자가 art_007 (BROKERED 시드) ConditionReport correction을 작성하면
- ✓ "Condition Report 수정본 생성" 이벤트 emit
- ✓ Audit Log: LOGISTICS 도메인, CORRECTION 강조 (revision 아이콘), "원본 → 수정본" chain pill

### 4. Curation new version chain (art_001 LOCKED v1 → v2 fork)

- art_001 → Curation 카드 → "큐레이션 상세" → "새 버전 생성" 클릭
- ✓ "큐레이션 노트 새 버전" 이벤트 emit (actor: AXVELA AI), detail에 "v2 · ... (이전 v1는 영구 보존)"
- 감사 로그 → ✓ AI 도메인, v2 pill, **chain hint pill "v1 → v2"** 노출

### 5. Filter combination

- art_002 (INQUIRY) → 감사 로그
- 필터: 도메인 "AI" + 작성자 "AI"
- ✓ AI 응대 초안 생성 / 재생성 이벤트만 (AXVELA AI actor)
- 필터: 도메인 "Inquiry" + 작성자 "Manager"
- ✓ "Inquiry 응대 발송" / "Inquiry 업데이트" 등 인간 매니저 액션만
- 필터: 도메인 "AI" + 작성자 "Manager"
- ✓ 빈 결과 (AI 도메인은 actor=AXVELA AI 강제, Manager actorType과 교집합 없음) — EmptyState 노출

### 6. RBAC actor type 정확성

- 시드 + 사용자 액션 통한 모든 actorType 시연:
  - "AI": AXVELA AI 이벤트
  - "SYSTEM": Inquiry 자동 생성 / Transaction 자동 생성 / Invoice 자동 생성 / 배송 상태 cascade
  - "STAFF": Logistics 생성 / ConditionReport 생성 (STAFF 권한)
  - "MANAGER": Contract 검토 요청 / 큐레이션 LOCK / 결제 등록
  - "OWNER": Contract 승인 / Settlement 완료 / TaxRecord 발행 / 거래 종료

### 7. 빈 상태 (no events / filter mismatch)

- 신규 art_001 (DRAFT 가정) → 감사 로그 → ✓ "아직 기록된 이벤트가 없습니다"
- art_001 (시드 LOCKED v1 있음) + 필터 "Money Flow" → ✓ "선택한 필터에 해당하는 이벤트가 없습니다" + "전체로 변경" 안내

### 8. 기존 기능 회귀 없음

- DetailPanel Living Timeline 그대로 동작 ✓
- 모든 Drawer (Curation / Inquiry response / Contract / Settlement / Tax / Logistics / ConditionReport) 동작 ✓
- STEP 17 Disabled state polish 정상 ✓
- STEP 16 AI Layer 정상 ✓
- 빌드 통과 ✓

---

## 알려진 한계 (정직)

1. **분류기가 store actions의 title 문자열에 dependent** — store에서 신규 timeline title을 추가할 때 audit-helpers의 매칭 패턴도 함께 갱신해야 함. 도메인 추가 시 *ripple* 발생. 향후 TimelineEvent에 explicit `domain?: AuditDomain` 필드 추가하면 single source of truth 확립. 현재는 store action 코드 0줄 변경 정책 하에 heuristic으로 동작.

2. **Chain hint는 detail 문자열에 의존 (fragile)** — `"이전 v{N}는 영구 보존"` 정확한 패턴 매칭. detail 문구가 바뀌면 chain pill이 사라짐. 단위 테스트 인프라 부재 — store action에서 timeline.detail을 바꿀 때 grep으로 audit-helpers 영향 확인 필요.

3. **Living Timeline과 Audit Log의 관계 — 일부 중복** — 같은 데이터 소스 두 view. 사용자 입장에서 "왜 둘 다 필요한가" 헷갈릴 수 있음. 의도: Living Timeline은 chronological 탐색 entry, Audit Log은 분류·필터·신뢰 강조. 향후 TimelineItem (Living Timeline의 행 컴포넌트) 클릭 시 audit log의 해당 카드로 anchor jump 같은 연결 가능 (STEP 후보).

4. **Cross-artwork audit view 미구현** — 현재는 단일 artwork audit만. Owner 입장에서 "지난 7일간 모든 작품의 LOCK 이벤트" 같은 cross-cut 질의는 불가능. 향후 STEP에서 별도 page (또는 modal)로 추가 가능.

5. **이벤트 검색 미구현** — 필터만 있고 자유 검색 없음. 이벤트 수가 많아지면 (예: 수년치 이력) 필요. v1 갤러리 운영 규모에서는 작품당 수십 건 수준이라 필터로 충분.

6. **클릭 시 탐색 (rule_8 "Navigation = Timeline") 미적용** — Audit Log 카드 클릭이 해당 도메인 객체 (Contract / Curation / Settlement 등) drawer를 여는 동작 없음. read-only audit view 의도이긴 하나, 사용자가 "이 LOCK 이벤트의 실제 문서 보기"를 자연스럽게 기대할 수 있음. 향후 cardClick → openDocumentDetail dispatch 가능.

7. **`role="note"` ARIA semantic 약함** — 카드는 `<article>`, 헤더는 텍스트, 강조 아이콘은 `aria-label` 부여. 그러나 `aria-live`로 필터 결과 변경 알림은 미구현. 접근성 강화 STEP 후보.

8. **모바일 반응형 미고려** — Drawer 폭 480px (max-w-92vw). 매우 좁은 화면에서 filter chip row가 잘릴 수 있음. v1 desktop 갤러리 운영 환경 가정.

---

## 다음 STEP 후보

1. **STEP 21 — Audit Log card → document drawer navigation (rule_8 완성)**: card 클릭 시 해당 도메인 객체의 drawer를 여는 dispatch. 예: Contract LOCK 카드 클릭 → ContractDetailDrawer 열림 (해당 contract).

2. **STEP 22 — TimelineEvent에 explicit domain field**: heuristic 의존도 제거. store action 12개 위치에서 명시적 `domain` 부여. classifier는 fallback only로 축소.

3. **STEP 23 — Cross-artwork audit view**: 모든 작품의 audit 이벤트를 하나의 view에서 필터링 (Owner 권한 한정 가능). 별도 page (`/audit`) 또는 modal.

4. **STEP 24 — Audit log export**: CSV / PDF로 audit 기록 내보내기. 갤러리 외부 감사·세무 신고에 활용.

5. **STEP 18/19 — 보류된 이전 STEP들**: 가격 제안 (rule_18 (c)) 또는 Market Data (rule_19) — 별도 승인 필요.
