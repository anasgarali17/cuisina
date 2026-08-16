"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AppWindow,
  ArrowLeftRight,
  Check,
  Columns3,
  Compass,
  DoorClosed,
  DoorOpen,
  Eraser,
  FlipHorizontal,
  Hand,
  Maximize2,
  Minimize2,
  Minus,
  Pencil,
  RectangleHorizontal,
  RotateCcw,
  Square,
  Trash2,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { saveCroquis } from "@/lib/actions/fiche-actions";
import {
  CROQUIS_H,
  CROQUIS_W,
  croquisSchema,
  type Croquis,
  type CroquisShape,
} from "@/lib/schemas/fiche";
import { cn, messageErreur } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Tool =
  | "trait"
  | "rectangle"
  | "ligne"
  | "porte_simple"
  | "porte_double"
  | "coulissante"
  | "fenetre_simple"
  | "fenetre_double"
  | "baie_vitree"
  | "nord"
  | "texte"
  | "gomme"
  | "main";

/**
 * Chaque bouton du panneau pose un symbole distinct, mais le canevas n'en
 * connaît que deux familles (`porte`, `fenetre`) déclinées par `variante` —
 * la géométrie de pose (tirer un segment le long du mur) est la même, seul
 * le rendu change. `nord` est à part : un repère qu'on pose d'un clic.
 */
const TOOL_SHAPE: Partial<
  Record<Tool, { type: "porte"; variante: "simple" | "double" | "coulissante" } | { type: "fenetre"; variante: "simple" | "double" | "baie" }>
> = {
  porte_simple: { type: "porte", variante: "simple" },
  porte_double: { type: "porte", variante: "double" },
  coulissante: { type: "porte", variante: "coulissante" },
  fenetre_simple: { type: "fenetre", variante: "simple" },
  fenetre_double: { type: "fenetre", variante: "double" },
  baie_vitree: { type: "fenetre", variante: "baie" },
};

/** Quick presets — brand colors first, plus a full spectrum picker beside them. */
const PRESETS = [
  "#0a0a0a",
  "#c1121f",
  "#b98b54",
  "#2563eb",
  "#059669",
  "#d08a2c",
  "#475569",
  "#ffffff",
] as const;

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** 1 = the whole sketch fits the frame; anything above is a zoom-in. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.5;
/** Backing store multiplier, so strokes stay crisp once zoomed in. */
const RES = 2;

interface EditorState {
  mode: "texte" | "cote";
  screenX: number;
  screenY: number;
  commit: (value: string) => void;
  cancel: () => void;
}

/** Zoom factor plus the sketch's offset inside the frame, in CSS pixels. */
interface View {
  z: number;
  tx: number;
  ty: number;
}

interface Size {
  w: number;
  h: number;
}

/** CSS pixels per logical unit when the sketch is fitted to the frame. */
function fitScale(size: Size) {
  if (!size.w || !size.h) return 0;
  return Math.min(size.w / CROQUIS_W, size.h / CROQUIS_H);
}

/** Keeps the zoom in range and the sketch from being dragged out of the frame. */
function clampView(v: View, size: Size): View {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z));
  const s = fitScale(size) * z;
  const cw = CROQUIS_W * s;
  const ch = CROQUIS_H * s;
  return {
    z,
    tx: cw <= size.w ? (size.w - cw) / 2 : Math.min(0, Math.max(size.w - cw, v.tx)),
    ty: ch <= size.h ? (size.h - ch) / 2 : Math.min(0, Math.max(size.h - ch, v.ty)),
  };
}

/** Where a pointer landed, in the canvas's logical 1000×700 space. */
function toLogical(
  e: React.PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * CROQUIS_W,
    y: ((e.clientY - r.top) / r.height) * CROQUIS_H,
  };
}

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * True when a click at (px,py) should be treated as hitting this shape.
 * `tol` comes from the current zoom, so a fingertip is as forgiving zoomed
 * out as a mouse is zoomed in.
 */
