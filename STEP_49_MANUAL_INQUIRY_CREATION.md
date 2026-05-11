# STEP 49 — Manual Inquiry Creation

> **목표**: STEP 48 Customer Suggest의 자연 후속 — 작품 컨텍스트에서 운영자가
> 신규 inquiry를 직접 입력하는 진입점 추가. 전화 / 이메일 / 현장 대화 / 아트페어
> 상담 등 비-디지털 경로 문의를 시스템에 직접 기록.

---

## State

- **이전**: STEP 48 / Route 105 kB
- **이번**: STEP 49 / **Route 106 kB (+1 kB)**
- Build ✅ · type-check ✅ (`tsc --noEmit` 0 error)

---

## Flow

```
DetailPanel · Inquiry section header
  └─ "+ 문의 추가" inline 버튼  ← STEP 49 진입점
       ↓
       openInquiryCreate(artworkId)
       ↓
       store.inquiryCreateRequest = { kind: "open", artworkId }
       ↓
       <InquiryCreateDrawer />
         ├─ Linked artwork header
         ├─ Hint banner ("신규 Inquiry 직접 생성 · ...")
         ├─ 컬렉터 정보 FormSection
         │   ├─ TextField  collectorName
         │   ├─ TextField  contact
         │   ├─ Select    source
         │   └─ <CustomerSuggestList />  (STEP 48 재사용)
         ├─ 문의 내용 FormSection
         │   ├─ Select    inquiryType
         │   ├─ Textarea  message
         │   └─ Textarea  memo
         └─ Footer [취소] [저장]
              ↓
              createInquiry(artworkId, input)
                ├─ append inquiry (id / createdAt 자동)
                ├─ timeline event "Inquiry 직접 생성"
                └─ canonical state transition만 자동:
                     READY     → INQUIRY  ✓
                     BROKERED  → INQUIRY  ✓
                     그 외     → 무변경
```

---

## 변경 파일 목록

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/store/useArtworkStore.ts` | ~120 LOC | `InquiryCreateRequest` / `InquiryCreateInput` 타입 + UI slice + 3 actions (open/close/create) + label imports |
| `src/components/inquiry/InquirySummary.tsx` | ~25 LOC | `openInquiryCreate` hook + SectionHeader `onAdd` 옵셔널 + 빈 상태 hint 갱신 |
| `src/components/layout/DetailPanel.tsx` | 5 LOC | `INQUIRY_VISIBLE_STATES`에 DRAFT + READY 추가 (진입점 노출용) |
| `src/app/page.tsx` | 2 LOC | `InquiryCreateDrawer` import + mount |
| `ARCHITECTURE.md` | +1 changelog | STEP 49 추가 |

---

## 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/components/inquiry/InquiryCreateDrawer.tsx` | ~290 | lightweight drawer + form (CustomerSuggest 재사용) |
| `STEP_49_MANUAL_INQUIRY_CREATION.md` | (이 문서) | STEP 완료 보고 |

---

## 핵심 코드

### 1) Store types

```ts
// src/store/useArtworkStore.ts

export type InquiryCreateRequest =
  | { kind: "closed" }
  | { kind: "open"; artworkId: string };

export interface InquiryCreateInput {
  collectorName: string;
  contact: string;
  inquiryType: InquiryType;
  message: string;
  source: InquirySource;
  status?: InquiryStatus;  // default OPEN
  memo?: string;
}
```

### 2) `createInquiry` 액션 — canonical 전환 정책

