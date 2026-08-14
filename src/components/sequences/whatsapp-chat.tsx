"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  Ban,
  Copy,
  Lock,
  MessageCircleMore,
  Search,
  Send,
  TriangleAlert,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { journaliserEnvoi } from "@/lib/actions/sequence-actions";
import { formatDate, isToday } from "@/lib/dates";
import { lienWhatsApp, type MotifBlocage } from "@/lib/whatsapp";
import { cn, messageErreur } from "@/lib/utils";
import {
  MessageBubble,
  PastilleSysteme,
  type EtatBulle,
} from "@/components/sequences/message-bubble";

/** Un message dans un fil : déjà parti, ou seulement prévu. */
export interface ChatMessage {
  cle: string;
  corps: string;
  horodatage: string;
  etat: EtatBulle;
  /** La séquence qui l'a produit, affichée en légende de bulle. */
  sequenceNom: string | null;
  sequenceId: string | null;
  etapeId: string | null;
  delai: string | null;
  blocage: MotifBlocage | null;
}

/** Un fil de discussion : un client, ses messages, son numéro. */
export interface Conversation {
  ficheId: string;
  client: string;
  reference: string;
  stage: string;
  conseiller: string;
  destinataire: string | null;
  destinataireAffiche: string | null;
  messages: ChatMessage[];
  derniereActivite: string;
  /** Combien de messages attendent encore d'être envoyés. */
  enAttente: number;
}

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/);
  return ((mots[0]?.[0] ?? "") + (mots[1]?.[0] ?? "")).toUpperCase();
}

/**
 * WhatsApp, tel quel.
 *
 * Cet écran remplace la file d'attente et le journal : c'était deux tableaux
 * là où le conseiller n'a qu'une question — « qu'est-ce que ce client a déjà
 * reçu, et qu'est-ce qui part ensuite ». Dans un fil, la réponse se lit sans
 * l'expliquer. Les messages déjà partis portent leurs coches, ceux qui
 * attendent gardent la même bulle en pointillé, et le pied de page envoie le
 * prochain d'un tap au lieu d'un formulaire.
 *
 * Les couleurs sont celles de WhatsApp, pas celles de CUISINA. C'est délibéré
 * et limité à cet écran : on prévisualise ce que le client verra chez lui.
 */
