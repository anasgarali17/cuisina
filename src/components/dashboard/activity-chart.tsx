"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { CurveChart, type CurvePoint } from "@/components/ui/curve-chart";
import { cn } from "@/lib/utils";

export interface ActivityPoint {
  d: string;
  label: string;
  v: number;
}

/**
 * Showroom activity — price-chart-style curve of fiches created per day with
 * its moving-average trend, plus a 7 / 30 day pill toggle.
 */
export function ActivityChart({
  data,
  title,
  subtitle,
  label7,
  label30,
  seriesLabel,
  trendLabel,
}: {
  data: ActivityPoint[];
  title: string;
  subtitle: string;
  label7: string;
  label30: string;
  seriesLabel: string;
  trendLabel: string;
}) {
  const [range, setRange] = useState<7 | 30>(30);
  const curve: CurvePoint[] = data
    .slice(-range)
    .map((p) => ({ label: p.label, full: p.d, value: p.v }));

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="ms-auto flex shrink-0 rounded-full bg-muted p-1">
          {([7, 30] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                range === r
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r === 7 ? label7 : label30}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <CurveChart
          data={curve}
          seriesLabel={seriesLabel}
          trendLabel={trendLabel}
          trendWindow={range === 7 ? 3 : 7}
        />
      </div>
    </Card>
  );
}
