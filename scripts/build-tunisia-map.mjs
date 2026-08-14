/**
 * Génère les deux fichiers de géométrie de la carte :
 *
 *   src/lib/geo/tunisia-shapes.ts       — les 24 gouvernorats
 *   src/lib/geo/tunisia-delegations.ts  — les 264 مُعتمدية (délégations)
 *
 * Pourquoi pré-projeter et pré-simplifier au build plutôt qu'au runtime : la
 * source fait plus d'un mégaoctet de GeoJSON et 38 000 points. Le navigateur
 * n'a besoin ni de la précision cadastrale ni d'un moteur de projection — il a
 * besoin de chaînes `d`. Les deux fichiers générés n'embarquent aucune
 * dépendance géo, et celui des délégations est chargé à la demande.
 *
 * Sources, épinglées sur un commit pour que deux exécutions donnent le même
 * fichier :
 *   · frontières  : geoBoundaries gbOpen TUN ADM1/ADM2 (OpenStreetMap, ODbL 1.0)
 *   · noms fr/ar  : OpenStreetMap, relations admin_level=5 (ODbL 1.0)
 *
 * Les noms des délégations méritent un mot : geoBoundaries ne fournit qu'un
 * libellé, et il est tantôt arabe tantôt latin selon la délégation. On va donc
 * chercher les deux écritures dans OSM, et on les rattache **par la
 * géométrie** — le centre de la relation OSM doit tomber dans le polygone —
 * plutôt que par le nom. Rapprocher « صفاقس الجنوبية » et « Sfax Sud » par
 * chaîne de caractères ne marche pas ; par coordonnées, si.
 *
 *   node scripts/build-tunisia-map.mjs
 */

import fs from "node:fs";
import path from "node:path";

const SOURCES = {
  adm1: {
    url: "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUN/ADM1/geoBoundaries-TUN-ADM1_simplified.geojson",
    cache: ".cache/tun-adm1.geojson",
  },
  adm2: {
    url: "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/TUN/ADM2/geoBoundaries-TUN-ADM2_simplified.geojson",
    cache: ".cache/tun-adm2.geojson",
  },
};

/** Les noms des délégations, en arabe et en français. */
const OVERPASS = {
  url: "https://overpass-api.de/api/interpreter",
  cache: ".cache/tun-l5.json",
  query: `[out:json][timeout:120];
rel["boundary"="administrative"]["admin_level"="5"](30.0,7.4,37.6,11.7);
out tags center;`,
};

const OUT_SHAPES = "src/lib/geo/tunisia-shapes.ts";
const OUT_DELEGATIONS = "src/lib/geo/tunisia-delegations.ts";

/** Hauteur de référence de la projection, en unités SVG. */
const HEIGHT = 1000;

/**
 * Tolérances Douglas–Peucker, en unités SVG (1 unité ≈ 800 m).
 *
 * Les gouvernorats se voient à l'échelle du pays : au-delà de ~0.6 les côtes
 * bavent. Les délégations ne s'affichent qu'une fois zoomé sur un gouvernorat,
 * donc elles ont droit à trois fois plus de détail.
 */
const TOLERANCE = { adm1: 0.45, adm2: 0.32 };
/** Sous ce seuil (unités SVG²) un anneau est un caillou : on le jette. */
const MIN_RING_AREA = { adm1: 1.2, adm2: 0.35 };
/** Décimales gardées dans les `d`. 1 = ~0.1 unité SVG, invisible à l'écran. */
const PRECISION = 1;

/**
 * Noms officiels des gouvernorats. geoBoundaries ne fournit qu'un libellé
 * latin ; l'app est trilingue, donc le reste est saisi ici, indexé sur
 * l'ISO 3166-2. Vingt-quatre lignes, contrairement aux délégations.
 */
