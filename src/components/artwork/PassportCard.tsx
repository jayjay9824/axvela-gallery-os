"use client";

// =====================================================
// AXVELA — Passport Card (Closed Passport, STEP 131 Phase 2 Commit 1)
// =====================================================
//
// **본 component 의 정체**:
//   PASSPORT-1 spec (15 §) 의 *Closed Passport* 시각 표현. 일반 SaaS grid card
//   (`ArtworkCard`) 와 의도적 dimension 분리 — 같은 `artwork.id` (rule_1 SSOT)
//   진입이지만 시각 표현이 *Cultural Asset Passport* 톤 (Apple Wallet + Government
//   Archive + Luxury Certificate 통합).
//
// **PASSPORT-1 spec §2 정착 영역**:
//   - LEFT SPINE (~28px): AXID 세로 표기, AXVELA mark, REGISTERED / VERIFIED
//     상태 (registrationStatus 기반)
//   - FRONT COVER: AXVELA PASSPORT label, artwork title, artist, year, medium,
//     status chip
//   - 재질: dark navy leather + gold typography + low reflection
//   - 박음질 효과: outline offset (border-style 활용)
//   - 금지: gradients / neon / glassmorphism / floating SaaS / 과한 shadow
//
// **본 component 의 wire 영역** (Commit 1 Foundation 한정):
//   - 호출처 진입점: STEP 131 Phase 2 **Commit 2** 에서 ArtworkGrid 의 view
//     mode 분기 영역 (`viewMode === "passport"` 조건) 통합 예정.
//   - 본 Commit 1 에서는 호출처 0건 (additive only, props 정의만).
//   - locale 표시: `artwork.title` / `artwork.artist.name` direct access (정착물
//     1:1 답습). **Commit 2 에서 `getTitle(artwork, currentLocale)` /
//     `getArtistName(artwork.artist, currentLocale)` helper 로 전환 예정** —
//     STEP 130 정착물 (`src/lib/i18n-helpers.ts`) 의 *첫 production 호출처* 가
//     됨. 본 Commit 의 direct access 는 *임시* (Commit 2 wire 진입점).
//
// **rule_1 SSOT (Physical Root Key)** (필수 명시):
//   3-Surface 모두 동일 `artwork.id` 진입. 본 Passport surface 는 *시각만 다른*
//   같은 artwork master record. AXID (`artwork.axid.code`) 가 LEFT SPINE 에
//   세로 표기되어 *Physical Asset Trust Layer* 시각화.
//
// **§8 정합 — AxidVerticalDisplay 신설 폐기 정책**:
//   AXID 세로 표기는 본 component 내부 inline CSS (`writing-mode: vertical-rl`)
//   처리. 별도 helper component 신설 회피 (~30 LOC 절약, 재사용 0건 예상 영역).
//   STEP 131 Phase 1 §6.2 §8 표준 결정.
//
// **§7 deferred items reference**:
//   - **D-130-1** (titleI18n.en = "" fallback) — 본 component 의 `artwork.title`
//     direct access 는 Commit 2 helper 전환 시 자연 해소 (helper 의 fallback
//     chain 진입). 현 시점 결정 영향 0.
//   - **D-130-2** (locale 노출 KO/EN 제한) — 본 component 자체는 locale 무관,
//     Commit 2 wire 시점에 currentLocale 종속.
//   - **디자인 단순화 보류 (Phase 1 §8 항목 7)** — 사용자 인수인계 메모
//     "정보 밀도 높음 / 복잡하다" 피드백 명시. 본 commit 은 PASSPORT-1 spec
//     **그대로** 정착 (Option B: emblem + 가죽 grain + 박음질 + footer mark
//     4 element). 단순화 결정 시점 = 사용 후 자연 의사결정 (PASSPORT-1 그대로
//     첫 wire 후 사용자 피드백 누적 단계).
//
// **rule_5 AI-Human Loop**: 본 component 는 *표시 layer* 단독. AI 자동 변경
// 0건 — artwork 데이터는 운영자 명시 입력 (Form UI 별도 영역) 기반.
//
// **rule_14 (3 Column / Sidebar 240px 무손상)**: 본 component 는 ArtworkGrid
// 영역 내부 카드 — Sidebar / DetailPanel 폭 영향 0.
//
// **rule_16 (museum-safe minimal)**: PASSPORT-1 spec 자체가 institutional /
// archival / luxury trust 톤 — **금지 항목 (gradients / neon / glassmorphism
// / floating SaaS / 과한 shadow / startup SaaS / flashy motion / futuristic
// cyberpunk / glass UI / gaming UI) 모두 회피**.
//
// **명시적 작업 범위 외 (Commit 1 절대 금지)**:
//   - ❌ getTitle / getArtistName 호출 (Commit 2 wire 영역)
//   - ❌ ArtworkGrid 호출자 변경 (Commit 2 영역)
//   - ❌ useArtworkStore 구독 (props-driven 패턴, 부모가 결정)
//   - ❌ Expanded Passport / In-Passport Navigation (STEP 133 영역)
//   - ❌ AI Cultural Intelligence section (STEP 134 영역)
//   - ❌ Transaction Timeline (STEP 135 영역)
//   - ❌ Certificate / QR (STEP 136 영역)
//   - ❌ 9-row Index (Expanded Passport, STEP 133 영역)
// =====================================================

