# STEP 34 — Settlement FX Conversion 완료

STEP 32에서 Invoice에 저장된 `fxSnapshot`을 **Settlement / TaxRecord 흐름에서
read-only로 참조**. 외화 거래의 KRW 환산 기준이 invoice lock 시점으로 고정되어
Settlement → TaxRecord chain 전체에 같은 환율이 propagate. **Money Flow 계산
로직 0줄 변경, Invoice fxSnapshot 수정 0줄, Payment 로직 0줄 변경**.

> rule_3 (money flow separation) + rule_20 (FX) 통합 강화 — 각 layer가
> 독립적으로 데이터를 보유하면서 invoice를 single source of truth로 참조.

핵심 결정:
- **Read-only 참조 패턴** — Settlement/TaxRecord는 invoice.fxSnapshot 자체를
  복사하지 않고 `fxReferenceInvoiceId` + `fxRateUsed` 등 **메타데이터만 spread**.
  Invoice가 fx의 single source of truth — 추후 invoice를 lookup하면 lock 시점
  rate + provider + sourceNote 등 전체 metadata 재조회 가능.
- **Latest locked invoice 선택** — 한 transaction에 여러 version invoice가
  있을 수 있음 (createInvoiceVersion chain). createSettlement는 `isLocked &&
  currency 일치 && fxSnapshot 보유` 조건으로 필터링 후 **가장 높은 version**을
  선택. 사용자가 v3 invoice로 send했으면 settlement는 v3의 FX 사용.
- **KRW 거래는 무관** — `if (currency !== "KRW")` 가드 1줄. KRW는 모든 fx*
  필드 undefined → 기존 v1 동작 그대로 보존.
- **Defensive null-safe** — invoice가 아예 없거나 (rare), pre-STEP32 invoice
  (fxSnapshot 없음), unknown pair fallback 등 어느 케이스에서든 silent skip
  → fx* 필드 undefined → settlement / tax 정상 생성.
- **convertedTotalKRW = totalAmount * fxRateUsed** (Math.round). Settlement net
  계산 (artistShare/galleryShare/platformFee) 자체는 무수정 — 본 필드는
  **reporting / audit metadata**. 향후 보고서 / 정산 export에서 활용.
- **TaxRecord propagate** — Settlement에서 fxReferenceInvoiceId / fxRateUsed
  / taxableAmountKRW (= settlement.convertedTotalKRW) 전달. Settlement.taxableAmount /
  vatAmount / withholdingAmount 등 원 통화 기준 계산은 무수정 — 두 기준 모두
  audit-grade로 보관.
- **Timeline / Audit 자연 호환** — Settlement / TaxRecord 생성 timeline event
  detail에 ` · FX from Invoice INV-xxxx · USD/KRW 1,380` suffix. STEP 25 audit
  export (JSON / CSV / PDF)는 detail 그대로 export하므로 별도 변경 0.

---

## 1. 현재 코드 분석

**STEP 34 진입 시점 (v32 baseline):**

| 항목 | 진입 시점 | STEP 34 종료 |
|---|---|---|
| Settlement schema | id / transactionId / artworkId / totalAmount / artistShare / galleryShare / platformFee? / currency / status / settledAt? / createdAt / updatedAt (12 fields) | + fxReferenceInvoiceId? / fxRateUsed? / fxBaseCurrency? / fxQuoteCurrency? / convertedTotalKRW? (17 fields) |
| TaxRecord schema | id / transactionId / artworkId / settlementId / taxableAmount / vatAmount / withholdingAmount / currency / status / taxType / issuedAt? / createdAt / updatedAt (13 fields) | + taxableAmountKRW? / fxReferenceInvoiceId? / fxRateUsed? (16 fields) |
| createSettlement | totalAmount / shares / currency 계산 + timeline | + invoice fx lookup + fx* fields + timeline detail suffix |
| createTaxRecord | settlement → taxRecord 생성 + timeline | + settlement fx propagate + timeline detail suffix |
| completeSettlement / issueTaxRecord / registerPayment | 무수정 (이미 status flip만) | **무수정** |
| Settlement net 계산 (splitSettlement 60/40) | 원 통화 기준 | **무수정** — convertedTotalKRW는 reporting metadata |
| Tax 계산 (splitTax 10% VAT) | 원 통화 기준 | **무수정** — taxableAmountKRW는 reporting metadata |
| SettlementDetailDrawer | 총 정산액 / 분배 내역 / 정산 이력 / 거래 정보 sections | + FX 환산 기준 section (3-branch render) |
| TaxDetailDrawer | 거래 / 과세 기준 금액 / 세금 내역 / 기록 이력 sections | + FX 환산 기준 section (3-branch render) |

