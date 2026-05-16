# STEP 132.7 — AI Default Model Alignment (COMPLETE)

> **봉인 일자**: 2026-05-16
> **봉인 commit**: `TBD` (Box F 봉인 후 갱신)
> **선행 baseline**: `eb2a990` (STEP 132.6 Box 20 봉인 hash 정합 post-closure)
> **branch**: `claude/step127-architecture-review`

---

## a) 개요

**STEP 132.7 — AI Default Model Alignment** (single-phase, ~30분, 박스 단위 검증 사이클).

STEP 132.6 봉인 시점에 잔존 부채로 식별 + 명시 기록 (`HANDOFF.md` L443-444 / `STEP_132_6_COMPLETE.md` §h). `src/lib/ai/config.ts:43` 의 `DEFAULT_MODELS.anthropic = "claude-sonnet-4-7"` 부정확값 (실재 Anthropic 모델 부재) 을 `claude-sonnet-4-6` 으로 정정하여 single source of truth 회복. `.env.local` 의 `AXVELA_AI_MODEL` env override 제거 + scenarios fixture 7곳 동기화로 drift 방지.

`frozen §8 AI_DEFAULTS / AI Provider` 영역의 audit-safe 부정확값 정정 → 14_PERMANENT_POLICIES.md §10.3 정책 예외 절차 적용.

## b) 목적

1. **single source of truth 회복** — `DEFAULT_MODELS.anthropic` 값을 실재 Anthropic 모델 ID (`claude-sonnet-4-6`) 로 정합. STEP 132.6 의 `.env.local` `AXVELA_AI_MODEL` override 의존 path 해체.
2. **drift 방지** — `anthropic-provider.scenarios.ts` fixture 7곳 (5 bare + 2 dated suffix) 도 동기화. 향후 검토 시 `claude-sonnet-4-7` grep hit 0건 보장.
3. **신환경 진입 안전성** — CI / 신규 개발자 / staging 등 `.env.local` 부재 환경에서 즉시 fallback 정확 작동.

## c) 작업 범위 (확정)

| # | 파일 | 변경 |
|---|---|---|
| 1 | `src/lib/ai/config.ts:43` | `DEFAULT_MODELS.anthropic: "claude-sonnet-4-7" → "claude-sonnet-4-6"` (1 LOC) |
| 2 | `src/lib/__tests__/anthropic-provider.scenarios.ts` | `replace_all "claude-sonnet-4-7" → "claude-sonnet-4-6"` (7 hit, 5 bare + 2 dated suffix L139/158 짝 유지) |
| 3 | `.env.local` | `AXVELA_AI_MODEL=claude-sonnet-4-6` 줄 삭제 (3 env var `ENABLED`/`PROVIDER`/`API_KEY` 보존) |

**변경 통계** (tracked 파일 기준): 2 files changed, 8 insertions(+), 8 deletions(-). `.env.local` 1줄 삭제 (gitignored).

## d) Box 진행 기록

| Box | 작업 | 결과 |
|---|---|---|
| **A** | 정찰 4건 — HANDOFF "AI Provider" / §8 / §10.3 + src `claude-sonnet-4-7` 8 hits + `DEFAULT_MODELS` 4 hits + config.ts L35-55 read | 부정확값 분포 확정 (config:43 + scenarios.ts 7곳) |
| **A+** | 추가 정찰 — scenarios.ts 7 hit 가 mock fixture 인지 검증 (HANDOFF scenarios 11 hit / docs scenarios 50+ hit 모두 `anthropic-provider.scenarios.ts` 명시 부재 / file head STEP 94 "Mock-based, NO live network calls" 확인) | scenarios.ts = audit-safe mock fixture, frozen §8 명시 부재 → 옵션 A (9곳 전부 정정) 안전 |
| **B** | 정정 작업 3건 — scenarios.ts `replace_all` (7 hit, 5 bare + 2 dated) + config.ts:43 single Edit + .env.local 1줄 삭제 | `git diff --stat`: 2 files / 8 ins / 8 del. 부정확값 잔존 0 hits (`findstr` verify) |
| **C** | 검증 4건 순차 실행 | 1) `npx tsc --noEmit` 0 errors ✅ / 2) `npm run lint` 0 warnings/errors ✅ / 3) `npm run build` 14.2.15 production, 7/7 static pages ✅ / 4) `runAllScenarios()` 9/9 passed ✅ |
| **D** | 라이브 Anthropic API 호출 1회 — `.env.local` inline 로드 + `invokeProvider({ system, user, outputSchemaDescription, expectedJsonKeys }, { provider: "anthropic", apiKey, maxTokens: 20 })`. `model` 옵션 미전달 → `DEFAULT_MODELS[provider]` fallback 경로 진입 | ✅ ok=true / model="claude-sonnet-4-6" echo / text='{"ok":true}' / tokens 23 in + 8 out = 31 합산 |
| **E** | 문서 3건 — 본 COMPLETE doc + STEP_INDEX.md 갱신 (L17 header + L288 active STEP table 2 row 추가 + L293 변경 이력 2 entry 추가) + HANDOFF.md §10.3 132.7 entry 추가 (L381 위쪽, 시간순 역순) | 봉인 hash placeholder `TBD` (Box F 후 갱신) |
| **F** | commit + push + ZIP + (옵션) 봉인 hash 갱신 commit | 진행 예정 |

## e) 검증 결과

### Box C — 빌드 / 정합 / 회귀

