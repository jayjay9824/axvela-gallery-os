# STEP 131 Phase 2 — Vision Record (사용자 AI 비전 5 항목 영구 정착)

**작성 시점**: 2026-05-13
**작성 맥락**: STEP 131 Phase 2 Commit 2 (`4006030` Integration HEAD) 완료 직후
**Branch**: `claude/step127-architecture-review`
**Worktree**: `condescending-lamarr-f5022a` (canonical)
**문서 성격**: 살아있는 spec (개발 단계, 향후 수정 / 추가 가능)
**Risk**: 🟢 Low (doc-only commit, code 0줄)

---

## §1 개요

### §1.1 작성 배경

본 문서는 2026-05-13 사용자 turn 에서 명시한 **AI 비전 확장 5 항목** 의 영구 기록.
STEP 131 Phase 2 Commit 2 (`4006030`) 정착 직후 진입 — Closed Passport surface 가
첫 production wire 된 시점에 사용자가 STEP 134~136 영역의 비전 방향을 명시함.

작성 목적:
- 비전 5 항목을 Deferred Items 패턴 (D-AXVELA-VISION-1/2/3) 으로 영구 정착
- 향후 STEP (특히 STEP 134 AI Cultural Intelligence + STEP 136 Certificate) 진입
  시점의 의사결정 reference
- 매니페스토 21 rule + 영구 정책 14 항목과의 정합 검증

### §1.2 문서 성격 — 살아있는 spec

본 문서는 **개발 단계 살아있는 spec** — 향후 수정 / 추가 허용 영역:
- 사용자 의사결정 추가 시 본 문서 직접 갱신 또는 D-AXVELA-VISION-N 신설
- Tier 진입 시점 / 기술 검증 결과 / 외부 API 가용성 변화 시 본 문서 갱신

**절대 변경 금지 영역** (본 문서의 갱신과 무관):
- AXVELA_*.md 6 영구 정책 본문
- AXVELA_OS_Manifesto.xml 의 21 rule + 영구 정책 14 항목 본문
- 영구 정책 1 (Phase 1 Fiscal frozen)
- 영구 정책 2 (rule_5 AI-Human Loop architectural keyword)

### §1.3 Deferred Items 패턴 답습

STEP 130 의 **D-130-1** (titleI18n.en = "" fallback 의미 결정 보류) +
**D-130-2** (UI locale 노출 KO/EN 제한 + 단기 복귀 / 중기 신규 추가 roadmap)
패턴 답습. Deferred Items 의 본질:
- 현 시점 결정 미가능 또는 의도적 보류
- 영구 식별자 (`D-NNN-N` 또는 `D-AXVELA-VISION-N`)
- 재검토 시점 + 결정 영향 영역 명시
- 후속 STEP 진입 시 자연 reference

본 문서의 신규 Deferred Items 식별자: **`D-AXVELA-VISION-N`** (project-wide vision 영역).

---

## §2 사용자 비전 5 항목 (원문 + 정리)

### §2.1 원문 인용 (2026-05-13 사용자 turn)

> "QR 은 진위 여부보다는 전시나 아트페어에 작품정보나 큐레이션에 초점이고,
> 추후 개발하는 tag (QR 및 NFC)를 통한 작품의 배송 보험등과 연동,
> 시장가격 추론보다는 같은 작가의 실제 거래기록(소더비 옥션 등 나중에 api
> 및 ai 기록 등을 통한 확인된 정보만 제공)
> 추가 카테고리 abcd 전체가 다 좋은데 너의 추천대로 간단한거 부터 넣고
> 유료 api(소더비 나 옥션 기록등 무료면 지금 넣는게 좋음)는 차차 업데이트
> 하고 싶어 쉽고 효과가 좋은것 부터 넣는데 추후 업데이트는 대비하자"

### §2.2 정리 5 항목

