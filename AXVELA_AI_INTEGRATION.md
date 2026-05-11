# AXVELA AI Integration Architecture

> **6번째 영구 정책 문서**
> AI Direction §1/§10 / Trust Layer / Fiscal / Manifesto / DOC-2 위에 정착된 *AI insertion architecture*.
>
> 정착 시점: STEP 93 (2026-05-07).
> 본 문서는 *AI를 어떻게 AXVELA에 통합하는지*에 대한 헌법.

---

## 0. Reading Guide

| 결정점 | 참조 섹션 |
|---|---|
| AXVELA가 AI-first 제품인가? | §1 Architecture Position |
| 어떤 AI 기능을 추가할 수 있는가? | §2 5 AI Insertion Points |
| AI는 어떤 데이터 흐름으로 연결되는가? | §3 AI Service Protocol Architecture |
| AI가 비활성 상태일 때 시스템은 어떻게 동작하는가? | §4 AI-Disabled Safe Mode |
| AI 출력에서 절대 허용 안 되는 표현은? | §5 Forbidden Outputs |
| Prompt는 어떻게 작성되어야 하는가? | §6 Prompt Engineering Conventions |
| API key / 외부 호출은 어디서 일어나는가? | §7 Provider Abstraction |

---

## 1. Architecture Position — "Operational Software with Intelligence Layers"

### 1.1 AXVELA의 정체성

AXVELA는:

- ✅ **operational software** (갤러리 운영 인프라)
- ✅ **intelligence layers** (assistive, structured)

NOT:

- ❌ AI-first product
- ❌ autonomous AI agent platform
- ❌ AI valuation / pricing service
- ❌ AI appraisal authority

사용자 spec 명시:

> 현재 AXVELA 방향은 "AI-first product"가 아니라
> "operational software with intelligence layers"입니다.

### 1.2 AI의 역할 — Assistive Only

AI는 다음 역할만 수행:

| 역할 | 예시 |
|---|---|
| **Normalize** | "캔버스에 유채" → "Oil on Canvas" |
| **Rewrite (institutional tone)** | short notes → invoice description |
| **Summarize** | LiDAR variance data → "Surface variance observed near the lower-right edge" |
| **Translate** | KO ↔ EN ↔ JA ↔ ZH (gallery operational) |
| **Explain structured data** | operational metrics → institutional summary |

AI는 다음 역할을 *절대* 수행하지 않음:

- ❌ Raw operational metrics 직접 생성 (데이터는 deterministic하게 계산, AI는 *설명*만)
- ❌ Pricing prediction
- ❌ Valuation / appraisal
- ❌ Authenticity judgment
- ❌ Legal / tax final determination
- ❌ Autonomous decisions / actions
- ❌ "Damage confirmed" / "Authenticity compromised" 같은 확정 표현

### 1.3 데이터 흐름의 절대 순서

```
real operational data (deterministic)
        ↓
derived insight / structured metric (deterministic)
        ↓
AI summarization / explanation (assistive)
        ↓
human review / decision (final)
```

**AI는 raw operational metrics를 *직접 생성하지 않는다*.**

이는 hallucination 최소화를 위한 핵심 원칙. AI는 이미 계산된 structured data를 *설명*하는 역할만 수행. 즉 STEP 92에서 `operational-insight.ts`가 deterministic하게 metrics를 계산하고, AI는 그 결과를 institutional tone으로 *rewrite*만 수행.

---

## 2. 5 AI Insertion Points

각 insertion point는 다음 5 항목 명시:
- **Kind** (protocol identifier)
- **Input schema** (structured data — AI가 *생성하지 않음*, deterministic하게 *제공받음*)
- **Output schema** (structured rewrite / summary)
- **Forbidden outputs** (insertion point 별 추가 금지 영역)
- **Fallback behavior** (AI 비활성 시 동작)

### 2.1 `artwork_metadata` — Artwork Metadata Assist

**목표**: Manual data entry 감소.

**Input**:
```typescript
{
  rawTitle?: string;        // 운영자가 입력한 raw title
  rawMaterial?: string;     // 운영자가 입력한 raw material (e.g. "캔버스에 유채")
  rawCategory?: string;
  rawNotes?: string;
}
```

