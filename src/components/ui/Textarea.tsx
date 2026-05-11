"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    { label, required, error, hint, rows = 4, className, id, ...props },
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
        <textarea
          id={inputId}
          ref={ref}
          rows={rows}
          aria-invalid={!!error}
          className={cn(
            "w-full px-3 py-2.5 rounded-md bg-surface border text-[13.5px] text-ink resize-y",
            "placeholder:text-ink-subtle tracking-tightish leading-relaxed",
            "focus:outline-none transition-colors",
            error
              ? "border-status-inquiry focus:border-status-inquiry"
              : "border-line focus:border-ink-muted",
            className
          )}
          {...props}
        />
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
Textarea.displayName = "Textarea";