| # | 비전 항목 | 핵심 |
|---|----------|------|
| **1** | **QR 본질 재정의** | 전시 / 아트페어 작품정보 + 큐레이션 진입점 (진위는 부차) |
| **2** | **NFC tag 미래** | 추후 개발 — 작품 배송 + 보험 등 연동 |
| **3** | **시장 분석 본질 재정의** | 추론 금지 — 같은 작가의 *실제 거래기록* (확인된 정보만) |
| **4** | **A/B/C/D 카테고리 전체 가치 인정** | 이전 turn Claude 정리 reference, 점진 도입 |
| **5** | **도입 전략** | 쉽고 효과 좋은 것 부터, 무료 우선, 유료 API 는 차차 업데이트 |

### §2.3 5 항목의 의미 분석

**비전 1 (QR 본질 재정의)** — STEP 136 (Certificate) spec 갱신 사항. 기존 인수인계
spec 가정 = "QR = 진위 확인" → 새 spec = "QR = 전시/아트페어 정보 진입점, 진위는 부차".
디자인 자산 `docs/design/certificate/CERTIFICATE-1.png` 도 본 비전에 맞춰 STEP 136
진입 시점 재검토.

**비전 2 (NFC tag 미래)** — rule_21 (Logistics 1급 운영 view) + rule_2 (Physical →
Artwork → ... → Resale → Assetization 흐름) 정합. Hardware 정착 영역, 별도 STEP roadmap.

**비전 3 (시장 분석 본질)** — rule_5 (AI-Human Loop, AI 가 정리 보조만, 판단 금지)
**강화**. 영구 정책 2 의 architectural keyword 그대로 답습 + AI 결과 metadata 필수
요건 추가 (source / sourceUrl / verifiedAt).

**비전 4 (A/B/C/D 카테고리)** — 이전 turn Claude 정리 reference. AI 도입 영역의
4 카테고리 (Artwork / Business / Curation / Customer) 전체 가치 인정 — 단계적 진입.

**비전 5 (도입 전략)** — rule_2 (흐름 설계 + 단계별 정착) 정합 + 사용자 페이스
정합 (인수인계 메모 "비용 절약" 정합). 무료 우선 + 유료 API 추후 업데이트 +
인프라 미래 대비.

---

## §3 D-AXVELA-VISION-1 — AI 도입 우선순위 로드맵

**식별자**: `D-AXVELA-VISION-1`
**영역**: AI 기능 도입 우선순위 + 기술 요건
**재검토 시점**: 각 Tier 진입 시점 또는 사용자 의사결정 시점

### §3.1 Tier 1 — STEP 134 진입 시점 (무료 Claude API + 효과 큼)

| # | 기능 | 카테고리 | 비고 |
|---|------|---------|------|
| 1 | **큐레이션 노트 5종 자동 생성** | C (Curation) | description / curationDraft / exhibitionText / artistNote / provenanceNote — STEP 119 정착 5 inline fields |
| 2 | **C1 4 locale 자동 번역** | C (Curation) | 한국어 입력 → titleI18n.en/ja/zh 자동. **D-130-1** (빈 문자열 fallback) 결정 진입점 가능 |
| 3 | **B4 인보이스/계약 검토** | B (Business) | 누락 / 오류 검토 — rule_5 AI 가 정리 보조 (판단 금지, 운영자 LOCK 결정) |
| 4 | **D1 자동 이메일 작성** | D (Customer) | 컬렉터 문의 응답 초안 — rule_5 정합 (운영자 review + 명시 발송) |

**기술 요건**:
- Claude API 1개 (이미 정착 — STEP 93/94)
- 추가 dependency 0건
- rule_5 정합 (AI = 보조, 사용자 명시 LOCK)
- 영구 정책 2 (AI 자동 LOCK 절대 금지) 정합

### §3.2 Tier 2 — STEP 137~138 영역 (무료 외부 API + 일부 통합)

| # | 기능 | 카테고리 | 비고 |
|---|------|---------|------|
| 1 | **A1 작가 자동 검색** | A (Artwork) | Wikidata / Wikipedia 무료 API |
| 2 | **D3 시장 trend 자동 알림** | D (Customer) | 무료 art news RSS |

**기술 요건**:
- 무료 외부 API 진입점 정착 (provider abstraction)
- API rate limit / fallback 정착
- D-AXVELA-VISION-2 정합 (source 명시 필수)

### §3.3 Tier 3 — 별도 STEP, 유료 API 진입 시점 사용자 결정

