"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { FicheRow } from "@/lib/database.types";
import { formatDate } from "@/lib/dates";
import type { StageOrPerdu } from "@/lib/domain";
import { STAGE_CHIP, stageProgress } from "@/lib/stage-ui";
import { cn, formatDT } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { stageBadgeVariant } from "@/components/fiches/fiches-list";

const CELL = "px-4 py-4 align-middle";

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

/** The reference's bottom strip: filter pills + an airy borderless table. */
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

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="me-2 font-display text-lg font-semibold">
          {t("dashboard.hub.dernieresFiches")}
        </h2>
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
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className={cn(CELL, "text-start font-medium")}>
                {t("fiches.columns.client")}
              </th>
              <th className={cn(CELL, "text-start font-medium")}>
                {t("fiches.columns.projet")}
              </th>
              <th className={cn(CELL, "text-start font-medium")}>
                {t("fiches.columns.budget")}
              </th>
              <th className={cn(CELL, "text-start font-medium")}>
                {t("fiches.columns.stage")}
              </th>
              <th className={cn(CELL, "text-start font-medium")}>
                {t("fiches.columns.conseiller")}
              </th>
              <th className={cn(CELL, "text-start font-medium")}>
                {t("fiches.table.avancement")}
              </th>
              <th className={cn(CELL, "text-start font-medium")}>
                {t("fiches.columns.date")}
              </th>
            </tr>
          </thead>
          <tbody>
            {fiches.map((f) => {
              const progress = stageProgress(f.stage);
              return (
                <tr
                  key={f.id}
                  className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/40"
                >
                  <td className={CELL}>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold"
                      >
                        {initials(f.client_nom)}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/fiches/${f.id}`}
                          className="font-semibold hover:underline"
                        >
                          {f.client_nom}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground">
                          {f.reference}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className={CELL}>
                    {f.nb_cuisines > 0 &&
                      t("pipeline.projectChips.cuisine", { n: f.nb_cuisines })}
                    {f.nb_dressings > 0 && (
                      <>
                        {f.nb_cuisines > 0 && " · "}
                        {t("pipeline.projectChips.dressing", {
                          n: f.nb_dressings,
                        })}
                      </>
                    )}
                    {f.nb_sdb > 0 && (
                      <>
                        {(f.nb_cuisines > 0 || f.nb_dressings > 0) && " · "}
                        {t("pipeline.projectChips.sdb", { n: f.nb_sdb })}
                      </>
                    )}
                  </td>
                  <td className={cn(CELL, "font-semibold tabular-nums")}>
                    {formatDT(f.budget_estimatif)}
                  </td>
                  <td className={CELL}>
                    <StageChip stage={f.stage} label={t(`stages.${f.stage}`)} />
                  </td>
                  <td className={CELL}>
                    {conseillers[f.conseiller_id] ?? "—"}
                  </td>
                  <td className={CELL}>
                    <div className="min-w-24">
                      <span className="font-bold tabular-nums">
                        {progress}
                        <span className="text-xs font-medium text-muted-foreground">
                          %
                        </span>
                      </span>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td
                    className={cn(CELL, "whitespace-nowrap text-muted-foreground")}
                  >
                    {formatDate(f.updated_at, "d MMM", locale)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
              <Badge variant={stageBadgeVariant(f.stage)}>
                {t(`stages.${f.stage}`)}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
