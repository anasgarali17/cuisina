"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { catalogueDe, couleursDuModele } from "@/lib/catalogue";
import type { TypeProjet } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { PastilleCouleur } from "./pastille-couleur";

/** Pastilles montrées sur la vignette d'un modèle avant de l'ouvrir. */
const APERCU_MAX = 6;

/**
 * Le choix du modèle de cuisine, et de ses coloris.
 *
 * Sert des deux côtés : le conseiller sur la fiche contact, le client sur le
 * formulaire public. Même catalogue, même vocabulaire — sans quoi la fiche
 * dirait « Roma » et la demande « laque brillante », et personne ne saurait
 * s'il s'agit de la même cuisine.
 *
 * Les coloris suivent le modèle : changer de modèle vide la sélection, parce
 * qu'un Fango n'existe pas sur une Lucca. C'est brutal mais honnête — laisser
 * une teinte impossible cochée coûterait un rendez-vous.
 */
export function ChoixModele({
  typeProjet,
  modele,
  couleurs,
  onChange,
  /** Chemins des photos réellement présentes — voir catalogue-server.ts. */
  visuels,
  compact = false,
}: {
  /** Cuisine ou dressing : commande le catalogue et donc les coloris. */
  typeProjet: TypeProjet;
  modele: string | null;
  couleurs: string[];
  onChange: (patch: { modele: string | null; couleurs: string[] }) => void;
  visuels: ReadonlySet<string>;
  /** Vignettes plus basses, pour la fiche interne où la place est comptée. */
  compact?: boolean;
}) {
  const t = useTranslations();
  const catalogue = catalogueDe(typeProjet);
  const palette = couleursDuModele(modele);

  function choisirModele(id: string) {
    const meme = modele === id;
    onChange({ modele: meme ? null : id, couleurs: [] });
  }

  function basculerCouleur(nom: string) {
    onChange({
      modele,
      couleurs: couleurs.includes(nom)
        ? couleurs.filter((c) => c !== nom)
        : [...couleurs, nom],
    });
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "grid gap-3",
          compact
            ? "grid-cols-2 sm:grid-cols-4"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
        )}
      >
        {catalogue.map((m) => {
          const choisi = modele === m.id;
          const photo = visuels.has(m.image) ? m.image : null;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => choisirModele(m.id)}
              aria-pressed={choisi}
              className={cn(
                "overflow-hidden rounded-2xl border text-start transition-colors",
                choisi
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-foreground/30",
              )}
            >
              <span
                className={cn(
                  "relative block w-full bg-secondary",
                  compact ? "h-20" : "h-24 sm:h-28",
                )}
              >
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt=""
                    className="size-full object-cover"
                  />
                )}
                {choisi && (
                  <span className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check aria-hidden className="size-3.5" />
                  </span>
                )}
              </span>
              <span className="block px-3 py-2">
                <span className="flex items-baseline justify-between gap-1">
                  <span className="text-sm font-semibold">{m.nom}</span>
                  {/* « 0 coloris » n'apprend rien : un Room n'a pas de façade
                      à teindre, on se tait plutôt que d'annoncer une absence. */}
                  {m.couleurs.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {t("catalogue.nbCouleurs", { count: m.couleurs.length })}
                    </span>
                  )}
                </span>
                {/* Un aperçu de la gamme, avant même d'ouvrir le modèle : on
                    choisit rarement une Parma sans savoir qu'elle va du blanc
                    à l'ébène. Six pastilles suffisent à le dire ; les autres
                    se comptent, elles ne se dessinent pas. */}
                {m.couleurs.length > 0 && (
                  <span className="mt-1.5 flex items-center gap-1">
                    {m.couleurs.slice(0, APERCU_MAX).map((c) => (
                      <PastilleCouleur
                        key={c}
                        nom={c}
                        visuels={visuels}
                        className="size-3"
                      />
                    ))}
                    {m.couleurs.length > APERCU_MAX && (
                      <span className="text-[10px] text-muted-foreground">
                        +{m.couleurs.length - APERCU_MAX}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Les coloris n'apparaissent qu'une fois le modèle choisi : les montrer
          avant obligerait à deviner lesquels vont ensemble. */}
      {palette.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">
            {t("catalogue.couleursDe", {
              modele: catalogue.find((m) => m.id === modele)?.nom ?? "",
            })}
          </p>
          {/* La pastille d'abord, le nom ensuite : « Fil Tordu » ne se
              choisit pas sur son nom, et le client ne devrait pas avoir à
              deviner ce que la teinte lui réserve. */}
          <div className="flex flex-wrap gap-2">
            {palette.map((c) => {
              const choisi = couleurs.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => basculerCouleur(c)}
                  aria-pressed={choisi}
                  className={cn(
                    "flex items-center gap-2 rounded-full border py-1.5 pe-3.5 ps-2 text-sm transition-colors",
                    choisi
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border hover:bg-secondary/60",
                  )}
                >
                  <PastilleCouleur nom={c} visuels={visuels} />
                  {c}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("catalogue.couleursAide")}
          </p>
        </div>
      )}
    </div>
  );
}
