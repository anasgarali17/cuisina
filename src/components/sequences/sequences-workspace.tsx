"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquareText, ToggleRight, WholeWord } from "lucide-react";
import type {
  ModeleMessageRow,
  PointDeVenteRow,
  ProfileRow,
  SequenceEtapeRow,
  SequenceRow,
} from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { SequencesPanel } from "@/components/sequences/sequences-panel";
import { ModelesPanel } from "@/components/sequences/modeles-panel";
import {
  WhatsAppChat,
  type Conversation,
} from "@/components/sequences/whatsapp-chat";

const TABS = [
  { key: "messages", icon: MessageSquareText },
  { key: "activation", icon: ToggleRight },
  { key: "textes", icon: WholeWord },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

/**
 * Trois onglets, trois questions : qu'est-ce que mes clients reçoivent, quels
 * automatismes sont allumés, et que disent les textes.
 *
 * Les Messages passent en premier parce que c'est le poste de travail
 * quotidien — l'activation et les textes se règlent une fois par trimestre.
 */
export function SequencesWorkspace({
  ongletInitial = "messages",
  sequences,
  etapes,
  modeles,
  pdvs,
  profile,
  conversations,
  passerelleActive,
  enAttente,
}: {
  ongletInitial?: TabKey;
  sequences: SequenceRow[];
  etapes: SequenceEtapeRow[];
  modeles: ModeleMessageRow[];
  pdvs: PointDeVenteRow[];
  profile: ProfileRow;
  conversations: Conversation[];
  passerelleActive: boolean;
  /** Nombre de messages programmés en attente, tous fils confondus. */
  enAttente: number;
}) {
  const t = useTranslations();
  const [tab, setTab] = useState<TabKey>(ongletInitial);

  const compteParSequence: Record<string, number> = {};
  for (const conversation of conversations) {
    for (const message of conversation.messages) {
      if (!message.sequenceId) continue;
      if (message.etat !== "programme" && message.etat !== "en_retard") continue;
      compteParSequence[message.sequenceId] =
        (compteParSequence[message.sequenceId] ?? 0) + 1;
    }
  }

  const usageParModele: Record<string, number> = {};
  for (const etape of etapes) {
    usageParModele[etape.modele_id] = (usageParModele[etape.modele_id] ?? 0) + 1;
  }

  return (
    <div>
      <PageHeader
        title={t("sequences.title")}
        subtitle={
          passerelleActive
            ? t("sequences.sousTitreActif")
            : t("sequences.sousTitreSimulation")
        }
      />

      <div
        role="tablist"
        aria-label={t("sequences.title")}
        className="mb-5 flex flex-wrap gap-1.5 border-b border-border"
      >
        {TABS.map(({ key, icon: Icon }) => {
          const actif = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => setTab(key)}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
                actif
                  ? "border-rouge text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {t(`sequences.tabs.${key}`)}
              {key === "messages" && enAttente > 0 && (
                <span className="rounded-full bg-rouge px-1.5 py-0.5 font-mono text-[10px] leading-none text-white">
                  {enAttente}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "messages" && (
        <WhatsAppChat
          conversations={conversations}
          passerelleActive={passerelleActive}
        />
      )}
      {tab === "activation" && (
        <SequencesPanel
          sequences={sequences}
          etapes={etapes}
          modeles={modeles}
          pdvs={pdvs}
          profile={profile}
          compteParSequence={compteParSequence}
        />
      )}
      {tab === "textes" && (
        <ModelesPanel
          modeles={modeles}
          profile={profile}
          usageParModele={usageParModele}
        />
      )}
    </div>
  );
}
