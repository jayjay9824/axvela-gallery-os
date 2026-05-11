"use client";

import * as React from "react";
import { Drawer } from "@/components/ui/Drawer";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  classifyAuditEvent,
  applyAuditFilters,
  EMPTY_AUDIT_FILTER_STATE,
  type AuditFilterState,
  type ClassifiedAuditEvent,
} from "@/lib/audit-helpers";
import {
  type AuditTarget,
  type AuditNavigationStoreView,
} from "@/lib/audit-navigation";
import { AuditEventCard } from "@/components/audit/AuditEventCard";
import { AuditExportBar } from "@/components/audit/AuditExportBar";
import { AuditFilterBar } from "@/components/audit/AuditFilterBar";
import { AuditTrailVisualization } from "@/components/audit/AuditTrailVisualization";
import type { ExportContext, ExportScope } from "@/lib/audit-export";
import { hasPermission } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { Artwork, TimelineEvent } from "@/types/artwork";

// ============================================================================
// GlobalAuditDrawer — STEP 23 (rule_4 trust layer 확장 · cross-artwork view)
//
// 갤러리 전체 timeline 이벤트를 한 화면에서. STEP 20 단일 작품 AuditLogDrawer를
// 보조 — 상호 배타가 아니라 별개 진입점. Owner / Manager 전용 (rule_7).
//
// 구조:
//   - Header: "전체 감사 로그" + 닫기 (Drawer 기본)
//   - Filter section: STEP 24 통합 AuditFilterBar (date / search / domain[] /
//     actorType[] / actorRole[] / artworkIds[])
//   - Count summary: "총 N건 (M개 작품)"
//   - Scrollable list: AuditEventCard with `artworkLabel` rib
//
// Reuse:
//   - AuditEventCard (extracted to its own module)
//   - resolveAuditEventTarget (rule_8 navigation 그대로)
//   - AuditFilterBar / applyAuditFilters (STEP 24)
// ============================================================================

