"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { GripVertical, Plus, Search } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { changeStage } from "@/lib/actions/fiche-actions";
import type { FicheRow } from "@/lib/database.types";
import {
  ALL_STAGES,
  MOTIFS_PERTE,
  type MotifPerte,
  type StageOrPerdu,
} from "@/lib/domain";
import { formatDate } from "@/lib/dates";
import { cn, formatDT } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";

export type StageBadgeVariant =
  | "default"
  | "rouge"
  | "chene"
  | "vert"
  | "ambre"
  | "outline";

/** Shared stage → Badge variant mapping for fiche lists. */
export function stageBadgeVariant(stage: StageOrPerdu): StageBadgeVariant {
  switch (stage) {
    case "signe":
      return "vert";
    case "perdu":
      return "rouge";
    case "devis_envoye":
    case "negociation":
      return "chene";
    case "nouveau_contact":
    case "contacte":
      return "default";
    default:
      return "outline";
  }
}

function nameInitials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function ProjectChips({ fiche }: { fiche: FicheRow }) {
  const t = useTranslations();
  const chips: string[] = [];
  if (fiche.nb_cuisines > 0) {
    chips.push(t("pipeline.projectChips.cuisine", { n: fiche.nb_cuisines }));
  }
  if (fiche.nb_dressings > 0) {
    chips.push(t("pipeline.projectChips.dressing", { n: fiche.nb_dressings }));
  }
  if (fiche.nb_sdb > 0) {
    chips.push(t("pipeline.projectChips.sdb", { n: fiche.nb_sdb }));
  }
  if (chips.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip) => (
        <span
          key={chip}
          className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function Completude({ score }: { score: number }) {
  const t = useTranslations();
  return (
    <div className="mt-1 flex items-center gap-2">
      <Progress
        value={score}
        className="h-1.5 w-20"
        aria-label={t("fiches.completude")}
      />
      <span className="text-xs tabular-nums text-muted-foreground">
        {score}%
      </span>
    </div>
  );
}

function ConseillerCell({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-7">
        <AvatarFallback>{nameInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="whitespace-nowrap text-sm">{name}</span>
    </div>
  );
}

const CELL = "border-e border-border px-4 py-3 align-top last:border-e-0";

/**
 * Fiches as a gridded table, grouped by étape: each group is a drop target —
 * drag a row onto another group to move the lead through the pipeline.
 */
export function FichesList({
  fiches: initialFiches,
  conseillers,
}: {
  fiches: FicheRow[];
  conseillers: Record<string, string>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [fiches, setFiches] = useState(initialFiches);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingPerte, setPendingPerte] = useState<string | null>(null);
  const [motif, setMotif] = useState<MotifPerte | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fiches;
    return fiches.filter((f) => {
      const haystack = [
        f.client_nom,
        f.reference,
        f.tel_mobile ?? "",
        f.tel_domicile ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [fiches, query]);

  const byStage = useMemo(() => {
    const map = new Map<StageOrPerdu, FicheRow[]>();
    for (const stage of ALL_STAGES) map.set(stage, []);
    for (const f of filtered) map.get(f.stage)?.push(f);
    return map;
  }, [filtered]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  function applyStage(
    ficheId: string,
    stage: StageOrPerdu,
    motifPerte: MotifPerte | null,
  ) {
    const previous = fiches;
    setFiches((list) =>
      list.map((f) =>
        f.id === ficheId ? { ...f, stage, motif_perte: motifPerte } : f,
      ),
    );
    setError(null);
    void changeStage({ fiche_id: ficheId, stage, motif_perte: motifPerte }).then(
      (result) => {
        if (!result.ok) {
          setFiches(previous);
          setError(
            result.error === "demo_mode"
              ? t("app.demoReadOnly")
              : t("app.error"),
          );
        }
      },
    );
  }

  function requestMove(ficheId: string, stage: StageOrPerdu) {
    const fiche = fiches.find((f) => f.id === ficheId);
    if (!fiche || fiche.stage === stage) return;
    if (stage === "perdu") {
      setMotif(null);
      setPendingPerte(ficheId);
      return;
    }
    applyStage(ficheId, stage, null);
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over) return;
    requestMove(String(event.active.id), event.over.id as StageOrPerdu);
  }

  const activeFiche = activeId
    ? (fiches.find((f) => f.id === activeId) ?? null)
    : null;

  if (fiches.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("fiches.empty")}
        </p>
        <Link href="/fiches/nouvelle" className={buttonVariants()}>
          <Plus />
          {t("fiches.new")}
        </Link>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Label htmlFor="fiche-search" className="sr-only">
            {t("fiches.searchPlaceholder")}
          </Label>
          <Search
            aria-hidden
            className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="fiche-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("fiches.searchPlaceholder")}
            className="rounded-full ps-11"
          />
        </div>
        <span className="rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground">
          {t("fiches.count", { count: filtered.length })}
        </span>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-rouge">
          {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {t("fiches.emptyFiltered")}
          </p>
        </Card>
      ) : (
        <DndContext
          id="fiches-dnd"
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          {/* Desktop: gridded table grouped by étape */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className={cn(CELL, "w-8 py-3")} aria-hidden />
                  <th className={cn(CELL, "text-start font-medium")}>
                    {t("fiches.columns.client")}
                  </th>
                  <th className={cn(CELL, "text-start font-medium")}>
                    {t("fiches.columns.ville")}
                  </th>
                  <th className={cn(CELL, "text-start font-medium")}>
                    {t("fiches.columns.projet")}
                  </th>
                  <th className={cn(CELL, "text-start font-medium")}>
                    {t("fiches.columns.budget")}
                  </th>
                  <th className={cn(CELL, "text-start font-medium")}>
                    {t("fiches.columns.conseiller")}
                  </th>
                  <th className={cn(CELL, "text-start font-medium")}>
                    {t("fiches.columns.date")}
                  </th>
                </tr>
              </thead>
              {ALL_STAGES.map((stage) => (
                <StageGroup
                  key={stage}
                  stage={stage}
                  fiches={byStage.get(stage) ?? []}
                  conseillers={conseillers}
                  locale={locale}
                  onOpen={(id) => router.push(`/fiches/${id}`)}
                />
              ))}
            </table>
          </Card>

          <DragOverlay>
            {activeFiche && (
              <div className="neo flex items-center gap-3 rounded-2xl bg-card px-4 py-2.5 text-sm shadow-xl">
                <GripVertical className="size-4 text-muted-foreground" />
                <span className="font-medium">{activeFiche.client_nom}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {activeFiche.reference}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Mobile: stacked cards (stage change via fiche detail / pipeline) */}
      {filtered.length > 0 && (
        <ul className="space-y-3 md:hidden">
          {filtered.map((f) => {
            const conseiller = conseillers[f.conseiller_id] ?? "—";
            return (
              <li key={f.id}>
                <Link
                  href={`/fiches/${f.id}`}
                  className="card-lift block rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{f.client_nom}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {f.reference}
                      </p>
                    </div>
                    <Badge variant={stageBadgeVariant(f.stage)}>
                      {t(`stages.${f.stage}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {f.ville ?? "—"} ·{" "}
                    {formatDate(f.created_at, "d MMM yyyy", locale)}
                  </p>
                  <div className="mt-2">
                    <ProjectChips fiche={f} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <ConseillerCell name={conseiller} />
                    <span className="font-mono text-sm">
                      {formatDT(f.budget_estimatif)}
                    </span>
                  </div>
                  <Completude score={f.score_completude} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Motif de perte — mandatory when dropping into Perdu */}
      <Dialog
        open={pendingPerte !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPerte(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("motifsPerte.title")}</DialogTitle>
            <DialogDescription>{t("motifsPerte.prompt")}</DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={motif ?? ""}
            onValueChange={(v) => setMotif(v as MotifPerte)}
            className="gap-2"
          >
            {MOTIFS_PERTE.map((m) => (
              <RadioCard key={m} value={m}>
                {t(`motifsPerte.${m}`)}
              </RadioCard>
            ))}
          </RadioGroup>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPendingPerte(null)}>
              {t("app.cancel")}
            </Button>
            <Button
              disabled={!motif}
              onClick={() => {
                if (pendingPerte && motif) {
                  applyStage(pendingPerte, "perdu", motif);
                  setPendingPerte(null);
                }
              }}
            >
              {t("app.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StageGroup({
  stage,
  fiches,
  conseillers,
  locale,
  onOpen,
}: {
  stage: StageOrPerdu;
  fiches: FicheRow[];
  conseillers: Record<string, string>;
  locale: string;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations();
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = fiches.reduce((sum, f) => sum + (f.budget_estimatif ?? 0), 0);

  return (
    <tbody
      ref={setNodeRef}
      className={cn(
        "border-b border-border transition-colors last:border-b-0",
        isOver &&
          "bg-chene/10 outline outline-2 -outline-offset-2 outline-chene/60",
      )}
    >
      <tr className="bg-secondary/30">
        <td colSpan={7} className="px-4 py-2">
          <span className="flex items-center gap-2">
            <Badge variant={stageBadgeVariant(stage)}>
              {t(`stages.${stage}`)}
            </Badge>
            <span className="rounded-full bg-secondary px-2 font-mono text-xs text-muted-foreground">
              {fiches.length}
            </span>
            {total > 0 && (
              <span className="ms-auto font-mono text-xs text-muted-foreground">
                {formatDT(total)}
              </span>
            )}
          </span>
        </td>
      </tr>
      {fiches.length === 0 ? (
        <tr>
          <td
            colSpan={7}
            className="px-4 py-2.5 text-xs italic text-muted-foreground"
          >
            {t("pipeline.emptyColumn")}
          </td>
        </tr>
      ) : (
        fiches.map((f) => (
          <DraggableRow
            key={f.id}
            fiche={f}
            conseiller={conseillers[f.conseiller_id] ?? "—"}
            locale={locale}
            onOpen={onOpen}
          />
        ))
      )}
    </tbody>
  );
}

function DraggableRow({
  fiche,
  conseiller,
  locale,
  onOpen,
}: {
  fiche: FicheRow;
  conseiller: string;
  locale: string;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: fiche.id,
  });

  return (
    <tr
      ref={setNodeRef}
      onClick={() => onOpen(fiche.id)}
      className={cn(
        "cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-secondary/50",
        isDragging && "opacity-40",
      )}
    >
      <td className={cn(CELL, "w-8 px-2")}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label={`${t("fiches.columns.stage")} — ${fiche.client_nom}`}
          className="grid size-7 cursor-grab place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      </td>
      <td className={CELL}>
        <Link
          href={`/fiches/${fiche.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-semibold hover:underline"
        >
          {fiche.client_nom}
        </Link>
        <p className="font-mono text-xs text-muted-foreground">
          {fiche.reference}
        </p>
        <Completude score={fiche.score_completude} />
      </td>
      <td className={CELL}>{fiche.ville ?? "—"}</td>
      <td className={CELL}>
        <ProjectChips fiche={fiche} />
      </td>
      <td className={cn(CELL, "font-mono")}>
        {formatDT(fiche.budget_estimatif)}
      </td>
      <td className={CELL}>
        <ConseillerCell name={conseiller} />
      </td>
      <td className={cn(CELL, "whitespace-nowrap text-muted-foreground")}>
        {formatDate(fiche.created_at, "d MMM yyyy", locale)}
      </td>
    </tr>
  );
}
