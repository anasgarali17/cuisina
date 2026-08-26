import { getLocale, getTranslations } from "next-intl/server";
import { exigencesSchema, EXIGENCES_VIDES } from "@/lib/schemas/fiche";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { FicheRelanceRow, FicheRow } from "@/lib/database.types";
import { ArchitecteInline } from "@/components/fiches/architecte-inline";

/* — building blocks of the paper — */

function Sq({ on }: { on?: boolean }) {
  return (
    <span className="fiche-checkbox size-3.5 align-middle">
      {on && <span className="block size-1.5 bg-ardoise" />}
    </span>
  );
}

function Opt({ on, children }: { on?: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]">
      <Sq on={on} />
      {children}
    </span>
  );
}

function L({ children }: { children: React.ReactNode }) {
  return (
    // nowrap only where the paper is wide enough: on a phone the long
    // labels must wrap or they run past the screen edge.
    <span className="text-[13px] font-bold italic underline underline-offset-2 md:whitespace-nowrap">
      {children}
    </span>
  );
}

function Dotted({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "min-w-0 flex-1 border-b border-dotted border-ardoise/50 px-1 text-[13px] leading-6",
        className,
      )}
    >
      {children ?? " "}
    </span>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  // flex-wrap: on a phone, a value squeezed out by a long label drops to
  // its own dotted line instead of painting past the page edge.
  return <div className="flex flex-wrap items-end gap-1">{children}</div>;
}

/**
 * Exact facsimile of the paper FO-COM-02 « FICHE CONTACT » —
 * header boxes, dotted fields, checkbox grids, the five contact lines,
 * signature block and slogan.
 */
