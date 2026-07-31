import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/auth";
import { getFicheDetail, listPdvs, listProfiles } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { formatDate } from "@/lib/dates";
import { FichePaper } from "@/components/fiches/fiche-paper";
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

  const { fiche, historique, relances } = detail;

  const [profiles, pdvs] = await Promise.all([listProfiles(), listPdvs()]);
  const names = Object.fromEntries(
    profiles.map((p) => [p.id, `${p.prenom} ${p.nom}`]),
  );
  const pdvName =
    pdvs.find((p) => p.id === fiche.point_de_vente_id)?.nom ?? "—";

  let photoUrl: string | null = null;
  if (fiche.photo_fiche_url && supabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from("fiches")
      .createSignedUrl(fiche.photo_fiche_url, 3600);
    photoUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <div className="no-print mb-4 flex justify-end">
          <ExportPdfButton
            fiche={fiche}
            conseillerName={names[fiche.conseiller_id] ?? "—"}
            pdvName={pdvName}
          />
        </div>
        <FichePaper
          fiche={fiche}
          conseillerName={names[fiche.conseiller_id] ?? "—"}
          pdvName={pdvName}
        />
      </div>

      <div className="no-print space-y-4">
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

        <SuiviPanel fiche={fiche} relances={relances} />

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
                        {formatDate(h.created_at, "d MMM yyyy · HH:mm", locale)}{" "}
                        · {names[h.user_id] ?? "—"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
