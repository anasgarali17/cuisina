"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { Minus, Plus, Scan } from "lucide-react";
import { cn } from "@/lib/utils";
import { LAYER_STYLE } from "@/lib/carte-ui";
import { CARTE_LAYERS, type LayerKey, type Marker } from "@/lib/geo/reseau";
import {
  GOUVERNORATS,
  TUNISIA_VIEWBOX,
  type GouvernoratCode,
} from "@/lib/geo/tunisia-shapes";
import type { Delegation } from "@/lib/geo/tunisia-delegations";
import type { RegionCode } from "@/lib/geo/tunisia-regions";

/** Ce que la carte cadre : le pays, une région, un gouvernorat, une délégation. */
export type Selection =
  | { kind: "pays" }
  | { kind: "region"; region: RegionCode }
  | { kind: "gouvernorat"; code: GouvernoratCode }
  | { kind: "delegation"; code: string; gouvernorat: GouvernoratCode };

/** Le rectangle visible, en unités SVG. */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TunisiaMapProps {
  /** Déjà filtrées sur les couches actives par l'appelant. */
  markers: Marker[];
  activeLayers: readonly LayerKey[];
  selection: Selection;
  onPickGouvernorat: (code: GouvernoratCode) => void;
  onPickDelegation: (code: string, gouvernorat: GouvernoratCode) => void;
  /** Les tracés des délégations, ou `null` tant qu'ils se chargent. */
  delegations: readonly Delegation[] | null;
  labels: {
    carte: string;
    parLayer: Record<LayerKey, string>;
    vide: string;
  };
  className?: string;
}

/** Marge autour du cadrage, en proportion de la zone. */
const PADDING_RATIO = 0.06;
const PADDING_MIN = 3;

/** Bornes du zoom, en facteur d'agrandissement par rapport à la vue « pays ». */
const ZOOM_MIN = 0.9;
const ZOOM_MAX = 60;

/** Au-delà de ce facteur, les délégations valent la peine d'être tracées. */
const SEUIL_DELEGATIONS = 1.8;

/** Durée du recadrage automatique, en millisecondes. */
const DUREE_RECADRAGE = 480;

/**
 * Rayon d'une punaise, **en pixels écran**. Racine carrée du nombre : c'est
 * l'aire du disque qui doit suivre le compte, pas son rayon.
 *
 * Tout ce qui n'est pas de la géographie est dimensionné en pixels puis
 * converti en unités SVG (voir `upx`). Une taille exprimée en unités SVG
 * dépendrait du cadrage : la même étiquette ferait 11 px sur un écran large et
 * 3 px sur la vue pays — c'est exactement le piège dans lequel on est tombé.
 */
function radiusPx(count: number): number {
  return Math.min(19, 5 + Math.sqrt(Math.max(0, count - 1)) * 3.1);
}

const VUE_PAYS: Rect = {
  x: 0,
  y: 0,
  w: TUNISIA_VIEWBOX.width,
  h: TUNISIA_VIEWBOX.height,
};

/** Le rectangle englobant d'un jeu de bbox, avec sa marge. */
function englobe(
  boxes: ReadonlyArray<readonly [number, number, number, number]>,
): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [bx0, by0, bx1, by1] of boxes) {
    if (bx0 < x0) x0 = bx0;
    if (by0 < y0) y0 = by0;
    if (bx1 > x1) x1 = bx1;
    if (by1 > y1) y1 = by1;
  }
  const marge = Math.max(
    PADDING_MIN,
    (x1 - x0) * PADDING_RATIO,
    (y1 - y0) * PADDING_RATIO,
  );
  return {
    x: x0 - marge,
    y: y0 - marge,
    w: x1 - x0 + marge * 2,
    h: y1 - y0 + marge * 2,
  };
}

/**
 * Étire un rectangle jusqu'au format du cadre, sans jamais le rogner : une
 * carte déformée ne vaut rien, et une zone à moitié coupée non plus.
 */
