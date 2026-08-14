/**
 * Vérifie le gazetteer contre les frontières officielles, et en déduit la
 * délégation de chaque localité.
 *
 * Deux raisons d'être :
 *
 *   1. **Contrôle.** Une coordonnée saisie à la main se trompe silencieusement :
 *      la punaise s'affiche, simplement au mauvais endroit. Chaque localité
 *      doit tomber dans le polygone du gouvernorat qu'elle déclare, et chaque
 *      libellé rencontré en base doit se résoudre.
 *
 *   2. **Génération.** `src/lib/geo/tunisia-place-delegations.ts` associe
 *      chaque localité à sa délégation (مُعتمدية). C'est ce qui permet de
 *      filtrer les punaises à ce niveau sans embarquer les 264 tracés côté
 *      serveur — le calcul est fait ici, une fois.
 *
 *   npx tsx scripts/build-tunisia-places.ts
 */

import fs from "node:fs";
import path from "node:path";
import {
  PLACES,
  projectLatLng,
  resolveVille,
  type Point,
} from "../src/lib/geo/tunisia";
import { GOUVERNORATS } from "../src/lib/geo/tunisia-shapes";
import { DELEGATIONS } from "../src/lib/geo/tunisia-delegations";

const OUT = "src/lib/geo/tunisia-place-delegations.ts";

/** Reconstruit les anneaux d'un chemin généré (`M x yL…Z` répété). */
function ringsOf(d: string): Point[][] {
  return d
    .split("Z")
    .filter((chunk) => chunk.trim().length > 0)
    .map((chunk) =>
      chunk
        .replace(/^M/, "")
        .split("L")
        .map((pair) => {
          const [x, y] = pair.trim().split(/\s+/).map(Number);
          return { x, y };
        }),
    );
}

/** Pair-impair sur tous les anneaux : les trous sont exclus d'office. */
function inRings(p: Point, rings: Point[][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[i];
      const b = ring[j];
      if (
        a.y > p.y !== b.y > p.y &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
      ) {
        inside = !inside;
      }
    }
  }
  return inside;
}

/** Distance du point au bord le plus proche — pour chiffrer un ratage. */
function distanceToRings(p: Point, rings: Point[][]): number {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[i];
      const b = ring[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
      if (d < best) best = d;
    }
  }
  return best;
}

const govRings = new Map(GOUVERNORATS.map((g) => [g.code, ringsOf(g.d)]));
const govNom = new Map(GOUVERNORATS.map((g) => [g.code, g.nom.fr]));
const delRings = DELEGATIONS.map((d) => ({ del: d, rings: ringsOf(d.d) }));

/**
 * Les tracés sont simplifiés (~0.45 unité SVG, soit ~400 m) : une ville
 * littorale peut tomber juste dehors sans être fausse. Au-delà on parle
 * d'une erreur de saisie, pas d'un arrondi.
 */
const SLACK = 3;

let failures = 0;

/* — 1. Chaque localité dans le bon gouvernorat — */

for (const place of PLACES) {
  const point = projectLatLng(place.lat, place.lng);
  const target = govRings.get(place.gouvernorat);
  if (!target) {
    console.error(`✗ ${place.nom} : gouvernorat ${place.gouvernorat} inconnu`);
    failures += 1;
    continue;
  }

  if (target.some((ring) => inRings(point, [ring]))) continue;

  const gap = distanceToRings(point, target);
  if (gap <= SLACK) continue;

  const actual = GOUVERNORATS.find((g) =>
    inRings(point, govRings.get(g.code) ?? []),
  );
  console.error(
    `✗ ${place.nom} (${place.lat}, ${place.lng}) déclaré ` +
      `${govNom.get(place.gouvernorat)} — trouvé ${actual ? actual.nom.fr : "hors du pays"}, ` +
      `à ${gap.toFixed(1)} unités du bord`,
  );
  failures += 1;
}

/* — 2. Chaque libellé rencontré en base doit se résoudre — */

