import "server-only";
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
 */

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

export async function listPdvs(): Promise<PointDeVenteRow[]> {
  if (!supabaseConfigured()) return demoPdvs;
  const supabase = await createClient();
  const { data } = await supabase.from("points_de_vente").select("*").order("nom");
  return data ?? [];
}

export async function listProfiles(): Promise<ProfileRow[]> {
  if (!supabaseConfigured()) return demoProfiles;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("actif", true)
    .order("nom");
  return data ?? [];
}

export async function listFiches(profile: ProfileRow): Promise<FicheRow[]> {
  if (!supabaseConfigured()) {
    return demoFiches.filter(demoScope(profile));
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("fiches_contact")
    .select("*")
    .order("updated_at", { ascending: false });
  return data ?? [];
}

export interface FicheDetail {
  fiche: FicheRow;
  historique: FicheHistoriqueRow[];
  relances: FicheRelanceRow[];
}

export async function getFicheDetail(id: string): Promise<FicheDetail | null> {
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
  const { data: fiche } = await supabase
    .from("fiches_contact")
    .select("*")
    .eq("id", id)
    .single();
  if (!fiche) return null;
  const [{ data: historique }, { data: relances }] = await Promise.all([
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
  return { fiche, historique: historique ?? [], relances: relances ?? [] };
}

export async function listTaches(profile: ProfileRow): Promise<TacheRow[]> {
  if (!supabaseConfigured()) {
    return demoTaches.filter(demoScope(profile));
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("taches")
    .select("*")
    .order("echeance", { ascending: true, nullsFirst: false });
  return data ?? [];
}

export async function listRdv(profile: ProfileRow): Promise<RendezVousRow[]> {
  if (!supabaseConfigured()) {
    return demoRdv.filter(demoScope(profile));
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("rendez_vous")
    .select("*")
    .order("debut");
  return data ?? [];
}

export async function listClients(profile: ProfileRow): Promise<ClientRow[]> {
  if (!supabaseConfigured()) {
    if (profile.role === "direction" || profile.role === "admin") {
      return demoClients;
    }
    return demoClients.filter(
      (c) => c.point_de_vente_id === profile.point_de_vente_id,
    );
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getClient(id: string): Promise<{
  client: ClientRow;
  fiches: FicheRow[];
} | null> {
  if (!supabaseConfigured()) {
    const client = demoClients.find((c) => c.id === id);
    if (!client) return null;
    return { client, fiches: demoFiches.filter((f) => f.client_id === id) };
  }
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();
  if (!client) return null;
  const { data: fiches } = await supabase
    .from("fiches_contact")
    .select("*")
    .eq("client_id", id);
  return { client, fiches: fiches ?? [] };
}

export async function listHistoriqueSince(
  profile: ProfileRow,
  sinceIso: string,
): Promise<FicheHistoriqueRow[]> {
  if (!supabaseConfigured()) {
    const visible = new Set(demoFiches.filter(demoScope(profile)).map((f) => f.id));
    return demoHistorique.filter(
      (h) => visible.has(h.fiche_id) && h.created_at >= sinceIso,
    );
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("fiche_historique")
    .select("*")
    .gte("created_at", sinceIso);
  return data ?? [];
}

export async function listRelancesForFiches(
  ficheIds: string[],
): Promise<FicheRelanceRow[]> {
  if (ficheIds.length === 0) return [];
  if (!supabaseConfigured()) {
    const set = new Set(ficheIds);
    return demoRelances.filter((r) => set.has(r.fiche_id));
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("fiche_relances")
    .select("*")
    .in("fiche_id", ficheIds);
  return data ?? [];
}
