# STEP 132.6 — AI Activate + frozen §8 Exception (COMPLETE)

> **봉인 일자**: 2026-05-16
> **봉인 commit**: (Box 20)
> **봉인 tag**: `step-132.6-closed`
> **선행 baseline**: `b8c0ec9` (STEP 132 Phase 2 Closure)

---

## a) 개요

**STEP 132.6 — AI Activate + frozen §8 Exception** (single-phase STEP, Phase 구분 없음).

STEP 132 Phase 2 (Server-side PDF Invoice/Contract) 직후 진입한 single-phase STEP. AI Provider 활성화 검증 (claude-sonnet-4-6 라이브 시연) 을 목표로 진행 중, 기존 frozen STEP §8 "AI Provider" 영역의 Anthropic API 현행 정책 (신모델 `temperature` + `top_p` 동시 거부) 과의 불일치 발견. 박진휘 분 명시 승인에 따라 14_PERMANENT_POLICIES.md §10.3 "정책 §N 예외 적용" 절차 정착 + 영구 기록.

## b) 목적

1. **AI Provider 활성화 검증** — `.env.local` 설정 + production `/api/ai-assist` route 의 end-to-end 작동 검증 (UI 호출 → server route → Anthropic API → JSON parse → response).
2. **claude-sonnet-4-6 라이브 시연** — Material 정규화 시연 (한국어 "캔버스에 유채" → "Oil on Canvas") 을 통한 5 AI 보조 기능 (artwork_metadata 외 4종) 의 실 운영 가능성 입증.
3. **frozen §8 AI Provider 정책 예외 영구 정착** — Anthropic 신모델 정책 변경 대응 + §10.3 절차 표준화.

## c) Commit chain (5 commit + COMPLETE doc)

| SHA | Box | 변경 영역 | 핵심 변경 |
|---|---|---|---|
| **`d175b97`** | Box 13 | `src/lib/ai/providers/anthropic.ts` + `HANDOFF.md` | frozen §8 예외 — top_p conditional 분기 + 정책 예외 적용 기록 §10.3 신규 섹션 |
| **`c514748`** | Box 13 | `.env.example` | AXVELA AI Integration 섹션 머지 (BLOB_READ_WRITE_TOKEN 보존) |
| **`c19ecab`** | Box 17 | `src/lib/ai/config.ts` | `AI_DEFAULTS.topP: 0.9 → undefined` (route caller-side chain 정합) |
| **`b4d6634`** | Box 18 | `HANDOFF.md §10.3` | Box 14.2 AI_DEFAULTS.topP exception entry 추가 (시간순 역순 배치) |
| **`ec6d7e4`** | Box 19 | `HANDOFF.md` (3 영역) | STEP 130/131/131.5/132/132.6 일괄 정합화 (현재 상태 + 진행 흐름 + 산출물) |
| (Box 20 commit) | Box 20 | `docs/steps/STEP_132_6_COMPLETE.md` + `HANDOFF.md` | 본 COMPLETE doc + HANDOFF 봉인 갱신 |

## d) Box 진행 기록

