import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface PipelineCounts {
  aFaire: number;
  enCours: number;
  devis: number;
  signe: number;
}

/** Four pipeline buckets — count, label and share-of-total chip. */
export async function PipelineCounters({
  counts,
  total,
}: {
  counts: PipelineCounts;
  total: number;
}) {
  const t = await getTranslations();
  const buckets = [
    { key: "aFaire", count: counts.aFaire, label: t("stages.nouveau_lead") },
    { key: "enCours", count: counts.enCours, label: t("dashboard.hub.enCours") },
    { key: "devis", count: counts.devis, label: t("stages.conception_devis") },
    { key: "signe", count: counts.signe, label: t("stages.signe") },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg font-semibold normal-case tracking-normal text-foreground">
          {t("dashboard.hub.pipelineCommercial")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {buckets.map((b) => (
            <div key={b.key} className="rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="kpi-number text-3xl">{b.count}</p>
                <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs">
                  {total > 0 ? Math.round((b.count / total) * 100) : 0}%
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{b.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
