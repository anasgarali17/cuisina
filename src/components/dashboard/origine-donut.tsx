"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  CHART_CATEGORICAL_DARK,
  CHART_CATEGORICAL_LIGHT,
  ORIGINE_COLOR_INDEX,
} from "@/lib/chart-colors";
import { ORIGINES, type Origine } from "@/lib/domain";

/** Fixed entity→hue assignment (validated palette) — never colored by rank. */
export function OrigineDonut({ counts }: { counts: Record<Origine, number> }) {
  const t = useTranslations();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const palette = dark ? CHART_CATEGORICAL_DARK : CHART_CATEGORICAL_LIGHT;
  const data = ORIGINES.map((o) => ({
    key: o,
    name: t(`origines.${o}`),
    value: counts[o],
    color: palette[ORIGINE_COLOR_INDEX[o]],
  })).filter((d) => d.value > 0);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <p className="mt-6 text-sm italic text-muted-foreground">
        {t("dashboard.insights.empty")}
      </p>
    );
  }

  return (
    <div>
      <div className="relative mt-2 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-lg border border-border bg-card px-2 py-1 text-xs shadow-sm">
                    {d.name}{" "}
                    <span className="font-mono font-medium">{d.value}</span>
                  </div>
                );
              }}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="kpi-number text-2xl">{total}</span>
        </div>
      </div>
      <ul className="mt-3 space-y-1">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: d.color }}
            />
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <span className="font-mono text-muted-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
