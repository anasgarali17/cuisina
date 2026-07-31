import { useTranslations } from "next-intl";
import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";

/** Designed placeholder for Phase 2+ modules — a real page, not a 404. */
export function ComingSoon({ moduleKey }: { moduleKey: string }) {
  const t = useTranslations("placeholders");
  const tApp = useTranslations("app");

  return (
    <div>
      <PageHeader title={t(`${moduleKey}.title`)} />
      <div className="grid min-h-[50vh] place-items-center rounded-3xl border border-dashed border-chene/50 bg-card/60">
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-chene/15 text-chene">
            <Hammer className="size-6" />
          </span>
          <p className="font-display text-xl font-semibold">
            {tApp("comingSoon")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t(`${moduleKey}.description`)}
          </p>
        </div>
      </div>
    </div>
  );
}
