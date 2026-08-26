import { getTranslations } from "next-intl/server";
import { profilAutorise } from "@/lib/garde";
import { DIRECTION } from "@/components/shell/nav-config";
import { AccesRefuse } from "@/components/shell/acces-refuse";
import {
  listEvenementsPersonnels,
  listFiches,
  listPdvs,
  listProfiles,
  listHistoriqueRecent,
} from "@/lib/data/queries";
import { calculerKpi, type KpiPeriode } from "@/lib/data/kpi-direction";
import { PageHeader } from "@/components/shell/page-header";
import { KpiDirection, type ClePeriode } from "@/components/direction/kpi-direction";
import { AgendaPerso } from "@/components/direction/agenda-perso";

/** Le premier jour du mois courant, à minuit local. */
function debutDuMois(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function ilYAJours(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DirectionPage() {
  const [t, profile] = await Promise.all([
    getTranslations(),
    profilAutorise(DIRECTION),
  ]);
  if (!profile) return <AccesRefuse />;

  const [fiches, profiles, pdvs, historique, evenements] = await Promise.all([
    listFiches(profile),
    listProfiles(),
    listPdvs(),
    listHistoriqueRecent(),
    listEvenementsPersonnels(),
  ]);

  const showrooms = new Map(pdvs.map((p) => [p.id, { nom: p.nom, ville: p.ville }]));
  const noms = new Map(
    profiles.map((p) => [
      p.id,
      {
        nom: `${p.prenom} ${p.nom}`,
        showroom: p.point_de_vente_id
          ? (showrooms.get(p.point_de_vente_id)?.nom ?? null)
          : null,
      },
    ]),
  );

  /* Les trois périodes sont calculées d'un coup : les données sont déjà en
     mémoire, et recalculer à chaque clic imposerait un aller-retour pour une
     addition. */
  const periodes = Object.fromEntries(
    (
      [
        ["mois", debutDuMois()],
        ["j30", ilYAJours(30)],
        ["j90", ilYAJours(90)],
      ] as const
    ).map(([cle, depuis]) => [
      cle,
      calculerKpi({ historique, fiches, noms, showrooms, depuis }),
    ]),
  ) as Record<ClePeriode, KpiPeriode>;

  return (
    <>
      <PageHeader title={t("direction.title")} />
      <p className="mb-5 text-sm text-muted-foreground">
        {t("direction.subtitle")}
      </p>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <KpiDirection periodes={periodes} />
        <AgendaPerso evenements={evenements} />
      </div>
    </>
  );
}
