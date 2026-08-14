import { profilAutorise } from "@/lib/garde";
import { ENCADREMENT } from "@/components/shell/nav-config";
import { AccesRefuse } from "@/components/shell/acces-refuse";
import { getTranslations } from "next-intl/server";
import { listClients, listFiches, listPdvs } from "@/lib/data/queries";
import { STAGES_HORS_FUNNEL, scoreClient } from "@/lib/domain";
import { daysSince } from "@/lib/dates";
import { PageHeader } from "@/components/shell/page-header";
import {
  ClientsWorkspace,
  type ClientMeta,
} from "@/components/clients/clients-workspace";

export default async function ClientsPage() {
  const [t, profile] = await Promise.all([
    getTranslations(),
    profilAutorise(ENCADREMENT),
  ]);
  if (!profile) return <AccesRefuse />;

  const [clients, fiches, pdvs] = await Promise.all([
    listClients(profile),
    listFiches(profile),
    listPdvs(),
  ]);

  /**
   * Où en est chaque client, et avec quoi. Lu depuis ses fiches plutôt que
   * depuis le compteur de projets : un client « actif » a au moins une
   * affaire encore dans le tunnel, un « signé » n'a plus que du conclu.
   *
   * Les projets sont réduits ici, côté serveur : le panneau n'a pas besoin
   * des 40 colonnes d'une fiche, et 500 fiches complètes n'ont rien à faire
   * dans le bundle client.
   */
  const meta: Record<string, ClientMeta> = {};
  const signes: Record<string, number> = {};
  for (const client of clients) {
    meta[client.id] = {
      statut: "dormant",
      enCours: 0,
      derniereActivite: client.created_at,
      projets: [],
      score: { total: 0, achats: 0, projets: 0, activite: 0, contact: 0 },
    };
    signes[client.id] = 0;
  }
  for (const fiche of fiches) {
    const clientId = fiche.client_id;
    const entry = clientId ? meta[clientId] : undefined;
    if (!entry || !clientId) continue;

    const horsFunnel = (STAGES_HORS_FUNNEL as readonly string[]).includes(
      fiche.stage,
    );
    if (!horsFunnel && fiche.stage !== "signe") {
      entry.enCours += 1;
      entry.statut = "actif";
    } else if (fiche.stage === "signe") {
      signes[clientId] += 1;
      if (entry.statut !== "actif") entry.statut = "signe";
    }
    if (fiche.updated_at > entry.derniereActivite) {
      entry.derniereActivite = fiche.updated_at;
    }
    entry.projets.push({
      id: fiche.id,
      reference: fiche.reference,
      stage: fiche.stage,
      budget: fiche.budget_estimatif,
      date: fiche.updated_at,
    });
  }
  // Le score se calcule ici : « depuis combien de jours » a besoin de l'heure
  // du serveur, et la lire dans le composant client ferait diverger le rendu
  // de l'hydratation.
  for (const client of clients) {
    const entry = meta[client.id];
    entry.projets.sort((a, b) => b.date.localeCompare(a.date));
    entry.score = scoreClient({
      caCumule: client.ca_cumule,
      projetsSignes: signes[client.id],
      projetsEnCours: entry.enCours,
      projetsTotal: entry.projets.length,
      joursDepuisActivite: daysSince(entry.derniereActivite),
      tel: !!client.tel,
      email: !!client.email,
      adresse: !!(client.adresse ?? client.ville),
    });
  }

  return (
    <>
      <PageHeader
        title={t("clients.title")}
        subtitle={t("clients.count", { count: clients.length })}
      />
      <ClientsWorkspace clients={clients} pdvs={pdvs} meta={meta} />
    </>
  );
}
