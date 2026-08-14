"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import {
  ALL_STAGES,
  DECLENCHEURS,
  DECLENCHEURS_AVEC_STAGE,
  type Declencheur,
  type StageOrPerdu,
} from "@/lib/domain";
import type {
  ModeleMessageRow,
  PointDeVenteRow,
  SequenceEtapeRow,
  SequenceRow,
} from "@/lib/database.types";
import { createSequence, updateSequence } from "@/lib/actions/sequence-actions";
import { libelleDelai } from "@/lib/whatsapp";
import { cn, messageErreur } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const TOUS_PDV = "__tous__";

/** Les déclencheurs dont le seuil de silence a un sens. */
const AVEC_SEUIL: readonly Declencheur[] = [
  "devis_sans_reponse",
  "client_inactif",
];

interface EtapeBrouillon {
  delai_jours: number;
  delai_heures: number;
  modele_id: string;
  actif: boolean;
}

interface Brouillon {
  nom: string;
  description: string;
  declencheur: Declencheur;
  stage_cible: StageOrPerdu | null;
  seuil_jours: number;
  fenetre_debut: number;
  fenetre_fin: number;
  exclure_dimanche: boolean;
  exclure_vendredi: boolean;
  stop_si_reponse: boolean;
  stop_si_stage_change: boolean;
  max_messages: number;
  point_de_vente_id: string | null;
  etapes: EtapeBrouillon[];
}

function brouillonVide(modeleParDefaut: string): Brouillon {
  return {
    nom: "",
    description: "",
    declencheur: "fiche_creee",
    stage_cible: null,
    seuil_jours: 0,
    fenetre_debut: 9,
    fenetre_fin: 19,
    exclure_dimanche: false,
    exclure_vendredi: false,
    stop_si_reponse: true,
    stop_si_stage_change: true,
    max_messages: 4,
    point_de_vente_id: null,
    etapes: [
      { delai_jours: 0, delai_heures: 2, modele_id: modeleParDefaut, actif: true },
    ],
  };
}

function brouillonDe(
  sequence: SequenceRow,
  etapes: SequenceEtapeRow[],
): Brouillon {
  return {
    nom: sequence.nom,
    description: sequence.description ?? "",
    declencheur: sequence.declencheur,
    stage_cible: sequence.stage_cible,
    seuil_jours: sequence.seuil_jours,
    fenetre_debut: sequence.fenetre_debut,
    fenetre_fin: sequence.fenetre_fin,
    exclure_dimanche: sequence.exclure_dimanche,
    exclure_vendredi: sequence.exclure_vendredi,
    stop_si_reponse: sequence.stop_si_reponse,
    stop_si_stage_change: sequence.stop_si_stage_change,
    max_messages: sequence.max_messages,
    point_de_vente_id: sequence.point_de_vente_id,
    etapes: etapes
      .slice()
      .sort((a, b) => a.ordre - b.ordre)
      .map((e) => ({
        delai_jours: e.delai_jours,
        delai_heures: e.delai_heures,
        modele_id: e.modele_id,
        actif: e.actif,
      })),
  };
}

/**
 * Le réglage d'une séquence : quand elle part, ce qu'elle dit, et à quelles
 * conditions elle se tait. Les garde-fous ne sont pas relégués dans un
 * « avancé » — ce sont eux qui font la différence entre une relance utile et
 * un client qui bloque le numéro.
 */
