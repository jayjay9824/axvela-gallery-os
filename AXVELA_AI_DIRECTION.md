# AXVELA AI / Market Intelligence Direction — 정체성 정책

> **상태**: 영구 정책 (Permanent Policy)
> **적용 시점**: STEP 86 이후 모든 STEP
> **우선순위**: AXVELA Manifesto rule_18 (Market Intelligence) 위 — 본 문서가 manifesto rule_18을 *해석*하고 *상세화*함
> **변경 권한**: Owner only — 본 문서 변경은 별도 STEP으로 처리

---

## ⚠️ Critical — AXVELA의 정체성 재정의

AXVELA는 **"AI 가격 예측 시스템"이 아닙니다.**

AXVELA는 **"Art Market Intelligence Infrastructure"**입니다.

이 차이는 단순한 marketing 차원이 아니라 **시스템 설계 / UI 표현 / 데이터 정책 / AI 호출 / audit 기록**의 모든 layer에 영향을 미칩니다.

---

## ❌ 절대 금지 (Hard Forbidden)

### 1. 정체성 표현
- "AI Estimated Price"
- "AI 감정가" / "AI Appraisal"
- "공식 가격" / "확정 시장가"
- "정확한 가치" / "정확한 가치 산정"
- "투자 보장" / "예상 수익"
- "투자 수익 예측" / "수익률 보장"
- "AI Pricing Engine"

### 2. UI 위험 패턴
- 단일 숫자 가격 표시 (예: `Estimated Value: $18,420`)
- "AI가 예측한 가격" / "AI가 산정한 가치" 같은 단정 표현
- 작품 카드 / 상세 패널에 *AI 추정가* 라벨로 단일 숫자 노출
- 가격을 *확정하는* 톤의 UI (큰 폰트 / 강조 색상 / 단정 라벨)

### 3. 데이터 위험
- 비공개 거래 데이터의 **추정** 노출
- 갤러리 비공개 가격의 **강제 공개**
- 검증되지 않은 외부 데이터를 "확실한 시장가"로 표시
- private sale 정보 leakage

### 4. AI 호출 패턴
- 모든 화면 진입 시 자동 AI 호출 (rule_5 AI-Human Loop 위반)
- 사용자 요청 없이 AI가 가격을 *생성하여 표시*
- AI 결과를 1차 fact로 표기 (보조 신호가 아닌 단정 형태)

---

## ✅ 권장 표현 (Allowed Wording)

### 정체성
- **"Art Market Intelligence Infrastructure"**
- **"Market Signal Platform"**
- **"Comparable Analysis System"**
- **"Cultural Intelligence Layer"**
- **"Historical Transaction Insight"**

### 데이터 표현
- **"운영 참고"**
- **"시장 신호 기반"**
- **"공개 거래 기준"**
- **"AI Comparable Analysis"**
- **"Market Interpretation"**
- **"참고 신호"** / **"보조 컨텍스트"**

### 부정형 disclaimer (필수)
- "감정가 또는 확정 시장가가 **아닙니다**"
- "법적 효력 / 회계 확정과 **무관합니다**"
- "최종 가격 결정은 사용자가 합니다"
- "운영 참고용 — 외부 보고 / 신고와 무관"

---

## 🎨 권장 UI 구조 (Future STEPs 반영)

기존의 단일 "AI Estimated Price" 카드를 다음 4-section 구조로 대체:

### Section 1: MARKET ACTIVITY
**무엇이 표시되나**:
- 공개 거래 범위 (range — 단일 숫자 아님)
- 최근 거래 빈도 (월별 / 분기별 카운트)
- 시장 활동성 indicator (높음 / 보통 / 낮음 — 정성)
- 거래량 변화 trend (방향성만 — 정확한 % 단정 회피)

**금지**:
- "Last sale: $X" 단일 단정 (대신 "최근 공개 거래 범위: $X ~ $Y, N회")

### Section 2: COMPARABLE SALES
**무엇이 표시되나**:
- 유사 작품 공개 거래 list
- 유사 크기 / 시리즈 / 재료 / 에디션 비교 group
- **반드시 "AI Comparable Analysis" 라벨 명시**
- 각 row에 출처 명시 (Sotheby's / Christie's / Phillips / Artsy / public gallery / museum acquisition)

**금지**:
- 비공개 거래의 추정 비교
- 갤러리 내부 가격 정보 노출 (gallery-controlled visibility 정책)

### Section 3: CULTURAL POSITIONING
**무엇이 표시되나**:
- 미술사적 위치 (movement / period / 영향)
- 최근 전시 영향 (exhibition impact)
- 기관 관심도 (museum acquisition / institution interest)
- 컬렉터 흐름 (collector momentum — 정성 / 행동 데이터 기반)
- 문화적 맥락 (cultural context commentary)