| # | 기능 | 카테고리 | 비고 |
|---|------|---------|------|
| 1 | **실제 거래 기록** | A/B (Artwork/Business) | Sotheby's / Christie's / Phillips / Artnet — 유료 API |
| 2 | **B1 가격 책정 도우미** | B (Business) | **확인 데이터 기반, 추론 금지** (D-AXVELA-VISION-2 정합) |
| 3 | **A2 유사 작품 자동 검색** | A (Artwork) | 이미지 분석 (유료 vision API) |
| 4 | **A4 Condition Report AI 분석** | A (Artwork) | 이미지 분석 (유료 vision API) |

**기술 요건**:
- 유료 API 비용 사용자 결정 (인수하기 메모 "비용 절약" 정합 — 사용자 페이스)
- AI 결과 source 필수 표기 (D-AXVELA-VISION-2 정합)
- 추론 금지 정책 강화 (rule_5)

### §3.4 Tier 4 — 장기, hardware 정착

| # | 기능 | 카테고리 | 비고 |
|---|------|---------|------|
| 1 | **NFC tag** | Physical | 작품 물류 + 보험 연동, rule_21 정합. **D-AXVELA-VISION-3** 의 NFC 영역 |

**기술 요건**:
- 별도 hardware 결정 + 새 STEP roadmap
- rule_2 (Physical → Artwork → ... → Resale → Assetization) 흐름 정합
- rule_21 (Logistics 1급 운영 view) 통합

### §3.5 도입 순서 결정 원칙

1. **Tier 1 → Tier 2 → Tier 3 → Tier 4** 순서 정합 (사용자 비전 5 — 쉽고 효과 좋은 것 부터)
2. 각 Tier 진입 시점 사용자 결정 — Claude 가 임의 진행 절대 금지
3. Tier 3 진입 시점 = 유료 API 비용 사용자 결정 시점
4. Tier 4 진입 시점 = hardware 결정 시점 (별도 worktree / 별도 STEP)

---

## §4 D-AXVELA-VISION-2 — 시장 분석 본질 (rule_5 강화)

**식별자**: `D-AXVELA-VISION-2`
**영역**: 시장 분석 / AI 결과 source 정책
**재검토 시점**: STEP 134 (Tier 1 자동번역에서 source 표기 패턴 확립)

### §4.1 핵심 정책

1. **AI 가 추론 절대 금지** — 기존 rule_5 정착 강화
2. **AI 가 확인된 데이터만 수집 + 정리** — 운영자 판단을 대체 금지
3. **데이터 source 가 명시되지 않은 시장 분석 결과 = 표시 금지**
4. **향후 외부 API 진입 시점에 source 명시 + 검증 흐름 정합**

### §4.2 매니페스토 정합

| 정합 영역 | 정착물 | 강화 내용 |
|----------|-------|----------|
| **rule_5** (AI-Human Loop) | "AI 가 정리 보조만, 판단 금지" | 시장 분석 영역으로 명시 확장 |
| **영구 정책 2** | rule_5 architectural keyword 보존 | source 명시 = AI-Human Loop 의 *trust mechanism* 으로 정착 |
| **rule_18** (AI Role) | 시장 분석 항목 정착 | 본 정책 정합 — source 부재 = 표시 차단 |

### §4.3 기술 요건 (STEP 134+ 진입 시점 적용)

```ts
// AI 결과 metadata 필수 schema (예시 — STEP 134 시점 정착)
interface AIResultWithSource {
  result: string;
  source: string;          // 데이터 origin (예: "Sotheby's", "Wikidata")
  sourceUrl: string;       // verifiable URL
  verifiedAt: string;      // ISO datetime
  // source 부재 시 본 interface 자체 부재 → UI 표시 자체 차단
}
```

UI 표시 정책:
- AI 결과 표시 시 source badge 필수 (예: "Sotheby's · 2024-03-12")
- source 부재 데이터는 *AI 추론* 으로 간주 → **표시 자체 차단**
- 운영자가 source 신뢰도 직접 평가 가능한 정보 제공

### §4.4 적용 영역 예시

