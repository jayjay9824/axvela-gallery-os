# STEP 16 — AI Layer (rule_18) 구현 (완료)

manifesto rule_18 (AI role) 중 **(a) 큐레이션 생성** + **(d) 거래 흐름 응대 생성**
2개 모듈 구현. 기존 `generateContractDraftContent` 패턴을 미러링한 결정론적
템플릿 기반. rule_5 (AI-Human loop) 4-phase 강제 — DRAFT(AI 생성) → 인간 편집
→ APPROVED → LOCKED. 빌드 통과.

미구현으로 남긴 rule_18 영역: **(b) 시장 분석** + **(c) 가격 제안**.
(b)는 rule_19 (market data) 미구현 상태에서 환각 위험 — STEP 19로 이연.
(c)는 STEP 16.5 또는 18 후보로 분리.

---

## 1. 현재 코드 분석 요약

**STEP 16 진입 시점에 부족했던 것:**

| 항목 | 진입 시점 상태 | STEP 16 적용 |
|---|---|---|
| AI 도메인 슬라이스 | ❌ 없음 | ✅ `curationNotes: Record<artworkId, CurationNote[]>` |
| `SUPPORTING_ACTIONS.DRAFT.secondary` "AI 큐레이션 초안" | ❌ 버튼 있으나 onClick 없음 | ✅ `openCurationDraft(artworkId)` 연결 |
| `SUPPORTING_ACTIONS.INQUIRY.secondary` "AI 응대 초안" | ❌ 동일, 미연결 | ✅ `openInquiryResponse(latestInquiryId)` 연결 |
| Inquiry 응답 추적 필드 | ❌ 없음 | ✅ `responseDraft / responseStatus / responseGeneratedAt / respondedAt` 4개 추가 |
| AI 시드 데이터 | ❌ contract LOCKED 시드만 존재 | ✅ art_001에 LOCKED CurationNote v1 + timeline 3건 |

**기존 활용된 patterns:**
- `generateContractDraftContent` (utils.ts) → `generateCurationDraftContent` + `generateInquiryResponseDraft` 형제로 추가
- `createContract / approveContract / lockContract / createContractVersion` → curation 액션 5종이 동일 lifecycle 패턴 미러
- `actor: "AXVELA AI"` 컨벤션 → AI 생성/재생성 timeline 이벤트 모두 동일 actor
- `actorLabel(role) + actorRole` → 인간 승인/LOCK/발송 timeline 이벤트
- `Drawer` + 3-mode (DRAFT 편집 / APPROVED+LOCK / LOCKED+새 버전) → ContractDetailDrawer와 같은 구조

---

## 2. 변경 파일 목록 (8)

- `src/types/inquiry.ts` — 응답 4개 필드 + 주석
- `src/types/role.ts` — `Permission` 7개 추가, `ACTION_MIN_ROLE`에 등록
- `src/lib/utils.ts` — `CURATION_STATUS_LABEL/COLOR` + `generateCurationDraftContent` + `generateInquiryResponseDraft`
- `src/lib/mock-data.ts` — `CurationNote` import, `MOCK_CURATION_NOTES` 신규 export, art_001 timeline 3건
- `src/store/useArtworkStore.ts`:
  - `CurationDraftRequest` / `InquiryResponseRequest` 타입 추가
  - 데이터 슬라이스: `curationNotes: Record<string, CurationNote[]>`
  - UI 상태: `curationDraftRequest`, `inquiryResponseRequest`
  - 인터페이스 / 구현: `openCurationDraft / closeCurationDraft / createCurationNote / updateCurationNote / regenerateCurationDraft / approveCurationNote / lockCurationNote / createCurationVersion / openInquiryResponse / closeInquiryResponse / generateInquiryResponse / sendInquiryResponse`
- `src/components/inquiry/InquirySummary.tsx` — SENT/DRAFT 응답 status 1줄 표시
- `src/components/layout/DetailPanel.tsx` — `inquiries`/`openCurationDraft`/`openInquiryResponse` 셀렉터 추가, `handleSecondary` 추가, secondary button onClick 연결, `<CurationSummary>` 삽입
- `src/app/page.tsx` — `<CurationDraftDrawer />` + `<InquiryResponseDrawer />` 마운트