**의존 관계:**
- Settlement type ← Currency (transaction.ts) — 추가 import 0
- TaxRecord type ← Currency — 추가 import 0
- store action createSettlement는 invoice.fxSnapshot read-only 참조 (이미 store 내부)
- store action createTaxRecord는 settlement.fx* 참조 (이미 store 내부)
- Drawer 컴포넌트는 기존 import만 사용 — Meta / Section / formatMoney / formatRelativeKR

순환 import 0건. 본 STEP은 type 확장 + store 액션 2개 patch + drawer 2개 section 추가.

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/types/settlement.ts` | Settlement interface에 optional 5 fields 추가: `fxReferenceInvoiceId?: string` (참조 invoice id, single source of truth lookup용) / `fxRateUsed?: number` (rate copy, read-only audit) / `fxBaseCurrency?: Currency` / `fxQuoteCurrency?: Currency` / `convertedTotalKRW?: number` (reporting metadata, Math.round). 기존 12 fields 무수정. 헤더 주석에 STEP 34 FX reference 정책 추가. |
| `src/types/tax.ts` | TaxRecord interface에 optional 3 fields 추가: `taxableAmountKRW?: number` (Settlement.convertedTotalKRW propagate) / `fxReferenceInvoiceId?: string` (chain audit) / `fxRateUsed?: number`. 기존 13 fields 무수정. |
| `src/store/useArtworkStore.ts` | `createSettlement` 액션 안 totalAmount/currency 계산 직후, FX lookup 블럭 (~25 LOC) — `if (currency !== "KRW")` 가드 → `state.invoices[transactionId]`에서 `isLocked && currency 일치 && fxSnapshot 보유` 필터 → `Math.max(version)` reducer로 latest locked 선택 → fxReferenceInvoiceId / fxRateUsed / fxBaseCurrency / fxQuoteCurrency / convertedTotalKRW 계산. settlement 객체 spread + timeline event detail에 `fxDetailSuffix` concat. `createTaxRecord` 액션 안 settlement → taxRecord 생성 시 `taxableAmountKRW = settlement.convertedTotalKRW ?? undefined` + settlement.fxReferenceInvoiceId / fxRateUsed propagate + timeline detail suffix. 다른 액션 (`completeSettlement` / `issueTaxRecord` / `registerPayment` / `splitSettlement` / `splitTax` 헬퍼 / Money Flow / Payment / Contract / Logistics / Curation / Inquiry 모두) 0줄 변경. |
| `src/components/settlement/SettlementDetailDrawer.tsx` | 분배 내역 ↔ 정산 이력 사이에 `<Section label="FX 환산 기준">` + `<FXReferencePanel settlement={settlement} />` 추가. 신규 컴포넌트 `FXReferencePanel` (~50 LOC) — 3-branch render: KRW / no-fx-ref / has-fx-ref. has-fx-ref 시 환율 쌍 / 환율 / 참조 Invoice / 총 정산액 (KRW 환산) 4 fields grid + "Invoice lock 시점 환율 기준" 안내 박스. 기존 Meta / Section / formatMoney 재사용. 다른 sections / drawer wrapper / hooks / RBAC / footer 모두 무수정. |
| `src/components/tax/TaxDetailDrawer.tsx` | 세금 내역 ↔ 기록 이력 사이에 `<Section label="FX 환산 기준">` + `<FXReferencePanel taxRecord={taxRecord} />` 추가. 신규 컴포넌트 (TaxRecord 버전) — 3-branch render: KRW / no-fx-ref / has-fx-ref. has-fx-ref 시 환율 / 참조 Invoice / 과세표준 (KRW 환산) 3 fields grid + "Invoice lock 시점 환율 기준 (Settlement 경유)" 안내 박스. 다른 sections 무수정. |
| `ARCHITECTURE.md` | STEP 34 changelog 항목 추가 |

---

## 3. 신규 파일 목록

| 파일 | 역할 |
|---|---|
| `STEP_34_SETTLEMENT_FX_CONVERSION_COMPLETE.md` | 본 문서 |

코드 신규 파일 0개 — STEP 34는 **순수 patch** (type + 액션 + UI section 확장).

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/types/invoice.ts` (STEP 32 fxSnapshot 등) | 0줄 변경 — Settlement는 read-only 참조만 |
| `src/lib/fx-provider.ts` (STEP 31) | 0줄 변경 — Settlement는 invoice.fxSnapshot read만, createFXSnapshot 호출 없음 |
| `src/types/fx.ts` (STEP 31 FXRate / FXRateProvider) | 0줄 변경 |
| `splitSettlement` / `splitTax` helpers | 원 통화 기준 60/40 / 10% VAT — 무수정 (사용자 spec "Money Flow 계산 로직 최소 변경") |
| `src/store/useArtworkStore.ts`의 다른 모든 액션 (~50개) | 0줄 변경 — `completeSettlement` / `issueTaxRecord` / `registerPayment` 무수정 (status flip만, FX 추가 캡처 없음 — 의도적: createSettlement가 single capture point) |
| Money Flow / Payment / Contract / Logistics / Curation / Inquiry / Audit (STEP 20/21/23/25) / Persistence (STEP 27 / 27.7 / 30) | 0줄 변경 |
| 3-Column 레이아웃 / Sidebar / 다른 Drawer (Invoice / Artwork / Inquiry / Transaction / Payment / Logistics / ConditionReport / Curation / Audit) | 0줄 변경 |
| RBAC matrix / 권한 / `package.json` / `mock-data.ts` (모두 KRW SENT/PAID — KRW 분기로 자연 처리) | 0줄 변경 |

