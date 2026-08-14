-- CUISINA CRM — Fiche remplie par le client (QR code + file d'attente)
-- À coller tel quel dans le SQL editor Supabase, une seule fois.

-- ========== supabase/migrations/0010_fiche_publique.sql ==========
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

-- ========== supabase/migrations/0011_liens_par_defaut.sql ==========
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

