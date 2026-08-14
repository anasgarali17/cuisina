/**
 * Du texte libre au point sur la carte.
 *
 * En base, un lieu est une chaîne saisie à la main : « La Soukra », « soukra »,
 * « Houmt Souk », « Djerba ». Personne ne saisira jamais des coordonnées dans
 * une fiche contact. Ce module fait donc les deux moitiés du chemin :
 *
 *   1. `resolveVille` — la chaîne devient une localité connue (accents,
 *      casse, articles et alias absorbés), et donc un gouvernorat.
 *   2. `projectLatLng` — la localité devient un point du même repère SVG que
 *      les tracés de `tunisia-shapes`, parce que c'est la même projection.
 *
 * Ce qui n'est pas reconnu n'est pas inventé : `resolveVille` renvoie `null`
 * et l'appelant compte la ligne comme « hors carte » plutôt que de la poser
 * au hasard sur le pays.
 */

import {
  GOUVERNORATS,
  TUNISIA_BOUNDS,
  TUNISIA_PROJECTION,
  type GouvernoratCode,
} from "./tunisia-shapes";
import { PLACE_DELEGATION } from "./tunisia-place-delegations";
import type { RegionCode } from "./tunisia-regions";

export interface Place {
  /** Libellé de référence, tel qu'on veut l'afficher. */
  nom: string;
  lat: number;
  lng: number;
  gouvernorat: GouvernoratCode;
  /** Écritures alternatives rencontrées en base. */
  alias?: readonly string[];
}

/**
 * Le gazetteer. Couvre les villes des points de vente, les localités semées
 * par `scripts/seed.ts`, et les chefs-lieux — de quoi placer une fiche saisie
 * n'importe où dans le pays.
 *
 * Vérifié par `node scripts/check-tunisia-places.mjs` : chaque point doit
 * tomber dans le polygone du gouvernorat déclaré.
 */
