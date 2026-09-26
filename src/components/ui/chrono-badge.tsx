import { useTranslations } from "next-intl";
import { Hourglass } from "lucide-react";
import { CHRONO_STYLE, type Chrono } from "@/lib/chrono";
import { cn } from "@/lib/utils";

/**
 * Depuis combien de jours ce dossier est là où il est.
 *
 * Le nombre seul ne dit rien — « 9 » est excellent en production et
 * catastrophique sur un nouveau lead. La couleur porte le jugement, le
 * libellé porte le seuil : on sait à la fois où on en est et ce qui était
 * attendu.
 */
export function ChronoBadge({
  chrono,
  className,
}: {
  chrono: Chrono;
  className?: string;
}) {
  const t = useTranslations();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 font-mono text-[10px] leading-none",
        CHRONO_STYLE[chrono.niveau],
        className,
      )}
      title={t(`chrono.infobulle.${chrono.niveau}`, {
        jours: chrono.jours,
        seuil: chrono.seuil,
      })}
    >
      <Hourglass aria-hidden className="size-3" />
      {t("chrono.jours", { n: chrono.jours })}
    </span>
  );
}
