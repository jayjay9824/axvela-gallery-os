// ============================================================================
// OperationalDrilldownDrawer — STEP 67.
//
// AXVELA OS의 모든 metric / count / status badge 클릭이 본 drawer로 흡수됨.
// 단일 reusable drawer가 store의 `drilldownRequest`를 흡수해 resolver 통해
// columns + rows 계산, domain-agnostic 표를 렌더.
//
// **artwork-centric navigation (rule_1)**:
//   row.artworkId가 채워진 row → 클릭 시 setSelectedArtwork → drawer close
//   → DetailPanel auto-sync. 사용자가 작품 컨텍스트로 자연 복귀.
//   row.artworkId 부재 (storage orphan 등) → row non-clickable, 단순 표시.
//
// **filter sync (사용자 spec)**:
//   payload.periodFromIso / periodToIso 가 호출자 (ReportingDrawer 등)의
//   현재 기간 필터를 inherit. resolver가 그 기간 안의 row만 추출.
//
// **rule_16 minimalism**:
//   - text-first 표
//   - status는 작은 dot + 라벨 (별도 색상 box 없음)
//   - 그림자 0, 과도한 hover effect 0
//   - row hover만 미세 surface-muted/40
// ============================================================================

"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import { resolveDrilldown } from "@/lib/drilldown-resolver";
import type {
  DrilldownColumn,
  DrilldownRow,
  DrilldownTone,
  DrilldownResolverResult,
} from "@/types/drilldown";
import { cn } from "@/lib/utils";

export function OperationalDrilldownDrawer() {
  const request = useArtworkStore((s) => s.drilldownRequest);
  const close = useArtworkStore((s) => s.closeDrilldown);
  const isOpen = request.kind === "open";

  return (
    <Drawer
      open={isOpen}
      onClose={close}
      title="운영 흐름 상세"
      widthClass="w-[820px]"
    >
      {isOpen && <DrilldownBody onClose={close} />}
    </Drawer>
  );
}

// ============================================================================
// Body — request payload → resolver → columns + rows
// ============================================================================