export const PLACES: readonly Place[] = [
  /* — Grand Tunis — */
  { nom: "Tunis", lat: 36.8065, lng: 10.1815, gouvernorat: "TN-11" },
  { nom: "Le Bardo", lat: 36.8092, lng: 10.14, gouvernorat: "TN-11", alias: ["bardo"] },
  { nom: "El Menzah", lat: 36.84, lng: 10.17, gouvernorat: "TN-11", alias: ["menzah", "el manzah"] },
  { nom: "Montplaisir", lat: 36.825, lng: 10.185, gouvernorat: "TN-11", alias: ["mont plaisir"] },
  { nom: "El Omrane", lat: 36.8283, lng: 10.155, gouvernorat: "TN-11", alias: ["omrane"] },
  { nom: "La Goulette", lat: 36.818, lng: 10.305, gouvernorat: "TN-11", alias: ["goulette", "halq el oued"] },
  { nom: "Le Kram", lat: 36.835, lng: 10.315, gouvernorat: "TN-11", alias: ["kram"] },
  { nom: "Carthage", lat: 36.8528, lng: 10.3233, gouvernorat: "TN-11" },
  { nom: "Sidi Bou Saïd", lat: 36.8708, lng: 10.3475, gouvernorat: "TN-11", alias: ["sidi bousaid", "sidi bou said"] },
  { nom: "La Marsa", lat: 36.8783, lng: 10.3247, gouvernorat: "TN-11", alias: ["marsa"] },
  { nom: "Gammarth", lat: 36.92, lng: 10.29, gouvernorat: "TN-11" },
  { nom: "Ariana", lat: 36.8625, lng: 10.1956, gouvernorat: "TN-12", alias: ["l'ariana", "lariana"] },
  { nom: "Ennasr", lat: 36.86, lng: 10.15, gouvernorat: "TN-12", alias: ["el nasr", "en nasr", "nasr"] },
  { nom: "Borj Louzir", lat: 36.88, lng: 10.19, gouvernorat: "TN-12", alias: ["bordj louzir"] },
  { nom: "La Soukra", lat: 36.87, lng: 10.24, gouvernorat: "TN-12", alias: ["soukra", "el soukra"] },
  { nom: "Raoued", lat: 36.93, lng: 10.2, gouvernorat: "TN-12" },
  { nom: "Sidi Thabet", lat: 36.92, lng: 10.03, gouvernorat: "TN-12" },
  { nom: "Ben Arous", lat: 36.7533, lng: 10.2189, gouvernorat: "TN-13" },
  { nom: "Ezzahra", lat: 36.74, lng: 10.31, gouvernorat: "TN-13", alias: ["el zahra", "zahra"] },
  { nom: "Hammam Lif", lat: 36.725, lng: 10.34, gouvernorat: "TN-13", alias: ["hammam el lif"] },
  { nom: "Radès", lat: 36.77, lng: 10.275, gouvernorat: "TN-13", alias: ["rades"] },
  { nom: "Mégrine", lat: 36.775, lng: 10.235, gouvernorat: "TN-13", alias: ["megrine"] },
  { nom: "Fouchana", lat: 36.71, lng: 10.14, gouvernorat: "TN-13" },
  { nom: "Mornag", lat: 36.67, lng: 10.29, gouvernorat: "TN-13", alias: ["morneg"] },
  { nom: "Mohamedia", lat: 36.66, lng: 10.1, gouvernorat: "TN-13", alias: ["mohammedia"] },
  { nom: "Manouba", lat: 36.81, lng: 10.1, gouvernorat: "TN-14", alias: ["la manouba", "manubah", "mannouba"] },
  { nom: "Den Den", lat: 36.81, lng: 10.12, gouvernorat: "TN-14", alias: ["denden"] },
  { nom: "Douar Hicher", lat: 36.82, lng: 10.08, gouvernorat: "TN-14" },
  { nom: "Oued Ellil", lat: 36.83, lng: 10.03, gouvernorat: "TN-14" },
  { nom: "Mornaguia", lat: 36.75, lng: 9.95, gouvernorat: "TN-14" },

  /* — Nord-Est — */
  { nom: "Nabeul", lat: 36.4513, lng: 10.7357, gouvernorat: "TN-21" },
  { nom: "Dar Chaabane", lat: 36.47, lng: 10.75, gouvernorat: "TN-21", alias: ["dar chabaane", "dar chaabane el fehri"] },
  { nom: "Béni Khiar", lat: 36.47, lng: 10.79, gouvernorat: "TN-21", alias: ["beni khiar"] },
  { nom: "Hammamet", lat: 36.4, lng: 10.6167, gouvernorat: "TN-21" },
  { nom: "Yasmine Hammamet", lat: 36.365, lng: 10.545, gouvernorat: "TN-21", alias: ["hammamet sud", "yasmine"] },
  { nom: "Bir Bouregba", lat: 36.41, lng: 10.57, gouvernorat: "TN-21", alias: ["bir bou rekba", "bir bou regba"] },
  { nom: "Korba", lat: 36.57, lng: 10.86, gouvernorat: "TN-21" },
  { nom: "Kélibia", lat: 36.8478, lng: 11.0939, gouvernorat: "TN-21", alias: ["kelibia"] },
  { nom: "Menzel Temime", lat: 36.78, lng: 10.99, gouvernorat: "TN-21" },
  { nom: "Soliman", lat: 36.7, lng: 10.49, gouvernorat: "TN-21" },
  { nom: "Grombalia", lat: 36.5972, lng: 10.5, gouvernorat: "TN-21" },
  { nom: "Zaghouan", lat: 36.4025, lng: 10.1425, gouvernorat: "TN-22", alias: ["zaghouane", "zaghwan"] },
  { nom: "El Fahs", lat: 36.38, lng: 9.9, gouvernorat: "TN-22", alias: ["fahs"] },
  { nom: "Bizerte", lat: 37.2744, lng: 9.8739, gouvernorat: "TN-23", alias: ["benzert"] },
  { nom: "Menzel Bourguiba", lat: 37.15, lng: 9.79, gouvernorat: "TN-23" },
  { nom: "Menzel Jemil", lat: 37.235, lng: 9.915, gouvernorat: "TN-23" },
  { nom: "Ras Jebel", lat: 37.215, lng: 10.12, gouvernorat: "TN-23" },
  { nom: "Mateur", lat: 37.04, lng: 9.665, gouvernorat: "TN-23" },

  /* — Nord-Ouest — */
  { nom: "Béja", lat: 36.7256, lng: 9.1817, gouvernorat: "TN-31", alias: ["beja"] },
  { nom: "Testour", lat: 36.55, lng: 9.44, gouvernorat: "TN-31" },
  { nom: "Nefza", lat: 36.96, lng: 9.07, gouvernorat: "TN-31" },
  { nom: "Jendouba", lat: 36.5011, lng: 8.7803, gouvernorat: "TN-32" },
  { nom: "Tabarka", lat: 36.9544, lng: 8.7581, gouvernorat: "TN-32" },
  { nom: "Bou Salem", lat: 36.61, lng: 8.97, gouvernorat: "TN-32", alias: ["boussalem"] },
  { nom: "Le Kef", lat: 36.1742, lng: 8.705, gouvernorat: "TN-33", alias: ["kef", "el kef"] },
  { nom: "Dahmani", lat: 35.95, lng: 8.83, gouvernorat: "TN-33" },
  { nom: "Siliana", lat: 36.085, lng: 9.3708, gouvernorat: "TN-34" },
  { nom: "Makthar", lat: 35.86, lng: 9.2, gouvernorat: "TN-34", alias: ["maktar"] },

  /* — Centre-Est — */
  { nom: "Sousse", lat: 35.8256, lng: 10.6369, gouvernorat: "TN-51", alias: ["soussa"] },
  { nom: "Hammam Sousse", lat: 35.86, lng: 10.6, gouvernorat: "TN-51" },
  { nom: "Port El Kantaoui", lat: 35.893, lng: 10.595, gouvernorat: "TN-51", alias: ["kantaoui", "el kantaoui"] },
  { nom: "Msaken", lat: 35.7292, lng: 10.5806, gouvernorat: "TN-51", alias: ["m'saken", "messaken"] },
  { nom: "Kalaa Kebira", lat: 35.87, lng: 10.535, gouvernorat: "TN-51", alias: ["kalaa el kebira"] },
  { nom: "Enfidha", lat: 36.13, lng: 10.38, gouvernorat: "TN-51" },
  { nom: "Monastir", lat: 35.777, lng: 10.8262, gouvernorat: "TN-52" },
  { nom: "Ksar Hellal", lat: 35.6467, lng: 10.89, gouvernorat: "TN-52" },
  { nom: "Moknine", lat: 35.6383, lng: 10.8983, gouvernorat: "TN-52" },
  { nom: "Sahline", lat: 35.75, lng: 10.71, gouvernorat: "TN-52" },
  { nom: "Mahdia", lat: 35.5047, lng: 11.0622, gouvernorat: "TN-53" },
  { nom: "Ksour Essef", lat: 35.42, lng: 10.995, gouvernorat: "TN-53" },
  { nom: "Chebba", lat: 35.2372, lng: 11.115, gouvernorat: "TN-53", alias: ["la chebba"] },
  { nom: "Sfax", lat: 34.7406, lng: 10.7603, gouvernorat: "TN-61", alias: ["safaqis"] },
  { nom: "Sakiet Ezzit", lat: 34.83, lng: 10.76, gouvernorat: "TN-61", alias: ["sakiet ezzit", "saqiat al zayt"] },
  { nom: "Sakiet Eddaier", lat: 34.78, lng: 10.79, gouvernorat: "TN-61", alias: ["sakiet eddaier"] },
  { nom: "Route Gremda", lat: 34.79, lng: 10.71, gouvernorat: "TN-61", alias: ["gremda", "km gremda"] },
  { nom: "Chihia", lat: 34.79, lng: 10.79, gouvernorat: "TN-61" },
  { nom: "Mahrès", lat: 34.53, lng: 10.5, gouvernorat: "TN-61", alias: ["mahres"] },
  { nom: "Kerkennah", lat: 34.69, lng: 11.22, gouvernorat: "TN-61", alias: ["kerkenah", "iles kerkennah"] },

  /* — Centre-Ouest — */
  { nom: "Kairouan", lat: 35.6781, lng: 10.0958, gouvernorat: "TN-41", alias: ["qairouan"] },
  { nom: "Haffouz", lat: 35.63, lng: 9.67, gouvernorat: "TN-41" },
  { nom: "Kasserine", lat: 35.1676, lng: 8.8365, gouvernorat: "TN-42", alias: ["kasserine", "kassérine"] },
  { nom: "Sbeitla", lat: 35.235, lng: 9.12, gouvernorat: "TN-42" },
  { nom: "Sidi Bouzid", lat: 35.0381, lng: 9.4858, gouvernorat: "TN-43", alias: ["sidi bou zid"] },
  { nom: "Regueb", lat: 34.86, lng: 9.78, gouvernorat: "TN-43" },

  /* — Sud-Est — */
  { nom: "Gabès", lat: 33.8815, lng: 10.0982, gouvernorat: "TN-81", alias: ["gabes", "qabis"] },
  { nom: "Chenini Nahal", lat: 33.89, lng: 10.05, gouvernorat: "TN-81", alias: ["chenini nahal", "chenini gabes"] },
  { nom: "Ghannouch", lat: 33.94, lng: 10.06, gouvernorat: "TN-81" },
  { nom: "Mareth", lat: 33.62, lng: 10.28, gouvernorat: "TN-81" },
  { nom: "Médenine", lat: 33.3549, lng: 10.5055, gouvernorat: "TN-82", alias: ["medenine"] },
  { nom: "Djerba", lat: 33.8076, lng: 10.8451, gouvernorat: "TN-82", alias: ["jerba", "ile de djerba"] },
  { nom: "Houmt Souk", lat: 33.8756, lng: 10.8578, gouvernorat: "TN-82", alias: ["houmt essouk", "houmt souq"] },
  { nom: "Midoun", lat: 33.8081, lng: 10.9931, gouvernorat: "TN-82" },
  { nom: "Aghir", lat: 33.723, lng: 10.995, gouvernorat: "TN-82" },
  { nom: "Ajim", lat: 33.72, lng: 10.75, gouvernorat: "TN-82", alias: ["adjim"] },
  { nom: "Zarzis", lat: 33.5039, lng: 11.1122, gouvernorat: "TN-82" },
  { nom: "Ben Gardane", lat: 33.1381, lng: 11.22, gouvernorat: "TN-82", alias: ["ben guerdane"] },
  { nom: "Tataouine", lat: 32.9297, lng: 10.4518 , gouvernorat: "TN-83" },
  { nom: "Ghomrassen", lat: 33.06, lng: 10.34, gouvernorat: "TN-83" },
  { nom: "Remada", lat: 32.3167, lng: 10.4, gouvernorat: "TN-83" },

  /* — Sud-Ouest — */
  { nom: "Gafsa", lat: 34.425, lng: 8.7842, gouvernorat: "TN-71" },
  { nom: "Metlaoui", lat: 34.33, lng: 8.4, gouvernorat: "TN-71" },
  { nom: "Redeyef", lat: 34.39, lng: 8.16, gouvernorat: "TN-71" },
  { nom: "Tozeur", lat: 33.9197, lng: 8.1335, gouvernorat: "TN-72" },
  { nom: "Nefta", lat: 33.873, lng: 7.877, gouvernorat: "TN-72" },
  { nom: "Kébili", lat: 33.705, lng: 8.969, gouvernorat: "TN-73", alias: ["kebili"] },
  { nom: "Douz", lat: 33.4661, lng: 9.0203, gouvernorat: "TN-73" },
];

