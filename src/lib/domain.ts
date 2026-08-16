/** Domain vocabulary — mirrors the Postgres enums. Labels live in messages/*.json. */

/**
 * L'état du dossier — le parcours commercial tel qu'il se déroule réellement
 * chez CUISINA, du lead au dossier transmis à la production.
 *
 * « Clôturé » précède « Signé » à dessein : il marque la fin de la phase
 * commerciale (le client a tranché), la signature venant ensuite formaliser
 * l'accord. Le relevé définitif ne se fait qu'une fois signé — mesurer avant
 * revient à mesurer deux fois.
 *
 * Un dossier qui atteint `dossier_envoye` bascule automatiquement dans le
 * suivi de production — voir `ETAPES_PRODUCTION`.
 */
export const STAGES = [
  "nouveau_lead",
  "releve_preliminaire",
  "conception_devis",
  "rdv_showroom",
  "cloture",
  "signe",
  "releve_definitif",
  "dossier_envoye",
] as const;
export type Stage = (typeof STAGES)[number];

/** Le dernier état commercial : franchi, le dossier passe en production. */
export const STAGE_FINAL_COMMERCIAL = "dossier_envoye" as const;

/** Parked leads: neither advancing nor lost. */
export const EN_PAUSE = "en_pause" as const;

export const ALL_STAGES = [...STAGES, EN_PAUSE, "perdu"] as const;
export type StageOrPerdu = (typeof ALL_STAGES)[number];

/** Stages that take a fiche out of the active funnel. */
export const STAGES_HORS_FUNNEL = [EN_PAUSE, "perdu"] as const;

/**
 * Client actif — ce qui se passe une fois le dossier parti en production.
 *
 * Le suivi commercial s'arrêtait à la signature : entre « dossier envoyé » et
 * la pose, l'application ne savait plus rien. Ces six étapes reprennent le
 * relais, et le premier maillon se remplit tout seul — un dossier qui atteint
 * `dossier_envoye` apparaît en `bureau_ordre` sans que personne le déplace.
 */
export const ETAPES_PRODUCTION = [
  "bureau_ordre",
  "bureau_etude",
  "approvisionnement",
  "achat",
  "production",
  "planification",
] as const;
export type EtapeProduction = (typeof ETAPES_PRODUCTION)[number];

/** Où entre un dossier qui vient d'être envoyé. */
export const ETAPE_PRODUCTION_INITIALE = "bureau_ordre" as const;

/**
 * Ce que le client vient chercher. Le choix est fait à l'étape 1 du
 * formulaire public et commande tout le reste : les questions posées ensuite,
 * et ce que le commercial voit arriver.
 */
export const TYPES_PROJET = ["cuisine", "dressing"] as const;
export type TypeProjet = (typeof TYPES_PROJET)[number];

/**
 * Les sept modèles de cuisine, repris du catalogue public cuisina.com.
 *
 * L'ordre est celui du site (`/fr/products/…`). Les identifiants valent aussi
 * pour l'URL de la fiche produit — un conseiller peut montrer la page au
 * client sans qu'on maintienne une seconde table de correspondance.
 */
export const MODELES_CUISINE = [
  "capri",
  "roma",
  "latina",
  "parma",
  "pisa",
  "portofino",
  "lucca",
] as const;
export type ModeleCuisine = (typeof MODELES_CUISINE)[number];

/**
 * Les trois dressings du catalogue : sans façades, coulissant, ouvrant.
 *
 * Seul l'ouvrant se décline en coloris — les deux autres n'ont pas de façade
 * à teinter. Le formulaire ne montre donc de palette que pour lui.
 */
export const MODELES_DRESSING = ["room", "coulissant", "ouvrant"] as const;
export type ModeleDressing = (typeof MODELES_DRESSING)[number];

/** Le caisson du dressing — la matière de la structure, pas de la façade. */
export const TYPES_CAISSON_DRESSING = [
  "agglomere_standard",
  "mdf_hydrofuge",
  "contreplaque_bouleau",
  "bois_massif",
] as const;
export type TypeCaissonDressing = (typeof TYPES_CAISSON_DRESSING)[number];

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
  // Cle historique conservee : la valeur existe deja dans l enum Postgres.
  // Seul le libelle a change (« Reseaux sociaux »), ce qui evite une migration
  // avant chaque deploiement — voir messages/*.json.
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
  // Les réseaux d'où viennent réellement les leads. Le détail est du texte
  // libre en base : le changer ne demande aucune migration.
  publicite: ["facebook", "instagram", "tiktok", "autre_reseau"],
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

/**
 * Qui tient le téléphone quand le formulaire public se remplit. Le fond est
 * identique — seule la formulation change : « Comment nous avez-vous connus ? »
 * pour le client, « Où le client nous a-t-il connus ? » pour l'équipe.
 */
export const LIEN_AUDIENCES = ["client", "equipe"] as const;
export type LienAudience = (typeof LIEN_AUDIENCES)[number];

/** Le verdict de la direction sur une demande reçue. */
export const SUBMISSION_STATUTS = ["en_attente", "accepte", "refuse"] as const;
export type SubmissionStatut = (typeof SUBMISSION_STATUTS)[number];

/**
 * Combien le client a acheté chez nous, en trois tranches lues dans le CA
 * cumulé plutôt que saisies à la main : les chiffres le savent déjà. Les
 * tranches ne portent pas de nom commercial — elles s'affichent en dinars,
 * parce qu'un montant se comprend sans traduction. Le VIP, lui, reste une
 * décision humaine — voir `clients.vip`.
 */
