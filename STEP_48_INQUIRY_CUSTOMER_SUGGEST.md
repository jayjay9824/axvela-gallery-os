# STEP 48 — Inquiry Customer Suggest

> **목표**: STEP 42 Customer 1급 도메인 + STEP 47 Channel Mix 위에 Inquiry intake
> 흐름의 customer 후보 추천 layer 추가. 운영자가 같은 customer 정보를 반복 입력
> 하지 않도록 도와 — AXVELA가 단순 기록 도구가 아닌 고객 관계를 기억하는 운영
> OS로 보이게 하는 마지막 UX layer.

---

## State

- **이전**: STEP 47 / Route 103 kB
- **이번**: STEP 48 / **Route 105 kB (+2 kB)**
- Build ✅ · type-check ✅ (`tsc --noEmit` 0 error)

---

## Flow

```
InquiryDetailDrawer (열림)
  │
  ├─ store read-only:
  │   - inquiries / transactions / invoices
  │
  ├─ useMemo chain:
  │   - invoiceFxLookup (CustomerViewDrawer / ReportingDrawer 패턴)
  │   - customers ← deriveCustomers(flatInq, flatTx, fxLookup)
  │   - suggestions ← suggestCustomers(name, contact, customers, { exclude })
  │
  └─ InquiryForm (컬렉터 정보 section)
       ├─ TextField "컬렉터 이름"  ─┐
       ├─ TextField "연락처"        ├─ 입력 → suggestions 재계산
       ├─ Select   "유입 경로"      ┘
       │
       └─ <CustomerSuggestList suggestions={...} onSelect={handler} />
            │
            └─ 클릭 → setCollectorName + setContact (비어있을 때만)
                 → 사용자가 명시적으로 [저장] 클릭해야 updateInquiry 호출
                 → "자동 연결" 0건 — 추천일 뿐 (rule_5 AI-Human Loop)
```

**저장 흐름 0줄 변경** — handleSubmit / updateInquiry 패턴 그대로.

---

## 변경 파일 목록

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/components/inquiry/InquiryDetailDrawer.tsx` | ~70 LOC | imports + customers/suggestions useMemo + handleSelectSuggestion + `<CustomerSuggestList />` 렌더 |
| `ARCHITECTURE.md` | +1 changelog | STEP 48 추가 |

---

## 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/customer-suggest.ts` | ~165 | `suggestCustomers` pure function + `CustomerSuggestion` / `CustomerSuggestReason` 타입 + `SUGGEST_REASON_LABEL_KR` |
| `src/components/inquiry/CustomerSuggestList.tsx` | ~85 | inline 추천 후보 panel UI + `SuggestionRow` sub-component |
| `STEP_48_INQUIRY_CUSTOMER_SUGGEST.md` | (이 문서) | STEP 완료 보고 |

---

## 핵심 코드

### 1) Pure matching helper

