import { STAGES, type StageOrPerdu } from "@/lib/domain";

/** Tinted chip classes per stage — one source for every table and board. */
export const STAGE_CHIP: Record<StageOrPerdu, string> = {
  nouveau_contact: "bg-violet-50 text-violet-700 border-violet-200",
  contacte: "bg-violet-50 text-violet-700 border-violet-200",
  rdv_showroom: "bg-sky-50 text-sky-700 border-sky-200",
  metre_releve: "bg-sky-50 text-sky-700 border-sky-200",
  conception_devis: "bg-sky-50 text-sky-700 border-sky-200",
  devis_envoye: "bg-amber-50 text-amber-700 border-amber-200",
  negociation: "bg-amber-50 text-amber-700 border-amber-200",
  signe: "bg-emerald-50 text-emerald-700 border-emerald-200",
  en_pause: "bg-slate-100 text-slate-600 border-slate-300",
  perdu: "bg-red-50 text-red-600 border-red-200",
};

/**
 * How far a fiche got through the funnel, in percent. A parked or lost lead
 * keeps no progress bar — it is out of the funnel, not behind in it.
 */
export function stageProgress(stage: StageOrPerdu): number {
  if (stage === "perdu" || stage === "en_pause") return 0;
  return Math.round(((STAGES.indexOf(stage) + 1) / STAGES.length) * 100);
}
