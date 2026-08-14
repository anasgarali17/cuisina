import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Le formulaire rempli par le client. Il est ouvert par définition : la
 * personne qui scanne le QR code n'a pas de compte, et n'en aura jamais.
 */
const PUBLIC_ROUTE = /^\/(?:fr|ar|en)?\/?f\/[^/]+\/?$/;

/**
 * Renommé de `middleware` à `proxy` : Next 16 déprécie l'ancien nom, et le
 * runtime edge n'existe plus ici — ce fichier tourne en Node.
 */
export async function proxy(request: NextRequest) {
  const response = intlMiddleware(request);
  // Le chemin demandé, relu par le layout pour fermer les sections réservées
  // à qui taperait l'adresse à la main. Les Server Components n'ont pas accès
  // à l'URL autrement.
  response.headers.set("x-pathname", request.nextUrl.pathname);
  // Demo mode: no Supabase yet — locale routing only, no auth gate.
  if (!supabaseConfigured()) return response;
  if (PUBLIC_ROUTE.test(request.nextUrl.pathname)) return response;
  return updateSession(request, response);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
