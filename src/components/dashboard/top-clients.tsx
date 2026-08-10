import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDT } from "@/lib/utils";

export interface TopClientItem {
  id: string;
  nom: string;
  ca: number;
}

function wordInitials(nom: string): string {
  return (
    nom
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/** Top 5 clients by cumulated revenue, with red progress tracks. */
export async function TopClients({ clients }: { clients: TopClientItem[] }) {
  const t = await getTranslations();
  const max = clients.reduce((m, c) => Math.max(m, c.ca), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg font-semibold normal-case tracking-normal text-foreground">
          {t("dashboard.hub.topClients")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            {t("clients.empty")}
          </p>
        ) : (
          <ul className="space-y-4">
            {clients.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-xs font-semibold"
                >
                  {wordInitials(c.nom)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium">{c.nom}</p>
                    <span className="shrink-0 font-mono text-sm">
                      {formatDT(c.ca)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-secondary">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{
                        width: `${max > 0 ? Math.round((c.ca / max) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
