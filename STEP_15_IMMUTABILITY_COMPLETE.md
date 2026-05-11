# STEP 15 — Logistics / Condition Report Immutability (완료)

배송 완료 (DELIVERED+) 이후의 Logistics 기록과, 작성된 모든
ConditionReport를 store + UI 양 레이어에서 완전히 immutable하게 보호.
수정 필요 시 `createConditionReportCorrection`으로 원본 보존하면서
correction 체인 생성. 빌드 통과.

---

## 1. 현재 코드 분석 요약

**STEP 15 진입 시점에 부족했던 보호:**

| Artifact | 진입 시점 보호 | STEP 15 적용 |
|---|---|---|
| Logistics — `carrierName` / `trackingNumber` / `pickupDate` / `deliveryDate` / `memo` | ❌ 어떤 status에서도 수정 가능 | ✅ DELIVERED+ lock |
| Logistics — `status` | ❌ CONDITION_CHECKED → IN_TRANSIT 되돌림 가능 | ✅ DELIVERED+ lock |
| ConditionReport — 모든 필드 | ❌ `updateConditionReport`로 자유 수정 | ✅ 완전 immutable, correction만 가능 |

**관련 액션 사전 매핑:**
- `updateLogistics(id, patch)` — 5개 필드 수정
- `updateLogisticsStatus(id, status)` — status 전환
- `createConditionReport(...)` — 새 리포트 생성 (cascade로 logistics status 자동 전환 가능)
- `updateConditionReport(id, patch)` — 기존 리포트 수정 (이번 STEP에서 deprecated 처리)

**중요 구조 발견:**
`createConditionReport`의 AFTER_DELIVERY → CONDITION_CHECKED cascade는
`updateLogisticsStatus`를 호출하지 않고 *inline `set()`*으로 처리됨.
즉 store guard를 `updateLogisticsStatus`에 추가해도 cascade는 영향 없음.
이 우회는 의도적이며 코드 코멘트로 명시.

---

## 2. 변경 파일 목록 (5)

- `src/types/condition-report.ts` — `correctsReportId?: string` optional 필드
- `src/store/useArtworkStore.ts`:
  - `isLogisticsLocked(status): boolean` 모듈-스코프 helper 추가 (단일 정의 출처)
  - 인터페이스: `createConditionReportCorrection` 추가, `updateConditionReport` @deprecated 마킹
  - `updateLogistics` 진입부 lock guard
  - `updateLogisticsStatus` 진입부 lock guard
  - `updateConditionReport` 본체를 silent no-op으로 교체
  - `createConditionReportCorrection` 신규 구현
- `src/components/logistics/LogisticsDetailDrawer.tsx` — `isLocked` 감지, 모든 input `disabled`,
  read-only 배너 + LockMiniIcon, 저장 버튼 숨김
- `src/components/logistics/ConditionReportDrawer.tsx` — edit mode 전체 read-only 전환,
  `isCreatingCorrection` state로 correction 모드 진입, 3-mode footer
  (read-only / correction / create), `disabled` prop을 `ConditionRadioGroup` + `Textarea`에 적용,
  LockMiniIcon 추가
- `ARCHITECTURE.md` — 변경이력 STEP 15 항목 추가

## 3. 신규 파일 목록 (0)

없음 — 기존 파일 확장만으로 구현

---

## 4. 핵심 patch 코드

### isLogisticsLocked helper (단일 정의 출처)

```ts
// src/store/useArtworkStore.ts (모듈 스코프)
function isLogisticsLocked(status: LogisticsStatus): boolean {
  return status === "DELIVERED" || status === "CONDITION_CHECKED";
}
```

### updateLogistics — lock guard

```ts
updateLogistics: (logisticsId, patch) => {
  const state = get();
  // ... locate foundLog ...
  if (!foundLog || !foundTxId) return;

  // STEP 15 — immutability guard (rule_4).
  // 배송 완료 이후 carrier / tracking / dates / memo는 audit data —
  // silent no-op + no timeline event.
  if (isLogisticsLocked(foundLog.status)) return;

  // ... rest of impl unchanged ...
},
```

### updateLogisticsStatus — lock guard with cascade exception

```ts
updateLogisticsStatus: (logisticsId, newStatus) => {
  const state = get();
  // ... locate foundLog ...
  if (!foundLog || !foundTxId) return;
  if (foundLog.status === newStatus) return;

  // STEP 15 — immutability guard.
  // DELIVERED + CONDITION_CHECKED은 terminal: 사용자 액션으로 전환 불가.
  // 단, createConditionReport의 AFTER_DELIVERY → CONDITION_CHECKED cascade는
  // inline set()으로 직접 처리되어 이 guard를 의도적으로 우회.
  if (isLogisticsLocked(foundLog.status)) return;

  // ... rest of impl unchanged ...
},
```

