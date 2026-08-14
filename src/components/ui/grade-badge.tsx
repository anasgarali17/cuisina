import { cn } from "@/lib/utils";

/**
 * Les paliers de note, communs aux fiches et aux clients : un A veut dire la
 * même chose partout où il s'affiche.
 */
export function gradeOf(score: number): { letter: string; className: string } {
  if (score >= 85) return { letter: "A", className: "bg-emerald-500" };
  if (score >= 70) return { letter: "B", className: "bg-lime-500" };
  if (score >= 50) return { letter: "C", className: "bg-amber-500" };
  return { letter: "D", className: "bg-red-400" };
}

/** Le chiffre et sa lettre. `compact` cache le chiffre sur mobile. */
export function GradeBadge({
  score,
  compact = false,
}: {
  score: number;
  compact?: boolean;
}) {
  const grade = gradeOf(score);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "font-semibold tabular-nums",
          compact && "hidden sm:inline",
        )}
      >
        {score}
      </span>
      <span
        aria-hidden
        className={cn(
          "grid size-5 place-items-center rounded-md text-[11px] font-bold text-white",
          grade.className,
        )}
      >
        {grade.letter}
      </span>
    </span>
  );
}
