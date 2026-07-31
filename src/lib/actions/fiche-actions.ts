"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { getCurrentProfile } from "@/lib/auth";
import {
  computeScoreCompletude,
  ficheDraftSchema,
  stageChangeSchema,
  suiviSchema,
} from "@/lib/schemas/fiche";
import { CANAUX, RELANCE_RESULTATS } from "@/lib/domain";
import type { FicheRow } from "@/lib/database.types";
import { type ActionResult, fail, succeed } from "./result";

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const saveFicheSchema = z.object({
  id: z.string().uuid().nullable(),
  draft: ficheDraftSchema,
});

export interface SavedFiche {
  id: string;
  reference: string;
  score: number;
}

/** Creates or updates a fiche from the wizard (drafts included — autosave). */
export async function saveFiche(
  input: unknown,
): Promise<ActionResult<SavedFiche>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = saveFicheSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");
  if (!profile.point_de_vente_id && profile.role === "conseiller") {
    return fail("no_point_de_vente");
  }

  const { id, draft } = parsed.data;
  const score = computeScoreCompletude(draft);
  const row = {
    client_nom: draft.identite.client_nom,
    tel_domicile: draft.identite.tel_domicile ?? null,
    tel_mobile: draft.identite.tel_mobile ?? null,
    email: draft.identite.email || null,
    adresse_complete: draft.identite.adresse_complete ?? null,
    code_postal: draft.identite.code_postal ?? null,
    ville: draft.identite.ville ?? null,
    origine: draft.origine.origine,
    origine_detail: draft.origine.origine_detail,
    nb_cuisines: draft.projet.nb_cuisines ?? 0,
    nb_dressings: draft.projet.nb_dressings ?? 0,
    nb_sdb: draft.projet.nb_sdb ?? 0,
    etat_chantier: draft.projet.etat_chantier ?? null,
    budget_estimatif: draft.projet.budget_estimatif ?? null,
    date_livraison_souhaitee: draft.projet.date_livraison_souhaitee ?? null,
    observations: draft.projet.observations || null,
    exigences: draft.exigences,
    score_completude: score,
  };

  const supabase = await createClient();

  if (id) {
    const { data, error } = await supabase
      .from("fiches_contact")
      .update(row)
      .eq("id", id)
      .select("id, reference")
      .single();
    if (error || !data) return fail("db");
    revalidatePath("/", "layout");
    return succeed({ id: data.id, reference: data.reference, score });
  }

  const { data, error } = await supabase
    .from("fiches_contact")
    .insert({
      ...row,
      conseiller_id: profile.id,
      point_de_vente_id: profile.point_de_vente_id ?? "",
    })
    .select("id, reference")
    .single();
  if (error || !data) return fail("db");
  revalidatePath("/", "layout");
  return succeed({ id: data.id, reference: data.reference, score });
}

/**
 * Moves a fiche through the pipeline: persists the stage, writes history,
 * generates relance tasks (contacté → J+3 · devis envoyé → J+3 and J+7)
 * and creates the client record on signature.
 */
