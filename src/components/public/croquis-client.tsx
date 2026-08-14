"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Eraser } from "lucide-react";
import { cn } from "@/lib/utils";

/** Espace logique du dessin — indépendant de la taille de l'écran. */
const W = 800;
const H = 500;

/**
 * L'espace de dessin du client.
 *
 * Volontairement pauvre : un trait, une gomme totale, rien d'autre. Le client
 * n'est pas métreur — il veut montrer « l'évier ici, le frigo là ». Les cotes
 * et les symboles normalisés sont l'affaire du conseiller, dans le croquis de
 * la fiche.
 */
export function CroquisClient({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const t = useTranslations();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dessine = useRef(false);
  const dernier = useRef<{ x: number; y: number } | null>(null);
  const pret = useRef(false);
  const [vide, setVide] = useState(value == null);

  /** Prépare le contexte au premier contact, pas au montage : le canvas
      n'a sa taille définitive qu'une fois la mise en page faite. */
  function contexte(): CanvasRenderingContext2D | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (!pret.current) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#1a1a1a";
      pret.current = true;
    }
    return ctx;
  }

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
    };
  }

  function debut(e: React.PointerEvent<HTMLCanvasElement>) {
    contexte();
    e.currentTarget.setPointerCapture(e.pointerId);
    dessine.current = true;
    dernier.current = point(e);
  }

  function trace(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dessine.current) return;
    const ctx = contexte();
    const depuis = dernier.current;
    if (!ctx || !depuis) return;
    const vers = point(e);
    ctx.beginPath();
    ctx.moveTo(depuis.x, depuis.y);
    ctx.lineTo(vers.x, vers.y);
    ctx.stroke();
    dernier.current = vers;
    if (vide) setVide(false);
  }

  function fin() {
    if (!dessine.current) return;
    dessine.current = false;
    dernier.current = null;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  }

  function effacer() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setVide(true);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-white",
          vide ? "border-dashed border-border" : "border-border",
        )}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={debut}
          onPointerMove={trace}
          onPointerUp={fin}
          onPointerLeave={fin}
          onPointerCancel={fin}
          // `touch-none` : sans lui, le doigt fait défiler la page.
          className="block h-56 w-full touch-none"
          style={{ aspectRatio: `${W} / ${H}` }}
        />
        {vide && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-sm text-neutral-400">
            {t("public.souhaits.croquisInvite")}
          </p>
        )}
      </div>

      {!vide && (
        <button
          type="button"
          onClick={effacer}
          className="flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <Eraser aria-hidden className="size-4" />
          {t("public.souhaits.croquisEffacer")}
        </button>
      )}
    </div>
  );
}
