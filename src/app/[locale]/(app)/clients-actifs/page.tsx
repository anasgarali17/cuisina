import { profilAutorise } from "@/lib/garde";
import { ENCADREMENT } from "@/components/shell/nav-config";
import { AccesRefuse } from "@/components/shell/acces-refuse";
import { getTranslations } from "next-intl/server";
import {
  listClientActifHistorique,
  listClientsActifs,
} from "@/lib/data/queries";
import {
  chronoDe,
  depuisQuandEtape,
  maintenantServeur,
  SEUIL_ETAPE,
  type Chrono,
} from "@/lib/chrono";
import { PageHeader } from "@/components/shell/page-header";
import { ProductionBoard } from "@/components/production/production-board";

export default async function ClientsActifsPage() {
  const [t, profile] = await Promise.all([
    getTranslations(),
    profilAutorise(ENCADREMENT),
  ]);
  if (!profile) return <AccesRefuse />;

  const [dossiers, historique] = await Promise.all([
    listClientsActifs(profile),
    listClientActifHistorique(),
  ]);

  /*
   * Depuis combien de jours chaque dossier est à son étape.
   *
   * Calculé au serveur : `Date.now()` dans le tableau donnerait l'heure du
   * serveur au premier rendu et celle du navigateur ensuite.
   */
  const maintenant = maintenantServeur();
  const chronos: Record<string, Chrono> = {};
  for (const dossier of dossiers) {
    chronos[dossier.id] = chronoDe(
      depuisQuandEtape(dossier, historique),
      SEUIL_ETAPE[dossier.etape],
      maintenant,
    );
  }

  return (
    <>
      <PageHeader title={t("production.title")} />
      <p className="mb-4 text-sm text-muted-foreground">
        {t("production.subtitle")}
      </p>
      <ProductionBoard dossiers={dossiers} chronos={chronos} />
    </>
  );
}