export const TRANCHES_ACHAT = ["haut", "moyen", "bas"] as const;
export type TrancheAchat = (typeof TRANCHES_ACHAT)[number];

export const SEUIL_HAUT = 45_000;
export const SEUIL_MOYEN = 30_000;

export function trancheAchat(caCumule: number): TrancheAchat {
  if (caCumule >= SEUIL_HAUT) return "haut";
  if (caCumule >= SEUIL_MOYEN) return "moyen";
  return "bas";
}

/**
 * Le score client, sur 100. Quatre choses qu'on regarde de toute façon avant
 * de rappeler quelqu'un : ce qu'il a acheté, ce que ses projets sont devenus,
 * depuis quand il n'a plus bougé, et si on sait seulement le joindre. Aucune
 * saisie — tout se calcule depuis les fiches.
 */
export const SCORE_CLIENT_POIDS = {
  achats: 40,
  projets: 30,
  activite: 20,
  contact: 10,
} as const;

export interface ScoreClient {
  total: number;
  achats: number;
  projets: number;
  activite: number;
  contact: number;
}

export function scoreClient(input: {
  caCumule: number;
  projetsSignes: number;
  projetsEnCours: number;
  projetsTotal: number;
  /** Jours depuis la dernière activité ; null quand rien n'a jamais bougé. */
  joursDepuisActivite: number | null;
  tel: boolean;
  email: boolean;
  adresse: boolean;
}): ScoreClient {
  const achats =
    SCORE_CLIENT_POIDS.achats * Math.min(1, Math.max(0, input.caCumule) / SEUIL_HAUT);

  // Un signé compte plein, une affaire encore en cours compte moitié : elle
  // peut encore tomber d'un côté ou de l'autre.
  const projets =
    input.projetsTotal === 0
      ? 0
      : SCORE_CLIENT_POIDS.projets *
        Math.min(
          1,
          (input.projetsSignes + input.projetsEnCours / 2) / input.projetsTotal,
        );

  const j = input.joursDepuisActivite;
  const activite =
    j === null ? 0 : j <= 30 ? 20 : j <= 90 ? 14 : j <= 180 ? 8 : j <= 365 ? 3 : 0;

  const contact = (input.tel ? 4 : 0) + (input.email ? 3 : 0) + (input.adresse ? 3 : 0);

  return {
    total: Math.round(achats + projets + activite + contact),
    achats: Math.round(achats),
    projets: Math.round(projets),
    activite,
    contact,
  };
}

/* — Séquences WhatsApp — voir la migration 0014 — */

/**
 * Ce qui met une séquence en marche. Chaque déclencheur se lit sur une fiche
 * déjà existante : rien n'est inventé, on ne fait que dater le départ.
 */
export const DECLENCHEURS = [
  "fiche_creee",
  "stage_atteint",
  "rdv_planifie",
  "devis_sans_reponse",
  "pause_reprise",
  "apres_signature",
  "client_inactif",
] as const;
export type Declencheur = (typeof DECLENCHEURS)[number];

/** Le déclencheur `stage_atteint` a besoin de savoir quelle étape. */
export const DECLENCHEURS_AVEC_STAGE: readonly Declencheur[] = ["stage_atteint"];

/**
 * Une séquence en `simulation` calcule tout — destinataire, texte, horaire —
 * mais n'envoie rien : elle remplit la file d'attente, que le conseiller vide
 * à la main d'un tap sur WhatsApp. `actif` sera le jour où la passerelle
 * enverra elle-même. On garde le premier par défaut : un message parti tout
 * seul chez le mauvais client ne se rattrape pas.
 */
export const SEQUENCE_MODES = ["simulation", "actif"] as const;
export type SequenceMode = (typeof SEQUENCE_MODES)[number];

/**
 * Le cycle de vie d'un message. `simule` est le seul état que la phase
 * actuelle sait produire ; les suivants attendent la passerelle.
 */
export const ENVOI_STATUTS = [
  "simule",
  "planifie",
  "envoye",
  "repondu",
  "echec",
  "annule",
] as const;
export type EnvoiStatut = (typeof ENVOI_STATUTS)[number];

export const MODELE_CATEGORIES = [
  "relance",
  "rdv",
  "devis",
  "apres_vente",
  "courtoisie",
] as const;
export type ModeleCategorie = (typeof MODELE_CATEGORIES)[number];

/**
 * Les variables qu'un modèle peut interpoler, en `{{nom}}`. Toute variable
 * hors de cette liste est refusée à l'enregistrement : un `{{prix_final}}`
 * inventé partirait chez le client tel quel.
 */
export const VARIABLES_MESSAGE = [
  "client",
  "conseiller",
  "showroom",
  "telephone_showroom",
  "reference",
  "ville",
  "budget",
  "date_rdv",
  "heure_rdv",
  "lieu_rdv",
] as const;
export type VariableMessage = (typeof VARIABLES_MESSAGE)[number];

/** WhatsApp coupe au-delà ; au-delà de ça on ne lit plus, on scrolle. */
export const LONGUEUR_MESSAGE_MAX = 900;

/** Fenêtre d'envoi par défaut — personne ne relance un client à 7 h. */
export const FENETRE_DEFAUT = { debut: 9, fin: 19 } as const;

/** Ce qu'un fournisseur nous livre — voir la migration 0013. */
export const FOURNISSEUR_CATEGORIES = [
  "caisson",
  "plan_travail",
  "electromenager",
  "quincaillerie",
  "pose",
  "transport",
  "autre",
] as const;
export type FournisseurCategorie = (typeof FOURNISSEUR_CATEGORIES)[number];