export async function changeStage(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = stageChangeSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const { fiche_id, stage, motif_perte } = parsed.data;
  const supabase = await createClient();

  const { data: fiche } = await supabase
    .from("fiches_contact")
    .select("*")
    .eq("id", fiche_id)
    .single();
  if (!fiche) return fail("not_found");
  if (fiche.stage === stage) return succeed(undefined);

  const typedFiche = fiche as FicheRow;

  const { error: updateError } = await supabase
    .from("fiches_contact")
    .update({
      stage,
      motif_perte: stage === "perdu" ? motif_perte : null,
    })
    .eq("id", fiche_id);
  if (updateError) return fail("db");

  const { error: histError } = await supabase.from("fiche_historique").insert({
    fiche_id,
    stage_from: typedFiche.stage,
    stage_to: stage,
    user_id: profile.id,
  });
  if (histError) return fail("db");

  // Auto-generated relances — the digital heir of the paper's five contact lines.
  const today = new Date();
  const relanceOffsets =
    stage === "contacte" ? [3] : stage === "devis_envoye" ? [3, 7] : [];
  if (relanceOffsets.length > 0) {
    await supabase.from("taches").insert(
      relanceOffsets.map((offset) => ({
        titre: `Relance ${typedFiche.client_nom}`,
        echeance: addDays(today, offset),
        priorite: "haute" as const,
        fiche_id,
        assigne_a: typedFiche.conseiller_id,
        cree_par: profile.id,
        auto_generee: true,
        canal: "appel" as const,
      })),
    );
  }

  if (stage === "signe" && !typedFiche.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .insert({
        nom: typedFiche.client_nom,
        tel: typedFiche.tel_mobile,
        email: typedFiche.email,
        adresse: typedFiche.adresse_complete,
        ville: typedFiche.ville,
        ca_cumule: typedFiche.budget_estimatif ?? 0,
        nb_projets: 1,
        point_de_vente_id: typedFiche.point_de_vente_id,
      })
      .select("id")
      .single();
    if (client) {
      await supabase
        .from("fiches_contact")
        .update({ client_id: client.id })
        .eq("id", fiche_id);
    }
  }

  revalidatePath("/", "layout");
  return succeed(undefined);
}

export async function updateSuivi(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = suiviSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const supabase = await createClient();
  const { error } = await supabase
    .from("fiches_contact")
    .update({
      date_prevue_remise_devis: parsed.data.date_prevue_remise_devis,
      date_effective_remise_devis: parsed.data.date_effective_remise_devis,
    })
    .eq("id", parsed.data.fiche_id);
  if (error) return fail("db");
  revalidatePath("/", "layout");
  return succeed(undefined);
}

const relanceSchema = z.object({
  fiche_id: z.string().uuid(),
  canal: z.enum(CANAUX),
  resultat: z.enum(RELANCE_RESULTATS),
  commentaire: z.string().max(500).default(""),
  tache_id: z.string().uuid().nullable().default(null),
  prochaine_relance: z.string().date().nullable().default(null),
});

/** Logs a relance, completes its task and optionally schedules the next one. */
export async function logRelance(
  input: unknown,
): Promise<ActionResult<{ numero: number }>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = relanceSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const { fiche_id, canal, resultat, commentaire, tache_id, prochaine_relance } =
    parsed.data;
  const supabase = await createClient();

  const { count } = await supabase
    .from("fiche_relances")
    .select("id", { count: "exact", head: true })
    .eq("fiche_id", fiche_id);
  const numero = Math.min((count ?? 0) + 1, 5);

  const { error } = await supabase.from("fiche_relances").insert({
    fiche_id,
    numero_contact: numero,
    canal,
    resultat,
    commentaire: commentaire || null,
    user_id: profile.id,
  });
  if (error) return fail("db");

  if (tache_id) {
    await supabase.from("taches").update({ statut: "fait" }).eq("id", tache_id);
  }

  if (prochaine_relance) {
    const { data: fiche } = await supabase
      .from("fiches_contact")
      .select("client_nom, conseiller_id")
      .eq("id", fiche_id)
      .single();
    if (fiche) {
      await supabase.from("taches").insert({
        titre: `Relance ${fiche.client_nom}`,
        echeance: prochaine_relance,
        priorite: "haute",
        fiche_id,
        assigne_a: fiche.conseiller_id,
        cree_par: profile.id,
        auto_generee: true,
        canal,
      });
    }
  }

  revalidatePath("/", "layout");
  return succeed({ numero });
}

const photoSchema = z.object({
  fiche_id: z.string().uuid(),
  path: z.string().min(1).max(500),
});

export async function setFichePhoto(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = photoSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const supabase = await createClient();
  const { error } = await supabase
    .from("fiches_contact")
    .update({ photo_fiche_url: parsed.data.path })
    .eq("id", parsed.data.fiche_id);
  if (error) return fail("db");
  revalidatePath("/", "layout");
  return succeed(undefined);
}
