"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Search, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PointDeVenteRow } from "@/lib/database.types";

export const TOUS_LES_SHOWROOMS = "__tous__";

export interface ShowroomPickerProps {
  /** Les showrooms que ce profil a le droit de voir — déjà filtrés côté serveur. */
  showrooms: readonly PointDeVenteRow[];
  /** L'identifiant choisi, ou `TOUS_LES_SHOWROOMS`. */
  value: string;
  onChange: (value: string) => void;
  /**
   * Propose « Tous les showrooms » en tête. Faux pour un profil borné à un
   * seul point de vente : l'entrée n'aurait aucun sens.
   */
  autoriseTous?: boolean;
  /** Nombre de fiches actives par showroom, affiché en pastille. */
  compteurs?: Record<string, number>;
  className?: string;
}

/**
 * Le sélecteur de showroom.
 *
 * Un `<select>` natif aurait suffi pour neuf lignes, mais c'est l'écran qu'on
 * ouvre vingt fois par jour : il se comporte donc comme le sélecteur de date —
 * on l'ouvre au clavier, on tape trois lettres, on valide. La recherche porte
 * sur le nom **et** la ville, parce qu'on cherche « Nabeul » aussi souvent
 * que « Cuisina Nabeul ».
 *
 * Un profil qui n'a droit qu'à un showroom ne reçoit pas un menu à un seul
 * choix : il reçoit une étiquette. Un menu qu'on ne peut pas changer donne
 * l'impression d'un droit qu'on n'a pas.
 */
export function ShowroomPicker({
  showrooms,
  value,
  onChange,
  autoriseTous = false,
  compteurs,
  className,
}: ShowroomPickerProps) {
  const t = useTranslations("showroomPicker");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [actif, setActif] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listeId = useId();

  /* Les entrées telles que la liste les affiche : « Tous » d'abord quand il
     est permis, puis les showrooms filtrés par la recherche. */
  const entrees = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const correspond = (pdv: PointDeVenteRow) =>
      !q ||
      pdv.nom.toLocaleLowerCase().includes(q) ||
      (pdv.ville ?? "").toLocaleLowerCase().includes(q);

    const liste: Array<{ id: string; nom: string; ville: string | null }> =
      showrooms
        .filter(correspond)
        .map((p) => ({ id: p.id, nom: p.nom, ville: p.ville }));

    if (autoriseTous && !q) {
      liste.unshift({ id: TOUS_LES_SHOWROOMS, nom: t("tous"), ville: null });
    }
    return liste;
  }, [showrooms, query, autoriseTous, t]);

  /* Le curseur clavier reste visible quand la liste défile. */
  useEffect(() => {
    listRef.current?.children[actif]?.scrollIntoView({ block: "nearest" });
  }, [actif]);

  /* La recherche remet le curseur en tête : une liste qui rétrécit ne doit
     pas laisser Entrée valider une ligne qui n'existe plus. Fait ici plutôt
     que dans un effet — c'est la frappe qui le décide, pas un rendu. */
  function chercher(valeur: string) {
    setQuery(valeur);
    setActif(0);
  }

  const choisi = showrooms.find((p) => p.id === value);
  const libelle =
    value === TOUS_LES_SHOWROOMS ? t("tous") : (choisi?.nom ?? t("aucun"));

  /* Un seul showroom accessible : rien à choisir, donc pas de menu. */
  if (showrooms.length <= 1 && !autoriseTous) {
    return (
      <span
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm font-medium",
          className,
        )}
      >
        <Store aria-hidden className="size-4 text-muted-foreground" />
        <span className="truncate">{libelle}</span>
      </span>
    );
  }

  function valider(id: string) {
    onChange(id);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActif((i) => (i + 1) % Math.max(entrees.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActif((i) => (i - 1 + entrees.length) % Math.max(entrees.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entree = entrees[actif];
      if (entree) valider(entree.id);
    }
  }

  /* La recherche repart de zéro à chaque ouverture : on ne rouvre pas un menu
     sur les trois lettres tapées la fois d'avant. */
  function ouvrir(prochain: boolean) {
    setOpen(prochain);
    if (!prochain) {
      setQuery("");
      setActif(0);
    }
  }

  return (
    <Popover open={open} onOpenChange={ouvrir}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listeId}
          aria-haspopup="listbox"
          aria-label={t("label")}
          className={cn(
            "inline-flex h-10 min-w-0 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm font-medium transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            className,
          )}
        >
          <Store aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{libelle}</span>
          <ChevronsUpDown
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground"
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[min(22rem,calc(100vw-2rem))] p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => chercher(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("chercher")}
            aria-label={t("chercher")}
            className="h-11 w-full bg-transparent text-sm placeholder:text-muted-foreground focus-visible:outline-none"
          />
        </div>

        {entrees.length === 0 ? (
          // La liste garde son identifiant même vide : `aria-controls` du
          // bouton doit toujours désigner un élément qui existe.
          <p
            id={listeId}
            role="listbox"
            aria-label={t("label")}
            className="px-3 py-6 text-center text-sm text-muted-foreground"
          >
            {t("vide")}
          </p>
        ) : (
          <ul
            ref={listRef}
            id={listeId}
            role="listbox"
            aria-label={t("label")}
            className="max-h-72 overflow-y-auto p-1.5"
          >
            {entrees.map((entree, i) => {
              const selectionne = entree.id === value;
              const compteur = compteurs?.[entree.id];
              return (
                <li key={entree.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectionne}
                    onClick={() => valider(entree.id)}
                    onMouseEnter={() => setActif(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start text-sm transition-colors",
                      i === actif ? "bg-secondary" : "hover:bg-secondary/60",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-lg",
                        selectionne
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      <Store className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {entree.nom}
                      </span>
                      {entree.ville && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {entree.ville}
                        </span>
                      )}
                    </span>
                    {compteur !== undefined && (
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {compteur}
                      </span>
                    )}
                    {selectionne && (
                      <Check aria-hidden className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
