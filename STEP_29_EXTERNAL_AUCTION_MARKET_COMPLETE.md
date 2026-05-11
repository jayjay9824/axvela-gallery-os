# STEP 29 — External Auction Market Reference 완료

STEP 19에서 마련한 `MarketDataProvider` 확장 hook을 실제로 활성화. 갤러리
외부의 옥션 / 마켓플레이스 가격 데이터를 PriceSuggestion에 신호로 통합.
**FX 변환 (USD → KRW) + TTL 캐시 + freshness timestamp + 실패 격리**.

> rule_18 (b) 시장 분석 / rule_19 Market Data — internal-only(STEP 19) → external 결합(STEP 29).

핵심 결정:
- **Provider 단일 push로 활성** — STEP 19의 `ACTIVE_PROVIDERS` 배열에
  `new ExternalAuctionProvider()` 한 줄 추가가 진입점. `gatherMarketSignals` /
  `axvela-price.ts` / store 로직 0줄 변경. 사용자 spec "확장 구조 유지" 준수.
- **Sync API 유지** — STEP 19의 `fetchSignals(input): MarketSignal[]` 시그니처
  그대로. 외부 신호도 sync 반환. 내부에 in-memory cache (artistName 키, 24h TTL)
  를 두고, 같은 input은 cache hit. 실제 네트워크는 v1에서 mock dataset 참조 —
  진짜 auction API 연동 시 `buildSignalsFor()` 메서드만 교체.
- **Failure 격리** — Provider throw → STEP 19의 `gatherMarketSignals` try/catch
  가 차단 → internal 신호는 그대로 emit. 사용자는 "외부 신호만 빠진" 정상
  PriceSuggestion 경험. 실패율은 `failureRate` 옵션으로 시뮬레이션 가능 (v1
  default 0% → 데모는 항상 성공).
- **Existing kind 재사용** — 외부 옥션 comparable sales는 `artist_avg` (external) +
  `artist_recent_sale` (external) kind로 emit. 이렇게 하면 STEP 19의 base price
  blend 로직 (artist_avg ≥2 sample 10% blend)이 외부 데이터에도 그대로 작동 —
  `axvela-price.ts` 0줄 변경. Marketplace listing은 `external_reference` kind
  전용 (asking price이며 sale price 아님 — 신호 성격 다름).
- **FX 변환** — 정적 환율 테이블 (USD/EUR/JPY/GBP → KRW). 모든 외부 신호는
  KRW로 정규화 emit. 향후 STEP에서 실시간 FX feed로 교체 가능 (rule_20).
- **Confidence cap 0.95 유지** — STEP 18+19의 cap 그대로. 외부 신호 추가로
  boost가 0.95에 도달하더라도 그 이상 못 올림 — "확정" 표현 차단.
- **Determinism (cache-stable)** — 같은 cache 상태에서 같은 input은 같은 출력.
  Cache miss 시 fetchedAt만 변동, signal id는 입력 hash 기반이라 안정.

---

## 1. 현재 코드 분석

**STEP 29 진입 시점 (v28 baseline):**

| 항목 | 진입 시점 | STEP 29 종료 |
|---|---|---|
| `MarketDataProvider` interface | STEP 19 정의 | 무수정 — 그대로 implement |
| `ACTIVE_PROVIDERS` registry | internal 1개 | + ExternalAuctionProvider |
| `gatherMarketSignals` | try/catch failure isolation 이미 존재 | 무수정 — 그대로 작동 |
| `MarketSignalSource` (`internal` / `external` 2-union) | external 분기 STEP 19 placeholder | **활성** — 실제 emit |
| `MarketSignalKind` 5-union (`external_reference` 포함) | placeholder | 활성 |
| `axvela-price.ts` blend / confidence boost | external 분기 disclaimer 이미 존재 | 무수정 — 그대로 분기 |
| FX 변환 | 부재 | USD→KRW 정적 테이블 |
| TTL 캐시 | 부재 | 24h in-memory Map |
| UI 안내 | 부재 | SuggestionCard `EXT REF` 배지 |

**의존 관계:**
- ExternalAuctionProvider는 `MarketSignal` 타입 + `formatMoney` 의존
- 호출 흐름: `useArtworkStore` → `gatherMarketSignals` → `ACTIVE_PROVIDERS.fetchSignals` →
  ExternalAuctionProvider.fetchSignals → cache lookup or buildSignalsFor → MarketSignal[] → PriceSuggestion sourceRefs
- 실패 시: throw → gatherMarketSignals try/catch → 빈 배열 → internal 신호만 emit