## 3. 신규 파일 목록 (4)

- `src/types/curation.ts` — `CurationStatus`, `CurationNote`, `CurationNoteUpdate`
- `src/components/curation/CurationDraftDrawer.tsx` — 3-mode drawer (DRAFT 편집 / APPROVED+LOCK / LOCKED+새 버전), auto-bootstrap
- `src/components/curation/CurationSummary.tsx` — DetailPanel용 카드 (CurationNote 존재 시에만 렌더)
- `src/components/inquiry/InquiryResponseDrawer.tsx` — 2-mode drawer (DRAFT 편집 / SENT 영구 기록), auto-bootstrap

---

## 4. 핵심 patch 코드

### Curation lifecycle — 3-stage state machine

```
DRAFT           편집 가능, AI 초안
  │ approveCurationNote (MANAGER)
  ▼
APPROVED        편집 잠김, LOCK 대기
  │ lockCurationNote (MANAGER)
  ▼
LOCKED          immutable
  │ createCurationVersion (MANAGER)
  ▼
DRAFT v(n+1)    이전 버전은 영구 보존 (parentCurationId chain)
```

Contract와 의도적 차이:
- 4-stage가 아닌 3-stage — REVIEW 단계 없음 (법적 문서 아니라 검토 분리 불필요)
- LOCK 권한이 OWNER가 아닌 MANAGER (Contract.lock과 차등 — curation은 일상 운영 범위)

### `createCurationNote` — idempotent + version chain 진입

```ts
createCurationNote: (artworkId) => {
  if (!hasPermission(state.currentRole, "curation.create")) return null;

  const existing = state.curationNotes[artworkId] ?? [];
  // 활성 DRAFT/APPROVED 있으면 그 id 반환 (parallel chain 금지)
  const liveDraft = existing.find(
    (c) => c.status === "DRAFT" || c.status === "APPROVED"
  );
  if (liveDraft) return liveDraft.id;

  // version 결정 — 이전 LOCKED가 있으면 그 위에 v(n+1)
  const prevLocked = existing.find((c) => c.status === "LOCKED");
  const nextVersion = prevLocked ? prevLocked.version + 1 : 1;
  const parentId = prevLocked?.id ?? null;

  // AI 생성 → DRAFT prepend → "AXVELA AI" timeline 이벤트
  // ...
};
```

### `regenerateCurationDraft` — DRAFT 내부에서 AI 재생성

```ts
regenerateCurationDraft: (curationId) => {
  // ... locate ...
  if (foundNote.status !== "DRAFT") return; // rule_4

  const fresh = generateCurationDraftContent({...artwork});
  const updated = { ...foundNote, ...fresh, updatedAt: now };

  // "AI 재생성" timeline 이벤트 별도 emit (actor: AXVELA AI)
  // → rule_8 (한 액션 = 한 이벤트) 준수
};
```

### Inquiry 응답 — DRAFT/SENT 2-state (version chain 없음)

```ts
// 의도적 simplification: Contract/Curation 같은 version chain을 두지 않음.
// 사유: Inquiry 응대는 한 번 발송되면 끝나는 단일 텍스트이며, 재응대 필요 시
// 별도 Inquiry 또는 memo로 처리. 단순한 응답 단위에 version overhead 불필요.
generateInquiryResponse: (inquiryId) => {
  if (!hasPermission(state.currentRole, "inquiry.generate_response")) return;
  if (foundInquiry.responseStatus === "SENT") return; // rule_4 — SENT는 immutable

  const draftBody = generateInquiryResponseDraft({
    collectorName, artistName, artworkTitle,
    inquiryType, message, priceKRW,
  });

  // responseStatus === undefined인 경우 "AI 응대 초안 생성", 아니면 "재생성"
  // → 동일한 액션이지만 timeline 이벤트는 의미 차이를 기록
};

sendInquiryResponse: (inquiryId, finalText) => {
  if (foundInquiry.responseStatus !== "DRAFT") return; // 발송은 DRAFT에서만
  // OPEN → RESPONDED cascade (rule_8 — 단일 액션이지만 inquiry status도 함께)
  // ESCALATED, ON_HOLD 등 다른 status는 보존
};
```

### `generateInquiryResponseDraft` — type-aware 분기

