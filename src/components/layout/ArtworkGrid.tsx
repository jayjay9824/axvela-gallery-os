"use client";

import { useMemo } from "react";
import { ArtworkCard } from "@/components/artwork/ArtworkCard";
// STEP 131 Phase 2 Commit 2 — viewMode 분기 wire 진입점.
// PassportCard (Closed Passport, Commit 1 정착) + ViewModeToggle (Grid header
// 통합, Commit 1 정착) 의 첫 production 호출처.
// 사용자 §8 항목 1, 2, 3 결정 정합:
//   - ArtworkCard + PassportCard 둘 다 보존 (replace 절대 금지)
//   - ArtworkGrid 확장 + viewMode 분기 (PassportListView 신설 폐기, ~120 LOC 절약)
//   - ViewModeToggle 위치 = Grid header
import { PassportCard } from "@/components/artwork/PassportCard";
import { ViewModeToggle } from "@/components/artwork/ViewModeToggle";
import { SearchBar } from "@/components/artwork/SearchBar";
import { Button } from "@/components/ui/Button";
import { useArtworkStore } from "@/store/useArtworkStore";
import { MobilePassportStack } from "@/components/mobile/MobilePassportStack";
import { PassportUnfoldView } from "@/components/mobile/PassportUnfoldView";

export function ArtworkGrid() {
  const artworks = useArtworkStore((s) => s.artworks);
  const selectedArtworkId = useArtworkStore((s) => s.selectedArtworkId);
  const select = useArtworkStore((s) => s.select);
  const query = useArtworkStore((s) => s.query);
  const stateFilter = useArtworkStore((s) => s.stateFilter);
  const openCreate = useArtworkStore((s) => s.openCreate);

  // STEP 131 Phase 2 Commit 2 — ArtworkGrid display mode (grid / passport)
  // store wire. P1 (Persistence 0) 정착물 — 세션마다 default "grid" 자동
  // 초기화. 사용자 §8 항목 6 결정 정합.
  const viewMode = useArtworkStore((s) => s.viewMode);
  const setViewMode = useArtworkStore((s) => s.setViewMode);
// STEP 131.5 Phase 2 Commit 4 — selectedArtwork 객체 조회 (PassportUnfoldView wire).
  // store 에는 selectedArtworkId (string | null) 만 저장 → artworks 배열에서 find.
  // DetailPanel 패턴 정합 (artworks + selectedArtworkId 별도 구독 후 컴포넌트 내 join).
  const selectedArtwork = artworks.find((a) => a.id === selectedArtworkId);
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
            {/* STEP 131 Phase 2 Commit 2 — Grid header ViewModeToggle 통합.
                사용자 §8 항목 1 결정 정합 (Grid header 위치). rule_15
                (≤3 button) 한계 내: 본 영역 button = 작품 추가 (1) +
                ViewModeToggle (2 toggle button = 1 logical control) = 2.
                STEP 130 Sidebar header `justify-between` 패턴 답습 (header
                내부 utility 우측 align). */}
            <ViewModeToggle mode={viewMode} onChange={setViewMode} />
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

        {/* Grid — STEP 131 Phase 2 Commit 2 viewMode 분기 wire.
            사용자 §8 항목 2/3 결정 정합:
              - viewMode === "grid"     → ArtworkCard (기존 정착물, replace 0)
              - viewMode === "passport" → PassportCard (Closed Passport, Commit 1)
            grid layout / filter / EmptyState 0줄 변경 — 카드 컴포넌트만 분기. */}
        {filtered.length > 0 ? (
          <>
            {/* STEP 131.5 Phase 2 Commit 3 — Mobile (≤768px) Passport Stack wire.
                §11 (b) 결정 (옵션 A): MobilePassportStack 신설 채택 — Commit 1
                Foundation 정합. Mobile viewport 에서만 진입 (md:hidden), Desktop
                ≥769px 무손상. viewMode === "passport" 일 때만 진입 (grid 모드는
                기존 grid 분기 유지).
                §11 (h) Smartphone 우선 (≤768px) — Tablet 은 Desktop fallback.
                Tailwind CSS-only 분기 (Commit 2 Sidebar/TopNav 패턴 정합) — JS
                viewport 훅 0건, bundle 영향 ~3 kB (MobilePassportStack lazy
                없이 직접 import). */}
            {viewMode === "passport" && (
              <div className="md:hidden">
                <MobilePassportStack
                  artworks={filtered}
                  selectedArtworkId={selectedArtworkId}
                  onCardTap={(a) => select(a.id)}
                />
              </div>
            )}

            {/* Desktop (≥769px) — 기존 grid 분기 보존 (rule_14 Desktop Layout
                Contract). viewMode === "passport" 일 때만 md:grid 적용 (mobile
                에서 grid 와 Stack 동시 노출 방지). viewMode === "grid" 는 양쪽
                viewport 에서 동일 grid 유지 (기존 정착물 무손상). */}
            <div
              className={
                viewMode === "passport"
                  ? "hidden md:grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5"
                  : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5"
              }
            >
              {filtered.map((artwork) =>
                viewMode === "passport" ? (
                  <PassportCard
                    key={artwork.id}
                    artwork={artwork}
                    isSelected={selectedArtworkId === artwork.id}
                    onClick={(a) => select(a.id)}
                  />
                ) : (
                  <ArtworkCard
                    key={artwork.id}
                    artwork={artwork}
                    selected={selectedArtworkId === artwork.id}
                    onSelect={select}
                  />
                ),
              )}
            </div>
            {/* STEP 131.5 Phase 2 Commit 4 — Mobile PassportUnfoldView wire.
                §11 (c) 결정 (Foundation 신설만, In-Passport Navigation STEP 133 이월):
                Mobile 에서 PassportCard tap → MobilePassportStack.onCardTap →
                ArtworkGrid 의 select(a.id) → selectedArtworkId 세팅 → 본 분기 진입
                → full-screen PassportUnfoldView 등장 (PASSPORT-1 spec §4 정합).
                swipe-down close (PassportUnfoldView 내부 @use-gesture/react 처리)
                → onClose 호출 → select(null) → 본 분기 사라짐.
                Desktop ≥769px 무손상 (md:hidden 분기) — 기존 DetailPanel 패턴 보존. */}
            {viewMode === "passport" && selectedArtwork && (
              <div className="md:hidden">
                <PassportUnfoldView
                  artwork={selectedArtwork}
                  onClose={() => select(null)}
                />
              </div>
            )}
          </>
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
