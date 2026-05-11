"use client";

import * as React from "react";
import { useArtworkStore } from "@/store/useArtworkStore";
import {
  ROLE_LABEL,
  ROLE_LABEL_KR,
  ROLE_DESCRIPTION_KR,
  ROLE_COLOR,
} from "@/lib/rbac";
import type { Role } from "@/types/role";

const ROLES: Role[] = ["STAFF", "MANAGER", "OWNER"];

/**
 * Sidebar 푸터의 사용자 칩을 클릭하면 위로 솟는 popover. 3개 role을 한 줄
 * 옵션으로 노출 — 별도 모달이나 dropdown UI 금지 (rule_15 / 사용자 요구).
 *
 * v1: role 전환은 시연용 — 실제 운영에서는 인증된 세션에서 결정됨.
 */
export function RoleSwitcher() {
  const currentRole = useArtworkStore((s) => s.currentRole);
  const setCurrentRole = useArtworkStore((s) => s.setCurrentRole);

  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click + Escape
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const accent = ROLE_COLOR[currentRole];

  const handleSelect = (role: Role) => {
    setCurrentRole(role);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger — replaces the static "JH · Manager" chip in the footer */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-surface-muted transition-colors"
      >
        <div
          aria-hidden
          className="h-7 w-7 rounded-full bg-surface-muted border border-line flex items-center justify-center text-[11px] font-semibold text-ink"
        >
          {currentRole.charAt(0)}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[12px] font-medium text-ink truncate tracking-tightish">
            {ROLE_LABEL_KR[currentRole]} · 운영자
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: accent }}
            />
            <p className="text-[10.5px] text-ink-subtle truncate tracking-tightish">
              {ROLE_LABEL[currentRole]} 권한
            </p>
          </div>
        </div>
        <ChevronUpDownIcon />
      </button>

      {/* Popover — anchored above the trigger */}
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 right-0 mb-2 bg-surface border border-line rounded-md shadow-soft py-1.5 z-30"
        >
          <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-ink-subtle uppercase">
            역할 전환
          </p>
          {ROLES.map((role) => {
            const selected = role === currentRole;
            return (
              <button
                key={role}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => handleSelect(role)}
                className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${
                  selected ? "bg-surface-muted" : "hover:bg-surface-muted"
                }`}
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full shrink-0 mt-1.5"
                  style={{ backgroundColor: ROLE_COLOR[role] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[12.5px] font-medium text-ink tracking-tightish">
                      {ROLE_LABEL_KR[role]}
                    </p>
                    <span className="text-[10px] text-ink-subtle font-mono tracking-[0.04em]">
                      {ROLE_LABEL[role]}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-ink-muted mt-0.5 leading-relaxed tracking-tightish">
                    {ROLE_DESCRIPTION_KR[role]}
                  </p>
                </div>
                {selected && <CheckIcon />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChevronUpDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-ink-subtle shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-ink shrink-0 mt-1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
