# STEP 32 — Invoice FX Lock Wiring 완료

STEP 31에서 마련한 `createFXSnapshot(base, quote)` helper를 **Invoice LOCK 흐름에
연결**. 인보이스가 발송 (DRAFT → SENT/LOCKED) 시점에 환율 snapshot을 capture하여
Invoice 객체에 영구 보관. 이후 환율이 변동해도 locked Invoice의 FX 기준은 변하지
않음 — Settlement / Tax / Audit가 같은 환율 기준 사용 가능.

> rule_20 FX 100% 완성 — Provider system (STEP 31) + Invoice lock wiring (STEP 32).

핵심 결정:
- **Capture 시점은 sendInvoice 단 1곳** — DRAFT → SENT/LOCKED transition에서만.
  `createInvoiceVersion`은 새 DRAFT 생성 — FX는 **그 draft가 send될 때 별도
  capture** (각 version은 자기만의 lock 시점 → 자기만의 snapshot). PAID는
  registerPayment를 통한 status flip — 이미 locked 상태이므로 새 capture 없음.
- **KRW invoice는 fxSnapshot 없음** — 갤러리 base currency, 변환 불필요.
  `if (foundInv.currency !== "KRW")` 가드 1줄로 분기.
- **Defensive null 처리** — `createFXSnapshot`이 unknown pair / provider 실패
  등으로 null 반환 시 fxSnapshot 미저장 + invoice는 정상 lock 진행. **FX 시스템
  부재가 lock 흐름을 차단하지 않음**.
- **Direction**: invoice.currency → KRW (갤러리 base). 향후 multi-base 지원 시
  fxQuoteCurrency 필드를 그대로 활용.
- **Versioning과의 상호작용** — `createInvoiceVersion`이 만드는 새 DRAFT는
  fxSnapshot 안 가지고 시작. 사용자가 그 draft를 send하면 그 시점의 FX가
  fresh capture. 결과적으로 **각 version마다 자기 lock 시점의 FX가 보관** —
  parentInvoiceId chain을 따라가면 historic FX 변동 audit 가능.
- **Money Flow / Settlement / Tax 계산 로직 0줄 변경** — 본 STEP은 Invoice에
  FX metadata를 첨부할 뿐, 가격 계산이나 정산 로직은 무수정. 향후 STEP에서
  Settlement helper가 invoice.fxSnapshot을 read-only로 참조 가능.
- **Audit / Export 자연 호환** — TimelineEvent.detail에 FX 정보를 한 줄
  더한 형태로 노출 ("FX USD/KRW 1,380 locked at 2026-05-04"). STEP 25 audit
  export (JSON / CSV / PDF)는 detail 필드를 그대로 export하므로 별도 export
  변경 0.

---

## 1. 현재 코드 분석

**STEP 32 진입 시점 (v31 baseline):**

| 항목 | 진입 시점 | STEP 32 종료 |
|---|---|---|
| Invoice schema | id / transactionId / amount / currency / status / issuedAt / sentAt? / paidAt? / version / parentInvoiceId / lockedAt / isLocked (12 fields) | + fxSnapshot? / fxBaseCurrency? / fxQuoteCurrency? (15 fields) |
| `sendInvoice` | DRAFT → SENT + lockedAt + isLocked + timeline event | + FX capture (currency !== KRW 시) + timeline detail에 FX suffix |
| `createInvoiceVersion` | DRAFT 새 버전 생성 (parentInvoiceId chain) | **무수정** — 새 DRAFT는 FX 없이 시작, send 시 fresh capture |
| `registerPayment` (PAID flip) | invoice.status PAID + paidAt | **무수정** — 이미 locked이므로 새 capture 없음. 기존 fxSnapshot 그대로 유지 |
| InvoiceDetailDrawer LockedInvoiceView | 청구 금액 / 문서 이력 sections | + FX 환율 스냅샷 section (KRW / 없음 / 있음 3-branch) |
| Audit Export (STEP 25) | timeline event detail 그대로 | 무수정 — detail에 FX 정보 자동 포함 |

