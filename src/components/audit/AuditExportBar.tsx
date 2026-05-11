// ============================================================================
// AuditExportBar — STEP 25
//
// AuditLogDrawer + GlobalAuditDrawer가 공유하는 export 진입점 UI.
// 3-format 인라인 버튼 (JSON / CSV / PDF) + scope-aware 라벨.
//
// rule_4 trust layer 종착점 — read-only export 액션. RBAC 가드 없음
// (audit view 자체에 접근 가능하면 export도 가능 — 단일 작품 view는 누구나,
// global view는 audit.view_global 보유자만 진입 가능하므로 자연스럽게 차등됨).
// ============================================================================

"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  exportAuditLog,
  type ExportFormat,
  type ExportScope,
  type ExportContext,
} from "@/lib/audit-export";
import type { ClassifiedAuditEvent } from "@/lib/audit-helpers";

interface AuditExportBarProps {
  classified: ClassifiedAuditEvent[];
  scope: ExportScope;
  ctx: ExportContext;
  /** 비어있으면 disabled로 처리 — 빈 export는 의미 없음 */
  disabled?: boolean;
}

export function AuditExportBar({
  classified,
  scope,
  ctx,
  disabled,
}: AuditExportBarProps) {
  const isEmpty = classified.length === 0;
  const isDisabled = disabled || isEmpty;

  const handleExport = (format: ExportFormat) => {
    if (isDisabled) return;
    exportAuditLog(format, classified, scope, ctx);
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        "px-3.5 py-2 rounded-md border border-line bg-surface-muted"
      )}
    >
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-semibold tracking-tightish text-ink">
          감사 로그 내보내기
        </span>
        <span className="text-[10.5px] italic text-ink-subtle tracking-tightish">
          {isEmpty
            ? "내보낼 이벤트 없음"
            : `${classified.length}건 · 내부 기록 기반 Audit Report`}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <FormatButton
          label="JSON"
          onClick={() => handleExport("json")}
          disabled={isDisabled}
        />
        <FormatButton
          label="CSV"
          onClick={() => handleExport("csv")}
          disabled={isDisabled}
        />
        <FormatButton
          label="PDF"
          onClick={() => handleExport("pdf")}
          disabled={isDisabled}
        />
      </div>
    </div>
  );
}

function FormatButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </Button>
  );
}
