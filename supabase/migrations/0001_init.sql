-- CUISINA CRM — Phase 1 schema
-- 0001: enums, tables, triggers, indexes

create extension if not exists "pgcrypto";

-- ============ ENUMS ============

create type app_role as enum ('conseiller', 'chef_showroom', 'direction', 'admin');

create type fiche_stage as enum (
  'nouveau_contact', 'contacte', 'rdv_showroom', 'metre_releve',
  'conception_devis', 'devis_envoye', 'negociation', 'signe', 'perdu'
);

create type motif_perte as enum (
  'prix', 'delai', 'concurrent', 'projet_annule', 'injoignable', 'autre'
);

create type origine_contact as enum (
  'bouche_a_oreille', 'site_web', 'foire', 'publicite'
);

create type etat_chantier as enum ('en_cours', 'fini');

-- Phase 2 automation is WhatsApp-only; the enum is ready for it now.
create type canal_contact as enum ('whatsapp', 'appel', 'sms', 'email', 'visite');

create type tache_priorite as enum ('basse', 'normale', 'haute');
create type tache_statut as enum ('a_faire', 'fait');

create type rdv_type as enum ('showroom', 'metre', 'livraison', 'pose', 'interne');

-- ============ TABLES ============

create table points_de_vente (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  ville text not null,
  adresse text,
  telephone text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text not null,
  prenom text not null,
  role app_role not null default 'conseiller',
  point_de_vente_id uuid references points_de_vente (id),
  locale text not null default 'fr' check (locale in ('fr', 'ar', 'en')),
  objectif_mensuel numeric(12, 3) not null default 0,
  avatar_url text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  tel text,
  email text,
  adresse text,
  ville text,
  ca_cumule numeric(14, 3) not null default 0,
  nb_projets integer not null default 0,
  point_de_vente_id uuid references points_de_vente (id),
  created_at timestamptz not null default now()
);

create sequence fiche_reference_seq;

create table fiches_contact (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  client_nom text not null,
  tel_domicile text,
  tel_mobile text,
  email text,
  adresse_complete text,
  code_postal text,
  ville text,
  origine origine_contact,
  origine_detail text,
  nb_cuisines integer not null default 0,
  nb_dressings integer not null default 0,
  nb_sdb integer not null default 0,
  etat_chantier etat_chantier,
  budget_estimatif numeric(12, 3),
  date_livraison_souhaitee date,
  observations text,
  exigences jsonb not null default '{}'::jsonb,
  stage fiche_stage not null default 'nouveau_contact',
  motif_perte motif_perte,
  date_prevue_remise_devis date,
  date_effective_remise_devis date,
  score_completude integer not null default 0 check (score_completude between 0 and 100),
  photo_fiche_url text,
  conseiller_id uuid not null references profiles (id),
  point_de_vente_id uuid not null references points_de_vente (id),
  client_id uuid references clients (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint perdu_requires_motif check (stage <> 'perdu' or motif_perte is not null)
);

create index idx_fiches_conseiller_stage on fiches_contact (conseiller_id, stage);
create index idx_fiches_pdv_created on fiches_contact (point_de_vente_id, created_at);
create index idx_fiches_stage_updated on fiches_contact (stage, updated_at);

create table fiche_historique (
  id uuid primary key default gen_random_uuid(),
  fiche_id uuid not null references fiches_contact (id) on delete cascade,
  stage_from fiche_stage,
  stage_to fiche_stage not null,
  user_id uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create index idx_historique_fiche on fiche_historique (fiche_id, created_at);

create table fiche_relances (
  id uuid primary key default gen_random_uuid(),
  fiche_id uuid not null references fiches_contact (id) on delete cascade,
  numero_contact integer not null check (numero_contact between 1 and 5),
  canal canal_contact not null,
  resultat text not null,
  commentaire text,
  user_id uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create index idx_relances_fiche on fiche_relances (fiche_id, created_at);

create table taches (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  echeance date,
  priorite tache_priorite not null default 'normale',
  statut tache_statut not null default 'a_faire',
  fiche_id uuid references fiches_contact (id) on delete cascade,
  assigne_a uuid not null references profiles (id),
  cree_par uuid references profiles (id),
  auto_generee boolean not null default false,
  canal canal_contact,
  created_at timestamptz not null default now()
);

create index idx_taches_assigne on taches (assigne_a, statut, echeance);

create table rendez_vous (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  type rdv_type not null default 'showroom',
  debut timestamptz not null,
  fin timestamptz not null,
  fiche_id uuid references fiches_contact (id) on delete set null,
  client_id uuid references clients (id) on delete set null,
  conseiller_id uuid not null references profiles (id),
  point_de_vente_id uuid not null references points_de_vente (id),
  lieu text,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_rdv_conseiller_debut on rendez_vous (conseiller_id, debut);
create index idx_rdv_pdv_debut on rendez_vous (point_de_vente_id, debut);

-- ============ TRIGGERS ============

-- Auto reference FC-{YYYY}-{NNNN}
create or replace function set_fiche_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'FC-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('fiche_reference_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_fiche_reference
  before insert on fiches_contact
  for each row execute function set_fiche_reference();

-- updated_at
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_fiches_touch
  before update on fiches_contact
  for each row execute function touch_updated_at();
