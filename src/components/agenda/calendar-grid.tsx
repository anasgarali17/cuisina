"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CheckCircle2, Clock, MapPin } from "lucide-react";
import { formatDate, toISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  CATEGORY_STYLES,
  type AgendaEvent,
  type EventCategory,
} from "./event-model";

export type CalendarView = "mois" | "semaine" | "jour";

/** Working day drawn in the time grids. Earlier events are pinned to the top row. */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 21;
const HOUR_PX = 56;

/** Monday-first weeks — the Tunisian working week, and what the team expects. */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return d;
}

/** The 6×7 block a month view draws, padded with neighbouring days. */
export function monthMatrix(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const cursor = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() + i);
    return d;
  });
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function minutesFromDayStart(d: Date): number {
  return (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes();
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ chips */

function EventChip({
  event,
  onOpen,
  compact,
}: {
  event: AgendaEvent;
  onOpen: (event: AgendaEvent) => void;
  compact?: boolean;
}) {
  const style = CATEGORY_STYLES[event.category as EventCategory];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: { event },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={() => onOpen(event)}
      title={event.title}
      className={cn(
        "group/chip flex w-full items-center gap-1.5 overflow-hidden rounded-md px-1.5 py-1 text-start text-[11px] font-medium leading-tight transition",
        "hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        style.chip,
        isDragging && "opacity-40",
        compact && "py-0.5",
      )}
    >
      <span className={cn("h-3 w-[3px] shrink-0 rounded-full", style.dot)} />
      {event.start && (
        /* On a phone a month cell is ~50px wide, where the time is unreadable
           and its min-content width pushes the grid past the viewport. */
        <span className="hidden shrink-0 tabular-nums opacity-70 sm:inline">
          {hhmm(event.start)}
        </span>
      )}
      <span className={cn("truncate", event.done && "line-through opacity-60")}>
        {event.title}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------- month */

function MonthCell({
  day,
  month,
  events,
  selected,
  today,
  onSelect,
  onOpen,
}: {
  day: Date;
  month: number;
  events: AgendaEvent[];
  selected: string;
  today: string;
  onSelect: (iso: string) => void;
  onOpen: (event: AgendaEvent) => void;
}) {
  const iso = toISODate(day);
  const outside = day.getMonth() !== month;
  const isToday = iso === today;
  const isSelected = iso === selected;
  const { setNodeRef, isOver } = useDroppable({ id: `day:${iso}` });
  const shown = events.slice(0, 3);
  const overflow = events.length - shown.length;

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(iso)}
      className={cn(
        // min-w-0 + clipping: a day cell must never be widened by the event
        // chips inside it, or seven of them push the page sideways on a phone.
        "flex min-h-[104px] min-w-0 cursor-pointer flex-col gap-1 overflow-hidden border-b border-e border-border/70 p-1.5 transition-colors",
        outside && "bg-muted/30",
        isSelected && "bg-chene/[0.07] ring-1 ring-inset ring-chene/40",
        isOver && "bg-chene/15",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums",
            outside ? "text-muted-foreground/50" : "text-foreground",
            isToday && "bg-rouge text-white",
          )}
        >
          {day.getDate()}
        </span>
        {events.length > 0 && (
          <span className="flex gap-0.5">
            {[...new Set(events.map((e) => e.category))].slice(0, 4).map((c) => (
              <span
                key={c}
                className={cn(
                  "size-1.5 rounded-full",
                  CATEGORY_STYLES[c as EventCategory].dot,
                )}
              />
            ))}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {shown.map((e) => (
          <EventChip key={e.id} event={e} onOpen={onOpen} compact />
        ))}
        {overflow > 0 && (
          <span className="ps-1 text-[10px] font-medium text-muted-foreground">
            +{overflow}
          </span>
        )}
      </div>
    </div>
  );
}

export function MonthGrid({
  month,
  byDay,
  selected,
  onSelect,
  onOpen,
}: {
  month: Date;
  byDay: Map<string, AgendaEvent[]>;
  selected: string;
  onSelect: (iso: string) => void;
  onOpen: (event: AgendaEvent) => void;
}) {
  const locale = useLocale();
  const today = toISODate(new Date());
  const cells = useMemo(() => monthMatrix(month), [month]);
  const headers = useMemo(() => weekDays(new Date()), []);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {headers.map((d) => (
          <div
            key={d.toISOString()}
            className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {formatDate(d, "EEE", locale)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-e-0">
        {cells.map((d) => (
          <MonthCell
            key={d.toISOString()}
            day={d}
            month={month.getMonth()}
            events={byDay.get(toISODate(d)) ?? []}
            selected={selected}
            today={today}
            onSelect={onSelect}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- time grids */

function TimedBlock({
  event,
  onOpen,
  lane,
  lanes,
}: {
  event: AgendaEvent;
  onOpen: (event: AgendaEvent) => void;
  lane: number;
  lanes: number;
}) {
  const style = CATEGORY_STYLES[event.category as EventCategory];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: { event },
  });
  if (!event.start || !event.end) return null;

  const top = Math.max(0, (minutesFromDayStart(event.start) / 60) * HOUR_PX);
  const rawHeight =
    ((event.end.getTime() - event.start.getTime()) / 3_600_000) * HOUR_PX;

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      onClick={() => onOpen(event)}
      style={{
        top,
        height: Math.max(24, rawHeight),
        insetInlineStart: `${(lane / lanes) * 100}%`,
        width: `${100 / lanes}%`,
      }}
      className={cn(
        "absolute overflow-hidden rounded-lg border p-1.5 text-start text-[11px] leading-tight transition",
        "hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        style.block,
        isDragging && "opacity-40",
      )}
    >
      <span className="block truncate font-semibold">{event.title}</span>
      <span className="block truncate tabular-nums opacity-75">
        {hhmm(event.start)} – {hhmm(event.end)}
      </span>
      {event.lieu && (
        <span className="mt-0.5 flex items-center gap-1 truncate opacity-70">
          <MapPin className="size-3 shrink-0" />
          {event.lieu}
        </span>
      )}
    </button>
  );
}

/** Side-by-side lanes so simultaneous appointments do not stack on top of each other. */
function assignLanes(events: AgendaEvent[]): { event: AgendaEvent; lane: number; lanes: number }[] {
  const timed = events.filter((e) => e.start && e.end);
  const laneEnds: number[] = [];
  const placed = timed.map((event) => {
    const start = event.start!.getTime();
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = event.end!.getTime();
    return { event, lane };
  });
  const lanes = Math.max(1, laneEnds.length);
  return placed.map((p) => ({ ...p, lanes }));
}

function DayColumn({
  day,
  events,
  onOpen,
  onSelect,
  selected,
}: {
  day: Date;
  events: AgendaEvent[];
  onOpen: (event: AgendaEvent) => void;
  onSelect: (iso: string) => void;
  selected: string;
}) {
  const iso = toISODate(day);
  const { setNodeRef, isOver } = useDroppable({ id: `day:${iso}` });
  const hours = DAY_END_HOUR - DAY_START_HOUR;
  const laned = useMemo(() => assignLanes(events), [events]);

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(iso)}
      className={cn(
        "relative border-e border-border/70",
        isOver && "bg-chene/10",
        iso === selected && "bg-chene/[0.05]",
      )}
      style={{ height: hours * HOUR_PX }}
    >
      {Array.from({ length: hours }, (_, i) => (
        <div
          key={i}
          className="border-b border-border/50"
          style={{ height: HOUR_PX }}
        />
      ))}
      {laned.map(({ event, lane, lanes }) => (
        <TimedBlock
          key={event.id}
          event={event}
          onOpen={onOpen}
          lane={lane}
          lanes={lanes}
        />
      ))}
    </div>
  );
}

export function TimeGrid({
  days,
  byDay,
  selected,
  onSelect,
  onOpen,
}: {
  days: Date[];
  byDay: Map<string, AgendaEvent[]>;
  selected: string;
  onSelect: (iso: string) => void;
  onOpen: (event: AgendaEvent) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("agenda");
  const today = toISODate(new Date());
  const hours = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR },
    (_, i) => DAY_START_HOUR + i,
  );

  const allDayRow = days.map((d) => ({
    iso: toISODate(d),
    events: (byDay.get(toISODate(d)) ?? []).filter((e) => e.allDay),
  }));
  const hasAllDay = allDayRow.some((d) => d.events.length > 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Day headers */}
      <div
        className="grid border-b border-border bg-muted/40"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
      >
        <div />
        {days.map((d) => {
          const iso = toISODate(d);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-2 transition-colors hover:bg-muted",
                iso === selected && "bg-chene/10",
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {formatDate(d, "EEE", locale)}
              </span>
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full text-sm font-semibold tabular-nums",
                  iso === today && "bg-rouge text-white",
                )}
              >
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* All-day row: tasks and anything without a time */}
      {hasAllDay && (
        <div
          className="grid border-b border-border bg-muted/20"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
        >
          <div className="flex items-center justify-center px-1 py-2 text-[10px] font-medium uppercase text-muted-foreground">
            {t("allDay")}
          </div>
          {allDayRow.map(({ iso, events }) => (
            <div key={iso} className="flex flex-col gap-0.5 border-s border-border/70 p-1">
              {events.map((e) => (
                <EventChip key={e.id} event={e} onOpen={onOpen} compact />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Hour rail + day columns */}
      <div
        className="grid max-h-[62vh] overflow-y-auto"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
      >
        <div>
          {hours.map((h) => (
            <div
              key={h}
              className="relative border-b border-border/50 pe-2 text-end text-[10px] tabular-nums text-muted-foreground"
              style={{ height: HOUR_PX }}
            >
              <span className="absolute end-2 top-0 -translate-y-1/2 bg-card px-1">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>
        {days.map((d) => (
          <DayColumn
            key={toISODate(d)}
            day={d}
            events={(byDay.get(toISODate(d)) ?? []).filter((e) => !e.allDay)}
            onOpen={onOpen}
            onSelect={onSelect}
            selected={selected}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- day panel */

export function DayPanel({
  iso,
  events,
  onOpen,
  ownerName,
  emptyLabel,
}: {
  iso: string;
  events: AgendaEvent[];
  onOpen: (event: AgendaEvent) => void;
  ownerName: (id: string) => string;
  emptyLabel: string;
}) {
  const locale = useLocale();
  const t = useTranslations("agenda");

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="font-display text-lg font-semibold capitalize">
        {formatDate(iso, "EEEE d MMMM", locale)}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {t("eventCount", { count: events.length })}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {events.length === 0 && (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        )}
        {events.map((e) => {
          const style = CATEGORY_STYLES[e.category as EventCategory];
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpen(e)}
              className="flex items-start gap-3 rounded-xl border border-border p-3 text-start transition-colors hover:bg-muted/60"
            >
              <span className={cn("mt-0.5 h-9 w-1 shrink-0 rounded-full", style.dot)} />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm font-semibold",
                    e.done && "line-through text-muted-foreground",
                  )}
                >
                  {e.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {e.start && e.end ? (
                    <span className="flex items-center gap-1 tabular-nums">
                      <Clock className="size-3" />
                      {hhmm(e.start)} – {hhmm(e.end)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="size-3" />
                      {ownerName(e.ownerId)}
                    </span>
                  )}
                  {e.lieu && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="size-3" />
                      {e.lieu}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
