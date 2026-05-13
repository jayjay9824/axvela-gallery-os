"use client";

// =====================================================
// AXVELA — Mobile Passport Stack (STEP 131.5 Phase 2 Commit 1, Foundation)
// =====================================================
//
// **본 component 의 정체**:
//   ArtworkGrid (Desktop 4-col grid 운영자 surface) 의 *Mobile-first 대체
//   surface*. Apple Wallet pass stack 메타포 정합 — Closed Passport 카드의
//   single-column vertical stack 표시.
//
// **Multi-Surface Architecture 정합** (STEP 131.5 Phase 1 §4 정착):
//   - Gallery OS Desktop ArtworkGrid (정착물 보존) — viewMode grid/passport
//     분기 + 4-col responsive
//   - Mobile Passport Stack (본 component) — *별도 dimension*, single-col
//     stack + slightly stacked spacing + swipe-friendly tap target
//   - 같은 데이터 (rule_1 SSOT `artwork.id`) / 다른 UX surface
//
// **ChatGPT + Claude 통합 시각 흡수** (Phase 1 §3 정착):
//   - "PASSPORT 가 모바일에서 *더 강력*" — Closed Passport 세로 비율 (aspect
//     4/5) 이 mobile viewport 와 자연 정합, Apple Wallet 메타포 자연 흡수
//   - "물리적 보관소" 느낌 (PASSPORT-1 spec §3) 의 mobile native 표현
//
// **본 component 의 wire 영역** (Commit 1 Foundation 한정):
//   - 호출처 0건 (additive only) — wire 는 Commit 3 (ArtworkGrid 반응형 분기)
//     영역에서 viewport ≤768px 시 본 component 진입 (사용자 §11 (f) 5-commit
//     분할 결정 정합)
//   - props-driven 패턴 — artworks list / onCardTap 부모 책임. store 구독은
//     ArtworkGrid 영역 정착물 답습 (filter / sort 로직 단일 진실 원천)
//   - PassportCard 재사용 (STEP 131 정착물) — 본 component 는 *컨테이너 단독*,
//     카드 시각 표현은 PassportCard 정착물 변경 0줄
//
// **사용자 §11 결정 reference**:
//   - (a) rule_14 보강 → Commit 5 영역 (매니페스토 XML 본문 변경은 Commit 5)
//   - (c) Foundation 신설만, In-Passport Navigation STEP 133 이월 — 본
//     component 는 tap → onCardTap callback 단독 (sub-screen navigation 0)
//   - (g) @use-gesture/react (~10 kB) — 본 component 는 *카드 시각 단독*,
//     swipe gesture 는 PassportUnfoldView 영역 (drag-to-close 단독)
//   - (h) Smartphone 우선 (≤768px), Tablet 은 Desktop fallback
//
// **§8 정합 (Phase 1 §6.2 결정)**:
//   - MobilePassportStack 신설 결정 — ArtworkGrid 와 viewMode + viewport 2축
//     분기 복잡도 회피, 별도 dimension 정합. ChatGPT "creative redesign" 정신
//     정합 (naive responsive `display:none/block` 회피)
//   - ResponsiveLayoutWrapper 신설 폐기 — viewport 분기는 page root 의 Tailwind
//     `md:hidden` / `hidden md:flex` 클래스 단독 (~80 LOC 절약)
//   - 누적 §8 절약: ~80 LOC (Phase 1 §6.2 정착)
//
// **rule_1 SSOT (Physical Root Key)**:
//   본 component 의 artworks prop = `useArtworkStore.artworks` 의 filter/sort
//   결과 (부모 ArtworkGrid 영역). 같은 artwork.id 단일 진입 — Desktop /
//   Mobile dimension 분리지만 master record 통합.
//
// **rule_5 AI-Human Loop**:
//   카드 tap = 사용자 명시 클릭 단독. AI 자동 진입 0건. PassportCard 의
//   `onClick` 정착 패턴 답습.
//
// **rule_14 보강 정합** (Phase 1 §5.2 spec):
//   Desktop Layout Contract 의 ArtworkGrid (4-col responsive) 와 Mobile
//   Responsive Surface Layer 의 single-col stack 은 *dimension 절대 통합 금지*.
//   본 component 가 그 분리의 정착물.
//
// **rule_15 (≤3 button 단일 명령)**:
//   본 component 는 button = 카드별 tap 단독 (PassportCard 의 onClick). 추가
//   action button 0건. rule_15 정합.
//
// **rule_16 (museum-safe minimal)**:
//   - Stack spacing 자연 gap (slightly stacked 시각, PASSPORT-1 spec §3 정합)
//   - Padding minimal (모바일 viewport 폭 최대 활용)
//   - 금지: gradients / neon / glassmorphism / floating SaaS / 과한 shadow /
//     animated card transitions / hover lift (mobile 은 hover 부재)
//
// **rule_17 (페이지 이동 금지)**:
//   카드 tap → onCardTap callback (부모가 PassportUnfoldView 진입 결정,
//   Commit 4 영역). 페이지 이동 0건, Drawer/Modal 회피 (PASSPORT spec §4
//   정합 — Passport 자체가 펼쳐짐, PassportUnfoldView 가 그 본질).
//
// **D-AXVELA-VISION-3 (QR 본질 재정의) reference**:
//   본 component 자체는 QR 진입점 미포함. 향후 QR scan 결과 → 특정 artwork.id
//   → PassportUnfoldView 직접 진입 (Stack 우회) 패턴은 STEP 136 Certificate
//   Surface 영역. 본 component 는 운영자/컬렉터의 *list browse* 진입점 단독.
//
// **명시적 작업 범위 외 (Commit 1 절대 금지)**:
//   - ❌ ArtworkGrid 호출자 변경 (Commit 3 영역)
//   - ❌ useArtworkStore 직접 구독 (props-driven, 부모 ArtworkGrid 책임)
//   - ❌ PassportCard 변경 0줄 (STEP 131 정착물 보존)
//   - ❌ filter / sort 로직 (ArtworkGrid 영역 정착물)
//   - ❌ swipe gesture (PassportUnfoldView 영역, Commit 4)
//   - ❌ In-Passport Navigation (STEP 133 영역)
// =====================================================

