"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MapPin, Phone, RotateCcw, Truck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn, formatDT } from "@/lib/utils";
import { LAYER_STYLE } from "@/lib/carte-ui";
import {
  CARTE_LAYERS,
  type HorsCarte,
  type LayerKey,
  type Marker,
} from "@/lib/geo/reseau";
import { GOUVERNORATS, type GouvernoratCode } from "@/lib/geo/tunisia-shapes";
import type { Delegation } from "@/lib/geo/tunisia-delegations";
import { REGION_CODES, type RegionCode } from "@/lib/geo/tunisia-regions";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TunisiaMap, type Selection } from "./tunisia-map";

const TOUT = "__tout__";

export interface ReseauCarteProps {
  markers: Marker[];
  horsCarte: HorsCarte;
  /** Les fiches showroom, rendues côté serveur, indexées par identifiant. */
  cartesPdv: Record<string, ReactNode>;
}

/**
 * La carte du réseau : où sont les showrooms, d'où viennent les clients, où
 * sont les prospects, qui nous livre.
 *
 * Deux filtres, indépendants. Les **couches** décident de ce qu'on regarde —
 * on peut ne garder que les showrooms, ou croiser prospects et fournisseurs.
 * La **zone** décide d'où : le pays, une des sept régions commerciales, un
 * gouvernorat, ou une délégation (مُعتمدية) qu'on désigne au clic. Tout le
 * reste de l'écran, y compris les fiches showroom en bas, suit la sélection.
 *
 * Les 264 tracés de délégations pèsent une bonne centaine de kilooctets : ils
 * sont chargés par `import()` à la première descente sous la région, jamais
 * pour la vue « pays ».
 */