| 기능 | 정착 정책 |
|------|----------|
| Tier 3 #1 (실제 거래 기록) | source = "Sotheby's" 등 명시 |
| Tier 3 #2 (B1 가격 책정 도우미) | source = 확인된 거래기록 (추론 금지) |
| Tier 1 #2 (C1 4 locale 자동 번역) | source = "Claude AI translation" 명시 (사용자 review 필수) |
| Tier 1 #4 (D1 자동 이메일) | source = "Claude AI draft" + 운영자 명시 발송 |

---

## §5 D-AXVELA-VISION-3 — QR 본질 재정의 (STEP 136 spec 갱신)

**식별자**: `D-AXVELA-VISION-3`
**영역**: QR / NFC tag 본질 재정의
**적용 시점**: STEP 136 진입 시점
**재검토 시점**: STEP 136 진입 직전

### §5.1 기존 spec (인수인계 문서)

> "QR encrypted token 생성 (STEP 128 §2.D 정합)"
> "Server-side PDF 렌더링"
> "Resale 시 ownership 이전 + provenance chain (rule_13)"

→ **QR = 진위 확인** 가정.

### §5.2 새 spec (사용자 비전 — 2026-05-13)

> "QR 은 진위 여부보다는 전시나 아트페어에 작품정보나 큐레이션에 초점"

새 spec 정착:

**QR 주요 용도** (사용자 비전 우선):
- 전시 / 아트페어 작품 정보 진입점 (관람객 / 컬렉터 향)
- 큐레이션 텍스트 (curationDraft / exhibitionText / artistNote / provenanceNote) 노출
- 4 locale 다국어 표시 (currentLocale 정합)

**QR 부차 용도** (기존 spec 보존):
- 진위 확인 (artwork.id 검증) — 갤러리 운영자 / 컬렉터 향
- ownership 이전 + provenance chain (rule_13 정합)

**미래 확장** (D-AXVELA-VISION-1 Tier 4):
- NFC tag 통합 (rule_21 Logistics + 보험 연동)
- 작품 배송 트래킹 + 보험 자동 갱신 진입점

### §5.3 매니페스토 정합

| Rule | 정합 영역 |
|------|----------|
| **rule_2** (Physical → Artwork → ... → Resale → Assetization) | Physical 단계 Tag/QR 정합 |
| **rule_21** (Logistics 1급 운영 view) | NFC tag 향후 통합 진입점 |
| **rule_13** (Resale Provenance Chain) | QR 부차 용도 (진위 확인) 정합 |

### §5.4 영향 영역

- **STEP 136 spec 갱신** — Certificate surface 의 QR 본질 재정의
- **`docs/design/certificate/CERTIFICATE-1.png` 검토** — 새 비전 정합 디자인 확인 필요
- **Server-side PDF 렌더링** (STEP 132) — 큐레이션 텍스트 + 4 locale 표시 정합
- **외부 진입 surface** (관람객 / 컬렉터) — 운영 surface 와 별도 dimension (운영자 인증 미필요)

### §5.5 STEP 136 진입 권고 변경

기존 권고:
- "Certificate entity 신설 + QR encrypted token + Resale provenance chain"

새 권고 (D-AXVELA-VISION-3 정합):
- **Phase A**: 큐레이션 정보 진입점 (관람객 / 컬렉터, locale-aware)
- **Phase B**: 진위 확인 (운영자 / 컬렉터, encrypted token)
- **Phase C**: NFC tag 통합 (Tier 4, hardware)

→ STEP 136 진입 시점 사용자 결정 — 어느 Phase 부터 진입할지.

---

## §6 도입 전략 영구 기록

### §6.1 전략 핵심

| 원칙 | 의미 |
|------|------|
| **쉽고 효과 좋은 것 부터** | Tier 1 우선 (STEP 134) — 무료 + 즉시 가능 + 효과 큼 |
| **무료 우선** | Claude API (정착) → 무료 외부 API (Tier 2) → 유료 API (Tier 3) |
| **유료 API 차차 업데이트** | 사용자 비용 결정 시점 — 의사결정 권한 = 사용자 |
| **확장성 보장 = 인프라 미래 대비** | Slot / type / UI 정착 + 데이터 source = placeholder |

