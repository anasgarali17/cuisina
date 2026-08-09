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
import { ChevronRight, Download, GripVertical, Plus, Search } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { changeStage } from "@/lib/actions/fiche-actions";
import type { FicheRow, PointDeVenteRow } from "@/lib/database.types";
import { ALL_STAGES, type StageOrPerdu } from "@/lib/domain";
import { STAGE_CHIP, stageProgress } from "@/lib/stage-ui";
import {
  EMPTY_REASON,
  StageReasonDialog,
  type StageReason,
} from "@/components/pipeline/stage-reason-dialog";
import { formatDate } from "@/lib/dates";
import { cn, formatDT } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

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

function StageChip({ stage }: { stage: StageOrPerdu }) {
  const t = useTranslations();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STAGE_CHIP[stage],
      )}
    >
      <span aria-hidden className="text-[8px] leading-none">
        ●
      </span>
      {t(`stages.${stage}`)}
    </span>
  );
}

function gradeOf(score: number): { letter: string; className: string } {
  if (score >= 85) return { letter: "A", className: "bg-emerald-500" };
  if (score >= 70) return { letter: "B", className: "bg-lime-500" };
  if (score >= 50) return { letter: "C", className: "bg-amber-500" };
  return { letter: "D", className: "bg-red-400" };
}

function GradeBadge({ score }: { score: number }) {
  const grade = gradeOf(score);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-semibold tabular-nums">{score}</span>
      <span
        aria-hidden
        className={cn(
          "grid size-5 place-items-center rounded-md text-[11px] font-bold text-white",
          grade.className,
        )}
      >
        {grade.letter}
      </span>
    </span>
  );
}

