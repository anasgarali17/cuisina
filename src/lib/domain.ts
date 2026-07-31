/** Domain vocabulary — mirrors the Postgres enums. Labels live in messages/*.json. */

export const STAGES = [
  "nouveau_contact",
  "contacte",
  "rdv_showroom",
  "metre_releve",
  "conception_devis",
  "devis_envoye",
  "negociation",
  "signe",
] as const;
export type Stage = (typeof STAGES)[number];

export const ALL_STAGES = [...STAGES, "perdu"] as const;
export type StageOrPerdu = (typeof ALL_STAGES)[number];

export const MOTIFS_PERTE = [
  "prix",
  "delai",
  "concurrent",
  "projet_annule",
  "injoignable",
  "autre",
] as const;
export type MotifPerte = (typeof MOTIFS_PERTE)[number];

export const ORIGINES = [
  "bouche_a_oreille",
  "site_web",
  "foire",
  "publicite",
] as const;
export type Origine = (typeof ORIGINES)[number];

export const ORIGINE_DETAILS: Record<string, readonly string[]> = {
  bouche_a_oreille: [
    "prospection",
    "architecte_decorateur",
    "promoteur_entrepreneur",
    "ami",
  ],
  publicite: ["spot_publicitaire", "magasine", "affiche_enseigne", "catalogue"],
};

export const CANAUX = ["whatsapp", "appel", "sms", "email", "visite"] as const;
export type Canal = (typeof CANAUX)[number];

export const RELANCE_RESULTATS = [
  "joint",
  "message_laisse",
  "injoignable",
  "rdv_pris",
  "a_rappeler",
] as const;
export type RelanceResultat = (typeof RELANCE_RESULTATS)[number];

export const PRIORITES = ["basse", "normale", "haute"] as const;
export type Priorite = (typeof PRIORITES)[number];

export const ROLES = [
  "conseiller",
  "chef_showroom",
  "direction",
  "admin",
] as const;
export type Role = (typeof ROLES)[number];

export const RDV_TYPES = [
  "showroom",
  "metre",
  "livraison",
  "pose",
  "interne",
] as const;
export type RdvType = (typeof RDV_TYPES)[number];

export const ETATS_CHANTIER = ["en_cours", "fini"] as const;
export type EtatChantier = (typeof ETATS_CHANTIER)[number];
