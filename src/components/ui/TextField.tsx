"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  suffix?: string;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  (
    { label, required, error, hint, suffix, className, id, ...props },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={inputId}
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
          <input
            id={inputId}
            ref={ref}
            aria-invalid={!!error}
            className={cn(
              "w-full h-10 px-3 rounded-md bg-surface border text-[13.5px] text-ink",
              "placeholder:text-ink-subtle tracking-tightish",
              "focus:outline-none transition-colors",
              error
                ? "border-status-inquiry focus:border-status-inquiry"
                : "border-line focus:border-ink-muted",
              suffix ? "pr-12" : "",
              className
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-subtle pointer-events-none">
              {suffix}
            </span>
          )}
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
TextField.displayName = "TextField";