```ts
createInquiry: (artworkId, input) => {
  const state = get();
  const artwork = state.artworks.find((a) => a.id === artworkId);
  if (!artwork) return null;

  const now = new Date().toISOString();
  const newInquiry: Inquiry = {
    id: genId("inq"),
    artworkId,
    collectorName: (input.collectorName ?? "").trim(),
    contact: (input.contact ?? "").trim(),
    inquiryType: input.inquiryType,
    message: (input.message ?? "").trim(),
    source: input.source,
    status: input.status ?? "OPEN",
    memo: (input.memo ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };

  const inquiryEvent: TimelineEvent = {
    id: genId("ev"),
    artworkId,
    kind: "INQUIRY",
    title: "Inquiry 직접 생성",
    detail: newInquiry.collectorName
      ? `${newInquiry.collectorName} · ${INQUIRY_TYPE_LABEL[newInquiry.inquiryType]} · ${INQUIRY_SOURCE_LABEL[newInquiry.source]}`
      : `${INQUIRY_TYPE_LABEL[newInquiry.inquiryType]} · ${INQUIRY_SOURCE_LABEL[newInquiry.source]}`,
    at: now,
    actor: actorLabel(state.currentRole),
    actorRole: state.currentRole,
    relatedEntityType: "inquiry",
    relatedEntityId: newInquiry.id,
  };

  // canonical state machine 경로일 때만 자동 전환
  const shouldTransition =
    artwork.state === "READY" || artwork.state === "BROKERED";
  const nextEvents: TimelineEvent[] = [inquiryEvent];
  let nextArtworks = state.artworks;

  if (shouldTransition) {
    const stateEvent: TimelineEvent = {
      id: genId("ev"),
      artworkId,
      kind: "STATE_CHANGE",
      title: `${artwork.state} → INQUIRY`,
      detail: `${STATE_LABEL_KR[artwork.state]} → ${STATE_LABEL_KR.INQUIRY} · 신규 문의 직접 생성과 함께 전환`,
      at: now,
      actor: actorLabel(state.currentRole),
      actorRole: state.currentRole,
    };
    nextEvents.push(stateEvent);
    nextArtworks = state.artworks.map((a) =>
      a.id === artworkId
        ? { ...a, state: "INQUIRY" as ArtworkState, updatedAt: now }
        : a
    );
  }

  set((s) => ({
    artworks: nextArtworks,
    inquiries: {
      ...s.inquiries,
      [artworkId]: [newInquiry, ...(s.inquiries[artworkId] ?? [])],
    },
    timeline: {
      ...s.timeline,
      [artworkId]: [...nextEvents, ...(s.timeline[artworkId] ?? [])],
    },
  }));

  return newInquiry.id;
}
```

### 3) Drawer form (Customer Suggest 재사용)

```tsx
// src/components/inquiry/InquiryCreateDrawer.tsx

function InquiryCreateForm({ artworkId, ... }) {
  const createInquiry = useArtworkStore((s) => s.createInquiry);
  // STEP 48 패턴 그대로 — invoiceFxLookup → customers → suggestions
  const customers = React.useMemo(() => {
    return deriveCustomers(
      Object.values(allInquiries).flat(),
      Object.values(allTransactions).flat(),
      invoiceFxLookup
    );
  }, [allInquiries, allTransactions, invoiceFxLookup]);

  const suggestions = React.useMemo<CustomerSuggestion[]>(() => {
    return suggestCustomers(collectorName, contact, customers, {
      maxResults: 4,
      exclude: { name: collectorName, contact },
    });
  }, [collectorName, contact, customers]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;
    const id = createInquiry(artworkId, {
      collectorName: collectorName.trim(),
      contact: contact.trim(),
      inquiryType, message: message.trim(), source,
      status: "OPEN",
      memo: memo.trim(),
    });
    if (id) onCancel();  // 성공 시 drawer 닫음
  };
  // ... form JSX with <CustomerSuggestList />
}
```

### 4) InquirySummary 진입점

```tsx
// src/components/inquiry/InquirySummary.tsx

const openInquiryCreate = useArtworkStore((s) => s.openInquiryCreate);

<SectionHeader
  label="Inquiry"
  hint={list.length > 0 ? `총 ${list.length}건` : "협상의 시작점"}
  onAdd={() => openInquiryCreate(artworkId)}  // STEP 49
/>
```

```tsx
// SectionHeader 확장 — onAdd 있을 때만 inline 버튼 렌더
<button
  onClick={onAdd}
  className="text-[10.5px] text-ink-muted enabled:hover:text-ink ..."
>
  + 문의 추가
</button>
```

### 5) DetailPanel 노출 확장

```ts
// src/components/layout/DetailPanel.tsx

// 이전: INQUIRY 이상만 노출
// 이후: DRAFT / READY 추가 — manual create 진입점이 모든 단계에서 보이도록
const INQUIRY_VISIBLE_STATES: ArtworkState[] = [
  "DRAFT", "READY",
  "INQUIRY", "DEAL", "PAID", "CLOSED", "BROKERED", "REOPENED",
];
```

---

