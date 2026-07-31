"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Camera, Minus, Plus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { saveFiche, setFichePhoto } from "@/lib/actions/fiche-actions";
import { createClient } from "@/lib/supabase/client";
import {
  computeScoreCompletude,
  ficheIdentiteSchema,
  ficheOrigineSchema,
  EXIGENCES_VIDES,
  type Exigences,
  type FicheDraft,
} from "@/lib/schemas/fiche";
import { ORIGINES, ORIGINE_DETAILS, type Origine } from "@/lib/domain";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Identite {
  client_nom: string;
  tel_domicile: string;
  tel_mobile: string;
  email: string;
  adresse_complete: string;
  code_postal: string;
  ville: string;
}

interface Projet {
  nb_cuisines: number;
  nb_dressings: number;
  nb_sdb: number;
  etat_chantier: "en_cours" | "fini" | null;
  budget: string;
  date_livraison: string;
  observations: string;
}

const STEPS = ["step1", "step2", "step3", "step4"] as const;

function toDraft(
  identite: Identite,
  origine: Origine | null,
  origineDetail: string | null,
  projet: Projet,
  exigences: Exigences,
): FicheDraft {
  const budget = parseFloat(projet.budget.replace(/\s/g, ""));
  return {
    identite,
    origine: { origine, origine_detail: origineDetail },
    projet: {
      nb_cuisines: projet.nb_cuisines,
      nb_dressings: projet.nb_dressings,
      nb_sdb: projet.nb_sdb,
      etat_chantier: projet.etat_chantier,
      budget_estimatif: Number.isFinite(budget) && budget > 0 ? budget : null,
      date_livraison_souhaitee: projet.date_livraison || null,
      observations: projet.observations,
    },
    exigences,
  };
}

