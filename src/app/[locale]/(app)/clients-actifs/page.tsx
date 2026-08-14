import { profilAutorise } from "@/lib/garde";
import { ENCADREMENT } from "@/components/shell/nav-config";
import { AccesRefuse } from "@/components/shell/acces-refuse";
import { getTranslations } from "next-intl/server";
import { listClientsActifs } from "@/lib/data/queries";
import { PageHeader } from "@/components/shell/page-header";
import { ProductionBoard } from "@/components/production/production-board";

export default async function ClientsActifsPage() {
  const [t, profile] = await Promise.all([
    getTranslations(),
    profilAutorise(ENCADREMENT),
  ]);
  if (!profile) return <AccesRefuse />;

  const dossiers = await listClientsActifs(profile);

  return (
    <>
      <PageHeader title={t("production.title")} />
      <p className="mb-4 text-sm text-muted-foreground">
        {t("production.subtitle")}
      </p>
      <ProductionBoard dossiers={dossiers} />
    </>
  );
}