const NAMES = {
  "TN-11": { fr: "Tunis", en: "Tunis", ar: "تونس" },
  "TN-12": { fr: "Ariana", en: "Ariana", ar: "أريانة" },
  "TN-13": { fr: "Ben Arous", en: "Ben Arous", ar: "بن عروس" },
  "TN-14": { fr: "Manouba", en: "Manouba", ar: "منوبة" },
  "TN-21": { fr: "Nabeul", en: "Nabeul", ar: "نابل" },
  "TN-22": { fr: "Zaghouan", en: "Zaghouan", ar: "زغوان" },
  "TN-23": { fr: "Bizerte", en: "Bizerte", ar: "بنزرت" },
  "TN-31": { fr: "Béja", en: "Beja", ar: "باجة" },
  "TN-32": { fr: "Jendouba", en: "Jendouba", ar: "جندوبة" },
  "TN-33": { fr: "Le Kef", en: "Kef", ar: "الكاف" },
  "TN-34": { fr: "Siliana", en: "Siliana", ar: "سليانة" },
  "TN-41": { fr: "Kairouan", en: "Kairouan", ar: "القيروان" },
  "TN-42": { fr: "Kasserine", en: "Kasserine", ar: "القصرين" },
  "TN-43": { fr: "Sidi Bouzid", en: "Sidi Bouzid", ar: "سيدي بوزيد" },
  "TN-51": { fr: "Sousse", en: "Sousse", ar: "سوسة" },
  "TN-52": { fr: "Monastir", en: "Monastir", ar: "المنستير" },
  "TN-53": { fr: "Mahdia", en: "Mahdia", ar: "المهدية" },
  "TN-61": { fr: "Sfax", en: "Sfax", ar: "صفاقس" },
  "TN-71": { fr: "Gafsa", en: "Gafsa", ar: "قفصة" },
  "TN-72": { fr: "Tozeur", en: "Tozeur", ar: "توزر" },
  "TN-73": { fr: "Kébili", en: "Kebili", ar: "قبلي" },
  "TN-81": { fr: "Gabès", en: "Gabes", ar: "قابس" },
  "TN-82": { fr: "Médenine", en: "Medenine", ar: "مدنين" },
  "TN-83": { fr: "Tataouine", en: "Tataouine", ar: "تطاوين" },
};

/**
 * Rattachements corrigés à la main, indexés sur le nom français de la
 * délégation.
 *
 * ADM1 et ADM2 ne viennent pas du même relevé : le tracé ADM2 de Ben Gardane
 * déborde largement sur le Tataouine d'ADM1, si bien que le vote de surface —
 * comme le centroïde avant lui — la classe dans le mauvais gouvernorat. Elle
 * est administrativement à Médenine, point. Une ligne par désaccord constaté,
 * plutôt qu'une heuristique de plus.
 */
const PARENT_CORRIGE = {
  "Ben Gardane": "TN-82",
};

/**
 * Les gouvernorats regroupés comme le commerce les regroupe. Le Grand Tunis
 * n'est pas une région administrative, mais c'est bien une zone de chalandise.
 */
const REGIONS = {
  "TN-11": "grand_tunis",
  "TN-12": "grand_tunis",
  "TN-13": "grand_tunis",
  "TN-14": "grand_tunis",
  "TN-21": "nord_est",
  "TN-22": "nord_est",
  "TN-23": "nord_est",
  "TN-31": "nord_ouest",
  "TN-32": "nord_ouest",
  "TN-33": "nord_ouest",
  "TN-34": "nord_ouest",
  "TN-51": "centre_est",
  "TN-52": "centre_est",
  "TN-53": "centre_est",
  "TN-61": "centre_est",
  "TN-41": "centre_ouest",
  "TN-42": "centre_ouest",
  "TN-43": "centre_ouest",
  "TN-71": "sud_ouest",
  "TN-72": "sud_ouest",
  "TN-73": "sud_ouest",
  "TN-81": "sud_est",
  "TN-82": "sud_est",
  "TN-83": "sud_est",
};

/* — Projection : Mercator sphérique, cadrée sur la bbox du pays — */

function mercatorY(lat) {
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

/* — Simplification : Douglas–Peucker, dans l'espace projeté — */

function perpDistanceSq(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
  }
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * dx;
  const cy = a[1] + t * dy;
  return (p[0] - cx) ** 2 + (p[1] - cy) ** 2;
}

