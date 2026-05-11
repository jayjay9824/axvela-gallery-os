"use client";

import * as React from "react";
import {
  resolveAuditEventTarget,
  type AuditTarget,
  type AuditNavigationInfo,
  type AuditChainDetail,
  type AuditNavigationStoreView,
} from "@/lib/audit-navigation";
import {
  type AuditDomain,
  type AuditActorType,
  type AuditEmphasis,
  type ClassifiedAuditEvent,
} from "@/lib/audit-helpers";
import { formatRelativeKR, cn } from "@/lib/utils";
import { ROLE_LABEL_KR } from "@/lib/rbac";

// ============================================================================
// AuditEventCard — STEP 20 분류 + STEP 21 navigation + STEP 23 cross-artwork
//
// AuditLogDrawer (단일 작품)와 GlobalAuditDrawer (전체 갤러리) 양쪽에서 재사용.
// 시각 primitive (badge / pill / icon)도 함께 export — 두 drawer 모두 같은
// 디자인 시스템 사용을 보장.
//
// 구조:
//   - artworkLabel(선택)  ← STEP 23: 어떤 작품 이벤트인지 카드 상단에 표시
//   - top row             domain badge / version / correction / timestamp
//   - title row           emphasis icon + 제목
//   - detail              부가 설명
//   - chain hint pill     "v1 → v2" / "원본 → 수정본"
//   - chain detail block  parentId / currentId 인라인 (STEP 21)
//   - bottom row          actor 이름 + actor pill
//   - navigation footer   "관련 기록 열기 →" / "연결된 객체 없음" (STEP 21)
// ============================================================================

export interface AuditEventCardProps {
  classified: ClassifiedAuditEvent;
  artworkId: string;
  navStore: AuditNavigationStoreView;
  onDispatch: (target: AuditTarget) => void;
  /**
   * STEP 23 — Cross-artwork view에서 카드 상단에 작품 식별 rib 표시.
   * AuditLogDrawer (단일 작품)에서는 미설정 → rib 표시 안 함.
   */
  artworkLabel?: string;
}

export function AuditEventCard({
  classified,
  artworkId,
  navStore,
  onDispatch,
  artworkLabel,
}: AuditEventCardProps) {
  const { event, domain, actorType, emphasis, version, isCorrection, chainHint } =
    classified;
  const hasEmphasis = emphasis !== null;

  // STEP 21 — Resolve target + chain at render time. resolver는 store
  // slices 중 일부만 의존하므로 컴포넌트 props로 전달된 navStore를 그대로 패스.
  const navigation: AuditNavigationInfo = React.useMemo(
    () => resolveAuditEventTarget(event, artworkId, navStore),
    [event, artworkId, navStore]
  );

  const target = navigation.target;
  const chain = navigation.chain;
  const isClickable = target !== null;

  const handleClick = () => {
    if (target) onDispatch(target);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!target) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onDispatch(target);
    }
  };

  return (
    <article
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={
        isClickable ? `${event.title} — 관련 기록 열기` : event.title
      }
      className={cn(
        "rounded-md border bg-surface p-3.5 transition-colors outline-none",
        hasEmphasis ? "border-line-strong" : "border-line",
        isClickable
          ? "cursor-pointer hover:bg-surface-muted hover:border-line-strong focus-visible:border-ink"
          : "cursor-default"
      )}
    >
      {/* STEP 23 — Artwork rib (cross-artwork view 전용) */}
      {artworkLabel && (
        <div className="mb-2 -mt-0.5">
          <span className="text-[10.5px] tracking-tightish text-ink-subtle font-medium">
            {artworkLabel}
          </span>
        </div>
      )}

      {/* Top row — domain badge, chain pills, timestamp */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <DomainBadge domain={domain} />
          {version !== null && <VersionPill version={version} />}
          {isCorrection && <CorrectionPill />}
        </div>
        <span className="text-[10.5px] text-ink-subtle tabular-nums tracking-tightish shrink-0">
          {formatRelativeKR(event.at)}
        </span>
      </div>

      {/* Title row — emphasis icon + title */}
      <div className="flex items-start gap-2">
        {hasEmphasis && <EmphasisIcon emphasis={emphasis} />}
        <p
          className={cn(
            "text-[13px] text-ink leading-snug tracking-tight2 min-w-0 flex-1",
            hasEmphasis ? "font-semibold" : "font-medium"
          )}
        >
          {event.title}
        </p>
      </div>

      {/* Detail line */}
      {event.detail && (
        <p className="mt-1 text-[11.5px] text-ink-muted leading-relaxed tracking-tightish">
          {event.detail}
        </p>
      )}

      {/* Chain hint pill — "v1 → v2" or "원본 → 수정본" (audit-helpers 분류) */}
      {chainHint && (
        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-muted border border-line">
          <ChainIcon />
          <span className="text-[10.5px] text-ink-muted font-mono tabular-nums tracking-tightish">
            {chainHint}
          </span>
        </div>
      )}

      {/* STEP 21 — Chain detail expanded area: parentId / currentId 등 */}
      {chain && <ChainDetailBlock chain={chain} />}

      {/* Bottom row — actor + actor role */}
      <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between gap-2">
        <span className="text-[10.5px] text-ink-muted tracking-tightish truncate">
          {event.actor ?? "—"}
        </span>
        <ActorPill actorType={actorType} />
      </div>

      {/* STEP 21 — Navigation footer: 관련 기록 열기 / 연결된 객체 없음 */}
      <NavigationFooter target={target} />
    </article>
  );
}

