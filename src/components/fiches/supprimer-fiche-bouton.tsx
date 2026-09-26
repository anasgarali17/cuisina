"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { supprimerFiche } from "@/lib/actions/fiche-actions";
import { messageErreur } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Supprimer la fiche, définitivement.
 *
 * La suppression emporte l'historique, les relances, les rendez-vous, les
 * photos et les tâches de la fiche. Elle passe donc par une confirmation qui
 * nomme le client et dit ce qui part : sur un téléphone tenu d'une main au
 * milieu d'un showroom, une corbeille se touche par accident, et rien ne
 * permettrait de revenir en arrière.
 */
export function SupprimerFicheBouton({
  ficheId,
  clientNom,
  reference,
}: {
  ficheId: string;
  clientNom: string;
  reference: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function supprimer() {
    setEnCours(true);
    setErreur(null);
    const result = await supprimerFiche({ id: ficheId });
    if (!result.ok) {
      setEnCours(false);
      setErreur(messageErreur(t, result.error));
      return;
    }
    // `replace` et non `push` : revenir en arrière rouvrirait une fiche qui
    // n'existe plus, sur un 404 qu'on n'a pas provoqué.
    router.replace("/fiches");
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-rouge hover:bg-rouge/10 hover:text-rouge"
        onClick={() => setOuvert(true)}
      >
        <Trash2 aria-hidden />
        {t("app.delete")}
      </Button>

      <Dialog open={ouvert} onOpenChange={(v) => !enCours && setOuvert(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("fiches.supprimer.titre")}</DialogTitle>
            <DialogDescription>
              {t("fiches.supprimer.confirmation", {
                client: clientNom,
                reference,
              })}
            </DialogDescription>
          </DialogHeader>

          {/* Ce que la suppression emporte, écrit avant le clic et non
              après : c'est la seule information qui peut encore l'arrêter. */}
          <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
            <li>{t("fiches.supprimer.perteHistorique")}</li>
            <li>{t("fiches.supprimer.pertePhotos")}</li>
            <li>{t("fiches.supprimer.perteRdv")}</li>
          </ul>
          <p className="mt-3 text-sm font-medium text-rouge">
            {t("fiches.supprimer.irreversible")}
          </p>

          {erreur && (
            <p role="alert" className="mt-3 text-sm font-medium text-rouge">
              {erreur}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={enCours}
              onClick={() => setOuvert(false)}
            >
              {t("app.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={enCours}
              onClick={supprimer}
            >
              {enCours && <Loader2 aria-hidden className="animate-spin" />}
              {enCours
                ? t("fiches.supprimer.enCours")
                : t("fiches.supprimer.confirmer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