export async function FichePaper({
  fiche,
  conseillerName,
  relances = [],
  signatureDate = null,
}: {
  fiche: FicheRow;
  conseillerName: string;
  pdvName?: string;
  relances?: FicheRelanceRow[];
  signatureDate?: string | null;
}) {
  const t = await getTranslations();
  const locale = await getLocale();
  const p = (key: string) => t(`fiches.paper.${key}`);

  const parsed = exigencesSchema.safeParse(fiche.exigences);
  const ex = parsed.success ? parsed.data : EXIGENCES_VIDES;
  const e = ex.electromenager;
  const d = ex.details_cuisine;
  const f = ex.finition_facade;

  const fmt = (date: string | null) =>
    date ? formatDate(date, "dd/MM/yyyy", locale) : "";

  const contactByNumero = new Map<number, FicheRelanceRow>();
  for (const r of relances) {
    const existing = contactByNumero.get(r.numero_contact);
    if (!existing || r.created_at > existing.created_at) {
      contactByNumero.set(r.numero_contact, r);
    }
  }
  const ORD = ["1ᵉʳ", "2ᵉ", "3ᵉ", "4ᵉ", "5ᵉ"];

  return (
    <article
      dir="ltr"
      className="rounded-xl border border-border bg-white p-5 text-ardoise shadow-sm md:p-8 dark:bg-white"
    >
      {/* ═ Header: logo | title | form code ═ */}
      <div className="grid grid-cols-[auto_1fr_auto] border-2 border-ardoise/80">
        <div className="flex flex-col items-center justify-center border-e-2 border-ardoise/80 px-2 py-2 md:px-4">
          <span className="rounded-[50%] bg-rouge px-2.5 py-1 font-display text-sm font-bold tracking-wider text-white md:px-4 md:py-1.5 md:text-lg">
            CUISINA
          </span>
          <span className="mt-1 hidden text-[8px] uppercase tracking-widest text-rouge/80 sm:block">
            {t("app.tagline")}
          </span>
        </div>
        <div className="grid place-items-center px-2 md:px-4">
          <h1 className="text-center font-serif text-base font-bold tracking-widest sm:text-2xl md:text-3xl">
            FICHE CONTACT
          </h1>
        </div>
        <div className="grid place-items-center border-s-2 border-ardoise/80 px-2 py-2 text-center font-serif text-xs font-bold md:px-4 md:text-sm">
          FO-COM-02
          <br />
          IE : 09 ;JUIL 2018
        </div>
      </div>

      {/* reference + le : date */}
      <div className="mt-3 flex items-end justify-between gap-4">
        <span className="font-mono text-sm font-semibold text-rouge">
          {fiche.reference}
        </span>
        <Row>
          <Dotted className="max-w-40" />
          <L>{p("le")} :</L>
          <Dotted className="max-w-36">
            {formatDate(fiche.created_at, "dd/MM/yyyy", locale)}
          </Dotted>
        </Row>
      </div>

      {/* ═ Identity — two columns ═ */}
      <div className="mt-2 grid gap-x-8 gap-y-1 sm:grid-cols-2">
        <div className="space-y-1">
          <Row>
            <L>{p("client")} :</L>
            <Dotted>{fiche.client_nom}</Dotted>
          </Row>
          <Row>
            <L>{p("telDomicile")} :</L>
            <Dotted className="font-mono">{fiche.tel_domicile}</Dotted>
          </Row>
          <Row>
            <span className="ps-8" />
            <L>{p("mobile")} :</L>
            <Dotted className="font-mono">{fiche.tel_mobile}</Dotted>
          </Row>
          <Row>
            <L>{p("adresse")} :</L>
            <Dotted>{fiche.adresse_complete}</Dotted>
          </Row>
        </div>
        <div className="space-y-1">
          <Row>
            <L>{p("commercial")} :</L>
            <Dotted>{conseillerName}</Dotted>
          </Row>
          <Row>
            <L>{p("bureau")} :</L>
            <Dotted className="font-mono">{fiche.tel_bureau}</Dotted>
          </Row>
          <Row>
            <L>{p("email")} :</L>
            <Dotted>{fiche.email}</Dotted>
          </Row>
          <Row>
            <L>{p("ville")}:</L>
            <Dotted>{fiche.ville}</Dotted>
          </Row>
          <Row>
            <L>{p("architecte")} :</L>
            {/* Seule ligne saisissable du papier — voir ArchitecteInline. */}
            <ArchitecteInline ficheId={fiche.id} valeur={fiche.architecte} />
          </Row>
        </div>
      </div>

      {/* ═ Origine ═ */}
      <div className="mt-4 rounded-sm border border-ardoise/40 p-3">
        <p className="text-[13px] font-bold italic underline underline-offset-2">
          {t("origines.question")}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 md:grid-cols-4">
          <div className="space-y-1.5">
            <Opt on={fiche.origine === "bouche_a_oreille"}>
              {t("origines.bouche_a_oreille")} :
            </Opt>
            <div className="ms-5 flex flex-col gap-1.5">
              {(
                [
                  "prospection",
                  "architecte_decorateur",
                  "promoteur_entrepreneur",
                  "ami",
                ] as const
              ).map((sub) => (
                <Opt key={sub} on={fiche.origine_detail === sub}>
                  {t(`origines.details.${sub}`)}
                </Opt>
              ))}
            </div>
          </div>
          <Opt on={fiche.origine === "site_web"}>{t("origines.site_web")}</Opt>
          <Opt on={fiche.origine === "foire"}>{t("origines.foire")}</Opt>
          <div className="space-y-1.5">
            <Opt on={fiche.origine === "publicite"}>
              {t("origines.publicite")} :
            </Opt>
            <div className="ms-5 flex flex-col gap-1.5">
              {(
                [
                  "facebook",
                  "instagram",
                  "tiktok",
                  "autre_reseau",
                ] as const
              ).map((sub) => (
                <Opt key={sub} on={fiche.origine_detail === sub}>
                  {t(`origines.details.${sub}`)}
                </Opt>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═ Projet ═ */}
      <div className="mt-4 space-y-1.5">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-1.5">
          <L>{p("typeProjet")} :</L>
          <span className="inline-flex items-end gap-1 text-[13px]">
            {p("nombre")} :
            <span className="w-8 border-b border-dotted border-ardoise/50 text-center font-mono">
              {fiche.nb_cuisines || ""}
            </span>
            {p("cuisines")} <Sq on={fiche.nb_cuisines > 0} />
          </span>
          <span className="inline-flex items-end gap-1 text-[13px]">
            {p("nombre")} :
            <span className="w-8 border-b border-dotted border-ardoise/50 text-center font-mono">
              {fiche.nb_dressings || ""}
            </span>
            {p("dressings")} <Sq on={fiche.nb_dressings > 0} />
          </span>
        </div>
        <Row>
          <L>{p("dateLivraison")}:</L>
          <Dotted className="font-mono">
            {fmt(fiche.date_livraison_souhaitee)}
          </Dotted>
        </Row>
      </div>

      {/* ═ Exigences Client ═ */}
      <div className="mt-4 border-2 border-ardoise/60">
        <div className="border-b-2 border-ardoise/60 bg-brume/60 px-3 py-1">
          <L>{p("exigences")}</L>
        </div>
        <div className="grid md:grid-cols-[1fr_1.5fr_1fr]">
          {/* Finition façade */}
          <div className="border-b border-ardoise/40 p-3 md:border-b-0 md:border-e">
            <p className="mb-2 text-[13px] font-bold italic underline underline-offset-2">
              {p("finitionFacade")} :
            </p>
            <div className="space-y-1.5">
              <Opt on={f.type === "bois_massif"}>
                {t("fiches.exigences.bois_massif")}
              </Opt>
              <br />
              <Opt on={f.type === "laque"}>{t("fiches.exigences.laque")}</Opt>
              {f.type === "laque" && f.type_detail && (
                <span className="ms-2 text-[12px] italic text-rouge">
                  {f.type_detail}
                </span>
              )}
              <br />
              <Opt on={f.type === "pvc"}>{t("fiches.exigences.pvc")}</Opt>
              {f.type === "pvc" && f.type_detail && (
                <span className="ms-2 text-[12px] italic text-rouge">
                  {f.type_detail}
                </span>
              )}
            </div>
            <Row>
              <L>{p("caisson")} :</L>
              <Dotted>{f.caisson}</Dotted>
            </Row>
            <Row>
              <L>{p("decorFacade")} :</L>
              <Dotted>{f.decor_facade}</Dotted>
            </Row>
          </div>

          {/* Électro */}
          <div className="border-b border-ardoise/40 p-3 md:border-b-0 md:border-e">
            <p className="mb-2 text-[13px] font-bold italic underline underline-offset-2">
              {p("electro")} :
            </p>
            <div className="space-y-1.5 text-[13px]">
              <div className="flex flex-wrap items-center gap-x-3">
                <L>{p("evier")} :</L>
                <Opt on={e.evier === "1_bac"}>1 bac</Opt>
                <Opt on={e.evier === "2_bac"}>2 bac</Opt>
              </div>
              <div className="flex flex-wrap items-center gap-x-3">
                <L>{p("plaque")} :</L>
                <Opt on={e.plaque === "4F"}>4 F</Opt>
                <Opt on={e.plaque === "5F"}>5 F</Opt>
                <Opt on={e.plaque === "coin"}>{t("fiches.exigences.coin")}</Opt>
              </div>
              <div className="flex flex-wrap items-center gap-x-3">
                <L>{p("hotte")} :</L>
                <Opt on={e.hotte === "60"}>60</Opt>
                <Opt on={e.hotte === "90"}>90</Opt>
                <Opt on={e.hotte === "coin"}>{t("fiches.exigences.coin")}</Opt>
                <Opt on={e.hotte === "centrale"}>
                  {t("fiches.exigences.centrale")}
                </Opt>
              </div>
              <div className="flex flex-wrap items-center gap-x-3">
                <L>{p("four")} :</L>
                <Opt on={e.four === "encastrable"}>{p("enc")}</Opt>
                <Opt on={e.four === "non_encastrable"}>{p("nonEnc")}</Opt>
                <Opt on={e.four_taille === "60"}>60</Opt>
                <Opt on={e.four_taille === "90"}>90</Opt>
              </div>
              <div className="flex flex-wrap items-center gap-x-3">
                <L>{p("monde")} :</L>
                <Opt on={e.micro_onde === "encastrable"}>{p("enc")}</Opt>
                <Opt on={e.micro_onde === "non_encastrable"}>{p("nonEnc")}</Opt>
              </div>
              <div className="flex flex-wrap items-center gap-x-3">
                <L>{p("frigo")} :</L>
                <Opt on={e.frigo === "encastrable"}>{p("enc")}</Opt>
                <Opt on={e.frigo === "non_encastrable"}>{p("nonEnc")}</Opt>
                <span className="inline-flex items-end gap-1">
                  <Sq on={Boolean(e.frigo_autres)} /> {p("autres")} :
                  <span className="min-w-16 border-b border-dotted border-ardoise/50 px-1 text-[12px] italic">
                    {e.frigo_autres}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3">
                <L>{p("lv")} :</L>
                <Opt on={e.lave_vaisselle === "encastrable"}>{p("enc")}</Opt>
                <Opt on={e.lave_vaisselle === "non_encastrable"}>
                  {p("nonEnc")}
                </Opt>
              </div>
              <Row>
                <L>{p("autres")}:</L>
                <Dotted>{e.electro_autres}</Dotted>
              </Row>
            </div>
          </div>

          {/* Autres détails */}
          <div className="p-3">
            <p className="mb-2 text-[13px] font-bold italic underline underline-offset-2">
              {p("autresDetails")}:
            </p>
            <div className="space-y-2 text-[13px]">
              <div className="flex flex-wrap items-center gap-x-3">
                {p("avecRetour")}
                <Opt on={d.avec_retour === true}>{p("oui")}</Opt>
                <Opt on={d.avec_retour === false}>{p("non")}</Opt>
              </div>
              <div className="flex flex-wrap items-center gap-x-3">
                {p("ilotCentral")}
                <Opt on={d.ilot_central === true}>{p("oui")}</Opt>
                <Opt on={d.ilot_central === false}>{p("non")}</Opt>
              </div>
              <Row>
                <L>{p("autres")} :</L>
                <Dotted>{d.autres_details}</Dotted>
              </Row>
            </div>
          </div>
        </div>
      </div>

      {/* ═ Suivi commercial ═ */}
      <div className="mt-4 border-2 border-ardoise/60">
        <div className="border-b-2 border-ardoise/60 bg-brume/60 px-3 py-1">
          <L>{p("suiviTitle")}</L>
        </div>
        <div className="space-y-2 p-3">
          <Row>
            <L>{p("datePrevue")} :</L>
            <Dotted className="font-mono">
              {fmt(fiche.date_prevue_remise_devis)}
            </Dotted>
          </Row>
          <Row>
            <L>{p("dateEffective")} :</L>
            <Dotted className="font-mono">
              {fmt(fiche.date_effective_remise_devis)}
            </Dotted>
          </Row>
          <Row>
            <L>{p("datePrete")}:</L>
            <Dotted className="font-mono">{fmt(fiche.date_prete_devis)}</Dotted>
          </Row>

          <div className="space-y-3 pt-3">
            {ORD.map((ord, i) => {
              const r = contactByNumero.get(i + 1);
              return (
                <Row key={ord}>
                  <L>
                    {ord} {p("contact")} :
                  </L>
                  <Dotted>
                    {r
                      ? `${formatDate(r.created_at, "dd/MM/yyyy", locale)} — ${t(`canaux.${r.canal}`)} — ${t(`relanceResultats.${r.resultat}`)}${r.commentaire ? ` · ${r.commentaire}` : ""}`
                      : undefined}
                  </Dotted>
                </Row>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═ Footer ═ */}
      <div className="mt-4 space-y-2">
        <Row>
          <L>{p("confirmation")} :</L>
          <Dotted className="font-mono">{fmt(signatureDate)}</Dotted>
        </Row>
        <Row>
          <L>{p("remarques")} :</L>
          <Dotted>{fiche.remarques_client}</Dotted>
        </Row>
      </div>

      <p className="mt-6 text-center text-[12px] font-bold underline underline-offset-4">
        {p("slogan")}
      </p>
    </article>
  );
}