/* — Projection — */

export interface Point {
  x: number;
  y: number;
}

/**
 * Un couple (lat, lng) dans le repère SVG des gouvernorats. Même Mercator,
 * mêmes constantes — celles que le générateur a figées dans `tunisia-shapes`.
 */
export function projectLatLng(lat: number, lng: number): Point {
  const { xScale, scale, yTop } = TUNISIA_PROJECTION;
  const rad = (lat * Math.PI) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + rad / 2));
  return {
    x: (lng - TUNISIA_BOUNDS.minLng) * xScale,
    y: (yTop - y) * scale,
  };
}

/* — Résolution du texte libre — */

/**
 * Casse, accents, articles, ponctuation : tout ce qui distingue
 * « Sidi Bou Saïd » de « sidi bousaid » disparaît ici.
 */
function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .replace(/\b(la|le|les|el|al)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_KEY = new Map<string, Place>();
for (const place of PLACES) {
  BY_KEY.set(normalise(place.nom), place);
  for (const alias of place.alias ?? []) {
    BY_KEY.set(normalise(alias), place);
  }
}

const GOV_BY_CODE = new Map(GOUVERNORATS.map((g) => [g.code, g]));

/** Index des gouvernorats par nom, pour les villes saisies au gouvernorat. */
const GOV_BY_NAME = new Map<string, GouvernoratCode>();
for (const gov of GOUVERNORATS) {
  for (const nom of [gov.nom.fr, gov.nom.en, gov.nom.ar]) {
    GOV_BY_NAME.set(normalise(nom), gov.code);
  }
}

export interface ResolvedPlace {
  place: Place;
  gouvernorat: GouvernoratCode;
  /**
   * Code de délégation (مُعتمدية), calculé au build par
   * `scripts/build-tunisia-places.ts`. `null` si la localité n'a pas pu être
   * rattachée — la carte la garde alors au niveau du gouvernorat.
   */
  delegation: string | null;
  region: RegionCode;
  point: Point;
}

const RESOLVED = new Map<string, ResolvedPlace | null>();

function resolvedFor(place: Place): ResolvedPlace {
  const gov = GOV_BY_CODE.get(place.gouvernorat);
  if (!gov) throw new Error(`Gouvernorat inconnu : ${place.gouvernorat}`);
  return {
    place,
    gouvernorat: place.gouvernorat,
    delegation: PLACE_DELEGATION[place.nom] ?? null,
    region: gov.region,
    point: projectLatLng(place.lat, place.lng),
  };
}

/**
 * La ville d'une fiche, d'un client ou d'un point de vente, résolue en point
 * cartographique. `null` si la chaîne n'évoque rien de connu — auquel cas
 * l'appelant la compte hors carte, plutôt que de la placer à peu près.
 *
 * Deux replis avant d'abandonner : le nom d'un gouvernorat (on prend son
 * chef-lieu), puis le premier mot d'une adresse (« Sfax Route de Tunis »).
 */
export function resolveVille(
  ville: string | null | undefined,
): ResolvedPlace | null {
  if (!ville) return null;
  const key = normalise(ville);
  if (!key) return null;

  const cached = RESOLVED.get(key);
  if (cached !== undefined) return cached;

  let result: ResolvedPlace | null = null;
  const direct = BY_KEY.get(key);
  if (direct) {
    result = resolvedFor(direct);
  } else {
    const govCode = GOV_BY_NAME.get(key);
    if (govCode) {
      // Le chef-lieu porte le nom du gouvernorat dans presque tous les cas.
      const chefLieu = PLACES.find((p) => p.gouvernorat === govCode);
      if (chefLieu) result = resolvedFor(chefLieu);
    }
  }
  if (!result) {
    // « Sfax Route de Tunis km 3 » → on retient le plus long préfixe connu.
    const words = key.split(" ");
    for (let take = Math.min(3, words.length); take >= 1 && !result; take -= 1) {
      const prefix = BY_KEY.get(words.slice(0, take).join(" "));
      if (prefix) result = resolvedFor(prefix);
    }
  }

  RESOLVED.set(key, result);
  return result;
}

/** Le gouvernorat d'une ville, sans le reste. */
export function gouvernoratOf(
  ville: string | null | undefined,
): GouvernoratCode | null {
  return resolveVille(ville)?.gouvernorat ?? null;
}

export { GOUVERNORATS, GOV_BY_CODE };
export type { GouvernoratCode };
