# STEP 41 — Collector View 완료

갤러리 운영의 핵심 차원인 "고객 / 컬렉터 관리" 화면을 추가. **신규 도메인
store 0개 · 핵심 계산 0줄 변경 · pure derive aggregation**. Inquiry /
Transaction에 이미 존재하는 `collectorName` / `buyerName` 필드를 view 시점에
동적 그룹핑하여 collector entity로 표현. STEP 40에서 "준비 중"이었던 Sidebar
"Collector View" 항목을 RBAC 기반으로 활성화 (Manager 이상).

핵심 결정:
- **Pure read-only derive** — `src/lib/collector-aggregates.ts`의
  `deriveCollectors(inquiries, transactions, invoiceFxLookup): Collector[]` 단일
  pure function. 도메인 store / mock data / 도메인 액션 0줄 변경 — 본 view는
  "또 하나의 read-only layer"로 도메인 위에 올라감.
- **Collector identity = `name (lowercase trim)` 그룹핑** — Inquiry
  `collectorName` + Transaction `buyerName` 모두 활용. 같은 이름 / 다른 contact
  는 같은 collector로 간주 (mock data 단순화). 빈 이름은 collector로 카운트
  안 함 (intake pending 상태).
- **신규 entity 없음** — 사용자 spec "신규 도메인 로직 최소화" 충족. Collector
  는 v1에서 first-class entity가 아닌 **derived view** — 향후 정식 entity로
  승격 시 store slice 추가 자연스러움.
- **"확정 고객 등급" 금지 → "운영 참고 신호"** — 사용자 spec 엄격 준수. 신호
  4종 (MULTI_DEAL / ACTIVE_INQUIRY / RECENT_ACTIVITY / HIGH_VALUE) 모두 단순
  휴리스틱 매칭, 영구 등급 / VIP / 블루칩 / 평점 등 표현 grep 검증 통과 (UI
  텍스트 0건). Disclaimer banner에서도 "확정 고객 등급 또는 영구 마스터 데이터
  아닙니다" 명시.
- **Master-detail in single Drawer** — 폭 880px (audit drawer 800 + 약간
  넓힘). 좌측 260px collector list (검색 + 클릭 선택), 우측 detail 패널 (5
  섹션 — Identity / Signals / KPI 3카드 / 보유·매입 작품 / 문의 이력). 사용자
  spec "Drawer 또는 dedicated panel 방식 중 현재 구조에 가장 안전한 방식
  선택" — Drawer가 일관성 + 안전.
- **RBAC 게이트** — Manager 이상만 접근. 새 permission `collector.view_global`
  추가 (audit.view_global / report.view_global 패턴 일치). Staff는 sidebar
  항목 disabled + "Manager 권한 필요" hint.
- **Sidebar PRIMARY 동적 빌더** — STEP 40의 정적 PRIMARY 배열을 기본
  (`PRIMARY_STATIC`) + 동적 `Collector View` 항목 결합 useMemo로 변환. STEP
  35에서 SECONDARY가 동적이 된 패턴 그대로. 작품(active) / 거래 / 문서 항목
  은 0줄 변경.
- **Read-only FX 활용** — collector의 누적 매입 KRW 계산에 invoice
  `fxSnapshot.rate` 활용. Settlement / Tax / FX provider / Invoice LOCK 로직
  0줄 변경. 외화 거래 + fxSnapshot 부재 시 missingFxCount 별도 카운트 (사용자
  에게 "환산 정보 부족" 명시 — STEP 35와 일관 trust 신호).

---

## 1. 현재 코드 분석

**STEP 41 진입 시점 (v34 + STEP 24/26/40/35/35.5/35.6/36 baseline):**

| 항목 | 진입 시점 | STEP 41 종료 |
|---|---|---|
| Collector entity | 부재 (Inquiry.collectorName / Transaction.buyerName 분산) | derived view (pure function) |
| Sidebar "Collector View" | STEP 40 disabled + "준비 중" | RBAC 기반 활성화 (Manager 이상) |
| Collector aggregation | 부재 | `deriveCollectors()` pure function |
| RBAC permission | 15개 (audit / report 포함) | + `collector.view_global` (Manager) |
| Store slice | reportingRequest 추가 | + `collectorViewRequest` (kind: closed/open + selectedCollectorId) |
| Inquiry / Transaction / Invoice / Artwork 도메인 액션 | STEP 14~36에서 완성 | **무수정** |
| Audit / Reporting drawer (STEP 24/26/35) | 정상 | **무수정** |
| Sidebar PRIMARY 정적 / SECONDARY 동적 | STEP 40 | PRIMARY도 동적 (Collector View 항목만) |

