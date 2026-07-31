import { getTranslations } from "next-intl/server";

/**
 * The visual anchor of the dashboard — the featured tile in solid Cuisina
 * red with kitchen line-art and a brutalist offset shadow, echoing the
 * reference design's hero card.
 */
export async function ProjetDuMois({
  fiche,
}: {
  fiche: { client: string; ville: string | null; montant: string } | null;
}) {
  const t = await getTranslations();

  return (
    <div
      className="neo neo-hover relative flex min-h-52 flex-col justify-end overflow-hidden rounded-3xl bg-rouge p-6 text-white"
      style={{
        backgroundImage:
          "radial-gradient(90% 90% at 80% 10%, rgba(255,255,255,0.18), transparent 60%)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/projet-cuisine.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -end-3 -top-4 h-28 opacity-45"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-noir-atelier/35 to-transparent"
      />
      <div className="relative">
        <span className="inline-block rounded-full bg-noir-atelier/40 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
          {t("dashboard.kpi.projetDuMois")}
        </span>
        {fiche ? (
          <>
            <p className="mt-2 font-display text-2xl font-semibold leading-tight">
              {fiche.client}
            </p>
            {fiche.ville && (
              <p className="text-sm text-white/70">{fiche.ville}</p>
            )}
            <p className="kpi-number mt-3 text-3xl text-white">
              {fiche.montant}
            </p>
          </>
        ) : (
          <p className="mt-2 max-w-[24ch] text-sm text-white/70">
            {t("dashboard.insights.empty")}
          </p>
        )}
      </div>
    </div>
  );
}
