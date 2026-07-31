"use client";

import { cn } from "@/lib/utils";

interface PillPoint {
  day: string;
  count: number;
  highlight?: boolean;
}

/**
 * Waveform of rounded capsules — muted bars, the highlighted one in
 * Cuisina red. Replaces the recharts sparkline on the dashboard.
 */
export function PillBar({ data }: { data: PillPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div
      className="mt-3 flex h-16 items-end gap-1.5"
      role="img"
      aria-label={data.map((d) => `${d.day}: ${d.count}`).join(", ")}
    >
      {data.map((d, i) => (
        <span
          key={`${d.day}-${i}`}
          title={`${d.day} · ${d.count}`}
          className={cn(
            "w-2.5 rounded-full",
            d.highlight
              ? "bg-rouge"
              : "bg-noir-atelier/15 dark:bg-ivoire/20",
          )}
          style={{ height: `${Math.max(6, Math.round((d.count / max) * 64))}px` }}
        />
      ))}
    </div>
  );
}
