import { z } from "zod";
import { locales } from "@/i18n/routing";
import {
  ALL_STAGES,
  DECLENCHEURS,
  ENVOI_STATUTS,
  LONGUEUR_MESSAGE_MAX,
  MODELE_CATEGORIES,
  SEQUENCE_MODES,
} from "@/lib/domain";
import { variablesInconnues } from "@/lib/whatsapp";

/* — Modèles — */

/**
 * Le corps d'un message. La seule règle qui compte : pas de variable
 * inventée. `{{prix_final}}` n'existe pas côté données — il partirait chez le
 * client accolades comprises, et personne ne le verrait avant lui.
 */
const corpsSchema = z
  .string()
  .min(2, "corps_requis")
  .max(LONGUEUR_MESSAGE_MAX, "corps_trop_long")
  .refine((corps) => variablesInconnues(corps).length === 0, {
    message: "variable_inconnue",
  });

export const modeleSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "code_invalide"),
  libelle: z.string().min(2, "libelle_requis").max(120),
  categorie: z.enum(MODELE_CATEGORIES).default("relance"),
  locale: z.enum(locales).default("fr"),
  corps: corpsSchema,
  point_de_vente_id: z.string().uuid().nullable().default(null),
});
export type ModeleInput = z.infer<typeof modeleSchema>;

export const updateModeleSchema = modeleSchema
  .partial()
  .extend({ id: z.string().uuid() });

/* — Séquences — */

/**
 * Une étape porte son décalage et son texte. Le décalage peut être négatif :
 * c'est ainsi qu'on rappelle un rendez-vous la veille.
 */
export const etapeSchema = z.object({
  ordre: z.number().int().min(1).max(12),
  delai_jours: z.number().int().min(-30).max(365).default(0),
  delai_heures: z.number().int().min(-23).max(23).default(0),
  modele_id: z.string().uuid(),
  actif: z.boolean().default(true),
});
export type EtapeInput = z.infer<typeof etapeSchema>;

export const sequenceSchema = z
  .object({
    nom: z.string().min(2, "nom_requis").max(120),
    description: z.string().max(500).default(""),
    declencheur: z.enum(DECLENCHEURS),
    stage_cible: z.enum(ALL_STAGES).nullable().default(null),
    seuil_jours: z.number().int().min(0).max(365).default(0),
    mode: z.enum(SEQUENCE_MODES).default("simulation"),
    actif: z.boolean().default(true),
    fenetre_debut: z.number().int().min(0).max(23).default(9),
    fenetre_fin: z.number().int().min(1).max(24).default(19),
    exclure_dimanche: z.boolean().default(false),
    exclure_vendredi: z.boolean().default(false),
    stop_si_reponse: z.boolean().default(true),
    stop_si_stage_change: z.boolean().default(true),
    max_messages: z.number().int().min(1).max(12).default(4),
    point_de_vente_id: z.string().uuid().nullable().default(null),
    etapes: z.array(etapeSchema).min(1, "etapes_requises").max(12),
  })
  .refine((s) => s.fenetre_fin > s.fenetre_debut, {
    message: "fenetre_invalide",
    path: ["fenetre_fin"],
  })
  // Une séquence « étape atteinte » sans étape cible ne se déclencherait
  // jamais : autant le dire à l'enregistrement plutôt qu'au silence.
  .refine((s) => s.declencheur !== "stage_atteint" || s.stage_cible !== null, {
    message: "stage_cible_requis",
    path: ["stage_cible"],
  });
export type SequenceInput = z.infer<typeof sequenceSchema>;

export const updateSequenceSchema = z.object({
  id: z.string().uuid(),
  patch: sequenceSchema,
});

export const toggleSequenceSchema = z.object({
  id: z.string().uuid(),
  actif: z.boolean(),
});

/**
 * Le basculement simulation → actif. Isolé de la mise à jour générale : ce
 * n'est pas un champ parmi d'autres, c'est le moment où l'outil se met à
 * parler aux clients tout seul.
 */
export const modeSequenceSchema = z.object({
  id: z.string().uuid(),
  mode: z.enum(SEQUENCE_MODES),
});

export const deleteSequenceSchema = z.object({ id: z.string().uuid() });

/* — Journal — */

/**
 * Ce qu'on écrit quand un conseiller a envoyé le message à la main depuis la
 * file d'attente. Le corps rendu est archivé tel quel : le modèle sera
 * réécrit, le message parti ne le sera pas.
 */
export const journaliserEnvoiSchema = z.object({
  sequence_id: z.string().uuid().nullable().default(null),
  etape_id: z.string().uuid().nullable().default(null),
  fiche_id: z.string().uuid(),
  destinataire: z.string().min(8).max(20),
  corps_rendu: z.string().min(1).max(LONGUEUR_MESSAGE_MAX),
  statut: z.enum(ENVOI_STATUTS).default("envoye"),
  planifie_le: z.string().datetime(),
});
export type JournaliserEnvoi = z.infer<typeof journaliserEnvoiSchema>;
