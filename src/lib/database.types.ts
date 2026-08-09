/**
 * Hand-maintained Database types mirroring supabase/migrations.
 * Regenerate with `supabase gen types typescript` once the CLI is linked.
 */

import type {
  Canal,
  EtatChantier,
  MotifPause,
  MotifPerte,
  Origine,
  Priorite,
  RdvType,
  Role,
  StageOrPerdu,
} from "@/lib/domain";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface PointDeVenteRow {
  id: string;
  nom: string;
  ville: string;
  adresse: string | null;
  telephone: string | null;
  actif: boolean;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  nom: string;
  prenom: string;
  role: Role;
  point_de_vente_id: string | null;
  locale: "fr" | "ar" | "en";
  objectif_mensuel: number;
  avatar_url: string | null;
  actif: boolean;
  created_at: string;
}

export interface ClientRow {
  id: string;
  nom: string;
  tel: string | null;
  email: string | null;
  adresse: string | null;
  ville: string | null;
  ca_cumule: number;
  nb_projets: number;
  point_de_vente_id: string | null;
  created_at: string;
}

export interface FicheRow {
  id: string;
  reference: string;
  client_nom: string;
  tel_domicile: string | null;
  tel_mobile: string | null;
  tel_bureau: string | null;
  email: string | null;
  adresse_complete: string | null;
  code_postal: string | null;
  ville: string | null;
  origine: Origine | null;
  origine_detail: string | null;
  nb_cuisines: number;
  nb_dressings: number;
  nb_sdb: number;
  etat_chantier: EtatChantier | null;
  budget_estimatif: number | null;
  date_livraison_souhaitee: string | null;
  observations: string | null;
  exigences: Json;
  stage: StageOrPerdu;
  motif_perte: MotifPerte | null;
  motif_perte_libre: string | null;
  motif_pause: MotifPause | null;
  motif_pause_detail: string | null;
  pause_cadence_jours: number | null;
  pause_reprise_le: string | null;
  date_prevue_remise_devis: string | null;
  date_effective_remise_devis: string | null;
  date_prete_devis: string | null;
  remarques_client: string | null;
  score_completude: number;
  photo_fiche_url: string | null;
  conseiller_id: string;
  point_de_vente_id: string;
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FicheHistoriqueRow {
  id: string;
  fiche_id: string;
  stage_from: StageOrPerdu | null;
  stage_to: StageOrPerdu;
  user_id: string;
  created_at: string;
}

export interface FicheRelanceRow {
  id: string;
  fiche_id: string;
  numero_contact: number;
  canal: Canal;
  resultat: string;
  commentaire: string | null;
  user_id: string;
  created_at: string;
}

export interface MotifPersonnaliseRow {
  id: string;
  type: "perte" | "pause";
  libelle: string;
  point_de_vente_id: string | null;
  cree_par: string | null;
  utilisations: number;
  actif: boolean;
  created_at: string;
}

export interface TacheRow {
  id: string;
  titre: string;
  description: string | null;
  echeance: string | null;
  priorite: Priorite;
  statut: "a_faire" | "fait";
  fiche_id: string | null;
  assigne_a: string;
  cree_par: string | null;
  auto_generee: boolean;
  canal: Canal | null;
  created_at: string;
}

export interface RendezVousRow {
  id: string;
  titre: string;
  type: RdvType;
  debut: string;
  fin: string;
  fiche_id: string | null;
  client_id: string | null;
  conseiller_id: string;
  point_de_vente_id: string;
  lieu: string | null;
  notes: string | null;
  created_at: string;
}

type TableOf<Row, Required extends keyof Row, Generated extends keyof Row> = {
  Row: Row;
  Insert: Partial<Omit<Row, Required>> & Pick<Row, Required> & Partial<Pick<Row, Generated>>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      points_de_vente: TableOf<PointDeVenteRow, "nom" | "ville", "id">;
      profiles: TableOf<ProfileRow, "id" | "nom" | "prenom", never>;
      clients: TableOf<ClientRow, "nom", "id">;
      fiches_contact: TableOf<
        FicheRow,
        "client_nom" | "conseiller_id" | "point_de_vente_id",
        "id" | "reference"
      >;
      fiche_historique: TableOf<
        FicheHistoriqueRow,
        "fiche_id" | "stage_to" | "user_id",
        "id"
      >;
      fiche_relances: TableOf<
        FicheRelanceRow,
        "fiche_id" | "numero_contact" | "canal" | "resultat" | "user_id",
        "id"
      >;
      taches: TableOf<TacheRow, "titre" | "assigne_a", "id">;
      motifs_personnalises: TableOf<
        MotifPersonnaliseRow,
        "type" | "libelle",
        "id"
      >;
      rendez_vous: TableOf<
        RendezVousRow,
        "titre" | "debut" | "fin" | "conseiller_id" | "point_de_vente_id",
        "id"
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
