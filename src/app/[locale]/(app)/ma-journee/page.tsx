import { getTranslations } from "next-intl/server";
import {
  BellRing,
  CalendarDays,
  FileClock,
  FolderOpen,
  Percent,
  Users,
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
import {
  SectionSwitcher,
  type DashboardSection,
} from "@/components/dashboard/section-switcher";
import { PastelKpi } from "@/components/dashboard/pastel-kpi";
import {
  ActivityChart,
  type ActivityPoint,
} from "@/components/dashboard/activity-chart";
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
import { RdvDemain } from "@/components/dashboard/rdv-demain";
import {
  TableauHebdo,
  celluleVide,
  type CelluleHebdo,
  type FamilleHebdo,
  type SemaineRow,
} from "@/components/dashboard/tableau-hebdo";
import {
  ProductsStrip,
  type ProductCounts,
} from "@/components/dashboard/products-strip";

/** Les étapes où un silence se paie : ni tout début, ni dossier conclu. */
const MID_STAGES = new Set([
  "releve_preliminaire",
  "conception_devis",
  "rdv_showroom",
  "cloture",
]);

const ENCOURS_STAGES = new Set([
  "releve_preliminaire",
  "conception_devis",
  "rdv_showroom",
  "cloture",
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

  /* — RDV de demain, du plus proche au plus lointain — */
  const demainDebut = new Date(today);
  demainDebut.setDate(demainDebut.getDate() + 1);
  const demainFin = new Date(demainDebut);
  demainFin.setDate(demainFin.getDate() + 1);
  const rdvDemain = rdv
    .filter((r) => {
      const d = new Date(r.debut);
      return d >= demainDebut && d < demainFin;
    })
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
  const devisAttente = fiches.filter((f) => f.stage === "conception_devis");
  const devisTotal = devisAttente.reduce(
    (sum, f) => sum + (f.budget_estimatif ?? 0),
    0,
  );

  /*
   * Les fiches signées ce mois. La carte « CA signé » a disparu du tableau de
   * bord, mais le classement de la direction s'appuie encore sur cet ensemble
   * — c'est la seule raison de le calculer ici.
   */
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const signedThisMonth = new Set(
    historique
      .filter(
        (h) => h.stage_to === "signe" && new Date(h.created_at) >= monthStart,
      )
      .map((h) => h.fiche_id),
  );

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

  /* — Fiches signées, pour le compteur du pipeline — */
  const signedFiches = fiches.filter((f) => f.stage === "signe");

  /* — Prochain RDV (toutes dates) — */
  const prochainRdv = [...rdv]
    .filter((r) => new Date(r.debut) > now)
    .sort((a, b) => a.debut.localeCompare(b.debut))[0];
  const prochainRdvValue = prochainRdv
    ? formatDate(prochainRdv.debut, "d MMM · HH:mm", locale)
    : "—";

  /* — Compteurs pipeline — */
  const pipelineCounts = {
    aFaire: fiches.filter((f) => f.stage === "nouveau_lead").length,
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
    if (f.stage === "conception_devis" && f.date_effective_remise_devis) {
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
    if (f.stage === "releve_preliminaire") {
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

  /*
   * Tableau hebdomadaire — la reprise du fichier Excel de la direction.
   *
   * Un devis se compte au passage en « Conception devis », un bon de commande
   * au passage en « Signé » : c'est la date du mouvement qui compte, pas celle
   * de création de la fiche. La valeur vient du budget estimatif.
   *
   * Une fiche qui porte une cuisine *et* un dressing compte dans les deux
   * familles — c'est ce que fait le fichier papier, où une affaire mixte
   * apparaît sur les deux colonnes. Sa valeur, elle, est répartie au prorata
   * du nombre d'éléments, pour qu'un total de ligne reste juste.
   */
  const semaines: SemaineRow[] = [];
  for (let i = 0; i < 8; i++) {
    // Semaine du lundi au dimanche : `getDay()` renvoie 0 pour dimanche, qu'on
    // ramène à 6 pour que la semaine commence le lundi comme sur l'agenda.
    const debut = new Date(today);
    const decalage = (debut.getDay() + 6) % 7;
    debut.setDate(debut.getDate() - decalage - i * 7);
    const finSemaine = new Date(debut);
    finSemaine.setDate(finSemaine.getDate() + 7);

    const dans = (iso: string) => {
      const d = new Date(iso);
      return d >= debut && d < finSemaine;
    };

    const familles: Record<FamilleHebdo, CelluleHebdo> = {
      cuisine: celluleVide(),
      dressing: celluleVide(),
      electro: celluleVide(),
      pt: celluleVide(),
    };

    for (const h of historique) {
      const devis = h.stage_to === "conception_devis";
      const bc = h.stage_to === "signe";
      if ((!devis && !bc) || !dans(h.created_at)) continue;

      const fiche = ficheById.get(h.fiche_id);
      if (!fiche) continue;

      const elements = fiche.nb_cuisines + fiche.nb_dressings;
      if (elements === 0) continue;
      const valeur = fiche.budget_estimatif ?? 0;

      for (const [famille, nb] of [
        ["cuisine", fiche.nb_cuisines],
        ["dressing", fiche.nb_dressings],
      ] as const) {
        if (nb === 0) continue;
        const part = Math.round((valeur * nb) / elements);
        const cellule = familles[famille];
        if (devis) {
          cellule.nbDevis += 1;
          cellule.valeurDevis += part;
        } else {
          cellule.nbBc += 1;
          cellule.valeurBc += part;
        }
      }
    }

    semaines.push({
      libelle: `${formatDate(debut, "d", locale)}–${formatDate(
        new Date(finSemaine.getTime() - 86_400_000),
        "d MMM",
        locale,
      )}`,
      familles,
    });
  }

  /* — Sections filtrables depuis la barre d'emojis — */
  const sections: DashboardSection[] = [
    {
      id: "chiffres",
      emoji: "📊",
      label: t("dashboard.views.chiffres"),
      content: (
        // Chaque carte mène à l'écran qui détaille son chiffre : lire « 7 » ne
        // sert à rien si retrouver les sept demande trois clics de plus.
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <PastelKpi
            tone="amber"
            title={t("dashboard.kpi.relancesRetard")}
            value={relancesRetard}
            hint={t("dashboard.kpi.relances48h")}
            icon={<BellRing className="size-5" />}
            href="/taches?filtre=retard"
            urgent={relancesRetard > 0}
          />
          <PastelKpi
            tone="blue"
            title={t("dashboard.kpi.devisAttente")}
            value={devisAttente.length}
            hint={t("dashboard.kpi.devisTotal", { total: formatDT(devisTotal) })}
            icon={<FileClock className="size-5" />}
            href="/etat-dossier?stage=conception_devis"
          />
          <PastelKpi
            tone="rouge"
            title={t("dashboard.kpi.tauxConversion")}
            value={`${conversion}%`}
            hint={t("dashboard.kpi.conversionWindow")}
            icon={<Percent className="size-5" />}
            href="/etat-dossier"
          />
          <PastelKpi
            tone="orange"
            title={t("dashboard.hub.fichesActives")}
            value={activeCount}
            hint={`${t("dashboard.hub.valeurPipeline")} : ${formatDT(
              valeurPipeline,
            )}`}
            icon={<FolderOpen className="size-5" />}
            href="/fiches"
          />
          <PastelKpi
            tone="green"
            title={t("dashboard.hub.prochainRdv")}
            value={<span className="text-2xl">{prochainRdvValue}</span>}
            icon={<CalendarDays className="size-5" />}
            href="/agenda-client"
          />
          <PastelKpi
            tone="blue"
            title={t("dashboard.hub.clientsActifs")}
            value={clients.length}
            icon={<Users className="size-5" />}
            href="/clients"
          />
        </div>
      ),
    },
    /*
     * L'ordre de la journée, de haut en bas : ce qui dérape d'abord, puis ce
     * qu'il y a à faire aujourd'hui et à préparer pour demain. La courbe vient
     * après — elle explique le mois, elle ne dit pas quoi faire dans l'heure,
     * et occuper le haut de l'écran avec un contexte fait descendre l'action
     * sous la ligne de flottaison.
     *
     * Les quatre tiennent dans une seule section pour qu'on ne puisse pas en
     * masquer une en filtrant.
     */
    {
      id: "courbe",
      emoji: "📈",
      label: t("dashboard.views.courbe"),
      content: (
        <div className="space-y-4">
          <InsightsPanel insights={insights.slice(0, 8)} alerte />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TasksWidget taches={widgetTaches} ficheNames={ficheNames} />
            <RdvDemain rdv={rdvDemain} />
          </div>

          <ActivityChart
            data={fiches30d}
            title={t("dashboard.hub.activite")}
            subtitle={t("dashboard.hub.activiteSub")}
            label7={t("dashboard.hub.jours7")}
            label30={t("dashboard.hub.jours30")}
            seriesLabel={t("dashboard.hub.fichesJour")}
            trendLabel={t("dashboard.hub.tendance")}
          />

          <TableauHebdo semaines={semaines} />
        </div>
      ),
    },
    {
      id: "pipeline",
      emoji: "🧭",
      label: t("dashboard.views.pipeline"),
      content: (
        <div className="space-y-4">
          <PipelineCounters counts={pipelineCounts} total={fiches.length} />
          <ProductsStrip counts={productCounts} />
        </div>
      ),
    },
    {
      id: "a-venir",
      emoji: "📅",
      label: t("dashboard.views.aVenir"),
      content: (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Echeances items={echeances} locale={locale} />
          <AgendaJour rdv={rdvToday} />
        </div>
      ),
    },
    ...(classement && classement.length > 0
      ? [
          {
            id: "classement",
            emoji: "🏆",
            label: t("dashboard.views.classement"),
            content: <Classement rows={classement} />,
          },
        ]
      : []),
    {
      id: "fiches",
      emoji: "🗂️",
      label: t("dashboard.views.fiches"),
      content: (
        <LatestFiches
          fiches={latest}
          conseillers={conseillerNames}
          total={fiches.length}
        />
      ),
    },
  ];

  return (
    <SectionSwitcher
      title={t("dashboard.greeting", { name: profile.prenom })}
      subtitle={formatDate(now, "EEEE d MMMM yyyy", locale)}
      allLabel={t("dashboard.views.tout")}
      groupLabel={t("dashboard.views.groupLabel")}
      sections={sections}
    />
  );
}