---

## 2. 변경 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `src/lib/market-data.ts` | `ExternalAuctionProvider` import + `ACTIVE_PROVIDERS`에 push (1줄). 주석 갱신. |
| `src/components/artwork/ArtworkFormDrawer.tsx` | `SuggestionCard`에 external sourceRef 검출 + "EXT REF" 배지 (사용자 spec "external reference 포함 안내 문구"). 신뢰도 row에만 추가, 다른 부분 무수정. |
| `ARCHITECTURE.md` | rule_18 (b) / rule_19 매트릭스 갱신 + STEP 29 changelog |

---

## 3. 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/external-auction-provider.ts` | 290 | `ExternalAuctionProvider` class implements MarketDataProvider. providerId="auction_v1", isExternal=true. + Mock auction comparable dataset (5명 작가, 7건) + Mock marketplace listings (2명 작가, 2건) + FX 변환 (`toKRW`) + TTL 캐시 (24h) + `failureRate` 옵션 (테스트용). |
| `STEP_29_EXTERNAL_AUCTION_MARKET_COMPLETE.md` | 본 문서 |

---

## 4. 변경 없는 파일 목록 (의도적)

| 파일 | 보존 이유 |
|---|---|
| `src/types/market-signal.ts` | STEP 19에서 external placeholder 이미 정의 — 추가 변경 0 |
| `src/lib/internal-market-provider.ts` | STEP 19 그대로. 외부 추가는 별도 provider |
| `src/lib/market-data.ts`의 `gatherMarketSignals` 함수 | try/catch 격리 이미 STEP 19 구현 |
| `src/lib/axvela-price.ts` (3-tier confidence + blend + disclaimer) | external/internal 분기 이미 STEP 19 구현 — `hasExternal` 자동 활성 |
| `src/types/price-suggestion.ts` (`market_signal` sourceRef kind) | STEP 19 정의 — `isExternal: boolean` 필드 그대로 사용 |
| `src/store/useArtworkStore.ts` (`generatePriceSuggestionForArtwork`) | `gatherMarketSignals` 호출 한 줄 그대로 — 내부에서 자동으로 external 신호 누적 |
| Money Flow / Contract / Tax / Logistics / Curation / Inquiry 도메인 코드 | 0줄 변경 |
| Audit (STEP 20/21/23/25) | 0줄 변경 |
| Persistence (STEP 27 / 27.7) | 0줄 변경 |
| 3-Column 레이아웃 / Sidebar / 모든 Drawer (PriceSuggestionPanel 외) | 0줄 변경 |
| `package.json` | 외부 라이브러리 0개 추가 |

---

## 5. 핵심 코드

### 5.1 Provider class

```ts
export class ExternalAuctionProvider implements MarketDataProvider {
  readonly providerId = "auction_v1";
  readonly isExternal = true;

  private readonly failureRate: number;
  private readonly cacheTTLMs: number;
  private readonly cache: Map<string, CacheEntry> = new Map();

  constructor(options: ExternalAuctionProviderOptions = {}) {
    this.failureRate = options.failureRate ?? 0;     // v1 default: 항상 성공
    this.cacheTTLMs = options.cacheTTLMs ?? 86_400_000; // 24h
  }

  fetchSignals(input: MarketDataInput): MarketSignal[] {
    // Failure simulation (테스트용)
    if (this.failureRate > 0 && Math.random() < this.failureRate) {
      throw new Error(`[ExternalAuctionProvider] simulated network failure`);
    }

    // Cache hit?
    const cached = this.cache.get(input.artistName);
    if (cached && this.isFresh(cached)) {
      return this.rebindToArtwork(cached.signals, input.artworkId);
    }

    // Cache miss / stale → "fetch" (v1: mock lookup) + cache 갱신
    const signals = this.buildSignalsFor(input);
    this.cache.set(input.artistName, {
      signals,
      fetchedAt: new Date().toISOString(),
      fetchedAtMs: Date.now(),
    });
    return this.rebindToArtwork(signals, input.artworkId);
  }
}
```

### 5.2 FX 변환

```ts
const FX_TO_KRW: Record<string, number> = {
  USD: 1380,
  EUR: 1480,
  JPY: 9.2,
  GBP: 1750,
};

function toKRW(amount: number, currency: string): number {
  const rate = FX_TO_KRW[currency];
  if (!rate) return 0;
  return Math.round(amount * rate);
}
```

### 5.3 Mock auction comparable sales → MarketSignal[]