---

## 5. 핵심 코드

### 5.1 Settlement 타입 확장

```ts
export interface Settlement {
  // ... 기존 12 fields 무수정 ...

  // ── FX reference (STEP 34 — rule_20) ────────────────
  /**
   * Invoice.fxSnapshot을 참조한 invoice의 id. KRW 거래면 undefined.
   * Settlement는 Invoice를 single source of truth로 두고 fxSnapshot을
   * 복사하지 않음.
   */
  fxReferenceInvoiceId?: string;
  fxRateUsed?: number;
  fxBaseCurrency?: Currency;
  fxQuoteCurrency?: Currency;
  /** KRW 환산 총액 — reporting metadata, net 계산 무관 */
  convertedTotalKRW?: number;
}
```

### 5.2 createSettlement — FX lookup 블럭

```ts
// STEP 34 — FX reference. KRW 거래는 무관.
let fxReferenceInvoiceId: string | undefined;
let fxRateUsed: number | undefined;
let fxBaseCurrency: Currency | undefined;
let fxQuoteCurrency: Currency | undefined;
let convertedTotalKRW: number | undefined;

if (currency !== "KRW") {
  const txInvoices = (state.invoices[transactionId] ?? []).filter(
    (inv) => inv.isLocked && inv.currency === currency && inv.fxSnapshot
  );
  // 가장 최신 version 선택 (createInvoiceVersion chain의 head)
  const latestLocked = txInvoices.length > 0
    ? txInvoices.reduce((acc, cur) => cur.version > acc.version ? cur : acc)
    : undefined;
  if (latestLocked && latestLocked.fxSnapshot) {
    fxReferenceInvoiceId = latestLocked.id;
    fxRateUsed = latestLocked.fxSnapshot.rate;
    fxBaseCurrency = latestLocked.fxSnapshot.baseCurrency;
    fxQuoteCurrency = latestLocked.fxSnapshot.quoteCurrency;
    convertedTotalKRW = Math.round(totalAmount * fxRateUsed);
  }
}

const settlement: Settlement = {
  /* ... 기존 fields ... */
  fxReferenceInvoiceId, fxRateUsed,
  fxBaseCurrency, fxQuoteCurrency, convertedTotalKRW,
};

// Timeline detail에 FX suffix
const fxDetailSuffix = fxReferenceInvoiceId && fxRateUsed
  ? ` · FX from Invoice ${fxReferenceInvoiceId} · ${fxBaseCurrency}/${fxQuoteCurrency} ${fxRateUsed.toLocaleString(...)}`
  : "";
```

