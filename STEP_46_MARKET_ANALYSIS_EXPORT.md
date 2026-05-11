# STEP 46 — Market Analysis Export (PDF)

> **목표**: STEP 45 AI Market Analysis View의 종착점. 6-section commentary
> 결과를 PDF로 외부 공유 가능하게 함. STEP 25 / 35.6 / 44 export 패턴 그대로
> 차용해 일관성 + 위험도 최소화.

---

## State

- **이전**: STEP 45 / Route 97.7 kB
- **이번**: STEP 46 / **Route 101 kB (+3.3 kB)**
- Build ✅ · type-check ✅ (`tsc --noEmit` 0 error)

---

## Flow

```
MarketAnalysisDrawer (STEP 45)
  │  Header + Disclaimer + 6 SectionCard 렌더 중
  │
  └─ Footer (STEP 46 — justify-end → justify-between)
       ┌──────────────────────────────┬──────────────┐
       │ 내보내기 [PDF]                │       [닫기] │
       └─────────┬────────────────────┴──────────────┘
                 │
                 └→ handleExport("pdf")
                     └→ exportMarketAnalysis("pdf", report)
                         └→ window.open + document.write + onload print
                             → 브라우저 native PDF 다이얼로그
                                 ↓
                                 axvela-market-analysis-{ts}.pdf
```

**Export 대상 = drawer에 표시 중인 `report` 객체 그대로** — 별도 fetch / 재계산 0건. drawer view와 PDF의 wording 100% 일치.

---

## 변경 파일 목록

| 파일 | 변경량 | 역할 |
|---|---|---|
| `src/components/market-analysis/MarketAnalysisDrawer.tsx` | ~50 LOC | `market-analysis-export` import / `handleExport` callback / footer 재구성 / `ExportButton` sub-component |
| `ARCHITECTURE.md` | +1 changelog | STEP 46 추가 |

---

## 신규 파일 목록

| 파일 | LOC | 역할 |
|---|---|---|
| `src/lib/market-analysis-export.ts` | ~310 | `MarketAnalysisExportFormat` / `buildMarketAnalysisFilename` / `exportMarketAnalysis` dispatcher / `exportMarketAnalysisAsPDF` / 6 section HTML builders / accent + severity helpers |
| `STEP_46_MARKET_ANALYSIS_EXPORT.md` | (이 문서) | STEP 완료 보고 |

---

## 핵심 코드

### 1) Export dispatcher + format

```ts
// src/lib/market-analysis-export.ts

/**
 * v1은 PDF 단일. CSV는 6-section commentary 구조에 부합하지 않아 의도적 제외.
 * 향후 JSON (audit-export 패턴) 추가 가능성은 열어둠.
 */
export type MarketAnalysisExportFormat = "pdf";

export function exportMarketAnalysis(
  format: MarketAnalysisExportFormat,
  report: MarketAnalysisReport
): void {
  if (format === "pdf") {
    exportMarketAnalysisAsPDF(report);
  }
}

export function exportMarketAnalysisAsPDF(report: MarketAnalysisReport): void {
  const html = buildMarketAnalysisHTML(report);
  const win = window.open("", "_blank");
  if (!win) {
    window.alert("PDF 인쇄 창을 열 수 없습니다. 팝업 차단을 해제하고 다시 시도해주세요.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}
```

### 2) HTML 빌더 — 메타 + disclaimer + 6 sections + FX note + footnote

```ts
function buildMarketAnalysisHTML(report: MarketAnalysisReport): string {
  // FX 관련 disclaimer — 외부 신호 보유 시에만 노출 (STEP 35/36 동일 톤)
  const fxFootnote = report.metadata.hasExternalSignals
    ? `<div class="fx-note">
         외부 reference 신호의 KRW 환산은 STEP 31 FX provider snapshot을 기준으로 합니다.
         환율 변동 시 비교 결과가 달라질 수 있으며, Settlement / Tax는 각 거래의 Invoice
         lock 시점 환율(fxSnapshot)을 propagate합니다 (STEP 35 일관).
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>... @page A4, Pretendard, 6 section style ...</head>
<body>
  <h1>AI Market Analysis</h1>
  <div class="meta">
    <div><strong>분석 대상</strong> · ${escapeHTML(report.artworkTitle)}</div>
    <div><strong>작가</strong> · ${escapeHTML(report.artistName)}</div>
    <div><strong>생성 시각</strong> · ${escapeHTML(generatedDisplay)}</div>
    <div><strong>입력 신호</strong> · ${report.metadata.signalCount}건 · ${escapeHTML(providerLabel)}</div>
  </div>

  <div class="disclaimer">
    <strong>참고 분석 · 시장 신호 기반</strong> · 내부 거래 / 외부 reference 신호에서
    자동 derive — 감정가 또는 확정 시장가가 아닙니다.
  </div>

  ${positionHTML}      <!-- 01 Market Position -->
  ${comparableHTML}    <!-- 02 Comparable Signals -->
  ${liquidityHTML}     <!-- 03 Liquidity -->
  ${demandHTML}        <!-- 04 Demand -->
  ${pricingHTML}       <!-- 05 Pricing Confidence -->
  ${riskHTML}          <!-- 06 Risk / Caution Notes -->

  ${fxFootnote}

  <div class="footnote">
    본 분석은 휴리스틱 기반 <strong>운영 참고용</strong>입니다.
    가격 결정 / 거래 권유 / 투자 수익 보장과 무관하며, 분석 시점의 신호 집합에
    한정됩니다 — 새 거래 / 신호가 추가되면 결과가 달라질 수 있습니다.
  </div>