**Output**:
```typescript
{
  normalizedTitle?: string;
  normalizedMaterial?: string;     // e.g. "Oil on Canvas"
  suggestedCategory?: ArtworkCategory;
  cleanedNotes?: string;
  normalizationNotes?: string[];   // "원본 보존: 캔버스에 유채 → Oil on Canvas"
}
```

**Forbidden outputs**:
- ❌ Year / date guessing (artist career timeline 추정 금지)
- ❌ Authentication claims
- ❌ Provenance fabrication
- ❌ Price suggestions
- ❌ Edition number guessing

**Fallback**: 운영자가 직접 입력 (현재 form UI 그대로).

### 2.2 `document_writing` — Document Writing Assist

**목표**: Short notes → institutional writing tone rewrite.

**지원 문서**: Invoice / Receipt / Condition Report / Settlement Summary / Shipment Summary / Artwork Description.

**Input**:
```typescript
{
  documentType: "invoice" | "receipt" | "condition_report" | "settlement_summary" | "shipment_summary" | "artwork_description";
  shortNotes: string;
  contextSummary?: string;  // optional — 작품/거래/고객 정보
  locale?: "ko" | "en" | "ja" | "zh";
}
```

**Output**:
```typescript
{
  rewrittenText: string;
  toneNotes?: string[];     // "institutional / formal / present tense"
}
```

**Forbidden outputs**:
- ❌ Legal final wording (e.g. "이 계약은 법적 효력이 있습니다")
- ❌ Tax determination (e.g. "VAT 면세 확정")
- ❌ Authenticity guarantee
- ❌ Title/ownership transfer claims
- ❌ Pricing decisions

**중요**: AI는 *정리* 역할. Legal / final wording 확정은 운영자 / 법무 / 회계 검토 후.

**Fallback**: 운영자가 직접 작성 (현재 textarea 그대로).

### 2.3 `condition_compare` — Condition Compare Summary

**목표**: LiDAR / visual compare 결과 기반 institutional tone summary.

**Input**:
```typescript
{
  baselineCapturedAt: string;     // ISO datetime
  currentCapturedAt: string;
  surfaceVarianceMetrics: {
    region: string;             // e.g. "lower-right-edge"
    deltaMM: number;            // e.g. 0.4
    classification: "minor" | "moderate" | "significant";
  }[];
  depthVariationMetrics?: {
    region: string;
    deltaMM: number;
  }[];
  visualDifferenceMetrics?: {
    region: string;
    similarity: number;          // 0..1
  }[];
}
```

**Output**:
```typescript
{
  summary: string;                 // institutional tone, e.g. "Surface variance observed near the lower-right edge."
  observationLines: string[];      // structured observations
  reviewRequired: boolean;          // true if any "significant" classification
}
```

**Forbidden outputs**:
- ❌ "Damage confirmed"
- ❌ "Authenticity compromised"
- ❌ "Forgery suspected"
- ❌ Conservation / restoration prescription
- ❌ Insurance / legal liability statements
- ❌ Final condition rating ("A-grade" / "Damaged")

**허용 표현**:
- ✅ "Surface variance observed near..."
- ✅ "Depth variation detected at..."
- ✅ "Visual difference identified in..."
- ✅ "Conservator review recommended"
- ✅ "Further inspection advised"

**Fallback**: deterministic structured report (variance metrics를 그대로 list 형태로 표시, 한 줄 요약 부재).

### 2.4 `operational_insight` — Operational Insight Summary (STEP 92 방향 정합)

**목표**: STEP 92에서 정착한 `operational-insight.ts` 결과의 institutional rewrite.

**Input**:
```typescript
{
  snapshot: OperationalInsightSnapshot;  // STEP 92 deterministic output
  period: InsightPeriod;
  artworkContext?: { artworkId: string; artworkTitle: string };
}
```

**Output**:
```typescript
{
  overview: string[];           // 3-line institutional summary (max)
  categoryRewrites: {
    kind: "inquiry" | "save" | "artist" | "settlement" | "funnel" | "activity";
    headline: string;
    observations: string[];     // 1-3 lines
  }[];
}
```

