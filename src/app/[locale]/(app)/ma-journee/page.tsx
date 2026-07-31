import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  listFiches,
  listHistoriqueSince,
  listProfiles,
  listRdv,
  listRelancesForFiches,
  listTaches,
} from "@/lib/data/queries";
import { daysBetween, formatDate, isToday, startOfToday } from "@/lib/dates";
import { formatDT } from "@/lib/utils";
import { KpiCard } from "@/components/dashboard/kpi-cards";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { Sparkline } from "@/components/dashboard/sparkline";
import { OrigineDonut } from "@/components/dashboard/origine-donut";
import { ProjetDuMois } from "@/components/dashboard/projet-du-mois";
import {
  InsightsPanel,
  type Insight,
} from "@/components/dashboard/insights-panel";
import { AgendaJour } from "@/components/dashboard/agenda-jour";
import { TasksWidget } from "@/components/dashboard/tasks-widget";
import { Classement, type ClassementRow } from "@/components/dashboard/classement";
import { Card, CardTitle } from "@/components/ui/card";

const MID_STAGES = new Set([
  "contacte",
  "rdv_showroom",
  "metre_releve",
  "conception_devis",
  "devis_envoye",
  "negociation",
]);

export default async function MaJourneePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, profile] = await Promise.all([
    getTranslations(),
    getCurrentProfile(),
  ]);
  if (!profile) return null;

  const since90 = new Date();
  since90.setDate(since90.getDate() - 90);

  const [fiches, taches, rdv, profiles, historique] = await Promise.all([
    listFiches(profile),
    listTaches(profile),
    listRdv(profile),
    listProfiles(),
    listHistoriqueSince(profile, since90.toISOString()),
  ]);

  const activeFiches = fiches.filter(
    (f) => f.stage !== "signe" && f.stage !== "perdu",
  );
  const relances = await listRelancesForFiches(activeFiches.map((f) => f.id));

  const now = new Date();
  const today = startOfToday();
  const ficheById = new Map(fiches.map((f) => [f.id, f]));

  /* — KPI 1 : RDV du jour — */
  const rdvToday = rdv
    .filter((r) => isToday(r.debut))
    .sort((a, b) => a.debut.localeCompare(b.debut));
  const nextRdv = rdvToday.find((r) => new Date(r.debut) > now);

  /* — KPI 2 : relances en retard — */
  const relancesRetard = taches.filter(
    (task) =>
      task.statut === "a_faire" &&
      task.auto_generee &&
      task.fiche_id !== null &&
      task.echeance !== null &&
      new Date(task.echeance) < today,
  ).length;

  /* — KPI 3 : devis en attente — */
  const devisAttente = fiches.filter((f) => f.stage === "devis_envoye");
  const devisTotal = devisAttente.reduce(
    (sum, f) => sum + (f.budget_estimatif ?? 0),
    0,
  );

  /* — KPI 4 : CA signé ce mois vs objectif — */
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const signedThisMonth = new Set(
    historique
      .filter(
        (h) => h.stage_to === "signe" && new Date(h.created_at) >= monthStart,
      )
      .map((h) => h.fiche_id),
  );
  const caSigne = [...signedThisMonth].reduce((sum, id) => {
    const fiche = ficheById.get(id);
    return sum + (fiche?.budget_estimatif ?? 0);
  }, 0);
  const objectif =
    profile.role === "conseiller"
      ? profile.objectif_mensuel
      : profiles
          .filter(
            (p) =>
              p.role === "conseiller" &&
              (profile.role !== "chef_showroom" ||
                p.point_de_vente_id === profile.point_de_vente_id),
          )
          .reduce((sum, p) => sum + p.objectif_mensuel, 0);
  const caPercent = objectif > 0 ? Math.round((caSigne / objectif) * 100) : 0;

  /* — Sparkline : nouvelles fiches 7 jours — */
  const fiches7d: { day: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    fiches7d.push({
      day: formatDate(d, "EEE", locale),
      count: fiches.filter((f) => f.created_at.slice(0, 10) === key).length,
    });
  }
  const fiches7dTotal = fiches7d.reduce((sum, p) => sum + p.count, 0);

  /* — Conversion 90 jours — */
  const recent = fiches.filter((f) => new Date(f.created_at) >= since90);
  const conversion =
    recent.length > 0
      ? Math.round(
          (recent.filter((f) => f.stage === "signe").length / recent.length) *
            100,
        )
      : 0;

  /* — Projet du mois — */
  const signedFiches = fiches
    .filter((f) => f.stage === "signe")
    .sort((a, b) => (b.budget_estimatif ?? 0) - (a.budget_estimatif ?? 0));
  const projetDuMois =
    signedFiches.find((f) => signedThisMonth.has(f.id)) ??
    signedFiches[0] ??
    null;

  /* — Origine donut — */
  const origineCounts = { bouche_a_oreille: 0, site_web: 0, foire: 0, publicite: 0 };
  for (const f of fiches) {
    if (f.origine) origineCounts[f.origine] += 1;
  }

  /* — Insights — */
  const lastRelanceByFiche = new Map<string, string>();
  for (const r of relances) {
    const prev = lastRelanceByFiche.get(r.fiche_id);
    if (!prev || r.created_at > prev) lastRelanceByFiche.set(r.fiche_id, r.created_at);
  }
  const insights: Insight[] = [];
  for (const f of activeFiches) {
    if (MID_STAGES.has(f.stage)) {
      const last = lastRelanceByFiche.get(f.id) ?? f.created_at;
      const days = daysBetween(last, now);
      if (days > 7) {
        insights.push({
          type: "noRelance7d",
          ficheId: f.id,
          client: f.client_nom,
          days,
        });
        continue;
      }
    }
    if (f.stage === "devis_envoye" && f.date_effective_remise_devis) {
      const days = daysBetween(f.date_effective_remise_devis, now);
      if (days > 5) {
        insights.push({
          type: "devisNoResponse",
          ficheId: f.id,
          client: f.client_nom,
          days,
        });
        continue;
      }
    }
    if (f.stage === "metre_releve") {
      const days = daysBetween(f.updated_at, now);
      if (days > 10) {
        insights.push({
          type: "metreStuck",
          ficheId: f.id,
          client: f.client_nom,
          days,
        });
        continue;
      }
    }
    if (f.score_completude < 60) {
      const days = daysBetween(f.created_at, now);
      if (days > 3) {
        insights.push({
          type: "ficheIncomplete",
          ficheId: f.id,
          client: f.client_nom,
          days,
          score: f.score_completude,
        });
      }
    }
  }
  insights.sort((a, b) => b.days - a.days);

  /* — Tâches du widget : aujourd'hui + en retard — */
  const widgetTaches = taches.filter(
    (task) =>
      task.statut === "a_faire" &&
      task.echeance !== null &&
      new Date(task.echeance) <= today,
  );

  /* — Classement (chef / direction) — */
  let classement: ClassementRow[] | null = null;
  if (profile.role !== "conseiller") {
    const conseillers = profiles.filter(
      (p) =>
        p.role === "conseiller" &&
        (profile.role !== "chef_showroom" ||
          p.point_de_vente_id === profile.point_de_vente_id),
    );
    classement = conseillers
      .map((p) => {
        const own = fiches.filter((f) => f.conseiller_id === p.id);
        const ownRecent = own.filter((f) => new Date(f.created_at) >= since90);
        const ca = [...signedThisMonth].reduce((sum, id) => {
          const fiche = ficheById.get(id);
          return fiche?.conseiller_id === p.id
            ? sum + (fiche.budget_estimatif ?? 0)
            : sum;
        }, 0);
        const withDevis = own.filter(
          (f) => f.date_effective_remise_devis !== null,
        );
        const delai =
          withDevis.length > 0
            ? Math.round(
                withDevis.reduce(
                  (sum, f) =>
                    sum +
                    daysBetween(f.created_at, f.date_effective_remise_devis as string),
                  0,
                ) / withDevis.length,
              )
            : null;
        return {
          id: p.id,
          nom: p.nom,
          prenom: p.prenom,
          ca,
          conversion:
            ownRecent.length > 0
              ? Math.round(
                  (ownRecent.filter((f) => f.stage === "signe").length /
                    ownRecent.length) *
                    100,
                )
              : 0,
          delai,
        };
      })
      .sort((a, b) => b.ca - a.ca);
  }

  const ficheNames = Object.fromEntries(
    fiches.map((f) => [f.id, f.client_nom] as const),
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          {t("dashboard.greeting", { name: profile.prenom })}
        </h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">
          {formatDate(now, "EEEE d MMMM yyyy", locale)}
        </p>
      </div>

      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("dashboard.kpi.rdvJour")}
          value={rdvToday.length}
          hint={
            nextRdv
              ? t("dashboard.kpi.nextRdv", {
                  time: formatDate(nextRdv.debut, "HH:mm", locale),
                })
              : rdvToday.length === 0
                ? t("dashboard.kpi.noRdv")
                : undefined
          }
        />
        <KpiCard
          label={t("dashboard.kpi.relancesRetard")}
          value={relancesRetard}
          accent={relancesRetard > 0 ? "ambre" : undefined}
          hint={relancesRetard === 0 ? t("dashboard.kpi.relancesOk") : undefined}
        />
        <KpiCard
          label={t("dashboard.kpi.devisAttente")}
          value={devisAttente.length}
          hint={t("dashboard.kpi.devisTotal", { total: formatDT(devisTotal) })}
        />
        <KpiCard
          label={t("dashboard.kpi.caSigne")}
          value={<span className="text-rouge">{formatDT(caSigne)}</span>}
          valueClassName="text-3xl md:text-4xl"
          hint={t("dashboard.kpi.objectif", { total: formatDT(objectif) })}
          trailing={
            <ProgressRing
              percent={caPercent}
              label={t("dashboard.kpi.caSigne")}
            />
          }
        />

        <Card className="p-6">
          <CardTitle className="p-0">
            {t("dashboard.kpi.nouvellesFiches")}
          </CardTitle>
          <p className="kpi-number mt-2 text-4xl">{fiches7dTotal}</p>
          <Sparkline data={fiches7d} />
        </Card>
        <KpiCard
          label={t("dashboard.kpi.tauxConversion")}
          value={`${conversion}%`}
          hint={t("dashboard.kpi.conversionWindow")}
        />
        <ProjetDuMois
          fiche={
            projetDuMois
              ? {
                  client: projetDuMois.client_nom,
                  ville: projetDuMois.ville,
                  montant: formatDT(projetDuMois.budget_estimatif),
                }
              : null
          }
        />
        <Card className="p-6">
          <CardTitle className="p-0">
            {t("dashboard.kpi.origineContacts")}
          </CardTitle>
          <OrigineDonut counts={origineCounts} />
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InsightsPanel insights={insights.slice(0, 8)} />
        <AgendaJour rdv={rdvToday} />
        <TasksWidget taches={widgetTaches} ficheNames={ficheNames} />
      </div>

      {classement && classement.length > 0 && (
        <div className="mt-4">
          <Classement rows={classement} />
        </div>
      )}
    </div>
  );
}