</body>
</html>`;
}
```

### 3) 섹션 빌더 예시 — Liquidity (badge + commentary + table)

```ts
function buildLiquidityHTML(s: LiquiditySection): string {
  const accent = liquidityAccent(s.level);
  const selfResaleCell =
    s.hasSelfResale && s.selfResaleValueKRW !== null
      ? `있음 · ${escapeHTML(formatKRW(s.selfResaleValueKRW))}`
      : s.hasSelfResale
      ? "있음"
      : "없음";
  return `
    <h2>
      <span class="index">03</span>Liquidity
      <span class="subtitle">· 유동성 신호</span>
      <span class="badge ${accent}">${escapeHTML(LIQUIDITY_LABEL_KR[s.level])}</span>
    </h2>
    <p class="commentary">${escapeHTML(s.commentary)}</p>
    <table>
      <tr><th>작가 거래 (KRW · PAID 이상)</th><td class="num">${s.artistTransactionCount}건</td></tr>
      <tr><th>본 작품 transaction</th><td class="num">${s.ownTransactionCount}건</td></tr>
      <tr><th>self-resale 신호</th><td>${selfResaleCell}</td></tr>
    </table>
  `;
}
```

### 4) Risk notes — severity 3-tier 카드

```ts
function buildRiskHTML(notes: RiskNote[]): string {
  if (notes.length === 0) {
    return `... <p class="commentary">주의 사항 없음.</p>`;
  }
  const items = notes.map((n) => `
    <div class="risk-item ${severityClass(n.severity)}">
      <span class="risk-dot ${severityClass(n.severity)}"></span>
      <div>
        <div>${escapeHTML(n.message)}</div>
        <div class="risk-severity">${escapeHTML(severityLabel(n.severity))}</div>
      </div>
    </div>
  `).join("");
  // HIGH = amber border + dot, MEDIUM = neutral, LOW = subtle
  // severityLabel: HIGH→"주의" / MEDIUM→"참고" / LOW→"안내"
  return `... ${items}`;
}
```

### 5) Drawer 통합 — handleExport callback

```tsx
// src/components/market-analysis/MarketAnalysisDrawer.tsx

import {
  exportMarketAnalysis,
  type MarketAnalysisExportFormat,
} from "@/lib/market-analysis-export";

// STEP 46 — Market Analysis Export. Drawer에 표시 중인 report 객체를 그대로
// PDF로 직렬화. Report 부재 시 silent no-op (defensive).
const handleExport = React.useCallback(
  (format: MarketAnalysisExportFormat) => {
    if (!report) return;
    exportMarketAnalysis(format, report);
  },
  [report]
);
```

### 6) Footer — STEP 44 customer-export 패턴 그대로

```tsx
<footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-between bg-surface">
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase mr-1">
      내보내기
    </span>
    <ExportButton label="PDF" onClick={() => handleExport("pdf")} disabled={!report} />
  </div>
  <Button type="button" variant="ghost" onClick={closeView}>닫기</Button>
</footer>
```

---

## PDF 출력 구조 (실제 렌더 예시)