**의존 관계:**
- `src/types/invoice.ts` ← `@/types/fx` (FXRate import 추가)
- `src/store/useArtworkStore.ts` ← `@/lib/fx-provider` (createFXSnapshot import 추가) + `@/types/fx` (FXRate import 추가)
- `src/components/invoice/InvoiceDetailDrawer.tsx` — 무수정 import + 신규 FXSnapshotPanel 컴포넌트

순환 import 0건. STEP 32는 STEP 31 위에 단방향 의존.

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/types/invoice.ts` | `import type { FXRate } from "./fx"` 추가. `Invoice` interface에 optional 3 fields 추가: `fxSnapshot?: FXRate`, `fxBaseCurrency?: Currency`, `fxQuoteCurrency?: Currency`. 파일 헤더에 STEP 32 FX lock 주석 추가. 기존 12 fields 무수정. |
| `src/store/useArtworkStore.ts` | `createFXSnapshot` (from `@/lib/fx-provider`) import + `FXRate` (from `@/types/fx`) import 추가. `sendInvoice` 액션 안: `now` 계산 직후, FX capture 블럭 (15 LOC) — `if (foundInv.currency !== "KRW")` 가드, `createFXSnapshot(invoice.currency, "KRW")` 호출, null 안전 처리. `updated: Invoice` 객체에 fxSnapshot / fxBaseCurrency / fxQuoteCurrency spread. `event.detail` 문자열에 FX suffix concat (`fxDetailSuffix` 별도 변수). 기타 액션 (`createInvoiceVersion` / `registerPayment` / `updateInvoice` / 모든 Money Flow / Payment / Settlement / Tax 액션) 무수정. |
| `src/components/invoice/InvoiceDetailDrawer.tsx` | LockedInvoiceView에서 청구 금액 ↔ 문서 이력 사이에 `<Section label="FX 환율 스냅샷">` + `<FXSnapshotPanel invoice={invoice} />` 추가. 신규 컴포넌트 `FXSnapshotPanel` (60 LOC) — KRW / no-snapshot / has-snapshot 3-branch render. has-snapshot 시 환율 쌍 / 환율 / Provider / Capture 시점 / 유효 만료 / sourceNote 6 fields. Meta 컴포넌트 재사용. DraftInvoiceForm / Header / DocumentTrail / 모든 다른 부분 무수정. |
| `ARCHITECTURE.md` | rule_20 FX matrix 갱신 + STEP 32 changelog |

---

## 3. 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `STEP_32_INVOICE_FX_LOCK_COMPLETE.md` | 본 문서 |

코드 신규 파일 0개 — STEP 32는 **순수 patch** (타입 + 액션 + UI 섹션 확장).

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/lib/fx-provider.ts` (MockFXRateProvider / getFXRate / convertCurrency / createFXSnapshot) | STEP 31 그대로. 본 STEP은 호출자만. |
| `src/types/fx.ts` (FXRate / FXRateProvider) | STEP 31 그대로. |
| `src/store/useArtworkStore.ts`의 `createInvoiceVersion` | 새 DRAFT는 FX 없이 시작 (의도적 — 각 version 자기 lock 시점에 fresh capture) |
| `src/store/useArtworkStore.ts`의 `registerPayment` | 이미 locked 인보이스의 status flip만 — FX는 SENT 시점에 이미 capture됨 |
| `src/store/useArtworkStore.ts`의 `updateInvoice` | DRAFT만 수정 가능 — locked 상태 진입 전이므로 FX 무관 |
| Money Flow / Payment / Settlement / Tax 액션 (~30개) | 0줄 변경 (사용자 spec 명시) |
| Contract / Logistics / Curation / Inquiry / AI 로직 | 0줄 변경 |
| `mock-data.ts` (MOCK_INVOICES — 모두 KRW SENT/PAID) | 0줄 변경. 기존 KRW invoice는 FXSnapshotPanel의 KRW 분기로 자연 처리 ("KRW 기준 인보이스 — FX snapshot 없음"). 검증용 USD invoice는 사용자가 새 거래로 생성. |
| `src/lib/audit-export.ts` (STEP 25 JSON / CSV / PDF) | 0줄 변경 — timeline event detail에 FX 정보가 자동 포함되어 export됨 |
| Persistence (STEP 27 / 27.7 / 30) | 0줄 변경 — Invoice 새 fields는 PersistedState 일관성 자동 보존 (Record<string, Invoice[]> 그대로 직렬화) |
| 3-Column 레이아웃 / Sidebar / 모든 다른 Drawer | 0줄 변경 |
| RBAC matrix / 권한 / `package.json` | 0줄 변경 |