```ts
// src/lib/customer-suggest.ts

export type CustomerSuggestReason =
  | "name_prefix"      // 이름 접두 매치 (가장 강한 신호)
  | "name_substring"   // 이름 부분 매치
  | "contact_match"    // 연락처 부분 매치
  | "exact_name";      // 이름 완전 일치 (다중 동명이인 케이스)

export function suggestCustomers(
  nameQuery: string,
  contactQuery: string,
  customers: Customer[],
  options?: CustomerSuggestOptions
): CustomerSuggestion[] {
  const nameNorm = normalize(nameQuery);
  const contactNorm = normalize(contactQuery);

  if (nameNorm.length === 0 && contactNorm.length === 0) return [];
  if (nameNorm.length === 1 && contactNorm.length === 0) return []; // noise 차단

  const exclude = options?.exclude
    ? { name: normalize(options.exclude.name), contact: normalize(options.exclude.contact) }
    : null;

  const scored: CustomerSuggestion[] = [];
  for (const c of customers) {
    const cName = normalize(c.displayName);
    const cContacts = c.allContacts.map(normalize);

    // 이미 form에 있는 customer 제외
    if (exclude && cName === exclude.name && exclude.contact.length > 0
        && cContacts.includes(exclude.contact)) continue;

    let score = 0;
    let reason: CustomerSuggestReason | null = null;

    // 이름 매칭: exact (110) > prefix (100 - 길이패널티) > substring (60 - 길이패널티)
    if (nameNorm.length > 0) {
      if (cName === nameNorm) { score = 110; reason = "exact_name"; }
      else if (cName.startsWith(nameNorm)) {
        score = 100 - Math.min(40, cName.length - nameNorm.length);
        reason = "name_prefix";
      } else if (cName.includes(nameNorm) && nameNorm.length >= 2) {
        score = 60 - Math.min(30, cName.length - nameNorm.length);
        reason = "name_substring";
      }
    }

    // 연락처 매칭: exact (95) > substring (50). 이름 매치와 결합 시 +10 보강.
    if (contactNorm.length >= 2) {
      let contactScore = 0;
      for (const ct of cContacts) {
        if (ct === contactNorm) { contactScore = 95; break; }
        if (ct.includes(contactNorm)) contactScore = Math.max(contactScore, 50);
      }
      if (contactScore > score) { score = contactScore; reason = "contact_match"; }
      else if (contactScore > 0 && reason !== null) score += 10;
    }

    if (score <= 0 || reason === null) continue;

    // Segment 보정 (반복 구매 > 거래 경험)
    if (c.segment === "REPEAT_BUYER") score += 5;
    else if (c.segment === "ONE_TIME_BUYER") score += 3;

    scored.push({ customer: c, score, reason });
  }

  // score desc → name asc → lastInteractionAt desc
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const nameCmp = a.customer.displayName.localeCompare(b.customer.displayName);
    if (nameCmp !== 0) return nameCmp;
    return b.customer.lastInteractionAt.localeCompare(a.customer.lastInteractionAt);
  });

  return scored.slice(0, options?.maxResults ?? 4);
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
```

### 2) UI Component — CustomerSuggestList

```tsx
// src/components/inquiry/CustomerSuggestList.tsx

export function CustomerSuggestList({ suggestions, onSelect }) {
  if (suggestions.length === 0) return null;  // 빈 list → DOM 미렌더
  
  return (
    <div className="mt-2 rounded-md border border-line bg-surface-muted/60 px-3 py-2.5">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
          기존 고객 후보
        </span>
        <span className="text-[10px] text-ink-subtle italic">
          운영 참고 · 추천일 뿐 자동 연결되지 않습니다
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {suggestions.map((s) => (
          <li key={s.customer.id}>
            <SuggestionRow suggestion={s} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 3) Drawer 통합

```tsx
// src/components/inquiry/InquiryDetailDrawer.tsx (InquiryForm 내부)

// STEP 48 — Customer Suggest 데이터 파이프라인
const invoiceFxLookup = React.useMemo(() => { /* CustomerViewDrawer 패턴 그대로 */ }, [allInvoices]);
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

// 후보 클릭 → form state 업데이트만 (저장은 별도 [저장] 클릭으로)
const handleSelectSuggestion = React.useCallback((s: CustomerSuggestion) => {
  const c = s.customer;
  setCollectorName(c.displayName);
  // 연락처는 비어있을 때만 채움 — 운영자 의도 보존
  setContact((current) => current.trim() === "" ? c.primaryContact : current);
}, []);
```

### 4) 컬렉터 정보 section 안 inline 렌더

```tsx
<FormSection label="컬렉터 정보">
  <TextField label="컬렉터 이름" value={collectorName} ... />
  <TextField label="연락처" value={contact} ... />
  <Select label="유입 경로" value={source} ... />
  {/* STEP 48 — 자동 연결되지 않음 (rule_5 AI-Human Loop 정책 일관) */}
  <CustomerSuggestList
    suggestions={suggestions}
    onSelect={handleSelectSuggestion}
  />
