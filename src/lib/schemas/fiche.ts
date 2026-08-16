import { z } from "zod";
import {
  MOTIFS_PAUSE,
  MOTIFS_PERTE,
  ORIGINES,
  ORIGINE_DETAILS,
  ALL_STAGES,
  TYPES_CAISSON_DRESSING,
} from "@/lib/domain";

/* — Step 4 : Exigences Client (stored as jsonb) — */

export const finitionFacadeSchema = z.object({
  type: z.enum(["bois_massif", "laque", "pvc"]).nullable().default(null),
  type_detail: z.string().max(200).default(""),
  caisson: z.string().max(200).default(""),
  decor_facade: z.string().max(200).default(""),
});

export const electromenagerSchema = z.object({
  evier: z.enum(["1_bac", "2_bac"]).nullable().default(null),
  plaque: z.enum(["4F", "5F", "coin"]).nullable().default(null),
  hotte: z.enum(["60", "90", "coin", "centrale"]).nullable().default(null),
  four: z.enum(["encastrable", "non_encastrable"]).nullable().default(null),
  four_taille: z.enum(["60", "90"]).nullable().default(null),
  micro_onde: z.enum(["encastrable", "non_encastrable"]).nullable().default(null),
  frigo: z.enum(["encastrable", "non_encastrable"]).nullable().default(null),
  frigo_autres: z.string().max(200).default(""),
  lave_vaisselle: z
    .enum(["encastrable", "non_encastrable"])
    .nullable()
    .default(null),
  electro_autres: z.string().max(500).default(""),
});

export const detailsCuisineSchema = z.object({
  avec_retour: z.boolean().nullable().default(null),
  ilot_central: z.boolean().nullable().default(null),
  autres_details: z.string().max(500).default(""),
});

/**
 * Ce qui manquait côté dressing : la matière du caisson (la façade et ses
 * coloris sont déjà couverts par `ChoixModele`) et ce que le client cherche à
 * ranger, en texte libre — un dressing se décrit par son usage, pas par un
 * formulaire fermé.
 */
export const detailsDressingSchema = z.object({
  type_caisson: z.enum(TYPES_CAISSON_DRESSING).nullable().default(null),
  description_besoins: z.string().max(500).default(""),
});

export const exigencesSchema = z.object({
  finition_facade: finitionFacadeSchema.default(finitionFacadeSchema.parse({})),
  electromenager: electromenagerSchema.default(electromenagerSchema.parse({})),
  details_cuisine: detailsCuisineSchema.default(detailsCuisineSchema.parse({})),
  details_dressing: detailsDressingSchema.default(detailsDressingSchema.parse({})),
});
export type Exigences = z.infer<typeof exigencesSchema>;

export const EXIGENCES_VIDES: Exigences = exigencesSchema.parse({});

/* — Steps 1–3 — */

const telephone = z
  .string()
  .max(20)
  .regex(/^[0-9+ ]*$/, "telephone_invalide");

/**
 * Deux champs obligatoires, pas un de plus : un nom et un téléphone.
 *
 * Tout le reste attend. Exiger l'adresse ou l'origine au premier contact
 * bloquait la saisie au moment précis où le conseiller a le client au
 * téléphone et trois secondes devant lui — la fiche ne se créait pas, et
 * l'information qu'on avait se perdait avec celle qu'on n'avait pas.
 */
export const ficheIdentiteSchema = z.object({
  client_nom: z.string().min(2, "nom_requis").max(120),
  tel_domicile: telephone.default(""),
  tel_bureau: telephone.default(""),
  tel_mobile: telephone.min(8, "mobile_requis"),
  /** Le mobile est joignable sur WhatsApp — aucune ressaisie du numéro. */
  whatsapp: z.boolean().default(false),
  email: z.union([z.literal(""), z.string().email("email_invalide")]).default(""),
  adresse_complete: z.string().max(300).default(""),
  ville: z.string().max(80).default(""),
});

export const ficheOrigineSchema = z
  .object({
    origine: z.enum(ORIGINES).nullable().default(null),
    origine_detail: z.string().nullable().default(null),
  })
  .refine(
    (v) => {
      // Le détail n'est vérifié que s'il a été saisi : l'origine elle-même
      // n'est plus obligatoire, son détail ne peut pas l'être davantage.
      if (!v.origine || v.origine_detail == null) return true;
      const details = ORIGINE_DETAILS[v.origine];
      return !details || details.includes(v.origine_detail);
    },
    { message: "origine_detail_requise", path: ["origine_detail"] },
  );

