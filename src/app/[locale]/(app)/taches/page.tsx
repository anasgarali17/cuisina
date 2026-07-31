import { getCurrentProfile } from "@/lib/auth";
import { listFiches, listProfiles, listTaches } from "@/lib/data/queries";
import { TachesBoard } from "@/components/taches/taches-board";

export default async function TachesPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const [taches, fiches, profiles] = await Promise.all([
    listTaches(profile),
    listFiches(profile),
    listProfiles(),
  ]);

  const ficheMap = Object.fromEntries(
    fiches.map((f) => [
      f.id,
      { reference: f.reference, client: f.client_nom },
    ]),
  );

  return (
    <TachesBoard
      taches={taches}
      ficheMap={ficheMap}
      profiles={profiles}
      currentProfile={profile}
    />
  );
}
