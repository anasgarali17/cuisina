import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { exigencesSchema, EXIGENCES_VIDES } from "@/lib/schemas/fiche";
import type { FicheRelanceRow, FicheRow } from "@/lib/database.types";

export type PdfStrings = Record<string, string>;

// The built-in Helvetica has no Arabic glyphs: an Arabic client name or
// address would silently render as nothing. Amiri covers Arabic + Latin;
// it is only fetched when a rendered text actually uses it.
Font.register({ family: "Amiri", src: "/fonts/Amiri-Regular.ttf" });

const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const arStyle = (v?: string | null) =>
  v && ARABIC_RE.test(v)
    ? ({ fontFamily: "Amiri", direction: "rtl", textAlign: "right" } as const)
    : null;

const INK = "#1f1c18";

const s = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica", color: INK },
  headerRow: {
    flexDirection: "row",
    borderWidth: 1.5,
    borderColor: INK,
  },
  headerCell: { justifyContent: "center", alignItems: "center", padding: 6 },
  logoBadge: {
    backgroundColor: "#C1121F",
    color: "#ffffff",
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 10,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  tagline: { fontSize: 5, color: "#C1121F", marginTop: 2, letterSpacing: 1 },
  title: {
    fontSize: 19,
    fontFamily: "Times-Bold",
    letterSpacing: 2,
  },
  code: { fontFamily: "Times-Bold", fontSize: 10, textAlign: "center" },
  label: {
    fontFamily: "Helvetica-BoldOblique",
    textDecoration: "underline",
    fontSize: 9,
  },
  row: { flexDirection: "row", alignItems: "flex-end", marginTop: 4 },
  // flex 1 (grow + shrink + basis 0) sizes the value box to exactly the
  // space left in the row, so long values wrap there instead of running
  // past the page edge, where they would be cut off.
  dotted: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    borderBottomWidth: 0.8,
    borderBottomColor: INK,
    borderBottomStyle: "dotted",
    paddingHorizontal: 3,
    minHeight: 11,
    fontSize: 9,
  },
  cols2: { flexDirection: "row", gap: 24 },
  col: { flex: 1 },
  box: { borderWidth: 1, borderColor: INK, padding: 6, marginTop: 8 },
  band: {
    backgroundColor: "#e8e2d8",
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  sq: {
    width: 7,
    height: 7,
    borderWidth: 0.9,
    borderColor: INK,
    marginRight: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  sqIn: { width: 3.4, height: 3.4, backgroundColor: INK },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    flexShrink: 1,
    maxWidth: "100%",
  },
  optText: { flexShrink: 1 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", rowGap: 2 },
  exGrid: { flexDirection: "row" },
  exCol: { padding: 5, borderRightWidth: 0.8, borderRightColor: INK },
  slogan: {
    marginTop: 12,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    textDecoration: "underline",
  },
});

function Sq({ on }: { on?: boolean }) {
  return <View style={s.sq}>{on ? <View style={s.sqIn} /> : null}</View>;
}

function Opt({ on, label }: { on?: boolean; label: string }) {
  const ar = arStyle(label);
  return (
    <View style={s.opt}>
      <Sq on={on} />
      <Text style={ar ? [s.optText, ar] : s.optText}>{label}</Text>
    </View>
  );
}

