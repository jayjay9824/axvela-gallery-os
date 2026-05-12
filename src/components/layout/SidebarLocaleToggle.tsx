"use client";

// =====================================================
// AXVELA — Sidebar Locale Toggle (STEP 130 Phase 2 Commit 3)
// =====================================================
//
// **본 component 의 정체**:
//   Sidebar header 영역의 *artwork i18n display locale* 전환 컨트롤.
//   "KO EN JA ZH" 4 locale 횡렬 segmented control. 사용자 명시 클릭으로만
//   `useArtworkStore.currentLocale` 을 set.
//
// **본 component 의 wire 영역**:
//   - 진입점: `useArtworkStore.setLocale` (Commit 2 `50ab862` 정착)
//   - 시각적 강조: 현재 `currentLocale` 값에 medium weight + subtle bottom
//     border (border-b border-ink/60) 로 활성 표시.
//   - 호출처 0건 외 (사용처 wire 는 STEP 131+ 점진적 적용) — 본 Commit 은
//     toggle 자체와 store wire 만 정착, 효과는 Commit 1 helpers 가 호출되는
//     시점부터 자연 발생.
//
// **STEP 96 TranslationLocaleSelector 와의 dimension 분리** (필수 명시 — 통합 절대 금지):
//   - 본 component = *storage-level artwork i18n* 의 display locale 전환.
//     useArtworkStore.currentLocale 단일 진실 원천. 운영자의 *전체 갤러리
//     화면 표시 언어* 선택 — 모든 artwork title / artist name 이 본 locale
//     projection 으로 표시됨 (Commit 1 i18n-helpers 의 fallback chain 통과).
//   - STEP 96 `TranslationLocaleSelector` (src/components/translation/) =
//     *runtime AI projection* 의 target locale. Invoice / Receipt / TaxInvoice
//     등 document content 의 AI 동적 번역. local state, ephemeral cache,
//     문서별 *개별* selector — Drawer 내부에 위치.
//   - 두 component 의도적 별도 dimension — 통합 절대 금지. 같은 enum
//     (DocumentLocale = AILocale) 을 공유하지만 *어디서 어떻게 사용되는가*
//     가 다름. 폴더 분리 (`layout/` vs `translation/`) 가 dimension 분리의
//     visual signal.
//
// **convention 답습** (`TranslationLocaleSelector` 패턴):
//   - museum-safe minimal tone — colorful tabs 금지, animated transitions 금지,
//     flashy segmented control 금지
//   - active = medium weight + subtle bottom border
//   - inactive = subtle ink, hoverable
//   - DOCUMENT_LOCALE_LABEL_SHORT (KO/EN/JA/ZH) 재활용 — STEP 96 정착물
//   - 다만 `sourceLocale` prop 제거 — artwork i18n 은 *source 개념 부재*.
//     모든 locale 은 동등 display projection (rule_1 — 원본은 항상 한국어
//     baseline, 그 외는 모두 projection).
//
// **rule_5 AI-Human Loop 정합** (필수 명시):
//   사용자 명시 클릭으로만 호출 (Sidebar header 의 4 button 중 하나). AI 자동
//   호출 절대 금지 — Translation Layer (STEP 96) 가 본 toggle 자동 변경 0건.
//
// **rule_15 정합**:
//   4 버튼 = locale 4종 (ko/en/ja/zh), 단일 segmented control (별도 모달 /
//   dropdown UI 금지 — RoleSwitcher 의 "한 줄 옵션" 패턴 답습 정신).
//
// **rule_16 정합** (Apple/OpenAI 미니멀):
//   border-b 1px transparent (active 시만 ink/60), padding 미니멀,
//   transition 미세, 그림자 0건, 장식 0건.
//
// **rule_14 정합** (3 Column 구조):
//   Sidebar 폭 240px 무손상 — 4 button × ~28px = 112px 미만, 좌측 padding
//   포함해도 240px 안에 자연 수용.
//
// **STEP 130 Phase 1 §UI rationale**:
//   currentLocale = UI 표시 언어 선택 (어떤 데이터를 보여줄지). 운영자가
//   header 에서 한 번 클릭 → 전체 화면이 즉시 해당 locale projection 표시.
//   향후 STEP 131+ 사용처 wire (ArtworkGrid / DetailPanel / Drawer) 가
//   getTitle(art, currentLocale) / getArtistName(artist, currentLocale) 호출.
// =====================================================

import * as React from "react";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  type DocumentLocale,
  DOCUMENT_LOCALES,
  DOCUMENT_LOCALE_LABEL_FULL,
  DOCUMENT_LOCALE_LABEL_SHORT,
} from "@/lib/document-locale";
import { cn } from "@/lib/utils";

// -----------------------------------------------------
// Component
// -----------------------------------------------------

/**
 * Sidebar header artwork i18n display locale toggle.
 *
 * Self-contained — store 직접 구독 (currentLocale + setLocale). 별도 props 0건.
 *
 * **호출처**: `src/components/layout/Sidebar.tsx` 내 1곳 (header 영역 직하 행).
 * **호출처 다중화 금지** — Sidebar header 외 다른 곳 사용 시 currentLocale UI
 * 표시 불일치 발생 가능 (단일 진실 원천 위반).
 */
export function SidebarLocaleToggle() {
  const currentLocale = useArtworkStore((s) => s.currentLocale);
  const setLocale = useArtworkStore((s) => s.setLocale);

  return (
    <div
      role="tablist"
      aria-label="작품 표시 언어 (artwork display locale)"
      className="flex items-center gap-0.5"
    >
      {DOCUMENT_LOCALES.map((locale) => {
        const isActive = locale === currentLocale;
        return (
          <button
            key={locale}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-label={DOCUMENT_LOCALE_LABEL_FULL[locale]}
            onClick={() => {
              // 같은 locale 재선택 시 set 호출 0건 (idempotent — reference equality
              // 보호, audit log emit 0건 정책 정합 — Commit 2 setLocale 의 단순 setter
              // 의도와 일치).
              if (isActive) return;
              setLocale(locale);
            }}
            className={cn(
              // Base — minimal padding, monospace-ish tracking for locale codes
              // (TranslationLocaleSelector convention 그대로)
              "px-2 py-1 text-[11px] tracking-[0.08em] transition-colors",
              "border-b border-transparent",
              // Active — medium weight + subtle bottom border (museum-safe)
              isActive && "font-medium text-ink-strong border-ink/60",
              // Inactive — subtle, hoverable lift
              !isActive &&
                "text-ink-subtle hover:text-ink-strong hover:border-line cursor-pointer",
            )}
          >
            {DOCUMENT_LOCALE_LABEL_SHORT[locale]}
          </button>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------
// Re-export type (dev convenience — 사용처 0건 외에는 필요 없음, future-safe)
// -----------------------------------------------------

export type { DocumentLocale };
