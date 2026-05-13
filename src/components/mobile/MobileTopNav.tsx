"use client";

// =====================================================
// AXVELA — Mobile Top Nav (STEP 131.5 Phase 2 Commit 1, Foundation)
// =====================================================
//
// **본 component 의 정체**:
//   Sidebar (240px Desktop 운영자 navigation) 의 *Mobile-first 대체 surface*.
//   Multi-Surface Cultural Asset OS 정착의 모바일 운영자 진입점 — 햄버거
//   메뉴 + AXVELA 로고 + locale toggle 의 horizontal top bar.
//
// **Multi-Surface Architecture 정합** (STEP 131.5 Phase 1 §4 정착):
//   - Gallery OS (Desktop, ≥1024px) — Sidebar 240px 정착물 (보존)
//   - Passport Surface (Mobile-first, ≤768px) — 본 component + MobilePassportStack
//     + PassportUnfoldView (Foundation 3 file 합류)
//   - Certificate Surface — STEP 136 영역
//
// **rule_14 보강 정합** (Phase 1 §5.2 spec, Commit 5 영역 매니페스토 정착):
//   Desktop Layout Contract (Sidebar 240px / Grid / DetailPanel) 와 Mobile
//   Responsive Surface Layer (Top Nav / Passport Stack / Full-screen Unfold)
//   의 *dimension 절대 통합 금지* — 본 component 는 Sidebar 의 반응형 hide/show
//   대안이 아닌 **별도 dimension** 컴포넌트.
//
// **본 component 의 wire 영역** (Commit 1 Foundation 한정):
//   - 호출처 0건 (additive only) — wire 는 Commit 2 (Sidebar / TopNav 반응형
//     wire) 영역에서 page root 진입
//   - props-driven 패턴 (store 직접 구독 없음) — 부모 layout 이 결정.
//     SidebarLocaleToggle (STEP 130 self-contained) 와 의도적 다른 패턴 —
//     Multi-Surface 의 *부모 레이아웃 책임* 영역 정합
//
// **사용자 §11 결정 reference**:
//   - (a) rule_14 보강 → Commit 5 영역 (매니페스토 XML 본문 변경은 Commit 5)
//   - (b) Phase 1→2 정합 (긴급 수정 회피) — 본 component 가 정합 절차의 정착물
//   - (g) @use-gesture/react ~10 kB — 본 component 자체는 gesture 미사용
//     (햄버거 클릭 = 단순 onClick), gesture 는 MobilePassportStack /
//     PassportUnfoldView 영역
//   - (h) Smartphone 우선 (≤768px), Tablet 은 Desktop fallback
//
// **rule_1 SSOT (Physical Root Key)**:
//   본 component 는 *navigation chrome 단독* — artwork 데이터 진입 0건. locale
//   state 만 props 로 전달 받음 (store 구독은 부모 책임).
//
// **rule_5 AI-Human Loop**:
//   햄버거 / locale 모두 *사용자 명시 클릭* 단독. AI 자동 호출 0건. AXVELA OS
//   의 *모든 액션은 사용자 의도* 정합.
//
// **rule_15 정합 (≤3 button 단일 명령)**:
//   본 component 의 명시 button = 햄버거 1 + locale toggle 2 (KO/EN, Hotfix
//   `631885d` VISIBLE_LOCALES 정합) = 총 3 button. rule_15 한계 정합.
//
// **rule_16 (museum-safe minimal)**:
//   - Border-b 1px (subtle line, 그림자 0)
//   - Padding minimal, height ~48px
//   - 금지: gradients / neon / glassmorphism / floating SaaS / 과한 shadow /
//     animated transitions / colorful tabs
//
// **ChatGPT + Claude 통합 시각** (Phase 1 §3 정착):
//   ChatGPT 외부 시각 — "모바일은 축소 데스크탑이 아니다" — Sidebar 의 modal
//   shrinking 회피, Apple Wallet / Notion 패턴 답습. 본 component = Mobile-native
//   navigation chrome (Apple iOS top nav 메타포).
//
// **D-AXVELA-VISION-3 (QR 본질 재정의) reference**:
//   QR 진입점 (큐레이션 정보 / 진위 검증) 은 STEP 136 Certificate Surface 영역.
//   본 component 는 navigation chrome 단독 — QR scan 트리거 0건.
//
// **명시적 작업 범위 외 (Commit 1 절대 금지)**:
//   - ❌ Sidebar 호출자 변경 (Commit 2 영역)
//   - ❌ useArtworkStore 직접 구독 (props-driven 패턴)
//   - ❌ SidebarLocaleToggle 재사용 (Desktop 240px 영역 정착물 — 별도 dimension)
//   - ❌ Drawer / Modal 진입 (rule_17 정합, 본 component 는 chrome 단독)
//   - ❌ QR scan / Certificate 진입점 (STEP 136 영역)
// =====================================================

