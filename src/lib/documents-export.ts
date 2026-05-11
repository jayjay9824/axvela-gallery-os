// ============================================================================
// Documents Export — STEP 51 (list-only CSV / PDF).
//
// 사용자 spec 명시 (3): 본 STEP은 list export만 — 개별 PDF ZIP 다운로드는
// 후속 STEP으로 분리. STEP 25 / 35.6 / 44 / 46 / 47 패턴 일관.
//
// **표현 정책:**
//   - "운영 참고 리스트" / "검색 결과 export"
//   - "법적 효력" / "회계 확정" 표현 0건
// ============================================================================

import type {
  DocumentRow,
  DocumentDomain,
  DocumentStatusFilter,
} from "./documents-aggregates";
import {
  DOCUMENT_DOMAIN_LABEL_KR,
  DOCUMENT_STATUS_FILTER_LABEL_KR,
} from "./documents-aggregates";

export type DocumentsExportFormat = "csv" | "pdf";

export interface DocumentsExportContext {
  /** 사용자에게 표시할 필터 요약 — "전체 · 이번 달 · 검색: 김민지" */
  filterLabel: string;
  /** 표시 시점 (ISO datetime) — header에 한국어로 표기 */
  generatedAt: string;
  /** 도메인별 카운트 — header summary 표시용 */
  totalCountByDomain: Record<DocumentDomain, number>;
  filteredCountByDomain: Record<DocumentDomain, number>;
  /** 적용된 status 필터 — disclaimer 강화용 */
  statusFilter: DocumentStatusFilter;
}

export function buildDocumentsFilename(
  format: DocumentsExportFormat,
  generatedAt: string
): string {
  // YYYY-MM-DD-HHMM compact stamp
  const d = new Date(generatedAt);
  const stamp = Number.isNaN(d.getTime())
    ? "unknown"
    : `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
  return `axvela-documents-${stamp}.${format}`;
}

export function exportDocuments(
  format: DocumentsExportFormat,
  rows: DocumentRow[],
  ctx: DocumentsExportContext
): void {
  if (format === "csv") return exportAsCSV(rows, ctx);
  if (format === "pdf") return exportAsPDF(rows, ctx);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function exportAsCSV(rows: DocumentRow[], ctx: DocumentsExportContext): void {
  const lines: string[] = [];

  // Metadata header (5 lines)
  lines.push(`# AXVELA Documents Hub — ${csv(ctx.filterLabel)}`);
  lines.push(`# 생성 시각,${csv(formatHumanDate(ctx.generatedAt))}`);
  lines.push(
    `# 상태 필터,${csv(DOCUMENT_STATUS_FILTER_LABEL_KR[ctx.statusFilter])}`
  );
  lines.push(
    `# 도메인 카운트 (필터/전체)`
  );
  for (const d of ["INVOICE", "CONTRACT", "TAX", "CONDITION_REPORT"] as const) {
    lines.push(
      `# ${csv(DOCUMENT_DOMAIN_LABEL_KR[d])},${ctx.filteredCountByDomain[d]} / ${ctx.totalCountByDomain[d]}`
    );
  }
  lines.push("");

  // Disclaimer
  lines.push(
    "# 운영 참고 리스트 — 본 export는 검색 결과 요약이며 회계 확정 / 법적 효력과 무관합니다."
  );
  lines.push("");

  // Body — 11 columns
  const headers = [
    "도메인",
    "상태",
    "AXID",
    "작품",
    "작가",
    "주요일자",
    "일자종류",
    "금액",
    "버전",
    "비고",
    "ID",
  ];
  lines.push(headers.map(csv).join(","));

  for (const r of rows) {
    lines.push(
      [
        r.domainLabel,
        r.statusLabel + (r.isLocked ? " · LOCK" : ""),
        r.artworkAxidCode,
        r.artworkTitle,
        r.artistName,
        formatHumanDate(r.primaryDate),
        r.primaryDateLabel,
        r.amountLabel ?? "—",
        r.versionLabel ?? "—",
        r.detailLabel ?? "—",
        r.entityId,
      ]
        .map(csv)
        .join(",")
    );
  }

  const filename = buildDocumentsFilename("csv", ctx.generatedAt);
  // RFC 4180 — CRLF + UTF-8 BOM (Excel 한글 호환)
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(blob, filename);
}

// ---------------------------------------------------------------------------
// PDF (window.print 기반)
// ---------------------------------------------------------------------------

