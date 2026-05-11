import { cn, STATE_LABEL_KR, STATE_COLOR } from "@/lib/utils";
import type { ArtworkState } from "@/types/artwork";

interface StatusBadgeProps {
  state: ArtworkState;
  className?: string;
}

export function StatusBadge({ state, className }: StatusBadgeProps) {
  const color = STATE_COLOR[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-tightish",
        "border border-line bg-surface",
        className
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{STATE_LABEL_KR[state]}</span>
    </span>
  );
}
