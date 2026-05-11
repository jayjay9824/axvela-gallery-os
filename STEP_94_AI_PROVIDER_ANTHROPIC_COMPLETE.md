# STEP 94 — AI Provider Client + UI Integration ✅

> **완료 시점**: 2026-05-07
> **Phase**: Phase 3 Intelligence Layer 3/8
> **방향성**: STEP 93 protocol skeleton 위에 *anthropic 1개 provider + artwork_metadata 1개 insertion point* 활성
> **사용자 spec**: `.env.local`에 API key 1번 설정 → STEP 94/95/96/97/98 모두 동일 key 자동 사용

---

## 🎯 STEP 94의 정체성

본 STEP은 **AI 테스트 진입 가능 시점** 입니다.

✅ 본 STEP의 정체:
- STEP 93 deferred provider call section 활성 (anthropic Messages API 실 호출)
- ArtworkForm 재료 필드 옆 "AI 정리 보조" CTA — "캔버스에 유채" → "Oil on Canvas"
- 6-state machine UI (idle/loading/result/unavailable/validation_error/network_error)
- "적용" 버튼 통한 explicit user confirmation (rule_5 AI-Human Loop)
- 4-step output guard (parse → validate → forbidden scan → ok) 영구 매뉴얼화
- Server-side only API key — client.ts/Button.tsx에 NEXT_PUBLIC_* / process.env.*KEY 0건

❌ 본 STEP은 *아닙니다*:
- 5 insertion points 모두 활성 (1개만 — artwork_metadata)
- 3 provider 모두 활성 (1개만 — anthropic; openai/gemini는 graceful 거부)
- autonomous AI agent
- 자동 setter / 자동 fetch trigger
- 외부 SDK 의존 (native fetch)

---

## 📊 산출물 요약

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/ai/providers/anthropic.ts` | ~165 | Server-side Messages API client (callAnthropic) |
| `src/lib/ai/invoke.ts` | ~115 | Provider dispatch (anthropic 활성, openai/gemini graceful) |
| `src/app/api/ai-assist/route.ts` | +70/-30 | Deferred section → 4-step output guard activated |
| `src/components/artwork/ArtworkAIAssistButton.tsx` | ~225 | Client component (6-state machine + diff display) |
| `src/components/artwork/ArtworkFormDrawer.tsx` | +8 | Mount in medium field |
| `src/lib/ai/config.ts` | +1 | DEFAULT_MODELS export |
| `src/lib/__tests__/anthropic-provider.scenarios.ts` | ~440 | 9/9 mock scenarios PASS |
| **production** | **~545 LOC** | **Route +1 kB (ArtworkAIAssistButton client)** |

---

## 🧪 Validation Results

```
✓ npx tsc --noEmit          0 errors
✓ npx next lint             clean
✓ npx next build            ✓ Compiled successfully
✓ Route delta               181 kB → 182 kB  (+1 kB)
✓ First Load JS             268 kB → 270 kB  (+2 kB)
✓ /api/ai-assist            ƒ server-only (0 B client)
✓ Anthropic scenarios       9/9 PASS  (mock fetch, 0 live calls)
✓ AI Protocol scenarios     17/17 PASS (STEP 93 보존)
✓ Operational scenarios     12/12 PASS (STEP 92 보존)
✓ Fiscal scenarios          10/10 PASS (STEP 90 보존)
✓ Total                     48/48 PASS
```

---

## 🚀 AI 테스트 진입 가이드

`.env.local` 프로젝트 루트에 생성 (한 번만):

```
AXVELA_AI_ENABLED=true
AXVELA_AI_PROVIDER=anthropic
AXVELA_AI_API_KEY=sk-ant-...
AXVELA_AI_ARTWORK_METADATA_ENABLED=true
```

→ `npm install && npm run dev` → 사이드바 "작품 추가" → 재료 필드 "캔버스에 유채" 입력 → "AI 정리 보조" 클릭 → "Oil on Canvas" 제안 + "적용" 버튼.

`.env.local`은 git ignore + ZIP 미포함 — API key 유출 0건.

**STEP 95~98 진입 시 추가**: per-kind flag 한 줄씩 추가 (API key는 그대로 재사용):
```
AXVELA_AI_DOCUMENT_WRITING_ENABLED=true     # STEP 95
AXVELA_AI_TRANSLATION_ENABLED=true          # STEP 96
AXVELA_AI_CONDITION_COMPARE_ENABLED=true    # STEP 97
AXVELA_AI_OPERATIONAL_INSIGHT_ENABLED=true  # STEP 98
```

---

## 🛡️ 5 정책 grep verify (모두 통과)

### 1. AI Direction §1 / §10 ✅
- 4-step output guard activated (parse → validate → forbidden scan → ok)
- 25 forbidden phrases 검출 시 `output_rejected` reason
- ArtworkAIAssistButton에 user-facing forbidden phrase 0건

### 2. Trust Layer ✅
ApprovalAction / ApprovalQueue / reviewerAssignment / managerApproval 모두 0건.

### 3. **CRITICAL — API key client exposure** ✅
- `client.ts` → `NEXT_PUBLIC_*KEY` / `process.env.*KEY` 0건
- `ArtworkAIAssistButton.tsx` → 동일 0건
- API key 접근은 `readAIApiKey()` server helper만

### 4. **CRITICAL — Provider client server-side 격리** ✅
- `anthropic.ts` / `invoke.ts`를 client component에서 import 0건 (verified)
- 두 모듈 모두 헤더에 "SERVER-SIDE ONLY" 명시 주석

### 5. Manifesto rule_3 (Money Flow Separation) ✅
cross-domain 합산 0건. AI는 fiscal calculation 미수행.

---

## 🔁 STEP 86 Anchor 6번째 사용처 — Deferred Section 활성

본 STEP은 *새 abstraction 0개*. STEP 93 protocol skeleton의 deferred 섹션을 *활성*만으로 anchor pattern 6번째 사용처 확장 (Pure Derive Layer Tier 6).

| Tier | STEP | 사용처 |
|---|---|---|
| 1 정착 | STEP 86 | DocumentTrustMetadata |
| 2 entity | STEP 87/89 | Receipt + TaxInvoice trust |
| 3 cross-doc | STEP 91 | unified vocabulary |
| 4 fiscal | STEP 90 | withholding/classification |
| 5 new domain | STEP 92 | operational intelligence |
| 6 protocol | STEP 93 | AI integration skeleton |
| **6 (활성)** | **STEP 94** | **deferred section activation (새 abstraction 0개)** |

---

## 🎨 4-step Output Guard 영구 매뉴얼화

향후 STEP 95~98에서 동일 흐름 답습:

```
1. invokeProvider(promptBundle, {provider, apiKey, ...})
   → 실패 시 reason 매핑 (timeout / provider_not_implemented → provider_not_configured / etc → provider_error)

