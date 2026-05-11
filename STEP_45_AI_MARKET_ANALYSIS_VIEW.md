# STEP 45 — AI Market Analysis View

> **목표**: STEP 18 PriceSuggestion + STEP 19/29 MarketSignal 데이터 토대 위에
> 운영자가 한 번에 읽을 수 있는 6-section commentary view 추가. AXVELA를
> Cultural / Market Intelligence AI로 보이게 하는 첫 분석 layer (rule_18 (b)).

---

## State

- **이전**: STEP 44 / Route 92.3 kB
- **이번**: STEP 45 / **Route 97.7 kB (+5.4 kB)**
- Build ✅ · type-check ✅ (`tsc --noEmit` 0 error)

---

## Flow

```
DetailPanel (column 3)
  └─ Living Timeline header
       ├─ [AI 시장 분석] inline button     ← STEP 45 진입점
       └─ [감사 로그 보기] inline button   (STEP 20 기존)
            ↓
            openMarketAnalysis(artworkId)
            ↓
            store.marketAnalysisRequest = { kind: "open", artworkId }
            ↓
            MarketAnalysisDrawer (720px overlay)
              ├─ useMemo: gatherMarketSignals()  (STEP 19/29 read-only)
              ├─ useMemo: priceSuggestions[artworkId][0]  (STEP 18 read-only)
              ├─ useMemo: same-artist tx/artwork count
              ├─ useMemo: own tx/inquiry count + recent/active
              ├─ useMemo: computeGalleryMedianPriceKRW()  (STEP 18 helper)
              └─ useMemo: generateMarketAnalysis()  ← deterministic pure
                  └─ 6 sections rendered
```

**분석은 ephemeral** — store에 보관 0 (STEP 19 MarketSignal 패턴 일관). 매 drawer open 시 재계산.

---

## 변경 파일 목록

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/store/useArtworkStore.ts` | ~25 LOC | `MarketAnalysisRequest` type + `marketAnalysisRequest` UI slice + 2 actions + 초기값/reset |
| `src/components/layout/DetailPanel.tsx` | ~12 LOC | `openMarketAnalysis` hook + Living Timeline header inline 버튼 |
| `src/app/page.tsx` | 2 LOC | `MarketAnalysisDrawer` import/mount |
| `ARCHITECTURE.md` | rule_18 row 갱신 + STEP 45 changelog | 정합성 매트릭스 |

---

## 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/types/market-analysis.ts` | ~160 | `MarketAnalysisReport` + 6 section types + 4 enum unions + `RiskNote` |
| `src/lib/market-analysis-generator.ts` | ~430 | Pure deterministic `generateMarketAnalysis(input)` + 6 builder helpers + display labels |
| `src/components/market-analysis/MarketAnalysisDrawer.tsx` | ~600 | Drawer 720px + 6 SectionCard + per-section metrics + RiskNotesList + disclaimer/footnote |
| `STEP_45_AI_MARKET_ANALYSIS_VIEW.md` | (이 문서) | STEP 완료 보고 |

---

## 핵심 코드

### 1) 6-section 리포트 타입

```ts
// src/types/market-analysis.ts

export interface MarketAnalysisReport {
  artworkId: string;
  artworkTitle: string;
  artistName: string;
  generatedAt: string;

  marketPosition: MarketPositionSection;        // 01
  comparableSummary: ComparableSummarySection;  // 02
  liquiditySignal: LiquiditySection;            // 03
  demandSignal: DemandSection;                  // 04
  pricingConfidence: PricingConfidenceSection;  // 05
  riskNotes: RiskNotesSection;                  // 06

  metadata: AnalysisMetadata;
}

export type MarketPositionTier =
  | "ABOVE_MEDIAN" | "AT_MEDIAN" | "BELOW_MEDIAN" | "INSUFFICIENT_DATA";

export type LiquidityLevel =
  | "STRONG" | "MODERATE" | "LIMITED" | "INSUFFICIENT_DATA";

export type DemandLevel = "ELEVATED" | "STEADY" | "LOW" | "NONE";
export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH";
```

### 2) Deterministic generator — 6 builders

```ts
// src/lib/market-analysis-generator.ts

export function generateMarketAnalysis(
  input: MarketAnalysisInput
): MarketAnalysisReport {
  const marketPosition = buildMarketPosition({...});      // ratio: ABOVE/AT/BELOW
  const comparableSummary = buildComparableSummary(signals);
  const liquiditySignal = buildLiquidity({...});         // self_resale + tx
  const demandSignal = buildDemand({...});               // recent + active inquiry
  const pricingConfidence = buildPricingConfidence({...}); // suggestion + diversity
  const riskNotes = buildRiskNotes({...});               // 8 트리거
  const metadata = buildMetadata({...});

  return { ...all sections, generatedAt: new Date().toISOString() };
}
```

