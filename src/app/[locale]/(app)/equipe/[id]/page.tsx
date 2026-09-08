import { profilAutorise } from "@/lib/garde";
import { ENCADREMENT } from "@/components/shell/nav-config";
import { showroomsVisibles } from "@/lib/acces";
import { AccesRefuse } from "@/components/shell/acces-refuse";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MapPin, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  listFiches,
  listHistoriqueSince,
  listPdvs,
  listProfiles,
} from "@/lib/data/queries";
import { formatDate } from "@/lib/dates";
import { STAGE_CHIP, stageProgress } from "@/lib/stage-ui";
import { cn, formatDT, initials } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ObjectifDialog } from "@/components/equipe/objectif-dialog";

export default async function ShowroomDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const [t, profile] = await Promise.all([
    getTranslations(),
    profilAutorise(ENCADREMENT),
  ]);
  if (!profile) return <AccesRefuse />;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const since90 = new Date();
  since90.setDate(since90.getDate() - 90);

  const [tousPdvs, profiles, fiches, historique] = await Promise.all([
    listPdvs(),
    listProfiles(),
    listFiches(profile),
    listHistoriqueSince(profile, monthStart.toISOString()),
  ]);

  /* On cherche l'adresse tapée dans les seuls showrooms ouverts à ce profil :
     un chef de showroom qui devine l'identifiant du voisin tombe sur
     « Section réservée », pas sur les chiffres du voisin. */
  const pdvs = showroomsVisibles(profile, tousPdvs);
  const pdv = pdvs.find((p) => p.id === id);
  if (!pdv) {
    return tousPdvs.some((p) => p.id === id) ? <AccesRefuse /> : notFound();
  }

  const own = fiches.filter((f) => f.point_de_vente_id === pdv.id);
  const team = profiles.filter((p) => p.point_de_vente_id === pdv.id);
  const ficheById = new Map(fiches.map((f) => [f.id, f]));

  const caMois = historique
    .filter((h) => h.stage_to === "signe")
    .reduce((sum, h) => {
      const fiche = ficheById.get(h.fiche_id);
      return fiche?.point_de_vente_id === pdv.id
        ? sum + (fiche.budget_estimatif ?? 0)
        : sum;
    }, 0);

  const actives = own.filter(
    (f) => f.stage !== "signe" && f.stage !== "perdu",
  ).length;

  const recent = own.filter((f) => new Date(f.created_at) >= since90);
  const conversion =
    recent.length > 0
      ? Math.round(
          (recent.filter((f) => f.stage === "signe").length / recent.length) *
            100,
        )
      : 0;

  const signed = own.filter((f) => f.stage === "signe");
  const panierMoyen =
    signed.length > 0
      ? Math.round(
          signed.reduce((sum, f) => sum + (f.budget_estimatif ?? 0), 0) /
            signed.length,
        )
      : 0;

  const latest = [...own]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5);

  const isAdmin = profile.role === "admin";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={pdv.nom} subtitle={pdv.ville} />

      {/* Hero card — banner over a white body, reference structure */}
      <Card className="overflow-hidden p-0">
        <div
          className="relative flex min-h-44 flex-col justify-end p-6 text-white md:min-h-52"
          style={{
            backgroundImage: [
              "linear-gradient(to top, rgba(23,23,23,0.85) 0%, rgba(23,23,23,0.25) 55%, rgba(23,23,23,0.35) 100%)",
              "radial-gradient(70% 90% at 80% 10%, rgba(193,18,31,0.55), transparent 65%)",
              "linear-gradient(120deg, #5c0a11 0%, #a30f1a 55%, #e0454f 100%)",
            ].join(", "),
          }}
        >
          <h2 className="font-display text-2xl font-bold leading-tight md:text-3xl">
            {pdv.nom}
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/80">
            <MapPin aria-hidden className="size-3.5" />
            {pdv.adresse ?? pdv.ville}
          </p>
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-lg font-semibold">
                {t("equipe.conseillers", { count: team.length })}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("equipe.fichesActives")} · {actives}
              </p>
            </div>
            {pdv.telephone && (
              <a
                href={`tel:${pdv.telephone.replace(/\s/g, "")}`}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-secondary"
              >
                <Phone aria-hidden className="size-4 text-primary" />
                <span className="font-mono text-xs">{pdv.telephone}</span>
              </a>
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-4 border-t border-border pt-5">
            <div>
              <p className="kpi-number text-xl">{formatDT(caMois)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("equipe.caCumule")}
              </p>
            </div>
            <div>
              <p className="kpi-number text-xl">{conversion}%</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("equipe.tauxConversion")}
              </p>
            </div>
            <div>
              <p className="kpi-number text-xl">{formatDT(panierMoyen)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("equipe.panierMoyen")}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Team */}
      <Card className="mt-4 p-6">
        <h3 className="font-display text-lg font-semibold">
          {t("equipe.equipeTitle")}
        </h3>
        <ul className="mt-3 space-y-3">
          {team.map((member) => (
            <li key={member.id} className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarFallback>
                  {initials(member.nom, member.prenom)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.prenom} {member.nom}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(`equipe.roles.${member.role}`)}
                </p>
              </div>
              {member.role === "conseiller" && (
                <div className="flex items-center gap-1 text-end">
                  <div>
                    <p className="text-[9px] uppercase text-muted-foreground">
                      {t("equipe.objectifMensuel")}
                    </p>
                    <p className="font-mono text-xs">
                      {formatDT(member.objectif_mensuel)}
                    </p>
                  </div>
                  {isAdmin && (
                    <ObjectifDialog
                      profileId={member.id}
                      name={`${member.prenom} ${member.nom}`}
                      current={member.objectif_mensuel}
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {/* Recent fiches */}
      <Card className="mt-4 p-6">
        <h3 className="font-display text-lg font-semibold">
          {t("equipe.fichesRecentes")}
        </h3>
        {latest.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("equipe.aucuneFiche")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {latest.map((f) => {
              const progress = stageProgress(f.stage);
              return (
                <li key={f.id}>
                  <Link
                    href={`/fiches/${f.id}`}
                    className="flex items-center gap-3 py-3 hover:bg-secondary/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {f.client_nom}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {f.reference} ·{" "}
                        {formatDate(f.updated_at, "d MMM yyyy", locale)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        STAGE_CHIP[f.stage],
                      )}
                    >
                      {t(`stages.${f.stage}`)}
                    </span>
                    <span className="w-20 shrink-0 text-end">
                      <span className="text-sm font-semibold tabular-nums">
                        {progress}%
                      </span>
                      <span
                        aria-hidden
                        className="mt-1 block h-1.5 rounded-full bg-secondary"
                      >
                        <span
                          className="block h-full rounded-full bg-emerald-500"
                          style={{ width: `${progress}%` }}
                        />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