2. tryParseJSONOutput(raw.text)
   → markdown fence strip
   → JSON.parse 실패 시 provider_error

3. validateExpectedKeys(parsed.value, promptBundle.expectedJsonKeys)
   → 누락 키 검출 시 provider_error

4. scanOutputForForbidden(parsed.value)
   → 25 phrase 검출 시 output_rejected
   → 통과 시 ok 응답 + meta (provider/model/generatedAtISO/locale/inputTokens/outputTokens)
```

---

## 🎨 6-state Machine Client UI 영구 reference

향후 STEP 95~98 client component에서 동일 패턴 답습:

```typescript
type AssistState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; ...domain-specific output }
  | { kind: "unavailable"; reason: AIUnavailableReason }
  | { kind: "validation_error"; errors: string[] }
  | { kind: "network_error"; message: string };
```

UNAVAILABLE_LABEL_KR 한글 매핑 (7 reason):
- disabled → "AI 보조가 비활성 상태입니다."
- kind_disabled → "본 영역의 AI 보조가 비활성 상태입니다."
- provider_not_configured → "AI 제공자 설정이 필요합니다 (서버 환경 변수)."
- rate_limit → "요청 속도 제한에 도달했습니다."
- provider_error → "AI 제공자 응답 처리에 실패했습니다."
- output_rejected → "응답이 정책에 부합하지 않아 거부되었습니다."
- timeout → "응답 시간이 초과되었습니다."

---

## ⚠️ Risk Assessment — 🟡 Low Risk

회귀 영향 가능 영역:
- (a) ArtworkFormDrawer medium 필드 layout (TextField → AIAssistButton → MaterialPresetChips 3-stack)
- (b) `/api/ai-assist` 응답 shape 활성 (env 부재 시 graceful degradation 보존)

회귀 영향 없는 영역 (검증 0줄 변경):
- persistence (validateV1 / SCHEMA_VERSION)
- All Phase 1 Fiscal entities (Settlement / Tax / Invoice / Receipt / TaxInvoice)
- All fiscal drawers + FiscalSummaryDrawer + AccountantExportDrawer
- STEP 92 MarketInsightDrawer (Operational Intelligence)
- STEP 45 legacy MarketAnalysisDrawer
- DetailPanel UX-3 6 zones / Sidebar UX-2
- ArtworkImageUpload / ColorSwatchPicker / RoleSwitcher
- All API routes (upload-image / delete-image / list-images / accountant-export)
- mock-data / state-machine / transaction-helpers
- package.json (외부 라이브러리 0개)

---

## 🎯 본 STEP의 영구 가치

1. **AI 테스트 진입 가능 시점** — STEP 93 protocol → STEP 94 활성 → 사용자가 .env.local 1번 설정 후 즉시 테스트
2. **4-step output guard 영구 매뉴얼화** — STEP 95~98에서 동일 흐름 답습
3. **6-state Machine client UI 영구 reference** — STEP 95~98 client component 답습
4. **Provider abstraction minimum viable 활성** — anthropic 1개 활성 + openai/gemini graceful 거부 → 향후 동일 패턴 추가
5. **Server-side only 강화 검증** — 5 grep all clean
6. **Anchor pattern Tier 6** — 새 abstraction 0개 (deferred 섹션 활성만으로 사용처 확장)

---

## 🚀 다음 STEP 권장

🅑 **STEP 95 (document_writing UI integration)**

본 STEP의 4-step output guard + 6-state machine 패턴 답습:
- Invoice/Receipt/Condition Report/Settlement Summary/Shipment Summary/Artwork Description 6 target
- Document drawer (5 fiscal drawers)에 "AI 정리 보조" CTA 추가
- short notes → institutional rewrite
- ~250 LOC 예상 (~1 kB Route delta)

🅑 **STEP 96 (translation UI)**

- KO/EN/JA/ZH locale 토글
- DetailPanel zone 또는 Sidebar 진입점
- ~200 LOC 예상

🅒 **STEP 101 (Approval Workflow / Trust Layer activation)**

Phase 1 freeze + Phase 3 baseline (STEP 92+93+94) 정착으로 진입 조건 충족.
- STEP 86 `lockedBy` slot anchor 사용 시점
