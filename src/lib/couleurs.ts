/**
 * Les teintes du catalogue, en couleur.
 *
 * Le nuancier ne vivait que par ses noms. « Fango », « Ordino », « Fil Tordu »
 * ne veulent rien dire à un client debout devant son téléphone : il cochait
 * des mots, découvrait la teinte au rendez-vous, et changeait d'avis. La
 * pastille montre ce qu'il choisit.
 *
 * Chaque teinte porte une finition, parce qu'une laque brillante et un mat ne
 * se rendent pas de la même façon : le brillant reçoit un reflet, le bois des
 * veines, la pierre un veinage. Sans ça, dix-sept beiges se ressemblent tous.
 *
 * Ces valeurs sont des approximations tirées des visuels du site — assez
 * justes pour reconnaître une teinte, jamais pour la valider. Le vrai
 * nuancier reste le showroom, et un échantillon photographié remplace la
 * pastille dès qu'il est déposé : voir `imageCouleur()` plus bas.
 */

export type Finition = "brillant" | "mat" | "bois" | "pierre";

export interface Teinte {
  hex: string;
  finition: Finition;
}

/**
 * Clé de recherche : sans accents, sans casse, sans mention entre
 * parenthèses. « Bleu (sur commande) » et « bleu » désignent la même teinte,
 * et le catalogue écrit « Crème » ici, « Creme » là.
 */
export function cleCouleur(nom: string): string {
  let sortie = "";
  for (const caractere of nom.replace(/\(.*?\)/g, "").normalize("NFD")) {
    const code = caractere.codePointAt(0) ?? 0;
    // Bloc « Combining Diacritical Marks » : ce que NFD détache des lettres
    // accentuées. Écrit en points de code plutôt qu'en classe de caractères,
    // parce qu'un intervalle de signes combinants est illisible dans le
    // source — et se perd au premier copier-coller.
    if (code >= 0x0300 && code <= 0x036f) continue;
    sortie += caractere;
  }
  return sortie.trim().toLowerCase();
}

const TEINTES: Record<string, Teinte> = {
  /* — Laques et mats — */
  "blanc brillant": { hex: "#f4f4f1", finition: "brillant" },
  "blanc": { hex: "#f1f0eb", finition: "mat" },
  "anthracite mat": { hex: "#383b3e", finition: "mat" },
  "chamois mat": { hex: "#c7b291", finition: "mat" },
  "bleu brillant": { hex: "#2b5c8a", finition: "brillant" },
  "bleu": { hex: "#35597f", finition: "brillant" },
  "cashemire brillant": { hex: "#d8cdbc", finition: "brillant" },
  "cashemire mat": { hex: "#d1c6b4", finition: "mat" },
  "gris brillant": { hex: "#a8a9a6", finition: "brillant" },
  "gris": { hex: "#9b9b98", finition: "mat" },
  "gris taupe mat": { hex: "#8a8078", finition: "mat" },
  "creme mat": { hex: "#e3d9c5", finition: "mat" },
  "fango": { hex: "#8b7e72", finition: "mat" },
  "beige": { hex: "#d8c8ad", finition: "mat" },
  "vert soft": { hex: "#8a9a83", finition: "mat" },
  "vert": { hex: "#6d7e62", finition: "mat" },
  "capuccino": { hex: "#99826f", finition: "mat" },
  "chanvre": { hex: "#c2b6a1", finition: "mat" },

  /* — Textures effet bois — le site les range sous « TEXTURES » — */
  "white toulip": { hex: "#e9e5db", finition: "bois" },
  "noyer": { hex: "#6a4930", finition: "bois" },
  "noyer perenne": { hex: "#5b3e2a", finition: "bois" },
  "tayler": { hex: "#796450", finition: "bois" },
  "nepal": { hex: "#9f8d76", finition: "bois" },
  "fil tordu": { hex: "#8d7b67", finition: "bois" },
  "lucenta": { hex: "#b8a88e", finition: "bois" },
  "denver": { hex: "#6d6156", finition: "bois" },
  "ebene": { hex: "#3a2b21", finition: "bois" },
  "perla blanchi": { hex: "#cec5b5", finition: "bois" },
  "montana": { hex: "#7d7269", finition: "bois" },
  "ordino": { hex: "#93826d", finition: "bois" },
  "chene": { hex: "#af8a5d", finition: "bois" },

  /* — Pierres : la Portofino est un décor marbre — */
  "travertin": { hex: "#c8b69b", finition: "pierre" },
  "nero marquina": { hex: "#232120", finition: "pierre" },
  "kone mix": { hex: "#8e8981", finition: "pierre" },
  "calacatta poli": { hex: "#ece9e3", finition: "pierre" },
};

/** Teinte neutre : un nom inconnu se montre en gris, jamais en rien. */
const INCONNUE: Teinte = { hex: "#b4b0a8", finition: "mat" };

export function teinteDe(nom: string): Teinte {
  return TEINTES[cleCouleur(nom)] ?? INCONNUE;
}

/** Vrai quand la teinte est reconnue — sert à ne pas promettre une couleur. */
export function teinteConnue(nom: string): boolean {
  return cleCouleur(nom) in TEINTES;
}

/**
 * Le chemin d'un échantillon photographié, s'il a été déposé.
 *
 * Même principe que les vignettes de modèle : poser le fichier suffit à
 * remplacer la pastille calculée par la vraie matière, sans toucher au code.
 */
export function imageCouleur(nom: string): string {
  const slug = cleCouleur(nom).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `/catalogue/couleurs/${slug}.jpg`;
}

/** Tous les noms du nuancier — pour la vérification de présence disque. */
export const TOUTES_TEINTES: readonly string[] = Object.keys(TEINTES);
