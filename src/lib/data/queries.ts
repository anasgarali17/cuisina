import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import type {
  ClientRow,
  FicheHistoriqueRow,
  FicheRelanceRow,
  FicheRow,
  PointDeVenteRow,
  ProfileRow,
  RendezVousRow,
  TacheRow,
} from "@/lib/database.types";
import {
  demoClients,
  demoFiches,
  demoHistorique,
  demoPdvs,
  demoProfiles,
  demoRdv,
  demoRelances,
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
