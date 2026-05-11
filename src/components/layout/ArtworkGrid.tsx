"use client";

import { useMemo } from "react";
import { ArtworkCard } from "@/components/artwork/ArtworkCard";
import { SearchBar } from "@/components/artwork/SearchBar";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";

export function ArtworkGrid() {
  const artworks = useArtworkStore((s) => s.artworks);
  const selectedArtworkId = useArtworkStore((s) => s.selectedArtworkId);
  const select = useArtworkStore((s) => s.select);
  const query = useArtworkStore((s) => s.query);
  const stateFilter = useArtworkStore((s) => s.stateFilter);
  const openCreate = useArtworkStore((s) => s.openCreate);

  const filtered = useMemo(() => {
    return artworks.filter((a) => {
      if (stateFilter !== "ALL" && a.state !== stateFilter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.artist.name.toLowerCase().includes(q) ||
        a.artist.nameEn?.toLowerCase().includes(q) ||
        a.axid.code.toLowerCase().includes(q)
      );
    });
  }, [artworks, query, stateFilter]);

  return (
    <main className="flex-1 min-w-0 h-full overflow-y-auto scroll-clean">
      <div className="px-10 pt-10 pb-6">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 mb-6">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-ink-subtle uppercase mb-2">
              Workspace
            </p>
            <h1 className="text-[26px] font-semibold text-ink tracking-tight2">
              작품 리스트
            </h1>
            <p className="mt-1.5 text-[13px] text-ink-muted tracking-tightish">
              모든 데이터의 출발점.{" "}
              <span className="text-ink-subtle">
                Single Source of Truth — Artwork
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[12px] text-ink-muted tabular-nums">
              총 {artworks.length}점
              <span className="text-line-strong mx-1.5">·</span>
              표시 {filtered.length}점
            </span>
            <Button variant="primary" size="md" onClick={openCreate}>
              <PlusIcon />
              작품 추가
            </Button>
          </div>
        </div>

        {/* Search + filter */}
        <div className="mb-7">
          <SearchBar />
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {filtered.map((artwork) => (
              <ArtworkCard
                key={artwork.id}
                artwork={artwork}
                selected={selectedArtworkId === artwork.id}
                onSelect={select}
              />
            ))}
          </div>
        ) : (
          <EmptyState onCreate={openCreate} />
        )}
      </div>
    </main>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-12 w-12 rounded-full border border-line flex items-center justify-center mb-4">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-ink-subtle"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <p className="text-[14px] font-medium text-ink tracking-tightish">
        결과가 없습니다
      </p>
      <p className="text-[12px] text-ink-muted mt-1 mb-4">
        검색어 또는 상태 필터를 조정하거나, 새 작품을 추가해 보세요.
      </p>
      <Button variant="secondary" size="sm" onClick={onCreate}>
        <PlusIcon />
        새 작품 추가
      </Button>
    </div>
  );
}
