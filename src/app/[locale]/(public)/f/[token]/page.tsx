import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getLienPublic, listShowroomsPublics } from "@/lib/data/queries";
import { visuelsDisponibles } from "@/lib/catalogue-server";
import { PublicFicheForm } from "@/components/public/public-fiche-form";
import { PublicShell } from "@/components/public/public-shell";

export const metadata: Metadata = {
  title: "Fiche Contact",
  // Un lien de collecte n'a rien à faire dans un index de moteur de recherche.
  robots: { index: false, follow: false },
};

export default async function FichePubliquePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, t] = await Promise.all([params, getTranslations("public")]);
  const [lien, showrooms] = await Promise.all([
    getLienPublic(token),
    listShowroomsPublics(),
  ]);

  if (!lien) {
    return (
      <PublicShell>
        <div className="rounded-3xl border border-border bg-card p-8 text-center">
          <h1 className="font-display text-2xl font-bold">
            {t("shared.expiredTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("shared.expiredBody")}
          </p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell pdv={`${lien.pdv_nom} · ${lien.pdv_ville}`}>
      <PublicFicheForm
        token={token}
        audience={lien.audience}
        showrooms={showrooms}
        visuels={visuelsDisponibles()}
      />
    </PublicShell>
  );
}