```ts
private buildSignalsFor(input: MarketDataInput): MarketSignal[] {
  const out: MarketSignal[] = [];
  const fetchedAt = new Date().toISOString();

  const comparables = MOCK_AUCTION_COMPARABLES.filter(c => c.artistName === input.artistName);

  if (comparables.length > 0) {
    // (a) artist_avg (external) — KRW로 정규화된 평균
    const krwValues = comparables.map(c => toKRW(c.pricePaidUSD, "USD"));
    const avg = Math.round(krwValues.reduce((a,b)=>a+b, 0) / krwValues.length);
    const houses = Array.from(new Set(comparables.map(c => c.auctionHouse))).join(", ");

    out.push({
      kind: "artist_avg",
      artworkId: input.artworkId,
      averageKRW: avg,
      currency: "KRW",
      sampleSize: comparables.length,
      freshness: fetchedAt,
      weight: comparables.length >= 2 ? 0.75 : 0.55,  // external은 internal보다 약간 무거운 가중치
      source: { kind: "external", provider: "auction_v1", fetchedAt },
      rationale: `옥션 comparable ${comparables.length}건 평균 ${formatMoney(avg, "KRW")} (${houses})`,
      // ...
    });

    // (b) artist_recent_sale (external) — 가장 최근 1건
    // ...
  }

  // 2) Marketplace listings → external_reference kind
  // (asking price ≠ sale price — 신호 성격 명시)
  // ...
}
```

### 5.4 활성 (`market-data.ts`)

```ts
import { ExternalAuctionProvider } from "@/lib/external-auction-provider";

export const ACTIVE_PROVIDERS: MarketDataProvider[] = [
  new InternalMarketDataProvider(),
  new ExternalAuctionProvider(),  // STEP 29 — 활성
];
```

### 5.5 Failure 격리 (이미 STEP 19에 구현, 무수정)

```ts
export function gatherMarketSignals(input: MarketDataInput): MarketSignal[] {
  const out: MarketSignal[] = [];
  for (const provider of ACTIVE_PROVIDERS) {
    try {
      out.push(...provider.fetchSignals(input));
    } catch {
      // Defensive: ExternalAuctionProvider 실패해도 InternalMarketDataProvider 신호 보존
    }
  }
  return out;
}
```

### 5.6 SuggestionCard "EXT REF" 배지

```tsx
const hasExternalRef = sourceRefs.some(
  (ref) => ref.kind === "market_signal" && ref.isExternal === true
);

{/* 신뢰도 row 옆 배지 */}
{hasExternalRef && (
  <span
    className="text-[9.5px] font-medium tracking-[0.08em] uppercase px-1.5 py-0.5 rounded border border-line text-ink-subtle bg-surface-muted"
    title="옥션 / 마켓플레이스 reference 신호가 가격 제안에 포함되었습니다"
  >
    EXT REF
  </span>
)}
```

### 5.7 Disclaimer 자동 분기 (이미 STEP 19에 구현, 무수정)

```ts
// axvela-price.ts
const hasExternal = marketSignals.some((s) => s.source.kind === "external");
if (hasExternal) {
  rationale.push("내부 거래 기록 + 외부 reference 신호 결합 — 참고 가격 범위입니다");
} else {
  rationale.push("외부 시장 데이터 미사용 — 내부 거래 기록 기반 v1 제안");
}
```

STEP 29 활성 후, 데이터가 있는 작가의 작품은 자동으로 첫 번째 분기로 진입.

---

## 6. Mock Dataset 인벤토리

### Auction comparable sales (7건, 5명 작가)

| 작가 | 옥션 하우스 | 작품 | USD | 낙찰일 |
|---|---|---|---|---|
| 김지은 | Sotheby's HK | Aurora Series #08 | $14,500 | 2025-09-12 |
| 김지은 | Christie's HK | Untitled (2023) | $18,200 | 2025-11-04 |
| 박현우 | Phillips HK | Stratum 04 | $22,500 | 2025-08-21 |
| 이서연 | Sotheby's HK | Deep Field 02 | $11,000 | 2025-10-19 |
| 최아름 | Christie's HK | Inversion #5 | $9,800 | 2025-07-08 |
| 최아름 | Phillips HK | Inversion #2 | $12,300 | 2026-01-15 |
| 한도윤 | Sotheby's HK | Surface III | $16,500 | 2025-12-02 |

### Marketplace listings (2건, 2명 작가)

| 작가 | 마켓플레이스 | 호가 USD | 등재일 |
|---|---|---|---|
| 이서연 | Artsy | $13,500 | 2026-02-10 |
| 박현우 | Artsy | $25,000 | 2026-03-14 |

