"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CalendarCheck, Clock } from "lucide-react";
import { RDV_TYPES, type RdvType } from "@/lib/domain";
import { formatDate } from "@/lib/dates";
import { tzDay, tzMinutes } from "@/lib/tz";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface RdvDraft {
  type: RdvType;
  /** Jour calendaire au showroom, `yyyy-MM-dd`. */
  day: string;
  /** `HH:mm` au showroom. */
  heure: string;
  /** Durée en minutes. */
  duree: number;
  notes: string;
}

/** Un rendez-vous déjà pris par le conseiller — ce qui bloque un créneau. */
export interface CreneauOccupe {
  id: string;
  titre: string;
  /** ISO 8601, tel que la base le rend. */
  debut: string;
  fin: string;
  type: RdvType;
}

export const RDV_VIDE: RdvDraft = {
  type: "showroom",
  day: "",
  heure: "",
  duree: 60,
  notes: "",
};

/**
 * La journée du showroom : on ne propose pas un rendez-vous à 3 h du matin,
 * et une grille de 24 heures noierait les créneaux qui comptent.
 */
const OUVERTURE = 8 * 60;
const FERMETURE = 20 * 60;
const PAS = 30;

const DUREES = [30, 45, 60, 90, 120];

/**
 * Les créneaux de la journée, calculés une fois pour toutes.
 *
 * Ouverture, fermeture et pas sont des constantes : reconstruire les
 * vingt-quatre valeurs à chaque frappe dans les notes ne changeait rien
 * qu'une nouvelle liste à comparer pour React.
 */
const CRENEAUX: readonly number[] = Array.from(
  { length: (FERMETURE - OUVERTURE) / PAS },
  (_, i) => OUVERTURE + i * PAS,
);

/** Jours proposés d'un coup, sans ouvrir le calendrier. */
const JOURS_RAPIDES = 7;