### updateConditionReport — silent no-op

```ts
/**
 * @deprecated STEP 15 — silent no-op.
 * ConditionReport는 생성 후 immutable (rule_4).
 * 수정 필요 시 createConditionReportCorrection 사용.
 */
updateConditionReport: (_reportId, _patch) => {
  return;
},
```

### createConditionReportCorrection — 신규 액션

```ts
createConditionReportCorrection: (originalReportId, input) => {
  const state = get();

  // 1. 원본 locate
  let originalReport: ConditionReport | undefined;
  let foundTxId: string | undefined;
  for (const [txId, list] of Object.entries(state.conditionReports)) {
    const r = list.find((rep) => rep.id === originalReportId);
    if (r) { originalReport = r; foundTxId = txId; break; }
  }
  if (!originalReport || !foundTxId) return null;

  const now = new Date().toISOString();
  // 2. 새 리포트 생성 — 같은 logisticsId, reportType 유지
  const correction: ConditionReport = {
    id: genId("rep"),
    logisticsId: originalReport.logisticsId,
    artworkId: originalReport.artworkId,
    transactionId: originalReport.transactionId,
    reportType: originalReport.reportType,
    conditionStatus: input.conditionStatus,
    notes: input.notes,
    imagePlaceholder: input.imagePlaceholder ?? "",
    correctsReportId: originalReportId, // 체인 형성
    createdAt: now,
    updatedAt: now,
  };

  // 3. Timeline 이벤트
  const event: TimelineEvent = {
    id: genId("ev"),
    artworkId: originalReport.artworkId,
    kind: "DOCUMENT",
    title: "Condition Report 수정본 생성",
    detail: `${REPORT_TYPE_LABEL[correction.reportType]} · ${
      CONDITION_STATUS_LABEL[correction.conditionStatus]
    } · 원본: ${originalReportId}`,
    at: now,
    actor: actorLabel(state.currentRole),
    actorRole: state.currentRole,
  };

  // 4. set — 원본은 그대로, 새 리포트 prepend
  set((s) => ({
    conditionReports: {
      ...s.conditionReports,
      [foundTxId!]: [correction, ...(s.conditionReports[foundTxId!] ?? [])],
    },
    timeline: {
      ...s.timeline,
      [originalReport!.artworkId]: [event, ...(s.timeline[originalReport!.artworkId] ?? [])],
    },
  }));

  return correction.id;
},
```

### LogisticsDetailDrawer — read-only mode

```tsx
const isLocked = log.status === "DELIVERED" || log.status === "CONDITION_CHECKED";

// 상단 배너
{isLocked && (
  <div className="mb-4 px-3 py-2.5 rounded-md bg-surface-muted border border-line">
    <div className="flex items-center gap-2">
      <LockMiniIcon />
      <p className="text-[11.5px] text-ink font-semibold tracking-tightish">
        {LOGISTICS_STATUS_LABEL[log.status]} · 읽기 전용
      </p>
    </div>
    <p className="mt-1 text-[10.5px] text-ink-subtle tracking-tightish leading-relaxed">
      배송 완료 이후 물류 기록은 감사 가능한 기록으로 보존되며 수정할 수 없습니다.
    </p>
  </div>
)}

// 모든 input: disabled={isLocked}
<TextField label="운송사" ... disabled={isLocked} />
<TextField label="운송장 번호" ... disabled={isLocked} />
<TextField label="픽업일" ... disabled={isLocked} />
<TextField label="인도일" ... disabled={isLocked} />
<Textarea label="" ... disabled={isLocked} />
<Select label="상태" ... disabled={isLocked} />

// 저장 버튼 숨김
<footer>
  <Button onClick={onClose}>닫기</Button>
  {!isLocked && <Button type="submit" variant="primary">저장</Button>}
</footer>
```

### ConditionReportDrawer — 3-mode UI

