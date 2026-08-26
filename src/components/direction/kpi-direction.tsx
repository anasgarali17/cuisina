"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, PackageCheck } from "lucide-react";
import type { KpiPeriode, LigneKpi } from "@/lib/data/kpi-direction";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ClePeriode = "mois" | "j30" | "j90";

const PERIODES: ClePeriode[] = ["mois", "j30", "j90"];

/**
 * Les indicateurs de la direction, en deux lectures de la même période :
 * par conseiller, puis par showroom.
 *
 * Les trois périodes sont calculées d'avance côté serveur : passer de l'une à
 * l'autre est une question qu'on se pose trois fois de suite, et attendre un
 * aller-retour à chaque fois casserait la comparaison.
 */
export function KpiDirection({
  periodes,
}: {
  periodes: Record<ClePeriode, KpiPeriode>;
}) {
  const t = useTranslations();
  const [periode, setPeriode] = useState<ClePeriode>("mois");
  const donnees = periodes[periode];

  return (
    <div className="space-y-5">
      {/* — Le sélecteur de période — */}
      <div className="flex flex-wrap gap-1.5">
        {PERIODES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriode(p)}
            aria-pressed={periode === p}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              periode === p
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-secondary/60",
            )}
          >
            {t(`direction.periodes.${p}`)}
          </button>
        ))}
      </div>

      {/* — Les deux totaux — */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Total
          icon={FileText}
          libelle={t("direction.devis")}
          valeur={donnees.devis}
        />
        <Total
          icon={PackageCheck}
          libelle={t("direction.commandes")}
          valeur={donnees.commandes}
          accent
        />
      </div>

      {/* — Les deux découpages — */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Tableau
          titre={t("direction.parConseiller")}
          lignes={donnees.parConseiller}
          vide={t("direction.vide")}
        />
        <Tableau
          titre={t("direction.parShowroom")}
          lignes={donnees.parShowroom}
          vide={t("direction.vide")}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {t("direction.note")}
      </p>
    </div>
  );
}

function Total({
  icon: Icon,
  libelle,
  valeur,
  accent,
}: {
  icon: typeof FileText;
  libelle: string;
  valeur: number;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-2xl",
            accent
              ? "bg-vert-plan/10 text-vert-plan"
              : "bg-secondary text-muted-foreground",
          )}
        >
          <Icon aria-hidden className="size-5" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {libelle}
          </p>
          <p className="kpi-number text-3xl">{valeur}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Tableau({
  titre,
  lignes,
  vide,
}: {
  titre: string;
  lignes: LigneKpi[];
  vide: string;
}) {
  const t = useTranslations();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titre}</CardTitle>
      </CardHeader>
      <CardContent>
        {lignes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{vide}</p>
        ) : (
          /* La table déborde plutôt que la page : trois colonnes tiennent sur
             un téléphone, mais un nom long ne doit pas pousser le reste. */
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[20rem] text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 text-start font-medium">
                    {t("direction.colonneNom")}
                  </th>
                  <th className="pb-2 text-end font-medium">
                    {t("direction.devisCourt")}
                  </th>
                  <th className="pb-2 text-end font-medium">
                    {t("direction.commandesCourt")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2">
                      <span className="font-medium">{l.libelle}</span>
                      {l.detail && (
                        <span className="block text-xs text-muted-foreground">
                          {l.detail}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-end tabular-nums">{l.devis}</td>
                    <td className="py-2 text-end font-semibold tabular-nums text-vert-plan">
                      {l.commandes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
