# STEP 132 — Phase 1 Architecture Review (Server-side PDF)

**작성 시점**: 2026-05-13
**Baseline**: `dddebfa` (STEP 131 Phase 2 Closure HEAD)
**Branch**: `claude/step127-architecture-review` (STEP 127~132 연속 commit 흐름)
**작업 성격**: doc-only Phase 1 review — 코드 0줄. Phase 2 implementation 은 별도 진입.
**리스크 평가**: 🟡 **Medium** (신규 dependency 도입 가능성 + 4 surface 통합 + Korean font 검증 + Vercel Hobby plan 제약)

---

## §1 개요

### §1.1 STEP 132 목표

STEP 128 §7 revised roadmap 의 세 번째 단계 (STEP 132 = "Server-side PDF"). Invoice / Contract / Passport / Certificate **4 surface** 의 PDF 출력 인프라 정착.

작업 본질:
- **현재 메커니즘**: 4 PrintView 정착물 (총 1035 LOC) 가 `window.print()` 단독 — 사용자가 직접 Cmd/Ctrl+P → "PDF 로 저장" (client-side, browser native)
- **신규 영역**: Server-side PDF 생성 — 이메일 첨부 / 다운로드 link / 자동 발급 흐름 진입점
- **사용자 사전 결정** (STEP 128 §9 항목 6): "신규 영역만 server-side PDF, 기존 4 PrintView 보존" — *별도 dimension* 정착 결정

### §1.2 매니페스토 정합 (사전 검증)

| Rule | 정합 영역 |
|------|----------|
| **rule_1** (SSOT — `artwork.id`) | PDF 도 같은 `artwork.id` 진입, 4 surface 모두 single source |
| **rule_4** (Document Trust Layer — Version + Status + Approval + Audit) | PDF 가 LOCKED document 의 *immutable artifact* — version 정합 + audit 진입 |
| **rule_5** (AI-Human Loop) | PDF 자동 발급 = AI 자동 LOCK 위험 회피 — 운영자 명시 클릭 진입 필수 |
| **rule_11** (Document Chain — Inquiry → Transaction → Invoice → Payment → Receipt → Settlement → Tax) | PDF 출력은 chain *외부 read* — 데이터 영향 0 |
| **rule_16** (museum-safe minimal) | PDF 디자인 정합 (현 PrintView 정착물의 minimal layout 답습) |
| **영구 정책 1** (Phase 1 Fiscal frozen) | **PDF 생성이 fiscal 영역 변경 0줄 보장 필수** — settlement / payment / tax / invoice schema 무손상 |

---

## §2 PDF 라이브러리 정량 비교 — 3 후보

### §2.1 후보 (a) — Puppeteer

| 항목 | 결과 |
|------|------|
| 라이브러리 + 버전 | `puppeteer@21.x` (또는 `puppeteer-core@21.x` + 별도 Chromium) |
| 설치 dependency | `puppeteer` 전체 (~280MB Chromium 자동 다운로드) 또는 `puppeteer-core` (~10MB) + `@sparticuz/chromium` (Vercel serverless 용 minimal Chromium ~50MB) |
| 동작 방식 | Headless Chromium 으로 HTML/CSS → PDF (browser native engine) |
| Bundle 영향 (client) | 0 (server-only) |
| Server function size | puppeteer 전체 ~280MB / puppeteer-core + sparticuz ~50-60MB |
| Korean font | system font 부재 (Chromium minimal) → `@font-face` CSS 또는 file embed (ttf/otf) |
| 기존 PrintView 재활용 | ✅ **재활용 가능** — HTML markup 그대로 → PDF 변환 (~1035 LOC 활용) |
| Next.js 14 정합 | ✅ 정합 (App Router API route 에서 호출) |
| 학습 곡선 | 🟡 중간 (Chromium 제약 + Vercel minimal build 정합 필요) |
| 성능 (PDF 1장) | ~2-5s (Chromium cold start 포함) |
| License | Apache 2.0 (Puppeteer) + Chromium License |
| 알려진 이슈 | Vercel cold start 길이 (5-10s), font 임베딩 복잡, ChromeNotFoundError 가능성 |

### §2.2 후보 (b) — Playwright

| 항목 | 결과 |
|------|------|
| 라이브러리 + 버전 | `playwright@1.40+` |
| 설치 dependency | `playwright` (Chromium/Firefox/WebKit 다중 브라우저 ~300MB+ default) |
| 동작 방식 | Headless 다중 브라우저 (Chromium 단독 사용 시) HTML/CSS → PDF |
| Bundle 영향 (client) | 0 (server-only) |
| Server function size | ~300MB+ (Hobby 50MB 한참 초과) |
| Korean font | Puppeteer 와 유사 (Chromium 기반) |
| 기존 PrintView 재활용 | ✅ HTML markup 그대로 |
| Next.js 14 정합 | ✅ 정합 |
| 학습 곡선 | 🟡 중간 (Puppeteer 와 유사 API) |
| 성능 | ~2-5s |
| License | Apache 2.0 |
| 알려진 이슈 | Vercel serverless 통합 약함 (커뮤니티 minimal build solution 부재), Hobby plan 부적합 |

