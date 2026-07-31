import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { exigencesSchema, EXIGENCES_VIDES } from "@/lib/schemas/fiche";
import type { FicheRow } from "@/lib/database.types";

export type PdfStrings = Record<string, string>;

const s = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#3A3733",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brand: { fontSize: 20, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  tagline: { fontSize: 8, fontFamily: "Helvetica-Oblique", color: "#B98B54" },
  formCode: {
    borderWidth: 1,
    borderColor: "#3A3733",
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: 7,
    fontFamily: "Courier",
  },
  rule: { height: 3, backgroundColor: "#C1121F", marginTop: 8 },
  reference: {
    marginTop: 8,
    fontSize: 11,
    fontFamily: "Courier-Bold",
    color: "#C1121F",
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 2,
    borderBottomWidth: 1.5,
    borderBottomColor: "#3A3733",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  fieldHalf: { width: "50%", marginBottom: 5, paddingRight: 8 },
  fieldQuarter: { width: "25%", marginBottom: 5, paddingRight: 8 },
  label: { fontSize: 6.5, color: "#8A8377", textTransform: "uppercase" },
  value: { fontSize: 9, marginTop: 1 },
  mono: { fontFamily: "Courier" },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
    marginRight: 12,
  },
  checkbox: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: "#3A3733",
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxInner: { width: 4, height: 4, backgroundColor: "#3A3733" },
  columns: { flexDirection: "row", marginTop: 4 },
  column: { flex: 1, paddingRight: 10 },
  columnTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#B98B54",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  signatureBlock: {
    marginTop: 30,
    alignSelf: "flex-end",
    width: 160,
  },
  signatureLine: { borderTopWidth: 1, borderTopColor: "#3A3733" },
  signatureLabel: { fontSize: 6.5, color: "#8A8377", marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 6.5,
    color: "#8A8377",
    textAlign: "center",
  },
});

function Check({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={s.checkRow}>
      <View style={s.checkbox}>{checked ? <View style={s.checkboxInner} /> : null}</View>
      <Text>{label}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  mono,
  quarter,
}: {
  label: string;
  value: string;
  mono?: boolean;
  quarter?: boolean;
}) {
  return (
    <View style={quarter ? s.fieldQuarter : s.fieldHalf}>
      <Text style={s.label}>{label}</Text>
      <Text style={mono ? [s.value, s.mono] : s.value}>{value || "—"}</Text>
    </View>
  );
}

/**
 * A4 document mirroring the paper FO-COM-02 — red header rule, boxed form
 * code, checkbox squares, three-column exigences, signature line.
 */
