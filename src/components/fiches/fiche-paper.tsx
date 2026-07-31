import { getLocale, getTranslations } from "next-intl/server";
import { exigencesSchema, EXIGENCES_VIDES } from "@/lib/schemas/fiche";
import { ORIGINES, ORIGINE_DETAILS } from "@/lib/domain";
import { formatDate } from "@/lib/dates";
import { formatDT } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { FicheRow } from "@/lib/database.types";

function CheckSquare({
  checked,
  label,
}: {
  checked: boolean;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="fiche-checkbox">
        {checked && <span className="block size-2 bg-ardoise dark:bg-foreground" />}
      </span>
      {label}
    </span>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-8 border-b-2 border-ardoise pb-1 text-sm font-semibold uppercase tracking-wide dark:border-foreground">
      {children}
    </h2>
  );
}

/** The FO-COM-02 echo — the one deliberately paper-like surface of the app. */
export async function FichePaper({
  fiche,
  conseillerName,
  pdvName,
}: {
  fiche: FicheRow;
  conseillerName: string;
  pdvName: string;
}) {
  const t = await getTranslations();
  const locale = await getLocale();

  const parsed = exigencesSchema.safeParse(fiche.exigences);
  const ex = parsed.success ? parsed.data : EXIGENCES_VIDES;

  const encLabel = (v: string | null) =>
    v === null ? "—" : t(`fiches.exigences.${v === "encastrable" ? "encastrable" : "non_encastrable"}`);

  return (
    <article className="fiche-paper rounded-3xl border border-border bg-card p-6 md:p-10">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-display text-2xl font-bold tracking-wide">
            CUISINA
          </p>
          <p className="text-xs italic text-chene">{t("app.tagline")}</p>
        </div>
        <span className="border border-ardoise px-2 py-1 font-mono text-[10px] dark:border-foreground">
          {t("fiches.formCode")}
        </span>
      </header>
      <div className="fiche-rule mt-4" />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-sm font-medium text-rouge">
          {fiche.reference}
        </p>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              fiche.stage === "signe"
                ? "vert"
                : fiche.stage === "perdu"
                  ? "rouge"
                  : "outline"
            }
          >
            {t(`stages.${fiche.stage}`)}
          </Badge>
          {fiche.motif_perte && (
            <Badge variant="ambre">{t(`motifsPerte.${fiche.motif_perte}`)}</Badge>
          )}
        </div>
      </div>

      {/* Identité */}
      <SectionTitle>{t("fiches.wizard.step1")}</SectionTitle>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <Field label={t("fiches.wizard.clientNom")} value={fiche.client_nom} />
        <Field
          label={t("fiches.wizard.telMobile")}
          value={
            fiche.tel_mobile ? (
              <span className="font-mono">{fiche.tel_mobile}</span>
            ) : null
          }
        />
        <Field
          label={t("fiches.wizard.telDomicile")}
          value={
            fiche.tel_domicile ? (
              <span className="font-mono">{fiche.tel_domicile}</span>
            ) : null
          }
        />
        <Field label={t("fiches.wizard.email")} value={fiche.email} />
        <Field
          label={t("fiches.wizard.adresse")}
          value={fiche.adresse_complete}
        />
        <Field
          label={`${t("fiches.wizard.codePostal")} · ${t("fiches.wizard.ville")}`}
          value={[fiche.code_postal, fiche.ville].filter(Boolean).join(" ") || null}
        />
        <Field label={t("fiches.wizard.conseiller")} value={conseillerName} />
        <Field label={t("fiches.wizard.pointDeVente")} value={pdvName} />
        <Field
          label={t("fiches.wizard.dateContact")}
          value={formatDate(fiche.created_at, "d MMMM yyyy", locale)}
        />
      </dl>

      {/* Origine */}
      <SectionTitle>{t("fiches.wizard.step2")}</SectionTitle>
      <p className="mb-2 text-sm italic text-muted-foreground">
        {t("origines.question")}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ORIGINES.map((o) => (
          <CheckSquare
            key={o}
            checked={fiche.origine === o}
            label={t(`origines.${o}`)}
          />
        ))}
      </div>
      {fiche.origine && ORIGINE_DETAILS[fiche.origine] && (
        <div className="ms-6 mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ORIGINE_DETAILS[fiche.origine].map((d) => (
            <CheckSquare
              key={d}
              checked={fiche.origine_detail === d}
              label={t(`origines.details.${d}`)}
            />
          ))}
        </div>
      )}

      {/* Projet */}
      <SectionTitle>{t("fiches.wizard.step3")}</SectionTitle>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
        <Field label={t("fiches.wizard.nbCuisines")} value={fiche.nb_cuisines} />
        <Field
          label={t("fiches.wizard.nbDressings")}
          value={fiche.nb_dressings}
        />
        <Field label={t("fiches.wizard.nbSdb")} value={fiche.nb_sdb} />
        <Field
          label={t("fiches.wizard.etatChantier")}
          value={
            fiche.etat_chantier
              ? t(`fiches.wizard.${fiche.etat_chantier}`)
              : null
          }
        />
        <Field
          label={t("fiches.wizard.budget")}
          value={
            fiche.budget_estimatif != null ? (
              <span className="font-mono">{formatDT(fiche.budget_estimatif)}</span>
            ) : null
          }
        />
        <Field
          label={t("fiches.wizard.dateLivraison")}
          value={
            fiche.date_livraison_souhaitee
              ? formatDate(fiche.date_livraison_souhaitee, "d MMM yyyy", locale)
              : null
          }
        />
      </dl>
      {fiche.observations && (
        <div className="mt-3">
          <Field
            label={t("fiches.wizard.observations")}
            value={<span className="italic">{fiche.observations}</span>}
          />
        </div>
      )}

      {/* Exigences Client — the paper's three columns */}
      <SectionTitle>{t("fiches.wizard.step4")}</SectionTitle>
      <div className="grid gap-8 md:grid-cols-3">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-chene">
            {t("fiches.exigences.finitionFacade")}
          </h3>
          <div className="space-y-1.5">
            {(["bois_massif", "laque", "pvc"] as const).map((v) => (
              <CheckSquare
                key={v}
                checked={ex.finition_facade.type === v}
                label={t(`fiches.exigences.${v}`)}
              />
            ))}
            {ex.finition_facade.type_detail && (
              <p className="ms-6 text-sm italic">
                {ex.finition_facade.type_detail}
              </p>
            )}
            <Field
              label={t("fiches.exigences.caisson")}
              value={
                ex.finition_facade.caisson ? (
                  <span className="italic">{ex.finition_facade.caisson}</span>
                ) : null
              }
            />
            <Field
              label={t("fiches.exigences.decorFacade")}
              value={
                ex.finition_facade.decor_facade ? (
                  <span className="italic">
                    {ex.finition_facade.decor_facade}
                  </span>
                ) : null
              }
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-chene">
            {t("fiches.exigences.electromenager")}
          </h3>
          <dl className="space-y-2">
            <Field
              label={t("fiches.exigences.evier")}
              value={
                ex.electromenager.evier
                  ? t(
                      `fiches.exigences.${ex.electromenager.evier === "1_bac" ? "bac1" : "bac2"}`,
                    )
                  : "—"
              }
            />
            <Field
              label={t("fiches.exigences.plaque")}
              value={
                ex.electromenager.plaque === "4F"
                  ? t("fiches.exigences.feux4")
                  : ex.electromenager.plaque === "5F"
                    ? t("fiches.exigences.feux5")
                    : ex.electromenager.plaque === "coin"
                      ? t("fiches.exigences.coin")
                      : "—"
              }
            />
            <Field
              label={t("fiches.exigences.hotte")}
              value={
                ex.electromenager.hotte === "60"
                  ? t("fiches.exigences.hotte60")
                  : ex.electromenager.hotte === "90"
                    ? t("fiches.exigences.hotte90")
                    : ex.electromenager.hotte
                      ? t(`fiches.exigences.${ex.electromenager.hotte}`)
                      : "—"
              }
            />
            <Field
              label={t("fiches.exigences.four")}
              value={`${encLabel(ex.electromenager.four)}${
                ex.electromenager.four_taille
                  ? ` · ${ex.electromenager.four_taille} cm`
                  : ""
              }`}
            />
            <Field
              label={t("fiches.exigences.microOnde")}
              value={encLabel(ex.electromenager.micro_onde)}
            />
            <Field
              label={t("fiches.exigences.frigo")}
              value={`${encLabel(ex.electromenager.frigo)}${
                ex.electromenager.frigo_autres
                  ? ` · ${ex.electromenager.frigo_autres}`
                  : ""
              }`}
            />
            <Field
              label={t("fiches.exigences.laveVaisselle")}
              value={encLabel(ex.electromenager.lave_vaisselle)}
            />
            {ex.electromenager.electro_autres && (
              <Field
                label={t("fiches.exigences.electroAutres")}
                value={
                  <span className="italic">
                    {ex.electromenager.electro_autres}
                  </span>
                }
              />
            )}
          </dl>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-chene">
            {t("fiches.exigences.detailsCuisine")}
          </h3>
          <div className="space-y-2">
            <Field
              label={t("fiches.exigences.avecRetour")}
              value={
                ex.details_cuisine.avec_retour === null
                  ? "—"
                  : t(
                      `fiches.exigences.${ex.details_cuisine.avec_retour ? "oui" : "non"}`,
                    )
              }
            />
            <Field
              label={t("fiches.exigences.ilotCentral")}
              value={
                ex.details_cuisine.ilot_central === null
                  ? "—"
                  : t(
                      `fiches.exigences.${ex.details_cuisine.ilot_central ? "oui" : "non"}`,
                    )
              }
            />
            {ex.details_cuisine.autres_details && (
              <Field
                label={t("fiches.exigences.autresDetails")}
                value={
                  <span className="italic">
                    {ex.details_cuisine.autres_details}
                  </span>
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Signature line */}
      <div className="ms-auto mt-14 w-56">
        <div className="border-t border-ardoise dark:border-foreground" />
        <p className="mt-1 text-xs text-muted-foreground">
          {t("fiches.detail.signature")}
        </p>
      </div>
    </article>
  );
}
