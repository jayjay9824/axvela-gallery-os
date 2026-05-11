"use client";

import * as React from "react";
import { useArtworkStore } from "@/store/useArtworkStore";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { hasPermission, permissionHint } from "@/lib/rbac";
import { cn, STATE_LABEL_KR } from "@/lib/utils";
import { getActiveRemoteAdapter } from "@/lib/persistence";
import {
  computeBackupHealth,
  type BackupHealth,
} from "@/lib/backup-metadata";
import { ClickableMetric } from "@/components/drilldown/ClickableMetric";
import type { ArtworkState } from "@/types/artwork";
import {
  extractDraftPreviewLabel,
  formatDraftRelativeTime,
} from "@/types/artwork-draft";

interface NavItem {
  label: string;
  active?: boolean;
  badge?: number;
  /**
   * STEP 40 — 항목이 아직 navigation을 지원하지 않을 때 true.
   * 단순히 `onClick` 부재로 "조용히 무응답"하는 대신 시각적/접근성 상으로
   * 명시적인 비활성 상태 (rule_7 disabled 패턴 일관성).
   */
  disabled?: boolean;
  /**
   * STEP 40 — disabled 항목 옆에 작게 표시할 힌트 라벨.
   * "준비 중" / "작품 상세에서 접근" 등. 사용자가 왜 클릭이 안 되는지
   * 즉시 인지 가능하도록.
   */
  hint?: string;
  /**
   * STEP 35 — 활성 항목의 click 핸들러. disabled === false이고 본 필드가
   * 있으면 클릭 시 실행. 일반 nav item은 onClick 없이 active 표시만 (이미
   * 표시 중인 view라는 의미).
   */
  onClick?: () => void;
}

const PRIMARY_STATIC: NavItem[] = [
  { label: "작품", active: true },
  { label: "거래",          disabled: true, hint: "작품 상세에서 접근" },
  // STEP 51 — "문서" 메뉴 활성화. 컴포넌트 내부에서 RBAC + onClick 동적 빌드
  // (Reporting / 고객과 일관). 본 STATIC 배열에서는 제거되었으며 PRIMARY 동적
  // 빌드 시 추가됨.
];

// SECONDARY는 컴포넌트 내부에서 RBAC + store 액션과 결합하여 동적 빌드.
// (STEP 35 — "보고서" 항목 활성화 + Manager 이상 권한 게이트)
// (STEP 42 — "고객" 항목은 PRIMARY로 이동, SECONDARY에서 제거)

/**
 * Pending approval queue item — derived live from the store. Click routes
 * directly into the existing detail drawer for that artifact (rule_9 — Work
 * Queue is actionable, never just a notification).
 */
interface ApprovalItem {
  id: string;                    // stable key
  domain: "CONTRACT" | "SETTLEMENT" | "TAX";
  label: string;                 // e.g. "Contract 승인 — 흐름의 조각"
  hint: string;                  // status sub-label
  accent: string;                // status color dot
  artworkId: string;             // for selection
  open: () => void;              // click handler — opens the relevant drawer
}

