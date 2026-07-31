import { getTranslations } from "next-intl/server";

/**
 * The visual anchor of the dashboard — a dark tile with a warm oak glow,
 * echoing the reference design's featured project card.
 */
export async function ProjetDuMois({
  fiche,
}: {
  fiche: { client: string; ville: string | null; montant: string } | null;
}) {
  const t = await getTranslations();

  return (
    <div
      className="card-lift relative flex min-h-52 flex-col justify-end overflow-hidden rounded-3xl bg-noir-atelier p-6 text-ivoire"
      style={{
        backgroundImage: [
          "radial-gradient(120% 90% at 85% 0%, rgba(185,139,84,0.35) 0%, rgba(185,139,84,0.08) 45%, transparent 70%)",
          "radial-gradient(80% 60% at 15% 100%, rgba(193,18,31,0.18) 0%, transparent 60%)",
          "repeating-linear-gradient(100deg, rgba(251,248,243,0.025) 0px, rgba(251,248,243,0.025) 1px, transparent 1px, transparent 9px)",
        ].join(", "),
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-chene">
        {t("dashboard.kpi.projetDuMois")}
      </p>
      {fiche ? (
        <>
          <p className="mt-2 font-display text-2xl font-semibold leading-tight">
            {fiche.client}
          </p>
          {fiche.ville && (
            <p className="text-sm text-ivoire/60">{fiche.ville}</p>
          )}
          <p className="kpi-number mt-3 text-3xl">{fiche.montant}</p>
          <span className="mt-2 block h-[3px] w-12 rounded-full bg-rouge" />
        </>
      ) : (
        <p className="mt-2 max-w-[24ch] text-sm text-ivoire/60">
          {t("dashboard.insights.empty")}
        </p>
      )}
    </div>
  );
}