### 3) Risk note 트리거 8종

| 트리거 | severity | 메시지 |
|---|---|---|
| 갤러리 median 부재 | HIGH | "갤러리 가격 데이터 부족" |
| comparable 신호 부재 | MEDIUM | "동일 작가의 비교 가능한 평균 거래 신호 없음" |
| 유동성 INSUFFICIENT_DATA | MEDIUM | "유동성 신호 산출 불가" |
| 유동성 LIMITED | LOW | "단일 데이터 포인트 — 일반화 제한" |
| external 부재 | LOW | "외부 reference 부재 — 비교 폭 제한" |
| internal 부재 | LOW | "내부 거래 부족 — 외부 위주 산출" |
| suggestion 부재 | LOW | "AI 가격 제안 미생성" |
| 낮은 신뢰도 (<0.5) | MEDIUM | "추가 신호 보강 권장" |
| 종결 작품 (CLOSED/BROKERED) | LOW | "운영 참고용" |
| 모두 정상 | LOW | (default 안내 메시지) |

### 4) Drawer — useMemo chain (read-only consume)

```tsx
const report = React.useMemo<MarketAnalysisReport | null>(() => {
  if (!artwork) return null;

  // 1. STEP 19/29 signals (read-only call to existing dispatcher)
  const signals = gatherMarketSignals({ artworkId, artistName, ...slices });

  // 2. STEP 18 latest suggestion (read-only slice access)
  const latestSuggestion = priceSuggestions[artwork.id]?.[0] ?? null;

  // 3. Same-artist tx/artwork count (loop, deterministic)
  let artistTransactionCount = 0, artistArtworkCount = 0;
  for (const a of artworks) {
    if (a.artist.name === artwork.artist.name) {
      if (a.priceKRW > 0) artistArtworkCount += 1;
      const txs = transactions[a.id] ?? [];
      for (const t of txs) {
        if (t.currency === "KRW" && PAID_TX_STATUSES.has(t.status)) {
          artistTransactionCount += 1;
        }
      }
    }
  }

  // 4. Inquiry counts (own artwork)
  // ...

  // 5. STEP 18 helper — gallery median (read-only)
  const galleryMedianKRW = computeGalleryMedianPriceKRW(artworks);

  // 6. Pure generator
  return generateMarketAnalysis({ artwork, signals, latestSuggestion, ... });
}, [artwork, artworks, transactions, payments, inquiries, priceSuggestions]);
```

### 5) Store — UI request slice (Persistence 무관)

```ts
// src/store/useArtworkStore.ts

export type MarketAnalysisRequest =
  | { kind: "closed" }
  | { kind: "open"; artworkId: string };

// State slice
marketAnalysisRequest: MarketAnalysisRequest;

// Actions
openMarketAnalysis: (artworkId: string) => void;
closeMarketAnalysis: () => void;
```

**UI 슬라이스 — PersistedState 무관, validateV1 required 15개 키 무수정** (사용자 spec "Persistence schema 변경 금지" 준수).

### 6) DetailPanel — inline 버튼 진입점

```tsx
// src/components/layout/DetailPanel.tsx

<div className="flex items-center gap-3">
  {/* STEP 45 — AI 시장 분석 진입점 (rule_18 (b)) */}
  <button
    type="button"
    onClick={() => openMarketAnalysis(artwork.id)}
    className="text-[10.5px] text-ink-muted enabled:hover:text-ink ..."
  >
    AI 시장 분석
  </button>
  {/* STEP 20 — 감사 로그 진입점 (기존) */}
  <button
    type="button"
    onClick={() => openAuditLog(artwork.id)}
    className="text-[10.5px] text-ink-muted enabled:hover:text-ink ..."
  >
    감사 로그 보기
  </button>
</div>
```

---

## Drawer UI 구조 (6 섹션 카드)

