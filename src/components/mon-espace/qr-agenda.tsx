"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Le côté du QR dans la carte, en unités du viewBox. */
const COTE = 200;

/**
 * Le QR de l'agenda, aux couleurs de la maison.
 *
 * Les trois carrés de repérage sont redessinés en arrondi plutôt que laissés
 * carrés : c'est ce qui distingue un QR dessiné d'un QR généré, et le reste de
 * l'application est trop soigné pour qu'on lui colle une image par défaut.
 * Le niveau de correction H, choisi côté serveur, laisse la marge nécessaire
 * au pastille centrale.
 */
function Modules({ bits, size }: { bits: string; size: number }) {
  const m = COTE / size;
  const arrondi = m * 0.32;

  /** Les zones des trois repères — redessinées à part, en arrondi. */
  const dansRepere = (row: number, col: number) =>
    (row < 7 && col < 7) ||
    (row < 7 && col >= size - 7) ||
    (row >= size - 7 && col < 7);

  const carres: React.ReactNode[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (bits[row * size + col] !== "1" || dansRepere(row, col)) continue;
      carres.push(
        <rect
          key={`${row}-${col}`}
          x={col * m}
          y={row * m}
          width={m}
          height={m}
          rx={arrondi}
          fill="currentColor"
        />,
      );
    }
  }

  const repere = (x: number, y: number) => (
    <g key={`r-${x}-${y}`}>
      <rect
        x={x}
        y={y}
        width={m * 7}
        height={m * 7}
        rx={m * 2}
        fill="none"
        stroke="currentColor"
        strokeWidth={m}
      />
      <rect
        x={x + m * 2}
        y={y + m * 2}
        width={m * 3}
        height={m * 3}
        rx={m}
        fill="currentColor"
      />
    </g>
  );

  return (
    <>
      {carres}
      {repere(0, 0)}
      {repere((size - 7) * m, 0)}
      {repere(0, (size - 7) * m)}
    </>
  );
}

export function QrAgenda({
  url,
  qr,
}: {
  url: string;
  qr: { size: number; bits: string };
}) {
  const t = useTranslations("monEspace");
  const [copie, setCopie] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : l'adresse
      // reste lisible et sélectionnable sous le code, rien n'est perdu.
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Smartphone aria-hidden className="size-4" />
          {t("qrTitre")}
        </p>
        <p className="text-xs text-muted-foreground">{t("qrTexte")}</p>

        <div className="rounded-2xl border border-border bg-white p-3">
          <svg
            viewBox={`0 0 ${COTE} ${COTE}`}
            className="size-40 text-neutral-900"
            role="img"
            aria-label={t("qrAlt")}
          >
            <Modules bits={qr.bits} size={qr.size} />
          </svg>
        </div>

        <p className="w-full truncate font-mono text-[11px] text-muted-foreground">
          {url}
        </p>

        <Button variant="outline" size="sm" onClick={copier} className="w-full">
          {copie ? (
            <>
              <Check className="size-4" />
              {t("qrCopie")}
            </>
          ) : (
            <>
              <Copy className="size-4" />
              {t("qrCopier")}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