import { StatusBadge } from "./StatusBadge";
import { cn, formatKRW } from "@/lib/utils";
import {
  buildThumbnailUrl,
  THUMBNAIL_PRESETS,
} from "@/lib/image-thumbnail";
import type { Artwork } from "@/types/artwork";

// -----------------------------------------------------
// PASSPORT-1 visual palette — inline arbitrary tailwind value
// (tailwind.config.ts 무손상, custom hex 직접 활용)
// -----------------------------------------------------

/** Dark navy leather (PASSPORT-1 cover 재질 톤). */
const PASSPORT_COVER_BG = "bg-[#0e1a30]";
/** Gold typography (PASSPORT-1 §2 — gold typography on cover). */
const PASSPORT_GOLD = "text-[#c9a361]";
/** Subtle gold accent (박음질 / 박음 / underline 영역). */
const PASSPORT_GOLD_SUBTLE = "text-[#c9a361]/60";
/** 박음질 outline (PASSPORT-1 spec 정착물 — Option B 의 4 element 중 하나). */
const PASSPORT_STITCH_BORDER = "border-[#c9a361]/30";

// -----------------------------------------------------
// Props
// -----------------------------------------------------

interface PassportCardProps {
  /** 표시 대상 artwork (rule_1 SSOT — 같은 artwork.id 진입). */
  artwork: Artwork;
  /**
   * 현재 선택된 카드 여부 — DetailPanel 동기화 표시. ArtworkCard 정착 패턴
   * 답습 (사용자 §8 항목 4 결정 — 기존 select 그대로).
   */
  isSelected?: boolean;
  /**
   * 클릭 진입점 — 사용자 명시 클릭 시 호출. STEP 131 Phase 2 Commit 2 에서
   * ArtworkGrid 가 `select(artwork.id)` 호출로 wire 예정.
   *
   * **사용자 §8 항목 4 결정 정착**: 기존 select 답습 (DetailPanel 갱신).
   * Expanded Passport 의 In-Passport Navigation (PASSPORT-1 spec §4) 은
   * STEP 133 영역.
   */
  onClick?: (artwork: Artwork) => void;
}

// -----------------------------------------------------
// Component
// -----------------------------------------------------

