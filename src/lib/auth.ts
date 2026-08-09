import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { demoCurrentProfile } from "@/lib/data/demo";
import { getSnapshot } from "@/lib/data/queries";
import type { ProfileRow } from "@/lib/database.types";

/**
 * Current signed-in profile — demo persona when Supabase is not configured.
 *
 * The JWT check and the data snapshot are fired together rather than in
 * sequence, and the profile is picked out of the snapshot the page is going
 * to load anyway. That removes two of the three serial round trips every
 * screen used to pay before it could start rendering.
 */
export const getCurrentProfile = cache(async (): Promise<ProfileRow | null> => {
  if (!supabaseConfigured()) return demoCurrentProfile;

  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    snapshot,
  ] = await Promise.all([supabase.auth.getUser(), getSnapshot()]);

  if (!user) return null;

  const fromSnapshot = snapshot.profiles.find((p) => p.id === user.id);
  if (fromSnapshot) return fromSnapshot;

  // Not in the snapshot (deactivated account, or the snapshot failed):
  // fall back to a direct read so access is decided on real data.
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return profile;
});
