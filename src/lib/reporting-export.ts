// ============================================================================
// Reporting Export — STEP 35.6
//
// CSV / PDF 내보내기. STEP 25 audit-export.ts 패턴 재활용 (triggerDownload /
// window.print HTML / escape helpers). 입력은 이미 필터된 ReportingAggregates +
// time filter 정보 (라벨용). **도메인 로직 0줄 변경 · 외부 라이브러리 0개**.
//
// 표현 정책 (사용자 spec 엄격 준수):
//   - "운영 참고 리포트" 문구 유지
//   - "회계 확정", "세무 신고 완료", "법적 효력" 표현 절대 금지
//   - "FX snapshot 기준 (lock 시점)" / "내부 정산 기준" 사용
// ============================================================================

import type { ReportingAggregates, ChannelMixBucket } from "./reporting-aggregates";
import {
  INVOICE_STATUS_LABEL_KR,
  SETTLEMENT_STATUS_LABEL_KR,
  TAX_STATUS_LABEL_KR,
} from "./reporting-aggregates";
import { INQUIRY_SOURCE_LABEL_KR } from "./customer-aggregates";

export type ReportExportFormat = "csv" | "pdf";

export interface ReportExportContext {
  /** UI에 노출되는 기간 라벨 (formatTimeFilterLabel 결과). */
  timeFilterLabel: string;
}

// ---------------------------------------------------------------------------
// Filename
// ---------------------------------------------------------------------------

export function buildReportFilename(format: ReportExportFormat): string {
  const ts = nowFilenameSafe();
  return `axvela-reporting-${ts}.${format}`;
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
// CSV
// ---------------------------------------------------------------------------

export function exportReportingAsCSV(
  agg: ReportingAggregates,
  ctx: ReportExportContext
): void {
  const lines: string[] = [];

  // Header / metadata
  lines.push("운영 참고 리포트");
  lines.push("내부 정산 기준 / FX snapshot 기준 (lock 시점)");
  lines.push("회계 확정 또는 세무 신고와 무관");
  lines.push(`생성 시각,${csv(formatNowKR())}`);
  lines.push(`기간,${csv(ctx.timeFilterLabel)}`);
  if (agg.fxSourceIsMock) {
    lines.push(
      `FX 데이터,mock provider${
        agg.fxProviderId ? ` (${agg.fxProviderId})` : ""
      } — 실 환율과 차이 가능`
    );
  }
  lines.push("");

  // 핵심 지표 (KPI)
  lines.push("[핵심 지표]");
  lines.push("지표,KRW 값,건수,비고");
  lines.push(
    `Total Sales,${agg.totalSalesKRW},${agg.totalSalesCount},` +
      csv(
        agg.totalSalesCount > agg.convertibleInvoiceCount
          ? `${
              agg.totalSalesCount - agg.convertibleInvoiceCount
            }건 환산 정보 부족`
          : ""
      )
  );
  lines.push(
    `Settlement Total,${agg.settlementTotalKRW},${agg.settlementCount},` +
      csv(
        agg.settlementMissingFxCount > 0
          ? `${agg.settlementMissingFxCount}건 환산 정보 부족`
          : ""
      )
  );
  lines.push(
    `Taxable Amount,${agg.taxableAmountKRW},${agg.taxRecordCount},` +
      csv(
        agg.taxMissingFxCount > 0
          ? `${agg.taxMissingFxCount}건 환산 정보 부족`
          : ""
      )
  );
  lines.push(
    `FX Converted,${agg.fxConvertedKRWTotal},${agg.fxConvertedInvoiceCount},외화 invoice 환산 합계`
  );
  lines.push("");

  // 통화별 분포
  lines.push("[통화별 매출 분포]");
  lines.push("통화,건수,통화 단위 합계,KRW 환산,비고");
  for (const b of agg.currencyBreakdown) {
    lines.push(
      `${b.currency},${b.count},${b.total},` +
        (b.convertedKRW !== null ? `${b.convertedKRW}` : "(누락)") +
        "," +
        csv(b.missingFxCount > 0 ? `${b.missingFxCount}건 환산 누락` : "")
    );
  }
  lines.push("");

  // Status 분포
  lines.push("[상태별 분포]");
  lines.push("도메인,상태,건수");
  for (const status of ["DRAFT", "SENT", "PAID"] as const) {
    lines.push(
      `Invoice,${csv(INVOICE_STATUS_LABEL_KR[status])},${
        agg.invoiceStatusBreakdown[status]
      }`
    );
  }
  for (const status of ["PENDING", "READY", "COMPLETED"] as const) {
    lines.push(
      `Settlement,${csv(SETTLEMENT_STATUS_LABEL_KR[status])},${
        agg.settlementStatusBreakdown[status]
      }`
    );
  }
  for (const status of ["PENDING", "READY", "ISSUED"] as const) {
    lines.push(
      `Tax,${csv(TAX_STATUS_LABEL_KR[status])},${
        agg.taxStatusBreakdown[status]
      }`
    );
  }

  // STEP 47 — Channel Mix (유입 채널 기준 운영 참고). channelMix가 null이면
  // 섹션 자체를 생략 (backward-compat — STEP 35.6 single-section 출력과 호환).
  if (agg.channelMix) {
    lines.push("");
    lines.push("[유입 채널 분포]");
    lines.push("유입 채널 기준 — 문의 / 거래 연결 신호 · 광고 성과 또는 매출 기여 확정과 무관");
    lines.push(
      `총 문의,${agg.channelMix.totalInquiryCount},총 고객 (derive),${agg.channelMix.totalCustomerCount},총 거래,${agg.channelMix.totalTransactionCount}`
    );
    if (agg.channelMix.unattributedTransactionCount > 0) {
      lines.push(
        `Attribution 불가 거래,${agg.channelMix.unattributedTransactionCount}건,비고,같은 작품 inquiry 부재`
      );
    }
    lines.push("채널,문의 수,inquiry 비중(%),고객 수,거래 수(first-touch)");
    for (const b of agg.channelMix.buckets) {
      lines.push(
        [
          INQUIRY_SOURCE_LABEL_KR[b.source],
          String(b.inquiryCount),
          b.inquiryShare.toFixed(1),
          String(b.customerCount),
          String(b.transactionCount),
        ]
          .map(csv)
          .join(",")
      );
    }
    if (agg.channelMix.topSources.length > 0) {
      lines.push(
        `상위 채널,${csv(
          agg.channelMix.topSources
            .map((s) => INQUIRY_SOURCE_LABEL_KR[s])
            .join(" · ")
        )}`
      );
    }
  }

  // Excel UTF-8 BOM 추가 (한글 깨짐 방지)
  const csvText = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, buildReportFilename("csv"));
}

