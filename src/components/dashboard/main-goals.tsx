import { getTranslations } from "next-intl/server";
import { Card, CardTitle } from "@/components/ui/card";
import { SemiGauge } from "@/components/dashboard/semi-gauge";

/**
 * The reference's "Main goals" block: headline amounts over striped
 * progress bars, plus the conversion gauge.
 */
export async function MainGoals({
  caSigne,
  caPercent,
  objectifHint,
  devisCount,
  devisTotal,
  conversion,
}: {
  caSigne: string;
  caPercent: number;
  objectifHint: string;
  devisCount: number;
  devisTotal: string;
  conversion: number;
}) {
  const t = await getTranslations();

  return (
    <Card className="p-6">
      <CardTitle className="p-0">{t("dashboard.hub.goals")}</CardTitle>

      <div className="mt-4">
        <p className="text-xs text-muted-foreground">
          {t("dashboard.kpi.caSigne")}
        </p>
        <p className="kpi-number mt-1 text-3xl text-rouge">{caSigne}</p>
        <div
          className="hatch relative mt-2 h-3 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={Math.min(100, caPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("dashboard.kpi.caSigne")}
        >
          <div
            className="absolute inset-y-0 start-0 rounded-full bg-rouge"
            style={{ width: `${Math.max(2, Math.min(100, caPercent))}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{objectifHint}</p>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {t("dashboard.kpi.devisAttente")}
        </p>
        <div className="flex items-baseline gap-3">
          <p className="kpi-number mt-1 text-3xl">{devisCount}</p>
          <p className="font-mono text-sm text-muted-foreground">{devisTotal}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.kpi.tauxConversion")}
          </p>
          <p className="kpi-number mt-1 text-3xl">{conversion}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("dashboard.kpi.conversionWindow")}
          </p>
        </div>
        <SemiGauge percent={conversion} label={t("dashboard.kpi.tauxConversion")} />
      </div>
    </Card>
  );
}
