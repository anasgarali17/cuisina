import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import type {
  ClientActifRow,
  ClientRow,
  FicheHistoriqueRow,
  FicheLienRow,
  FicheRelanceRow,
  FicheRow,
  FicheSubmissionRow,
  FournisseurRow,
  MessageEnvoyeRow,
  ModeleMessageRow,
  PointDeVenteRow,
  ProfileRow,
  RendezVousRow,
  SequenceEtapeRow,
  SequenceRow,
  TacheRow,
} from "@/lib/database.types";
import type { LienAudience } from "@/lib/domain";
import { resolveVille } from "@/lib/geo/tunisia";
import type { RegionCode } from "@/lib/geo/tunisia-regions";
import {
  demoClients,
  demoClientsActifs,
  demoEnvois,
  demoFiches,
  demoFournisseurs,
  demoHistorique,
  demoLiensPublics,
  demoModeles,
  demoPdvs,
  demoProfiles,
  demoRdv,
  demoRelances,
  demoSequenceEtapes,
  demoSequences,
  demoTaches,
} from "@/lib/data/demo";

/**
 * Read layer. With Supabase configured, RLS already scopes rows to the
 * caller; demo mode reproduces the same scoping in memory.
 *
 * Every export is wrapped in React `cache()` so a page that needs the same
 * list in two components pays for one round trip, and columns are listed
 * explicitly — `select("*")` was pulling the whole `exigences` jsonb into
 * every board and table that never reads it.
 */

/** Columns the lists actually render. Detail views ask for the rest. */
const FICHE_LIST_COLUMNS =
  "id, reference, client_nom, tel_mobile, email, adresse_complete, ville, origine, nb_cuisines, nb_dressings, nb_sdb, budget_estimatif, observations, stage, motif_perte, motif_perte_libre, motif_pause, motif_pause_detail, pause_cadence_jours, pause_reprise_le, date_prevue_remise_devis, date_effective_remise_devis, score_completude, conseiller_id, point_de_vente_id, client_id, created_at, updated_at";

/**
 * Everything a screen needs, in one round trip.
 *
 * The per-table helpers below read from this snapshot, so a page that calls
 * `listFiches` + `listProfiles` + `listPdvs` + `listTaches` pays for a single
 * request instead of four. RLS still applies — `app_snapshot` is a
 * SECURITY INVOKER function.
 */
interface Snapshot {
  fiches: FicheRow[];
  profiles: ProfileRow[];
  pdvs: PointDeVenteRow[];
  taches: TacheRow[];
  rdv: RendezVousRow[];
  clients: ClientRow[];
  fournisseurs: FournisseurRow[];
  sequences: SequenceRow[];
  sequence_etapes: SequenceEtapeRow[];
  modeles: ModeleMessageRow[];
  historique: FicheHistoriqueRow[];
  relances: FicheRelanceRow[];
}

const EMPTY_SNAPSHOT: Snapshot = {
  fiches: [],
  profiles: [],
  pdvs: [],
  taches: [],
  rdv: [],
  clients: [],
  fournisseurs: [],
  sequences: [],
  sequence_etapes: [],
  modeles: [],
  historique: [],
  relances: [],
};

/** 90 days back covers every window the dashboard computes. */
function defaultSince(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString();
}

export const getSnapshot = cache(async (): Promise<Snapshot> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("app_snapshot", {
    p_since: defaultSince(),
  });
  if (error || !data) return EMPTY_SNAPSHOT;
  return { ...EMPTY_SNAPSHOT, ...(data as Partial<Snapshot>) };
});

function demoScope(profile: ProfileRow): (f: {
  conseiller_id?: string;
  point_de_vente_id?: string | null;
  assigne_a?: string;
}) => boolean {
  if (profile.role === "direction" || profile.role === "admin") return () => true;
  if (profile.role === "chef_showroom") {
    return (f) => f.point_de_vente_id === profile.point_de_vente_id;
  }
  return (f) =>
    f.conseiller_id === profile.id || f.assigne_a === profile.id;
}

export const listPdvs = cache(async (): Promise<PointDeVenteRow[]> => {
  if (!supabaseConfigured()) return demoPdvs;
  return (await getSnapshot()).pdvs;
});

/**
 * Donnée référentielle, comme les points de vente : la même liste pour tout
 * le monde. `app_snapshot` ne renvoie que les fournisseurs actifs.
 */
export const listFournisseurs = cache(async (): Promise<FournisseurRow[]> => {
  if (!supabaseConfigured()) return demoFournisseurs;
  return (await getSnapshot()).fournisseurs;
});

export const listProfiles = cache(async (): Promise<ProfileRow[]> => {
  if (!supabaseConfigured()) return demoProfiles;
  return (await getSnapshot()).profiles;
});

export const listFiches = cache(
  async (profile: ProfileRow): Promise<FicheRow[]> => {
    if (!supabaseConfigured()) {
      return demoFiches.filter(demoScope(profile));
    }
    return (await getSnapshot()).fiches;
  },
);

