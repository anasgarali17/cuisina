"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronRight,
  Columns3,
  Download,
  ExternalLink,
  LayoutList,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Search,
  Star,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { toggleVip } from "@/lib/actions/client-actions";
import type { ClientRow, PointDeVenteRow } from "@/lib/database.types";
import {
  SCORE_CLIENT_POIDS,
  SEUIL_HAUT,
  SEUIL_MOYEN,
  trancheAchat,
  type ScoreClient,
  type StageOrPerdu,
  type TrancheAchat,
} from "@/lib/domain";
import { STAGE_CHIP } from "@/lib/stage-ui";
import { formatDate } from "@/lib/dates";
import { cn, formatDT, formatMontant, messageErreur } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { GradeBadge } from "@/components/ui/grade-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

export type ClientStatut = "actif" | "signe" | "dormant";

export interface ClientProjet {
  id: string;
  reference: string;
  stage: StageOrPerdu;
  budget: number | null;
  date: string;
}

export interface ClientMeta {
  statut: ClientStatut;
  enCours: number;
  derniereActivite: string;
  projets: ClientProjet[];
  score: ScoreClient;
}

type SortKey = "ca" | "score" | "nom" | "activite";
type ViewKey = "cards" | "board";

/**
 * Les rangées se regroupent sous ces bandeaux. Le VIP passe devant sa propre
 * tranche : un VIP qui a beaucoup acheté apparaît une seule fois, en tête —
 * dupliquer un client dans deux sections rendrait tous les totaux faux à l'œil.
 */
type SegmentKey = "vip" | TrancheAchat;
const SEGMENTS: SegmentKey[] = ["vip", "haut", "moyen", "bas"];

const SEGMENT_ACCENT: Record<SegmentKey, string> = {
  vip: "bg-rouge",
  haut: "bg-chene",
  moyen: "bg-ambre",
  bas: "bg-muted-foreground/40",
};

const STATUT_BADGE: Record<ClientStatut, "vert" | "chene" | "outline"> = {
  actif: "chene",
  signe: "vert",
  dormant: "outline",
};

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function segmentOf(c: ClientRow): SegmentKey {
  return c.vip ? "vip" : trancheAchat(c.ca_cumule);
}

function Contact({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Phone;
  label: string;
  value: string | null;
  href?: string;
}) {
  const inner = (
    <>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="block truncate">{value ?? "—"}</span>
      </span>
    </>
  );
  return value && href ? (
    <a href={href} className="flex gap-2.5 text-sm hover:underline">
      {inner}
    </a>
  ) : (
    <div className="flex gap-2.5 text-sm">{inner}</div>
  );
}

