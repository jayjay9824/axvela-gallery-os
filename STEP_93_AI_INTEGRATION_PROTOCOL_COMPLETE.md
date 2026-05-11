# STEP 93 — AI Integration Protocol (Lightweight Skeleton + 6번째 영구 정책) ✅

> **완료 시점**: 2026-05-07
> **Phase**: Phase 3 Intelligence Layer 2/8
> **방향성**: *AXVELA = operational software with intelligence layers, NOT AI-first product*
> **사용자 명시**: "small / stable / assistive AI insertion points를 architecture에 먼저 정착해주세요"

---

## 🎯 STEP 93의 정체성

본 STEP은 **AI integration architecture의 영구 정착**입니다.

✅ 본 STEP의 정체:
- 6번째 영구 정책 문서 (`AXVELA_AI_INTEGRATION.md`) — AI 통합 헌법
- 5 AI insertion points 영구 정의 (artwork_metadata / document_writing / condition_compare / operational_insight / translation)
- AI service protocol (request/response discriminated union, 7 unavailable reasons)
- Server-side only API route (POST /api/ai-assist)
- AI-disabled safe mode default
- 25 forbidden output phrases 영구 매뉴얼화
- 17/17 deterministic scenarios

❌ 본 STEP은 *아닙니다*:
- Actual provider client (OpenAI/Anthropic/Gemini SDK 호출 — STEP 94+ 영역)
- UI integration (artwork form / document drawer 통합 — STEP 94+ 영역)
- Autonomous agent / pricing engine / appraisal / forecasting / orchestration (모두 영구 금지)

---

## 📊 산출물 요약

| 파일 | LOC | 역할 |
|---|---|---|
| `AXVELA_AI_INTEGRATION.md` | ~600 | 6번째 영구 정책 문서 (9 sections) |
| `src/lib/ai/types.ts` | ~280 | Protocol — 5 insertion points discriminated union + 25 forbidden phrases |
| `src/lib/ai/config.ts` | ~155 | Feature flags + safe mode + provider config |
| `src/lib/ai/prompts.ts` | ~360 | 5 prompt builders + universal blocks + JSON helpers |
| `src/lib/ai/client.ts` | ~155 | Typed client wrapper + 5 convenience helpers |
| `src/app/api/ai-assist/route.ts` | ~210 | Server-side POST handler + per-kind validation |
| `src/lib/__tests__/ai-protocol.scenarios.ts` | ~330 | 17 deterministic scenarios |
| **production** | **~1490 LOC** | **Route 0 kB delta** |

---

## 🧪 Validation Results

```
✓ npx tsc --noEmit          0 errors
✓ npx next lint             clean
✓ npx next build            ✓ Compiled successfully
✓ Route delta               181 kB → 181 kB  (0 kB delta!)
✓ First Load JS             268 kB → 268 kB  (0 kB delta!)
✓ AI scenarios              17/17 PASS (npx tsx 검증)
✓ Operational scenarios     12/12 PASS
✓ Fiscal scenarios          10/10 PASS
✓ Total                     39/39 PASS
```

**0 kB delta는 의도된 결과** — `/api/ai-assist`는 server-only Next.js route (0 B client), client wrapper (`client.ts`)는 현재 UI 미연결로 tree-shake out. DOC-2 §4.5 derived-layer-oriented의 정확한 비용 효율 입증.

---

## 🔬 사용자 spec 7 구현 항목 — 100% 매칭

| # | 사용자 spec | 정착 위치 |
|---|---|---|
| 1 | AI insertion points 정의 | `types.ts` `AIAssistKind` 5-tier (artwork_metadata / document_writing / condition_compare / operational_insight / translation) |
| 2 | AI service protocol 정의 | `types.ts` `AIAssistRequest<K>` + `AIAssistResponse<K>` (ok / ai_unavailable / validation_error 3-tier) |
| 3 | Lightweight server-side API route | `route.ts` POST /api/ai-assist (runtime=nodejs, dynamic=force-dynamic) |
| 4 | Prompt templates | `prompts.ts` 5 builders + UNIVERSAL_FORBIDDEN_BLOCK + UNIVERSAL_TONE_BLOCK + UNIVERSAL_OUTPUT_DISCIPLINE |
| 5 | Structured input/output schema | `types.ts` per-kind discriminated maps (`AIAssistInputMap` + `AIAssistOutputMap`) |
| 6 | Fallback behavior | `client.ts` + `route.ts` `buildFallback` per-kind structured fallback |
| 7 | AI-disabled safe mode | `config.ts` `readAIConfig` env-driven, default disabled |

---

## 🛡️ 5 AI Insertion Points (사용자 spec 정확 매칭)

