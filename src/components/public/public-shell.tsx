import { getTranslations } from "next-intl/server";

/**
 * L'habillage du formulaire public : la marque, rien d'autre. Pas de rail de
 * navigation, pas de barre de recherche — la personne en face n'est pas dans
 * le CRM, elle est sur son téléphone devant un stand ou un showroom.
 */
export async function PublicShell({
  children,
  pdv,
}: {
  children: React.ReactNode;
  pdv?: string;
}) {
  const t = await getTranslations("public.shared");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-4">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-rouge font-display text-[9px] font-bold tracking-tight text-white"
          >
            CUISINA
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold leading-none tracking-tight">
              CUISINA
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {pdv ?? t("tagline")}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-border px-4 py-5 text-center">
        <p className="text-xs text-muted-foreground">{t("footer")}</p>
      </footer>
    </div>
  );
}
