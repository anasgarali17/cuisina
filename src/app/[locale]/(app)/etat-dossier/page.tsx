import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  listFiches,
  listHistoriqueSince,
  listPdvsVisibles,
  listProfiles,
  listTaches,
} from "@/lib/data/queries";
import { startOfToday } from "@/lib/dates";
import {
  chronoDe,
  depuisQuandStage,
  maintenantServeur,
  SEUIL_STAGE,
  stageChronometre,
  type Chrono,
} from "@/lib/chrono";
import { PageHeader } from "@/components/shell/page-header";
import { KanbanBoard } from "@/components/pipeline/kanban-board";

export default async function EtatDossierPage() {
  const [t, profile] = await Promise.all([
    getTranslations(),
    getCurrentProfile(),
  ]);
  if (!profile) return null;

  /*
   * Quatre-vingt-dix jours d'historique : au-delà, un dossier qui n'a pas
   * bougé est de toute façon au maximum de son compteur, et la date exacte
   * de son dernier mouvement ne change plus rien à l'alerte.
   */
  const depuis90 = new Date();
  depuis90.setDate(depuis90.getDate() - 90);

  const [fiches, profiles, pdvs, taches, historique] = await Promise.all([
    listFiches(profile),
    listProfiles(),
    listPdvsVisibles(profile),
    listTaches(profile),
    listHistoriqueSince(profile, depuis90.toISOString()),
  ]);

  // Overdue auto-generated relances → amber dot on the fiche card.
  const today = startOfToday().getTime();
  const overdueFicheIds = Array.from(
    new Set(
      taches
        .filter(
          (tache) =>
            tache.auto_generee &&
            tache.statut === "a_faire" &&
            tache.fiche_id !== null &&
            tache.echeance !== null &&
            new Date(tache.echeance).getTime() < today,
        )
        .map((tache) => tache.fiche_id)
        .filter((id): id is string => id !== null),
    ),
  );

  /*
   * Le chrono de chaque fiche, calculé ici.
   *
   * Un dossier ne se perd pas d'un coup, il s'arrête : trois semaines en
   * « conception devis » parce que personne ne s'est dit que c'était long.
   * Le tableau disait où était chaque fiche, jamais depuis quand.
   *
   * « Perdu » et « en pause » n'en ont pas : le premier est un point final,
   * le second a déjà sa date de reprise.
   */
  const maintenant = maintenantServeur();
  const chronos: Record<string, Chrono> = {};
  for (const fiche of fiches) {
    if (!stageChronometre(fiche.stage)) continue;
    chronos[fiche.id] = chronoDe(
      depuisQuandStage(fiche, historique),
      SEUIL_STAGE[fiche.stage],
      maintenant,
    );
  }

  return (
    <>
      <PageHeader title={t("pipeline.title")} />
      <KanbanBoard
        fiches={fiches}
        profiles={profiles}
        pdvs={pdvs}
        overdueFicheIds={overdueFicheIds}
        chronos={chronos}
        role={profile.role}
      />
    </>
  );
}