function hits(shape: CroquisShape, px: number, py: number, tol: number): boolean {
  switch (shape.type) {
    case "trait":
      return shape.points.some((p) => Math.hypot(p.x - px, p.y - py) < tol);
    case "rectangle": {
      const x1 = Math.min(shape.x, shape.x + shape.w);
      const x2 = Math.max(shape.x, shape.x + shape.w);
      const y1 = Math.min(shape.y, shape.y + shape.h);
      const y2 = Math.max(shape.y, shape.y + shape.h);
      const near =
        px > x1 - tol && px < x2 + tol && py > y1 - tol && py < y2 + tol;
      const inside =
        px > x1 + tol && px < x2 - tol && py > y1 + tol && py < y2 - tol;
      return near && !inside;
    }
    case "ligne":
    case "porte":
    case "fenetre":
      return (
        distanceToSegment(px, py, shape.x1, shape.y1, shape.x2, shape.y2) < tol
      );
    case "texte":
      return (
        Math.abs(shape.x - px) < 90 + tol && Math.abs(shape.y - py) < 22 + tol
      );
    case "nord":
      return Math.hypot(shape.x - px, shape.y - py) < 18 + tol;
  }
}

/** L'étiquette de cote, posée au milieu d'un segment sur fond blanc. */
function drawCote(
  ctx: CanvasRenderingContext2D,
  texte: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  couleur: string,
): void {
  if (!texte) return;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  ctx.font = "600 20px ui-sans-serif, system-ui, sans-serif";
  const w = ctx.measureText(texte).width;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(mx - w / 2 - 5, my - 22, w + 10, 24);
  ctx.fillStyle = couleur;
  ctx.textAlign = "center";
  ctx.fillText(texte, mx, my - 4);
  ctx.textAlign = "start";
}