export function SequenceEditor({
  open,
  onOpenChange,
  sequence,
  etapes,
  modeles,
  pdvs,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null = création. */
  sequence: SequenceRow | null;
  etapes: SequenceEtapeRow[];
  modeles: ModeleMessageRow[];
  pdvs: PointDeVenteRow[];
  onSaved: () => void;
}) {
  const t = useTranslations();
  const [brouillon, setBrouillon] = useState<Brouillon>(() =>
    sequence ? brouillonDe(sequence, etapes) : brouillonVide(modeles[0]?.id ?? ""),
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const modeleById = useMemo(
    () => new Map(modeles.map((m) => [m.id, m])),
    [modeles],
  );

  function set<K extends keyof Brouillon>(cle: K, valeur: Brouillon[K]) {
    setBrouillon((b) => ({ ...b, [cle]: valeur }));
  }

  function setEtape(index: number, patch: Partial<EtapeBrouillon>) {
    setBrouillon((b) => ({
      ...b,
      etapes: b.etapes.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }));
  }

  function ajouterEtape() {
    setBrouillon((b) => {
      const derniere = b.etapes.at(-1);
      return {
        ...b,
        etapes: [
          ...b.etapes,
          {
            // Une étape ajoutée se pose après la précédente, pas dessus.
            delai_jours: (derniere?.delai_jours ?? 0) + 3,
            delai_heures: 0,
            modele_id: modeles[0]?.id ?? "",
            actif: true,
          },
        ],
      };
    });
  }

  function retirerEtape(index: number) {
    setBrouillon((b) => ({
      ...b,
      etapes: b.etapes.filter((_, i) => i !== index),
    }));
  }

  const besoinStage = DECLENCHEURS_AVEC_STAGE.includes(brouillon.declencheur);
  const besoinSeuil = AVEC_SEUIL.includes(brouillon.declencheur);
  const valide =
    brouillon.nom.trim().length >= 2 &&
    brouillon.etapes.length > 0 &&
    brouillon.etapes.every((e) => e.modele_id) &&
    (!besoinStage || brouillon.stage_cible !== null);

  function enregistrer() {
    setErreur(null);
    const charge = {
      ...brouillon,
      nom: brouillon.nom.trim(),
      stage_cible: besoinStage ? brouillon.stage_cible : null,
      seuil_jours: besoinSeuil ? brouillon.seuil_jours : 0,
      etapes: brouillon.etapes.map((e, i) => ({ ...e, ordre: i + 1 })),
    };

    startTransition(async () => {
      const resultat = sequence
        ? await updateSequence({ id: sequence.id, patch: charge })
        : await createSequence(charge);
      if (!resultat.ok) {
        setErreur(
          resultat.error === "nom_existe"
            ? t("sequences.editeur.nomExiste")
            : messageErreur(t, resultat.error),
        );
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {sequence
              ? t("sequences.editeur.titreEdition")
              : t("sequences.editeur.titreCreation")}
          </DialogTitle>
          <DialogDescription>{t("sequences.editeur.intro")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="seq-nom">{t("sequences.editeur.nom")}</Label>
            <Input
              id="seq-nom"
              value={brouillon.nom}
              maxLength={120}
              placeholder={t("sequences.editeur.nomPlaceholder")}
              onChange={(e) => set("nom", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seq-desc">
              {t("sequences.editeur.description")}{" "}
              <span className="text-muted-foreground">({t("app.optional")})</span>
            </Label>
            <Textarea
              id="seq-desc"
              className="min-h-16"
              maxLength={500}
              value={brouillon.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          {/* — Déclencheur — */}
          <section className="space-y-3 rounded-2xl border border-border bg-brume/25 p-4">
            <h3 className="text-sm font-semibold">
              {t("sequences.editeur.quand")}
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="seq-decl">{t("sequences.editeur.declencheur")}</Label>
              <Select
                value={brouillon.declencheur}
                onValueChange={(v) => set("declencheur", v as Declencheur)}
              >
                <SelectTrigger id="seq-decl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECLENCHEURS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {t(`sequences.declencheurs.${d}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t(`sequences.declencheursAide.${brouillon.declencheur}`)}
              </p>
            </div>

            {besoinStage && (
              <div className="space-y-1.5">
                <Label htmlFor="seq-stage">
                  {t("sequences.editeur.stageCible")}
                </Label>
                <Select
                  value={brouillon.stage_cible ?? ""}
                  onValueChange={(v) => set("stage_cible", v as StageOrPerdu)}
                >
                  <SelectTrigger id="seq-stage">
                    <SelectValue
                      placeholder={t("sequences.editeur.stageCiblePlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`stages.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {besoinSeuil && (
              <div className="space-y-1.5">
                <Label htmlFor="seq-seuil">{t("sequences.editeur.seuil")}</Label>
                <Input
                  id="seq-seuil"
                  type="number"
                  min={0}
                  max={365}
                  className="w-28"
                  value={brouillon.seuil_jours}
                  onChange={(e) =>
                    set("seuil_jours", Number(e.target.value) || 0)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("sequences.editeur.seuilAide")}
                </p>
              </div>
            )}
          </section>

          {/* — Étapes — */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {t("sequences.editeur.etapes")}
              </h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={ajouterEtape}
                disabled={brouillon.etapes.length >= 12}
              >
                <Plus className="size-4" />
                {t("sequences.editeur.ajouterEtape")}
              </Button>
            </div>

            <ul className="space-y-2">
              {brouillon.etapes.map((etape, i) => {
                const modele = modeleById.get(etape.modele_id);
                return (
                  <li
                    key={i}
                    className="rounded-2xl border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground/50"
                      />
                      <span className="w-14 shrink-0 rounded-full bg-chene/15 px-2 py-0.5 text-center font-mono text-xs text-chene">
                        {libelleDelai(etape)}
                      </span>
                      <Select
                        value={etape.modele_id}
                        onValueChange={(v) => setEtape(i, { modele_id: v })}
                      >
                        <SelectTrigger
                          aria-label={t("sequences.editeur.modele")}
                          className="h-9 flex-1"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {modeles.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.libelle}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="iconSm"
                        aria-label={t("sequences.editeur.retirerEtape")}
                        onClick={() => retirerEtape(i)}
                        disabled={brouillon.etapes.length <= 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-3 ps-6">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {t("sequences.editeur.jours")}
                        <Input
                          type="number"
                          min={-30}
                          max={365}
                          className="h-8 w-20 px-2 text-sm"
                          value={etape.delai_jours}
                          onChange={(e) =>
                            setEtape(i, {
                              delai_jours: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {t("sequences.editeur.heures")}
                        <Input
                          type="number"
                          min={-23}
                          max={23}
                          className="h-8 w-20 px-2 text-sm"
                          value={etape.delai_heures}
                          onChange={(e) =>
                            setEtape(i, {
                              delai_heures: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                    </div>

                    {modele && (
                      <p className="mt-2 line-clamp-2 ps-6 text-xs italic text-muted-foreground">
                        {modele.corps}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">
              {t("sequences.editeur.etapesAide")}
            </p>
          </section>

          {/* — Fenêtre et garde-fous — */}
          <section className="space-y-3 rounded-2xl border border-border bg-brume/25 p-4">
            <h3 className="text-sm font-semibold">
              {t("sequences.editeur.gardeFous")}
            </h3>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="seq-debut">{t("sequences.editeur.pasAvant")}</Label>
                <Select
                  value={String(brouillon.fenetre_debut)}
                  onValueChange={(v) => set("fenetre_debut", Number(v))}
                >
                  <SelectTrigger id="seq-debut" className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seq-fin">{t("sequences.editeur.pasApres")}</Label>
                <Select
                  value={String(brouillon.fenetre_fin)}
                  onValueChange={(v) => set("fenetre_fin", Number(v))}
                >
                  <SelectTrigger id="seq-fin" className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => h + 1)
                      .filter((h) => h > brouillon.fenetre_debut)
                      .map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          {String(h).padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seq-max">{t("sequences.editeur.maxMessages")}</Label>
                <Input
                  id="seq-max"
                  type="number"
                  min={1}
                  max={12}
                  className="w-24"
                  value={brouillon.max_messages}
                  onChange={(e) =>
                    set("max_messages", Number(e.target.value) || 1)
                  }
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Bascule
                id="seq-stop-reponse"
                label={t("sequences.editeur.stopSiReponse")}
                checked={brouillon.stop_si_reponse}
                onChange={(v) => set("stop_si_reponse", v)}
              />
              <Bascule
                id="seq-stop-stage"
                label={t("sequences.editeur.stopSiStage")}
                checked={brouillon.stop_si_stage_change}
                onChange={(v) => set("stop_si_stage_change", v)}
              />
              <Bascule
                id="seq-vendredi"
                label={t("sequences.editeur.exclureVendredi")}
                checked={brouillon.exclure_vendredi}
                onChange={(v) => set("exclure_vendredi", v)}
              />
              <Bascule
                id="seq-dimanche"
                label={t("sequences.editeur.exclureDimanche")}
                checked={brouillon.exclure_dimanche}
                onChange={(v) => set("exclure_dimanche", v)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seq-pdv">{t("sequences.editeur.portee")}</Label>
              <Select
                value={brouillon.point_de_vente_id ?? TOUS_PDV}
                onValueChange={(v) =>
                  set("point_de_vente_id", v === TOUS_PDV ? null : v)
                }
              >
                <SelectTrigger id="seq-pdv">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TOUS_PDV}>
                    {t("sequences.editeur.tousLesPdv")}
                  </SelectItem>
                  {pdvs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {erreur && (
            <p role="alert" className="text-sm font-medium text-rouge">
              {erreur}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("app.cancel")}
          </Button>
          <Button onClick={enregistrer} disabled={pending || !valide}>
            {t("app.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Bascule({
  id,
  label,
  checked,
  onChange,
  className,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (valeur: boolean) => void;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-xl bg-card px-3 py-2 text-sm",
        className,
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      {label}
    </label>
  );
}