### §2.3 후보 (c) — @react-pdf/renderer

| 항목 | 결과 |
|------|------|
| 라이브러리 + 버전 | `@react-pdf/renderer@4.x` |
| 설치 dependency | `@react-pdf/renderer` (~3MB total dep tree) |
| 동작 방식 | React-native PDF rendering (browser 미사용, PDF 직접 생성) |
| Bundle 영향 (client) | ~200KB (client-side 사용 시) 또는 0 (server-only) |
| Server function size | ~5-10MB (Vercel Hobby 50MB 한참 안쪽) |
| Korean font | `Font.register({ family, src })` 로 ttf/otf 직접 embed |
| 기존 PrintView 재활용 | 🔴 **재활용 불가** — React-native primitive (`<Page>`, `<Text>`, `<View>`), HTML markup 재작성 필요 |
| Next.js 14 정합 | ✅ 정합 (App Router + API route 또는 client component) |
| 학습 곡선 | 🟢 작음 (React 정합) but layout 제약 (CSS Flexbox subset 만, complex CSS 불가) |
| 성능 (PDF 1장) | **~50ms-200ms** (native rendering, Chromium boot 0) |
| License | MIT |
| 알려진 이슈 | Layout flexbox subset 만 (grid / float / 복잡 positioning 불가), 일부 CSS 미지원 |

### §2.4 종합 정량 비교 표

| 항목 | Puppeteer | Playwright | @react-pdf/renderer |
|------|-----------|-----------|---------------------|
| Vercel Hobby 50MB | 🟡 minimal build 필요 (@sparticuz) | 🔴 부적합 | ✅ **자연 정합** |
| Vercel Pro 250MB | ✅ 정합 | ✅ 정합 | ✅ 자연 정합 |
| 기존 PrintView 재활용 | ✅ HTML markup | ✅ HTML markup | 🔴 React 별도 작성 |
| Korean font | @font-face / embed | @font-face / embed | Font.register() embed |
| 성능 (cold start 포함) | ~2-5s | ~2-5s | **~50-200ms** |
| Bundle (server) | ~50-280MB | ~300MB+ | **~5-10MB** |
| License | Apache 2.0 + Chromium | Apache 2.0 | **MIT** |
| 학습 곡선 | 중간 | 중간 | **작음** |

### §2.5 Claude 추천

🟢 **@react-pdf/renderer** 추천

근거:
1. **Vercel Hobby plan 정합도 최고** — 사용자 현재 hosting 환경 (스크린샷 확인됨) 자연 정합, 50MB function limit 한참 안쪽
2. **License MIT** — 사용자 비전 "비용 절약" 정합
3. **성능 우월** — cold start 짧음 (~50ms-200ms vs Puppeteer ~2-5s)
4. **Bundle 가벼움** — server function ~5-10MB
5. **추가 dependency 1건만** — `@react-pdf/renderer` (package.json 변경 최소)
6. **D-AXVELA-VISION 정합** — "쉽고 효과 좋은 것 부터" 정신 정합

trade-off:
- 🟡 기존 4 PrintView markup 재활용 불가 → 신규 React-PDF 컴포넌트 작성 필요 (~800-1000 LOC 추가 예상)
- 🟡 Layout flexbox subset 제약 — PASSPORT-1 디자인 시각 정합 검증 필요 (별도 §10 단순화 보류 항목과 자연 합류)
- ✅ **다만** 4 PrintView 정착물 그대로 보존 (window.print 정착물 무영향) — *별도 dimension* 정합 정착

→ **사용자 §N 결정 항목 1 (PDF 라이브러리 선택)** 로 정착 (사용자 final 결정 영역).

---

## §3 AXVELA OS 4 surface PDF 출력 요건

### §3.1 Invoice PDF (rule_11 정합, STEP 127/129 정착)

| 항목 | 요건 |
|------|------|
| 데이터 진입점 | `useArtworkStore.invoices` (transactionId keyed) |
| 분기 | PRE invoice / FINAL invoice (STEP 127 `invoiceKind` 정착) |
| PRE 정합 | "PRO FORMA — NOT FOR PAYMENT" watermark (InvoicePrintView 정착) |
| AXID 표기 | `formatAxidForDocument(axid)` (STEP 127 옵션 Z 정착) |
| Trust language | "거래 청구 문서" / "결제 안내" / "buyer 안내용" (AXVELA_AI_DIRECTION 일관) |
| 4 locale | currentLocale 종속 (STEP 130 i18n 정합, D-130-2 KO/EN 만) |
| Fiscal 영역 | **변경 0줄 필수** (영구 정책 1 Phase 1 Fiscal frozen) |

### §3.2 Contract PDF (rule_11 정합, STEP 129 정착)

| 항목 | 요건 |
|------|------|
| 데이터 진입점 | `useArtworkStore.contracts` (transactionId keyed) |
| 분기 | DRAFT / REVIEW / APPROVED / LOCKED (rule_4 Trust Layer) |
| LOCKED 정합 | "[인쇄/PDF 저장]" CTA — LOCKED 상태 한정 (rule_4 정합) |
| Content | `whitespace-pre-wrap` (계약 본문 그대로 보존) |
| 서명 placeholder | "_______________" 영역 (운영자 / buyer 수기 서명) |
| Trust language | "매매 계약서" / "공식 거래 확정" 가능 (LOCKED 시) |

