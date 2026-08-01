import { getTranslations } from "next-intl/server";
import { BorderBeam } from "@/components/ui/border-beam";

/**
 * The visual anchor of the dashboard — a near-black hero tile with the
 * kitchen line-art and an animated red→oak border beam.
 */
export async function ProjetDuMois({
  fiche,
}: {
  fiche: { client: string; ville: string | null; montant: string } | null;
}) {
  const t = await getTranslations();

  return (
    <div
      className="neo-hover relative flex h-full min-h-52 flex-col justify-end overflow-hidden rounded-3xl bg-noir-atelier p-6 text-white shadow-sm"
      style={{
        backgroundImage:
          "radial-gradient(90% 90% at 80% 0%, rgba(185,139,84,0.22), transparent 60%)",
      }}
    >
      <BorderBeam size={180} duration={12} borderWidth={1.5} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/projet-cuisine.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-6 mx-auto max-h-[55%] w-auto opacity-60"
      />
      <div className="relative">
        <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
          {t("dashboard.kpi.projetDuMois")}
        </span>
        {fiche ? (
          <>
            <p className="mt-2 font-display text-2xl font-semibold leading-tight">
              {fiche.client}
            </p>
            {fiche.ville && (
              <p className="text-sm text-white/60">{fiche.ville}</p>
            )}
            <p className="kpi-number mt-3 text-3xl text-white">
              {fiche.montant}
            </p>
            <span className="mt-2 block h-[3px] w-12 rounded-full bg-rouge" />
          </>
        ) : (
          <p className="mt-2 max-w-[24ch] text-sm text-white/60">
            {t("dashboard.insights.empty")}
          </p>
        )}
      </div>
    </div>
  );
}