### 5.3 createTaxRecord — FX propagate

```ts
const taxableAmountKRW =
  settlement.convertedTotalKRW !== undefined
    ? settlement.convertedTotalKRW
    : undefined;

const taxRecord: TaxRecord = {
  /* ... 기존 fields ... */
  taxableAmountKRW,
  fxReferenceInvoiceId: settlement.fxReferenceInvoiceId,
  fxRateUsed: settlement.fxRateUsed,
};

const fxDetailSuffix = settlement.fxReferenceInvoiceId && settlement.fxRateUsed
  ? ` · FX from Invoice ${settlement.fxReferenceInvoiceId} · ${settlement.fxBaseCurrency}/${settlement.fxQuoteCurrency} ${settlement.fxRateUsed.toLocaleString(...)}`
  : "";
```

### 5.4 SettlementDetailDrawer FXReferencePanel — 3-branch

```tsx
function FXReferencePanel({ settlement }: { settlement: Settlement }) {
  // (A) KRW 거래
  if (settlement.currency === "KRW")
    return <p>KRW 거래 — FX 환산 없음</p>;

  // (B) Defensive — fx ref 없음 (pre-STEP32 / unknown pair / no locked invoice)
  if (!settlement.fxReferenceInvoiceId || settlement.fxRateUsed === undefined)
    return <p>본 settlement는 invoice FX snapshot 없이 생성됨 — 정산 시 환율 미반영</p>;

  // (C) FX ref 보유
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <Meta label="환율 쌍" value={`${settlement.fxBaseCurrency} → ${settlement.fxQuoteCurrency}`} mono />
      <Meta label="환율" value={`1 ${settlement.fxBaseCurrency} = ${settlement.fxRateUsed.toLocaleString(...)} ${settlement.fxQuoteCurrency}`} />
      <Meta label="참조 Invoice" value={settlement.fxReferenceInvoiceId} mono />
      {typeof settlement.convertedTotalKRW === "number" && (
        <Meta label="총 정산액 (KRW 환산)" value={formatMoney(settlement.convertedTotalKRW, "KRW")} />
      )}
      <div className="col-span-2 mt-1 px-2.5 py-1.5 rounded border border-line bg-surface-muted">
        <p>Invoice lock 시점 환율 기준 — 이후 환율 변동에도 변경되지 않습니다</p>
      </div>
    </div>
  );
}
```

### 5.5 TaxDetailDrawer FXReferencePanel — 같은 패턴

```tsx
function FXReferencePanel({ taxRecord }: { taxRecord: TaxRecord }) {
  // (A) KRW / (B) no-fx-ref → same as Settlement
  // (C) FX ref 보유:
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <Meta label="환율" value={`1 ${taxRecord.currency} = ${taxRecord.fxRateUsed.toLocaleString(...)} KRW`} />
      <Meta label="참조 Invoice" value={taxRecord.fxReferenceInvoiceId} mono />
      {typeof taxRecord.taxableAmountKRW === "number" && (
        <Meta label="과세표준 (KRW 환산)" value={formatMoney(taxRecord.taxableAmountKRW, "KRW")} />
      )}
      <div className="col-span-2 mt-1 px-2.5 py-1.5 rounded border border-line bg-surface-muted">
        <p>Invoice lock 시점 환율 기준 (Settlement 경유) — 이후 환율 변동에도 변경되지 않습니다</p>
      </div>
    </div>
  );
}
```

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    73.9 kB         161 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 31 (FX Rate System) | 72.5 kB | — |
| STEP 32 (Invoice FX Lock) | 73.1 kB | +0.6 |
| **STEP 34 (Settlement FX Conversion)** | **73.9 kB** | **+0.8** |

