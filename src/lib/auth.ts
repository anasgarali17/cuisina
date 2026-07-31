import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { demoCurrentProfile } from "@/lib/data/demo";
import type { ProfileRow } from "@/lib/database.types";

/** Current signed-in profile — demo persona when Supabase is not configured. */
export const getCurrentProfile = cache(async (): Promise<ProfileRow | null> => {
  if (!supabaseConfigured()) return demoCurrentProfile;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
});
