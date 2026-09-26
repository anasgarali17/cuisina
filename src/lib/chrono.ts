import {
  ETAPES_PRODUCTION,
  STAGES,
  type EtapeProduction,
  type Stage,
  type StageOrPerdu,
} from "@/lib/domain";

/**
 * Le temps passé dans une étape, et à partir de quand il devient anormal.
 *
 * Un dossier ne se perd pas d'un coup : il s'arrête. Il reste trois semaines
 * en « conception devis » parce que personne ne s'est dit que c'était long,
 * et le client a signé ailleurs entre-temps. Les tableaux montraient où était
 * chaque dossier, jamais depuis combien de temps il y était.
 *
 * Les seuils ci-dessous sont un point de départ raisonnable, pas une vérité :
 * ils se règlent ici, en un endroit, et les trois écrans suivent.
 */

/** Jours au-delà desquels une étape commerciale traîne. */
export const SEUIL_STAGE: Record<Stage, number> = {
  // Un lead qu'on ne rappelle pas le jour même est un lead qui refroidit.
  nouveau_lead: 2,
  releve_preliminaire: 7,
  // Un devis sans réponse est ce qui se perd le plus silencieusement.
  conception_devis: 7,
  rdv_showroom: 5,
  // Signé : le relevé définitif doit suivre, l'atelier attend.
  signe: 5,
  releve_definitif: 7,
  dossier_envoye: 3,
};

/** Jours au-delà desquels une étape de production traîne. */
export const SEUIL_ETAPE: Record<EtapeProduction, number> = {
  bureau_ordre: 3,
  bureau_etude: 7,
  approvisionnement: 10,
  // L'achat compte six sous-étapes : il a le droit d'être le plus long.
  achat: 14,
  production: 21,
  planification: 7,
};

export type NiveauChrono = "ok" | "attention" | "retard";

/**
 * Où en est le compteur.
 *
 * Trois niveaux et non deux : prévenir la veille du dépassement laisse encore
 * le temps d'un appel, alors qu'une alerte qui n'apparaît qu'au dépassement
 * arrive toujours après la bascule.
 */
export function niveauChrono(jours: number, seuil: number): NiveauChrono {
  if (jours > seuil) return "retard";
  if (jours >= Math.max(1, Math.round(seuil * 0.75))) return "attention";
  return "ok";
}

/**
 * L'horloge du serveur, lue une fois par rendu.
 *
 * Passe par une fonction nommée plutôt qu'un `Date.now()` posé dans le corps
 * d'un composant : la lecture de l'heure est impure, et la lire une seule
 * fois garantit surtout que toutes les cartes d'un même écran sont comptées
 * depuis le même instant.
 */
export function maintenantServeur(): number {
  return Date.now();
}

/** Jours calendaires écoulés depuis cet instant, jamais négatif. */
export function joursDepuis(iso: string, maintenant = Date.now()): number {
  const debut = new Date(iso).getTime();
  if (!Number.isFinite(debut)) return 0;
  return Math.max(0, Math.floor((maintenant - debut) / 86_400_000));
}

export interface Chrono {
  /** Jours passés dans l'étape courante. */
  jours: number;
  seuil: number;
  niveau: NiveauChrono;
}

export function chronoDe(depuisIso: string, seuil: number, maintenant?: number): Chrono {
  const jours = joursDepuis(depuisIso, maintenant);
  return { jours, seuil, niveau: niveauChrono(jours, seuil) };
}

/**
 * Les étapes qui ne se chronomètrent pas.
 *
 * « Perdu » est un point final — compter les jours depuis la perte
 * n'appellerait aucune action. « En pause » a déjà sa propre date de reprise,
 * et une pastille rouge sur un dossier volontairement mis de côté ferait du
 * bruit pour rien.
 */
export function stageChronometre(stage: StageOrPerdu): stage is Stage {
  return (STAGES as readonly string[]).includes(stage);
}

/**
 * Depuis quand une fiche est dans son étape.
 *
 * L'historique donne la date exacte du passage. À défaut — une fiche créée
 * avant que l'historique n'existe, ou jamais déplacée — on retombe sur sa
 * création, qui est bien le moment où elle est entrée dans « nouveau lead ».
 */
export function depuisQuandStage(
  fiche: { id: string; stage: StageOrPerdu; created_at: string },
  historique: readonly { fiche_id: string; stage_to: string; created_at: string }[],
): string {
  let dernier: string | null = null;
  for (const h of historique) {
    if (h.fiche_id !== fiche.id || h.stage_to !== fiche.stage) continue;
    if (!dernier || h.created_at > dernier) dernier = h.created_at;
  }
  return dernier ?? fiche.created_at;
}

/** Même principe côté production : l'historique d'abord, l'entrée sinon. */
export function depuisQuandEtape(
  dossier: { id: string; etape: EtapeProduction; entre_le: string },
  historique: readonly {
    client_actif_id: string;
    etape_to: string;
    created_at: string;
  }[],
): string {
  let dernier: string | null = null;
  for (const h of historique) {
    if (h.client_actif_id !== dossier.id || h.etape_to !== dossier.etape) continue;
    if (!dernier || h.created_at > dernier) dernier = h.created_at;
  }
  return dernier ?? dossier.entre_le;
}

/** Les classes d'une pastille de chrono, par niveau. */
export const CHRONO_STYLE: Record<NiveauChrono, string> = {
  ok: "border-border bg-secondary text-muted-foreground",
  attention: "border-ambre/40 bg-ambre/10 text-ambre",
  retard: "border-rouge/40 bg-rouge/10 text-rouge",
};

export { ETAPES_PRODUCTION, STAGES };