```ts
// 단일 generator가 InquiryType 6개 (PRICE/AVAILABILITY/VIEWING/DOCUMENTATION/
// RESALE/GENERAL) 모두 처리. switch case별 응답 본문 분기.
case "PRICE":
  body = `문의주신 작품의 현재 가격은 ${formatKRW(priceKRW)}입니다. ...`;
case "VIEWING":
  body = `실견을 희망하신다고 알려주셨습니다. ...`;
case "RESALE":
  body = `재판매 작품에 대한 문의로 분류되었습니다. ...`;
// ...
```

### DetailPanel — 두 placeholder button onClick 연결

```tsx
const handleSecondary = () => {
  if (artwork.state === "DRAFT") {
    openCurationDraft(artwork.id); // → CurationDraftDrawer
    return;
  }
  if (artwork.state === "INQUIRY") {
    const inquiryList = inquiries[artwork.id] ?? [];
    // 우선순위: OPEN > ESCALATED > ON_HOLD > 기타
    const target =
      inquiryList.find((i) => i.status === "OPEN") ??
      inquiryList.find((i) => i.status === "ESCALATED") ??
      inquiryList.find((i) => i.status === "ON_HOLD") ??
      inquiryList[0];
    if (target) openInquiryResponse(target.id);
    return;
  }
};

const isSecondaryWired =
  artwork.state === "DRAFT" || artwork.state === "INQUIRY";

// READY/DEAL/PAID/CLOSED 등 다른 state는 disabled — placeholder임이 시각적으로 명확
```

### CurationDraftDrawer — auto-bootstrap

```tsx
// 드로어 열 때 노트가 없으면 즉시 v1 DRAFT 생성. 한 번의 "AI 큐레이션 초안"
// 클릭으로 편집 가능한 초안에 바로 진입. UX 매끄러움.
React.useEffect(() => {
  if (!isOpen || !artworkId || latest) return;
  createCurationNote(artworkId);
}, [isOpen, artworkId, latest, createCurationNote]);
```

---

## 5. RBAC 매트릭스 (rule_7)

| Permission | 최소 등급 | 의도 |
|---|---|---|
| `curation.create` | STAFF | 일상 운영 — 큐레이션 노트 시작 |
| `curation.update` | STAFF | DRAFT 편집 |
| `curation.approve` | MANAGER | 승인 — 편집 잠금 |
| `curation.lock` | MANAGER | LOCK — 영구 보존 (Contract.lock OWNER와 차등 — curation은 법적 문서 아님) |
| `curation.create_version` | MANAGER | LOCKED → 새 DRAFT 분기 |
| `inquiry.generate_response` | STAFF | AI 초안 생성 |
| `inquiry.send_response` | STAFF | 발송 — Inquiry status cascade |

---

## 6. 빌드 결과

```
TypeScript: 0 errors        (npx tsc --noEmit)
Next build: ✓ Compiled successfully
Route /:    54.1 kB (+5.7 kB vs STEP 15 baseline 48.4 kB)
```

5.7 kB 증가 분포 추정:
- CurationDraftDrawer (~7.2 KB raw .tsx)
- InquiryResponseDrawer (~7.5 KB raw .tsx)
- CurationSummary (~3.1 KB raw .tsx)
- 스토어 actions ~10 KB
- 라이브러리 generators 2개 ~3 KB
- DetailPanel / InquirySummary / page.tsx 패치 ~1 KB
- mock-data 시드 + timeline ~1 KB

빌드 후 minify + tree-shake로 5.7 kB로 압축됨.

---

## Manifesto 대조

