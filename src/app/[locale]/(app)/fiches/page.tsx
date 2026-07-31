import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { listFiches, listProfiles } from "@/lib/data/queries";
import { PageHeader } from "@/components/shell/page-header";
import { FichesList } from "@/components/fiches/fiches-list";
import { buttonVariants } from "@/components/ui/button";

export default async function FichesPage() {
  const [t, profile] = await Promise.all([
    getTranslations(),
    getCurrentProfile(),
  ]);
  if (!profile) return null;

  const [fiches, profiles] = await Promise.all([
    listFiches(profile),
    listProfiles(),
  ]);

  const conseillers = Object.fromEntries(
    profiles.map((p) => [p.id, `${p.prenom} ${p.nom}`]),
  );

  return (
    <>
      <PageHeader
        title={t("fiches.title")}
        actions={
          <Link href="/fiches/nouvelle" className={buttonVariants()}>
            <Plus className="size-4" />
            {t("fiches.new")}
          </Link>
        }
      />
      <FichesList fiches={fiches} conseillers={conseillers} />
    </>
  );
}
