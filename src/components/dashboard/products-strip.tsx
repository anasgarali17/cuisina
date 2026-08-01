import { getTranslations } from "next-intl/server";
import { Card, CardTitle } from "@/components/ui/card";

export interface ProductCounts {
  evier: number;
  plaque: number;
  hotte: number;
  four: number;
  micro_onde: number;
  frigo: number;
  lave_vaisselle: number;
}

const PRODUCTS: { key: keyof ProductCounts; labelKey: string }[] = [
  { key: "frigo", labelKey: "frigo" },
  { key: "four", labelKey: "four" },
  { key: "plaque", labelKey: "plaque" },
  { key: "hotte", labelKey: "hotte" },
  { key: "evier", labelKey: "evier" },
  { key: "micro_onde", labelKey: "microOnde" },
  { key: "lave_vaisselle", labelKey: "laveVaisselle" },
];

/**
 * Isometric 3D product tiles (generated brand renders in /public/products)
 * with live demand: how many active fiches ticked each appliance in their
 * Exigences.
 */
export async function ProductsStrip({ counts }: { counts: ProductCounts }) {
  const t = await getTranslations();

  return (
    <Card className="p-6">
      <div className="flex items-baseline justify-between gap-3">
        <CardTitle className="p-0">{t("dashboard.hub.produits")}</CardTitle>
        <span className="text-xs text-muted-foreground">
          {t("dashboard.hub.produitsHint")}
        </span>
      </div>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {PRODUCTS.map(({ key, labelKey }) => (
          <div
            key={key}
            className="group flex min-w-32 shrink-0 flex-col items-center gap-1 rounded-2xl border border-border/70 bg-card/60 px-4 pb-4 pt-2 text-center transition-transform hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/products/${key}.svg`}
              alt=""
              aria-hidden
              className="h-20 w-auto transition-transform duration-200 group-hover:scale-110 motion-reduce:transition-none"
            />
            <span className="text-xs font-medium">
              {t(`fiches.exigences.${labelKey}`)}
            </span>
            <span className="kpi-number text-xl">{counts[key]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
