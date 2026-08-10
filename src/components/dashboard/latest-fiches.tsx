"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowUpRight,
  ChevronsUpDown,
  MoreVertical,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { FicheRow } from "@/lib/database.types";
import { formatDate } from "@/lib/dates";
import type { StageOrPerdu } from "@/lib/domain";
import { STAGE_CHIP } from "@/lib/stage-ui";
import { cn, formatDT } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CELL = "px-4 py-4 align-middle";
const HEAD = "px-4 py-3 text-start text-xs font-medium uppercase tracking-wide";

/** Tinted stage chips — reference-style pills with a leading dot glyph. */

function StageChip({ stage, label }: { stage: StageOrPerdu; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STAGE_CHIP[stage],
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
}

/** A header label with the reference's sort affordance (decorative only). */
function SortableHead({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <ChevronsUpDown aria-hidden="true" className="size-3 opacity-40" />
    </span>
  );
}

/** The reference's bottom strip: filter pills + a "Recent Transaction" card. */
export function LatestFiches({
  fiches,
  conseillers,
  total,
}: {
  fiches: FicheRow[];
  conseillers: Record<string, string>;
  total: number;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fiches;
    return fiches.filter(
      (f) =>
        f.client_nom.toLowerCase().includes(q) ||
        f.reference.toLowerCase().includes(q),
    );
  }, [fiches, query]);

  const allVisibleSelected =
    visible.length > 0 && visible.every((f) => selected.has(f.id));
  const someVisibleSelected =
    !allVisibleSelected && visible.some((f) => selected.has(f.id));
  const headerChecked: boolean | "indeterminate" = someVisibleSelected
    ? "indeterminate"
    : allVisibleSelected;

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const f of visible) {
        if (checked) next.add(f.id);
        else next.delete(f.id);
      }
      return next;
    });
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div>
      {/* The card below carries the heading; these are just quick links. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link
          href="/fiches"
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          {t("fiches.title")}
          <span className="ms-1.5 font-mono text-muted-foreground">{total}</span>
        </Link>
        <Link
          href="/pipeline"
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          {t("pipeline.title")}
        </Link>
        <Link
          href="/fiches"
          className="ms-auto flex items-center gap-1 text-xs font-medium text-rouge hover:underline"
        >
          {t("app.seeAll")}
          <ArrowUpRight className="size-3.5 rtl:-scale-x-100" />
        </Link>
      </div>

      <Card className="hidden overflow-hidden md:block">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h3 className="font-display text-lg font-semibold">
            {t("dashboard.hub.dernieresFiches")}
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("fiches.table.rechercher")}
                aria-label={t("fiches.table.rechercher")}
                className="h-9 w-56 rounded-xl border border-transparent bg-secondary/60 ps-9 pe-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              />
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-sm hover:bg-secondary"
            >
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              {t("fiches.table.filtrer")}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className={cn(HEAD, "w-10")}>
                  <Checkbox
                    checked={headerChecked}
                    onCheckedChange={(c) => toggleAll(c === true)}
                    aria-label={t("fiches.columns.client")}
                  />
                </th>
                <th className={HEAD}>
                  <SortableHead label={t("fiches.reference")} />
                </th>
                <th className={HEAD}>
                  <SortableHead label={t("fiches.columns.client")} />
                </th>
                <th className={HEAD}>
                  <SortableHead label={t("fiches.columns.conseiller")} />
                </th>
                <th className={HEAD}>
                  <SortableHead label={t("fiches.columns.date")} />
                </th>
                <th className={HEAD}>
                  <SortableHead label={t("fiches.columns.budget")} />
                </th>
                <th className={HEAD}>
                  <SortableHead label={t("fiches.columns.stage")} />
                </th>
                <th className={cn(HEAD, "w-12")}>
                  <span className="sr-only">{t("fiches.table.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => {
                const isSelected = selected.has(f.id);
                return (
                  <tr
                    key={f.id}
                    className={cn(
                      "border-b border-border transition-colors last:border-b-0 hover:bg-secondary/40",
                      isSelected && "bg-primary/5",
                    )}
                  >
                    <td className={CELL}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(c) => toggleOne(f.id, c === true)}
                        aria-label={f.client_nom}
                      />
                    </td>
                    <td
                      className={cn(
                        CELL,
                        "whitespace-nowrap font-mono text-xs text-muted-foreground",
                      )}
                    >
                      {f.reference}
                    </td>
                    <td className={CELL}>
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold"
                        >
                          {initials(f.client_nom)}
                        </span>
                        <Link
                          href={`/fiches/${f.id}`}
                          prefetch={false}
                          className="font-semibold hover:underline"
                        >
                          {f.client_nom}
                        </Link>
                      </div>
                    </td>
                    <td className={cn(CELL, "text-muted-foreground")}>
                      {conseillers[f.conseiller_id] ?? "—"}
                    </td>
                    <td
                      className={cn(
                        CELL,
                        "whitespace-nowrap text-muted-foreground",
                      )}
                    >
                      {formatDate(f.updated_at, "d MMM yyyy", locale)}
                    </td>
                    <td className={cn(CELL, "font-semibold tabular-nums")}>
                      {formatDT(f.budget_estimatif)}
                    </td>
                    <td className={CELL}>
                      <StageChip
                        stage={f.stage}
                        label={t(`stages.${f.stage}`)}
                      />
                    </td>
                    <td className={CELL}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={t("fiches.table.actions")}
                            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                          >
                            <MoreVertical aria-hidden="true" className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/fiches/${f.id}`} prefetch={false}>
                              {t("app.seeAll")}
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile: compact rows */}
      <ul className="space-y-2 md:hidden">
        {fiches.map((f) => (
          <li key={f.id}>
            <Link
              href={`/fiches/${f.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {f.client_nom}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatDT(f.budget_estimatif)}
                </span>
              </span>
              <StageChip stage={f.stage} label={t(`stages.${f.stage}`)} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