```
┌───────────────────────────────────────────────────────────────┐
│ AI 시장 분석                                            [×]   │
├───────────────────────────────────────────────────────────────┤
│ 참고 분석 · 시장 신호 기반 · 감정가 또는 확정 시장가가 아닙니다│
├───────────────────────────────────────────────────────────────┤
│ 분석 대상                                                     │
│ {작품명}                                                      │
│ {작가명} · ₩{priceKRW}                                        │
│ 생성 시각 · 2026-05-04 03:55 · 신호 4건 · internal_v1/auction_v1│
├───────────────────────────────────────────────────────────────┤
│ 01 Market Position · 갤러리 가격 위치    [중간가 상위] +      │
│ 갤러리 중간 가격 대비 약 142% 수준 — 상위 가격 구간입니다.    │
│ ┌─────────────┬─────────────┐                                 │
│ │ 중간가 대비 │ 작가 작품   │                                 │
│ │   142%      │   3점       │                                 │
│ └─────────────┴─────────────┘                                 │
│                                                               │
│ 02 Comparable Signals · 동일 작가 비교 거래                   │
│ 내부 거래 평균 ₩... · 외부 reference 평균 ₩... · 최근 ...    │
│ ┌─────────────┬─────────────┬─────────────┐                  │
│ │ 내부 평균   │ 외부 평균   │ 최근 거래   │                  │
│ └─────────────┴─────────────┴─────────────┘                  │
│                                                               │
│ 03 Liquidity · 유동성 신호                  [강함]            │
│ ...                                                           │
│ 04 Demand · 문의 / 수요 신호                [두드러짐]        │
│ ...                                                           │
│ 05 Pricing Confidence · 가격 제안 신뢰도   [높음]             │
│ ...                                                           │
│ 06 Risk / Caution Notes · 주의 사항                           │
│  • [참고] 외부 reference 신호가 없어 분석은 내부 기록...      │
│  • [안내] AI 가격 제안 미생성                                 │
│                                                               │
│ ─────────────────────────────────────                         │
│ 본 분석은 휴리스틱 기반 운영 참고용입니다. 가격 결정 / 거래   │
│ 권유 / 투자 수익 보장과 무관합니다.                           │
├───────────────────────────────────────────────────────────────┤
│                                                  [닫기]       │
└───────────────────────────────────────────────────────────────┘
```

---

## Build 결과

```
> npm run build

Route (app)                              Size     First Load JS
┌ ○ /                                    97.7 kB         185 kB
└ ○ /_not-found                          873 B            88 kB
+ First Load JS shared by all            87.1 kB

✓ Compiled successfully
✓ type-check 통과 (tsc --noEmit, 0 error)
```

**Δ Route**: 92.3 kB → **97.7 kB (+5.4 kB)** vs STEP 44 baseline.

증분 분석:
- `market-analysis.ts` (~160 LOC) — type 정의만, 런타임 0 byte
- `market-analysis-generator.ts` (~430 LOC) — 6 builders + display helpers
- `MarketAnalysisDrawer.tsx` (~600 LOC) — Drawer + 6 SectionCard + sub-metrics + RiskNotesList
- DetailPanel +12 LOC + Store +25 LOC + page.tsx +2 LOC

---

## 검증 매트릭스

| 사용자 spec | 검증 결과 |
|---|---|
| **구현 범위** | |
| Artwork DetailPanel에 "AI 시장 분석" 진입점 추가 | ✅ Living Timeline header inline 버튼 |
| 기존 MarketSignal / PriceSuggestion / ExternalAuctionProvider 결과를 read-only 활용 | ✅ `gatherMarketSignals` + `priceSuggestions` slice + `computeGalleryMedianPriceKRW` 모두 read-only |
| AI commentary는 실제 API 호출 없이 deterministic generator | ✅ pure function, 같은 입력 → 같은 출력 (generatedAt 제외) |
| **6-section 분석** | |
| Market Position | ✅ section 01 — ratio 4-tier |
| Comparable Signal Summary | ✅ section 02 — internal/external avg + recent sale |
| Liquidity Signal | ✅ section 03 — self_resale + same-artist tx 4-level |
| Demand / Inquiry Signal | ✅ section 04 — recent + active 4-level |
| Pricing Confidence | ✅ section 05 — confidence + range + diversity |
| Risk / Caution Notes | ✅ section 06 — 8 트리거 + severity 3-tier |
| **표현 정책** | |
| "참고 분석" / "운영 참고" / "시장 신호 기반" 사용 | ✅ Disclaimer banner / footnote / commentary 전반 |
| "감정가" 금지 | ✅ disclaimer 부정형으로만 |
| "확정 시장가" 금지 | ✅ disclaimer 부정형으로만 |
| "투자 수익 보장" 금지 | ✅ footnote 부정형으로만 |
| **UI** | |
| Drawer 방식 | ✅ 720px overlay |
| 3-column layout 변경 금지 | ✅ Drawer overlay만 |
| DetailPanel Secondary action 또는 Market Intelligence section 추가 | ✅ inline 버튼 (감사 로그와 동일 패턴) |
| 기존 Price Suggestion과 충돌하지 않게 구분 | ✅ ArtworkFormDrawer (편집)와 별개 view; commentary 중심 |
| **제약** | |
| 실제 AI API 호출 금지 | ✅ pure function only |
| 외부 API 신규 호출 금지 | ✅ `gatherMarketSignals`만 사용 (STEP 29 패턴 그대로) |
| MarketSignal 구조 큰 변경 금지 | ✅ 0줄 변경, consumer 역할만 |
| Payment / Settlement / Tax / FX / Customer 로직 변경 금지 | ✅ 0줄 변경 |
| Persistence schema 변경 금지 | ✅ PersistedState / validateV1 / SCHEMA_VERSION 0줄 변경 (UI request 슬라이스만 추가) |
| 신규 라이브러리 추가 금지 | ✅ `package.json` 0줄 변경 |

