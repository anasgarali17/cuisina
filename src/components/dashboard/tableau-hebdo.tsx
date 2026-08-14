import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMontant } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Les quatre familles du tableau hebdomadaire, dans l'ordre du fichier Excel
 * que la direction tient à la main depuis des années.
 *
 * `electro` et `pt` (plans de travail) n'ont pas encore de source dans le CRM :
 * une fiche ne dit pas quel électroménager ni quel plan de travail a été
 * devisé, seulement ce que le client souhaite. Les colonnes existent quand
 * même — vides plutôt qu'absentes, pour que le tableau reste comparable au
 * fichier d'origine et se remplisse le jour où la donnée arrive.
 */
export const FAMILLES_HEBDO = ["cuisine", "dressing", "electro", "pt"] as const;
export type FamilleHebdo = (typeof FAMILLES_HEBDO)[number];

/** Ce qu'une famille pèse sur une semaine : des devis, et des commandes. */
export interface CelluleHebdo {
  nbDevis: number;
  valeurDevis: number;
  nbBc: number;
  valeurBc: number;
}

export interface SemaineRow {
  /** Libellé de la semaine, façon « 27-31 juillet ». */
  libelle: string;
  familles: Record<FamilleHebdo, CelluleHebdo>;
}

const VIDE: CelluleHebdo = { nbDevis: 0, valeurDevis: 0, nbBc: 0, valeurBc: 0 };

export function celluleVide(): CelluleHebdo {
  return { ...VIDE };
}

/** Un zéro n'apporte rien dans une grille de seize colonnes : on l'efface. */
function nb(v: number): string {
  return v === 0 ? "" : String(v);
}

function montant(v: number): string {
  return v === 0 ? "" : formatMontant(v);
}

/**
 * Le tableau hebdomadaire, repris du fichier Excel de la direction.
 *
 * Quatre familles, et pour chacune : combien de devis, pour quelle valeur,
 * combien de bons de commande, pour quelle valeur. Une ligne par semaine, la
 * plus récente en haut.
 *
 * Les devis se comptent au passage en « Conception devis », les bons de
 * commande au passage en « Signé » — donc à la date où le dossier a bougé,
 * pas à celle où la fiche a été créée. C'est ce que compte le fichier papier.
 */
export async function TableauHebdo({ semaines }: { semaines: SemaineRow[] }) {
  const t = await getTranslations();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg font-semibold normal-case tracking-normal text-foreground">
          {t("dashboard.hebdo.titre")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {semaines.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("dashboard.hebdo.vide")}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[58rem] border-collapse text-sm">
                <thead>
                  <tr>
                    <th
                      rowSpan={2}
                      className="border border-border bg-secondary/60 px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide"
                    >
                      {t("dashboard.hebdo.semaine")}
                    </th>
                    {FAMILLES_HEBDO.map((f) => (
                      <th
                        key={f}
                        colSpan={4}
                        className={cn(
                          "border border-border px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wide",
                          f === "cuisine" && "bg-emerald-50 text-emerald-900",
                          f === "dressing" && "bg-sky-50 text-sky-900",
                          f === "electro" && "bg-amber-50 text-amber-900",
                          f === "pt" && "bg-stone-100 text-stone-800",
                        )}
                      >
                        {t(`dashboard.hebdo.familles.${f}`)}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {FAMILLES_HEBDO.flatMap((f) =>
                      (["nbDevis", "valeurDevis", "nbBc", "valeurBc"] as const).map(
                        (c) => (
                          <th
                            key={`${f}-${c}`}
                            className="border border-border bg-secondary/40 px-2 py-1.5 text-center text-[11px] font-medium text-muted-foreground"
                          >
                            {t(`dashboard.hebdo.colonnes.${c}`)}
                          </th>
                        ),
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {semaines.map((s, i) => (
                    <tr key={s.libelle} className={cn(i === 0 && "font-medium")}>
                      <td className="whitespace-nowrap border border-border px-3 py-2">
                        {s.libelle}
                      </td>
                      {FAMILLES_HEBDO.flatMap((f) => {
                        const c = s.familles[f];
                        return [
                          <td
                            key={`${f}-nd`}
                            className="border border-border px-2 py-2 text-center font-mono tabular-nums"
                          >
                            {nb(c.nbDevis)}
                          </td>,
                          <td
                            key={`${f}-vd`}
                            className="border border-border px-2 py-2 text-end font-mono tabular-nums"
                          >
                            {montant(c.valeurDevis)}
                          </td>,
                          <td
                            key={`${f}-nb`}
                            className="border border-border px-2 py-2 text-center font-mono tabular-nums"
                          >
                            {nb(c.nbBc)}
                          </td>,
                          <td
                            key={`${f}-vb`}
                            className="border border-border px-2 py-2 text-end font-mono tabular-nums"
                          >
                            {montant(c.valeurBc)}
                          </td>,
                        ];
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Dire ce que le tableau ne sait pas encore, plutôt que laisser
                croire que ces colonnes valent zéro. */}
            <p className="mt-3 text-xs text-muted-foreground">
              {t("dashboard.hebdo.note")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
