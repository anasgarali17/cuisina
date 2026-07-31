"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";

interface Point {
  day: string;
  count: number;
}

/** Seven-day single-series sparkline — no axes, no grid, no legend. */
export function Sparkline({ data }: { data: Point[] }) {
  return (
    <div
      className="mt-3 h-12"
      role="img"
      aria-label={data.map((d) => `${d.day}: ${d.count}`).join(", ")}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, bottom: 4, left: 4, right: 4 }}>
          <Tooltip
            cursor={{ stroke: "var(--brume)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as Point;
              return (
                <div className="rounded-lg border border-border bg-card px-2 py-1 text-xs shadow-sm">
                  <span className="text-muted-foreground">{point.day}</span>{" "}
                  <span className="font-mono font-medium">{point.count}</span>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#C1121F"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