function draw(ctx: CanvasRenderingContext2D, shapes: CroquisShape[]) {
  // Backing store is RES× the logical size — draw in logical units regardless.
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  ctx.clearRect(0, 0, CROQUIS_W, CROQUIS_H);

  // Graph paper, so a sketch reads as a measured plan.
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 1;
  for (let x = 0; x <= CROQUIS_W; x += 25) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CROQUIS_H);
    ctx.stroke();
  }
  for (let y = 0; y <= CROQUIS_H; y += 25) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CROQUIS_W, y);
    ctx.stroke();
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const s of shapes) {
    ctx.strokeStyle = s.couleur;
    ctx.fillStyle = s.couleur;
    if (s.type !== "texte" && s.type !== "nord") ctx.lineWidth = s.epaisseur;

    switch (s.type) {
      case "trait": {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (const p of s.points.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        break;
      }
      case "rectangle":
        ctx.strokeRect(s.x, s.y, s.w, s.h);
        break;
      case "ligne": {
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
        // Arrow ends, so a dimension reads as a dimension.
        const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
        for (const [ex, ey, dir] of [
          [s.x1, s.y1, a],
          [s.x2, s.y2, a + Math.PI],
        ] as const) {
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex + 12 * Math.cos(dir - 0.4), ey + 12 * Math.sin(dir - 0.4));
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex + 12 * Math.cos(dir + 0.4), ey + 12 * Math.sin(dir + 0.4));
          ctx.stroke();
        }
        drawCote(ctx, s.cote, s.x1, s.y1, s.x2, s.y2, s.couleur);
        break;
      }
      case "porte": {
        // Le symbole normalisé : l'ouverture dans le mur, un ou deux
        // battants, et leur arc de débattement — sauf la coulissante, qui
        // n'a pas de débattement puisqu'elle glisse dans le mur.
        const dx = s.x2 - s.x1;
        const dy = s.y2 - s.y1;
        const largeur = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);

        // Les deux tableaux, épais : ils interrompent le mur — commun aux trois.
        ctx.lineWidth = s.epaisseur * 1.6;
        for (const [cx, cy] of [
          [s.x1, s.y1],
          [s.x2, s.y2],
        ] as const) {
          ctx.beginPath();
          ctx.moveTo(
            cx - 5 * Math.sin(angle) * s.sens,
            cy + 5 * Math.cos(angle) * s.sens,
          );
          ctx.lineTo(
            cx + 5 * Math.sin(angle) * s.sens,
            cy - 5 * Math.cos(angle) * s.sens,
          );
          ctx.stroke();
        }

        if (s.variante === "coulissante") {
          // Un vantail qui glisse dans l'épaisseur du mur : un trait décalé,
          // une flèche pour le sens — pas d'arc, rien ne débat.
          const nx = -Math.sin(angle);
          const ny = Math.cos(angle);
          const offset = 6 * s.sens;
          ctx.lineWidth = s.epaisseur * 1.3;
          ctx.beginPath();
          ctx.moveTo(s.x1 + nx * offset, s.y1 + ny * offset);
          ctx.lineTo(s.x2 + nx * offset, s.y2 + ny * offset);
          ctx.stroke();

          const mx = (s.x1 + s.x2) / 2 + nx * offset;
          const my = (s.y1 + s.y2) / 2 + ny * offset;
          const reach = Math.min(largeur / 3, 22);
          ctx.lineWidth = Math.max(1, s.epaisseur * 0.7);
          ctx.beginPath();
          ctx.moveTo(mx - reach * Math.cos(angle), my - reach * Math.sin(angle));
          ctx.lineTo(mx + reach * Math.cos(angle), my + reach * Math.sin(angle));
          ctx.lineTo(
            mx + reach * Math.cos(angle) - 7 * Math.cos(angle - 0.5),
            my + reach * Math.sin(angle) - 7 * Math.sin(angle - 0.5),
          );
          ctx.stroke();
        } else {
          // Simple : un battant depuis (x1,y1). Double : deux, hinges aux
          // deux tableaux, chacun couvrant la moitié de la largeur.
          const battants =
            s.variante === "double"
              ? [
                  { gondX: s.x1, gondY: s.y1, versAutre: angle, portee: largeur / 2 },
                  {
                    gondX: s.x2,
                    gondY: s.y2,
                    versAutre: angle + Math.PI,
                    portee: largeur / 2,
                  },
                ]
              : [{ gondX: s.x1, gondY: s.y1, versAutre: angle, portee: largeur }];

          for (const { gondX, gondY, versAutre, portee } of battants) {
            const battantAngle = versAutre - (Math.PI / 2) * s.sens;
            ctx.lineWidth = s.epaisseur;
            ctx.beginPath();
            ctx.moveTo(gondX, gondY);
            ctx.lineTo(
              gondX + portee * Math.cos(battantAngle),
              gondY + portee * Math.sin(battantAngle),
            );
            ctx.stroke();

            ctx.beginPath();
            ctx.setLineDash([6, 5]);
            ctx.lineWidth = Math.max(1, s.epaisseur * 0.7);
            ctx.arc(
              gondX,
              gondY,
              portee,
              Math.min(battantAngle, versAutre),
              Math.max(battantAngle, versAutre),
            );
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        drawCote(ctx, s.cote, s.x1, s.y1, s.x2, s.y2, s.couleur);
        break;
      }
      case "fenetre": {
        // Deux traits parallèles entre deux tableaux : le dormant vu en plan.
        // La baie vitrée n'a pas de tableaux — l'ouverture est pleine largeur.
        // La double a un meneau central : deux vantaux plutôt qu'un.
        const dx = s.x2 - s.x1;
        const dy = s.y2 - s.y1;
        const angle = Math.atan2(dy, dx);
        const nx = -Math.sin(angle);
        const ny = Math.cos(angle);
        const demi = 4;

        if (s.variante !== "baie") {
          ctx.lineWidth = s.epaisseur * 1.6;
          for (const [cx, cy] of [
            [s.x1, s.y1],
            [s.x2, s.y2],
          ] as const) {
            ctx.beginPath();
            ctx.moveTo(cx - demi * nx, cy - demi * ny);
            ctx.lineTo(cx + demi * nx, cy + demi * ny);
            ctx.stroke();
          }
        }

        if (s.variante === "double") {
          const mx = (s.x1 + s.x2) / 2;
          const my = (s.y1 + s.y2) / 2;
          ctx.lineWidth = s.epaisseur * 1.6;
          ctx.beginPath();
          ctx.moveTo(mx - demi * nx, my - demi * ny);
          ctx.lineTo(mx + demi * nx, my + demi * ny);
          ctx.stroke();
        }

        ctx.lineWidth = s.epaisseur;
        for (const offset of [-demi, demi]) {
          ctx.beginPath();
          ctx.moveTo(s.x1 + offset * nx, s.y1 + offset * ny);
          ctx.lineTo(s.x2 + offset * nx, s.y2 + offset * ny);
          ctx.stroke();
        }

        drawCote(ctx, s.cote, s.x1, s.y1, s.x2, s.y2, s.couleur);
        break;
      }
      case "texte":
        ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(s.contenu, s.x, s.y);
        break;
      case "nord": {
        // Un repère d'orientation, pas une mesure : un cercle, une aiguille
        // qui pointe le haut de la page — le nord du plan, pas de l'écran.
        const R = 16;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - R + 3);
        ctx.lineTo(s.x - 5, s.y + 4);
        ctx.lineTo(s.x + 5, s.y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.font = "700 11px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("N", s.x, s.y - R - 4);
        ctx.textAlign = "start";
        break;
      }
    }
  }
}