/**
 * Itératif, pas récursif : un anneau de 16 000 points fait exploser la pile.
 */
function simplify(points, toleranceSq) {
  if (points.length <= 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let maxDist = -1;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const d = perpDistanceSq(points[i], points[first], points[last]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > toleranceSq && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
}

/** Aire signée d'un anneau — sert au tri (plus gros anneau = terre ferme). */
function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(sum / 2);
}

/** Centroïde d'aire d'un anneau — où poser l'étiquette. */
function ringCentroid(ring) {
  let cx = 0;
  let cy = 0;
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    area += cross;
    cx += (ring[j][0] + ring[i][0]) * cross;
    cy += (ring[j][1] + ring[i][1]) * cross;
  }
  area *= 0.5;
  if (area === 0) return ring[0];
  return [cx / (6 * area), cy / (6 * area)];
}

function ringsOf(geometry) {
  if (geometry.type === "Polygon") return geometry.coordinates;
  return geometry.coordinates.flat();
}

/**
 * Test pair-impair sur tous les anneaux : les trous (lagune de Boughrara,
 * sebkhas) sont donc correctement exclus, sans les traiter à part.
 */
function pointInRings(point, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (
        yi > point[1] !== yj > point[1] &&
        point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
      ) {
        inside = !inside;
      }
    }
  }
  return inside;
}

function distanceToRings(point, rings) {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const d = Math.sqrt(perpDistanceSq(point, ring[i], ring[j]));
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * Deux écritures arabes du même nom, réduites à la même clé : diacritiques,
 * tatweel, marques de direction et espaces sautent, les variantes d'alef et de
 * ya sont unifiées. C'est ce qui rapproche « بن قردان » de « بنقردان ».
 */
function arabicKey(value) {
  return (value ?? "")
    .replace(/[ً-ْٰـ‎‏‪-‮]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, "")
    .trim();
}

/** `Sfax Sud` → `sfax-sud`. Sert de clé lisible, stable d'une exécution à l'autre. */
function slug(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function cached(cache, url, body) {
  const file = path.join(process.cwd(), cache);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));

  console.log(`↓ ${url}`);
  const res = await fetch(url, body ? { method: "POST", body } : undefined);
  if (!res.ok) throw new Error(`${url} a répondu ${res.status}`);
  const text = await res.text();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return JSON.parse(text);
}

