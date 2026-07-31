import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  listFiches,
  listPdvs,
  listProfiles,
  listTaches,
} from "@/lib/data/queries";
import { startOfToday } from "@/lib/dates";
import { PageHeader } from "@/components/shell/page-header";
import { KanbanBoard } from "@/components/pipeline/kanban-board";

export default async function PipelinePage() {
  const [t, profile] = await Promise.all([
    getTranslations(),
    getCurrentProfile(),
  ]);
  if (!profile) return null;

  const [fiches, profiles, pdvs, taches] = await Promise.all([
    listFiches(profile),
    listProfiles(),
    listPdvs(),
    listTaches(profile),
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

  return (
    <>
      <PageHeader title={t("pipeline.title")} />
      <KanbanBoard
        fiches={fiches}
        profiles={profiles}
        pdvs={pdvs}
        overdueFicheIds={overdueFicheIds}
        role={profile.role}
      />
    </>
  );
}
