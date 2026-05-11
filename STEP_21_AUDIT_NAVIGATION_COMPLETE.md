# STEP 21 — Audit Log Navigation + Chain Detail (완료)

STEP 20에서 만든 read-only Audit Log Panel을 **navigation layer**로 승격.
각 audit 카드 클릭 시 해당 도메인 객체의 drawer가 직접 열림. version /
correction chain은 카드 내부 expanded area로 인라인 가시화.

> rule_8 — "Timeline = Navigation" 완성.

핵심 결정:
- **TimelineEvent에 optional 필드 2개 확장** — `relatedEntityType` +
  `relatedEntityId`. 기존 필드(`id / artworkId / kind / title / detail / at /
  actor / actorRole`)는 0줄 변경. 옵션 필드만 추가해 backward-compatible.
- **Resolver는 두 필드 직접 lookup** (`src/lib/audit-navigation.ts`).
  STEP 21 초안에서 시도한 timestamp / version 추출 heuristic은 폐기 — store
  action이 정확한 ref를 emit하므로 추측이 불필요.
- **Audit Log 닫고 target drawer 열기** — 같은 React turn에 두 store action
  을 dispatch. drawer 두 개가 z-index 위에서 겹치지 않도록.
- **3-column 레이아웃 / Drawer 신규 추가 0** — STEP 20 AuditLogDrawer 1개
  내부 동작만 확장.

---

## 1. 현재 코드 분석

**STEP 21 진입 시점 상태 (STEP 20 직후):**

| 항목 | 진입 시점 | 비고 |
|---|---|---|
| Audit Log 분류·필터·강조 | ✅ STEP 20 완성 | rule_8 navigation 부분 미구현 |
| 카드 클릭 동작 | ❌ 없음 — 카드는 정보 표시만 | rule_8 "Timeline = Navigation" 미충족 |
| 도메인 drawer open 액션 | ✅ 모두 존재 | 9개 (Contract / Curation / Invoice / Settlement / Tax / Logistics / ConditionReportEdit / Inquiry / InquiryResponse) |
| TimelineEvent → 도메인 객체 ref | ❌ 없음 | heuristic 매칭 외 결정론적 경로 부재 |
| chain 정보 추출 | ⚠️ chainHint 문자열만 ("v1 → v2") | 실제 parentId / currentId 등 표시 미흡 |

**Drawer ↔ open action 매핑 (검증 완료):**

| Target kind | Store action 시그니처 | Drawer |
|---|---|---|
| `contract` | `openContractDetail(contractId)` | ContractDetailDrawer |
| `curation` | `openCurationDraft(artworkId)` — auto-resolves latest | CurationDraftDrawer |
| `invoice` | `openInvoiceDetail(invoiceId)` | InvoiceDetailDrawer |
| `settlement` | `openSettlementDetail(settlementId)` | SettlementDetailDrawer |
| `tax` | `openTaxDetail(taxRecordId)` | TaxDetailDrawer |
| `logistics` | `openLogisticsDetail(logisticsId)` | LogisticsDetailDrawer |
| `conditionReport` | `openConditionReportEdit(reportId)` | ConditionReportDrawer (edit mode) |
| `inquiry` | `openInquiryDetail(inquiryId)` | InquiryDetailDrawer |
| `inquiryResponse` | `openInquiryResponse(inquiryId)` | InquiryResponseDrawer |

---

## 2. 변경 파일 목록 (1)

`src/types/artwork.ts` — TimelineEvent에 optional 필드 2개 추가 + 신규 union type.

`src/lib/audit-navigation.ts` — Field-based resolver로 재작성 (272 LOC).
이전 STEP 21 초안의 heuristic 매칭 코드 삭제.

`src/lib/mock-data.ts` — 5개 artwork × 25개 seed timeline 이벤트에
`relatedEntityType` + `relatedEntityId` 필드 채움 (entity ID가 seed에 존재
하는 이벤트만).

`src/store/useArtworkStore.ts` — 39개 timeline emit 사이트 중 37개에
관계 ref 채움 (STATE_CHANGE 2개는 의도적 비워둠 — 상태 변경 자체에는 도메인
객체 없음).

---

## 3. 변경 파일 목록 (2) — 파일별 상세

### 3.1 `src/types/artwork.ts`