export function Sidebar() {
  const artworks = useArtworkStore((s) => s.artworks);
  const contracts = useArtworkStore((s) => s.contracts);
  const settlements = useArtworkStore((s) => s.settlements);
  const taxRecords = useArtworkStore((s) => s.taxRecords);

  const select = useArtworkStore((s) => s.select);
  const openContractDetail = useArtworkStore((s) => s.openContractDetail);
  const openSettlementDetail = useArtworkStore((s) => s.openSettlementDetail);
  const openTaxDetail = useArtworkStore((s) => s.openTaxDetail);

  // STEP 23 — Cross-artwork Audit (rule_4 trust layer · rule_7 RBAC)
  const currentRole = useArtworkStore((s) => s.currentRole);
  const openGlobalAudit = useArtworkStore((s) => s.openGlobalAudit);
  const canViewGlobalAudit = hasPermission(currentRole, "audit.view_global");

  // STEP 35 — Multi-currency Reporting (rule_3 + rule_20)
  const openReporting = useArtworkStore((s) => s.openReporting);
  const canViewReporting = hasPermission(currentRole, "report.view_global");

  // STEP 88 — Fiscal Summary Aggregate Layer (operational fiscal/VAT overview).
  // 권한은 Reporting과 동일 (Manager 이상) — 동일 데이터 영역의 *operational
  // overlay*. 신규 RBAC 키 도입 0건.
  const openFiscalSummary = useArtworkStore((s) => s.openFiscalSummary);

  // STEP 42 — Customer / Collector Domain Promotion. STEP 41의 "Collector View"
  // 항목 라벨을 "고객"으로 변경 (1급 도메인 위치). 권한 키 (`collector.view_global`)
  // / store 액션 / drawer state는 STEP 41 그대로 호환 — semantic만 customer로 확장.
  const openCustomerView = useArtworkStore((s) => s.openCollectorView);
  const canViewCustomer = hasPermission(currentRole, "collector.view_global");

  // STEP 51 — Documents Hub 진입점 (Reporting과 같은 권한 — Manager 이상).
  const openDocuments = useArtworkStore((s) => s.openDocuments);
  const canViewDocuments = hasPermission(currentRole, "report.view_global");

  // STEP 74 — Sidebar Artwork Status Drilldown. 8 ArtworkState별 카운트 +
  // 전체 카운트를 클릭 가능. 기존 drilldown 도메인 `artwork_state` 재사용.
  const openDrilldown = useArtworkStore((s) => s.openDrilldown);
  const statusCounts = React.useMemo(() => {
    const counts: Record<ArtworkState, number> = {
      DRAFT: 0,
      READY: 0,
      INQUIRY: 0,
      DEAL: 0,
      PAID: 0,
      CLOSED: 0,
      REOPENED: 0,
      BROKERED: 0,
    };
    for (const a of artworks) {
      counts[a.state] = (counts[a.state] ?? 0) + 1;
    }
    return counts;
  }, [artworks]);
  // STATUS 표시 순서 — 운영 흐름 자연 순서 (rule_6 작품 lifecycle)
  const STATUS_ORDER: ReadonlyArray<ArtworkState> = [
    "DRAFT",
    "READY",
    "INQUIRY",
    "DEAL",
    "PAID",
    "CLOSED",
    "REOPENED",
    "BROKERED",
  ];

  // STEP UX-2 — Sidebar Grouping & AI Reframe. PRIMARY = 일상 작업의 1급 도메인
  // 만 (작품 / 거래 / 고객). "문서"는 OPERATIONS group으로 이동 — 운영 보조 view
  // 성격에 더 부합 (단일 작품 진입이 아닌 cross-artwork 검색·관리 view).
  // STEP 42 정착 그대로 — 권한 있음 → onClick. 권한 부족 → disabled + permission
  // hint.
  const PRIMARY: NavItem[] = React.useMemo(
    () => [
      ...PRIMARY_STATIC,
      {
        label: "고객",
        disabled: !canViewCustomer,
        hint: canViewCustomer
          ? undefined
          : permissionHint("collector.view_global"),
        onClick: canViewCustomer ? openCustomerView : undefined,
      },
    ],
    [canViewCustomer, openCustomerView]
  );

  // STEP 35 — SECONDARY 동적 빌드. "보고서" 항목만 권한에 따라 활성/비활성.
  // 권한 있음 → onClick=openReporting, disabled false. 권한 부족 → disabled +
  // "Manager 권한 필요" hint (rule_7 disabled 패턴 일관성).
  // STEP 42 — "고객" 항목은 PRIMARY로 이동 (1급 도메인 승격), SECONDARY에서 제거.
  // STEP 54 — "물류 운영" 항목 추가. 보고서와 같은 권한 (Manager+ —
  // `report.view_global`). rule_21 1급 운영 view.
  const openLogisticsOperations = useArtworkStore(
    (s) => s.openLogisticsOperations
  );
  // STEP 62 — "이미지 정리" 항목 추가. OWNER 전용 (`image.cleanup_review`) admin
  // tool — 외부 저장소 inspection + orphan candidate review + remove request.
  const openImageCleanup = useArtworkStore((s) => s.openImageCleanup);
  const canReviewImageCleanup = hasPermission(
    currentRole,
    "image.cleanup_review"
  );
  // STEP 65 — "운영 로그" 항목 추가. OWNER 전용 (`audit.view`) — system-level
  // operational record viewer (artwork-scoped TimelineEvent와 별개).
  const openSystemAuditLog = useArtworkStore((s) => s.openSystemAuditLog);
  const canViewAuditLog = hasPermission(currentRole, "audit.view");
  // STEP UX-2 — Sidebar Grouping & AI Reframe.
  //
  // SECONDARY (single flat group "Operations") was visually flat and mixed
  // *daily-use ops* (보고서/물류 운영) with *governance/admin* (운영 로그/설정)
  // and a *non-functional disabled placeholder* (AI 워크플로우 — hint pointed
  // elsewhere, providing 0 nav value).
  //
  // 새 구조 — daily-use 우선, governance 시각적으로 quieter:
  //   OPERATIONS: 문서 / 물류 운영 / 보고서 / 이미지 정리
  //   GOVERNANCE: 운영 로그 / 전체 감사 로그 / 설정 (+ 백업 health indicator
  //                                                    — 본 group 직하 sibling)
  //
  // "AI 워크플로우" 항목은 sidebar에서 제거 — AXVELA AI는 *작품/거래 흐름에
  // 임베드되는 운영 보조*이지 별도 navigation section이 아님 (AXVELA_AI_DIRECTION
  // §10 "AI는 보조" 정책 / rule_5 AI-Human Loop). 사용자는 이미 disabled hint
  // "작품 상태 액션에서 접근"을 통해 동일한 진입을 안내받고 있었으므로 nav 가치 0.
  // 진입은 `DetailPanel`의 next-action / supporting-action UI를 통해서만 (STEP
  // UX-1 + Document Lifecycle Clarity 정책 일관).
  //
  // 권한 / RBAC 변경 0줄 — `canViewReporting` / `canReviewImageCleanup` /
  // `canViewAuditLog` / `canViewDocuments` 모두 그대로 재사용. 본 STEP은
  // *grouping refinement*이며 권한 시스템은 무관.
  const OPERATIONS: NavItem[] = React.useMemo(
    () => [
      {
        label: "문서",
        disabled: !canViewDocuments,
        hint: canViewDocuments
          ? undefined
          : permissionHint("report.view_global"),
        onClick: canViewDocuments ? openDocuments : undefined,
      },
      {
        label: "물류 운영",
        disabled: !canViewReporting,
        hint: canViewReporting
          ? undefined
          : permissionHint("report.view_global"),
        onClick: canViewReporting ? openLogisticsOperations : undefined,
      },
      {
        label: "보고서",
        disabled: !canViewReporting,
        hint: canViewReporting ? undefined : permissionHint("report.view_global"),
        onClick: canViewReporting ? openReporting : undefined,
      },
      {
        label: "세무 흐름",
        disabled: !canViewReporting,
        hint: canViewReporting
          ? undefined
          : permissionHint("report.view_global"),
        onClick: canViewReporting ? openFiscalSummary : undefined,
      },
      {
        label: "이미지 정리",
        disabled: !canReviewImageCleanup,
        hint: canReviewImageCleanup
          ? undefined
          : permissionHint("image.cleanup_review"),
        onClick: canReviewImageCleanup ? openImageCleanup : undefined,
      },
    ],
    [
      canViewDocuments,
      openDocuments,
      canViewReporting,
      openReporting,
      openLogisticsOperations,
      openFiscalSummary,
      canReviewImageCleanup,
      openImageCleanup,
    ]
  );

  // GOVERNANCE — 운영 로그 (OWNER) / 전체 감사 로그 (MANAGER+) / 설정 (준비 중).
  // 시각적으로 quieter — NavGroup `tone="muted"` (기본 색조를 `text-ink-subtle`로
  // 하향, 호버시 ink-muted로 lift). 이전 "감사" custom big button (전체 감사 로그
  // + 부제 "갤러리 전체 이벤트")은 GOVERNANCE NavGroup item으로 흡수 — 시각적
  // 통일 + governance bucket 일관성. 부제는 유지 가치 낮음 (라벨 자체가 명확).
  const GOVERNANCE: NavItem[] = React.useMemo(
    () => [
      {
        label: "운영 로그",
        disabled: !canViewAuditLog,
        hint: canViewAuditLog ? undefined : permissionHint("audit.view"),
        onClick: canViewAuditLog ? openSystemAuditLog : undefined,
      },
      {
        label: "전체 감사 로그",
        disabled: !canViewGlobalAudit,
        hint: canViewGlobalAudit
          ? undefined
          : permissionHint("audit.view_global"),
        onClick: canViewGlobalAudit ? openGlobalAudit : undefined,
      },
      { label: "설정", disabled: true, hint: "준비 중" },
    ],
    [
      canViewAuditLog,
      openSystemAuditLog,
      canViewGlobalAudit,
      openGlobalAudit,
    ]
  );

  // Build the list of pending approvals across all domains.
  // Order: Contracts (most urgent — gates document trust) → Settlements → Tax.
  const approvals: ApprovalItem[] = React.useMemo(() => {
    const out: ApprovalItem[] = [];
    const titleOf = (artworkId: string) =>
      artworks.find((a) => a.id === artworkId)?.title ?? "—";

    // Contracts — REVIEW (needs Owner approval) + APPROVED (needs Owner LOCK)
    Object.values(contracts)
      .flat()
      .forEach((c) => {
        if (c.status === "REVIEW") {
          out.push({
            id: `ctr:${c.id}`,
            domain: "CONTRACT",
            label: `계약 승인 — ${titleOf(c.artworkId)}`,
            hint: `v${c.version} · 검토 중`,
            accent: "#B97A1F", // amber — needs review
            artworkId: c.artworkId,
            open: () => {
              select(c.artworkId);
              openContractDetail(c.id);
            },
          });
        } else if (c.status === "APPROVED") {
          out.push({
            id: `ctr:${c.id}`,
            domain: "CONTRACT",
            label: `계약 LOCK — ${titleOf(c.artworkId)}`,
            hint: `v${c.version} · 승인 완료`,
            accent: "#1E5FBF", // blue — committed, awaiting lock
            artworkId: c.artworkId,
            open: () => {
              select(c.artworkId);
              openContractDetail(c.id);
            },
          });
        }
      });

    // Settlements — non-COMPLETED (PENDING / READY)
    Object.values(settlements)
      .flat()
      .forEach((s) => {
        if (s.status !== "COMPLETED") {
          out.push({
            id: `stl:${s.id}`,
            domain: "SETTLEMENT",
            label: `정산 완료 — ${titleOf(s.artworkId)}`,
            hint: s.status === "PENDING" ? "정산 대기" : "송금 준비",
            accent: "#B97A1F",
            artworkId: s.artworkId,
            open: () => {
              select(s.artworkId);
              openSettlementDetail(s.id);
            },
          });
        }
      });

    // Tax — non-ISSUED (PENDING / READY)
    Object.values(taxRecords)
      .flat()
      .forEach((t) => {
        if (t.status !== "ISSUED") {
          out.push({
            id: `tax:${t.id}`,
            domain: "TAX",
            label: `세무 발행 — ${titleOf(t.artworkId)}`,
            hint: t.status === "PENDING" ? "검토 대기" : "발행 준비",
            accent: "#B97A1F",
            artworkId: t.artworkId,
            open: () => {
              select(t.artworkId);
              openTaxDetail(t.id);
            },
          });
        }
      });

    return out;
  }, [
    artworks,
    contracts,
    settlements,
    taxRecords,
    select,
    openContractDetail,
    openSettlementDetail,
    openTaxDetail,
  ]);

  return (
    <aside className="flex flex-col h-full w-[240px] shrink-0 bg-surface border-r border-line">
      {/* Logo */}
      <div className="flex items-center h-14 px-5 border-b border-line">
        <div className="flex items-baseline gap-2">
          <span className="text-[17px] font-semibold tracking-[0.18em] text-ink">
            AXVELA
          </span>
          <span className="text-[10px] tracking-[0.16em] text-ink-subtle font-medium">
            OS
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scroll-clean px-3 py-4">
        <NavGroup label="PRIMARY" items={PRIMARY} />

        {/* STEP 117 — Artwork registration draft resume entry. Phase 4 §4.4
            Draft-safe 정착. 진행 중 임시 저장 부재 시 자연 비표시 (zero-state
            pattern, draft 부재 → null return). 클릭 시 작품 등록 drawer 열림
            + 모든 4-tab fields hydrate. createArtwork 성공 → store auto-clear
            → entry 사라짐. rule_9 Work Queue 정책 정합 (실행 가능 + 즉시 동작). */}
        <DraftResumeEntry />

        {/* STEP 74 — Sidebar Artwork Status Drilldown.
            작품 상태별 카운트 + 전체 카운트 — 모두 ClickableMetric. count 0인
            상태는 자연스럽게 비활성화. 기존 `artwork_state` drilldown 재사용. */}
        <div className="mt-5 px-2">
          <p className="px-1 mb-2 flex items-baseline justify-between">
            <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
              작품 상태
            </span>
            <span className="text-[10px] tabular-nums text-ink-muted font-medium">
              {artworks.length}
            </span>
          </p>
          {/* 전체 → artworkState 미지정 (resolver가 전체 표시) */}
          <ClickableMetric
            onClick={
              artworks.length > 0
                ? () => openDrilldown({ domain: "artwork_state" })
                : undefined
            }
            disabled={artworks.length === 0}
            ariaLabel={`작품 전체 ${artworks.length}건 — 상태 상세 보기`}
            className="block w-full mb-1"
          >
            <div className="flex items-center justify-between px-2.5 py-1 rounded-md border border-line bg-surface">
              <span className="text-[11.5px] tracking-tightish text-ink">
                전체
              </span>
              <span className="text-[11px] tabular-nums text-ink font-medium">
                {artworks.length}
              </span>
            </div>
          </ClickableMetric>
          <ul className="flex flex-col gap-0.5">
            {STATUS_ORDER.map((s) => {
              const count = statusCounts[s] ?? 0;
              const disabled = count === 0;
              return (
                <li key={s}>
                  <ClickableMetric
                    onClick={
                      disabled
                        ? undefined
                        : () =>
                            openDrilldown({
                              domain: "artwork_state",
                              artworkState: s,
                            })
                    }
                    disabled={disabled}
                    ariaLabel={`${STATE_LABEL_KR[s]} ${count}건 — 연결 작품 상세 보기`}
                    className="block w-full"
                  >
                    <div
                      className={cn(
                        "flex items-center justify-between px-2.5 py-1 rounded-md",
                        disabled ? "text-ink-subtle" : "text-ink-muted"
                      )}
                    >
                      <span className="text-[11.5px] tracking-tightish">
                        {STATE_LABEL_KR[s]}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] tabular-nums",
                          count > 0 ? "text-ink" : "text-ink-subtle"
                        )}
                      >
                        {count}
                      </span>
                    </div>
                  </ClickableMetric>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="h-3" />
        <NavGroup label="OPERATIONS" items={OPERATIONS} />

        {/* STEP UX-2 — GOVERNANCE group. governance/admin 항목을 시각적으로
            quieter한 색조로 묶음 — text-ink-subtle 기본, hover 시 lift. 백업
            health indicator는 GOVERNANCE 그룹 직하 sibling으로 위치하여
            "백업"이 GOVERNANCE bucket의 1급 항목임을 시각적으로 표현
            (사용자 spec 기준 구조). 기존 footer placement (STEP 59)에서 이동.
            기능 / 클릭 동작 / RBAC / health 계산 모두 변경 0줄 — 위치 polish만. */}
        <div className="mt-6">
          <NavGroup label="GOVERNANCE" items={GOVERNANCE} tone="muted" />
          <div className="mt-1.5 px-2">
            <BackupHealthSidebarIndicator />
          </div>
        </div>

        {/* Pending Approvals — live, clickable (rule_9, rule_7) */}
        <div className="mt-6 px-2">
          <div className="px-1 mb-2 flex items-baseline justify-between">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
              승인 대기
            </p>
            {approvals.length > 0 && (
              <span className="text-[10px] tabular-nums text-ink-muted font-medium">
                {approvals.length}
              </span>
            )}
          </div>
          {approvals.length === 0 ? (
            <p className="px-2.5 py-2 text-[11.5px] text-ink-subtle tracking-tightish">
              승인 대기 항목이 없습니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {approvals.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={item.open}
                    className={cn(
                      "group flex flex-col items-start w-full px-2.5 py-2 rounded-md",
                      "text-left text-ink hover:bg-surface-muted transition-colors"
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0 w-full">
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.accent }}
                      />
                      <span className="truncate text-[12.5px] tracking-tightish">
                        {item.label}
                      </span>
                    </span>
                    <span className="pl-3.5 mt-0.5 text-[10.5px] text-ink-subtle tracking-tightish">
                      {item.hint}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </nav>

      {/* Footer / role switcher (rule_7) + STEP 27 reset + STEP 30 sync status.
          STEP UX-2 — BackupHealthSidebarIndicator는 GOVERNANCE area로 이동
          (이전 footer 위치는 user spec의 GOVERNANCE bucket과 visual hierarchy
          상 어긋남). RoleSwitcher / ResetDataButton / SyncStatusIndicator 는
          여전히 *user/data context* 영역으로 footer 유지. */}
      <div className="border-t border-line p-2 flex flex-col gap-1.5">
        <RoleSwitcher />
        <ResetDataButton />
        <SyncStatusIndicator />
      </div>
    </aside>
  );
}

// STEP 27 — 작은 reset 링크. 개발 / 데모용 (사용자 spec: 숨김 / debug 영역).
// localStorage clear + mock data 재로드 + 모든 drawer close. 확인 prompt 1회.
// STEP 30 — remote도 함께 clear (있을 경우).
function ResetDataButton() {
  const resetAllData = useArtworkStore((s) => s.resetAllData);
  const handleClick = () => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "저장된 모든 데이터를 초기화하고 데모 시드로 되돌립니다. 계속하시겠습니까?"
    );
    if (!ok) return;
    resetAllData();
    // STEP 30 — remote도 비동기 clear (실패해도 silent)
    const remote = getActiveRemoteAdapter();
    if (remote) {
      remote.clearRemote().catch(() => {
        // silent
      });
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left px-2.5 py-1 rounded text-[10.5px] tracking-tightish text-ink-subtle hover:text-ink-muted hover:bg-surface-muted cursor-pointer transition-colors"
      title="저장된 데이터 초기화 (개발/데모용)"
    >
      저장 데이터 초기화
    </button>
  );
}

// STEP 30 — 작은 sync 상태 표시. "Local Only" 또는 "Remote Ready · {adapterId}".
// 실 백엔드 도입 시 isReal=true인 adapter면 더 prominent하게 표시 가능.
// 현재는 debug-style — 사용자 spec "최소화" 준수.
function SyncStatusIndicator() {
  // Render 시점에만 평가 — adapter는 mount 시점에 한 번 set되므로 충분.
  // 동적 변화가 필요해지면 zustand UI 슬라이스로 승격.
  const remote = typeof window !== "undefined" ? getActiveRemoteAdapter() : null;
  const label = remote
    ? `Remote Ready · ${remote.adapterId}${remote.isReal ? "" : " (mock)"}`
    : "Local Only";
  const dotColor = remote ? "bg-status-deal" : "bg-ink-subtle";
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 text-[9.5px] tracking-tightish text-ink-subtle"
      title={
        remote
          ? "Remote sync adapter 활성 — local에 저장 후 백그라운드로 push"
          : "Remote sync 비활성 — local 저장만 동작"
      }
    >
      <span
        className={cn("w-1 h-1 rounded-full shrink-0", dotColor)}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// STEP 59 — Backup Health Sidebar Indicator
//
// 절제된 톤의 작은 한 줄 indicator. Sidebar 하단 footer에 위치.
// - "백업: 오늘" / "백업 12일 전" / "백업 미실행"
// - 7일 이상: amber, 30일 이상: red
// - 클릭 시 DocumentsDrawer 열기 (Manager+ RBAC) — 즉시 백업 가능
// - tooltip = health.description (사용자 환기 메시지)
// ----------------------------------------------------------------------------
function BackupHealthSidebarIndicator() {
  const lastBackupAt = useArtworkStore((s) => s.backupMetadata.lastBackupAt);
  const openDocuments = useArtworkStore((s) => s.openDocuments);
  const currentRole = useArtworkStore((s) => s.currentRole);

  const health = React.useMemo(
    () => computeBackupHealth(lastBackupAt),
    [lastBackupAt]
  );

  // Manager+ 권한 있으면 클릭 시 Documents Drawer 열기 (백업 섹션으로 즉시 진입)
  const canOpenDocuments = hasPermission(currentRole, "report.view_global");
  const dotColor = sidebarDotClass(health.level);
  const labelClass = sidebarLabelClass(health.level);

  // Wrapper element: 권한 있으면 button, 없으면 div (단순 표시)
  const inner = (
    <>
      <span
        className={cn("w-1 h-1 rounded-full shrink-0", dotColor)}
        aria-hidden
      />
      <span className={cn("truncate", labelClass)}>{health.label}</span>
    </>
  );

  if (canOpenDocuments) {
    return (
      <button
        type="button"
        onClick={openDocuments}
        title={`${health.description} · 클릭하면 백업 섹션을 엽니다.`}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1",
          "text-[9.5px] tracking-tightish",
          "rounded transition-colors hover:bg-surface-muted/60 cursor-pointer",
          "text-left w-full"
        )}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 text-[9.5px] tracking-tightish text-ink-subtle"
      title={health.description}
    >
      {inner}
    </div>
  );
}

function sidebarDotClass(level: BackupHealth["level"]): string {
  switch (level) {
    case "never":
      return "bg-ink-subtle";
    case "fresh":
      return "bg-ink-muted";
    case "stale":
      return "bg-status-inquiry";
    case "expired":
      return "bg-status-deal";
  }
}

function sidebarLabelClass(level: BackupHealth["level"]): string {
  switch (level) {
    case "never":
      return "text-ink-subtle";
    case "fresh":
      return "text-ink-subtle";
    case "stale":
      return "text-status-inquiry";
    case "expired":
      return "text-status-deal";
  }
}

function NavGroup({
  label,
  items,
  tone = "default",
}: {
  label: string;
  items: NavItem[];
  /**
   * STEP UX-2 — 시각 톤. "default"는 기존 동작 (text-ink-muted 기본).
   * "muted"는 GOVERNANCE 같은 quieter 영역용 — text-ink-subtle 기본으로
   * 색조 한 단계 dim, hover 시 text-ink-muted로 lift. 항목 간 간격 / 폰트
   * 사이즈 / 패딩은 동일 — 시각적 차이는 *기본 색조*만.
   */
  tone?: "default" | "muted";
}) {
  const idleClass =
    tone === "muted"
      ? "text-ink-subtle hover:text-ink-muted hover:bg-surface-muted"
      : "text-ink-muted hover:text-ink hover:bg-surface-muted";
  return (
    <div className="px-2">
      <p className="px-1 mb-2 text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
        {label}
      </p>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          // STEP 40 — three-way state: active / disabled / normal.
          // active와 disabled는 상호 배타 (active 우선이지만 데이터상 둘 다 true가
          // 들어올 수 없도록 데이터 정의에서 보장).
          const isDisabled = !!item.disabled && !item.active;
          return (
            <li key={item.label}>
              <button
                type="button"
                disabled={isDisabled}
                aria-disabled={isDisabled || undefined}
                tabIndex={isDisabled ? -1 : undefined}
                title={isDisabled ? item.hint : undefined}
                onClick={isDisabled ? undefined : item.onClick}
                className={cn(
                  "flex items-center w-full px-2.5 py-2 rounded-md text-[13px] tracking-tightish transition-colors",
                  item.active
                    ? "bg-surface-muted text-ink font-medium"
                    : isDisabled
                    ? "text-ink-subtle opacity-60 cursor-not-allowed"
                    : idleClass
                )}
              >
                <span className="flex-1 text-left truncate">{item.label}</span>
                {isDisabled && item.hint && (
                  <span
                    className="ml-2 text-[9.5px] tracking-tightish text-ink-subtle truncate shrink-0 max-w-[7.5rem]"
                    aria-hidden
                  >
                    {item.hint}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// STEP UX-2 — `AuditIcon` removed. 이전 standalone "전체 감사 로그" custom
// button (ux 통일성을 위해 GOVERNANCE NavGroup item으로 흡수) 외에는 사용처가
//없었으며, NavGroup 항목 시각 톤 (icon-less) 일관 정책에 따라 함께 제거.

// ============================================================================
// STEP 117 — Artwork Registration Draft Resume Entry
// ============================================================================
//
// **본 컴포넌트의 정체**:
//   진행 중 작품 등록의 임시 저장 (`artworkDraft`) 이 store 에 존재할 때
//   Sidebar 에 표시되는 *resume CTA*. 사용자가 새 작품 등록을 시작했지만
//   완료 전에 drawer 를 닫고 다른 작업을 하다가도, 진행 중 입력으로 다시
//   진입할 수 있는 단일 entry point.
//
// **Zero-state pattern**:
//   `artworkDraft === undefined` → null return → entry 자연 비표시. 별도
//   조건부 분기 없이 mount 점에서 unconditional 하게 렌더 가능.
//
// **rule_9 Work Queue 정책 정합**:
//   - 실행 가능 (단일 click → 즉시 drawer 진입 + form hydrate)
//   - 알림 / 노티 성격 0 (action-first)
//   - 시각적 noise 최소 — Sidebar 240px 안의 1 row card
//
// **Phase 4 §4.4 Draft-safe 정착**:
//   사용자 의도하지 않은 데이터 손실 0건 보장. 임시 저장 → drawer 닫음 →
//   페이지 reload → DraftResumeEntry 표시 → 클릭 → 4-tab fields 모두 복원.
//
// **rule_16 design tone**:
//   border-line 1px, bg-surface, hover bg-surface-muted, 그림자 0.
//   text 12.5px (preview) + 10.5px (relative time) — Pretendard 한국어 UI.
// ============================================================================

function DraftResumeEntry() {
  const draft = useArtworkStore((s) => s.artworkDraft);
  const openCreate = useArtworkStore((s) => s.openCreate);

  // Zero-state — draft 부재 시 자연 비표시. mount 점에서 unconditional render
  // 가능 (별도 wrapper 분기 불필요).
  if (!draft) return null;

  const preview = extractDraftPreviewLabel(draft);
  const relativeTime = formatDraftRelativeTime(draft.lastEditedAt);

  return (
    <div className="mt-5 px-2">
      <p className="px-1 mb-2 text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
        이어 작성
      </p>
      <button
        type="button"
        onClick={openCreate}
        className="flex flex-col w-full px-2.5 py-2 rounded-md border border-line bg-surface hover:bg-surface-muted transition-colors text-left gap-0.5"
        aria-label={`작품 등록 임시 저장 — ${preview} / ${relativeTime} 이어 작성`}
      >
        <span className="text-[12.5px] tracking-tightish text-ink truncate">
          {preview}
        </span>
        <span className="text-[10.5px] tabular-nums text-ink-subtle tracking-tightish">
          {relativeTime}
        </span>
      </button>
    </div>
  );
}
