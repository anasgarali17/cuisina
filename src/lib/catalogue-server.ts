import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FACADES, TOUS_VISUELS } from "@/lib/catalogue";
import { imageCouleur, TOUTES_TEINTES } from "@/lib/couleurs";

/**
 * Quels visuels du catalogue sont réellement sur le disque.
 *
 * `onError` côté client ne suffit pas : la page est rendue au serveur, le
 * navigateur tente le chargement avant que React ne s'attache, et l'icône de
 * fichier cassé s'affiche pour de bon. On tranche donc au serveur — une
 * image absente n'est jamais écrite dans le HTML.
 *
 * Conséquence voulue : déposer les fichiers aux chemins du catalogue suffit à
 * les faire apparaître, sans toucher au code.
 */
/** Les chemins à vérifier : modèles, dressings, façades et échantillons. */
const A_VERIFIER: readonly string[] = [
  ...TOUS_VISUELS,
  ...FACADES.map((f) => f.image),
  // Les échantillons de teinte : absents, la pastille reste calculée en
  // CSS. Présents, ils la remplacent par la vraie matière.
  ...TOUTES_TEINTES.map(imageCouleur),
];

/**
 * Le résultat, retenu une fois pour toutes — en production seulement.
 *
 * La liste fait une cinquantaine d'entrées depuis que le nuancier s'y est
 * ajouté, et `existsSync` est bloquant : la recalculer à chaque rendu, c'est
 * cinquante appels système synchrones avant d'afficher le formulaire, à
 * chaque visite. Le contenu de `public/` ne bouge pas pendant la vie du
 * processus — une seule passe suffit.
 *
 * En développement elle reste recalculée : c'est là qu'on dépose les
 * fichiers, et devoir redémarrer le serveur pour voir apparaître une photo
 * qu'on vient d'ajouter contredirait exactement la promesse ci-dessus.
 */
let cache: string[] | null = null;

export function visuelsDisponibles(): string[] {
  if (cache) return cache;
  const racine = join(process.cwd(), "public");
  const presents = A_VERIFIER.filter((chemin) =>
    existsSync(join(racine, chemin)),
  );
  if (process.env.NODE_ENV === "production") cache = presents;
  return presents;
}
