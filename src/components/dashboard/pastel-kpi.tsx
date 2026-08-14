import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type PastelTone = "green" | "blue" | "rouge" | "amber" | "orange";

const TONE_CLASS: Record<PastelTone, string> = {
  green: "tone-green",
  blue: "tone-blue",
  rouge: "tone-rouge",
  amber: "tone-amber",
  orange: "tone-orange",
};

/**
 * Pastel-tinted stat card (buildingfit reference): tinted surface, colored
 * title + oversized colored number, icon badge in the matching tone.
 * Presentational — labels arrive already translated.
 *
 * Un chiffre mène toujours quelque part. Sans `href` la carte reste un carton
 * décoratif : on lit « 7 devis en attente » et on doit ensuite aller les
 * chercher à la main. Avec, elle ouvre la liste déjà filtrée.
 *
 * `urgent` sert au seul cas qui le mérite — les relances en retard. La carte
 * clignote alors, et le clignotement s'arrête de lui-même pour qui a demandé
 * moins d'animations.
 */
export function PastelKpi({
  tone,
  title,
  value,
  hint,
  icon,
  href,
  urgent = false,
}: {
  tone: PastelTone;
  title: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  href?: string;
  urgent?: boolean;
}) {
  const contenu = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="tone-title text-sm font-semibold">{title}</h3>
        <span
          aria-hidden
          className="tone-badge grid size-10 shrink-0 place-items-center rounded-2xl"
        >
          {icon}
        </span>
      </div>
      <div className="kpi-number tone-value mt-3 truncate text-4xl">{value}</div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      {href && (
        <ArrowUpRight
          aria-hidden
          className="pointer-events-none absolute end-3 bottom-3 size-4 opacity-0 transition-opacity group-hover:opacity-60"
        />
      )}
    </>
  );

  const classes = cn(
    "relative block rounded-3xl border p-6",
    TONE_CLASS[tone],
    href && "group neo-hover focus-visible:ring-2 focus-visible:ring-primary",
    !href && "neo-hover",
    urgent && "kpi-urgent",
  );

  if (!href) return <div className={classes}>{contenu}</div>;

  return (
    <Link href={href} className={classes}>
      {contenu}
    </Link>
  );
}
