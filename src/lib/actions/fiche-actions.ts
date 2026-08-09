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
import { CADENCE_PAR_MOTIF, CANAUX, RELANCE_RESULTATS } from "@/lib/domain";
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
    tel_bureau: draft.identite.tel_bureau ?? null,
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
 * Moves a fiche through the pipeline and wires the consequences across the
 * app: history, auto-relances (contacté → J+3 · devis envoyé → J+3/J+7),
 * the client record on signature, and — for a parked lead — a recurring
 * WhatsApp check-in at the chosen cadence. Any open auto-relance is closed
 * when a fiche leaves the active funnel, so Mes Tâches never nags about a
 * lead that is paused or lost.
 */
export async function changeStage(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = stageChangeSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const {
    fiche_id,
    stage,
    motif_perte,
    motif_perte_libre,
    motif_pause,
    motif_pause_detail,
    pause_cadence_jours,
    enregistrer_motif,
  } = parsed.data;
  const supabase = await createClient();

  const { data: fiche } = await supabase
    .from("fiches_contact")
    .select(
      "id, stage, client_nom, tel_mobile, email, adresse_complete, ville, budget_estimatif, conseiller_id, point_de_vente_id, client_id",
    )
    .eq("id", fiche_id)
    .single();
  if (!fiche) return fail("not_found");
  if (fiche.stage === stage) return succeed(undefined);

  const typedFiche = fiche as Pick<
    FicheRow,
    | "id"
    | "stage"
    | "client_nom"
    | "tel_mobile"
    | "email"
    | "adresse_complete"
    | "ville"
    | "budget_estimatif"
    | "conseiller_id"
    | "point_de_vente_id"
    | "client_id"
  >;

  const today = new Date();
  const cadence =
    stage === "en_pause"
      ? (pause_cadence_jours ??
        (motif_pause ? CADENCE_PAR_MOTIF[motif_pause] : 14))
      : null;

  const { error: updateError } = await supabase
    .from("fiches_contact")
    .update({
      stage,
      motif_perte: stage === "perdu" ? motif_perte : null,
      motif_perte_libre:
        stage === "perdu" && motif_perte_libre.trim()
          ? motif_perte_libre.trim()
          : null,
      motif_pause: stage === "en_pause" ? motif_pause : null,
      motif_pause_detail:
        stage === "en_pause" && motif_pause_detail.trim()
          ? motif_pause_detail.trim()
          : null,
      pause_cadence_jours: cadence,
      pause_reprise_le: cadence ? addDays(today, cadence) : null,
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

  // Leaving the funnel: close the open auto-relances for this fiche.
  if (stage === "perdu" || stage === "en_pause") {
    await supabase
      .from("taches")
      .update({ statut: "fait" })
      .eq("fiche_id", fiche_id)
      .eq("statut", "a_faire")
      .eq("auto_generee", true);
  }

  // Auto-generated relances — the digital heir of the paper's five contact lines.
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

  // Parked lead: schedule the first WhatsApp check-in at the cadence.
  if (stage === "en_pause" && cadence) {
    await supabase.from("taches").insert({
      titre: `Reprise de contact — ${typedFiche.client_nom}`,
      description: motif_pause_detail.trim() || null,
      echeance: addDays(today, cadence),
      priorite: "normale" as const,
      fiche_id,
      assigne_a: typedFiche.conseiller_id,
      cree_par: profile.id,
      auto_generee: true,
      canal: "whatsapp" as const,
    });
  }

  // A reason the conseiller typed by hand, kept for everyone next time.
  if (enregistrer_motif) {
    const libelle =
      stage === "perdu" ? motif_perte_libre.trim() : motif_pause_detail.trim();
    if (libelle.length >= 2) {
      await supabase.from("motifs_personnalises").insert({
        type: stage === "perdu" ? "perte" : "pause",
        libelle,
        point_de_vente_id: profile.point_de_vente_id,
        cree_par: profile.id,
      });
    }
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

  // Targeted: the board updated optimistically, so only the views that read
  // this data need re-rendering — not the whole layout tree.
  revalidatePath("/pipeline");
  revalidatePath("/fiches");
  revalidatePath("/ma-journee");
  revalidatePath("/taches");
  revalidatePath(`/fiches/${fiche_id}`);
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
      date_prete_devis: parsed.data.date_prete_devis,
      remarques_client: parsed.data.remarques_client || null,
    })
    .eq("id", parsed.data.fiche_id);
  if (error) return fail("db");
  revalidatePath(`/fiches/${parsed.data.fiche_id}`);
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

  const { data: fiche } = await supabase
    .from("fiches_contact")
    .select("client_nom, conseiller_id, stage, pause_cadence_jours")
    .eq("id", fiche_id)
    .single();

  if (prochaine_relance && fiche) {
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
  } else if (fiche?.stage === "en_pause" && fiche.pause_cadence_jours) {
    // A parked lead keeps its rhythm: log a check-in, the next one is booked.
    const next = addDays(new Date(), fiche.pause_cadence_jours);
    await supabase.from("taches").insert({
      titre: `Reprise de contact — ${fiche.client_nom}`,
      echeance: next,
      priorite: "normale",
      fiche_id,
      assigne_a: fiche.conseiller_id,
      cree_par: profile.id,
      auto_generee: true,
      canal: "whatsapp",
    });
    await supabase
      .from("fiches_contact")
      .update({ pause_reprise_le: next })
      .eq("id", fiche_id);
  }

  revalidatePath("/taches");
  revalidatePath("/ma-journee");
  revalidatePath(`/fiches/${fiche_id}`);
  return succeed({ numero });
}

/** Reusable custom reasons, newest-used first, for the pipeline dialogs. */
export async function listMotifsPersonnalises(
  type: "perte" | "pause",
): Promise<string[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("motifs_personnalises")
    .select("libelle")
    .eq("type", type)
    .eq("actif", true)
    .order("utilisations", { ascending: false })
    .limit(20);
  return (data ?? []).map((row) => row.libelle);
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
