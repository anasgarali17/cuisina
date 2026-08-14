import { profilAutorise } from "@/lib/garde";
import { ENCADREMENT } from "@/components/shell/nav-config";
import { AccesRefuse } from "@/components/shell/acces-refuse";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import {
  listClients,
  listFiches,
  listFournisseurs,
  listHistoriqueSince,
  listPdvs,
  listProfiles,
} from "@/lib/data/queries";
import { buildCarteReseau } from "@/lib/geo/reseau";
import { daysBetween, formatDate, startOfToday, toISODate } from "@/lib/dates";
import { PageHeader } from "@/components/shell/page-header";
import { ReseauCarte } from "@/components/carte/reseau-carte";
import { PdvCard } from "@/components/equipe/pdv-card";
import {
  ActivityChart,
  type ActivityPoint,
} from "@/components/dashboard/activity-chart";
import {
  Classement,
  type ClassementRow,
} from "@/components/dashboard/classement";

export default async function EquipePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, profile] = await Promise.all([
    getTranslations(),
    profilAutorise(ENCADREMENT),
  ]);
  if (!profile) return <AccesRefuse />;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [pdvs, profiles, fiches, historique, clients, fournisseurs] =
    await Promise.all([
      listPdvs(),
      listProfiles(),
      listFiches(profile),
      listHistoriqueSince(profile, monthStart.toISOString()),
      listClients(profile),
      listFournisseurs(),
    ]);

  const ficheById = new Map(fiches.map((f) => [f.id, f]));
  const signedThisMonth = historique.filter((h) => h.stage_to === "signe");

  const caByPdv = new Map<string, number>();
  for (const h of signedThisMonth) {
    const fiche = ficheById.get(h.fiche_id);
    if (!fiche) continue;
    caByPdv.set(
      fiche.point_de_vente_id,
      (caByPdv.get(fiche.point_de_vente_id) ?? 0) +
        (fiche.budget_estimatif ?? 0),
    );
  }

  const activesByPdv = new Map<string, number>();
  for (const f of fiches) {
    if (f.stage === "signe" || f.stage === "perdu") continue;
    activesByPdv.set(
      f.point_de_vente_id,
      (activesByPdv.get(f.point_de_vente_id) ?? 0) + 1,
    );
  }

  const isAdmin = profile.role === "admin";

  /*
   * — Activité du réseau, 30 jours —
   *
   * Venue du tableau de bord, où elle expliquait le mois à quelqu'un qui
   * cherchait sa journée. Ici, elle est à sa place : la courbe des fiches
   * créées se lit à côté des showrooms qui les créent.
   */
  const today = startOfToday();
  /*
   * Le comptage passe par `toISODate`, des deux côtés — jour calendaire local.
   * Découper `created_at` à la dixième lettre lisait la date en UTC : une
   * fiche saisie à 00 h 30 à Tunis (UTC+1) tombait la veille, et la barre du
   * jour restait vide au moment précis où le conseiller venait la voir.
   */
  const fichesParJour = new Map<string, number>();
  for (const f of fiches) {
    const jour = toISODate(new Date(f.created_at));
    fichesParJour.set(jour, (fichesParJour.get(jour) ?? 0) + 1);
  }
  const activite: ActivityPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    activite.push({
      d: formatDate(d, "d MMM", locale),
      label: formatDate(d, "d", locale),
      v: fichesParJour.get(toISODate(d)) ?? 0,
    });
  }

  /*
   * — Classement des conseillers —
   *
   * Le chef de showroom ne voit que son équipe ; la direction, tout le monde.
   * La RLS a déjà borné `fiches` et `historique`, mais pas `profiles` : le
   * répertoire est lisible par tous, et sans ce filtre un chef verrait les
   * conseillers des huit autres showrooms, tous à zéro.
   */
  const since90 = new Date(now);
  since90.setDate(since90.getDate() - 90);

  const classement: ClassementRow[] = profiles
    .filter(
      (p) =>
        p.role === "conseiller" &&
        (profile.role !== "chef_showroom" ||
          p.point_de_vente_id === profile.point_de_vente_id),
    )
    .map((p) => {
      const own = fiches.filter((f) => f.conseiller_id === p.id);
      const ownRecent = own.filter((f) => new Date(f.created_at) >= since90);
      const ca = signedThisMonth.reduce((sum, h) => {
        const fiche = ficheById.get(h.fiche_id);
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

  /**
   * Les punaises sont calculées ici : le géocodage lit un gazetteer de cent
   * localités et les fiches complètes, rien de tout ça n'a à descendre dans
   * le navigateur. Le client reçoit une trentaine de points agrégés.
   */
  const { markers, horsCarte } = buildCarteReseau({
    pdvs,
    profiles,
    clients,
    fiches,
    fournisseurs,
    caParPdv: caByPdv,
  });

  /**
   * Les fiches showroom, rendues d'avance et indexées : la carte en affiche
   * le sous-ensemble de la zone choisie, sans aller-retour serveur.
   */
  const cartesPdv: Record<string, ReactNode> = {};
  for (const pdv of pdvs) {
    cartesPdv[pdv.id] = (
      <PdvCard
        key={pdv.id}
        pdv={pdv}
        team={profiles.filter((p) => p.point_de_vente_id === pdv.id)}
        fichesActives={activesByPdv.get(pdv.id) ?? 0}
        caMois={caByPdv.get(pdv.id) ?? 0}
        isAdmin={isAdmin}
      />
    );
  }

  return (
    <>
      <PageHeader title={t("equipe.title")} />
      <ReseauCarte
        markers={markers}
        horsCarte={horsCarte}
        cartesPdv={cartesPdv}
      />

      {/* La carte dit où l'on est, ces deux-là comment on s'y comporte : la
          courbe pour le réseau, le classement pour les personnes. */}
      <div className="mt-6 space-y-4">
        <ActivityChart
          data={activite}
          title={t("dashboard.hub.activite")}
          subtitle={t("dashboard.hub.activiteSub")}
          label7={t("dashboard.hub.jours7")}
          label30={t("dashboard.hub.jours30")}
          seriesLabel={t("dashboard.hub.fichesJour")}
          trendLabel={t("dashboard.hub.tendance")}
        />

        {/* Un showroom sans conseiller n'a pas de classement à montrer — une
            carte vide et titrée ferait croire à une panne. */}
        {classement.length > 0 && <Classement rows={classement} />}
      </div>
    </>
  );
}