**기존:** TimelineEvent 8개 필드 (`id` / `artworkId` / `kind` / `title` /
`detail?` / `at` / `actor?` / `actorRole?`).

**STEP 21 추가:** `relatedEntityType?` + `relatedEntityId?` (모두 optional).

```ts
export type TimelineEntityType =
  | "contract"
  | "curation"
  | "inquiry"
  | "inquiry_response"
  | "invoice"
  | "logistics"
  | "condition_report"
  | "settlement"
  | "tax"
  | "transaction";

export interface TimelineEvent {
  // ... 기존 8개 필드 0줄 변경 ...

  /**
   * STEP 21 — Optional reference for audit log navigation (rule_8).
   * Set by store actions that emit events tied to a specific domain entity.
   */
  relatedEntityType?: TimelineEntityType;
  /**
   * For "curation" this is the artworkId; for all other types the entity's
   * primary id.
   */
  relatedEntityId?: string;
}
```

설계 의도:
- **Optional**이므로 기존 seed event / 기존 emit 호출자 모두 변경 없이 컴파일
  통과. 점진 도입 가능.
- **Curation은 예외적으로 artworkId**를 쓴다. CurationDraftDrawer는 latest
  CurationNote를 자동 해석하므로 artworkId만 있으면 충분 (rule_1 — Artwork
  직접 종속).
- `transaction` 타입은 union에 포함하지만 audit-navigation에서 의도적으로
  EMPTY 반환 — Transaction은 container이고 contained Invoice/Contract/
  Settlement로 직접 진입하는 게 audit context에서 더 유용 (사용자 spec 미열거).

### 3.2 `src/lib/audit-navigation.ts` (272 LOC, 신규 작성)

**역할:** TimelineEvent → (AuditTarget | null, AuditChainDetail | null).

**구조:**
- `resolveAuditEventTarget(event, artworkId, store)` — 단일 진입점.
  `event.relatedEntityType` switch로 9개 case 라우팅. 각 case는 (target
  생성, chain 빌더 호출)만 담당.
- `buildCurationChain` / `buildContractChain` / `buildInvoiceChain` /
  `buildConditionReportChain` — 도메인 객체에서 `parent*Id` /
  `correctsReportId` 직접 lookup해서 AuditChainDetail 빌드.
- `lookupById` — generic id 기반 lookup across tx-keyed slices.

**Public types** (STEP 20에서 import하던 것들 그대로 유지):
- `AuditTarget` — 9-kind tagged union
- `AuditChainDetail` — { type, currentId, currentLabel, parentId, parentLabel }
- `AuditNavigationInfo` — { target, chain }
- `AuditNavigationStoreView` — 9개 store slice의 read-only view

**핵심 코드:**

```ts
export function resolveAuditEventTarget(
  event: TimelineEvent,
  artworkId: string,
  store: AuditNavigationStoreView
): AuditNavigationInfo {
  const type = event.relatedEntityType;
  const id = event.relatedEntityId;
  if (!type || !id) return EMPTY;

  switch (type) {
    case "curation":
      return {
        target: { kind: "curation", artworkId: id },
        chain: buildCurationChain(event, id, store.curationNotes),
      };

    case "contract":
      return {
        target: { kind: "contract", id },
        chain: buildContractChain(id, artworkId, store.transactions, store.contracts),
      };

    case "invoice":
      return {
        target: { kind: "invoice", id },
        chain: buildInvoiceChain(id, artworkId, store.transactions, store.invoices),
      };

    case "settlement":
      return { target: { kind: "settlement", id }, chain: null };

    case "tax":
      return { target: { kind: "tax", id }, chain: null };

    case "logistics":
      return { target: { kind: "logistics", id }, chain: null };

    case "condition_report":
      return {
        target: { kind: "conditionReport", id },
        chain: buildConditionReportChain(id, artworkId, store.transactions, store.conditionReports),
      };

    case "inquiry":
      return { target: { kind: "inquiry", id }, chain: null };

    case "inquiry_response":
      return { target: { kind: "inquiryResponse", id }, chain: null };

    case "transaction":
      // Spec 미열거 — Transaction container 자체는 audit에서 비활성.
      return EMPTY;

    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return EMPTY;
    }
  }
}
```

