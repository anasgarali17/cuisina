"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { getCurrentProfile } from "@/lib/auth";
import { PRIORITES } from "@/lib/domain";
import { type ActionResult, fail, succeed } from "./result";

const toggleSchema = z.object({
  id: z.string().uuid(),
  done: z.boolean(),
});

export async function toggleTache(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const supabase = await createClient();
  const { error } = await supabase
    .from("taches")
    .update({ statut: parsed.data.done ? "fait" : "a_faire" })
    .eq("id", parsed.data.id);
  if (error) return fail("db");
  // The caller already flipped the checkbox optimistically; only the views
  // that count tasks need to re-render.
  revalidatePath("/taches");
  revalidatePath("/ma-journee");
  return succeed(undefined);
}

const createSchema = z.object({
  titre: z.string().min(1).max(200),
  description: z.string().max(1000).default(""),
  echeance: z.string().date().nullable().default(null),
  priorite: z.enum(PRIORITES).default("normale"),
  fiche_id: z.string().uuid().nullable().default(null),
  assigne_a: z.string().uuid().nullable().default(null),
});

export async function createTache(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const supabase = await createClient();
  const { error } = await supabase.from("taches").insert({
    titre: parsed.data.titre,
    description: parsed.data.description || null,
    echeance: parsed.data.echeance,
    priorite: parsed.data.priorite,
    fiche_id: parsed.data.fiche_id,
    assigne_a: parsed.data.assigne_a ?? profile.id,
    cree_par: profile.id,
  });
  if (error) return fail("db");
  revalidatePath("/taches");
  revalidatePath("/ma-journee");
  return succeed(undefined);
}

const echeanceSchema = z.object({
  id: z.string().uuid(),
  echeance: z.string().date().nullable(),
});

/** Reassigns a task to a new due date — how a drag between kanban columns lands. */
export async function updateTacheEcheance(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = echeanceSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const supabase = await createClient();
  const { error } = await supabase
    .from("taches")
    .update({ echeance: parsed.data.echeance })
    .eq("id", parsed.data.id);
  if (error) return fail("db");
  revalidatePath("/taches");
  revalidatePath("/ma-journee");
  return succeed(undefined);
}

const objectifSchema = z.object({
  profile_id: z.string().uuid(),
  objectif_mensuel: z.coerce.number().min(0).max(10_000_000),
});

export async function updateObjectif(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = objectifSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return fail("forbidden");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ objectif_mensuel: parsed.data.objectif_mensuel })
    .eq("id", parsed.data.profile_id);
  if (error) return fail("db");
  revalidatePath("/equipe");
  revalidatePath("/ma-journee");
  return succeed(undefined);
}
