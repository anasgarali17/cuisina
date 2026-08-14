"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CalendarClock,
  CircleSlash,
  Clock,
  FlaskConical,
  MoonStar,
  Pencil,
  Plus,
  Radio,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import type {
  ModeleMessageRow,
  PointDeVenteRow,
  ProfileRow,
  SequenceEtapeRow,
  SequenceRow,
} from "@/lib/database.types";
import {
  deleteSequence,
  toggleSequence,
} from "@/lib/actions/sequence-actions";
import { libelleDelai } from "@/lib/whatsapp";
import { cn, messageErreur } from "@/lib/utils";
import { SequenceEditor } from "@/components/sequences/sequence-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Les séquences, une carte chacune, avec leur frise d'étapes. On lit d'un
 * coup d'œil ce qui part, quand, et combien de fois — c'est la question
 * qu'on se pose devant une automatisation, pas de savoir comment elle est
 * codée.
 */
export function SequencesPanel({
  sequences,
  etapes,
  modeles,
  pdvs,
  profile,
  compteParSequence,
}: {
  sequences: SequenceRow[];
  etapes: SequenceEtapeRow[];
  modeles: ModeleMessageRow[];
  pdvs: PointDeVenteRow[];
  profile: ProfileRow;
  /** Combien de messages chaque séquence a produits dans la file d'attente. */
  compteParSequence: Record<string, number>;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [editee, setEditee] = useState<SequenceRow | null>(null);
  const [creation, setCreation] = useState(false);
  const [aSupprimer, setASupprimer] = useState<SequenceRow | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const peutEcrire = profile.role === "direction" || profile.role === "admin";

  const etapesParSequence = useMemo(() => {
    const map = new Map<string, SequenceEtapeRow[]>();
    for (const etape of etapes) {
      const liste = map.get(etape.sequence_id) ?? [];
      liste.push(etape);
      map.set(etape.sequence_id, liste);
    }
    for (const liste of map.values()) liste.sort((a, b) => a.ordre - b.ordre);
    return map;
  }, [etapes]);

  const modeleById = useMemo(
    () => new Map(modeles.map((m) => [m.id, m])),
    [modeles],
  );
  const pdvById = useMemo(() => new Map(pdvs.map((p) => [p.id, p])), [pdvs]);

  function basculer(sequence: SequenceRow) {
    setErreur(null);
    void toggleSequence({ id: sequence.id, actif: !sequence.actif }).then(
      (resultat) => {
        if (!resultat.ok) {
          setErreur(
            messageErreur(t, resultat.error),
          );
          return;
        }
        router.refresh();
      },
    );
  }

  function supprimer(sequence: SequenceRow) {
    setErreur(null);
    void deleteSequence({ id: sequence.id }).then((resultat) => {
      setASupprimer(null);
      if (!resultat.ok) {
        setErreur(
          messageErreur(t, resultat.error),
        );
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("sequences.intro")}
        </p>
        {peutEcrire && (
          <Button className="neo neo-hover" onClick={() => setCreation(true)}>
            <Plus className="size-4" />
            {t("sequences.nouvelle")}
          </Button>
        )}
      </div>

      {erreur && (
        <p role="alert" className="text-sm font-medium text-rouge">
          {erreur}
        </p>
      )}

      {sequences.length === 0 ? (
        <div className="grid min-h-[36vh] place-items-center rounded-3xl border border-dashed border-border bg-card/60">
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t("sequences.vide")}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sequences.map((sequence) => {
            const sesEtapes = (etapesParSequence.get(sequence.id) ?? []).slice(
              0,
              sequence.max_messages,
            );
            const pdv = sequence.point_de_vente_id
              ? pdvById.get(sequence.point_de_vente_id)
              : null;
            const enFile = compteParSequence[sequence.id] ?? 0;

            return (
              <li
                key={sequence.id}
                className={cn(
                  "rounded-3xl border border-border bg-card p-5",
                  !sequence.actif && "opacity-60",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-semibold">
                        {sequence.nom}
                      </h3>
                      <ModeBadge mode={sequence.mode} />
                      {!sequence.actif && (
                        <Badge variant="outline">
                          <CircleSlash className="size-3" />
                          {t("sequences.desactivee")}
                        </Badge>
                      )}
                      {pdv && <Badge variant="outline">{pdv.nom}</Badge>}
                    </div>
                    {sequence.description && (
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {sequence.description}
                      </p>
                    )}
                  </div>

                  {peutEcrire && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => basculer(sequence)}
                      >
                        {sequence.actif
                          ? t("sequences.desactiver")
                          : t("sequences.activer")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label={t("app.edit")}
                        onClick={() => setEditee(sequence)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label={t("app.delete")}
                        onClick={() => setASupprimer(sequence)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock aria-hidden className="size-3.5" />
                    {t(`sequences.declencheurs.${sequence.declencheur}`)}
                    {sequence.stage_cible && (
                      <> · {t(`stages.${sequence.stage_cible}`)}</>
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock aria-hidden className="size-3.5" />
                    {t("sequences.fenetre", {
                      debut: String(sequence.fenetre_debut).padStart(2, "0"),
                      fin: String(sequence.fenetre_fin).padStart(2, "0"),
                    })}
                  </span>
                  {(sequence.exclure_vendredi || sequence.exclure_dimanche) && (
                    <span className="inline-flex items-center gap-1.5">
                      <MoonStar aria-hidden className="size-3.5" />
                      {[
                        sequence.exclure_vendredi &&
                          t("sequences.editeur.exclureVendredi"),
                        sequence.exclure_dimanche &&
                          t("sequences.editeur.exclureDimanche"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  {sequence.stop_si_reponse && (
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck aria-hidden className="size-3.5" />
                      {t("sequences.editeur.stopSiReponse")}
                    </span>
                  )}
                </div>

                {/* La frise : un jalon par étape, dans l'ordre du temps. */}
                <ol className="mt-4 flex flex-wrap items-stretch gap-2">
                  {sesEtapes.map((etape) => {
                    const modele = modeleById.get(etape.modele_id);
                    return (
                      <li
                        key={etape.id}
                        className="min-w-44 flex-1 rounded-2xl bg-brume/40 p-3"
                      >
                        <span className="inline-block rounded-full bg-chene/15 px-2 py-0.5 font-mono text-[11px] text-chene">
                          {libelleDelai(etape)}
                        </span>
                        <p className="mt-1.5 text-sm font-medium">
                          {modele?.libelle ?? t("sequences.modeleIntrouvable")}
                        </p>
                        {modele && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {modele.corps}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>

                {enFile > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t("sequences.enFile", { count: enFile })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {(creation || editee) && (
        <SequenceEditor
          // Remonter le composant à chaque cible : le brouillon est un état
          // initial, il ne se met pas à jour tout seul quand la prop change.
          key={editee?.id ?? "nouvelle"}
          open
          onOpenChange={(ouvert) => {
            if (!ouvert) {
              setCreation(false);
              setEditee(null);
            }
          }}
          sequence={editee}
          etapes={editee ? (etapesParSequence.get(editee.id) ?? []) : []}
          modeles={modeles.filter((m) => m.actif)}
          pdvs={pdvs}
          onSaved={() => router.refresh()}
        />
      )}

      <Dialog
        open={aSupprimer !== null}
        onOpenChange={(ouvert) => {
          if (!ouvert) setASupprimer(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sequences.supprimerTitre")}</DialogTitle>
            <DialogDescription>
              {t("sequences.supprimerTexte", { nom: aSupprimer?.nom ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setASupprimer(null)}>
              {t("app.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => aSupprimer && supprimer(aSupprimer)}
            >
              {t("app.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ModeBadge({ mode }: { mode: SequenceRow["mode"] }) {
  const t = useTranslations();
  const simulation = mode === "simulation";
  const Icone = simulation ? FlaskConical : Radio;
  return (
    <Badge variant={simulation ? "chene" : "vert"}>
      <Icone className="size-3" />
      {t(`sequences.modes.${mode}`)}
    </Badge>
  );
}
