"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Lock,
  Trash2,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  deplacerEvenementPerso,
  enregistrerEvenementPerso,
  supprimerEvenementPerso,
} from "@/lib/actions/agenda-perso-actions";
import { toggleTache } from "@/lib/actions/tache-actions";
import { formatDate, toISODate } from "@/lib/dates";
import { cn, messageErreur } from "@/lib/utils";
import type {
  EvenementPersonnelRow,
  ProfileRow,
  TacheRow,
} from "@/lib/database.types";
import {
  CATEGORY_STYLES,
  groupByDay,
  persoToEvent,
  tacheToEvent,
  type AgendaEvent,
} from "@/components/agenda/event-model";
import {
  DayPanel,
  MonthGrid,
  TimeGrid,
} from "@/components/agenda/calendar-grid";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrAgenda } from "./qr-agenda";

type Vue = "mois" | "semaine" | "jour";

/** « 2026-08-24T14:30 », le format qu'attend un input datetime-local. */
function versChampLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function plusUneHeure(local: string): string {
  const d = new Date(local);
  d.setHours(d.getHours() + 1);
  return versChampLocal(d.toISOString());
}

/** Le créneau proposé par défaut : le jour choisi, à l'heure ronde suivante. */
function creneauParDefaut(jourIso: string, heure?: string): string {
  if (heure) return `${jourIso}T${heure}`;
  const maintenant = new Date();
  maintenant.setHours(maintenant.getHours() + 1, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${jourIso}T${pad(maintenant.getHours())}:${pad(maintenant.getMinutes())}`;
}

function debutSemaine(date: Date): Date {
  const d = new Date(date);
  const jour = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - jour);
  d.setHours(0, 0, 0, 0);
  return d;
}

function joursSemaine(ancre: Date): Date[] {
  const debut = debutSemaine(ancre);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(debut);
    d.setDate(debut.getDate() + i);
    return d;
  });
}

interface Brouillon {
  id: string | null;
  titre: string;
  debut: string;
  fin: string;
  notes: string;
}

/**
 * L'espace personnel — l'agenda privé et les tâches d'une seule personne.
 *
 * La grille est celle des agendas d'équipe, à dessein : on ne réapprend pas
 * une interface parce qu'on change de page. Ce qui change, c'est le contenu —
 * ici rien n'appartient à l'entreprise, et le violet le dit à chaque coup
 * d'œil.
 *
 * Les tâches figurent sur la grille sans pouvoir y être déplacées : une tâche
 * porte une échéance qui engage quelqu'un d'autre, et la déplacer depuis un
 * espace privé la déplacerait pour tout le monde.
 */
export function EspacePerso({
  profile,
  evenements,
  taches,
  urlAgenda,
  qr,
}: {
  profile: ProfileRow;
  evenements: EvenementPersonnelRow[];
  taches: TacheRow[];
  urlAgenda: string;
  qr: { size: number; bits: string };
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [vue, setVue] = useState<Vue>("semaine");
  const [curseur, setCurseur] = useState<Date>(() => new Date());
  const [selection, setSelection] = useState<string>(() => toISODate(new Date()));
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [actif, setActif] = useState<AgendaEvent | null>(null);
  const [pending, startTransition] = useTransition();

  /*
   * L'optimisme, sans la dérive.
   *
   * Un glisser-déposer doit répondre avant l'aller-retour serveur, d'où une
   * copie locale. Mais garder cette copie comme unique source la fige : les
   * tâches créées ailleurs — depuis une fiche, depuis le tableau — n'arrivaient
   * jamais, parce que `useState(props)` ne lit ses props qu'au premier rendu.
   *
   * On ne retient donc que la retouche en cours, effacée dès que le serveur a
   * répondu. Entre-temps elle se superpose aux lignes fraîches ; après, ce sont
   * les props qui font foi, et tout ce qui vient d'ailleurs apparaît seul.
   */
  const [retouchePerso, setRetouchePerso] = useState<
    Map<string, EvenementPersonnelRow | null>
  >(() => new Map());
  const [retoucheTaches, setRetoucheTaches] = useState<Map<string, TacheRow>>(
    () => new Map(),
  );

  const lignesPerso = useMemo(() => {
    if (retouchePerso.size === 0) return evenements;
    return evenements
      .map((ligne) => (retouchePerso.has(ligne.id) ? retouchePerso.get(ligne.id) : ligne))
      .filter((ligne): ligne is EvenementPersonnelRow => ligne != null);
  }, [evenements, retouchePerso]);

  const lignesTaches = useMemo(() => {
    if (retoucheTaches.size === 0) return taches;
    return taches.map((ligne) => retoucheTaches.get(ligne.id) ?? ligne);
  }, [taches, retoucheTaches]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 10 },
    }),
  );

  const evenementsGrille = useMemo<AgendaEvent[]>(() => {
    const perso = lignesPerso.map(persoToEvent);
    const desTaches = lignesTaches
      .map(tacheToEvent)
      .filter((e): e is AgendaEvent => e !== null);
    return [...perso, ...desTaches];
  }, [lignesPerso, lignesTaches]);

  const parJour = useMemo(
    () => groupByDay(evenementsGrille),
    [evenementsGrille],
  );

  const jours = useMemo(() => {
    if (vue === "semaine") return joursSemaine(curseur);
    if (vue === "jour") return [curseur];
    return [];
  }, [vue, curseur]);

  /* Les tâches à faire, échéance la plus proche d'abord. Une tâche sans
     échéance reste listée : elle n'a pas de place sur la grille, mais elle
     existe quand même. */
  const tachesOuvertes = useMemo(
    () =>
      [...lignesTaches]
        .filter((tache) => tache.statut === "a_faire")
        .sort((a, b) => {
          if (!a.echeance) return 1;
          if (!b.echeance) return -1;
          return a.echeance.localeCompare(b.echeance);
        }),
    [lignesTaches],
  );

  function naviguer(sens: -1 | 1) {
    const d = new Date(curseur);
    if (vue === "mois") d.setMonth(d.getMonth() + sens);
    else if (vue === "semaine") d.setDate(d.getDate() + sens * 7);
    else d.setDate(d.getDate() + sens);
    setCurseur(d);
  }

  function aujourdhui() {
    const maintenant = new Date();
    setCurseur(maintenant);
    setSelection(toISODate(maintenant));
  }

  function ouvrirNouveau(jourIso: string, heure?: string) {
    const debut = creneauParDefaut(jourIso, heure);
    setErreur(null);
    setBrouillon({
      id: null,
      titre: "",
      debut,
      fin: plusUneHeure(debut),
      notes: "",
    });
  }

  function ouvrirEvenement(event: AgendaEvent) {
    // Une tâche ne s'édite pas ici : elle vit dans « Mes tâches », avec son
    // assignation et sa fiche. L'ouvrir ici donnerait l'illusion du contraire.
    if (event.kind !== "perso") return;
    const ligne = lignesPerso.find((e) => e.id === event.id);
    if (!ligne) return;
    setErreur(null);
    setBrouillon({
      id: ligne.id,
      titre: ligne.titre,
      debut: versChampLocal(ligne.debut),
      fin: versChampLocal(ligne.fin),
      notes: ligne.notes ?? "",
    });
  }

  function enregistrer() {
    if (!brouillon) return;
    setErreur(null);
    startTransition(async () => {
      const result = await enregistrerEvenementPerso(brouillon);
      if (result.ok) {
        setBrouillon(null);
        router.refresh();
      } else {
        setErreur(messageErreur(t, result.error));
      }
    });
  }

  function supprimer(id: string) {
    setErreur(null);
    // `null` = ligne retirée le temps que le serveur confirme.
    setRetouchePerso((r) => new Map(r).set(id, null));
    startTransition(async () => {
      const result = await supprimerEvenementPerso({ id });
      if (result.ok) {
        setBrouillon(null);
        router.refresh();
      } else {
        setRetouchePerso((r) => {
          const suivant = new Map(r);
          suivant.delete(id);
          return suivant;
        });
        setErreur(messageErreur(t, result.error));
      }
    });
  }

  function onDragStart(event: DragStartEvent) {
    const porte = event.active.data.current?.event as AgendaEvent | undefined;
    setActif(porte ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActif(null);
    const porte = event.active.data.current?.event as AgendaEvent | undefined;
    const cible = event.over?.id;
    if (!porte || typeof cible !== "string" || !cible.startsWith("day:")) return;

    const jour = cible.slice(4);
    if (jour === porte.day) return;
    // Seul le privé se déplace d'ici — voir le commentaire de tête.
    if (porte.kind !== "perso") return;

    const ligne = lignesPerso.find((e) => e.id === porte.id);
    if (!ligne) return;

    const debut = new Date(ligne.debut);
    const duree = new Date(ligne.fin).getTime() - debut.getTime();
    const [annee, mois, jourDuMois] = jour.split("-").map(Number);
    if (!annee || !mois || !jourDuMois) return;
    const nouveau = new Date(debut);
    nouveau.setFullYear(annee, mois - 1, jourDuMois);

    setRetouchePerso((r) =>
      new Map(r).set(porte.id, {
        ...ligne,
        debut: nouveau.toISOString(),
        fin: new Date(nouveau.getTime() + duree).toISOString(),
      }),
    );

    startTransition(async () => {
      const result = await deplacerEvenementPerso({ id: porte.id, jour });
      if (!result.ok) setErreur(messageErreur(t, result.error));
      // La retouche s'efface dans les deux cas : le serveur a tranché, et
      // c'est sa version — déplacée ou non — que la page doit montrer.
      setRetouchePerso((r) => {
        const suivant = new Map(r);
        suivant.delete(porte.id);
        return suivant;
      });
      router.refresh();
    });
  }

  function basculerTache(tache: TacheRow, fait: boolean) {
    setRetoucheTaches((r) =>
      new Map(r).set(tache.id, {
        ...tache,
        statut: fait ? "fait" : "a_faire",
      }),
    );
    startTransition(async () => {
      const result = await toggleTache({ id: tache.id, done: fait });
      if (!result.ok) setErreur(messageErreur(t, result.error));
      setRetoucheTaches((r) => {
        const suivant = new Map(r);
        suivant.delete(tache.id);
        return suivant;
      });
      router.refresh();
    });
  }

  const titrePeriode =
    vue === "mois"
      ? formatDate(curseur.toISOString(), "MMMM yyyy", locale)
      : vue === "jour"
        ? formatDate(curseur.toISOString(), "EEEE d MMMM", locale)
        : `${formatDate(jours[0]!.toISOString(), "d MMM", locale)} – ${formatDate(
            jours[6]!.toISOString(),
            "d MMM",
            locale,
          )}`;

  const evenementsDuJour = parJour.get(selection) ?? [];

  return (
    <>
      <PageHeader
        title={t("monEspace.titre", { prenom: profile.prenom })}
        subtitle={t("monEspace.sousTitre")}
        actions={
          <Button onClick={() => ouvrirNouveau(selection)}>
            <CalendarPlus className="size-4" />
            {t("monEspace.ajouter")}
          </Button>
        }
      />

      {/* Le cadenas répond à la seule question qu'on se pose avant d'écrire
          quoi que ce soit dans un agenda hébergé par son employeur. */}
      <p className="-mt-3 mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock aria-hidden className="size-3" />
        {t("monEspace.prive")}
      </p>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label={t("monEspace.precedent")}
                onClick={() => naviguer(-1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={aujourdhui}>
                {t("monEspace.aujourdhui")}
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={t("monEspace.suivant")}
                onClick={() => naviguer(1)}
              >
                <ChevronRight className="size-4" />
              </Button>
              <span className="ms-2 text-sm font-semibold capitalize">
                {titrePeriode}
              </span>
            </div>

            <div
              role="group"
              aria-label={t("monEspace.vue")}
              className="inline-flex rounded-full border border-border p-0.5"
            >
              {(["mois", "semaine", "jour"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVue(v)}
                  aria-pressed={vue === v}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    vue === v
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {t(`agenda.views.${v}`)}
                </button>
              ))}
            </div>
          </div>

          <DndContext
            id="espace-perso-dnd"
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            {vue === "mois" ? (
              <MonthGrid
                month={curseur}
                byDay={parJour}
                selected={selection}
                onSelect={setSelection}
                onOpen={ouvrirEvenement}
              />
            ) : (
              <TimeGrid
                days={jours}
                byDay={parJour}
                selected={selection}
                onSelect={setSelection}
                onOpen={ouvrirEvenement}
              />
            )}

            <DragOverlay dropAnimation={null}>
              {actif && (
                <span
                  className={cn(
                    "rounded-lg px-2 py-1 text-xs font-medium shadow-lg",
                    CATEGORY_STYLES[
                      actif.category as keyof typeof CATEGORY_STYLES
                    ].chip,
                  )}
                >
                  {actif.title}
                </span>
              )}
            </DragOverlay>
          </DndContext>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("size-2 rounded-full", CATEGORY_STYLES.perso.dot)}
              />
              {t("monEspace.legendePrive")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("size-2 rounded-full", CATEGORY_STYLES.tache.dot)}
              />
              {t("monEspace.legendeTache")}
            </span>
          </div>
        </div>

        <div className="space-y-5">
          <DayPanel
            iso={selection}
            events={evenementsDuJour}
            onOpen={ouvrirEvenement}
            onCreateAt={(iso, heure) => ouvrirNouveau(iso, heure)}
            ownerName={() => `${profile.prenom} ${profile.nom}`}
            emptyLabel={t("monEspace.journeeVide")}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t("monEspace.mesTaches")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tachesOuvertes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("monEspace.aucuneTache")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {tachesOuvertes.slice(0, 8).map((tache) => (
                    <li
                      key={tache.id}
                      className="flex items-start gap-2.5 rounded-xl border border-border p-2.5"
                    >
                      <Checkbox
                        checked={false}
                        disabled={pending}
                        aria-label={t("taches.markDone")}
                        onCheckedChange={(v) => basculerTache(tache, v === true)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {tache.titre}
                        </span>
                        {tache.echeance && (
                          <span className="block text-xs text-muted-foreground">
                            {formatDate(tache.echeance, "EEE d MMM", locale)}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <QrAgenda url={urlAgenda} qr={qr} />
        </div>
      </div>

      {erreur && !brouillon && (
        <p role="alert" className="mt-4 text-xs font-medium text-rouge">
          {erreur}
        </p>
      )}

      <Dialog
        open={brouillon !== null}
        onOpenChange={(open) => !open && setBrouillon(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {brouillon?.id
                ? t("monEspace.modifier")
                : t("monEspace.nouveau")}
            </DialogTitle>
          </DialogHeader>

          {brouillon && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="esp-titre">{t("monEspace.champTitre")}</Label>
                <Input
                  id="esp-titre"
                  autoFocus
                  value={brouillon.titre}
                  onChange={(e) =>
                    setBrouillon({ ...brouillon, titre: e.target.value })
                  }
                  placeholder={t("monEspace.titrePlaceholder")}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="esp-debut">{t("monEspace.debut")}</Label>
                  <Input
                    id="esp-debut"
                    type="datetime-local"
                    value={brouillon.debut}
                    onChange={(e) =>
                      setBrouillon({
                        ...brouillon,
                        debut: e.target.value,
                        fin:
                          new Date(brouillon.fin) <= new Date(e.target.value)
                            ? plusUneHeure(e.target.value)
                            : brouillon.fin,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="esp-fin">{t("monEspace.fin")}</Label>
                  <Input
                    id="esp-fin"
                    type="datetime-local"
                    value={brouillon.fin}
                    onChange={(e) =>
                      setBrouillon({ ...brouillon, fin: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="esp-notes">{t("monEspace.notes")}</Label>
                <Textarea
                  id="esp-notes"
                  className="min-h-20"
                  value={brouillon.notes}
                  onChange={(e) =>
                    setBrouillon({ ...brouillon, notes: e.target.value })
                  }
                />
              </div>

              {erreur && (
                <p role="alert" className="text-sm font-medium text-rouge">
                  {erreur}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                {brouillon.id ? (
                  <Button
                    variant="outline"
                    onClick={() => supprimer(brouillon.id!)}
                    disabled={pending}
                    className="text-rouge"
                  >
                    <Trash2 className="size-4" />
                    {t("app.delete")}
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setBrouillon(null)}>
                    {t("app.cancel")}
                  </Button>
                  <Button
                    onClick={enregistrer}
                    disabled={pending || !brouillon.titre.trim()}
                  >
                    {t("app.save")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
