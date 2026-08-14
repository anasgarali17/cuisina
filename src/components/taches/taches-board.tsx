"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  GripVertical,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  createTache,
  toggleTache,
  updateTacheEcheance,
} from "@/lib/actions/tache-actions";
import { formatDate, startOfToday, toISODate } from "@/lib/dates";
import { PRIORITES, type Canal, type Priorite } from "@/lib/domain";
import type { ProfileRow, TacheRow } from "@/lib/database.types";
import { cn, messageErreur } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { RelanceDialog } from "@/components/fiches/relance-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const CANAL_ICONS: Record<Canal, typeof Phone> = {
  whatsapp: MessageCircle,
  appel: Phone,
  sms: MessageSquare,
  email: Mail,
  visite: MapPin,
};

const NONE = "__none__";

type ColumnKey = "retard" | "aujourdhui" | "semaine" | "plusTard" | "fait";
const COLUMNS: ColumnKey[] = ["retard", "aujourdhui", "semaine", "plusTard", "fait"];

interface FicheRef {
  reference: string;
  client: string;
}

/** The representative due date a drop into a date column assigns. */
function dateForColumn(col: "aujourdhui" | "semaine" | "plusTard"): string {
  const d = startOfToday();
  if (col === "semaine") d.setDate(d.getDate() + 3);
  if (col === "plusTard") d.setDate(d.getDate() + 10);
  return toISODate(d);
}

function bucketOf(task: TacheRow, today: Date, weekEnd: Date): ColumnKey {
  if (task.statut === "fait") return "fait";
  if (!task.echeance) return "plusTard";
  const due = new Date(task.echeance);
  if (due < today) return "retard";
  if (due.getTime() === today.getTime()) return "aujourdhui";
  if (due < weekEnd) return "semaine";
  return "plusTard";
}

/**
 * Mes Tâches as a kanban board, one column per time bucket — mirrors the
 * Pipeline: drag a task to reschedule it, or drop it on Fait to complete it.
 * En retard is read-only as a destination (there is no meaningful "make this
 * overdue on purpose"), but tasks still leave it by being dragged elsewhere.
 */
