"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { type ActionResult, fail, succeed } from "./result";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function signIn(
  input: unknown,
): Promise<ActionResult<undefined>> {
  if (!supabaseConfigured()) return fail("demo_mode");
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return fail("invalid_credentials");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail("invalid_credentials");
  redirect("/");
}

export async function signOut(): Promise<void> {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

const localeSchema = z.enum(["fr", "ar", "en"]);

export async function persistLocale(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = localeSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  if (!supabaseConfigured()) return succeed(undefined);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from("profiles")
      .update({ locale: parsed.data })
      .eq("id", user.id);
  }
  revalidatePath("/", "layout");
  return succeed(undefined);
}