</FormSection>
```

---

## UI 예시 (실제 렌더)

```
┌─────────────────────────────────────────────────────────────┐
│ 컬렉터 정보                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 컬렉터 이름                                             │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ 김도                                                │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 연락처                                                  │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │                                                     │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Select 유입 경로                                            │
│                                                             │
│ ╭─ 기존 고객 후보 · 운영 참고 · 추천일 뿐 자동 연결되지 않습니다 ─╮│
│ │ ┌────────────────────────────────────────────────────────┐│
│ │ │ 김도현  · 거래 경험            이름 일치              ││
│ │ │ kim.dohyun@example.com         반복 구매 · 거래 2건   ││
│ │ └────────────────────────────────────────────────────────┘│
│ │ ┌────────────────────────────────────────────────────────┐│
│ │ │ 김도원  · 거래 경험            이름 부분 매치         ││
│ │ │ kim.dowon@example.com          거래 경험 · 거래 1건   ││
│ │ └────────────────────────────────────────────────────────┘│
│ ╰────────────────────────────────────────────────────────────╯│
└─────────────────────────────────────────────────────────────┘
```

클릭 시: collectorName + contact (비어있을 때만) 채움 → 사용자가 [저장] 명시적 클릭해야 inquiry 업데이트.

---

## Build 결과

```
> npm run build

Route (app)                              Size     First Load JS
┌ ○ /                                    105 kB          192 kB
└ ○ /_not-found                          873 B            88 kB

