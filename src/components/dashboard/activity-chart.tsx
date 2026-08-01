"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
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
 * Showroom activity — dashed violet area of fiches created per day, with a
 * 7 / 30 day pill toggle. Labels arrive translated via props.
 */
export function ActivityChart({
  data,
  title,
  subtitle,
  label7,
  label30,
}: {
  data: ActivityPoint[];
  title: string;
  subtitle: string;
  label7: string;
  label30: string;
}) {
  const [range, setRange] = useState<7 | 30>(30);
  const shown = data.slice(-range);

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
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart
            data={shown}
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
          >
            <defs>
              <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              minTickGap={24}
            />
            <YAxis hide allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "var(--brume)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as ActivityPoint;
                return (
                  <div className="rounded-lg border border-border bg-card px-2 py-1 text-xs shadow-sm">
                    <span className="text-muted-foreground">{point.d}</span>{" "}
                    <span className="font-mono font-medium">{point.v}</span>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke="#7c3aed"
              strokeWidth={2}
              strokeDasharray="6 4"
              fill="url(#activity-fill)"
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