/**
 * Métré sketch pad: the conseiller draws the room and writes its dimensions
 * straight onto the fiche. Vector shapes, saved to Supabase as jsonb.
 *
 * The sketch is a fixed 1000×700 page shown through a frame: pinch (or the
 * zoom buttons / wheel) to magnify, drag with the hand tool or two fingers to
 * move around. On a phone that is the difference between drawing blind and
 * drawing a room.
 */
export function CroquisPad({
  ficheId,
  initial,
}: {
  ficheId: string;
  initial: unknown;
}) {
  const t = useTranslations();
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const draftRef = useRef<CroquisShape | null>(null);

  // Live pointers, so two fingers can be told from one.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<
    | { dist: number; fx: number; fy: number; z: number; tx: number; ty: number }
    | null
  >(null);
  const panRef = useRef<
    { x: number; y: number; tx: number; ty: number } | null
  >(null);

  const parsed = croquisSchema.safeParse(initial);
  const [shapes, setShapes] = useState<CroquisShape[]>(
    parsed.success ? parsed.data.shapes : [],
  );
  const [draft, setDraft] = useState<CroquisShape | null>(null);
  const [tool, setTool] = useState<Tool>("trait");
  /** De quel côté du mur la porte s'ouvre. Se retourne avant de la poser. */
  const [sensPorte, setSensPorte] = useState<1 | -1>(1);
  const [couleur, setCouleur] = useState<string>(PRESETS[0] as string);
  const [hexInput, setHexInput] = useState<string>(PRESETS[0] as string);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const sizeRef = useRef<Size>({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ z: 1, tx: 0, ty: 0 });
  const viewRef = useRef<View>({ z: 1, tx: 0, ty: 0 });

  const scale = fitScale(size) * view.z;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) draw(ctx, draft ? [...shapes, draft] : shapes);
  }, [shapes, draft]);

  const applyView = useCallback((next: View) => {
    const clamped = clampView(next, sizeRef.current);
    viewRef.current = clamped;
    setView(clamped);
  }, []);

  /** Zooms by `ratio` around a point given in frame coordinates. */
  const zoomAt = useCallback(
    (ratio: number, fx: number, fy: number) => {
      const v = viewRef.current;
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z * ratio));
      const r = z / v.z;
      applyView({ z, tx: fx - (fx - v.tx) * r, ty: fy - (fy - v.ty) * r });
    },
    [applyView],
  );

  const zoomFromButton = useCallback(
    (ratio: number) =>
      zoomAt(ratio, sizeRef.current.w / 2, sizeRef.current.h / 2),
    [zoomAt],
  );

  // The frame drives everything: refit whenever it is resized (or fullscreened).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      // A hidden or detached frame reports 0×0 — keep the last real size so the
      // sketch never scales itself down to nothing.
      if (!r.width || !r.height) return;
      sizeRef.current = { w: r.width, h: r.height };
      setSize({ w: r.width, h: r.height });
      applyView(viewRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyView]);

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Plain wheel keeps scrolling the fiche; ctrl/⌘ (and trackpad pinch) zooms.
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  /** Selecting a color (preset or picker) keeps the hex field in sync. */
  function selectColor(c: string) {
    setCouleur(c);
    setHexInput(c);
  }

  /** Maps a logical canvas point to a CSS pixel position inside the frame. */
  function logicalToScreen(p: { x: number; y: number }) {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return { x: 0, y: 0 };
    const cr = canvas.getBoundingClientRect();
    const vr = viewport.getBoundingClientRect();
    const x = cr.left - vr.left + (p.x / CROQUIS_W) * cr.width;
    const y = cr.top - vr.top + (p.y / CROQUIS_H) * cr.height;
    // The popup follows the point, but never off the edge of the frame.
    const { w, h } = sizeRef.current;
    const mx = Math.min(130, w / 2);
    return {
      x: Math.min(w - mx, Math.max(mx, x)),
      y: Math.min(h - 28, Math.max(28, y)),
    };
  }

  function setDraftShape(next: CroquisShape | null) {
    draftRef.current = next;
    setDraft(next);
  }

  function commit(next: CroquisShape[]) {
    setShapes(next);
    setDirty(true);
    setMessage(null);
  }

  function openTextEditor(logicalPoint: { x: number; y: number }) {
    const screen = logicalToScreen(logicalPoint);
    setEditorValue("");
    setEditor({
      mode: "texte",
      screenX: screen.x,
      screenY: screen.y,
      commit: (value) => {
        const trimmed = value.trim().slice(0, 80);
        if (trimmed) {
          commit([
            ...shapes,
            { type: "texte", x: logicalPoint.x, y: logicalPoint.y, contenu: trimmed, couleur },
          ]);
        }
        setEditor(null);
      },
      cancel: () => setEditor(null),
    });
  }

  function openCoteEditor(
    ligne: Extract<CroquisShape, { type: "ligne" | "porte" | "fenetre" }>,
  ) {
    const mid = { x: (ligne.x1 + ligne.x2) / 2, y: (ligne.y1 + ligne.y2) / 2 };
    const screen = logicalToScreen(mid);
    setEditorValue("");
    setEditor({
      mode: "cote",
      screenX: screen.x,
      screenY: screen.y,
      commit: (value) => {
        commit([...shapes, { ...ligne, cote: value.trim().slice(0, 24) }]);
        setEditor(null);
      },
      // The line itself is already drawn — cancelling only skips the label.
      cancel: () => {
        commit([...shapes, { ...ligne, cote: "" }]);
        setEditor(null);
      },
    });
  }

  /** A second finger always means pinch — never a stroke. */
  function beginPinch() {
    const el = viewportRef.current;
    const pts = [...pointersRef.current.values()].slice(0, 2);
    if (!el || pts.length < 2) return;
    const r = el.getBoundingClientRect();
    const v = viewRef.current;
    pinchRef.current = {
      dist: Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)),
      fx: (pts[0].x + pts[1].x) / 2 - r.left,
      fy: (pts[0].y + pts[1].y) / 2 - r.top,
      z: v.z,
      tx: v.tx,
      ty: v.ty,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);

    if (pointersRef.current.size >= 2) {
      drawingRef.current = false;
      startRef.current = null;
      panRef.current = null;
      setDraftShape(null);
      beginPinch();
      return;
    }

    if (editor) return;

    if (tool === "main") {
      const v = viewRef.current;
      panRef.current = { x: e.clientX, y: e.clientY, tx: v.tx, ty: v.ty };
      return;
    }

    const p = toLogical(e, canvas);

    if (tool === "gomme") {
      const tol = Math.min(60, Math.max(10, 14 / (scale || 1)));
      const idx = [...shapes].reverse().findIndex((s) => hits(s, p.x, p.y, tol));
      if (idx !== -1) commit(shapes.filter((_, i) => i !== shapes.length - 1 - idx));
      return;
    }

    if (tool === "texte") {
      openTextEditor(p);
      return;
    }

    if (tool === "nord") {
      // Un repère, pas un tracé : il se pose d'un clic, sans qu'on ait à tirer.
      commit([...shapes, { type: "nord", x: p.x, y: p.y, couleur }]);
      return;
    }

    drawingRef.current = true;
    startRef.current = p;
    if (tool === "trait") {
      setDraftShape({ type: "trait", points: [p], couleur, epaisseur: 3 });
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    const pinch = pinchRef.current;
    if (pinch) {
      const el = viewportRef.current;
      const pts = [...pointersRef.current.values()].slice(0, 2);
      if (!el || pts.length < 2) return;
      const r = el.getBoundingClientRect();
      const dist = Math.max(
        1,
        Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
      );
      const z = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, (pinch.z * dist) / pinch.dist),
      );
      const ratio = z / pinch.z;
      // Zoom around the first midpoint, and follow it as the fingers travel.
      const mx = (pts[0].x + pts[1].x) / 2 - r.left;
      const my = (pts[0].y + pts[1].y) / 2 - r.top;
      applyView({
        z,
        tx: mx - (pinch.fx - pinch.tx) * ratio,
        ty: my - (pinch.fy - pinch.ty) * ratio,
      });
      return;
    }

    const pan = panRef.current;
    if (pan) {
      applyView({
        z: viewRef.current.z,
        tx: pan.tx + (e.clientX - pan.x),
        ty: pan.ty + (e.clientY - pan.y),
      });
      return;
    }

    if (!drawingRef.current || !canvasRef.current || !startRef.current) return;
    const p = toLogical(e, canvasRef.current);
    const s = startRef.current;

    if (tool === "trait") {
      const d = draftRef.current;
      if (d && d.type === "trait") {
        setDraftShape({ ...d, points: [...d.points, p] });
      }
    } else if (tool === "rectangle") {
      setDraftShape({
        type: "rectangle",
        x: s.x,
        y: s.y,
        w: p.x - s.x,
        h: p.y - s.y,
        couleur,
        epaisseur: 3,
      });
    } else if (tool === "ligne") {
      setDraftShape({
        type: "ligne",
        x1: s.x,
        y1: s.y,
        x2: p.x,
        y2: p.y,
        couleur,
        epaisseur: 3,
        cote: "",
      });
    } else {
      const cible = TOOL_SHAPE[tool];
      if (cible?.type === "porte") {
        setDraftShape({
          type: "porte",
          x1: s.x,
          y1: s.y,
          x2: p.x,
          y2: p.y,
          sens: sensPorte,
          variante: cible.variante,
          couleur,
          epaisseur: 3,
          cote: "",
        });
      } else if (cible?.type === "fenetre") {
        setDraftShape({
          type: "fenetre",
          x1: s.x,
          y1: s.y,
          x2: p.x,
          y2: p.y,
          variante: cible.variante,
          couleur,
          epaisseur: 3,
          cote: "",
        });
      }
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    panRef.current = null;

    if (!drawingRef.current) return;
    drawingRef.current = false;
    startRef.current = null;

    const d = draftRef.current;
    setDraftShape(null);
    if (!d) return;

    // Ignore accidental taps. Une porte ou une fenêtre demande un peu plus de
    // course qu'un trait : sous 20 px le symbole serait illisible.
    const tiny =
      (d.type === "rectangle" && Math.abs(d.w) < 6 && Math.abs(d.h) < 6) ||
      (d.type === "ligne" && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 6) ||
      ((d.type === "porte" || d.type === "fenetre") &&
        Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 20) ||
      (d.type === "trait" && d.points.length < 2);
    if (tiny) return;

    // Les trois portent une cote : c'est la mesure qui intéresse l'atelier.
    if (d.type === "ligne" || d.type === "porte" || d.type === "fenetre") {
      openCoteEditor(d);
    } else {
      commit([...shapes, d]);
    }
  }

  async function persist() {
    setSaving(true);
    setMessage(null);
    const payload: Croquis = { v: 1, shapes };
    const result = await saveCroquis({ fiche_id: ficheId, croquis: payload });
    setSaving(false);
    if (result.ok) {
      setDirty(false);
      setMessage(t("app.saved"));
    } else {
      setMessage(
        messageErreur(t, result.error),
      );
    }
  }

  function applyHex(raw: string) {
    setHexInput(raw);
    const value = raw.startsWith("#") ? raw : `#${raw}`;
    if (HEX_RE.test(value)) setCouleur(value);
  }

  const tools: { id: Tool; icon: typeof Pencil; label: string }[] = [
    { id: "trait", icon: Pencil, label: t("fiches.croquis.crayon") },
    { id: "rectangle", icon: Square, label: t("fiches.croquis.rectangle") },
    { id: "ligne", icon: Minus, label: t("fiches.croquis.cote") },
    { id: "porte_simple", icon: DoorOpen, label: t("fiches.croquis.porteSimple") },
    { id: "porte_double", icon: DoorClosed, label: t("fiches.croquis.porteDouble") },
    { id: "coulissante", icon: ArrowLeftRight, label: t("fiches.croquis.coulissante") },
    { id: "fenetre_simple", icon: AppWindow, label: t("fiches.croquis.fenetreSimple") },
    { id: "fenetre_double", icon: Columns3, label: t("fiches.croquis.fenetreDouble") },
    { id: "baie_vitree", icon: RectangleHorizontal, label: t("fiches.croquis.baieVitree") },
    { id: "nord", icon: Compass, label: t("fiches.croquis.nord") },
    { id: "texte", icon: Type, label: t("fiches.croquis.texte") },
    { id: "gomme", icon: Eraser, label: t("fiches.croquis.gomme") },
    { id: "main", icon: Hand, label: t("fiches.croquis.main") },
  ];

  const isPreset = PRESETS.includes(couleur as (typeof PRESETS)[number]);
  const iconButton =
    "grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40";

  const pad = (
    <Card
      className={cn(
        "no-print",
        fullscreen && "flex min-h-0 flex-1 flex-col rounded-2xl",
      )}
    >
      <CardHeader
        className={cn(
          "p-4 pb-2 sm:p-6 sm:pb-2",
          // Fullscreen is for drawing — give the frame the space back.
          fullscreen && "p-3 pb-1 sm:p-4 sm:pb-1",
        )}
      >
        <CardTitle>{t("fiches.croquis.title")}</CardTitle>
        {!fullscreen && (
          <p className="text-xs text-muted-foreground">
            {t("fiches.croquis.hint")}
          </p>
        )}
      </CardHeader>
      <CardContent
        className={cn(
          "p-4 pt-2 sm:p-6 sm:pt-2",
          fullscreen && "flex min-h-0 flex-1 flex-col",
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {tools.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTool(id)}
              aria-pressed={tool === id}
              aria-label={label}
              title={label}
              className={cn(
                iconButton,
                tool === id &&
                  "border-primary bg-primary/10 text-primary hover:bg-primary/10",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}

          {/* Le sens d'ouverture ne s'affiche que quand il veut dire quelque
              chose — un bouton de plus en permanence encombrerait la barre. */}
          {TOOL_SHAPE[tool]?.type === "porte" && (
            <button
              type="button"
              onClick={() => setSensPorte((s) => (s === 1 ? -1 : 1))}
              aria-label={t("fiches.croquis.sensPorte")}
              title={t("fiches.croquis.sensPorte")}
              className={cn(iconButton, "text-primary")}
            >
              <FlipHorizontal className="size-4" />
            </button>
          )}

          <span aria-hidden className="mx-1 h-6 w-px bg-border" />

          <button
            type="button"
            onClick={() => commit(shapes.slice(0, -1))}
            disabled={shapes.length === 0}
            aria-label={t("fiches.croquis.annuler")}
            title={t("fiches.croquis.annuler")}
            className={iconButton}
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => commit([])}
            disabled={shapes.length === 0}
            aria-label={t("fiches.croquis.effacer")}
            title={t("fiches.croquis.effacer")}
            className={iconButton}
          >
            <Trash2 className="size-4" />
          </button>

          <div className="ms-auto flex items-center gap-3">
            {message && (
              <span className="text-xs text-muted-foreground">{message}</span>
            )}
            <Button size="sm" onClick={persist} disabled={saving || !dirty}>
              {t("app.save")}
            </Button>
          </div>
        </div>

        {/* Colors scroll sideways rather than pushing the frame off a phone. */}
        <div className="mb-3 -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => selectColor(c)}
              aria-pressed={couleur === c}
              aria-label={c}
              className={cn(
                "size-7 shrink-0 rounded-full border-2 transition-transform",
                couleur === c ? "scale-110 border-foreground" : "border-border",
              )}
              style={{ backgroundColor: c }}
            />
          ))}

          {/* Full spectrum — a native picker gives every color and gradient. */}
          <label
            className={cn(
              "relative grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-transform",
              !isPreset ? "scale-110 border-foreground" : "border-border",
            )}
            style={{
              background:
                "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
            }}
            title={t("fiches.croquis.couleurPerso")}
          >
            <span className="sr-only">{t("fiches.croquis.couleurPerso")}</span>
            <input
              type="color"
              value={couleur}
              onChange={(e) => selectColor(e.target.value)}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              aria-label={t("fiches.croquis.couleurPerso")}
            />
          </label>

          <input
            type="text"
            value={hexInput}
            onChange={(e) => applyHex(e.target.value)}
            spellCheck={false}
            maxLength={7}
            aria-label={t("fiches.croquis.codeCouleur")}
            title={t("fiches.croquis.codeCouleur")}
            className="hidden h-9 w-20 shrink-0 rounded-lg border border-border bg-card px-2 font-mono text-xs uppercase text-foreground sm:block"
          />
        </div>

        <div
          ref={viewportRef}
          className={cn(
            "relative touch-none overflow-hidden rounded-2xl border border-border bg-white",
            fullscreen && "min-h-0 flex-1",
          )}
          style={
            fullscreen
              ? undefined
              : { aspectRatio: `${CROQUIS_W} / ${CROQUIS_H}` }
          }
        >
          <canvas
            ref={canvasRef}
            width={CROQUIS_W * RES}
            height={CROQUIS_H * RES}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="absolute left-0 top-0 origin-top-left touch-none bg-white"
            style={{
              width: `${CROQUIS_W}px`,
              height: `${CROQUIS_H}px`,
              transform: `translate(${view.tx}px, ${view.ty}px) scale(${scale})`,
              opacity: size.w ? 1 : 0,
              cursor: tool === "main" ? "grab" : "crosshair",
            }}
            role="img"
            aria-label={t("fiches.croquis.title")}
          />

          {/* Zoom sits on the sketch: always in reach of a thumb, and laid out
              along the bottom so it hides as little of the plan as possible. */}
          <div className="absolute bottom-2 end-2 flex items-center gap-0.5 rounded-2xl border border-border bg-card/90 p-1 shadow-md backdrop-blur">
            <button
              type="button"
              onClick={() => zoomFromButton(1 / ZOOM_STEP)}
              disabled={view.z <= MIN_ZOOM}
              aria-label={t("fiches.croquis.zoomOut")}
              title={t("fiches.croquis.zoomOut")}
              className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ZoomOut className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => applyView({ z: 1, tx: 0, ty: 0 })}
              aria-label={t("fiches.croquis.zoomFit")}
              title={t("fiches.croquis.zoomFit")}
              className="h-9 min-w-11 rounded-lg px-1 text-[11px] font-semibold tabular-nums text-muted-foreground hover:bg-secondary"
            >
              {Math.round(view.z * 100)}%
            </button>
            <button
              type="button"
              onClick={() => zoomFromButton(ZOOM_STEP)}
              disabled={view.z >= MAX_ZOOM}
              aria-label={t("fiches.croquis.zoomIn")}
              title={t("fiches.croquis.zoomIn")}
              className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ZoomIn className="size-4" />
            </button>
            <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              aria-label={
                fullscreen
                  ? t("fiches.croquis.quitterPleinEcran")
                  : t("fiches.croquis.pleinEcran")
              }
              title={
                fullscreen
                  ? t("fiches.croquis.quitterPleinEcran")
                  : t("fiches.croquis.pleinEcran")
              }
              className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-secondary"
            >
              {fullscreen ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </button>
          </div>

          {editor && (
            <div
              className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-xl border-2 border-primary bg-white p-1.5 shadow-lg"
              style={{ left: editor.screenX, top: editor.screenY }}
            >
              <input
                autoFocus
                value={editorValue}
                onChange={(e) => setEditorValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") editor.commit(editorValue);
                  if (e.key === "Escape") {
                    // Don't let Escape also drop out of fullscreen.
                    e.stopPropagation();
                    editor.cancel();
                  }
                }}
                placeholder={
                  editor.mode === "texte"
                    ? t("fiches.croquis.texteHint")
                    : t("fiches.croquis.coteHint")
                }
                maxLength={editor.mode === "texte" ? 80 : 24}
                className="h-8 w-32 rounded-lg border border-border bg-card px-2 text-sm text-foreground sm:w-40"
              />
              <button
                type="button"
                onClick={() => editor.commit(editorValue)}
                aria-label={t("app.confirm")}
                className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
              >
                <Check className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={editor.cancel}
                aria-label={t("app.cancel")}
                className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        {!fullscreen && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t("fiches.croquis.zoomHint")}
          </p>
        )}
      </CardContent>
    </Card>
  );

  // Same wrapper element either way: swapping it would remount the canvas and
  // strand the ResizeObserver on a detached frame.
  return (
    <div
      className={cn(
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background p-2 sm:p-4"
          : "contents",
      )}
    >
      {pad}
    </div>
  );
}
