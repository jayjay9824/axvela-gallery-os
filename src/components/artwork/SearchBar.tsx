"use client";

import { useArtworkStore } from "@/store/useArtworkStore";
import { cn, STATE_LABEL_KR } from "@/lib/utils";
import type { ArtworkState } from "@/types/artwork";

const FILTERS: ("ALL" | ArtworkState)[] = [
  "ALL",
  "DRAFT",
  "READY",
  "INQUIRY",
  "DEAL",
  "PAID",
  "CLOSED",
];

export function SearchBar() {
  const { query, setQuery, stateFilter, setStateFilter } = useArtworkStore();

  return (
    <div className="flex flex-col gap-3">
      {/* Search input */}
      <div className="relative">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="작품 제목, 작가, AXID 검색"
          className={cn(
            "w-full h-10 pl-10 pr-4 rounded-md",
            "bg-surface border border-line",
            "text-sm text-ink placeholder:text-ink-subtle",
            "focus:border-ink-muted focus:outline-none transition-colors"
          )}
        />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = stateFilter === f;
          const label = f === "ALL" ? "전체" : STATE_LABEL_KR[f];
          return (
            <button
              key={f}
              onClick={() => setStateFilter(f)}
              className={cn(
                "h-7 px-3 rounded-full text-[12px] font-medium tracking-tightish transition-colors",
                "border",
                active
                  ? "bg-ink text-white border-ink"
                  : "bg-surface text-ink-muted border-line hover:text-ink hover:border-line-strong"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
