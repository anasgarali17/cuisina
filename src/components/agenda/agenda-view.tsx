"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  NotebookPen,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { createRdv, deleteRdv, moveRdv } from "@/lib/actions/rdv-actions";
import { createTache, updateTacheEcheance } from "@/lib/actions/tache-actions";
import { formatDate } from "@/lib/dates";
import { tzDay, tzHhmm, tzInstant } from "@/lib/tz";
import { PRIORITES, RDV_TYPES, type RdvType } from "@/lib/domain";
import type {
  PointDeVenteRow,
  ProfileRow,
  RendezVousRow,
  TacheRow,
} from "@/lib/database.types";
import { cn, messageErreur } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
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
import {
  DayPanel,
  MonthGrid,
  TimeGrid,
  weekDays,
  type CalendarView,
} from "./calendar-grid";
import {
  CATEGORY_STYLES,
  CLIENT_TYPES,
  groupByDay,
  tacheToEvent,
  toEvent,
  type AgendaEvent,
  type EventCategory,
} from "./event-model";

const VIEWS: CalendarView[] = ["mois", "semaine", "jour"];
const ALL = "__all__";
const NONE = "__none__";

export interface FicheOption {
  id: string;
  reference: string;
  client: string;
}

/**
 * Agenda Équipe shows everything the team is doing; Agenda Client narrows to
 * the appointments a client is party to. Same calendar, different lens.
 */
export type AgendaVariant = "equipe" | "client";

interface Draft {
  kind: "rdv" | "tache";
  titre: string;
  type: RdvType;
  day: string;
  heure: string;
  duree: string;
  conseiller: string;
  pdv: string;
  fiche: string;
  lieu: string;
  notes: string;
  priorite: (typeof PRIORITES)[number];
}

function emptyDraft(day: string, variant: AgendaVariant, ownerId: string, pdvId: string): Draft {
  return {
    kind: "rdv",
    titre: "",
    type: variant === "equipe" ? "interne" : "showroom",
    day,
    heure: "09:00",
    duree: "60",
    conseiller: ownerId,
    pdv: pdvId,
    fiche: NONE,
    lieu: "",
    notes: "",
    priorite: "normale",
  };
}

