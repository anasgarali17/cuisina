"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FicheRow } from "@/lib/database.types";
import type { PdfStrings } from "@/components/fiches/fiche-pdf";

export function ExportPdfButton({
  fiche,
  conseillerName,
  pdvName,
}: {
  fiche: FicheRow;
  conseillerName: string;
  pdvName: string;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);

  async function exportPdf() {
    setBusy(true);
    try {
      const [{ pdf }, { buildFichePdfDoc }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./fiche-pdf"),
      ]);

      const strings: PdfStrings = {
        tagline: t("app.tagline"),
        formCode: t("fiches.formCode"),
        step1: t("fiches.wizard.step1"),
        step2: t("origines.question"),
        step3: t("fiches.wizard.step3"),
        step4: t("fiches.wizard.step4"),
        clientNom: t("fiches.wizard.clientNom"),
        telMobile: t("fiches.wizard.telMobile"),
        telDomicile: t("fiches.wizard.telDomicile"),
        email: t("fiches.wizard.email"),
        adresse: t("fiches.wizard.adresse"),
        ville: t("fiches.wizard.ville"),
        conseiller: t("fiches.wizard.conseiller"),
        pointDeVente: t("fiches.wizard.pointDeVente"),
        nbCuisines: t("fiches.wizard.nbCuisines"),
        nbDressings: t("fiches.wizard.nbDressings"),
        nbSdb: t("fiches.wizard.nbSdb"),
        etatChantier: t("fiches.wizard.etatChantier"),
        en_cours: t("fiches.wizard.en_cours"),
        fini: t("fiches.wizard.fini"),
        budget: t("fiches.wizard.budget"),
        dateLivraison: t("fiches.wizard.dateLivraison"),
        observations: t("fiches.wizard.observations"),
        bouche_a_oreille: t("origines.bouche_a_oreille"),
        site_web: t("origines.site_web"),
        foire: t("origines.foire"),
        publicite: t("origines.publicite"),
        prospection: t("origines.details.prospection"),
        architecte_decorateur: t("origines.details.architecte_decorateur"),
        promoteur_entrepreneur: t("origines.details.promoteur_entrepreneur"),
        ami: t("origines.details.ami"),
        spot_publicitaire: t("origines.details.spot_publicitaire"),
        magasine: t("origines.details.magasine"),
        affiche_enseigne: t("origines.details.affiche_enseigne"),
        catalogue: t("origines.details.catalogue"),
        finitionFacade: t("fiches.exigences.finitionFacade"),
        bois_massif: t("fiches.exigences.bois_massif"),
        laque: t("fiches.exigences.laque"),
        pvc: t("fiches.exigences.pvc"),
        caisson: t("fiches.exigences.caisson"),
        decorFacade: t("fiches.exigences.decorFacade"),
        electromenager: t("fiches.exigences.electromenager"),
        evier: t("fiches.exigences.evier"),
        bac1: t("fiches.exigences.bac1"),
        bac2: t("fiches.exigences.bac2"),
        plaque: t("fiches.exigences.plaque"),
        hotte: t("fiches.exigences.hotte"),
        four: t("fiches.exigences.four"),
        microOnde: t("fiches.exigences.microOnde"),
        frigo: t("fiches.exigences.frigo"),
        laveVaisselle: t("fiches.exigences.laveVaisselle"),
        encastrable: t("fiches.exigences.encastrable"),
        non_encastrable: t("fiches.exigences.non_encastrable"),
        electroAutres: t("fiches.exigences.electroAutres"),
        detailsCuisine: t("fiches.exigences.detailsCuisine"),
        avecRetour: t("fiches.exigences.avecRetour"),
        ilotCentral: t("fiches.exigences.ilotCentral"),
        autresDetails: t("fiches.exigences.autresDetails"),
        oui: t("fiches.exigences.oui"),
        non: t("fiches.exigences.non"),
        signature: t("fiches.detail.signature"),
      };

      const blob = await pdf(
        buildFichePdfDoc({ fiche, strings, conseillerName, pdvName }),
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