export const ficheProjetSchema = z.object({
  nb_cuisines: z.coerce.number().int().min(0).max(20).default(0),
  nb_dressings: z.coerce.number().int().min(0).max(20).default(0),
  date_livraison_souhaitee: z.string().date().nullable().default(null),
  budget_estimatif: z.coerce.number().min(0).max(999_999).nullable().default(null),
});

/** Full wizard payload — used by the create/update Server Actions. */
export const fichePayloadSchema = z.object({
  identite: ficheIdentiteSchema,
  origine: ficheOrigineSchema,
  projet: ficheProjetSchema,
  exigences: exigencesSchema,
});
export type FichePayload = z.infer<typeof fichePayloadSchema>;

/** Draft payload — everything optional except a name to hang the draft on. */
export const ficheDraftSchema = z.object({
  identite: ficheIdentiteSchema.partial().extend({
    client_nom: z.string().min(2).max(120),
  }),
  origine: z
    .object({
      origine: z.enum(ORIGINES).nullable().default(null),
      origine_detail: z.string().nullable().default(null),
    })
    .default({ origine: null, origine_detail: null }),
  projet: ficheProjetSchema.partial().default({}),
  exigences: exigencesSchema.default(EXIGENCES_VIDES),
  /** Signature du client, en data URL PNG. Null tant qu'elle n'est pas posée. */
  signature: z.string().max(400_000).nullable().default(null),
  /** Modèle du catalogue et ses coloris — voir src/lib/catalogue.ts. */
  modele: z.string().max(40).nullable().default(null),
  couleurs: z.array(z.string().max(60)).max(20).default([]),
});
export type FicheDraft = z.infer<typeof ficheDraftSchema>;

export const stageChangeSchema = z
  .object({
    fiche_id: z.string().uuid(),
    stage: z.enum(ALL_STAGES),
    /** Preset loss reason, or "autre" when a free-text reason is given. */
    motif_perte: z.enum(MOTIFS_PERTE).nullable().default(null),
    /** Free-text loss reason typed by the conseiller. */
    motif_perte_libre: z.string().max(200).default(""),
    /** Pause reason + re-check cadence. */
    motif_pause: z.enum(MOTIFS_PAUSE).nullable().default(null),
    motif_pause_detail: z.string().max(200).default(""),
    pause_cadence_jours: z.coerce.number().int().min(1).max(365).nullable().default(null),
    /** Persist the free-text reason so it appears in the list next time. */
    enregistrer_motif: z.boolean().default(false),
  })
  .refine(
    (v) =>
      v.stage !== "perdu" ||
      v.motif_perte != null ||
      v.motif_perte_libre.trim().length > 0,
    { message: "motif_perte_requis", path: ["motif_perte"] },
  )
  .refine((v) => v.stage !== "en_pause" || v.motif_pause != null, {
    message: "motif_pause_requis",
    path: ["motif_pause"],
  });

/* — Métré sketch — vector shapes on a 1000×700 logical canvas — */

export const CROQUIS_W = 1000;
export const CROQUIS_H = 700;

const point = z.object({ x: z.number(), y: z.number() });

