import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentProfile } from "@/lib/auth";
import {
  listFiches,
  listLiens,
  listPdvsVisibles,
  listProfiles,
  listSubmissions,
} from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { qrMatrix } from "@/lib/qr";
import { PageHeader } from "@/components/shell/page-header";
import { FichesWorkspace } from "@/components/fiches/fiches-workspace";
import type { LienView } from "@/components/fiches/liens-panel";
import { buttonVariants } from "@/components/ui/button";

/** L'origine réelle de la requête : le QR code doit pointer vers ce domaine. */
async function currentOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function FichesPage() {
  const [t, profile] = await Promise.all([
    getTranslations(),
    getCurrentProfile(),
  ]);
  if (!profile) return null;

  const [fiches, profiles, pdvs, submissions, liensRows, origin] =
    await Promise.all([
      listFiches(profile),
      listProfiles(),
      listPdvsVisibles(profile),
      listSubmissions(),
      listLiens(),
      currentOrigin(),
    ]);

  const conseillers = Object.fromEntries(
    profiles.map((p) => [p.id, `${p.prenom} ${p.nom}`]),
  );
  const conseillerOptions = profiles.map((p) => ({
    id: p.id,
    name: `${p.prenom} ${p.nom}`,
  }));

  /**
   * Les photos déposées par le client, signées pour une heure.
   *
   * Le bucket est privé : un chemin ne s'ouvre pas tout seul. Le client
   * envoyait donc ses photos depuis la foire, elles arrivaient bien en base,
   * et personne ne pouvait les voir — le conseiller rappelait pour demander
   * ce qui était déjà là.
   *
   * Tout est signé en une fois plutôt qu'une requête par demande : la pile
   * en compte plusieurs dizaines, et chaque signature est un aller-retour.
   */
  const photosDemandes: Record<string, string[]> = {};
  if (supabaseConfigured()) {
    const chemins = submissions.flatMap((s) => s.photos ?? []);
    if (chemins.length > 0) {
      const supabase = await createClient();
      const { data } = await supabase.storage
        .from("demandes-photos")
        .createSignedUrls(chemins, 3600);
      const parChemin = new Map<string, string>();
      for (const entree of data ?? []) {
        // `path` est rendu tel qu'il a été demandé : on s'y fie plutôt qu'à
        // l'ordre, qu'une erreur partielle suffirait à décaler.
        if (entree?.path && entree.signedUrl) {
          parChemin.set(entree.path, entree.signedUrl);
        }
      }
      for (const s of submissions) {
        const urls = (s.photos ?? [])
          .map((p) => parChemin.get(p))
          .filter((u): u is string => Boolean(u));
        if (urls.length > 0) photosDemandes[s.id] = urls;
      }
    }
  }

  // La matrice est calculée ici : l'encodeur QR reste hors du bundle client,
  // qui ne reçoit que les modules — un millier de caractères par lien.
  const liens: LienView[] = liensRows.map((lien) => {
    const url = `${origin}/f/${lien.token}`;
    return { ...lien, url, qr: qrMatrix(url) };
  });

  return (
    <>
      <PageHeader
        title={t("fiches.title")}
        actions={
          <Link
            href="/fiches/nouvelle"
            className={`${buttonVariants({ variant: "secondary" })}`}
          >
            <Plus className="size-4" />
            {t("fiches.new")}
          </Link>
        }
      />
      <FichesWorkspace
        fiches={fiches}
        conseillers={conseillers}
        pdvs={pdvs}
        submissions={submissions}
        photosDemandes={photosDemandes}
        conseillerOptions={conseillerOptions}
        liens={liens}
      />
    </>
  );
}
