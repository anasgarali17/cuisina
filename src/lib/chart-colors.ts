/**
 * Categorical data-viz palette — validated with the dataviz six-checks script
 * (lightness band, chroma floor, CVD separation, normal-vision floor, contrast)
 * for both surfaces. Hues are assigned to entities in FIXED order, never cycled.
 */

import type { Origine } from "@/lib/domain";

export const CHART_CATEGORICAL_LIGHT = [
  "#C1121F", // rouge — bouche_a_oreille
  "#3B5FC0", // bleu — site_web
  "#B87217", // chêne — foire
  "#0E8C66", // vert — publicite
] as const;

export const CHART_CATEGORICAL_DARK = [
  "#D9453D",
  "#6B8AD6",
  "#C4861F",
  "#3D9E7D",
] as const;

export const ORIGINE_COLOR_INDEX: Record<Origine, number> = {
  bouche_a_oreille: 0,
  site_web: 1,
  foire: 2,
  publicite: 3,
};
