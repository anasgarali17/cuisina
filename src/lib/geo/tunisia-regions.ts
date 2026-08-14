/**
 * Les régions commerciales — six zones de chalandise, pas un découpage
 * administratif. Le Grand Tunis n'existe pas dans le code ISO ; il existe
 * dans le carnet de commandes.
 *
 * Le libellé n'est pas ici : il est traduit côté messages
 * (`carte.regions.<code>`), comme le reste de l'interface.
 */

export const REGION_CODES = [
  "grand_tunis",
  "nord_est",
  "nord_ouest",
  "centre_est",
  "centre_ouest",
  "sud_est",
  "sud_ouest",
] as const;

export type RegionCode = (typeof REGION_CODES)[number];
