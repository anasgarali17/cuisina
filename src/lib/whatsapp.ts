import { formatDate } from "@/lib/dates";
import {
  LONGUEUR_MESSAGE_MAX,
  VARIABLES_MESSAGE,
  type Declencheur,
  type VariableMessage,
} from "@/lib/domain";
import type {
  FicheRow,
  ModeleMessageRow,
  PointDeVenteRow,
  ProfileRow,
  RendezVousRow,
  SequenceEtapeRow,
  SequenceRow,
} from "@/lib/database.types";

/**
 * Le moteur des séquences WhatsApp — tout ce qui précède l'envoi.
 *
 * Il calcule exactement ce qu'une passerelle enverrait : le destinataire, le
 * texte variables remplacées, et l'horodatage calé dans la fenêtre autorisée.
 * Puis il s'arrête. Rien ici n'ouvre de connexion : la file d'attente ainsi
 * produite se vide à la main, d'un tap sur wa.me, jusqu'à ce que la
 * passerelle existe. Le jour venu, c'est le consommateur qui change — pas ce
 * fichier.
 */

/* — Numéros — */

const INDICATIF_TN = "216";

/**
 * Vers le format que wa.me attend : chiffres seuls, indicatif compris.
 *
 * Les numéros saisis en showroom ressemblent à « 98 123 456 », « +216 98 123
 * 456 » ou « 00216 98123456 ». Les trois désignent le même téléphone.
 * Retourne null si ça ne ressemble pas à un mobile joignable — mieux vaut une
 * ligne barrée dans la file qu'un message parti chez un inconnu.
 */
export function normaliserTelephone(tel: string | null | undefined): string | null {
  if (!tel) return null;
  let chiffres = tel.replace(/\D/g, "");
  if (chiffres.startsWith("00")) chiffres = chiffres.slice(2);
  if (chiffres.length === 8) chiffres = INDICATIF_TN + chiffres;
  if (!chiffres.startsWith(INDICATIF_TN)) return null;
  // 216 + 8 chiffres. Un fixe passe aussi : c'est au conseiller de savoir.
  return chiffres.length === 11 ? chiffres : null;
}

