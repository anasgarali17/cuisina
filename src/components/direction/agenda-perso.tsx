"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarPlus, Lock, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  enregistrerEvenementPerso,
  supprimerEvenementPerso,
} from "@/lib/actions/agenda-perso-actions";
import { formatDate } from "@/lib/dates";
import type { EvenementPersonnelRow } from "@/lib/database.types";
import { cn, messageErreur } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** « 2026-08-24T14:30 », le format qu'attend un input datetime-local. */
function versChampLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function prochaineHeure(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return versChampLocal(d.toISOString());
}

function plusUneHeure(local: string): string {
  const d = new Date(local);
  d.setHours(d.getHours() + 1);
  return versChampLocal(d.toISOString());
}

interface Brouillon {
  id: string | null;
  titre: string;
  debut: string;
  fin: string;
  notes: string;
}

/**
 * L'agenda personnel de la direction.
 *
 * Une liste, pas une grille : ces rendez-vous se comptent en unités par
 * semaine, et une grille horaire vide sur six jours sur sept dirait surtout
 * qu'il n'y a rien. Les événements passés restent visibles mais s'effacent
 * visuellement — on relit rarement la semaine dernière, mais on veut pouvoir.
 */
export function AgendaPerso({
  evenements,
}: {
  evenements: EvenementPersonnelRow[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { avenir, passes } = useMemo(() => {
    const maintenant = Date.now();
    const tries = [...evenements].sort(
      (a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime(),
    );
    return {
      avenir: tries.filter((e) => new Date(e.fin).getTime() >= maintenant),
      passes: tries
        .filter((e) => new Date(e.fin).getTime() < maintenant)
        .reverse()
        .slice(0, 5),
    };
  }, [evenements]);

  function ouvrirNouveau() {
    const debut = prochaineHeure();
    setErreur(null);
    setBrouillon({ id: null, titre: "", debut, fin: plusUneHeure(debut), notes: "" });
  }

  function ouvrirEdition(e: EvenementPersonnelRow) {
    setErreur(null);
    setBrouillon({
      id: e.id,
      titre: e.titre,
      debut: versChampLocal(e.debut),
      fin: versChampLocal(e.fin),
      notes: e.notes ?? "",
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
    startTransition(async () => {
      const result = await supprimerEvenementPerso({ id });
      if (result.ok) {
        setBrouillon(null);
        router.refresh();
      } else {
        setErreur(messageErreur(t, result.error));
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            {t("direction.agenda.titre")}
          </CardTitle>
          {/* Le cadenas n'est pas décoratif : il répond à la seule question
              qu'on se pose avant d'écrire quoi que ce soit ici. */}
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock aria-hidden className="size-3" />
            {t("direction.agenda.prive")}
          </p>
        </div>
        <Button size="sm" onClick={ouvrirNouveau}>
          <CalendarPlus className="size-4" />
          {t("direction.agenda.ajouter")}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {avenir.length === 0 && passes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("direction.agenda.vide")}
          </p>
        ) : (
          <>
            {avenir.length > 0 && (
              <ul className="space-y-2">
                {avenir.map((e) => (
                  <Evenement
                    key={e.id}
                    evenement={e}
                    locale={locale}
                    onEdit={() => ouvrirEdition(e)}
                  />
                ))}
              </ul>
            )}

            {passes.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("direction.agenda.passes")}
                </p>
                <ul className="space-y-2">
                  {passes.map((e) => (
                    <Evenement
                      key={e.id}
                      evenement={e}
                      locale={locale}
                      passe
                      onEdit={() => ouvrirEdition(e)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {erreur && !brouillon && (
          <p role="alert" className="text-xs font-medium text-rouge">
            {erreur}
          </p>
        )}
      </CardContent>

      <Dialog
        open={brouillon !== null}
        onOpenChange={(open) => !open && setBrouillon(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {brouillon?.id
                ? t("direction.agenda.modifier")
                : t("direction.agenda.nouveau")}
            </DialogTitle>
          </DialogHeader>

          {brouillon && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ev-titre">{t("direction.agenda.champTitre")}</Label>
                <Input
                  id="ev-titre"
                  autoFocus
                  value={brouillon.titre}
                  onChange={(e) =>
                    setBrouillon({ ...brouillon, titre: e.target.value })
                  }
                  placeholder={t("direction.agenda.titrePlaceholder")}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ev-debut">{t("direction.agenda.debut")}</Label>
                  <Input
                    id="ev-debut"
                    type="datetime-local"
                    value={brouillon.debut}
                    onChange={(e) =>
                      setBrouillon({
                        ...brouillon,
                        debut: e.target.value,
                        // La fin suit le début tant qu'elle serait devenue
                        // antérieure : sinon on refuse un formulaire que
                        // l'utilisateur n'a pas encore fini de remplir.
                        fin:
                          new Date(brouillon.fin) <= new Date(e.target.value)
                            ? plusUneHeure(e.target.value)
                            : brouillon.fin,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-fin">{t("direction.agenda.fin")}</Label>
                  <Input
                    id="ev-fin"
                    type="datetime-local"
                    value={brouillon.fin}
                    onChange={(e) =>
                      setBrouillon({ ...brouillon, fin: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ev-notes">{t("direction.agenda.notes")}</Label>
                <Textarea
                  id="ev-notes"
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
    </Card>
  );
}

function Evenement({
  evenement,
  locale,
  passe,
  onEdit,
}: {
  evenement: EvenementPersonnelRow;
  locale: string;
  passe?: boolean;
  onEdit: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          "flex w-full items-start gap-3 rounded-2xl border border-border p-3 text-start transition-colors hover:bg-secondary/60",
          passe && "opacity-60",
        )}
      >
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-xs font-semibold tabular-nums text-muted-foreground">
          {formatDate(evenement.debut, "HH:mm", locale)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{evenement.titre}</span>
          <span className="block text-xs text-muted-foreground">
            {formatDate(evenement.debut, "EEE d MMM", locale)} ·{" "}
            {formatDate(evenement.debut, "HH:mm", locale)}–
            {formatDate(evenement.fin, "HH:mm", locale)}
          </span>
          {evenement.notes && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {evenement.notes}
            </span>
          )}
        </span>
        <Pencil aria-hidden className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}