```
┌───────────────────────────────────────────────────────────┐
│ AI Market Analysis                                        │
│                                                           │
│ 분석 대상 · {작품명}                                      │
│ 작가 · {작가명}                                           │
│ 생성 시각 · 2026-05-04 04:25                              │
│ 입력 신호 · 4건 · internal_v1 / auction_v1                │
│                                                           │
│ ┃ 참고 분석 · 시장 신호 기반 · 내부 거래 / 외부 reference│
│ ┃ 신호에서 자동 derive — 감정가 또는 확정 시장가가 아닙니│
│                                                           │
│ 01 Market Position · 갤러리 가격 위치  [중간가 상위]      │
│ 갤러리 중간 가격 대비 약 142% 수준 — 상위 가격 구간입니다.│
│ ┌─────────────────────────────┬─────────────────────┐    │
│ │ 중간가 대비                 │              142%   │    │
│ │ 작가 작품 보유 (KRW>0)      │               3점   │    │
│ └─────────────────────────────┴─────────────────────┘    │
│                                                           │
│ 02 Comparable Signals · 동일 작가 비교 거래               │
│ 내부 거래 평균 ₩... · 외부 reference 평균 ₩...            │
│ ...                                                       │
│                                                           │
│ 03 Liquidity · 유동성 신호  [강함]                        │
│ 04 Demand · 문의 / 수요 신호  [두드러짐]                  │
│ 05 Pricing Confidence · 가격 제안 신뢰도  [높음]          │
│ 06 Risk / Caution Notes · 주의 사항                       │
│   • 외부 reference 신호가 없어 분석은 내부 기록... [참고] │
│                                                           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━ FX note (외부 신호 보유 시) ━━━ │
│ 외부 reference 신호의 KRW 환산은 STEP 31 FX provider...   │
│ Settlement / Tax는 각 거래의 Invoice lock 시점 환율을... │
│                                                           │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│ 본 분석은 휴리스틱 기반 운영 참고용입니다.                │
│ 가격 결정 / 거래 권유 / 투자 수익 보장과 무관하며,        │
│ 분석 시점의 신호 집합에 한정됩니다.                       │
└───────────────────────────────────────────────────────────┘
                                                  axvela-market-analysis-20260504-042530.pdf
```

---

## Build 결과

```
> npm run build

Route (app)                              Size     First Load JS
┌ ○ /                                    101 kB          188 kB
└ ○ /_not-found                          873 B            88 kB
+ First Load JS shared by all            87.1 kB

✓ Compiled successfully
✓ type-check 통과 (tsc --noEmit, 0 error)
```

**Δ Route**: 97.7 kB → **101 kB (+3.3 kB)** vs STEP 45 baseline.

증분 분석:
- `market-analysis-export.ts` (~310 LOC) — PDF HTML builder + 6 section helpers + accent/severity utils
- MarketAnalysisDrawer +50 LOC — handleExport callback + footer 재구성 + ExportButton

---

## 검증 매트릭스

| 사용자 spec | 검증 결과 |
|---|---|
| **Export 대상** | |
| Market Analysis Drawer 내용 전체 | ✅ 6 section + 메타 + disclaimer + footnote + FX note 모두 포함 |
| 6개 블록 모두 직렬화 | ✅ Market Position / Comparable / Liquidity / Demand / Pricing Confidence / Risk Notes |
| **Export 형식** | |
| PDF 중심 | ✅ 단일 format |
| CSV 제외 | ✅ 텍스트 분석 구조상 의미 낮음 — 의도적 미구현 |
| window.print 기반 HTML export (기존 패턴 유지) | ✅ STEP 25 / 35.6 / 44와 동일 |
| **포함 내용** | |
| 작품 정보 (title / artist / date) | ✅ Header 메타 |
| 분석 생성 시각 | ✅ `generatedAt` ISO → "2026-05-04 04:25" 표시 |
| "참고 분석 · 시장 신호 기반" disclaimer | ✅ 본문 상단 강조 박스 |
| FX 관련 문구 STEP 35/36 동일 톤 | ✅ 외부 신호 보유 시 조건부 fx-note ("Invoice lock 시점 환율(fxSnapshot)을 propagate") |
| **표현 정책** | |
| 기존 wording 유지 ("참고 분석", "운영 참고용") | ✅ drawer / PDF 100% 일치 |
| "감정가" 금지 | ✅ disclaimer 부정형으로만 |
| "확정 시장가" 금지 | ✅ disclaimer 부정형으로만 |
| "투자 수익 보장" 금지 | ✅ footnote 부정형으로만 |
| "확정 판단" 금지 | ✅ 0건 사용 |
| **UI** | |
| Footer [PDF 내보내기] [닫기] | ✅ STEP 44 customer-export와 동일 패턴 |
| **제약** | |
| AI API 호출 금지 | ✅ HTML 직렬화만 |
| 외부 API 추가 금지 | ✅ browser native API + window.open + window.print |
| MarketAnalysis generator 로직 변경 금지 | ✅ 0줄 변경 (consumer 역할만) |
| Payment / Settlement / Tax / FX / Customer 로직 변경 금지 | ✅ 0줄 변경 |
| Persistence schema 변경 금지 | ✅ PersistedState / validateV1 / SCHEMA_VERSION 0줄 변경 |
| 신규 라이브러리 추가 금지 | ✅ `package.json` 0줄 변경 |

