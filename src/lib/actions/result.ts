export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function fail<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

export function succeed<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/**
 * Ce que Postgres refuse, dit en clair.
 *
 * Renvoyer « db » sur chaque échec laissait l'utilisateur devant « Une erreur
 * est survenue » sans savoir s'il fallait corriger sa saisie, appeler un
 * administrateur, ou simplement réessayer. Chaque code ci-dessous correspond à
 * une clé de `errors.*` dans les messages, et donc à une phrase qui dit quoi
 * faire.
 *
 * Le détail brut part dans les logs serveur : il est utile au débogage, jamais
 * à l'écran — il nomme des colonnes et des contraintes.
 */
export function dbError(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (process.env.NODE_ENV !== "production") console.error("[db]", error);

  switch (code) {
    /** RLS : la ligne existe peut-être, mais elle n'est pas à cette personne. */
    case "42501":
      return "db_droits";
    /** Doublon sur une contrainte unique. */
    case "23505":
      return "db_doublon";
    /** Colonne NOT NULL laissée vide. */
    case "23502":
      return "db_champ_manquant";
    /** Clé étrangère absente — profil ou point de vente inexistant. */
    case "23503":
      return "db_reference_absente";
    /** Contrainte CHECK — p.ex. « perdu » sans motif. */
    case "23514":
      return "db_valeur_refusee";
    /** Texte invalide pour le type attendu (uuid vide, date malformée…). */
    case "22P02":
      return "db_valeur_invalide";
    /** PostgREST : aucune ligne renvoyée là où une seule était attendue. */
    case "PGRST116":
      return "db_introuvable";
    default:
      return "db";
  }
}