/** `yyyy-MM-dd` as a plain calendar date — même valeur serveur et client. */
function dayToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function AgendaView({
  variant,
  rdv,
  taches,
  profiles,
  pdvs,
  fiches,
  currentProfile,
}: {
  variant: AgendaVariant;
  rdv: RendezVousRow[];
  taches: TacheRow[];
  profiles: ProfileRow[];
  pdvs: PointDeVenteRow[];
  fiches: FicheOption[];
  currentProfile: ProfileRow;
}) {
  const t = useTranslations("agenda");
  const tApp = useTranslations("app");
  /** Racine — `messageErreur` résout des clés `errors.*` et `app.*`. */
  const tRoot = useTranslations();
  const tRdv = useTranslations("rdv.types");
  const tPri = useTranslations("taches");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const today = tzDay(new Date());
  const [view, setView] = useState<CalendarView>("mois");
  // Ancré sur le jour du showroom : `new Date()` place le curseur sur le jour
  // du serveur (UTC), qui n'est pas toujours celui d'ici.
  const [cursor, setCursor] = useState(() => dayToDate(today));
  const [selected, setSelected] = useState(today);
  const [owner, setOwner] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<AgendaEvent | null>(null);
  const [detail, setDetail] = useState<AgendaEvent | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  // Local copies so a drag lands instantly and only reverts if the server says no.
  const [rdvRows, setRdvRows] = useState(rdv);
  const [tacheRows, setTacheRows] = useState(taches);

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so chips stay clickable.
    // Not PointerSensor: on touch it races native scrolling and dies on
    // pointercancel. Touch goes through the long-press TouchSensor alone.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 10 } }),
  );

  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );
  const ficheById = useMemo(
    () => new Map(fiches.map((f) => [f.id, f])),
    [fiches],
  );
  const ownerName = (id: string) => {
    const p = profileById.get(id);
    return p ? `${p.prenom} ${p.nom}` : "—";
  };

  const events = useMemo(() => {
    const fromRdv = rdvRows
      .filter((r) => (variant === "client" ? CLIENT_TYPES.includes(r.type) : true))
      .map(toEvent);
    const fromTaches = tacheRows
      .map(tacheToEvent)
      .filter((e): e is AgendaEvent => e !== null);
    // The client agenda is about appointments; a task is internal admin.
    const all = variant === "client" ? fromRdv : [...fromRdv, ...fromTaches];
    return all.filter(
      (e) =>
        (owner === ALL || e.ownerId === owner) &&
        (category === ALL || e.category === category),
    );
  }, [rdvRows, tacheRows, variant, owner, category]);

  const byDay = useMemo(() => groupByDay(events), [events]);
  const selectedEvents = byDay.get(selected) ?? [];

  const days = useMemo(() => {
    if (view === "semaine") return weekDays(cursor);
    if (view === "jour") return [cursor];
    return [];
  }, [view, cursor]);

  const periodLabel = useMemo(() => {
    if (view === "mois") return formatDate(cursor, "MMMM yyyy", locale);
    if (view === "jour") return formatDate(cursor, "EEEE d MMMM yyyy", locale);
    const week = weekDays(cursor);
    return `${formatDate(week[0], "d MMM", locale)} – ${formatDate(week[6], "d MMM yyyy", locale)}`;
  }, [view, cursor, locale]);

  function shift(direction: -1 | 1) {
    const next = new Date(cursor);
    if (view === "mois") next.setMonth(next.getMonth() + direction);
    else if (view === "semaine") next.setDate(next.getDate() + 7 * direction);
    else next.setDate(next.getDate() + direction);
    setCursor(next);
  }

  function goToday() {
    const iso = tzDay(new Date());
    setCursor(dayToDate(iso));
    setSelected(iso);
  }

  function selectDay(iso: string) {
    setSelected(iso);
    if (view !== "mois") return;
    const [y, m, d] = iso.split("-").map(Number);
    // Clicking a neighbouring month's day should follow it there.
    const picked = new Date(y, m - 1, d);
    if (picked.getMonth() !== cursor.getMonth()) setCursor(picked);
  }

  function onDragStart(e: DragStartEvent) {
    setDragging((e.active.data.current?.event as AgendaEvent) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    const event = dragging;
    setDragging(null);
    const overId = String(e.over?.id ?? "");
    if (!event || !overId.startsWith("day:")) return;
    const day = overId.slice(4);
    if (day === event.day) return;

    setError(null);
    if (event.kind === "tache") {
      const previous = tacheRows;
      setTacheRows((rows) =>
        rows.map((r) => (r.id === event.id ? { ...r, echeance: day } : r)),
      );
      startTransition(async () => {
        const result = await updateTacheEcheance({ id: event.id, echeance: day });
        if (!result.ok) {
          setTacheRows(previous);
          setError(messageErreur(tRoot, result.error));
        } else {
          router.refresh();
        }
      });
      return;
    }

    const previous = rdvRows;
    setRdvRows((rows) =>
      rows.map((r) => {
        if (r.id !== event.id) return r;
        const debut = new Date(r.debut);
        const fin = new Date(r.fin);
        const duration = fin.getTime() - debut.getTime();
        const [y, m, d] = day.split("-").map(Number);
        const nextDebut = new Date(debut);
        nextDebut.setFullYear(y, m - 1, d);
        return {
          ...r,
          debut: nextDebut.toISOString(),
          fin: new Date(nextDebut.getTime() + duration).toISOString(),
        };
      }),
    );
    startTransition(async () => {
      const result = await moveRdv({ id: event.id, day });
      if (!result.ok) {
        setRdvRows(previous);
        setError(messageErreur(tRoot, result.error));
      } else {
        router.refresh();
      }
    });
  }

  function submitDraft() {
    if (!draft || !draft.titre.trim() || !draft.day) return;
    setError(null);

    startTransition(async () => {
      const result =
        draft.kind === "rdv"
          ? await createRdv({
              titre: draft.titre,
              type: draft.type,
              debut: tzInstant(draft.day, draft.heure).toISOString(),
              fin: new Date(
                tzInstant(draft.day, draft.heure).getTime() +
                  Number(draft.duree) * 60_000,
              ).toISOString(),
              fiche_id: draft.fiche === NONE ? null : draft.fiche,
              client_id: null,
              conseiller_id: draft.conseiller,
              point_de_vente_id: draft.pdv,
              lieu: draft.lieu,
              notes: draft.notes,
            })
          : await createTache({
              titre: draft.titre,
              description: draft.notes,
              echeance: draft.day,
              priorite: draft.priorite,
              fiche_id: draft.fiche === NONE ? null : draft.fiche,
              assigne_a: draft.conseiller,
            });

      if (!result.ok) {
        setError(messageErreur(tRoot, result.error));
        return;
      }
      setDraft(null);
      router.refresh();
    });
  }

  function removeEvent(event: AgendaEvent) {
    setError(null);
    startTransition(async () => {
      const result = await deleteRdv({ id: event.id });
      if (!result.ok) {
        setError(messageErreur(tRoot, result.error));
        return;
      }
      setRdvRows((rows) => rows.filter((r) => r.id !== event.id));
      setDetail(null);
      router.refresh();
    });
  }

  const legend: EventCategory[] =
    variant === "client"
      ? (CLIENT_TYPES as EventCategory[])
      : [...(RDV_TYPES as readonly EventCategory[]), "tache"];

  const openDraft = (day?: string, heure?: string) => {
    const base = emptyDraft(
      day ?? selected ?? today,
      variant,
      currentProfile.id,
      currentProfile.point_de_vente_id ?? pdvs[0]?.id ?? "",
    );
    setDraft(heure ? { ...base, heure } : base);
  };

  /** L'heure de fin, telle qu'elle tombera — début + durée choisie. */
  const draftEnd = draft
    ? formatDate(
        new Date(
          tzInstant(draft.day, draft.heure).getTime() +
            Number(draft.duree) * 60_000,
        ),
        "HH:mm",
        locale,
      )
    : "";

  return (
    <div>
      <PageHeader
        title={t(`${variant}.title`)}
        subtitle={t(`${variant}.subtitle`)}
        actions={
          <Button onClick={() => openDraft()}>
            <Plus className="size-4" />
            {t("newEvent")}
          </Button>
        }
      />

      {/* Toolbar: period, navigation, view switch */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("previous")}
            onClick={() => shift(-1)}
          >
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("next")}
            onClick={() => shift(1)}
          >
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            {tApp("today")}
          </Button>
        </div>

        <p className="font-display text-lg font-semibold capitalize">{periodLabel}</p>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border p-0.5">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                  view === v
                    ? "bg-chene text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`views.${v}`)}
              </button>
            ))}
          </div>

          <Select value={owner} onValueChange={setOwner}>
            {/* Explicit children: the trigger label must be right on first
                paint, before the item list has ever been mounted. */}
            <SelectTrigger className="h-9 w-[170px] text-xs">
              <SelectValue>
                {owner === ALL ? t("allAdvisors") : ownerName(owner)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allAdvisors")}</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.prenom} {p.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue>
                {category === ALL
                  ? t("allTypes")
                  : category === "tache"
                    ? t("taskType")
                    : tRdv(category)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allTypes")}</SelectItem>
              {legend.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "tache" ? t("taskType") : tRdv(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-ambre/40 bg-ambre/10 px-4 py-2.5 text-sm text-ambre">
          {error}
        </p>
      )}

      <DndContext
        // Sans id fixe, dnd-kit numérote ses `aria-describedby` dans l'ordre de
        // montage : le serveur dit 0, le client dit 1, et React régénère tout
        // l'arbre à l'hydratation.
        id="agenda-dnd"
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className={cn(pending && "opacity-70 transition-opacity")}>
            {view === "mois" ? (
              <MonthGrid
                month={cursor}
                byDay={byDay}
                selected={selected}
                onSelect={selectDay}
                onOpen={setDetail}
              />
            ) : (
              <TimeGrid
                days={days}
                byDay={byDay}
                selected={selected}
                onSelect={selectDay}
                onOpen={setDetail}
              />
            )}

            {/* Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
              {legend.map((c) => (
                <span
                  key={c}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className={cn("size-2.5 rounded-full", CATEGORY_STYLES[c].dot)}
                  />
                  {c === "tache" ? t("taskType") : tRdv(c)}
                </span>
              ))}
              <span className="ms-auto text-xs text-muted-foreground">
                {t("dragHint")}
              </span>
            </div>
          </div>

          <DayPanel
            iso={selected}
            events={selectedEvents}
            onOpen={setDetail}
            onCreateAt={(day, heure) => openDraft(day, heure)}
            ownerName={ownerName}
            emptyLabel={t("emptyDay")}
          />
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging && (
            <span
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-semibold shadow-lg",
                CATEGORY_STYLES[dragging.category as EventCategory].chip,
              )}
            >
              {dragging.title}
            </span>
          )}
        </DragOverlay>
      </DndContext>

      {/* Event detail */}
      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      CATEGORY_STYLES[detail.category as EventCategory].dot,
                    )}
                  />
                  {detail.title}
                </DialogTitle>
              </DialogHeader>
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <CalendarDays className="size-4 shrink-0" />
                  <span className="capitalize text-foreground">
                    {formatDate(detail.day, "EEEE d MMMM yyyy", locale)}
                  </span>
                </div>
                {detail.start && detail.end && (
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Clock className="size-4 shrink-0" />
                    <span className="tabular-nums text-foreground">
                      {tzHhmm(detail.start)} – {tzHhmm(detail.end)}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <User className="size-4 shrink-0" />
                  <span className="text-foreground">{ownerName(detail.ownerId)}</span>
                </div>
                {detail.lieu && (
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <MapPin className="size-4 shrink-0" />
                    <span className="text-foreground">{detail.lieu}</span>
                  </div>
                )}
                {detail.ficheId && ficheById.get(detail.ficheId) && (
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <NotebookPen className="size-4 shrink-0" />
                    <span className="text-foreground">
                      {ficheById.get(detail.ficheId)!.reference} ·{" "}
                      {ficheById.get(detail.ficheId)!.client}
                    </span>
                  </div>
                )}
                {detail.notes && (
                  <p className="rounded-xl bg-muted/60 p-3 text-sm leading-relaxed">
                    {detail.notes}
                  </p>
                )}
              </dl>
              <DialogFooter className="flex-wrap">
                {detail.kind === "rdv" && (
                  <Button
                    variant="ghost"
                    onClick={() => removeEvent(detail)}
                    disabled={pending}
                    className="text-rouge hover:bg-rouge/10 hover:text-rouge"
                  >
                    <Trash2 className="size-4" />
                    {tApp("delete")}
                  </Button>
                )}
                {/* Enchaîner depuis le rendez-vous ouvert : le suivant démarre
                    quand celui-ci finit, sur la même fiche. */}
                {detail.end && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const end = tzHhmm(detail.end!);
                      const base = emptyDraft(
                        detail.day,
                        variant,
                        detail.ownerId,
                        currentProfile.point_de_vente_id ?? pdvs[0]?.id ?? "",
                      );
                      setDetail(null);
                      setDraft({
                        ...base,
                        heure: end,
                        fiche: detail.ficheId ?? NONE,
                        lieu: detail.lieu ?? "",
                      });
                    }}
                  >
                    <Plus className="size-4" />
                    {t("addAfter")}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetail(null)}>
                  {tApp("close")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create */}
      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          {draft && (
            <>
              <DialogHeader>
                <DialogTitle>{t("newEvent")}</DialogTitle>
              </DialogHeader>

              <div className="flex flex-col gap-4">
                {/* Rendez-vous or task */}
                <div className="flex rounded-xl border border-border p-0.5">
                  {(["rdv", "tache"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setDraft({ ...draft, kind: k })}
                      className={cn(
                        "flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
                        draft.kind === k
                          ? "bg-chene text-white"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(k === "rdv" ? "kindRdv" : "kindTache")}
                    </button>
                  ))}
                </div>

                <div>
                  <Label htmlFor="ev-titre">{t("fTitle")}</Label>
                  <Input
                    id="ev-titre"
                    value={draft.titre}
                    autoFocus
                    onChange={(e) => setDraft({ ...draft, titre: e.target.value })}
                  />
                </div>

                {draft.kind === "rdv" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>{t("fType")}</Label>
                      <Select
                        value={draft.type}
                        onValueChange={(v) => setDraft({ ...draft, type: v as RdvType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RDV_TYPES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {tRdv(r)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="ev-day">{t("fDate")}</Label>
                      <DatePicker
                        id="ev-day"
                        value={draft.day}
                        clearable={false}
                        onChange={(v) => setDraft({ ...draft, day: v })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ev-heure">{t("fStart")}</Label>
                      <Input
                        id="ev-heure"
                        type="time"
                        value={draft.heure}
                        onChange={(e) => setDraft({ ...draft, heure: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="flex items-baseline justify-between gap-2">
                        {t("fDuration")}
                        {/* L'heure de fin se lit ici plutôt qu'en tête : c'est
                            elle qui dit si le créneau suivant reste libre. */}
                        <span className="text-xs font-normal tabular-nums text-muted-foreground">
                          {t("endsAt", { time: draftEnd })}
                        </span>
                      </Label>
                      <Select
                        value={draft.duree}
                        onValueChange={(v) => setDraft({ ...draft, duree: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["15", "30", "45", "60", "90", "120", "180", "240", "480"].map(
                            (m) => (
                              <SelectItem key={m} value={m}>
                                {Number(m) >= 60
                                  ? t("hours", {
                                      h: Math.floor(Number(m) / 60),
                                      m: Number(m) % 60,
                                    })
                                  : t("minutes", { count: Number(m) })}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="ev-echeance">{t("fDueDate")}</Label>
                      <DatePicker
                        id="ev-echeance"
                        value={draft.day}
                        clearable={false}
                        onChange={(v) => setDraft({ ...draft, day: v })}
                      />
                    </div>
                    <div>
                      <Label>{t("fPriority")}</Label>
                      <Select
                        value={draft.priorite}
                        onValueChange={(v) =>
                          setDraft({ ...draft, priorite: v as Draft["priorite"] })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {tPri(p)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>{t("fOwner")}</Label>
                    <Select
                      value={draft.conseiller}
                      onValueChange={(v) => setDraft({ ...draft, conseiller: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.prenom} {p.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("fFiche")}</Label>
                    <Select
                      value={draft.fiche}
                      onValueChange={(v) => setDraft({ ...draft, fiche: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("noFiche")}</SelectItem>
                        {fiches.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.reference} · {f.client}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {draft.kind === "rdv" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>{t("fPdv")}</Label>
                      <Select
                        value={draft.pdv}
                        onValueChange={(v) => setDraft({ ...draft, pdv: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {pdvs.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="ev-lieu">
                        {t("fPlace")}{" "}
                        <span className="text-muted-foreground">({tApp("optional")})</span>
                      </Label>
                      <Input
                        id="ev-lieu"
                        value={draft.lieu}
                        onChange={(e) => setDraft({ ...draft, lieu: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="ev-notes">
                    {t("fNotes")}{" "}
                    <span className="text-muted-foreground">({tApp("optional")})</span>
                  </Label>
                  <Textarea
                    id="ev-notes"
                    rows={3}
                    value={draft.notes}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDraft(null)}>
                  {tApp("cancel")}
                </Button>
                <Button
                  onClick={submitDraft}
                  disabled={pending || !draft.titre.trim() || !draft.day}
                >
                  {tApp("save")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
