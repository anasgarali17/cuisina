import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * Ce qu'on montre à la place d'une page interdite.
 *
 * Ni page blanche ni 404 : dire « cette section ne vous est pas ouverte »
 * évite qu'on croie à une panne et qu'on rappelle l'administrateur pour rien.
 */
export async function AccesRefuse() {
  const t = await getTranslations();

  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="max-w-md text-center">
        <span
          aria-hidden
          className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-secondary text-muted-foreground"
        >
          <Lock className="size-6" />
        </span>
        <h1 className="font-display text-xl font-bold">
          {t("acces.refuseTitre")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("acces.refuseTexte")}
        </p>
        <Link
          href="/ma-journee"
          className="mt-5 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("acces.retour")}
        </Link>
      </div>
    </div>
  );
}