### 데이터 부재 작가 (의도적 — fallback 검증용)

- 정민호 (ar_04): external 신호 0건 → internal-only 흐름
- 윤세라 (ar_07): external 신호 0건 → internal-only 흐름

---

## 7. Build 결과

```
✓ Compiled successfully
Route (app)                              Size     First Load JS
┌ ○ /                                    70.6 kB         158 kB
```

| Step | Route / size | Δ |
|---|---|---|
| STEP 27 (Persistence) | 69.1 kB | — |
| STEP 27.7 (Multi-tab Sync) | 69.4 kB | +0.3 |
| **STEP 29 (External Auction)** | **70.6 kB** | **+1.2** |

`tsc --noEmit` 0 error / `next build` 0 warning. 외부 npm 의존성 0개 추가.

---

## 8. Manifesto 준수

| 규칙 | 상태 | 비고 |
|---|---|---|
| **rule_4** Trust Layer | ✅ 강화 | sourceRefs `isExternal: true` + `provider: "auction_v1"` + `fetchedAt` 명시 — audit trail에 외부 신호 origin 추적 |
| **rule_5** AI-Human Loop | ✅ | external 신호 추가돼도 최종 적용은 "Mid 적용" 명시 클릭 |
| **rule_18 (b)** 시장 분석 | ✅ **승격** | 🟡 STEP 19 (internal v1) → 🟢 STEP 29 (internal + external) |
| **rule_19** Market Data | ✅ **승격** | external connector 활성. 향후 STEP에서 실시간 FX / 실 API로 진화 |
| **rule_20** FX | 🟡 부분 | USD/EUR/JPY/GBP → KRW 정적 테이블. 인보이스 lock과는 별개 — 본 STEP은 read-only price reference만 |
| 도메인 / Money Flow / Audit / Store 구조 변경 | ✅ 0줄 | |
| 외부 API 실패 시 시스템 영향 | ✅ 0건 | gatherMarketSignals try/catch 격리 |
| Confidence cap 0.95 유지 | ✅ | STEP 18+19의 cap 그대로 |
| "감정가" / "시장가 확정" 표현 | ✅ 0건 | "참고 가격 범위" / "옥션 comparable" / "낙찰가 아님" (listing 명시) |
| 외부 라이브러리 추가 | ✅ 0개 | mock dataset + Date.now() 만 사용 |

---

## 9. 검증 시나리오

### A — External 신호 활성 (김지은 작품)

1. 김지은 작가의 작품 (예: art_001) 편집 진입
2. "AI 가격 제안" 클릭
3. **기대**:
   - SuggestionCard 신뢰도 row에 `EXT REF` 배지 표시
   - rationale에 "옥션 comparable 2건 평균 ₩... (Sotheby's Hong Kong, Christie's Hong Kong)" + "최근 옥션 낙찰 ₩... · Christie's Hong Kong (2025-11-04)" 추가
   - rationale 마지막 줄: "내부 거래 기록 + 외부 reference 신호 결합 — 참고 가격 범위입니다"
   - 기존 internal 신호도 그대로 유지

### B — Listing 신호 (이서연 작품)