export function FicheWizard({
  conseillerName,
  pdvName,
}: {
  conseillerName: string;
  pdvName: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [identite, setIdentite] = useState<Identite>({
    client_nom: "",
    tel_domicile: "",
    tel_mobile: "",
    email: "",
    adresse_complete: "",
    code_postal: "",
    ville: "",
  });
  const [origine, setOrigine] = useState<Origine | null>(null);
  const [origineDetail, setOrigineDetail] = useState<string | null>(null);
  const [projet, setProjet] = useState<Projet>({
    nb_cuisines: 0,
    nb_dressings: 0,
    nb_sdb: 0,
    etat_chantier: null,
    budget: "",
    date_livraison: "",
    observations: "",
  });
  const [exigences, setExigences] = useState<Exigences>(EXIGENCES_VIDES);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [demoNoticed, setDemoNoticed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const savedIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const stateRef = useRef({ identite, origine, origineDetail, projet, exigences });
  useEffect(() => {
    stateRef.current = { identite, origine, origineDetail, projet, exigences };
  }, [identite, origine, origineDetail, projet, exigences]);

  const draft = toDraft(identite, origine, origineDetail, projet, exigences);
  const score = computeScoreCompletude(draft);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  /* Autosave every 20s once a name exists. */
  useEffect(() => {
    const interval = setInterval(() => {
      const s = stateRef.current;
      if (!dirtyRef.current || s.identite.client_nom.trim().length < 2) return;
      dirtyRef.current = false;
      void saveFiche({
        id: savedIdRef.current,
        draft: toDraft(s.identite, s.origine, s.origineDetail, s.projet, s.exigences),
      }).then((result) => {
        if (result.ok) {
          savedIdRef.current = result.data.id;
          setSavedAt(formatDate(new Date(), "HH:mm", locale));
        } else if (result.error === "demo_mode") {
          setDemoNoticed(true);
        }
      });
    }, 20_000);
    return () => clearInterval(interval);
  }, [locale]);

  function fieldError(key: string): string | null {
    const code = errors[key];
    return code ? t(`fiches.wizard.errors.${code}`) : null;
  }

  function validateStep(current: number): boolean {
    setErrors({});
    if (current === 0) {
      const parsed = ficheIdentiteSchema.safeParse(identite);
      if (!parsed.success) {
        const map: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? "");
          if (!map[key]) {
            map[key] =
              issue.code === "too_small" && key === "client_nom"
                ? "nom_requis"
                : issue.code === "too_small" && key === "tel_mobile"
                  ? "mobile_requis"
                  : issue.message;
          }
        }
        setErrors(map);
        return false;
      }
    }
    if (current === 1) {
      const parsed = ficheOrigineSchema.safeParse({
        origine,
        origine_detail: origineDetail,
      });
      if (!parsed.success) {
        const map: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          map[String(issue.path[0] ?? "origine")] = issue.message;
        }
        if (!origine) map.origine = "origine_requise";
        setErrors(map);
        return false;
      }
    }
    return true;
  }

  async function submit() {
    if (!validateStep(step)) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await saveFiche({ id: savedIdRef.current, draft });
    if (!result.ok) {
      setSubmitting(false);
      setSubmitError(
        result.error === "demo_mode" ? t("app.demoReadOnly") : t("app.error"),
      );
      return;
    }
    const ficheId = result.data.id;
    if (photo && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const path = `${user.id}/${ficheId}.jpg`;
          const { error } = await supabase.storage
            .from("fiches")
            .upload(path, photo, { upsert: true });
          if (!error) {
            await setFichePhoto({ fiche_id: ficheId, path });
          }
        }
      } catch {
        // Photo is best-effort — the fiche itself is already saved.
      }
    }
    router.push(`/fiches/${ficheId}`);
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0 });
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-3xl">
      {/* — Wizard header: the paper echo — */}
      <div className="glass-strong sticky top-16 z-20 -mx-4 px-4 pt-2 md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              {t("fiches.wizard.title")}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("fiches.wizard.stepOf", {
                current: step + 1,
                total: STEPS.length,
              })}{" "}
              · {t(`fiches.wizard.${STEPS[step]}`)}
            </p>
          </div>
          <span className="border border-ardoise px-2 py-1 font-mono text-[10px] text-ardoise dark:border-foreground dark:text-foreground">
            {t("fiches.formCode")}
          </span>
        </div>
        <div className="fiche-rule mt-3" />
        <div className="flex items-center gap-3 py-2">
          <Progress
            value={score}
            className="h-2 flex-1"
            aria-label={t("fiches.completude")}
          />
          <span className="font-mono text-xs text-muted-foreground">
            {score}%
          </span>
          {savedAt && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {t("fiches.draftSaved", { time: savedAt })}
            </span>
          )}
        </div>
      </div>

      {demoNoticed && (
        <p className="mb-3 mt-2 text-xs text-muted-foreground">
          {t("app.demoReadOnly")}
        </p>
      )}

      <Card className="mt-4 p-5 md:p-8">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="w-nom">{t("fiches.wizard.clientNom")}</Label>
              <Input
                id="w-nom"
                value={identite.client_nom}
                onChange={(e) => {
                  setIdentite({ ...identite, client_nom: e.target.value });
                  markDirty();
                }}
                autoComplete="name"
                aria-invalid={Boolean(errors.client_nom)}
              />
              {fieldError("client_nom") && (
                <p className="text-xs font-medium text-rouge">
                  {fieldError("client_nom")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-mobile">{t("fiches.wizard.telMobile")}</Label>
              <Input
                id="w-mobile"
                inputMode="tel"
                value={identite.tel_mobile}
                onChange={(e) => {
                  setIdentite({ ...identite, tel_mobile: e.target.value });
                  markDirty();
                }}
                aria-invalid={Boolean(errors.tel_mobile)}
              />
              {fieldError("tel_mobile") && (
                <p className="text-xs font-medium text-rouge">
                  {fieldError("tel_mobile")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-domicile">
                {t("fiches.wizard.telDomicile")}
              </Label>
              <Input
                id="w-domicile"
                inputMode="tel"
                value={identite.tel_domicile}
                onChange={(e) => {
                  setIdentite({ ...identite, tel_domicile: e.target.value });
                  markDirty();
                }}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="w-email">{t("fiches.wizard.email")}</Label>
              <Input
                id="w-email"
                type="email"
                inputMode="email"
                value={identite.email}
                onChange={(e) => {
                  setIdentite({ ...identite, email: e.target.value });
                  markDirty();
                }}
                aria-invalid={Boolean(errors.email)}
              />
              {fieldError("email") && (
                <p className="text-xs font-medium text-rouge">
                  {fieldError("email")}
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="w-adresse">{t("fiches.wizard.adresse")}</Label>
              <Textarea
                id="w-adresse"
                className="min-h-16"
                value={identite.adresse_complete}
                onChange={(e) => {
                  setIdentite({
                    ...identite,
                    adresse_complete: e.target.value,
                  });
                  markDirty();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-cp">{t("fiches.wizard.codePostal")}</Label>
              <Input
                id="w-cp"
                inputMode="numeric"
                value={identite.code_postal}
                onChange={(e) => {
                  setIdentite({ ...identite, code_postal: e.target.value });
                  markDirty();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-ville">{t("fiches.wizard.ville")}</Label>
              <Input
                id="w-ville"
                value={identite.ville}
                onChange={(e) => {
                  setIdentite({ ...identite, ville: e.target.value });
                  markDirty();
                }}
              />
            </div>
            <dl className="sm:col-span-2 mt-2 grid grid-cols-1 gap-2 rounded-2xl bg-secondary/60 p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("fiches.wizard.conseiller")}
                </dt>
                <dd className="font-medium">{conseillerName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("fiches.wizard.pointDeVente")}
                </dt>
                <dd className="font-medium">{pdvName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("fiches.wizard.dateContact")}
                </dt>
                <dd className="font-medium">
                  {formatDate(new Date(), "d MMM yyyy", locale)}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {step === 1 && (
          <fieldset>
            <legend className="mb-4 font-display text-lg font-semibold">
              {t("origines.question")}
            </legend>
            <RadioGroup
              value={origine ?? ""}
              onValueChange={(v) => {
                setOrigine(v as Origine);
                setOrigineDetail(null);
                markDirty();
              }}
              className="gap-2.5"
            >
              {ORIGINES.map((o) => (
                <div key={o}>
                  <RadioCard value={o} className="w-full">
                    {t(`origines.${o}`)}
                  </RadioCard>
                  {origine === o && ORIGINE_DETAILS[o] && (
                    <RadioGroup
                      value={origineDetail ?? ""}
                      onValueChange={(v) => {
                        setOrigineDetail(v);
                        markDirty();
                      }}
                      className="ms-6 mt-2 gap-2"
                    >
                      {ORIGINE_DETAILS[o].map((d) => (
                        <RadioCard key={d} value={d} className="w-full py-2">
                          {t(`origines.details.${d}`)}
                        </RadioCard>
                      ))}
                    </RadioGroup>
                  )}
                </div>
              ))}
            </RadioGroup>
            {errors.origine && (
              <p className="mt-3 text-xs font-medium text-rouge">
                {t("fiches.wizard.errors.origine_requise")}
              </p>
            )}
            {errors.origine_detail && (
              <p className="mt-3 text-xs font-medium text-rouge">
                {t("fiches.wizard.errors.origine_detail_requise")}
              </p>
            )}
          </fieldset>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  ["nb_cuisines", "nbCuisines"],
                  ["nb_dressings", "nbDressings"],
                  ["nb_sdb", "nbSdb"],
                ] as const
              ).map(([key, labelKey]) => (
                <div
                  key={key}
                  className="rounded-2xl border border-border p-4 text-center"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t(`fiches.wizard.${labelKey}`)}
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="iconSm"
                      aria-label={`− ${t(`fiches.wizard.${labelKey}`)}`}
                      onClick={() => {
                        setProjet((p) => ({
                          ...p,
                          [key]: Math.max(0, p[key] - 1),
                        }));
                        markDirty();
                      }}
                    >
                      <Minus />
                    </Button>
                    <span className="kpi-number w-10 text-3xl">
                      {projet[key]}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="iconSm"
                      aria-label={`+ ${t(`fiches.wizard.${labelKey}`)}`}
                      onClick={() => {
                        setProjet((p) => ({
                          ...p,
                          [key]: Math.min(20, p[key] + 1),
                        }));
                        markDirty();
                      }}
                    >
                      <Plus />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">
                {t("fiches.wizard.etatChantier")}
              </legend>
              <RadioGroup
                value={projet.etat_chantier ?? ""}
                onValueChange={(v) => {
                  setProjet({
                    ...projet,
                    etat_chantier: v as "en_cours" | "fini",
                  });
                  markDirty();
                }}
                className="grid-cols-2"
              >
                <RadioCard value="en_cours">
                  {t("fiches.wizard.en_cours")}
                </RadioCard>
                <RadioCard value="fini">{t("fiches.wizard.fini")}</RadioCard>
              </RadioGroup>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="w-budget">{t("fiches.wizard.budget")}</Label>
                <Input
                  id="w-budget"
                  inputMode="numeric"
                  value={projet.budget}
                  onChange={(e) => {
                    setProjet({ ...projet, budget: e.target.value });
                    markDirty();
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-livraison">
                  {t("fiches.wizard.dateLivraison")}
                </Label>
                <Input
                  id="w-livraison"
                  type="date"
                  value={projet.date_livraison}
                  onChange={(e) => {
                    setProjet({ ...projet, date_livraison: e.target.value });
                    markDirty();
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="w-obs">{t("fiches.wizard.observations")}</Label>
              <Textarea
                id="w-obs"
                value={projet.observations}
                onChange={(e) => {
                  setProjet({ ...projet, observations: e.target.value });
                  markDirty();
                }}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <ExigencesStep
            exigences={exigences}
            onChange={(e) => {
              setExigences(e);
              markDirty();
            }}
            photoPreview={photoPreview}
            photoName={photo?.name ?? null}
            onPhoto={(file) => {
              setPhoto(file);
              if (photoPreview) URL.revokeObjectURL(photoPreview);
              setPhotoPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
        )}
      </Card>

      {submitError && (
        <p role="alert" className="mt-3 text-sm font-medium text-rouge">
          {submitError}
        </p>
      )}

      {/* — Sticky footer — */}
      <div className="sticky bottom-14 z-20 -mx-4 mt-4 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 md:-mx-6 md:px-6">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={cn(step === 0 && "invisible")}
        >
          {t("app.previous")}
        </Button>
        <Button
          type="button"
          onClick={isLast ? submit : next}
          disabled={submitting}
          className="neo neo-hover min-w-36"
        >
          {isLast
            ? submitting
              ? t("fiches.wizard.creating")
              : t("fiches.wizard.create")
            : t("app.next")}
        </Button>
      </div>
    </div>
  );
}

/* — Step 4 — */

function ExigencesStep({
  exigences,
  onChange,
  onPhoto,
  photoPreview,
  photoName,
}: {
  exigences: Exigences;
  onChange: (e: Exigences) => void;
  onPhoto: (file: File | null) => void;
  photoPreview: string | null;
  photoName: string | null;
}) {
  const t = useTranslations("fiches.exigences");
  const tw = useTranslations("fiches.wizard");

  const columns = (
    <>
      <FinitionColumn exigences={exigences} onChange={onChange} />
      <ElectroColumn exigences={exigences} onChange={onChange} />
      <DetailsColumn exigences={exigences} onChange={onChange} />
    </>
  );

  return (
    <div className="space-y-6">
      {/* Desktop: the paper's three columns */}
      <div className="hidden gap-6 lg:grid lg:grid-cols-3">{columns}</div>

      {/* Mobile: stacked accordions */}
      <Accordion
        type="multiple"
        defaultValue={["finition"]}
        className="lg:hidden"
      >
        <AccordionItem value="finition">
          <AccordionTrigger>{t("finitionFacade")}</AccordionTrigger>
          <AccordionContent>
            <FinitionColumn exigences={exigences} onChange={onChange} noTitle />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="electro">
          <AccordionTrigger>{t("electromenager")}</AccordionTrigger>
          <AccordionContent>
            <ElectroColumn exigences={exigences} onChange={onChange} noTitle />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="details">
          <AccordionTrigger>{t("detailsCuisine")}</AccordionTrigger>
          <AccordionContent>
            <DetailsColumn exigences={exigences} onChange={onChange} noTitle />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Photo of the paper sheet */}
      <div className="rounded-2xl border border-dashed border-chene/60 p-4">
        <Label htmlFor="w-photo" className="flex items-center gap-2">
          <Camera className="size-4 text-chene" />
          {tw("photoLabel")}
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">{tw("photoHint")}</p>
        <input
          id="w-photo"
          type="file"
          accept="image/*"
          capture="environment"
          className="mt-3 block w-full text-sm file:me-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium"
          onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
        />
        {photoPreview && (
          <div className="mt-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt={photoName ?? ""}
              className="size-16 rounded-xl border border-border object-cover"
            />
            <span className="text-xs text-muted-foreground">{photoName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 border-b-2 border-ardoise pb-1 text-sm font-semibold uppercase tracking-wide">
      {children}
    </h3>
  );
}

function OptionRow({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onSelect(o.value)}
            aria-pressed={value === o.value}
            className={cn(
              "flex min-h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-colors",
              value === o.value
                ? "border-rouge bg-rouge/5"
                : "border-border bg-card hover:border-chene/60",
            )}
          >
            <span className="fiche-checkbox size-3.5">
              {value === o.value && <span className="block size-1.5 bg-rouge" />}
            </span>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FinitionColumn({
  exigences,
  onChange,
  noTitle,
}: {
  exigences: Exigences;
  onChange: (e: Exigences) => void;
  noTitle?: boolean;
}) {
  const t = useTranslations("fiches.exigences");
  const f = exigences.finition_facade;
  const set = (patch: Partial<typeof f>) =>
    onChange({ ...exigences, finition_facade: { ...f, ...patch } });

  return (
    <div>
      {!noTitle && <ColumnTitle>{t("finitionFacade")}</ColumnTitle>}
      <OptionRow
        label={t("finitionFacade")}
        options={[
          { value: "bois_massif", label: t("bois_massif") },
          { value: "laque", label: t("laque") },
          { value: "pvc", label: t("pvc") },
        ]}
        value={f.type}
        onSelect={(v) => set({ type: v as typeof f.type })}
      />
      {f.type && (
        <div className="mb-3 space-y-1.5">
          <Label htmlFor="ex-type-detail" className="text-xs">
            {t("typeDetail")}
          </Label>
          <Input
            id="ex-type-detail"
            className="h-9 text-sm"
            value={f.type_detail}
            onChange={(e) => set({ type_detail: e.target.value })}
          />
        </div>
      )}
      <div className="mb-3 space-y-1.5">
        <Label htmlFor="ex-caisson" className="text-xs">
          {t("caisson")}
        </Label>
        <Input
          id="ex-caisson"
          className="h-9 text-sm"
          value={f.caisson}
          onChange={(e) => set({ caisson: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ex-decor" className="text-xs">
          {t("decorFacade")}
        </Label>
        <Input
          id="ex-decor"
          className="h-9 text-sm"
          value={f.decor_facade}
          onChange={(e) => set({ decor_facade: e.target.value })}
        />
      </div>
    </div>
  );
}

function ElectroColumn({
  exigences,
  onChange,
  noTitle,
}: {
  exigences: Exigences;
  onChange: (e: Exigences) => void;
  noTitle?: boolean;
}) {
  const t = useTranslations("fiches.exigences");
  const e = exigences.electromenager;
  const set = (patch: Partial<typeof e>) =>
    onChange({ ...exigences, electromenager: { ...e, ...patch } });

  const enc = [
    { value: "encastrable", label: t("encastrable") },
    { value: "non_encastrable", label: t("non_encastrable") },
  ];

  return (
    <div>
      {!noTitle && <ColumnTitle>{t("electromenager")}</ColumnTitle>}
      <OptionRow
        label={t("evier")}
        options={[
          { value: "1_bac", label: t("bac1") },
          { value: "2_bac", label: t("bac2") },
        ]}
        value={e.evier}
        onSelect={(v) => set({ evier: v as typeof e.evier })}
      />
      <OptionRow
        label={t("plaque")}
        options={[
          { value: "4F", label: t("feux4") },
          { value: "5F", label: t("feux5") },
          { value: "coin", label: t("coin") },
        ]}
        value={e.plaque}
        onSelect={(v) => set({ plaque: v as typeof e.plaque })}
      />
      <OptionRow
        label={t("hotte")}
        options={[
          { value: "60", label: t("hotte60") },
          { value: "90", label: t("hotte90") },
          { value: "coin", label: t("coin") },
          { value: "centrale", label: t("centrale") },
        ]}
        value={e.hotte}
        onSelect={(v) => set({ hotte: v as typeof e.hotte })}
      />
      <OptionRow
        label={t("four")}
        options={enc}
        value={e.four}
        onSelect={(v) => set({ four: v as typeof e.four })}
      />
      {e.four && (
        <OptionRow
          label={t("fourTaille")}
          options={[
            { value: "60", label: t("hotte60") },
            { value: "90", label: t("hotte90") },
          ]}
          value={e.four_taille}
          onSelect={(v) => set({ four_taille: v as typeof e.four_taille })}
        />
      )}
      <OptionRow
        label={t("microOnde")}
        options={enc}
        value={e.micro_onde}
        onSelect={(v) => set({ micro_onde: v as typeof e.micro_onde })}
      />
      <OptionRow
        label={t("frigo")}
        options={enc}
        value={e.frigo}
        onSelect={(v) => set({ frigo: v as typeof e.frigo })}
      />
      <div className="mb-3 space-y-1.5">
        <Label htmlFor="ex-frigo-autres" className="text-xs">
          {t("frigoAutres")}
        </Label>
        <Input
          id="ex-frigo-autres"
          className="h-9 text-sm"
          value={e.frigo_autres}
          onChange={(ev) => set({ frigo_autres: ev.target.value })}
        />
      </div>
      <OptionRow
        label={t("laveVaisselle")}
        options={enc}
        value={e.lave_vaisselle}
        onSelect={(v) => set({ lave_vaisselle: v as typeof e.lave_vaisselle })}
      />
      <div className="space-y-1.5">
        <Label htmlFor="ex-electro-autres" className="text-xs">
          {t("electroAutres")}
        </Label>
        <Textarea
          id="ex-electro-autres"
          className="min-h-16 text-sm"
          value={e.electro_autres}
          onChange={(ev) => set({ electro_autres: ev.target.value })}
        />
      </div>
    </div>
  );
}

function DetailsColumn({
  exigences,
  onChange,
  noTitle,
}: {
  exigences: Exigences;
  onChange: (e: Exigences) => void;
  noTitle?: boolean;
}) {
  const t = useTranslations("fiches.exigences");
  const d = exigences.details_cuisine;
  const set = (patch: Partial<typeof d>) =>
    onChange({ ...exigences, details_cuisine: { ...d, ...patch } });

  const ouiNon = (
    value: boolean | null,
    onSelect: (v: boolean) => void,
    label: string,
  ) => (
    <OptionRow
      label={label}
      options={[
        { value: "oui", label: t("oui") },
        { value: "non", label: t("non") },
      ]}
      value={value === null ? null : value ? "oui" : "non"}
      onSelect={(v) => onSelect(v === "oui")}
    />
  );

  return (
    <div>
      {!noTitle && <ColumnTitle>{t("detailsCuisine")}</ColumnTitle>}
      {ouiNon(d.avec_retour, (v) => set({ avec_retour: v }), t("avecRetour"))}
      {ouiNon(d.ilot_central, (v) => set({ ilot_central: v }), t("ilotCentral"))}
      <div className="space-y-1.5">
        <Label htmlFor="ex-autres-details" className="text-xs">
          {t("autresDetails")}
        </Label>
        <Textarea
          id="ex-autres-details"
          className="min-h-16 text-sm"
          value={d.autres_details}
          onChange={(e) => set({ autres_details: e.target.value })}
        />
      </div>
    </div>
  );
}
