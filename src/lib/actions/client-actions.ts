"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { getCurrentProfile } from "@/lib/auth";
import { type ActionResult, dbError, fail, succeed } from "./result";

const toggleVipSchema = z.object({
  id: z.string().uuid(),
  vip: z.boolean(),
});

/**
 * Épingle (ou retire) le statut VIP. Le niveau — Essentiel · Signature ·
 * Prestige — se calcule tout seul depuis le CA ; le VIP est l'échappatoire
 * humaine : l'architecte qui amène quatre chantiers par an ne signe rien
 * lui-même et pèse pourtant plus lourd que son CA ne le dit.
 *
 * La politique RLS `clients_update` tranche qui a le droit : direction, ou
 * conseiller du même point de vente.
 */
export async function toggleVip(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = toggleVipSchema.safeParse(input);
  if (!parsed.success) return fail("validation");

  const profile = await getCurrentProfile();
  if (!profile) return fail("unauthenticated");

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ vip: parsed.data.vip })
    .eq("id", parsed.data.id);
  if (error) return fail(dbError(error));

  revalidatePath("/clients");
  revalidatePath(`/clients/${parsed.data.id}`);
  return succeed(undefined);
}
