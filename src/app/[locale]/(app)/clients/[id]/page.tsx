import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/auth";
import { getClient } from "@/lib/data/queries";
import { formatDate } from "@/lib/dates";
import { formatDT } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const [t, profile, data] = await Promise.all([
    getTranslations(),
    getCurrentProfile(),
    getClient(id),
  ]);
  if (!profile) return null;
  if (!data) notFound();

  const { client, fiches } = data;
  const signed = fiches
    .filter((f) => f.stage === "signe")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  return (
    <div>
      <PageHeader title={client.nom} subtitle={client.ville ?? undefined} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("clients.identity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {(
                [
                  [t("clients.nom"), client.nom, false],
                  [t("clients.tel"), client.tel, true],
                  [t("clients.email"), client.email, false],
                  [t("clients.adresse"), client.adresse, false],
                  [t("clients.ville"), client.ville, false],
                ] as const
              ).map(([label, value, mono]) => (
                <div key={label}>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className={mono ? "font-mono" : undefined}>
                    {value ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("clients.linkedFiches")}</CardTitle>
          </CardHeader>
          <CardContent>
            {fiches.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-2.5">
                {fiches.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/fiches/${f.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-secondary"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {f.client_nom}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {f.reference}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant={
                            f.stage === "signe"
                              ? "vert"
                              : f.stage === "perdu"
                                ? "rouge"
                                : "outline"
                          }
                        >
                          {t(`stages.${f.stage}`)}
                        </Badge>
                        <span className="font-mono text-xs">
                          {formatDT(f.budget_estimatif)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardTitle className="p-0">{t("clients.caCumule")}</CardTitle>
          <p className="kpi-number mt-3 text-4xl text-rouge">
            {formatDT(client.ca_cumule)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("clients.nbProjets", { count: client.nb_projets })}
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("clients.projectHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {signed.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ol className="space-y-3">
              {signed.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex items-center gap-3">
                    <span className="size-2 rounded-full bg-vert-plan" />
                    <Link
                      href={`/fiches/${f.id}`}
                      className="font-medium hover:underline"
                    >
                      {f.reference}
                    </Link>
                    <span className="text-muted-foreground">
                      {formatDate(f.updated_at, "d MMM yyyy", locale)}
                    </span>
                  </span>
                  <span className="font-mono">
                    {formatDT(f.budget_estimatif)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Reserved: client tier + scoring (Phase 2) */}
      <div className="mt-4 rounded-3xl border-2 border-dashed border-chene/40 p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("clients.tierComing")}</p>
      </div>
    </div>
  );
}
