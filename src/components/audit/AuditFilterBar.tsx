// ============================================================================
// AuditFilterBar — STEP 24 (Audit Filters 강화)
//
// 단일 작품 (AuditLogDrawer) / 전체 작품 (GlobalAuditDrawer) 공용 필터 UI.
// 사용자 spec 명시 6 차원: date range / search / domain[] / actorType[] /
// actorRole[] / (Global only) artworkIds[]. 모든 필드는 chip / native input
// 기반 — 복잡한 테이블 / 외부 라이브러리 없음.
//
// Controlled component — `state` + `onChange` + `onReset` 3개 prop만으로
// 동작. 부모 drawer가 useState로 AuditFilterState 보유, AuditFilterBar는
// 표시 + 토글만.
//
// `mode === "single"`은 단일 작품 — artworkIds row 숨김. global은 모든 row 표시.
//
// Multi-select 정책: chip 클릭 = toggle. 빈 array = "전체 통과" (= 필터 비활성).
// ============================================================================

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
  AuditDomain,
  AuditActorTypeBroad,
  AuditFilterState,
  AuditRoleFilter,
} from "@/lib/audit-helpers";
import {
  EMPTY_AUDIT_FILTER_STATE,
  isAuditFilterActive,
} from "@/lib/audit-helpers";
import type { Artwork } from "@/types/artwork";

const DOMAIN_CHIPS: Array<{ value: AuditDomain; label: string }> = [
  { value: "AI",          label: "AI" },
  { value: "DOCUMENT",    label: "문서" },
  { value: "MONEY",       label: "정산·결제·세무" },
  { value: "LOGISTICS",   label: "물류" },
  { value: "INQUIRY",     label: "Inquiry" },
  { value: "TRANSACTION", label: "거래" },
  { value: "STATE",       label: "상태 전환" },
  { value: "NOTE",        label: "노트" },
];

const ACTOR_TYPE_CHIPS: Array<{ value: AuditActorTypeBroad; label: string }> = [
  { value: "AI",     label: "AI" },
  { value: "HUMAN",  label: "사람" },
  { value: "SYSTEM", label: "System" },
];

const ROLE_CHIPS: Array<{ value: AuditRoleFilter; label: string }> = [
  { value: "STAFF",   label: "Staff" },
  { value: "MANAGER", label: "Manager" },
  { value: "OWNER",   label: "Owner" },
];

interface AuditFilterBarProps {
  state: AuditFilterState;
  onChange: (next: AuditFilterState) => void;
  /** "single" — AuditLogDrawer / "global" — GlobalAuditDrawer */
  mode: "single" | "global";
  /** Global mode에서 artwork 필터 chip의 source. single mode면 무시. */
  artworks?: Artwork[];
}

export function AuditFilterBar({
  state,
  onChange,
  mode,
  artworks,
}: AuditFilterBarProps) {
  const active = isAuditFilterActive(state);

  function patch<K extends keyof AuditFilterState>(
    key: K,
    value: AuditFilterState[K]
  ) {
    onChange({ ...state, [key]: value });
  }

  function toggleInArray<T>(arr: T[], item: T): T[] {
    return arr.includes(item)
      ? arr.filter((x) => x !== item)
      : [...arr, item];
  }

  function reset() {
    onChange(EMPTY_AUDIT_FILTER_STATE);
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Row 1 — Search + Reset */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={state.search}
          onChange={(e) => patch("search", e.target.value)}
          placeholder="검색 — 제목 / 상세 / 작성자 / 작품"
          className="flex-1 h-7 px-2.5 rounded border border-line bg-surface text-[11.5px] text-ink tracking-tightish placeholder:text-ink-subtle focus:outline-none focus:border-line-strong"
        />
        <button
          type="button"
          onClick={reset}
          disabled={!active}
          className={cn(
            "h-7 px-2.5 rounded text-[10.5px] tracking-tightish border transition-colors shrink-0",
            active
              ? "border-line text-ink-muted hover:bg-surface-muted hover:text-ink cursor-pointer"
              : "border-line text-ink-subtle opacity-50 cursor-not-allowed"
          )}
          title={active ? "모든 필터 초기화" : "활성 필터 없음"}
        >
          필터 초기화
        </button>
      </div>

      {/* Row 2 — Date range */}
      <div className="flex items-center gap-2">
        <span className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold w-12 shrink-0">
          기간
        </span>
        <input
          type="date"
          value={state.startDate}
          onChange={(e) => patch("startDate", e.target.value)}
          max={state.endDate || undefined}
          className="h-7 px-2 rounded border border-line bg-surface text-[11.5px] text-ink tracking-tightish focus:outline-none focus:border-line-strong"
          aria-label="시작일"
        />
        <span className="text-[10.5px] text-ink-subtle">~</span>
        <input
          type="date"
          value={state.endDate}
          onChange={(e) => patch("endDate", e.target.value)}
          min={state.startDate || undefined}
          className="h-7 px-2 rounded border border-line bg-surface text-[11.5px] text-ink tracking-tightish focus:outline-none focus:border-line-strong"
          aria-label="종료일"
        />
      </div>

      {/* Row 3 — Domain multi-select */}
      <ChipMultiSelect
        label="유형"
        chips={DOMAIN_CHIPS}
        selected={state.domains}
        onToggle={(v) => patch("domains", toggleInArray(state.domains, v))}
      />

      {/* Row 4 — Actor type */}
      <ChipMultiSelect
        label="작성자"
        chips={ACTOR_TYPE_CHIPS}
        selected={state.actorTypes}
        onToggle={(v) => patch("actorTypes", toggleInArray(state.actorTypes, v))}
      />

      {/* Row 5 — Actor role */}
      <ChipMultiSelect
        label="권한"
        chips={ROLE_CHIPS}
        selected={state.actorRoles}
        onToggle={(v) => patch("actorRoles", toggleInArray(state.actorRoles, v))}
      />

      {/* Row 6 — Artwork (global only) */}
      {mode === "global" && artworks && artworks.length > 0 && (
        <ChipMultiSelect
          label="작품"
          chips={artworks.map((a) => ({
            value: a.id,
            label: `${a.title} · ${a.artist.name}`,
          }))}
          selected={state.artworkIds}
          onToggle={(v) => patch("artworkIds", toggleInArray(state.artworkIds, v))}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Internal — ChipMultiSelect
// ----------------------------------------------------------------------------

interface ChipMultiSelectProps<T extends string> {
  label: string;
  chips: Array<{ value: T; label: string }>;
  selected: T[];
  onToggle: (value: T) => void;
}

function ChipMultiSelect<T extends string>({
  label,
  chips,
  selected,
  onToggle,
}: ChipMultiSelectProps<T>) {
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10.5px] text-ink-subtle uppercase tracking-[0.14em] font-semibold pt-1 shrink-0 w-12">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((opt) => {
          const active = selectedSet.has(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={cn(
                "h-6 px-2.5 rounded-full text-[11px] tracking-tightish transition-colors border",
                active
                  ? "bg-ink text-white border-ink"
                  : "bg-surface text-ink-muted border-line enabled:hover:bg-surface-muted enabled:hover:text-ink"
              )}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
