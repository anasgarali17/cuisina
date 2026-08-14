import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/auth";
import { PageHeader } from "@/components/shell/page-header";
import { ParametresWorkspace } from "@/components/parametres/parametres-workspace";

export default async function ParametresPage() {
  const [t, profile] = await Promise.all([
    getTranslations("parametres"),
    getCurrentProfile(),
  ]);
  if (!profile) return null;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ParametresWorkspace profile={profile} />
    </>
  );
}
