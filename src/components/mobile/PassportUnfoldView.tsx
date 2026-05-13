"use client";

// =====================================================
// AXVELA — Passport Unfold View (STEP 131.5 Phase 2 Commit 1, Foundation)
// =====================================================
//
// **본 component 의 정체**:
//   Mobile full-screen Passport 펼침 view. PASSPORT-1 spec §4 의 "Passport
//   자체가 펼쳐짐, drawer/modal 절대 금지" 의 모바일 native 정착물.
//
// **Multi-Surface Architecture 정합** (STEP 131.5 Phase 1 §4 / §7 정착):
//   - Closed Passport (PassportCard 정착물) → tap → 본 PassportUnfoldView
//     full-screen 진입 (mobile-native unfold animation)
//   - Apple Wallet pass open 메타포 + PASSPORT-1 spec §4 (hinge motion,
//     slow calm institutional) 정합
//   - swipe-down-to-close = mobile native gesture (Wallet 패턴 답습)
//
// **In-Passport Navigation 영역 분리** (사용자 §11 (c) 결정 정합):
//   - 본 Commit 1 영역: Foundation 신설만 — full-screen unfold 진입 + 9-row
//     Index *기본 시각* + swipe-down close gesture
//   - **STEP 133 이월 영역**:
//     · PASSPORT-1 spec §6 9-row Index 의 본격 *진입 wire* (PROVENANCE /
//       INQUIRY / INVOICE / SETTLEMENT / TAX / LOGISTICS / CERTIFICATE /
//       AI CULTURAL INTELLIGENCE / TRANSACTION TIMELINE)
//     · PASSPORT-1 spec §7 In-Passport Navigation (외부 modal 절대 금지,
//       모든 detail 은 패스포트 *내부* slide transition)
//     · swipe-between-rows (가로 swipe)
//   - 본 Commit 은 *진입점 정착물* 단독 — Index row 시각 + tap = noop
//     (STEP 133 wire 영역) 정합
//
// **본 component 의 wire 영역** (Commit 1 Foundation 한정):
//   - 호출처 0건 (additive only) — wire 는 Commit 4 (PassportUnfoldView
//     mobile-native wire) 영역에서 PassportCard.onClick → 모바일 viewport 시
//     본 component full-screen 진입
//   - props-driven 패턴 (artwork + onClose) — store 구독은 부모 책임
//
// **사용자 §11 결정 reference**:
//   - (a) rule_14 보강 → Commit 5 영역 (Mobile Responsive Surface Layer 정착)
//   - (c) Foundation 신설만, In-Passport Navigation 본격 wire 는 STEP 133 이월
//   - (g) @use-gesture/react ~10 kB — 본 component 의 swipe-down-to-close
//     gesture 영역. `useDrag` import + threshold 기반 vertical drag detection
//   - (h) Smartphone 우선 — full-screen 진입은 mobile viewport (≤768px) 한정
//
// **rule_1 SSOT**:
//   본 component 의 artwork prop = `useArtworkStore.artworks` 의 단일 entry.
//   PassportCard 와 같은 artwork master record — *시각 layer 만 펼친 상태*.
//
// **rule_5 AI-Human Loop**:
//   진입 = 사용자 명시 카드 tap (PassportCard.onClick → 부모 wire).
//   닫기 = 사용자 명시 swipe-down 또는 close button. AI 자동 호출 0건.
//
// **rule_14 보강 정합** (Phase 1 §5.2 spec):
//   Mobile Responsive Surface Layer 의 *Full-screen Passport Open* 정착물.
//   Desktop Layout Contract (Sidebar 240px / Grid / DetailPanel) 와 dimension
//   절대 통합 금지 — Desktop 의 DetailPanel 우측 표시 패턴과 의도적 별도.
//
// **rule_17 (페이지 이동 금지, Drawer/Modal/Overlay 만)**:
//   ↔ PASSPORT spec §4 (drawer/modal 절대 금지) / §7 (외부 modal 절대 금지) 의
//   표면적 충돌 — Phase 1 §8.2 (c) 해석 통합 정착:
//   - rule_17 = *페이지 이동 회피* 본질 (Drawer/Modal/Overlay 허용)
//   - PASSPORT spec = Passport surface 의 *In-Passport Navigation* 채택
//     (rule_17 의 더 강한 형태 — Passport 자체가 surface)
//   - 본 PassportUnfoldView 는 **Passport surface 내부 unfold** — Drawer/Modal
//     영역 외 (Passport 자체가 surface 의 본질)
//
// **rule_16 (museum-safe minimal)**:
//   - Full-screen dark navy leather 배경 (PASSPORT-1 cover 톤 확장)
//   - Gold typography (PASSPORT-1 §2 정합)
//   - Hinge animation = 자연 transition (과한 motion 회피, "slow calm
//     institutional" 정합)
//   - 금지: gradients / neon / glassmorphism / floating SaaS / 과한 shadow /
//     flashy motion / animated transitions (Apple Wallet calm tone 답습)
//
// **PASSPORT-1 spec 정착 영역**:
//   §1 Cultural Asset Passport 본질, §2 dark navy + gold + LEFT SPINE,
//   §4 Passport 자체가 펼쳐짐 (drawer/modal 회피), §6 9-row Index 시각만
//   (본격 nav 는 STEP 133), §14 minimal / premium / institutional / calm /
//   archival / luxury trust
//
// **§8 정합** (Phase 1 §6.2 결정 정합):
//   PassportUnfoldView 신설 정합 — Drawer 패턴 답습 불가 (Mobile-native
//   unfold 본질). 단 *데이터 / 닫기 핸들러* 재활용 (artwork prop + onClose
//   callback) — 정착물 무손상.
//
// **ChatGPT + Claude 통합 시각** (Phase 1 §3 정착):
//   - ChatGPT: Apple Wallet unfold 메타포, swipe-down-to-close native gesture
//   - Claude: PASSPORT-1 spec §4 hinge animation, In-Passport Navigation 영역
//     분리 (STEP 133 이월)
//   - 합류: 모바일 native UX + 매니페스토 정합 동시 정착
//
// **D-AXVELA-VISION-3 (QR 본질 재정의) reference**:
//   QR scan → 특정 artwork.id → 본 PassportUnfoldView 직접 진입 패턴 가능성
//   (STEP 136 Certificate Surface 영역). 본 Commit 은 진입점 정착물 단독,
//   QR scan 트리거는 STEP 136.
//
// **명시적 작업 범위 외 (Commit 1 절대 금지)**:
//   - ❌ PassportCard 변경 0줄 (STEP 131 정착물 보존)
//   - ❌ In-Passport Navigation 본격 wire (9-row Index tap → sub-screen,
//     STEP 133 영역)
//   - ❌ AI Cultural Intelligence section (STEP 134 영역)
//   - ❌ Transaction Timeline (STEP 135 영역)
//   - ❌ Certificate / QR (STEP 136 영역)
//   - ❌ useArtworkStore 직접 구독 (props-driven 패턴)
//   - ❌ 외부 modal / Drawer 진입 (rule_17 ↔ PASSPORT spec §4/§7 정합)
// =====================================================

