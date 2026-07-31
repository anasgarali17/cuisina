import { getTranslations } from "next-intl/server";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDT, initials } from "@/lib/utils";

export interface ClassementRow {
  id: string;
  nom: string;
  prenom: string;
  ca: number;
  conversion: number;
  delai: number | null;
}

/** Discreet conseiller strip for chef/direction — informative, not a scoreboard. */
export async function Classement({ rows }: { rows: ClassementRow[] }) {
  const t = await getTranslations();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.classement.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex min-w-56 shrink-0 items-center gap-3 rounded-2xl border border-border px-4 py-3"
            >
              <Avatar className="size-9">
                <AvatarFallback>{initials(row.nom, row.prenom)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {row.prenom} {row.nom}
                </p>
                <dl className="mt-1 flex gap-4">
                  <div>
                    <dt className="text-[10px] uppercase text-muted-foreground">
                      {t("dashboard.classement.caSigne")}
                    </dt>
                    <dd className="font-mono text-xs">{formatDT(row.ca)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-muted-foreground">
                      {t("dashboard.classement.conversion")}
                    </dt>
                    <dd className="font-mono text-xs">{row.conversion}%</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-muted-foreground">
                      {t("dashboard.classement.delaiDevis")}
                    </dt>
                    <dd className="font-mono text-xs">
                      {row.delai !== null
                        ? t("dashboard.classement.days", { n: row.delai })
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
