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
export function visuelsDisponibles(): string[] {
  const racine = join(process.cwd(), "public");
  const tous = [
    ...TOUS_VISUELS,
    ...FACADES.map((f) => f.image),
    // Les échantillons de teinte : absents, la pastille reste calculée en
    // CSS. Présents, ils la remplacent par la vraie matière.
    ...TOUTES_TEINTES.map(imageCouleur),
  ];
  return tous.filter((chemin) => existsSync(join(racine, chemin)));
}
