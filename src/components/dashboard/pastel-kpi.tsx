import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PastelTone = "green" | "blue" | "violet" | "amber" | "orange";

const TONE_CLASS: Record<PastelTone, string> = {
  green: "tone-green",
  blue: "tone-blue",
  violet: "tone-violet",
  amber: "tone-amber",
  orange: "tone-orange",
};

/**
 * Pastel-tinted stat card (buildingfit reference): tinted surface, colored
 * title + oversized colored number, icon badge in the matching tone.
 * Presentational — labels arrive already translated.
 */
export function PastelKpi({
  tone,
  title,
  value,
  hint,
  icon,
}: {
  tone: PastelTone;
  title: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
}) {
  return (
    <div className={cn("neo-hover rounded-3xl border p-6", TONE_CLASS[tone])}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="tone-title text-sm font-semibold">{title}</h3>
        <span
          aria-hidden
          className="tone-badge grid size-10 shrink-0 place-items-center rounded-2xl"
        >
          {icon}
        </span>
      </div>
      <div className="kpi-number tone-value mt-3 truncate text-4xl">
        {value}
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
