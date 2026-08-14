"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured, whatsappConfigured } from "@/lib/env";
import { getCurrentProfile } from "@/lib/auth";
import {
  deleteSequenceSchema,
  journaliserEnvoiSchema,
  modeleSchema,
  modeSequenceSchema,
  sequenceSchema,
  toggleSequenceSchema,
  updateModeleSchema,
  updateSequenceSchema,
} from "@/lib/schemas/sequence";
import { type ActionResult, dbError, fail, succeed } from "./result";

/**
 * L'écriture côté séquences WhatsApp. Rien ici n'envoie de message : la
 * passerelle n'existe pas encore, et c'est délibéré. Ces actions règlent la
 * mécanique — modèles, déclencheurs, délais — et journalisent ce qu'un
 * conseiller a envoyé de sa main depuis la file d'attente.
 */

const CHEMINS = ["/sequences", "/modeles", "/journal-envoi"];

function rafraichir() {
  for (const chemin of CHEMINS) revalidatePath(chemin);
}

/* — Modèles — */

export async function createModele(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = modeleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "validation");
  }

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("modeles_message")
    .insert({ ...parsed.data, cree_par: profile.id })
    .select("id")
    .single();
  // Le code est unique : deux « relance-j3 » rendraient la liste illisible.
  if (error) return fail(error.code === "23505" ? "code_existe" : "db");
  if (!data) return fail("db_introuvable");

  rafraichir();
  return succeed({ id: data.id });
}

export async function updateModele(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = updateModeleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "validation");
  }

  const { id, ...patch } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("modeles_message")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(error.code === "23505" ? "code_existe" : "db");

  rafraichir();
  return succeed(undefined);
}

const toggleModeleSchema = z.object({
  id: z.string().uuid(),
  actif: z.boolean(),
});

export async function toggleModele(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = toggleModeleSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const supabase = await createClient();
  const { error } = await supabase
    .from("modeles_message")
    .update({ actif: parsed.data.actif })
    .eq("id", parsed.data.id);
  if (error) return fail(dbError(error));

  rafraichir();
  return succeed(undefined);
}

/* — Séquences — */

/**
 * Crée la séquence et ses étapes. Deux écritures, pas de transaction : si les
 * étapes échouent on retire la séquence, faute de quoi il resterait une
 * séquence vide qui ne déclenche rien mais s'affiche comme active.
 */
export async function createSequence(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = sequenceSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "validation");
  }

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const { etapes, description, ...reste } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sequences")
    .insert({
      ...reste,
      description: description.trim() || null,
      cree_par: profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.code === "23505" ? "nom_existe" : dbError(error));
  if (!data) return fail("db_introuvable");

  const { error: etapesError } = await supabase
    .from("sequence_etapes")
    .insert(etapes.map((e) => ({ ...e, sequence_id: data.id })));
  if (etapesError) {
    await supabase.from("sequences").delete().eq("id", data.id);
    return fail(dbError(etapesError));
  }

  rafraichir();
  return succeed({ id: data.id });
}

/**
 * Remplace la séquence et ses étapes. Les étapes sont réécrites en bloc
 * plutôt que rapprochées une à une : leur identité n'est que leur rang, et un
 * diff sur un rang produit des collisions sur `unique (sequence_id, ordre)`.
 */
export async function updateSequence(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = updateSequenceSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "validation");
  }

  const { id, patch } = parsed.data;
  const { etapes, description, ...reste } = patch;
  const supabase = await createClient();

  const { error } = await supabase
    .from("sequences")
    .update({
      ...reste,
      description: description.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return fail(error.code === "23505" ? "nom_existe" : dbError(error));

  await supabase.from("sequence_etapes").delete().eq("sequence_id", id);
  const { error: etapesError } = await supabase
    .from("sequence_etapes")
    .insert(etapes.map((e) => ({ ...e, sequence_id: id })));
  if (etapesError) return fail(dbError(etapesError));

  rafraichir();
  return succeed(undefined);
}

export async function toggleSequence(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = toggleSequenceSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const supabase = await createClient();
  const { error } = await supabase
    .from("sequences")
    .update({ actif: parsed.data.actif, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return fail(dbError(error));

  rafraichir();
  return succeed(undefined);
}

/**
 * Simulation ↔ actif. Réservé à la direction, et refusé tant que la
 * passerelle WhatsApp n'est pas configurée : « actif » sans passerelle est un
 * mensonge d'interface — la séquence paraîtrait envoyer et n'enverrait rien.
 */
export async function setModeSequence(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = modeSequenceSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  if (parsed.data.mode === "actif" && !whatsappConfigured()) {
    return fail("passerelle_absente");
  }

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");
  if (profile.role !== "direction" && profile.role !== "admin") {
    return fail("non_autorise");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("sequences")
    .update({ mode: parsed.data.mode, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return fail(dbError(error));

  rafraichir();
  return succeed(undefined);
}

export async function deleteSequence(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = deleteSequenceSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const supabase = await createClient();
  // Les étapes tombent en cascade ; le journal garde ses lignes, sequence_id
  // passe à null. Un message parti reste parti.
  const { error } = await supabase
    .from("sequences")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(dbError(error));

  rafraichir();
  return succeed(undefined);
}

/* — Journal — */

/**
 * Trace un message que le conseiller vient d'envoyer à la main depuis la file
 * d'attente. C'est ce qui rend la phase de simulation exploitable : on saura
 * quels textes ont vraiment été utilisés, et lesquels sont restés lettre
 * morte, avant de laisser la machine appuyer elle-même.
 */
export async function journaliserEnvoi(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = journaliserEnvoiSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages_envoyes")
    .upsert(
      {
        ...parsed.data,
        envoye_le: new Date().toISOString(),
        envoye_par: profile.id,
      },
      { onConflict: "fiche_id,etape_id" },
    )
    .select("id")
    .single();
  if (error || !data) return fail(dbError(error));

  rafraichir();
  revalidatePath("/ma-journee");
  return succeed({ id: data.id });
}
