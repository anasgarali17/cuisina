import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";

/**
 * The reference's promo tile: title, one-liner, black pill CTA,
 * avatar cluster and a red sun burst.
 */
export async function PromoCard({ initials }: { initials: string[] }) {
  const t = await getTranslations();

  return (
    <Card className="relative overflow-hidden p-6">
      <div
        aria-hidden
        className="burst pointer-events-none absolute -end-8 -top-8 size-44 opacity-60"
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="max-w-md">
          <h2 className="font-display text-xl font-semibold">
            {t("dashboard.hub.promoTitle")}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("dashboard.hub.promoText")}
          </p>
          <Link
            href="/fiches/nouvelle"
            className="neo-hover mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-noir-atelier px-5 text-sm font-medium text-ivoire"
          >
            <Plus className="size-4" />
            {t("fiches.new")}
          </Link>
        </div>
        <div className="relative flex shrink-0 -space-x-2 rtl:space-x-reverse">
          {initials.slice(0, 3).map((ini, i) => (
            <Avatar key={`${ini}-${i}`} className="size-9 ring-2 ring-card">
              <AvatarFallback>{ini}</AvatarFallback>
            </Avatar>
          ))}
        </div>
      </div>
    </Card>
  );
}
