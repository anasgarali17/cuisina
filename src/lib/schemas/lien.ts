import { z } from "zod";
import {
  LIEN_AUDIENCES,
  SUBMISSION_STATUTS,
  TYPES_PROJET,
} from "@/lib/domain";
import { locales } from "@/i18n/routing";
import {
  ficheIdentiteSchema,
  ficheOrigineSchema,
  ficheProjetSchema,
} from "@/lib/schemas/fiche";

/**
 * Ce que le client remplit derrière le QR code : les trois premières étapes
 * de la FO-COM-02. Les Exigences Client (finitions, électroménager) restent
 * un travail de showroom — on ne les demande pas à quelqu'un sur son
 * téléphone, on les remplit avec lui, plan sous les yeux.
 */
/**
 * Ce que le client dit vouloir, à l'étape 2.
 *
 * Rien n'est obligatoire : c'est un vœu, pas une commande. L'intérêt est que
 * le commercial arrive au rendez-vous en sachant déjà de quoi on parle — un
 * rendez-vous préparé se conclut, un rendez-vous découvert se reporte.
 *
 * Les identifiants (`modele`, `facade`, coloris) viennent du catalogue et n'y
 * sont pas revalidés : le catalogue bouge au rythme des collections, et une
 * demande ne doit pas être refusée parce qu'un modèle a été renommé entre le
 * moment où le client a ouvert la page et celui où il a validé.
 */
export const souhaitsSchema = z.object({
  type_projet: z.enum(TYPES_PROJET),
  modele: z.string().max(40).nullable().default(null),
  facade: z.string().max(40).nullable().default(null),
  couleurs: z.array(z.string().max(40)).max(8).default([]),
  /** Croquis libre du client, en data URL PNG. */
  croquis: z.string().max(600_000).nullable().default(null),
  /** Chemins des photos déjà déposées dans le bucket public. */
  photos: z.array(z.string().max(500)).max(6).default([]),
  commentaire: z.string().max(1000).default(""),
});
export type Souhaits = z.infer<typeof souhaitsSchema>;

export const publicFicheSchema = z.object({
  identite: ficheIdentiteSchema,
  origine: ficheOrigineSchema,
  projet: ficheProjetSchema,
  /** Le showroom choisi par le client, par zone puis par nom. */
  point_de_vente_id: z.string().uuid().nullable().default(null),
  souhaits: souhaitsSchema,
  /**
   * Rempli seulement quand le client veut une cuisine ET un dressing : la
   * cuisine occupe déjà `souhaits`, le dressing voyage à part. Même
   * convention que la fiche interne — voir `details_dressing` dans
   * `exigencesSchema`.
   */
  souhaits_dressing: z
    .object({
      modele: z.string().max(40).nullable().default(null),
      couleurs: z.array(z.string().max(40)).max(8).default([]),
    })
    .nullable()
    .default(null),
});
export type PublicFiche = z.infer<typeof publicFicheSchema>;

export const submitPublicSchema = z.object({
  token: z.string().min(8).max(40),
  payload: publicFicheSchema,
});

export const createLienSchema = z.object({
  libelle: z.string().min(2, "libelle_requis").max(120),
  audience: z.enum(LIEN_AUDIENCES).default("client"),
  conseiller_id: z.string().uuid(),
  point_de_vente_id: z.string().uuid(),
  locale: z.enum(locales).default("fr"),
  /** Nul = le lien ne périme pas ; utile pour l'affiche permanente du showroom. */
  expire_le: z.string().date().nullable().default(null),
});
export type CreateLien = z.infer<typeof createLienSchema>;

export const toggleLienSchema = z.object({
  id: z.string().uuid(),
  actif: z.boolean(),
});

/**
 * Le verdict. « En attente » n'est pas un non-choix : c'est l'état du client
 * qui a dit « je vais voir » — la demande reste sur le dessus de la pile.
 */
export const decisionSchema = z.object({
  submission_id: z.string().uuid(),
  statut: z.enum(SUBMISSION_STATUTS),
  note: z.string().max(500).default(""),
  /** À l'acceptation : à qui confier le lead. Nul = le conseiller du lien. */
  conseiller_id: z.string().uuid().nullable().default(null),
});
export type Decision = z.infer<typeof decisionSchema>;
