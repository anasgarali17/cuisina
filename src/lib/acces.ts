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
 * L'espace personnel : une section qui n'appartient qu'à une personne.
 *
 * C'est le seul droit du fichier qui ne se déduise pas d'un rôle. Un rôle dit
 * ce qu'on fait dans l'entreprise ; ici on désigne quelqu'un. Deux
 * administrateurs ont les mêmes droits partout ailleurs, et pourtant un seul
 * doit voir cette porte — un rôle ne saurait pas l'exprimer.
 *
 * Le rattachement se fait par e-mail plutôt que par identifiant : l'e-mail se
 * lit, se vérifie, et survit à une base recréée. L'identifiant, lui, change à
 * chaque provisionnement et ne dit rien à qui relit ce fichier.
 */
const ESPACE_PERSONNEL = ["sofiene@cuisina.com"] as const;

/**
 * Vrai pour les seules personnes qui ont un espace personnel.
 *
 * L'e-mail ne vit pas dans `profiles` mais dans `auth.users` : la page le lit
 * de la session et le passe ici. Absent — session incomplète, mode démo — la
 * réponse est non : une porte ne s'ouvre pas sur une donnée manquante.
 */
export function aUnEspacePersonnel(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalise = email.trim().toLocaleLowerCase();
  return ESPACE_PERSONNEL.some((autorise) => autorise === normalise);
}

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
