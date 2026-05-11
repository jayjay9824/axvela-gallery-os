"use client";

import { useArtworkStore } from "@/store/useArtworkStore";
import { Button } from "@/components/ui/Button";
import {
  formatRelativeKR,
  CURATION_STATUS_LABEL,
  CURATION_STATUS_COLOR,
} from "@/lib/utils";
import type { CurationStatus } from "@/types/curation";

// ============================================================================
// CurationSummary — DetailPanel 내 큐레이션 노트 요약 카드 (STEP 16, rule_18 (a)).
// CurationNote가 존재할 때만 렌더 (없으면 null) — DetailPanel은 항상 호출하고
// 시드 부재 시 자동으로 사라지는 디자인. 노트 생성은 DRAFT 상태의 supporting
// action "AI 큐레이션 초안" 버튼 진입점에서 처리.
// ============================================================================

interface CurationSummaryProps {
  artworkId: string;
}

export function CurationSummary({ artworkId }: CurationSummaryProps) {
  const curationNotes = useArtworkStore((s) => s.curationNotes);
  const openCurationDraft = useArtworkStore((s) => s.openCurationDraft);

  const list = curationNotes[artworkId] ?? [];
  const latest = list[0];

  if (!latest) return null;

  return (
    <section className="px-6 py-5 border-b border-line">
      <SectionHeader
        label="Curation"
        hint={`v${latest.version} · ${CURATION_STATUS_LABEL[latest.status]}`}
      />

      <div className="mt-3 rounded-md border border-line p-3.5">
        {/* Status row */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <StatusPill status={latest.status} />
            {latest.status === "LOCKED" && <LockMiniIcon />}
          </div>
          <span className="text-[10.5px] text-ink-subtle font-mono tabular-nums tracking-tightish">
            v{latest.version}
          </span>
        </div>

        {/* Headline preview */}
        <p className="text-[13px] font-semibold text-ink leading-snug tracking-tight2 line-clamp-2">
          {latest.headline}
        </p>
        {latest.subheadline && (
          <p className="mt-1.5 text-[11px] text-ink-muted tracking-tightish line-clamp-1">
            {latest.subheadline}
          </p>
        )}

        {/* Timestamp */}
        <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
          <span className="text-[10.5px] text-ink-subtle tracking-tightish">
            마지막 수정
          </span>
          <span className="text-[10.5px] text-ink-muted tabular-nums tracking-tightish">
            {formatRelativeKR(latest.updatedAt)}
          </span>
        </div>
      </div>

      <div className="mt-2.5">
        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-between"
          onClick={() => openCurationDraft(artworkId)}
        >
          <span>큐레이션 상세</span>
          <ChevronRightIcon />
        </Button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Local primitives
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: CurationStatus }) {
  const color = CURATION_STATUS_COLOR[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium tracking-tightish bg-surface border border-line">
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{CURATION_STATUS_LABEL[status]}</span>
    </span>
  );
}

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="text-[11px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
        {label}
      </h3>
      {hint && (
        <span className="text-[10.5px] text-ink-subtle tracking-tightish">
          {hint}
        </span>
      )}
    </div>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function LockMiniIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3 text-ink-subtle shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="잠김"
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
