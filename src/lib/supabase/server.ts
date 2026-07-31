import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Untyped on purpose: row types are enforced at the data-layer boundaries
 * (src/lib/data/queries.ts, src/lib/actions/*) via the interfaces in
 * database.types.ts.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — session refresh is handled by middleware.
          }
        },
      },
    },
  );
}
