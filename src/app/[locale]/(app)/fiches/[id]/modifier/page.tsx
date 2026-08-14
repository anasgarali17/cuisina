import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getFicheDetail, listPdvs } from "@/lib/data/queries";
import { visuelsDisponibles } from "@/lib/catalogue-server";
import { FicheWizard } from "@/components/fiches/fiche-wizard";

/**
 * La reprise d'une fiche déjà enregistrée.
 *
 * Aucune garde de rôle ici : `getFicheDetail` passe par la RLS, qui ne rend
 * la fiche qu'à qui a le droit de la lire — et la même règle borne l'écriture.
 * Une fiche hors périmètre revient donc en `null`, et l'écran en 404, ce qui
 * est la bonne réponse : elle n'existe pas, pour cette personne.
 */
export default async function ModifierFichePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const [profile, detail] = await Promise.all([
    getCurrentProfile(),
    getFicheDetail(id),
  ]);
  if (!profile) return null;
  if (!detail) notFound();

  const pdvs = await listPdvs();
  const pdv = pdvs.find((p) => p.id === detail.fiche.point_de_vente_id) ?? null;

  return (
    <FicheWizard
      fiche={detail.fiche}
      conseillerName={`${profile.prenom} ${profile.nom}`}
      pdvName={pdv?.nom ?? "—"}
      visuels={visuelsDisponibles()}
      // Le showroom d'une fiche existante ne se rechoisit pas : elle est déjà
      // rattachée, et la déplacer changerait qui la voit.
      pdvs={[]}
    />
  );
}