import * as React from "react";
import { useDrag } from "@use-gesture/react";
import { StatusBadge } from "@/components/artwork/StatusBadge";
import { cn, formatKRW } from "@/lib/utils";
import { getArtistName, getTitle } from "@/lib/i18n-helpers";
import { useArtworkStore } from "@/store/useArtworkStore";
import type { Artwork } from "@/types/artwork";

// -----------------------------------------------------
// PASSPORT-1 visual palette — PassportCard 정착물 답습
// -----------------------------------------------------

const PASSPORT_COVER_BG = "bg-[#0e1a30]";
const PASSPORT_PAPER_BG = "bg-[#f5efe2]"; // PASSPORT-1 §5 RIGHT paper (ivory)
const PASSPORT_GOLD = "text-[#c9a361]";
const PASSPORT_GOLD_SUBTLE = "text-[#c9a361]/60";
const PASSPORT_STITCH_BORDER = "border-[#c9a361]/30";
const PAPER_INK = "text-[#2b2418]"; // ivory paper 위의 dark ink
const PAPER_INK_SUBTLE = "text-[#2b2418]/60";

// -----------------------------------------------------
// 9-row Index labels (PASSPORT-1 spec §6) — STEP 133 wire 영역, 본 Commit
// 시각만 정착
// -----------------------------------------------------

const INDEX_ROWS = [
  { key: "provenance", label: "PROVENANCE" },
  { key: "inquiry", label: "INQUIRY" },
  { key: "invoice", label: "INVOICE" },
  { key: "settlement", label: "SETTLEMENT" },
  { key: "tax", label: "TAX" },
  { key: "logistics", label: "LOGISTICS" },
  { key: "certificate", label: "CERTIFICATE" },
  { key: "ai", label: "AI CULTURAL INTELLIGENCE" },
  { key: "timeline", label: "TRANSACTION TIMELINE" },
] as const;