export function WhatsAppChat({
  conversations,
  passerelleActive,
}: {
  conversations: Conversation[];
  passerelleActive: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [actifId, setActifId] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [traces, setTraces] = useState<Set<string>>(new Set());
  const [erreur, setErreur] = useState<string | null>(null);
  const filRef = useRef<HTMLDivElement>(null);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.client.toLowerCase().includes(q) ||
        c.reference.toLowerCase().includes(q),
    );
  }, [conversations, recherche]);

  const active = conversations.find((c) => c.ficheId === actifId) ?? null;

  // Comme WhatsApp : on ouvre un fil au dernier message, pas au premier.
  // Et comme WhatsApp Web, aucun fil n'est ouvert d'office — la liste
  // d'abord, sur tous les écrans.
  useEffect(() => {
    const fil = filRef.current;
    if (fil) fil.scrollTop = fil.scrollHeight;
  }, [actifId]);

  function marquerEnvoye(conversation: Conversation, message: ChatMessage) {
    const numero = conversation.destinataire;
    if (!numero) return;
    setErreur(null);
    setTraces((s) => new Set(s).add(message.cle));
    void journaliserEnvoi({
      sequence_id: message.sequenceId,
      etape_id: message.etapeId,
      fiche_id: conversation.ficheId,
      destinataire: numero,
      corps_rendu: message.corps,
      statut: "envoye",
      planifie_le: message.horodatage,
    }).then((resultat) => {
      if (!resultat.ok) {
        setTraces((s) => {
          const copie = new Set(s);
          copie.delete(message.cle);
          return copie;
        });
        setErreur(
          messageErreur(t, resultat.error),
        );
      }
    });
  }

  function envoyer(conversation: Conversation, message: ChatMessage) {
    const numero = conversation.destinataire;
    if (!numero) return;
    window.open(
      lienWhatsApp(numero, message.corps),
      "_blank",
      "noopener,noreferrer",
    );
    marquerEnvoye(conversation, message);
  }

  if (conversations.length === 0) {
    return (
      <div className="wa grid min-h-[50vh] place-items-center rounded-2xl border border-border bg-card/60">
        <div className="max-w-sm p-10 text-center">
          <MessageCircleMore
            aria-hidden
            className="mx-auto mb-4 size-10"
            style={{ color: "var(--wa-vert)" }}
          />
          <p className="font-display text-lg font-semibold">
            {t("sequences.chat.aucuneConversation")}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("sequences.chat.aucuneConversationAide")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!passerelleActive && (
        <div
          className="flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm"
          style={{
            background: "color-mix(in srgb, var(--chene) 10%, transparent)",
          }}
        >
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-chene" />
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">
              {t("sequences.chat.bandeauTitre")}
            </span>{" "}
            {t("sequences.chat.bandeauTexte")}
          </p>
        </div>
      )}

      {erreur && (
        <p role="alert" className="text-sm font-medium text-rouge">
          {erreur}
        </p>
      )}

      <div
        className="wa flex h-[clamp(30rem,calc(100vh-17rem),52rem)] overflow-hidden rounded-xl shadow-lg"
        style={{ border: "1px solid var(--wa-separateur)" }}
      >
        {/* ——— Liste des discussions ——— */}
        <aside
          className={cn(
            "flex w-full shrink-0 flex-col md:w-[22rem] lg:w-[24rem]",
            active && "hidden md:flex",
          )}
          style={{
            background: "var(--wa-panneau)",
            borderInlineEnd: "1px solid var(--wa-separateur)",
          }}
        >
          <div
            className="flex h-14 shrink-0 items-center px-4"
            style={{ background: "var(--wa-entete)" }}
          >
            <p
              className="text-[17px] font-semibold"
              style={{ color: "var(--wa-texte)" }}
            >
              {t("sequences.chat.discussions")}
            </p>
          </div>

          <div className="shrink-0 p-2" style={{ background: "var(--wa-panneau)" }}>
            <div
              className="flex items-center gap-3 rounded-lg px-3 py-1.5"
              style={{ background: "var(--wa-entete)" }}
            >
              <Search
                aria-hidden
                className="size-4 shrink-0"
                style={{ color: "var(--wa-attenue)" }}
              />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder={t("sequences.chat.rechercher")}
                aria-label={t("sequences.chat.rechercher")}
                className="h-7 w-full bg-transparent text-[14px] outline-none"
                style={{ color: "var(--wa-texte)" }}
              />
            </div>
          </div>

          <div className="wa-scroll flex-1 overflow-y-auto">
            {filtrees.length === 0 ? (
              <p
                className="p-6 text-center text-[13px]"
                style={{ color: "var(--wa-attenue)" }}
              >
                {t("sequences.chat.aucunResultat")}
              </p>
            ) : (
              filtrees.map((conversation) => {
                const dernier = conversation.messages.at(-1);
                const selectionne = conversation.ficheId === actifId;
                const restants = conversation.messages.filter(
                  (m) =>
                    (m.etat === "programme" || m.etat === "en_retard") &&
                    !traces.has(m.cle),
                ).length;
                return (
                  <button
                    key={conversation.ficheId}
                    type="button"
                    onClick={() => setActifId(conversation.ficheId)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors"
                    style={{
                      background: selectionne
                        ? "color-mix(in srgb, var(--wa-attenue) 16%, transparent)"
                        : "transparent",
                      borderBottom: "1px solid var(--wa-separateur)",
                    }}
                  >
                    <span
                      className="grid size-12 shrink-0 place-items-center rounded-full text-[15px] font-semibold text-white"
                      style={{ background: "var(--wa-vert)" }}
                    >
                      {initiales(conversation.client)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className="truncate text-[16px]"
                          style={{ color: "var(--wa-texte)" }}
                        >
                          {conversation.client}
                        </span>
                        <span
                          className="shrink-0 text-[12px]"
                          style={{
                            color: restants
                              ? "var(--wa-vert)"
                              : "var(--wa-attenue)",
                          }}
                        >
                          {formatDate(conversation.derniereActivite, "d MMM", locale)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span
                          className="truncate text-[13.5px]"
                          style={{ color: "var(--wa-attenue)" }}
                        >
                          {dernier?.corps.replace(/\s+/g, " ") ?? ""}
                        </span>
                        {restants > 0 && (
                          <span
                            className="grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                            style={{ background: "var(--wa-vert)" }}
                          >
                            {restants}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ——— Le fil ——— */}
        {active ? (
          <section className="flex min-w-0 flex-1 flex-col">
            <header
              className="flex h-14 shrink-0 items-center gap-3 px-3"
              style={{
                background: "var(--wa-entete)",
                borderBottom: "1px solid var(--wa-separateur)",
              }}
            >
              <button
                type="button"
                onClick={() => setActifId(null)}
                aria-label={t("app.back")}
                className="md:hidden"
                style={{ color: "var(--wa-attenue)" }}
              >
                <ArrowLeft className="size-5" />
              </button>
              <span
                className="grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white"
                style={{ background: "var(--wa-vert)" }}
              >
                {initiales(active.client)}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[16px] font-medium"
                  style={{ color: "var(--wa-texte)" }}
                >
                  {active.client}
                </p>
                <p
                  className="truncate text-[12.5px]"
                  style={{ color: "var(--wa-attenue)" }}
                >
                  {active.destinataireAffiche ?? t("sequences.chat.sansNumero")}
                </p>
              </div>
              <Link
                href={`/fiches/${active.ficheId}`}
                prefetch={false}
                className="shrink-0 rounded-full px-3 py-1 font-mono text-[11px] transition-colors hover:underline"
                style={{ color: "var(--wa-attenue)" }}
              >
                {active.reference}
              </Link>
            </header>

            <div
              ref={filRef}
              className="wa-papier wa-scroll flex-1 space-y-2 overflow-y-auto px-4 py-4 md:px-12"
            >
              {active.messages.map((message, i) => {
                const precedent = active.messages[i - 1];
                const nouveauJour =
                  !precedent ||
                  precedent.horodatage.slice(0, 10) !==
                    message.horodatage.slice(0, 10);
                const trace = traces.has(message.cle);
                const etat: EtatBulle = trace ? "envoye" : message.etat;
                const attente = etat === "programme" || etat === "en_retard";

                return (
                  <div key={message.cle} className="space-y-2">
                    {nouveauJour && (
                      <div className="py-1.5">
                        <PastilleSysteme>
                          {isToday(message.horodatage)
                            ? t("app.today").toUpperCase()
                            : formatDate(
                                message.horodatage,
                                "d MMMM yyyy",
                                locale,
                              )}
                        </PastilleSysteme>
                      </div>
                    )}

                    <div className="group/msg">
                      <MessageBubble
                        corps={message.corps}
                        heure={formatDate(message.horodatage, "HH:mm", locale)}
                        etat={etat}
                        legende={
                          message.sequenceNom
                            ? `${message.sequenceNom}${message.delai ? ` · ${message.delai}` : ""}`
                            : undefined
                        }
                      />

                      {/* Les commandes n'apparaissent que sur ce qui attend. */}
                      {attente && (
                        <div className="mt-1 flex items-center justify-end gap-2">
                          {message.blocage ? (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium"
                              style={{
                                background:
                                  "color-mix(in srgb, var(--destructive) 14%, transparent)",
                                color: "var(--destructive)",
                              }}
                            >
                              <Ban aria-hidden className="size-3" />
                              {t(`sequences.chat.blocages.${message.blocage}`)}
                            </span>
                          ) : (
                            <>
                              {etat === "en_retard" && (
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium"
                                  style={{
                                    background:
                                      "color-mix(in srgb, var(--ambre) 16%, transparent)",
                                    color: "var(--ambre)",
                                  }}
                                >
                                  <TriangleAlert aria-hidden className="size-3" />
                                  {t("sequences.chat.enRetard")}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  void navigator.clipboard.writeText(
                                    message.corps,
                                  )
                                }
                                aria-label={t("sequences.chat.copier")}
                                className="rounded-full p-1.5 transition-colors"
                                style={{ color: "var(--wa-attenue)" }}
                              >
                                <Copy className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => envoyer(active, message)}
                                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
                                style={{ background: "var(--wa-vert)" }}
                              >
                                <Send aria-hidden className="size-3.5" />
                                {t("sequences.chat.envoyer")}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {message.etat === "repondu" && (
                      <div className="py-1">
                        <PastilleSysteme>
                          {t("sequences.chat.clientARepondu")}
                        </PastilleSysteme>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <FooterFil
              conversation={active}
              traces={traces}
              onEnvoyer={(message) => envoyer(active, message)}
            />
          </section>
        ) : (
          <section
            className="hidden flex-1 place-items-center md:grid"
            style={{
              background: "var(--wa-entete)",
              borderBottom: "6px solid var(--wa-vert)",
            }}
          >
            <div className="max-w-md px-8 text-center">
              <MessageCircleMore
                aria-hidden
                className="mx-auto mb-5 size-16"
                strokeWidth={1.2}
                style={{ color: "var(--wa-attenue)" }}
              />
              <p
                className="text-[28px] font-light"
                style={{ color: "var(--wa-texte)" }}
              >
                {t("sequences.chat.accueilTitre")}
              </p>
              <p
                className="mt-3 text-[14px] leading-relaxed"
                style={{ color: "var(--wa-attenue)" }}
              >
                {t("sequences.chat.choisirDiscussion")}
              </p>
              <p
                className="mt-10 inline-flex items-center gap-1.5 text-[13px]"
                style={{ color: "var(--wa-attenue)" }}
              >
                <Lock aria-hidden className="size-3.5" />
                {t("sequences.chat.accueilPied")}
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * Le pied du fil. Là où WhatsApp met un champ de saisie, on met le prochain
 * message programmé : ici on n'écrit pas, on approuve. Quand la file est
 * vide, la barre le dit plutôt que de disparaître.
 */
function FooterFil({
  conversation,
  traces,
  onEnvoyer,
}: {
  conversation: Conversation;
  traces: Set<string>;
  onEnvoyer: (message: ChatMessage) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();

  const prochain = conversation.messages.find(
    (m) =>
      (m.etat === "programme" || m.etat === "en_retard") &&
      !traces.has(m.cle) &&
      !m.blocage,
  );

  return (
    <footer
      className="flex shrink-0 items-center gap-3 px-3 py-2.5"
      style={{
        background: "var(--wa-entete)",
        borderTop: "1px solid var(--wa-separateur)",
      }}
    >
      {prochain ? (
        <>
          <div
            className="min-w-0 flex-1 rounded-full px-4 py-2.5"
            style={{ background: "var(--wa-panneau)" }}
          >
            <p
              className="truncate text-[14px]"
              style={{ color: "var(--wa-texte)" }}
            >
              {prochain.corps.replace(/\s+/g, " ")}
            </p>
            <p className="text-[11.5px]" style={{ color: "var(--wa-attenue)" }}>
              {t("sequences.chat.prevuPour", {
                quand: isToday(prochain.horodatage)
                  ? `${t("app.today").toLowerCase()} ${formatDate(prochain.horodatage, "HH:mm", locale)}`
                  : formatDate(prochain.horodatage, "EEEE d MMM 'à' HH:mm", locale),
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onEnvoyer(prochain)}
            aria-label={t("sequences.chat.envoyer")}
            className="grid size-11 shrink-0 place-items-center rounded-full text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--wa-vert)" }}
          >
            <Send className="size-5" />
          </button>
        </>
      ) : (
        <p
          className="flex-1 py-2 text-center text-[13px]"
          style={{ color: "var(--wa-attenue)" }}
        >
          {conversation.destinataire
            ? t("sequences.chat.rienEnAttente")
            : t("sequences.chat.sansNumeroAide")}
        </p>
      )}
    </footer>
  );
}
