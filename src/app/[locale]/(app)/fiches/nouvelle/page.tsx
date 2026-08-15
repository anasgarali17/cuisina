import { getCurrentProfile } from "@/lib/auth";
import { listPdvs, listRdv } from "@/lib/data/queries";
import { visuelsDisponibles } from "@/lib/catalogue-server";
import { tzDay } from "@/lib/tz";
import { FicheWizard } from "@/components/fiches/fiche-wizard";
import type { CreneauOccupe } from "@/components/fiches/etape-rendez-vous";

export default async function NouvelleFichePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [pdvs, rdv] = await Promise.all([listPdvs(), listRdv(profile)]);
  const pdv = pdvs.find((p) => p.id === profile.point_de_vente_id) ?? null;

  /*
   * L'agenda du conseiller, reduit a ce que l'etape 3 doit savoir.
   *
   * Seulement les siens : le chevauchement qui compte est celui de la
   * personne qui prend le rendez-vous, pas celui du showroom entier — la RLS
   * rend a la direction les rendez-vous des neuf points de vente, et les lui
   * opposer bloquerait des creneaux parfaitement libres pour elle.
   *
   * Seulement a partir d'hier, aussi : on ne prend pas rendez-vous dans le
   * passe, et trois ans d'historique traverseraient le reseau pour rien.
   */
  const depuis = new Date();
  depuis.setDate(depuis.getDate() - 1);
  const occupes: CreneauOccupe[] = rdv
    .filter((r) => r.conseiller_id === profile.id && new Date(r.fin) >= depuis)
    .map((r) => ({
      id: r.id,
      titre: r.titre,
      debut: r.debut,
      fin: r.fin,
      type: r.type,
    }));

  return (
    <FicheWizard
      conseillerName={`${profile.prenom} ${profile.nom}`}
      pdvName={pdv?.nom ?? "—"}
      visuels={visuelsDisponibles()}
      occupes={occupes}
      // Le jour courant se calcule ici : `new Date()` dans un composant client
      // donne l'heure du serveur au premier rendu et celle du navigateur
      // ensuite, et React jette tout l'arbre a l'hydratation.
      aujourdHui={tzDay(new Date())}
      pdvs={
        profile.point_de_vente_id
          ? []
          : pdvs.map((p) => ({ id: p.id, nom: p.nom, ville: p.ville }))
      }
    />
  );
}