1. 이서연 작가의 작품 편집
2. "AI 가격 제안"
3. **기대**:
   - 옥션 1건 (Sotheby's HK $11,000) + 마켓플레이스 1건 (Artsy $13,500)
   - rationale에 "마켓플레이스 listing 1건 평균 호가 ₩... — 낙찰가 아님" 명시
   - external_reference kind sourceRef 1개

### C — 데이터 부재 작가 (정민호 / 윤세라)

1. 정민호 또는 윤세라 작가 작품 편집
2. "AI 가격 제안"
3. **기대**:
   - SuggestionCard에 `EXT REF` 배지 **없음**
   - rationale 마지막 줄: "외부 시장 데이터 미사용 — 내부 거래 기록 기반 v1 제안"
   - internal 신호만 emit (artist_avg / self_resale / inquiry_volume)

### D — Cache 동작 검증

1. 같은 작가 작품 2개 연속 generate
2. **기대**:
   - 1번째: cache miss → buildSignalsFor 호출 → cache 저장
   - 2번째: cache hit → rebindToArtwork (artworkId만 갱신, 신호 내용 동일)
   - DevTools Performance에서 두 번째 호출이 더 빠름

### E — TTL 만료 시 자동 refresh

1. 같은 작가 작품 generate (cache 저장)
2. 24시간 후 (또는 cacheTTLMs 줄여 테스트) 같은 작가 generate
3. **기대**: cache stale → buildSignalsFor 재호출 → fetchedAt 갱신

### F — Failure 격리 (시뮬레이션)

1. `new ExternalAuctionProvider({ failureRate: 1 })` 강제 실패 모드 적용
2. 어떤 작가든 generate
3. **기대**:
   - ExternalAuctionProvider가 throw
   - `gatherMarketSignals` try/catch 차단
   - **Internal 신호는 그대로 emit** (artist_avg / self_resale / inquiry_volume)
   - SuggestionCard에 `EXT REF` 배지 없음
   - rationale 마지막 줄: internal-only disclaimer
   - **시스템 안정성 유지** — 사용자는 정상 흐름 (외부 신호만 빠짐)

### G — FX 변환 정확성

1. ExternalAuctionProvider 단위 호출 (코드 검증)
2. 김지은 ($14,500 + $18,200) / 2 = $16,350 평균
3. KRW 변환: $16,350 × 1380 = ₩22,563,000
4. **기대**: rationale에 ₩22,563,000 표시 (Math.round 적용)

### H — Confidence cap 유지

1. external + internal 신호 다수 emit되는 작가 작품
2. Tier 1 (paid) 0.82 + 모든 boost 합산 시 이론상 1.0+
3. **기대**: confidence ≤ 0.95 (Math.min cap)

### I — Determinism (cache-stable)

1. 같은 작가 작품 generate 2번
2. **기대**: suggestedLow / suggestedMid / suggestedHigh / confidence 동일 (cache hit으로 신호 재계산 안 됨)

### J — UI 배지 검증

1. 데이터 있는 작가 (김지은) generate
2. SuggestionCard 시각 확인
3. **기대**: `EXT REF` 배지 노출, hover 시 title "옥션 / 마켓플레이스 reference 신호가 가격 제안에 포함되었습니다"

---

## 10. 알려진 한계

| 항목 | 설명 | 향후 |
|---|---|---|
| Mock dataset (실 API 미연동) | v1 demo는 5명 작가, 9건 데이터. 실 auction API 연동 안 됨 | `buildSignalsFor()` 메서드를 `loadFromAPI(input)`으로 교체. 나머지 cache / FX / signal 빌드 로직 그대로 재사용 |
| 정적 FX 테이블 | USD=1380 / EUR=1480 / JPY=9.2 / GBP=1750 — 스냅샷 | rule_20 본격 구현 시 실시간 FX feed (한국은행 / Open Exchange Rates API 등) |
| Cache 영속성 부재 | in-memory Map — 페이지 새로고침 시 cache 사라짐 | STEP 27 PersistedState에 marketDataCache 슬라이스 추가 가능 |
| Artist 매칭 by name | 한국어 작가명 정확 일치 필요 | Artist 도메인 정비 시 id 기반 매칭 + alias 지원 |
| 단일 external provider | auction만 — 갤러리 sale / 페어 등 다른 reference 없음 | provider 추가 (ACTIVE_PROVIDERS에 push) |
| Marketplace listing 활용도 낮음 | weight 0.4, blend 0 — confidence boost만 | listing 가격을 base price 상한 신호로 활용 가능 (별도 STEP) |
| 통화별 신뢰도 미차등 | 모든 외부 신호 weight 동일 | 일부 통화(예: 스테이블한 USD)에 더 높은 weight 부여 가능 |
| Failure rate 옵션 미노출 | constructor에만 — UI에서 설정 불가 | 향후 admin / debug panel에서 토글 가능하게 노출 |

---

## 11. 다음 STEP 후보

1. **STEP 30 — RemoteSyncAdapter** — STEP 27 PersistenceAdapter를 백엔드(Supabase / Firebase / REST)로 확장. multi-device sync. server-side timestamp + conflict resolution.
2. **STEP 31 — Real FX Rate System (rule_20 완성)** — 인보이스 lock 시점 환율 자동 fetch. 정산 시 FX 계산 자동화. 본 STEP의 정적 테이블도 함께 교체.
3. **STEP 28 — Real AI Integration** — Curation / Inquiry response / Price suggestion에 실제 AI API 옵션 layer. deterministic helper와 병행 운영.
4. **STEP 24 — Audit Filters 강화** — date range / multi-select.
5. **STEP 26 — Audit Trail Visualization** — timeline graph / heatmap.
6. **STEP 27.5 — IndexedDBAdapter** — localStorage 5MB 한계 해소.
