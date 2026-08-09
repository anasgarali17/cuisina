"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Eraser,
  Minus,
  Pencil,
  RotateCcw,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import { saveCroquis } from "@/lib/actions/fiche-actions";
import {
  CROQUIS_H,
  CROQUIS_W,
  croquisSchema,
  type Croquis,
  type CroquisShape,
} from "@/lib/schemas/fiche";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Tool = "trait" | "rectangle" | "ligne" | "texte" | "gomme";

const COULEURS = ["#0a0a0a", "#c1121f", "#2563eb", "#059669"] as const;

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

/** True when a click at (px,py) should be treated as hitting this shape. */
function hits(shape: CroquisShape, px: number, py: number): boolean {
  const TOL = 12;
  switch (shape.type) {
    case "trait":
      return shape.points.some((p) => Math.hypot(p.x - px, p.y - py) < TOL);
    case "rectangle": {
      const x1 = Math.min(shape.x, shape.x + shape.w);
      const x2 = Math.max(shape.x, shape.x + shape.w);
      const y1 = Math.min(shape.y, shape.y + shape.h);
      const y2 = Math.max(shape.y, shape.y + shape.h);
      const near =
        px > x1 - TOL && px < x2 + TOL && py > y1 - TOL && py < y2 + TOL;
      const inside =
        px > x1 + TOL && px < x2 - TOL && py > y1 + TOL && py < y2 - TOL;
      return near && !inside;
    }
    case "ligne":
      return (
        distanceToSegment(px, py, shape.x1, shape.y1, shape.x2, shape.y2) < TOL
      );
    case "texte":
      return Math.abs(shape.x - px) < 90 && Math.abs(shape.y - py) < 22;
  }
}

function draw(ctx: CanvasRenderingContext2D, shapes: CroquisShape[]) {
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
    ctx.strokeStyle = s.type === "texte" ? s.couleur : s.couleur;
    ctx.fillStyle = s.couleur;
    if (s.type !== "texte") ctx.lineWidth = s.epaisseur;

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
        if (s.cote) {
          const mx = (s.x1 + s.x2) / 2;
          const my = (s.y1 + s.y2) / 2;
          ctx.font = "600 20px ui-sans-serif, system-ui, sans-serif";
          const w = ctx.measureText(s.cote).width;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(mx - w / 2 - 5, my - 22, w + 10, 24);
          ctx.fillStyle = s.couleur;
          ctx.textAlign = "center";
          ctx.fillText(s.cote, mx, my - 4);
          ctx.textAlign = "start";
        }
        break;
      }
      case "texte":
        ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(s.contenu, s.x, s.y);
        break;
    }
  }
}

/**
 * Métré sketch pad: the conseiller draws the room and writes its dimensions
 * straight onto the fiche. Vector shapes, saved to Supabase as jsonb.
 */