/** Le numéro tel qu'on l'affiche : +216 98 123 456. */
export function formaterTelephone(e164: string): string {
  const local = e164.slice(INDICATIF_TN.length);
  return `+${INDICATIF_TN} ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
}

/**
 * Le lien qui ouvre WhatsApp avec le message déjà écrit. C'est le pont de
 * cette phase : le texte est calculé par l'outil, l'envoi reste un geste
 * humain — donc traçable, et interruptible.
 */
export function lienWhatsApp(e164: string, message: string): string {
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

/* — Modèles — */

const MOTIF_VARIABLE = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Les variables citées par un modèle, sans doublon, dans l'ordre du texte. */
export function variablesUtilisees(corps: string): string[] {
  const vues = new Set<string>();
  for (const [, nom] of corps.matchAll(MOTIF_VARIABLE)) vues.add(nom);
  return [...vues];
}

/**
 * Celles qui n'existent pas. Un `{{prix_final}}` inventé ne serait pas
 * remplacé : il partirait tel quel, accolades comprises.
 */
export function variablesInconnues(corps: string): string[] {
  const connues = new Set<string>(VARIABLES_MESSAGE);
  return variablesUtilisees(corps).filter((v) => !connues.has(v));
}

export type Variables = Partial<Record<VariableMessage, string>>;

/**
 * Remplace les variables. Celles sans valeur pour ce client deviennent
 * `[nom]` plutôt que de disparaître : un message amputé se remarque, un
 * message troué se corrige.
 */
export function rendreMessage(corps: string, variables: Variables): string {
  return corps.replace(MOTIF_VARIABLE, (_, nom: string) => {
    const valeur = variables[nom as VariableMessage];
    return valeur && valeur.trim() ? valeur : `[${nom}]`;
  });
}

/** Jeu de valeurs d'exemple, pour prévisualiser un modèle sans vrai client. */
export const VARIABLES_EXEMPLE: Variables = {
  client: "Mohamed Ben Romdhane",
  conseiller: "Amine",
  showroom: "La Marsa",
  telephone_showroom: "+216 71 100 200",
  reference: "FC-2026-0142",
  ville: "La Marsa",
  budget: "32 000 DT",
  date_rdv: "jeudi 14 août",
  heure_rdv: "10:00",
  lieu_rdv: "Showroom La Marsa",
};

export function messageTropLong(corps: string): boolean {
  return corps.length > LONGUEUR_MESSAGE_MAX;
}

/* — Fenêtre d'envoi — */

const DIMANCHE = 0;
const VENDREDI = 5;

/**
 * Cale un horaire dans la fenêtre de la séquence : un message calculé pour
 * 6 h du matin attend l'ouverture au lieu de réveiller le client, et un
 * message tombé un jour exclu glisse au jour suivant.
 */
export function calerDansFenetre(date: Date, sequence: SequenceRow): Date {
  const cale = new Date(date);

  if (cale.getHours() < sequence.fenetre_debut) {
    cale.setHours(sequence.fenetre_debut, 0, 0, 0);
  } else if (cale.getHours() >= sequence.fenetre_fin) {
    cale.setDate(cale.getDate() + 1);
    cale.setHours(sequence.fenetre_debut, 0, 0, 0);
  }

  // Au plus une semaine de glissement : au-delà, les deux exclusions se
  // contrediraient et la boucle ne finirait pas.
  for (let i = 0; i < 7; i++) {
    const jour = cale.getDay();
    const exclu =
      (sequence.exclure_dimanche && jour === DIMANCHE) ||
      (sequence.exclure_vendredi && jour === VENDREDI);
    if (!exclu) break;
    cale.setDate(cale.getDate() + 1);
    cale.setHours(sequence.fenetre_debut, 0, 0, 0);
  }

  return cale;
}

/* — Planification — */

/** Pourquoi une ligne de la file ne partirait pas telle quelle. */
export type MotifBlocage = "sans_telephone" | "variables_manquantes";

export interface EnvoiPlanifie {
  /** Stable pour un (fiche, étape) donné — sert de clé de rendu et de dédoublonnage. */
  cle: string;
  sequence: SequenceRow;
  etape: SequenceEtapeRow;
  modele: ModeleMessageRow;
  fiche: FicheRow;
  /** Le rendez-vous à l'origine du rappel, pour le déclencheur `rdv_planifie`. */
  rdv: RendezVousRow | null;
  conseiller: ProfileRow | null;
  /** Numéro normalisé, prêt pour wa.me. Null = injoignable par WhatsApp. */
  destinataire: string | null;
  corps: string;
  planifieLe: Date;
  /** L'heure est passée : c'est ce que la machine aurait déjà envoyé. */
  enRetard: boolean;
  blocage: MotifBlocage | null;
}

export interface ContextePlanification {
  fiches: FicheRow[];
  rdv: RendezVousRow[];
  sequences: SequenceRow[];
  etapes: SequenceEtapeRow[];
  modeles: ModeleMessageRow[];
  profiles: ProfileRow[];
  pdvs: PointDeVenteRow[];
  locale: string;
  /** Combien de jours en avant on calcule. */
  horizonJours?: number;
  /** Combien de jours en arrière on garde le retard visible. */
  retardJours?: number;
  maintenant?: Date;
}

const HORIZON_DEFAUT = 21;
const RETARD_DEFAUT = 14;

/** Les étapes en dur d'un déclencheur qui ne se lit pas sur la fiche. */
const DECLENCHEURS_SUR_RDV: readonly Declencheur[] = ["rdv_planifie"];

function joursDepuis(iso: string, maintenant: Date): number {
  return Math.floor((maintenant.getTime() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * Quand la séquence s'arme pour cette fiche — ou null si elle ne s'arme pas.
 *
 * Chaque déclencheur se lit sur une donnée déjà présente : on ne devine rien,
 * on date un fait. `seuil_jours` est une porte, pas un décalage : il exige un
 * silence minimum avant que la séquence soit seulement considérée.
 */
function dateBase(
  sequence: SequenceRow,
  fiche: FicheRow,
  maintenant: Date,
): Date | null {
  const stage = fiche.stage;
  const clos = stage === "signe" || stage === "perdu";

  switch (sequence.declencheur) {
    case "fiche_creee":
      // Les tout premiers messages : seulement tant que rien n'a bougé.
      return stage === "nouveau_lead" ? new Date(fiche.created_at) : null;

    case "stage_atteint":
      return sequence.stage_cible && stage === sequence.stage_cible
        ? new Date(fiche.updated_at)
        : null;

    case "devis_sans_reponse": {
      if (stage !== "conception_devis") return null;
      if (joursDepuis(fiche.updated_at, maintenant) < sequence.seuil_jours) {
        return null;
      }
      const remise = fiche.date_effective_remise_devis ?? fiche.updated_at;
      const base = new Date(remise);
      // Une date sans heure tombe à minuit : la fenêtre la remonterait au
      // lendemain matin. On la pose à l'ouverture du showroom.
      if (remise.length === 10) base.setHours(sequence.fenetre_debut, 0, 0, 0);
      return base;
    }

    case "pause_reprise": {
      if (stage !== "en_pause" || !fiche.pause_reprise_le) return null;
      const base = new Date(fiche.pause_reprise_le);
      base.setHours(sequence.fenetre_debut, 0, 0, 0);
      return base;
    }

    case "apres_signature":
      return stage === "signe" ? new Date(fiche.updated_at) : null;

    case "client_inactif":
      if (clos || stage === "en_pause") return null;
      return joursDepuis(fiche.updated_at, maintenant) >= sequence.seuil_jours
        ? new Date(fiche.updated_at)
        : null;

    default:
      return null;
  }
}

function variablesPour(
  fiche: FicheRow,
  conseiller: ProfileRow | null,
  pdv: PointDeVenteRow | null,
  rdv: RendezVousRow | null,
  locale: string,
): Variables {
  return {
    client: fiche.client_nom,
    conseiller: conseiller?.prenom ?? "",
    showroom: pdv?.ville ?? pdv?.nom ?? "",
    telephone_showroom: pdv?.telephone ?? "",
    reference: fiche.reference,
    ville: fiche.ville ?? "",
    budget: fiche.budget_estimatif
      ? `${fiche.budget_estimatif.toLocaleString("fr-FR")} DT`
      : "",
    date_rdv: rdv ? formatDate(rdv.debut, "EEEE d MMMM", locale) : "",
    heure_rdv: rdv ? formatDate(rdv.debut, "HH:mm", locale) : "",
    lieu_rdv: rdv?.lieu ?? "",
  };
}

/**
 * La file d'attente complète : ce que les séquences enverraient, sur la
 * fenêtre demandée.
 *
 * Aucun état n'est écrit. La fonction est pure et rejouable — c'est ce qui
 * permet de la faire tourner en simulation pendant des semaines, de regarder
 * ce qui en sort, et de corriger les modèles avant que le premier message
 * réel ne parte.
 */
export function planifierEnvois(ctx: ContextePlanification): EnvoiPlanifie[] {
  const maintenant = ctx.maintenant ?? new Date();
  const horizon = new Date(maintenant);
  horizon.setDate(horizon.getDate() + (ctx.horizonJours ?? HORIZON_DEFAUT));
  const planchier = new Date(maintenant);
  planchier.setDate(planchier.getDate() - (ctx.retardJours ?? RETARD_DEFAUT));

  const modeleById = new Map(ctx.modeles.map((m) => [m.id, m]));
  const profileById = new Map(ctx.profiles.map((p) => [p.id, p]));
  const pdvById = new Map(ctx.pdvs.map((p) => [p.id, p]));
  const ficheById = new Map(ctx.fiches.map((f) => [f.id, f]));

  const etapesParSequence = new Map<string, SequenceEtapeRow[]>();
  for (const etape of ctx.etapes) {
    if (!etape.actif) continue;
    const liste = etapesParSequence.get(etape.sequence_id) ?? [];
    liste.push(etape);
    etapesParSequence.set(etape.sequence_id, liste);
  }
  for (const liste of etapesParSequence.values()) {
    liste.sort((a, b) => a.ordre - b.ordre);
  }

  const file: EnvoiPlanifie[] = [];

  for (const sequence of ctx.sequences) {
    if (!sequence.actif) continue;
    const etapes = (etapesParSequence.get(sequence.id) ?? []).slice(
      0,
      sequence.max_messages,
    );
    if (etapes.length === 0) continue;

    /** Un couple (fiche, base) est un « sujet » : ce sur quoi la séquence court. */
    const sujets: Array<{ fiche: FicheRow; base: Date; rdv: RendezVousRow | null }> = [];

    if (DECLENCHEURS_SUR_RDV.includes(sequence.declencheur)) {
      for (const rdv of ctx.rdv) {
        const fiche = rdv.fiche_id ? ficheById.get(rdv.fiche_id) : undefined;
        // Un point hebdo interne n'a pas de client à prévenir.
        if (!fiche || rdv.type === "interne") continue;
        // Et on ne rappelle pas un rendez-vous déjà passé : la fenêtre de
        // retard, utile pour les relances, n'a aucun sens ici.
        const debut = new Date(rdv.debut);
        if (debut < maintenant) continue;
        sujets.push({ fiche, base: debut, rdv });
      }
    } else {
      for (const fiche of ctx.fiches) {
        // Une séquence de showroom ne parle qu'aux fiches de son showroom.
        if (
          sequence.point_de_vente_id &&
          sequence.point_de_vente_id !== fiche.point_de_vente_id
        ) {
          continue;
        }
        const base = dateBase(sequence, fiche, maintenant);
        if (base) sujets.push({ fiche, base, rdv: null });
      }
    }

    for (const { fiche, base, rdv } of sujets) {
      const conseiller = profileById.get(fiche.conseiller_id) ?? null;
      const pdv = pdvById.get(fiche.point_de_vente_id) ?? null;
      const destinataire = normaliserTelephone(fiche.tel_mobile);
      const variables = variablesPour(fiche, conseiller, pdv, rdv, ctx.locale);

      for (const etape of etapes) {
        const modele = modeleById.get(etape.modele_id);
        if (!modele || !modele.actif) continue;

        const brut = new Date(base);
        brut.setDate(brut.getDate() + etape.delai_jours);
        brut.setHours(brut.getHours() + etape.delai_heures);
        const planifieLe = calerDansFenetre(brut, sequence);

        if (planifieLe < planchier || planifieLe > horizon) continue;

        const corps = rendreMessage(modele.corps, variables);
        const manquantes = variablesUtilisees(modele.corps).some(
          (v) => !variables[v as VariableMessage]?.trim(),
        );

        file.push({
          cle: `${fiche.id}:${etape.id}${rdv ? `:${rdv.id}` : ""}`,
          sequence,
          etape,
          modele,
          fiche,
          rdv,
          conseiller,
          destinataire,
          corps,
          planifieLe,
          enRetard: planifieLe < maintenant,
          blocage: !destinataire
            ? "sans_telephone"
            : manquantes
              ? "variables_manquantes"
              : null,
        });
      }
    }
  }

  return file.sort((a, b) => a.planifieLe.getTime() - b.planifieLe.getTime());
}

/** Regroupe la file par journée calendaire, pour l'affichage. */
export function grouperParJour(
  file: EnvoiPlanifie[],
): Array<{ jour: string; envois: EnvoiPlanifie[] }> {
  const groupes = new Map<string, EnvoiPlanifie[]>();
  for (const envoi of file) {
    const d = envoi.planifieLe;
    const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    const liste = groupes.get(jour) ?? [];
    liste.push(envoi);
    groupes.set(jour, liste);
  }
  return [...groupes.entries()].map(([jour, envois]) => ({ jour, envois }));
}

/**
 * Combien de messages réclament une action maintenant : ceux déjà en retard,
 * et ceux qui partent dans les vingt-quatre heures.
 *
 * C'est le chiffre de la pastille d'onglet — pas le total de la file, qui
 * court sur trois semaines et n'apprendrait rien d'actionnable.
 */
export function compterAAgir(
  messages: ReadonlyArray<{ etat: string; horodatage: string }>,
): number {
  const limite = Date.now() + 86_400_000;
  return messages.filter(
    (m) =>
      (m.etat === "programme" || m.etat === "en_retard") &&
      new Date(m.horodatage).getTime() <= limite,
  ).length;
}

/** Le délai d'une étape, tel qu'on l'écrit sur la frise : J+3, J−1, J+0 2 h. */
export function libelleDelai(etape: {
  delai_jours: number;
  delai_heures: number;
}): string {
  const jours = etape.delai_jours;
  const heures = etape.delai_heures;
  const signeJours = jours < 0 ? "−" : "+";
  const base = `J${signeJours}${Math.abs(jours)}`;
  if (heures === 0) return base;
  const signeHeures = heures < 0 ? "−" : "+";
  return `${base} ${signeHeures}${Math.abs(heures)} h`;
}
