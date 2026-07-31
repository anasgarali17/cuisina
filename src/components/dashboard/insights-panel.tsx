import { getTranslations } from "next-intl/server";
import {
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary"
          >
            <Sparkles className="size-3.5" />
          </span>
          {t("dashboard.insights.title")}
          {insights.length > 0 && (
            <span aria-hidden className="size-2 rounded-full bg-ambre" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3">
        {insights.length === 0 ? (
          <p className="px-3 text-sm italic text-muted-foreground">
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
                    className="flex items-start gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-secondary"
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