### §2.1 `artwork_metadata` — Artwork Metadata Assist
- **사용자 예시**: "캔버스에 유채" → "Oil on Canvas"
- **목표**: Manual data entry 감소
- **금지**: artist year guessing / authentication claims / provenance fabrication / price suggestions / edition number guessing

### §2.2 `document_writing` — Document Writing Assist
- **지원**: Invoice / Receipt / Condition Report / Settlement Summary / Shipment Summary / Artwork Description (6 documentTargets)
- **AI 역할**: short notes → institutional rewrite ("EDITORIAL role only")
- **금지**: legal final wording / tax determination / authenticity guarantee / pricing decisions

### §2.3 `condition_compare` — Condition Compare Summary
- **사용자 예시**: "Surface variance observed near the lower-right edge."
- **금지** (사용자 spec 명시): "Damage confirmed" / "Authenticity compromised"
- **허용**: "Conservator review recommended" / "Further inspection advised"

### §2.4 `operational_insight` — Operational Insight Summary
- STEP 92 snapshot rewrite (Bloomberg + McKinsey 톤)
- **금지** (사용자 spec 명시): pricing prediction / investment scoring / speculative valuation / autonomous recommendations

### §2.5 `translation` — Translation Layer
- **지원 언어**: Korean / English / Japanese / Chinese (4-tier `AILocale`)
- **금지**: 정보 추가 (hallucination) / 조작 데이터 제거 / 작품 고유명사 번역

---

## 🔒 4 영구 정책 grep verify (모두 통과)

### AI Direction §1 / §10 ✅
- 25 forbidden phrases (5 영역: 가격/진위/법적/condition/추천) FORBIDDEN_OUTPUT_PHRASES const
- 5 prompt builders 모두 UNIVERSAL_FORBIDDEN_BLOCK 강제 inline
- User-facing positive claim 0건

### Trust Layer ✅
- ApprovalAction / ApprovalQueue / reviewerAssignment / managerApproval 모두 0건
- "PERMISSION ≠ APPROVAL" 분리 보존

### Manifesto rule_5 (AI-Human Loop) ✅
- 외부 LLM 호출 (`fetch`/`axios`/`openai-sdk`/`anthropic-sdk`/`google-generativeai`) 0건
- `openai`/`anthropic`/`gemini` 매치는 모두 `config.ts` string literal (provider name + default model name)
- Provider call deferred — STEP 94+ 진입 시 invokeProvider 활성

### Manifesto rule_3 (Money Flow Separation) ✅
- cross-domain 합산 0건
- Settlement / Tax / Invoice / Receipt entity 모두 0줄 변경
- Phase 1 Fiscal foundation freeze 그대로 유지

---

## 🔐 Critical Security — API Key Client Exposure 검증

```bash
$ grep -rE "NEXT_PUBLIC.*KEY|NEXT_PUBLIC.*API|process\.env.*KEY" src/lib/ai/client.ts
(empty result)
```

**`client.ts`에 API key 관련 환경변수 read 0건** ✅

- API key는 `config.ts` `readAIApiKey()`에서만 read (server-side only)
- `NEXT_PUBLIC_` prefix 사용 절대 금지 (정책 §7.2 영구 명시)
- Client wrapper는 `/api/ai-assist` endpoint만 호출 — provider URL 직접 호출 0건

---

## 🏗️ Architecture Flow (사용자 spec 정확 매칭)