---

## 5. 핵심 코드

### 5.1 Invoice 타입 확장

```ts
import type { Currency } from "./transaction";
import type { FXRate } from "./fx";

export interface Invoice {
  // ... 기존 12 fields 무수정 ...

  // ── FX lock (rule_20 — STEP 32 Invoice FX Lock Wiring) ───
  /**
   * 인보이스 lock 시점에 capture된 환율 snapshot. invoice.currency가 KRW가
   * 아닐 때만 채워짐. 한 번 lock되면 이후 환율 변동에도 변하지 않음.
   * KRW invoice는 undefined. createFXSnapshot이 null 반환 시에도 undefined.
   */
  fxSnapshot?: FXRate;
  /** fxSnapshot.baseCurrency의 explicit duplicate. 쿼리 편의. */
  fxBaseCurrency?: Currency;
  /** fxSnapshot.quoteCurrency의 explicit duplicate. v1 사실상 항상 "KRW". */
  fxQuoteCurrency?: Currency;
}
```

### 5.2 sendInvoice — FX capture 블럭

```ts
const artworkId = tx.artworkId;
const now = new Date().toISOString();

// STEP 32 — FX lock at SENT/LOCKED transition.
let fxSnapshot: FXRate | undefined;
let fxBaseCurrency: Currency | undefined;
let fxQuoteCurrency: Currency | undefined;
if (foundInv.currency !== "KRW") {
  const snap = createFXSnapshot(foundInv.currency, "KRW");
  if (snap) {
    fxSnapshot = snap;
    fxBaseCurrency = snap.baseCurrency;
    fxQuoteCurrency = snap.quoteCurrency;
  }
}

// SENT + LOCK applied atomically (rule_4)
const updated: Invoice = {
  ...foundInv,
  status: "SENT",
  sentAt: now,
  isLocked: true,
  lockedAt: now,
  fxSnapshot,
  fxBaseCurrency,
  fxQuoteCurrency,
};

// Timeline detail — FX 정보를 Audit / Export에서 자연 노출
const fxDetailSuffix = fxSnapshot
  ? ` · FX ${fxSnapshot.baseCurrency}/${fxSnapshot.quoteCurrency} ${fxSnapshot.rate.toLocaleString(
      "en-US", { maximumFractionDigits: 4 }
    )} locked at ${fxSnapshot.fetchedAt.slice(0, 10)}`
  : "";

const event: TimelineEvent = {
  // ... id, artworkId, kind, title, at, actor, relatedEntityType/Id 무수정 ...
  detail: `v${updated.version} · ${formatMoney(updated.amount, updated.currency)} · ${INVOICE_STATUS_LABEL.SENT} · 이후 수정 불가${fxDetailSuffix}`,
};
```

### 5.3 FXSnapshotPanel UI — 3-branch render