| Stage | 명령 | 결과 |
|---|---|---|
| 1 | `npx tsc --noEmit` | ✅ 0 errors |
| 2 | `npm run lint` (next lint) | ✅ "No ESLint warnings or errors" |
| 3 | `npm run build` (next build) | ✅ Compiled successfully, 7/7 static pages, 8 routes (Route `/` 205 kB / First Load 292 kB) |
| 4 | `runAllScenarios()` (npx tsx -e dynamic import) | ✅ `{ summary: "9/9 passed", passed: 9, failed: 0 }` |

### Box D — 라이브 API

| 항목 | 값 |
|---|---|
| Endpoint | Anthropic Messages API (via `callAnthropic`) |
| Provider | `anthropic` |
| Model | `DEFAULT_MODELS.anthropic` fallback (claude-sonnet-4-6) |
| Request | `system`: "Reply with exactly the JSON {"ok":true}. Nothing else." / `user`: "ping" / `maxTokens`: 20 |
| Response | `ok: true` / `text: '{"ok":true}'` / `model: "claude-sonnet-4-6"` / `tokens: { input: 23, output: 8 }` |
| 의의 | env override 제거 후 fallback path 정확 작동 입증. config.ts 정정값이 production AI flow 실 진입 검증. |

### 부정확값 잔존 확인

`findstr /S /N "claude-sonnet-4-7" src` (Box C 후 재실행) → **0 hits**. 정정 100% 완료, drift 0.

## f) 정책 예외 기록 (§10.3 참조)

본 STEP 132.7 은 frozen STEP §8 영역 (`config.ts` AI_DEFAULTS / `anthropic.ts` AI Provider / `invoke.ts` dispatch) 의 audit-safe 정정 1 차례. `HANDOFF.md §10.3 "🚨 정책 예외 적용 기록"` 섹션 최상단에 영구 기록.

### 예외 (Box B) — config.ts:43 부정확값 정정 + scenarios fixture 동기화 + env override 제거

- **수정 위치 3 영역** (단일 commit chain)
- **합계**: tracked 2 files / +8 / -8 LOC + .env.local 1줄 삭제
- **HANDOFF.md entry**: `### STEP 132.7 — Box B: AI Default Model Alignment (config.ts:43 + scenarios fixture + .env.local)`

### 보존 약속 (frozen §8 무손상 보장)

| 항목 | 결과 |
|---|---|
| 시스템 정체성 (AI 의도 / 4 역할 / fail-close 정책) | ❌ 0 변경 |
| 함수 signature / export / 타입 정의 | ❌ 0 변경 |
| `DEFAULT_MODELS` 객체 shape (3 keys) | ❌ 0 변경 (value 1개만 정정) |
| `AI_DEFAULTS` 객체 (STEP 132.6 정착물) | ❌ 0 변경 |
| Backward Compatibility (`AXVELA_DEV_CONVENTION.md §9.1`) | ✅ 100% 정합 (caller `model` override path 보존) |
| Build Green (`§9.4`) | ✅ tsc 0 / lint 0 / build green / scenarios 9/9 |
| 라이브 API 작동 | ✅ HTTP 200, model echo 정합 |

### 대안 검토 (각 옵션과 기각 사유)

- **(A)** 9곳 전부 정정 (config + scenarios 7 + .env.local): ✅ 채택 — single source of truth 완전 회복, audit-safe.
- (B) 2곳만 (config + .env.local), scenarios fixture 보존: 검토 시 fixture 부정확값 hit → audit confusion, 기각.
- (C) `.env.local` override 유지 + config 만 정정: env 의존 영구화, single source of truth 미회복, 기각.
- (D) 보류 — 별도 STEP 132.8 로 이월: 잔존 부채 누적 + 신환경 진입 시 즉시 fail risk, 기각.

## g) 4-Layer 백업 (각 Box ZIP archive)

| Layer | 상태 |
|---|---|
| Working tree | (Box F 완료 후 clean) |
| Local .git | (Box F commit 후) |
| GitHub remote | (Box F push 후) |
| ZIP archive | `~/Downloads/AXVELA_STEP_132_7_<hash>_FINAL.zip` (Box F 마무리 시) |

## h) 차기 STEP 연결

### STEP 132.8 — Image-First Curation Auto-Fill (메모리 spec)

- **목적**: 사용자 발견 spec (메모리 #3~#7) — 이미지 + 작가 + 제목 입력 만으로 AI 가 5 curation fields 자동 채움
- **포함 영역**:
  - 작가 한↔영 자동 정규화 (예: "이우환" → "Lee Ufan")
  - Dimensions cm↔in 자동 변환
  - 5 curation fields (description / curationDraft / exhibitionText / artistNote / provenanceNote) 의 AI 보조 wire
  - AI 안전장치 (수정 가능 + "모름은 모름" 표시)
  - 3-Mode 등록 lifecycle (manual / AI-assisted / hybrid)
- **예상 분량**: 10~15 시간 (별도 세션 풀 컨디션 권장)
- **전제 조건 정합**: STEP 132.7 봉인으로 DEFAULT_MODELS / `.env.local` / scenarios fixture single source of truth — STEP 132.8 진입 시 모델명 drift risk 0.

### 재발 방지 — `DEFAULT_MODELS` 정합 패턴

- 신모델 등장 / 모델 deprecation 시 동일 §10.3 절차 (옵션 제시 → 박진휘 분 승인 → 영구 기록) 반복.
- scenarios fixture 모델명 = `DEFAULT_MODELS` 값과 동기화 유지. (drift detect 시 별도 alignment STEP 분리.)

---

**STEP 132.7 완전 봉인** — frozen §8 audit-safe 정정 1 차례 §10.3 영구 정착 + 라이브 API model echo 정합 + 부정확값 잔존 0. 차기 STEP 132.8 진입 가능 상태.