`default` case의 `_exhaustive: never` 패턴: 향후 `TimelineEntityType`에 새
타입을 추가했는데 라우팅을 빠뜨리면 **컴파일 타임에 에러** — 신뢰 보장.

### 3.3 `src/store/useArtworkStore.ts` (37 emit 사이트 갱신)

전체 39개 timeline emit 사이트 중 37개에 ref 추가. 도메인별 정리:

| 도메인 | 액션 | emit 사이트 | relatedEntity |
|---|---|---|---|
| **Curation** (5) | createCurationNote | 1 | `curation`, `artwork.id` |
| | regenerateCurationDraft | 1 | `curation`, `artwork.id` |
| | approveCurationNote | 1 | `curation`, `foundArtId` |
| | lockCurationNote | 1 | `curation`, `foundArtId` |
| | createCurationVersion | 1 | `curation`, `artwork.id` |
| **Contract** (6) | createContract | 1 | `contract`, `contract.id` |
| | updateContract | 1 | `contract`, `contractId` |
| | submitContractForReview | 1 | `contract`, `contractId` |
| | approveContract | 1 | `contract`, `contractId` |
| | lockContract | 1 | `contract`, `contractId` |
| | createContractVersion | 1 | `contract`, `newContract.id` |
| **Settlement** (3) | registerPayment cascade | 1 | `settlement`, `newSettlement.id` |
| | createSettlement | 1 | `settlement`, `settlement.id` |
| | completeSettlement | 1+1 | `settlement` + `transaction` (cascade) |
| **Tax** (3) | completeSettlement cascade | 1 | `tax`, `newTaxRecord.id` |
| | createTaxRecord | 1 | `tax`, `taxRecord.id` |
| | issueTaxRecord | 1 | `tax`, `taxRecordId` |
| **Logistics** (3) | createLogistics | 1 | `logistics`, `logistics.id` |
| | updateLogisticsStatus | 1 | `logistics`, `logisticsId` |
| | createConditionReport cascade | 1 | `logistics`, `parentLog.id` |
| **Condition Report** (2) | createConditionReport main | 1 | `condition_report`, `report.id` |
| | createConditionReportCorrection | 1 | `condition_report`, `correction.id` |
| **Inquiry** (3) | transitionState INQUIRY auto | 1 | `inquiry`, `newInquiry.id` |
| | updateInquiry | 1 | `inquiry`, `inquiryId` |
| | transitionState resale auto | 1 | `inquiry`, `resaleInquiry.id` |
| **Inquiry Response** (2) | generateInquiryResponse | 1 | `inquiry_response`, `inquiryId` |
| | sendInquiryResponse | 1 | `inquiry_response`, `inquiryId` |
| **Invoice** (4) | transitionState INVOICE auto | 1 | `invoice`, `newInvoice.id` |
| | sendInvoice | 1 | `invoice`, `invoiceId` |
| | createInvoiceVersion | 1 | `invoice`, `newInvoice.id` |
| | registerPayment paymentEvent | 1 | `invoice`, `invoice.id` (no payment viewer drawer — route to invoice) |
| **Transaction** (5) | transitionState TRANSACTION auto | 1 | `transaction`, `newTransaction.id` |
| | transitionState resale | 1 | `transaction`, `resaleTx.id` |
| | updateTransaction | 1 | `transaction`, `transactionId` |
| | updateBuyer | 1 | `transaction`, `transactionId` |
| | updatePrice | 1 | `transaction`, `transactionId` |
| **STATE_CHANGE** (2 — 의도적 미설정) | transitionState | 1 | (none — clickable 아님) |
| | registerPayment cascade | 1 | (none — clickable 아님) |

총 37 (clickable) + 2 (non-clickable STATE_CHANGE) = 39.

### 3.4 `src/lib/mock-data.ts` (25 seed 이벤트 갱신)

5개 artwork seed timeline에 ref 추가. entity ID가 seed에 존재하는 이벤트만:

