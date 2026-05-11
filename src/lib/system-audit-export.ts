// ============================================================================
// System Audit Export — STEP 83.
//
// device-local SystemAuditEvent 데이터를 운영 참고용 export snapshot으로
// 반출. STEP 65 system-level audit과 STEP 78 audit drilldown 위에서
// portability layer 정착. STEP 25 artwork-scoped audit-export.ts와는 별개
// 모듈 — SystemAuditEvent (artworkId 부재) 와 TimelineEvent (artworkId 필수)
// 분리 정책 일관 (STEP 65 핵심 설계).
//
// **출력 format**:
//   - CSV : RFC 4180 quote escape + UTF-8 BOM (Excel 한글 호환) + CRLF
//           + 5-row metadata header (exportedAt / category / severity /
//             timeRange / totalEvents) + disclaimer 1줄
//   - JSON: 2-space pretty print, `{ metadata, filters, events }` shape.
//           events는 SystemAuditEvent 그대로 (raw record — 향후 import 가능
//           구조이지만 본 STEP에서는 *export only*, 운영 참고용 스냅샷).
//
// **What you see is what you export 정책 (사용자 spec)**:
//   현재 AuditLogViewerDrawer에 적용된 필터(category / severity)를 그대로
//   inherit. 향후 viewer에 timeRange / search 가 추가되면 본 export가 자연
//   호환 (context 필드 옵셔널).
//
// **표현 정책 (사용자 spec STEP 83)**:
//   - 사용: "운영 참고" / "device-local" / "audit event" / "export snapshot"
//   - 금지: "법적 감사 기록" / "certified audit" / "tamper-proof" /
//     "compliance guaranteed" / "forensic evidence"
//   - 모든 disclaimer는 부정형 only (\"~과 무관합니다\") — 보장 표현 0건.
//
// **제약 (사용자 spec)**:
//   - 신규 라이브러리 0개 (Blob / URL.createObjectURL / DOM trigger only)
//   - SystemAuditEvent schema 변경 0줄
//   - appendAuditEvent 변경 0줄
//   - Persistence schema 변경 0줄
//   - Backend / 외부 API 호출 0건
// ============================================================================

import {
  AUDIT_CATEGORY_LABEL_KR,
  AUDIT_SEVERITY_LABEL_KR,
  type AuditCategory,
  type AuditSeverity,
  type SystemAuditEvent,
} from "@/types/audit-event";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SystemAuditExportFormat = "csv" | "json";

/**
 * Export 시점에 viewer가 적용 중이던 필터 상태. \"all\"은 미적용.
 * 호출자가 viewer state에서 그대로 매핑하여 전달.
 */
export interface SystemAuditExportFilters {
  category: AuditCategory | "all";
  severity: AuditSeverity | "all";
  /** 향후 timeRange filter 추가 시 viewer가 채움. 현재는 항상 null. */
  timeRange?: { fromIso: string; toIso: string } | null;
  /** 향후 search 추가 시 viewer가 채움. 현재는 항상 undefined. */
  searchQuery?: string;
}

export interface SystemAuditExportContext {
  /** ISO timestamp — export 호출 시 호출자가 채움 (`new Date().toISOString()`) */
  generatedAt: string;
  /** Viewer가 그대로 노출 중이던 필터 상태 — \"What you see is what you export\" */
  filters: SystemAuditExportFilters;
  /**
   * 전체 audit event 카운트 (필터 무관) — metadata 표기용.
   * 사용자가 \"필터 적용 후 N건 export · 전체 M건 보유\" 컨텍스트 인지 가능.
   */
  totalEventCount: number;
}

// ---------------------------------------------------------------------------
// Filename helper
// ---------------------------------------------------------------------------

