// ============================================================================
// Audit Log Export — STEP 25 (rule_4 trust layer 종착점)
//
// 클라이언트-only export. 백엔드 / 외부 API 호출 0줄. 외부 라이브러리 추가 0개.
//
// Format별 전략:
//   - JSON:  pretty-print Blob → URL.createObjectURL → <a download> 클릭
//   - CSV:   RFC 4180 quote escaping → Blob → 다운로드 (UTF-8 BOM 포함, Excel 한글 보존)
//   - PDF:   window.open() + 스타일 적용된 HTML + window.print() — 브라우저 native PDF
//            저장. 외부 PDF 라이브러리 없음. 사용자가 print 다이얼로그에서
//            "PDF로 저장" 선택. 가장 가벼우면서도 출력 품질 최고.
//
// 데이터:
//   - STEP 20 ClassifiedAuditEvent (domain / actorType / emphasis / version / chain)
//   - STEP 21 navigation chain detail (선택적 — chain summary만 한 줄로 압축)
//   - STEP 23 cross-artwork context (artwork title 표기)
//
// UX 문구 (사용자 spec 명시):
//   - "감사 로그 내보내기"
//   - "내부 기록 기반 Audit Report입니다."
//   - "법적/외부 제출 시 참고용으로 사용 가능합니다."
//   - 금지: "공식 증명서" / "법적 효력 보장"
// ============================================================================

import type { ClassifiedAuditEvent } from "./audit-helpers";
import type { Artwork } from "@/types/artwork";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ExportFormat = "json" | "csv" | "pdf";

export type ExportScope =
  | { kind: "single_artwork"; artworkId: string; artworkLabel: string }
  | { kind: "global" };

/**
 * Export 시 함께 전달되는 context — artwork lookup, chain summary 가공 등.
 * Drawer가 hydrate해서 export 함수에 전달.
 */