| Rule | 적용 |
|---|---|
| rule_1 | CurationNote는 `artworkId`만 보유 — Artwork-first, Transaction에 의존하지 않음 (Contract와 의도적 차이) |
| rule_2 | Flow: Artwork(DRAFT) → AI 초안 → 인간 편집 → 승인 → LOCK → (필요 시 새 버전). 각 단계 cascade 명확 |
| rule_3 | **Money flow 코드 0줄 변경** — Payment / Settlement / Tax 슬라이스 / 컴포넌트 / 액션 모두 무영향 |
| rule_4 | **Document Trust Layer 강화** — CurationNote LOCK 후 immutable + version chain (Contract와 동일 정책). Inquiry 응답도 SENT 후 immutable (단일 텍스트라 version chain 없음 — rule_4의 "수정 시 새 버전" 정신은 "수정 시 새 Inquiry"로 대응) |
| rule_5 | **AI-Human Loop 명시적 4-phase 구현** — `actor: "AXVELA AI"` (생성/재생성) + `actor: actorLabel(role) + actorRole` (승인/LOCK/발송)으로 timeline에 가시화. art_001 시드가 전체 라이프사이클 데모 |
| rule_6 | State machine 무변경. AI는 Artwork state 전환을 일으키지 않음 — DRAFT 작품은 큐레이션 LOCK 후에도 DRAFT (전시 준비 상태는 별도 액션 "전시 준비 완료"로 인간이 결정) |
| rule_7 | 신규 7개 permission이 모두 `ACTION_MIN_ROLE` 매트릭스 등록. RBAC 부족 → silent no-op + UI hint (기존 패턴 일관성) |
| rule_8 | 한 사용자 액션 = 한 timeline 이벤트. AI 생성·재생성·승인·LOCK·발송 각각 1건씩 emit. cascade 이벤트 (Inquiry OPEN→RESPONDED)는 send와 같은 액션이므로 별도 이벤트 emit 안 함 (`detail`에 포함) |
| rule_11 | CurationNote는 transactionId 없음 — Artwork에 직접 종속이 의도. Contract (transactionId 보유)와의 구조적 분리 명확 |
| rule_13 | Resale loop 영향 없음 — 재판매 시점에도 직전 CurationNote 그대로 유지 (artworkId 기준이므로 transaction 갱신과 무관) |
| rule_14/16/17 | 3-Column 무변경. Sidebar/Grid/DetailPanel 레이아웃 변경 0줄. 모든 새 UI는 Drawer 안에서만 발생 |
| rule_15 | 버튼 ≤3 / Primary 1 — 모든 footer가 [닫기] / [AI 재생성] / [Primary] 3-button 구성. DRAFT의 Primary는 "승인", APPROVED는 "LOCK", LOCKED는 "새 버전 생성", Inquiry DRAFT는 "발송 처리" |
| rule_18 | **(a) 큐레이션 생성** + **(d) 거래 흐름 응대 생성** 구현. (b) 시장 분석 + (c) 가격 제안은 미구현으로 남김 |

---

## 검증 시나리오

### 1. 전체 라이프사이클 (art_001 시드 — LOCKED v1 검토)

- art_001 (READY) 선택 → DetailPanel 우측 확인
- ✓ "Curation" 섹션 노출 (v1 · 잠금)
- ✓ headline / subheadline 미리보기 표시
- ✓ Living Timeline에 3건 누적: "큐레이션 노트 LOCK" / "큐레이션 노트 승인" / "큐레이션 노트 생성 (AXVELA AI)"
- "큐레이션 상세" 클릭 → drawer 열림
- ✓ "이 문서는 잠겨 있습니다" 배너 + 잠금 시각
- ✓ headline / subheadline / body 모두 disabled + readOnly
- ✓ footer: [닫기] / [새 버전 생성] (MANAGER+ 가능)

### 2. 신규 생성 (art_006 — DRAFT 상태, 시드 없음)

- art_006 ("검은 수면 위의 빛", DRAFT) 선택
- ✓ DetailPanel "Curation" 섹션 미노출 (CurationNote 없음)
- 상태 기반 액션 → "AI 큐레이션 초안" 클릭 (DRAFT 상태에서만 활성)
- ✓ CurationDraftDrawer 자동 열림
- ✓ 즉시 v1 DRAFT 생성 (auto-bootstrap useEffect)
- ✓ Timeline에 "큐레이션 노트 생성 · v1 · AI 초안 생성 · 초안 (AXVELA AI)" 1건 emit
- ✓ DetailPanel에 Curation 섹션 즉시 노출 (status: DRAFT)
- ✓ drawer footer: [닫기] / [AI 재생성] / [승인] (MANAGER 권한 필요)

