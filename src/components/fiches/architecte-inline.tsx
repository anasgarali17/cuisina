"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { majArchitecte } from "@/lib/actions/fiche-actions";
import { cn, messageErreur } from "@/lib/utils";

/**
 * La ligne « Architecte » du papier, mais saisissable.
 *
 * Le reste de la fiche est en lecture seule : elle reproduit la FO-COM-02 et
 * se remplit à la création. L'architecte fait exception parce qu'il arrive
 * plus tard — le client le mentionne au deuxième rendez-vous — et qu'il n'y
 * avait alors aucun endroit où l'inscrire sans refaire la fiche.
 *
 * L'enregistrement se fait à la sortie du champ, et seulement si la valeur a
 * changé : personne ne pense à cliquer un bouton posé sur une feuille.
 */
export function ArchitecteInline({
  ficheId,
  valeur,
}: {
  ficheId: string;
  valeur: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [texte, setTexte] = useState(valeur ?? "");
  /* La valeur de reference : ce que la base contient. On ne compare pas a
     `valeur`, qui ne bouge qu au prochain rendu serveur. */
  const enregistre = useRef(valeur ?? "");
  const [etat, setEtat] = useState<"repos" | "ok" | string>("repos");
  const [pending, startTransition] = useTransition();

  function enregistrer() {
    const propre = texte.trim();
    if (propre === enregistre.current) return;
    setEtat("repos");
    startTransition(async () => {
      const result = await majArchitecte({
        fiche_id: ficheId,
        architecte: propre,
      });
      if (result.ok) {
        enregistre.current = propre;
        setTexte(propre);
        setEtat("ok");
        router.refresh();
      } else {
        setEtat(messageErreur(t, result.error));
      }
    });
  }

  return (
    <span className="relative flex min-w-0 flex-1 items-end gap-1">
      <input
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value);
          if (etat !== "repos") setEtat("repos");
        }}
        onBlur={enregistrer}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          // Échap : on repose la valeur de la base et on quitte le champ.
          if (e.key === "Escape") {
            setTexte(enregistre.current);
            setTimeout(() => e.currentTarget.blur(), 0);
          }
        }}
        maxLength={120}
        disabled={pending}
        placeholder={t("fiches.wizard.architectePlaceholder")}
        aria-label={t("fiches.wizard.architecte")}
        className={cn(
          // Calque exact de <Dotted> : sur le papier, rien ne doit trahir
          // un champ de formulaire tant qu'on n'y touche pas.
          "min-w-0 flex-1 border-b border-dotted border-ardoise/50 bg-transparent px-1",
          "text-[13px] leading-6 outline-none",
          "placeholder:text-ardoise/35 placeholder:italic",
          "focus:border-solid focus:border-rouge",
          "print:border-dotted print:border-ardoise/50 print:placeholder:text-transparent",
        )}
      />
      {etat === "ok" && (
        <Check className="mb-1 size-3.5 shrink-0 text-vert-plan no-print" />
      )}
      {etat !== "ok" && etat !== "repos" && (
        <span className="mb-0.5 shrink-0 text-[11px] text-rouge no-print">
          {etat}
        </span>
      )}
    </span>
  );
}
