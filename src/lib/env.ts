/**
 * Supabase is optional at runtime until credentials are provisioned:
 * with no env vars the app runs in demo mode on in-memory data,
 * so the UI stays reviewable. Mutations are disabled in demo mode.
 */
export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