export function ClientsWorkspace({
  clients,
  pdvs,
  meta,
}: {
  clients: ClientRow[];
  pdvs: PointDeVenteRow[];
  meta: Record<string, ClientMeta>;
}) {
  const t = useTranslations();
  const locale = useLocale();

  const [rows, setRows] = useState(clients);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string>(ALL);
  const [villeFilter, setVilleFilter] = useState<string>(ALL);
  const [pdvFilter, setPdvFilter] = useState<string>(ALL);
  const [statutFilter, setStatutFilter] = useState<string>(ALL);
  const [sort, setSort] = useState<SortKey>("ca");
  const [view, setView] = useState<ViewKey>("cards");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const villes = useMemo(
    () =>
      Array.from(
        new Set(rows.map((c) => c.ville).filter((v): v is string => !!v)),
      ).sort((a, b) => a.localeCompare(b, locale)),
    [rows, locale],
  );

  const metaOf = (id: string): ClientMeta =>
    meta[id] ?? {
      statut: "dormant",
      enCours: 0,
      derniereActivite: "",
      projets: [],
      score: { total: 0, achats: 0, projets: 0, activite: 0, contact: 0 },
    };

  /** Le libellé d'un segment : « VIP », sinon le montant acheté, en dinars. */
  function segmentLabel(key: SegmentKey): string {
    switch (key) {
      case "vip":
        return t("clients.vip");
      case "haut":
        return t("clients.tranches.haut", { montant: formatDT(SEUIL_HAUT) });
      case "moyen":
        return t("clients.tranches.moyen", {
          min: formatMontant(SEUIL_MOYEN),
          max: formatDT(SEUIL_HAUT),
        });
      case "bas":
        return t("clients.tranches.bas", { montant: formatDT(SEUIL_MOYEN) });
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((c) => {
      if (segmentFilter !== ALL && segmentOf(c) !== segmentFilter) return false;
      if (villeFilter !== ALL && c.ville !== villeFilter) return false;
      if (pdvFilter !== ALL && c.point_de_vente_id !== pdvFilter) return false;
      if (statutFilter !== ALL && metaOf(c.id).statut !== statutFilter) {
        return false;
      }
      if (!q) return true;
      return [c.nom, c.tel ?? "", c.email ?? "", c.ville ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, meta, query, segmentFilter, villeFilter, pdvFilter, statutFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "nom":
          return a.nom.localeCompare(b.nom, locale);
        case "score":
          return metaOf(b.id).score.total - metaOf(a.id).score.total;
        case "activite":
          return metaOf(b.id).derniereActivite.localeCompare(
            metaOf(a.id).derniereActivite,
          );
        default:
          return b.ca_cumule - a.ca_cumule;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, meta, sort, locale]);

  /** Une section par segment, dans l'ordre. */
  const allSections = useMemo(
    () =>
      SEGMENTS.map((key) => {
        const members = sorted.filter((c) => segmentOf(c) === key);
        return {
          key,
          members,
          total: members.reduce((sum, c) => sum + c.ca_cumule, 0),
        };
      }),
    [sorted],
  );

  // En liste, une section vide ne dit rien et coupe le fil ; en colonnes elle
  // tient sa place, comme une étape vide du pipeline.
  const sections = useMemo(
    () => allSections.filter((s) => s.members.length > 0),
    [allSections],
  );
  const boardSections = allSections;

  const segmentCounts = useMemo(() => {
    const counts = {} as Record<SegmentKey, number>;
    for (const key of SEGMENTS) {
      counts[key] = rows.filter((c) => segmentOf(c) === key).length;
    }
    return counts;
  }, [rows]);

  const totals = useMemo(
    () => ({
      ca: filtered.reduce((sum, c) => sum + c.ca_cumule, 0),
      count: filtered.length,
    }),
    [filtered],
  );

  const hasFilters =
    query.trim() !== "" ||
    segmentFilter !== ALL ||
    villeFilter !== ALL ||
    pdvFilter !== ALL ||
    statutFilter !== ALL;

  function resetFilters() {
    setQuery("");
    setSegmentFilter(ALL);
    setVilleFilter(ALL);
    setPdvFilter(ALL);
    setStatutFilter(ALL);
  }

  function onToggleVip(client: ClientRow) {
    const next = !client.vip;
    setRows((list) =>
      list.map((c) => (c.id === client.id ? { ...c, vip: next } : c)),
    );
    setError(null);
    startTransition(async () => {
      const result = await toggleVip({ id: client.id, vip: next });
      if (!result.ok) {
        setRows((list) =>
          list.map((c) => (c.id === client.id ? { ...c, vip: !next } : c)),
        );
        setError(
          messageErreur(t, result.error),
        );
      }
    });
  }

  function exportCsv() {
    const header = [
      t("clients.nom"),
      t("clients.ville"),
      t("clients.tel"),
      t("clients.email"),
      t("clients.filters.tranche"),
      t("clients.vip"),
      t("clients.columns.statut"),
      t("clients.columns.projets"),
      t("clients.caCumule"),
      t("clients.score.label"),
    ];
    const body = sorted.map((c) => [
      c.nom,
      c.ville ?? "",
      c.tel ?? "",
      c.email ?? "",
      segmentLabel(trancheAchat(c.ca_cumule)),
      c.vip ? "1" : "0",
      t(`clients.statuts.${metaOf(c.id).statut}`),
      c.nb_projets,
      c.ca_cumule,
      metaOf(c.id).score.total,
    ]);
    const csv =
      "﻿" +
      [header, ...body].map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (clients.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {t("clients.empty")}
        </p>
      </Card>
    );
  }

  return (
    <div>
      {/* ————— Barre de filtres ————— */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Label htmlFor="client-search" className="sr-only">
              {t("clients.searchPlaceholder")}
            </Label>
            <Search
              aria-hidden
              className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="client-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("clients.searchPlaceholder")}
              className="h-10 rounded-xl ps-11"
            />
          </div>

          <Select value={villeFilter} onValueChange={setVilleFilter}>
            <SelectTrigger
              aria-label={t("clients.ville")}
              className="h-10 w-auto min-w-32 rounded-xl bg-card text-sm"
            >
              <SelectValue placeholder={t("clients.ville")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("clients.ville")}</SelectItem>
              {villes.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statutFilter} onValueChange={setStatutFilter}>
            <SelectTrigger
              aria-label={t("clients.columns.statut")}
              className="h-10 w-auto min-w-32 rounded-xl bg-card text-sm"
            >
              <SelectValue placeholder={t("clients.columns.statut")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("clients.columns.statut")}</SelectItem>
              {(["actif", "signe", "dormant"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`clients.statuts.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {pdvs.length > 1 && (
            <Select value={pdvFilter} onValueChange={setPdvFilter}>
              <SelectTrigger
                aria-label={t("pipeline.filters.pointDeVente")}
                className="h-10 w-auto min-w-32 rounded-xl bg-card text-sm"
              >
                <SelectValue placeholder={t("pipeline.filters.pointDeVente")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>
                  {t("pipeline.filters.pointDeVente")}
                </SelectItem>
                {pdvs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger
              aria-label={t("clients.sort.label")}
              className="h-10 w-auto min-w-32 rounded-xl bg-card text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ca">{t("clients.sort.ca")}</SelectItem>
              <SelectItem value="score">{t("clients.sort.score")}</SelectItem>
              <SelectItem value="nom">{t("clients.sort.nom")}</SelectItem>
              <SelectItem value="activite">
                {t("clients.sort.activite")}
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Liste ou tableau — la même donnée, deux façons de la lire */}
          <div className="inline-flex h-10 shrink-0 items-center rounded-xl border border-border bg-card p-1">
            {(
              [
                ["cards", LayoutList, t("clients.view.cards")],
                ["board", Columns3, t("clients.view.board")],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                aria-pressed={view === key}
                aria-label={label}
                title={label}
                className={cn(
                  "grid size-8 place-items-center rounded-lg transition-colors",
                  view === key
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="ms-auto inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            <Download aria-hidden className="size-4" />
            {t("fiches.table.exportList")}
          </button>
        </div>

        {/* Segments : le VIP d'abord, puis les trois niveaux */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSegmentFilter(ALL)}
            aria-pressed={segmentFilter === ALL}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              segmentFilter === ALL
                ? "border-transparent bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t("clients.filters.tous")}
            <span className="ms-1.5 tabular-nums opacity-60">
              {rows.length}
            </span>
          </button>
          {SEGMENTS.map((key) => {
            const active = segmentFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSegmentFilter(key)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-transparent bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {key === "vip" ? (
                  <Star
                    aria-hidden
                    className={cn(
                      "size-3",
                      active ? "fill-current" : "fill-rouge text-rouge",
                    )}
                  />
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      active ? "bg-current" : SEGMENT_ACCENT[key],
                    )}
                  />
                )}
                {segmentLabel(key)}
                <span className="tabular-nums opacity-60">
                  {segmentCounts[key]}
                </span>
              </button>
            );
          })}

          <span className="ms-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {t("clients.count", { count: totals.count })}
            </span>
            <span aria-hidden>·</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatDT(totals.ca)}
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <RotateCcw aria-hidden className="size-3" />
                {t("pipeline.filters.reset")}
              </button>
            )}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-rouge">
          {error}
        </p>
      )}

      {/* ————— Les rangées, groupées par segment ————— */}
      {sections.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {t("clients.emptyFiltered")}
          </p>
        </Card>
      ) : view === "board" ? (
        <ClientsBoard
          sections={boardSections}
          metaOf={metaOf}
          segmentLabel={segmentLabel}
        />
      ) : (
        <>
          <div className="space-y-7">
            {sections.map((section) => (
              <section key={section.key}>
                <div className="mb-2.5 flex items-center gap-2.5 px-1">
                  <span
                    aria-hidden
                    className={cn(
                      "h-4 w-1 rounded-full",
                      SEGMENT_ACCENT[section.key],
                    )}
                  />
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {segmentLabel(section.key)}
                  </h2>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {section.members.length}
                  </span>
                  <span className="ms-auto text-xs font-semibold tabular-nums">
                    {formatDT(section.total)}
                  </span>
                </div>

                <div className="space-y-2">
                  {section.members.map((client) => (
                    <ClientRowCard
                      key={client.id}
                      client={client}
                      meta={metaOf(client.id)}
                      locale={locale}
                      open={openId === client.id}
                      pending={pending}
                      onToggle={() =>
                        setOpenId((id) => (id === client.id ? null : client.id))
                      }
                      onToggleVip={() => onToggleVip(client)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Les mêmes clients en colonnes côte à côte, comme le pipeline : une tranche
 * d'achat par colonne, qui défilent à l'horizontale. On compare les paquets
 * plutôt que les lignes.
 */
function ClientsBoard({
  sections,
  metaOf,
  segmentLabel,
}: {
  sections: { key: SegmentKey; members: ClientRow[]; total: number }[];
  metaOf: (id: string) => ClientMeta;
  segmentLabel: (key: SegmentKey) => string;
}) {
  const t = useTranslations();

  return (
    <div className="kanban-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
      {sections.map((section) => (
        <div
          key={section.key}
          className="w-[85vw] shrink-0 snap-center sm:w-80 md:w-72 md:snap-align-none"
        >
          <div className="mb-2 flex items-center gap-2 px-1">
            <span
              aria-hidden
              className={cn("h-4 w-1 rounded-full", SEGMENT_ACCENT[section.key])}
            />
            <h2 className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {segmentLabel(section.key)}
            </h2>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
              {section.members.length}
            </span>
            <span className="ms-auto whitespace-nowrap text-[11px] font-semibold tabular-nums">
              {formatDT(section.total)}
            </span>
          </div>

          <div className="min-h-36 space-y-2 rounded-2xl bg-brume/25 p-2">
            {section.members.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs italic text-muted-foreground">
                {t("clients.view.emptyColumn")}
              </p>
            ) : (
              section.members.map((client) => {
                const meta = metaOf(client.id);
                return (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    prefetch={false}
                    className="card-lift block rounded-2xl border border-border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">
                            {client.nom}
                          </span>
                          {client.vip && (
                            <Star
                              aria-label={t("clients.vip")}
                              className="size-3 shrink-0 fill-rouge text-rouge"
                            />
                          )}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {client.ville ?? "—"}
                        </span>
                      </span>
                      <GradeBadge score={meta.score.total} compact />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant={STATUT_BADGE[meta.statut]}>
                        {t(`clients.statuts.${meta.statut}`)}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {t("clients.nbProjets", { count: client.nb_projets })}
                      </span>
                    </div>

                    {client.tel && (
                      <p className="mt-2 font-mono text-xs text-muted-foreground">
                        {client.tel}
                      </p>
                    )}

                    <p className="mt-2 border-t border-border pt-2 text-end font-display text-base font-semibold tabular-nums">
                      {formatDT(client.ca_cumule)}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Une rangée pleine largeur, qui s'ouvre sur place. */
function ClientRowCard({
  client,
  meta,
  locale,
  open,
  pending,
  onToggle,
  onToggleVip,
}: {
  client: ClientRow;
  meta: ClientMeta;
  locale: string;
  open: boolean;
  pending: boolean;
  onToggle: () => void;
  onToggleVip: () => void;
}) {
  const t = useTranslations();

  return (
    <Card
      className={cn(
        "overflow-hidden transition-shadow",
        open ? "shadow-md" : "hover:shadow-sm",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-4 text-start transition-colors hover:bg-secondary/30"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-display text-base font-semibold">
              {client.nom}
            </span>
            {client.vip && (
              <Star
                aria-label={t("clients.vip")}
                className="size-3.5 shrink-0 fill-rouge text-rouge"
              />
            )}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{client.ville ?? "—"}</span>
            <span aria-hidden>·</span>
            <Badge variant={STATUT_BADGE[meta.statut]}>
              {t(`clients.statuts.${meta.statut}`)}
            </Badge>
            <span aria-hidden>·</span>
            <span>{t("clients.nbProjets", { count: client.nb_projets })}</span>
          </span>
        </span>

        {/* Le téléphone reste lisible sans ouvrir : c'est ce qu'on cherche le plus */}
        <span className="hidden shrink-0 text-sm tabular-nums text-muted-foreground md:block">
          {client.tel ?? "—"}
        </span>

        {/* Le score, du même alphabet que celui des fiches */}
        <span
          className="shrink-0 text-sm text-muted-foreground"
          title={t("clients.score.label")}
        >
          <GradeBadge score={meta.score.total} compact />
        </span>

        <span className="shrink-0 text-end">
          <span className="block font-display text-lg font-semibold tabular-nums">
            {formatDT(client.ca_cumule)}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {t("clients.achete")}
          </span>
        </span>

        <ChevronRight
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open ? "rotate-90" : "rtl:rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-border bg-secondary/20 p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,18rem)_1fr]">
            <div className="space-y-4">
              <Contact
                icon={Phone}
                label={t("clients.tel")}
                value={client.tel}
                href={client.tel ? `tel:${client.tel}` : undefined}
              />
              <Contact
                icon={Mail}
                label={t("clients.email")}
                value={client.email}
                href={client.email ? `mailto:${client.email}` : undefined}
              />
              <Contact
                icon={MapPin}
                label={t("clients.adresse")}
                value={
                  [client.adresse, client.ville].filter(Boolean).join(", ") ||
                  null
                }
              />
              <p className="text-xs text-muted-foreground">
                {t("clients.clientDepuis", {
                  date: formatDate(client.created_at, "MMMM yyyy", locale),
                })}
                {meta.derniereActivite && (
                  <>
                    {" · "}
                    {t("clients.columns.derniereActivite")}{" "}
                    {formatDate(meta.derniereActivite, "d MMM yyyy", locale)}
                  </>
                )}
              </p>

              {/* Ce qui fait le score, ligne par ligne : un chiffre qu'on ne
                  peut pas vérifier ne convainc personne. */}
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("clients.score.label")}
                  </span>
                  <span className="text-sm">
                    <GradeBadge score={meta.score.total} />
                  </span>
                </div>
                <dl className="mt-2.5 space-y-1.5 text-xs text-muted-foreground">
                  {(
                    [
                      ["achats", meta.score.achats, SCORE_CLIENT_POIDS.achats],
                      ["projets", meta.score.projets, SCORE_CLIENT_POIDS.projets],
                      [
                        "activite",
                        meta.score.activite,
                        SCORE_CLIENT_POIDS.activite,
                      ],
                      ["contact", meta.score.contact, SCORE_CLIENT_POIDS.contact],
                    ] as const
                  ).map(([key, value, max]) => (
                    <div key={key} className="flex items-center gap-2">
                      <dt className="min-w-0 flex-1 truncate">
                        {t(`clients.score.${key}`)}
                      </dt>
                      <dd className="flex shrink-0 items-center gap-2">
                        <span className="block h-1 w-12 overflow-hidden rounded-full bg-secondary">
                          <span
                            className="block h-full rounded-full bg-chene"
                            style={{ width: `${(value / max) * 100}%` }}
                          />
                        </span>
                        <span className="tabular-nums">
                          {value}/{max}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onToggleVip}
                  disabled={pending}
                  aria-pressed={client.vip}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-colors disabled:opacity-60",
                    client.vip
                      ? "border-transparent bg-rouge/10 text-rouge"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Star
                    aria-hidden
                    className={cn("size-3.5", client.vip && "fill-current")}
                  />
                  {client.vip ? t("clients.vipRemove") : t("clients.vipAdd")}
                </button>
                <Link
                  href={`/clients/${client.id}`}
                  prefetch={false}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ExternalLink aria-hidden className="size-3.5" />
                  {t("clients.openFull")}
                </Link>
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("clients.linkedFiches")}
              </h3>
              {meta.projets.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("clients.aucunProjet")}
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {meta.projets.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/fiches/${p.id}`}
                        prefetch={false}
                        className="flex flex-wrap items-center gap-3 rounded-xl bg-card px-3 py-2.5 transition-colors hover:bg-card/60"
                      >
                        <span className="font-mono text-xs text-muted-foreground">
                          {p.reference}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            STAGE_CHIP[p.stage],
                          )}
                        >
                          {t(`stages.${p.stage}`)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(p.date, "d MMM yyyy", locale)}
                        </span>
                        <span className="ms-auto text-sm font-semibold tabular-nums">
                          {formatDT(p.budget)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
