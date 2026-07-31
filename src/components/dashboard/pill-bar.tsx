"use client";

import { cn } from "@/lib/utils";

export interface PillPoint {
  day: string;
  label: string;
  count: number;
  highlight?: boolean;
}

/**
 * The reference's capsule "waveform": rounded vertical pills with numbered
 * day labels — muted capsules, hatched when empty, red when highlighted.
 */
export function PillBar({ data }: { data: PillPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div
      role="img"
      aria-label={data.map((d) => `${d.day}: ${d.count}`).join(", ")}
      className="mt-4 flex items-end gap-1.5 sm:gap-2"
    >
      {data.map((d, i) => {
        const h = d.count === 0 ? 10 : 14 + Math.round((d.count / max) * 66);
        return (
          <div
            key={`${d.label}-${i}`}
            className="flex flex-1 flex-col items-center gap-1.5"
            title={`${d.day} · ${d.count}`}
          >
            <div
              className={cn(
                "w-full max-w-4 rounded-full",
                d.highlight
                  ? "bg-rouge"
                  : d.count === 0
                    ? "hatch bg-brume/40"
                    : "bg-noir-atelier/20 dark:bg-ivoire/25",
              )}
              style={{ height: `${h}px` }}
            />
            <span
              className={cn(
                "font-mono text-[10px]",
                d.highlight
                  ? "font-semibold text-rouge"
                  : "text-muted-foreground",
              )}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
