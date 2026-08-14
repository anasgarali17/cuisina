"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { getCurrentProfile } from "@/lib/auth";
import { ETAPES_PRODUCTION } from "@/lib/domain";
import { type ActionResult, dbError, fail, succeed } from "./result";

const changeEtapeSchema = z.object({
  id: z.string().uuid(),
  etape: z.enum(ETAPES_PRODUCTION),
});

const remarquesSchema = z.object({
  id: z.string().uuid(),
  remarques: z.string().max(1000).default(""),
});

/**
 * Déplacer un dossier d'une étape de production à la suivante.
 *
 * Aucune règle d'ordre n'est imposée : un dossier peut revenir en arrière si
 * l'atelier renvoie une pièce au bureau d'étude. Ce qui compte est que le
 * mouvement laisse une trace — c'est l'historique qui répond à « depuis quand
 * ce dossier traîne en achat ».
 */
export async function changeEtapeProduction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = changeEtapeSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const { id, etape } = parsed.data;
  const supabase = await createClient();

  const { data: courant } = await supabase
    .from("clients_actifs")
    .select("id, etape")
    .eq("id", id)
    .single();
  if (!courant) return fail("not_found");
  if (courant.etape === etape) return succeed(undefined);

  const { error } = await supabase
    .from("clients_actifs")
    .update({ etape })
    .eq("id", id);
  if (error) return fail(dbError(error));

  await supabase.from("client_actif_historique").insert({
    client_actif_id: id,
    etape_from: courant.etape,
    etape_to: etape,
    user_id: profile.id,
  });

  revalidatePath("/clients-actifs");
  return succeed(undefined);
}

/** Le mot que l'atelier laisse au conseiller, et réciproquement. */
export async function updateRemarquesProduction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = remarquesSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients_actifs")
    .update({ remarques: parsed.data.remarques.trim() || null })
    .eq("id", parsed.data.id);
  if (error) return fail(dbError(error));

  revalidatePath("/clients-actifs");
  return succeed(undefined);
}
