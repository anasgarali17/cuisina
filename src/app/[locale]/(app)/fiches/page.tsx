import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentProfile } from "@/lib/auth";
import {
  listFiches,
  listLiens,
  listPdvs,
  listProfiles,
  listSubmissions,
} from "@/lib/data/queries";
import { qrMatrix } from "@/lib/qr";
import { PageHeader } from "@/components/shell/page-header";
import { FichesWorkspace } from "@/components/fiches/fiches-workspace";
import type { LienView } from "@/components/fiches/liens-panel";
import { buttonVariants } from "@/components/ui/button";

/** L'origine réelle de la requête : le QR code doit pointer vers ce domaine. */
async function currentOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function FichesPage() {
  const [t, profile] = await Promise.all([
    getTranslations(),
    getCurrentProfile(),
  ]);
  if (!profile) return null;

  const [fiches, profiles, pdvs, submissions, liensRows, origin] =
    await Promise.all([
      listFiches(profile),
      listProfiles(),
      listPdvs(),
      listSubmissions(),
      listLiens(),
      currentOrigin(),
    ]);

  const conseillers = Object.fromEntries(
    profiles.map((p) => [p.id, `${p.prenom} ${p.nom}`]),
  );
  const conseillerOptions = profiles.map((p) => ({
    id: p.id,
    name: `${p.prenom} ${p.nom}`,
  }));

  // La matrice est calculée ici : l'encodeur QR reste hors du bundle client,
  // qui ne reçoit que les modules — un millier de caractères par lien.
  const liens: LienView[] = liensRows.map((lien) => {
    const url = `${origin}/f/${lien.token}`;
    return { ...lien, url, qr: qrMatrix(url) };
  });

  return (
    <>
      <PageHeader
        title={t("fiches.title")}
        actions={
          <Link
            href="/fiches/nouvelle"
            className={`${buttonVariants({ variant: "secondary" })}`}
          >
            <Plus className="size-4" />
            {t("fiches.new")}
          </Link>
        }
      />
      <FichesWorkspace
        fiches={fiches}
        conseillers={conseillers}
        pdvs={pdvs}
        submissions={submissions}
        conseillerOptions={conseillerOptions}
        liens={liens}
      />
    </>
  );
}
