import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { RendezVousRow } from "@/lib/database.types";

/**
 * Les rendez-vous de demain, du plus proche au plus lointain.
 *
 * Ce qu'on prépare la veille au soir, pas le matin même : le premier
 * rendez-vous est mis en avant parce que c'est celui pour lequel il reste le
 * moins de temps — c'est aussi celui que l'e-mail de 15 h annonce.
 */
export async function RdvDemain({ rdv }: { rdv: RendezVousRow[] }) {
  const t = await getTranslations();
  const locale = await getLocale();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary"
          >
            <CalendarClock className="size-3.5" />
          </span>
          {t("dashboard.rdvDemain.titre")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rdv.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            {t("dashboard.rdvDemain.vide")}
          </p>
        ) : (
          <ol className="space-y-2.5">
            {rdv.map((r, i) => (
              <li key={r.id}>
                <Link
                  href="/agenda-client"
                  className={cn(
                    "flex items-start gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-secondary/60",
                    i === 0 && "bg-secondary/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 font-mono text-xs",
                      i === 0
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {formatDate(r.debut, "HH:mm", locale)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.titre}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="chene">{t(`rdv.types.${r.type}`)}</Badge>
                      {r.lieu && (
                        <span className="flex min-w-0 items-center gap-1">
                          <MapPin aria-hidden className="size-3 shrink-0" />
                          <span className="truncate">{r.lieu}</span>
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
