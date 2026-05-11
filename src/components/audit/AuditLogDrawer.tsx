"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  classifyAuditEvent,
  applyAuditFilters,
  getAuditEventsForArtwork,
  EMPTY_AUDIT_FILTER_STATE,
  type AuditFilterState,
  type ClassifiedAuditEvent,
} from "@/lib/audit-helpers";
import {
  type AuditTarget,
  type AuditNavigationStoreView,
} from "@/lib/audit-navigation";
import {
  AuditEventCard,
} from "@/components/audit/AuditEventCard";
import { AuditFilterBar } from "@/components/audit/AuditFilterBar";
import { AuditTrailVisualization } from "@/components/audit/AuditTrailVisualization";
import type { Artwork } from "@/types/artwork";
import { AuditExportBar } from "./AuditExportBar";
import type { ExportContext, ExportScope } from "@/lib/audit-export";

// ============================================================================
// Audit Log Drawer — STEP 20 (rule_7 + rule_8 follow-through)
//
// Read-only view of all TimelineEvents for the current artwork, with two
// filter axes (domain + actor type) and emphasis markers for trust-critical
// events (LOCK / APPROVED / CORRECTION / PAYMENT / SETTLEMENT / TAX_ISSUED).
//
// 기존 TimelineEvent 구조 0줄 변경. 분류·필터·체인 추출은 lib/audit-helpers의
// 순수 함수에서 처리 — UI 컴포넌트는 표시만 담당.
//
// 위치 정책 (rule_14, rule_17): 3-column 레이아웃 무변경, drawer로만 노출.
// DetailPanel의 Living Timeline 섹션 헤더에 "감사 로그 보기" 진입점.
// ============================================================================