function csv(value: string): string {
  if (value === "") return "";
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// PDF (HTML print pattern)
// ---------------------------------------------------------------------------

export function exportReportingAsPDF(
  agg: ReportingAggregates,
  ctx: ReportExportContext
): void {
  const html = buildReportingHTML(agg, ctx);
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

function buildReportingHTML(
  agg: ReportingAggregates,
  ctx: ReportExportContext
): string {
  const formatKRW = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

  const kpiRow = (
    label: string,
    value: number,
    count: number,
    note: string
  ) => `
    <tr>
      <td>${escapeHTML(label)}</td>
      <td class="num">${escapeHTML(formatKRW(value))}</td>
      <td class="num">${count}</td>
      <td class="muted small">${escapeHTML(note)}</td>
    </tr>
  `;

  const kpiHTML =
    kpiRow(
      "Total Sales",
      agg.totalSalesKRW,
      agg.totalSalesCount,
      agg.totalSalesCount > agg.convertibleInvoiceCount
        ? `${
            agg.totalSalesCount - agg.convertibleInvoiceCount
          }건 환산 정보 부족`
        : "총 매출 · KRW 환산"
    ) +
    kpiRow(
      "Settlement Total",
      agg.settlementTotalKRW,
      agg.settlementCount,
      agg.settlementMissingFxCount > 0
        ? `${agg.settlementMissingFxCount}건 환산 정보 부족`
        : "총 정산 · KRW 환산"
    ) +
    kpiRow(
      "Taxable Amount",
      agg.taxableAmountKRW,
      agg.taxRecordCount,
      agg.taxMissingFxCount > 0
        ? `${agg.taxMissingFxCount}건 환산 정보 부족`
        : "과세 표준액 · KRW 환산"
    ) +
    kpiRow(
      "FX Converted",
      agg.fxConvertedKRWTotal,
      agg.fxConvertedInvoiceCount,
      "외화 매출 · KRW 환산 합계"
    );

  const currencyHTML = agg.currencyBreakdown
    .map(
      (b) => `
        <tr>
          <td><span class="mono">${escapeHTML(b.currency)}</span></td>
          <td class="num">${b.count}</td>
          <td class="num">${escapeHTML(
            b.currency === "KRW"
              ? formatKRW(b.total)
              : `${b.currency} ${b.total.toLocaleString("en-US")}`
          )}</td>
          <td class="num">${
            b.convertedKRW !== null
              ? escapeHTML(formatKRW(b.convertedKRW))
              : `<span class="muted small">${b.missingFxCount}건 누락</span>`
          }</td>
        </tr>
      `
    )
    .join("");

  const statusRow = (
    domain: string,
    breakdown: Record<string, number>,
    labels: Record<string, string>,
    keys: string[]
  ) =>
    keys
      .map(
        (k) => `
        <tr>
          <td>${escapeHTML(domain)}</td>
          <td>${escapeHTML(labels[k] ?? k)}</td>
          <td class="num">${breakdown[k] ?? 0}</td>
        </tr>
      `
      )
      .join("");

  const statusHTML =
    statusRow("Invoice", agg.invoiceStatusBreakdown, INVOICE_STATUS_LABEL_KR, [
      "DRAFT",
      "SENT",
      "PAID",
    ]) +
    statusRow(
      "Settlement",
      agg.settlementStatusBreakdown,
      SETTLEMENT_STATUS_LABEL_KR,
      ["PENDING", "READY", "COMPLETED"]
    ) +
    statusRow("Tax", agg.taxStatusBreakdown, TAX_STATUS_LABEL_KR, [
      "PENDING",
      "READY",
      "ISSUED",
    ]);

  const mockBanner = agg.fxSourceIsMock
    ? `<p class="warn">⚠ 현재 FX provider는 mock 데이터입니다${
        agg.fxProviderId ? ` (${escapeHTML(agg.fxProviderId)})` : ""
      } — 실 환율과 차이가 있을 수 있습니다.</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>AXVELA — 운영 참고 리포트</title>
  <style>
    @page { margin: 16mm; }
    body {
      font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI",
        "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
      color: #1a1a1a; font-size: 11pt; line-height: 1.5; margin: 0; padding: 0;
    }
    h1 { font-size: 18pt; margin: 0 0 4mm; font-weight: 600; }
    h2 {
      font-size: 12pt; font-weight: 600; margin: 8mm 0 3mm;
      padding-bottom: 1.5mm; border-bottom: 1px solid #e5e5e5;
    }
    .meta { color: #6b6b6b; font-size: 10pt; margin-bottom: 6mm; }
    .meta div { margin: 0.5mm 0; }
    table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
    th, td {
      padding: 2mm 2.5mm; border-bottom: 1px solid #f0f0f0;
      vertical-align: middle; font-size: 10pt; text-align: left;
    }
    th {
      font-size: 9pt; font-weight: 600; color: #6b6b6b;
      text-transform: uppercase; letter-spacing: 0.04em;
      border-bottom: 1px solid #d0d0d0;
    }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: #6b6b6b; }
    .small { font-size: 9pt; }
    .mono { font-family: "JetBrains Mono", "SF Mono", Consolas, monospace; }
    .warn { color: #b45309; font-size: 10pt; margin: 3mm 0; }
    /* STEP 47 — Channel Mix bar (외부 차트 라이브러리 0개, CSS div only) */
    .channel-mix-table .bar-wrap {
      display: flex; align-items: center; gap: 2mm; min-width: 40mm;
    }
    .channel-mix-table .bar {
      flex: 1; height: 2mm; min-width: 0;
      background: #c8c8c8; border-radius: 1mm;
    }
    .channel-mix-table .bar-top { background: #1a1a1a; }
    .channel-mix-table .bar-label {
      flex-shrink: 0; min-width: 12mm; text-align: right;
      font-size: 8.5pt; color: #6b6b6b; font-variant-numeric: tabular-nums;
    }
    .channel-mix-table .badge {
      display: inline-block; margin-left: 2mm;
      padding: 0.3mm 1.5mm; border-radius: 4mm;
      border: 1px solid #1a1a1a; color: #1a1a1a;
      font-size: 7.5pt; vertical-align: middle;
    }
    .footnote {
      margin-top: 8mm; padding-top: 4mm; border-top: 1px dashed #d0d0d0;
      color: #6b6b6b; font-size: 9pt; line-height: 1.6;
    }
  </style>
</head>
<body>
  <h1>운영 참고 리포트</h1>
  <div class="meta">
    <div>생성 시각 · ${escapeHTML(formatNowKR())}</div>
    <div>기간 · ${escapeHTML(ctx.timeFilterLabel)}</div>
    <div>기준 · 내부 정산 기준 / FX snapshot 기준 (lock 시점)</div>
  </div>
  ${mockBanner}

  <h2>핵심 지표</h2>
  <table>
    <thead>
      <tr>
        <th>지표</th>
        <th class="num">KRW 환산 값</th>
        <th class="num">건수</th>
        <th>비고</th>
      </tr>
    </thead>
    <tbody>${kpiHTML}</tbody>
  </table>

  <h2>통화별 매출 분포</h2>
  <table>
    <thead>
      <tr>
        <th>통화</th>
        <th class="num">건수</th>
        <th class="num">통화 단위 합계</th>
        <th class="num">KRW 환산</th>
      </tr>
    </thead>
    <tbody>${currencyHTML}</tbody>
  </table>

  <h2>상태별 분포</h2>
  <table>
    <thead>
      <tr>
        <th>도메인</th>
        <th>상태</th>
        <th class="num">건수</th>
      </tr>
    </thead>
    <tbody>${statusHTML}</tbody>
  </table>

  ${buildChannelMixHTML(agg)}

  <div class="footnote">
    FX 환산은 각 인보이스의 lock 시점 환율 (Invoice.fxSnapshot)을 기준으로 합니다.
    Settlement / Tax는 해당 invoice의 환율을 propagate합니다.
    <br />
    본 리포트는 <strong>운영 참고용</strong>이며 회계 확정 / 세무 신고 권한 / 외부 보고와 무관합니다.
    ${
      agg.channelMix
        ? '<br /><strong>유입 채널 분포</strong>는 inquiry / transaction 연결 신호이며 광고 성과 또는 매출 기여 확정과 무관합니다.'
        : ''
    }
  </div>
</body>
</html>`;
}

// STEP 47 — Channel Mix HTML section builder. agg.channelMix가 null이면 빈
// 문자열 — 기존 PDF 구조와 backward-compat.
function buildChannelMixHTML(agg: ReportingAggregates): string {
  const c = agg.channelMix;
  if (!c) return "";
  if (c.totalInquiryCount === 0 && c.buckets.length === 0) {
    return `
      <h2>유입 채널 분포</h2>
      <p class="muted small">현재 기간에 inquiry / transaction 기록이 없습니다.</p>
    `;
  }
  const topSet = new Set(c.topSources);
  const rows = c.buckets
    .map((b) => {
      const isTop = topSet.has(b.source);
      const widthPct = Math.max(2, Math.min(100, b.inquiryShare));
      return `
        <tr>
          <td>
            ${escapeHTML(INQUIRY_SOURCE_LABEL_KR[b.source])}
            ${isTop ? '<span class="badge">TOP</span>' : ''}
          </td>
          <td>
            <div class="bar-wrap">
              <div class="bar ${isTop ? 'bar-top' : ''}" style="width: ${widthPct}%;"></div>
              <span class="bar-label">${b.inquiryShare.toFixed(1)}%</span>
            </div>
          </td>
          <td class="num">${b.inquiryCount}</td>
          <td class="num">${b.customerCount}</td>
          <td class="num">${b.transactionCount}</td>
        </tr>
      `;
    })
    .join("");

  const unattributedNote =
    c.unattributedTransactionCount > 0
      ? `<p class="muted small">※ ${c.unattributedTransactionCount}건의 거래는 같은 작품의 inquiry 부재로 채널 attribution 불가</p>`
      : "";

  const topLabel =
    c.topSources.length > 0
      ? `<p class="muted small">상위 채널 · ${escapeHTML(
          c.topSources.map((s) => INQUIRY_SOURCE_LABEL_KR[s]).join(" · ")
        )}</p>`
      : "";

  return `
    <h2>유입 채널 분포</h2>
    <p class="muted small">총 문의 ${c.totalInquiryCount}건 · 총 고객 (derive) ${c.totalCustomerCount}명 · 총 거래 ${c.totalTransactionCount}건 · first-touch 어트리뷰션 기준</p>
    <table class="channel-mix-table">
      <thead>
        <tr>
          <th>채널</th>
          <th>inquiry 비중</th>
          <th class="num">문의</th>
          <th class="num">고객</th>
          <th class="num">거래</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${unattributedNote}
    ${topLabel}
  `;
}

// ---------------------------------------------------------------------------
// Helpers (audit-export 패턴 차용)
// ---------------------------------------------------------------------------

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNowKR(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

export function exportReporting(
  format: ReportExportFormat,
  agg: ReportingAggregates,
  ctx: ReportExportContext
): void {
  if (format === "csv") {
    exportReportingAsCSV(agg, ctx);
  } else {
    exportReportingAsPDF(agg, ctx);
  }
}