### §3.3 Passport PDF (rule_1 SSOT, STEP 131 정착 — Closed Passport)

| 항목 | 요건 |
|------|------|
| 데이터 진입점 | `useArtworkStore.artworks` (artwork.id 단독) |
| 디자인 | PASSPORT-1 spec — dark navy leather + gold typography + LEFT SPINE (AXID 세로) + FRONT COVER |
| 분기 | Closed Passport (현 STEP 131) → Expanded Passport (STEP 133 시점, PDF 도 expanded 영역 추가 결정 영역) |
| 4 locale | currentLocale 종속 (getTitle / getArtistName, STEP 130 정합) |
| QR | **D-AXVELA-VISION-3 정합 — 큐레이션 정보 진입점 (주) + 진위 (부)** |
| 디자인 단순화 | PASSPORT-1 정보 밀도 높음 피드백 → PDF 출력 시점 재검토 가능성 (§7 deferred reference) |

### §3.4 Certificate PDF (rule_1 SSOT, STEP 136 영역 — 사전 검토만)

| 항목 | 요건 |
|------|------|
| 데이터 진입점 | `useArtworkStore.artworks` (CLOSED state 자동 또는 갤러리 수동 발급) |
| 디자인 자산 | `docs/design/certificate/CERTIFICATE-1.png` (untracked 보존 영역) |
| QR | D-AXVELA-VISION-3 정합 — 진위 확인 (부) + provenance chain (rule_13) |
| 발급 trigger | STEP 136 영역 (본 STEP 132 영역 외) |
| **본 STEP 132 정합** | **PDF 인프라만 정착** — Certificate 의 *PDF 출력 layer* 만 본 STEP 영역, *발급 trigger / Resale provenance chain* 등은 STEP 136 영역 의도적 분리 |

### §3.5 4 surface 통합 요건

- **단일 PDF 라이브러리** — 4 surface 모두 같은 라이브러리 사용 (drift 방지)
- **단일 PDF API route** — `/api/pdf/[surface]/[id]` 형태 또는 별도 결정 영역
- **fallback chain 정합** — STEP 130 i18n helper 호출 (getTitle / getArtistName 의 4 locale)
- **rule_4 Trust Layer 정합** — LOCKED document 만 PDF 발급 (DRAFT / REVIEW 단계 차단)

---

## §4 Vercel hosting 환경 정합

### §4.1 사용자 hosting 현황 (스크린샷 확인)

| 항목 | 값 |
|------|---|
| Plan | Vercel **Hobby** (무료) |
| Production Branch | `main` (현재 `278d97f`, STEP 129 Phase 2 Commit 4) |
| Function size limit | **50MB** (Hobby) / 250MB (Pro) |
| Function timeout | **10s** (Hobby) / 60s (Pro) |
| Region | (사용자 default) |

### §4.2 후보 라이브러리별 정합도

| 후보 | Vercel Hobby 50MB | Vercel Hobby 10s timeout | 정합 결론 |
|------|------------------|------------------------|----------|
| Puppeteer (`puppeteer` 전체) | 🔴 ~280MB 초과 | 🔴 cold start ~5-10s 위험 | 부적합 |
| Puppeteer (`puppeteer-core` + `@sparticuz/chromium`) | 🟡 ~50-60MB 경계 | 🟡 cold start ~5s, 위험 | 경계 — minimal build 정합 필요 |
| Playwright | 🔴 ~300MB+ | 🔴 cold start ~5s | 부적합 |
| @react-pdf/renderer | ✅ ~5-10MB | ✅ ~50-200ms | **정합 (한참 안쪽)** |

### §4.3 환경 변수 / API key

- **Anthropic API** (STEP 93/94 정착) — 환경 변수 정착 영역, PDF 영역 무관
- **Vercel Blob** (STEP 53/57 정착) — 향후 PDF 저장 위치 후보 (사용자 §N 결정 항목 g)
- **Resend / SendGrid** 등 이메일 service — STEP 132 영역 외 (이메일 발송은 별도 STEP)

### §4.4 Vercel Pro plan 검토

만약 Vercel Pro plan upgrade 결정 시:
- 250MB function size → Puppeteer (`puppeteer-core` + Chromium) 정합 가능
- 60s timeout → Chromium cold start 안정
- 그러나 비용 발생 (사용자 비전 "비용 절약" 정합 검증 필요)

→ **사용자 §N 결정 항목** — Vercel plan upgrade 여부 (별도 항목 e 와 합류).

---

## §5 Korean font 검증

### §5.1 Pretendard (AXVELA OS UI 기본 폰트)

| 항목 | 결과 |
|------|------|
| License | SIL Open Font License 1.1 (오픈소스 무료) |
| 파일 크기 | ~1.5MB (variable font) / ~300KB-500KB (weight별 static) |
| PDF 임베딩 가능성 | ✅ ttf/otf 모두 가능 |
| @react-pdf/renderer Font.register() | ✅ 정합 (ttf 직접 register) |
| Puppeteer @font-face | ✅ 정합 (CSS 또는 base64) |