export function PassportCard({
  artwork,
  isSelected = false,
  onClick,
}: PassportCardProps) {
  // STEP 131 Phase 2 Commit 1 (Foundation):
  //   artwork.title / artwork.artist.name direct access.
  //   Commit 2 에서 getTitle/getArtistName helper 로 전환 (currentLocale 종속).
  const displayTitle = artwork.title;
  const displayArtist = artwork.artist.name;

  return (
    <button
      type="button"
      onClick={() => onClick?.(artwork)}
      aria-label={`${artwork.axid.code} — ${displayTitle} (${displayArtist}) — 패스포트 열기`}
      className={cn(
        // Layout — ArtworkCard 와 동일 비율 (4/5) 유지, grid spacing 정합
        "group relative flex w-full overflow-hidden rounded-md text-left",
        "aspect-[4/5] transition-all duration-200",
        // PASSPORT-1 cover (dark navy leather)
        PASSPORT_COVER_BG,
        // 박음질 outline (Option B 4 element 중 1) — outline-offset 으로 안쪽
        // 1.5px 미세한 박음 라인 효과 (museum-safe, 과한 shadow 회피)
        "border-[1.5px]",
        PASSPORT_STITCH_BORDER,
        // Selected state — gold ring (museum-safe minimal, 과한 강조 회피)
        isSelected && "ring-1 ring-[#c9a361]/70",
        // Hover — 미세한 lift (rule_16 정합, 과한 motion 회피)
        !isSelected && "hover:border-[#c9a361]/50",
      )}
    >
      {/* ============================================================
          LEFT SPINE — AXID 세로 표기 + AXVELA mark (PASSPORT-1 §2)
          ============================================================ */}
      <div
        className={cn(
          "flex flex-col items-center justify-between shrink-0",
          "w-7 py-3.5 px-1",
          // Spine 우측에 미세한 gold divider (cover 와 분리)
          "border-r",
          PASSPORT_STITCH_BORDER,
        )}
      >
        {/* AXVELA mark (top of spine) — 작은 monogram */}
        <div
          className={cn(
            "text-[8px] tracking-[0.18em] font-semibold uppercase",
            PASSPORT_GOLD_SUBTLE,
          )}
          aria-hidden
        >
          AX
        </div>

        {/* AXID 세로 표기 — §8 정합 inline CSS (writing-mode: vertical-rl)
            AxidVerticalDisplay 신설 폐기 결정 (Phase 1 §6.2). */}
        <div
          className={cn(
            "flex-1 flex items-center justify-center min-h-0 my-2",
            "text-[9px] tracking-[0.14em] font-medium tabular-nums",
            PASSPORT_GOLD,
          )}
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
          }}
        >
          {artwork.axid.code}
        </div>

        {/* REGISTERED / VERIFIED 상태 (registrationStatus 기반) — STEP 114
            정착물. registrationStatus 부재 시 자연 비표시 (zero-state pattern).
            spine bottom 에 작은 dot indicator. */}
        {artwork.registrationStatus && (
          <div
            className={cn("h-1 w-1 rounded-full", "bg-[#c9a361]/70")}
            aria-label={`등록 상태: ${artwork.registrationStatus}`}
          />
        )}
      </div>

      {/* ============================================================
          FRONT COVER — AXVELA PASSPORT label + artwork metadata + status
          ============================================================ */}
      <div className="relative flex flex-1 flex-col justify-between min-w-0 px-3.5 py-3.5">
        {/* Top — AXVELA PASSPORT label (PASSPORT-1 §2 emboss seal 영역) */}
        <div className="flex items-start justify-between">
          <div>
            <p
              className={cn(
                "text-[8.5px] tracking-[0.22em] font-semibold uppercase",
                PASSPORT_GOLD,
              )}
            >
              AXVELA PASSPORT
            </p>
            <p
              className={cn(
                "mt-0.5 text-[7.5px] tracking-[0.14em] uppercase",
                PASSPORT_GOLD_SUBTLE,
              )}
            >
              Cultural Asset
            </p>
          </div>

          {/* Emblem (Option B 4 element 중 1) — 우측 상단 작은 seal mark.
              SVG inline (외부 asset 0건). 미세한 luxury archive 시각 정합. */}
          <EmblemMark className={cn("h-6 w-6", PASSPORT_GOLD_SUBTLE)} />
        </div>

        {/* Middle — artwork title (gold typography, primary visual element)
            + artist + year (subtle gold) */}
        <div className="my-3.5 min-w-0">
          <h3
            className={cn(
              "text-[14px] font-medium tracking-tight2 leading-tight truncate",
              PASSPORT_GOLD,
            )}
          >
            {displayTitle}
          </h3>
          <p
            className={cn(
              "mt-1 text-[11px] tracking-tightish truncate",
              PASSPORT_GOLD_SUBTLE,
            )}
          >
            {displayArtist} · {artwork.year}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[10px] tracking-tightish truncate",
              PASSPORT_GOLD_SUBTLE,
            )}
          >
            {artwork.medium}
          </p>
        </div>

        {/* Bottom — status chip + price + footer mark */}
        <div className="space-y-2">
          {/* Status chip (정착물 StatusBadge 답습) + price */}
          <div className="flex items-center justify-between gap-2">
            <StatusBadge state={artwork.state} />
            <span
              className={cn(
                "text-[11px] tabular-nums font-medium",
                PASSPORT_GOLD,
              )}
            >
              {formatKRW(artwork.priceKRW)}
            </span>
          </div>

          {/* Footer mark (Option B 4 element 중 1) — 미세한 institutional
              footer line. 박음질 영역 위 subtle divider. */}
          <div
            className={cn(
              "pt-2 border-t",
              PASSPORT_STITCH_BORDER,
              "flex items-center justify-between",
            )}
          >
            <span
              className={cn(
                "text-[7px] tracking-[0.16em] uppercase",
                PASSPORT_GOLD_SUBTLE,
              )}
              aria-hidden
            >
              Cultural Asset OS
            </span>
            <span
              className={cn(
                "text-[7px] tracking-[0.18em] font-semibold uppercase tabular-nums",
                PASSPORT_GOLD_SUBTLE,
              )}
              aria-hidden
            >
              v1
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// -----------------------------------------------------
// EmblemMark — inline SVG (외부 asset 0건)
// -----------------------------------------------------

/**
 * AXVELA PASSPORT 의 emblem seal mark. 미세한 institutional / archival
 * 톤. PASSPORT-1.png 의 right-top 영역 emblem 시각화 (gold subtle, 과한
 * 강조 회피).
 *
 * **rule_16 정합**: 단순 geometric SVG, 외부 image asset 0건, gradients /
 * shadow 0.
 */
function EmblemMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* outer ring */}
      <circle cx="12" cy="12" r="9" />
      {/* inner ring */}
      <circle cx="12" cy="12" r="5.5" />
      {/* center dot */}
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      {/* 4-direction subtle marks (compass-like institutional pattern) */}
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
    </svg>
  );
}

// -----------------------------------------------------
// Re-export type (dev convenience — Commit 2 ArtworkGrid wire 의 type-safe
// import 진입점. 본 Commit 1 시점 외부 호출처 0건, future-safe export).
// -----------------------------------------------------

export type { PassportCardProps };
