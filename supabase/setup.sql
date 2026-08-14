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

-- ========== supabase\migrations\0010_fiche_publique.sql ==========
-- CUISINA CRM — 0010: la fiche remplie par le client
--
-- Renversement du flux : au lieu que le conseiller saisisse la FO-COM-02,
-- le client la remplit lui-même depuis un lien (ou son QR code affiché en
-- showroom / sur un stand de foire). Ce qui en revient n'entre PAS dans le
-- pipeline : ça tombe dans une file d'attente que la direction accepte,
-- laisse en attente ou refuse. Seule l'acceptation crée une vraie fiche.
--
-- Deux publics pour le même formulaire :
--   'client'  — le client répond pour lui-même  (« Comment nous avez-vous connus ? »)
--   'equipe'  — un conseiller répond pour le client (« Où le client nous a-t-il connus ? »)
-- La différence est purement rédactionnelle, côté application.

create type lien_audience as enum ('client', 'equipe');
create type submission_statut as enum ('en_attente', 'accepte', 'refuse');

-- ============ LIENS DE COLLECTE ============

create table fiche_liens (
  id uuid primary key default gen_random_uuid(),
  -- Segment d'URL public : /f/{token}. Opaque, pas un secret : ce qu'il ouvre
  -- est un formulaire vide, et rien ne peut être lu au travers.
  token text not null unique check (char_length(token) between 8 and 40),
  libelle text not null check (char_length(libelle) between 2 and 120),
  audience lien_audience not null default 'client',
  conseiller_id uuid not null references profiles (id),
  point_de_vente_id uuid not null references points_de_vente (id),
  locale text not null default 'fr' check (locale in ('fr', 'ar', 'en')),
  actif boolean not null default true,
  expire_le timestamptz,
  soumissions integer not null default 0,
  cree_par uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index idx_liens_pdv on fiche_liens (point_de_vente_id, created_at desc);

-- ============ DEMANDES REÇUES ============

create sequence submission_reference_seq;

create table fiche_submissions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  lien_id uuid references fiche_liens (id) on delete set null,
  audience lien_audience not null default 'client',

  -- Identité — mêmes colonnes que fiches_contact pour une reprise à l'identique
  client_nom text not null,
  tel_domicile text,
  tel_bureau text,
  tel_mobile text,
  email text,
  adresse_complete text,
  code_postal text,
  ville text,

  -- Origine + projet
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
  score_completude integer not null default 0
    check (score_completude between 0 and 100),

  -- Routage hérité du lien, puis décision
  conseiller_id uuid not null references profiles (id),
  point_de_vente_id uuid not null references points_de_vente (id),
  statut submission_statut not null default 'en_attente',
  decision_note text,
  decide_par uuid references profiles (id),
  decide_le timestamptz,
  fiche_id uuid references fiches_contact (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_submissions_statut on fiche_submissions (statut, created_at desc);
create index idx_submissions_pdv on fiche_submissions (point_de_vente_id, statut);

-- Référence auto DE-{YYYY}-{NNNN} — « DE » comme demande, pour ne jamais
-- confondre une demande reçue avec une fiche FC- du pipeline.
create or replace function set_submission_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'DE-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('submission_reference_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_submission_reference
  before insert on fiche_submissions
  for each row execute function set_submission_reference();

-- ============ RLS ============
-- Aucun accès direct pour anon : le formulaire public passe exclusivement par
-- les deux fonctions security definer plus bas.

alter table fiche_liens enable row level security;
alter table fiche_submissions enable row level security;

create policy liens_select on fiche_liens
  for select to authenticated
  using (is_direction() or point_de_vente_id = auth_pdv() or conseiller_id = auth.uid());

create policy liens_insert on fiche_liens
  for insert to authenticated
  with check (is_direction() or point_de_vente_id = auth_pdv());

create policy liens_update on fiche_liens
  for update to authenticated
  using (is_direction() or point_de_vente_id = auth_pdv())
  with check (is_direction() or point_de_vente_id = auth_pdv());

create policy liens_delete on fiche_liens
  for delete to authenticated
  using (is_direction() or point_de_vente_id = auth_pdv());

create policy submissions_select on fiche_submissions
  for select to authenticated
  using (can_read_fiche(conseiller_id, point_de_vente_id));

-- Accepter / refuser / remettre en attente. La décision reste au périmètre
-- habituel : direction partout, chef de showroom sur son point de vente.
create policy submissions_update on fiche_submissions
  for update to authenticated
  using (is_direction() or point_de_vente_id = auth_pdv())
  with check (is_direction() or point_de_vente_id = auth_pdv());

create policy submissions_delete on fiche_submissions
  for delete to authenticated
  using (is_direction());

-- ============ SURFACE PUBLIQUE ============
-- Deux fonctions, rien d'autre. security definer : elles franchissent RLS
-- pour le strict nécessaire — lire l'en-tête d'un lien, déposer une demande.

create or replace function lien_public(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'libelle', l.libelle,
    'audience', l.audience,
    'locale', l.locale,
    'pdv_nom', v.nom,
    'pdv_ville', v.ville
  )
  from fiche_liens l
  join points_de_vente v on v.id = l.point_de_vente_id
  where l.token = p_token
    and l.actif
    and (l.expire_le is null or l.expire_le > now());
$$;

comment on function lien_public(text) is
  'En-tête d''un lien de collecte actif. Ne divulgue aucune donnée client.';

create or replace function soumettre_fiche(p_token text, p_payload jsonb)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l fiche_liens;
  recentes integer;
  ref text;
begin
  select * into l
  from fiche_liens
  where token = p_token
    and actif
    and (expire_le is null or expire_le > now());

  if not found then
    return json_build_object('ok', false, 'error', 'lien_invalide');
  end if;

  if coalesce(btrim(p_payload->>'client_nom'), '') = '' then
    return json_build_object('ok', false, 'error', 'validation');
  end if;

  -- Frein anti-abus : un lien affiché en public reste ouvert à tous.
  select count(*) into recentes
  from fiche_submissions
  where lien_id = l.id and created_at > now() - interval '10 minutes';

  if recentes >= 12 then
    return json_build_object('ok', false, 'error', 'trop_de_demandes');
  end if;

  insert into fiche_submissions (
    lien_id, audience,
    client_nom, tel_domicile, tel_bureau, tel_mobile, email,
    adresse_complete, code_postal, ville,
    origine, origine_detail,
    nb_cuisines, nb_dressings, nb_sdb, etat_chantier,
    budget_estimatif, date_livraison_souhaitee, observations, exigences,
    score_completude, conseiller_id, point_de_vente_id
  )
  values (
    l.id, l.audience,
    left(btrim(p_payload->>'client_nom'), 120),
    nullif(btrim(coalesce(p_payload->>'tel_domicile', '')), ''),
    nullif(btrim(coalesce(p_payload->>'tel_bureau', '')), ''),
    nullif(btrim(coalesce(p_payload->>'tel_mobile', '')), ''),
    nullif(btrim(coalesce(p_payload->>'email', '')), ''),
    nullif(btrim(coalesce(p_payload->>'adresse_complete', '')), ''),
    nullif(btrim(coalesce(p_payload->>'code_postal', '')), ''),
    nullif(btrim(coalesce(p_payload->>'ville', '')), ''),
    (p_payload->>'origine')::origine_contact,
    nullif(btrim(coalesce(p_payload->>'origine_detail', '')), ''),
    coalesce((p_payload->>'nb_cuisines')::integer, 0),
    coalesce((p_payload->>'nb_dressings')::integer, 0),
    coalesce((p_payload->>'nb_sdb')::integer, 0),
    (p_payload->>'etat_chantier')::etat_chantier,
    (p_payload->>'budget_estimatif')::numeric,
    (p_payload->>'date_livraison_souhaitee')::date,
    nullif(btrim(coalesce(p_payload->>'observations', '')), ''),
    coalesce(p_payload->'exigences', '{}'::jsonb),
    least(greatest(coalesce((p_payload->>'score_completude')::integer, 0), 0), 100),
    l.conseiller_id, l.point_de_vente_id
  )
  returning reference into ref;

  update fiche_liens set soumissions = soumissions + 1 where id = l.id;

  return json_build_object('ok', true, 'reference', ref);
exception
  when others then
    return json_build_object('ok', false, 'error', 'validation');
end;
$$;

comment on function soumettre_fiche(text, jsonb) is
  'Dépose une demande depuis le formulaire public. Écrit uniquement dans fiche_submissions.';

grant execute on function lien_public(text) to anon, authenticated;
grant execute on function soumettre_fiche(text, jsonb) to anon, authenticated;

-- ========== supabase\migrations\0011_liens_par_defaut.sql ==========
-- CUISINA CRM — 0011: les deux liens de collecte de départ
--
-- Tokens lisibles à dessein : ils finissent imprimés sur une affiche, et
-- quelqu'un les recopiera à la main quand l'appareil photo refusera de
-- coopérer. Ce qu'ils ouvrent est un formulaire vide — rien à protéger.

insert into fiche_liens (token, libelle, audience, conseiller_id, point_de_vente_id, locale)
select
  v.token,
  v.libelle,
  v.audience::lien_audience,
  p.id,
  coalesce(p.point_de_vente_id, (select id from points_de_vente where nom = 'Tunis' limit 1)),
  'fr'
from (values
  ('fiche-contact', 'Fiche Contact — Client', 'client'),
  ('fiche-equipe',  'Fiche Contact — Équipe', 'equipe')
) as v (token, libelle, audience)
cross join lateral (
  select id, point_de_vente_id
  from profiles
  where role in ('direction', 'admin') and actif
  order by created_at
  limit 1
) p
on conflict (token) do nothing;
