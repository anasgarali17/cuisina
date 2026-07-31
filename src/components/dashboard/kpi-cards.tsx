import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Oversized-numeral KPI tile. The only dominant red on the dashboard is the
 * CA signé value — every other tile stays ardoise/ambre. Optional delta chip
 * (▲ vert / ▼ rouge) compares against the previous period.
 */
export function KpiCard({
  label,
  value,
  hint,
  accent,
  trailing,
  valueClassName,
  delta,
  children,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: "ambre" | "rouge" | "vert" | "chene";
  trailing?: React.ReactNode;
  valueClassName?: string;
  delta?: number;
  children?: React.ReactNode;
}) {
  return (
    <Card className="card-lift p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="p-0">{label}</CardTitle>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <p
              className={cn(
                "kpi-number text-5xl",
                accent === "ambre" && "text-ambre",
                accent === "rouge" && "text-rouge",
                accent === "vert" && "text-vert-plan",
                accent === "chene" && "text-chene",
                valueClassName,
              )}
            >
              {value}
            </p>
            {typeof delta === "number" && (
              <span
                className={cn(
                  "inline-block rounded-full px-2 py-0.5 font-mono text-[11px] font-medium",
                  delta >= 0
                    ? "bg-vert-plan/10 text-vert-plan"
                    : "bg-rouge/10 text-rouge",
                )}
              >
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
              </span>
            )}
          </div>
          {hint && (
            <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
      {children}
    </Card>
  );
}