**금지**:
- "이 작품은 가치가 X로 상승할 것입니다" 류 예언
- 미래 가격 단정

### Section 4: MARKET INTERPRETATION
**무엇이 표시되나**:
- AXVELA AI 해석 (commentary form, 단정 아님)
- 시장 변화 해석 (직선적 예측이 아닌 컨텍스트 설명)
- collector interest interpretation
- momentum commentary
- 명시적 disclaimer ("운영 참고용 / 시장 해석 / 가격 확정 아님")

**금지**:
- "예상 가치: $X" 단일 숫자
- "투자 추천 / 투자 회피" 같은 투자 자문 표현

---

## 📊 데이터 정책 — Verified Data Only (초기 단계)

### 사용 가능 데이터 (Verified Sources)
| Source | 사용 |
|---|---|
| Sotheby's 공개 낙찰가 | ✅ |
| Christie's 공개 거래 | ✅ |
| Phillips 공개 거래 | ✅ |
| Artsy 공개 데이터 | ✅ |
| 공개 gallery sale history | ✅ |
| Museum acquisition record | ✅ |
| Art Basel / Frieze reported sales | ✅ |
| Artist gallery pricing (해당 갤러리 본인 데이터) | ✅ — 단, gallery-controlled visibility 정책 적용 |

### 사용 금지 데이터
- 비공개 거래의 **추정 가격**
- 다른 갤러리의 비공개 가격 정보
- 컬렉터 신원 노출 데이터
- 개인 컬렉터 보유 정보 (소유자 동의 없음)

---

## 🛡️ Gallery-Friendly 구조 — 갤러리 운영 인프라로의 포지셔닝

**핵심**: AXVELA는 시장 파괴자가 아니라 **갤러리 운영 인프라**입니다.

### Gallery-Controlled Visibility (필수 구현)

갤러리가 작품 단위로 제어 가능해야 합니다:
- 가격 공개 여부 (`pricingVisibility`: public / private / inquiry-only)
- "문의만 가능" 모드
- market range 숨김 옵션
- "Sold" 표시 (가격 비노출)
- private sale 여부 표기

### Persistence Schema 영향 (사전 검토)
- `Artwork` type에 `pricingVisibility?` 필드 추가 가능 (옵셔널 — v1 호환)
- 향후 STEP에서 `validateV1` 보완 필요 (사전 계획)

---

## 🔄 장기 데이터 Flywheel — Cultural Intelligence

**중요한 통찰**:
> AXVELA의 가장 강력한 데이터는 *가격 데이터*가 아니라 *행동 데이터*입니다.

### 행동 데이터 (Behavioral Demand Signal) — 향후 수집 대상
- Scan 수 (작품 QR / AXID 스캔)
- Dwell time (작품 상세 페이지 체류 시간)
- 저장 (Save / Bookmark)
- 문의 (Inquiry)
- 재조회 (Re-visit)
- "Ask AXVELA" interaction (AI 질문 횟수)
- Collector conversion flow (문의 → 거래 전환율)

이 데이터는 **"미래 시장 수요 신호"**로 간주 — 가격 예측이 아닌 *수요 패턴* 신호.

장기적으로:
> AXVELA만의 **Cultural Intelligence Flywheel**로 발전.

---

## ⚙️ Technical Direction (AI 호출 정책)

### AI 호출 최소화 전략 (rule_5 AI-Human Loop 강화)

| 상황 | 정책 |
|---|---|
| 기본 화면 진입 | ❌ AI 자동 호출 금지 — deterministic 데이터만 표시 |
| 사용자 명시적 action | ✅ 그 시점에만 AI 호출 |
| AI 결과 | ✅ 영속 저장 후 재사용 (반복 호출 금지) |
| AI 결과 갱신 | ✅ 사용자가 명시적으로 "재분석" 요청 시만 |

### 결과 저장 정책
- AI 결과는 작품 / Inquiry / Settlement 등 도메인 entity에 영속 저장
- 동일 컨텍스트 재진입 시 저장된 결과 재사용 (불필요한 AI 호출 0건)
- 결과의 timestamp / model version 함께 저장 (rule_4 Trust Layer 일관)

