"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DashboardSection {
  id: string;
  emoji: string;
  label: string;
  content: ReactNode;
}

const ALL = "tout";
const STORAGE_KEY = "cuisina:ma-journee:vue";

/* The chosen view lives in localStorage so it survives a navigation, read
   through useSyncExternalStore: the server always renders "tout", the client
   swaps in the stored view right after hydration. */
let listeners: (() => void)[] = [];

function subscribe(onChange: () => void) {
  listeners = [...listeners, onChange];
  return () => {
    listeners = listeners.filter((l) => l !== onChange);
  };
}

function readView() {
  return window.localStorage.getItem(STORAGE_KEY) ?? ALL;
}

function writeView(id: string) {
  window.localStorage.setItem(STORAGE_KEY, id);
  for (const l of listeners) l();
}

/**
 * Greeting row plus the emoji pill bar that decides what the dashboard shows:
 * everything, or a single section. Sections arrive already rendered on the
 * server — this component only picks which ones stay on screen.
 */
export function SectionSwitcher({
  title,
  subtitle,
  allLabel,
  groupLabel,
  sections,
}: {
  title: string;
  subtitle: string;
  allLabel: string;
  groupLabel: string;
  sections: DashboardSection[];
}) {
  const stored = useSyncExternalStore(subscribe, readView, () => ALL);
  /* A section can disappear between visits (le classement, réservé aux chefs) —
     fall back on the full dashboard rather than an empty page. */
  const view = sections.some((s) => s.id === stored) ? stored : ALL;

  const visible =
    view === ALL ? sections : sections.filter((s) => s.id === view);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="shrink-0">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            {title}
          </h1>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {subtitle}
          </p>
        </div>

        {/* Sur grand écran la barre monte sur la ligne du titre, à droite ;
            sur mobile elle passe dessous et défile latéralement. */}
        <div
          role="group"
          aria-label={groupLabel}
          className="-mx-1 flex w-full gap-2 overflow-x-auto px-1 py-1 lg:mx-0 lg:min-w-0 lg:flex-1 lg:flex-wrap lg:justify-end lg:gap-1.5 lg:overflow-visible lg:px-0"
        >
          {[{ id: ALL, emoji: "✨", label: allLabel }, ...sections].map(
            (tab) => {
              const active = view === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => writeView(tab.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors lg:px-2.5",
                    active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <span aria-hidden className="text-base leading-none">
                    {tab.emoji}
                  </span>
                  {tab.label}
                </button>
              );
            },
          )}
        </div>
      </div>

      <div className="space-y-4">
        {visible.map((s) => (
          <section key={s.id} aria-label={s.label}>
            {s.content}
          </section>
        ))}
      </div>
    </div>
  );
}