---

## Manifesto rule 정합성

| Rule | STEP 45 영향 | 상태 |
|---|---|---|
| **rule_1** Artwork-First | 분석은 작품 단위, Artwork-First 흐름의 결과 view | ✅ 보존 |
| **rule_4** Document Trust | 8 risk note 트리거로 transparent 노출 + disclaimer 부정형 + provider id 명시 | ✅ 강화 |
| **rule_5** AI-Human Loop | AI commentary → 인간 운영자 read (의사결정용 아님) — analysis는 advisory only | ✅ 보존 |
| **rule_8** Timeline = Navigation | Living Timeline header inline 버튼 (audit log entry와 같은 패턴) | ✅ 일관성 |
| **rule_14** 3-Column | 레이아웃 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | drawer footer "닫기" 1개; DetailPanel inline 버튼은 primary action 영역 외 | ✅ 보존 |
| **rule_16** 미니멀 디자인 | 6 카드 + 4-accent badge + 그림자 0 + 절제된 회색 톤 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | overlay만 | ✅ 보존 |
| **rule_18** AI role (b 시장 분석) | **본 STEP에서 본격 활성화** — 6-section commentary view | ✅ **승격** |
| **rule_19** Market Data | 기존 internal + external provider 결과를 commentary로 가시화 | ✅ 강화 |

---

## 패턴 재사용 — 기존 STEP과 일관성

| 항목 | STEP 18 (PriceSuggestion) | STEP 19/29 (MarketSignal) | STEP 45 (MarketAnalysis) |
|---|---|---|---|
| Generator 결정성 | ✅ pure | ✅ pure | ✅ pure |
| 외부 API 호출 | 0건 | 0건 | 0건 |
| 데이터 영속화 | store slice | ephemeral (재계산) | ephemeral (재계산) |
| disclaimer 부정형 표현 | "외부 시장 데이터 미사용" | "감정가 / 시장가 확정" 표현 금지 | "감정가 / 확정 시장가 / 투자 수익 보장 무관" |
| 신뢰도 cap | 0.95 (STEP 19) | — | confidenceLabel 재사용 |
| Confidence | 3-tier (STEP 18) → 0~1 + signal blend (STEP 19) | weight 0.30~0.85 | latestConfidence + diversity bonus (commentary) |

---

## 다음 STEP 후보

남은 Track 2 / Track 4 항목:

1. **Channel mix → Reporting Drawer 통합** — 갤러리 단위 channel 분포 분석 (Customer view에 이미 per-customer 보임 — 통합 view로 확장)
2. **Inquiry 신규 생성 시 Customer suggest** — 동일 이름 customer 자동 추천
3. **Logistics 외부 provider 연결** (rule_21) — STEP 29 ExternalAuctionProvider 패턴 답습
4. **Market Analysis Export** — STEP 25/35.6/44 export 패턴을 Market Analysis에도 적용 (PDF 한정 — view 중심이라 csv 의미 약함)

---

## 결과 요약

- 신규 파일 3개 (type 1 + lib 1 + component 1, 총 ~1190 LOC)
- 수정 파일 3개 (store / DetailPanel / page.tsx)
- 0 신규 라이브러리 / 0 외부 API / 0 도메인 store slice / 0 schema 변경
- rule_18 (b) 본격 활성화 — AXVELA가 Cultural / Market Intelligence AI로 보이는 첫 layer
- Route +5.4 kB (92.3 → 97.7 kB)

**STEP 45 완료.**
