"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Ruler } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  annulerDemandeMetrage,
  demanderMetrage,
} from "@/lib/actions/fiche-actions";
import { formatDate } from "@/lib/dates";
import { messageErreur } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * La demande de métrage, sur la fiche ouverte.
 *
 * Deux états seulement : demandé, ou pas. Tant qu'aucune demande n'est en
 * cours, un bouton ; une fois posée, la date et l'auteur, avec de quoi
 * revenir en arrière — une demande faite sur la mauvaise fiche doit pouvoir
 * s'annuler sans passer par la base.
 */
export function MetragePanel({
  ficheId,
  demandeLe,
  demandeParNom,
}: {
  ficheId: string;
  demandeLe: string | null;
  /** Null quand l'auteur n'est plus dans l'équipe : la date suffit. */
  demandeParNom: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function lancer(action: typeof demanderMetrage) {
    setMessage(null);
    startTransition(async () => {
      const result = await action({ fiche_id: ficheId });
      if (result.ok) router.refresh();
      else setMessage(messageErreur(t, result.error));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ruler aria-hidden className="size-4 text-chene" />
          {t("fiches.metrage.titre")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {demandeLe ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-vert-plan/40 bg-vert-plan/5 p-3">
              <p className="text-sm font-medium text-vert-plan">
                {t("fiches.metrage.enAttente")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("fiches.metrage.demandeLe", {
                  date: formatDate(demandeLe, "d MMM yyyy", locale),
                })}
                {demandeParNom ? ` · ${demandeParNom}` : ""}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={pending}
              onClick={() => lancer(annulerDemandeMetrage)}
            >
              {t("fiches.metrage.annuler")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("fiches.metrage.aide")}
            </p>
            <Button
              className="w-full"
              disabled={pending}
              onClick={() => lancer(demanderMetrage)}
            >
              <Ruler className="size-4" />
              {t("fiches.metrage.demander")}
            </Button>
          </div>
        )}
        {message && (
          <p role="alert" className="mt-2 text-xs font-medium text-rouge">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
