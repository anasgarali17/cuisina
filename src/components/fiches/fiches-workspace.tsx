"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Inbox, QrCode } from "lucide-react";
import type {
  FicheRow,
  FicheSubmissionRow,
  PointDeVenteRow,
} from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { FichesList } from "@/components/fiches/fiches-list";
import { DemandesPanel } from "@/components/fiches/demandes-panel";
import { LiensPanel, type LienView } from "@/components/fiches/liens-panel";

const TABS = [
  { key: "fiches", icon: ClipboardList },
  { key: "demandes", icon: Inbox },
  { key: "liens", icon: QrCode },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Les trois temps d'une fiche contact, dans l'ordre où ils arrivent :
 * on affiche un QR code, on trie ce qui en revient, et ce qui est accepté
 * rejoint les fiches.
 */
export function FichesWorkspace({
  fiches,
  conseillers,
  pdvs,
  submissions,
  conseillerOptions,
  liens,
}: {
  fiches: FicheRow[];
  conseillers: Record<string, string>;
  pdvs: PointDeVenteRow[];
  submissions: FicheSubmissionRow[];
  conseillerOptions: { id: string; name: string }[];
  liens: LienView[];
}) {
  const t = useTranslations();
  const [tab, setTab] = useState<TabKey>("fiches");

  const enAttente = submissions.filter((s) => s.statut === "en_attente").length;

  return (
    <div>
      <div
        role="tablist"
        aria-label={t("fiches.title")}
        className="mb-5 flex flex-wrap gap-1.5 border-b border-border"
      >
        {TABS.map(({ key, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-rouge text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {t(`fiches.tabs.${key}`)}
              {key === "demandes" && enAttente > 0 && (
                <span className="rounded-full bg-rouge px-1.5 py-0.5 font-mono text-[10px] leading-none text-white">
                  {enAttente}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "fiches" && (
        <FichesList fiches={fiches} conseillers={conseillers} pdvs={pdvs} />
      )}
      {tab === "demandes" && (
        <DemandesPanel
          submissions={submissions}
          conseillers={conseillerOptions}
        />
      )}
      {tab === "liens" && <LiensPanel liens={liens} />}
    </div>
  );
}
