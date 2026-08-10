"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ActivityPoint {
  d: string;
  label: string;
  v: number;
}

/**
 * Main series in the house red, trend in amber — kept in sync with the legend
 * dots. The two carry a ~19-point lightness gap plus solid-vs-dashed strokes,
 * so they stay separable without relying on hue alone.
 */
const MAIN = "#c1121f";
const TREND = "#f0a842";

interface Row {
  label: string;
  full: string;
  v: number;
  trend: number;
}

/**
 * Showroom activity — smooth monotone area of fiches created per day with its
 * moving-average trend line, plus a 7 / 30 day pill toggle.
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

  const rows = useMemo<Row[]>(() => {
    const slice = data.slice(-range);
    const values = slice.map((p) => p.v);
    const window = range === 7 ? 3 : 7;
    return slice.map((p, i) => {
      const from = Math.max(0, i - window + 1);
      const win = values.slice(from, i + 1);
      return {
        label: p.label,
        full: p.d,
        v: p.v,
        trend: win.reduce((a, b) => a + b, 0) / win.length,
      };
    });
  }, [data, range]);

  const last = rows[rows.length - 1]?.v ?? 0;
  const first = rows[0]?.v ?? 0;
  const change = last - first;
  const pct = first > 0 ? (change / first) * 100 : 0;
  const up = change >= 0;

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

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: MAIN }}
          />
          {seriesLabel}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: TREND }}
          />
          {trendLabel}
        </span>
      </div>

      <div
        className="mt-3 h-56 w-full sm:h-72"
        role="img"
        aria-label={`${seriesLabel}: ${last}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="activity-main" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(124,58,237,0.20)" />
                <stop offset="95%" stopColor="rgba(124,58,237,0)" />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />

            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              minTickGap={20}
              dy={6}
              fontSize={11}
              tick={{ fill: "var(--muted-foreground)" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={34}
              allowDecimals={false}
              fontSize={11}
              tick={{ fill: "var(--muted-foreground)" }}
            />

            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as Row;
                return (
                  <div className="rounded-lg border border-border bg-card px-2 py-1 shadow-md">
                    <span className="inline-block rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground tabular-nums">
                      {point.v}
                    </span>
                    <p className="mt-1 text-[11px] text-muted-foreground">{point.full}</p>
                  </div>
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="v"
              stroke={MAIN}
              strokeWidth={2.5}
              fill="url(#activity-main)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="trend"
              stroke={TREND}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              fill="none"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="kpi-number text-2xl tabular-nums">{last}</span>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
            up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600",
          )}
        >
          {up ? "▲" : "▼"} {Math.abs(change)} ({up ? "+" : "−"}
          {Math.abs(pct).toFixed(0)}%)
        </span>
      </div>
    </Card>
  );
}