export function GlobalAuditDrawer() {
  const globalAuditRequest = useArtworkStore((s) => s.globalAuditRequest);
  const closeGlobalAudit = useArtworkStore((s) => s.closeGlobalAudit);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const artworks = useArtworkStore((s) => s.artworks);
  const timeline = useArtworkStore((s) => s.timeline);

  // Navigation dependencies — same selectors as AuditLogDrawer (STEP 21).
  const inquiries = useArtworkStore((s) => s.inquiries);
  const transactions = useArtworkStore((s) => s.transactions);
  const invoices = useArtworkStore((s) => s.invoices);
  const settlements = useArtworkStore((s) => s.settlements);
  const taxRecords = useArtworkStore((s) => s.taxRecords);
  const contracts = useArtworkStore((s) => s.contracts);
  const logistics = useArtworkStore((s) => s.logistics);
  const conditionReports = useArtworkStore((s) => s.conditionReports);
  const curationNotes = useArtworkStore((s) => s.curationNotes);

  // Open dispatchers — STEP 21과 동일.
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
  const select = useArtworkStore((s) => s.select);

  const isAllowed = hasPermission(currentRole, "audit.view_global");
  const isOpen = globalAuditRequest.kind === "open" && isAllowed;

  // STEP 24 — 통합 필터 상태. drawer 닫혔다 다시 열면 reset.
  const [filterState, setFilterState] = React.useState<AuditFilterState>(
    EMPTY_AUDIT_FILTER_STATE
  );

  React.useEffect(() => {
    if (!isOpen) return;
    setFilterState(EMPTY_AUDIT_FILTER_STATE);
  }, [isOpen]);

  // STEP 21 navigation store view — 카드의 chain detail / target 해석에 사용.
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

  // Aggregate all events across artworks. Sort DESC by `at`.
  // 작품 lookup 빠르게 하기 위해 id → Artwork 사전 빌드.
  const artworkById = React.useMemo(() => {
    const m = new Map<string, Artwork>();
    for (const a of artworks) m.set(a.id, a);
    return m;
  }, [artworks]);

  const allClassified: Array<{
    classified: ClassifiedAuditEvent;
    artwork: Artwork;
  }> = React.useMemo(() => {
    const out: Array<{
      classified: ClassifiedAuditEvent;
      artwork: Artwork;
      eventAt: number;
    }> = [];
    for (const artwork of artworks) {
      const list: TimelineEvent[] = timeline[artwork.id] ?? [];
      for (const event of list) {
        out.push({
          classified: classifyAuditEvent(event),
          artwork,
          eventAt: new Date(event.at).getTime(),
        });
      }
    }
    out.sort((a, b) => b.eventAt - a.eventAt);
    return out.map(({ classified, artwork }) => ({ classified, artwork }));
  }, [artworks, timeline]);

  // STEP 24 — Search 시 작품 제목까지 매칭하기 위한 lookup
  const artworkSearchLookup = React.useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const a of artworks) {
      m[a.id] = `${a.title} · ${a.artist.name}`;
    }
    return m;
  }, [artworks]);

  // STEP 24 — 통합 필터 적용. allClassified는 { classified, artwork, eventAt }
  // 형태이므로 classified만 추출해 적용 후 다시 join.
  const filtered = React.useMemo(() => {
    const onlyClassified = allClassified.map((x) => x.classified);
    const filteredClassifiedSet = new Set(
      applyAuditFilters(onlyClassified, filterState, artworkSearchLookup).map(
        (c) => c.event.id
      )
    );
    return allClassified.filter(({ classified }) =>
      filteredClassifiedSet.has(classified.event.id)
    );
  }, [allClassified, filterState, artworkSearchLookup]);

  // Distinct artwork count in filtered results — for the summary
  const distinctArtworkCount = React.useMemo(() => {
    const ids = new Set<string>();
    for (const { artwork } of filtered) ids.add(artwork.id);
    return ids.size;
  }, [filtered]);

  const totalCount = allClassified.length;
  const filteredCount = filtered.length;
  const isFiltered = filteredCount !== totalCount;

  // STEP 25 — Export scope + ctx (global view)
  const exportScope: ExportScope = { kind: "global" };
  const exportCtx: ExportContext = React.useMemo(() => {
    const map: Record<string, Artwork> = {};
    for (const a of artworks) map[a.id] = a;
    return { artworkById: map };
  }, [artworks]);
  const filteredClassified = React.useMemo(
    () => filtered.map(({ classified }) => classified),
    [filtered]
  );

  /**
   * Single dispatch — same as AuditLogDrawer (STEP 21). 두 drawer가 z-index
   * 위에서 겹치지 않도록 close 후 target 열기. 단일 작품 audit과 달리
   * `select(artworkId)`로 Detail Panel도 함께 전환 — 사용자가 다른 작품
   * 이벤트 클릭 시 컨텍스트 자동 따라감.
   */
  const dispatchTarget = React.useCallback(
    (target: AuditTarget, artworkId: string) => {
      closeGlobalAudit();
      // Sidebar / DetailPanel 컨텍스트 전환
      if (artworkId) select(artworkId);
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
      closeGlobalAudit,
      select,
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

  // 권한 가드 — 권한 없는 사용자가 어떤 경로로든 drawer를 열려고 하면
  // 즉시 close. defensive: store action도 가드하지만 UI 레벨에서도 한 번 더.
  React.useEffect(() => {
    if (globalAuditRequest.kind === "open" && !isAllowed) {
      closeGlobalAudit();
    }
  }, [globalAuditRequest.kind, isAllowed, closeGlobalAudit]);

  return (
    <Drawer
      open={isOpen}
      onClose={closeGlobalAudit}
      title="전체 감사 로그"
      widthClass="w-[800px]"
    >
      {isOpen && (
        <div className="flex flex-col h-full">
          {/* Header — filters */}
          <div className="border-b border-line px-6 py-4 shrink-0 flex flex-col gap-3.5 bg-surface">
            <SummaryLine
              filteredCount={filteredCount}
              totalCount={totalCount}
              distinctArtworkCount={distinctArtworkCount}
              totalArtworkCount={artworks.length}
              isFiltered={isFiltered}
            />
            <AuditFilterBar
              state={filterState}
              onChange={setFilterState}
              mode="global"
              artworks={artworks}
            />
            {/* STEP 26 — Audit Trail Visualization (with artwork lookup for Top artworks) */}
            <AuditTrailVisualization
              classified={filteredClassified}
              mode="global"
              artworkLookup={artworkSearchLookup}
            />
            {/* STEP 25 — Export bar */}
            <AuditExportBar
              classified={filteredClassified}
              scope={exportScope}
              ctx={exportCtx}
            />
          </div>

          {/* Scrollable event list */}
          <div className="flex-1 overflow-y-auto scroll-clean px-6 py-5">
            {filtered.length === 0 ? (
              <EmptyState hasAnyEvents={totalCount > 0} />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {filtered.map(({ classified, artwork }) => (
                  <li key={classified.event.id}>
                    <AuditEventCard
                      classified={classified}
                      artworkId={artwork.id}
                      navStore={navStore}
                      onDispatch={(target) =>
                        dispatchTarget(target, artwork.id)
                      }
                      artworkLabel={artworkLabelFor(artwork)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

// ============================================================================
// Internal subcomponents
// ============================================================================

function artworkLabelFor(artwork: Artwork): string {
  return `${artwork.title} · ${artwork.artist}`;
}

interface SummaryLineProps {
  filteredCount: number;
  totalCount: number;
  distinctArtworkCount: number;
  totalArtworkCount: number;
  isFiltered: boolean;
}

function SummaryLine({
  filteredCount,
  totalCount,
  distinctArtworkCount,
  totalArtworkCount,
  isFiltered,
}: SummaryLineProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
          이벤트
        </p>
        <p className="text-[12px] text-ink-muted tabular-nums tracking-tightish mt-0.5">
          {isFiltered
            ? `${filteredCount} / ${totalCount}건`
            : `${totalCount}건`}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold">
          작품
        </p>
        <p className="text-[12px] text-ink-muted tabular-nums tracking-tightish mt-0.5">
          {isFiltered
            ? `${distinctArtworkCount} / ${totalArtworkCount}점`
            : `${totalArtworkCount}점`}
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
