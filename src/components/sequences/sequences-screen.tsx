import { getLocale } from "next-intl/server";
import { getCurrentProfile } from "@/lib/auth";
import { whatsappConfigured } from "@/lib/env";
import {
  listEnvois,
  listFiches,
  listModeles,
  listPdvs,
  listProfiles,
  listRdv,
  listSequenceEtapes,
  listSequences,
} from "@/lib/data/queries";
import {
  compterAAgir,
  formaterTelephone,
  libelleDelai,
  normaliserTelephone,
  planifierEnvois,
} from "@/lib/whatsapp";
import {
  SequencesWorkspace,
  type TabKey,
} from "@/components/sequences/sequences-workspace";
import type { Conversation } from "@/components/sequences/whatsapp-chat";
import type { EtatBulle } from "@/components/sequences/message-bubble";

/**
 * L'écran des séquences WhatsApp, partagé par ses trois routes — chacune
 * n'en choisit que l'onglet d'entrée.
 *
 * Les fils de discussion sont assemblés ici, côté serveur : il faut toutes
 * les fiches, tous les rendez-vous et tout le journal pour les composer, et
 * rien de tout cela n'a à traverser vers le navigateur. Le client ne reçoit
 * que les messages déjà rendus, groupés par client.
 */
export async function SequencesScreen({
  ongletInitial = "messages",
}: {
  ongletInitial?: TabKey;
}) {
  const [locale, profile] = await Promise.all([getLocale(), getCurrentProfile()]);
  if (!profile) return null;

  const [fiches, rdv, sequences, etapes, modeles, pdvs, profiles, envois] =
    await Promise.all([
      listFiches(profile),
      listRdv(profile),
      listSequences(),
      listSequenceEtapes(),
      listModeles(),
      listPdvs(),
      listProfiles(),
      listEnvois(profile),
    ]);

  const plan = planifierEnvois({
    fiches,
    rdv,
    sequences,
    etapes,
    modeles,
    profiles,
    pdvs,
    locale,
  });

  const ficheById = new Map(fiches.map((f) => [f.id, f]));
  const sequenceById = new Map(sequences.map((s) => [s.id, s]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const etapeById = new Map(etapes.map((e) => [e.id, e]));

  /** Un fil par fiche, créé à la première pièce qui le concerne. */
  const fils = new Map<string, Conversation>();

  function filPour(ficheId: string): Conversation | null {
    const existant = fils.get(ficheId);
    if (existant) return existant;
    const fiche = ficheById.get(ficheId);
    if (!fiche) return null;
    const conseiller = profileById.get(fiche.conseiller_id);
    const destinataire = normaliserTelephone(fiche.tel_mobile);
    const fil: Conversation = {
      ficheId: fiche.id,
      client: fiche.client_nom,
      reference: fiche.reference,
      stage: fiche.stage,
      conseiller: conseiller ? `${conseiller.prenom} ${conseiller.nom}` : "",
      destinataire,
      destinataireAffiche: destinataire ? formaterTelephone(destinataire) : null,
      messages: [],
      derniereActivite: fiche.updated_at,
      enAttente: 0,
    };
    fils.set(fiche.id, fil);
    return fil;
  }

  // 1. Ce qui est déjà parti — c'est l'historique du fil.
  const dejaTraces = new Set<string>();
  for (const envoi of envois) {
    if (!envoi.fiche_id || envoi.statut === "annule") continue;
    if (envoi.etape_id) dejaTraces.add(`${envoi.fiche_id}:${envoi.etape_id}`);

    const fil = filPour(envoi.fiche_id);
    if (!fil) continue;

    const etape = envoi.etape_id ? etapeById.get(envoi.etape_id) : undefined;
    const etat: EtatBulle =
      envoi.statut === "repondu"
        ? "repondu"
        : envoi.statut === "echec"
          ? "echec"
          : "envoye";

    fil.messages.push({
      cle: `envoi:${envoi.id}`,
      corps: envoi.corps_rendu,
      horodatage: envoi.envoye_le ?? envoi.planifie_le,
      etat,
      sequenceNom: envoi.sequence_id
        ? (sequenceById.get(envoi.sequence_id)?.nom ?? null)
        : null,
      sequenceId: envoi.sequence_id,
      etapeId: envoi.etape_id,
      delai: etape ? libelleDelai(etape) : null,
      blocage: null,
    });
  }

  // 2. Ce qui reste à envoyer — la même bulle, en pointillé.
  for (const envoi of plan) {
    if (dejaTraces.has(`${envoi.fiche.id}:${envoi.etape.id}`)) continue;
    const fil = filPour(envoi.fiche.id);
    if (!fil) continue;

    fil.messages.push({
      cle: envoi.cle,
      corps: envoi.corps,
      horodatage: envoi.planifieLe.toISOString(),
      etat: envoi.enRetard ? "en_retard" : "programme",
      sequenceNom: envoi.sequence.nom,
      sequenceId: envoi.sequence.id,
      etapeId: envoi.etape.id,
      delai: libelleDelai(envoi.etape),
      blocage: envoi.blocage,
    });
  }

  const conversations = [...fils.values()]
    .map((fil) => {
      fil.messages.sort((a, b) => a.horodatage.localeCompare(b.horodatage));
      fil.enAttente = fil.messages.filter(
        (m) => m.etat === "programme" || m.etat === "en_retard",
      ).length;
      // La date du fil est celle de son dernier message, comme dans WhatsApp —
      // y compris quand ce dernier message n'est encore que prévu.
      fil.derniereActivite =
        fil.messages.at(-1)?.horodatage ?? fil.derniereActivite;
      return fil;
    })
    // Les fils qui réclament quelque chose remontent ; à égalité, le plus
    // récent d'abord. Un conseiller ouvre cet écran pour agir, pas pour lire.
    .sort((a, b) => {
      const urgenceA = a.messages.some((m) => m.etat === "en_retard") ? 0 : 1;
      const urgenceB = b.messages.some((m) => m.etat === "en_retard") ? 0 : 1;
      if (urgenceA !== urgenceB) return urgenceA - urgenceB;
      if (a.enAttente !== b.enAttente) return b.enAttente - a.enAttente;
      return b.derniereActivite.localeCompare(a.derniereActivite);
    });

  const enAttente = compterAAgir(conversations.flatMap((fil) => fil.messages));

  return (
    <SequencesWorkspace
      ongletInitial={ongletInitial}
      sequences={sequences}
      etapes={etapes}
      modeles={modeles}
      pdvs={pdvs}
      profile={profile}
      conversations={conversations}
      passerelleActive={whatsappConfigured()}
      enAttente={enAttente}
    />
  );
}
