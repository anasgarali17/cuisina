import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FACADES, TOUS_VISUELS } from "@/lib/catalogue";

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
  const tous = [...TOUS_VISUELS, ...FACADES.map((f) => f.image)];
  return tous.filter((chemin) => existsSync(join(racine, chemin)));
}
