import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { PointDeVenteRow, ProfileRow } from "@/lib/database.types";
import { formatDT, initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ObjectifDialog } from "@/components/equipe/objectif-dialog";

/**
 * La fiche d'un showroom : ses chiffres du mois et son équipe.
 *
 * Rendue côté serveur puis passée à la carte, qui n'en garde que celles de la
 * zone sélectionnée — le composant n'a donc pas à savoir qu'un filtre existe.
 */
export async function PdvCard({
  pdv,
  team,
  fichesActives,
  caMois,
  isAdmin,
}: {
  pdv: PointDeVenteRow;
  team: ProfileRow[];
  fichesActives: number;
  caMois: number;
  isAdmin: boolean;
}) {
  const t = await getTranslations();

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link
            href={`/equipe/${pdv.id}`}
            className="font-display text-lg font-semibold hover:underline"
          >
            {pdv.nom}
          </Link>
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
        <Link
          href={`/equipe/${pdv.id}`}
          className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          {t("equipe.voirDetail")}
        </Link>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-secondary/60 p-3">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("equipe.fichesActives")}
          </dt>
          <dd className="kpi-number text-2xl">{fichesActives}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("equipe.caMois")}
          </dt>
          <dd className="kpi-number text-2xl">{formatDT(caMois)}</dd>
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
}
