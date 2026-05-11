# STEP 119 — Curation Connected Data — COMPLETE ✅

**완료 시점**: 2026-05-08
**Phase**: 4 — Artwork-Centric Workflow Foundation (4/10)
**Stage**: 1 — Foundation (lowest risk) — **🎉 Stage 1 완성 (4/4)**
**Risk profile**: 🟢 매우 낮음 — type-only addition, 0 logic, 0 persistence change, 0 UI

---

## 1. STEP 119 의 정체

### 1.1 본 STEP 의 목표

사용자 spec STEP 119 (#9 Curation as Connected Data) 정확 매칭. Artwork master record 에 *직접 연결되는* 큐레이션 / 전시 / 작가 / provenance inline data 정착.

5 fields (사용자 spec 정확 매칭):
- ✅ 작품 설명 → `description?: string`
- ✅ 큐레이션 초안 → `curationDraft?: string`
- ✅ 전시 설명 → `exhibitionText?: string`
- ✅ 작가 메모 → `artistNote?: string`
- ✅ provenance note → `provenanceNote?: string`

### 1.2 본 STEP 이 *아닌* 것

- ❌ 기존 `CurationNote` (별도 entity) 변경 — 0줄 변경
- ❌ `CurationDraftDrawer` / `CurationSummary` UI 변경
- ❌ AI 통합 (Phase 4 §4.8 — Claude API 신규 연결 금지)
- ❌ Persistence migration (`SCHEMA_VERSION` "v1" 그대로)
- ❌ Validation engine (free-form, future STEP)

---

## 2. Architecture 결정 핵심

### 2.1 Two-Layer Curation Model 정착

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1 — Formal Curation Document (CurationNote, 기존)          │
│ src/types/curation.ts                                           │
│   - DRAFT / APPROVED / LOCKED 3-stage lifecycle                 │
│   - Version chain (createCurationVersion)                       │
│   - AI-Human Loop (rule_5)                                      │
│   - Audit trail / immutable LOCK                                │
│   → 정식 큐레이션 카탈로그 텍스트                                  │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Layer 2 — Connected Inline Data (Artwork.*, 신규 STEP 119)       │
│ src/types/artwork.ts + src/types/artwork-curation-data.ts       │
│   - 5 optional plain string fields on Artwork                   │
│   - 별도 lifecycle 없음, free-form, validation 미진입             │
│   - Artwork master record 직접 합류                              │
│   → 작품 마스터에 붙는 light note / quick draft                  │
└─────────────────────────────────────────────────────────────────┘
```

두 layer 는 의도적 *별도 dimension*. Artwork 등록 시점부터 light note 합류 가능 (사용자 spec "거래 후 별도 생성이 아닙니다" 직접 매칭), formal curation 진입 필요 시 CurationNote 로 prommote.

### 2.2 Flatten on Artwork (not nested struct)

사용자 spec *"Artwork master record 내부의 connected data"* 명시 — Artwork field 로 직접 합류. nested object (`artwork.curationData?.description`) 는 connected intent 와 어긋남 + 사용 convenience 떨어짐.

→ Flatten 채택: `artwork.description`, `artwork.curationDraft` 등 직접 접근.

### 2.3 Type module 분리 패턴 답습

STEP 114/115 패턴 답습 — 별도 module 에 type / labels / helpers 정착, Artwork interface 는 5 fields flatten:

| STEP | Type module |
|------|-------------|
| 114 | `src/types/artwork-registration-status.ts` |
| 115 | `src/types/contact.ts` |
| **119** | **`src/types/artwork-curation-data.ts`** ⭐ |

---

## 3. Implementation Inventory

### 3.1 신규 파일 (2)

#### `src/types/artwork-curation-data.ts` (~155 LOC)

| Symbol | 시그니처 | 역할 |
|--------|---------|------|
| `ArtworkCurationDataKey` | `type ... = "description" \| ... \| "provenanceNote"` | 5 keys union |
| `ARTWORK_CURATION_DATA_KEYS` | `readonly ArtworkCurationDataKey[]` | Canonical ordered list |
| `ARTWORK_CURATION_DATA_LABEL_KR` | `Record<...>` | KR labels (작품 설명 / 큐레이션 초안 / 전시 설명 / 작가 메모 / Provenance 메모) |
| `ARTWORK_CURATION_DATA_LABEL_EN` | `Record<...>` | EN labels (Description / Curation Draft / Exhibition Text / Artist Note / Provenance Note) |
| `isArtworkCurationDataKey` | type guard | 외부 input 검증 |
| `hasAnyCurationData(artwork)` | helper | 5 fields 중 하나라도 non-empty trim 검사 (UI active indicator 용) |
| `collectCurationData(artwork)` | helper | non-empty fields 만 partial record 추출 (compact projection, UI/export 용) |

#### `src/lib/__tests__/artwork-curation-data.scenarios.ts` (~310 LOC)

6 scenarios:
1. Key union integrity — 5 keys + ordered + uniqueness
2. KR label coverage — 5 keys non-empty
3. EN label coverage — 5 keys non-empty
4. `isArtworkCurationDataKey` — 5 valid accept + 15 invalid reject (case variants / typos / 다른 Artwork field name 등)
5. `hasAnyCurationData` — empty / partial / full / **whitespace-only edge** (trim 검사) / empty string edge
6. `collectCurationData` — compact projection + Artwork persistence v1 forward compat

### 3.2 수정 파일 (1)

#### `src/types/artwork.ts` (+~30 LOC)

```typescript
export interface Artwork {
  // ... 기존 fields 모두 그대로 ...
  registrationStatus?: ArtworkRegistrationStatus;  // STEP 114

  // STEP 119 — 5 optional inline fields (flatten)
  description?: string;        // 작품 설명
  curationDraft?: string;      // 큐레이션 초안
  exhibitionText?: string;     // 전시 설명
  artistNote?: string;         // 작가 메모
  provenanceNote?: string;     // provenance / 소장 이력
}
```

JSDoc 으로 *Two-Layer Curation Model* 명시 + CurationNote 와의 dimension 분리 설명 + spec source cross-reference.

### 3.3 절대 변경 안된 영역 (검증됨)

- ❌ `src/types/curation.ts` — `CurationNote` entity / lifecycle / version chain 0줄 변경
- ❌ `src/components/curation/CurationDraftDrawer.tsx` — UI 0줄 변경
- ❌ `src/components/curation/CurationSummary.tsx` — UI 0줄 변경
- ❌ `src/lib/persistence.ts` — `validateV1` / `SCHEMA_VERSION` "v1" 0줄
- ❌ `src/lib/mock-data.ts` — 모든 artwork instance 그대로 (5 curation fields 부재 → undefined 자연 호환)
- ❌ Phase 1 Fiscal entity 6/6 — 0줄 변경
- ❌ AI infra (STEP 93~96) — 0줄 변경
- ❌ STEP 113/114/115 산출물 — 0줄 변경

---

## 4. Validation Results

| 항목 | 결과 |
|------|------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next lint` | ✅ 0 warnings, 0 errors |
| `npx next build` | ✅ build success |
| Route size | **187 kB** (STEP 115 → 변동 0 kB) |
| First Load JS | **275 kB** (변동 0 kB) |
| DOC-2 §4.1 ≤10 kB target | ✅ 통과 (0 kB delta — type-only 4회 연속) |

| Scenario Suite | Result |
|----------------|--------|
| ai-protocol | ✅ 17/17 |
| fiscal-derive | ✅ 10/10 |
| operational-insight | ✅ 12/12 |
| anthropic-provider | ✅ 9/9 |
| artwork-registration-status | ✅ 7/7 |
| contact | ✅ 6/6 |
| **artwork-curation-data** ⭐ | **✅ 6/6 (신규)** |
| **Total** | **✅ 67/67 PASS** (회귀 0건, +6 신규) |

---

## 5. Phase 4 §4 Implementation Constraints 정합 검증

| §4 원칙 | 검증 |
|---------|------|
| §4.1 Additive only | ✅ 신규 type module + 5 optional fields |
| §4.2 Optional slot priority | ✅ 5 fields 모두 optional |
| §4.3 No persistence migration | ✅ `validateV1` / `SCHEMA_VERSION` 변경 0줄 |
| §4.4 Draft-safe | ✅ 영향 없음 |
| §4.5 Backward compat | ✅ 기존 mock-data.ts 모든 artwork 자연 호환 |
| §4.6 Build green | ✅ tsc / lint / build / 67 scenarios 모두 통과 |
| §4.7 Worktree 금지 | ✅ 현재 project 만 수정 |
| §4.8 AI not priority | ✅ AI 영역 0줄 변경 |

---

## 6. 🎉 Phase 4 Stage 1 완성 (4/4)

| Stage 1 STEP | Status | 산출물 |
|-------------|--------|--------|
| STEP 113 | ✅ | Terminology Reframe + 7번째 영구 정책 (`AXVELA_WORKFLOW_ARCHITECTURE.md`) |
| STEP 114 | ✅ | ArtworkRegistrationStatus enum (10-state operational lifecycle) |
| STEP 115 | ✅ | ContactInfo struct (6 optional fields, future-ready) |
| **STEP 119** | ✅ | **ArtworkCurationData (5 optional inline fields)** |

**Stage 1 누적 효과**:
- Route delta: **+0 kB / +0 kB / +0 kB / +0 kB = 0 kB 합계** (4회 연속 type-only)
- 신규 scenarios: 7 + 6 + 6 = **19 신규** (48 → 67)
- 신규 type modules: **3개** (registration-status / contact / curation-data)
- 신규 영구 정책 문서: **1개** (`AXVELA_WORKFLOW_ARCHITECTURE.md`)
- Code-logic 변경: **0줄**
- Persistence migration: **0건**
- Backward compat: **100%**

→ Phase 4 의 *Foundation Stage* 가 minimum viable pattern 으로 완성. 이후 Stage 2 (UI Restructure) 가 본 foundation 위에 합류 예정.

---

## 7. 다음 STEP — Stage 2 진입

### 권장 자연 진입: **STEP 116 — Image-First Registration Hero**

Phase 4 Stage 2 진입 (113/114/115/119 ✅ → **116** → 118 → 117).

- spec: `ArtworkUploadHero.tsx` 신규 (large drop zone + drag&drop + multiple + thumbnail), ArtworkFormDrawer hierarchy 재배치 (이미지 → 기본정보 → 설명 순)
- Risk: 🟡 **mid risk** — 신규 UI component, 기존 ArtworkFormDrawer hierarchy 변경
- ~200 LOC 예상
- 의존성: 없음 (Stage 2 entry point)
- Phase 4 5/10 진입

→ **Stage 1 의 type-only foundation 흐름 종료, Stage 2 의 UI 작업 진입**.

### 🅑 대안 — STEP 118 (Registration Tabs Structure)

Stage 2 의 다른 entry. ArtworkFormDrawer 9-tab 재구성. STEP 116 보다 *구조 재배치 위주*.

---

## 8. 본 STEP 의 영구 가치

1. **Two-Layer Curation Model 정착** — `CurationNote` (formal document, lifecycle) vs `ArtworkCurationData` (inline data, free-form) 의 dimension 분리. 미래 다른 entity 에서 "공식 문서 vs inline note" 패턴 동일 답습 가능.
2. **Flatten on Artwork pattern 매뉴얼화** — connected data 는 nested struct 보다 flatten 이 사용자 mental model 에 더 자연. Artist / AXID 의 nested struct (sub-entity) vs Curation data 의 flatten (metadata) 의 *분리 기준* 정립.
3. **Phase 4 Stage 1 완성 (4/4)** — 4 STEP 모두 +0 kB / type-only / scenario 검증만으로 Stage 진행, minimum viable phase progression pattern 입증.
4. **Backward compat 100% 4회 연속 입증** — STEP 113/114/115/119 모두 기존 mock-data.ts 자연 호환.
5. **Type module 분리 일관성** — STEP 114 (registration-status) / 115 (contact) / 119 (curation-data) 모두 동일 패턴 (type union + ordered list + KR/EN labels + helpers + scenarios), Phase 4 Stage 2/3 STEP 들도 동일 패턴 답습 가능.