export function CroquisPad({
  ficheId,
  initial,
}: {
  ficheId: string;
  initial: unknown;
}) {
  const t = useTranslations();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const parsed = croquisSchema.safeParse(initial);
  const [shapes, setShapes] = useState<CroquisShape[]>(
    parsed.success ? parsed.data.shapes : [],
  );
  const [draft, setDraft] = useState<CroquisShape | null>(null);
  const [tool, setTool] = useState<Tool>("trait");
  const [couleur, setCouleur] = useState<string>(COULEURS[0]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) draw(ctx, draft ? [...shapes, draft] : shapes);
  }, [shapes, draft]);

  function commit(next: CroquisShape[]) {
    setShapes(next);
    setDirty(true);
    setMessage(null);
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const p = toLogical(e, canvas);

    if (tool === "gomme") {
      const idx = [...shapes].reverse().findIndex((s) => hits(s, p.x, p.y));
      if (idx !== -1) commit(shapes.filter((_, i) => i !== shapes.length - 1 - idx));
      return;
    }

    if (tool === "texte") {
      const contenu = window.prompt(t("fiches.croquis.textePrompt"));
      if (contenu?.trim()) {
        commit([
          ...shapes,
          { type: "texte", x: p.x, y: p.y, contenu: contenu.trim().slice(0, 80), couleur },
        ]);
      }
      return;
    }

    drawingRef.current = true;
    startRef.current = p;
    if (tool === "trait") {
      setDraft({ type: "trait", points: [p], couleur, epaisseur: 3 });
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !canvasRef.current || !startRef.current) return;
    const p = toLogical(e, canvasRef.current);
    const s = startRef.current;

    if (tool === "trait") {
      setDraft((d) =>
        d && d.type === "trait" ? { ...d, points: [...d.points, p] } : d,
      );
    } else if (tool === "rectangle") {
      setDraft({
        type: "rectangle",
        x: s.x,
        y: s.y,
        w: p.x - s.x,
        h: p.y - s.y,
        couleur,
        epaisseur: 3,
      });
    } else if (tool === "ligne") {
      setDraft({
        type: "ligne",
        x1: s.x,
        y1: s.y,
        x2: p.x,
        y2: p.y,
        couleur,
        epaisseur: 3,
        cote: "",
      });
    }
  }

  function onPointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    startRef.current = null;

    setDraft((d) => {
      if (!d) return null;
      // Ignore accidental taps.
      const tiny =
        (d.type === "rectangle" && Math.abs(d.w) < 6 && Math.abs(d.h) < 6) ||
        (d.type === "ligne" && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 6) ||
        (d.type === "trait" && d.points.length < 2);
      if (tiny) return null;

      if (d.type === "ligne") {
        const cote = window.prompt(t("fiches.croquis.cotePrompt"))?.trim() ?? "";
        commit([...shapes, { ...d, cote: cote.slice(0, 24) }]);
      } else {
        commit([...shapes, d]);
      }
      return null;
    });
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
        result.error === "demo_mode" ? t("app.demoReadOnly") : t("app.error"),
      );
    }
  }

  const tools: { id: Tool; icon: typeof Pencil; label: string }[] = [
    { id: "trait", icon: Pencil, label: t("fiches.croquis.crayon") },
    { id: "rectangle", icon: Square, label: t("fiches.croquis.rectangle") },
    { id: "ligne", icon: Minus, label: t("fiches.croquis.cote") },
    { id: "texte", icon: Type, label: t("fiches.croquis.texte") },
    { id: "gomme", icon: Eraser, label: t("fiches.croquis.gomme") },
  ];

  return (
    <Card className="no-print">
      <CardHeader>
        <CardTitle>{t("fiches.croquis.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("fiches.croquis.hint")}
        </p>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {tools.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTool(id)}
              aria-pressed={tool === id}
              aria-label={label}
              title={label}
              className={cn(
                "grid size-10 place-items-center rounded-xl border transition-colors",
                tool === id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}

          <span aria-hidden className="mx-1 h-6 w-px bg-border" />

          {COULEURS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCouleur(c)}
              aria-pressed={couleur === c}
              aria-label={c}
              className={cn(
                "size-7 rounded-full border-2 transition-transform",
                couleur === c
                  ? "scale-110 border-foreground"
                  : "border-transparent",
              )}
              style={{ backgroundColor: c }}
            />
          ))}

          <span aria-hidden className="mx-1 h-6 w-px bg-border" />

          <button
            type="button"
            onClick={() => commit(shapes.slice(0, -1))}
            disabled={shapes.length === 0}
            aria-label={t("fiches.croquis.annuler")}
            title={t("fiches.croquis.annuler")}
            className="grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-secondary disabled:opacity-40"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => commit([])}
            disabled={shapes.length === 0}
            aria-label={t("fiches.croquis.effacer")}
            title={t("fiches.croquis.effacer")}
            className="grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-secondary disabled:opacity-40"
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

        <canvas
          ref={canvasRef}
          width={CROQUIS_W}
          height={CROQUIS_H}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="w-full touch-none rounded-2xl border border-border bg-white"
          style={{ aspectRatio: `${CROQUIS_W} / ${CROQUIS_H}`, cursor: "crosshair" }}
          role="img"
          aria-label={t("fiches.croquis.title")}
        />
      </CardContent>
    </Card>
  );
}
