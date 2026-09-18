import { headers } from "next/headers";
import { profilAvecEspacePersonnel } from "@/lib/garde";
import { AccesRefuse } from "@/components/shell/acces-refuse";
import { listEvenementsPersonnels, listTaches } from "@/lib/data/queries";
import { qrMatrix } from "@/lib/qr";
import { EspacePerso } from "@/components/mon-espace/espace-perso";

/**
 * L'espace personnel — la page d'une seule personne.
 *
 * Le garde ne regarde pas le rôle mais l'identité : deux administrateurs ont
 * les mêmes droits partout ailleurs, et un seul entre ici. Les événements,
 * eux, sont bornés par la RLS de `evenements_personnels`, qui ne laisse voir à
 * personne — pas même à l'administrateur — les lignes d'un autre.
 */
export default async function MonEspacePage() {
  const profile = await profilAvecEspacePersonnel();
  if (!profile) return <AccesRefuse />;

  const [evenements, taches, entetes] = await Promise.all([
    listEvenementsPersonnels(),
    listTaches(profile),
    headers(),
  ]);

  // L'adresse telle que le navigateur l'a demandée : le QR se scanne depuis
  // l'écran où la page est ouverte, et un domaine codé en dur enverrait le
  // téléphone sur la production depuis un poste de développement.
  const host =
    entetes.get("x-forwarded-host") ?? entetes.get("host") ?? "localhost:3000";
  const proto =
    entetes.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const urlAgenda = `${proto}://${host}/mon-espace`;

  return (
    <EspacePerso
      profile={profile}
      evenements={evenements}
      // Ses tâches à lui : `listTaches` rend le périmètre du profil, on garde
      // ce qui lui est assigné. Un espace personnel ne montre pas le travail
      // des autres.
      taches={taches.filter((tache) => tache.assigne_a === profile.id)}
      urlAgenda={urlAgenda}
      qr={qrMatrix(urlAgenda)}
    />
  );
}
