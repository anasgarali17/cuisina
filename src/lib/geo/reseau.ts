/**
 * Les lignes de la base, converties en punaises.
 *
 * Tout se passe côté serveur : 500 fiches deviennent une trentaine de
 * punaises agrégées par localité, et le client ne reçoit que ça. Le
 * navigateur n'a pas à connaître le gazetteer ni à porter les fiches
 * complètes pour dessiner des points.
 *
 * Les showrooms et les fournisseurs restent une punaise par ligne — ils sont
 * peu nombreux et chacun est identifiable. Les clients et les prospects sont
 * regroupés par localité : deux cents points superposés sur le Grand Tunis
 * ne disent rien, « Ariana · 14 clients » si.
 */

import type {
  ClientRow,
  FicheRow,
  FournisseurRow,
  PointDeVenteRow,
  ProfileRow,
} from "@/lib/database.types";
import {
  STAGES_HORS_FUNNEL,
  type FournisseurCategorie,
} from "@/lib/domain";
import { resolveVille } from "./tunisia";
import type { GouvernoratCode } from "./tunisia-shapes";
import type { RegionCode } from "./tunisia-regions";

/** Les couches superposables. L'ordre est celui de la barre de filtres. */
export const CARTE_LAYERS = [
  "showrooms",
  "clients",
  "prospects",
  "fournisseurs",
] as const;

export type LayerKey = (typeof CARTE_LAYERS)[number];

export interface Marker {
  id: string;
  layer: LayerKey;
  /** Le libellé de la punaise : un nom d'enseigne, ou une localité. */
  nom: string;
  ville: string;
  gouvernorat: GouvernoratCode;
  /** Code de délégation (مُعتمدية) — `null` si la localité n'a pas été rattachée. */
  delegation: string | null;
  region: RegionCode;
  x: number;
  y: number;
  /** Nombre d'entités regroupées ici — 1 pour un showroom. */
  count: number;
  /** En DT : CA du mois, CA cumulé ou budget selon la couche. */
  valeur: number;
  /** Page dédiée, quand elle existe. */
  href: string | null;
  /* — Extras propres à une couche — */
  /** Showroom : conseillers rattachés. */
  equipe?: number;
  /** Showroom : téléphone affiché dans la liste. */
  telephone?: string | null;
  /** Fournisseur : ce qu'il livre. */
  categorie?: FournisseurCategorie;
  /** Fournisseur : délai indicatif, en jours ouvrés. */
  delaiJours?: number | null;
}

/** Ce qui n'a pas pu être placé, par couche — affiché tel quel, pas caché. */
export type HorsCarte = Record<LayerKey, number>;

export interface CarteReseau {
  markers: Marker[];
  horsCarte: HorsCarte;
}

interface Bucket {
  nom: string;
  ville: string;
  gouvernorat: GouvernoratCode;
  /** Code de délégation (مُعتمدية) — `null` si la localité n'a pas été rattachée. */
  delegation: string | null;
  region: RegionCode;
  x: number;
  y: number;
  count: number;
  valeur: number;
}

/**
 * Regroupe par localité résolue. La clé est le nom de référence du gazetteer,
 * pas la chaîne saisie : « soukra » et « La Soukra » tombent dans le même seau.
 */
function bucketise(
  rows: Array<{ ville: string | null; valeur: number }>,
): { buckets: Map<string, Bucket>; horsCarte: number } {
  const buckets = new Map<string, Bucket>();
  let horsCarte = 0;

  for (const row of rows) {
    const resolved = resolveVille(row.ville);
    if (!resolved) {
      horsCarte += 1;
      continue;
    }
    const key = resolved.place.nom;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.valeur += row.valeur;
      continue;
    }
    buckets.set(key, {
      nom: resolved.place.nom,
      ville: resolved.place.nom,
      gouvernorat: resolved.gouvernorat,
      delegation: resolved.delegation,
      region: resolved.region,
      x: resolved.point.x,
      y: resolved.point.y,
      count: 1,
      valeur: row.valeur,
    });
  }

  return { buckets, horsCarte };
}

export interface ReseauInput {
  pdvs: PointDeVenteRow[];
  profiles: ProfileRow[];
  clients: ClientRow[];
  fiches: FicheRow[];
  fournisseurs: FournisseurRow[];
  /** CA signé du mois par point de vente, déjà calculé par la page. */
  caParPdv: Map<string, number>;
}

const HORS_FUNNEL: readonly string[] = STAGES_HORS_FUNNEL;

export function buildCarteReseau({
  pdvs,
  profiles,
  clients,
  fiches,
  fournisseurs,
  caParPdv,
}: ReseauInput): CarteReseau {
  const markers: Marker[] = [];
  const horsCarte: HorsCarte = {
    showrooms: 0,
    clients: 0,
    prospects: 0,
    fournisseurs: 0,
  };

  /* — Showrooms : une punaise chacun, avec son équipe et son CA — */
  for (const pdv of pdvs) {
    const resolved = resolveVille(pdv.ville) ?? resolveVille(pdv.nom);
    if (!resolved) {
      horsCarte.showrooms += 1;
      continue;
    }
    markers.push({
      id: `pdv:${pdv.id}`,
      layer: "showrooms",
      nom: pdv.nom,
      ville: pdv.ville,
      gouvernorat: resolved.gouvernorat,
      delegation: resolved.delegation,
      region: resolved.region,
      x: resolved.point.x,
      y: resolved.point.y,
      count: 1,
      valeur: caParPdv.get(pdv.id) ?? 0,
      href: `/equipe/${pdv.id}`,
      equipe: profiles.filter((p) => p.point_de_vente_id === pdv.id).length,
      telephone: pdv.telephone,
    });
  }

  /* — Clients : agrégés par localité, valorisés au CA cumulé — */
  const clientsAgg = bucketise(
    clients.map((c) => ({ ville: c.ville, valeur: c.ca_cumule })),
  );
  horsCarte.clients = clientsAgg.horsCarte;
  for (const [key, bucket] of clientsAgg.buckets) {
    markers.push({
      ...bucket,
      id: `clients:${key}`,
      layer: "clients",
      href: null,
    });
  }

  /* — Prospects : les fiches encore dans le tunnel, valorisées au budget — */
  const prospectsAgg = bucketise(
    fiches
      .filter((f) => f.stage !== "signe" && !HORS_FUNNEL.includes(f.stage))
      .map((f) => ({
        ville: f.ville ?? f.adresse_complete,
        valeur: f.budget_estimatif ?? 0,
      })),
  );
  horsCarte.prospects = prospectsAgg.horsCarte;
  for (const [key, bucket] of prospectsAgg.buckets) {
    markers.push({
      ...bucket,
      id: `prospects:${key}`,
      layer: "prospects",
      href: null,
    });
  }

  /* — Fournisseurs : une punaise chacun, ils sont peu nombreux — */
  for (const f of fournisseurs) {
    const resolved = resolveVille(f.ville);
    if (!resolved) {
      horsCarte.fournisseurs += 1;
      continue;
    }
    markers.push({
      id: `fournisseur:${f.id}`,
      layer: "fournisseurs",
      nom: f.nom,
      ville: f.ville,
      gouvernorat: resolved.gouvernorat,
      delegation: resolved.delegation,
      region: resolved.region,
      x: resolved.point.x,
      y: resolved.point.y,
      count: 1,
      valeur: 0,
      href: null,
      categorie: f.categorie,
      delaiJours: f.delai_jours,
    });
  }

  return { markers, horsCarte };
}
