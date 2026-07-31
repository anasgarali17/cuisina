"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { FicheRow } from "@/lib/database.types";
import { formatDate } from "@/lib/dates";
import { cn, formatDT } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { stageBadgeVariant } from "@/components/fiches/fiches-list";

const CELL = "border-e border-border px-4 py-3 align-middle last:border-e-0";

/** The reference's bottom strip: filter pills + a compact gridded table. */
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
            <tr className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
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
                {t("fiches.columns.date")}
              </th>
            </tr>
          </thead>
          <tbody>
            {fiches.map((f) => (
              <tr
                key={f.id}
                className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/50"
              >
                <td className={CELL}>
                  <Link
                    href={`/fiches/${f.id}`}
                    className="font-semibold hover:underline"
                  >
                    {f.client_nom}
                  </Link>
                  <p className="font-mono text-xs text-muted-foreground">
                    {f.reference}
                  </p>
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
                <td className={cn(CELL, "font-mono")}>
                  {formatDT(f.budget_estimatif)}
                </td>
                <td className={CELL}>
                  <Badge variant={stageBadgeVariant(f.stage)}>
                    {t(`stages.${f.stage}`)}
                  </Badge>
                </td>
                <td className={CELL}>{conseillers[f.conseiller_id] ?? "—"}</td>
                <td className={cn(CELL, "whitespace-nowrap text-muted-foreground")}>
                  {formatDate(f.updated_at, "d MMM", locale)}
                </td>
              </tr>
            ))}
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
