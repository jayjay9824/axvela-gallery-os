"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#A9B6C8", // blue gray
  "#C9C2B5", // sand
  "#D8D4CB", // light beige
  "#EFEAE1", // porcelain
  "#E8DCC4", // cream
  "#9A8E7F", // warm gray
  "#7A6E5D", // bronze
  "#3E3A35", // dark slate
  "#5E3A38", // burgundy
  "#4A5D4A", // forest
];

interface ColorSwatchPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

export function ColorSwatchPicker({
  label,
  value,
  onChange,
}: ColorSwatchPickerProps) {
  const isPreset = PRESET_COLORS.some(
    (c) => c.toLowerCase() === value.toLowerCase()
  );

  return (
    <div className="flex flex-col gap-2.5">
      <label className="text-[11.5px] font-medium tracking-tightish text-ink-muted">
        {label}
      </label>

      {/* Preview block — shows what the thumbnail will look like */}
      <div
        className="h-20 w-full rounded-md border border-line"
        style={{ backgroundColor: value }}
        aria-hidden
      />

      {/* Swatches */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => {
          const selected = color.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              aria-label={`색상 ${color}`}
              aria-pressed={selected}
              className={cn(
                "h-7 w-7 rounded-md border transition-all",
                selected
                  ? "ring-2 ring-ink ring-offset-2 ring-offset-surface border-transparent"
                  : "border-line hover:border-line-strong"
              )}
              style={{ backgroundColor: color }}
            />
          );
        })}
        {/* Custom color picker */}
        <label
          className={cn(
            "h-7 w-7 rounded-md border cursor-pointer transition-colors",
            "flex items-center justify-center bg-surface relative overflow-hidden",
            !isPreset
              ? "ring-2 ring-ink ring-offset-2 ring-offset-surface border-transparent"
              : "border-line hover:border-line-strong"
          )}
          title="사용자 지정 색상"
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="사용자 지정 색상"
          />
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 text-ink-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </label>
      </div>

      {/* Hex preview */}
      <div className="flex items-center gap-2">
        <span className="text-[10.5px] text-ink-subtle tracking-tightish uppercase">
          Hex
        </span>
        <span className="text-[11px] text-ink-muted font-mono tracking-tightish">
          {value.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
