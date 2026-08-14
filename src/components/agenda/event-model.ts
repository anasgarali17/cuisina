import type { RdvType } from "@/lib/domain";
import type { RendezVousRow, TacheRow } from "@/lib/database.types";
import { tzDay } from "@/lib/tz";

/**
 * One shape for everything the calendar draws. Appointments carry a real time
 * range; tasks are anchored to their due date and sit in the all-day row, so
 * the two can share a grid without pretending a task happens at 09:00.
 */
export interface AgendaEvent {
  id: string;
  kind: "rdv" | "tache";
  /** `rdv` events keep their type; tasks are their own visual family. */
  category: RdvType | "tache";
  title: string;
  /** Local calendar day, `yyyy-MM-dd` — the key every view groups by. */
  day: string;
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  /** Advisor the item belongs to: `conseiller_id` or `assigne_a`. */
  ownerId: string;
  pdvId: string | null;
  ficheId: string | null;
  clientId: string | null;
  lieu: string | null;
  notes: string | null;
  /** Tasks only: a done task is drawn struck through. */
  done: boolean;
  /** Tasks only. */
  priorite: TacheRow["priorite"] | null;
}

/** Appointments the client is party to; `interne` is the team's own business. */
export const CLIENT_TYPES: RdvType[] = ["showroom", "metre", "livraison", "pose"];

export const EVENT_CATEGORIES = [
  "showroom",
  "metre",
  "livraison",
  "pose",
  "interne",
  "tache",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

interface CategoryStyle {
  /** Event chip: tinted fill, readable in both themes. */
  chip: string;
  /** The 3px rail down the leading edge of a chip, and legend dots. */
  dot: string;
  /** Block fill in the week and day time grids. */
  block: string;
}

export const CATEGORY_STYLES: Record<EventCategory, CategoryStyle> = {
  // The showroom visit is the house's signature appointment, so it carries the
  // brand red; every other category stays a distinct hue around it.
  showroom: {
    chip: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200",
    dot: "bg-red-600",
    block: "bg-red-100 text-red-900 border-red-300 dark:bg-red-500/25 dark:text-red-100 dark:border-red-400/40",
  },
  metre: {
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
    dot: "bg-sky-500",
    block: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-500/25 dark:text-sky-100 dark:border-sky-400/40",
  },
  livraison: {
    chip: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
    dot: "bg-amber-500",
    block: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/25 dark:text-amber-100 dark:border-amber-400/40",
  },
  pose: {
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
    dot: "bg-emerald-500",
    block: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/25 dark:text-emerald-100 dark:border-emerald-400/40",
  },
  interne: {
    chip: "bg-slate-200 text-slate-800 dark:bg-slate-400/20 dark:text-slate-200",
    dot: "bg-slate-500",
    block: "bg-slate-200 text-slate-900 border-slate-400 dark:bg-slate-400/25 dark:text-slate-100 dark:border-slate-400/40",
  },
  // Moved off rose so it cannot be mistaken for a showroom visit now that
  // showroom owns the red; warm stone keeps it distinct from cool interne.
  tache: {
    chip: "bg-stone-200 text-stone-800 dark:bg-stone-400/20 dark:text-stone-200",
    dot: "bg-stone-500",
    block: "bg-stone-200 text-stone-900 border-stone-400 dark:bg-stone-400/25 dark:text-stone-100 dark:border-stone-400/40",
  },
};

export function toEvent(rdv: RendezVousRow): AgendaEvent {
  const start = new Date(rdv.debut);
  return {
    id: rdv.id,
    kind: "rdv",
    category: rdv.type,
    title: rdv.titre,
    day: tzDay(start),
    start,
    end: new Date(rdv.fin),
    allDay: false,
    ownerId: rdv.conseiller_id,
    pdvId: rdv.point_de_vente_id,
    ficheId: rdv.fiche_id,
    clientId: rdv.client_id,
    lieu: rdv.lieu,
    notes: rdv.notes,
    done: false,
    priorite: null,
  };
}

/** Tasks without a due date have no place on a calendar — the caller drops them. */
export function tacheToEvent(tache: TacheRow): AgendaEvent | null {
  if (!tache.echeance) return null;
  return {
    id: tache.id,
    kind: "tache",
    category: "tache",
    title: tache.titre,
    day: tache.echeance.slice(0, 10),
    start: null,
    end: null,
    allDay: true,
    ownerId: tache.assigne_a,
    pdvId: null,
    ficheId: tache.fiche_id,
    clientId: null,
    lieu: null,
    notes: tache.description,
    done: tache.statut === "fait",
    priorite: tache.priorite,
  };
}

/** All-day first, then by start time, then alphabetically — a stable order. */
export function compareEvents(a: AgendaEvent, b: AgendaEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (a.start && b.start) {
    const diff = a.start.getTime() - b.start.getTime();
    if (diff !== 0) return diff;
  }
  return a.title.localeCompare(b.title);
}

export function groupByDay(events: AgendaEvent[]): Map<string, AgendaEvent[]> {
  const map = new Map<string, AgendaEvent[]>();
  for (const event of events) {
    const bucket = map.get(event.day);
    if (bucket) bucket.push(event);
    else map.set(event.day, [event]);
  }
  for (const bucket of map.values()) bucket.sort(compareEvents);
  return map;
}
