// ============================================================================
// Market Analysis Export — STEP 46.
//
// AI Market Analysis View (STEP 45) 결과를 PDF로 출력. STEP 25 audit-export /
// STEP 35.6 reporting-export / STEP 44 customer-export 패턴 그대로 차용.
// **CSV 제외** — 6 섹션 commentary 중심 텍스트 분석은 표 형태로 직렬화 시
// 가독성이 떨어지고 외부 활용성도 낮음 (사용자 spec).
//
// **외부 라이브러리 0개 · 백엔드 0건 · 외부 API 호출 0건 · MarketAnalysis
// generator 로직 변경 0줄 · Money Flow / Settlement / Tax / FX / Customer /
// AI 로직 변경 0줄 · Persistence schema 변경 0줄 · 신규 store slice 0개**.
//
// **표현 정책 (사용자 spec 엄격 준수):**
//   - "참고 분석" / "운영 참고용" / "시장 신호 기반" 사용 (기존 wording 유지)
//   - "감정가" / "확정 시장가" / "투자 수익 보장" / "확정 판단" 표현 0건
//     (오직 disclaimer의 부정형 표현으로만 등장)
//   - FX 관련 문구는 STEP 35/36와 동일 톤 — "FX snapshot 기준 (lock 시점)"
// ============================================================================

import type {
  MarketAnalysisReport,
  MarketPositionSection,
  ComparableSummarySection,
  LiquiditySection,
  DemandSection,
  PricingConfidenceSection,
  RiskNote,
  RiskSeverity,
} from "@/types/market-analysis";
import {
  formatKRW,
  MARKET_POSITION_LABEL_KR,
  LIQUIDITY_LABEL_KR,
  DEMAND_LABEL_KR,
} from "@/lib/market-analysis-generator";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * v1은 PDF 단일. CSV는 6-section commentary 구조에 부합하지 않아 의도적 제외.
 * 향후 JSON (audit-export 패턴) 추가 가능성은 열어둠.
 */
export type MarketAnalysisExportFormat = "pdf";

// ---------------------------------------------------------------------------
// Filename
// ---------------------------------------------------------------------------

/**
 * `axvela-market-analysis-{YYYYMMDD-HHMMSS}.pdf`
 * STEP 25 / 35.6 / 44 export 파일명 규약 일관.
 */
export function buildMarketAnalysisFilename(): string {
  return `axvela-market-analysis-${nowFilenameSafe()}.pdf`;
}

