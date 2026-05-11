# STEP 115 — Contact Structure Foundation — COMPLETE ✅

**완료 시점**: 2026-05-08
**Phase**: 4 — Artwork-Centric Workflow Foundation (3/10)
**Stage**: 1 — Foundation (lowest risk)
**Risk profile**: 🟢 매우 낮음 — type-only addition, 0 logic, 0 persistence change, 0 UI

---

## 1. STEP 115 의 정체

### 1.1 본 STEP 의 목표

사용자 spec STEP 115 (#7 Contact Structure Refactor) 정확 매칭. Inquiry/Customer/Buyer 의 *contact channel* 정보를 담는 future-ready `ContactInfo` struct 정착.

7 항목 (사용자 spec):
- ✅ Email
- ✅ Phone Number
- ✅ Institution
- ✅ Preferred Contact Method
- ✅ Internal Notes
- ✅ Timezone
- ✅ Collector Name (기존 `Inquiry.collectorName` field 그대로 보존 — identity 분리)

### 1.2 본 STEP 이 *아닌* 것

- ❌ UI 변경 (InquiryDetailDrawer / InquiryCreateDrawer 의 `'연락처'` label 4건 — STEP 118 Tabs 영역)
- ❌ Customer derive 변경 (customer-aggregates.ts 0줄 변경)
- ❌ Validation engine (email regex / phone format / IANA timezone — v1 free-form)
- ❌ 기존 `Inquiry.contact: string` 제거 (deprecated marker 만, required 보존)
- ❌ Persistence migration (`SCHEMA_VERSION` "v1" 그대로)
- ❌ AI integration (Phase 4 §4.8 — Claude API 신규 연결 금지)

---

## 2. Architecture 결정 핵심

### 2.1 별도 `ContactInfo` interface 신규

**Why separate type**: 사용자 spec *"future-ready 구조"* 명시 — 미래 다음 entity 들도 자연 합류 가능:

```
ContactInfo  (STEP 115 정착)
   ├── Inquiry.contactInfo?           ← 본 STEP 합류
   ├── Transaction.buyerContactInfo?  (미래 STEP)
   ├── Customer.contactInfo?          (미래 — derive 합류)
   └── 확장 가능
```

### 2.2 Identity 분리 — collectorName 보존

기존 `Inquiry.collectorName: string` (required) 그대로 보존. `ContactInfo` 는 *contact channel 정보만* 담당, 이름은 entity 별 own field 가 담당.

→ 두 dimension 분리: identity vs contact channels.

### 2.3 보수적 v1 enum

`PreferredContactMethod = "email" | "phone"` — 사용자 spec 명시 2개로 시작. 미래 확장 (messenger / kakao / in_person) 은 실제 운영 need 명시 시 추가 (YAGNI).

### 2.4 Backward compat 100% — `Inquiry.contact` 보존

기존 `contact: string` field 는 **required 그대로 유지**, `@deprecated` JSDoc marker 만 추가. 기존 mock-data.ts 의 모든 inquiry instance 가 자연 호환.

---

## 3. Implementation Inventory

### 3.1 신규 파일 (2)

#### `src/types/contact.ts` (~165 LOC)

| Symbol | 시그니처 | 역할 |
|--------|---------|------|
| `ContactInfo` | `interface { email?, phone?, institution?, preferredContactMethod?, internalNotes?, timezone? }` | 6 optional contact channel fields |
| `PreferredContactMethod` | `"email" \| "phone"` | 보수적 v1 enum |
| `PREFERRED_CONTACT_METHODS` | `readonly PreferredContactMethod[]` | enum array (외부 iteration 용) |
| `PREFERRED_CONTACT_METHOD_LABEL_KR` | `Record<...>` | KR labels ("이메일", "전화") |
| `PREFERRED_CONTACT_METHOD_LABEL_EN` | `Record<...>` | EN labels |
| `isPreferredContactMethod` | type guard | 외부 input 검증 (case-sensitive) |
| `isContactInfo` | type guard | runtime shape 검증 (forward-compat 친화 — 알려지지 않은 field 는 무시) |

#### `src/lib/__tests__/contact.scenarios.ts` (~280 LOC)

6 scenarios:
1. Empty ContactInfo `{}` is valid (모든 field optional)
2. KR label coverage — 2 keys non-empty
3. EN label coverage — 2 keys non-empty
4. `isPreferredContactMethod` — accepts "email"/"phone" + rejects 16 invalid (case variants / unknown / null / number / object 등)
5. `isContactInfo` — accepts valid (empty/partial/full + 알려지지 않은 field 무시) + rejects invalid (null/array/primitive/wrong-type-field)
6. Inquiry persistence v1 forward compat — legacy shape (contactInfo 부재) + enhanced shape (contactInfo present) 모두 type-check 통과

### 3.2 수정 파일 (1)

#### `src/types/inquiry.ts` (+~30 LOC)

```typescript
import type { ContactInfo } from "./contact";

export interface Inquiry {
  // ... 기존 fields ...
  collectorName: string;

  /**
   * @deprecated STEP 115 — 새 코드는 contactInfo (ContactInfo struct) 사용 권장.
   * 본 field 는 backward compat 보장을 위해 *required 유지*.
   */
  contact: string;

  /**
   * STEP 115 — Collector contact channel 정보 (future-ready 구조).
   * Optional slot — backward compat 보장.
   */
  contactInfo?: ContactInfo;

  // ... 기존 다른 fields 모두 그대로 ...
}
```

### 3.3 절대 변경 안된 영역 (검증됨)

- ❌ `src/lib/persistence.ts` — `validateV1` / `SCHEMA_VERSION` "v1" 0줄 변경
- ❌ `src/types/customer.ts` — Customer derive view 0줄 변경
- ❌ `src/lib/customer-aggregates.ts` — derive 0줄 변경
- ❌ `src/lib/customer-export.ts` — CSV column 0줄 변경
- ❌ `src/lib/customer-suggest.ts` — contact_match 매칭 0줄 변경
- ❌ `src/components/inquiry/*` — 모든 UI '연락처' label 그대로 (STEP 118 Tabs 영역)
- ❌ `src/lib/mock-data.ts` — 모든 inquiry instance 그대로 (contactInfo 부재 → undefined 자연 호환)
- ❌ Phase 1 Fiscal entity 6/6 — 0줄 변경
- ❌ AI infra (STEP 93~96) — 0줄 변경
- ❌ STEP 113/114 산출물 — 0줄 변경

---

## 4. Validation Results

| 항목 | 결과 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next lint` | ✅ 0 warnings, 0 errors |
| `npx next build` | ✅ build success |
| Route size | **187 kB** (STEP 114 → 변동 0 kB) |
| First Load JS | **275 kB** (변동 0 kB) |
| DOC-2 §4.1 ≤10 kB target | ✅ 통과 (0 kB delta) |

| Scenario Suite | Result |
|----------------|--------|
| ai-protocol | ✅ 17/17 |
| fiscal-derive | ✅ 10/10 |
| operational-insight | ✅ 12/12 |
| anthropic-provider | ✅ 9/9 |
| artwork-registration-status | ✅ 7/7 |
| **contact** ⭐ | **✅ 6/6 (신규)** |
| **Total** | **✅ 61/61 PASS** (회귀 0건, +6 신규) |

---

## 5. Phase 4 §4 Implementation Constraints 정합 검증

| §4 원칙 | 검증 |
|---------|------|
| §4.1 Additive only | ✅ 신규 type + optional slot |
| §4.2 Optional slot priority | ✅ contactInfo? + 모든 sub-fields optional |
| §4.3 No persistence migration | ✅ `validateV1` / `SCHEMA_VERSION` 변경 0줄 |
| §4.4 Draft-safe | ✅ 영향 없음 |
| §4.5 Backward compat | ✅ 기존 `contact: string` 보존 + `@deprecated` marker only |
| §4.6 Build green | ✅ tsc / lint / build / 61 scenarios 모두 통과 |
| §4.7 Worktree 금지 | ✅ 현재 project 만 수정 |
| §4.8 AI not priority | ✅ AI 영역 0줄 변경 |

---

## 6. Anchor Pattern 정착 (DOC-2 §3.1)

본 STEP 의 산출물은 **다음 STEP / 미래 entity 들이 합류할 anchor**:

| 미래 합류 후보 | 본 anchor 사용 |
|---------------|---------------|
| `Transaction.buyerContactInfo?` | future STEP (Phase 4 ~ 6 사이) |
| `Customer.contactInfo?` (derive) | customer-aggregates.ts 의 dedup 로직이 ContactInfo merge 합류 시 |
| STEP 118 Tabs UI | Tab 1 Basic Info / Tab 5 Inquiry 의 contact 입력 surface |
| STEP 122 Workflow Viz | Living Timeline 에 institutional collector 표시 |

---

## 7. 다음 STEP

### 권장 자연 진입: **STEP 119 — Curation Connected Data**

Phase 4 Stage 1 마무리 (113 ✅ → 114 ✅ → 115 ✅ → **119**).

- spec: Artwork type 에 `curationDraft?`, `exhibitionText?`, `artistNote?`, `provenanceNote?` optional 추가
- Risk: 🟢 낮음 — type foundation only, additive
- ~150 LOC 예상
- 의존성: 없음 (Stage 1 마지막 항목)
- Phase 4 4/10 진입

또는 Stage 2 진입:

### 🅑 STEP 116 — Image-First Registration Hero

- Stage 2 진입, ~200 LOC, 🟡 mid risk
- ArtworkUploadHero.tsx 신규 + ArtworkFormDrawer hierarchy 재배치

---

## 8. 본 STEP 의 영구 가치

1. **Future-ready ContactInfo struct 정착** — Inquiry / Transaction / Customer 모두 미래에 자연 합류 가능. 사용자 spec "확장 가능하게 설계" 정확 매칭.
2. **Identity vs Contact dimension 분리** — `collectorName` (identity) 와 `ContactInfo` (channels) 분리, 미래 모든 entity 에 동일 패턴 reference.
3. **Backward compat 100% 입증** — 기존 `contact: string` 보존 + `@deprecated` marker 만으로 새 구조 합류 가능 패턴 매뉴얼화.
4. **보수적 enum start pattern** — `PreferredContactMethod = "email" | "phone"` v1 시작, 실제 need 시 확장 (YAGNI 원칙 엄격 적용).
5. **Forward-compat type guard** — `isContactInfo` 가 알려지지 않은 field 무시 → 미래 field 추가 시 type guard 무수정 자연 호환.
6. **Phase 4 Stage 1 진행 가속** — STEP 113/114/115 모두 +0 kB / type-only / scenario 검증만으로 phase progression. minimum viable pattern 영구 reference.