→ Pretendard 가 **PDF 한국어 표시 권고** (UI 일관성 + free + PDF 정합).

### §5.2 무료 대안

| 폰트 | License | 비고 |
|------|---------|------|
| Noto Sans KR (Google Fonts) | OFL 1.1 / Apache 2.0 | Google Fonts 직접 fetch 또는 file embed |
| Nanum Gothic | OFL 1.1 (Naver) | 한국 표준 폰트 정합 |
| Pretendard | OFL 1.1 | **권고** (UI 일관성) |

### §5.3 향후 4 locale 확장 시점

D-130-2 단기 복귀 (zh / ja 노출 회복) 시점 PDF 폰트 정합:

| Locale | 권고 폰트 | License |
|--------|----------|---------|
| ko | Pretendard | OFL |
| en | Pretendard (latin glyph 포함) | OFL |
| ja | Noto Sans JP | OFL / Apache 2.0 |
| zh | Noto Sans SC / TC | OFL / Apache 2.0 |

→ STEP 132 정착 시 **Pretendard 단일** (ko + en 충분), D-130-2 복귀 시 Noto Sans JP/SC 추가 정책 (별도 STEP, 본 STEP 영역 외).

---

## §6 §7 + §8 + §9 표준 적용

STEP 129 Phase 2 §12.4 정착 + STEP 130/131 Phase 1.0 적용 답습.

### §6.1 §7 — 이전 STEP deferred items 재검토

| Item | STEP 132 진입 시 결과 |
|------|--------------------|
| **D-130-1** (titleI18n.en = "" fallback) | PDF 표시 시점 결정 가능 여부 — PDF 의 *공란 표시* 가 사용자에게 visible artifact (스크린 보다 영구 출력물) → **결정 가능성 높음**. 사용자 §N 결정 항목 후보 |
| **D-130-2** (UI locale KO/EN 제한) | PDF 4 locale 출력 정합 — 본 STEP 은 ko/en 만 정착 (Hotfix `631885d` 정합), zh/ja 폰트는 D-130-2 복귀 시 별도 STEP |
| **D-AXVELA-VISION-1** (AI 도입 Tier 1~4) | 본 STEP 직접 영향 0건 — STEP 134 영역 (AI Tier 1 진입 시점) |
| **D-AXVELA-VISION-2** (시장 분석 추론 금지) | 본 STEP 영역 외 (AI 결과 표시 영역, PDF 인프라와 무관) |
| **D-AXVELA-VISION-3** (QR 본질 재정의) | **STEP 132 첫 결정 진입 가능** — Passport / Certificate PDF 의 QR 정책. 사용자 §N 결정 항목 후보 |
| 디자인 단순화 보류 | PDF 출력 시점 재검토 가능성 — Passport PDF 가 PASSPORT-1 정보 밀도 그대로 출력 시 사용자 피드백 누적 자연 시점 |

### §6.2 §8 — 신설 가정 컴포넌트 vs 기존 정착물 중복 검증

#### (a) 4 PrintView 정착물 vs 신규 Server-side PDF generator

| 영역 | 결정 |
|------|------|
| **별도 dimension 정합** | ✅ Confirmed — PrintView (client-side `window.print()`) + Server-side PDF (신규 surface). STEP 128 §9 항목 6 사용자 사전 결정 정착물 정합. |
| **markup 재활용** | Puppeteer/Playwright = HTML markup 재활용 가능 (~1035 LOC 활용) / @react-pdf/renderer = React-native, markup 재작성 |
| **기존 PrintView 보존 약속** | 4 파일 0줄 변경 필수 (정착물 무손상) |

→ **신설 폐기 0건**. server-side PDF generator 는 신규 *별도 dimension* — 정합 정착.

#### (b) lib/document-trust-metadata vs PDF trust metadata

기존 정착물: `src/lib/document-trust-metadata.ts` (STEP 86 정착) — document 의 trust metadata (version, lockedAt, lockedBy 등).

| 영역 | 결정 |
|------|------|
| **PDF trust metadata 신설 가정** | 🔴 신설 폐기 — 기존 `document-trust-metadata.ts` 재활용 (PDF metadata = document metadata 의 readonly projection) |
| **PDF audit 진입점** | rule_4 정합 — PDF 발급 시 audit event emit (기존 audit-log-storage 답습) |

→ **~50-100 LOC 절약 예상** (PDF trust metadata 신설 폐기).

#### (c) lib/fiscal-derive vs PDF fiscal display

기존 정착물: `src/lib/fiscal-derive.ts` (STEP 90 정착) + `src/lib/fiscal-summary.ts` (STEP 88 정착) — fiscal 데이터 derive helper.

| 영역 | 결정 |
|------|------|
| **PDF fiscal display 가정** | 🔴 신설 폐기 — 기존 `fiscal-derive` / `fiscal-summary` 재활용 (PDF display = derive 결과의 read-only render) |
| **영구 정책 1 정합** | ✅ Fiscal frozen 영역 0줄 변경 보장 (PDF 는 read-only 호출) |