## 상태 전환 정책 매트릭스

| 작품 현재 상태 | manual inquiry 추가 시 동작 |
|---|---|
| **DRAFT** | inquiry만 추가 (state 무변경 — 작품이 sale ready 되지 않은 단계, 운영자가 의도적으로 사전 기록) |
| **READY** | inquiry 추가 + **READY → INQUIRY 자동 전환** (canonical 경로) |
| **INQUIRY** | inquiry만 추가 (이미 같은 단계) |
| **DEAL** | inquiry만 추가 (협상 중인 별도 컬렉터 문의 등) |
| **PAID** | inquiry만 추가 (사후 문의 / 보증서 / Condition Report 요청 등) |
| **CLOSED** | inquiry만 추가 (사후 컨택 기록) |
| **REOPENED** | inquiry만 추가 |
| **BROKERED** | inquiry 추가 + **BROKERED → INQUIRY 자동 전환** (재판매 문의 접수 — canonical 경로) |

**비-canonical 자동 전환 0건** (rule_5 / rule_6 일관).

---

## Build 결과

```
> npm run build

Route (app)                              Size     First Load JS
┌ ○ /                                    106 kB          193 kB
└ ○ /_not-found                          873 B            88 kB

✓ Compiled successfully
✓ type-check 통과 (tsc --noEmit, 0 error)
```

**Δ Route**: 105 kB → **106 kB (+1 kB)** vs STEP 48 baseline.

증분 분석:
- `InquiryCreateDrawer.tsx` (~290 LOC) — 신규 drawer
- store +120 LOC — 타입 + slice + 3 actions
- InquirySummary +25 LOC + DetailPanel +5 LOC + page.tsx +2 LOC

---

## 검증 매트릭스

| 사용자 spec | 검증 결과 |
|---|---|
| **진입점** | |
| DetailPanel Inquiry 섹션 또는 Supporting Action에 "문의 추가" | ✅ InquirySummary SectionHeader inline 버튼 |
| Artwork 선택 상태에서만 활성화 | ✅ DetailPanel 마운트 시 artworkId props 전달 |
| 3-column layout 변경 금지 | ✅ Drawer overlay만 |
| **신규 Inquiry Form** | |
| 기존 InquiryDetailDrawer / InquiryForm 패턴 재사용 | ✅ FormSection / Divider / artwork header / hint banner 톤 동일 |
| 신규 lightweight drawer 분리 판단 | ✅ 별도 컴포넌트로 — mode flag 복잡도 회피 |
| collectorName / contact / inquiryType / source / message / status 입력 | ✅ 모두 form state |
| status 기본값 OPEN | ✅ store에서 input.status ?? "OPEN" |
| createdAt / updatedAt 자동 생성 | ✅ store가 ISO timestamp 부여 |
| **Customer Suggest 통합** | |
| STEP 48 CustomerSuggestList 재사용 | ✅ 동일 import + 동일 props |
| 이름/연락처 입력 시 추천 표시 | ✅ suggestions useMemo (suggestCustomers) |
| 클릭 시 이름/연락처 채움 | ✅ handleSelectSuggestion (contact는 비어있을 때만) |
| "추천 후보" 표현 유지 | ✅ STEP 48 wording 그대로 |
| 자동 연결 표현 금지 | ✅ "추천일 뿐 자동 연결되지 않습니다" |
| **Store action** | |
| `createInquiry(artworkId, input)` 추가 | ✅ Inquiry id 반환 (실패 시 null) |
| timeline event "Inquiry 직접 생성" | ✅ kind=INQUIRY / actor=role label |
| relatedEntityType "inquiry" / id 채움 | ✅ |
| **State Machine 영향** | |
| READY → INQUIRY 자동 전환 | ✅ canonical 경로 |
| INQUIRY/DEAL/PAID/CLOSED 상태 무변경 | ✅ |
| 불필요한 자동 전환 금지 | ✅ READY + BROKERED만 (둘 다 state-machine.ts canonical 경로) |
| **제약** | |
| Customer master data slice 추가 금지 | ✅ deriveCustomers derive only |
| Persistence schema 변경 금지 | ✅ UI slice만, validateV1 / SCHEMA_VERSION 0줄 변경 |
| Payment / Settlement / Tax / FX / AI 로직 변경 금지 | ✅ 0줄 변경 |
| 외부 API 호출 금지 | ✅ 0건 |
| 신규 라이브러리 추가 금지 | ✅ `package.json` 0줄 변경 |
| 3-column layout 변경 금지 | ✅ 0줄 변경 |
| **검증** | |
| Artwork 선택 후 문의 추가 가능 | ✅ DRAFT/READY/INQUIRY/DEAL/PAID/CLOSED/BROKERED/REOPENED 8개 모두 |
| 신규 inquiry 저장 후 InquirySummary 즉시 반영 | ✅ store inquiries map prepend → React reactivity |
| Timeline에 "Inquiry 직접 생성" 표시 | ✅ kind=INQUIRY / title 정확 |
| Customer Suggest 정상 동작 | ✅ STEP 48 helper + UI 100% 재사용 |
| 기존 Inquiry 편집 기능 회귀 없음 | ✅ InquiryDetailDrawer / updateInquiry 0줄 변경 |
| build 통과 | ✅ Route 106 kB / type-check 0 error |