```tsx
function FXSnapshotPanel({ invoice }: { invoice: Invoice }) {
  // Branch A — KRW invoice (갤러리 base currency)
  if (invoice.currency === "KRW") {
    return (
      <p className="text-[11px] text-ink-muted ...">
        KRW 기준 인보이스 — FX snapshot 없음
      </p>
    );
  }

  // Branch B — Non-KRW + snapshot 미존재 (defensive — provider null 등)
  if (!invoice.fxSnapshot) {
    return (
      <p className="text-[11px] text-ink-muted ...">
        본 버전은 FX snapshot 없이 잠겼습니다 — 정산 시 현재 환율 기준 사용
      </p>
    );
  }

  // Branch C — FX snapshot 보유
  const fx = invoice.fxSnapshot;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <Meta label="환율 쌍" value={`${fx.baseCurrency} → ${fx.quoteCurrency}`} mono />
      <Meta label="환율" value={`1 ${fx.baseCurrency} = ${fx.rate.toLocaleString(...)} ${fx.quoteCurrency}`} />
      <Meta label="Provider" value={fx.provider} mono />
      <Meta label="Capture 시점" value={formatRelativeKR(fx.fetchedAt)} />
      <Meta label="유효 만료" value={fx.validUntil ? formatRelativeKR(fx.validUntil) : "제한 없음"} />
      {fx.sourceNote && (
        <div className="col-span-2 ...">
          <p className="text-[10px] uppercase">sourceNote</p>
          <p>{fx.sourceNote}</p>
        </div>
      )}
    </div>
  );
}
```

### 5.4 Section 위치 (LockedInvoiceView)

```tsx
<Section label="청구 금액">{/* ... */}</Section>
<Divider />
<Section label="FX 환율 스냅샷">              {/* STEP 32 신규 */}
  <FXSnapshotPanel invoice={invoice} />
</Section>
<Divider />
<Section label="문서 이력">{/* ... */}</Section>
```

DraftInvoiceForm / Header / 다른 모든 부분 무수정.

---

## 6. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    73.1 kB         160 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 31 (FX Rate System) | 72.5 kB | — |
| **STEP 32 (Invoice FX Lock Wiring)** | **73.1 kB** | **+0.6** |

`tsc --noEmit` 0 error / `next build` 0 warning. **외부 npm 의존성 0개**.

---

## 7. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_4** Document Trust Layer | ✅ **강화** | Lock 시점 환율도 영구 보관 — 이후 환율 변동에도 invariance 유지 |
| **rule_5** AI-Human Loop | ✅ | FX는 system layer — AI 흐름 무영향 |
| **rule_6** State Machine | ✅ | DRAFT → SENT/LOCKED transition 시점에만 capture |
| **rule_8** Timeline = Navigation | ✅ | timeline event detail에 FX 정보 포함 → audit log / export에서 즉시 가시화 |
| **rule_11** Transaction Core | ✅ | Document chain (Invoice version chain)에 FX는 per-version 영구 보관 |
| **rule_20** FX | ✅ **100% 완성** | Provider system (STEP 31) + Invoice lock wiring (STEP 32). 향후 Settlement / Tax도 invoice.fxSnapshot read-only 참조 가능 |
| Money Flow / Payment / Settlement / Tax 계산 로직 변경 | ✅ 0줄 | |
| Contract / Logistics / AI 로직 변경 | ✅ 0줄 | |
| Invoice LOCK / Versioning 동작 | ✅ 0줄 | createInvoiceVersion 무수정, lock 흐름 무수정 |
| 실 외부 FX API 호출 | ✅ 0건 | createFXSnapshot 호출만, MockFXRateProvider가 처리 |
| 외부 라이브러리 추가 | ✅ 0개 | |
| 3-Column 레이아웃 | ✅ 무변경 | |

---

## 8. 검증 시나리오

### A — KRW invoice 발송 (기존 동작 보존)

1. KRW transaction 생성 → DEAL → invoice 발송
2. **기대**:
   - Invoice locked 정상
   - `fxSnapshot` undefined (KRW 가드)
   - Timeline detail: `v1 · ₩... · 발송 · 이후 수정 불가` (FX suffix 없음)
   - InvoiceDetailDrawer FX 섹션: "KRW 기준 인보이스 — FX snapshot 없음"

