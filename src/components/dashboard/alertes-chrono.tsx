import { getTranslations } from "next-intl/server";
import { ArrowRight, Hourglass } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CHRONO_STYLE, type NiveauChrono } from "@/lib/chrono";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface AlerteChrono {
  /** `fiche` pointe vers l'état du dossier, `production` vers le client actif. */
  origine: "fiche" | "production";
  id: string;
  client: string;
  reference: string;
  /** Libellé de l'étape, déjà traduit par l'appelant. */
  etape: string;
  jours: number;
  seuil: number;
  niveau: NiveauChrono;
}

/**
 * Les dossiers qui traînent, commercial et production mêlés.
 *
 * Les deux tableaux portent chacun leur compteur, mais il faut les ouvrir
 * pour les voir. Le matin, on ouvre le tableau de bord : c'est là que doit
 * se trouver la liste de ce qui a dépassé son délai, sans avoir à aller la
 * chercher étape par étape.
 *
 * Le plus en retard d'abord — pas le plus ancien, le plus au-delà de son
 * seuil. Trois semaines en production est normal ; trois jours sur un
 * nouveau lead ne l'est pas, et c'est celui-là qu'il faut rappeler.
 */
export async function AlertesChrono({
  alertes,
  max = 8,
}: {
  alertes: AlerteChrono[];
  max?: number;
}) {
  const t = await getTranslations();
  if (alertes.length === 0) return null;

  const visibles = alertes.slice(0, max);

  return (
    <Card className="border-rouge/30">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-1.5 text-rouge">
          <Hourglass aria-hidden className="size-4" />
          {t("chrono.alertes.titre")}
        </CardTitle>
        <span className="font-mono text-xs text-muted-foreground">
          {alertes.length}
        </span>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {visibles.map((a) => (
            <li key={`${a.origine}-${a.id}`}>
              <Link
                href={a.origine === "fiche" ? `/fiches/${a.id}` : "/clients-actifs"}
                className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-secondary/60"
              >
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[10px] leading-none",
                    CHRONO_STYLE[a.niveau],
                  )}
                >
                  {t("chrono.jours", { n: a.jours })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {a.client}
                  </span>
                  {/* L'étape et le seuil : sans eux, « 12 j » ne dit pas si
                      c'est grave. */}
                  <span className="block truncate text-xs text-muted-foreground">
                    {t("chrono.alertes.ligne", {
                      etape: a.etape,
                      seuil: a.seuil,
                    })}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
                />
              </Link>
            </li>
          ))}
        </ul>
        {alertes.length > visibles.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("chrono.alertes.reste", { n: alertes.length - visibles.length })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