→ **~30-50 LOC 절약 예상**.

#### (d) lib/utils 의 formatAxidForDocument vs PDF AXID 표기

기존 정착물: `src/lib/utils.ts` 의 `formatAxidForDocument` (STEP 127 옵션 Z 정착).

| 영역 | 결정 |
|------|------|
| **PDF AXID 표기 helper 가정** | 🔴 신설 폐기 — `formatAxidForDocument` 그대로 재활용 |

→ **~10 LOC 절약**.

#### §6.2.5 §8 검증 결과 요약

| 가정 컴포넌트 | 검증 결과 | 결정 |
|--------------|---------|------|
| Server-side PDF generator | 별도 dimension 정합 (PrintView 보존) | ✅ 신설 (별도 surface) |
| PDF trust metadata | document-trust-metadata 재활용 | 🔴 신설 폐기 (~50-100 LOC 절약) |
| PDF fiscal display | fiscal-derive / fiscal-summary 재활용 | 🔴 신설 폐기 (~30-50 LOC 절약) |
| PDF AXID 표기 helper | formatAxidForDocument 재활용 | 🔴 신설 폐기 (~10 LOC 절약) |
| Korean font helper | Pretendard 단일 (Phase 2 정착) | ✅ 신설 (~30 LOC, Font.register wrapper) |

**누적 절약**: **~90-160 LOC** (STEP 130/131 §8 패턴 답습 강화).

### §6.3 §9 — 검증 게이트 path-specific 설계

Phase 2 commit 별 검증 게이트:

| Commit | path-specific 검증 |
|--------|------------------|
| Commit 1 (PDF infra) | `git grep "puppeteer\|playwright\|@react-pdf" src/` |
| Commit 2 (Invoice/Contract PDF) | `git grep "InvoicePrintView\|ContractPrintView" src/` (정착물 무손상 확인) |
| Commit 3 (Passport PDF) | `git grep "PassportCard" src/` |
| Commit 4 (Closure) | `git grep "STEP 132" docs/steps/` |

**broad pattern 회피** — `grep -r ... .` 대신 `git grep ... src/` (repo 영역 한정).

---

## §7 Phase 2 Commit 분할 사전 계획

### §7.1 권고 분할 안 — 4 commits

| # | Commit | 작업 범위 | 예상 LOC | Risk |
|---|--------|----------|---------|------|
| 1 | **Foundation** — PDF 인프라 + 1 surface 정착 | `package.json` (+1 dep), `src/lib/pdf/*` 신설 (font wrapper + 공통 helper), Invoice PDF 1 surface 정착 + API route | +400-600 | 🟡 Medium (dep 도입 + 첫 surface) |
| 2 | **Integration** — Contract + Passport PDF | Contract / Passport PDF 추가 (Foundation 패턴 답습) | +400-500 | 🟢 Low (패턴 답습) |
| 3 | **Test scenarios** (선택) | PDF render scenarios (mock data → PDF bytes, content 검증) | +200-300 | 🟢 Low |
| 4 | **Closure** | `STEP_132_PHASE_2_COMPLETE.md` + Phase 1 cross-ref | +400 doc | 🟢 Low |

### §7.2 대안 분할 안

**3 commits (간소화)**: Commit 1+2 합침 → 4 surface 전체 단일 commit. 단, Risk profile 다양화 영역 부재 (Foundation 의 dep 도입 Risk vs Integration 의 패턴 답습 Risk).

**5 commits (세분화)**: 각 surface 별 분리 (Invoice / Contract / Passport / Certificate / Closure). 단, Certificate 는 본 STEP 영역 외 (STEP 136), 세분화 가치 낮음.

→ **4 commits 권고**.

### §7.3 누적 LOC 예상

| 영역 | LOC |
|------|-----|
| 신설 코드 (PDF infra + 3 PDF components + API route) | ~1000-1500 |
| 신규 dep | 1건 (사용자 §N 결정 항목 1) |
| 신규 doc | ~500 (Phase 2 COMPLETE) |
| 기존 doc 갱신 | ~2 (cross-ref) |
| Test scenarios (선택) | ~200-300 |
| **총** | ~1700-2300 |

**Bundle 영향 사전 평가**:
- @react-pdf/renderer 채택 시: server function +5-10MB, client bundle +0 (server-only) 또는 +200KB (client component)
- Puppeteer 채택 시 (Vercel Pro): server function +50-280MB
- → 사용자 §N 결정 항목 1 결정 후 정확 측정

---

## §8 사용자 §N 결정 항목

Phase 2 진입 전 사용자 결정 필요 — **8 항목**.

### §8.1 항목 1 — PDF 라이브러리 최종 선택

**선택지**:
- (A) **@react-pdf/renderer** — Vercel Hobby 자연 정합, 빠른 cold start, MIT, but PrintView markup 재활용 불가
- (B) Puppeteer (puppeteer-core + @sparticuz/chromium) — PrintView markup 재활용, but Vercel Hobby 50MB 경계
- (C) Playwright — Vercel Hobby 부적합

