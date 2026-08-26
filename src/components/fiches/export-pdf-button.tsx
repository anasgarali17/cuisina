"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CANAUX, RELANCE_RESULTATS } from "@/lib/domain";
import type { FicheRelanceRow, FicheRow } from "@/lib/database.types";
import type { PdfStrings } from "@/components/fiches/fiche-pdf";

const PAPER_KEYS = [
  "le",
  "client",
  "telDomicile",
  "mobile",
  "bureau",
  "commercial",
  "email",
  "cp",
  "ville",
  "architecte",
  "adresse",
  "typeProjet",
  "nombre",
  "cuisines",
  "dressings",
  "etatChantier",
  "enCours",
  "fini",
  "budget",
  "dateLivraison",
  "observations",
  "exigences",
  "finitionFacade",
  "electro",
  "autresDetails",
  "caisson",
  "decorFacade",
  "evier",
  "plaque",
  "hotte",
  "four",
  "monde",
  "frigo",
  "lv",
  "enc",
  "nonEnc",
  "autres",
  "avecRetour",
  "ilotCentral",
  "oui",
  "non",
  "suiviTitle",
  "datePrevue",
  "dateEffective",
  "datePrete",
  "contact",
  "confirmation",
  "remarques",
  "slogan",
] as const;

const ORIGINE_KEYS = [
  "bouche_a_oreille",
  "site_web",
  "foire",
  "publicite",
] as const;
const ORIGINE_DETAIL_KEYS = [
  "prospection",
  "architecte_decorateur",
  "promoteur_entrepreneur",
  "ami",
  "facebook",
  "instagram",
  "tiktok",
  "autre_reseau",
] as const;

export function ExportPdfButton({
  fiche,
  conseillerName,
  pdvName,
  relances = [],
  signatureDate = null,
}: {
  fiche: FicheRow;
  conseillerName: string;
  pdvName?: string;
  relances?: FicheRelanceRow[];
  signatureDate?: string | null;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  void pdvName;

  async function exportPdf() {
    setBusy(true);
    try {
      const [{ pdf }, { buildFichePdfDoc }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./fiche-pdf"),
      ]);

      const strings: PdfStrings = {
        tagline: t("app.tagline"),
        question: t("origines.question"),
        bois_massif: t("fiches.exigences.bois_massif"),
        laque: t("fiches.exigences.laque"),
        pvc: t("fiches.exigences.pvc"),
        coin: t("fiches.exigences.coin"),
        centrale: t("fiches.exigences.centrale"),
      };
      for (const key of PAPER_KEYS) strings[key] = t(`fiches.paper.${key}`);
      for (const key of ORIGINE_KEYS) strings[key] = t(`origines.${key}`);
      for (const key of ORIGINE_DETAIL_KEYS)
        strings[key] = t(`origines.details.${key}`);
      for (const canal of CANAUX) strings[canal] = t(`canaux.${canal}`);
      for (const resultat of RELANCE_RESULTATS)
        strings[resultat] = t(`relanceResultats.${resultat}`);

      const blob = await pdf(
        buildFichePdfDoc({
          fiche,
          strings,
          conseillerName,
          relances,
          signatureDate,
        }),
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fiche.reference}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={exportPdf} disabled={busy}>
      <Download className="size-4" />
      {t("fiches.detail.exportPdf")}
    </Button>
  );
}
