"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Search } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import type { FicheRow } from "@/lib/database.types";
import type { StageOrPerdu } from "@/lib/domain";
import { formatDate } from "@/lib/dates";
import { formatDT } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export type StageBadgeVariant =
  | "default"
  | "rouge"
  | "chene"
  | "vert"
  | "ambre"
  | "outline";

/** Shared stage → Badge variant mapping for fiche lists. */
export function stageBadgeVariant(stage: StageOrPerdu): StageBadgeVariant {
  switch (stage) {
    case "signe":
      return "vert";
    case "perdu":
      return "rouge";
    case "devis_envoye":
    case "negociation":
      return "chene";
    case "nouveau_contact":
    case "contacte":
      return "default";
    default:
      return "outline";
  }
}

function nameInitials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function ProjectChips({ fiche }: { fiche: FicheRow }) {
  const t = useTranslations();
  const chips: string[] = [];
  if (fiche.nb_cuisines > 0) {
    chips.push(t("pipeline.projectChips.cuisine", { n: fiche.nb_cuisines }));
  }
  if (fiche.nb_dressings > 0) {
    chips.push(t("pipeline.projectChips.dressing", { n: fiche.nb_dressings }));
  }
  if (fiche.nb_sdb > 0) {
    chips.push(t("pipeline.projectChips.sdb", { n: fiche.nb_sdb }));
  }
  if (chips.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip) => (
        <span
          key={chip}
          className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function Completude({ score }: { score: number }) {
  const t = useTranslations();
  return (
    <div className="mt-1 flex items-center gap-2">
      <Progress
        value={score}
        className="h-1.5 w-20"
        aria-label={t("fiches.completude")}
      />
      <span className="text-xs tabular-nums text-muted-foreground">
        {score}%
      </span>
    </div>
  );
}

function ConseillerCell({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-7">
        <AvatarFallback>{nameInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="whitespace-nowrap text-sm">{name}</span>
    </div>
  );
}

export function FichesList({
  fiches,
  conseillers,
}: {
  fiches: FicheRow[];
  conseillers: Record<string, string>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fiches;
    return fiches.filter((f) => {
      const haystack = [
        f.client_nom,
        f.reference,
        f.tel_mobile ?? "",
        f.tel_domicile ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [fiches, query]);

  if (fiches.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("fiches.empty")}
        </p>
        <Link href="/fiches/nouvelle" className={buttonVariants()}>
          <Plus />
          {t("fiches.new")}
        </Link>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Label htmlFor="fiche-search" className="sr-only">
            {t("fiches.searchPlaceholder")}
          </Label>
          <Search
            aria-hidden
            className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="fiche-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("fiches.searchPlaceholder")}
            className="ps-11"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {t("fiches.count", { count: filtered.length })}
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {t("fiches.emptyFiltered")}
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 text-start font-medium">
                    {t("fiches.columns.client")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">
                    {t("fiches.columns.ville")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">
                    {t("fiches.columns.projet")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">
                    {t("fiches.columns.budget")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">
                    {t("fiches.columns.stage")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">
                    {t("fiches.columns.conseiller")}
                  </th>
                  <th className="px-4 py-3 text-start font-medium">
                    {t("fiches.columns.date")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => {
                  const conseiller = conseillers[f.conseiller_id] ?? "—";
                  return (
                    <tr
                      key={f.id}
                      onClick={() => router.push(`/fiches/${f.id}`)}
                      className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-secondary/50"
                    >
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/fiches/${f.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold hover:underline"
                        >
                          {f.client_nom}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground">
                          {f.reference}
                        </p>
                        <Completude score={f.score_completude} />
                      </td>
                      <td className="px-4 py-3 align-top">{f.ville ?? "—"}</td>
                      <td className="px-4 py-3 align-top">
                        <ProjectChips fiche={f} />
                      </td>
                      <td className="px-4 py-3 align-top font-mono">
                        {formatDT(f.budget_estimatif)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge variant={stageBadgeVariant(f.stage)}>
                          {t(`stages.${f.stage}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <ConseillerCell name={conseiller} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-muted-foreground">
                        {formatDate(f.created_at, "d MMM yyyy", locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile stacked cards */}
          <ul className="space-y-3 md:hidden">
            {filtered.map((f) => {
              const conseiller = conseillers[f.conseiller_id] ?? "—";
              return (
                <li key={f.id}>
                  <Link
                    href={`/fiches/${f.id}`}
                    className="card-lift block rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{f.client_nom}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {f.reference}
                        </p>
                      </div>
                      <Badge variant={stageBadgeVariant(f.stage)}>
                        {t(`stages.${f.stage}`)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {f.ville ?? "—"} ·{" "}
                      {formatDate(f.created_at, "d MMM yyyy", locale)}
                    </p>
                    <div className="mt-2">
                      <ProjectChips fiche={f} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <ConseillerCell name={conseiller} />
                      <span className="font-mono text-sm">
                        {formatDT(f.budget_estimatif)}
                      </span>
                    </div>
                    <Completude score={f.score_completude} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