**Trade-off**:
- (A): 신규 컴포넌트 ~800-1000 LOC 작성 + flexbox subset 제약. **Vercel Hobby 정합 + 비용 절약**
- (B): 1035 LOC 재활용 + 학습 곡선 낮음. Vercel Hobby 경계 + cold start ~5s
- (C): 부적합

**Claude 추천**: **(A) @react-pdf/renderer**
- 근거: Vercel Hobby 정합 (사용자 현재 환경), 비용 절약 (사용자 비전), 성능 우월

### §8.2 항목 2 — Korean font 처리 방식

**선택지**:
- (A) **Pretendard 단일** (UI 일관성 + OFL 무료)
- (B) Noto Sans KR (Google Fonts)
- (C) Nanum Gothic (Naver)

**Claude 추천**: **(A) Pretendard** — UI 일관성 + UX

### §8.3 항목 3 — 4 surface PDF 출력 우선순위

**선택지**:
- (A) Invoice / Contract / Passport 동시 (Phase 2 Commit 1+2)
- (B) Invoice 우선 (Foundation), Contract / Passport 점진
- (C) Passport 우선 (D-AXVELA-VISION-3 정합)

**Trade-off**:
- (A): Phase 2 LOC 큰 batch, but 통합 검증 효율
- (B): Foundation 안정 후 점진 확장, Risk 분배
- (C): 사용자 비전 정합 but Phase 1 의 4 surface 정합 검증 약화

**Claude 추천**: **(A) 동시** — Foundation 1 surface + Integration 2 surface (총 3 surface, Certificate 는 STEP 136)

### §8.4 항목 4 — D-AXVELA-VISION-3 QR 정책 첫 적용

**선택지**:
- (A) **Passport PDF 에 QR 인쇄** — 큐레이션 정보 진입점 (사용자 비전 주 용도)
- (B) Passport PDF 에 QR 미포함 — STEP 136 (Certificate) 까지 QR 보류
- (C) Passport / Certificate PDF 둘 다 QR

**Trade-off**:
- (A): D-AXVELA-VISION-3 첫 wire, but Passport PDF spec 확장
- (B): 보수적 접근, STEP 136 영역 보호
- (C): 본 STEP 132 영역 초과 (Certificate STEP 136)

**Claude 추천**: **(A) Passport PDF QR** — D-AXVELA-VISION-3 정합 + 사용자 비전 첫 적용

### §8.5 항목 5 — Vercel plan upgrade 여부

**선택지**:
- (A) **Hobby 유지** + @react-pdf/renderer (정합)
- (B) Pro upgrade (Puppeteer 정합) + 월 비용 발생

**Claude 추천**: **(A) Hobby 유지** — 사용자 비전 "비용 절약" 정합

### §8.6 항목 6 — PDF 미리보기 UI 위치

**선택지**:
- (A) Drawer 내부 미리보기 (현 PrintView 패턴 답습)
- (B) Modal expansion
- (C) **별도 페이지** — rule_17 위반 가능성
- (D) **다운로드 link 만** (미리보기 0) — minimal UI

**Trade-off**:
- (A): 정합 + 정착물 답습, but Drawer 내부 iframe 복잡도
- (B): rule_17 회피, Modal 정착 패턴
- (C): rule_17 위반 (페이지 이동 금지) — 거부
- (D): 가장 minimal, but 사용자 미리보기 부재 UX 약화

**Claude 추천**: **(A) Drawer 내부 미리보기** — 정착물 답습 + UI 일관성

### §8.7 항목 7 — PDF 저장 위치

**선택지**:
- (A) **Vercel Blob 활용** (STEP 53/57 정착물) — production-ready
- (B) On-demand 생성 (저장 0, 매번 새 PDF 생성)
- (C) Server-side temp storage (Vercel /tmp)

**Trade-off**:
- (A): Blob 정착물 재활용 (§8 정합), 영구 저장, but 비용 (Blob storage)
- (B): 저장 0, but 매번 cold start cost
- (C): temp storage 휘발성 (Vercel function 종료 시 삭제)

**Claude 추천**: **(B) On-demand 생성** (Phase 1 정착) → 향후 (B) → (A) 진화 가능
- 근거: Phase 1 minimal 정합, @react-pdf/renderer 의 성능 우월 (~50-200ms) → on-demand 실용
- 향후 사용자 사용 데이터 누적 후 (A) Vercel Blob 전환 결정 가능

### §8.8 항목 8 — D-130-1 빈 문자열 fallback 의미 결정

PDF 출력 시점 결정 가능 영역 — 사용자 §N 결정 항목 5 (STEP 131 Phase 1 §8 항목 5) 의 재검토 시점.

**선택지**:
- (A) **결정 보류** (STEP 134 또는 별도) — Form UI 미존재로 production 데이터 0
- (B) 현 nullish (`??`) 유지 — PDF 공란 표시 = 운영자 의도 일관
- (C) truthy 체크 전환 — 빈 문자열은 다음 fallback

**Claude 추천**: **(A) 결정 보류** — STEP 131 Phase 1 §8 항목 5 결정 그대로 유지 (Form UI 미존재 상태)

### §8.9 항목 N (Phase 2 commit 분할 안 승인)