export const croquisShapeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("trait"),
    points: z.array(point).min(2).max(4000),
    couleur: z.string().max(20),
    epaisseur: z.number().min(1).max(20),
  }),
  z.object({
    type: z.literal("rectangle"),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    couleur: z.string().max(20),
    epaisseur: z.number().min(1).max(20),
  }),
  z.object({
    type: z.literal("ligne"),
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    couleur: z.string().max(20),
    epaisseur: z.number().min(1).max(20),
    /** Cotation shown at the midpoint, e.g. "3,20 m". */
    cote: z.string().max(24).default(""),
  }),
  z.object({
    type: z.literal("texte"),
    x: z.number(),
    y: z.number(),
    contenu: z.string().min(1).max(80),
    couleur: z.string().max(20),
  }),
  /**
   * Porte et fenêtre — les ouvertures qu'un relevé doit porter.
   *
   * Toutes deux se posent en tirant le long du mur : le segment donne à la
   * fois la position, la largeur et l'orientation, sans poignée à régler
   * ensuite. `sens` fait basculer le battant d'un côté ou de l'autre, parce
   * qu'une porte qui ouvre du mauvais côté change l'implantation des meubles.
   *
   * `variante` distingue les usages du même symbole de base : une porte peut
   * être simple, double (deux vantaux) ou coulissante (pas de débattement) ;
   * une fenêtre peut être simple, double (un meneau central) ou une baie
   * vitrée (l'ouverture pleine hauteur). Absente sur un croquis déjà
   * enregistré, elle vaut « simple » — l'ancien tracé reste ce qu'il était.
   */
  z.object({
    type: z.literal("porte"),
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    sens: z.union([z.literal(1), z.literal(-1)]).default(1),
    variante: z.enum(["simple", "double", "coulissante"]).default("simple"),
    couleur: z.string().max(20),
    epaisseur: z.number().min(1).max(20),
    cote: z.string().max(24).default(""),
  }),
  z.object({
    type: z.literal("fenetre"),
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    variante: z.enum(["simple", "double", "baie"]).default("simple"),
    couleur: z.string().max(20),
    epaisseur: z.number().min(1).max(20),
    cote: z.string().max(24).default(""),
  }),
  /** Le nord — un repère posé d'un clic, pas tiré : une orientation, pas une mesure. */
  z.object({
    type: z.literal("nord"),
    x: z.number(),
    y: z.number(),
    couleur: z.string().max(20),
  }),
]);
export type CroquisShape = z.infer<typeof croquisShapeSchema>;

export const croquisSchema = z.object({
  v: z.literal(1).default(1),
  shapes: z.array(croquisShapeSchema).max(500),
});
export type Croquis = z.infer<typeof croquisSchema>;

export const saveCroquisSchema = z.object({
  fiche_id: z.string().uuid(),
  croquis: croquisSchema,
});

/** Adding a reusable custom reason from the pipeline dialogs. */
export const motifPersonnaliseSchema = z.object({
  type: z.enum(["perte", "pause"]),
  libelle: z.string().min(2).max(120),
});

export const suiviSchema = z.object({
  fiche_id: z.string().uuid(),
  date_prevue_remise_devis: z.string().date().nullable(),
  date_effective_remise_devis: z.string().date().nullable(),
  date_prete_devis: z.string().date().nullable().default(null),
  remarques_client: z.string().max(1000).default(""),
});

/* — Completion score : % of filled fields across the whole fiche — */

export function computeScoreCompletude(payload: FicheDraft): number {
  const flags: boolean[] = [];
  const id = payload.identite;
  flags.push(
    Boolean(id.client_nom?.trim()),
    Boolean(id.tel_mobile?.trim()),
    Boolean(id.tel_domicile?.trim()),
    Boolean(id.email?.trim()),
    Boolean(id.adresse_complete?.trim()),
    Boolean(id.ville?.trim()),
  );
  flags.push(Boolean(payload.origine.origine));
  const p = payload.projet;
  flags.push(
    (p.nb_cuisines ?? 0) + (p.nb_dressings ?? 0) > 0,
    p.date_livraison_souhaitee != null,
  );
  flags.push(payload.signature != null);
  // Le modèle et au moins un coloris : c'est ce qu'un dossier complet porte.
  flags.push(payload.modele != null, (payload.couleurs?.length ?? 0) > 0);
  const ex = payload.exigences;
  flags.push(
    ex.finition_facade.type != null,
    Boolean(ex.finition_facade.caisson.trim()),
    Boolean(ex.finition_facade.decor_facade.trim()),
    ex.electromenager.evier != null,
    ex.electromenager.plaque != null,
    ex.electromenager.hotte != null,
    ex.electromenager.four != null,
    ex.electromenager.micro_onde != null,
    ex.electromenager.frigo != null,
    ex.electromenager.lave_vaisselle != null,
    ex.details_cuisine.avec_retour != null,
    ex.details_cuisine.ilot_central != null,
  );
  const filled = flags.filter(Boolean).length;
  return Math.round((filled / flags.length) * 100);
}