### 기존 STEP과의 통합
| Layer | 정책 |
|---|---|
| **rule_4 Trust Layer** (audit / version / approval / lock) | 모든 AI 결과는 audit append + version 기록 |
| **rule_5 AI-Human Loop** | AI 자동 0건 / 모든 호출 사용자 명시 trigger |
| **rule_18 Market Intelligence** | 본 문서가 rule_18의 상세 해석 |
| **STEP 65/78/80~85 Audit Governance** | AI 호출 / 결과 / 사용자 승인 모두 audit category 활용 |
| **STEP 83 Export** | AI 결과 export 시 disclaimer 강화 |
| **STEP 31~34 FX** | 외화 거래 데이터 정확 활용 |

---

## 📋 향후 Layer 후보 (Future Intelligence STEPs)

```
[현재] STEP 65/78/80~85 Audit Governance Cycle 완성

         ↓

[Phase 2 — Tax / Fiscal Layer] STEP 86~91 (이미 예약됨)
  86 Cash Receipt / 87 Tax Invoice / 88 VAT Summary
  89 Artist Settlement Tax / 90 International Tax / 91 Accountant Export

         ↓

[Phase 3 — AXVELA Intelligence Layer] STEP 92 ~ (예약)
  92 Market Signal — 공개 거래 신호 수집 + 정규화
  93 Comparable Analysis — 유사 작품 매칭 + AI Comparable label
  94 Cultural Positioning — 미술사 / 전시 / 기관 데이터
  95 Collector Momentum — 컬렉터 행동 흐름 신호
  96 Institution Interest Tracking — 미술관 / 기관 관심도
  97 Behavioral Demand Signal — scan / dwell / save / inquiry 행동 데이터
  98 AI Market Interpretation — AXVELA AI commentary layer
  99 Gallery-Controlled Visibility — pricingVisibility 정착
```

### 금지 STEP 방향
- ❌ "AI Pricing Engine" / "AI Estimated Price" 강화
- ❌ 가격 예언 / 단정 / 투자 추천 류 layer
- ❌ 비공개 데이터 추정 / 강제 노출

### 권장 STEP 방향
- ✅ 행동 데이터 수집 / 정규화 / 해석
- ✅ 공개 거래 데이터 통합 + 출처 명시
- ✅ Comparable Analysis (참고 신호 only)
- ✅ Cultural Context commentary
- ✅ Gallery-Controlled visibility 강화

---

## 🔍 기존 코드베이스 정합성 (현 시점 audit)

### ✅ 이미 정렬된 부분
| File | 현 상태 |
|---|---|
| `src/types/price-suggestion.ts` | "확정하지 않는다" / "범위와 근거만 제안" — 본 정책과 정렬 |
| `src/types/market-analysis.ts` | "참고 분석 commentary" — 정렬 |
| `src/types/market-signal.ts` | "참고 신호" — 정렬 |
| `src/components/market-analysis/MarketAnalysisDrawer.tsx` | disclaimer "감정가 또는 확정 시장가가 아닙니다" 부정형 사용 — 정렬 |
| `src/lib/market-analysis-export.ts` | 동일 disclaimer — 정렬 |

### 🟡 향후 reframe 권장 (Phase 3 STEP들에서 처리)
| File | 권장 변경 |
|---|---|
| `src/components/artwork/ArtworkFormDrawer.tsx:289` | "AXVELA AI Price Suggestion" → "AI Comparable Analysis" 또는 "Market Reference Range" 라벨 변경 (코드 0줄, UI 텍스트만) |
| `src/lib/axvela-price.ts` | 모듈명 유지 (내부 구현), 다만 사용처 표기 시 "Comparable" / "Market Reference" 라벨 우선 |
| Section 구조 | 단일 "AI Estimated Price" → 4-section (Market Activity / Comparable / Cultural / Interpretation) 분리 |

### ❌ 즉시 회피 (Phase 3 시작 전 자연 준수)
- 새 STEP에서 "AI 추정가" / "AI 감정" / "예측 가격" 표현 0건
- 새 STEP에서 단일 숫자 가격 단정 표시 0건
- 새 STEP에서 자동 AI 호출 0건

---

## 📝 향후 STEP의 정책 준수 의무

본 문서는 **STEP 86 이후 모든 STEP의 가이드라인**입니다.

각 새 STEP은 다음을 ARCHITECTURE.md entry에 명시해야 합니다:

```
- AXVELA AI Direction 정책 준수 ✓
  - 금지 표현 0건 (verified)
  - 권장 표현 사용
  - rule_5 AI-Human Loop / rule_18 Market Intelligence 일관
  - Gallery-Controlled Visibility 정책 (해당 시)
```

본 문서 위반 시 STEP 진행 차단.

---

## 📅 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-05-04 | Phase A 정책 영구 기록 — STEP 85 직후, STEP 86 이후 모든 STEP에 적용 |
