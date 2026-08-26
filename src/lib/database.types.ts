/**
 * Hand-maintained Database types mirroring supabase/migrations.
 * Regenerate with `supabase gen types typescript` once the CLI is linked.
 */

import type {
  Canal,
  Declencheur,
  EnvoiStatut,
  EtapeProduction,
  EtatChantier,
  FournisseurCategorie,
  LienAudience,
  ModeleCategorie,
  MotifPause,
  MotifPerte,
  Origine,
  Priorite,
  RdvType,
  Role,
  SequenceMode,
  TypeProjet,
  StageOrPerdu,
  SubmissionStatut,
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

/**
 * Un fournisseur. Comme une fiche, il ne porte qu'une ville : les coordonnées
 * sont dérivées à l'affichage par `src/lib/geo/tunisia.ts`.
 */
export interface FournisseurRow {
  id: string;
  nom: string;
  categorie: FournisseurCategorie;
  ville: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  contact_nom: string | null;
  /** Délai indicatif de livraison, en jours ouvrés. */
  delai_jours: number | null;
  notes: string | null;
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
  /** Épinglé à la main par la direction — indépendant du CA. */
  vip: boolean;
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
  /* nb_sdb retiré : la salle de bain ne fait plus partie du périmètre.
     La colonne reste en base pour les fiches déjà saisies. */
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
  croquis: Json | null;
  /** Le mobile est joignable sur WhatsApp — pas un second numéro. */
  whatsapp: boolean;
  /** Signature du client en data URL PNG, posée à l'écran. */
  signature: string | null;
  signature_le: string | null;
  /* — Repris de la demande en ligne quand elle est acceptée — */
  type_projet: TypeProjet | null;
  modele: string | null;
  facade: string | null;
  couleurs: string[];
  croquis_client: string | null;
  photos_client: string[];
  commentaire_client: string | null;
  /** Nom de l'architecte du projet, quand il y en a un. Saisie libre. */
  architecte: string | null;
  /**
   * La demande de métrage : quand elle a été faite, et par qui. Nulles
   * ensemble tant qu'aucune demande n'est en cours — ce n'est pas une étape
   * du dossier, mais un marqueur posé sur celui-ci.
   */
  metrage_demande_le: string | null;
  metrage_demande_par: string | null;
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

/** Un document déposé sur une fiche : plan, photo de chantier, devis reçu. */
export interface FichePieceJointeRow {
  id: string;
  fiche_id: string;
  chemin: string;
  nom_fichier: string;
  type_mime: string | null;
  taille_octets: number | null;
  ajoute_par: string;
  created_at: string;
}

/**
 * Client actif — un dossier passé en production. La ligne naît d'un trigger
 * Postgres au passage en « dossier envoyé », jamais d'une saisie.
 */
export interface ClientActifRow {
  id: string;
  fiche_id: string;
  etape: EtapeProduction;
  point_de_vente_id: string;
  conseiller_id: string;
  remarques: string | null;
  entre_le: string;
  updated_at: string;
}

export interface ClientActifHistoriqueRow {
  id: string;
  client_actif_id: string;
  etape_from: EtapeProduction | null;
  etape_to: EtapeProduction;
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

/** Un lien de collecte — ce que le QR code ouvre. */
export interface FicheLienRow {
  id: string;
  token: string;
  libelle: string;
  audience: LienAudience;
  conseiller_id: string;
  point_de_vente_id: string;
  locale: "fr" | "ar" | "en";
  actif: boolean;
  expire_le: string | null;
  soumissions: number;
  cree_par: string | null;
  created_at: string;
}

/** Une fiche remplie côté client, en attente du verdict de la direction. */
export interface FicheSubmissionRow {
  id: string;
  reference: string;
  lien_id: string | null;
  audience: LienAudience;
  client_nom: string;
  tel_domicile: string | null;
  tel_bureau: string | null;
  tel_mobile: string | null;
  email: string | null;
  adresse_complete: string | null;
  code_postal: string | null;
  ville: string | null;
  origine: Origine | null;
  origine_detail: string | null;
  nb_cuisines: number;
  nb_dressings: number;
  /* nb_sdb retiré : la salle de bain ne fait plus partie du périmètre.
     La colonne reste en base pour les fiches déjà saisies. */
  etat_chantier: EtatChantier | null;
  budget_estimatif: number | null;
  date_livraison_souhaitee: string | null;
  observations: string | null;
  exigences: Json;
  /* — Ce que le client a choisi lui-même, à l'étape 2 du formulaire — */
  type_projet: TypeProjet | null;
  modele: string | null;
  facade: string | null;
  couleurs: string[];
  croquis_client: string | null;
  photos: string[];
  commentaire_client: string | null;
  /** Le showroom que le client a désigné, qui peut différer de celui du lien. */
  pdv_choisi_id: string | null;
  score_completude: number;
  conseiller_id: string;
  point_de_vente_id: string;
  statut: SubmissionStatut;
  decision_note: string | null;
  decide_par: string | null;
  decide_le: string | null;
  fiche_id: string | null;
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

/**
 * Un rendez-vous personnel : celui qui ne concerne que son propriétaire.
 *
 * Distinct de `RendezVousRow` à dessein — pas de fiche, pas de client, pas de
 * point de vente. La RLS de la table ne laisse voir que ses propres lignes.
 */
export interface EvenementPersonnelRow {
  id: string;
  proprietaire_id: string;
  titre: string;
  debut: string;
  fin: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

/* — Séquences WhatsApp — voir la migration 0014 — */

/** Un texte type, validé une fois, réutilisé partout. */
export interface ModeleMessageRow {
  id: string;
  /** Identifiant lisible : c'est lui qu'on cite en réunion, pas l'uuid. */
  code: string;
  libelle: string;
  categorie: ModeleCategorie;
  locale: "fr" | "ar" | "en";
  /** Le corps, avec ses `{{variables}}`. */
  corps: string;
  /** Modèle maison d'un showroom, ou texte commun à tous (null). */
  point_de_vente_id: string | null;
  actif: boolean;
  cree_par: string | null;
  created_at: string;
  updated_at: string;
}

export interface SequenceRow {
  id: string;
  nom: string;
  description: string | null;
  declencheur: Declencheur;
  /** Renseigné seulement pour `stage_atteint`. */
  stage_cible: StageOrPerdu | null;
  /** Le silence qui arme le déclencheur, en jours. */
  seuil_jours: number;
  mode: SequenceMode;
  actif: boolean;
  fenetre_debut: number;
  fenetre_fin: number;
  exclure_dimanche: boolean;
  exclure_vendredi: boolean;
  stop_si_reponse: boolean;
  stop_si_stage_change: boolean;
  max_messages: number;
  point_de_vente_id: string | null;
  cree_par: string | null;
  created_at: string;
  updated_at: string;
}

export interface SequenceEtapeRow {
  id: string;
  sequence_id: string;
  ordre: number;
  /** Décalage depuis le déclencheur. Négatif = avant (rappel de la veille). */
  delai_jours: number;
  delai_heures: number;
  modele_id: string;
  actif: boolean;
  created_at: string;
}

/** Une ligne du journal : simulée, envoyée à la main, ou partie toute seule. */
export interface MessageEnvoyeRow {
  id: string;
  sequence_id: string | null;
  etape_id: string | null;
  fiche_id: string | null;
  client_id: string | null;
  destinataire: string;
  /** Le texte tel qu'il part, variables déjà remplacées. */
  corps_rendu: string;
  statut: EnvoiStatut;
  planifie_le: string;
  envoye_le: string | null;
  envoye_par: string | null;
  erreur: string | null;
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
      fiche_pieces_jointes: TableOf<
        FichePieceJointeRow,
        "fiche_id" | "chemin" | "nom_fichier" | "ajoute_par",
        "id"
      >;
      clients_actifs: TableOf<
        ClientActifRow,
        "fiche_id" | "point_de_vente_id" | "conseiller_id",
        "id"
      >;
      client_actif_historique: TableOf<
        ClientActifHistoriqueRow,
        "client_actif_id" | "etape_to" | "user_id",
        "id"
      >;
      fournisseurs: TableOf<FournisseurRow, "nom" | "ville", "id">;
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
      fiche_liens: TableOf<
        FicheLienRow,
        "token" | "libelle" | "conseiller_id" | "point_de_vente_id",
        "id"
      >;
      fiche_submissions: TableOf<
        FicheSubmissionRow,
        "client_nom" | "conseiller_id" | "point_de_vente_id",
        "id" | "reference"
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
      modeles_message: TableOf<
        ModeleMessageRow,
        "code" | "libelle" | "corps",
        "id"
      >;
      sequences: TableOf<SequenceRow, "nom" | "declencheur", "id">;
      sequence_etapes: TableOf<
        SequenceEtapeRow,
        "sequence_id" | "ordre" | "modele_id",
        "id"
      >;
      messages_envoyes: TableOf<
        MessageEnvoyeRow,
        "destinataire" | "corps_rendu" | "planifie_le",
        "id"
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