**Forbidden outputs** (STEP 92 정책 그대로 답습):
- ❌ Pricing prediction
- ❌ Investment scoring
- ❌ Speculative valuation
- ❌ Autonomous recommendations
- ❌ "Buy / sell / hold" advice
- ❌ Confidence scores invented out of thin air

**Fallback**: STEP 92 `generateInsightSummary` deterministic templated output (이미 정착됨, 항상 사용 가능).

### 2.5 `translation` — Translation Layer

**목표**: Gallery operational translation assist.

**지원 언어**: KO ↔ EN ↔ JA ↔ ZH.

**Input**:
```typescript
{
  sourceText: string;
  sourceLocale: "ko" | "en" | "ja" | "zh";
  targetLocale: "ko" | "en" | "ja" | "zh";
  domain?: "artwork_description" | "invoice" | "general";
}
```

**Output**:
```typescript
{
  translatedText: string;
  notes?: string[];               // e.g. "고유명사 보존: 〈Untitled〉"
}
```

**Forbidden outputs**:
- ❌ Adding information not in source (hallucination 방지)
- ❌ Removing critical operational data (price / size / date)
- ❌ Translating proper names of artworks (보존 권장)

**Fallback**: 운영자가 직접 번역 또는 외부 도구 사용.

---

## 3. AI Service Protocol Architecture

### 3.1 데이터 흐름

```
┌──────────────────────────────────────────────────────────────┐
│  Client UI                                                  │
│  - Drawer / Modal / Form                                    │
│  - User explicit trigger only (rule_5 AI-Human Loop)        │
│  - Calls requestAIAssist<K>(request)                        │
└──────────────────────────────────────────────────────────────┘
                        ↓ POST /api/ai-assist
┌──────────────────────────────────────────────────────────────┐
│  Server-Side API Route (src/app/api/ai-assist/route.ts)     │
│  - Validate request shape                                   │
│  - Check AI enabled (env flag)                              │
│  - Build prompt from template (src/lib/ai/prompts.ts)        │
│  - Apply output guards                                      │
│  - Call provider (anthropic / openai / gemini)              │
│  - Return structured AIAssistResponse                        │
└──────────────────────────────────────────────────────────────┘
                        ↓ provider call
┌──────────────────────────────────────────────────────────────┐
│  External Provider (Claude / OpenAI / Gemini)                │
│  - API key server-side only                                 │
│  - Never exposed to client                                   │
└──────────────────────────────────────────────────────────────┘
                        ↓ raw response
┌──────────────────────────────────────────────────────────────┐
│  Output Guard (src/lib/ai/types.ts FORBIDDEN_PHRASES)        │
│  - Reject if forbidden phrases detected                      │
│  - Return ai_unavailable with reason "output_rejected"       │
└──────────────────────────────────────────────────────────────┘
                        ↓ structured response
            AIAssistResponse<K> back to client
```

### 3.2 Protocol Shape

```typescript
type AIAssistRequest<K extends AIAssistKind> = {
  kind: K;
  input: AIAssistInputMap[K];
  locale?: "ko" | "en" | "ja" | "zh";
  meta?: { gallerySlug?: string; userId?: string };
};

type AIAssistResponse<K extends AIAssistKind> =
  | { status: "ok"; output: AIAssistOutputMap[K]; meta: AIAssistMeta }
  | { status: "ai_unavailable"; reason: AIUnavailableReason; fallback?: AIAssistOutputMap[K] }
  | { status: "validation_error"; errors: string[] };

type AIUnavailableReason =
  | "disabled"
  | "provider_not_configured"
  | "rate_limit"
  | "provider_error"
  | "output_rejected"
  | "timeout";
```

### 3.3 Type-safe per Kind

각 insertion point는 *discriminated union*으로 type-safe하게 정의. Client 코드는 `AIAssistRequest<"artwork_metadata">` 등 generic 사용 시 input/output type 자동 추론.

---

## 4. AI-Disabled Safe Mode

### 4.1 기본 상태 — Disabled

AXVELA의 AI 기능은 **default disabled**. 활성화 조건:

```bash
AXVELA_AI_ENABLED=true                    # required
AXVELA_AI_PROVIDER=anthropic               # one of: anthropic | openai | gemini
AXVELA_AI_API_KEY=<server-side-only>       # required
```