export function buildSystemAuditFilename(
  format: SystemAuditExportFormat,
  generatedAt: string
): string {
  const d = new Date(generatedAt);
  const stamp = Number.isNaN(d.getTime())
    ? "unknown"
    : `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
  return `axvela-audit-${stamp}.${format}`;
}

// ---------------------------------------------------------------------------
// Public — single dispatcher
// ---------------------------------------------------------------------------

/**
 * 운영 감사 로그 export. format에 따라 CSV / JSON 분기.
 *
 * **결과 없음 (events.length === 0) 일 때 silent no-op** — 호출자(footer button)
 * 가 disabled로 사전 차단하므로 본 함수 진입은 정상적으로 events.length > 0.
 * 안전 가드로 빈 배열 케이스도 graceful 처리 — 빈 파일 다운로드 가능 (운영자가
 * \"필터 후 0건임\"을 파일로 받아도 의미 있음).
 */
export function exportSystemAudit(
  format: SystemAuditExportFormat,
  events: ReadonlyArray<SystemAuditEvent>,
  ctx: SystemAuditExportContext
): void {
  if (format === "csv") {
    exportAsCSV(events, ctx);
  } else {
    exportAsJSON(events, ctx);
  }
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const CSV_HEADER_COLUMNS = [
  "createdAt",
  "category",
  "severity",
  "action",
  "message",
  "actorRole",
  "targetType",
  "targetRef",
] as const;

function exportAsCSV(
  events: ReadonlyArray<SystemAuditEvent>,
  ctx: SystemAuditExportContext
): void {
  const lines: string[] = [];

  // ── metadata header — 5 rows + disclaimer (사용자 spec section 4 매칭) ──
  lines.push(`# AXVELA 운영 감사 로그 export`);
  lines.push(`# exportedAt,${csv(formatHumanDate(ctx.generatedAt))}`);
  lines.push(`# category,${csv(filterLabelCategory(ctx.filters.category))}`);
  lines.push(`# severity,${csv(filterLabelSeverity(ctx.filters.severity))}`);
  lines.push(`# timeRange,${csv(filterLabelTimeRange(ctx.filters.timeRange))}`);
  lines.push(
    `# totalEvents,${events.length} / 전체 ${ctx.totalEventCount}`
  );
  // 부정형 disclaimer — 결과 보장 / 법적 효력 표현 0건
  lines.push(
    `# 운영 참고용 — device-local 기록 · 회계 확정 / 외부 신고 / 법적 효력과 무관합니다.`
  );
  // 빈 줄 — Excel에서 metadata 영역과 데이터 영역 시각 분리
  lines.push(``);

  // ── column header ──
  lines.push(CSV_HEADER_COLUMNS.join(","));

  // ── data rows ──
  for (const e of events) {
    const row = [
      e.createdAt,
      AUDIT_CATEGORY_LABEL_KR[e.category as AuditCategory] ?? e.category,
      AUDIT_SEVERITY_LABEL_KR[e.severity] ?? e.severity,
      e.action,
      e.message,
      e.actorRole,
      e.targetType ?? "",
      e.targetRef ?? "",
    ];
    lines.push(row.map(csv).join(","));
  }

  const filename = buildSystemAuditFilename("csv", ctx.generatedAt);
  // RFC 4180 — CRLF + UTF-8 BOM (Excel 한글 호환, STEP 25/44/51 일관)
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(blob, filename);
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

function exportAsJSON(
  events: ReadonlyArray<SystemAuditEvent>,
  ctx: SystemAuditExportContext
): void {
  // SystemAuditEvent 그대로 events 배열에 — pretty print 2-space indent
  // (사용자 spec 명시).
  const payload = {
    metadata: {
      exportedAt: ctx.generatedAt,
      filteredEventCount: events.length,
      totalEventCount: ctx.totalEventCount,
      schemaVersion: "v1" as const,
      deviceLocal: true,
      disclaimer:
        "운영 참고용 — device-local 기록 · 회계 확정 / 외부 신고 / 법적 효력과 무관합니다.",
    },
    filters: {
      category: ctx.filters.category,
      severity: ctx.filters.severity,
      timeRange: ctx.filters.timeRange ?? null,
      searchQuery: ctx.filters.searchQuery ?? null,
    },
    events: events.map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      category: e.category,
      severity: e.severity,
      action: e.action,
      message: e.message,
      actorRole: e.actorRole,
      actorLabel: e.actorLabel,
      targetType: e.targetType ?? null,
      targetRef: e.targetRef ?? null,
      metadata: e.metadata ?? null,
    })),
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = buildSystemAuditFilename("json", ctx.generatedAt);
  const blob = new Blob([json], {
    type: "application/json;charset=utf-8",
  });
  triggerDownload(blob, filename);
}

// ---------------------------------------------------------------------------
// Filter label helpers — UI 라벨 (한국어) 매핑
// ---------------------------------------------------------------------------

function filterLabelCategory(value: AuditCategory | "all"): string {
  if (value === "all") return "전체";
  return AUDIT_CATEGORY_LABEL_KR[value] ?? value;
}

function filterLabelSeverity(value: AuditSeverity | "all"): string {
  if (value === "all") return "전체";
  return AUDIT_SEVERITY_LABEL_KR[value] ?? value;
}

function filterLabelTimeRange(
  value: { fromIso: string; toIso: string } | null | undefined
): string {
  if (!value) return "전체";
  const from = formatHumanDate(value.fromIso);
  const to = formatHumanDate(value.toIso);
  return `${from} ~ ${to}`;
}

// ---------------------------------------------------------------------------
// Internal helpers — 다른 export 모듈 (STEP 25/44/51) 패턴 일관
// ---------------------------------------------------------------------------

function csv(s: string): string {
  if (s == null) return "";
  const needsQuote = /[",\r\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
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

function formatHumanDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