async function main() {
  const adm1 = await cached(SOURCES.adm1.cache, SOURCES.adm1.url);
  const adm2 = await cached(SOURCES.adm2.cache, SOURCES.adm2.url);
  const osm = await cached(OVERPASS.cache, OVERPASS.url, OVERPASS.query);

  if (adm1.features.length !== 24) {
    throw new Error(`24 gouvernorats attendus, ${adm1.features.length} trouvés`);
  }

  /* — Cadrage : bbox du pays, sur la source non simplifiée — */

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const f of adm1.features) {
    for (const ring of ringsOf(f.geometry)) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  const yTop = mercatorY(maxLat);
  const yBottom = mercatorY(minLat);
  // Une seule échelle pour x et y : sinon le pays est étiré.
  const scale = HEIGHT / (yTop - yBottom);
  const xScale = scale * (Math.PI / 180);
  const width = (maxLng - minLng) * xScale;

  const project = ([lng, lat]) => [
    (lng - minLng) * xScale,
    (yTop - mercatorY(lat)) * scale,
  ];

  const round = (n) => Number(n.toFixed(PRECISION));

  /**
   * Projette, simplifie, et rend le `d` d'un feature, plus sa bbox et son
   * centroïde. Le même traitement pour les deux niveaux, à la tolérance près.
   */
  function toPath(geometry, tolerance, minArea, label) {
    const kept = [];
    let pointsIn = 0;
    for (const ring of ringsOf(geometry)) {
      pointsIn += ring.length;
      const projected = ring.map(project);
      if (ringArea(projected) < minArea) continue;
      const simplified = simplify(projected, tolerance * tolerance);
      if (simplified.length < 4) continue;
      kept.push(simplified);
    }
    if (kept.length === 0) throw new Error(`${label} : plus aucun anneau`);
    kept.sort((a, b) => ringArea(b) - ringArea(a));

    let pointsOut = 0;
    const d = kept
      .map((ring) => {
        pointsOut += ring.length;
        const head = ring[0];
        const body = ring
          .slice(1)
          .map((p) => `${round(p[0])} ${round(p[1])}`)
          .join("L");
        return `M${round(head[0])} ${round(head[1])}L${body}Z`;
      })
      .join("");

    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const ring of kept) {
      for (const [x, y] of ring) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }

    const centre = ringCentroid(kept[0]).map(round);
    return {
      d,
      bbox: [x0, y0, x1, y1].map(round),
      labelX: centre[0],
      labelY: centre[1],
      pointsIn,
      pointsOut,
      /** Anneaux projetés et simplifiés — servent aux tests d'appartenance. */
      rings: kept,
    };
  }

  /**
   * À quel gouvernorat appartient une délégation.
   *
   * Le centroïde ne suffit pas : ADM1 et ADM2 ne viennent pas du même relevé
   * et ne s'emboîtent pas au mètre près. Ben Gardane, en croissant autour du
   * golfe, voyait son centroïde tomber dans Tataouine — et Smâr dans Médenine.
   * On vote donc sur une grille de points intérieurs, ce qui approche le
   * recouvrement de surface : la délégation appartient au gouvernorat qui en
   * couvre le plus.
   */
  function parentDe(rings, bbox, gouvernorats) {
    const [x0, y0, x1, y1] = bbox;
    const PAS = 17;
    const votes = new Map();

    for (let i = 0; i < PAS; i += 1) {
      for (let j = 0; j < PAS; j += 1) {
        const point = [
          x0 + ((i + 0.5) * (x1 - x0)) / PAS,
          y0 + ((j + 0.5) * (y1 - y0)) / PAS,
        ];
        if (!pointInRings(point, rings)) continue;
        for (const gov of gouvernorats) {
          const [gx0, gy0, gx1, gy1] = gov.bbox;
          if (
            point[0] < gx0 ||
            point[0] > gx1 ||
            point[1] < gy0 ||
            point[1] > gy1
          ) {
            continue;
          }
          if (!pointInRings(point, gov.rings)) continue;
          votes.set(gov.code, (votes.get(gov.code) ?? 0) + 1);
          break;
        }
      }
    }

    let best = null;
    let bestVotes = 0;
    for (const [code, n] of votes) {
      if (n > bestVotes) {
        bestVotes = n;
        best = code;
      }
    }
    if (best) return { code: best, parVote: true };

    // Aucun point intérieur retenu (délégation minuscule, ou entièrement
    // hors des tracés ADM1) : on prend la frontière la plus proche.
    const centre = ringCentroid(rings[0]);
    let distance = Infinity;
    for (const gov of gouvernorats) {
      const d = distanceToRings(centre, gov.rings);
      if (d < distance) {
        distance = d;
        best = gov.code;
      }
    }
    return { code: best, parVote: false };
  }

  /* — Niveau 1 : les gouvernorats — */

  const gouvernorats = [];
  let adm1In = 0;
  let adm1Out = 0;

  for (const f of adm1.features) {
    const code = f.properties.shapeISO;
    const names = NAMES[code];
    if (!names) throw new Error(`Gouvernorat inconnu : ${code}`);
    const shape = toPath(
      f.geometry,
      TOLERANCE.adm1,
      MIN_RING_AREA.adm1,
      code,
    );
    adm1In += shape.pointsIn;
    adm1Out += shape.pointsOut;
    gouvernorats.push({ code, region: REGIONS[code], nom: names, ...shape });
  }
  gouvernorats.sort((a, b) => a.code.localeCompare(b.code));

  /* — Niveau 2 : les délégations — */

  // Anneaux en degrés : rattacher un nom OSM à sa délégation se fait sur les
  // coordonnées brutes, celles que renvoie Overpass.
  const adm2Rings = adm2.features.map((f) => ringsOf(f.geometry));

  /** Les noms OSM, rattachés à une délégation par leur centre. */
  const nomsOsm = new Array(adm2.features.length).fill(null);
  let osmPlaces = 0;

  // « معتمدية X » et « Délégation X » : le mot « délégation » est déjà dans
  // l'intitulé de la colonne, pas la peine de le répéter 264 fois.
  const nomsDe = (el) => {
    const ar = (el.tags["name:ar"] ?? el.tags.name ?? "")
      .replace(/^معتمدية\s+/, "")
      .trim();
    const fr = (el.tags["name:fr"] ?? el.tags.name ?? "")
      .replace(/^D[eé]l[eé]gation\s+/i, "")
      .trim();
    return ar || fr ? { ar, fr, en: el.tags["name:en"]?.trim() || fr } : null;
  };

  /**
   * Premier passage : appartenance stricte.
   *
   * Les deux relevés ne datent pas du même jour et OSM a parfois découpé une
   * délégation que geoBoundaries garde entière — deux centres OSM tombent
   * alors dans le même polygone. Le second est mis de côté, **pas** recollé
   * ailleurs : inventer une délégation « Smâr » dans Médenine parce qu'un
   * polygone anonyme traînait à côté serait pire que de ne rien nommer.
   */
  const dehors = [];
  let doublons = 0;
  for (const el of osm.elements) {
    if (!el.center) continue;
    const noms = nomsDe(el);
    if (!noms) continue;
    const point = [el.center.lon, el.center.lat];
    const index = adm2Rings.findIndex((rings) => pointInRings(point, rings));
    if (index === -1) {
      dehors.push({ point, noms });
      continue;
    }
    if (nomsOsm[index]) {
      doublons += 1;
      continue;
    }
    nomsOsm[index] = noms;
    osmPlaces += 1;
  }

  /*
   * Second passage, réservé aux centres tombés hors de tout polygone : le
   * centre d'une relation en croissant peut sortir de sa propre enveloppe.
   * Recollage au polygone encore anonyme le plus proche, et seulement s'il
   * touche presque (≈ 10 km) — au-delà ce n'est plus un arrondi, c'est un
   * autre lieu.
   */
  const SEUIL_RECOLLAGE = 0.1; // degrés
  for (const { point, noms } of dehors) {
    let best = Infinity;
    let cible = -1;
    adm2Rings.forEach((rings, index) => {
      if (nomsOsm[index]) return;
      const d = distanceToRings(point, rings);
      if (d < best) {
        best = d;
        cible = index;
      }
    });
    if (cible !== -1 && best <= SEUIL_RECOLLAGE) {
      nomsOsm[cible] = noms;
      osmPlaces += 1;
    }
  }

  /*
   * Troisième passage, purement lexical. Les polygones encore anonymes portent
   * déjà un libellé arabe chez geoBoundaries — il ne manque que la
   * translittération. On la cherche dans OSM par le nom arabe : aucune
   * géométrie n'entre en jeu, donc aucun risque de déplacer une délégation,
   * seulement celui de recopier un intitulé déjà utilisé ailleurs.
   */
  const parNomArabe = new Map();
  for (const el of osm.elements) {
    const noms = nomsDe(el);
    if (!noms?.ar) continue;
    const key = arabicKey(noms.ar);
    if (key && !parNomArabe.has(key)) parNomArabe.set(key, noms);
  }

  let parNom = 0;
  adm2.features.forEach((f, index) => {
    if (nomsOsm[index]) return;
    const key = arabicKey(f.properties.shapeName);
    const trouve = key ? parNomArabe.get(key) : undefined;
    if (!trouve) return;
    // Le tracé reste celui de geoBoundaries ; on n'emprunte que les libellés.
    nomsOsm[index] = trouve;
    parNom += 1;
  });

  const delegations = [];
  let adm2In = 0;
  let adm2Out = 0;
  let sansNomOsm = 0;
  let parDistance = 0;
  let corrections = 0;

  adm2.features.forEach((f, index) => {
    const brut = f.properties.shapeName?.trim() ?? `Délégation ${index}`;
    const noms = nomsOsm[index];
    if (!noms) sansNomOsm += 1;

    const shape = toPath(f.geometry, TOLERANCE.adm2, MIN_RING_AREA.adm2, brut);
    adm2In += shape.pointsIn;
    adm2Out += shape.pointsOut;

    // geoBoundaries ne porte aucun lien de parenté ; la géométrie le sait.
    const nomFr = noms?.fr ?? brut;
    const corrige = PARENT_CORRIGE[nomFr];
    const parent = corrige
      ? { code: corrige, parVote: true }
      : parentDe(shape.rings, shape.bbox, gouvernorats);
    if (!parent.parVote) parDistance += 1;
    if (corrige) corrections += 1;

    delegations.push({
      gouvernorat: parent.code,
      nom: noms ?? { fr: brut, en: brut, ar: brut },
      d: shape.d,
      bbox: shape.bbox,
      labelX: shape.labelX,
      labelY: shape.labelY,
    });
  });

  // Codes lisibles et stables : gouvernorat + nom francisé. Le suffixe ne
  // sert qu'aux rares homonymes au sein d'un même gouvernorat.
  const vus = new Map();
  for (const d of delegations) {
    const base = `${d.gouvernorat}:${slug(d.nom.fr || d.nom.ar)}`;
    const n = (vus.get(base) ?? 0) + 1;
    vus.set(base, n);
    d.code = n === 1 ? base : `${base}-${n}`;
  }
  delegations.sort((a, b) => a.code.localeCompare(b.code));

  /* — Écriture — */

  const shapesFile = `/**
 * GÉNÉRÉ — ne pas modifier à la main. Régénérer avec :
 *   node scripts/build-tunisia-map.mjs
 *
 * Les 24 gouvernorats tunisiens, projetés en Mercator et cadrés sur la bbox
 * du pays, donc directement utilisables comme chemins SVG. La même projection
 * est exposée par \`projectLatLng\` dans ./tunisia — un point (lat, lng) et un
 * gouvernorat partagent forcément le même repère.
 *
 * Frontières : geoBoundaries gbOpen TUN ADM1, dérivé d'OpenStreetMap,
 * sous licence ODbL 1.0.
 */

import type { RegionCode } from "./tunisia-regions";

export interface Gouvernorat {
  /** ISO 3166-2, ex. \`TN-11\`. */
  code: GouvernoratCode;
  /** Regroupement commercial : Grand Tunis, Sahel… */
  region: RegionCode;
  nom: { fr: string; en: string; ar: string };
  /** Chemin SVG dans le repère \`TUNISIA_VIEWBOX\`. */
  d: string;
  /** Centroïde du plus grand anneau — où poser l'étiquette. */
  labelX: number;
  labelY: number;
  /** \`[x0, y0, x1, y1]\` — de quoi cadrer le zoom sur le gouvernorat. */
  bbox: readonly [number, number, number, number];
}

/** Bornes géographiques ayant servi au cadrage. */
export const TUNISIA_BOUNDS = {
  minLng: ${minLng},
  maxLng: ${maxLng},
  minLat: ${minLat},
  maxLat: ${maxLat},
} as const;

/** Constantes de la projection Mercator, partagées avec \`projectLatLng\`. */
export const TUNISIA_PROJECTION = {
  xScale: ${xScale},
  scale: ${scale},
  yTop: ${yTop},
} as const;

export const TUNISIA_VIEWBOX = {
  width: ${round(width)},
  height: ${HEIGHT},
} as const;

export type GouvernoratCode =
${gouvernorats.map((s) => `  | "${s.code}"`).join("\n")};

export const GOUVERNORATS: readonly Gouvernorat[] = [
${gouvernorats
  .map(
    (s) => `  {
    code: "${s.code}",
    region: "${s.region}",
    nom: { fr: "${s.nom.fr}", en: "${s.nom.en}", ar: "${s.nom.ar}" },
    labelX: ${s.labelX},
    labelY: ${s.labelY},
    bbox: [${s.bbox.join(", ")}],
    d: "${s.d}",
  },`,
  )
  .join("\n")}
];
`;

  const delegationsFile = `/**
 * GÉNÉRÉ — ne pas modifier à la main. Régénérer avec :
 *   node scripts/build-tunisia-map.mjs
 *
 * Les ${delegations.length} délégations — المُعتمدية — dans le même repère SVG que les
 * gouvernorats de ./tunisia-shapes.
 *
 * Ce module pèse une bonne centaine de kilooctets et ne doit **pas** être
 * importé statiquement par un composant de page : la vue « pays » n'affiche
 * que les gouvernorats. La carte le charge par \`import()\` la première fois
 * qu'une zone plus fine est demandée.
 *
 * Frontières : geoBoundaries gbOpen TUN ADM2 · Noms : OpenStreetMap
 * (relations admin_level=5), rattachés par géométrie. Les deux sous ODbL 1.0.
 */

import type { GouvernoratCode } from "./tunisia-shapes";

export interface Delegation {
  /** Gouvernorat + nom francisé, ex. \`TN-61:sfax-sud\`. */
  code: string;
  gouvernorat: GouvernoratCode;
  nom: { fr: string; en: string; ar: string };
  /** Chemin SVG dans le repère \`TUNISIA_VIEWBOX\`. */
  d: string;
  labelX: number;
  labelY: number;
  bbox: readonly [number, number, number, number];
}

export const DELEGATIONS: readonly Delegation[] = [
${delegations
  .map(
    (s) => `  {
    code: "${s.code}",
    gouvernorat: "${s.gouvernorat}",
    nom: { fr: ${JSON.stringify(s.nom.fr)}, en: ${JSON.stringify(s.nom.en)}, ar: ${JSON.stringify(s.nom.ar)} },
    labelX: ${s.labelX},
    labelY: ${s.labelY},
    bbox: [${s.bbox.join(", ")}],
    d: "${s.d}",
  },`,
  )
  .join("\n")}
];

/** Les délégations d'un gouvernorat, dans l'ordre des codes. */
export function delegationsDe(
  gouvernorat: GouvernoratCode,
): readonly Delegation[] {
  return DELEGATIONS.filter((d) => d.gouvernorat === gouvernorat);
}
`;

  for (const [file, content] of [
    [OUT_SHAPES, shapesFile],
    [OUT_DELEGATIONS, delegationsFile],
  ]) {
    const out = path.join(process.cwd(), file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, content, "utf8");
    const kb = (fs.statSync(out).size / 1024).toFixed(1);
    console.log(`✓ ${file} — ${kb} ko`);
  }

  console.log(
    `  gouvernorats : ${gouvernorats.length} · ${adm1In} → ${adm1Out} points`,
  );
  console.log(
    `  délégations  : ${delegations.length} · ${adm2In} → ${adm2Out} points`,
  );
  console.log(`  noms OSM rattachés : ${osmPlaces}/${delegations.length}`);
  if (doublons > 0) {
    console.log(
      `  ${doublons} relation(s) OSM tombée(s) dans un polygone déjà nommé — ignorée(s)`,
    );
  }
  if (parNom > 0) {
    console.log(`  ${parNom} libellé(s) retrouvé(s) par le nom arabe`);
  }
  if (sansNomOsm > 0) {
    console.log(
      `  ⚠ ${sansNomOsm} délégation(s) sans nom OSM — libellé geoBoundaries conservé`,
    );
  }
  if (parDistance > 0) {
    console.log(
      `  ${parDistance} délégation(s) rattachée(s) au gouvernorat le plus proche`,
    );
  }
  if (corrections > 0) {
    console.log(`  ${corrections} rattachement(s) corrigé(s) à la main`);
  }

  /*
   * Deux polygones sous le même nom : geoBoundaries découpe là où OSM ne
   * découpe pas. C'est visible dans un menu déroulant, donc c'est dit ici
   * plutôt que découvert à l'écran. Les codes, eux, restent distincts.
   */
  const homonymes = [...vus.entries()].filter(([, n]) => n > 1);
  if (homonymes.length > 0) {
    console.log(
      `  ⚠ ${homonymes.length} nom(s) porté(s) par deux tracés : ${homonymes
        .map(([base]) => base)
        .join(", ")}`,
    );
  }
  console.log(`  viewBox 0 0 ${round(width)} ${HEIGHT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