import { PassportCard } from "@/components/artwork/PassportCard";
import { cn } from "@/lib/utils";
import type { Artwork } from "@/types/artwork";

// -----------------------------------------------------
// Props
// -----------------------------------------------------

interface MobilePassportStackProps {
  /**
   * 표시 대상 artworks (rule_1 SSOT — 같은 artwork.id 진입).
   * filter / sort 는 부모 (ArtworkGrid Commit 3 wire) 책임 — 본 component 는
   * *컨테이너 단독* 정합.
   */
  artworks: readonly Artwork[];
  /**
   * 현재 선택된 artwork.id — DetailPanel / PassportUnfoldView 동기화 표시.
   * PassportCard 의 `isSelected` 정착 패턴 답습.
   */
  selectedArtworkId?: string | null;
  /**
   * 카드 tap 진입점. 사용자 명시 클릭 시 호출 (rule_5).
   *
   * **사용자 §11 (c) 결정 정합**: Foundation 신설만, 본 callback 의 본격
   * PassportUnfoldView 진입 wire 는 Commit 4 영역. Commit 1 시점 호출처 0건.
   */
  onCardTap: (artwork: Artwork) => void;
}

// -----------------------------------------------------
// Component
// -----------------------------------------------------

export function MobilePassportStack({
  artworks,
  selectedArtworkId,
  onCardTap,
}: MobilePassportStackProps) {
  // Zero-state — artworks 0건일 경우 미니멀 institutional 표기 (rule_16 정합)
  if (artworks.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center",
          "py-16 px-6",
          "text-center",
        )}
        role="status"
        aria-label="작품 없음"
      >
        <p className="text-[13px] tracking-tightish text-ink-subtle">
          등록된 작품이 없습니다
        </p>
        <p className="mt-1 text-[11px] tracking-tight text-ink-subtle/70">
          Cultural Asset Passport
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        // Layout — single column vertical stack (mobile viewport 폭 최대 활용)
        "flex flex-col",
        // Stack spacing — slightly stacked spacing (PASSPORT-1 spec §3 정합)
        // gap 4 = 모바일에서 자연스러운 카드 간격, 과한 spacing 회피 (rule_16)
        "gap-4 px-4 py-4",
        // Full width within Mobile viewport
        "w-full",
      )}
      role="list"
      aria-label="작품 패스포트 목록"
    >
      {artworks.map((artwork) => (
        <div
          key={artwork.id}
          role="listitem"
          className={cn(
            // Card wrapper — full-width card on mobile (aspect 4/5 = PassportCard
            // 정착물 비율 유지, mobile viewport 폭 ~360-414px 에서 자연 height)
            "w-full",
          )}
        >
          <PassportCard
            artwork={artwork}
            isSelected={artwork.id === selectedArtworkId}
            onClick={onCardTap}
          />
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------
// Re-export type (dev convenience — Commit 3 wire 진입점)
// -----------------------------------------------------

export type { MobilePassportStackProps };
