"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Eraser, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Taille logique du trait — indépendante du zoom de l'écran. */
const W = 600;
const H = 200;

/**
 * La signature du client, posée à l'écran : au doigt sur tablette, à la
 * souris ailleurs.
 *
 * Le trait est capturé en coordonnées logiques puis rendu à la densité réelle
 * de l'écran, sinon une signature prise sur téléphone ressort floue sur le
 * PDF. Rien n'est envoyé tant que le geste n'est pas terminé : `onChange` ne
 * part qu'au relâchement.
 */
export function SignaturePad({
  value,
  onChange,
  signedAt,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  signedAt?: string | null;
}) {
  const t = useTranslations();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dernier = useRef<{ x: number; y: number } | null>(null);
  const [vide, setVide] = useState(value == null);

  /* Rendu initial : redessine une signature déjà enregistrée. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#111111";

    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, W, H);
      img.src = value;
      // `vide` part déjà à false via l'état initial : le repositionner ici ne
      // ferait qu'un rendu de plus.
    }
    // Le montage seul : redessiner à chaque frappe effacerait le trait en cours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pointDe(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function debut(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    dernier.current = pointDe(e);
  }

  function trace(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const depuis = dernier.current;
    if (!ctx || !depuis) return;
    const vers = pointDe(e);
    ctx.beginPath();
    ctx.moveTo(depuis.x, depuis.y);
    ctx.lineTo(vers.x, vers.y);
    ctx.stroke();
    dernier.current = vers;
    if (vide) setVide(false);
  }

  function fin() {
    if (!drawing.current) return;
    drawing.current = false;
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
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <PenLine aria-hidden="true" className="size-4" />
          {t("fiches.signature.titre")}
        </p>
        {!vide && (
          <Button type="button" variant="ghost" size="sm" onClick={effacer}>
            <Eraser className="size-4" />
            {t("fiches.signature.effacer")}
          </Button>
        )}
      </div>

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
          // `touch-none` : sans lui, le doigt fait défiler la page au lieu
          // de signer.
          className="block h-40 w-full touch-none"
          style={{ aspectRatio: `${W} / ${H}` }}
        />
        {vide && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-neutral-400">
            {t("fiches.signature.invite")}
          </p>
        )}
      </div>

      {signedAt && !vide && (
        <p className="text-xs text-muted-foreground">
          {t("fiches.signature.le", { date: signedAt })}
        </p>
      )}
    </div>
  );
}
