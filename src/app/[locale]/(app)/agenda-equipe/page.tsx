import { getCurrentProfile } from "@/lib/auth";
import {
  listFiches,
  listPdvsVisibles,
  listProfiles,
  listRdv,
  listTaches,
} from "@/lib/data/queries";
import { AgendaView } from "@/components/agenda/agenda-view";

export default async function AgendaEquipePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [rdv, taches, fiches, profiles, pdvs] = await Promise.all([
    listRdv(profile),
    listTaches(profile),
    listFiches(profile),
    listProfiles(),
    listPdvsVisibles(profile),
  ]);

  return (
    <AgendaView
      variant="equipe"
      rdv={rdv}
      taches={taches}
      profiles={profiles}
      pdvs={pdvs}
      fiches={fiches.map((f) => ({
        id: f.id,
        reference: f.reference,
        client: f.client_nom,
      }))}
      currentProfile={profile}
    />
  );
}