`tsc --noEmit` 0 error / `next build` 0 warning. **외부 npm 의존성 0개**.

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_3** Money Flow Separation | ✅ **강화** | Settlement / TaxRecord 각자 독립 데이터 + 독립 액션 + 독립 UI 유지. FX는 invoice를 single source of truth로 read-only 참조만. |
| **rule_4** Document Trust Layer | ✅ **강화** | Lock 시점 환율이 Settlement → TaxRecord chain 전체에 invariance |
| **rule_6** State Machine | ✅ | createSettlement (PENDING) / createTaxRecord (PENDING) 시점에만 capture |
| **rule_8** Timeline = Navigation | ✅ | Settlement / TaxRecord 생성 timeline event detail에 FX 정보 포함 |
| **rule_11** Transaction Core | ✅ | Artwork → Transaction → Invoice → Settlement → TaxRecord chain 그대로, fx ref가 chain audit 강화 |
| **rule_12** Settlement net 구조 | ✅ | gross/commission/expenses/net 원 통화 기준 무수정. convertedTotalKRW는 reporting metadata 별개 |
| **rule_20** FX | ✅ **확장** | Provider system (STEP 31) + Invoice lock wiring (STEP 32) + Settlement/TaxRecord propagate (STEP 34) |
| Invoice fxSnapshot 수정 | ✅ 0줄 | read-only 참조만 |
| Payment 로직 변경 | ✅ 0줄 (사용자 spec "최소화" 준수) | |
| 실 외부 FX API 호출 | ✅ 0건 | |
| Contract / Logistics / AI 로직 변경 | ✅ 0줄 | |
| 3-Column 레이아웃 | ✅ 무변경 | |
| 기존 KRW 거래 동작 | ✅ 유지 | KRW 가드 1줄 — 모든 fx* fields undefined |
| 기존 Settlement / Tax 상태 흐름 | ✅ 유지 | PENDING / READY / COMPLETED / ISSUED 흐름 무수정 |

---

## 8. 검증 시나리오

### A — KRW 거래 정상 (기존 동작 보존)

1. KRW transaction → invoice 발송 → payment 등록 → settlement 자동 생성
2. **기대**:
   - Settlement.fxReferenceInvoiceId / fxRateUsed / fxBaseCurrency / fxQuoteCurrency / convertedTotalKRW 모두 undefined
   - SettlementDetailDrawer FX 섹션: "KRW 거래 — FX 환산 없음" 1줄
   - TaxRecord 자동 생성 시 fx* 필드도 모두 undefined
   - TaxDetailDrawer FX 섹션: "KRW 거래 — FX 환산 없음" 1줄
   - Timeline detail에 FX suffix 없음

### B — USD 거래 settlement에 fxReferenceInvoiceId 저장

1. 새 transaction 생성, currency=USD
2. invoice DRAFT 자동 생성 (USD)
3. invoice 발송 → fxSnapshot 캡처 (mock_fx_v1, rate=1380)
4. payment 등록
5. settlement 자동 생성
6. **기대**:
   - `settlement.fxReferenceInvoiceId === "<USD invoice id>"`
   - `settlement.fxRateUsed === 1380`
   - `settlement.fxBaseCurrency === "USD"`
   - `settlement.fxQuoteCurrency === "KRW"`
   - `settlement.convertedTotalKRW === Math.round(totalAmount * 1380)`
   - Timeline detail: `... · FX from Invoice <id> · USD/KRW 1,380`