function auFormat(rect: Rect, aspect: number): Rect {
  const courant = rect.w / rect.h;
  if (Math.abs(courant - aspect) < 0.001) return rect;
  if (courant < aspect) {
    const w = rect.h * aspect;
    return { x: rect.x - (w - rect.w) / 2, y: rect.y, w, h: rect.h };
  }
  const h = rect.w / aspect;
  return { x: rect.x, y: rect.y - (h - rect.h) / 2, w: rect.w, h };
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

interface Hover {
  left: number;
  top: number;
  titre: string;
  lignes: string[];
  couleur: string | null;
}

export function TunisiaMap({
  markers,
  activeLayers,
  selection,
  onPickGouvernorat,
  onPickDelegation,
  delegations,
  labels,
  className,
}: TunisiaMapProps) {
  const t = useTranslations();
  const locale = useLocale() as "fr" | "en" | "ar";
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  /**
   * Taille du cadre, mesurée. Le format sert au cadrage — la carte doit remplir
   * la place disponible — et la largeur en pixels sert à convertir les tailles
   * d'écran en unités SVG.
   */
  const [cadre, setCadre] = useState<{ width: number; height: number }>({
    width: TUNISIA_VIEWBOX.width,
    height: TUNISIA_VIEWBOX.height,
  });
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setCadre({ width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const aspect = cadre.width / cadre.height;

  /* — Le cadrage visé par la sélection — */

  const cible = useMemo<Rect>(() => {
    let boxes: ReadonlyArray<readonly [number, number, number, number]> = [];
    if (selection.kind === "region") {
      boxes = GOUVERNORATS.filter((g) => g.region === selection.region).map(
        (g) => g.bbox,
      );
    } else if (selection.kind === "gouvernorat") {
      const gov = GOUVERNORATS.find((g) => g.code === selection.code);
      boxes = gov ? [gov.bbox] : [];
    } else if (selection.kind === "delegation") {
      const del = delegations?.find((d) => d.code === selection.code);
      // Tant que les tracés ne sont pas là, on cadre le gouvernorat parent.
      const gov = GOUVERNORATS.find((g) => g.code === selection.gouvernorat);
      boxes = del ? [del.bbox] : gov ? [gov.bbox] : [];
    }
    return auFormat(boxes.length > 0 ? englobe(boxes) : VUE_PAYS, aspect);
  }, [selection, aspect, delegations]);

  /* — Le cadrage réellement affiché : la cible, ou ce que l'utilisateur a
       fabriqué à la molette et à la souris — */

  const [vue, setVue] = useState<Rect>(cible);
  const vueRef = useRef(vue);
  useEffect(() => {
    vueRef.current = vue;
  }, [vue]);
  const animation = useRef<number | null>(null);

  const anime = useCallback((vers: Rect) => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    const depuis = vueRef.current;
    const t0 = performance.now();
    const pas = (now: number) => {
      const k = easeOut(Math.min(1, (now - t0) / DUREE_RECADRAGE));
      setVue({
        x: depuis.x + (vers.x - depuis.x) * k,
        y: depuis.y + (vers.y - depuis.y) * k,
        w: depuis.w + (vers.w - depuis.w) * k,
        h: depuis.h + (vers.h - depuis.h) * k,
      });
      if (k < 1) animation.current = requestAnimationFrame(pas);
      else animation.current = null;
    };
    animation.current = requestAnimationFrame(pas);
  }, []);

  /* La sélection change → on y va en glissant. Le format du cadre change
     (fenêtre redimensionnée) → on s'y adapte sèchement, sans animer un
     événement que l'utilisateur n'a pas déclenché sur la carte. */
  const cibleRef = useRef(cible);
  useEffect(() => {
    const precedent = cibleRef.current;
    cibleRef.current = cible;
    const memeZone =
      Math.abs(precedent.x - cible.x) < 0.5 &&
      Math.abs(precedent.y - cible.y) < 0.5 &&
      Math.abs(precedent.w - cible.w) < 0.5;
    if (memeZone) setVue(cible);
    else anime(cible);
  }, [cible, anime]);

  useEffect(
    () => () => {
      if (animation.current !== null) cancelAnimationFrame(animation.current);
    },
    [],
  );

  /** Facteur d'agrandissement courant, par rapport à la vue « pays ». */
  const zoom = auFormat(VUE_PAYS, aspect).w / vue.w;

  /** Recadre en gardant un point fixe à l'écran — la molette zoome « là ». */
  const zoomeVers = useCallback(
    (facteur: number, ancre?: { x: number; y: number }) => {
      if (animation.current !== null) {
        cancelAnimationFrame(animation.current);
        animation.current = null;
      }
      const courant = vueRef.current;
      const plein = auFormat(VUE_PAYS, aspect);
      const zoomCourant = plein.w / courant.w;
      const vise = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, zoomCourant * facteur),
      );
      const w = plein.w / vise;
      const h = plein.h / vise;
      const fixe = ancre ?? {
        x: courant.x + courant.w / 2,
        y: courant.y + courant.h / 2,
      };
      // La position relative de l'ancre dans le cadre est préservée.
      const rx = (fixe.x - courant.x) / courant.w;
      const ry = (fixe.y - courant.y) / courant.h;
      setVue({ x: fixe.x - rx * w, y: fixe.y - ry * h, w, h });
    },
    [aspect],
  );

  /** Coordonnées SVG d'un événement souris. */
  const enSvg = useCallback(
    (clientX: number, clientY: number) => {
      const box = containerRef.current?.getBoundingClientRect();
      const courant = vueRef.current;
      if (!box) return { x: courant.x, y: courant.y };
      return {
        x: courant.x + ((clientX - box.left) / box.width) * courant.w,
        y: courant.y + ((clientY - box.top) / box.height) * courant.h,
      };
    },
    [],
  );

  /* La molette : `passive: false` posé à la main, sinon Chrome refuse le
     preventDefault et la page défile sous la carte. */
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const facteur = Math.exp(-event.deltaY * 0.0015);
      zoomeVers(facteur, enSvg(event.clientX, event.clientY));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [zoomeVers, enSvg]);

  /* — Le glisser-déplacer — */

  const drag = useRef<{
    pointer: number;
    clientX: number;
    clientY: number;
    depart: Rect;
    deplace: boolean;
  } | null>(null);
  const [glisse, setGlisse] = useState(false);

  /**
   * Vrai entre la fin d'un glisser et le `click` que le navigateur émet quand
   * même au relâchement : ce clic-là ne doit pas sélectionner un gouvernorat.
   */
  const vientDeGlisser = useRef(false);

  function onPointerDown(event: React.PointerEvent) {
    if (event.button !== 0) return;
    vientDeGlisser.current = false;
    drag.current = {
      pointer: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      depart: vueRef.current,
      deplace: false,
    };
    /* Pas de capture du pointeur ici : capturer retargette aussi le `click`
       final vers le conteneur, et les gouvernorats ne recevraient plus jamais
       le leur. La capture n'a d'intérêt qu'une fois le glisser avéré. */
  }

  function onPointerMove(event: React.PointerEvent) {
    const état = drag.current;
    if (!état || état.pointer !== event.pointerId) return;
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    const dx = event.clientX - état.clientX;
    const dy = event.clientY - état.clientY;
    // Quelques pixels de tolérance : un clic tremblant reste un clic.
    if (!état.deplace && Math.hypot(dx, dy) < 4) return;
    if (!état.deplace) {
      état.deplace = true;
      setGlisse(true);
      setHover(null);
      // La souris peut maintenant sortir du cadre sans casser le glisser.
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      if (animation.current !== null) {
        cancelAnimationFrame(animation.current);
        animation.current = null;
      }
    }
    const courant = vueRef.current;
    setVue({
      x: état.depart.x - (dx / box.width) * courant.w,
      y: état.depart.y - (dy / box.height) * courant.h,
      w: courant.w,
      h: courant.h,
    });
  }

  function onPointerUp(event: React.PointerEvent) {
    const état = drag.current;
    if (état?.pointer === event.pointerId) {
      vientDeGlisser.current = état.deplace;
      drag.current = null;
      setGlisse(false);
    }
  }

  /** Un clic n'est un clic que si la souris n'a pas voyagé entre-temps. */
  const aGlisse = () =>
    drag.current?.deplace === true || vientDeGlisser.current;

  /* — Ce qui est visible, et ce qui est en avant — */

  const enAvant = useMemo<Set<GouvernoratCode> | null>(() => {
    if (selection.kind === "pays") return null;
    if (selection.kind === "gouvernorat") return new Set([selection.code]);
    if (selection.kind === "delegation") return new Set([selection.gouvernorat]);
    return new Set(
      GOUVERNORATS.filter((g) => g.region === selection.region).map(
        (g) => g.code,
      ),
    );
  }, [selection]);

  /**
   * Les délégations s'affichent dès qu'on descend sous la région, ou dès que le
   * zoom manuel devient assez serré. Au niveau du pays, 264 tracés seraient
   * illisibles autant que coûteux.
   */
  const montreDelegations =
    delegations !== null &&
    (selection.kind === "gouvernorat" ||
      selection.kind === "delegation" ||
      selection.kind === "region" ||
      zoom >= SEUIL_DELEGATIONS);

  /** Ne dessiner que les délégations qui croisent le cadre. */
  const delegationsVisibles = useMemo(() => {
    if (!montreDelegations || !delegations) return [];
    return delegations.filter(
      (d) =>
        d.bbox[0] <= vue.x + vue.w &&
        d.bbox[2] >= vue.x &&
        d.bbox[1] <= vue.y + vue.h &&
        d.bbox[3] >= vue.y,
    );
  }, [montreDelegations, delegations, vue]);

  /* — Aplats graduès par gouvernorat — */

  const parGouvernorat = useMemo(() => {
    const total = new Map<GouvernoratCode, number>();
    const detail = new Map<GouvernoratCode, Record<LayerKey, number>>();
    for (const m of markers) {
      total.set(m.gouvernorat, (total.get(m.gouvernorat) ?? 0) + m.count);
      let row = detail.get(m.gouvernorat);
      if (!row) {
        row = { showrooms: 0, clients: 0, prospects: 0, fournisseurs: 0 };
        detail.set(m.gouvernorat, row);
      }
      row[m.layer] += m.count;
    }
    return { total, detail };
  }, [markers]);

  const maxParGouvernorat = Math.max(1, ...parGouvernorat.total.values());

  /** Combien de punaises par délégation — pour l'infobulle et l'aplat. */
  const parDelegation = useMemo(() => {
    const total = new Map<string, number>();
    for (const m of markers) {
      if (!m.delegation) continue;
      total.set(m.delegation, (total.get(m.delegation) ?? 0) + m.count);
    }
    return total;
  }, [markers]);

  const maxParDelegation = Math.max(1, ...parDelegation.values());

  /**
   * Les punaises coïncidentes sont écartées en rosette autour du point réel :
   * le showroom de Sfax, le client de Sfax et le prospect de Sfax tombent sur
   * le même point, et empilés il n'en resterait qu'un de visible.
   *
   * L'ordre de dessin finit le travail : les gros disques d'abord, les
   * showrooms toujours en dernier — c'est l'enseigne qu'on cherche d'abord.
   */
  const punaises = useMemo(() => {
    const groupes = new Map<string, Marker[]>();
    for (const m of markers) {
      const key = `${m.x.toFixed(1)},${m.y.toFixed(1)}`;
      const groupe = groupes.get(key);
      if (groupe) groupe.push(m);
      else groupes.set(key, [m]);
    }

    const placees: Array<{
      marker: Marker;
      angle: number | null;
      ecart: number;
    }> = [];

    for (const groupe of groupes.values()) {
      if (groupe.length === 1) {
        placees.push({ marker: groupe[0], angle: null, ecart: 0 });
        continue;
      }
      const pas = (Math.PI * 2) / groupe.length;
      const ecart = Math.max(...groupe.map((m) => radiusPx(m.count))) * 0.8;
      groupe.forEach((marker, i) => {
        placees.push({ marker, angle: -Math.PI / 2 + i * pas, ecart });
      });
    }

    return placees.sort(
      (a, b) =>
        (a.marker.layer === "showrooms" ? 1 : 0) -
          (b.marker.layer === "showrooms" ? 1 : 0) ||
        b.marker.count - a.marker.count,
    );
  }, [markers]);

  /**
   * Unités SVG par pixel écran. Multiplier une taille en pixels par `upx`
   * donne la valeur à écrire dans le SVG, quel que soit le zoom ou la taille
   * du cadre. Traits, punaises et étiquettes gardent donc exactement la même
   * taille apparente du pays à la délégation.
   */
  const upx = vue.w / Math.max(1, cadre.width);

  function moveHover(
    event: React.MouseEvent,
    titre: string,
    lignes: string[],
    couleur: string | null,
  ) {
    if (aGlisse()) return;
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    setHover({
      left: ((event.clientX - box.left) / box.width) * 100,
      top: ((event.clientY - box.top) / box.height) * 100,
      titre,
      lignes,
      couleur,
    });
  }

  function gouvernoratLignes(code: GouvernoratCode): string[] {
    const row = parGouvernorat.detail.get(code);
    if (!row) return [labels.vide];
    const lignes: string[] = [];
    for (const layer of CARTE_LAYERS) {
      if (!activeLayers.includes(layer) || row[layer] === 0) continue;
      lignes.push(`${row[layer]} · ${labels.parLayer[layer]}`);
    }
    return lignes.length > 0 ? lignes : [labels.vide];
  }

  return (
    <div className={cn("relative", className)}>
      <div
        ref={containerRef}
        className={cn(
          "h-full w-full touch-none overscroll-none",
          glisse ? "cursor-grabbing" : "cursor-grab",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox={`${vue.x} ${vue.y} ${vue.w} ${vue.h}`}
          className="h-full w-full"
          role="img"
          aria-label={labels.carte}
        >
          {GOUVERNORATS.map((gov) => {
            const count = parGouvernorat.total.get(gov.code) ?? 0;
            /* Aplat gradué : la teinte dit « il y a du monde ici » avant même
               qu'on lise les punaises. Il s'efface quand les délégations
               prennent le relais — la couleur appartient au découpage qu'on
               regarde, sinon le gouvernorat noie ses propres subdivisions. */
            const intensite =
              count === 0
                ? 0
                : (0.06 + (count / maxParGouvernorat) * 0.34) *
                  (montreDelegations ? 0.3 : 1);
            const dimmed = enAvant !== null && !enAvant.has(gov.code);
            const choisi =
              selection.kind === "gouvernorat" && selection.code === gov.code;
            return (
              /* Cliquable à la souris seulement, et volontairement : le même
                 choix se fait au clavier dans les sélecteurs de zone, juste
                 au-dessus. Vingt-quatre tabulations de plus n'aideraient
                 personne. */
              <path
                key={gov.code}
                d={gov.d}
                onClick={() => {
                  if (!aGlisse()) onPickGouvernorat(gov.code);
                }}
                onMouseMove={(e) =>
                  moveHover(
                    e,
                    gov.nom[locale] ?? gov.nom.fr,
                    gouvernoratLignes(gov.code),
                    null,
                  )
                }
                className="transition-opacity"
                style={{
                  opacity: dimmed ? 0.3 : 1,
                  fill: `color-mix(in srgb, var(--rouge-cuisina) ${(intensite * 100).toFixed(1)}%, var(--card))`,
                  stroke: choisi
                    ? "var(--rouge-cuisina)"
                    : "color-mix(in srgb, var(--foreground) 22%, transparent)",
                  strokeWidth: (choisi ? 2.2 : 1) * upx,
                  strokeLinejoin: "round",
                }}
              />
            );
          })}

          {/* Les délégations par-dessus les gouvernorats. C'est à elles que
              revient l'aplat gradué dès qu'elles sont visibles. */}
          {delegationsVisibles.map((del) => {
            const dimmed = enAvant !== null && !enAvant.has(del.gouvernorat);
            const choisie =
              selection.kind === "delegation" && selection.code === del.code;
            const count = parDelegation.get(del.code) ?? 0;
            const intensite =
              count === 0 ? 0 : 0.1 + (count / maxParDelegation) * 0.4;
            return (
              <path
                key={del.code}
                d={del.d}
                onClick={() => {
                  if (!aGlisse()) onPickDelegation(del.code, del.gouvernorat);
                }}
                onMouseMove={(e) =>
                  moveHover(
                    e,
                    del.nom[locale] ?? del.nom.fr,
                    [
                      GOUVERNORATS.find((g) => g.code === del.gouvernorat)?.nom[
                        locale
                      ] ?? "",
                      count > 0
                        ? t("carte.nPunaises", { count })
                        : labels.vide,
                    ].filter(Boolean),
                    null,
                  )
                }
                style={{
                  opacity: dimmed ? 0.25 : 1,
                  fill: choisie
                    ? "color-mix(in srgb, var(--rouge-cuisina) 26%, var(--card))"
                    : `color-mix(in srgb, var(--rouge-cuisina) ${(intensite * 100).toFixed(1)}%, transparent)`,
                  stroke: choisie
                    ? "var(--rouge-cuisina)"
                    : "color-mix(in srgb, var(--foreground) 30%, transparent)",
                  strokeWidth: (choisie ? 2 : 0.7) * upx,
                  strokeLinejoin: "round",
                }}
              />
            );
          })}

          {/* Le nom des délégations, seulement quand il y a la place : au-delà
              d'une vingtaine de tracés à l'écran, les libellés se chevauchent
              et ne renseignent plus personne. */}
          {delegationsVisibles.length <= 24 &&
            delegationsVisibles.map((del) => (
              <text
                key={`label-${del.code}`}
                x={del.labelX}
                y={del.labelY}
                textAnchor="middle"
                dominantBaseline="central"
                fill="color-mix(in srgb, var(--foreground) 70%, transparent)"
                stroke="var(--card)"
                strokeWidth={2.5 * upx}
                paintOrder="stroke"
                style={{
                  fontSize: 11 * upx,
                  fontWeight: 500,
                  pointerEvents: "none",
                }}
              >
                {del.nom[locale] ?? del.nom.fr}
              </text>
            ))}

          {punaises.map(({ marker: m, angle, ecart }) => {
            const style = LAYER_STYLE[m.layer];
            const r = radiusPx(m.count) * upx;
            const cx =
              angle === null ? m.x : m.x + Math.cos(angle) * ecart * upx;
            const cy =
              angle === null ? m.y : m.y + Math.sin(angle) * ecart * upx;
            const dimmed = enAvant !== null && !enAvant.has(m.gouvernorat);
            const lignes = [m.ville];
            lignes.push(
              m.count > 1
                ? `${m.count} · ${labels.parLayer[m.layer]}`
                : labels.parLayer[m.layer],
            );
            return (
              <g
                key={m.id}
                style={{ opacity: dimmed ? 0.22 : 1 }}
                className="transition-opacity"
                onMouseMove={(e) => moveHover(e, m.nom, lignes, style.couleur)}
              >
                {/* Halo : détache la punaise de l'aplat sans cerner au trait,
                    qui deviendrait un anneau épais au zoom. */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r * 1.9}
                  fill={style.couleur}
                  opacity={0.16}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={style.couleur}
                  stroke="var(--card)"
                  strokeWidth={r * 0.28}
                />
                {m.count > 1 && (
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="var(--card)"
                    style={{
                      fontSize: r * 1.05,
                      fontWeight: 700,
                      pointerEvents: "none",
                    }}
                  >
                    {m.count}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* — La commande de zoom — */}
      <div className="absolute end-3 top-3 flex flex-col overflow-hidden rounded-xl border border-border bg-card/90 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={() => zoomeVers(1.6)}
          aria-label={t("carte.zoomPlus")}
          className="p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomeVers(1 / 1.6)}
          aria-label={t("carte.zoomMoins")}
          className="border-t border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => anime(cible)}
          aria-label={t("carte.recadrer")}
          className="border-t border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Scan className="size-4" />
        </button>
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-56 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-xl border border-border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur-sm"
          style={{ left: `${hover.left}%`, top: `${hover.top}%` }}
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            {hover.couleur && (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: hover.couleur }}
              />
            )}
            {hover.titre}
          </p>
          {hover.lignes.map((ligne) => (
            <p key={ligne} className="text-[11px] text-muted-foreground">
              {ligne}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