| Artwork | 이벤트 ID | relatedEntity |
|---|---|---|
| art_001 (READY) | ev_cur_001_create / approve / lock | curation × art_001 (×3) |
| art_002 (INQUIRY) | ev_2 / ev_3 (Inquiry) | inquiry × inq_001 (×2) |
| | ev_1 (STATE_CHANGE), ev_4 (CR title without seed) | (none) |
| art_003 (DEAL) | ev_5a (Invoice 발송) | invoice × inv_001 |
| | ev_5b / ev_5c (Contract) | contract × ctr_001 (×2) |
| | ev_5 / ev_6 (Transaction) | transaction × tx_001 (×2) |
| | ev_6a (Invoice 자동) | invoice × inv_001 |
| | ev_8 / ev_9 (Inquiry) | inquiry × inq_002 (×2) |
| | ev_7 (STATE_CHANGE) | (none) |
| art_004 (PAID) | ev_15 / ev_13 (Logistics) | logistics × log_001 (×2) |
| | ev_14 (CR) | condition_report × rep_001 |
| | ev_10b (Settlement) | settlement × stl_001 |
| | ev_10a (PAYMENT) | invoice × inv_002 (route to invoice viewer) |
| | ev_11 (Transaction 자동) | transaction × tx_002 |
| | ev_12 (Inquiry) | inquiry × inq_003 |
| | ev_10 (STATE_CHANGE) | (none) |
| art_007 (BROKERED) | ev_r03 (Ownership 전환) | inquiry × inq_006 |
| | ev_r02 (New Transaction) | transaction × tx_005 |
| | ev_r01 (Resale 시작 STATE_CHANGE) | (none) |

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/components/audit/AuditLogDrawer.tsx` | STEP 20 + 이전 STEP 21 초안에서 navigation 인프라 이미 작성 — `dispatchTarget`, `AuditEventCard`의 `onClick`/`onKeyDown`, `ChainDetailBlock`, `NavigationFooter` 모두 그대로 작동. resolver 시그니처 호환되므로 외부 변경 0줄. |
| `src/lib/audit-helpers.ts` | STEP 20 분류·필터·체인 hint 로직 그대로 유지. |
| `src/components/layout/DetailPanel.tsx` | "감사 로그 보기" 진입점 STEP 20에서 추가됨. |
| `src/components/ui/Button.tsx`, `ButtonHint.tsx` | STEP 17 disabled 폴리시 무관. |
| `src/store/useArtworkStore.ts`의 도메인 엔티티 구조 | Inquiry / Transaction / Invoice / Settlement / Tax / Contract / Logistics / ConditionReport / CurationNote 0줄. |
| 모든 도메인 타입 파일 (`types/inquiry.ts`, `types/transaction.ts`, ...) | 0줄. |
| 3-column 레이아웃 (`page.tsx`, `Sidebar.tsx`, `ArtworkGrid.tsx`) | rule_14 — 무변경. |
| FX / Logistics / RBAC 코드 | rule_3 / rule_7 무관. |
| Money Flow (Payment / Settlement / Tax) 도메인 로직 | rule_3 — 분리·로직 모두 무변경 (timeline ref만 추가). |

---

## 5. 핵심 코드 — AuditEventCard 클릭 가능 처리 (STEP 20에서 작성, STEP 21에서 활성화)

```tsx
// src/components/audit/AuditLogDrawer.tsx
const navigation: AuditNavigationInfo = React.useMemo(
  () => resolveAuditEventTarget(event, artworkId, navStore),
  [event, artworkId, navStore]
);

const target = navigation.target;
const chain = navigation.chain;
const isClickable = target !== null;

