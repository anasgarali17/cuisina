"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Download, FileText, Loader2, Paperclip, X } from "lucide-react";
import {
  enregistrerPieceJointe,
  supprimerPieceJointe,
} from "@/lib/actions/fiche-actions";
import { createClient } from "@/lib/supabase/client";
import type { FichePieceJointeRow } from "@/lib/database.types";
import { messageErreur } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** 10 Mo : au-delà, c'est un envoi qui échoue sur une connexion de showroom. */
const TAILLE_MAX = 10 * 1024 * 1024;

function tailleLisible(octets: number | null): string {
  if (octets == null) return "";
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Les pièces jointes d'une fiche déjà enregistrée.
 *
 * L'assistant de saisie n'accepte des documents qu'avant le premier
 * enregistrement — après, il n'y avait plus d'endroit où les déposer. Or un
 * plan arrive rarement le jour du premier contact : il arrive trois jours
 * plus tard, par WhatsApp, et le conseiller n'avait que la corbeille pour le
 * ranger.
 *
 * Le fichier monte directement au bucket depuis le navigateur : le faire
 * transiter par une Server Action ferait exploser la taille du payload. La
 * ligne qui lui donne un nom, elle, passe par le serveur.
 */
export function PiecesJointesPanel({
  ficheId,
  pieces,
  liens,
}: {
  ficheId: string;
  pieces: FichePieceJointeRow[];
  /** URLs signées, calculées au serveur — voir la page de détail. */
  liens: Record<string, string>;
}) {
  const t = useTranslations();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [suppression, demarrerSuppression] = useTransition();

  async function ajouter(liste: FileList | null) {
    if (!liste?.length) return;
    const trop = [...liste].find((f) => f.size > TAILLE_MAX);
    if (trop) {
      setErreur(t("fiches.pieces.tropGros", { nom: trop.name }));
      return;
    }
    setErreur(null);
    setEnCours(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setErreur(messageErreur(t, "unauthenticated"));
        return;
      }
      /*
       * Les fichiers montent ensemble.
       *
       * En série, déposer les cinq photos d'un chantier faisait attendre la
       * somme des cinq envois alors qu'ils ne dépendent pas les uns des
       * autres. Un échec reste isolé : il se dit, et n'emporte pas les
       * autres — c'est déjà ce que faisait la boucle, en plus lent.
       */
      const horodatage = Date.now();
      const echecs = await Promise.all(
        [...liste].map(async (fichier, i) => {
          // Le dossier porte l'uid : c'est ce que la policy du bucket vérifie.
          // L'index départage deux fichiers homonymes envoyés dans la même
          // milliseconde, que `Date.now()` seul aurait fait se recouvrir.
          const chemin = `${user.id}/${ficheId}/${horodatage}-${i}-${fichier.name}`;
          const { error } = await supabase.storage
            .from("fiches-pieces")
            .upload(chemin, fichier, { upsert: false });
          if (error) {
            return t("fiches.pieces.echecEnvoi", { nom: fichier.name });
          }
          const result = await enregistrerPieceJointe({
            fiche_id: ficheId,
            chemin,
            nom_fichier: fichier.name,
            type_mime: fichier.type || null,
            taille_octets: fichier.size,
          });
          return result.ok ? null : messageErreur(t, result.error);
        }),
      );
      const premierEchec = echecs.find((e) => e !== null);
      if (premierEchec) setErreur(premierEchec);
      router.refresh();
    } finally {
      setEnCours(false);
    }
  }

  function retirer(id: string) {
    demarrerSuppression(async () => {
      const result = await supprimerPieceJointe({ id, fiche_id: ficheId });
      if (!result.ok) {
        setErreur(messageErreur(t, result.error));
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-1.5">
          <Paperclip aria-hidden className="size-4" />
          {t("fiches.pieces.titre")}
        </CardTitle>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={enCours}
          onClick={() => inputRef.current?.click()}
        >
          {enCours && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
          {enCours ? t("fiches.pieces.envoi") : t("fiches.pieces.ajouter")}
        </Button>
      </CardHeader>

      <CardContent className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          onChange={(e) => {
            void ajouter(e.target.files);
            // Remis à zéro : sinon re-sélectionner le même fichier ne
            // déclenche aucun change.
            e.target.value = "";
          }}
        />

        {erreur && (
          <p role="alert" className="text-xs font-medium text-rouge">
            {erreur}
          </p>
        )}

        {pieces.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
            {t("fiches.pieces.vide")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {pieces.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm"
              >
                <FileText
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 truncate">{p.nom_fichier}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {tailleLisible(p.taille_octets)}
                </span>
                {/* Le lien signé expire : s'il manque, on n'affiche pas un
                    bouton qui mènerait à une erreur du bucket. */}
                {liens[p.id] && (
                  <a
                    href={liens[p.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("fiches.pieces.ouvrir", { nom: p.nom_fichier })}
                    className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <Download className="size-4" />
                  </a>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="iconSm"
                  disabled={suppression}
                  aria-label={t("fiches.pieces.retirer", {
                    nom: p.nom_fichier,
                  })}
                  onClick={() => retirer(p.id)}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