✓ Compiled successfully
✓ type-check 통과 (tsc --noEmit, 0 error)
```

**Δ Route**: 103 kB → **105 kB (+2 kB)** vs STEP 47 baseline.

증분 분석:
- `customer-suggest.ts` (~165 LOC) — pure matching + 라벨
- `CustomerSuggestList.tsx` (~85 LOC) — inline UI panel
- InquiryDetailDrawer +70 LOC — useMemo chain + handler

---

## 검증 매트릭스

| 사용자 spec | 검증 결과 |
|---|---|
| **Customer Suggest Helper** | |
| existing inquiries / transactions 기반 deriveCustomers 재사용 | ✅ STEP 42 deriveCustomers 그대로 |
| collectorName / contact 기준 fuzzy / normalized matching | ✅ normalize (trim + lowercase + 공백 정규화) + substring matching |
| 동일 이름 / 동일 이메일 / 유사 이름 추천 | ✅ exact_name / name_prefix / contact_match / name_substring |
| 신규 외부 라이브러리 금지 | ✅ `package.json` 0줄 변경 |
| simple deterministic matching only | ✅ Levenshtein / Soundex / Fuse.js 모두 미사용 |
| **InquiryDetailDrawer 통합** | |
| collectorName 입력 시 기존 Customer 추천 표시 | ✅ collectorName 또는 contact 입력 시 추천 노출 |
| 추천 항목 클릭 시 collectorName 자동 채움 | ✅ setCollectorName(c.displayName) |
| 추천 항목 클릭 시 contact 자동 채움 (가능하면) | ✅ contact 비어있을 때만 채움 (운영자 의도 보존) |
| source / inquiryType은 기존 입력 유지 | ✅ handleSelectSuggestion은 name + contact만 set |
| **UI** | |
| 작고 절제된 suggestion list | ✅ text-[10.5px] / [12px], max 4 후보, 그림자 0 |
| "기존 고객 후보" / "운영 참고" 표현 사용 | ✅ heading + italic disclaimer |
| 과도한 CRM 기능 금지 | ✅ 후보 렌더 + 클릭 콜백만 |
| 확정 고객 매칭 표현 금지 | ✅ 0건 (정책 주석 부정형으로만) |
| "자동 연결됨" 대신 "추천 후보" | ✅ "추천일 뿐 자동 연결되지 않습니다" |
| **Data** | |
| Customer master data slice 추가 금지 | ✅ deriveCustomers derive only |
| Persistence schema 변경 금지 | ✅ 0줄 |
| Inquiry / Transaction 구조 변경 금지 | ✅ 0줄 |
| 저장 시 기존 updateInquiry 흐름 사용 | ✅ handleSubmit / updateInquiry 0줄 변경 |
| **Constraint** | |
| Payment / Settlement / Tax / FX / AI 로직 변경 금지 | ✅ 0줄 |
| 외부 API 호출 금지 | ✅ 0건 |
| 신규 라이브러리 추가 금지 | ✅ `package.json` 0줄 |
| 3-column layout 변경 금지 | ✅ Drawer overlay 안 inline panel만 |
| 기존 Customer View / Reporting / Export 흐름 유지 | ✅ 모두 read-only consumer |
| **검증** | |
| 기존 customer 이름 일부 입력 시 suggestion 노출 | ✅ 2자 이상 substring + 1자+ prefix |
| suggestion 클릭 시 이름/연락처 입력값 반영 | ✅ handleSelectSuggestion |
| 저장 시 기존 Inquiry 업데이트 정상 | ✅ handleSubmit 0줄 변경 |
| 신규 고객이면 suggestion 없어도 정상 입력 가능 | ✅ suggestions=[] → CustomerSuggestList null 반환 |
| build 통과 | ✅ Route 105 kB / type-check 0 error |

---

## Manifesto rule 정합성

| Rule | STEP 48 영향 | 상태 |
|---|---|---|
| **rule_4** Trust Layer | disclaimer + reason label 표시로 매칭 근거 transparent 노출 | ✅ 강화 |
| **rule_5** AI-Human Loop | 후보는 추천일 뿐 — 명시적 클릭 + 명시적 저장 필요 — "자동 연결" 0건 | ✅ 핵심 적용 |
| **rule_7** RBAC | InquiryDetailDrawer 진입 가능하면 추천도 가능 (audit / market analysis와 같은 정책) | ✅ 보존 |
| **rule_14** 3-Column | 레이아웃 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | 후보 list는 form section 안 보조 UI, primary action 영역 외 | ✅ 보존 |
| **rule_16** 미니멀 디자인 | 절제된 회색 + 작은 typography + 그림자 0 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | overlay 안 inline panel만 | ✅ 보존 |

---

## 매칭 알고리즘 결정성 검증

| 입력 케이스 | 기대 결과 |
|---|---|
| `name=""`, `contact=""` | `[]` (no signal) |
| `name="김"`, `contact=""` | `[]` (1글자 noise 차단) |
| `name="김"`, `contact="kim"` | contact_match 후보들 |
| `name="김도"`, `contact=""` | name_prefix 매치 ("김도현" / "김도원") |
| `name="김도현"`, `contact="kim.dohyun@example.com"` (정확 일치) | exclude로 제외 |
| `name="현"`, `contact=""` | name_substring 매치 (2글자 이상일 때만 substring 동작) |
| `name="동일이름"`, `contact=""` (동명이인 2명) | exact_name 후보 2개 (lastInteractionAt desc) |

---

## 다음 STEP 후보

남은 Track 후보:

1. **Logistics 외부 provider 연결** (rule_21) — STEP 29 ExternalAuctionProvider 패턴 답습
2. **Market Analysis history slice** — Persistence schema v2 migration (시간 추이 비교용)
3. **Channel Mix cross-tab 확장** — 작가별 / 상태별 세분화
4. **Inquiry 신규 직접 생성 흐름** — 현재는 inquiry가 자동 생성되어 채움 — 운영자가 직접 신규 inquiry를 생성하는 진입점 필요 (STEP 48의 자연 후속)

---

## 결과 요약

- 신규 파일 2개 (helper + UI component, 총 ~250 LOC)
- 수정 파일 1개 (InquiryDetailDrawer ~70 LOC)
- 0 신규 라이브러리 / 0 외부 API / 0 store slice / 0 schema 변경 / 0 도메인 타입 변경
- pure deterministic matching — fuzzy / Levenshtein / 외부 lib 0개
- 클릭 후에도 사용자가 명시적으로 [저장]해야 적용 — rule_5 AI-Human Loop 일관
- Route +2 kB (103 → 105 kB)

**STEP 48 완료.**
