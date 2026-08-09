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

/** Parked leads: neither advancing nor lost. */
export const EN_PAUSE = "en_pause" as const;

export const ALL_STAGES = [...STAGES, EN_PAUSE, "perdu"] as const;
export type StageOrPerdu = (typeof ALL_STAGES)[number];

/** Stages that take a fiche out of the active funnel. */
export const STAGES_HORS_FUNNEL = [EN_PAUSE, "perdu"] as const;

export const MOTIFS_PERTE = [
  "prix",
  "delai",
  "concurrent",
  "projet_annule",
  "injoignable",
  "autre",
] as const;
export type MotifPerte = (typeof MOTIFS_PERTE)[number];

/** Why a lead is parked — drives the WhatsApp re-check cadence. */
export const MOTIFS_PAUSE = [
  "chantier_en_cours",
  "budget_non_pret",
  "reflexion",
  "autre",
] as const;
export type MotifPause = (typeof MOTIFS_PAUSE)[number];

/** Default re-check cadence per pause reason, in days. */
export const CADENCE_PAR_MOTIF: Record<MotifPause, number> = {
  chantier_en_cours: 30,
  budget_non_pret: 30,
  reflexion: 7,
  autre: 14,
};

/** Cadences offered in the pause dialog, in days. */
export const CADENCES = [7, 14, 30, 60, 90] as const;
export type Cadence = (typeof CADENCES)[number];

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
