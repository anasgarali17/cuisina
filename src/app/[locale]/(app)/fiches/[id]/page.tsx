import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/auth";
import { getFicheDetail, listPdvs, listProfiles } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { formatDate } from "@/lib/dates";
import { CroquisPad } from "@/components/fiches/croquis-pad";
import { DetailTabs } from "@/components/fiches/detail-tabs";
import { FicheActionsBar } from "@/components/fiches/fiche-actions-bar";
import { FichePaper } from "@/components/fiches/fiche-paper";
import { PiecesJointesPanel } from "@/components/fiches/pieces-jointes-panel";
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
   * Les liens de téléchargement des pièces jointes.
   *
   * Le bucket est privé : un chemin ne s'ouvre pas tout seul. On signe au
   * serveur, pour une heure — assez pour consulter un plan pendant un
   * rendez-vous, trop peu pour qu'une URL copiée circule ensuite.
   */
  const liensPieces: Record<string, string> = {};
  if (supabaseConfigured()) {
    const supabase = await createClient();

    if (fiche.photo_fiche_url) {
      const { data } = await supabase.storage
        .from("fiches")
        .createSignedUrl(fiche.photo_fiche_url, 3600);
      photoUrl = data?.signedUrl ?? null;
    }

    if (pieces.length > 0) {
      const { data } = await supabase.storage
        .from("fiches-pieces")
        .createSignedUrls(
          pieces.map((p) => p.chemin),
          3600,
        );
      // `createSignedUrls` rend les résultats dans l'ordre demandé, et met
      // `signedUrl` à null pour un objet absent — un fichier effacé du bucket
      // ne doit pas priver les autres de leur lien.
      (data ?? []).forEach((entree, i) => {
        const piece = pieces[i];
        if (piece && entree?.signedUrl) liensPieces[piece.id] = entree.signedUrl;
      });
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <div className="no-print mb-4 flex flex-wrap items-center justify-end gap-2">
          <FicheActionsBar
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
        {/* Les pièces jointes en haut de colonne : un plan reçu après la
            saisie est ce qu'on vient chercher le plus souvent sur cet écran. */}
        <PiecesJointesPanel
          ficheId={fiche.id}
          pieces={pieces}
          liens={liensPieces}
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