**의존 관계:**
- `CollectorViewDrawer` → `deriveCollectors` (신규 lib) + store read-only +
  `Drawer` UI
- `collector-aggregates.ts` ← `Inquiry` / `Transaction` / `Artwork` 타입만 import
- Sidebar → `openCollectorView` action + `collector.view_global` permission

순환 import 0건. 본 STEP은 **새 layer를 도메인 위에 올린 형태** — 도메인은
collector view의 존재를 모름.

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/types/role.ts` | `Permission` union에 `"collector.view_global"` 추가 (~3 LOC). `ACTION_MIN_ROLE`에 `"collector.view_global": "MANAGER"` 매핑 추가 (~3 LOC). 기존 권한 0줄 변경. |
| `src/store/useArtworkStore.ts` | `CollectorViewRequest` type (kind/selectedCollectorId) 추가. State에 `collectorViewRequest` 필드 + Actions에 `openCollectorView` / `closeCollectorView` / `selectCollector`. 초기 state 1줄 + reset 블록 1줄. 액션 본체 — `openCollectorView`는 RBAC 가드 후 set, `selectCollector`는 open 상태에서만 동작. **도메인 액션 / mock data / 다른 모든 slice / 모든 cascade 0줄 변경** (~30 LOC 추가만). |
| `src/components/layout/Sidebar.tsx` | PRIMARY 정적 배열 4 항목 → 3 항목 정적 (`PRIMARY_STATIC`) + 컴포넌트 내부 useMemo 동적 빌더로 4번째 (Collector View) 항목 RBAC 결합. `openCollectorView` / `canViewCollector` 신규 hook. 다른 모든 부분 (Header / 감사 / Pending Approval / RoleSwitcher / SyncStatus / Reset) 0줄 변경. (~25 LOC 변경) |
| `src/app/page.tsx` | `CollectorViewDrawer` import + mount 1줄 (다른 drawer 옆). |
| `ARCHITECTURE.md` | STEP 41 changelog |

---

## 3. 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/collector-aggregates.ts` | 290 | Pure derive function. Inquiry/Transaction → Collector entities 그룹핑. `Collector` interface (id / displayName / contact / inquiryIds / transactionIds / ownedArtworkIds / totalPurchaseKRW / missingFxCount / activeInquiryCount / activeTransactionCount / lastInteractionAt / signals). `CollectorSignal` 4종 (MULTI_DEAL / ACTIVE_INQUIRY / RECENT_ACTIVITY / HIGH_VALUE). `deriveCollectors(inquiries, transactions, invoiceFxLookup)` 단일 진입점. Display helpers (`formatCollectorKRW` / `formatRelativeTime` / 한국어 라벨 dictionaries) 함께 export. |
| `src/components/collector/CollectorViewDrawer.tsx` | 460 | Master-detail Drawer (880px). 5 섹션 (Identity / Signals / KPI 3카드 / 보유·매입 작품 / 문의 이력). Sub-components: `CollectorListRow` / `CollectorDetail` / `Stat` / `SignalChip` / `Section` / `StatusTag` / `EmptyDetailState`. Status 라벨 dictionary (TX / Inquiry). 검색 (이름 + email lowercase contains). 빈 상태 ("왼쪽에서 컬렉터 선택"). 외부 라이브러리 0개. |
| `STEP_41_COLLECTOR_VIEW_COMPLETE.md` | 본 문서 |

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/types/inquiry.ts` (Inquiry / collectorName / contact / status) | 0줄 — read-only |
| `src/types/transaction.ts` (Transaction / buyerName / status / agreedPrice / currency / isResale) | 0줄 |
| `src/types/invoice.ts` (Invoice / fxSnapshot) | 0줄 — read-only |
| `src/types/artwork.ts` | 0줄 |
| Mock data | 0줄 — collector identity는 derive 시 자동 그룹핑 |
| `src/store/*` (도메인 액션) | sendInvoice / createSettlement / completeSettlement / createTaxRecord / 모든 도메인 액션 0줄 변경 |
| `src/lib/audit-*` (STEP 20/21/24/25) | 0줄 — audit 영역 무관 |
| `src/lib/reporting-aggregates.ts` (STEP 35) / `reporting-export.ts` (STEP 35.6) | 0줄 — reporting 영역 무관 |
| `src/lib/fx-provider.ts` (STEP 31) | 0줄 |
| `src/components/audit/*` / `src/components/reporting/*` / `src/components/settlement/*` / `src/components/tax/*` / 다른 모든 drawer / Detail Panel | 0줄 변경 |
| `src/components/shared/MoneyAmount.tsx` (STEP 36) | 0줄 — 본 STEP에서 MoneyAmount는 사용 안 함 (collector 단위 누적 KRW가 핵심, 분배 표시 아님). 향후 collector view에서도 통화 inline 표시 시 재활용 가능 |
| Persistence (STEP 27/27.7/30) | 0줄 — collectorViewRequest는 UI 상태이므로 영속 안 됨 (drawer 닫혔다 열면 reset, 의도된 동작) |
| Market Data (STEP 19/29) / AI (STEP 16/18) | 0줄 |
| 3-Column 레이아웃 / Sidebar Header / Pending Approval Queue / RoleSwitcher / SyncStatus / ResetDataButton | 0줄 |
| `package.json` | 0줄 — 외부 라이브러리 0개 |

---

## 5. 핵심 코드

### 5.1 Pure derive

```ts
export function deriveCollectors(
  inquiries: Inquiry[],
  transactions: Transaction[],
  invoicesByTxId: Record<string, { fxRate?: number }>
): Collector[] {
  const accumByKey = new Map<string, CollectorAccum>();

  // Inquiries — collectorName 기준 그룹
  for (const inq of inquiries) {
    const key = normalizeName(inq.collectorName);
    if (!key) continue;  // 빈 이름 제외
    const acc = ensure(accumByKey, key, inq.collectorName);
    acc.inquiryIds.add(inq.id);
    if (ACTIVE_INQUIRY_STATUSES.has(inq.status)) acc.activeInquiryCount++;
    // contact 빈도 누적
  }

  // Transactions — buyerName 기준 그룹 + KRW 환산
  for (const tx of transactions) {
    const key = normalizeName(tx.buyerName);
    if (!key) continue;
    const acc = ensure(accumByKey, key, tx.buyerName);
    acc.transactionIds.add(tx.id);
    acc.ownedArtworkIds.add(tx.artworkId);

    // KRW 환산 — 도메인 store에서 계산된 fxSnapshot.rate 활용 (read-only)
    const invInfo = invoicesByTxId[tx.id];
    if (tx.currency === "KRW") {
      acc.totalPurchaseKRW += tx.agreedPrice;
    } else if (invInfo?.fxRate !== undefined) {
      acc.totalPurchaseKRW += Math.round(tx.agreedPrice * invInfo.fxRate);
    } else {
      acc.missingFxCount++;
    }
  }

  // Convert + signals
  for (const [key, acc] of accumByKey) {
    const signals: CollectorSignal[] = [];
    if (acc.transactionIds.size >= MULTI_DEAL_MIN) signals.push("MULTI_DEAL");
    if (acc.activeInquiryCount > 0) signals.push("ACTIVE_INQUIRY");
    if (acc.totalPurchaseKRW >= HIGH_VALUE_KRW_THRESHOLD) signals.push("HIGH_VALUE");
    if (recentActivity(acc.lastInteractionAt, now)) signals.push("RECENT_ACTIVITY");
    out.push({ ... });
  }

  // 정렬: lastInteractionAt 내림차순
  return out;
}
```

### 5.2 RBAC permission

```ts
export type Permission = ... | "collector.view_global";
export const ACTION_MIN_ROLE = { ..., "collector.view_global": "MANAGER" };
```

### 5.3 Store slice

```ts
export type CollectorViewRequest =
  | { kind: "closed" }
  | { kind: "open"; selectedCollectorId: string | null };

// Actions
openCollectorView: () => {
  if (!hasPermission(get().currentRole, "collector.view_global")) return;
  set({ collectorViewRequest: { kind: "open", selectedCollectorId: null } });
},
closeCollectorView: () => set({ collectorViewRequest: { kind: "closed" } }),
selectCollector: (id) => {
  const state = get();
  if (state.collectorViewRequest.kind !== "open") return;
  set({ collectorViewRequest: { kind: "open", selectedCollectorId: id } });
},
```

### 5.4 Sidebar PRIMARY 동적 (STEP 41)

```tsx
const PRIMARY_STATIC: NavItem[] = [
  { label: "작품", active: true },
  { label: "거래",   disabled: true, hint: "작품 상세에서 접근" },
  { label: "문서",   disabled: true, hint: "작품 상세에서 접근" },
];

// 컴포넌트 내부:
const PRIMARY: NavItem[] = useMemo(() => [
  ...PRIMARY_STATIC,
  {
    label: "Collector View",
    disabled: !canViewCollector,
    hint: canViewCollector ? undefined : permissionHint("collector.view_global"),
    onClick: canViewCollector ? openCollectorView : undefined,
  },
], [canViewCollector, openCollectorView]);
```

### 5.5 Drawer 880px master-detail 구조

```tsx
<Drawer widthClass="w-[880px]" title="Collector View">
  <DisclaimerBanner />          {/* "운영 참고 신호 · ... 확정 고객 등급 ... 아닙니다" */}
  <div className="flex">
    <aside className="w-[260px]">  {/* Master */}
      <SearchInput />
      <CollectorList items={filteredCollectors} onSelect={selectCollector} />
    </aside>
    <div className="flex-1">      {/* Detail */}
      {selected ? <CollectorDetail collector={selected} ... /> : <EmptyDetailState />}
    </div>
  </div>