return (
  <article
    onClick={isClickable ? handleClick : undefined}
    onKeyDown={isClickable ? handleKeyDown : undefined}
    role={isClickable ? "button" : undefined}
    tabIndex={isClickable ? 0 : undefined}
    aria-label={isClickable ? `${event.title} — 관련 기록 열기` : event.title}
    className={cn(
      "rounded-md border bg-surface p-3.5 transition-colors outline-none",
      hasEmphasis ? "border-line-strong" : "border-line",
      isClickable
        ? "cursor-pointer hover:bg-surface-muted hover:border-line-strong focus-visible:border-ink"
        : "cursor-default"
    )}
  >
    {/* domain badge / version pill / chain pill / actor pill ... */}

    {chain && <ChainDetailBlock chain={chain} />}
    <NavigationFooter target={target} />
  </article>
);
```

dispatch 흐름:

```tsx
const dispatchTarget = React.useCallback(
  (target: AuditTarget) => {
    closeAuditLog();
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
  [closeAuditLog, /* ... */]
);
```

---

## 6. 빌드 결과

```
Route (app)                              Size     First Load JS
┌ ○ /                                    59 kB           146 kB
└ ○ /_not-found                          873 B            88 kB
+ First Load JS shared by all            87.1 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 15 baseline | 48.4 kB | — |
| STEP 16 (AI Layer) | 54.1 kB | +5.7 |
| STEP 17 (Disabled Polish) | 54.5 kB | +0.4 |
| STEP 20 (Audit Log) | 57.2 kB | +2.7 |
| **STEP 21 (Audit Navigation)** | **59.0 kB** | **+1.8** |

`tsc --noEmit` 0 error, `next build` 0 error / 0 warning. ESLint 통과.

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_1** Artwork-First | ✅ | navigation은 Artwork 직접 종속 (artworkId가 항상 컨텍스트). Curation은 artworkId 직접 사용 — Single Source of Truth 강화. |
| **rule_2** Flow System | ✅ | TimelineEvent → AuditNavigationInfo → AuditTarget → drawer open → 해당 도메인 객체 인라인 표시. 기능 나열 아님. |
| **rule_3** Money Flow Separation | ✅ | Payment / Settlement / Tax 각각 독립 ref + 독립 drawer. Settlement → Tax cascade도 timeline에 두 별도 이벤트로 emit. |
| **rule_4** Document Trust Layer | ✅ | Contract / Curation / Invoice / ConditionReport 모두 chain detail 가시화. parentId / correctsReportId 추적이 audit 카드에서 직접 보임. LOCK 이벤트는 LOCKED 객체로 navigate. |
| **rule_5** AI-Human Loop | ✅ | "AI 응대 초안 생성" → InquiryResponseDrawer (AI 초안 + 인간 편집 + 발송 단계). "큐레이션 노트 생성" → CurationDraftDrawer (3-mode AI/HUMAN/LOCKED). |
| **rule_6** State Machine | ✅ | STATE_CHANGE 이벤트(전환 자체)는 별도 객체 없음 → non-clickable. 도메인 객체 변경(예: Settlement 완료)은 그 객체 drawer로 navigate. |
| **rule_7** RBAC | ✅ | actor type pill (STAFF / MANAGER / OWNER / SYSTEM / AI) 그대로 표시. drawer 내부의 RBAC 가드는 drawer 자체가 처리 — navigation은 권한 무관. |
| **rule_8** Timeline = Navigation | ✅ **완성** | rule_8의 핵심 약속 충족. 모든 의미있는 timeline 이벤트가 클릭 가능 + 도메인 drawer로 진입. |
| **rule_9** Work Queue | ✅ | 영향 없음 — Work Queue는 별도 진입점 유지. |
| **rule_11** Transaction Core | ✅ | Settlement / Tax / Contract / Invoice 모두 Transaction 종속 구조 보존. resolver는 transaction-keyed slice를 통해 lookup. |
| **rule_14** Layout 3-Column | ✅ | 무변경. |
| **rule_17** Layer UI | ✅ | Drawer만 사용. 같은 turn에 audit 닫고 target 열기 → 시각적 충돌 없음. |
| **rule_18** AI Role | ✅ | AI 이벤트(actor "AXVELA AI")도 클릭 가능 — drawer 내부에서 AI 초안 + 인간 검토 단계 그대로 표시. |

---

## 8. 검증 시나리오

### 시나리오 A — Curation chain (art_001)

1. Sidebar에서 "art_001" 선택
2. DetailPanel에서 Living Timeline 헤더 → "감사 로그 보기" 클릭
3. AuditLogDrawer 열림. art_001은 READY state + LOCKED CurationNote v1
4. "큐레이션 노트 LOCK" 카드 클릭
5. **기대**: AuditLogDrawer 닫힘 + CurationDraftDrawer (LOCKED 모드) 열림.
   v1 본문 표시. 편집 disabled.
6. CurationDraftDrawer 닫고 → "감사 로그 보기" 다시 → "큐레이션 노트 생성"
   카드 클릭 → 같은 LOCKED v1 drawer (latest 자동 해석)

### 시나리오 B — Contract resale + chain detail

1. Sidebar에서 "art_007" (BROKERED) 선택
2. "감사 로그 보기" → "Resale 시작 / New Transaction 생성 / Ownership 전환
   준비" 3개 카드 표시
3. "Ownership 전환 준비" 클릭 → InquiryDetailDrawer (inq_006, resale inquiry)
   열림. collector 미입력 상태 표시.

### 시나리오 C — Settlement → Tax cascade trace

1. art_004 (PAID, Settlement PENDING)에서 PaymentRegisterDrawer 열고 결제 등록
2. AuditLogDrawer에서 "결제 등록" / "Settlement 자동 생성" / "DEAL → PAID"
   3개 새 이벤트 확인
3. "결제 등록" 클릭 → InvoiceDetailDrawer 열림 (rule: payment에 별도 viewer
   drawer 부재 → invoice viewer로 라우팅)
4. "Settlement 자동 생성" 클릭 → SettlementDetailDrawer (PENDING) 열림
5. Settlement 완료 액션 → Tax cascade 발생 → 새 audit 이벤트 "TaxRecord 자동
   생성" 클릭 가능

### 시나리오 D — STATE_CHANGE 비활성

1. art_002 (INQUIRY)의 audit log 열기
2. "READY → INQUIRY" 카드는 cursor-default + "연결된 객체 없음" italic
   안내 + chevron 부재
3. 키보드로 Tab → 카드는 focus되지 않음 (tabIndex 미설정)

### 시나리오 E — Chain detail 표시

1. (시연용 시드 부족 시) Contract 새 버전 생성 액션 실행 → "Contract 새
   버전 생성" 이벤트 emit
2. AuditLogDrawer에서 해당 카드 → "체인 상세" 박스 인라인 표시:
   - 현재: `ctr_xxx · v2`
   - 부모: `ctr_yyy · v1`
3. 카드 클릭 → ContractDetailDrawer (v2 DRAFT) 열림. drawer 내부의 version
   chain 탐색기와 일관.

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 처리 |
|---|---|---|
| Transaction navigation 미지원 | 사용자 spec 미열거. relatedEntityType="transaction" 이벤트 5개는 ref는 채웠으나 resolver에서 `EMPTY` 반환 (clickable 아님). | TransactionDetailDrawer 라우팅 spec 확장 시 audit-navigation에 case 추가 + AuditTarget union 확장. |
| Payment viewer drawer 부재 | PaymentRegisterDrawer는 등록용. "결제 등록" 이벤트는 invoice drawer로 라우팅. | 별도 PaymentDetailDrawer 도입 시 라우팅 변경 가능. |
| art_002 "Condition Report v1 — LOCKED" seed | seed에 일치하는 ConditionReport 객체 없음 (legacy 시드 — title만 존재). non-clickable. | 데모용 seed 보강 또는 그대로 두기. |
| Cross-artwork audit | AuditLogDrawer는 단일 artwork 범위. 시스템 전체 audit view 부재. | STEP 23 후보 — Owner 권한 별도 page. |
| Chain detail 중첩 | v3 → v2 → v1 chain 시 카드는 v2의 parent v1만 표시. | 더 깊은 chain 시연 필요해지면 ChainDetailBlock에 multi-step 표시 옵션 추가. |
| Chain detail only on creation events | "Contract LOCK" 같은 LOCK 이벤트에는 chain 표시 없음. 의미상 LOCK은 chain step이 아니므로 의도적. | n/a |

---

## 10. 다음 STEP 후보

1. **STEP 22 — explicit `domain?: AuditDomain` 필드** — heuristic 분류기
   (audit-helpers.ts) 단순화. relatedEntityType과는 별도 필드. 분류 정확도
   향상 + 신규 도메인 도입 시 매칭 패턴 갱신 부담 제거.
2. **STEP 23 — Cross-artwork Audit View** — Owner 권한 전용 page. 시스템
   전체 timeline + 작품별 / 액터별 / 도메인별 필터.
3. **STEP 24 — Transaction navigation routing** — `transaction` case 활성화
   + ContractDetailDrawer가 contract version chain explorer를 inline 보여
   주는 것처럼, TransactionDetailDrawer에 contained Invoice/Contract/
   Settlement 인라인 navigation.
4. **STEP 25 — Audit Log export** — JSON / CSV / PDF로 대내외 감사용 출력
   (rule_4 trust layer 강화).