**편집 흐름:**
- headline/body 편집 → [승인] → DRAFT → APPROVED 전환
- ✓ Timeline "큐레이션 노트 승인 · v1 · 초안 → 승인 완료" 1건 emit
- ✓ 재진입 시 모든 input disabled, footer: [닫기] / [LOCK]
- [LOCK] → APPROVED → LOCKED 전환
- ✓ Timeline "큐레이션 노트 LOCK · v1 · 잠금 (영구 보존)" 1건 emit
- ✓ lockedAt 기록. footer: [닫기] / [새 버전 생성]

**새 버전 분기:**
- LOCKED 상태에서 [새 버전 생성] → v2 DRAFT 자동 생성 + AI 재생성
- ✓ Timeline "큐레이션 노트 새 버전 · v2 · AI 초안 재생성 (이전 v1는 영구 보존)" 1건 emit
- ✓ v1은 그대로 보존, v2가 latest
- ✓ drawer 자동으로 v2 DRAFT 모드로 전환 (`key={latest.id}` 재마운트)
- ✓ Document Trail 섹션에 v2 → v1 chain 표시

### 3. AI 재생성 (DRAFT 모드)

- 생성된 v1 DRAFT 편집 중
- 본문 수정 → [AI 재생성] 클릭
- ✓ 변경분이 있으면 confirm dialog ("덮어쓰여집니다, 계속할까요?")
- ✓ 확인 시 store가 generator 재호출, drawer가 새 값으로 sync (`updatedAt` ref 비교)
- ✓ Timeline "큐레이션 노트 AI 재생성 · v1 · 초안 재생성 (AXVELA AI)" 1건 emit
- ✓ 비-DRAFT (APPROVED/LOCKED)는 store에서 silent no-op

### 4. RBAC 게이트 (rule_7)

- Sidebar role switcher → STAFF로 전환
- art_006 (DRAFT) → "AI 큐레이션 초안" 클릭 → drawer 열림
- ✓ DRAFT 작성/저장 모두 가능 (curation.create/update = STAFF)
- ✓ [승인] 버튼: disabled + "Manager 권한 필요" hint (curation.approve = MANAGER)
- 프로그래매틱: `store.approveCurationNote(noteId)` STAFF 호출 시 silent no-op
- MANAGER로 전환 → [승인] 활성, 클릭 시 APPROVED
- 다시 STAFF → APPROVED 노트 열기 → [LOCK] disabled + hint

### 5. Inquiry 응답 흐름 (art_002 — INQUIRY, inq_001 OPEN)

- art_002 (INQUIRY) 선택
- 상태 기반 액션 → "AI 응대 초안" 클릭
- ✓ inq_001 (Sarah Lim, PRICE) 자동 선택 (OPEN priority)
- ✓ InquiryResponseDrawer 열림 + 즉시 응대 초안 생성
- ✓ 컬렉터 메시지 + AI 생성 응답 본문 (PRICE 분기 — 가격 + 인보이스 안내)
- ✓ Timeline "AI 응대 초안 생성 · Sarah Lim · PRICE (AXVELA AI)" 1건 emit
- ✓ InquirySummary 카드에 "AI 응대 초안 작성 중 · 방금" 1줄 노출

**편집 + 발송:**
- 본문 수정 → [발송 처리]
- ✓ inq_001.responseStatus: DRAFT → SENT
- ✓ inq_001.status: OPEN → RESPONDED (cascade)
- ✓ Timeline "Inquiry 응대 발송 · Sarah Lim · 응대 대기 → 응대 완료 (Manager · 운영자)" 1건 emit
- ✓ InquirySummary에 "응대 발송 · 방금" 표시
- 다시 drawer 열기 → SENT mode 표시
- ✓ "응대 발송 완료 — 영구 기록" 배너 + 잠금 시각
- ✓ 발송된 응답이 readOnly로 표시
- ✓ footer: [닫기]만 (재발송/재생성 불가능)

**재생성 가드:**
- 프로그래매틱: `store.generateInquiryResponse("inq_001")` SENT 상태 호출 시 silent no-op
- 프로그래매틱: `store.sendInquiryResponse("inq_001", "...")` SENT 재호출 시 silent no-op

### 6. Inquiry 타입별 응답 분기