</Drawer>
```

### 5.6 Detail 5 섹션

```
┌─Identity──────────────────────────────────────┐
│ 박기훈                                         │
│ park.kihoon@example.com                        │  monospace
├─Signals────────────────────────────────────────┤
│ ● 다회 거래  ● 응대 필요  ● 최근 활동           │  chip + bullet
├─KPI 3 카드─────────────────────────────────────┤
│ 누적 매입  보유 작품      마지막 활동           │
│ ₩148M     3점·거래5건     4일 전               │
├─보유/매입 작품─────────────────────────────────┤
│ Aurora #08 · 박기훈      ₩42,000,000  완료    │
│ Stratum no.7 · 박기훈    ₩42,500,000  결제    │
├─문의 이력─────────────────────────────────────┤
│ Aurora #08 — "전시 기간 ..."        응답       │
│ Quiet Field II — "가격 협상..."      응대 대기 │
└────────────────────────────────────────────────┘
```

### 5.7 Signal 휴리스틱 (사용자 spec "운영 참고 신호")

```ts
const HIGH_VALUE_KRW_THRESHOLD = 100_000_000;
const RECENT_ACTIVITY_DAYS = 30;
const MULTI_DEAL_MIN = 2;

// Signal 4종 — 모두 단순 휴리스틱:
MULTI_DEAL       // 거래 ≥ 2건
ACTIVE_INQUIRY   // 진행 중 inquiry ≥ 1
HIGH_VALUE       // 누적 매입 KRW ≥ 100M
RECENT_ACTIVITY  // 마지막 활동 ≤ 30일
```

각 신호는 **독립적으로 검사** — 한 collector가 여러 신호를 동시에 가질 수 있음.
chip으로 노출 + title attribute에 hint ("거래 2건 이상" / "30일 이내 활동").

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    86.8 kB         174 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 35.5+35.6+36 (Bundle) | 83.5 kB | — |
| **STEP 41 (Collector View)** | **86.8 kB** | **+3.3** |

`tsc --noEmit` 0 error / `next build` 0 warning. **외부 npm 의존성 0개**.

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_1** Artwork-First | ✅ | Collector view도 ownedArtworkIds로 작품 중심 — 작품을 떠나지 않음 |
| **rule_4** Trust Layer | ✅ | missingFxCount 명시 — 환산 부족 trust 신호 |
| **rule_7** RBAC | ✅ | 새 `collector.view_global` Manager 이상. STAFF disabled + hint |
| **rule_10** 홈 = 작품 리스트 | ✅ | Collector view는 Drawer overlay — 홈 무변경 |
| **rule_14 / rule_17** Layout / Layer | ✅ 0줄 | Drawer 추가만 |
| **rule_19** Market Data viscosity | ✅ | Collector signals는 시장 viscosity의 사용자 측 view |
| 신규 도메인 로직 최소화 | ✅ | derive function 1개. 도메인 store / 핵심 계산 / FX provider 0줄 |
| Payment / Settlement / Tax / Invoice / Audit 로직 변경 | ✅ 0줄 | |
| 3-column 레이아웃 변경 | ✅ 0줄 | |
| Drawer 또는 dedicated panel 방식 (현재 구조에 안전) | ✅ Drawer 880px |
| Manager 이상 접근 | ✅ |
| Staff disabled / 권한 안내 | ✅ "Manager 권한 필요" hint |
| Collector list / detail summary / owned artworks / inquiry history / transaction status / total purchase / last interaction / high-intent | ✅ 모두 5 섹션에 포함 |
| 실제 개인정보처럼 보이지 않게 mock email/이름 유지 | ✅ mock data 그대로 |
| "확정 고객 등급" 표현 금지, "운영 참고 신호" 사용 | ✅ grep 검증 통과 |
| CRM처럼 보이되 과도한 기능 추가 금지 | ✅ View only — 편집 / 노트 / tag / 즐겨찾기 모두 부재 |
| View 중심 (이번 STEP) | ✅ |

---

## 8. 검증 시나리오

### A — Manager 권한 진입
1. RoleSwitcher → Manager (default)
2. Sidebar → "Collector View" 클릭
3. **기대**: Drawer 열림 (880px). 헤더 "Collector View". DisclaimerBanner. 좌측 collector list, 우측 "왼쪽에서 컬렉터 선택" empty state.

### B — Staff 권한 차단
1. RoleSwitcher → Staff
2. Sidebar → "Collector View" 항목 시각: disabled + "Manager 권한 필요" hint
3. 클릭 시도 → **무동작** (HTML disabled)

### C — Owner 권한 정상 (상속)
1. Owner로 전환 → Manager 상속 → 정상 진입

### D — Collector list
1. Drawer 진입 → 좌측 collector list 노출
2. mock data 기준 약 6명 (Sarah Lim / 강민정 / 리움 컬렉션 / 김도현 / 박기훈 / Initial Owner)
3. **기대**:
   - 각 row: 이름 / 거래·문의 카운트 / 마지막 활동 (상대 시간)
   - 신호 있는 collector는 우측에 작은 검은 점 (●)
   - lastInteractionAt 내림차순 정렬

### E — 검색
1. 검색창에 "박" 입력
2. **기대**: "박기훈" 1명만 노출. 카운트 "1 / 6 컬렉터" 갱신
3. 빈 검색어로 복원 → 6명 다시 표시

### F — Collector 선택 → Detail 표시
1. "박기훈" 클릭
2. **기대 우측 패널**:
   - **Identity**: "박기훈" + "park.kihoon@example.com" (monospace)
   - **운영 참고 신호** (있으면): chip 1개 이상
   - **KPI 3 카드**: 누적 매입 (KRW) / 보유 작품 + 거래 카운트 / 마지막 활동
   - **보유 / 매입 작품**: transaction 기준 작품 row + KRW + status tag
   - **문의 이력**: inquiry 기준 row + 메시지 truncate + status tag

### G — 신호 노출
1. 거래 2건 이상인 collector 선택
2. **기대**: "다회 거래" chip 노출. title attribute "거래 2건 이상".
3. 진행 중 inquiry 있는 collector → "응대 필요" chip
4. 누적 매입 100M+ → "대규모 매입" chip
5. 마지막 활동 30일 이내 → "최근 활동" chip
6. 빈 array면 신호 섹션 미렌더 (전체 collector에 신호 없을 때)

### H — Detail empty state
1. 검색으로 collector list 0건 만들기 → 검색어로 누구도 매칭 안 됨
2. **기대**: 우측 "왼쪽에서 컬렉터 선택" 표시. 선택 자동 해제 (effect).

### I — Drawer 닫고 다시 열기
1. 닫기 → 다시 열기
2. **기대**: 검색어 reset, selectedCollectorId reset (null), empty detail state.

### J — Collector list 정렬
1. mock data에 다양한 lastInteractionAt
2. **기대**: 가장 최근 활동 collector가 첫 줄

### K — 외화 매입 환산
1. 외화 거래 (USD invoice 발송) 후 collector 선택
2. **기대**: 누적 매입 KRW에 환산값 포함. fxSnapshot 부재 시 "N건 환산 정보 부족" amber hint.

### L — 빈 collectorName 제외
1. mock data에 collectorName "" 인 inquiry/transaction 1건 (idx 226-227)
2. **기대**: 그 inquiry는 어떤 collector에도 속하지 않음 (intake pending) — list에 anonymous collector 그룹 없음.

### M — Persistence 호환
1. F5 새로고침
2. **기대**: 도메인 데이터 (inquiry / transaction / invoice) 영속. drawer state는 UI이므로 reset.

### N — Audit / Reporting 무영향
1. Sidebar "전체 감사 로그" / "보고서" 진입 → 기존 drawer 정상
2. **기대**: STEP 24/26/35 모든 검증 그대로

### O — 도메인 흐름 무영향
1. invoice 발송 / settlement / payment 등
2. **기대**: 0영향. 단 Collector View가 열려 있는 동안 새 거래 발생 시 view 자동 갱신 (useMemo dependency)

### P — RoleSwitcher 동작 중
1. Manager → Staff 전환
2. **기대**: Drawer 즉시 비활성 (isAllowed false → isOpen false). Sidebar 항목 disabled로 전환.

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| Collector identity는 이름 단순 그룹핑 | 동명이인 분리 못함 (mock data 단순화 가정) | 정식 entity 승격 시 contact 결합 또는 explicit collector_id 도입 |
| 빈 collectorName 제외 | "Anonymous" 그룹 부재 — intake pending 거래는 collector list에 안 뜸 | 정식 entity 시 명시 anonymous bucket |
| 편집 / 메모 / tag / 즐겨찾기 부재 | 사용자 spec "View only" 명시. CRM 기능 의도적 제한 | 후속 STEP에서 점진 추가 가능 |
| Inquiry status 활동 판정 | "OPEN" / "RESPONDED" / "ESCALATED"만 active로 간주 — RESPONDED는 응답 후 collector 답변 대기로 보지만 실은 종료 단계일 수도 | 추후 status 의미 명확화 |
| 외화 환산은 invoice fxSnapshot에만 의존 | DRAFT 상태 외화 거래는 fxSnapshot 없어 환산 불가 → missingFxCount | 사용자 spec 충족 (FX provider read-only) |
| Persistence 부재 | drawer state UI 상태 — 의도된 reset 동작 | Saved view preset 후속 STEP |
| 정렬 옵션 부재 | lastInteractionAt 내림차순 고정 | 향후 toggle 추가 가능 (이름 / 누적 매입 등) |
| 페이지네이션 부재 | 전체 list 한 화면 — 1000+ collector 시 성능 이슈 | mock 규모에서 OK. 정식 entity 승격 시 가상화 |
| 작품 클릭으로 navigate 부재 | 보유 작품 row가 단순 표시 — DetailPanel로 이동 안 함 | 후속 STEP에서 timeline navigation 패턴 차용 |
| Export 부재 | 사용자 spec "View 중심" 명시 | STEP 35.6 패턴 재활용해 후속 STEP 가능 |
| Inquiry source 분포 부재 | 채널별 (Website / Email / Showroom 등) 카운트 미표시 | 정식 entity 시 추가 |
| Locale 부재 | 한국어 hardcoded | i18n 후속 |

---

## 10. 다음 STEP 후보

본 STEP 41로 Sidebar 4 항목 중 3 항목 (작품 / 보고서 / Collector View) 활성.
남은 미구현은 sidebar의 거래 / 문서 / AI 워크플로우 / 고객 / 설정. 자연스러운
후속:

1. **STEP 33 — Real FX Provider** — OpenExchangeRatesProvider 실 구현. STEP
   31~36의 mock 경고가 자연스럽게 사라짐. 본 STEP 41 collector 누적 매입의
   환산 정확도 ↑.
2. **STEP 41.5 — Collector Drill-down Navigation** — Collector View에서
   작품 / inquiry / transaction row 클릭 시 해당 detail drawer로 navigate.
   STEP 21 audit-navigation 패턴 차용.
3. **STEP 28 — Real AI Integration** — 실 AI API.
4. **STEP 38 — Saved Filter Preset** — audit + reporting + collector view
   조합을 사용자별 저장.
5. **STEP 27.5 — IndexedDBAdapter** — localStorage 5MB 한계 해소.
6. **STEP 39 — Audit Heatmap** — 7일 × N주 grid heatmap.
7. **STEP 37 — Document Approval Workflow** — Contract / Curation multi-step.
8. **STEP 41.6 — Collector Export** — collector view CSV / PDF (STEP 35.6
   패턴).
9. **STEP 42 — Customer (고객) View** — Sidebar "고객" 항목 활성화. Collector
   와 별개로 inquiry-only / 미거래 lead 관리.
