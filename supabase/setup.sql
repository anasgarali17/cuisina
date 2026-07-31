-- CUISINA CRM — consolidated setup (paste into Supabase SQL editor)
-- Generated from supabase/migrations/*.sql

-- ========== supabase\migrations\0001_init.sql ==========
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

-- ========== supabase\migrations\0002_rls.sql ==========
-- CUISINA CRM — 0002: Row Level Security
-- conseiller: own rows · chef_showroom: own point de vente · direction/admin: all

-- ============ HELPERS ============
-- security definer + fixed search_path so policies can read profiles without recursion.

create or replace function auth_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function auth_pdv()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select point_de_vente_id from profiles where id = auth.uid();
$$;

create or replace function is_direction()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_role() in ('direction', 'admin');
$$;

-- Read access to a fiche row, reused by child tables.
create or replace function can_read_fiche(f_conseiller uuid, f_pdv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_direction()
    or f_conseiller = auth.uid()
    or (auth_role() = 'chef_showroom' and f_pdv = auth_pdv());
$$;

-- ============ ENABLE ============

alter table points_de_vente enable row level security;
alter table profiles enable row level security;
alter table clients enable row level security;
alter table fiches_contact enable row level security;
alter table fiche_historique enable row level security;
alter table fiche_relances enable row level security;
alter table taches enable row level security;
alter table rendez_vous enable row level security;

-- ============ POINTS DE VENTE ============
-- Referential data: readable by every authenticated user; admin manages.

create policy pdv_select on points_de_vente
  for select to authenticated using (true);

create policy pdv_admin_all on points_de_vente
  for all to authenticated
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ============ PROFILES ============
-- Team directory is visible to all (needed for avatars, classement, filters).

create policy profiles_select on profiles
  for select to authenticated using (true);

create policy profiles_update_own on profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_update on profiles
  for update to authenticated
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ============ FICHES CONTACT ============

create policy fiches_select on fiches_contact
  for select to authenticated
  using (can_read_fiche(conseiller_id, point_de_vente_id));

create policy fiches_insert on fiches_contact
  for insert to authenticated
  with check (
    conseiller_id = auth.uid()
    or is_direction()
    or (auth_role() = 'chef_showroom' and point_de_vente_id = auth_pdv())
  );

create policy fiches_update on fiches_contact
  for update to authenticated
  using (can_read_fiche(conseiller_id, point_de_vente_id))
  with check (can_read_fiche(conseiller_id, point_de_vente_id));

create policy fiches_delete on fiches_contact
  for delete to authenticated
  using (is_direction());

-- ============ FICHE HISTORIQUE / RELANCES ============
-- Visible when the parent fiche is visible; writes always stamped with auth.uid().

create policy historique_select on fiche_historique
  for select to authenticated
  using (exists (
    select 1 from fiches_contact f
    where f.id = fiche_id
      and can_read_fiche(f.conseiller_id, f.point_de_vente_id)
  ));

create policy historique_insert on fiche_historique
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from fiches_contact f
      where f.id = fiche_id
        and can_read_fiche(f.conseiller_id, f.point_de_vente_id)
    )
  );

create policy relances_select on fiche_relances
  for select to authenticated
  using (exists (
    select 1 from fiches_contact f
    where f.id = fiche_id
      and can_read_fiche(f.conseiller_id, f.point_de_vente_id)
  ));

create policy relances_insert on fiche_relances
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from fiches_contact f
      where f.id = fiche_id
        and can_read_fiche(f.conseiller_id, f.point_de_vente_id)
    )
  );

-- ============ TACHES ============

create policy taches_select on taches
  for select to authenticated
  using (
    assigne_a = auth.uid()
    or cree_par = auth.uid()
    or is_direction()
    or (auth_role() = 'chef_showroom' and exists (
      select 1 from profiles p
      where p.id = assigne_a and p.point_de_vente_id = auth_pdv()
    ))
  );

create policy taches_insert on taches
  for insert to authenticated
  with check (
    cree_par = auth.uid()
    and (
      assigne_a = auth.uid()
      or is_direction()
      or (auth_role() = 'chef_showroom' and exists (
        select 1 from profiles p
        where p.id = assigne_a and p.point_de_vente_id = auth_pdv()
      ))
    )
  );

create policy taches_update on taches
  for update to authenticated
  using (
    assigne_a = auth.uid()
    or cree_par = auth.uid()
    or is_direction()
  )
  with check (
    assigne_a = auth.uid()
    or cree_par = auth.uid()
    or is_direction()
  );

create policy taches_delete on taches
  for delete to authenticated
  using (cree_par = auth.uid() or is_direction());

-- ============ CLIENTS ============

create policy clients_select on clients
  for select to authenticated
  using (
    is_direction()
    or point_de_vente_id = auth_pdv()
    or exists (
      select 1 from fiches_contact f
      where f.client_id = clients.id and f.conseiller_id = auth.uid()
    )
  );

create policy clients_insert on clients
  for insert to authenticated
  with check (is_direction() or point_de_vente_id = auth_pdv());

create policy clients_update on clients
  for update to authenticated
  using (is_direction() or point_de_vente_id = auth_pdv())
  with check (is_direction() or point_de_vente_id = auth_pdv());

-- ============ RENDEZ-VOUS ============

create policy rdv_select on rendez_vous
  for select to authenticated
  using (
    conseiller_id = auth.uid()
    or is_direction()
    or (auth_role() = 'chef_showroom' and point_de_vente_id = auth_pdv())
  );

create policy rdv_write on rendez_vous
  for insert to authenticated
  with check (
    conseiller_id = auth.uid()
    or is_direction()
    or (auth_role() = 'chef_showroom' and point_de_vente_id = auth_pdv())
  );

create policy rdv_update on rendez_vous
  for update to authenticated
  using (
    conseiller_id = auth.uid()
    or is_direction()
    or (auth_role() = 'chef_showroom' and point_de_vente_id = auth_pdv())
  )
  with check (
    conseiller_id = auth.uid()
    or is_direction()
    or (auth_role() = 'chef_showroom' and point_de_vente_id = auth_pdv())
  );

-- ========== supabase\migrations\0003_storage.sql ==========
-- CUISINA CRM — 0003: storage bucket for paper fiche photos

insert into storage.buckets (id, name, public)
values ('fiches', 'fiches', false)
on conflict (id) do nothing;

-- Authenticated users manage photos inside their own uid folder: {uid}/{fiche_id}.jpg
create policy fiches_photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'fiches');

create policy fiches_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fiches'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fiches_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fiches'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fiches_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fiches'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

