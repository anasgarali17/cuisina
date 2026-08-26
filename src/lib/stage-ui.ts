import {
  ETAPES_PRODUCTION,
  STAGES,
  type EtapeProduction,
  type StageOrPerdu,
} from "@/lib/domain";

/**
 * Tinted chip classes per stage — one source for every table and board.
 *
 * Red is reserved for `perdu`: it is the one state that must read as a stop.
 * The opening stages therefore take the brand's warm cream rather than another
 * red, so the funnel still runs cream → blue → amber → green with a single red
 * exit.
 */
export const STAGE_CHIP: Record<StageOrPerdu, string> = {
  nouveau_lead: "bg-stone-100 text-stone-700 border-stone-200",
  releve_preliminaire: "bg-stone-100 text-stone-700 border-stone-200",
  conception_devis: "bg-sky-50 text-sky-700 border-sky-200",
  rdv_showroom: "bg-sky-50 text-sky-700 border-sky-200",
  signe: "bg-emerald-50 text-emerald-700 border-emerald-200",
  releve_definitif: "bg-emerald-50 text-emerald-700 border-emerald-200",
  dossier_envoye: "bg-emerald-100 text-emerald-800 border-emerald-300",
  en_pause: "bg-slate-100 text-slate-600 border-slate-300",
  perdu: "bg-red-50 text-red-600 border-red-200",
};

/** Les six étapes de production, mêmes règles de teinte que ci-dessus. */
export const ETAPE_PRODUCTION_CHIP: Record<EtapeProduction, string> = {
  bureau_ordre: "bg-stone-100 text-stone-700 border-stone-200",
  bureau_etude: "bg-sky-50 text-sky-700 border-sky-200",
  approvisionnement: "bg-sky-50 text-sky-700 border-sky-200",
  achat: "bg-amber-50 text-amber-700 border-amber-200",
  production: "bg-amber-50 text-amber-700 border-amber-200",
  planification: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

/**
 * How far a fiche got through the funnel, in percent. A parked or lost lead
 * keeps no progress bar — it is out of the funnel, not behind in it.
 */
export function stageProgress(stage: StageOrPerdu): number {
  if (stage === "perdu" || stage === "en_pause") return 0;
  return Math.round(((STAGES.indexOf(stage) + 1) / STAGES.length) * 100);
}

/** Où en est la production, en pourcentage — même lecture que `stageProgress`. */
export function etapeProductionProgress(etape: EtapeProduction): number {
  return Math.round(
    ((ETAPES_PRODUCTION.indexOf(etape) + 1) / ETAPES_PRODUCTION.length) * 100,
  );
}
