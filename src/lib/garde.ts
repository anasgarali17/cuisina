import "server-only";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { aUnEspacePersonnel } from "@/lib/acces";
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

/**
 * L'e-mail de la session, ou `null`.
 *
 * `profiles` ne porte pas l'e-mail — il vit dans `auth.users`, que seule la
 * session sait lire. Hors Supabase (mode démo) il n'y en a pas, et l'absence
 * ferme les portes qui s'y adossent.
 */
export async function emailSession(): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

/**
 * Le garde de l'espace personnel — celui d'une personne, pas d'un rôle.
 *
 * Même contrat que `profilAutorise` : le profil si la porte s'ouvre, `null`
 * sinon, et la page rend alors `<AccesRefuse />`.
 */
export async function profilAvecEspacePersonnel(): Promise<ProfileRow | null> {
  const [profile, email] = await Promise.all([
    getCurrentProfile(),
    emailSession(),
  ]);
  if (!profile) return null;
  return aUnEspacePersonnel(email) ? profile : null;
}
