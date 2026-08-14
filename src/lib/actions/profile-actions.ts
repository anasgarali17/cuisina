"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { type ActionResult, dbError, fail, succeed } from "./result";

const profilSchema = z.object({
  prenom: z.string().trim().min(1).max(80),
  nom: z.string().trim().min(1).max(80),
});

/** Self-service : chacun ne peut renommer que son propre profil (RLS profiles_update_own). */
export async function updateProfil(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = profilSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("unauthenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ prenom: parsed.data.prenom, nom: parsed.data.nom })
    .eq("id", user.id);
  if (error) return fail(dbError(error));

  // The name feeds the top-bar avatar and every screen's greeting.
  revalidatePath("/", "layout");
  return succeed(undefined);
}