function MetricCell({ value }: { value: number }) {
  return (
    <div className="min-w-20 max-w-28">
      <p className="whitespace-nowrap">
        <span className="font-semibold tabular-nums">{value}</span>
        <span className="ms-0.5 text-xs text-muted-foreground">%</span>
      </p>
      <div
        aria-hidden
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
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

function FilterPill({
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
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className="h-10 w-auto min-w-36 rounded-xl border-border bg-card text-sm"
      >
        <span className="text-muted-foreground">{label}</span>
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
  );
}

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CELL = "px-4 py-4 align-middle";

/**
 * Fiches as a table grouped by étape: each group is a drop target —
 * drag a row onto another group to move the lead through the pipeline.
 */
export function FichesList({
  fiches: initialFiches,
  conseillers,
  pdvs,
}: {
  fiches: FicheRow[];
  conseillers: Record<string, string>;
  pdvs: PointDeVenteRow[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [fiches, setFiches] = useState(initialFiches);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>(ALL);
  const [conseillerFilter, setConseillerFilter] = useState<string>(ALL);
  const [pdvFilter, setPdvFilter] = useState<string>(ALL);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    ficheId: string;
    stage: "perdu" | "en_pause";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fiches.filter((f) => {
      if (stageFilter !== ALL && f.stage !== stageFilter) return false;
      if (conseillerFilter !== ALL && f.conseiller_id !== conseillerFilter)
        return false;
      if (pdvFilter !== ALL && f.point_de_vente_id !== pdvFilter) return false;
      if (!q) return true;
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
  }, [fiches, query, stageFilter, conseillerFilter, pdvFilter]);

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

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function exportCsv() {
    const header = [
      t("fiches.reference"),
      t("fiches.columns.client"),
      t("fiches.columns.ville"),
      t("fiches.columns.stage"),
      t("fiches.columns.budget"),
      t("fiches.table.score"),
      t("fiches.columns.conseiller"),
      t("fiches.columns.date"),
    ];
    const rows = filtered.map((f) => [
      f.reference,
      f.client_nom,
      f.ville ?? "",
      t(`stages.${f.stage}`),
      f.budget_estimatif ?? "",
      f.score_completude,
      conseillers[f.conseiller_id] ?? "",
      f.created_at.slice(0, 10),
    ]);
    const csv =
      "\uFEFF" +
      [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fiches.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function applyStage(
    ficheId: string,
    stage: StageOrPerdu,
    reason: StageReason = EMPTY_REASON,
  ) {
    const previous = fiches;
    setFiches((list) =>
      list.map((f) =>
        f.id === ficheId
          ? {
              ...f,
              stage,
              motif_perte: reason.motif_perte,
              motif_perte_libre: reason.motif_perte_libre || null,
              motif_pause: reason.motif_pause,
              motif_pause_detail: reason.motif_pause_detail || null,
              pause_cadence_jours: reason.pause_cadence_jours,
            }
          : f,
      ),
    );
    setError(null);
    void changeStage({ fiche_id: ficheId, stage, ...reason }).then((result) => {
      if (!result.ok) {
        setFiches(previous);
        setError(
          result.error === "demo_mode" ? t("app.demoReadOnly") : t("app.error"),
        );
      }
    });
  }

  function requestMove(ficheId: string, stage: StageOrPerdu) {
    const fiche = fiches.find((f) => f.id === ficheId);
    if (!fiche || fiche.stage === stage) return;
    if (stage === "perdu" || stage === "en_pause") {
      setPending({ ficheId, stage });
      return;
    }
    applyStage(ficheId, stage);
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
      {/* Top bar: search + filter pills + export */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
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
            className="h-10 rounded-xl ps-11"
          />
        </div>
        <FilterPill
          label={t("fiches.columns.stage")}
          value={stageFilter}
          onChange={setStageFilter}
          options={ALL_STAGES.map((s) => ({
            value: s,
            label: t(`stages.${s}`),
          }))}
          allLabel={t("pipeline.filters.all")}
        />
        <FilterPill
          label={t("pipeline.filters.conseiller")}
          value={conseillerFilter}
          onChange={setConseillerFilter}
          options={Object.entries(conseillers).map(([id, name]) => ({
            value: id,
            label: name,
          }))}
          allLabel={t("pipeline.filters.all")}
        />
        <FilterPill
          label={t("pipeline.filters.pointDeVente")}
          value={pdvFilter}
          onChange={setPdvFilter}
          options={pdvs.map((p) => ({ value: p.id, label: p.nom }))}
          allLabel={t("pipeline.filters.all")}
        />
        <span className="rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground">
          {t("fiches.count", { count: filtered.length })}
        </span>
        <button
          type="button"
          onClick={exportCsv}
          className="ms-auto inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <Download aria-hidden className="size-4" />
          {t("fiches.table.exportList")}
        </button>
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
          {/* Desktop: airy table grouped by étape */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-16 px-4 py-3" aria-hidden />
                    <th className="px-4 py-3 text-start font-medium">
                      {t("fiches.columns.client")}
                    </th>
                    <th className="px-4 py-3 text-start font-medium">
                      {t("fiches.columns.ville")}
                    </th>
                    <th className="px-4 py-3 text-start font-medium">
                      {t("fiches.columns.projet")}
                    </th>
                    <th className="px-4 py-3 text-start font-medium">
                      {t("fiches.columns.budget")}
                    </th>
                    <th className="px-4 py-3 text-start font-medium">
                      {t("fiches.table.score")}
                    </th>
                    <th className="px-4 py-3 text-start font-medium">
                      {t("fiches.table.avancement")}
                    </th>
                    <th className="px-4 py-3 text-start font-medium">
                      {t("fiches.columns.conseiller")}
                    </th>
                    <th className="px-4 py-3 text-start font-medium">
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
                    expandedIds={expanded}
                    onToggle={toggleExpanded}
                    onOpen={(id) => router.push(`/fiches/${id}`)}
                  />
                ))}
              </table>
            </div>
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
                    <StageChip stage={f.stage} />
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
                    <span className="font-semibold tabular-nums text-sm">
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

      {/* Why the fiche left the funnel — mandatory for perdu and en pause */}
      <StageReasonDialog
        mode={pending?.stage ?? null}
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        onConfirm={(reason) => {
          if (pending) {
            applyStage(pending.ficheId, pending.stage, reason);
            setPending(null);
          }
        }}
      />
    </div>
  );
}

function StageGroup({
  stage,
  fiches,
  conseillers,
  locale,
  expandedIds,
  onToggle,
  onOpen,
}: {
  stage: StageOrPerdu;
  fiches: FicheRow[];
  conseillers: Record<string, string>;
  locale: string;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
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
        <td colSpan={9} className="px-4 py-2">
          <span className="flex items-center gap-2">
            <StageChip stage={stage} />
            <span className="rounded-full bg-secondary px-2 font-mono text-xs text-muted-foreground">
              {fiches.length}
            </span>
            {total > 0 && (
              <span className="ms-auto font-semibold tabular-nums text-xs text-muted-foreground">
                {formatDT(total)}
              </span>
            )}
          </span>
        </td>
      </tr>
      {fiches.length === 0 ? (
        <tr>
          <td
            colSpan={9}
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
            expanded={expandedIds.has(f.id)}
            onToggle={onToggle}
            onOpen={onOpen}
          />
        ))
      )}
    </tbody>
  );
}

function DetailField({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5", mono && "font-mono")}>{value || "—"}</p>
    </div>
  );
}

function DraggableRow({
  fiche,
  conseiller,
  locale,
  expanded,
  onToggle,
  onOpen,
}: {
  fiche: FicheRow;
  conseiller: string;
  locale: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: fiche.id,
  });

  return (
    <>
      <tr
        ref={setNodeRef}
        onClick={() => onOpen(fiche.id)}
        className={cn(
          "cursor-pointer border-b border-border transition-colors hover:bg-secondary/40",
          !expanded && "last:border-b-0",
          isDragging && "opacity-40",
        )}
      >
        <td className="w-16 px-2 py-4 align-middle">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(fiche.id);
              }}
              aria-expanded={expanded}
              aria-label={`${t("app.seeAll")} — ${fiche.client_nom}`}
              className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ChevronRight
                aria-hidden
                className={cn(
                  "size-4 transition-transform",
                  expanded ? "rotate-90" : "rtl:rotate-180",
                )}
              />
            </button>
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
          </div>
        </td>
        <td className={CELL}>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold"
            >
              {nameInitials(fiche.client_nom)}
            </span>
            <div className="min-w-0">
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
            </div>
          </div>
        </td>
        <td className={CELL}>{fiche.ville ?? "—"}</td>
        <td className={CELL}>
          <ProjectChips fiche={fiche} />
        </td>
        <td className={cn(CELL, "whitespace-nowrap font-semibold tabular-nums")}>
          {formatDT(fiche.budget_estimatif)}
        </td>
        <td className={CELL}>
          <GradeBadge score={fiche.score_completude} />
        </td>
        <td className={CELL}>
          <MetricCell value={stageProgress(fiche.stage)} />
        </td>
        <td className={CELL}>
          <ConseillerCell name={conseiller} />
        </td>
        <td className={cn(CELL, "whitespace-nowrap text-muted-foreground")}>
          {formatDate(fiche.created_at, "d MMM yyyy", locale)}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border last:border-b-0">
          <td colSpan={9} className="p-0">
            <div className="grid gap-4 bg-secondary/30 px-6 py-4 text-sm sm:grid-cols-3">
              <DetailField
                label={t("fiches.wizard.telMobile")}
                value={fiche.tel_mobile}
                mono
              />
              <DetailField
                label={t("fiches.wizard.email")}
                value={fiche.email}
              />
              <DetailField
                label={t("fiches.wizard.adresse")}
                value={fiche.adresse_complete}
              />
              <DetailField
                label={t("fiches.wizard.budget")}
                value={formatDT(fiche.budget_estimatif)}
              />
              <DetailField
                label={t("fiches.wizard.observations")}
                value={fiche.observations}
                className="sm:col-span-2"
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
