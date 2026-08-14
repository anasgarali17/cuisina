import { profilAutorise } from "@/lib/garde";
import { ENCADREMENT } from "@/components/shell/nav-config";
import { AccesRefuse } from "@/components/shell/acces-refuse";
import { SequencesScreen } from "@/components/sequences/sequences-screen";

/** Même écran que /messages — les textes n'existent que pour être envoyés. */
export default async function Page() {
  if (!(await profilAutorise(ENCADREMENT))) return <AccesRefuse />;
  return <SequencesScreen ongletInitial="textes" />;
}