### C — TaxRecord에 taxableAmountKRW 전달

1. (B) 시나리오 이어서 settlement complete → TaxRecord 자동 생성
2. **기대**:
   - `taxRecord.taxableAmountKRW === settlement.convertedTotalKRW`
   - `taxRecord.fxReferenceInvoiceId === settlement.fxReferenceInvoiceId`
   - `taxRecord.fxRateUsed === 1380`
   - 기존 `taxRecord.taxableAmount` (= settlement.totalAmount, 원 USD 통화 기준) 그대로 보존
   - 기존 `taxRecord.vatAmount` (= taxableAmount * 0.10, USD 기준) 그대로 보존

### D — Invoice version chain — Settlement는 latest locked 선택

1. USD transaction, invoice v1 발송 (rate=1380)
2. v1을 createInvoiceVersion → v2 DRAFT
3. v2 발송 (rate=1380, 같은 mock provider)
4. payment 등록 → settlement 생성
5. **기대**: `settlement.fxReferenceInvoiceId === "<v2 id>"` (가장 높은 version)

### E — Latest locked가 다른 currency → skip (defensive)

1. transaction에 v1 KRW invoice + v2 USD invoice (가상의 mismatch 시나리오)
2. payment USD로 등록 → settlement currency=USD
3. **기대**: filter는 `currency === "USD"` 조건 → v2 USD invoice만 매치 → 정상 propagate. KRW invoice는 자연 제외.

### F — Pre-STEP32 invoice (fxSnapshot 없음) → defensive skip

1. USD invoice가 STEP32 이전 형태로 lock된 가상 시나리오 (fxSnapshot undefined)
2. settlement 생성 시점
3. **기대**: filter는 `inv.fxSnapshot` 조건 → 매치 0 → settlement.fxReferenceInvoiceId undefined → SettlementDetailDrawer "본 settlement는 invoice FX snapshot 없이 생성됨" 분기

### G — SettlementDetailDrawer UI 시각

1. (B) 시나리오의 USD settlement 열기
2. **기대**:
   ```
   FX 환산 기준
   ─────────────────────────────────
   환율 쌍              USD → KRW
   환율                 1 USD = 1,380 KRW
   참조 Invoice         <invoice id>
   총 정산액 (KRW 환산)  ₩...
   ┌────────────────────────────────────────┐
   │ Invoice lock 시점 환율 기준 — 이후 환율 │
   │ 변동에도 변경되지 않습니다              │
   └────────────────────────────────────────┘
   ```

### H — TaxDetailDrawer UI 시각

1. (C) 시나리오의 USD tax record 열기
2. **기대**:
   ```
   FX 환산 기준
   ─────────────────────────────────
   환율                 1 USD = 1,380 KRW
   참조 Invoice         <invoice id>
   과세표준 (KRW 환산)   ₩...
   ┌────────────────────────────────────────┐
   │ Invoice lock 시점 환율 기준 (Settlement│
   │ 경유) — 이후 환율 변동에도 변경되지     │
   │ 않습니다                                │
   └────────────────────────────────────────┘
   ```

### I — Audit / Export FX 노출

1. (B) 시나리오 후 audit log drawer 열기
2. "Settlement 생성" / "TaxRecord 생성" event 카드 확인
3. **기대**: detail에 `... · FX from Invoice <id> · USD/KRW 1,380` 표시
4. Audit Export (JSON / CSV / PDF) 실행 → detail 컬럼에 FX 정보 포함됨 (별도 STEP 25 변경 0)

### J — Money Flow / Payment / 거래 흐름 무영향

1. 임의 시나리오 — KRW 거래 / USD 거래 / 둘 다 cycle 완료
2. **기대**:
   - Payment 등록 / Transaction status 흐름 (INQUIRY → DEAL → PAID → CLOSED) 모두 v32 baseline과 동일
   - splitSettlement (60/40) / splitTax (10% VAT) 결과 무변경
   - Settlement.totalAmount / artistShare / galleryShare / TaxRecord.taxableAmount / vatAmount 원 통화 기준 그대로

