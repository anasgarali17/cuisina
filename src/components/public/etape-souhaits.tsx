"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ImagePlus, PenLine, X } from "lucide-react";
import { FACADES } from "@/lib/catalogue";
import { ChoixModele } from "@/components/catalogue/choix-modele";
import type { TypeProjet } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { CroquisClient } from "./croquis-client";

export interface Souhaits {
  modele: string | null;
  facade: string | null;
  couleurs: string[];
  croquis: string | null;
  /** Fichiers encore locaux : ils ne montent qu'à l'envoi du formulaire. */
  photos: File[];
  commentaire: string;
}

export const SOUHAITS_VIDES: Souhaits = {
  modele: null,
  facade: null,
  couleurs: [],
  croquis: null,
  photos: [],
  commentaire: "",
};

/** 6 photos, 8 Mo pièce — au-delà, l'envoi échoue sur une 4G de chantier. */
const PHOTOS_MAX = 6;
const TAILLE_MAX = 8 * 1024 * 1024;

/**
 * Ce que le client veut, en images.
 *
 * On ne lui demande pas de vocabulaire : il désigne des photos. Un modèle,
 * une façade, deux ou trois coloris, un croquis s'il en a un en tête, et des
 * photos de sa cuisine actuelle. Rien n'est obligatoire — c'est ce qui fait
 * qu'il répond.
 *
 * Les visuels du catalogue ne sont pas encore livrés : chaque vignette se
 * rabat proprement sur son nom, et les coloris sur une pastille de teinte
 * approchée. Le parcours fonctionne, il embellira tout seul.
 */
export function EtapeSouhaits({
  typeProjet,
  souhaits,
  onChange,
  visuels,
}: {
  typeProjet: TypeProjet;
  souhaits: Souhaits;
  onChange: (s: Souhaits) => void;
  /** Chemins des visuels réellement présents sur le disque. */
  visuels: ReadonlySet<string>;
}) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [refus, setRefus] = useState<string | null>(null);
  /** Le croquis reste replie tant que le client ne le demande pas. */
  const [croquisOuvert, setCroquisOuvert] = useState(souhaits.croquis != null);

  const set = (patch: Partial<Souhaits>) => onChange({ ...souhaits, ...patch });

  function ajouterPhotos(liste: FileList | null) {
    if (!liste?.length) return;
    const trop = [...liste].find((f) => f.size > TAILLE_MAX);
    if (trop) {
      setRefus(t("public.souhaits.photoTropGrosse", { nom: trop.name }));
      return;
    }
    setRefus(null);
    set({ photos: [...souhaits.photos, ...liste].slice(0, PHOTOS_MAX) });
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        {t("public.souhaits.intro")}
      </p>

      {/* — Modèle et coloris, selon ce qui a été choisi à l'étape 1 : sept
            cuisines ou trois dressings. Même composant que la fiche interne,
            pour que le conseiller et le client parlent des mêmes gammes. — */}
      <Section
        titre={t(`public.souhaits.modele_${typeProjet}`)}
        aide={t(`public.souhaits.modeleAide_${typeProjet}`)}
      >
        <ChoixModele
          typeProjet={typeProjet}
          modele={souhaits.modele}
          couleurs={souhaits.couleurs}
          visuels={visuels}
          onChange={(patch) => set(patch)}
        />
      </Section>

      {/* — Façade : des cuisines réalisées, pas du vocabulaire — */}
      <Section
        titre={t("public.souhaits.facade")}
        aide={t("public.souhaits.facadeAide")}
      >
        <Grille>
          {FACADES.map((f) => (
            <Vignette
              key={f.id}
              image={visuels.has(f.image) ? f.image : null}
              libelle={t(`public.souhaits.facades.${f.id}`)}
              choisi={souhaits.facade === f.id}
              onClick={() =>
                set({ facade: souhaits.facade === f.id ? null : f.id })
              }
            />
          ))}
        </Grille>
      </Section>

      {/* — Le croquis, replié derrière un bouton.
            La plupart des clients ne dessinent pas ; leur imposer une grande
            zone blanche allonge la page pour rien. Elle s'ouvre pour ceux qui
            en veulent une, et se referme en effaçant — sans quoi on garderait
            un trait fait par erreur. — */}
      <Section titre={t("public.souhaits.croquis")}>
        {croquisOuvert ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("public.souhaits.croquisAide")}
            </p>
            <CroquisClient
              value={souhaits.croquis}
              onChange={(v) => set({ croquis: v })}
            />
            <button
              type="button"
              onClick={() => {
                setCroquisOuvert(false);
                set({ croquis: null });
              }}
              className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {t("public.souhaits.croquisFermer")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCroquisOuvert(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            <PenLine aria-hidden className="size-4" />
            {t("public.souhaits.croquisOuvrir")}
          </button>
        )}
      </Section>

      {/* — Photos : l'existant, ou des images d'inspiration — */}
      <Section
        titre={t("public.souhaits.photos")}
        aide={t("public.souhaits.photosAide")}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            ajouterPhotos(e.target.files);
            e.target.value = "";
          }}
        />

        {refus && (
          <p role="alert" className="mb-2 text-xs font-medium text-rouge">
            {refus}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {souhaits.photos.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="relative overflow-hidden rounded-xl border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(f)}
                alt={f.name}
                className="h-20 w-full object-cover"
              />
              <button
                type="button"
                aria-label={t("app.delete")}
                onClick={() =>
                  set({ photos: souhaits.photos.filter((_, j) => j !== i) })
                }
                className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}

          {souhaits.photos.length < PHOTOS_MAX && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="grid h-20 place-items-center rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:bg-secondary/60"
            >
              <ImagePlus aria-hidden className="size-5" />
            </button>
          )}
        </div>
      </Section>

    </div>
  );
}

function Section({
  titre,
  aide,
  children,
}: {
  titre: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold">{titre}</h2>
      {aide && <p className="mb-3 mt-0.5 text-sm text-muted-foreground">{aide}</p>}
      <div className={cn(!aide && "mt-3")}>{children}</div>
    </section>
  );
}

function Grille({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>;
}

/**
 * Une option en image.
 *
 * Le visuel n'est pas encore livré pour toutes les entrées du catalogue. Une
 * balise `<img>` laissée en place afficherait l'icône de fichier cassé du
 * navigateur, ce qui donne l'impression que le site est en panne. On la
 * retire donc de l'arbre dès l'échec, et la vignette se replie sur une
 * surface neutre : le nom, lui, suffit à choisir.
 *
 * Pas de `loading="lazy"` : ces vignettes sont peu nombreuses, et le chargement
 * différé retarde aussi l'erreur — donc le repli.
 */
function Vignette({
  image,
  libelle,
  choisi,
  onClick,
}: {
  /** Null = visuel pas encore livré : la vignette se replie sur son nom. */
  image: string | null;
  libelle: string;
  choisi: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={choisi}
      className={cn(
        "overflow-hidden rounded-2xl border text-start transition-colors",
        choisi
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-foreground/30",
      )}
    >
      <span className="relative block h-24 w-full bg-secondary sm:h-28">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="size-full object-cover" />
        )}
        {choisi && (
          <span className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check aria-hidden className="size-3.5" />
          </span>
        )}
      </span>
      <span className="block px-3 py-2 text-sm font-medium">{libelle}</span>
    </button>
  );
}

