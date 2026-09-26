"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Camera, ImageOff, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import {
  enregistrerPieceJointe,
  supprimerPhotoClient,
  supprimerPieceJointe,
} from "@/lib/actions/fiche-actions";
import { createClient } from "@/lib/supabase/client";
import { messageErreur } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** 8 Mo la photo — au-delà, l'envoi échoue sur une 4G de chantier. */
const TAILLE_MAX = 8 * 1024 * 1024;

export interface PhotoVue {
  /** Identifiant de la ligne (équipe) ou chemin du bucket (client). */
  cle: string;
  url: string;
  nom: string;
  /** Vrai pour une photo déposée par le client depuis le formulaire. */
  duClient: boolean;
}

/**
 * Les photos de la fiche, des deux côtés.
 *
 * Celles que le client a envoyées avec sa demande — elles arrivaient en base
 * et n'étaient affichées nulle part — et celles que le conseiller prend au
 * rendez-vous : l'existant, le chantier, un plan griffonné sur un coin de
 * table. Les deux vivent dans des buckets différents et se suppriment donc
 * par deux chemins, mais pour qui regarde la fiche c'est le même mur
 * d'images.
 *
 * L'envoi se fait du navigateur au bucket, directement : faire transiter une
 * photo de 8 Mo par une Server Action ferait exploser la taille du payload.
 */
export function PhotosPanel({
  ficheId,
  photos,
}: {
  ficheId: string;
  photos: PhotoVue[];
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
      setErreur(t("fiches.photos.tropGrosse", { nom: trop.name }));
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
      // Ensemble plutôt qu'à la file : trois photos de chantier feraient
      // attendre la somme des trois envois pour rien.
      const horodatage = Date.now();
      const echecs = await Promise.all(
        [...liste].map(async (fichier, i) => {
          // Le dossier porte l'uid : c'est ce que la policy du bucket vérifie.
          const chemin = `${user.id}/${ficheId}/${horodatage}-${i}-${fichier.name}`;
          const { error } = await supabase.storage
            .from("fiches-pieces")
            .upload(chemin, fichier, { upsert: false });
          if (error) return t("fiches.photos.echecEnvoi", { nom: fichier.name });
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
      const premier = echecs.find((e) => e !== null);
      if (premier) setErreur(premier);
      router.refresh();
    } finally {
      setEnCours(false);
    }
  }

  function retirer(photo: PhotoVue) {
    demarrerSuppression(async () => {
      const result = photo.duClient
        ? await supprimerPhotoClient({ fiche_id: ficheId, chemin: photo.cle })
        : await supprimerPieceJointe({ id: photo.cle, fiche_id: ficheId });
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
          <Camera aria-hidden className="size-4" />
          {t("fiches.photos.titre")}
        </CardTitle>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={enCours}
          onClick={() => inputRef.current?.click()}
        >
          {enCours && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
          {enCours ? t("fiches.photos.envoi") : t("fiches.photos.ajouter")}
        </Button>
      </CardHeader>

      <CardContent className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            void ajouter(e.target.files);
            // Remis à zéro : sinon re-choisir la même photo ne déclenche rien.
            e.target.value = "";
          }}
        />

        {erreur && (
          <p role="alert" className="text-xs font-medium text-rouge">
            {erreur}
          </p>
        )}

        {photos.length === 0 ? (
          <p className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            <ImageOff aria-hidden className="size-5" strokeWidth={1.5} />
            {t("fiches.photos.vide")}
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <li key={photo.cle} className="group relative">
                <a
                  href={photo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.nom}
                    className="h-24 w-full object-cover transition-opacity group-hover:opacity-75"
                  />
                </a>
                {/* La provenance compte : une photo du client se supprime
                    aussi, mais on doit savoir qu'on efface ce qu'il a
                    envoyé. */}
                {photo.duClient && (
                  <span className="pointer-events-none absolute start-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {t("fiches.photos.duClient")}
                  </span>
                )}
                <button
                  type="button"
                  disabled={suppression}
                  aria-label={t("fiches.photos.retirer", { nom: photo.nom })}
                  onClick={() => retirer(photo)}
                  className="absolute end-1 top-1 grid size-7 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-rouge focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