/** Tout ce que `seed.ts`, les points de vente et les fiches écrivent en base. */
const LIBELLES_EN_BASE = [
  "Tunis", "El Menzah", "Le Bardo", "Montplaisir",
  "La Marsa", "Gammarth", "Carthage", "Sidi Bou Saïd",
  "La Soukra", "Soukra", "Ariana", "Ennasr", "Borj Louzir",
  "Hammamet", "Yasmine Hammamet", "Bir Bouregba",
  "Nabeul", "Dar Chaabane", "Béni Khiar",
  "Sousse", "Hammam Sousse", "Kantaoui", "Msaken",
  "Houmt Souk", "Midoun", "Aghir", "Djerba",
  "Sfax", "Sakiet Ezzit", "Route Gremda",
  "Gabès", "Chenini Nahal",
  "Menzel Bourguiba", "Kasserine", "Ben Arous", "Monastir",
  "Radès", "Kairouan",
  // Écritures dégradées : casse perdue, accents perdus, adresse complète.
  "tunis", "SFAX", "gabes", "la manouba", "Sfax Route de Tunis km 3",
];

for (const libelle of LIBELLES_EN_BASE) {
  if (!resolveVille(libelle)) {
    console.error(`✗ « ${libelle} » ne se résout pas`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\n${failures} problème(s). Rien n'a été généré.`);
  process.exit(1);
}

/* — 3. La délégation de chaque localité — */

const assignations: Array<{ nom: string; code: string; parDistance: boolean }> =
  [];
let horsDelegation = 0;

for (const place of PLACES) {
  const point = projectLatLng(place.lat, place.lng);

  // On ne cherche que dans les délégations du gouvernorat déjà validé : plus
  // rapide, et surtout impossible de rattacher une localité à la délégation
  // d'un gouvernorat voisin dont le tracé mordrait un peu.
  const candidates = delRings.filter(
    ({ del }) => del.gouvernorat === place.gouvernorat,
  );
  if (candidates.length === 0) {
    horsDelegation += 1;
    continue;
  }

  const dedans = candidates.find(({ rings }) => inRings(point, rings));
  if (dedans) {
    assignations.push({
      nom: place.nom,
      code: dedans.del.code,
      parDistance: false,
    });
    continue;
  }

  // Point tombé entre deux tracés simplifiés, ou dans une sebkha : on prend
  // la délégation la plus proche du même gouvernorat.
  let best = Infinity;
  let cible: string | null = null;
  for (const { del, rings } of candidates) {
    const d = distanceToRings(point, rings);
    if (d < best) {
      best = d;
      cible = del.code;
    }
  }
  if (cible) {
    assignations.push({ nom: place.nom, code: cible, parDistance: true });
  } else {
    horsDelegation += 1;
  }
}

const parDistance = assignations.filter((a) => a.parDistance).length;

const file = `/**
 * GÉNÉRÉ — ne pas modifier à la main. Régénérer avec :
 *   npx tsx scripts/build-tunisia-places.ts
 *
 * La délégation (مُعتمدية) de chaque localité du gazetteer, calculée par
 * appartenance géométrique au build.
 *
 * Ce détour existe pour que le serveur puisse étiqueter une punaise sans
 * charger les 264 tracés ADM2 : les polygones restent dans
 * ./tunisia-delegations, importé à la demande par la carte seule.
 */

/** Localité de référence → code de délégation. */
export const PLACE_DELEGATION: Record<string, string> = {
${assignations
  .sort((a, b) => a.nom.localeCompare(b.nom))
  .map((a) => `  ${JSON.stringify(a.nom)}: "${a.code}",`)
  .join("\n")}
};
`;

const out = path.join(process.cwd(), OUT);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, file, "utf8");

console.log(
  `✓ ${PLACES.length} localités dans le bon gouvernorat · ` +
    `${LIBELLES_EN_BASE.length} libellés résolus`,
);
console.log(
  `✓ ${OUT} — ${assignations.length} localités rattachées à leur délégation` +
    (parDistance > 0 ? ` (dont ${parDistance} par proximité)` : ""),
);
if (horsDelegation > 0) {
  console.log(`  ⚠ ${horsDelegation} localité(s) sans délégation`);
}
