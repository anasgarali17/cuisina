import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/auth";
import { listClients } from "@/lib/data/queries";
import { PageHeader } from "@/components/shell/page-header";
import { ClientsList } from "@/components/clients/clients-list";

export default async function ClientsPage() {
  const [t, profile] = await Promise.all([
    getTranslations(),
    getCurrentProfile(),
  ]);
  if (!profile) return null;

  const clients = await listClients(profile);

  return (
    <>
      <PageHeader title={t("clients.title")} />
      <ClientsList clients={clients} />
    </>
  );
}
