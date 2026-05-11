"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /**
   * Optional Tailwind width class. Defaults to `w-[480px]` for the standard
   * domain drawers. STEP 23 wider variants (GlobalAuditDrawer) pass `w-[800px]`
   * etc. — `max-w-[92vw]` is always preserved as the hard ceiling on small
   * viewports.
   */
  widthClass?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  widthClass = "w-[480px]",
}: DrawerProps) {
  // ESC to close
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Body scroll lock
  React.useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <>
      {/*
        BUGFIX (Phase 1) — 닫힌 drawer가 다른 열린 drawer의 클릭을 가로채는 이슈.
        같은 z-50 fixed 형제 panel들이 마운트 순서대로 painter's algorithm에서
        위에 그려지면, `translate-x-full`이 transform으로 화면 밖으로 밀려있어도
        브라우저에 따라 hit test 영역이 일부 남아 클릭을 흡수. 닫힌 panel /
        backdrop 모두 `pointer-events-none` + `invisible`로 hit test에서 완전
        제외시켜 production 환경에서도 결정성 보장.

        - open=true → pointer-events-auto + visible
        - open=false → pointer-events-none + invisible (transform은 그대로)
      */}
      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/15 transition-opacity duration-200",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label={title}
        // inert는 React 19+ 정식 prop이지만 18에서도 DOM attr로 통과 — 닫힌
        // drawer 안의 요소들이 focus / pointer 이벤트 받지 않도록 보강. 미지원
        // 브라우저에서는 단순히 무시되며 위 pointer-events-none이 fallback.
        {...({ inert: open ? undefined : "" } as Record<string, string | undefined>)}
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 max-w-[92vw]",
          widthClass,
          "bg-surface border-l border-line",
          "flex flex-col",
          "transition-transform duration-300 ease-out",
          open
            ? "translate-x-0 pointer-events-auto"
            : "translate-x-full pointer-events-none"
        )}
      >
        <header className="flex items-center justify-between h-14 px-6 border-b border-line shrink-0">
          <h2 className="text-[15px] font-semibold tracking-tight2 text-ink">
            {title}
          </h2>
          <button
            onClick={onClose}
            type="button"
            aria-label="닫기"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="flex-1 min-h-0">{children}</div>
      </aside>
    </>
  );
}