export interface FicheDetail {
  fiche: FicheRow;
  historique: FicheHistoriqueRow[];
  relances: FicheRelanceRow[];
}

export const getFicheDetail = cache(
  async (id: string): Promise<FicheDetail | null> => {
    if (!supabaseConfigured()) {
      const fiche = demoFiches.find((f) => f.id === id);
      if (!fiche) return null;
      return {
        fiche,
        historique: demoHistorique
          .filter((h) => h.fiche_id === id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at)),
        relances: demoRelances
          .filter((r) => r.fiche_id === id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      };
    }
    const supabase = await createClient();
    // One round trip: the detail page needs all three lists together.
    const [{ data: fiche }, { data: historique }, { data: relances }] =
      await Promise.all([
        supabase.from("fiches_contact").select("*").eq("id", id).single(),
        supabase
          .from("fiche_historique")
          .select("*")
          .eq("fiche_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("fiche_relances")
          .select("*")
          .eq("fiche_id", id)
          .order("created_at", { ascending: false }),
      ]);
    if (!fiche) return null;
    return { fiche, historique: historique ?? [], relances: relances ?? [] };
  },
);

export const listTaches = cache(
  async (profile: ProfileRow): Promise<TacheRow[]> => {
    if (!supabaseConfigured()) {
      return demoTaches.filter(demoScope(profile));
    }
    return (await getSnapshot()).taches;
  },
);

export const listRdv = cache(
  async (profile: ProfileRow): Promise<RendezVousRow[]> => {
    if (!supabaseConfigured()) {
      return demoRdv.filter(demoScope(profile));
    }
    return (await getSnapshot()).rdv;
  },
);

export const listClients = cache(
  async (profile: ProfileRow): Promise<ClientRow[]> => {
    if (!supabaseConfigured()) {
      if (profile.role === "direction" || profile.role === "admin") {
        return demoClients;
      }
      return demoClients.filter(
        (c) => c.point_de_vente_id === profile.point_de_vente_id,
      );
    }
    return (await getSnapshot()).clients;
  },
);

export const getClient = cache(
  async (
    id: string,
  ): Promise<{ client: ClientRow; fiches: FicheRow[] } | null> => {
    if (!supabaseConfigured()) {
      const client = demoClients.find((c) => c.id === id);
      if (!client) return null;
      return { client, fiches: demoFiches.filter((f) => f.client_id === id) };
    }
    const supabase = await createClient();
    const [{ data: client }, { data: fiches }] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase
        .from("fiches_contact")
        .select(FICHE_LIST_COLUMNS)
        .eq("client_id", id),
    ]);
    if (!client) return null;
    return { client, fiches: (fiches ?? []) as unknown as FicheRow[] };
  },
);

export const listHistoriqueSince = cache(
  async (
    profile: ProfileRow,
    sinceIso: string,
  ): Promise<FicheHistoriqueRow[]> => {
    if (!supabaseConfigured()) {
      const visible = new Set(
        demoFiches.filter(demoScope(profile)).map((f) => f.id),
      );
      return demoHistorique.filter(
        (h) => visible.has(h.fiche_id) && h.created_at >= sinceIso,
      );
    }
    const { historique } = await getSnapshot();
    // The snapshot spans 90 days; narrow if the caller asked for less.
    return historique.filter((h) => h.created_at >= sinceIso);
  },
);

/* — Séquences WhatsApp — */

/**
 * Modèles et séquences sont du paramétrage : la même liste pour tout le
 * monde, comme les points de vente. Ce que chacun voit filtré, c'est le
 * journal — il suit la fiche, donc la portée du conseiller.
 */
export const listModeles = cache(async (): Promise<ModeleMessageRow[]> => {
  if (!supabaseConfigured()) return demoModeles;
  return (await getSnapshot()).modeles;
});

export const listSequences = cache(async (): Promise<SequenceRow[]> => {
  if (!supabaseConfigured()) return demoSequences;
  return (await getSnapshot()).sequences;
});

export const listSequenceEtapes = cache(
  async (): Promise<SequenceEtapeRow[]> => {
    if (!supabaseConfigured()) return demoSequenceEtapes;
    return (await getSnapshot()).sequence_etapes;
  },
);

/**
 * Le journal. Hors snapshot à dessein : il grossit à chaque message et une
 * seule page le lit. RLS le borne déjà au périmètre du conseiller.
 */
export const listEnvois = cache(
  async (profile: ProfileRow, limite = 200): Promise<MessageEnvoyeRow[]> => {
    if (!supabaseConfigured()) {
      // Le journal suit la fiche : en démo on reproduit à la main la portée
      // que la policy `envois_select` applique en base.
      const visibles = new Set(
        demoFiches.filter(demoScope(profile)).map((f) => f.id),
      );
      return demoEnvois
        .filter((e) => e.fiche_id && visibles.has(e.fiche_id))
        .sort((a, b) => b.planifie_le.localeCompare(a.planifie_le));
    }
    const supabase = await createClient();
    const { data } = await supabase
      .from("messages_envoyes")
      .select("*")
      .order("planifie_le", { ascending: false })
      .limit(limite);
    return data ?? [];
  },
);

