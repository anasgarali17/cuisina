"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
import { MoreHorizontal } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { changeStage } from "@/lib/actions/fiche-actions";
import {
  ALL_STAGES,
  MOTIFS_PERTE,
  ORIGINES,
  STAGES,
  type MotifPerte,
  type Role,
  type Stage,
  type StageOrPerdu,
} from "@/lib/domain";
import type { FicheRow, PointDeVenteRow, ProfileRow } from "@/lib/database.types";
import { cn, formatDT, initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

interface Filters {
  conseiller: string;
  pdv: string;
  origine: string;
  from: string;
  to: string;
  types: { cuisine: boolean; dressing: boolean; sdb: boolean };
}

const EMPTY_FILTERS: Filters = {
  conseiller: ALL,
  pdv: ALL,
  origine: ALL,
  from: "",
  to: "",
  types: { cuisine: false, dressing: false, sdb: false },
};

interface PendingPerte {
  ficheId: string;
  fromStage: StageOrPerdu;
}

export function KanbanBoard({
  fiches: initialFiches,
  profiles,
  pdvs,
  overdueFicheIds,
  role,
}: {
  fiches: FicheRow[];
  profiles: ProfileRow[];
  pdvs: PointDeVenteRow[];
  overdueFicheIds: string[];
  role: Role;
}) {
  const t = useTranslations();
  const [fiches, setFiches] = useState(initialFiches);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingPerte, setPendingPerte] = useState<PendingPerte | null>(null);
  const [motif, setMotif] = useState<MotifPerte | null>(null);
  const [error, setError] = useState<string | null>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());

  const overdue = useMemo(() => new Set(overdueFicheIds), [overdueFicheIds]);
  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );
  const conseillerOptions = profiles.filter((p) => p.role === "conseiller");
  const canFilterPeople = role !== "conseiller";

  const filtered = useMemo(() => {
    return fiches.filter((f) => {
      if (filters.conseiller !== ALL && f.conseiller_id !== filters.conseiller)
        return false;
      if (filters.pdv !== ALL && f.point_de_vente_id !== filters.pdv)
        return false;
      if (filters.origine !== ALL && f.origine !== filters.origine) return false;
      if (filters.from && f.created_at.slice(0, 10) < filters.from) return false;
      if (filters.to && f.created_at.slice(0, 10) > filters.to) return false;
      const anyType =
        filters.types.cuisine || filters.types.dressing || filters.types.sdb;
      if (anyType) {
        const match =
          (filters.types.cuisine && f.nb_cuisines > 0) ||
          (filters.types.dressing && f.nb_dressings > 0) ||
          (filters.types.sdb && f.nb_sdb > 0);
        if (!match) return false;
      }
      return true;
    });
  }, [fiches, filters]);

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
      setPendingPerte({ ficheId, fromStage: fiche.stage });
      return;
    }
    applyStage(ficheId, stage, null);
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const over = event.over;
    if (!over) return;
    requestMove(String(event.active.id), over.id as StageOrPerdu);
  }

  const activeFiche = activeId
    ? (fiches.find((f) => f.id === activeId) ?? null)
    : null;

  function scrollToColumn(stage: string) {
    columnRefs.current
      .get(stage)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-2">
        {canFilterPeople && (
          <>
            <FilterSelect
              label={t("pipeline.filters.conseiller")}
              value={filters.conseiller}
              onChange={(v) => setFilters({ ...filters, conseiller: v })}
              options={conseillerOptions.map((p) => ({
                value: p.id,
                label: `${p.prenom} ${p.nom}`,
              }))}
              allLabel={t("pipeline.filters.all")}
            />
            <FilterSelect
              label={t("pipeline.filters.pointDeVente")}
              value={filters.pdv}
              onChange={(v) => setFilters({ ...filters, pdv: v })}
              options={pdvs.map((p) => ({ value: p.id, label: p.nom }))}
              allLabel={t("pipeline.filters.all")}
            />
          </>
        )}
        <FilterSelect
          label={t("pipeline.filters.origine")}
          value={filters.origine}
          onChange={(v) => setFilters({ ...filters, origine: v })}
          options={ORIGINES.map((o) => ({
            value: o,
            label: t(`origines.${o}`),
          }))}
          allLabel={t("pipeline.filters.all")}
        />
        <div className="space-y-1">
          <Label htmlFor="flt-from" className="text-xs text-muted-foreground">
            {t("pipeline.filters.periode")}
          </Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="flt-from"
              type="date"
              className="h-9 w-36 text-xs"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
            <Input
              aria-label={t("pipeline.filters.periode")}
              type="date"
              className="h-9 w-36 text-xs"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {(
            [
              ["cuisine", t("pipeline.filters.cuisine")],
              ["dressing", t("pipeline.filters.dressing")],
              ["sdb", t("pipeline.filters.sdb")],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filters.types[key]}
              onClick={() =>
                setFilters({
                  ...filters,
                  types: { ...filters.types, [key]: !filters.types[key] },
                })
              }
              className={cn(
                "h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                filters.types[key]
                  ? "border-rouge bg-rouge/5 text-rouge"
                  : "border-border bg-card text-muted-foreground hover:border-chene/60",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters(EMPTY_FILTERS)}
        >
          {t("pipeline.filters.reset")}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-rouge">
          {error}
        </p>
      )}

      {/* Mobile stage pills */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
        {STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            onClick={() => scrollToColumn(stage)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
          >
            {t(`stages.${stage}`)}
            <span className="rounded-full bg-secondary px-1.5 font-mono text-[10px]">
              {byStage.get(stage)?.length ?? 0}
            </span>
          </button>
        ))}
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="kanban-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              fiches={byStage.get(stage) ?? []}
              profileById={profileById}
              overdue={overdue}
              onMove={requestMove}
              refCallback={(el) => {
                if (el) columnRefs.current.set(stage, el);
              }}
            />
          ))}
        </div>

        {/* Perdu lane */}
        <PerduLane
          fiches={byStage.get("perdu") ?? []}
          profileById={profileById}
          overdue={overdue}
          onMove={requestMove}
        />

        <DragOverlay>
          {activeFiche && (
            <FicheCard
              fiche={activeFiche}
              profileById={profileById}
              overdue={overdue}
              onMove={() => undefined}
              overlay
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* Motif de perte — mandatory */}
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
                  applyStage(pendingPerte.ficheId, "perdu", motif);
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <div className="space-y-1">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-44 text-xs" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function KanbanColumn({
  stage,
  fiches,
  profileById,
  overdue,
  onMove,
  refCallback,
}: {
  stage: Stage;
  fiches: FicheRow[];
  profileById: Map<string, ProfileRow>;
  overdue: Set<string>;
  onMove: (ficheId: string, stage: StageOrPerdu) => void;
  refCallback: (el: HTMLDivElement | null) => void;
}) {
  const t = useTranslations();
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = fiches.reduce((sum, f) => sum + (f.budget_estimatif ?? 0), 0);

  return (
    <div
      ref={refCallback}
      className="w-[85vw] shrink-0 snap-center sm:w-80 md:w-72 md:snap-align-none"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold">
          {t(`stages.${stage}`)}{" "}
          <span className="font-mono text-xs text-muted-foreground">
            {fiches.length}
          </span>
        </h2>
        {total > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatDT(total)}
          </span>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-36 space-y-2 rounded-2xl border border-transparent bg-brume/25 p-2 transition-colors",
          isOver && "border-chene/60 bg-chene/10",
        )}
      >
        {fiches.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs italic text-muted-foreground">
            {t("pipeline.emptyColumn")}
          </p>
        ) : (
          fiches.map((f) => (
            <DraggableFicheCard
              key={f.id}
              fiche={f}
              profileById={profileById}
              overdue={overdue}
              onMove={onMove}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PerduLane({
  fiches,
  profileById,
  overdue,
  onMove,
}: {
  fiches: FicheRow[];
  profileById: Map<string, ProfileRow>;
  overdue: Set<string>;
  onMove: (ficheId: string, stage: StageOrPerdu) => void;
}) {
  const t = useTranslations();
  const { setNodeRef, isOver } = useDroppable({ id: "perdu" });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mt-2 rounded-3xl border-2 border-dashed border-border p-4 transition-colors",
        isOver && "border-ambre bg-ambre/5",
      )}
    >
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        {t("pipeline.perduLane")}{" "}
        <span className="font-mono text-xs">{fiches.length}</span>
      </h2>
      {fiches.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          {t("pipeline.emptyColumn")}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {fiches.map((f) => (
            <DraggableFicheCard
              key={f.id}
              fiche={f}
              profileById={profileById}
              overdue={overdue}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DraggableFicheCard(props: {
  fiche: FicheRow;
  profileById: Map<string, ProfileRow>;
  overdue: Set<string>;
  onMove: (ficheId: string, stage: StageOrPerdu) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.fiche.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(isDragging && "opacity-40")}
    >
      <FicheCard {...props} />
    </div>
  );
}

function FicheCard({
  fiche,
  profileById,
  overdue,
  onMove,
  overlay,
}: {
  fiche: FicheRow;
  profileById: Map<string, ProfileRow>;
  overdue: Set<string>;
  onMove: (ficheId: string, stage: StageOrPerdu) => void;
  overlay?: boolean;
}) {
  const t = useTranslations();
  const conseiller = profileById.get(fiche.conseiller_id);
  const chips: string[] = [];
  if (fiche.nb_cuisines > 0)
    chips.push(t("pipeline.projectChips.cuisine", { n: fiche.nb_cuisines }));
  if (fiche.nb_dressings > 0)
    chips.push(t("pipeline.projectChips.dressing", { n: fiche.nb_dressings }));
  if (fiche.nb_sdb > 0)
    chips.push(t("pipeline.projectChips.sdb", { n: fiche.nb_sdb }));

  return (
    <div
      className={cn(
        "card-lift cursor-grab rounded-2xl border border-border bg-card p-3",
        overlay && "rotate-2 shadow-xl",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/fiches/${fiche.id}`}
            onPointerDown={(e) => e.stopPropagation()}
            className="block truncate text-sm font-medium hover:underline"
          >
            {fiche.client_nom}
          </Link>
          <p className="text-xs text-muted-foreground">{fiche.ville ?? "—"}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={t("fiches.columns.stage")}
              className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("fiches.columns.stage")}</DropdownMenuLabel>
            {ALL_STAGES.map((s) => (
              <DropdownMenuItem
                key={s}
                disabled={s === fiche.stage}
                onSelect={() => onMove(fiche.id, s)}
              >
                {t(`stages.${s}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        {fiche.reference}
      </p>

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      {fiche.motif_perte && (
        <p className="mt-2 text-[10px] font-medium text-ambre">
          {t(`motifsPerte.${fiche.motif_perte}`)}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="font-mono text-xs">
          {formatDT(fiche.budget_estimatif)}
        </span>
        <span className="flex items-center gap-1.5">
          {overdue.has(fiche.id) && (
            <span
              className="size-2 rounded-full bg-ambre"
              role="img"
              aria-label={t("pipeline.relanceOverdue")}
              title={t("pipeline.relanceOverdue")}
            />
          )}
          <Avatar className="size-6">
            <AvatarFallback className="text-[9px]">
              {conseiller ? initials(conseiller.nom, conseiller.prenom) : "?"}
            </AvatarFallback>
          </Avatar>
        </span>
      </div>
    </div>
  );
}