export function TachesBoard({
  taches: initialTaches,
  ficheMap,
  profiles,
  currentProfile,
}: {
  taches: TacheRow[];
  ficheMap: Record<string, FicheRef>;
  profiles: ProfileRow[];
  currentProfile: ProfileRow;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [taches, setTaches] = useState(initialTaches);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [relanceTask, setRelanceTask] = useState<TacheRow | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());

  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  const today = startOfToday();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const byColumn = useMemo(() => {
    const map: Record<ColumnKey, TacheRow[]> = {
      retard: [],
      aujourdhui: [],
      semaine: [],
      plusTard: [],
      fait: [],
    };
    for (const task of taches) map[bucketOf(task, today, weekEnd)].push(task);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taches]);

  // Not PointerSensor: on touch it races native scrolling and dies on
  // pointercancel. Touch goes through the long-press TouchSensor alone.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 10 },
    }),
  );

  function setStatut(id: string, statut: "a_faire" | "fait") {
    setTaches((list) =>
      list.map((task) => (task.id === id ? { ...task, statut } : task)),
    );
  }

  function onCheck(task: TacheRow, next: boolean) {
    setError(null);
    // A relance task completes through the relance flow, not a plain check.
    if (next && task.auto_generee && task.fiche_id) {
      setRelanceTask(task);
      return;
    }
    const previous = task.statut;
    setStatut(task.id, next ? "fait" : "a_faire");
    void toggleTache({ id: task.id, done: next }).then((result) => {
      if (!result.ok) {
        setStatut(task.id, previous);
        setError(
          messageErreur(t, result.error),
        );
      }
    });
  }

  function moveToDate(task: TacheRow, target: "aujourdhui" | "semaine" | "plusTard") {
    const previous = task;
    const newEcheance = dateForColumn(target);
    const reopening = task.statut === "fait";

    setTaches((list) =>
      list.map((tk) =>
        tk.id === task.id
          ? { ...tk, echeance: newEcheance, statut: reopening ? "a_faire" : tk.statut }
          : tk,
      ),
    );
    setError(null);

    const calls = [updateTacheEcheance({ id: task.id, echeance: newEcheance })];
    if (reopening) calls.push(toggleTache({ id: task.id, done: false }));

    void Promise.all(calls).then((results) => {
      if (results.some((r) => !r.ok)) {
        setTaches((list) => list.map((tk) => (tk.id === task.id ? previous : tk)));
        const failed = results.find((r) => !r.ok);
        setError(failed && !failed.ok ? messageErreur(t, failed.error) : null);
      }
    });
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const over = event.over;
    if (!over) return;
    const task = taches.find((tk) => tk.id === event.active.id);
    if (!task) return;
    const target = over.id as ColumnKey;
    const current = bucketOf(task, today, weekEnd);
    if (target === current) return;

    if (target === "fait") {
      onCheck(task, true);
      return;
    }
    if (target === "retard") return; // not a valid destination
    moveToDate(task, target);
  }

  function scrollToColumn(key: string) {
    columnRefs.current
      .get(key)
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  const activeTask = activeId ? (taches.find((tk) => tk.id === activeId) ?? null) : null;
  const hasAnything = taches.length > 0;

  return (
    <div>
      <PageHeader
        title={t("taches.title")}
        actions={
          <Button className="neo neo-hover" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("taches.new")}
          </Button>
        }
      />

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-rouge">
          {error}
        </p>
      )}

      {!hasAnything ? (
        <div className="grid min-h-[40vh] place-items-center rounded-3xl border border-dashed border-border bg-card/60">
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">{t("taches.empty")}</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t("taches.new")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile column pills */}
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
            {COLUMNS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => scrollToColumn(key)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
              >
                {key === "fait" ? t("taches.fait") : t(`taches.groups.${key}`)}
                <span className="rounded-full bg-secondary px-1.5 font-mono text-[10px]">
                  {byColumn[key].length}
                </span>
              </button>
            ))}
          </div>

          <DndContext
            id="taches-dnd"
            sensors={sensors}
            // Nearest column wins, so a card straddling two columns still
            // lands where the conseiller aimed instead of snapping back.
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <div className="kanban-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
              {COLUMNS.map((key) => (
                <TaskColumn
                  key={key}
                  colKey={key}
                  tasks={byColumn[key]}
                  ficheMap={ficheMap}
                  profileById={profileById}
                  currentUserId={currentProfile.id}
                  onCheck={onCheck}
                  refCallback={(el) => {
                    if (el) columnRefs.current.set(key, el);
                  }}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask && (
                <TaskCard
                  task={activeTask}
                  ficheMap={ficheMap}
                  profileById={profileById}
                  currentUserId={currentProfile.id}
                  overdue={bucketOf(activeTask, today, weekEnd) === "retard"}
                  done={activeTask.statut === "fait"}
                  onCheck={() => undefined}
                  overlay
                />
              )}
            </DragOverlay>
          </DndContext>
        </>
      )}

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        ficheMap={ficheMap}
        profiles={profiles}
        currentProfile={currentProfile}
        onCreated={() => router.refresh()}
      />

      {relanceTask && relanceTask.fiche_id && (
        <RelanceDialog
          ficheId={relanceTask.fiche_id}
          tacheId={relanceTask.id}
          defaultCanal={relanceTask.canal}
          open
          onOpenChange={(open) => {
            if (!open) setRelanceTask(null);
          }}
          onDone={() => {
            setStatut(relanceTask.id, "fait");
            setRelanceTask(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TaskColumn({
  colKey,
  tasks,
  ficheMap,
  profileById,
  currentUserId,
  onCheck,
  refCallback,
}: {
  colKey: ColumnKey;
  tasks: TacheRow[];
  ficheMap: Record<string, FicheRef>;
  profileById: Map<string, ProfileRow>;
  currentUserId: string;
  onCheck: (task: TacheRow, next: boolean) => void;
  refCallback: (el: HTMLDivElement | null) => void;
}) {
  const t = useTranslations();
  const isRetard = colKey === "retard";
  const isFait = colKey === "fait";
  const { setNodeRef, isOver } = useDroppable({ id: colKey, disabled: isRetard });

  return (
    <div
      ref={refCallback}
      className="w-[85vw] shrink-0 snap-center sm:w-80 md:w-72 md:snap-align-none"
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        {isRetard && <TriangleAlert className="size-3.5 text-ambre" />}
        <h2
          className={cn(
            "text-sm font-semibold",
            isRetard && "text-ambre",
            isFait && "text-muted-foreground",
          )}
        >
          {isFait ? t("taches.fait") : t(`taches.groups.${colKey}`)}
        </h2>
        <span className="rounded-full bg-secondary px-2 font-mono text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        title={isRetard ? t("taches.retardLocked") : undefined}
        className={cn(
          "min-h-36 space-y-2 rounded-2xl border border-transparent p-2 transition-colors",
          isRetard ? "bg-ambre/5" : "bg-brume/25",
          isOver && "border-chene/60 bg-chene/10",
        )}
      >
        {tasks.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs italic text-muted-foreground">
            {t("taches.emptyColonne")}
          </p>
        ) : (
          tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              ficheMap={ficheMap}
              profileById={profileById}
              currentUserId={currentUserId}
              overdue={isRetard}
              done={isFait}
              onCheck={onCheck}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableTaskCard(props: {
  task: TacheRow;
  ficheMap: Record<string, FicheRef>;
  profileById: Map<string, ProfileRow>;
  currentUserId: string;
  overdue?: boolean;
  done?: boolean;
  onCheck: (task: TacheRow, next: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.task.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("drag-item touch-manipulation select-none", isDragging && "opacity-40")}
    >
      <TaskCard {...props} />
    </div>
  );
}

function TaskCard({
  task,
  ficheMap,
  profileById,
  currentUserId,
  overdue,
  done,
  onCheck,
  overlay,
}: {
  task: TacheRow;
  ficheMap: Record<string, FicheRef>;
  profileById: Map<string, ProfileRow>;
  currentUserId: string;
  overdue?: boolean;
  done?: boolean;
  onCheck: (task: TacheRow, next: boolean) => void;
  overlay?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fiche = task.fiche_id ? ficheMap[task.fiche_id] : undefined;
  const assignee =
    task.assigne_a !== currentUserId ? profileById.get(task.assigne_a) : null;
  const CanalIcon = task.canal ? CANAL_ICONS[task.canal] : null;

  return (
    <div
      className={cn(
        "card-lift cursor-grab rounded-2xl border border-border bg-card p-3",
        done && "opacity-60",
        overlay && "rotate-1 shadow-xl",
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical
          aria-hidden
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50"
        />
        <Checkbox
          checked={done ?? false}
          onCheckedChange={(v) => onCheck(task, v === true)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={task.titre}
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", done && "line-through")}>
            {task.titre}
          </p>
          {task.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {task.description}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge
              variant={
                task.priorite === "haute"
                  ? "rouge"
                  : task.priorite === "basse"
                    ? "outline"
                    : "default"
              }
            >
              {t(`taches.${task.priorite}`)}
            </Badge>
            {task.auto_generee && (
              <Badge variant="chene">
                {CanalIcon && <CanalIcon className="size-3" />}
                {t("taches.auto")}
              </Badge>
            )}
            {fiche && task.fiche_id && (
              <Link
                href={`/fiches/${task.fiche_id}`}
                prefetch={false}
                onPointerDown={(e) => e.stopPropagation()}
                className="font-mono text-[10px] text-muted-foreground underline-offset-2 hover:underline"
              >
                {fiche.reference}
              </Link>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            {task.echeance ? (
              <span
                className={cn(
                  "text-xs text-muted-foreground",
                  overdue && "font-medium text-ambre",
                )}
              >
                {formatDate(task.echeance, "d MMM", locale)}
              </span>
            ) : (
              <span />
            )}
            {assignee && (
              <Avatar
                className="size-6"
                title={`${assignee.prenom} ${assignee.nom}`}
              >
                <AvatarFallback className="text-[9px]">
                  {assignee.prenom.charAt(0)}
                  {assignee.nom.charAt(0)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateTaskDialog({
  open,
  onOpenChange,
  ficheMap,
  profiles,
  currentProfile,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ficheMap: Record<string, FicheRef>;
  profiles: ProfileRow[];
  currentProfile: ProfileRow;
  onCreated: () => void;
}) {
  const t = useTranslations();
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [echeance, setEcheance] = useState("");
  const [priorite, setPriorite] = useState<Priorite>("normale");
  const [ficheId, setFicheId] = useState(NONE);
  const [assigneA, setAssigneA] = useState(currentProfile.id);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canAssign = currentProfile.role !== "conseiller";
  const assignables = profiles.filter(
    (p) => p.role === "conseiller" || p.id === currentProfile.id,
  );

  function submit() {
    if (!titre.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createTache({
        titre: titre.trim(),
        description,
        echeance: echeance || null,
        priorite,
        fiche_id: ficheId === NONE ? null : ficheId,
        assigne_a: assigneA,
      });
      if (!result.ok) {
        setError(
          messageErreur(t, result.error),
        );
        return;
      }
      setTitre("");
      setDescription("");
      setEcheance("");
      setPriorite("normale");
      setFicheId(NONE);
      onOpenChange(false);
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("taches.new")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-titre">{t("taches.titre")}</Label>
            <Input
              id="task-titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">{t("taches.description")}</Label>
            <Textarea
              id="task-desc"
              className="min-h-16"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-echeance">{t("taches.echeance")}</Label>
              <DatePicker
                id="task-echeance"
                value={echeance}
                onChange={setEcheance}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-priorite">{t("taches.priorite")}</Label>
              <Select
                value={priorite}
                onValueChange={(v) => setPriorite(v as Priorite)}
              >
                <SelectTrigger id="task-priorite">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`taches.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-fiche">
              {t("taches.fiche")}{" "}
              <span className="text-muted-foreground">
                ({t("app.optional")})
              </span>
            </Label>
            <Select value={ficheId} onValueChange={setFicheId}>
              <SelectTrigger id="task-fiche">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {Object.entries(ficheMap).map(([id, ref]) => (
                  <SelectItem key={id} value={id}>
                    {ref.reference} · {ref.client}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canAssign && (
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">{t("taches.assigneA")}</Label>
              <Select value={assigneA} onValueChange={setAssigneA}>
                <SelectTrigger id="task-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignables.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.prenom} {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm font-medium text-rouge">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("app.cancel")}
          </Button>
          <Button onClick={submit} disabled={pending || !titre.trim()}>
            {t("app.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