### B — USD invoice 발송 시 fxSnapshot 저장

1. 새 거래 생성 → currency를 USD로 변경 → invoice DRAFT 자동 생성
2. invoice 발송 클릭
3. **기대**:
   - `invoice.fxSnapshot.baseCurrency === "USD"`
   - `invoice.fxSnapshot.quoteCurrency === "KRW"`
   - `invoice.fxSnapshot.rate === 1380` (mock_fx_v1)
   - `invoice.fxSnapshot.provider === "mock_fx_v1"`
   - `invoice.fxBaseCurrency === "USD"`
   - `invoice.fxQuoteCurrency === "KRW"`
   - Timeline detail에 ` · FX USD/KRW 1,380 locked at 2026-05-04` suffix 추가
   - InvoiceDetailDrawer FX 섹션: 환율 쌍 / 환율 / provider / capture 시점 / 유효 만료 / sourceNote (6 rows)

### C — Locked invoice 환율 invariance

1. USD invoice 발송 후 fxSnapshot 저장됨 (rate=1380)
2. (가상) FX provider 교체로 다른 rate 적용:
   ```ts
   class NewMockProvider implements FXRateProvider {
     readonly providerId = "alt_v1";
     readonly isExternal = false;
     getRate(b, q) { return { ...rate: 1500, ... }; }
   }
   setActiveFXProvider(new NewMockProvider());
   ```
3. **기대**: 기존 locked invoice의 `fxSnapshot.rate` 여전히 **1380** (불변).
   InvoiceDetailDrawer 다시 열어도 1380 표시.

### D — createInvoiceVersion 시 새 DRAFT는 FX 없이 시작

1. USD invoice v1 발송 (fxSnapshot=1380 capture)
2. "새 버전 생성" 클릭 → v2 DRAFT 생성
3. v2를 InvoiceDetailDrawer로 열어보면 **DRAFT** mode (locked 아님)
4. v2를 send → 그 시점의 FX 가 fresh capture (mock provider 그대로면 1380, 다른 rate 설정했으면 그 rate)
5. **기대**: v1과 v2가 각자의 fxSnapshot 보유. parentInvoiceId chain을 따라 historic FX 변동 audit 가능.

### E — registerPayment → PAID 흐름 무영향

1. USD invoice v1 발송 (fxSnapshot=1380)
2. 같은 거래에 payment 등록
3. **기대**: invoice.status PAID로 flip + paidAt 채워짐. fxSnapshot 변경 없음 (이미 SENT 시점에 lock됐고, payment는 새 capture 트리거 안 함).

### F — Audit log / Export 에 FX 노출

1. USD invoice 발송 후 audit log drawer 열기
2. "Invoice 발송 · 잠금" event 카드 확인
3. **기대**: detail에 `... · FX USD/KRW 1,380 locked at 2026-05-04` 표시
4. Audit Export (JSON / CSV / PDF) 실행 → detail 컬럼에 FX 정보 포함됨 (별도 STEP 25 변경 0)

### G — Provider 실패 fallback (createFXSnapshot null)

1. Provider 강제 실패 모드 (failureRate=1 등) — 본 STEP은 helper 호출만, fallback은 STEP 31 시스템에서 처리
2. **기대**: STEP 31의 3-tier fallback이 정적 테이블로 fallback → snapshot 정상 생성. 더 깊은 케이스 (unknown pair)는 invoice.fxSnapshot undefined + UI "본 버전은 FX snapshot 없이 잠겼습니다" 분기.

### H — EUR / JPY 거래도 동일 동작

1. EUR / JPY invoice 발송
2. **기대**:
   - EUR/KRW rate 1480, JPY/KRW rate 9.2 (mock provider)
   - 각자의 fxSnapshot 저장
   - UI에 정확히 표시

