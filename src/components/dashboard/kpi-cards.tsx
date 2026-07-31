import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Oversized-numeral KPI tile. The only dominant red on the dashboard is the
 * CA signé value — every other tile stays ardoise/ambre.
 */
export function KpiCard({
  label,
  value,
  hint,
  accent,
  trailing,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: "ambre" | "rouge" | "vert" | "chene";
  trailing?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card className="card-lift p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="p-0">{label}</CardTitle>
          <p
            className={cn(
              "kpi-number mt-2 text-5xl",
              accent === "ambre" && "text-ambre",
              accent === "rouge" && "text-rouge",
              accent === "vert" && "text-vert-plan",
              accent === "chene" && "text-chene",
              valueClassName,
            )}
          >
            {value}
          </p>
          {hint && (
            <p className="mt-2 truncate text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
    </Card>
  );
}
