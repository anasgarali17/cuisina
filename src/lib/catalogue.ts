import {
  MODELES_CUISINE,
  MODELES_DRESSING,
  type ModeleCuisine,
  type ModeleDressing,
  type TypeProjet,
} from "@/lib/domain";

/**
 * Le catalogue cuisine, repris du site public cuisina.com (/fr/products/…).
 *
 * Les coloris appartiennent au modèle, pas au catalogue : une Capri se fait en
 * quatre teintes, une Lucca en une seule, une Parma en dix-huit. Une palette
 * globale aurait laissé proposer un Chêne sur une Pisa laquée — le client
 * l'aurait coché, et le commercial serait arrivé au rendez-vous avec une
 * combinaison qui n'existe pas.
 *
 * Les photos vivent dans `public/catalogue/modeles/<id>.jpg`, téléchargées
 * depuis le site. Remplacer un fichier suffit à changer la vignette ; en
 * l'absence de fichier, `catalogue-server.ts` fait tomber la vignette sur le
 * nom du modèle, sans image cassée.
 */

export interface ModeleCatalogue {
  id: ModeleCuisine | ModeleDressing;
  /** Le nom tel qu'il est écrit sur le site — majuscules comprises. */
  nom: string;
  image: string;
  /** Les coloris de façade proposés pour ce modèle, dans l'ordre du site. */
  couleurs: readonly string[];
}

const COULEURS: Record<ModeleCuisine, readonly string[]> = {
  capri: ["Blanc Brillant", "Anthracite Mat", "Chamois Mat", "Bleu Brillant"],
  roma: ["Cashemire Brillant", "Cashemire Mat", "Fango", "Blanc Brillant"],
  latina: ["Beige"],
  // Parma se décline en teintes unies puis en textures effet bois ; le site
  // les sépare par un intertitre « TEXTURES », conservé tel quel.
  parma: [
    "Vert Soft",
    "Blanc",
    "Gris",
    "Capuccino",
    "Chanvre",
    "White Toulip",
    "Noyer",
    "Tayler",
    "Nepal",
    "Fil Tordu",
    "Lucenta",
    "Noyer Pérenne",
    "Denver",
    "Ebene",
    "Perla Blanchi",
    "Montana",
    "Ordino",
  ],
  pisa: [
    "Cashemire Brillant",
    "Blanc Brillant",
    "Gris Brillant",
    "Crème Mat",
    "Gris Taupe Mat",
    "Bleu (sur commande)",
  ],
  portofino: ["Travertin", "Nero Marquina", "Kone Mix", "Calacatta Poli"],
  lucca: ["Chêne"],
};

const NOMS: Record<ModeleCuisine, string> = {
  capri: "Capri",
  roma: "Roma",
  latina: "Latina",
  parma: "Parma",
  pisa: "Pisa",
  portofino: "Portofino",
  lucca: "Lucca",
};

export const MODELES: readonly ModeleCatalogue[] = MODELES_CUISINE.map((id) => ({
  id,
  nom: NOMS[id],
  image: `/catalogue/modeles/${id}.jpg`,
  couleurs: COULEURS[id],
}));

/**
 * Les dressings. « Room » et « Coulissant » n'ont pas de façade pleine à
 * teinter — le site ne leur donne pas de nuancier, et nous non plus. Seul
 * l'ouvrant en a un, le même que la Parma en cuisine.
 *
 * Le coulissant est servi en PNG : c'est le format déposé sur le site.
 */
const DRESSING_DETAIL: Record<
  ModeleDressing,
  { nom: string; image: string; couleurs: readonly string[] }
> = {
  room: { nom: "Room", image: "/catalogue/dressings/room.jpg", couleurs: [] },
  // Servi en PNG : c'est le format déposé sur le site.
  coulissant: {
    nom: "Coulissant",
    image: "/catalogue/dressings/coulissant.png",
    couleurs: [],
  },
  ouvrant: {
    nom: "Ouvrant",
    image: "/catalogue/dressings/ouvrant.jpg",
    couleurs: [
      "Blanc",
      "Gris",
      "Vert",
      "Capuccino",
      "Chanvre",
      "White Toulip",
      "Noyer Pérenne",
      "Denver",
      "Ebene",
      "Perla Blanchi",
      "Ordino",
      "Nepal",
      "Fil Tordu",
      "Lucenta",
      "Tayler",
      "Noyer",
      "Montana",
    ],
  },
};

export const DRESSINGS: readonly ModeleCatalogue[] = MODELES_DRESSING.map(
  (id) => ({ id, ...DRESSING_DETAIL[id] }),
);

/** Le catalogue du type de projet choisi à l'étape 1. */
export function catalogueDe(type: TypeProjet): readonly ModeleCatalogue[] {
  return type === "dressing" ? DRESSINGS : MODELES;
}

const PAR_ID = new Map(
  [...MODELES, ...DRESSINGS].map((m) => [m.id as string, m]),
);

export function modele(id: string | null | undefined): ModeleCatalogue | null {
  return id ? (PAR_ID.get(id) ?? null) : null;
}

/** Les coloris d'un modèle — liste vide si le modèle n'est pas reconnu. */
export function couleursDuModele(id: string | null | undefined): readonly string[] {
  return modele(id)?.couleurs ?? [];
}

/** Tous les visuels du catalogue, pour la vérification de présence disque. */
export const TOUS_VISUELS: readonly string[] = [
  ...MODELES.map((m) => m.image),
  ...DRESSINGS.map((d) => d.image),
];

/**
 * Les types de façade, présentés par des cuisines réalisées : « celle-ci » se
 * comprend sans vocabulaire technique. Indépendants du modèle — c'est une
 * question de matière, pas de gamme.
 *
 * Visuels à fournir : déposer les fichiers aux chemins ci-dessous suffit.
 */
export interface OptionVisuelle {
  id: string;
  image: string;
}

export const FACADES: readonly OptionVisuelle[] = [
  { id: "laque_mat", image: "/catalogue/facades/laque-mat.jpg" },
  { id: "laque_brillant", image: "/catalogue/facades/laque-brillant.jpg" },
  { id: "bois_massif", image: "/catalogue/facades/bois-massif.jpg" },
  { id: "stratifie", image: "/catalogue/facades/stratifie.jpg" },
  { id: "pvc", image: "/catalogue/facades/pvc.jpg" },
];
