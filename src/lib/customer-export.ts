// ============================================================================
// Customer Export — STEP 44.
//
// CSV / PDF 내보내기. STEP 25 audit-export.ts / STEP 35.6 reporting-export.ts
// 패턴 재활용 (triggerDownload / window.print HTML / escape helpers /
// UTF-8 BOM / RFC 4180 quote escape).
//
// **외부 라이브러리 0개 · 백엔드 0건 · 외부 API 호출 0건 · 도메인 로직 0줄
// 변경 · 신규 store slice 0개**. Customer 데이터는 derive 결과를 그대로 받아
// CSV/PDF로 직렬화만.
//
// 표현 정책 (사용자 spec 엄격 준수):
//   - "확정 고객 등급" / "신용 평가" / "법적 효력" / "VIP" / "골드/실버" 표현
//     절대 금지 (오직 disclaimer의 부정형 표현으로만 등장)
//   - "운영 참고용" / "Inquiry / Transaction에서 자동 derive" 사용
//   - mock name / email 그대로 직렬화 (transform 0)
// ============================================================================

import type { Customer } from "@/types/customer";
import {
  CUSTOMER_KIND_LABEL_KR,
  CUSTOMER_SEGMENT_LABEL_KR,
  CUSTOMER_SIGNAL_LABEL_KR,
  INQUIRY_SOURCE_LABEL_KR,
  formatCustomerKRW,
} from "@/lib/customer-aggregates";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CustomerExportFormat = "csv" | "pdf";

/**
 * Export 시점에 UI에서 전달되는 필터 컨텍스트. 라벨은 표시용으로만 사용,
 * 실제 데이터는 호출자가 이미 필터링한 `customers` 배열로 전달.
 */
export interface CustomerExportContext {
  /** 현재 segment + search 조합을 사람이 읽을 수 있는 형태로. */
  filterLabel: string;
  /** 전체 customer 수 (필터 전). */
  totalCount: number;
  /** 필터 적용 결과 수 (= customers.length, 가독성용 중복 보관). */
  filteredCount: number;
}

// ---------------------------------------------------------------------------
// Filename
// ---------------------------------------------------------------------------

export function buildCustomerFilename(format: CustomerExportFormat): string {
  return `axvela-customers-${nowFilenameSafe()}.${format}`;
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

/**
 * Excel-friendly CSV. UTF-8 BOM prepend (한글 깨짐 방지) + CRLF 라인 종결 +
 * RFC 4180 quote escape.
 */
export function exportCustomersAsCSV(
  customers: Customer[],
  ctx: CustomerExportContext
): void {
  const lines: string[] = [];

  // Metadata header — column header 위 5줄
  lines.push("Customer 운영 참고 — 컬렉터 / 매수자 derive view");
  lines.push(
    "Inquiry / Transaction에서 자동 derive — 확정 고객 등급 또는 영구 마스터 데이터 아닙니다"
  );
  lines.push(`생성 시각,${csv(formatNowKR())}`);
  lines.push(`필터,${csv(ctx.filterLabel)}`);
  lines.push(`결과,${csv(`${ctx.filteredCount} / ${ctx.totalCount}명`)}`);
  lines.push(""); // blank separator

  // Column header
  lines.push(
    [
      "이름",
      "대표 연락처",
      "추가 연락처 수",
      "Segment",
      "Kind",
      "거래 수",
      "문의 수",
      "보유 작품 수",
      "누적 매입 KRW",
      "환산 정보 부족 건수",
      "진행 중 거래",
      "진행 중 문의",
      "첫 활동",
      "마지막 활동",
      "주요 채널",
      "운영 참고 신호",
    ]
      .map(csv)
      .join(",")
  );

  // Rows
  for (const c of customers) {
    const additionalContacts = Math.max(0, c.allContacts.length - 1);
    const signals = c.signals
      .map((s) => CUSTOMER_SIGNAL_LABEL_KR[s])
      .join("; ");
    const channel = c.primarySource
      ? INQUIRY_SOURCE_LABEL_KR[c.primarySource]
      : "";
    lines.push(
      [
        c.displayName,
        c.primaryContact,
        String(additionalContacts),
        CUSTOMER_SEGMENT_LABEL_KR[c.segment],
        CUSTOMER_KIND_LABEL_KR[c.kind],
        String(c.transactionIds.length),
        String(c.inquiryIds.length),
        String(c.ownedArtworkIds.length),
        String(c.totalPurchaseKRW),
        String(c.missingFxCount),
        String(c.activeTransactionCount),
        String(c.activeInquiryCount),
        c.firstInteractionAt.slice(0, 10),
        c.lastInteractionAt.slice(0, 10),
        channel,
        signals,
      ]
        .map(csv)
        .join(",")
    );
  }

  // UTF-8 BOM prepend + CRLF lines (Excel for Windows 한글 깨짐 방지)
  const body = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, buildCustomerFilename("csv"));
}

