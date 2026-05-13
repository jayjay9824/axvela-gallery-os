"use client";

// =====================================================
// AXVELA — View Mode Toggle (STEP 131 Phase 2 Commit 1)
// =====================================================
//
// **본 component 의 정체**:
//   ArtworkGrid 영역의 *display mode* 전환 컨트롤. "Grid" / "Passport" 2-state
//   segmented control. 사용자 명시 클릭으로만 mode 전환 진입.
//
//   - "grid"     → 기존 ArtworkCard (일반 SaaS 카드, STEP 1~129 정착물)
//   - "passport" → PassportCard (Closed Passport 형태, 본 STEP 131 신설)
//
//   양 mode 의 데이터 진입점은 동일 (artwork prop) — 시각 표현만 분기 (사용자
//   §8 항목 2 결정 — 둘 다 보존 + 토글로 선택).
//
// **본 component 의 wire 영역**:
//   - 호출처 진입점: STEP 131 Phase 2 **Commit 2** 에서 ArtworkGrid header
//     영역에 인라인 통합 예정 (사용자 §8 항목 1 결정 — Grid header 위치).
//   - 본 Commit 1 (Foundation) 에서는 호출처 0건 (additive only, props 만 정의).
//
// **STEP 130 SidebarLocaleToggle 패턴 답습 + STEP 96 TranslationLocaleSelector
// 패턴 정합** (필수 명시):
//   - museum-safe minimal class 정확 답습:
//     · `px-2 py-1 text-[11px] tracking-[0.08em] transition-colors`
//     · `border-b border-transparent` (default)
//     · active = `font-medium text-ink-strong border-ink/60`
//     · inactive = `text-ink-subtle hover:text-ink-strong hover:border-line`
//   - 같은 enum / store 공유 0건 — 본 toggle 은 view mode 단독 영역, locale
//     toggle 과 무관 (별도 dimension).
//   - 의도적 별도 컴포넌트 — `SidebarLocaleToggle` 은 self-contained (store 직접
//     구독), 본 컴포넌트는 props-driven (부모가 store wire 결정).
//
// **STEP 58 LogisticsOperationsDrawer `viewMode` inline pattern 과의 dimension 분리**:
//   - LogisticsOperationsDrawer 의 `viewMode: "list" | "calendar"` 는 *Drawer
//     내부 한정* 의 inline state (STEP 58 정착, 컴포넌트 분리 0건).
//   - 본 component 의 `mode: "grid" | "passport"` 는 *ArtworkGrid surface*
//     의 reusable toggle. 향후 LogisticsOperationsDrawer 도 본 컴포넌트 재사용
//     가능 (별도 STEP — 본 STEP 영역 외).
//
// **rule_5 AI-Human Loop** (필수 명시): 사용자 명시 클릭으로만 호출. AI 자동
// 토글 절대 금지 — view mode 결정은 운영자 의도 단독 영역.
//
// **rule_15 (≤3 button)**: 2 button (Grid / Passport) — 한계 내. 단일 segmented
// control, 별도 모달 / dropdown UI 금지 (RoleSwitcher / SidebarLocaleToggle 의
// "한 줄 옵션" 정신 답습).
//
// **rule_16 (museum-safe minimal)**: STEP 96 / STEP 130 패턴 그대로 답습 —
// border-b 1px transparent, padding 미니멀, transition-colors 만, 그림자 0,
// 장식 0.
//
// **§7 deferred items reference**:
//   - D-130-1 (titleI18n.en = "" fallback) — 본 toggle 영역 무관
//   - D-130-2 (locale 노출 KO/EN 제한) — 본 toggle 영역 무관
//   - 디자인 단순화 보류 (§7 항목 7) — 본 toggle 은 PASSPORT-1 spec 외, 단순
//     2-button 영역으로 단순화 영향 0
//
// **§8 정합 결과** (STEP 131 Phase 1 §6.2 적용):
//   - PassportListView 신설 폐기 → ArtworkGrid 확장 + 본 toggle 통합 (Commit 2)
//   - AxidVerticalDisplay 신설 폐기 → PassportCard 내부 inline CSS
//   - 누적 ~150 LOC 절약 (STEP 130 §8 ~50 LOC 절약 패턴 답습 강화)
// =====================================================

import * as React from "react";
import { cn } from "@/lib/utils";

// -----------------------------------------------------
// Types
// -----------------------------------------------------

/**
 * ArtworkGrid surface 의 display mode 값.
 * - "grid"     → 기존 ArtworkCard (일반 grid card, STEP 1~129 정착물)
 * - "passport" → PassportCard (Closed Passport, STEP 131 신설)
 */
export type ViewMode = "grid" | "passport";

interface ViewModeToggleProps {
  /** 현재 mode. */
  mode: ViewMode;
  /** Mode 전환 진입점 — 사용자 명시 클릭 시 호출. */
  onChange: (next: ViewMode) => void;
  /** 추가 className (사용처에서 spacing / alignment 조정용). */
  className?: string;
}

// -----------------------------------------------------
// Visible mode order — 좌→우 표시 순서
// -----------------------------------------------------

/**
 * Mode 순서 — Grid (기존 정착, 운영자 baseline) 좌측, Passport (신규 surface)
 * 우측. 향후 mode 추가 시 본 배열 갱신 (확장 가능 구조).
 */
const VIEW_MODES: readonly ViewMode[] = ["grid", "passport"];

/**
 * Mode 라벨 — 1~3 char compact label (museum-safe minimal tone, STEP 96
 * DOCUMENT_LOCALE_LABEL_SHORT 답습 정신).
 */
const VIEW_MODE_LABEL: Record<ViewMode, string> = {
  grid: "Grid",
  passport: "Passport",
};

// -----------------------------------------------------
// Component
// -----------------------------------------------------

/**
 * ArtworkGrid surface display mode toggle.
 *
 * Props-driven (부모가 store wire 결정) — `SidebarLocaleToggle` 의 self-contained
 * 패턴과 의도적 차이. 부모 (ArtworkGrid, Commit 2 wire) 가 `useArtworkStore` 의
 * `viewMode` + `setViewMode` 를 구독하여 prop 으로 전달.
 *
 * **호출처**: 본 Commit 1 시점에서 0건. Commit 2 에서 ArtworkGrid header 영역에
 * 인라인 통합 예정.
 */
export function ViewModeToggle({
  mode,
  onChange,
  className,
}: ViewModeToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="작품 표시 모드 (artwork display mode)"
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {VIEW_MODES.map((m) => {
        const isActive = m === mode;
        return (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-label={`${VIEW_MODE_LABEL[m]} 모드로 전환`}
            onClick={() => {
              // 같은 mode 재선택 시 onChange 호출 0건 (idempotent — reference
              // equality 보호, store action 진입 0건).
              if (isActive) return;
              onChange(m);
            }}
            className={cn(
              // Base — STEP 96 / STEP 130 패턴 정확 답습
              "px-2 py-1 text-[11px] tracking-[0.08em] transition-colors",
              "border-b border-transparent",
              // Active — medium weight + subtle bottom border (museum-safe)
              isActive && "font-medium text-ink-strong border-ink/60",
              // Inactive — subtle, hoverable lift
              !isActive &&
                "text-ink-subtle hover:text-ink-strong hover:border-line cursor-pointer",
            )}
          >
            {VIEW_MODE_LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}