| Box | 작업 |
|---|---|
| **1~5** | `.env.local` + `.env.example` 환경변수 layer 정착 / `readAIConfig` / `isKindEnabled` 검증 (5/5 PASS) |
| **6** | ping v1 — `claude-sonnet-4-7` 404 not_found_error 발견 (DEFAULT_MODELS 부정확) |
| **7** | invoke.ts / providers/anthropic.ts / prompts.ts 구조 분석 |
| **8** | ping v2 — `claude-sonnet-4-6` HTTP 400 `temperature + top_p` 동시 거부 발견 |
| **9** | callAnthropic destructuring default `topP = 0.9` 무력화 발견 |
| **10** | ping v3 — `claude-3-5-sonnet-20241022` 404 (deprecated) — 모델 lookup 재시도 |
| **11** | **anthropic.ts conditional 패턴 정착** (frozen §8 예외 #1) + ping v4 HTTP 200 PASS |
| **12** | HANDOFF.md §10.3 "정책 예외 적용 기록" 신규 섹션 + Box 11 entry |
| **13** | commit chain (`d175b97` + `c514748`) — frozen §8 예외 + .env.example AI 섹션 |
| **14.1** | 정찰 — `route.ts:347` topP 명시 전달로 Box 11 fix 무력화 발견 (Issue #1) |
| **14.2** | **AI_DEFAULTS.topP = undefined 정착** (frozen §8 예외 #2) + ping v5 HTTP 200 PASS |
| **15.x** | **라이브 시연** — dev server 신규 기동 → `POST /api/ai-assist` 4회 연속 HTTP 200 OK (claude-sonnet-4-6, 4~5초 응답) |
| **16** | dev server 안전 종료 + STEP_132_6_PAUSE_HANDOFF.md 작성 (새벽 2시 마무리) |
| **17** | Box 14.2 commit (`c19ecab`) + push + ZIP (`BOX_14_2`) |
| **18** | HANDOFF.md §10.3 Box 14.2 entry 추가 (`b4d6634`) + push + ZIP (`BOX_18`) |
| **19** | HANDOFF.md 풀 정합화 — STEP 130/131/131.5/132/132.6 5건 일괄 entry 추가 (`ec6d7e4`) + push + ZIP (`BOX_19`) |
| **20** | **봉인** — 본 COMPLETE doc + tag `step-132.6-closed` + 최종 ZIP `_FINAL` |

## e) 검증 결과

### Ping 검증

| Ping | Box | 모델 | HTTP | 결과 | 의의 |
|---|---|---|---|---|---|
| v1 | 6 | claude-sonnet-4-7 (hardcoded) | 404 | not_found_error | 모델 lookup fail |
| v2 | 8 | claude-sonnet-4-6 (env) | 400 | invalid_request_error | top_p conflict 발견 |
| v3 | 10 | claude-3-5-sonnet-20241022 | 404 | not_found_error | deprecated |
| **v4** | **11** | **claude-sonnet-4-6** | **200** | **"PONG" 정확 수신** | **callAnthropic 직접 호출 PASS** |
| **v5** | **14.2** | **claude-sonnet-4-6** | **200** | **"PONG" 정확 수신** | **route caller-side chain 재현 PASS** |

### 라이브 시연 (Box 15.x)

| Call # | 응답 시간 | HTTP | 결과 |
|---|---|---|---|
| 1 | 5,077 ms | 200 | ✅ AI 정상 응답 (첫 호출 = 컴파일 포함) |
| 2 | 4,016 ms | 200 | ✅ |
| 3 | 4,270 ms | 200 | ✅ |
| 4 | 4,855 ms | 200 | ✅ |

→ **4회 연속 200 OK** — production AI flow 안정성 입증. Anthropic API (`claude-sonnet-4-6`) + 5 AI 보조 기능 운영 가능 상태.

## f) 정책 예외 기록 (§10.3 참조)

본 STEP 132.6 은 frozen STEP §8 "AI Provider — anthropic.ts / invoke.ts / 4-step guard" 영역의 **2 차례 예외** 적용. 모두 `HANDOFF.md §10.3 "🚨 정책 예외 적용 기록"` 섹션에 영구 기록.

### 예외 #1 (Box 11) — anthropic.ts conditional 패턴

- **수정 위치**: `src/lib/ai/providers/anthropic.ts`
  - line 101-103: destructuring default `topP = 0.9` → `topP = undefined`
  - line 110-126: request body const 분리 + `if (topP !== undefined && topP !== null)` conditional 분기
  - line 137: `body: JSON.stringify(requestBody)` 변수 참조 전환
- **합계**: 순 +5 LOC, 함수 외부 영향 0
- **HANDOFF.md entry**: `### STEP 132.6 — frozen §8 "AI Provider" 예외 적용`

### 예외 #2 (Box 14.2) — AI_DEFAULTS.topP undefined

- **수정 위치**: `src/lib/ai/config.ts` line 169
  - `AI_DEFAULTS.topP: 0.9` → `topP: undefined` + 주석 1줄
- **합계**: 순 +1 LOC, `AI_DEFAULTS` shape 무변경 (`as const`)
- **HANDOFF.md entry**: `### STEP 132.6 — Box 14.2: AI_DEFAULTS.topP 추가 예외 (route caller-side chain)`

### 보존 약속 (frozen §8 무손상 보장)

| 항목 | 결과 |
|---|---|
| 시스템 정체성 (AI 의도 / 4 역할 / fail-close 정책) | ❌ 0 변경 |
| 함수 signature / export / 타입 정의 | ❌ 0 변경 |
| `AnthropicCallOptions` interface | ❌ 0 변경 |
| `AI_DEFAULTS` 객체 shape (`as const`) | ❌ 0 변경 |
| Backward Compatibility (`AXVELA_DEV_CONVENTION.md §9.1`) | ✅ 100% 정합 |
| Build Green (`§9.4`) | ✅ `npx tsc --noEmit` 0 errors |

## g) 4-Layer 백업 (각 Box ZIP archive)

| Box | ZIP 파일명 | 저장 위치 | 시점 |
|---|---|---|---|
| 14.2 | `AXVELA_STEP_132_6_BOX_14_2_c19ecab.zip` | `~/Downloads/` | Box 17 |
| 18 | `AXVELA_STEP_132_6_BOX_18_b4d6634.zip` | `~/Downloads/` | Box 18 |
| 19 | `AXVELA_STEP_132_6_BOX_19_ec6d7e4.zip` | `~/Downloads/` | Box 19 |
| **20 (FINAL)** | **`AXVELA_STEP_132_6_BOX_20_[봉인hash]_FINAL.zip`** | `~/Downloads/` | Box 20 (본 봉인) |

### 4-Layer 완비 검증

| Layer | 상태 |
|---|---|
| Working tree | ✅ clean (PAUSE_HANDOFF 삭제 후) |
| Local .git | ✅ Box 20 봉인 commit (HEAD) + tag `step-132.6-closed` |
| GitHub remote | ✅ `origin/claude/step127-architecture-review` 동기화 + tag push |
| ZIP archive | ✅ `~/Downloads/AXVELA_STEP_132_6_BOX_20_*_FINAL.zip` |

## h) 차기 STEP 연결

### STEP 132.7 — AI Default Model Alignment (잔존 부채)

- **목적**: `src/lib/ai/config.ts:43` `DEFAULT_MODELS.anthropic = "claude-sonnet-4-7"` 부정확값 정정
- **현 상태**: `.env.local` 의 `AXVELA_AI_MODEL=claude-sonnet-4-6` override 로 우회 중
- **권장 방향**: `DEFAULT_MODELS.anthropic` 을 실재 모델 ID 로 정합화 (예: `claude-sonnet-4-6`) — single source of truth 회복
- **분류**: 별도 STEP 분리 권장 (단순 const 값 정합, frozen §8 영역이지만 예외 절차 적용 가능)

### STEP 132.8 — Image-First Curation Auto-Fill (신규 spec)

- **목적**: 사용자 발견 spec (메모리 #3~#7) — 이미지 + 작가 + 제목 입력 만으로 AI 가 5 curation fields 자동 채움
- **포함 영역**:
  - 작가 한↔영 자동 정규화 (예: "이우환" → "Lee Ufan")
  - Dimensions cm↔in 자동 변환
  - 5 curation fields (description / curationDraft / exhibitionText / artistNote / provenanceNote) 의 AI 보조 wire
  - AI 안전장치 (수정 가능 + "모름은 모름" 표시)
  - 3-Mode 등록 lifecycle (manual / AI-assisted / hybrid)
- **예상 분량**: 10~15 시간
- **권장**: 새 세션 풀 컨디션 진입 (현 STEP 132.6 봉인 후 별도 STEP)

---

**STEP 132.6 완전 봉인** — frozen §8 AI Provider 예외 2 차례 영구 정착 + 라이브 시연 4회 연속 200 OK + 4-Layer 백업 완비. 차기 STEP 132.7 / 132.8 진입 가능 상태.