```tsx
const isEdit = ctx.mode === "edit";
const [isCreatingCorrection, setIsCreatingCorrection] = React.useState(false);
const isReadOnly = isEdit && !isCreatingCorrection;

const handleStartCorrection = () => setIsCreatingCorrection(true);
const handleCancelCorrection = () => {
  // 원본 값으로 form 롤백
  setConditionStatus(ctx.existing?.conditionStatus ?? "GOOD");
  setNotes(ctx.existing?.notes ?? "");
  setIsCreatingCorrection(false);
};

const handleSubmit = (e) => {
  e.preventDefault();
  if (isReadOnly) return;
  if (isCreatingCorrection) {
    createConditionReportCorrection(ctx.existing!.id, { conditionStatus, notes });
  } else {
    createConditionReport({ logisticsId, reportType, conditionStatus, notes });
  }
  onClose();
};

// 3-mode footer
{isReadOnly ? (
  <>
    <Button onClick={onClose}>닫기</Button>
    <Button onClick={handleStartCorrection}>수정본 작성</Button>
  </>
) : isCreatingCorrection ? (
  <>
    <Button onClick={handleCancelCorrection}>취소</Button>
    <Button type="submit" disabled={!correctionIsDirty}>저장 (수정본 생성)</Button>
  </>
) : (
  <>
    <Button onClick={onClose}>닫기</Button>
    <Button type="submit">리포트 작성</Button>
  </>
)}
```

---

## 5. 빌드 결과

```
TypeScript: 0 errors
Next build: ✓ Compiled successfully
Route /:    48.4 kB  (+0.5 kB vs STEP 14 baseline 47.9 kB)
```

---

## Manifesto 대조

| Rule | 적용 |
|---|---|
| rule_3 | Money flow (Payment / Settlement / Tax) 코드 변경 0줄 |
| rule_4 | **Document Trust Layer 완성도 강화** — Logistics + ConditionReport 모두 immutable 정책 적용. 수정 필요 시 새 record 생성 (Contract LOCK / Invoice versioning과 동일 철학) |
| rule_8 | 한 사용자 액션 = 한 timeline 이벤트. correction 생성 시 "Condition Report 수정본 생성" 이벤트 emit. 기존 기록에는 수정 이벤트 추가 안 함 |
| rule_11 | ConditionReport는 logisticsId / transactionId 둘 다 보유 — 부모 체인 무수정 |
| rule_13 | Resale loop의 Logistics 기록도 보호 — 재판매 후 historical tx의 logistics가 CONDITION_CHECKED라면 자동으로 read-only |
| rule_14/15/16/17 | 3-Column 무변경. Drawer 안에서만 변경. 추가 버튼 1개 ("수정본 작성") — read-only 모드에서 저장 버튼 자리를 대체하는 형태 |
| rule_21 | Logistics / ConditionReport 정합성 강화 — AFTER_DELIVERY → CONDITION_CHECKED cascade는 inline set으로 정상 동작 (의도적 guard 우회) |

---

## 검증 시나리오

### 1. Logistics 가드 (art_005 — log_001 IN_TRANSIT vs art_007 — log_002 CONDITION_CHECKED)

**art_005 log_001 (IN_TRANSIT):**
- LogisticsSummary → drawer 열기
- ✓ 배너 미표시, 모든 필드 활성, 저장 버튼 노출
- 정상 편집 가능

**art_007 log_002 (CONDITION_CHECKED, locked):**
- drawer 열기
- ✓ "검수 완료 · 읽기 전용" 배너 + LockMiniIcon
- ✓ 모든 input disabled
- ✓ 저장 버튼 숨김
- 프로그래매틱: `store.updateLogistics("log_002", {memo: "X"})` → silent no-op
- 프로그래매틱: `store.updateLogisticsStatus("log_002", "IN_TRANSIT")` → silent no-op

### 2. ConditionReport 가드 + correction 흐름

**기존 리포트 열람 (rep_004 BEFORE_SHIPMENT, GOOD):**
- LogisticsSummary → 리포트 카드 클릭 → drawer 열기 (edit mode)
- ✓ "Condition Report · 읽기 전용" 배너
- ✓ ConditionRadioGroup 모든 옵션 disabled (opacity-50, cursor-not-allowed)
- ✓ Textarea disabled
- ✓ footer: "닫기" + "수정본 작성" 노출

**"수정본 작성" 클릭:**
- ✓ banner가 "수정본 작성 중 — 원본은 보존됩니다" 안내로 변경 (보라 톤)
- ✓ 모든 input 활성화
- ✓ footer: "취소" + "저장 (수정본 생성)" — 변경 없으면 disabled

