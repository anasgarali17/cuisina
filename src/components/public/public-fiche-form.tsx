"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, ChefHat, Minus, Phone, Plus, Shirt } from "lucide-react";
import { submitFichePublique } from "@/lib/actions/lien-actions";
import { createClient as supabaseNavigateur } from "@/lib/supabase/client";
import { ficheIdentiteSchema } from "@/lib/schemas/fiche";
import {
  ORIGINES,
  type LienAudience,
  type Origine,
  type TypeProjet,
} from "@/lib/domain";
import type { ShowroomPublic } from "@/lib/data/queries";
import { REGION_CODES, type RegionCode } from "@/lib/geo/tunisia-regions";
import { cn } from "@/lib/utils";
import { EtapeSouhaits, SOUHAITS_VIDES, type Souhaits } from "./etape-souhaits";
import {
  ChoixContact,
  type CanalPrefere,
} from "@/components/catalogue/choix-contact";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

interface Identite {
  client_nom: string;
  tel_mobile: string;
  tel_domicile: string;
  tel_bureau: string;
  whatsapp: boolean;
  email: string;
  adresse_complete: string;
  ville: string;
}

interface Projet {
  nb_cuisines: number;
  nb_dressings: number;
  date_livraison: string;
}

const IDENTITE_VIDE: Identite = {
  client_nom: "",
  tel_mobile: "",
  tel_domicile: "",
  tel_bureau: "",
  whatsapp: false,
  email: "",
  adresse_complete: "",
  ville: "",
};

const PROJET_VIDE: Projet = {
  nb_cuisines: 0,
  nb_dressings: 0,
  date_livraison: "",
};

const STEPS = ["step1", "step2"] as const;

/**
 * La demande client, en deux écrans.
 *
 * Étape 1 : qui vous êtes, ce que vous voulez faire, et dans quel showroom.
 * Étape 2 : à quoi vous voulez que ça ressemble.
 *
 * Deux écrans, pas trois : un formulaire de showroom rempli sur un téléphone,
 * debout, au milieu d'une foire, n'a droit qu'à quelques minutes d'attention.
 * Tout se passe sur cette page — aucun lien ne sort du site, aucune
 * application tierce ne s'ouvre : partir, c'est ne pas revenir.
 */