export function AuditLogDrawer() {
  const auditLogRequest = useArtworkStore((s) => s.auditLogRequest);
  const closeAuditLog = useArtworkStore((s) => s.closeAuditLog);
  const timeline = useArtworkStore((s) => s.timeline);
  const artworks = useArtworkStore((s) => s.artworks);

  // STEP 21 — Navigation dependencies. Resolver는 read-only이므로 selector로
  // 그대로 패스. 컴포넌트 mount 시점에는 빈 객체일 수도 있으므로 ?? {} 방어.
  const inquiries = useArtworkStore((s) => s.inquiries);
  const transactions = useArtworkStore((s) => s.transactions);
  const invoices = useArtworkStore((s) => s.invoices);
  const settlements = useArtworkStore((s) => s.settlements);
  const taxRecords = useArtworkStore((s) => s.taxRecords);
  const contracts = useArtworkStore((s) => s.contracts);
  const logistics = useArtworkStore((s) => s.logistics);
  const conditionReports = useArtworkStore((s) => s.conditionReports);
  const curationNotes = useArtworkStore((s) => s.curationNotes);

  // Open dispatchers — 클릭 시 audit log을 닫고 target drawer를 연다.
  const openContractDetail = useArtworkStore((s) => s.openContractDetail);
  const openCurationDraft = useArtworkStore((s) => s.openCurationDraft);
  const openInvoiceDetail = useArtworkStore((s) => s.openInvoiceDetail);
  const openReceiptDetail = useArtworkStore((s) => s.openReceiptDetail);
  const openTaxInvoiceDetail = useArtworkStore((s) => s.openTaxInvoiceDetail);
  const openSettlementDetail = useArtworkStore((s) => s.openSettlementDetail);
  const openTaxDetail = useArtworkStore((s) => s.openTaxDetail);
  const openLogisticsDetail = useArtworkStore((s) => s.openLogisticsDetail);
  const openConditionReportEdit = useArtworkStore(
    (s) => s.openConditionReportEdit
  );
  const openInquiryDetail = useArtworkStore((s) => s.openInquiryDetail);
  const openInquiryResponse = useArtworkStore((s) => s.openInquiryResponse);

  const isOpen = auditLogRequest.kind === "open";
  const artworkId = isOpen ? auditLogRequest.artworkId : null;
  const artwork: Artwork | undefined = artworkId
    ? artworks.find((a) => a.id === artworkId)
    : undefined;

  // Filter state — STEP 24 integrated. 다른 작품 audit log를 열면 reset.
  const [filterState, setFilterState] = React.useState<AuditFilterState>(
    EMPTY_AUDIT_FILTER_STATE
  );

  React.useEffect(() => {
    if (!isOpen) return;
    setFilterState(EMPTY_AUDIT_FILTER_STATE);
  }, [isOpen, artworkId]);

  // Aggregate the slices that resolver consumes.
  const navStore: AuditNavigationStoreView = React.useMemo(
    () => ({
      inquiries,
      transactions,
      invoices,
      settlements,
      taxRecords,
      contracts,
      logistics,
      conditionReports,
      curationNotes,
    }),
    [
      inquiries,
      transactions,
      invoices,
      settlements,
      taxRecords,
      contracts,
      logistics,
      conditionReports,
      curationNotes,
    ]
  );

  /**
   * Single dispatch function — 카드에서 호출됨. AuditTarget의 kind에 따라
   * 적절한 store open 액션 호출. audit log drawer는 같은 turn에 닫음 (3-column
   * 레이아웃 위에 두 drawer가 겹치지 않도록).
   */
  const dispatchTarget = React.useCallback(
    (target: AuditTarget) => {
      closeAuditLog();
      switch (target.kind) {
        case "contract":
          openContractDetail(target.id);
          break;
        case "curation":
          openCurationDraft(target.artworkId);
          break;
        case "invoice":
          openInvoiceDetail(target.id);
          break;
        case "receipt":
          openReceiptDetail(target.id);
          break;
        case "taxInvoice":
          openTaxInvoiceDetail(target.id);
          break;
        case "settlement":
          openSettlementDetail(target.id);
          break;
        case "tax":
          openTaxDetail(target.id);
          break;
        case "logistics":
          openLogisticsDetail(target.id);
          break;
        case "conditionReport":
          openConditionReportEdit(target.id);
          break;
        case "inquiry":
          openInquiryDetail(target.id);
          break;
        case "inquiryResponse":
          openInquiryResponse(target.id);
          break;
      }
    },
    [
      closeAuditLog,
      openContractDetail,
      openCurationDraft,
      openInvoiceDetail,
      openReceiptDetail,
      openTaxInvoiceDetail,
      openSettlementDetail,
      openTaxDetail,
      openLogisticsDetail,
      openConditionReportEdit,
      openInquiryDetail,
      openInquiryResponse,
    ]
  );

  const allClassified: ClassifiedAuditEvent[] = artworkId
    ? getAuditEventsForArtwork(timeline, artworkId).map(classifyAuditEvent)
    : [];

  // STEP 24 — single-artwork search lookup. 본 view는 한 작품만 다루지만
  // search가 작품 제목까지 매칭하도록 lookup 1건 제공.
  const searchLookup = React.useMemo<Record<string, string>>(
    () =>
      artwork
        ? { [artwork.id]: `${artwork.title} · ${artwork.artist.name}` }
        : {},
    [artwork]
  );

  const filtered = applyAuditFilters(allClassified, filterState, searchLookup);

  // STEP 25 — Export scope + ctx (single artwork view)
  const exportScope: ExportScope = artwork
    ? {
        kind: "single_artwork",
        artworkId: artwork.id,
        artworkLabel: `${artwork.title} · ${artwork.artist.name}`,
      }
    : { kind: "global" }; // 도달 불가 (drawer가 artwork 없으면 unmount)
  const exportCtx: ExportContext = React.useMemo(
    () => ({ artworkById: artwork ? { [artwork.id]: artwork } : {} }),
    [artwork]
  );

  return (
    <Drawer open={isOpen} onClose={closeAuditLog} title="감사 로그">
      {isOpen && artwork && (
        <div className="flex flex-col h-full">
          {/* Header — context + filters */}
          <div className="border-b border-line px-6 py-4 shrink-0 flex flex-col gap-3.5 bg-surface">
            <ArtworkContextLine
              artwork={artwork}
              totalCount={allClassified.length}
              filteredCount={filtered.length}
            />
            <AuditFilterBar
              state={filterState}
              onChange={setFilterState}
              mode="single"
            />
            {/* STEP 26 — Audit Trail Visualization */}
            <AuditTrailVisualization classified={filtered} mode="single" />
            {/* STEP 25 — Export bar */}
            <AuditExportBar
              classified={filtered}
              scope={exportScope}
              ctx={exportCtx}
            />
          </div>

          {/* Body — event card list */}
          <div className="flex-1 min-h-0 overflow-y-auto scroll-clean px-6 py-5">
            {filtered.length === 0 ? (
              <EmptyState hasAnyEvents={allClassified.length > 0} />
            ) : (
              <ol className="flex flex-col gap-2.5">
                {filtered.map((c) => (
                  <li key={c.event.id}>
                    <AuditEventCard
                      classified={c}
                      artworkId={artwork.id}
                      navStore={navStore}
                      onDispatch={dispatchTarget}
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Footer */}
          <footer className="border-t border-line px-6 py-3.5 shrink-0 flex items-center justify-end bg-surface">
            <Button type="button" variant="ghost" onClick={closeAuditLog}>
              닫기
            </Button>
          </footer>
        </div>
      )}
    </Drawer>
  );
}

// ============================================================================
// Filter chip definitions — text labels + ordering
// ============================================================================
// Sub-components
// ============================================================================

function ArtworkContextLine({
  artwork,
  totalCount,
  filteredCount,
}: {
  artwork: Artwork;
  totalCount: number;
  filteredCount: number;
}) {
  const isFiltered = filteredCount !== totalCount;
  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden
        className="h-7 w-7 rounded border border-line shrink-0"
        style={{ backgroundColor: artwork.thumbnailColor }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-ink truncate font-medium tracking-tightish">
          {artwork.title}
        </p>
        <p className="text-[10.5px] text-ink-subtle font-mono tracking-tightish">
          {artwork.axid.code}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
          이벤트
        </p>
        <p className="text-[11.5px] text-ink-muted tabular-nums tracking-tightish mt-0.5">
          {isFiltered ? `${filteredCount} / ${totalCount}` : totalCount}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ hasAnyEvents }: { hasAnyEvents: boolean }) {
  return (
    <div className="rounded-md border border-dashed border-line p-5 text-center">
      <p className="text-[12.5px] text-ink-muted tracking-tightish">
        {hasAnyEvents
          ? "선택한 필터에 해당하는 이벤트가 없습니다."
          : "아직 기록된 이벤트가 없습니다."}
      </p>
      <p className="mt-1 text-[11px] text-ink-subtle tracking-tightish">
        {hasAnyEvents
          ? "필터를 “전체”로 변경하여 모든 이벤트를 확인하세요."
          : "상태 전환·Inquiry·Transaction 발생 시 자동으로 누적됩니다."}
      </p>
    </div>
  );
}

