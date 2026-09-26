import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/auth";
import { getFicheDetail, listPdvs, listProfiles } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { formatDate } from "@/lib/dates";
import { CroquisPad } from "@/components/fiches/croquis-pad";
import { DetailTabs } from "@/components/fiches/detail-tabs";
import { MetragePanel } from "@/components/fiches/metrage-panel";
import { FichePaper } from "@/components/fiches/fiche-paper";
import { PhotosPanel, type PhotoVue } from "@/components/fiches/photos-panel";
import { SupprimerFicheBouton } from "@/components/fiches/supprimer-fiche-bouton";
import { SuiviPanel } from "@/components/fiches/suivi-panel";
import { ExportPdfButton } from "@/components/fiches/export-pdf-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function FicheDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const [t, profile, detail] = await Promise.all([
    getTranslations(),
    getCurrentProfile(),
    getFicheDetail(id),
  ]);
  if (!profile) return null;
  if (!detail) notFound();

  const { fiche, historique, relances, pieces } = detail;

  const [profiles, pdvs] = await Promise.all([listProfiles(), listPdvs()]);
  const names = Object.fromEntries(
    profiles.map((p) => [p.id, `${p.prenom} ${p.nom}`]),
  );
  const pdvName =
    pdvs.find((p) => p.id === fiche.point_de_vente_id)?.nom ?? "—";

  let photoUrl: string | null = null;
  /**
   * Les photos de la fiche, signées pour une heure.
   *
   * Deux sources, deux buckets : ce que le client a envoyé avec sa demande
   * (`demandes-photos`) et ce que l'équipe a ajouté depuis (`fiches-pieces`).
   * Les deux sont privés — un chemin ne s'ouvre pas tout seul — et elles
   * arrivent mélangées à l'écran, le client d'abord, puisque c'est ce qui
   * existait avant le rendez-vous.
   */
  const photos: PhotoVue[] = [];
  if (supabaseConfigured()) {
    const supabase = await createClient();

    if (fiche.photo_fiche_url) {
      const { data } = await supabase.storage
        .from("fiches")
        .createSignedUrl(fiche.photo_fiche_url, 3600);
      photoUrl = data?.signedUrl ?? null;
    }

    const cheminsClient = fiche.photos_client ?? [];
    // Seules les images : le panneau montre des vignettes, un PDF y
    // apparaîtrait comme un carré cassé.
    const piecesImages = pieces.filter((p) =>
      (p.type_mime ?? "").startsWith("image/"),
    );

    const [signeesClient, signeesEquipe] = await Promise.all([
      cheminsClient.length > 0
        ? supabase.storage
            .from("demandes-photos")
            .createSignedUrls(cheminsClient, 3600)
        : Promise.resolve({ data: [] }),
      piecesImages.length > 0
        ? supabase.storage
            .from("fiches-pieces")
            .createSignedUrls(
              piecesImages.map((p) => p.chemin),
              3600,
            )
        : Promise.resolve({ data: [] }),
    ]);

    const urlClient = new Map<string, string>();
    for (const e of signeesClient.data ?? []) {
      if (e?.path && e.signedUrl) urlClient.set(e.path, e.signedUrl);
    }
    for (const chemin of cheminsClient) {
      const url = urlClient.get(chemin);
      if (url) {
        photos.push({
          cle: chemin,
          url,
          nom: chemin.split("/").pop() ?? chemin,
          duClient: true,
        });
      }
    }

    const urlEquipe = new Map<string, string>();
    for (const e of signeesEquipe.data ?? []) {
      if (e?.path && e.signedUrl) urlEquipe.set(e.path, e.signedUrl);
    }
    for (const piece of piecesImages) {
      const url = urlEquipe.get(piece.chemin);
      if (url) {
        photos.push({
          cle: piece.id,
          url,
          nom: piece.nom_fichier,
          duClient: false,
        });
      }
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <div className="no-print mb-4 flex flex-wrap items-center justify-end gap-2">
          <SupprimerFicheBouton
            ficheId={fiche.id}
            clientNom={fiche.client_nom}
            reference={fiche.reference}
          />
          <ExportPdfButton
            fiche={fiche}
            conseillerName={names[fiche.conseiller_id] ?? "—"}
            pdvName={pdvName}
            relances={relances}
            signatureDate={
              historique.find((h) => h.stage_to === "signe")?.created_at ?? null
            }
          />
        </div>
        <FichePaper
          fiche={fiche}
          conseillerName={names[fiche.conseiller_id] ?? "—"}
          pdvName={pdvName}
          relances={relances}
          signatureDate={
            historique.find((h) => h.stage_to === "signe")?.created_at ?? null
          }
        />

        <div className="mt-4">
          <CroquisPad ficheId={fiche.id} initial={fiche.croquis} />
        </div>
      </div>

      <div className="no-print space-y-4">
        {/* Les photos en haut de colonne : ce que le client a envoyé est la
            première chose qu'on vient chercher avant un rendez-vous. */}
        <PhotosPanel ficheId={fiche.id} photos={photos} />

        <MetragePanel
          ficheId={fiche.id}
          demandeLe={fiche.metrage_demande_le}
          demandeParNom={
            fiche.metrage_demande_par
              ? (names[fiche.metrage_demande_par] ?? null)
              : null
          }
        />

        {photoUrl && (
          <Card>
            <CardHeader>
              <CardTitle>{t("fiches.detail.photoOriginal")}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt={t("fiches.detail.photoOriginal")}
                className="w-full rounded-2xl border border-border object-cover"
              />
            </CardContent>
          </Card>
        )}

        <DetailTabs
          suivi={<SuiviPanel fiche={fiche} relances={relances} />}
          historique={
            <Card>
              <CardHeader>
                <CardTitle>{t("fiches.detail.historique")}</CardTitle>
              </CardHeader>
              <CardContent>
                {historique.length === 0 ? (
                  <p className="text-sm text-muted-foreground">—</p>
                ) : (
                  <ol className="space-y-3">
                    {historique.map((h) => (
                      <li key={h.id} className="flex items-start gap-3 text-sm">
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-chene" />
                        <div>
                          <p className="font-medium">
                            {h.stage_from ? t(`stages.${h.stage_from}`) : "—"}
                            {" → "}
                            {t(`stages.${h.stage_to}`)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(
                              h.created_at,
                              "d MMM yyyy · HH:mm",
                              locale,
                            )}{" "}
                            · {names[h.user_id] ?? "—"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          }
        />
      </div>
    </div>
  );
}