---

## Manifesto rule 정합성

| Rule | STEP 46 영향 | 상태 |
|---|---|---|
| **rule_3** Money Flow 분리 | 외부 신호 KRW 환산은 Invoice fxSnapshot read-only 참조만 | ✅ 보존 |
| **rule_4** Document Trust | disclaimer + footnote + fx-note + risk note severity 명시로 transparent 노출 | ✅ 강화 |
| **rule_5** AI-Human Loop | AI commentary → 인간 운영자 read + share — analysis는 advisory only | ✅ 보존 |
| **rule_7** RBAC | 작품 detail 진입 가능하면 분석 + export 모두 가능 (audit / reporting / customer export와 같은 정책) | ✅ 일관성 |
| **rule_14** 3-Column | 레이아웃 0줄 변경 | ✅ 보존 |
| **rule_15** Max 3 buttons | drawer footer "PDF" / "닫기" 정확히 2개 (좌우 분리) | ✅ 보존 |
| **rule_16** 미니멀 디자인 | Pretendard + 절제된 회색 + 그림자 0 | ✅ 보존 |
| **rule_17** Drawer/Modal Layer | overlay만, 새 창은 print 전용 | ✅ 보존 |
| **rule_18 (b)** AI 시장 분석 | drawer view + PDF export = 외부 공유 가능한 commentary 종착점 | ✅ 강화 |
| **rule_20** FX | Invoice fxSnapshot lock 시점 환율 그대로 footnote에 명시 | ✅ 보존 |

---

## 패턴 재사용 — STEP 25 / 35.6 / 44 일관성 (4번째 export 모듈)

| 항목 | STEP 25 (audit) | STEP 35.6 (reporting) | STEP 44 (customer) | STEP 46 (market-analysis) |
|---|---|---|---|---|
| Format | JSON / CSV / PDF | CSV / PDF | CSV / PDF | **PDF only** |
| Filename 패턴 | `axvela-audit-{scope}-{ts}.{ext}` | `axvela-reporting-{ts}.{ext}` | `axvela-customers-{ts}.{ext}` | `axvela-market-analysis-{ts}.pdf` |
| CSV BOM | ✅ `\uFEFF` | ✅ `\uFEFF` | ✅ `\uFEFF` | — (CSV 미구현) |
| RFC 4180 escape | ✅ | ✅ | ✅ | — (CSV 미구현) |
| PDF 방식 | `window.open` + print | `window.open` + print | `window.open` + print | `window.open` + print |
| `escapeHTML` helper | ✅ | ✅ | ✅ | ✅ |
| Disclaimer 부정형 표현 | "법적/외부 제출 시 참고용" | "회계 확정 / 세무 신고 권한 / 외부 보고와 무관" | "확정 고객 등급 / 신용 평가 / 법적 효력과 무관" | "감정가 / 확정 시장가 / 투자 수익 보장과 무관" |
| Dispatcher 시그니처 | `(format, ...)` | `(format, ...)` | `(format, ...)` | `(format, ...)` (단일이지만 호환 유지) |
| Footer 패턴 | (drawer 내 이미 4개 export bar) | `[CSV][PDF]` + `[닫기]` | `[CSV][PDF]` + `[닫기]` | `[PDF]` + `[닫기]` |

네 모듈 모두 같은 mental model. 도메인별 column / disclaimer / 합계 / 섹션 구조만 차등.

---

## 다음 STEP 후보

남은 Track 후보:

1. **Channel mix → Reporting Drawer 통합** — 갤러리 단위 channel 분포 분석 (Customer view에 이미 per-customer 노출 — 통합 view로 확장)
2. **Inquiry 신규 생성 시 Customer suggest** — 동일 이름 customer 자동 추천 (intake form UX)
3. **Logistics 외부 provider 연결** (rule_21) — STEP 29 ExternalAuctionProvider 패턴 답습
4. **Market Analysis history slice 도입** — Persistence schema v2 migration 필요. 현재는 ephemeral re-derive, 시간 추이 비교 용도라면 슬라이스 필요.

---

## 결과 요약

- 신규 파일 1개 (`market-analysis-export.ts` ~310 LOC)
- 수정 파일 1개 (MarketAnalysisDrawer ~50 LOC)
- 0 신규 라이브러리 / 0 외부 API / 0 store slice / 0 schema 변경
- STEP 25 / 35.6 / 44 export 패턴과 100% 일관 (filename / window.print / disclaimer 부정형 / footer 구조)
- drawer view와 PDF export의 wording 100% 일치
- CSV 의도적 제외 — 6-section commentary 구조에 부합하지 않음
- Route +3.3 kB (97.7 → 101 kB)

**STEP 46 완료.**