**값 변경 후 "저장 (수정본 생성)" 클릭:**
- ✓ `createConditionReportCorrection(rep_004, {conditionStatus, notes})` 호출
- ✓ rep_004 그대로 보존
- ✓ 새 ConditionReport 생성 — 같은 logisticsId, 같은 reportType, `correctsReportId: "rep_004"`
- ✓ Timeline 이벤트 1개: "Condition Report 수정본 생성 · BEFORE_SHIPMENT · ... · 원본: rep_004"

**"취소" 클릭 (correction 모드 중간 이탈):**
- ✓ form 값이 원본으로 롤백 (conditionStatus, notes 모두)
- ✓ read-only 모드로 복귀
- ✓ Timeline / store 변경 없음

**프로그래매틱 검증:**
- `store.updateConditionReport("rep_004", {notes: "X"})` → silent no-op (모든 reportId에 대해)
- `store.createConditionReportCorrection("nonexistent", {...})` → null 반환

### 3. Cascade 안전성 (createConditionReport AFTER_DELIVERY)

art_004 log_logBC가 DELIVERED 상태라고 가정:
- `createConditionReport({logisticsId: log_logBC, reportType: AFTER_DELIVERY, ...})`
- ✓ 새 AFTER_DELIVERY 리포트 생성
- ✓ inline set()으로 log_logBC.status: DELIVERED → CONDITION_CHECKED
- ✓ "배송 상태 변경" cascade 이벤트 emit (System actor)
- ✓ `updateLogisticsStatus`의 lock guard는 우회됨 — cascade는 set 직접 호출이므로 (의도적 design)

### 4. Money Flow / Contract / Tax 무변경 (rule_3 보호)

`git diff` 기준:
- `src/types/payment.ts` / `src/types/settlement.ts` / `src/types/tax.ts` — 변경 0줄
- `src/types/contract.ts` / `src/types/invoice.ts` — 변경 0줄
- 관련 store 액션 (registerPayment / completeSettlement / issueTaxRecord / approveContract / lockContract / sendInvoice / payInvoice) — 변경 0줄
- 관련 컴포넌트 (PaymentRegisterDrawer / SettlementDetailDrawer / TaxDetailDrawer / ContractDetailDrawer / InvoiceDetailDrawer) — 변경 0줄

---

## 알려진 한계 (정직)

1. **Correction 체인의 시각화 미구현** — `correctsReportId`로 correction 체인이 형성되지만,
   UI에서 "이 리포트는 rep_004의 수정본입니다" 같은 안내가 표시되지 않음. v1에서는
   timeline의 "원본: rep_004" 텍스트로만 추적 가능. 본격적인 체인 UI(원본 ↔ 수정본 간
   네비게이션 링크)는 STEP 16 후보.

2. **ConditionReport history 표시는 LogisticsSummary가 담당** — drawer에서는
   현재 열린 리포트만 보여줌. 같은 logistics에 여러 correction이 쌓였을 때
   목록 보기는 LogisticsSummary가 모두 표시 (시간 역순). 사용자는 각 카드를 따로 클릭해서
   확인. 통합 비교 뷰는 미구현.

3. **`updateConditionReport`는 silent no-op으로 유지** — 호출자가 디버깅 시
   "왜 변경이 안 되지?" 헷갈릴 수 있음. dev-mode console.warn 추가 가능하나 다른
   silent guard(STEP 14)와 일관성 유지를 위해 silent로 유지.

4. **AFTER_DELIVERY cascade의 의도적 guard 우회**는 코멘트로만 명시되어 있음 —
   미래에 누군가 `createConditionReport`의 cascade를 `updateLogisticsStatus` 호출로
   리팩토링하면 cascade 자체가 깨짐. 코멘트 + integration test가 더 견고할 수 있음
   (현재는 unit test 인프라 없음).

5. **Logistics가 lock 상태로 진입한 시점의 timeline 이벤트**는 별도로 추가하지 않음 —
   "배송 상태 변경" 이벤트(이미 존재) 가 그 시점의 marker 역할 충분. 사용자 스펙에
   "기록 가능"으로 표현되어 있어 옵션이었음. rule_8 (한 액션 = 한 이벤트) 정신상 미추가.

---

## 다음 STEP 후보

1. **STEP 16 — AI Layer (rule_18)** (3-4시간): 미구현 manifesto 영역
2. **STEP 17 — Audit Log Panel** (rule_7 follow-through): actorRole 기반 필터링 + correction 체인 시각화 (위 #1 후속)
3. **STEP 18 — Disabled state visual polish**: 현재 STEP 14/15에서 도입한 disabled input의 시각 차별화
4. **STEP 19 — Market Data (rule_19)**: 미구현 manifesto 영역