function Line({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  const ar = arStyle(value);
  return (
    <View style={s.row}>
      <Text style={s.label}>{label} :</Text>
      <Text
        style={[
          s.dotted,
          mono && !ar ? { fontFamily: "Courier" } : {},
          ar ?? {},
        ]}
      >
        {value ?? ""}
      </Text>
    </View>
  );
}

/** A4 facsimile of the paper FO-COM-02 FICHE CONTACT. */
export function buildFichePdfDoc({
  fiche,
  strings,
  conseillerName,
  relances = [],
  signatureDate = null,
}: {
  fiche: FicheRow;
  strings: PdfStrings;
  conseillerName: string;
  pdvName?: string;
  relances?: FicheRelanceRow[];
  signatureDate?: string | null;
}) {
  const g = (key: string) => strings[key] ?? key;
  const parsed = exigencesSchema.safeParse(fiche.exigences);
  const ex = parsed.success ? parsed.data : EXIGENCES_VIDES;
  const e = ex.electromenager;
  const d = ex.details_cuisine;
  const f = ex.finition_facade;

  const fmt = (iso: string | null) =>
    iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";

  const byNumero = new Map<number, FicheRelanceRow>();
  for (const r of relances) {
    const prev = byNumero.get(r.numero_contact);
    if (!prev || r.created_at > prev.created_at) byNumero.set(r.numero_contact, r);
  }
  const ORD = ["1er", "2ème", "3ème", "4ème", "5ème"];

  return (
    <Document title={fiche.reference}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={[s.headerCell, { borderRightWidth: 1.5, borderRightColor: INK, width: 120 }]}>
            <Text style={s.logoBadge}>CUISINA</Text>
            <Text style={s.tagline}>{g("tagline").toUpperCase()}</Text>
          </View>
          <View style={[s.headerCell, { flex: 1 }]}>
            <Text style={s.title}>FICHE CONTACT</Text>
          </View>
          <View style={[s.headerCell, { borderLeftWidth: 1.5, borderLeftColor: INK, width: 110 }]}>
            <Text style={s.code}>FO-COM-02{"\n"}IE : 09 ;JUIL 2018</Text>
          </View>
        </View>

        {/* ref + le : */}
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={{ fontFamily: "Courier-Bold", color: "#C1121F" }}>
            {fiche.reference}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", width: 180 }}>
            <Text style={s.label}>{g("le")} :</Text>
            <Text style={s.dotted}>{fmt(fiche.created_at.slice(0, 10))}</Text>
          </View>
        </View>

        {/* Identity */}
        <View style={[s.cols2, { marginTop: 2 }]}>
          <View style={s.col}>
            <Line label={g("client")} value={fiche.client_nom} />
            <Line label={g("telDomicile")} value={fiche.tel_domicile} mono />
            <Line label={g("mobile")} value={fiche.tel_mobile} mono />
            <Line label={g("adresse")} value={fiche.adresse_complete} />
          </View>
          <View style={s.col}>
            <Line label={g("commercial")} value={conseillerName} />
            <Line label={g("bureau")} value={fiche.tel_bureau} mono />
            <Line label={g("email")} value={fiche.email} />
            <View style={s.row}>
              <Text style={s.label}>{g("ville")}:</Text>
              <Text style={[s.dotted, arStyle(fiche.ville) ?? {}]}>
                {fiche.ville ?? ""}
              </Text>
            </View>
          </View>
        </View>

        {/* Origine */}
        <View style={s.box}>
          <Text style={s.label}>{g("question")}</Text>
          <View style={{ flexDirection: "row", marginTop: 4 }}>
            <View style={{ width: "34%" }}>
              <Opt on={fiche.origine === "bouche_a_oreille"} label={`${g("bouche_a_oreille")} :`} />
              <View style={{ marginLeft: 12, marginTop: 3, gap: 3 }}>
                <Opt on={fiche.origine_detail === "prospection"} label={g("prospection")} />
                <Opt on={fiche.origine_detail === "architecte_decorateur"} label={g("architecte_decorateur")} />
                <Opt on={fiche.origine_detail === "promoteur_entrepreneur"} label={g("promoteur_entrepreneur")} />
                <Opt on={fiche.origine_detail === "ami"} label={g("ami")} />
              </View>
            </View>
            <View style={{ width: "18%" }}>
              <Opt on={fiche.origine === "site_web"} label={g("site_web")} />
            </View>
            <View style={{ width: "14%" }}>
              <Opt on={fiche.origine === "foire"} label={g("foire")} />
            </View>
            <View style={{ width: "34%" }}>
              <Opt on={fiche.origine === "publicite"} label={`${g("publicite")} :`} />
              <View style={{ marginLeft: 12, marginTop: 3, gap: 3 }}>
                <Opt on={fiche.origine_detail === "facebook"} label={g("facebook")} />
                <Opt on={fiche.origine_detail === "instagram"} label={g("instagram")} />
                <Opt on={fiche.origine_detail === "tiktok"} label={g("tiktok")} />
                <Opt on={fiche.origine_detail === "autre_reseau"} label={g("autre_reseau")} />
              </View>
            </View>
          </View>
        </View>

        {/* Projet */}
        <View style={[s.row, { gap: 14, flexWrap: "wrap" }]}>
          <Text style={s.label}>{g("typeProjet")} :</Text>
          <View style={s.opt}>
            <Text>
              {g("nombre")} : {fiche.nb_cuisines || "…"} {g("cuisines")}{" "}
            </Text>
            <Sq on={fiche.nb_cuisines > 0} />
          </View>
          <View style={s.opt}>
            <Text>
              {g("nombre")} : {fiche.nb_dressings || "…"} {g("dressings")}{" "}
            </Text>
            <Sq on={fiche.nb_dressings > 0} />
          </View>
        </View>
        <Line label={g("dateLivraison")} value={fmt(fiche.date_livraison_souhaitee)} mono />

        {/* Exigences */}
        <View style={[s.box, { padding: 0 }]}>
          <View style={s.band}>
            <Text style={s.label}>{g("exigences")}</Text>
          </View>
          <View style={s.exGrid}>
            <View style={[s.exCol, { width: "27%" }]}>
              <Text style={[s.label, { marginBottom: 3 }]}>{g("finitionFacade")} :</Text>
              <View style={{ gap: 3 }}>
                <Opt on={f.type === "bois_massif"} label={g("bois_massif")} />
                <Opt on={f.type === "laque"} label={`${g("laque")}${f.type === "laque" && f.type_detail ? ` — ${f.type_detail}` : ""}`} />
                <Opt on={f.type === "pvc"} label={`${g("pvc")}${f.type === "pvc" && f.type_detail ? ` — ${f.type_detail}` : ""}`} />
              </View>
              <Line label={g("caisson")} value={f.caisson} />
              <Line label={g("decorFacade")} value={f.decor_facade} />
            </View>
            <View style={[s.exCol, { width: "44%" }]}>
              <Text style={[s.label, { marginBottom: 3 }]}>{g("electro")} :</Text>
              <View style={{ gap: 3 }}>
                <View style={s.wrapRow}>
                  <Text style={s.label}>{g("evier")} : </Text>
                  <Opt on={e.evier === "1_bac"} label="1 bac" />
                  <Opt on={e.evier === "2_bac"} label="2 bac" />
                </View>
                <View style={s.wrapRow}>
                  <Text style={s.label}>{g("plaque")} : </Text>
                  <Opt on={e.plaque === "4F"} label="4 F" />
                  <Opt on={e.plaque === "5F"} label="5 F" />
                  <Opt on={e.plaque === "coin"} label={g("coin")} />
                </View>
                <View style={s.wrapRow}>
                  <Text style={s.label}>{g("hotte")} : </Text>
                  <Opt on={e.hotte === "60"} label="60" />
                  <Opt on={e.hotte === "90"} label="90" />
                  <Opt on={e.hotte === "coin"} label={g("coin")} />
                  <Opt on={e.hotte === "centrale"} label={g("centrale")} />
                </View>
                <View style={s.wrapRow}>
                  <Text style={s.label}>{g("four")} : </Text>
                  <Opt on={e.four === "encastrable"} label={g("enc")} />
                  <Opt on={e.four === "non_encastrable"} label={g("nonEnc")} />
                  <Opt on={e.four_taille === "60"} label="60" />
                  <Opt on={e.four_taille === "90"} label="90" />
                </View>
                <View style={s.wrapRow}>
                  <Text style={s.label}>{g("monde")} : </Text>
                  <Opt on={e.micro_onde === "encastrable"} label={g("enc")} />
                  <Opt on={e.micro_onde === "non_encastrable"} label={g("nonEnc")} />
                </View>
                <View style={s.wrapRow}>
                  <Text style={s.label}>{g("frigo")} : </Text>
                  <Opt on={e.frigo === "encastrable"} label={g("enc")} />
                  <Opt on={e.frigo === "non_encastrable"} label={g("nonEnc")} />
                  <Opt on={Boolean(e.frigo_autres)} label={`${g("autres")} : ${e.frigo_autres}`} />
                </View>
                <View style={s.wrapRow}>
                  <Text style={s.label}>{g("lv")} : </Text>
                  <Opt on={e.lave_vaisselle === "encastrable"} label={g("enc")} />
                  <Opt on={e.lave_vaisselle === "non_encastrable"} label={g("nonEnc")} />
                </View>
                <Line label={g("autres")} value={e.electro_autres} />
              </View>
            </View>
            <View style={[s.exCol, { width: "29%", borderRightWidth: 0 }]}>
              <Text style={[s.label, { marginBottom: 3 }]}>{g("autresDetails")}:</Text>
              <View style={{ gap: 4 }}>
                <View style={s.wrapRow}>
                  <Text>{g("avecRetour")} </Text>
                  <Opt on={d.avec_retour === true} label={g("oui")} />
                  <Opt on={d.avec_retour === false} label={g("non")} />
                </View>
                <View style={s.wrapRow}>
                  <Text>{g("ilotCentral")} </Text>
                  <Opt on={d.ilot_central === true} label={g("oui")} />
                  <Opt on={d.ilot_central === false} label={g("non")} />
                </View>
                <Line label={g("autres")} value={d.autres_details} />
              </View>
            </View>
          </View>
        </View>

        {/* Suivi commercial */}
        <View style={[s.box, { padding: 0 }]}>
          <View style={s.band}>
            <Text style={s.label}>{g("suiviTitle")}</Text>
          </View>
          <View style={{ padding: 6 }}>
            <Line label={g("datePrevue")} value={fmt(fiche.date_prevue_remise_devis)} mono />
            <Line label={g("dateEffective")} value={fmt(fiche.date_effective_remise_devis)} mono />
            <Line label={g("datePrete")} value={fmt(fiche.date_prete_devis)} mono />
            <View style={{ marginTop: 6, gap: 7 }}>
              {ORD.map((ord, i) => {
                const r = byNumero.get(i + 1);
                return (
                  <Line
                    key={ord}
                    label={`${ord} ${g("contact")}`}
                    value={
                      r
                        ? `${fmt(r.created_at.slice(0, 10))} — ${g(r.canal)} — ${g(r.resultat)}${r.commentaire ? ` · ${r.commentaire}` : ""}`
                        : ""
                    }
                  />
                );
              })}
            </View>
          </View>
        </View>

        {/* Footer */}
        <Line
          label={g("confirmation")}
          value={signatureDate ? fmt(signatureDate.slice(0, 10)) : ""}
          mono
        />
        <Line label={g("remarques")} value={fiche.remarques_client} />

        <Text style={s.slogan}>{g("slogan")}</Text>
      </Page>
    </Document>
  );
}
