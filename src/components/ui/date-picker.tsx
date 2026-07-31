"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { CalendarDays, X } from "lucide-react";
import { dateFnsLocale, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function parseISODate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Date field: rounded trigger with a calendar icon opening a themed
 * calendar popover. Value is an ISO `yyyy-MM-dd` string ("" = empty).
 */
export function DatePicker({
  value,
  onChange,
  id,
  placeholder,
  clearable = true,
  className,
  triggerClassName,
  align = "start",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
}) {
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const selected = parseISODate(value);

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            className={cn(
              "flex h-11 w-full items-center gap-2 rounded-xl border border-input bg-card px-3.5 text-sm transition-colors",
              "hover:border-chene/60 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
              !selected && "text-muted-foreground",
              triggerClassName,
            )}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selected
                ? formatDate(selected, "d MMM yyyy", locale)
                : (placeholder ?? "—")}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align={align} className="w-auto">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            locale={dateFnsLocale(locale)}
            weekStartsOn={1}
            onSelect={(date) => {
              onChange(date ? toISODate(date) : "");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {clearable && selected && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="×"
          className="absolute end-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
