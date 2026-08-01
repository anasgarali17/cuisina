import { getTranslations } from "next-intl/server";
import { CalendarClock, SquareCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";

export interface EcheanceItem {
  id: string;
  titre: string;
  date: string;
  kind: "rdv" | "tache";
}

/** Upcoming deadlines — merged rendez-vous + open tasks, soonest first. */
export async function Echeances({
  items,
  locale,
}: {
  items: EcheanceItem[];
  locale: string;
}) {
  const t = await getTranslations();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg font-semibold normal-case tracking-normal text-foreground">
          {t("dashboard.hub.echeances")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t("dashboard.hub.echeancesEmpty")}
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const Icon = item.kind === "rdv" ? CalendarClock : SquareCheck;
              return (
                <li key={item.id} className="flex items-center gap-3">
                  <Icon aria-hidden className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {item.titre}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {formatDate(item.date, "d MMM", locale)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