**선택지**:
- (A) **4 commits** (Foundation / Integration / Test / Closure) — Claude 권고
- (B) 3 commits (Commit 1+2 합침) — 과간소화
- (C) 5 commits (각 surface 별) — 과세분화

**Claude 추천**: **(A) 4 commits** — Risk profile 분배 + 정착 패턴 답습

---

## §9 Risk 평가

### §9.1 영역별 Risk

| 영역 | 사전 Risk | 근거 |
|------|----------|------|
| **PDF 라이브러리 도입** | 🟡 Medium | 신규 dep 1건 + Vercel Hobby 정합 검증 필요 |
| **Korean font** | 🟢 Low | Pretendard OFL + Font.register() 단순 |
| **Vercel 환경** | 🟡 Medium | Hobby plan 50MB / 10s 정합 검증 필요 (@react-pdf 자연 정합) |
| **4 surface 통합** | 🟡 Medium | 각 surface 데이터 schema + i18n + AXID 표기 + fiscal display 통합 |
| **rule_4 Trust Layer 정합** | 🟢 Low | LOCKED document 만 PDF 발급 (DRAFT 차단) |
| **영구 정책 1 (Fiscal frozen)** | 🟢 Low | PDF 는 read-only (fiscal schema 변경 0) |
| **§8 표준 적용** | 🟢 Low | ~90-160 LOC 절약 정착 + 신규 dimension 명확 |

### §9.2 종합 Risk 🟡 Medium (사전 평가)

영역별 Risk 누적:
- PDF 라이브러리 도입 (Medium) + Vercel 환경 (Medium) + 4 surface 통합 (Medium)
- 그 외 영역 Low

→ **🟡 Medium** 사전 평가 — 사용자 §N 8 항목 결정 후 Phase 2 commit 별 진입 시 정확 평가.

### §9.3 책임감 있는 멈춤 패턴 진입 조건

다음 발견 시 **즉시 진행 보류 + 사용자 확인 요청** (STEP 127~131 패턴 답습):

1. **Phase 2 Commit 진입 시 §8 표준 추가 발견** — 신설 가정 컴포넌트가 다른 정착물과 추가 중복
2. **Vercel function size 50MB 초과** — Hobby plan 부적합 발견
3. **Korean font PDF 임베딩 실패** — Pretendard ttf 정합 검증 실패
4. **rule_4 Trust Layer 위반 가능성 발견** — LOCKED 검증 missed
5. **영구 정책 1 위반 가능성 발견** — fiscal schema 변경 발생 (절대 금지)
6. **scenarios test 회귀** — 13/13 → 12/13 등
7. **Cross-worktree state 발견** (STEP 130 패턴 답습)

→ 책임감 있는 멈춤 패턴 9건째 누적 가능성.

---

## §10 보존 약속 (Phase 2 진입 시점)

| 보존 영역 | 약속 |
|----------|------|
| `src/types/artwork.ts` (STEP 130 정착) | 0줄 |
| `src/lib/i18n-helpers.ts` (STEP 130) | 0줄 |
| `src/lib/__tests__/i18n-helpers.scenarios.ts` (STEP 130) | 0줄 |
| `src/store/useArtworkStore.ts` (STEP 130/131 정착) | 0줄 (또는 PDF 발급 audit event emit 영역만 추가, 사용자 §N 결정) |
| `src/components/translation/*` 10 files (STEP 96) | 0줄 |
| `src/components/layout/SidebarLocaleToggle.tsx` (STEP 130 Hotfix) | 0줄 |
| `src/components/artwork/PassportCard.tsx` (STEP 131 Commit 1) | 0줄 (또는 PDF 발급 CTA 추가, 사용자 §N 결정) |
| `src/components/artwork/ViewModeToggle.tsx` (STEP 131 Commit 1) | 0줄 |
| `src/components/layout/ArtworkGrid.tsx` (STEP 131 Commit 2) | 0줄 |
| **`src/components/invoice/InvoicePrintView.tsx`** (STEP 129) | **0줄 (정착물 절대 보존)** |
| **`src/components/contract/ContractPrintView.tsx`** (STEP 129) | **0줄 (정착물 절대 보존)** |
| **`src/components/receipt/ReceiptPrintView.tsx`** (STEP 87) | **0줄 (정착물 절대 보존)** |
| **`src/components/tax-invoice/TaxInvoicePrintView.tsx`** (STEP 89) | **0줄 (정착물 절대 보존)** |
| `src/lib/persistence.ts` (SCHEMA_VERSION v1) | 0줄 |
| `src/lib/document-trust-metadata.ts` (STEP 86) | 0줄 (§8 재활용) |
| `src/lib/fiscal-derive.ts` (STEP 90) | 0줄 (§8 재활용) |
| `src/lib/fiscal-summary.ts` (STEP 88) | 0줄 (§8 재활용, 영구 정책 1 정합) |
| `src/lib/utils.ts` 의 `formatAxidForDocument` (STEP 127) | 0줄 (§8 재활용) |
| `package.json` | **신규 dependency 1건 추가** (사용자 §N 결정 항목 1 결정 후) |
| **영구 정책 1 (Phase 1 Fiscal frozen)** | **fiscal 영역 schema / 로직 0줄 변경 절대 보장** |
| AXVELA_*.md 6 영구 정책 본문 | 0줄 |
| AXVELA_OS_Manifesto.xml (21 rule + 14 영구 정책) | 0줄 |

