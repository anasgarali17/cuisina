"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Themed react-day-picker — soft rounded, red selected day, quiet chrome. */
function Calendar({
  className,
  classNames,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays
      className={cn("relative p-3", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-2",
        month_caption: "flex h-9 items-center justify-center",
        caption_label: "font-display text-sm font-semibold capitalize",
        nav: "absolute inset-x-3 top-3 z-10 flex h-9 items-center justify-between",
        button_previous:
          "grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        button_next:
          "grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
        week: "mt-1 flex",
        day: "p-0 text-center",
        day_button:
          "grid size-9 place-items-center rounded-full text-sm transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected:
          "[&>button]:bg-rouge [&>button]:font-semibold [&>button]:text-white [&>button:hover]:bg-rouge",
        today: "[&>button]:font-bold [&>button]:text-rouge [&.rdp-selected>button]:text-white",
        outside: "[&>button]:text-muted-foreground/40",
        disabled: "[&>button]:pointer-events-none [&>button]:opacity-35",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) => {
          void rest;
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className="size-4 rtl:-scale-x-100" />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