export function buildFichePdfDoc({
  fiche,
  strings,
  conseillerName,
  pdvName,
}: {
  fiche: FicheRow;
  strings: PdfStrings;
  conseillerName: string;
  pdvName: string;
}) {
  const parsed = exigencesSchema.safeParse(fiche.exigences);
  const ex = parsed.success ? parsed.data : EXIGENCES_VIDES;
  const g = (key: string) => strings[key] ?? key;

  const origines = ["bouche_a_oreille", "site_web", "foire", "publicite"];
  const details: Record<string, string[]> = {
    bouche_a_oreille: [
      "prospection",
      "architecte_decorateur",
      "promoteur_entrepreneur",
      "ami",
    ],
    publicite: ["spot_publicitaire", "magasine", "affiche_enseigne", "catalogue"],
  };

  const enc = (v: string | null) => (v ? g(v) : "—");

  return (
    <Document title={fiche.reference}>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.brand}>CUISINA</Text>
            <Text style={s.tagline}>{g("tagline")}</Text>
          </View>
          <Text style={s.formCode}>{g("formCode")}</Text>
        </View>
        <View style={s.rule} />
        <Text style={s.reference}>{fiche.reference}</Text>

        <Text style={s.sectionTitle}>{g("step1")}</Text>
        <View style={s.grid}>
          <Field label={g("clientNom")} value={fiche.client_nom} />
          <Field label={g("telMobile")} value={fiche.tel_mobile ?? ""} mono />
          <Field label={g("telDomicile")} value={fiche.tel_domicile ?? ""} mono />
          <Field label={g("email")} value={fiche.email ?? ""} />
          <Field label={g("adresse")} value={fiche.adresse_complete ?? ""} />
          <Field
            label={g("ville")}
            value={[fiche.code_postal, fiche.ville].filter(Boolean).join(" ")}
          />
          <Field label={g("conseiller")} value={conseillerName} />
          <Field label={g("pointDeVente")} value={pdvName} />
        </View>

        <Text style={s.sectionTitle}>{g("step2")}</Text>
        <View style={s.grid}>
          {origines.map((o) => (
            <Check key={o} checked={fiche.origine === o} label={g(o)} />
          ))}
        </View>
        {fiche.origine && details[fiche.origine] ? (
          <View style={[s.grid, { marginLeft: 14, marginTop: 2 }]}>
            {details[fiche.origine].map((d) => (
              <Check key={d} checked={fiche.origine_detail === d} label={g(d)} />
            ))}
          </View>
        ) : null}

        <Text style={s.sectionTitle}>{g("step3")}</Text>
        <View style={s.grid}>
          <Field label={g("nbCuisines")} value={String(fiche.nb_cuisines)} quarter />
          <Field label={g("nbDressings")} value={String(fiche.nb_dressings)} quarter />
          <Field label={g("nbSdb")} value={String(fiche.nb_sdb)} quarter />
          <Field
            label={g("etatChantier")}
            value={fiche.etat_chantier ? g(fiche.etat_chantier) : "—"}
            quarter
          />
          <Field
            label={g("budget")}
            value={
              fiche.budget_estimatif != null
                ? `${Math.round(fiche.budget_estimatif).toLocaleString("fr-TN")} DT`
                : "—"
            }
            mono
          />
          <Field
            label={g("dateLivraison")}
            value={fiche.date_livraison_souhaitee ?? ""}
            mono
          />
        </View>
        {fiche.observations ? (
          <Field label={g("observations")} value={fiche.observations} />
        ) : null}

        <Text style={s.sectionTitle}>{g("step4")}</Text>
        <View style={s.columns}>
          <View style={s.column}>
            <Text style={s.columnTitle}>{g("finitionFacade")}</Text>
            {(["bois_massif", "laque", "pvc"] as const).map((v) => (
              <Check
                key={v}
                checked={ex.finition_facade.type === v}
                label={g(v)}
              />
            ))}
            {ex.finition_facade.type_detail ? (
              <Field label="" value={ex.finition_facade.type_detail} />
            ) : null}
            <Field label={g("caisson")} value={ex.finition_facade.caisson} />
            <Field
              label={g("decorFacade")}
              value={ex.finition_facade.decor_facade}
            />
          </View>
          <View style={s.column}>
            <Text style={s.columnTitle}>{g("electromenager")}</Text>
            <Field
              label={g("evier")}
              value={
                ex.electromenager.evier
                  ? g(ex.electromenager.evier === "1_bac" ? "bac1" : "bac2")
                  : "—"
              }
            />
            <Field
              label={g("plaque")}
              value={ex.electromenager.plaque ?? "—"}
            />
            <Field label={g("hotte")} value={ex.electromenager.hotte ?? "—"} />
            <Field
              label={g("four")}
              value={`${enc(ex.electromenager.four)}${ex.electromenager.four_taille ? ` · ${ex.electromenager.four_taille}` : ""}`}
            />
            <Field
              label={g("microOnde")}
              value={enc(ex.electromenager.micro_onde)}
            />
            <Field label={g("frigo")} value={enc(ex.electromenager.frigo)} />
            <Field
              label={g("laveVaisselle")}
              value={enc(ex.electromenager.lave_vaisselle)}
            />
            {ex.electromenager.electro_autres ? (
              <Field
                label={g("electroAutres")}
                value={ex.electromenager.electro_autres}
              />
            ) : null}
          </View>
          <View style={s.column}>
            <Text style={s.columnTitle}>{g("detailsCuisine")}</Text>
            <Field
              label={g("avecRetour")}
              value={
                ex.details_cuisine.avec_retour === null
                  ? "—"
                  : g(ex.details_cuisine.avec_retour ? "oui" : "non")
              }
            />
            <Field
              label={g("ilotCentral")}
              value={
                ex.details_cuisine.ilot_central === null
                  ? "—"
                  : g(ex.details_cuisine.ilot_central ? "oui" : "non")
              }
            />
            {ex.details_cuisine.autres_details ? (
              <Field
                label={g("autresDetails")}
                value={ex.details_cuisine.autres_details}
              />
            ) : null}
          </View>
        </View>

        <View style={s.signatureBlock}>
          <View style={s.signatureLine} />
          <Text style={s.signatureLabel}>{g("signature")}</Text>
        </View>

        <Text style={s.footer}>PROMOCUISINE · ISO 9001 · www.cuisina.tn</Text>
      </Page>
    </Document>
  );
}
