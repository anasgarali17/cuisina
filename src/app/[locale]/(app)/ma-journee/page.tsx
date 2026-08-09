import { getTranslations } from "next-intl/server";
import {
  BellRing,
  CalendarDays,
  FileClock,
  FolderOpen,
  Percent,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import {
  listClients,
  listFiches,
  listHistoriqueSince,
  listProfiles,
  listRdv,
  listRelancesForFiches,
  listTaches,
} from "@/lib/data/queries";
import { daysBetween, formatDate, isToday, startOfToday } from "@/lib/dates";
import { formatDT } from "@/lib/utils";
import { exigencesSchema } from "@/lib/schemas/fiche";
import { HeroBanner, type SparkPoint } from "@/components/dashboard/hero-banner";
import { PastelKpi } from "@/components/dashboard/pastel-kpi";
import {
  ActivityChart,
  type ActivityPoint,
} from "@/components/dashboard/activity-chart";
import { TopClients } from "@/components/dashboard/top-clients";
import { PipelineCounters } from "@/components/dashboard/pipeline-counters";
import { Echeances, type EcheanceItem } from "@/components/dashboard/echeances";
import {
  InsightsPanel,
  type Insight,
} from "@/components/dashboard/insights-panel";
import { AgendaJour } from "@/components/dashboard/agenda-jour";
import { TasksWidget } from "@/components/dashboard/tasks-widget";
import {
  Classement,
  type ClassementRow,
} from "@/components/dashboard/classement";
import { LatestFiches } from "@/components/dashboard/latest-fiches";
import {
  ProductsStrip,
  type ProductCounts,
} from "@/components/dashboard/products-strip";

const MID_STAGES = new Set([
  "contacte",
  "rdv_showroom",
  "metre_releve",
  "conception_devis",
  "devis_envoye",
  "negociation",
]);

const ENCOURS_STAGES = new Set([
  "contacte",
  "rdv_showroom",
  "metre_releve",
  "conception_devis",
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

  const [fiches, taches, rdv, profiles, historique, clients] =
    await Promise.all([
      listFiches(profile),
      listTaches(profile),
      listRdv(profile),
      listProfiles(),
      listHistoriqueSince(profile, since90.toISOString()),
      listClients(profile),
    ]);

  const activeFiches = fiches.filter(
    (f) => f.stage !== "signe" && f.stage !== "perdu",
  );
  const relances = await listRelancesForFiches(activeFiches.map((f) => f.id));

  const now = new Date();
  const today = startOfToday();
  const ficheById = new Map(fiches.map((f) => [f.id, f]));

  /* — RDV du jour — */
  const rdvToday = rdv
    .filter((r) => isToday(r.debut))
    .sort((a, b) => a.debut.localeCompare(b.debut));

  /* — Relances en retard — */
  const relancesRetard = taches.filter(
    (task) =>
      task.statut === "a_faire" &&
      task.auto_generee &&
      task.fiche_id !== null &&
      task.echeance !== null &&
      new Date(task.echeance) < today,
  ).length;

  /* — Devis en attente — */
  const devisAttente = fiches.filter((f) => f.stage === "devis_envoye");
  const devisTotal = devisAttente.reduce(
    (sum, f) => sum + (f.budget_estimatif ?? 0),
    0,
  );

  /* — CA signé ce mois vs objectif — */
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

  /* — CA du mois précédent → delta du hero — */
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const signedPrevMonth = new Set(
    historique
      .filter((h) => {
        const at = new Date(h.created_at);
        return h.stage_to === "signe" && at >= prevMonthStart && at < monthStart;
      })
      .map((h) => h.fiche_id),
  );
  const caPrevMonth = [...signedPrevMonth].reduce((sum, id) => {
    const fiche = ficheById.get(id);
    return sum + (fiche?.budget_estimatif ?? 0);
  }, 0);
  const deltaPct =
    caPrevMonth > 0
      ? Math.round(((caSigne - caPrevMonth) / caPrevMonth) * 100)
      : null;

  /* — Nouvelles fiches, 30 jours (area chart) — */
  const fiches30d: ActivityPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    fiches30d.push({
      d: formatDate(d, "d MMM", locale),
      label: formatDate(d, "d", locale),
      v: fiches.filter((f) => f.created_at.slice(0, 10) === key).length,
    });
  }

  /* — Fiches créées par mois, 12 derniers mois (hero spark) — */
  const spark12m: SparkPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    spark12m.push({
      d: formatDate(month, "MMM", locale),
      v: fiches.filter((f) => {
        const c = new Date(f.created_at);
        return c >= month && c < next;
      }).length,
    });
  }

  /* — Valeur pipeline — */
  const valeurPipeline = activeFiches.reduce(
    (sum, f) => sum + (f.budget_estimatif ?? 0),
    0,
  );
  const activeCount = activeFiches.length;

  /* — Conversion 90 jours — */
  const recent = fiches.filter((f) => new Date(f.created_at) >= since90);
  const conversion =
    recent.length > 0
      ? Math.round(
          (recent.filter((f) => f.stage === "signe").length / recent.length) *
            100,
        )
      : 0;

  /* — Top client signé — */
  const signedFiches = fiches
    .filter((f) => f.stage === "signe")
    .sort((a, b) => (b.budget_estimatif ?? 0) - (a.budget_estimatif ?? 0));
  const topSigned = signedFiches[0] ?? null;

  /* — Top clients par CA cumulé — */
  const topClients = [...clients]
    .sort((a, b) => b.ca_cumule - a.ca_cumule)
    .slice(0, 5)
    .map((c) => ({ id: c.id, nom: c.nom, ca: c.ca_cumule }));

  /* — Prochain RDV (toutes dates) — */
  const prochainRdv = [...rdv]
    .filter((r) => new Date(r.debut) > now)
    .sort((a, b) => a.debut.localeCompare(b.debut))[0];
  const prochainRdvValue = prochainRdv
    ? formatDate(prochainRdv.debut, "d MMM · HH:mm", locale)
    : "—";

  /* — Compteurs pipeline — */
  const pipelineCounts = {
    aFaire: fiches.filter((f) => f.stage === "nouveau_contact").length,
    enCours: fiches.filter((f) => ENCOURS_STAGES.has(f.stage)).length,
    devis: devisAttente.length,
    signe: signedFiches.length,
  };

  /* — Échéances à venir : RDV + tâches ouvertes — */
  const echeances: EcheanceItem[] = [
    ...rdv
      .filter((r) => new Date(r.debut) >= today)
      .map((r) => ({
        id: `rdv-${r.id}`,
        titre: r.titre,
        date: r.debut,
        kind: "rdv" as const,
      })),
    ...taches.flatMap((task) =>
      task.statut === "a_faire" &&
      task.echeance !== null &&
      new Date(task.echeance) >= today
        ? [
            {
              id: `tache-${task.id}`,
              titre: task.titre,
              date: task.echeance,
              kind: "tache" as const,
            },
          ]
        : [],
    ),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  /* — Insights — */
  const lastRelanceByFiche = new Map<string, string>();
  for (const r of relances) {
    const prev = lastRelanceByFiche.get(r.fiche_id);
    if (!prev || r.created_at > prev)
      lastRelanceByFiche.set(r.fiche_id, r.created_at);
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

  /* — Tâches (aujourd'hui + retard) — */
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
                    daysBetween(
                      f.created_at,
                      f.date_effective_remise_devis as string,
                    ),
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

  const conseillerNames = Object.fromEntries(
    profiles.map((p) => [p.id, `${p.prenom} ${p.nom}`]),
  );
  const ficheNames = Object.fromEntries(
    fiches.map((f) => [f.id, f.client_nom] as const),
  );

  /* — Produits demandés (Exigences des fiches actives) — */
  const productCounts: ProductCounts = {
    evier: 0,
    plaque: 0,
    hotte: 0,
    four: 0,
    micro_onde: 0,
    frigo: 0,
    lave_vaisselle: 0,
  };
  for (const f of activeFiches) {
    const parsed = exigencesSchema.safeParse(f.exigences);
    if (!parsed.success) continue;
    const e = parsed.data.electromenager;
    if (e.evier) productCounts.evier += 1;
    if (e.plaque) productCounts.plaque += 1;
    if (e.hotte) productCounts.hotte += 1;
    if (e.four) productCounts.four += 1;
    if (e.micro_onde) productCounts.micro_onde += 1;
    if (e.frigo) productCounts.frigo += 1;
    if (e.lave_vaisselle) productCounts.lave_vaisselle += 1;
  }
  const latest = [...fiches]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 6);

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

      {/* — Hero banner — */}
      <HeroBanner
        label={t("dashboard.hub.heroLabel")}
        amount={formatDT(caSigne)}
        deltaPct={deltaPct}
        vsLabel={t("dashboard.hub.vsM1")}
        pendingLabel={t("dashboard.hub.enAttente")}
        pendingAmount={formatDT(devisTotal)}
        objectifLabel={t("dashboard.kpi.objectif", {
          total: formatDT(objectif),
        })}
        sparkTitle={t("dashboard.hub.derniersMois")}
        sparkData={spark12m}
        pipelineTitle={t("dashboard.hub.valeurPipeline")}
        pipelineValue={formatDT(valeurPipeline)}
        pipelineCount={`${t("dashboard.hub.fichesActives")} · ${activeCount}`}
      />

      {/* — Pastel KPI grid — */}
      <div className="stagger mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PastelKpi
          tone="green"
          title={t("dashboard.kpi.caSigne")}
          value={formatDT(caSigne)}
          icon={<Wallet className="size-5" />}
        />
        <PastelKpi
          tone="blue"
          title={t("dashboard.kpi.devisAttente")}
          value={devisAttente.length}
          hint={t("dashboard.kpi.devisTotal", { total: formatDT(devisTotal) })}
          icon={<FileClock className="size-5" />}
        />
        <PastelKpi
          tone="violet"
          title={t("dashboard.kpi.tauxConversion")}
          value={`${conversion}%`}
          hint={t("dashboard.kpi.conversionWindow")}
          icon={<Percent className="size-5" />}
        />
        <PastelKpi
          tone="amber"
          title={t("dashboard.kpi.relancesRetard")}
          value={relancesRetard}
          icon={<BellRing className="size-5" />}
        />
        <PastelKpi
          tone="orange"
          title={t("dashboard.hub.fichesActives")}
          value={activeCount}
          hint={formatDT(valeurPipeline)}
          icon={<FolderOpen className="size-5" />}
        />
        <PastelKpi
          tone="green"
          title={t("dashboard.hub.prochainRdv")}
          value={<span className="text-2xl">{prochainRdvValue}</span>}
          icon={<CalendarDays className="size-5" />}
        />
        <PastelKpi
          tone="violet"
          title={t("dashboard.hub.topClient")}
          value={
            <span className="block truncate text-2xl">
              {topSigned?.client_nom ?? "—"}
            </span>
          }
          hint={topSigned ? formatDT(topSigned.budget_estimatif) : undefined}
          icon={<Trophy className="size-5" />}
        />
        <PastelKpi
          tone="blue"
          title={t("dashboard.hub.clientsActifs")}
          value={clients.length}
          icon={<Users className="size-5" />}
        />
      </div>

      {/* — Activity + top clients — */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <ActivityChart
          data={fiches30d}
          title={t("dashboard.hub.activite")}
          subtitle={t("dashboard.hub.activiteSub")}
          label7={t("dashboard.hub.jours7")}
          label30={t("dashboard.hub.jours30")}
          seriesLabel={t("dashboard.hub.fichesJour")}
          trendLabel={t("dashboard.hub.tendance")}
        />
        <TopClients clients={topClients} />
      </div>

      {/* — Pipeline + échéances — */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <PipelineCounters counts={pipelineCounts} total={fiches.length} />
        <Echeances items={echeances} locale={locale} />
      </div>

      {/* — Operational row — */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InsightsPanel insights={insights.slice(0, 8)} />
        <AgendaJour rdv={rdvToday} />
        <TasksWidget taches={widgetTaches} ficheNames={ficheNames} />
      </div>

      <div className="mt-4">
        <ProductsStrip counts={productCounts} />
      </div>

      {classement && classement.length > 0 && (
        <div className="mt-4">
          <Classement rows={classement} />
        </div>
      )}

      <div className="mt-6">
        <LatestFiches
          fiches={latest}
          conseillers={conseillerNames}
          total={fiches.length}
        />
      </div>
    </div>
  );
}
