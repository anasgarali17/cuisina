"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

export interface SparkPoint {
  d: string;
  v: number;
}

interface HeroBannerProps {
  label: string;
  amount: string;
  deltaPct: number | null;
  vsLabel: string;
  pendingLabel: string;
  pendingAmount: string;
  objectifLabel: string;
  sparkData: SparkPoint[];
  sparkTitle: string;
  pipelineTitle: string;
  pipelineValue: string;
  pipelineCount: string;
}

/**
 * Vivid violet hero banner (buildingfit reference): headline CA with delta
 * chip, 12-month sparkline tile and pipeline-value tile on frosted glass.
 * All strings arrive translated via props — this component renders only.
 */
export function HeroBanner({
  label,
  amount,
  deltaPct,
  vsLabel,
  pendingLabel,
  pendingAmount,
  objectifLabel,
  sparkData,
  sparkTitle,
  pipelineTitle,
  pipelineValue,
  pipelineCount,
}: HeroBannerProps) {
  return (
    <div className="hero-gradient relative overflow-hidden rounded-3xl p-6 text-white md:p-7">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
            <span aria-hidden className="size-1.5 rounded-full bg-white" />
            {label}
          </span>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="kpi-number text-5xl">{amount}</p>
            {deltaPct !== null && (
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
                {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct)}% {vsLabel}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm text-white/75">
            {objectifLabel} · {pendingLabel} {pendingAmount}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="min-w-40 rounded-2xl bg-white/12 px-4 py-3 backdrop-blur">
            <p className="text-[11px] uppercase tracking-wide text-white/70">
              {sparkTitle}
            </p>
            <div
              className="mt-1 h-12 w-36"
              role="img"
              aria-label={`${sparkTitle}: ${sparkData
                .map((p) => `${p.d} ${p.v}`)
                .join(", ")}`}
            >
              <ResponsiveContainer width="100%" height={48}>
                <AreaChart
                  data={sparkData}
                  margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="hero-spark-fill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#ffffff" stopOpacity={1} />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#ffffff"
                    strokeWidth={2}
                    fill="url(#hero-spark-fill)"
                    fillOpacity={0.25}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="min-w-40 rounded-2xl bg-white/12 px-4 py-3 backdrop-blur">
            <p className="text-[11px] uppercase tracking-wide text-white/70">
              {pipelineTitle}
            </p>
            <p className="kpi-number mt-1 text-2xl">{pipelineValue}</p>
            <p className="mt-1 text-xs text-white/70">{pipelineCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