function minutesDe(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function hhmmDe(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** `yyyy-MM-dd` du jour décalé de `n` jours — sans passer par UTC. */
function jourDecale(depuis: string, n: number): string {
  const [y, m, d] = depuis.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  const p = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/**
 * La prise de rendez-vous, dernière étape de la fiche.
 *
 * Le conseiller ne quitte pas la fiche pour ouvrir son agenda : il verrait
 * l'un ou l'autre, jamais les deux, et c'est comme ça qu'on pose deux clients
 * à la même heure. Sa journée est donc là, sous le formulaire — les créneaux
 * déjà pris ne se cliquent pas, et un chevauchement bloque l'enregistrement
 * plutôt que de le signaler après coup.
 *
 * Tout se lit à l'heure du showroom (`Africa/Tunis`), jamais à celle du
 * serveur : Vercel tourne en UTC, où un rendez-vous de 00 h 30 tombe la veille.
 */
export function EtapeRendezVous({
  valeur,
  onChange,
  occupes,
  clientNom,
  aujourdHui,
}: {
  valeur: RdvDraft;
  onChange: (v: RdvDraft) => void;
  /** Les rendez-vous déjà pris par ce conseiller. */
  occupes: CreneauOccupe[];
  clientNom: string;
  /** Jour courant au showroom, calculé au serveur — voir plus bas. */
  aujourdHui: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const set = (patch: Partial<RdvDraft>) => onChange({ ...valeur, ...patch });

  /** Les rendez-vous groupés par jour, en minutes depuis minuit. */
  const parJour = useMemo(() => {
    const map = new Map<
      string,
      { id: string; titre: string; debut: number; fin: number; type: RdvType }[]
    >();
    for (const o of occupes) {
      const debut = new Date(o.debut);
      const fin = new Date(o.fin);
      const jour = tzDay(debut);
      const bucket = map.get(jour) ?? [];
      bucket.push({
        id: o.id,
        titre: o.titre,
        debut: tzMinutes(debut),
        // Un rendez-vous qui déborde sur le lendemain occupe cette journée
        // jusqu'à la fermeture, pas jusqu'à une heure « négative ».
        fin: tzDay(fin) === jour ? tzMinutes(fin) : FERMETURE,
        type: o.type,
      });
      map.set(jour, bucket);
    }
    for (const bucket of map.values()) bucket.sort((a, b) => a.debut - b.debut);
    return map;
  }, [occupes]);

  // Memoise : sans jour choisi, le `[]` litteral serait une nouvelle valeur a
  // chaque rendu, et le calcul des conflits repartirait pour rien.
  const duJour = useMemo(
    () => (valeur.day ? (parJour.get(valeur.day) ?? []) : []),
    [parJour, valeur.day],
  );

  const debutChoisi = minutesDe(valeur.heure);
  const finChoisie = debutChoisi === null ? null : debutChoisi + valeur.duree;

  /** Les rendez-vous que le créneau choisi chevauche. */
  const conflits = useMemo(() => {
    if (debutChoisi === null || finChoisie === null) return [];
    return duJour.filter((o) => debutChoisi < o.fin && finChoisie > o.debut);
  }, [duJour, debutChoisi, finChoisie]);

  /** Un créneau de 30 min est pris s'il tombe dans un rendez-vous existant. */
  const estPris = (debut: number) =>
    duJour.some((o) => debut < o.fin && debut + PAS > o.debut);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold">
          {t("fiches.rdv.titre")}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t("fiches.rdv.aide", { client: clientNom || t("fiches.rdv.leClient") })}
        </p>
      </div>

      {/* — Le type de rendez-vous — */}
      <div className="space-y-1.5">
        <Label>{t("fiches.rdv.type")}</Label>
        <div className="flex flex-wrap gap-2">
          {RDV_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => set({ type })}
              aria-pressed={valeur.type === type}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                valeur.type === type
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-border hover:bg-secondary/60",
              )}
            >
              {t(`rdv.types.${type}`)}
            </button>
          ))}
        </div>
      </div>

      {/* — Le jour : sept propositions, puis le calendrier pour le reste — */}
      <div className="space-y-2">
        <Label>{t("fiches.rdv.jour")}</Label>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: JOURS_RAPIDES }, (_, i) =>
            jourDecale(aujourdHui, i),
          ).map((jour, i) => {
            const nb = (parJour.get(jour) ?? []).length;
            const actif = valeur.day === jour;
            return (
              <button
                key={jour}
                type="button"
                onClick={() => set({ day: jour })}
                aria-pressed={actif}
                className={cn(
                  "min-w-[4.5rem] rounded-2xl border px-3 py-2 text-center transition-colors",
                  actif
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-secondary/60",
                )}
              >
                <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                  {i === 0
                    ? t("fiches.rdv.aujourdhui")
                    : formatDate(`${jour}T12:00:00`, "EEE", locale)}
                </span>
                <span className="block font-display text-lg font-semibold leading-tight">
                  {formatDate(`${jour}T12:00:00`, "d", locale)}
                </span>
                {/* Le nombre de rendez-vous déjà pris : on choisit un jour
                    creux avant même d'ouvrir la grille des heures. */}
                <span className="block text-[10px] text-muted-foreground">
                  {nb === 0 ? t("fiches.rdv.libre") : t("fiches.rdv.nbRdv", { n: nb })}
                </span>
              </button>
            );
          })}
        </div>
        <DatePicker
          value={valeur.day}
          onChange={(v) => set({ day: v })}
          placeholder={t("fiches.rdv.autreJour")}
          className="sm:max-w-xs"
        />
      </div>

      {valeur.day && (
        <>
          {/* — La journée du conseiller, telle qu'elle est déjà remplie — */}
          <div className="rounded-2xl border border-border bg-secondary/40 p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <CalendarCheck aria-hidden className="size-4" />
              {t("fiches.rdv.journeeDu", {
                date: formatDate(`${valeur.day}T12:00:00`, "EEEE d MMMM", locale),
              })}
            </p>
            {duJour.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("fiches.rdv.journeeVide")}
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {duJour.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Clock aria-hidden className="size-3.5 shrink-0" />
                    <span className="font-mono text-xs">
                      {hhmmDe(o.debut)}–{hhmmDe(o.fin)}
                    </span>
                    <span className="min-w-0 truncate">{o.titre}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* — Les créneaux : ce qui est pris ne se clique pas — */}
          <div className="space-y-2">
            <Label>{t("fiches.rdv.heure")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {CRENEAUX.map((m) => {
                const pris = estPris(m);
                const choisi = debutChoisi === m;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={pris}
                    onClick={() => set({ heure: hhmmDe(m) })}
                    aria-pressed={choisi}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 font-mono text-xs transition-colors",
                      pris
                        ? "cursor-not-allowed border-border/60 bg-secondary/60 text-muted-foreground/50 line-through"
                        : choisi
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "border-border hover:bg-secondary/60",
                    )}
                  >
                    {hhmmDe(m)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("fiches.rdv.creneauxAide")}
            </p>
          </div>

          {/* — La durée : elle décide si le créneau mord sur le suivant — */}
          <div className="space-y-1.5">
            <Label>{t("fiches.rdv.duree")}</Label>
            <div className="flex flex-wrap gap-2">
              {DUREES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set({ duree: d })}
                  aria-pressed={valeur.duree === d}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                    valeur.duree === d
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border hover:bg-secondary/60",
                  )}
                >
                  {t("fiches.rdv.minutes", { n: d })}
                </button>
              ))}
            </div>
          </div>

          {/* — Le chevauchement, dit avant l'enregistrement et non après — */}
          {conflits.length > 0 && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-2xl border border-rouge/40 bg-rouge/5 p-3 text-sm font-medium text-rouge"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                {t("fiches.rdv.conflit", {
                  titre: conflits[0].titre,
                  debut: hhmmDe(conflits[0].debut),
                  fin: hhmmDe(conflits[0].fin),
                })}
              </span>
            </p>
          )}

          {debutChoisi !== null && finChoisie !== null && conflits.length === 0 && (
            <p className="rounded-2xl border border-vert-plan/40 bg-vert-plan/5 p-3 text-sm font-medium text-vert-plan">
              {t("fiches.rdv.recap", {
                date: formatDate(`${valeur.day}T12:00:00`, "EEEE d MMMM", locale),
                debut: hhmmDe(debutChoisi),
                fin: hhmmDe(finChoisie),
              })}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rdv-notes">{t("fiches.rdv.notes")}</Label>
            <Textarea
              id="rdv-notes"
              className="min-h-16"
              value={valeur.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Ce qui empêche d'enregistrer : pas de jour, pas d'heure, ou un créneau déjà
 * pris. Exporté pour que l'assistant décide sans redessiner l'écran.
 */
export function rdvIncomplet(
  valeur: RdvDraft,
  occupes: CreneauOccupe[],
): "jour" | "heure" | "conflit" | null {
  if (!valeur.day) return "jour";
  const debut = minutesDe(valeur.heure);
  if (debut === null) return "heure";
  const fin = debut + valeur.duree;
  const chevauche = occupes.some((o) => {
    const d = new Date(o.debut);
    if (tzDay(d) !== valeur.day) return false;
    const oDebut = tzMinutes(d);
    const oFin = tzDay(new Date(o.fin)) === valeur.day
      ? tzMinutes(new Date(o.fin))
      : FERMETURE;
    return debut < oFin && fin > oDebut;
  });
  return chevauche ? "conflit" : null;
}

/** Le titre porté par l'événement de l'agenda. */
export function titreRdv(clientNom: string, libelle: string): string {
  const nom = clientNom.trim();
  return nom ? `${libelle} — ${nom}` : libelle;
}
