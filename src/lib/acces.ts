import type { Role } from "@/lib/domain";
import type { PointDeVenteRow, ProfileRow } from "@/lib/database.types";

/**
 * Qui voit quoi — la seule définition des périmètres.
 *
 * Le menu, les gardes de page et le sélecteur de showroom lisent tous d'ici.
 * Deux endroits qui décideraient chacun de leur côté finiraient par diverger,
 * et une divergence sur les droits, ça se remarque le jour où quelqu'un voit
 * ce qu'il ne devrait pas.
 */

/** La direction et les administrateurs — rien ne leur est fermé. */
export const DIRECTION: readonly Role[] = ["direction", "admin"];

/**
 * L'encadrement : direction, administrateurs, et le chef de showroom que la
 * RLS borne déjà à son point de vente. Le commercial n'en fait pas partie —
 * il travaille ses fiches, pas le réseau.
 */
export const ENCADREMENT: readonly Role[] = [
  "chef_showroom",
  "direction",
  "admin",
];

/** Seuls les administrateurs voient le réseau au complet. */
export const ADMIN: readonly Role[] = ["admin"];

/**
 * Les showrooms qu'un profil a le droit de regarder.
 *
 * L'administrateur les a tous — c'est lui qui pilote le réseau. Tout autre
 * rôle est ramené au sien, et à lui seul ; sans point de vente rattaché, la
 * liste est vide plutôt que complète, parce qu'un droit qui se déduit d'une
 * donnée manquante est un droit accordé par accident.
 */
export function showroomsVisibles(
  profile: ProfileRow,
  pdvs: readonly PointDeVenteRow[],
): PointDeVenteRow[] {
  if (peutVoirTousLesShowrooms(profile)) return [...pdvs];
  if (!profile.point_de_vente_id) return [];
  return pdvs.filter((p) => p.id === profile.point_de_vente_id);
}

/** Vrai pour l'administrateur seul : lui seul change de showroom. */
export function peutVoirTousLesShowrooms(profile: ProfileRow): boolean {
  return profile.role === "admin";
}
