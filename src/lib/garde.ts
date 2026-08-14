import "server-only";
import { getCurrentProfile } from "@/lib/auth";
import type { Role } from "@/lib/domain";
import type { ProfileRow } from "@/lib/database.types";

/**
 * Le garde d'une page réservée.
 *
 * Masquer l'entrée de menu ne protège rien — l'adresse se tape, et un lien se
 * partage. Chaque page réservée appelle donc cette fonction en tête : elle
 * répond soit avec le profil, soit avec `null`, auquel cas la page rend
 * `<AccesRefuse />` au lieu de son contenu.
 *
 * C'est un garde d'affichage, pas le dernier rempart : les données restent
 * bornées par la RLS Postgres, qui ne renvoie rien hors périmètre même si
 * quelqu'un contournait celui-ci.
 */
export async function profilAutorise(
  roles: readonly Role[],
): Promise<ProfileRow | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  return roles.includes(profile.role) ? profile : null;
}