// ============================================================================
// Chain detail expanded area — STEP 21
// ============================================================================

function ChainDetailBlock({ chain }: { chain: AuditChainDetail }) {
  return (
    <div className="mt-2 px-2.5 py-2 rounded bg-surface-muted border border-line">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase mb-1.5">
        체인 상세
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] tracking-tightish">
        <dt className="text-ink-subtle">현재</dt>
        <dd className="text-ink-muted font-mono tabular-nums">
          {chain.currentId}
          {chain.currentLabel && (
            <span className="ml-1.5 text-ink-subtle">· {chain.currentLabel}</span>
          )}
        </dd>
        {chain.parentId ? (
          <>
            <dt className="text-ink-subtle">
              {chain.type === "correction" ? "원본" : "부모"}
            </dt>
            <dd className="text-ink-muted font-mono tabular-nums">
              {chain.parentId}
              {chain.parentLabel && (
                <span className="ml-1.5 text-ink-subtle">
                  · {chain.parentLabel}
                </span>
              )}
            </dd>
          </>
        ) : (
          <>
            <dt className="text-ink-subtle">시작</dt>
            <dd className="text-ink-subtle italic">초기 버전 — 부모 없음</dd>
          </>
        )}
      </dl>
    </div>
  );
}

// ============================================================================
// Navigation footer — STEP 21
// ============================================================================

function NavigationFooter({ target }: { target: AuditTarget | null }) {
  if (target) {
    return (
      <div className="mt-2.5 pt-2 border-t border-dashed border-line flex items-center justify-between gap-2">
        <span className="text-[10.5px] text-ink-muted tracking-tightish">
          관련 기록 열기
        </span>
        <ChevronRightIcon />
      </div>
    );
  }
  return (
    <div className="mt-2.5 pt-2 border-t border-dashed border-line">
      <span className="text-[10.5px] text-ink-subtle italic tracking-tightish">
        연결된 객체 없음
      </span>
    </div>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 text-ink-muted shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// ============================================================================
// Visual primitives — badges, pills, icons
// AuditLogDrawer + GlobalAuditDrawer 양쪽 filter chip row에서도 일부 재사용.
// ============================================================================

export const DOMAIN_LABEL: Record<AuditDomain, string> = {
  AI: "AI",
  DOCUMENT: "Doc",
  MONEY: "Money",
  LOGISTICS: "Logistics",
  INQUIRY: "Inquiry",
  TRANSACTION: "Tx",
  STATE: "State",
  NOTE: "Note",
};

export const DOMAIN_COLOR: Record<AuditDomain, string> = {
  AI: "#5E3FB8",         // status-brokered purple — AI 전용 톤
  DOCUMENT: "#5A574F",   // muted neutral
  MONEY: "#1E5FBF",      // status-deal blue
  LOGISTICS: "#B97A1F",  // amber
  INQUIRY: "#1E5FBF",    // blue (Inquiry status_color와 동일)
  TRANSACTION: "#5A574F",// muted neutral
  STATE: "#94908A",      // 매우 절제된 톤
  NOTE: "#94908A",       // 매우 절제된 톤
};

export function DomainBadge({ domain }: { domain: AuditDomain }) {
  const color = DOMAIN_COLOR[domain];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] uppercase bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{DOMAIN_LABEL[domain]}</span>
    </span>
  );
}

function VersionPill({ version }: { version: number }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold font-mono tabular-nums tracking-tightish bg-surface-muted text-ink-muted border border-line">
      v{version}
    </span>
  );
}

function CorrectionPill() {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-tightish bg-surface-muted text-ink-muted border border-line">
      수정본
    </span>
  );
}

function ActorPill({ actorType }: { actorType: AuditActorType }) {
  const label =
    actorType === "AI"
      ? "AI"
      : actorType === "SYSTEM"
        ? "System"
        : ROLE_LABEL_KR[actorType];

  // 색조: AI (purple) / SYSTEM (subtle) / ROLE (rbac.ROLE_COLOR 차용은
  // import 경로 길어지므로 inline)
  const color =
    actorType === "AI"
      ? "#5E3FB8"
      : actorType === "OWNER"
        ? "#5E3FB8"
        : actorType === "MANAGER"
          ? "#1E5FBF"
          : actorType === "STAFF"
            ? "#6B6B6B"
            : "#94908A"; // SYSTEM

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-tightish bg-surface border border-line shrink-0">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{label}</span>
    </span>
  );
}

function EmphasisIcon({ emphasis }: { emphasis: AuditEmphasis }) {
  if (emphasis === null) return null;
  switch (emphasis) {
    case "LOCK":
      return <LockIcon />;
    case "APPROVED":
      return <CheckIcon />;
    case "CORRECTION":
      return <RevisionIcon />;
    case "PAYMENT":
    case "SETTLEMENT":
    case "TAX_ISSUED":
      return <MoneyIcon />;
  }
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-ink-muted shrink-0 mt-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="잠금"
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-status-deal shrink-0 mt-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="승인"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function RevisionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-ink-muted shrink-0 mt-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="수정본"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-status-deal shrink-0 mt-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="머니 플로우 이벤트"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v12" />
      <path d="M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1.1-3 2.5S10.3 12 12 12s3 1.1 3 2.5-1.3 2.5-3 2.5-3-1.1-3-2.5" />
    </svg>
  );
}

function ChainIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 text-ink-subtle shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.5 8.5h-2a4 4 0 0 0 0 8h2" />
      <path d="M14.5 8.5h2a4 4 0 0 1 0 8h-2" />
      <path d="M9 12.5h6" />
    </svg>
  );
}
