import { profilAutorise } from "@/lib/garde";
import { ENCADREMENT } from "@/components/shell/nav-config";
import { AccesRefuse } from "@/components/shell/acces-refuse";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Mail, MapPin, Phone } from "lucide-react";
import { getClient, listPdvs, listProfiles } from "@/lib/data/queries";
import {
  SCORE_CLIENT_POIDS,
  SEUIL_HAUT,
  SEUIL_MOYEN,
  STAGES_HORS_FUNNEL,
  scoreClient,
  trancheAchat,
} from "@/lib/domain";
import { daysSince, formatDate } from "@/lib/dates";
import { formatDT, formatMontant } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradeBadge } from "@/components/ui/grade-badge";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const [t, profile, data] = await Promise.all([
    getTranslations(),
    profilAutorise(ENCADREMENT),
    getClient(id),
  ]);
  if (!profile) return <AccesRefuse />;
  if (!data) notFound();

  const { client, fiches } = data;
  const [profiles, pdvs] = await Promise.all([listProfiles(), listPdvs()]);
  const conseillerName = (cid: string) => {
    const p = profiles.find((x) => x.id === cid);
    return p ? `${p.prenom} ${p.nom}` : "—";
  };
  const pdvName =
    pdvs.find((p) => p.id === client.point_de_vente_id)?.nom ?? null;

  const parDate = [...fiches].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );
  const signed = parDate.filter((f) => f.stage === "signe");

  const tranche = trancheAchat(client.ca_cumule);
  const seuilSuivant = tranche === "bas" ? SEUIL_MOYEN : SEUIL_HAUT;
  const manque = tranche === "haut" ? null : seuilSuivant - client.ca_cumule;
  const trancheLabel =
    tranche === "haut"
      ? t("clients.tranches.haut", { montant: formatDT(SEUIL_HAUT) })
      : tranche === "moyen"
        ? t("clients.tranches.moyen", {
            min: formatMontant(SEUIL_MOYEN),
            max: formatDT(SEUIL_HAUT),
          })
        : t("clients.tranches.bas", { montant: formatDT(SEUIL_MOYEN) });

  const derniere = fiches.reduce(
    (max, f) => (f.updated_at > max ? f.updated_at : max),
    client.created_at,
  );
  const enCours = fiches.filter(
    (f) =>
      f.stage !== "signe" &&
      !(STAGES_HORS_FUNNEL as readonly string[]).includes(f.stage),
  ).length;
  const score = scoreClient({
    caCumule: client.ca_cumule,
    projetsSignes: signed.length,
    projetsEnCours: enCours,
    projetsTotal: fiches.length,
    joursDepuisActivite: daysSince(derniere),
    tel: !!client.tel,
    email: !!client.email,
    adresse: !!(client.adresse ?? client.ville),
  });

  /**
   * La fiche contact porte plus de coordonnées que la ligne client (trois
   * téléphones, l'adresse complète). On lit la plus récente et on n'affiche
   * que ce que la ligne client n'a pas déjà.
   */
  const ficheContact = parDate[0] ?? null;
  const fichePhones = ficheContact
    ? (
        [
          [t("fiches.wizard.telMobile"), ficheContact.tel_mobile],
          [t("fiches.wizard.telDomicile"), ficheContact.tel_domicile],
          [t("fiches.wizard.telBureau"), ficheContact.tel_bureau],
        ] as const
      ).filter(
        (entry): entry is [string, string] =>
          !!entry[1] && entry[1] !== client.tel,
      )
    : [];
  const ficheEmail =
    ficheContact?.email && ficheContact.email !== client.email
      ? ficheContact.email
      : null;
  const ficheAdresse =
    ficheContact?.adresse_complete &&
    ficheContact.adresse_complete !== client.adresse
      ? [ficheContact.adresse_complete, ficheContact.code_postal, ficheContact.ville]
          .filter(Boolean)
          .join(", ")
      : null;
  const hasFicheContact =
    fichePhones.length > 0 || !!ficheEmail || !!ficheAdresse;

  /** Coordonnée cliquable — appeler ou écrire sans recopier. */
  const contacts: {
    icon: typeof Phone;
    label: string;
    value: string | null;
    href?: string;
    mono?: boolean;
  }[] = [
    {
      icon: Phone,
      label: t("clients.tel"),
      value: client.tel,
      href: client.tel ? `tel:${client.tel}` : undefined,
      mono: true,
    },
    {
      icon: Mail,
      label: t("clients.email"),
      value: client.email,
      href: client.email ? `mailto:${client.email}` : undefined,
    },
    {
      icon: MapPin,
      label: t("clients.adresse"),
      value:
        [client.adresse, client.ville].filter(Boolean).join(", ") || null,
    },
  ];

  return (
    <div>
      <PageHeader
        title={client.nom}
        subtitle={t("clients.clientDepuis", {
          date: formatDate(client.created_at, "MMMM yyyy", locale),
        })}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {client.vip && <Badge variant="rouge">★ {t("clients.vip")}</Badge>}
            <Badge
              variant={
                tranche === "haut"
                  ? "chene"
                  : tranche === "moyen"
                    ? "ambre"
                    : "outline"
              }
            >
              {trancheLabel}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ————— Identité & contact ————— */}
        <Card>
          <CardHeader>
            <CardTitle>{t("clients.identity")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contacts.map(({ icon: Icon, label, value, href, mono }) => {
              const inner = (
                <>
                  <Icon
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0">
                    <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </span>
                    <span className={mono ? "block font-mono" : "block"}>
                      {value ?? "—"}
                    </span>
                  </span>
                </>
              );
              return value && href ? (
                <a key={label} href={href} className="flex gap-2.5 text-sm hover:underline">
                  {inner}
                </a>
              ) : (
                <div key={label} className="flex gap-2.5 text-sm">
                  {inner}
                </div>
              );
            })}

            {/* Ce que la fiche contact sait en plus de la ligne client */}
            {hasFicheContact && ficheContact && (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("clients.detail.ficheContact")}{" "}
                  <Link
                    href={`/fiches/${ficheContact.id}`}
                    prefetch={false}
                    className="font-mono normal-case hover:underline"
                  >
                    {ficheContact.reference}
                  </Link>
                </p>
                {fichePhones.map(([label, value]) => (
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
                {ficheEmail && (
                  <a
                    href={`mailto:${ficheEmail}`}
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
                      <span className="block truncate">{ficheEmail}</span>
                    </span>
                  </a>
                )}
                {ficheAdresse && (
                  <div className="flex gap-2.5 text-sm">
                    <MapPin
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0">
                      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t("fiches.wizard.adresse")}
                      </span>
                      <span className="block">{ficheAdresse}</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            <dl className="space-y-3 border-t border-border pt-4 text-sm">
              {(
                [
                  [t("pipeline.filters.pointDeVente"), pdvName],
                  [
                    t("clients.columns.derniereActivite"),
                    formatDate(derniere, "d MMM yyyy", locale),
                  ],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd>{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* ————— Score, avec son détail ————— */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("clients.score.label")}</CardTitle>
            <span className="text-base">
              <GradeBadge score={score.total} />
            </span>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {(
                [
                  ["achats", score.achats, SCORE_CLIENT_POIDS.achats],
                  ["projets", score.projets, SCORE_CLIENT_POIDS.projets],
                  ["activite", score.activite, SCORE_CLIENT_POIDS.activite],
                  ["contact", score.contact, SCORE_CLIENT_POIDS.contact],
                ] as const
              ).map(([key, value, max]) => (
                <div key={key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">
                      {t(`clients.score.${key}`)}
                    </dt>
                    <dd className="tabular-nums">
                      {value}/{max}
                    </dd>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-chene"
                      style={{ width: `${(value / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* ————— Achats chez nous ————— */}
        <Card>
          <CardHeader>
            <CardTitle>{t("clients.filters.tranche")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="kpi-number text-4xl text-rouge">
              {formatDT(client.ca_cumule)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("clients.achete")}
            </p>

            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
              {(
                [
                  [t("clients.columns.projets"), fiches.length],
                  [t("clients.detail.signes"), signed.length],
                  [t("clients.detail.enCours"), enCours],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                  <dt className="text-[11px] text-muted-foreground">{label}</dt>
                </div>
              ))}
            </dl>

            {manque !== null && (
              <p className="mt-4 text-sm text-muted-foreground">
                {t("clients.versTranche", {
                  montant: formatDT(manque),
                  seuil: formatDT(seuilSuivant),
                })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ————— Toutes les fiches, pas seulement les signées ————— */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("clients.linkedFiches")}</CardTitle>
        </CardHeader>
        <CardContent>
          {parDate.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("clients.aucunProjet")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {parDate.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/fiches/${f.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {f.reference}
                    </span>
                    <Badge
                      variant={
                        f.stage === "signe"
                          ? "vert"
                          : f.stage === "perdu"
                            ? "rouge"
                            : "outline"
                      }
                    >
                      {t(`stages.${f.stage}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {conseillerName(f.conseiller_id)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(f.updated_at, "d MMM yyyy", locale)}
                    </span>
                    <span className="ms-auto flex items-center gap-3">
                      <span
                        className="text-xs text-muted-foreground"
                        title={t("fiches.table.score")}
                      >
                        <GradeBadge score={f.score_completude} compact />
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatDT(f.budget_estimatif)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ————— Historique des signatures ————— */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t("clients.projectHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {signed.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ol className="space-y-3">
              {signed.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex items-center gap-3">
                    <span className="size-2 rounded-full bg-vert-plan" />
                    <Link
                      href={`/fiches/${f.id}`}
                      className="font-medium hover:underline"
                    >
                      {f.reference}
                    </Link>
                    <span className="text-muted-foreground">
                      {formatDate(f.updated_at, "d MMM yyyy", locale)}
                    </span>
                  </span>
                  <span className="font-mono">
                    {formatDT(f.budget_estimatif)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