export function PublicFicheForm({
  token,
  audience,
  showrooms,
  visuels,
}: {
  token: string;
  audience: LienAudience;
  showrooms: ShowroomPublic[];
  /** Visuels du catalogue présents sur le disque — voir catalogue-server.ts. */
  visuels: string[];
}) {
  const t = useTranslations();
  /** Le fond ne change pas d'un public à l'autre, la formulation si. */
  const a = (key: string) => t(`public.${audience}.${key}`);

  const [step, setStep] = useState(0);
  const [identite, setIdentite] = useState<Identite>(IDENTITE_VIDE);
  const [origine, setOrigine] = useState<Origine | null>(null);
  /** Plus de sous-question : le detail reste vide, la colonne l accepte. */
  const origineDetail = null;
  const [projet, setProjet] = useState<Projet>(PROJET_VIDE);
  const [typeProjet, setTypeProjet] = useState<TypeProjet | null>(null);
  const [zone, setZone] = useState<RegionCode | null>(null);
  const [showroomId, setShowroomId] = useState<string | null>(null);
  const [souhaits, setSouhaits] = useState<Souhaits>(SOUHAITS_VIDES);
  /** Etat a part entiere — voir le commentaire dans la fiche interne. */
  const [canalContact, setCanalContact] = useState<CanalPrefere>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const setId = (patch: Partial<Identite>) =>
    setIdentite((prev) => ({ ...prev, ...patch }));

  /** Les zones où l'on a effectivement un showroom — pas les sept du pays. */
  const zonesDisponibles = useMemo(
    () => REGION_CODES.filter((r) => showrooms.some((s) => s.region === r)),
    [showrooms],
  );

  const showroomsDeLaZone = useMemo(
    () => (zone ? showrooms.filter((s) => s.region === zone) : []),
    [showrooms, zone],
  );

  const showroomChoisi = showrooms.find((s) => s.id === showroomId) ?? null;

  /** Un Set ne traverse pas la frontière serveur/client : on le reconstruit. */
  const visuelsSet = useMemo(() => new Set(visuels), [visuels]);

  function fieldError(key: string): string | null {
    const code = errors[key];
    return code ? t(`public.shared.errors.${code}`) : null;
  }

  function validateStep(current: number): boolean {
    setErrors({});
    if (current !== 0) return true;
    // Nom et téléphone, rien d'autre. Le reste se complète au showroom.
    const parsed = ficheIdentiteSchema.safeParse(identite);
    if (parsed.success) return true;
    const map: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (map[key]) continue;
      map[key] =
        issue.code === "too_small" && key === "client_nom"
          ? "nom_requis"
          : issue.code === "too_small" && key === "tel_mobile"
            ? "mobile_requis"
            : issue.message;
    }
    setErrors(map);
    return false;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0 });
  }

  async function submit() {
    if (!validateStep(step)) return;
    setSubmitting(true);
    setSubmitError(null);

    /*
     * Les photos montent d'abord, directement au bucket : elles ne peuvent
     * pas transiter par une Server Action sans faire exploser la taille du
     * payload. Une photo qui échoue est abandonnée en silence — perdre la
     * demande entière parce qu'une image de 7 Mo n'est pas passée serait un
     * mauvais échange.
     */
    let photos: string[] = [];
    if (souhaits.photos.length > 0 && supabaseNavigateur) {
      const supabase = supabaseNavigateur();
      const resultats = await Promise.all(
        souhaits.photos.map(async (f, i) => {
          const chemin = `${token}/${Date.now()}-${i}-${f.name}`;
          const { error } = await supabase.storage
            .from("demandes-photos")
            .upload(chemin, f, { upsert: false });
          return error ? null : chemin;
        }),
      );
      photos = resultats.filter((p): p is string => p !== null);
    }

    const result = await submitFichePublique({
      token,
      payload: {
        identite,
        origine: { origine, origine_detail: origineDetail },
        projet: {
          nb_cuisines: projet.nb_cuisines,
          nb_dressings: projet.nb_dressings,
          date_livraison_souhaitee: projet.date_livraison || null,
        },
        point_de_vente_id: showroomId,
        souhaits: {
          type_projet: typeProjet ?? "cuisine",
          modele: souhaits.modele,
          facade: souhaits.facade,
          couleurs: souhaits.couleurs,
          croquis: souhaits.croquis,
          photos,
          commentaire: souhaits.commentaire,
        },
      },
    });

    if (!result.ok) {
      setSubmitting(false);
      setSubmitError(
        result.error === "lien_invalide"
          ? t("public.shared.errorLien")
          : result.error === "trop_de_demandes"
            ? t("public.shared.errorRate")
            : t("public.shared.errorGeneric"),
      );
      return;
    }
    setReference(result.data.reference);
    window.scrollTo({ top: 0 });
  }

  if (reference) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2
          aria-hidden
          className="mx-auto size-14 text-vert-plan"
          strokeWidth={1.5}
        />
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
          {t("public.shared.merciTitle")}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {a("merciBody")}
        </p>
        {/* Le showroom choisi, rappelé une dernière fois : c'est le numéro
            qu'on cherchera dans une heure. */}
        {showroomChoisi && (
          <p className="mx-auto mt-4 max-w-sm rounded-2xl bg-secondary/60 p-4 text-sm">
            <span className="font-semibold">{showroomChoisi.nom}</span>
            {showroomChoisi.telephone && (
              <a
                href={`tel:${showroomChoisi.telephone.replace(/\s/g, "")}`}
                className="mt-1 flex items-center justify-center gap-1.5 font-mono text-foreground underline-offset-2 hover:underline"
              >
                <Phone aria-hidden className="size-3.5" />
                {showroomChoisi.telephone}
              </a>
            )}
          </p>
        )}
        <p className="mt-5 inline-block rounded-full border border-border px-4 py-1.5 font-mono text-xs text-muted-foreground">
          {t("public.shared.merciReference", { reference })}
        </p>
      </Card>
    );
  }

  const isLast = step === STEPS.length - 1;
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
        {a("title")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{a("subtitle")}</p>

      <div className="mt-5 flex items-center gap-3">
        <Progress value={progress} className="h-2 flex-1" />
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {t("public.shared.stepOf", {
            current: step + 1,
            total: STEPS.length,
          })}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {t(`public.shared.steps.${STEPS[step]}`)}
      </p>

      <Card className="mt-4 p-5 md:p-7">
        {step === 0 && (
          <div className="space-y-7">
            {/* — Coordonnées — */}
            <div className="grid gap-4 sm:grid-cols-2">
              <h2 className="font-display text-lg font-semibold sm:col-span-2">
                {a("sectionCoordonnees")}
              </h2>
              <Field
                id="p-nom"
                label={a("nom")}
                className="sm:col-span-2"
                value={identite.client_nom}
                onChange={(v) => setId({ client_nom: v })}
                autoComplete="name"
                error={fieldError("client_nom")}
                required
              />
              <Field
                id="p-mobile"
                label={a("mobile")}
                value={identite.tel_mobile}
                onChange={(v) => setId({ tel_mobile: v })}
                inputMode="tel"
                autoComplete="tel"
                error={fieldError("tel_mobile")}
                required
              />
              {/* WhatsApp ou e-mail — un choix, pas deux champs à remplir. */}
              <div className="sm:col-span-2">
                <ChoixContact
                  idPrefixe="p"
                  canal={canalContact}
                  email={identite.email}
                  telephone={identite.tel_mobile}
                  erreurEmail={fieldError("email")}
                  onChange={({ canal, email }) => {
                    setCanalContact(canal);
                    setId({ whatsapp: canal === "whatsapp", email });
                  }}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="p-adresse">{a("adresse")}</Label>
                <Textarea
                  id="p-adresse"
                  className="min-h-16"
                  value={identite.adresse_complete}
                  onChange={(e) => setId({ adresse_complete: e.target.value })}
                />
              </div>
              <Field
                id="p-ville"
                label={a("ville")}
                value={identite.ville}
                onChange={(v) => setId({ ville: v })}
                autoComplete="address-level2"
              />
            </div>

            {/* — Showroom, juste après la localisation — */}
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold">
                {t("public.shared.sectionShowroom")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("public.shared.showroomAide")}
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="p-zone">{t("public.shared.zone")}</Label>
                <select
                  id="p-zone"
                  value={zone ?? ""}
                  onChange={(e) => {
                    setZone((e.target.value || null) as RegionCode | null);
                    // La zone change : le showroom d'avant n'y est plus.
                    setShowroomId(null);
                  }}
                  className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"
                >
                  <option value="">{t("public.shared.zoneVide")}</option>
                  {zonesDisponibles.map((r) => (
                    <option key={r} value={r}>
                      {t(`carte.regions.${r}`)}
                    </option>
                  ))}
                </select>
              </div>

              {zone && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {showroomsDeLaZone.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setShowroomId(s.id)}
                      aria-pressed={showroomId === s.id}
                      className={cn(
                        "rounded-2xl border p-3 text-start transition-colors",
                        showroomId === s.id
                          ? "border-primary bg-primary/5 ring-2 ring-primary/25"
                          : "border-border hover:bg-secondary/60",
                      )}
                    >
                      <p className="font-medium">{s.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.adresse ?? s.ville}
                      </p>
                      {/* Le numéro apparaît dès la sélection : le client
                          n'a rien à aller chercher ailleurs. */}
                      {showroomId === s.id && s.telephone && (
                        <span className="mt-2 flex items-center gap-1.5 font-mono text-sm font-semibold text-primary">
                          <Phone aria-hidden className="size-3.5" />
                          {s.telephone}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* — Nature du projet — */}
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold">
                {t("public.shared.sectionProjet")}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["cuisine", ChefHat],
                    ["dressing", Shirt],
                  ] as const
                ).map(([type, Icon]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeProjet(type)}
                    aria-pressed={typeProjet === type}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-4 text-start transition-colors",
                      typeProjet === type
                        ? "border-primary bg-primary/5 ring-2 ring-primary/25"
                        : "border-border hover:bg-secondary/60",
                    )}
                  >
                    <Icon aria-hidden className="size-6 shrink-0" />
                    <span className="font-medium">
                      {t(`public.shared.types.${type}`)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Counter
                  label={t("public.shared.cuisines")}
                  value={projet.nb_cuisines}
                  onChange={(v) => setProjet({ ...projet, nb_cuisines: v })}
                />
                <Counter
                  label={t("public.shared.dressings")}
                  value={projet.nb_dressings}
                  onChange={(v) => setProjet({ ...projet, nb_dressings: v })}
                />
              </div>

              <div className="space-y-1.5 sm:max-w-xs">
                <Label htmlFor="p-livraison">
                  {t("public.shared.dateLivraison")}
                </Label>
                <DatePicker
                  id="p-livraison"
                  value={projet.date_livraison}
                  onChange={(v) => setProjet({ ...projet, date_livraison: v })}
                />
              </div>
            </div>

            {/* — Origine, facultative. Quatre réponses, sans sous-questions :
                  on demande d'où vient le client, pas de quelle affiche. — */}
            <fieldset className="space-y-3">
              <legend className="font-display text-lg font-semibold">
                {a("origineQuestion")}
              </legend>
              <RadioGroup
                value={origine ?? ""}
                onValueChange={(v) => setOrigine(v as Origine)}
                className="grid-cols-2 sm:grid-cols-4"
              >
                {ORIGINES.map((o) => (
                  <RadioCard key={o} value={o}>
                    {t(`origines.${o}`)}
                  </RadioCard>
                ))}
              </RadioGroup>
            </fieldset>
          </div>
        )}

        {step === 1 && (
          <EtapeSouhaits
            typeProjet={typeProjet ?? "cuisine"}
            souhaits={souhaits}
            onChange={setSouhaits}
            visuels={visuelsSet}
          />
        )}
      </Card>

      {submitError && (
        <p role="alert" className="mt-3 text-sm font-medium text-rouge">
          {submitError}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={cn(step === 0 && "invisible")}
        >
          {t("public.shared.previous")}
        </Button>
        <Button
          type="button"
          onClick={isLast ? submit : next}
          disabled={submitting}
          className="neo neo-hover min-w-40"
        >
          {isLast
            ? submitting
              ? t("public.shared.sending")
              : t("public.shared.submit")
            : t("public.shared.next")}
        </Button>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  className,
  required,
  ...input
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  className?: string;
  required?: boolean;
} & Pick<
  React.ComponentProps<typeof Input>,
  "type" | "inputMode" | "autoComplete"
>) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ms-1 text-rouge">*</span>}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        {...input}
      />
      {error && <p className="text-xs font-medium text-rouge">{error}</p>}
    </div>
  );
}

function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-border p-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-center justify-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="iconSm"
          aria-label={`− ${label}`}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          <Minus />
        </Button>
        <span className="kpi-number w-10 text-3xl">{value}</span>
        <Button
          type="button"
          variant="secondary"
          size="iconSm"
          aria-label={`+ ${label}`}
          onClick={() => onChange(Math.min(20, value + 1))}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