### I — Money Flow / Settlement / Tax 동작 검증

1. USD invoice → payment → settlement → tax record 흐름
2. **기대**: 모든 흐름 v31 baseline과 동일. Invoice.fxSnapshot은 추가 metadata로만 존재 — Payment / Settlement / Tax 계산 0줄 변경.

### J — Persistence (STEP 27 / 27.7 / 30) 호환

1. USD invoice 발송 후 F5 새로고침
2. **기대**: invoice.fxSnapshot 영속 (PersistedState.invoices가 Record<string, Invoice[]> 통째로 직렬화 — 새 fields 자동 포함)
3. 다른 탭에서도 storage event로 동일 fxSnapshot 동기화 (STEP 27.7)
4. Mock remote에도 push (STEP 30)

### K — UI 시각 검증

InvoiceDetailDrawer 열기:
- KRW invoice: `KRW 기준 인보이스 — FX snapshot 없음` 1줄
- USD invoice (snapshot 있음):
  ```
  환율 쌍              USD → KRW
  환율                 1 USD = 1,380 KRW
  Provider             mock_fx_v1
  Capture 시점         3분 전
  유효 만료            제한 없음
  ┌─────────────────────────────────┐
  │ SOURCENOTE                      │
  │ 내부 정적 환율 테이블 (v1 mock) │
  └─────────────────────────────────┘
  ```

---

## 9. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| Settlement에서 fxSnapshot 미참조 | 본 STEP은 capture만 — settlement net 계산 시 invoice.fxSnapshot 활용 안 함 (계산 로직 무수정 spec) | 후속 STEP에서 settlement helper에 fxSnapshot 참조 추가 — 환율 변동 후에도 정산 일관성 |
| Tax record 미연결 | tax 계산도 fxSnapshot 미참조 | 동일 — 후속 STEP |
| Invoice currency 변경 후 send | DRAFT 단계에서 currency 자유 변경 가능 — send 시점에 그 currency 기준으로 FX capture | 의도적 동작 |
| 같은 통화 invoice 여러 건 | 각자 자기 시점의 fxSnapshot — 같은 mock 제공자에서는 모두 1380 | 향후 실 provider 도입 시 시간차 캡처 의미 가짐 |
| Mock 정적 테이블 | rate=1380 고정 — STEP 33에서 실 API |
| Bulk send 미지원 | invoice 1건씩 send — bulk lock 시 같은 시점 FX 보장 안 됨 | 후속 STEP — bulk 흐름 도입 시 timestamp 동기화 |
| Historic FX 검색 UI 없음 | parentInvoiceId chain을 따라 fxSnapshot history 보려면 코드 필요 | InvoiceDetailDrawer에 "이전 버전 FX 비교" 위젯 추가 가능 |
| FX 만료 시 알림 없음 | mock은 validUntil 미설정 — 실 API는 ttl 설정 가능, 만료 invoice에 visual hint 가능 | 후속 STEP |

---

## 10. 다음 STEP 후보

1. **STEP 33 — Real FX Provider** — OpenExchangeRatesProvider 실 구현. 본 STEP의 invoice.fxSnapshot이 자연스럽게 실시간 환율로 capture.
2. **STEP 34 — Settlement FX Conversion** — Settlement helper에서 invoice.fxSnapshot 참조 → KRW 정산 금액 계산. Tax도 동일.
3. **STEP 28 — Real AI Integration** — Curation / Inquiry response / Price suggestion 실 AI API.
4. **STEP 24 — Audit Filters 강화** — date range / multi-select.
5. **STEP 26 — Audit Trail Visualization** — timeline graph / heatmap.
6. **STEP 27.5 — IndexedDBAdapter** — localStorage 5MB 한계 해소.
7. **STEP 30.5 — Periodic Pull / Polling** — multi-device 시 다른 device 변경 자동 인식.
8. **STEP 35 — Document Approval Workflow** — Contract / Curation multi-step approval.
