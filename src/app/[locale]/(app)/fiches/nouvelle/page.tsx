import { getCurrentProfile } from "@/lib/auth";
import { listPdvs } from "@/lib/data/queries";
import { FicheWizard } from "@/components/fiches/fiche-wizard";

export default async function NouvelleFichePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const pdvs = await listPdvs();
  const pdv = pdvs.find((p) => p.id === profile.point_de_vente_id) ?? null;

  return (
    <FicheWizard
      conseillerName={`${profile.prenom} ${profile.nom}`}
      pdvName={pdv?.nom ?? "—"}
    />
  );
}
