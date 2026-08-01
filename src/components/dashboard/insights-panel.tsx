import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  CircleDashed,
  FileClock,
  Ruler,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface Insight {
  type: "noRelance7d" | "devisNoResponse" | "metreStuck" | "ficheIncomplete";
  ficheId: string;
  client: string;
  days: number;
  score?: number;
}

const ICONS: Record<Insight["type"], { icon: LucideIcon; className: string }> =
  {
    noRelance7d: { icon: TriangleAlert, className: "text-ambre" },
    devisNoResponse: { icon: FileClock, className: "text-chene" },
    metreStuck: { icon: Ruler, className: "text-chene" },
    ficheIncomplete: { icon: CircleDashed, className: "text-muted-foreground" },
  };

/** Computed signals — every row is actionable and links to its fiche. */
export async function InsightsPanel({ insights }: { insights: Insight[] }) {
  const t = await getTranslations();

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"
        >
          <Sparkles className="size-5" />
        </span>
        <CardTitle className="font-display text-lg font-semibold normal-case tracking-normal text-foreground">
          {t("dashboard.insights.title")}
        </CardTitle>
        <Link
          href="/fiches"
          className="ms-auto flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          {t("app.seeAll")}
          <ArrowRight className="size-3.5 rtl:-scale-x-100" />
        </Link>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            {t("dashboard.insights.empty")}
          </p>
        ) : (
          <ul>
            {insights.map((insight) => {
              const { icon: Icon, className } = ICONS[insight.type];
              return (
                <li key={`${insight.type}-${insight.ficheId}`}>
                  <Link
                    href={`/fiches/${insight.ficheId}`}
                    className="mb-2 flex items-start gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm transition-colors hover:bg-secondary"
                  >
                    <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} />
                    <span className="min-w-0">
                      {t(`dashboard.insights.${insight.type}`, {
                        client: insight.client,
                        days: insight.days,
                        score: insight.score ?? 0,
                      })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