```
┌──────────────────────────────────────────────────────────────┐
│  Client UI (현재 미연결, STEP 94+ 영역)                      │
│  - Drawer / Modal / Form                                    │
│  - User explicit trigger only (rule_5)                      │
│  - Calls requestAIAssist<K>(...)                            │
└──────────────────────────────────────────────────────────────┘
                        ↓ POST /api/ai-assist
┌──────────────────────────────────────────────────────────────┐
│  Server-Side API Route (route.ts) ⭐ 본 STEP 정착             │
│  - validateBody (per-kind shape sanity)                     │
│  - readAIConfig() — enabled / per-kind check                │
│  - buildPrompt(kind, input, locale)                         │
│  - [DEFERRED] provider invoke                                │
│  - [DEFERRED] scanOutputForForbidden                         │
│  - Return AIAssistResponse                                   │
└──────────────────────────────────────────────────────────────┘
                        ↓ provider call (STEP 94+)
┌──────────────────────────────────────────────────────────────┐
│  External Provider (Claude / OpenAI / Gemini)                │
│  - API key server-side ONLY                                 │
│  - Never exposed to client                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 🧬 STEP 86 Anchor 6번째 사용처 — Pure Derive Layer (server-side)

DOC-2 §3.5 Pure Derive Layer 조건 모두 충족:
- ✅ entity 0줄
- ✅ store mutation 0건
- ✅ persistence 0줄
- ✅ pure 함수 (env-driven config, deterministic per env)
- ✅ 결정성 (동일 input → 동일 prompt — Determinism scenario 검증)

| Tier | STEP | 사용처 |
|---|---|---|
| 1 정착 | STEP 86 | DocumentTrustMetadata 12 필드 |
| 2 entity helper | STEP 87 + 89 | Receipt + TaxInvoice trust derive |
| 3 cross-doc 통합 | STEP 91 | unified vocabulary export |
| 4 fiscal calculation | STEP 90 | withholding + classification |
| 5 new domain Pure Derive | STEP 92 | operational intelligence |
| **6 server-side protocol** | **STEP 93** | **AI integration protocol skeleton** |

---

## ⚠️ Risk Assessment — 🟢 Zero Risk

본 STEP은 **passive infrastructure** — UI 통합 부재로 production runtime에 영향 0건.

회귀 영향 가능 영역: **0개**. 호출자 부재로 client wrapper는 tree-shake out, server-only API route는 호출 없으면 실행 0건.

회귀 영향 없는 영역 (검증 0줄 변경):
- 모든 fiscal entity (Settlement / Tax / Invoice / Receipt / TaxInvoice)
- 모든 fiscal drawer (5개) + FiscalSummaryDrawer + AccountantExportDrawer
- STEP 92 operational-insight 시스템 (별개 deterministic layer)
- STEP 45 legacy MarketAnalysisDrawer
- DetailPanel UX-3 6 zones / Sidebar UX-2 grouping
- persistence (validateV1 / SCHEMA_VERSION)
- 모든 API routes (upload-image / delete-image / list-images)
- mock-data / package.json

미래 STEP 94+ 진입 시 `client.ts` import 시점에 처음 활성. 그때부터 회귀 영향 분석 시작.

---

## 🎯 본 STEP의 영구 가치

1. **AXVELA의 AI 정체성 영구 고정** — "operational software with intelligence layers, NOT AI-first" 헌법 수준 명시
2. **5 insertion point 영구 정의** — 향후 모든 AI 기능은 본 5 카테고리 중 하나로 합류 (무분별한 AI 호출 차단)
3. **AI-Disabled Safe Mode default** — AI 비용 / API key 부재 / provider 장애 시에도 시스템 정상 작동 보장
4. **Forbidden outputs 25개 영구 매뉴얼화** — 가격 / 진위 / 법적 / condition / 추천 5 영역 차단
5. **Server-side only 정책** — `NEXT_PUBLIC_` prefix 절대 금지 영구 명시
6. **Hallucination 최소화 원칙 영구 정착** — AI는 raw operational metric 직접 생성 부재, 이미 계산된 structured data만 *설명*
7. **6번째 영구 정책 문서** — 5 기존 정책과 cross-reference 정착

---

## 🚀 다음 STEP 권장

🅑 **STEP 94 — Provider client + UI integration 시작**
- Actual provider client wired (anthropic-sdk / openai-sdk)
- 첫 UI 연결 — Artwork form metadata assist (사용자 예시 "캔버스에 유채" → "Oil on Canvas")
- 사전 조건: `AXVELA_AI_ENABLED=true` + `AXVELA_AI_PROVIDER=anthropic` + `AXVELA_AI_API_KEY` env 정착

🅒 **STEP 101 — Approval Workflow / Trust Layer activation (Phase 6 진입)**
- 사용자 명시 순서: "STEP 101은 STEP 92 / 93 안정화 이후 진입"
- Phase 1 foundation freeze + Phase 3 baseline (STEP 92) + AI Integration protocol (STEP 93) 정착으로 진입 조건 충족
- STEP 86 `lockedBy` slot anchor 사용 시점

---

## 📝 7번째 연속 Clean Slate

본 turn 시작 시 STEP 93 산출물 0건 발견 (DOC-2 §2.1 7-step checklist 부재 시 통과). UX-3 / STEP 89 / STEP 91 / STEP 90 / DOC-2 / STEP 92 / 본 STEP 93까지 7번 연속 partial-state 0건. DOC-2 §2.4 Continuation Safe Conditions 적용 불요.

DOC-2 §3.4 New Abstraction Path 5-Question Gate 첫 실전 통과 사례 (STEP 92에 이어 두 번째):
- ✅ 기존 anchor (operational-insight) 표현 불가 — deterministic vs LLM-backed
- ✅ Minimum viable — types + config + prompts + route + client + scenarios만, UI integration 분리
- ✅ 후속 STEP 사용 계획 — STEP 94+ artwork form / document drawers / condition compare / market insight / 4-locale 모두
- ✅ Route 부담 ≤10 kB — **0 kB delta** (server-only API + tree-shaken client wrapper)
- ✅ 4 정책 정합 100% — 모두 grep verified
