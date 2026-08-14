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
import { PageHeader } from "@/components/shell/page-header";
import { ReseauCarte } from "@/components/carte/reseau-carte";
import { PdvCard } from "@/components/equipe/pdv-card";

export default async function EquipePage() {
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
    </>
  );
}