export interface ExportContext {
  /** artworkId → Artwork lookup (cross-artwork view에서 작품 라벨 매핑) */
  artworkById: Record<string, Artwork>;
  /** 추가 chain summary (entity → "v1 → v2" 형태). 선택적. */
  chainSummaryByEventId?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Filename helper
// ---------------------------------------------------------------------------

/**
 * 파일명 규칙 (사용자 spec):
 *   - axvela-audit-{artworkId}-{timestamp}.{ext}     (single)
 *   - axvela-audit-global-{timestamp}.{ext}          (global)
 *
 * timestamp는 파일명에 안전한 형식 (YYYYMMDD-HHMMSS), local time 기준.
 */
export function buildExportFilename(
  scope: ExportScope,
  format: ExportFormat
): string {
  const ts = nowFilenameSafe();
  const ext = format === "pdf" ? "pdf" : format;
  if (scope.kind === "global") {
    return `axvela-audit-global-${ts}.${ext}`;
  }
  return `axvela-audit-${scope.artworkId}-${ts}.${ext}`;
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
// Format helpers (shared)
// ---------------------------------------------------------------------------

function lookupArtworkLabel(
  ctx: ExportContext,
  artworkId: string,
  fallback?: string
): string {
  const a = ctx.artworkById[artworkId];
  if (!a) return fallback ?? artworkId;
  return `${a.title} · ${a.artist.name}`;
}

function chainSummaryFor(
  ctx: ExportContext,
  classified: ClassifiedAuditEvent
): string {
  // Priority 1: drawer가 미리 계산한 chain summary
  const pre = ctx.chainSummaryByEventId?.[classified.event.id];
  if (pre) return pre;
  // Priority 2: ClassifiedAuditEvent.chainHint (STEP 20 — "v1 → v2" / "원본 → 수정본")
  return classified.chainHint ?? "";
}

// ---------------------------------------------------------------------------
// JSON export
// ---------------------------------------------------------------------------

/**
 * JSON 출력 — raw TimelineEvent + classification + chain summary 모두 포함.
 * pretty-print (2-space indent). 외부 시스템 import / archive에 적합.
 */
export function exportAuditAsJSON(
  classified: ClassifiedAuditEvent[],
  scope: ExportScope,
  ctx: ExportContext
): void {
  const payload = {
    schema: "axvela.audit.v1",
    generatedAt: new Date().toISOString(),
    scope:
      scope.kind === "global"
        ? { kind: "global" as const, label: "갤러리 전체" }
        : {
            kind: "single_artwork" as const,
            artworkId: scope.artworkId,
            artworkLabel: scope.artworkLabel,
          },
    eventCount: classified.length,
    note:
      "내부 기록 기반 Audit Report입니다. 법적/외부 제출 시 참고용으로 사용 가능합니다.",
    events: classified.map((c) => ({
      // raw event
      id: c.event.id,
      artworkId: c.event.artworkId,
      artworkLabel: lookupArtworkLabel(ctx, c.event.artworkId),
      kind: c.event.kind,
      title: c.event.title,
      detail: c.event.detail ?? null,
      at: c.event.at,
      actor: c.event.actor ?? null,
      actorRole: c.event.actorRole ?? null,
      relatedEntityType: c.event.relatedEntityType ?? null,
      relatedEntityId: c.event.relatedEntityId ?? null,
      // classification (STEP 20)
      classification: {
        domain: c.domain,
        actorType: c.actorType,
        emphasis: c.emphasis,
        version: c.version,
        isCorrection: c.isCorrection,
        chainHint: c.chainHint,
      },
      chainSummary: chainSummaryFor(ctx, c) || null,
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  triggerDownload(blob, buildExportFilename(scope, "json"));
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/** RFC 4180 quote — 큰따옴표는 두 번 escape, 줄바꿈/콤마 포함 시 따옴표로 감쌈 */
function csvQuote(value: string): string {
  if (value === "") return "";
  const needs = /[",\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

const CSV_COLUMNS = [
  "time",
  "artworkId",
  "artworkTitle",
  "domain",
  "actor",
  "actorRole",
  "title",
  "detail",
  "version",
  "chain",
] as const;

/**
 * CSV 출력 — 사용자 spec column 순서 그대로. UTF-8 BOM (\\uFEFF) prepend —
 * Excel for Windows에서 한글 깨짐 방지.
 */
export function exportAuditAsCSV(
  classified: ClassifiedAuditEvent[],
  scope: ExportScope,
  ctx: ExportContext
): void {
  const rows: string[] = [];
  rows.push(CSV_COLUMNS.join(","));

  for (const c of classified) {
    const e = c.event;
    const a = ctx.artworkById[e.artworkId];
    rows.push(
      [
        csvQuote(e.at),
        csvQuote(e.artworkId),
        csvQuote(a ? `${a.title} · ${a.artist.name}` : ""),
        csvQuote(c.domain),
        csvQuote(e.actor ?? ""),
        csvQuote(e.actorRole ?? ""),
        csvQuote(e.title),
        csvQuote(e.detail ?? ""),
        csvQuote(c.version != null ? `v${c.version}` : ""),
        csvQuote(chainSummaryFor(ctx, c)),
      ].join(",")
    );
  }

  // BOM + CRLF (Excel 친화)
  const csv = "\uFEFF" + rows.join("\r\n") + "\r\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, buildExportFilename(scope, "csv"));
}

// ---------------------------------------------------------------------------
// PDF export — print API approach (외부 라이브러리 0)
// ---------------------------------------------------------------------------

/**
 * PDF 출력 — 새 창에 스타일된 HTML 리포트를 열고 `window.print()`를 자동 호출.
 * 사용자가 인쇄 다이얼로그에서 "PDF로 저장" 선택 → 브라우저 native PDF.
 * 외부 PDF 라이브러리 0개, 출력 품질은 브라우저 렌더링 그대로.
 *
 * Pop-up blocker가 차단할 수 있어 호출은 사용자 click 이벤트 직속이어야 함.
 */
export function exportAuditAsPDF(
  classified: ClassifiedAuditEvent[],
  scope: ExportScope,
  ctx: ExportContext
): void {
  const html = buildAuditReportHTML(classified, scope, ctx);
  const win = window.open("", "_blank");
  if (!win) {
    // 팝업 차단 시: data URL fallback — 현재 탭에 navigate 대신 alert
    // (UX는 Drawer 안 inline error로 대체 가능, 본 helper는 silent로 처리)
    window.alert(
      "PDF 인쇄 창을 열 수 없습니다. 팝업 차단을 해제하고 다시 시도해주세요."
    );
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();

  // 새 창의 onload 시점에 print 호출 — 한국어 폰트 / 이미지 로드 보장
  win.onload = () => {
    win.focus();
    win.print();
    // print 다이얼로그 종료 후 자동 close하지 않음 — 사용자가 "취소" 누른 경우
    // 다시 인쇄할 수 있게 창 유지. 사용자가 직접 close 가능.
  };
}

function buildAuditReportHTML(
  classified: ClassifiedAuditEvent[],
  scope: ExportScope,
  ctx: ExportContext
): string {
  const generatedAt = new Date().toISOString();
  const scopeLabel =
    scope.kind === "global" ? "갤러리 전체 (Global)" : scope.artworkLabel;

  const rowsHtml = classified
    .map((c) => {
      const e = c.event;
      const a = ctx.artworkById[e.artworkId];
      const artworkLabel = a
        ? `${escapeHTML(a.title)} · ${escapeHTML(a.artist.name)}`
        : escapeHTML(e.artworkId);
      const versionLabel = c.version != null ? `v${c.version}` : "";
      const chain = chainSummaryFor(ctx, c);
      const detail = e.detail ? escapeHTML(e.detail) : "";
      return `
        <tr>
          <td class="nowrap">${escapeHTML(formatDateTimeShort(e.at))}</td>
          <td>${scope.kind === "global" ? `<div class="muted small">${artworkLabel}</div>` : ""}<strong>${escapeHTML(e.title)}</strong>${detail ? `<div class="muted small">${detail}</div>` : ""}</td>
          <td class="nowrap">${escapeHTML(domainLabel(c.domain))}</td>
          <td class="nowrap">${escapeHTML(e.actor ?? "")}${e.actorRole ? `<div class="muted small">${escapeHTML(e.actorRole)}</div>` : ""}</td>
          <td class="nowrap">${escapeHTML(versionLabel)}${chain ? `<div class="muted small">${escapeHTML(chain)}</div>` : ""}</td>
        </tr>
      `;
    })
    .join("");

  const emptyHtml =
    classified.length === 0
      ? `<tr><td colspan="5" class="empty">표시할 이벤트가 없습니다.</td></tr>`
      : "";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>AXVELA Audit Report — ${escapeHTML(scopeLabel)}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
      color: #1a1a1a;
      line-height: 1.45;
      margin: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    header { border-bottom: 1.5pt solid #1a1a1a; padding-bottom: 4mm; margin-bottom: 6mm; }
    h1 { font-size: 16pt; margin: 0 0 2mm; letter-spacing: -0.01em; font-weight: 700; }
    .scope { font-size: 11pt; color: #444; margin: 0 0 2mm; }
    .meta { font-size: 8.5pt; color: #888; }
    .meta strong { color: #444; font-weight: 500; }
    .summary { margin: 4mm 0 6mm; font-size: 9pt; color: #555; }
    .summary span { display: inline-block; margin-right: 6mm; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    thead th { text-align: left; border-bottom: 1pt solid #333; padding: 2mm 2mm; font-weight: 600; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; color: #444; background: #f5f5f5; }
    tbody td { border-bottom: 0.5pt solid #ddd; padding: 2mm 2mm; vertical-align: top; }
    tbody tr:nth-child(even) { background: #fafafa; }
    .nowrap { white-space: nowrap; }
    .muted { color: #777; }
    .small { font-size: 8pt; margin-top: 0.5mm; }
    .empty { text-align: center; color: #999; padding: 8mm; font-style: italic; }
    footer { margin-top: 8mm; padding-top: 3mm; border-top: 0.5pt solid #ccc; font-size: 8pt; color: #777; line-height: 1.6; }
    footer .disclaimer { font-style: italic; }
    @media print {
      body { font-size: 9pt; }
    }
  </style>
</head>
<body>
  <header>
    <h1>AXVELA Audit Report</h1>
    <p class="scope">${escapeHTML(scopeLabel)}</p>
    <p class="meta">생성: <strong>${escapeHTML(formatDateTimeFull(generatedAt))}</strong> · 이벤트 ${classified.length}건</p>
  </header>
  <div class="summary">
    <span>총 이벤트: <strong>${classified.length}</strong>건</span>
    ${scope.kind === "global" ? `<span>작품: <strong>${countDistinctArtworks(classified)}</strong>점</span>` : ""}
    <span>도메인 분포: <strong>${escapeHTML(formatDomainDistribution(classified))}</strong></span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 26mm">시각</th>
        <th>이벤트</th>
        <th style="width: 22mm">도메인</th>
        <th style="width: 28mm">작성자</th>
        <th style="width: 22mm">버전 / 체인</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      ${emptyHtml}
    </tbody>
  </table>
  <footer>
    <p class="disclaimer">내부 기록 기반 Audit Report입니다. 법적/외부 제출 시 참고용으로 사용 가능합니다.</p>
    <p>AXVELA Gallery OS · 본 문서는 ${escapeHTML(generatedAt)} 기준으로 생성된 스냅샷입니다. 이후 시스템 변경은 반영되지 않습니다.</p>
  </footer>
  <script>
    // 일부 브라우저는 onload 전에 폰트가 로드되지 않을 수 있어 fallback 1초 지연
    window.addEventListener("load", function() {
      setTimeout(function() { try { window.focus(); window.print(); } catch (e) {} }, 100);
    });
  </script>
</body>
</html>`;
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTimeShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTimeFull(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function domainLabel(d: ClassifiedAuditEvent["domain"]): string {
  switch (d) {
    case "AI": return "AI";
    case "DOCUMENT": return "문서";
    case "MONEY": return "정산·결제·세무";
    case "LOGISTICS": return "물류";
    case "INQUIRY": return "문의·응대";
    case "TRANSACTION": return "거래";
    case "STATE": return "상태 전환";
    case "NOTE": return "기록";
    default: return d;
  }
}

function countDistinctArtworks(classified: ClassifiedAuditEvent[]): number {
  const set = new Set<string>();
  for (const c of classified) set.add(c.event.artworkId);
  return set.size;
}

function formatDomainDistribution(classified: ClassifiedAuditEvent[]): string {
  const counts: Record<string, number> = {};
  for (const c of classified) counts[c.domain] = (counts[c.domain] ?? 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.map(([d, n]) => `${domainLabel(d as ClassifiedAuditEvent["domain"])} ${n}`).join(" · ");
}

// ---------------------------------------------------------------------------
// Download trigger (shared between JSON / CSV)
// ---------------------------------------------------------------------------

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // Safari 호환: DOM에 attach 후 click
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 비동기 cleanup — 다운로드 시작 직후 revoke 시 일부 브라우저에서 실패 가능
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Public dispatcher — Drawer가 단일 진입점으로 호출
// ---------------------------------------------------------------------------

export function exportAuditLog(
  format: ExportFormat,
  classified: ClassifiedAuditEvent[],
  scope: ExportScope,
  ctx: ExportContext
): void {
  switch (format) {
    case "json":
      exportAuditAsJSON(classified, scope, ctx);
      return;
    case "csv":
      exportAuditAsCSV(classified, scope, ctx);
      return;
    case "pdf":
      exportAuditAsPDF(classified, scope, ctx);
      return;
    default: {
      const _exhaustive: never = format;
      void _exhaustive;
    }
  }
}