### K — Persistence (STEP 27 / 27.7 / 30) 호환

1. USD settlement / TaxRecord 생성 후 F5 새로고침
2. **기대**: settlement.fxReferenceInvoiceId 등 새 fields 영속 (PersistedState.settlements / taxRecords가 Record<string, T[]> 통째로 직렬화 — 자동 포함)
3. 다른 탭에서도 storage event로 동기화

### L — Confidence: invoice fxSnapshot 수정 0 검증

1. settlement 생성 후 invoice 객체 검증
2. **기대**: invoice.fxSnapshot 변경 없음 (Settlement는 단순 read만)
3. 정적 source check: `state.invoices = ...` 형태로 invoice를 mutate하는 경로 createSettlement 안에 0건

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| Settlement net 계산은 원 통화 기준만 | `splitSettlement(totalAmount)` 60/40 split이 USD 기준 — KRW 환산 net은 보고 metadata만 | 후속 STEP에서 settlement helper에 currency-aware net 변형 추가 가능 |
| Tax 계산도 원 통화 기준만 | VAT 10%는 USD 기준 — 실제 한국 세무는 KRW 기준 필요 | tax helper에 currency-aware split 추가, 또는 별도 export step |
| Invoice fx snapshot 부재 → 단순 skip | "환율 미반영" 메시지만 — 자동 fallback rate 사용 안 함 | `createFXSnapshot(currency, "KRW")` 호출로 settlement 시점 캡처 옵션 추가 가능 |
| Latest locked invoice 한 건만 참조 | v3 발송 후 v4 DRAFT가 있어도 v3을 사용 (lock 안된 v4는 미사용) — payment가 v3 기준이면 정상 | 의도된 동작 |
| Multi-currency payment 미지원 | 한 transaction이 여러 통화 payment 받으면 currency=txPayments[0].currency 단일 — 본 STEP은 전제 |  payment-currency 병합 후속 STEP |
| Settlement update 후 FX 동기화 부재 | settlement update 액션이 v1에 없음 — 만약 future에 추가되면 fx ref 재계산 정책 필요 | 후속 STEP |
| Invoice 변경 후 settlement도 retroactive 변경? | 본 STEP은 No — invoice는 lock되어 변경 불가, settlement도 한 번 생성되면 fx ref 그대로 | 의도된 동작 (lock = lock) |
| Mock 정적 환율 | rate 1380 고정 — STEP 33에서 실 API |
| Reporting / Export currency 통일 부재 | 일부 invoice는 USD, 일부는 KRW — 갤러리 전체 보고서 작성 시 통일 환산 필요 | 후속 STEP — reporting layer 도입 |

---

## 10. 다음 STEP 후보

1. **STEP 33 — Real FX Provider** — OpenExchangeRatesProvider 실 구현. STEP 31 mock을 swap만으로 교체. STEP 32/34 wiring은 무수정 작동.
2. **STEP 35 — Multi-currency Reporting Layer** — 갤러리 전체 매출 / 정산 / 과세 리포트에 KRW 통일 환산. settlement.convertedTotalKRW / taxRecord.taxableAmountKRW 활용.
3. **STEP 36 — Settlement Currency-aware Net** — `splitSettlement` helper에 currency 파라미터 + net 계산 시 fx 활용 옵션.
4. **STEP 28 — Real AI Integration** — Curation / Inquiry response / Price suggestion 실 AI API.
5. **STEP 24 — Audit Filters 강화** — date range / multi-select.
6. **STEP 26 — Audit Trail Visualization** — timeline graph / heatmap.
7. **STEP 27.5 — IndexedDBAdapter** — localStorage 5MB 한계 해소.
8. **STEP 30.5 — Periodic Pull / Polling** — multi-device 시 다른 device 변경 자동 인식.
9. **STEP 37 — Document Approval Workflow** — Contract / Curation multi-step approval.