위 3 env var이 모두 설정되지 않으면 모든 AI insertion point는 자동으로 `ai_unavailable` 응답.

### 4.2 Per-Kind Granular Flag

각 insertion point는 독립적으로 disable 가능:

```bash
AXVELA_AI_ARTWORK_METADATA_ENABLED=true    # default: true (when AI enabled)
AXVELA_AI_DOCUMENT_WRITING_ENABLED=true
AXVELA_AI_CONDITION_COMPARE_ENABLED=true
AXVELA_AI_OPERATIONAL_INSIGHT_ENABLED=true
AXVELA_AI_TRANSLATION_ENABLED=true
```

### 4.3 Graceful Degradation

AI 비활성 상태에서:

- ✅ UI는 정상 작동 (AI assist 버튼이 보이지 않거나 disabled)
- ✅ 운영자는 manual entry / direct write 그대로 사용 가능
- ✅ STEP 92 deterministic operational insight는 항상 작동
- ✅ Fallback 응답은 structured (errors 없음)

### 4.4 Failure Modes

| Failure | Response | UI 처리 |
|---|---|---|
| Env not configured | `ai_unavailable: "disabled"` | AI 버튼 비활성 |
| Provider call timeout | `ai_unavailable: "timeout"` | "잠시 후 다시 시도" toast |
| Output rejected (forbidden) | `ai_unavailable: "output_rejected"` | "안전 가이드라인에 따라 응답을 거부했습니다" |
| Rate limit | `ai_unavailable: "rate_limit"` | "잠시 후 다시 시도" toast |
| Validation error | `validation_error: [...]` | Form에 inline error 표시 |

---

## 5. Forbidden Outputs (모든 insertion point 공통)

다음 표현이 AI 출력에 포함되면 **자동으로 reject**:

### 5.1 가격 / 가치 관련 (AI Direction §1 정확 매칭)

- "예상 가격" / "추정 가치" / "estimated price" / "estimated value"
- "투자 수익" / "ROI" / "appreciation potential"
- "가격 상승" / "price increase forecast"
- "시장가" / "market value" (확정 표현 — "참고가" 또는 "추정 범위"는 가능)
- "확정 시장가" / "fair market value confirmed"

### 5.2 진위 / 감정 관련

- "Authenticity confirmed"
- "정품 확인"
- "Forgery suspected"
- "감정 결과"
- "원작자 확정"

### 5.3 법적 / 세무 관련

- "법적 효력 보장"
- "세무 신고 완료"
- "VAT 면세 확정" (검토 필요는 가능)
- "원천징수 확정"
- "compliance verified"

### 5.4 condition / 손상 관련

- "Damage confirmed"
- "손상 확정"
- "Restoration required" (검토 권장은 가능)
- "Insurance claim warranted"

### 5.5 자율 추천 / 결정 관련

- "Buy / sell / hold this work"
- "구매 권장" / "판매 권장"
- "이 작품을 추천합니다" (curation 추천은 별개 — 본 항목은 *재무 결정* 추천)

### 5.6 Output Guard 구현 정책

- Forbidden phrase 검출 시 `ai_unavailable` 응답 (status="ai_unavailable", reason="output_rejected")
- 검출은 substring match (case-insensitive, locale-agnostic)
- 검출 시 audit log에 기록 (production 정착 시)

---

## 6. Prompt Engineering Conventions

### 6.1 System Prompt 필수 구성요소

모든 prompt template은 다음 구성요소를 *반드시* 포함:

```
1. Role — "You are an operational assist for AXVELA Gallery OS"
2. Tone — "Korean institutional / formal / minimalist"
3. Task — kind-specific (e.g. "Normalize material expressions")
4. Forbidden outputs — §5 list 명시 inline
5. Output schema — strict JSON shape
6. Examples (1-3 mini-examples)
```

### 6.2 Structured Output Enforcement

모든 prompt는 **strict JSON output** 요구:

```
Output ONLY a JSON object matching this schema:
{
  "normalizedMaterial": string | null,
  "normalizationNotes": string[]
}

DO NOT include explanatory text outside the JSON.
DO NOT use markdown code fences.
```