### §6.2 매니페스토 정합

| 정합 영역 | 정착물 |
|----------|-------|
| **rule_2** (흐름 설계 + 단계별 정착) | Tier 1~4 순서 정합 |
| **사용자 페이스 정합** | 인수인계 메모 "비용 절약" 정합 |
| **영구 정책 1** (Phase 1 Fiscal frozen) | Tier 진입 시 fiscal 영역 변경 0 (정합 검증 필수) |

### §6.3 Optional Slice 패턴 답습

Tier 1~3 진입 시 본 프로젝트의 정착 패턴 답습:
- **Optional Slice 패턴** (STEP 87 / STEP 89 / STEP 114 / STEP 117 / STEP 118 / STEP 119 / STEP 127 / STEP 130) — 신규 슬롯 = 옵셔널, 기존 데이터 자동 호환
- **Two-Layer 패턴** (STEP 119 Curation + STEP 130 i18n) — formal entity ↔ inline data 의도적 분리
- **§8 표준** — 신설 가정 컴포넌트 vs 기존 정착물 중복 검증 (STEP 130 / STEP 131 누적 ~200 LOC 절약)

### §6.4 Tier 진입 시점 의사결정 체크리스트

각 Tier 진입 시점 사용자 결정 항목:
1. 본 Tier 의 기능 우선순위 (Tier 내 항목 순서)
2. 무료 / 유료 API 가용성 검증 결과
3. AI 결과 metadata source 정착 흐름 (D-AXVELA-VISION-2 정합)
4. 매니페스토 / 영구 정책 정합 검증
5. Bundle 영향 사전 평가 (신규 dependency / API 호출)

---

## §7 매니페스토 / 영구 정책 정합 검증

### §7.1 비전 5 항목 × 정합 영역

| # | 비전 항목 | 정합 영역 | 평가 |
|---|----------|----------|------|
| 1 | QR 본질 재정의 | rule_2 + STEP 136 spec | 비전 수정, 영구 기록 (D-AXVELA-VISION-3) |
| 2 | NFC tag 미래 | rule_21 (Logistics) | 미래 STEP (Tier 4) |
| 3 | 추론 금지, 확인 데이터 | rule_5 "정리 보조만" 강화 | 매니페스토 정신 강화 (D-AXVELA-VISION-2) |
| 4 | A/B/C/D 카테고리 | rule_18 (AI Role) 정합 | 정합 (D-AXVELA-VISION-1 Tier 분배) |
| 5 | 도입 전략 | rule_2 (흐름 설계) 정합 | 정합 (§6 영구 정착) |

### §7.2 명시적 보존 (본 비전 변경 시도 시 위반 차단)

본 비전 5 항목 + 3 Deferred Items 가 다음 영구 정책 / 매니페스토 위반 *절대 금지*:

| 영구 정착물 | 위반 차단 영역 |
|-------------|---------------|
| **영구 정책 1** (Phase 1 Fiscal frozen) | AI 가 정산 자동 결정 절대 금지. Tier 1 #3 (인보이스/계약 검토) 도 *검토 보조 only*, AI 가 invoice LOCK / payment register / settlement complete 자동 진입 절대 금지 |
| **영구 정책 2** (rule_5 AI-Human Loop architectural keyword) | AI 자동 LOCK 절대 금지. Tier 1~3 모든 항목이 *사용자 명시 결정* 진입점 정합 |
| **rule_3** (Money Flow Separation) | AI 가 Payment / Settlement / Tax 통합 결정 절대 금지. Tier 1~3 의 fiscal 영역은 *읽기 + 정리 보조* only |
| **rule_5** (AI-Human Loop) | AI = 보조, 사용자 = 결정자. D-AXVELA-VISION-2 가 본 정책 강화 |
| **rule_18** (AI Role) | A/B/C/D 카테고리 정착물, D-AXVELA-VISION-1 Tier 분배 가 본 정책 정합 |
| **rule_13** (Resale Provenance Chain) | D-AXVELA-VISION-3 (QR 진위 부차 용도) 가 본 정책 정합 |
| **rule_21** (Logistics 1급) | D-AXVELA-VISION-3 (NFC tag 미래) 가 본 정책 정합 |

