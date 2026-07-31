import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  listFiches,
  listHistoriqueSince,
  listPdvs,
  listProfiles,
} from "@/lib/data/queries";
import { formatDT, initials } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ObjectifDialog } from "@/components/equipe/objectif-dialog";

export default async function EquipePage() {
  const [t, profile] = await Promise.all([
    getTranslations(),
    getCurrentProfile(),
  ]);
  if (!profile) return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [pdvs, profiles, fiches, historique] = await Promise.all([
    listPdvs(),
    listProfiles(),
    listFiches(profile),
    listHistoriqueSince(profile, monthStart.toISOString()),
  ]);

  const ficheById = new Map(fiches.map((f) => [f.id, f]));
  const signedThisMonth = historique.filter((h) => h.stage_to === "signe");

  const caByPdv = new Map<string, number>();
  for (const h of signedThisMonth) {
    const fiche = ficheById.get(h.fiche_id);
    if (!fiche) continue;
    caByPdv.set(
      fiche.point_de_vente_id,
      (caByPdv.get(fiche.point_de_vente_id) ?? 0) +
        (fiche.budget_estimatif ?? 0),
    );
  }

  const activesByPdv = new Map<string, number>();
  for (const f of fiches) {
    if (f.stage === "signe" || f.stage === "perdu") continue;
    activesByPdv.set(
      f.point_de_vente_id,
      (activesByPdv.get(f.point_de_vente_id) ?? 0) + 1,
    );
  }

  const isAdmin = profile.role === "admin";

  return (
    <>
      <PageHeader title={t("equipe.title")} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pdvs.map((pdv) => {
          const team = profiles.filter((p) => p.point_de_vente_id === pdv.id);
          return (
            <Card key={pdv.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold">
                    {pdv.nom}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {pdv.ville}
                    {pdv.telephone && (
                      <>
                        {" · "}
                        <span className="font-mono">{pdv.telephone}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-secondary/60 p-3">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("equipe.fichesActives")}
                  </dt>
                  <dd className="kpi-number text-2xl">
                    {activesByPdv.get(pdv.id) ?? 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("equipe.caMois")}
                  </dt>
                  <dd className="kpi-number text-2xl">
                    {formatDT(caByPdv.get(pdv.id) ?? 0)}
                  </dd>
                </div>
              </dl>

              <p className="mt-4 text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("equipe.conseillers", { count: team.length })}
              </p>
              <ul className="mt-2 space-y-2.5">
                {team.map((member) => (
                  <li key={member.id} className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback>
                        {initials(member.nom, member.prenom)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {member.prenom} {member.nom}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(`equipe.roles.${member.role}`)}
                      </p>
                    </div>
                    {member.role === "conseiller" && (
                      <div className="flex items-center gap-1 text-end">
                        <div>
                          <p className="text-[9px] uppercase text-muted-foreground">
                            {t("equipe.objectifMensuel")}
                          </p>
                          <p className="font-mono text-xs">
                            {formatDT(member.objectif_mensuel)}
                          </p>
                        </div>
                        {isAdmin && (
                          <ObjectifDialog
                            profileId={member.id}
                            name={`${member.prenom} ${member.nom}`}
                            current={member.objectif_mensuel}
                          />
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}
