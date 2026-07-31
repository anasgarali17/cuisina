import { getTranslations } from "next-intl/server";
import {
  CookingPot,
  Droplets,
  Fan,
  Flame,
  Microwave,
  Refrigerator,
  WashingMachine,
  type LucideIcon,
} from "lucide-react";
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

const PRODUCTS: {
  key: keyof ProductCounts;
  labelKey: string;
  icon: LucideIcon;
}[] = [
  { key: "evier", labelKey: "evier", icon: Droplets },
  { key: "plaque", labelKey: "plaque", icon: Flame },
  { key: "hotte", labelKey: "hotte", icon: Fan },
  { key: "four", labelKey: "four", icon: CookingPot },
  { key: "micro_onde", labelKey: "microOnde", icon: Microwave },
  { key: "frigo", labelKey: "frigo", icon: Refrigerator },
  { key: "lave_vaisselle", labelKey: "laveVaisselle", icon: WashingMachine },
];

/**
 * Kitchen product tiles with live demand: how many active fiches have each
 * appliance ticked in their Exigences (feeds showroom stock conversations).
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
        {PRODUCTS.map(({ key, labelKey, icon: Icon }) => (
          <div
            key={key}
            className="flex min-w-28 shrink-0 flex-col items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-4 text-center"
          >
            <span className="grid size-11 place-items-center rounded-full bg-card text-chene shadow-sm">
              <Icon className="size-5" aria-hidden />
            </span>
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