import { cn } from "@/lib/utils";
import {
  type DocumentLocale,
  DOCUMENT_LOCALE_LABEL_FULL,
  DOCUMENT_LOCALE_LABEL_SHORT,
} from "@/lib/document-locale";

// -----------------------------------------------------
// Visible locale subset — SidebarLocaleToggle 정착물 정합 (Hotfix `631885d`)
// -----------------------------------------------------

/**
 * Mobile Top Nav 노출 locale — SidebarLocaleToggle 의 `VISIBLE_LOCALES`
 * (Hotfix `631885d`) 정합. 두 toggle 모두 같은 *artwork i18n display locale*
 * 의 mobile/desktop dimension 단독 분기 — set 시점 동일 store 진입.
 *
 * **D-130-2 정합**: 본 배열도 SidebarLocaleToggle 과 동시 복귀 (zh/ja 단기
 * 복귀 시 두 곳 동시 update — 1줄 hotfix). 향후 fallback chain 자동 흡수.
 */
const MOBILE_VISIBLE_LOCALES: readonly DocumentLocale[] = ["ko", "en"];

// -----------------------------------------------------
// Props
// -----------------------------------------------------

interface MobileTopNavProps {
  /** 현재 locale (부모 책임 — useArtworkStore 구독 영역). */
  currentLocale: DocumentLocale;
  /**
   * Locale 변경 진입점. 사용자 명시 클릭 시 호출 (rule_5 AI-Human Loop).
   * 부모가 `useArtworkStore.setLocale` 또는 동등 setter 전달.
   */
  onLocaleChange: (locale: DocumentLocale) => void;
  /**
   * 햄버거 메뉴 진입점. 사용자 명시 클릭 시 호출. Sidebar 의 Mobile drawer
   * trigger 영역 (Commit 2 wire 시점에 결정 — 본 Commit 1 에서는 props 정의만).
   */
  onMenuToggle?: () => void;
}

// -----------------------------------------------------
// Component
// -----------------------------------------------------

export function MobileTopNav({
  currentLocale,
  onLocaleChange,
  onMenuToggle,
}: MobileTopNavProps) {
  return (
    <header
      className={cn(
        // Layout — fixed top bar (full-width, height ~48px)
        "flex items-center justify-between gap-2",
        "h-12 px-3.5",
        // Surface — same bg/border as Sidebar (rule_16 정합, 일관성)
        "bg-surface border-b border-line",
        // Mobile-only 노출은 Commit 2 wire (page root 의 md:hidden 분기)
      )}
      role="banner"
      aria-label="모바일 상단 네비게이션"
    >
      {/* ============================================================
          LEFT — 햄버거 메뉴 (Sidebar drawer trigger, Commit 2 wire)
          ============================================================ */}
      <button
        type="button"
        onClick={onMenuToggle}
        aria-label="메뉴 열기"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded",
          "text-ink-strong",
          "hover:bg-ink/5 transition-colors",
        )}
      >
        <HamburgerIcon className="h-5 w-5" />
      </button>

      {/* ============================================================
          CENTER — AXVELA 로고 (institutional, museum-safe minimal)
          ============================================================ */}
      <div className="flex flex-1 items-center justify-center">
        <span
          className={cn(
            "text-[13px] font-semibold tracking-[0.18em] uppercase",
            "text-ink-strong",
          )}
          aria-label="AXVELA Cultural Asset OS"
        >
          AXVELA
        </span>
      </div>

      {/* ============================================================
          RIGHT — Locale toggle (SidebarLocaleToggle 정합, 별도 dimension)
          ============================================================ */}
      <div
        role="tablist"
        aria-label="작품 표시 언어"
        className="flex items-center gap-0.5"
      >
        {MOBILE_VISIBLE_LOCALES.map((locale) => {
          const isActive = locale === currentLocale;
          return (
            <button
              key={locale}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-label={DOCUMENT_LOCALE_LABEL_FULL[locale]}
              onClick={() => {
                if (isActive) return;
                onLocaleChange(locale);
              }}
              className={cn(
                "px-2 py-1 text-[11px] tracking-[0.08em] transition-colors",
                "border-b border-transparent",
                isActive && "font-medium text-ink-strong border-ink/60",
                !isActive &&
                  "text-ink-subtle hover:text-ink-strong hover:border-line cursor-pointer",
              )}
            >
              {DOCUMENT_LOCALE_LABEL_SHORT[locale]}
            </button>
          );
        })}
      </div>
    </header>
  );
}

// -----------------------------------------------------
// HamburgerIcon — inline SVG (외부 asset 0건, rule_16 정합)
// -----------------------------------------------------

function HamburgerIcon({ className }: { className?: string }) {
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
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

// -----------------------------------------------------
// Re-export type (dev convenience — Commit 2 wire 진입점)
// -----------------------------------------------------

export type { MobileTopNavProps };