function nowFilenameSafe(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

export function exportMarketAnalysis(
  format: MarketAnalysisExportFormat,
  report: MarketAnalysisReport
): void {
  // 단일 format이지만 audit-export / reporting-export / customer-export
  // dispatcher 시그니처와 일관 유지 (향후 JSON 추가 시 backward-compat).
  if (format === "pdf") {
    exportMarketAnalysisAsPDF(report);
  }
}

// ---------------------------------------------------------------------------
// PDF (HTML print pattern — STEP 25 / 35.6 / 44 동일)
// ---------------------------------------------------------------------------

export function exportMarketAnalysisAsPDF(report: MarketAnalysisReport): void {
  const html = buildMarketAnalysisHTML(report);
  const win = window.open("", "_blank");
  if (!win) {
    window.alert(
      "PDF 인쇄 창을 열 수 없습니다. 팝업 차단을 해제하고 다시 시도해주세요."
    );
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

function buildMarketAnalysisHTML(report: MarketAnalysisReport): string {
  const positionHTML = buildPositionHTML(report.marketPosition);
  const comparableHTML = buildComparableHTML(report.comparableSummary);
  const liquidityHTML = buildLiquidityHTML(report.liquiditySignal);
  const demandHTML = buildDemandHTML(report.demandSignal);
  const pricingHTML = buildPricingHTML(report.pricingConfidence);
  const riskHTML = buildRiskHTML(report.riskNotes.notes);

  const generatedDisplay = report.generatedAt.replace("T", " ").slice(0, 16);
  const providerLabel =
    report.metadata.providers.length > 0
      ? report.metadata.providers.join(" / ")
      : "—";

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
<head>
  <meta charset="utf-8" />
  <title>AXVELA AI Market Analysis · ${escapeHTML(report.artworkTitle)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
      font-size: 10pt; line-height: 1.55; color: #1a1a1a;
    }
    h1 {
      font-size: 14pt; font-weight: 600; letter-spacing: -0.01em;
      margin: 0 0 1mm 0;
    }
    h2 {
      font-size: 11pt; font-weight: 600; margin: 6mm 0 1.5mm 0;
      letter-spacing: -0.01em; color: #1a1a1a;
    }
    h2 .index {
      display: inline-block; min-width: 6mm;
      font-family: "JetBrains Mono", "SF Mono", Consolas, monospace;
      font-size: 9pt; color: #888; font-weight: 500; margin-right: 1mm;
    }
    h2 .subtitle {
      font-size: 9pt; font-weight: 400; color: #777; margin-left: 1mm;
    }
    .meta {
      color: #555; font-size: 9pt; line-height: 1.7; margin-bottom: 3mm;
    }
    .meta div { margin: 0; }
    .disclaimer {
      border-left: 2px solid #1a1a1a; padding: 1.5mm 3mm;
      background: #f8f8f8; font-size: 9.5pt; color: #2a2a2a;
      margin: 3mm 0 5mm 0; line-height: 1.6;
    }
    .commentary {
      font-size: 10pt; color: #2a2a2a; margin: 1mm 0 2.5mm 0;
      line-height: 1.65;
    }
    .badge {
      display: inline-block; padding: 0.5mm 2mm; border-radius: 8mm;
      border: 1px solid #d0d0d0; font-size: 8.5pt; color: #444;
      vertical-align: middle; margin-left: 1.5mm;
    }
    .badge.positive { border-color: #1a1a1a; color: #1a1a1a; font-weight: 500; }
    .badge.warning { border-color: #b45309; color: #b45309; }
    .badge.muted { background: #f5f5f5; color: #888; border-color: #e0e0e0; }
    table {
      width: 100%; border-collapse: collapse; margin: 0 0 2mm 0;
    }
    th, td {
      border-bottom: 1px solid #ececec; padding: 1.2mm 2mm;
      text-align: left; vertical-align: top; font-size: 9pt;
    }
    th {
      font-weight: 500; color: #555; width: 38mm;
      background: #fafafa;
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .small { font-size: 8.5pt; color: #888; }
    .mono { font-family: "JetBrains Mono", "SF Mono", Consolas, monospace; }
    .risk-item {
      display: flex; align-items: flex-start; gap: 2.5mm;
      padding: 1.5mm 2.5mm; border: 1px solid #e0e0e0;
      border-radius: 1.5mm; margin-bottom: 1.5mm;
    }
    .risk-item.high { border-color: #b45309; background: #fef9f0; }
    .risk-item.medium { border-color: #d0d0d0; background: #f8f8f8; }
    .risk-item.low { border-color: #ececec; background: #fff; }
    .risk-dot {
      flex-shrink: 0; width: 2mm; height: 2mm; border-radius: 50%;
      margin-top: 1.2mm; background: #aaa;
    }
    .risk-dot.high { background: #b45309; }
    .risk-dot.medium { background: #777; }
    .risk-dot.low { background: #aaa; }
    .risk-severity {
      font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em;
      color: #777; margin-top: 0.5mm;
    }
    .empty {
      padding: 3mm; text-align: center; color: #999;
      border: 1px dashed #d0d0d0; border-radius: 1.5mm; font-size: 9pt;
    }
    .footnote {
      margin-top: 8mm; padding-top: 4mm;
      border-top: 1px dashed #d0d0d0;
      color: #6b6b6b; font-size: 8.5pt; line-height: 1.65;
    }
    .fx-note {
      margin-top: 3mm; padding: 2mm 3mm;
      background: #f8f8f8; border-radius: 1.5mm;
      font-size: 8.5pt; color: #555; line-height: 1.6;
    }
  </style>
</head>
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

  ${positionHTML}
  ${comparableHTML}
  ${liquidityHTML}
  ${demandHTML}
  ${pricingHTML}
  ${riskHTML}

  ${fxFootnote}

  <div class="footnote">
    본 분석은 휴리스틱 기반 <strong>운영 참고용</strong>입니다.
    가격 결정 / 거래 권유 / 투자 수익 보장과 무관하며, 분석 시점의 신호 집합에
    한정됩니다 — 새 거래 / 신호가 추가되면 결과가 달라질 수 있습니다.
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Per-section HTML builders
// ---------------------------------------------------------------------------

function buildPositionHTML(s: MarketPositionSection): string {
  const accent = positionAccent(s.tier);
  const ratioRow =
    s.ratioToMedian !== null
      ? `<tr><th>중간가 대비</th><td class="num">${(s.ratioToMedian * 100).toFixed(0)}%</td></tr>`
      : "";
  return `
    <h2>
      <span class="index">01</span>Market Position
      <span class="subtitle">· 갤러리 가격 위치</span>
      <span class="badge ${accent}">${escapeHTML(MARKET_POSITION_LABEL_KR[s.tier])}</span>
    </h2>
    <p class="commentary">${escapeHTML(s.commentary)}</p>
    <table>
      ${ratioRow}
      <tr><th>작가 작품 보유 (KRW>0)</th><td class="num">${s.artistArtworkCount}점</td></tr>
    </table>
  `;
}

function buildComparableHTML(s: ComparableSummarySection): string {
  const rows: string[] = [];

  rows.push(
    `<tr>
      <th>내부 거래 평균</th>
      <td class="num">${s.internalArtistAvgKRW !== null ? escapeHTML(formatKRW(s.internalArtistAvgKRW)) : "—"}</td>
      <td class="small">${s.internalArtistAvgKRW !== null ? `sample ${s.internalArtistSampleSize}` : "신호 없음"}</td>
    </tr>`
  );
  rows.push(
    `<tr>
      <th>외부 reference 평균</th>
      <td class="num">${s.externalArtistAvgKRW !== null ? escapeHTML(formatKRW(s.externalArtistAvgKRW)) : "—"}</td>
      <td class="small">${s.externalArtistAvgKRW !== null ? `sample ${s.externalArtistSampleSize} · 외부` : "신호 없음"}</td>
    </tr>`
  );
  if (s.recentSale) {
    rows.push(
      `<tr>
        <th>최근 거래</th>
        <td class="num">${escapeHTML(formatKRW(s.recentSale.valueKRW))}</td>
        <td class="small">${s.recentSale.isExternal ? "외부 reference" : "내부 기록"} · ${escapeHTML(s.recentSale.freshness.slice(0, 10))}</td>
      </tr>`
    );
  }

  return `
    <h2>
      <span class="index">02</span>Comparable Signals
      <span class="subtitle">· 동일 작가 비교 거래</span>
    </h2>
    <p class="commentary">${escapeHTML(s.commentary)}</p>
    <table>
      ${rows.join("")}
    </table>
  `;
}

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

function buildDemandHTML(s: DemandSection): string {
  const accent = demandAccent(s.level);
  return `
    <h2>
      <span class="index">04</span>Demand
      <span class="subtitle">· 문의 / 수요 신호</span>
      <span class="badge ${accent}">${escapeHTML(DEMAND_LABEL_KR[s.level])}</span>
    </h2>
    <p class="commentary">${escapeHTML(s.commentary)}</p>
    <table>
      <tr><th>누적 문의</th><td class="num">${s.totalInquiryCount}건</td></tr>
      <tr><th>최근 30일</th><td class="num">${s.recentInquiryCount}건</td></tr>
      <tr><th>진행 중 (응대 / 에스컬레이션)</th><td class="num">${s.activeInquiryCount}건</td></tr>
    </table>
  `;
}

function buildPricingHTML(s: PricingConfidenceSection): string {
  if (!s.hasSuggestion || !s.latestRange) {
    return `
      <h2>
        <span class="index">05</span>Pricing Confidence
        <span class="subtitle">· 참고 가격 신호 신뢰도</span>
        <span class="badge muted">참고 신호 부재</span>
      </h2>
      <p class="commentary">${escapeHTML(s.commentary)}</p>
      <div class="empty">참고 가격 신호가 아직 생성되지 않았습니다 — 작품 편집에서 신호를 생성할 수 있습니다.</div>
    `;
  }
  const { low, mid, high, currency } = s.latestRange;
  const fmt = (n: number) =>
    currency === "KRW"
      ? formatKRW(n)
      : `${currency} ${n.toLocaleString("en-US")}`;
  const accent =
    s.latestConfidence !== null && s.latestConfidence >= 0.75
      ? "positive"
      : s.latestConfidence !== null && s.latestConfidence >= 0.5
      ? ""
      : "warning";
  return `
    <h2>
      <span class="index">05</span>Pricing Confidence
      <span class="subtitle">· 참고 가격 신호 신뢰도</span>
      <span class="badge ${accent}">${escapeHTML(s.confidenceLabel)}</span>
    </h2>
    <p class="commentary">${escapeHTML(s.commentary)}</p>
    <table>
      <tr><th>신뢰도</th><td class="num">${(((s.latestConfidence ?? 0) * 100) | 0)}%</td><td class="small">${escapeHTML(s.confidenceLabel)}</td></tr>
      <tr><th>Low</th><td class="num">${escapeHTML(fmt(low))}</td><td class="small"></td></tr>
      <tr><th>Mid</th><td class="num">${escapeHTML(fmt(mid))}</td><td class="small">제안 중심값</td></tr>
      <tr><th>High</th><td class="num">${escapeHTML(fmt(high))}</td><td class="small"></td></tr>
      <tr><th>입력 신호 종류</th><td class="num">${s.signalKindDiversity}종</td><td class="small">${s.hasAppliedSuggestion ? "적용 이력 있음" : ""}</td></tr>
    </table>
  `;
}

function buildRiskHTML(notes: RiskNote[]): string {
  if (notes.length === 0) {
    return `
      <h2>
        <span class="index">06</span>Risk / Caution Notes
        <span class="subtitle">· 주의 사항</span>
      </h2>
      <p class="commentary">주의 사항 없음.</p>
    `;
  }
  const items = notes
    .map(
      (n) => `
    <div class="risk-item ${severityClass(n.severity)}">
      <span class="risk-dot ${severityClass(n.severity)}"></span>
      <div>
        <div>${escapeHTML(n.message)}</div>
        <div class="risk-severity">${escapeHTML(severityLabel(n.severity))}</div>
      </div>
    </div>
  `
    )
    .join("");
  return `
    <h2>
      <span class="index">06</span>Risk / Caution Notes
      <span class="subtitle">· 주의 사항</span>
    </h2>
    <div>${items}</div>
  `;
}

// ---------------------------------------------------------------------------
// Accent / severity helpers
// ---------------------------------------------------------------------------

function positionAccent(t: MarketPositionSection["tier"]): string {
  switch (t) {
    case "ABOVE_MEDIAN":
      return "positive";
    case "INSUFFICIENT_DATA":
      return "muted";
    default:
      return "";
  }
}

function liquidityAccent(l: LiquiditySection["level"]): string {
  switch (l) {
    case "STRONG":
      return "positive";
    case "LIMITED":
      return "warning";
    case "INSUFFICIENT_DATA":
      return "muted";
    default:
      return "";
  }
}

function demandAccent(d: DemandSection["level"]): string {
  switch (d) {
    case "ELEVATED":
      return "positive";
    case "LOW":
      return "warning";
    case "NONE":
      return "muted";
    default:
      return "";
  }
}

function severityClass(s: RiskSeverity): string {
  return s.toLowerCase();
}

function severityLabel(s: RiskSeverity): string {
  switch (s) {
    case "HIGH":
      return "주의";
    case "MEDIUM":
      return "참고";
    case "LOW":
      return "안내";
  }
}

// ---------------------------------------------------------------------------
// Helpers (audit-export / reporting-export / customer-export 패턴 그대로)
// ---------------------------------------------------------------------------

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
