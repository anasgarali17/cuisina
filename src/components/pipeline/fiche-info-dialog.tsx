"use client";

import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Mail, MapPin, Phone, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { FicheRow, PointDeVenteRow, ProfileRow } from "@/lib/database.types";
import { formatDate } from "@/lib/dates";
import { formatDT } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GradeBadge } from "@/components/ui/grade-badge";

/**
 * Tout ce qu'on sait du client, sans quitter le pipeline : la carte s'ouvre
 * sur place, comme une rangée de la section Clients. La fiche complète reste
 * à un tap pour ce qui s'édite.
 */
export function FicheInfoDialog({
  fiche,
  profileById,
  pdvs,
  onOpenChange,
}: {
  fiche: FicheRow | null;
  profileById: Map<string, ProfileRow>;
  pdvs: PointDeVenteRow[];
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  if (!fiche) return null;

  const conseiller = profileById.get(fiche.conseiller_id);
  const pdv = pdvs.find((p) => p.id === fiche.point_de_vente_id);
  const adresse =
    [fiche.adresse_complete, fiche.code_postal, fiche.ville]
      .filter(Boolean)
      .join(", ") || null;

  const phones = (
    [
      [t("fiches.wizard.telMobile"), fiche.tel_mobile],
      [t("fiches.wizard.telDomicile"), fiche.tel_domicile],
      [t("fiches.wizard.telBureau"), fiche.tel_bureau],
    ] as const
  ).filter((entry): entry is [string, string] => !!entry[1]);

  const projet = (
    [
      [t("fiches.wizard.nbCuisines"), fiche.nb_cuisines],
      [t("fiches.wizard.nbDressings"), fiche.nb_dressings],
    ] as const
  ).filter(([, n]) => n > 0);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pe-8">
            <DialogTitle>{fiche.client_nom}</DialogTitle>
            <Badge
              variant={
                fiche.stage === "signe"
                  ? "vert"
                  : fiche.stage === "perdu"
                    ? "rouge"
                    : "outline"
              }
            >
              {t(`stages.${fiche.stage}`)}
            </Badge>
          </div>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-xs">{fiche.reference}</span>
            <span aria-hidden>·</span>
            <span>{formatDate(fiche.created_at, "d MMM yyyy", locale)}</span>
            <span aria-hidden>·</span>
            <span title={t("fiches.table.score")}>
              <GradeBadge score={fiche.score_completude} />
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* — Coordonnées : appeler ou écrire directement — */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {phones.map(([label, value]) => (
              <a
                key={label}
                href={`tel:${value}`}
                className="flex gap-2.5 text-sm hover:underline"
              >
                <Phone
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0">
                  <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                  <span className="block font-mono">{value}</span>
                </span>
              </a>
            ))}
            {fiche.email && (
              <a
                href={`mailto:${fiche.email}`}
                className="flex gap-2.5 text-sm hover:underline"
              >
                <Mail
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0">
                  <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t("fiches.wizard.email")}
                  </span>
                  <span className="block truncate">{fiche.email}</span>
                </span>
              </a>
            )}
            {adresse && (
              <div className="flex gap-2.5 text-sm sm:col-span-2">
                <MapPin
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0">
                  <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t("fiches.wizard.adresse")}
                  </span>
                  <span className="block">{adresse}</span>
                </span>
              </div>
            )}
            {phones.length === 0 && !fiche.email && !adresse && (
              <p className="text-sm text-muted-foreground sm:col-span-2">—</p>
            )}
          </div>

          {/* — Le projet — */}
          <div className="rounded-2xl border border-border p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {projet.length === 0 ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                projet.map(([label, n]) => (
                  <span
                    key={label}
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {label} × {n}
                  </span>
                ))
              )}
              {fiche.origine && (
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {t(`origines.${fiche.origine}`)}
                </span>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("fiches.columns.budget")}
                </dt>
                <dd className="font-semibold tabular-nums">
                  {formatDT(fiche.budget_estimatif)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("fiches.wizard.dateLivraison")}
                </dt>
                <dd>
                  {fiche.date_livraison_souhaitee
                    ? formatDate(
                        fiche.date_livraison_souhaitee,
                        "d MMM yyyy",
                        locale,
                      )
                    : "—"}
                </dd>
              </div>
            </dl>
            {fiche.observations && (
              <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                {fiche.observations}
              </p>
            )}
          </div>

          {/* — Qui s'en occupe — */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <User aria-hidden className="size-3.5" />
              {conseiller ? `${conseiller.prenom} ${conseiller.nom}` : "—"}
            </span>
            {pdv && <span>{pdv.nom}</span>}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/fiches/${fiche.id}`}
              prefetch={false}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <ExternalLink aria-hidden className="size-3.5" />
              {t("pipeline.openFiche")}
            </Link>
            {fiche.client_id && (
              <Link
                href={`/clients/${fiche.client_id}`}
                prefetch={false}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ExternalLink aria-hidden className="size-3.5" />
                {t("clients.openFull")}
              </Link>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