### §7.3 본 문서 갱신 시 보존 약속 (영구)

본 문서 (STEP_131_PHASE_2_VISION_RECORD.md) 의 향후 갱신 시:
- ✅ AXVELA_*.md 6 영구 정책 본문 0줄 변경
- ✅ AXVELA_OS_Manifesto.xml 의 21 rule + 영구 정책 14 항목 본문 0줄 변경
- ✅ 본 문서 수정은 §1.2 살아있는 spec 영역 한정
- ✅ D-AXVELA-VISION-N 신설 시 매니페스토 / 영구 정책 정합 검증 필수

---

## §8 다음 작업 진입

### §8.1 본 비전 commit 완료 후 진입 가능 영역

**즉시 진입 가능**:
- **Commit 3 (Test scenarios, 선택사항)** — Phase 1 §7.1 권고는 "option"
  - 후보: `view-mode.scenarios.ts`, `passport-card.scenarios.ts` 등
- **Commit 4 (Closure)** — `STEP_131_PHASE_2_COMPLETE.md` 신설 (Phase 1 §7.1 정합)

**별도 분기 작업**:
- ZIP 패키지 갱신 (현 HEAD 시점 dump)
- D-130-1 / D-AXVELA-VISION-N 별도 결정 작업

### §8.2 비전 5 항목의 본격 wire 시점

| 비전 항목 | 본격 wire 시점 |
|----------|--------------|
| 1. QR 본질 재정의 | STEP 136 (Certificate surface) — Phase A 우선 권고 |
| 2. NFC tag 미래 | Tier 4 (별도 STEP, hardware 정착 시점) |
| 3. 추론 금지, 확인 데이터 | STEP 134 (Tier 1 진입) — source 표기 패턴 확립 |
| 4. A/B/C/D 카테고리 | STEP 134 (Tier 1) ~ Tier 3 점진 진입 |
| 5. 도입 전략 | STEP 134 부터 영구 적용 (Tier 1 우선) |

### §8.3 본 문서의 미래 reference 영역

향후 STEP 진입 시 본 문서 reference 영역:

- **STEP 132** (Server-side PDF) — D-AXVELA-VISION-3 (QR 큐레이션 정보) 반영
- **STEP 133** (Expanded Passport + In-Passport Navigation) — D-AXVELA-VISION-1 Tier 1 #1 (큐레이션 노트 5종) 의 표시 layer 검토
- **STEP 134** (AI Cultural Intelligence) — **본 문서의 첫 본격 wire 시점**:
  - D-AXVELA-VISION-1 Tier 1 4 항목 모두 진입
  - D-AXVELA-VISION-2 source 표기 패턴 확립
  - 비전 3 (추론 금지) 본격 적용
- **STEP 135** (Transaction Timeline + Provenance + Cross-link) — rule_13 정합 + Provenance chain 정착
- **STEP 136** (Ownership Certificate) — D-AXVELA-VISION-3 본격 적용 (QR 본질 재정의 spec 갱신)
- **STEP 137~138** (Tier 2 외부 무료 API) — D-AXVELA-VISION-1 Tier 2 진입

### §8.4 살아있는 spec 갱신 트리거

본 문서 갱신 진입 트리거:
- 사용자 비전 추가 / 수정 turn
- Tier 진입 시점 (사용자 결정 + 기술 검증 결과)
- 외부 API 가용성 변화 (무료 ↔ 유료 전환)
- D-AXVELA-VISION-N 결정 시점 (재검토 시점 도달)

각 갱신 시점 — 본 문서 commit history 가 의사결정 trace 자연 보존.

---

**STEP 131 Phase 2 — Vision Record COMPLETE ✅**

영구 기록 정착:
- 사용자 비전 5 항목 원문 인용 + 정리
- 3 신규 Deferred Items (D-AXVELA-VISION-1/2/3)
- 매니페스토 / 영구 정책 정합 검증
- 도입 전략 영구 기록
- 살아있는 spec 갱신 정책

다음 진입 — Commit 3 (Test scenarios, 선택) 또는 Commit 4 (Closure) 사용자 결정 대기.