- art_002의 inq_001b (강민정, VIEWING, RESPONDED 상태) — supporting button은 OPEN 우선이라 inq_001b는 자동 선택 안 됨
- 이 케이스는 InquiryDetailDrawer 또는 별도 진입점 필요 — STEP 16 범위 외 (현 구조에서는 OPEN 우선 응대만 지원)
- 단, generator 자체는 6개 타입 모두 분기 (PRICE/AVAILABILITY/VIEWING/DOCUMENTATION/RESALE/GENERAL)

### 7. Money Flow / Document Trust 무영향 (rule_3, rule_4 보호)

- `git diff` 기준 (개념적):
  - `src/types/payment.ts` / `src/types/settlement.ts` / `src/types/tax.ts` — 변경 0줄
  - `src/types/contract.ts` / `src/types/invoice.ts` — 변경 0줄
  - `src/types/logistics.ts` / `src/types/condition-report.ts` — 변경 0줄
  - 관련 Money/Document store 액션 — 변경 0줄
  - 관련 컴포넌트 (Settlement / Tax / Contract / Invoice / Payment / Logistics / ConditionReport drawers + summaries) — 변경 0줄

---

## 알려진 한계 (정직)

1. **시장 분석 (rule_18 (b)) 미구현** — `MOCK_TRANSACTIONS`만 있고 시장 데이터 (관심도 / 유동성 / 가격 추이) 인프라 부재. STEP 19 (rule_19 — Market Data) 선행 필요.

2. **가격 제안 (rule_18 (c)) 미구현** — Artwork edit drawer 안에 inline button 형태로 추가 가능. STEP 16.5 또는 STEP 18로 분리.

3. **Inquiry 응답에 version chain 없음** — Contract / CurationNote와 다른 모델 선택. SENT 후 수정 필요 시 새 Inquiry 생성으로 대응. rule_4 정신은 유지하나 정형성은 약간 다름. 만약 미래에 응답에도 version chain이 필요하다면 별도 도메인 객체 (`InquiryResponse`)로 승격 가능.

4. **응답 우선순위 결정 로직** — `OPEN > ESCALATED > ON_HOLD > 기타` 단순 우선순위. 같은 status 안에서는 `inquiries[artworkId]` 배열 첫 항목 (시간 역순). 다중 OPEN inquiry가 있을 때 명시적 선택 UI 없음 — InquirySummary에서 직접 inquiry 선택해서 응답하는 진입점은 미추가 (현재는 INQUIRY state supporting button만).

5. **AI 생성 결정론** — `generateContractDraftContent`와 동일 — 같은 작품에 대해 항상 같은 텍스트. 향후 LLM swap 인터페이스로 교체 가능. 현재 generator 시그니처는 그대로 유지하면서 내부 구현만 swap하면 됨.

6. **CurationNote 시드는 art_001 1건뿐** — STEP 16 범위 (시드 1건 default) 준수. art_002 (INQUIRY)에는 시드 없음 — 사용자가 작품을 DRAFT으로 되돌리거나 직접 store action 호출 필요. 데모 시 art_006으로 fresh creation 흐름 시연 권장.

7. **Curation Summary가 모든 state에 노출** — DRAFT부터 BROKERED까지. 만약 이를 DRAFT/READY에만 한정하고 싶다면 `CURATION_VISIBLE_STATES` 배열을 DetailPanel에 추가해야 함. 현재는 "documentation은 작품 lifecycle 내내 유효"라는 결정.

---

## 다음 STEP 후보

1. **STEP 17 — 가격 제안 (rule_18 (c))** (1-2시간): Artwork edit drawer 안 inline button. 신규 도메인 0. RBAC 1개 (`artwork.suggest_price` STAFF).
2. **STEP 18 — Disabled state visual polish**: STEP 14/15/16에서 누적된 disabled input의 시각 차별화. 현재는 `opacity-50 cursor-not-allowed` 일률적용.
3. **STEP 19 — Market Data (rule_19)**: rule_18 (b) 시장 분석의 선행 의존성. Artwork에 거래 기록 / 관심도 / 유동성 metric 도메인 추가.
4. **STEP 20 — Audit Log Panel** (rule_7 follow-through): actorRole 기반 timeline 필터링 + correction/version 체인 시각화. STEP 15 #1 한계와 STEP 16의 version chain 시각화 보강.
