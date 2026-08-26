import "server-only";
import type { FicheHistoriqueRow, FicheRow } from "@/lib/database.types";

/**
 * Les indicateurs de la direction : combien de devis, combien de bons de
 * commande, par conseiller et par showroom.
 *
 * Aucune table « devis » n'existe encore — la section est un écran d'attente.
 * Mais les deux événements se lisent déjà dans l'historique des dossiers :
 * passer un dossier en « Conception devis », c'est émettre un devis ; le
 * passer en « Signé », c'est confirmer une commande. Compter les transitions
 * plutôt que les états donne un chiffre par période, là où l'état ne dit que
 * le présent — un dossier signé en janvier et livré depuis ne compterait
 * nulle part si on regardait seulement où il se trouve aujourd'hui.
 *
 * Conséquence assumée : un dossier qu'on fait reculer puis avancer à nouveau
 * compte deux fois. C'est rare, et c'est le comportement honnête — deux
 * devis ont bien été produits.
 */

const STAGE_DEVIS = "conception_devis";
const STAGE_COMMANDE = "signe";

export interface LigneKpi {
  /** Identifiant du conseiller ou du point de vente. */
  id: string;
  libelle: string;
  /** Sous-titre : le showroom du conseiller, la ville d'un showroom. */
  detail: string | null;
  devis: number;
  commandes: number;
}

export interface KpiPeriode {
  devis: number;
  commandes: number;
  parConseiller: LigneKpi[];
  parShowroom: LigneKpi[];
}

export function calculerKpi({
  historique,
  fiches,
  noms,
  showrooms,
  depuis,
}: {
  historique: FicheHistoriqueRow[];
  fiches: FicheRow[];
  /** id conseiller → { nom, showroom } */
  noms: Map<string, { nom: string; showroom: string | null }>;
  /** id showroom → { nom, ville } */
  showrooms: Map<string, { nom: string; ville: string }>;
  depuis: Date;
}): KpiPeriode {
  const ficheById = new Map(fiches.map((f) => [f.id, f]));

  const parConseiller = new Map<string, { devis: number; commandes: number }>();
  const parShowroom = new Map<string, { devis: number; commandes: number }>();
  let devis = 0;
  let commandes = 0;

  for (const h of historique) {
    const estDevis = h.stage_to === STAGE_DEVIS;
    const estCommande = h.stage_to === STAGE_COMMANDE;
    if (!estDevis && !estCommande) continue;
    if (new Date(h.created_at) < depuis) continue;

    // Le dossier peut être hors du périmètre lisible (RLS) ou sorti des 500
    // dernières fiches du snapshot : on ne compte que ce qu'on sait rattacher.
    const fiche = ficheById.get(h.fiche_id);
    if (!fiche) continue;

    if (estDevis) devis += 1;
    else commandes += 1;

    for (const [carte, cle] of [
      [parConseiller, fiche.conseiller_id],
      [parShowroom, fiche.point_de_vente_id],
    ] as const) {
      if (!cle) continue;
      const ligne = carte.get(cle) ?? { devis: 0, commandes: 0 };
      if (estDevis) ligne.devis += 1;
      else ligne.commandes += 1;
      carte.set(cle, ligne);
    }
  }

  /* Trié par commandes puis devis : la direction cherche qui conclut, pas qui
     produit le plus de papier. */
  const trier = (a: LigneKpi, b: LigneKpi) =>
    b.commandes - a.commandes || b.devis - a.devis || a.libelle.localeCompare(b.libelle);

  return {
    devis,
    commandes,
    parConseiller: [...parConseiller.entries()]
      .map(([id, v]) => ({
        id,
        libelle: noms.get(id)?.nom ?? "—",
        detail: noms.get(id)?.showroom ?? null,
        ...v,
      }))
      .sort(trier),
    parShowroom: [...parShowroom.entries()]
      .map(([id, v]) => ({
        id,
        libelle: showrooms.get(id)?.nom ?? "—",
        detail: showrooms.get(id)?.ville ?? null,
        ...v,
      }))
      .sort(trier),
  };
}