### 6.3 Determinism Where Possible

- `temperature: 0.1` (저-온도 prefer)
- `top_p: 0.9`
- 동일 input → 동일 output 가능한 한 보장 (prompt에 caching key 포함)

### 6.4 Locale Handling

- `locale` 명시 시 → 해당 언어로만 응답
- 명시 부재 시 → input language detection → 동일 언어로 응답
- 단 institutional rewrite 시 default `ko` (Korean institutional)

---

## 7. Provider Abstraction

### 7.1 Provider 추상화

```typescript
type AIProvider = "anthropic" | "openai" | "gemini";

interface AIProviderClient {
  invoke(opts: {
    system: string;
    user: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ text: string; usage?: { input: number; output: number } }>;
}
```

### 7.2 Server-Side Only

- ✅ API key는 **process.env** 로만 접근 (server-side only)
- ✅ Next.js App Router의 server route handler에서만 provider 호출
- ❌ Client component에서 직접 fetch to provider 절대 금지
- ❌ API key를 환경변수 prefix `NEXT_PUBLIC_` 사용 절대 금지

### 7.3 Provider Switching

- Single provider만 active (env `AXVELA_AI_PROVIDER` 기준)
- Provider switching은 deployment 시점에만 가능 (runtime fallback 없음)
- 향후 multi-provider failover는 *new STEP*으로 분리 (현재 minimum viable scope 외)

---

## 8. Cross-Reference — 6 영구 정책 + 1 navigation layer

| # | 문서 | 정합 관계 |
|---|---|---|
| 1 | AXVELA_AI_DIRECTION.md | §5 Forbidden Outputs가 §1 / §10 정확 답습 |
| 2 | AXVELA_TRUST_LAYER.md | §1.2 "Assistive Only"가 "PERMISSION ≠ APPROVAL" 분리와 정합 (AI는 권한 부여 불가, approval workflow 미진입) |
| 3 | AXVELA_FISCAL_ARCHITECTURE.md | §2.2 document_writing이 fiscal calculation 0건 (rule_3 strict) |
| 4 | AXVELA_OS_Manifesto.xml | rule_5 AI-Human Loop 강화 — 사용자 명시 trigger only / human review 필수 |
| 5 | AXVELA_DEV_CONVENTION.md (DOC-2) | §3.4 New Abstraction Path 5-Question Gate 통과 (operational-insight anchor와 다른 domain) |
| 6 | **AXVELA_AI_INTEGRATION.md** ⭐ | **본 문서** |
| nav | STEP_INDEX.md | STEP 93 entry로 본 문서 정착 명시 |

---

## 9. Versioning & 영구 가치

### 9.1 Versioning Policy (DOC-2 §7 답습)

- ✅ **추가만 허용** — 새 insertion point / 새 forbidden phrase / 새 fallback 추가
- ❌ **삭제 금지** — 기존 insertion point 제거 시 새 STEP 번호 필수
- ❌ **완화 금지** — Forbidden phrase list는 *축소 불가*, 추가만 가능
- ❌ **사례 수정 금지** — 정착된 prompt template은 새 STEP에서만 변경

### 9.2 영구 가치

1. **AXVELA의 AI 정체성 고정** — "operational software with intelligence layers" (NOT AI-first)
2. **5 insertion point 영구 정의** — 향후 모든 AI 기능은 본 5 카테고리 중 하나로 합류
3. **AI-Disabled Safe Mode default** — AI 비용 / API key 부재 시에도 시스템 정상 작동
4. **Forbidden outputs 영구 매뉴얼화** — 가격 예측 / 진위 / 법적 final wording 절대 차단
5. **Server-side only 정책** — API key client 노출 영구 금지
6. **Hallucination 최소화 원칙** — AI는 raw metric 직접 생성 부재, 이미 계산된 structured data만 *설명*

### 9.3 한 문장 요약

> AXVELA는 operational software이며, AI는 운영자를 보조하는 *layer*다. AI는 가격 / 진위 / 법적 최종 판단을 절대 수행하지 않고, 이미 계산된 structured data를 institutional tone으로 설명 / 번역 / 정리하는 역할만 수행한다. AI가 비활성된 상태에서도 시스템은 완전히 작동한다.
