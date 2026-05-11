"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  options: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, required, error, hint, options, className, id, ...props },
    ref
  ) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={selectId}
          className="text-[11.5px] font-medium tracking-tightish text-ink-muted"
        >
          {label}
          {required && (
            <span className="ml-1 text-status-inquiry" aria-hidden>
              *
            </span>
          )}
        </label>
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            aria-invalid={!!error}
            className={cn(
              "appearance-none w-full h-10 px-3 pr-10 rounded-md bg-surface border text-[13.5px] text-ink",
              "tracking-tightish",
              "focus:outline-none transition-colors cursor-pointer",
              error
                ? "border-status-inquiry focus:border-status-inquiry"
                : "border-line focus:border-ink-muted",
              className
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        {error ? (
          <p className="text-[11px] text-status-inquiry tracking-tightish">
            {error}
          </p>
        ) : hint ? (
          <p className="text-[11px] text-ink-subtle tracking-tightish">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
Select.displayName = "Select";