function DrilldownBody({ onClose }: { onClose: () => void }) {
  const request = useArtworkStore((s) => s.drilldownRequest);
  const select = useArtworkStore((s) => s.select);
  // STEP 124 — Entity-direct detail openers. detailKind 가 채워진 row 는
  // artwork navigate 대신 entity detail drawer 를 직접 연다. single-drawer
  // policy: detailKind 진입 시 본 drilldown drawer 자동 close (z-index 충돌
  // 방어 — 모든 drawer 가 z-50 동일).
  const openInquiryDetail = useArtworkStore((s) => s.openInquiryDetail);
  const openInvoiceDetail = useArtworkStore((s) => s.openInvoiceDetail);
  const openSettlementDetail = useArtworkStore((s) => s.openSettlementDetail);
  const openTaxDetail = useArtworkStore((s) => s.openTaxDetail);
  const openTaxInvoiceDetail = useArtworkStore((s) => s.openTaxInvoiceDetail);

  // State subset selectors — resolver 입력
  const artworks = useArtworkStore((s) => s.artworks);
  const logistics = useArtworkStore((s) => s.logistics);
  const conditionReports = useArtworkStore((s) => s.conditionReports);
  const transactions = useArtworkStore((s) => s.transactions);
  const inquiries = useArtworkStore((s) => s.inquiries);
  const invoices = useArtworkStore((s) => s.invoices);
  const settlements = useArtworkStore((s) => s.settlements);
  const taxRecords = useArtworkStore((s) => s.taxRecords);
  const contracts = useArtworkStore((s) => s.contracts);
  // STEP 78 — System Audit Log drilldown용. store는 이미 flat array로 유지.
  const auditEvents = useArtworkStore((s) => s.auditEvents);

  const result: DrilldownResolverResult | null = React.useMemo(() => {
    if (request.kind !== "open") return null;
    // store의 Record<id, T[]> grouped shape를 resolver가 기대하는 flat array로
    // 변환. logistics는 transactionId로 keyed라 그대로 (resolver가 flatten 처리).
    // auditEvents는 store가 이미 flat array — flatten 호출 0건.
    const flatten = <T,>(record: Record<string, ReadonlyArray<T>>): T[] => {
      const out: T[] = [];
      for (const list of Object.values(record)) {
        for (const item of list) out.push(item);
      }
      return out;
    };
    return resolveDrilldown(request.payload, {
      artworks,
      logistics,
      conditionReports: flatten(conditionReports),
      transactions: flatten(transactions),
      inquiries: flatten(inquiries),
      invoices: flatten(invoices),
      settlements: flatten(settlements),
      taxRecords: flatten(taxRecords),
      contracts: flatten(contracts),
      auditEvents,
    });
  }, [
    request,
    artworks,
    logistics,
    conditionReports,
    transactions,
    inquiries,
    invoices,
    settlements,
    taxRecords,
    contracts,
    auditEvents,
  ]);

  if (!result) return null;

  // Row 클릭 — STEP 124 entity-direct detail 우선, 없으면 artwork navigate
  // (rule_1 자연 복귀). 모든 path 에서 본 drilldown drawer 는 close (single-
  // drawer policy, z-index 충돌 방어).
  const handleRowClick = (row: DrilldownRow) => {
    // 1) Entity-direct detail (사용자 spec — "리스트 item 클릭 시 상세")
    if (row.detailKind && row.detailId) {
      onClose();
      switch (row.detailKind) {
        case "inquiry":
          openInquiryDetail(row.detailId);
          return;
        case "invoice":
          openInvoiceDetail(row.detailId);
          return;
        case "settlement":
          openSettlementDetail(row.detailId);
          return;
        case "tax":
          openTaxDetail(row.detailId);
          return;
        case "tax_invoice":
          openTaxInvoiceDetail(row.detailId);
          return;
      }
    }
    // 2) Artwork navigate fallback (rule_1)
    if (!row.artworkId) return;
    select(row.artworkId);
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Header — title + context ───────────────────────────────────── */}
      <div className="px-6 pt-4 pb-3 border-b border-line shrink-0">
        <h2 className="text-[14px] font-semibold tracking-tightish text-ink leading-snug">
          {result.title}
        </h2>
        {result.context && (
          <p className="mt-1 text-[10.5px] tracking-tightish text-ink-subtle italic">
            {result.context}
          </p>
        )}
      </div>

      {/* ── Body — table ──────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-clean">
        {result.rows.length === 0 ? (
          <EmptyState message={result.emptyMessage} />
        ) : (
          <DrilldownTable
            columns={result.columns}
            rows={result.rows}
            onRowClick={handleRowClick}
          />
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-line px-6 py-3 shrink-0 flex items-center justify-between bg-surface">
        <div className="flex items-baseline gap-3">
          <span className="text-[10.5px] text-ink-subtle tracking-tightish">
            {result.rows.length}건 · 행을 클릭하면 상세 열림
          </span>
          <span className="text-[10px] text-ink-subtle italic tracking-tightish">
            운영 참고
          </span>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </footer>
    </div>
  );
}

// ============================================================================
// Table renderer
// ============================================================================

function DrilldownTable({
  columns,
  rows,
  onRowClick,
}: {
  columns: ReadonlyArray<DrilldownColumn>;
  rows: ReadonlyArray<DrilldownRow>;
  onRowClick: (row: DrilldownRow) => void;
}) {
  return (
    <table className="w-full text-[11.5px] tabular-nums">
      <thead className="sticky top-0 bg-surface border-b border-line">
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              scope="col"
              className={cn(
                "px-4 py-2 font-medium tracking-[0.06em] text-[10px] uppercase text-ink-subtle",
                col.align === "right" ? "text-right" : "text-left",
                col.widthClass
              )}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <DrilldownRowView
            key={row.id}
            row={row}
            columns={columns}
            onClick={() => onRowClick(row)}
            // STEP 124 — clickable 조건에 detailKind+detailId 도 포함. inquiry
            // 같은 entity-direct detail row 가 artworkId 없어도 클릭 가능해야 함.
            clickable={
              !!(row.detailKind && row.detailId) || !!row.artworkId
            }
          />
        ))}
      </tbody>
    </table>
  );
}

function DrilldownRowView({
  row,
  columns,
  onClick,
  clickable,
}: {
  row: DrilldownRow;
  columns: ReadonlyArray<DrilldownColumn>;
  onClick: () => void;
  clickable: boolean;
}) {
  return (
    <tr
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      title={
        clickable ? "작품 이동 — 클릭하면 상세 보기로 전환" : undefined
      }
      className={cn(
        "border-b border-line/60 transition-colors",
        clickable
          ? "cursor-pointer hover:bg-surface-muted/40 focus-visible:bg-surface-muted/40 focus-visible:outline-none"
          : "cursor-default"
      )}
    >
      {columns.map((col) => {
        const cell = row.cells[col.key];
        return (
          <td
            key={col.key}
            className={cn(
              "px-4 py-2.5 align-top",
              col.align === "right" ? "text-right" : "text-left"
            )}
          >
            <CellRender cell={cell} />
          </td>
        );
      })}
    </tr>
  );
}

function CellRender({
  cell,
}: {
  cell:
    | { text: string; tone?: DrilldownTone; meta?: string }
    | undefined;
}) {
  if (!cell) return <span className="text-ink-subtle">—</span>;
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span
        className={cn(
          "tracking-tightish leading-snug",
          toneTextClass(cell.tone)
        )}
      >
        {cell.tone && cell.tone !== "neutral" && (
          <span
            aria-hidden
            className={cn(
              "inline-block w-1 h-1 rounded-full mr-1.5 align-middle",
              toneDotClass(cell.tone)
            )}
          />
        )}
        {cell.text}
      </span>
      {cell.meta && (
        <span className="text-[9.5px] text-ink-subtle italic tracking-tightish leading-tight truncate">
          {cell.meta}
        </span>
      )}
    </div>
  );
}

function toneTextClass(tone?: DrilldownTone): string {
  switch (tone) {
    case "success":
      return "text-ink";
    case "warning":
      return "text-status-inquiry";
    case "error":
      return "text-status-deal";
    case "info":
      return "text-ink";
    case "neutral":
    case undefined:
      return "text-ink";
  }
}

function toneDotClass(tone: DrilldownTone): string {
  switch (tone) {
    case "success":
      return "bg-status-deal";
    case "warning":
      return "bg-status-inquiry";
    case "error":
      return "bg-status-deal";
    case "info":
      return "bg-ink-muted";
    case "neutral":
      return "bg-ink-subtle";
  }
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-[11.5px] text-ink-subtle italic tracking-tightish">
        {message ?? "표시할 연결 데이터가 없습니다."}
      </p>
    </div>
  );
}
