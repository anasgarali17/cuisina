"use client";

import { useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export interface CurvePoint {
  /** short axis label (e.g. day number) */
  label: string;
  /** full label for the tooltip (e.g. "12 août") */
  full: string;
  value: number;
}

/**
 * Price-chart-style curve: main series + a smoothed trend line, right-edge
 * ticks, crosshair scrubbing with a two-series tooltip, and a summary row
 * (last value left, signed change chip right). SVG-drawn, theme tokens only.
 */
export function CurveChart({
  data,
  seriesLabel,
  trendLabel,
  unit = "",
  trendWindow = 7,
  className,
}: {
  data: CurvePoint[];
  seriesLabel: string;
  trendLabel: string;
  unit?: string;
  trendWindow?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const W = 560;
  const H = 220;
  const PAD_R = 44;
  const N = data.length;

  const values = useMemo(() => data.map((d) => d.value), [data]);
  const trend = useMemo(() => {
    return values.map((_, i) => {
      const from = Math.max(0, i - trendWindow + 1);
      const slice = values.slice(from, i + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });
  }, [values, trendWindow]);

  const all = [...values, ...trend];
  const min = Math.min(...all, 0);
  const max = Math.max(...all, 1);
  const range = max - min || 1;

  const x = (i: number) => (N <= 1 ? 0 : (i / (N - 1)) * (W - PAD_R));
  const y = (v: number) => 10 + (1 - (v - min) / range) * (H - 20);
  const path = (arr: number[]) =>
    arr
      .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");

  const last = values[N - 1] ?? 0;
  const first = values[0] ?? 0;
  const change = last - first;
  const pct = first > 0 ? (change / first) * 100 : 0;
  const up = change >= 0;

  function onMove(e: React.PointerEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || N === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    setHover(Math.max(0, Math.min(N - 1, Math.round((px / (W - PAD_R)) * (N - 1)))));
  }

  // Integer-safe ticks: never repeat a label when the range is tiny.
  const ticks = useMemo(() => {
    const raw = [0, 0.25, 0.5, 0.75, 1].map((f) => max - range * f);
    const seen = new Set<string>();
    return raw.filter((v) => {
      const key = Math.round(v).toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [max, range]);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          {seriesLabel}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-[#e8b45a]" />
          {trendLabel}
        </span>
      </div>

      <div className="relative mt-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full cursor-crosshair touch-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`${seriesLabel}: ${last}${unit}`}
        >
          {ticks.map((v, i) => (
            <g key={i}>
              <line
                x1={0}
                y1={y(v)}
                x2={W - PAD_R}
                y2={y(v)}
                stroke="var(--border)"
                strokeOpacity={0.5}
              />
              <text
                x={W - PAD_R + 8}
                y={y(v) + 3}
                fontSize={9}
                fill="var(--muted-foreground)"
              >
                {Math.round(v)}
              </text>
            </g>
          ))}

          <motion.path
            d={path(trend)}
            fill="none"
            stroke="#e8b45a"
            strokeOpacity={0.8}
            strokeWidth={1.4}
            initial={{ pathLength: reduced ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.9, ease: EASE, delay: 0.15 }}
          />
          <motion.path
            d={path(values)}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            initial={{ pathLength: reduced ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.9, ease: EASE }}
          />

          {hover != null && (
            <g pointerEvents="none">
              <line
                x1={x(hover)}
                y1={8}
                x2={x(hover)}
                y2={H - 8}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <circle
                cx={x(hover)}
                cy={y(values[hover])}
                r={3}
                fill="var(--primary)"
                stroke="var(--card)"
                strokeWidth={1.5}
              />
              <circle
                cx={x(hover)}
                cy={y(trend[hover])}
                r={2.6}
                fill="#e8b45a"
                stroke="var(--card)"
                strokeWidth={1.3}
              />
            </g>
          )}
        </svg>

        {hover != null && data[hover] && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-32 rounded-xl border border-border bg-card px-2.5 py-2 shadow-lg"
            style={{
              left: `${Math.max(12, Math.min(78, (x(hover) / W) * 100))}%`,
              transform: "translateX(-50%)",
            }}
            role="status"
          >
            <p className="text-[10px] text-muted-foreground">{data[hover].full}</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2.5 w-[3px] rounded-full bg-primary" />
                {seriesLabel}
              </span>
              <span className="font-mono text-[11px] font-medium">
                {values[hover]}
                {unit}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="h-2.5 w-[3px] rounded-full bg-[#e8b45a]" />
                {trendLabel}
              </span>
              <span className="font-mono text-[11px] font-medium">
                {trend[hover].toFixed(1)}
                {unit}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="kpi-number text-2xl tabular-nums">
          {last}
          <span className="ms-1 text-sm font-normal text-muted-foreground">{unit}</span>
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
            up
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-600",
          )}
        >
          {up ? "▲" : "▼"} {Math.abs(change)} ({up ? "+" : "−"}
          {Math.abs(pct).toFixed(0)}%)
        </span>
      </div>
    </div>
  );
}
