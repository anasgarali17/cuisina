import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import type { RendezVousRow } from "@/lib/database.types";

/** Read-only chronological list of today's rendez-vous (full calendar in Phase 2). */
export async function AgendaJour({ rdv }: { rdv: RendezVousRow[] }) {
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
          {t("dashboard.agenda.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rdv.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            {t("dashboard.agenda.empty")}
          </p>
        ) : (
          <ol className="space-y-3">
            {rdv.map((r) => (
              <li key={r.id} className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">
                  {formatDate(r.debut, "HH:mm", locale)}
                  <span className="block text-[10px] opacity-70">
                    {formatDate(r.fin, "HH:mm", locale)}
                  </span>
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.titre}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="chene">{t(`rdv.types.${r.type}`)}</Badge>
                    {r.lieu && <span className="truncate">{r.lieu}</span>}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