---

## §11 명시적 작업 범위 외 (STEP 132 절대 금지)

| 영역 | 영역 STEP | 본 STEP 132 진입 절대 금지 |
|------|----------|-------------------------|
| **AI Cultural Intelligence** | STEP 134 | 0건 — AI 영역 진입 0, D-AXVELA-VISION-1/2 wire 0 |
| **Transaction Timeline + Provenance + Cross-link** | STEP 135 | 0건 — Timeline 표시 0, Provenance chain 0 |
| **Certificate surface code (Ownership Certificate)** | STEP 136 | 0건 — Certificate 발급 / 표시 / 진입점 0. **단 PDF 인프라는 Certificate PDF 도 정합 (인프라만, 발급 trigger 는 STEP 136)** |
| **Expanded Passport + In-Passport Navigation** | STEP 133 | 0건 — Closed Passport 만, 펼쳐진 상태 0 |
| **main branch push** | 사용자 결정 영역 | 0건 — STEP 132 작업은 `claude/step127-architecture-review` branch 한정 |
| **이메일 발송 (Resend/SendGrid 등)** | 별도 STEP | 0건 — PDF 인프라만, 이메일 service 영역 외 |
| **Vercel Blob 저장 (사용자 §N 결정 항목 7)** | Phase 2 진입 시 결정 | 0건 (Phase 1 정착물 = on-demand) — 사용자 결정 시 별도 진입 |
| **PrintView 4 파일 변경** | 정착물 보존 | 0줄 — *별도 dimension* 정합 (window.print 정착물 무손상) |
| **영구 정책 1 위반** | 절대 금지 | 0줄 — fiscal schema / 로직 변경 절대 금지 |

→ STEP 132 = **Server-side PDF 인프라 + Invoice / Contract / Passport 3 surface PDF 출력** 한정 — Certificate / Expanded Passport / AI / Timeline 모두 후속 STEP 영역 의도적 회피.

---

## §12 Phase 2 진입 권고

### §12.1 진입 조건

1. 본 review doc 사용자 검토 완료
2. **사용자 §8 (8 항목) 결정 완료** — 특히 항목 1 (PDF 라이브러리) + 항목 5 (Vercel plan)
3. Risk 🟡 Medium 동의
4. Phase 2 commit 분할 안 승인 (§8 항목 9)
5. D-AXVELA-VISION-3 첫 적용 결정 (§8 항목 4)

### §12.2 Phase 2 진입 후 작업 흐름

1. Phase 2 Commit 1 (Foundation) 진입 — `package.json` +1 dep, PDF infra (`src/lib/pdf/*`), Invoice PDF 1 surface 정착 + API route
2. Phase 2 Commit 2 (Integration) — Contract / Passport PDF 추가
3. Phase 2 Commit 3 (Test scenarios) — 선택 (사용자 결정)
4. Phase 2 Commit 4 (Closure) — `STEP_132_PHASE_2_COMPLETE.md` + 본 doc cross-ref
5. (선택) ZIP 패키지 생성 — `AXVELA_STEP_132_PHASE_2_COMPLETE_<hash>.zip`
6. (선택) GitHub push — `claude/step127-architecture-review` branch backup

### §12.3 추가 사실 발견 시 책임감 있는 멈춤 패턴

각 commit 진입 시점:
- §7+§8+§9 표준 재적용 — 신규 deferred items / 신규 정착물 중복 / 신규 false positive 영역 검증
- 발견 시 즉시 진행 보류 + 사용자 확인 (STEP 127~131 패턴 답습)
- 책임감 있는 멈춤 패턴 9건째 누적 가능성

### §12.4 다음 세션 진입 가능 시점

본 Phase 1 doc commit 완료 + 사용자 §8 결정 완료 후:
- 같은 turn 에 Phase 2 Commit 1 진입 가능
- 또는 별도 turn 에 진입 (사용자 명시 신호)

---

**STEP 132 Phase 1 Architecture Review — COMPLETE ✅ (Phase 1.1 doc-only commit)**

핵심 산출:
- PDF 라이브러리 3 후보 정량 비교 (Puppeteer / Playwright / @react-pdf/renderer)
- Vercel Hobby plan 정합 평가 (@react-pdf/renderer 최적)
- Korean font 검증 (Pretendard 권고)
- §6.2 §8 표준 적용 — **PDF trust metadata + fiscal display + AXID 표기 신설 폐기 결정 (~90-160 LOC 절약)**
- 사용자 §N 결정 항목 **8건** 도출 (특히 항목 1 PDF 라이브러리, 항목 5 Vercel plan)
- Phase 2 commit 분할 권고 — **4 commits** (Foundation / Integration / Test / Closure)
- Risk 🟡 Medium 사전 평가

Phase 2 는 사용자 §8 결정 (최소 항목 1 / 5 / 9 결정) 후 별도 turn 진입.
