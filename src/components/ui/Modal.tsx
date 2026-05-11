"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label={title}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center px-4",
        "transition-opacity duration-200",
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/15"
        aria-hidden
      />
      {/* Card */}
      <div
        className={cn(
          "relative w-full max-w-[440px] bg-surface border border-line rounded-lg shadow-soft",
          "flex flex-col max-h-[85vh]",
          "transition-transform duration-200 ease-out",
          open ? "translate-y-0" : "translate-y-2"
        )}
      >
        <header className="flex items-center justify-between h-12 px-5 border-b border-line shrink-0">
          <h2 className="text-[14px] font-semibold tracking-tight2 text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors"
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
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 scroll-clean">
          {children}
        </div>
        {footer && (
          <footer className="border-t border-line px-5 py-3 shrink-0 flex items-center justify-end gap-2 bg-surface">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
