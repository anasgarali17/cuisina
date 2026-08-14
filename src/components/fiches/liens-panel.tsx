"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Link2,
  Power,
  Printer,
  QrCode,
} from "lucide-react";
import { toggleLien } from "@/lib/actions/lien-actions";
import type { FicheLienRow } from "@/lib/database.types";
import { posterDataUrl, posterSvg } from "@/lib/poster";
import { cn, messageErreur } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface LienView extends FicheLienRow {
  /** URL absolue encodée dans le QR code. */
  url: string;
  qr: { size: number; bits: string };
}

/** Rendu de l'affiche à l'export : 2× le gabarit, bon pour un A4. */
const EXPORT_SCALE = 2;
const POSTER_W = 720;
const POSTER_H = 1080;

/**
 * Les liens de collecte et leur affiche. Un lien = un endroit : l'affiche du
 * showroom de Sousse n'est pas celle du stand de la foire, et les demandes
 * qui en reviennent le disent.
 */
export function LiensPanel({ liens: initial }: { liens: LienView[] }) {
  const t = useTranslations();
  const [liens, setLiens] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial[0]?.id ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const selected = liens.find((l) => l.id === selectedId) ?? liens[0] ?? null;

  async function onToggle(lien: LienView) {
    const next = !lien.actif;
    setLiens((list) =>
      list.map((l) => (l.id === lien.id ? { ...l, actif: next } : l)),
    );
    const result = await toggleLien({ id: lien.id, actif: next });
    if (!result.ok) {
      setLiens((list) =>
        list.map((l) => (l.id === lien.id ? { ...l, actif: !next } : l)),
      );
      setError(
        messageErreur(t, result.error),
      );
    }
  }

  return (
    <div>
      {/* Pas de création de lien : il en existe deux, et deux suffisent —
          celui que le client remplit, celui que l'équipe remplit pour lui.
          Un troisième lien ne créerait qu'une affiche de plus à imprimer et
          une demande de plus à ne pas savoir d'où elle vient. */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">{t("liens.intro")}</p>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-rouge">
          {error}
        </p>
      )}

      {liens.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <QrCode aria-hidden className="size-8 text-muted-foreground" strokeWidth={1.5} />
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("liens.empty")}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <ul className="space-y-2.5">
            {liens.map((lien) => (
              <li key={lien.id}>
                <LienRow
                  lien={lien}
                  selected={lien.id === selected?.id}
                  onSelect={() => setSelectedId(lien.id)}
                  onToggle={() => void onToggle(lien)}
                />
              </li>
            ))}
          </ul>

          {selected && <Affiche lien={selected} />}
        </div>
      )}

    </div>
  );
}

function LienRow({
  lien,
  selected,
  onSelect,
  onToggle,
}: {
  lien: LienView;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(lien.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Presse-papiers refusé (http, permission) — le lien reste lisible.
    }
  }

  return (
    <Card
      className={cn(
        "p-4 transition-colors",
        selected ? "border-primary ring-1 ring-primary/30" : "hover:bg-secondary/40",
        !lien.actif && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-start gap-3 text-start"
      >
        <span
          aria-hidden
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-xl",
            lien.actif ? "bg-rouge/10 text-rouge" : "bg-secondary text-muted-foreground",
          )}
        >
          <QrCode className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{lien.libelle}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {t(`liens.audiences.${lien.audience}`)}
            </span>
            {!lien.actif && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {t("liens.inactive")}
              </span>
            )}
          </span>
          <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
            {lien.url.replace(/^https?:\/\//, "")}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {t("liens.count", { count: lien.soumissions })}
          </span>
        </span>
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button size="sm" variant="secondary" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? t("liens.copied") : t("liens.copy")}
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(lien.url)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-secondary"
        >
          <Link2 aria-hidden className="size-4" />
          {t("liens.share")}
        </a>
        <Button
          size="sm"
          variant="ghost"
          className="ms-auto"
          onClick={onToggle}
          aria-pressed={lien.actif}
        >
          <Power />
          {lien.actif ? t("liens.deactivate") : t("liens.activate")}
        </Button>
      </div>
    </Card>
  );
}

/** L'affiche : aperçu, impression, export PNG et SVG. */
function Affiche({ lien }: { lien: LienView }) {
  const t = useTranslations();
  const imgRef = useRef<HTMLImageElement>(null);
  const [busy, setBusy] = useState(false);

  const svg = useMemo(
    () =>
      posterSvg({
        bits: lien.qr.bits,
        size: lien.qr.size,
        lien: lien.url.replace(/^https?:\/\//, ""),
        titre: t(`liens.poster.${lien.audience}.titre`),
        sousTitre: t(`liens.poster.${lien.audience}.sousTitre`),
        lienLabel: t("liens.poster.lienLabel"),
        pied: lien.libelle,
        code: t("fiches.formCode"),
      }),
    [lien, t],
  );

  const src = useMemo(() => posterDataUrl(svg), [svg]);
  const slug = lien.libelle.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  function downloadSvg() {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cuisina-qr-${slug}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPng() {
    const image = imgRef.current;
    if (!image) return;
    setBusy(true);
    try {
      // L'aperçu est déjà décodé : on le repeint simplement en plus grand.
      const canvas = document.createElement("canvas");
      canvas.width = POSTER_W * EXPORT_SCALE;
      canvas.height = POSTER_H * EXPORT_SCALE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await image.decode().catch(() => undefined);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `cuisina-qr-${slug}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }

  function print() {
    const w = window.open("", "_blank", "width=820,height=1100");
    if (!w) return;
    w.document.write(
      `<!doctype html><title>${lien.libelle}</title><style>@page{size:A4;margin:12mm}body{margin:0}img{width:100%}</style><img src="${src}" onload="window.print();window.close()">`,
    );
    w.document.close();
  }

  return (
    <Card className="h-fit p-4 lg:sticky lg:top-24">
      <div className="overflow-hidden rounded-2xl border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={t("liens.poster.alt", { libelle: lien.libelle })}
          width={POSTER_W}
          height={POSTER_H}
          className="block h-auto w-full"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="sm" onClick={() => void downloadPng()} disabled={busy}>
          <ImageIcon />
          {t("liens.poster.png")}
        </Button>
        <Button size="sm" variant="secondary" onClick={downloadSvg}>
          <Download />
          {t("liens.poster.svg")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="col-span-2"
          onClick={print}
        >
          <Printer />
          {t("liens.poster.print")}
        </Button>
      </div>
    </Card>
  );
}