export function ReseauCarte({
  markers,
  horsCarte,
  cartesPdv,
}: ReseauCarteProps) {
  const t = useTranslations();
  const locale = useLocale() as "fr" | "en" | "ar";

  const [layers, setLayers] = useState<LayerKey[]>([...CARTE_LAYERS]);
  const [selection, setSelection] = useState<Selection>({ kind: "pays" });
  const [delegations, setDelegations] = useState<readonly Delegation[] | null>(
    null,
  );

  /* Les tracés fins arrivent dès qu'on quitte la vue « pays » — la carte les
     dessine quand ils sont là, et se contente des gouvernorats en attendant. */
  const besoinDelegations = selection.kind !== "pays";
  useEffect(() => {
    if (!besoinDelegations || delegations !== null) return;
    let vivant = true;
    import("@/lib/geo/tunisia-delegations").then((mod) => {
      if (vivant) setDelegations(mod.DELEGATIONS);
    });
    return () => {
      vivant = false;
    };
  }, [besoinDelegations, delegations]);

  const nomGouvernorat = useMemo(() => {
    const map = new Map<GouvernoratCode, string>();
    for (const g of GOUVERNORATS) map.set(g.code, g.nom[locale] ?? g.nom.fr);
    return map;
  }, [locale]);

  const regionDe = useMemo(() => {
    const map = new Map<GouvernoratCode, RegionCode>();
    for (const g of GOUVERNORATS) map.set(g.code, g.region);
    return map;
  }, []);

  /** Le gouvernorat dont on liste les délégations dans le second sélecteur. */
  const govActif =
    selection.kind === "gouvernorat"
      ? selection.code
      : selection.kind === "delegation"
        ? selection.gouvernorat
        : null;

  const delegationsDuGov = useMemo(() => {
    if (!govActif || !delegations) return [];
    return delegations
      .filter((d) => d.gouvernorat === govActif)
      .map((d) => ({ code: d.code, nom: d.nom[locale] ?? d.nom.fr }))
      .sort((a, b) => a.nom.localeCompare(b.nom, locale));
  }, [govActif, delegations, locale]);

  const nomDelegation = useMemo(() => {
    if (selection.kind !== "delegation" || !delegations) return null;
    const del = delegations.find((d) => d.code === selection.code);
    return del ? (del.nom[locale] ?? del.nom.fr) : null;
  }, [selection, delegations, locale]);

  /** Un marqueur est-il dans la zone sélectionnée — liste et compteurs. */
  const gouvernoratsDeLaRegion = useMemo(
    () =>
      selection.kind === "region"
        ? new Set(
            GOUVERNORATS.filter((g) => g.region === selection.region).map(
              (g) => g.code,
            ),
          )
        : null,
    [selection],
  );

  function dansLaZone(m: Marker): boolean {
    switch (selection.kind) {
      case "pays":
        return true;
      case "delegation":
        return m.delegation === selection.code;
      case "gouvernorat":
        return m.gouvernorat === selection.code;
      case "region":
        return gouvernoratsDeLaRegion?.has(m.gouvernorat) ?? false;
    }
  }

  /* La carte reçoit les punaises filtrées sur les couches mais pas sur la
     zone : hors zone elles s'estompent au lieu de disparaître, sinon on perd
     le contexte du pays autour de la zone choisie. */
  const surCarte = useMemo(
    () => markers.filter((m) => layers.includes(m.layer)),
    [markers, layers],
  );

  /* La liste, les groupes et les totaux se recalculent à chaque rendu, sans
     mémo : quelques dizaines de punaises, ce n'est pas un coût — et ça évite
     de faire dépendre un useMemo d'une fonction recréée à chaque rendu. */

  /** La liste, elle, s'en tient strictement à la sélection. */
  const listés = surCarte
    .filter(dansLaZone)
    .sort(
      (a, b) =>
        CARTE_LAYERS.indexOf(a.layer) - CARTE_LAYERS.indexOf(b.layer) ||
        b.count - a.count ||
        b.valeur - a.valeur ||
        a.nom.localeCompare(b.nom),
    );

  /* Regroupée par couche : sans intitulé, « Tunis · 42 000 DT » (clients) et
     « Tunis · 43 500 DT » (prospects) se suivent sans qu'on sache lequel est
     lequel. */
  const groupes = CARTE_LAYERS.filter((layer) => layers.includes(layer))
    .map((layer) => {
      const lignes = listés.filter((m) => m.layer === layer);
      return {
        layer,
        lignes,
        // Le total des entités, pas le nombre de lignes : « Clients 7 » dans
        // le résumé et « Clients 6 » en tête de liste, pour les mêmes
        // données, ne s'explique pas.
        total: lignes.reduce((sum, m) => sum + m.count, 0),
      };
    })
    .filter((g) => g.lignes.length > 0);

  /**
   * Les totaux de la zone, calculés **avant** le filtre des couches : une puce
   * décochée doit annoncer ce qu'elle rendrait si on la cochait, pas zéro.
   */
  const totaux: Record<LayerKey, { count: number; valeur: number }> = {
    showrooms: { count: 0, valeur: 0 },
    clients: { count: 0, valeur: 0 },
    prospects: { count: 0, valeur: 0 },
    fournisseurs: { count: 0, valeur: 0 },
  };
  for (const m of markers) {
    if (!dansLaZone(m)) continue;
    totaux[m.layer].count += m.count;
    totaux[m.layer].valeur += m.valeur;
  }

  const titreZone =
    selection.kind === "pays"
      ? t("carte.toutLePays")
      : selection.kind === "region"
        ? t(`carte.regions.${selection.region}`)
        : selection.kind === "gouvernorat"
          ? (nomGouvernorat.get(selection.code) ?? "")
          : (nomDelegation ?? t("carte.chargement"));

  const sousTitreZone =
    selection.kind === "gouvernorat"
      ? t(`carte.regions.${regionDe.get(selection.code) ?? "grand_tunis"}`)
      : selection.kind === "delegation"
        ? (nomGouvernorat.get(selection.gouvernorat) ?? "")
        : null;

  const parLayer = useMemo(() => {
    const row = {} as Record<LayerKey, string>;
    for (const layer of CARTE_LAYERS) row[layer] = t(`carte.layers.${layer}`);
    return row;
  }, [t]);

  function toggleLayer(layer: LayerKey) {
    setLayers((current) =>
      current.includes(layer)
        ? // Jamais zéro couche : une carte vide n'apprend rien. Le dernier
          // filtre actif ne se décoche pas.
          current.length === 1
          ? current
          : current.filter((l) => l !== layer)
        : [...current, layer],
    );
  }

  /** Un clic sur la carte descend d'un cran, ou remonte si on y était déjà. */
  function pickGouvernorat(code: GouvernoratCode) {
    setSelection((current) =>
      current.kind === "gouvernorat" && current.code === code
        ? { kind: "region", region: regionDe.get(code) ?? "grand_tunis" }
        : { kind: "gouvernorat", code },
    );
  }

  function pickDelegation(code: string, gouvernorat: GouvernoratCode) {
    setSelection((current) =>
      current.kind === "delegation" && current.code === code
        ? { kind: "gouvernorat", code: gouvernorat }
        : { kind: "delegation", code, gouvernorat },
    );
  }

  const horsCarteTotal = CARTE_LAYERS.filter((l) => layers.includes(l)).reduce(
    (sum, l) => sum + horsCarte[l],
    0,
  );

  /** Les showrooms de la zone — ce sont eux qui ont une fiche détaillée. */
  const pdvIds = listés
    .filter((m) => m.layer === "showrooms")
    .map((m) => m.id.replace(/^pdv:/, ""));

  const valeurZone =
    selection.kind === "region"
      ? `region:${selection.region}`
      : selection.kind === "gouvernorat"
        ? `gov:${selection.code}`
        : selection.kind === "delegation"
          ? `gov:${selection.gouvernorat}`
          : TOUT;

  return (
    <div className="space-y-5">
      {/* — Les filtres — */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div
          role="group"
          aria-label={t("carte.couches")}
          className="flex flex-wrap gap-1.5"
        >
          {CARTE_LAYERS.map((layer) => {
            const actif = layers.includes(layer);
            const style = LAYER_STYLE[layer];
            return (
              <button
                key={layer}
                type="button"
                aria-pressed={actif}
                onClick={() => toggleLayer(layer)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  actif
                    ? style.chip
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full transition-opacity",
                    style.dot,
                    actif ? "opacity-100" : "opacity-35",
                  )}
                />
                {parLayer[layer]}
                <span className="font-mono tabular-nums opacity-70">
                  {totaux[layer].count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={valeurZone}
            onValueChange={(value) => {
              if (value === TOUT) return setSelection({ kind: "pays" });
              if (value.startsWith("region:")) {
                return setSelection({
                  kind: "region",
                  region: value.slice(7) as RegionCode,
                });
              }
              setSelection({
                kind: "gouvernorat",
                code: value.slice(4) as GouvernoratCode,
              });
            }}
          >
            <SelectTrigger className="h-9 w-52 text-xs">
              <SelectValue aria-label={t("carte.zone")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUT}>{t("carte.toutLePays")}</SelectItem>
              {REGION_CODES.map((region) => (
                <SelectItem key={region} value={`region:${region}`}>
                  {t(`carte.regions.${region}`)}
                </SelectItem>
              ))}
              {GOUVERNORATS.map((gov) => (
                <SelectItem key={gov.code} value={`gov:${gov.code}`}>
                  {"  "}
                  {nomGouvernorat.get(gov.code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Le second cran : les délégations du gouvernorat choisi. Absent
              tant qu'aucun gouvernorat n'est sélectionné — un menu de 264
              entrées ne serait pas un filtre. */}
          {govActif && (
            <Select
              value={
                selection.kind === "delegation" ? selection.code : TOUT
              }
              onValueChange={(value) => {
                if (value === TOUT) {
                  return setSelection({ kind: "gouvernorat", code: govActif });
                }
                setSelection({
                  kind: "delegation",
                  code: value,
                  gouvernorat: govActif,
                });
              }}
            >
              <SelectTrigger className="h-9 w-52 text-xs">
                <SelectValue aria-label={t("carte.delegation")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOUT}>
                  {t("carte.toutesDelegations")}
                </SelectItem>
                {delegationsDuGov.map((del) => (
                  <SelectItem key={del.code} value={del.code}>
                    {del.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selection.kind !== "pays" && (
            <button
              type="button"
              onClick={() => setSelection({ kind: "pays" })}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
            >
              <RotateCcw className="size-3.5" />
              {t("carte.reinitialiser")}
            </button>
          )}
        </div>
      </div>

      {/* — La carte, dominante, et la liste à sa droite —

          La Tunisie est deux fois plus haute que large : dans un cadre large,
          le pays laisse forcément du vide sur les côtés. Ce vide n'est pas
          comblé en rétrécissant la carte — c'est de la toile, et le résumé de
          la zone y flotte, comme la fiche d'un vrai outil cartographique. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="relative overflow-hidden p-0">
          <TunisiaMap
            markers={surCarte}
            activeLayers={layers}
            selection={selection}
            onPickGouvernorat={pickGouvernorat}
            onPickDelegation={pickDelegation}
            delegations={delegations}
            labels={{
              carte: t("carte.aria"),
              parLayer,
              vide: t("carte.rien"),
            }}
            className="h-[68vh] min-h-[440px] w-full lg:h-[min(860px,calc(100vh-12rem))] lg:min-h-[600px]"
          />

          {/* Le résumé, posé sur la toile. `pointer-events-none` sur le
              conteneur : la carte reste attrapable derrière lui. */}
          <div className="pointer-events-none absolute start-3 top-3 w-56 rounded-2xl border border-border bg-card/85 p-3.5 shadow-sm backdrop-blur-md">
            <h2 className="truncate font-display text-base font-semibold">
              {titreZone}
            </h2>
            {sousTitreZone && (
              <p className="truncate text-[11px] text-muted-foreground">
                {sousTitreZone}
              </p>
            )}

            <dl className="mt-3 space-y-1.5">
              {CARTE_LAYERS.filter((l) => layers.includes(l)).map((layer) => (
                <div key={layer} className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      LAYER_STYLE[layer].dot,
                    )}
                  />
                  <dt className="flex-1 truncate text-[11px] text-muted-foreground">
                    {parLayer[layer]}
                  </dt>
                  <dd className="kpi-number text-sm leading-none">
                    {totaux[layer].count}
                  </dd>
                  {layer !== "fournisseurs" && totaux[layer].valeur > 0 && (
                    <dd className="w-20 shrink-0 text-end font-mono text-[10px] text-muted-foreground">
                      {formatDT(totaux[layer].valeur)}
                    </dd>
                  )}
                </div>
              ))}
            </dl>

            {horsCarteTotal > 0 && (
              <p className="mt-2.5 text-[10px] leading-tight text-muted-foreground">
                {t("carte.horsCarte", { count: horsCarteTotal })}
              </p>
            )}
          </div>

          <p className="pointer-events-none absolute bottom-0 start-0 end-0 bg-gradient-to-t from-card via-card/80 to-transparent px-4 pb-2 pt-6 text-center text-[10px] text-muted-foreground">
            {t("carte.astuce")}
          </p>
        </Card>

        <div className="flex min-w-0 flex-col lg:max-h-[min(860px,calc(100vh-12rem))]">
          {/* La liste défile en place : c'est la carte qui doit occuper la
              hauteur de l'écran, pas l'énumération à côté. */}
          <Card className="min-h-0 flex-1 overflow-y-auto p-0">
            {groupes.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {t("carte.rien")}
              </p>
            ) : (
              groupes.map((groupe) => (
                <section key={groupe.layer}>
                  <h3 className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card/95 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        LAYER_STYLE[groupe.layer].dot,
                      )}
                    />
                    {parLayer[groupe.layer]}
                    <span className="font-mono">{groupe.total}</span>
                  </h3>
                  <div className="divide-y divide-border">
                    {groupe.lignes.map((m) => (
                      <LigneMarker key={m.id} marker={m} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </Card>
        </div>
      </div>

      {/* — Les fiches showroom, réduites à la zone choisie — */}
      {layers.includes("showrooms") && pdvIds.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">
            {t("carte.fichesShowroom")}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pdvIds.map((id) => cartesPdv[id]).filter(Boolean)}
          </div>
        </div>
      )}
    </div>
  );
}

/** Une ligne de la liste : la même pour les quatre couches. */
function LigneMarker({ marker }: { marker: Marker }) {
  const t = useTranslations();
  const style = LAYER_STYLE[marker.layer];

  const contenu = (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className={cn("size-2.5 shrink-0 rounded-full", style.dot)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{marker.nom}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" />
            {marker.ville}
          </span>
          {marker.categorie && (
            <span>{t(`fournisseurs.categories.${marker.categorie}`)}</span>
          )}
          {marker.equipe !== undefined && (
            <span>{t("equipe.conseillers", { count: marker.equipe })}</span>
          )}
          {marker.telephone && (
            <span className="inline-flex items-center gap-1 font-mono">
              <Phone className="size-3" />
              {marker.telephone}
            </span>
          )}
          {marker.delaiJours != null && (
            <span className="inline-flex items-center gap-1">
              <Truck className="size-3" />
              {t("fournisseurs.delai", { count: marker.delaiJours })}
            </span>
          )}
        </p>
      </div>
      <div className="shrink-0 text-end">
        {marker.count > 1 && (
          <p className="kpi-number text-base leading-none">{marker.count}</p>
        )}
        {marker.valeur > 0 && (
          <p className={cn("font-mono text-[11px]", style.texte)}>
            {formatDT(marker.valeur)}
          </p>
        )}
      </div>
    </div>
  );

  if (!marker.href) return contenu;
  return (
    <Link href={marker.href} className="block hover:bg-secondary/60">
      {contenu}
    </Link>
  );
}
