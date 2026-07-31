import { createBrowserClient } from "@supabase/ssr";

/**
 * Untyped on purpose: row types are enforced at the data-layer boundaries
 * (src/lib/data/queries.ts, src/lib/actions/*) via the interfaces in
 * database.types.ts.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