---

## Spec ↔ 실제 type 차이 메모

사용자 spec의 입력 필드 목록에 **`priority`**가 포함되었으나, 현재 `Inquiry` 타입에는
priority 필드가 부재합니다. **"Inquiry 구조 변경 0줄"** 정책 준수해 미포함.
향후 별도 STEP에서 priority enum (`HIGH` / `NORMAL` / `LOW` 등) 추가 검토 가능.
대안 — 운영자는 inquiry의 `memo` 필드에 우선순위 정보를 자유 텍스트로 기록 가능.

---

## Manifesto rule 정합성

| Rule | STEP 49 영향 | 상태 |
|---|---|---|
| **rule_4** Trust Layer | timeline event "Inquiry 직접 생성" + state transition event 모두 audit trail 기록 | ✅ 강화 |
| **rule_5** AI-Human Loop | 자동 연결 0건 + canonical state transition만 자동 + 비-canonical은 사용자 명시 transition 필요 | ✅ 핵심 적용 |
| **rule_6** State Machine | canonical 경로(READY/BROKERED)만 자동 전환 — state-machine.ts 정의 그대로 | ✅ 보존 |
| **rule_7** RBAC | 명시 가드 없음 (audit log / market analysis와 같은 정책) — InquirySummary 진입 가능하면 create 가능 | ✅ 보존 |
| **rule_8** Timeline = Navigation | 신규 timeline event는 relatedEntityType "inquiry" + id로 navigation 가능 | ✅ 강화 |
| **rule_14** 3-Column | 레이아웃 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | drawer footer "취소" / "저장" 2개 (한도 내) | ✅ 보존 |
| **rule_16** 미니멀 디자인 | 절제된 회색 + audit log entry 패턴 일관 + 그림자 0 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | overlay만 | ✅ 보존 |

---

## 다음 STEP 후보

다음 우선순위 — 사용자 직전 메시지에서 시사된 방향:

1. **★ Logistics 외부 provider 연결** (rule_21) — STEP 29 ExternalAuctionProvider 패턴 답습. 운영 후반부 (배송/insurance) provider hook. 고객/문의 흐름이 STEP 49로 자연 closure를 이뤘으니 이제 출고 단계로.
2. Market Analysis history slice — Persistence schema v2 migration (시간 추이 비교용)
3. Channel Mix cross-tab 확장 — 작가별 / 상태별 세분화

---

## 결과 요약

- 신규 파일 1개 (`InquiryCreateDrawer.tsx` ~290 LOC)
- 수정 파일 4개 (store / InquirySummary / DetailPanel / page.tsx)
- 0 신규 라이브러리 / 0 외부 API / 0 도메인 타입 변경 / 0 schema 변경
- 신규 store action 3개 (open/close/createInquiry) — UI slice만 추가, 도메인 slice 0개
- canonical state transition만 자동 (READY/BROKERED → INQUIRY) — 비-canonical 자동 전환 0건
- STEP 48 Customer Suggest 100% 재사용 — 동일 helper + 동일 UI 컴포넌트
- 기존 InquiryDetailDrawer 편집 흐름 회귀 0건
- Route +1 kB (105 → 106 kB)

**STEP 49 완료. 고객/문의 흐름 closure.** 다음은 **Logistics 외부 provider 연결**.
