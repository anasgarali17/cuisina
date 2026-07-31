import { z } from "zod";
import {
  ETATS_CHANTIER,
  MOTIFS_PERTE,
  ORIGINES,
  ORIGINE_DETAILS,
  ALL_STAGES,
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

export const exigencesSchema = z.object({
  finition_facade: finitionFacadeSchema.default(finitionFacadeSchema.parse({})),
  electromenager: electromenagerSchema.default(electromenagerSchema.parse({})),
  details_cuisine: detailsCuisineSchema.default(detailsCuisineSchema.parse({})),
});
export type Exigences = z.infer<typeof exigencesSchema>;

export const EXIGENCES_VIDES: Exigences = exigencesSchema.parse({});

/* — Steps 1–3 — */

const telephone = z
  .string()
  .max(20)
  .regex(/^[0-9+ ]*$/, "telephone_invalide");

export const ficheIdentiteSchema = z.object({
  client_nom: z.string().min(2, "nom_requis").max(120),
  tel_domicile: telephone.default(""),
  tel_mobile: telephone.min(8, "mobile_requis"),
  email: z.union([z.literal(""), z.string().email("email_invalide")]).default(""),
  adresse_complete: z.string().max(300).default(""),
  code_postal: z.string().max(10).default(""),
  ville: z.string().max(80).default(""),
});

export const ficheOrigineSchema = z
  .object({
    origine: z.enum(ORIGINES, { message: "origine_requise" }),
    origine_detail: z.string().nullable().default(null),
  })
  .refine(
    (v) => {
      const details = ORIGINE_DETAILS[v.origine];
      if (!details) return true;
      return v.origine_detail != null && details.includes(v.origine_detail);
    },
    { message: "origine_detail_requise", path: ["origine_detail"] },
  );

export const ficheProjetSchema = z.object({
  nb_cuisines: z.coerce.number().int().min(0).max(20).default(0),
  nb_dressings: z.coerce.number().int().min(0).max(20).default(0),
  nb_sdb: z.coerce.number().int().min(0).max(20).default(0),
  etat_chantier: z.enum(ETATS_CHANTIER).nullable().default(null),
  budget_estimatif: z.coerce.number().positive().max(10_000_000).nullable().default(null),
  date_livraison_souhaitee: z.string().date().nullable().default(null),
  observations: z.string().max(2000).default(""),
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
});
export type FicheDraft = z.infer<typeof ficheDraftSchema>;

export const stageChangeSchema = z
  .object({
    fiche_id: z.string().uuid(),
    stage: z.enum(ALL_STAGES),
    motif_perte: z.enum(MOTIFS_PERTE).nullable().default(null),
  })
  .refine((v) => v.stage !== "perdu" || v.motif_perte != null, {
    message: "motif_perte_requis",
    path: ["motif_perte"],
  });

export const suiviSchema = z.object({
  fiche_id: z.string().uuid(),
  date_prevue_remise_devis: z.string().date().nullable(),
  date_effective_remise_devis: z.string().date().nullable(),
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
    Boolean(id.code_postal?.trim()),
    Boolean(id.ville?.trim()),
  );
  flags.push(Boolean(payload.origine.origine));
  const p = payload.projet;
  flags.push(
    (p.nb_cuisines ?? 0) + (p.nb_dressings ?? 0) + (p.nb_sdb ?? 0) > 0,
    p.etat_chantier != null,
    p.budget_estimatif != null,
    p.date_livraison_souhaitee != null,
    Boolean(p.observations?.trim()),
  );
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