// Swipe-down close threshold (px) — drag distance 가 본 임계 초과 시 onClose
// 호출. rule_16 정합 (과한 sensitivity 회피, 의도적 swipe gesture).
const SWIPE_CLOSE_THRESHOLD_PX = 120;

// -----------------------------------------------------
// Props
// -----------------------------------------------------

interface PassportUnfoldViewProps {
  /** 표시 대상 artwork (rule_1 SSOT — Closed Passport 와 같은 master record). */
  artwork: Artwork;
  /**
   * 닫기 진입점. swipe-down threshold 초과 시 또는 close button 클릭 시 호출.
   * 부모 (Commit 4 wire 영역) 가 selectedArtworkId clear 등 결정.
   */
  onClose: () => void;
}

// -----------------------------------------------------
// Component
// -----------------------------------------------------

export function PassportUnfoldView({
  artwork,
  onClose,
}: PassportUnfoldViewProps) {
  // STEP 130 i18n helper 호출 — PassportCard 정착 패턴 답습. fallback chain
  // 통과로 currentLocale projection 또는 baseline (한국어) 반환 보장.
  const currentLocale = useArtworkStore((s) => s.currentLocale);
  const displayTitle = getTitle(artwork, currentLocale);
  const displayArtist = getArtistName(artwork.artist, currentLocale);

  // Drag offset (vertical) — swipe-down visual feedback (drag 따라 약간 내려가는
  // 효과). useDrag 가 [movement.y] 제공.
  const [dragY, setDragY] = React.useState(0);

  // @use-gesture/react useDrag — vertical-only drag detection.
  // 사용자 §11 (g) 결정 정합 (@use-gesture/react ~10 kB).
  const bind = useDrag(
    ({ down, movement: [, my], cancel }) => {
      // 위로 drag 는 무시 (down direction 만)
      if (my < 0) {
        setDragY(0);
        return;
      }
      // Drag 진행 중 — visual offset
      if (down) {
        setDragY(my);
        return;
      }
      // Drag 종료 — threshold 초과 시 close, 아니면 reset
      if (my > SWIPE_CLOSE_THRESHOLD_PX) {
        cancel();
        setDragY(0);
        onClose();
      } else {
        setDragY(0);
      }
    },
    {
      axis: "y", // vertical-only — horizontal swipe 는 STEP 133 (swipe-between-rows)
      filterTaps: true,
    },
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${artwork.axid.code} 패스포트 펼침`}
      className={cn(
        // Layout — full-screen overlay (mobile viewport 전체)
        "fixed inset-0 z-50",
        "flex flex-col",
        // Surface — dark navy leather cover (PASSPORT-1 §2 정합)
        PASSPORT_COVER_BG,
        // Touch optimization — drag gesture 영역
        "touch-none select-none",
      )}
      style={{
        // Drag offset (subtle visual feedback, rule_16 정합)
        transform: `translateY(${Math.max(0, Math.min(dragY, 200))}px)`,
        transition: dragY === 0 ? "transform 0.25s ease-out" : "none",
      }}
      {...bind()}
    >
      {/* ============================================================
          DRAG HANDLE — top of view, subtle gold line (swipe-down 시각 단서)
          ============================================================ */}
      <div className="flex justify-center pt-3 pb-2 shrink-0">
        <div
          className={cn(
            "h-1 w-10 rounded-full",
            "bg-[#c9a361]/40",
          )}
          aria-hidden
        />
      </div>

      {/* ============================================================
          HEADER — AXVELA PASSPORT label + close button
          ============================================================ */}
      <header
        className={cn(
          "flex items-center justify-between gap-3",
          "px-5 pb-4 shrink-0",
          "border-b",
          PASSPORT_STITCH_BORDER,
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              "text-[9px] tracking-[0.22em] font-semibold uppercase",
              PASSPORT_GOLD,
            )}
          >
            AXVELA PASSPORT
          </p>
          <p
            className={cn(
              "text-[8px] tracking-[0.14em] uppercase",
              PASSPORT_GOLD_SUBTLE,
            )}
          >
            Cultural Asset · {artwork.axid.code}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="패스포트 닫기"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full",
            "border",
            PASSPORT_STITCH_BORDER,
            PASSPORT_GOLD_SUBTLE,
            "hover:border-[#c9a361]/60 transition-colors",
          )}
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </header>

      {/* ============================================================
          BODY — artwork metadata + 9-row Index (시각만, STEP 133 wire 영역)
          ============================================================ */}
      <div className="flex-1 overflow-y-auto">
        {/* Artwork metadata (PASSPORT-1 §5 RIGHT paper 톤 — ivory 영역) */}
        <section
          className={cn(
            "mx-4 my-4 px-5 py-6 rounded",
            PASSPORT_PAPER_BG,
          )}
          aria-label="작품 정보"
        >
          <h2
            className={cn(
              "text-[18px] font-medium tracking-tight2 leading-snug",
              PAPER_INK,
            )}
          >
            {displayTitle}
          </h2>
          <p className={cn("mt-1 text-[12px] tracking-tightish", PAPER_INK_SUBTLE)}>
            {displayArtist} · {artwork.year}
          </p>
          <p className={cn("mt-0.5 text-[11px] tracking-tightish", PAPER_INK_SUBTLE)}>
            {artwork.medium}
          </p>

          <div
            className={cn(
              "mt-4 pt-3 flex items-center justify-between",
              "border-t border-[#2b2418]/15",
            )}
          >
            <StatusBadge state={artwork.state} />
            <span
              className={cn(
                "text-[12px] tabular-nums font-medium",
                PAPER_INK,
              )}
            >
              {formatKRW(artwork.priceKRW)}
            </span>
          </div>
        </section>

        {/* 9-row Index (PASSPORT-1 spec §6) — STEP 133 wire 영역.
            본 Commit 시각만 정착, tap = noop (사용자 §11 (c) 결정 정합). */}
        <nav
          className="mx-4 my-4 mb-8"
          aria-label="패스포트 인덱스 (STEP 133 wire 예정)"
        >
          <p
            className={cn(
              "px-1 pb-2 text-[8.5px] tracking-[0.22em] uppercase",
              PASSPORT_GOLD_SUBTLE,
            )}
          >
            INDEX
          </p>
          <ul role="list" className="space-y-0">
            {INDEX_ROWS.map((row) => (
              <li
                key={row.key}
                role="listitem"
                className={cn(
                  "flex items-center justify-between gap-3 py-3 px-1",
                  "border-b",
                  PASSPORT_STITCH_BORDER,
                  // STEP 133 wire 영역 — 본 Commit 시점 tap 비활성 (cursor-default)
                  "cursor-default",
                )}
                aria-label={`${row.label} (STEP 133 진입 예정)`}
              >
                <span
                  className={cn(
                    "text-[11px] tracking-[0.16em] font-medium",
                    PASSPORT_GOLD,
                  )}
                >
                  {row.label}
                </span>
                <span
                  className={cn(
                    "text-[10px] tracking-[0.12em]",
                    PASSPORT_GOLD_SUBTLE,
                  )}
                  aria-hidden
                >
                  →
                </span>
              </li>
            ))}
          </ul>
          <p
            className={cn(
              "mt-3 px-1 text-[8.5px] tracking-[0.14em] uppercase",
              PASSPORT_GOLD_SUBTLE,
            )}
          >
            In-Passport Navigation · STEP 133
          </p>
        </nav>
      </div>

      {/* ============================================================
          FOOTER — institutional mark (rule_16 정합, 미세한 footer line)
          ============================================================ */}
      <footer
        className={cn(
          "shrink-0 px-5 py-3",
          "border-t",
          PASSPORT_STITCH_BORDER,
          "flex items-center justify-between",
        )}
      >
        <span
          className={cn(
            "text-[8px] tracking-[0.16em] uppercase",
            PASSPORT_GOLD_SUBTLE,
          )}
          aria-hidden
        >
          Cultural Asset OS
        </span>
        <span
          className={cn(
            "text-[8px] tracking-[0.18em] font-semibold uppercase tabular-nums",
            PASSPORT_GOLD_SUBTLE,
          )}
          aria-hidden
        >
          v1
        </span>
      </footer>
    </div>
  );
}

// -----------------------------------------------------
// CloseIcon — inline SVG (외부 asset 0건, rule_16 정합)
// -----------------------------------------------------

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// -----------------------------------------------------
// Re-export type (dev convenience — Commit 4 wire 진입점)
// -----------------------------------------------------

export type { PassportUnfoldViewProps };