/** RFC 4180 escape — `"`, `,`, `\r`, `\n` 포함 시 큰따옴표로 감싸고 내부 `"` 이중화. */
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

export function exportCustomersAsPDF(
  customers: Customer[],
  ctx: CustomerExportContext
): void {
  const html = buildCustomersHTML(customers, ctx);
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

function buildCustomersHTML(
  customers: Customer[],
  ctx: CustomerExportContext
): string {
  const summaryHTML = buildSummaryHTML(customers);
  const tableHTML = buildTableHTML(customers);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>AXVELA Customer 운영 참고</title>
  <style>
    @page { size: A4; margin: 16mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
      font-size: 10pt; line-height: 1.5; color: #1a1a1a;
    }
    h1 { font-size: 14pt; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 2mm 0; }
    h2 { font-size: 11pt; font-weight: 600; margin: 6mm 0 2mm 0; letter-spacing: -0.01em; }
    .meta { color: #6b6b6b; font-size: 9pt; margin-bottom: 4mm; }
    .meta div { margin: 0.5mm 0; }
    table { width: 100%; border-collapse: collapse; margin: 0; }
    th, td {
      border-bottom: 1px solid #e5e5e5;
      padding: 1.5mm 2mm;
      text-align: left;
      vertical-align: top;
      font-size: 8.5pt;
    }
    th {
      font-weight: 600;
      color: #4a4a4a;
      border-bottom: 1.5px solid #b8b8b8;
      background: #fafafa;
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: #777; }
    .small { font-size: 8pt; }
    .mono { font-family: "JetBrains Mono", "SF Mono", Consolas, monospace; }
    .footnote {
      margin-top: 8mm; padding-top: 4mm; border-top: 1px dashed #d0d0d0;
      color: #6b6b6b; font-size: 9pt; line-height: 1.6;
    }
    .summary {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 2mm; margin-bottom: 4mm;
    }
    .stat {
      border: 1px solid #e5e5e5; border-radius: 1.5mm;
      padding: 2mm 3mm;
    }
    .stat-label {
      font-size: 7.5pt; color: #6b6b6b;
      text-transform: uppercase; letter-spacing: 0.06em;
    }
    .stat-value { font-size: 12pt; font-weight: 500; margin-top: 0.5mm; }
    .stat-hint { font-size: 7.5pt; color: #999; margin-top: 0.5mm; }
    .signals { font-size: 7.5pt; color: #4a4a4a; }
    .empty {
      padding: 6mm; text-align: center; color: #999;
      border: 1px dashed #d0d0d0; border-radius: 2mm;
    }
  </style>
</head>
<body>
  <h1>Customer 운영 참고</h1>
  <div class="meta">
    <div>생성 시각 · ${escapeHTML(formatNowKR())}</div>
    <div>필터 · ${escapeHTML(ctx.filterLabel)}</div>
    <div>결과 · ${ctx.filteredCount} / ${ctx.totalCount}명</div>
    <div>기준 · Inquiry / Transaction에서 자동 derive · 매 생성 시점 재계산</div>
  </div>

  ${summaryHTML}

  <h2>고객 목록</h2>
  ${tableHTML}

  <div class="footnote">
    본 리포트의 segment / kind / 운영 참고 신호는 거래 / 문의 활동에서
    자동 derive되는 휴리스틱 분류입니다. 누적 매입 KRW는 외화 거래의 경우
    Invoice의 lock 시점 환율 (fxSnapshot) 을 기준으로 환산됩니다.
    환산 정보가 부재한 거래는 합산에서 제외되며 별도 카운터로 명시됩니다.
    <br />
    본 리포트는 <strong>운영 참고용</strong>이며 확정 고객 등급 / 신용 평가 /
    법적 효력과 무관합니다.
  </div>
</body>
</html>`;
}

function buildSummaryHTML(customers: Customer[]): string {
  if (customers.length === 0) return "";

  // 단순 합계 — 새 핵심 계산 로직 0개. 이미 derive된 결과 단순 합산.
  let totalKRW = 0;
  let totalMissingFx = 0;
  let activeInquiry = 0;
  let activeTx = 0;
  for (const c of customers) {
    totalKRW += c.totalPurchaseKRW;
    totalMissingFx += c.missingFxCount;
    activeInquiry += c.activeInquiryCount;
    activeTx += c.activeTransactionCount;
  }

  const stat = (label: string, value: string, hint: string) => `
    <div class="stat">
      <div class="stat-label">${escapeHTML(label)}</div>
      <div class="stat-value">${escapeHTML(value)}</div>
      <div class="stat-hint">${escapeHTML(hint)}</div>
    </div>
  `;

  return `
    <h2>요약</h2>
    <div class="summary">
      ${stat("고객 수", `${customers.length}명`, "필터 적용 결과")}
      ${stat(
        "누적 매입 KRW",
        formatCustomerKRW(totalKRW),
        totalMissingFx > 0
          ? `${totalMissingFx}건 환산 정보 부족`
          : "환산 정보 완비"
      )}
      ${stat("진행 중 거래", `${activeTx}건`, "협상 / 합의 단계")}
      ${stat("진행 중 문의", `${activeInquiry}건`, "응대 대기 / 진행")}
    </div>
  `;
}

function buildTableHTML(customers: Customer[]): string {
  if (customers.length === 0) {
    return `<div class="empty">필터 결과 없음 — 내보낼 고객 데이터가 없습니다.</div>`;
  }

  const rows = customers
    .map((c) => {
      const additional =
        c.allContacts.length > 1
          ? ` <span class="muted small">(+${c.allContacts.length - 1})</span>`
          : "";
      const signals = c.signals
        .map((s) => CUSTOMER_SIGNAL_LABEL_KR[s])
        .join(", ");
      const channel = c.primarySource
        ? INQUIRY_SOURCE_LABEL_KR[c.primarySource]
        : "";
      const krwCell =
        c.missingFxCount > 0
          ? `${escapeHTML(formatCustomerKRW(c.totalPurchaseKRW))} <span class="muted small">(${c.missingFxCount}건 환산 부족)</span>`
          : escapeHTML(formatCustomerKRW(c.totalPurchaseKRW));
      return `
        <tr>
          <td>
            <div>${escapeHTML(c.displayName)}</div>
            <div class="muted small mono">${escapeHTML(c.primaryContact)}${additional}</div>
          </td>
          <td>${escapeHTML(CUSTOMER_SEGMENT_LABEL_KR[c.segment])}<div class="muted small">${escapeHTML(CUSTOMER_KIND_LABEL_KR[c.kind])}</div></td>
          <td class="num">${c.transactionIds.length}</td>
          <td class="num">${c.inquiryIds.length}</td>
          <td class="num">${c.ownedArtworkIds.length}</td>
          <td class="num">${krwCell}</td>
          <td>${escapeHTML(c.lastInteractionAt.slice(0, 10) || "—")}<div class="muted small">최초 ${escapeHTML(c.firstInteractionAt.slice(0, 10) || "—")}</div></td>
          <td>${escapeHTML(channel)}</td>
          <td class="signals">${escapeHTML(signals)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table>
      <thead>
        <tr>
          <th>고객</th>
          <th>Segment</th>
          <th class="num">거래</th>
          <th class="num">문의</th>
          <th class="num">보유</th>
          <th class="num">누적 매입 KRW</th>
          <th>마지막 활동</th>
          <th>채널</th>
          <th>운영 참고 신호</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// Helpers (audit-export / reporting-export 패턴 재사용)
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

export function exportCustomers(
  format: CustomerExportFormat,
  customers: Customer[],
  ctx: CustomerExportContext
): void {
  if (format === "csv") {
    exportCustomersAsCSV(customers, ctx);
  } else {
    exportCustomersAsPDF(customers, ctx);
  }
}