/* — Fiche remplie par le client : liens de collecte et demandes reçues — */

export const listLiens = cache(async (): Promise<FicheLienRow[]> => {
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("fiche_liens")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
});

export const listSubmissions = cache(async (): Promise<FicheSubmissionRow[]> => {
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("fiche_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
});

export interface LienPublic {
  libelle: string;
  audience: LienAudience;
  locale: "fr" | "ar" | "en";
  pdv_nom: string;
  pdv_ville: string;
}

/**
 * En-tête d'un lien de collecte, lu sans session. Passe par une fonction
 * security definer : le visiteur n'a aucun droit sur les tables.
 */
export const getLienPublic = cache(
  async (token: string): Promise<LienPublic | null> => {
    if (!supabaseConfigured()) {
      // En démo, les deux tokens semés par la migration 0011 ouvrent le même
      // formulaire vide : sans cela le parcours client serait le seul écran
      // impossible à montrer sans base.
      const lien = demoLiensPublics[token];
      return lien ?? null;
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("lien_public", {
      p_token: token,
    });
    if (error || !data) return null;
    return data as LienPublic;
  },
);

/**
 * Les dossiers en production, avec le nom du client repris de la fiche —
 * une carte sans nom ne sert à rien, et le nom vit côté fiche.
 *
 * `clients_actifs` n'entre pas dans `app_snapshot` : cette liste ne s'affiche
 * que sur son propre écran, et la charger partout coûterait plus qu'elle ne
 * rapporte.
 */
export interface ClientActifDetail extends ClientActifRow {
  client_nom: string;
  reference: string;
  budget_estimatif: number | null;
  ville: string | null;
}

export const listClientsActifs = cache(
  async (profile: ProfileRow): Promise<ClientActifDetail[]> => {
    if (!supabaseConfigured()) {
      const scope = demoScope(profile);
      const ficheById = new Map(demoFiches.map((f) => [f.id, f]));
      return demoClientsActifs.filter(scope).flatMap((ca) => {
        const fiche = ficheById.get(ca.fiche_id);
        return fiche
          ? [
              {
                ...ca,
                client_nom: fiche.client_nom,
                reference: fiche.reference,
                budget_estimatif: fiche.budget_estimatif,
                ville: fiche.ville,
              },
            ]
          : [];
      });
    }
    const supabase = await createClient();
    const { data } = await supabase
      .from("clients_actifs")
      .select(
        "*, fiches_contact(client_nom, reference, budget_estimatif, ville)",
      )
      .order("updated_at", { ascending: false });
    if (!data) return [];
    type Joined = ClientActifRow & {
      fiches_contact: {
        client_nom: string;
        reference: string;
        budget_estimatif: number | null;
        ville: string | null;
      } | null;
    };
    return (data as unknown as Joined[]).map(({ fiches_contact, ...ca }) => ({
      ...ca,
      client_nom: fiches_contact?.client_nom ?? "—",
      reference: fiches_contact?.reference ?? "—",
      budget_estimatif: fiches_contact?.budget_estimatif ?? null,
      ville: fiches_contact?.ville ?? null,
    }));
  },
);

/**
 * Les showrooms tels que le formulaire public les montre : regroupés par
 * zone commerciale, avec le téléphone qui s'affiche dès la sélection.
 *
 * Passe par `showrooms_publics()` — le client n'a pas de compte, et
 * `points_de_vente` n'est lisible que par les comptes authentifiés. La zone
 * est déduite de la ville, comme sur la carte du réseau.
 */
export interface ShowroomPublic {
  id: string;
  nom: string;
  ville: string;
  adresse: string | null;
  telephone: string | null;
  region: RegionCode | null;
}

export const listShowroomsPublics = cache(
  async (): Promise<ShowroomPublic[]> => {
    const brut: Array<Omit<ShowroomPublic, "region">> = supabaseConfigured()
      ? await (async () => {
          const supabase = await createClient();
          const { data } = await supabase.rpc("showrooms_publics");
          return (data as Array<Omit<ShowroomPublic, "region">>) ?? [];
        })()
      : demoPdvs.map((p) => ({
          id: p.id,
          nom: p.nom,
          ville: p.ville,
          adresse: p.adresse,
          telephone: p.telephone,
        }));

    return brut.map((p) => ({
      ...p,
      region: resolveVille(p.ville)?.region ?? null,
    }));
  },
);

export const listRelancesForFiches = cache(
  async (ficheIds: string[]): Promise<FicheRelanceRow[]> => {
    if (ficheIds.length === 0) return [];
    if (!supabaseConfigured()) {
      const set = new Set(ficheIds);
      return demoRelances.filter((r) => set.has(r.fiche_id));
    }
    const wanted = new Set(ficheIds);
    const { relances } = await getSnapshot();
    return relances.filter((r) => wanted.has(r.fiche_id));
  },
);
