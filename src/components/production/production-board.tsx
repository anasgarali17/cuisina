"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ExternalLink, StickyNote } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { changeEtapeProduction } from "@/lib/actions/client-actif-actions";
import { ETAPES_PRODUCTION, type EtapeProduction } from "@/lib/domain";
import type { ClientActifDetail } from "@/lib/data/queries";
import { cn, formatDT, messageErreur } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

/**
 * Le suivi de production, colonne par colonne — même lecture que l'État du
 * dossier, parce que c'est la même question posée plus tard : où en est-on.
 *
 * Aucun bouton « ajouter » : une ligne n'entre ici que par le passage d'un
 * dossier en « dossier envoyé ». Ce qui se déplace à la main, c'est l'étape.
 */
export function ProductionBoard({
  dossiers: initial,
}: {
  dossiers: ClientActifDetail[];
}) {
  const t = useTranslations();
  const [dossiers, setDossiers] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dragEndedAt = useRef(0);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 10 },
    }),
  );

  const parEtape = useMemo(() => {
    const map = new Map<EtapeProduction, ClientActifDetail[]>();
    for (const etape of ETAPES_PRODUCTION) map.set(etape, []);
    for (const d of dossiers) map.get(d.etape)?.push(d);
    return map;
  }, [dossiers]);

  function deplacer(id: string, etape: EtapeProduction) {
    const dossier = dossiers.find((d) => d.id === id);
    if (!dossier || dossier.etape === etape) return;

    const precedent = dossiers;
    setDossiers((list) =>
      list.map((d) => (d.id === id ? { ...d, etape } : d)),
    );
    setError(null);
    void changeEtapeProduction({ id, etape }).then((result) => {
      if (!result.ok) {
        setDossiers(precedent);
        setError(messageErreur(t, result.error));
      }
    });
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    dragEndedAt.current = Date.now();
    if (!event.over) return;
    deplacer(String(event.active.id), event.over.id as EtapeProduction);
  }

  const actif = activeId
    ? (dossiers.find((d) => d.id === activeId) ?? null)
    : null;

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm font-medium text-rouge">
          {error}
        </p>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-3">
          <div className="flex min-w-max gap-3">
            {ETAPES_PRODUCTION.map((etape) => (
              <Colonne
                key={etape}
                etape={etape}
                dossiers={parEtape.get(etape) ?? []}
                onDeplacer={deplacer}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {actif ? <Carte dossier={actif} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Colonne({
  etape,
  dossiers,
  onDeplacer,
}: {
  etape: EtapeProduction;
  dossiers: ClientActifDetail[];
  onDeplacer: (id: string, etape: EtapeProduction) => void;
}) {
  const t = useTranslations();
  const { setNodeRef, isOver } = useDroppable({ id: etape });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[16.5rem] shrink-0 flex-col rounded-3xl border border-border bg-card/60 p-3 transition-colors",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <header className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold">
          {t(`production.etapes.${etape}`)}
        </h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">
          {dossiers.length}
        </span>
      </header>

      <div className="flex flex-col gap-2">
        {dossiers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {t("production.empty")}
          </p>
        ) : (
          dossiers.map((d) => (
            <Carte key={d.id} dossier={d} onDeplacer={onDeplacer} />
          ))
        )}
      </div>
    </section>
  );
}

function Carte({
  dossier,
  overlay = false,
  onDeplacer,
}: {
  dossier: ClientActifDetail;
  overlay?: boolean;
  onDeplacer?: (id: string, etape: EtapeProduction) => void;
}) {
  const t = useTranslations();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dossier.id,
    disabled: overlay,
  });

  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      className={cn(
        "rounded-2xl border border-border bg-card p-3 shadow-sm",
        isDragging && "opacity-40",
        overlay && "rotate-2 shadow-lg",
      )}
    >
      <div
        {...(overlay ? {} : listeners)}
        {...(overlay ? {} : attributes)}
        className={cn("min-w-0", !overlay && "cursor-grab active:cursor-grabbing")}
      >
        <p className="truncate font-medium">{dossier.client_nom}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {dossier.reference}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {dossier.ville && <Badge variant="outline">{dossier.ville}</Badge>}
          {dossier.budget_estimatif !== null && (
            <Badge variant="outline">{formatDT(dossier.budget_estimatif)}</Badge>
          )}
        </div>
        {dossier.remarques && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <StickyNote aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
            <span className="line-clamp-2">{dossier.remarques}</span>
          </p>
        )}
      </div>

      {!overlay && (
        <div className="mt-2 flex items-center justify-between gap-1 border-t border-border pt-2">
          <Link
            href={`/fiches/${dossier.fiche_id}`}
            className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <ExternalLink aria-hidden="true" className="size-3" />
            {t("production.voirDossier")}
          </Link>

          {/* Le clavier et le tactile ont besoin d'un chemin sans glisser. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                {t("production.deplacer")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("production.deplacer")}</DropdownMenuLabel>
              {ETAPES_PRODUCTION.filter((e) => e !== dossier.etape).map((e) => (
                <DropdownMenuItem
                  key={e}
                  onSelect={() => onDeplacer?.(dossier.id, e)}
                >
                  {t(`production.etapes.${e}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </article>
  );
}
