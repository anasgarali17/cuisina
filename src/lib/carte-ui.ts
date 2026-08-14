import type { LayerKey } from "@/lib/geo/reseau";

/**
 * Une couleur par couche, prise dans la palette de marque — une source pour
 * la punaise (SVG), la pastille du filtre et la liste.
 *
 * Le rouge va aux showrooms : c'est l'enseigne, c'est ce qu'on cherche en
 * premier sur la carte. Les trois autres couches se répartissent le chêne,
 * l'ambre et le vert du reste de l'interface, donc rien de nouveau à
 * apprendre en arrivant sur cet écran.
 */
export interface LayerStyle {
  /** Pour les attributs SVG `fill` / `stroke`. */
  couleur: string;
  /** Pastille pleine, dans les filtres et la légende. */
  dot: string;
  /** Puce active du filtre. */
  chip: string;
  /** Texte accentué dans la liste. */
  texte: string;
}

export const LAYER_STYLE: Record<LayerKey, LayerStyle> = {
  showrooms: {
    couleur: "var(--rouge-cuisina)",
    dot: "bg-rouge",
    chip: "border-rouge/30 bg-rouge/10 text-rouge",
    texte: "text-rouge",
  },
  clients: {
    couleur: "var(--chene)",
    dot: "bg-chene",
    chip: "border-chene/40 bg-chene/15 text-chene",
    texte: "text-chene",
  },
  prospects: {
    couleur: "var(--ambre)",
    dot: "bg-ambre",
    chip: "border-ambre/40 bg-ambre/15 text-ambre",
    texte: "text-ambre",
  },
  fournisseurs: {
    couleur: "var(--vert-plan)",
    dot: "bg-vert-plan",
    chip: "border-vert-plan/40 bg-vert-plan/12 text-vert-plan",
    texte: "text-vert-plan",
  },
};