function exportAsPDF(rows: DocumentRow[], ctx: DocumentsExportContext): void {
  const html = buildPDFHTML(rows, ctx);
  const win = window.open("", "_blank");
  if (!win) {
    // popup 차단 fallback — 사용자에게 알리는 alert
    alert(
      "팝업이 차단되어 PDF export가 실행되지 않았습니다. 팝업 허용 후 다시 시도해주세요."
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

function buildPDFHTML(
  rows: DocumentRow[],
  ctx: DocumentsExportContext
): string {
  const summaryCards = (["INVOICE", "CONTRACT", "TAX", "CONDITION_REPORT"] as const)
    .map((d) => {
      const total = ctx.totalCountByDomain[d];
      const filtered = ctx.filteredCountByDomain[d];
      return `
        <div class="summary-card">
          <span class="label">${escapeHTML(DOCUMENT_DOMAIN_LABEL_KR[d])}</span>
          <span class="value">${filtered}<span class="muted"> / ${total}</span></span>
        </div>`;
    })
    .join("");

  const tbody = rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHTML(r.domainLabel)}</td>
        <td>
          ${escapeHTML(r.statusLabel)}
          ${r.isLocked ? '<span class="badge">LOCK</span>' : ""}
        </td>
        <td class="mono">${escapeHTML(r.artworkAxidCode)}</td>
        <td>${escapeHTML(r.artworkTitle)}</td>
        <td class="muted">${escapeHTML(r.artistName)}</td>
        <td class="num">${escapeHTML(formatHumanDate(r.primaryDate))}</td>
        <td class="muted small">${escapeHTML(r.primaryDateLabel)}</td>
        <td class="num">${escapeHTML(r.amountLabel ?? "—")}</td>
        <td class="muted small">${escapeHTML(r.versionLabel ?? r.detailLabel ?? "—")}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>AXVELA Documents — ${escapeHTML(ctx.filterLabel)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
      color: #1a1a1a; font-size: 10pt; line-height: 1.55;
    }
    h1 { font-size: 16pt; margin: 0 0 1mm; letter-spacing: -0.01em; }
    .meta { font-size: 9pt; color: #6b6b6b; margin-bottom: 6mm; }
    .summary {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm;
      margin: 4mm 0 6mm;
    }
    .summary-card {
      border: 1px solid #d8d8d8; border-radius: 2mm;
      padding: 3mm; display: flex; flex-direction: column; gap: 1mm;
    }
    .summary-card .label {
      font-size: 8pt; color: #6b6b6b; text-transform: uppercase;
      letter-spacing: 0.05em; font-weight: 600;
    }
    .summary-card .value {
      font-size: 13pt; font-weight: 600; font-variant-numeric: tabular-nums;
    }
    .summary-card .value .muted { font-weight: 400; color: #9b9b9b; font-size: 11pt; }
    table {
      width: 100%; border-collapse: collapse; font-size: 8.5pt;
    }
    thead th {
      text-align: left; border-bottom: 1px solid #1a1a1a;
      padding: 2mm 1.5mm; font-weight: 600; text-transform: uppercase;
      font-size: 7.5pt; letter-spacing: 0.04em;
    }
    tbody td {
      padding: 1.8mm 1.5mm; border-bottom: 1px solid #ececec;
      vertical-align: top;
    }
    .mono { font-family: "JetBrains Mono", "SF Mono", Consolas, monospace; }
    .num { font-variant-numeric: tabular-nums; }
    .muted { color: #6b6b6b; }
    .small { font-size: 7.5pt; }
    .badge {
      display: inline-block; margin-left: 1.5mm;
      padding: 0.3mm 1.2mm; border: 1px solid #1a1a1a; border-radius: 4mm;
      font-size: 6.5pt; vertical-align: middle;
    }
    .footnote {
      margin-top: 6mm; padding-top: 3mm; border-top: 1px solid #d8d8d8;
      font-size: 8pt; color: #6b6b6b; line-height: 1.6;
    }
  </style>
</head>
<body>
  <h1>AXVELA Documents Hub</h1>
  <div class="meta">
    ${escapeHTML(ctx.filterLabel)} · 생성 ${escapeHTML(formatHumanDate(ctx.generatedAt))}
    · 상태 ${escapeHTML(DOCUMENT_STATUS_FILTER_LABEL_KR[ctx.statusFilter])}
    · 총 ${rows.length}건
  </div>

  <div class="summary">${summaryCards}</div>

  <table>
    <thead>
      <tr>
        <th>도메인</th>
        <th>상태</th>
        <th>AXID</th>
        <th>작품</th>
        <th>작가</th>
        <th>주요일자</th>
        <th>일자종류</th>
        <th>금액</th>
        <th>버전 / 비고</th>
      </tr>
    </thead>
    <tbody>${tbody}</tbody>
  </table>

  <div class="footnote">
    본 리스트는 <strong>운영 참고용</strong>이며 회계 확정 / 세무 신고 / 외부 보고 / 법적 효력과 무관합니다.<br/>
    각 문서의 원본은 작품 상세 패널(rule_1 Artwork-First) 또는 본 Hub의 행 클릭으로 접근할 수 있습니다.
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function csv(s: string): string {
  if (s == null) return "";
  const needsQuote = /[",\r\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatHumanDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

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
