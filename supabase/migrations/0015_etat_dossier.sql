-- CUISINA CRM — 0015 : « Pipeline » devient « État du dossier »
--
-- Huit étapes qui décrivent le parcours réel, du lead au dossier transmis à la
-- production. Les anciennes valeurs ne se renomment pas une à une : deux
-- d'entre elles fusionnent, et l'ordre change. On reconstruit donc le type et
-- on convertit les colonnes avec une correspondance explicite.
--
-- Correspondance retenue — sémantique, pas positionnelle. Un « RDV showroom »
-- reste un RDV showroom même s'il change de rang ; c'est ce que les dossiers
-- en cours veulent dire.
--
--   nouveau_contact  → nouveau_lead
--   contacte         → releve_preliminaire
--   metre_releve     → releve_preliminaire   (fusion : même travail de relevé)
--   conception_devis → conception_devis
--   devis_envoye     → conception_devis      (fusion : la remise fait partie
--                                             de la phase devis)
--   rdv_showroom     → rdv_showroom
--   negociation      → cloture
--   signe            → signe
--   en_pause         → en_pause
--   perdu            → perdu
--
-- Les deux fusions perdent une nuance. L'historique, lui, la garde : les
-- lignes de `fiche_historique` déjà écrites conservent la trace du passage.
--
-- ── Rejouable ──────────────────────────────────────────────────────────────
-- Tout est gardé par des tests sur le catalogue : ce fichier peut être relancé
-- après un échec en cours de route sans rien casser. C'est nécessaire, parce
-- que l'éditeur SQL de Supabase n'enveloppe pas le script dans une
-- transaction — un arrêt au milieu laisse la moitié du travail faite.

-- ============ DÉPENDANCES DU TYPE ============
-- Trois objets référencent `stage` dans une expression, et Postgres les
-- revalide au changement de type — avec l'ancien type dans l'expression et le
-- nouveau dans la colonne, d'où « operator does not exist ». On les retire
-- avant, on les remet après.

alter table fiches_contact drop constraint if exists perdu_requires_motif;
alter table fiches_contact drop constraint if exists pause_requires_motif;
drop index if exists idx_fiches_pause_reprise;

-- ============ NOUVEAU TYPE ============

do $migration$
begin
  -- L'ancien type se reconnaît à une valeur que le nouveau n'a pas.
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'fiche_stage' and e.enumlabel = 'nouveau_contact'
  ) then
    alter type fiche_stage rename to fiche_stage_ancien;
  end if;

  if not exists (select 1 from pg_type where typname = 'fiche_stage') then
    create type fiche_stage as enum (
      'nouveau_lead',
      'releve_preliminaire',
      'conception_devis',
      'rdv_showroom',
      'cloture',
      'signe',
      'releve_definitif',
      'dossier_envoye',
      'en_pause',
      'perdu'
    );
  end if;
end
$migration$;

-- ============ CONVERSION DES COLONNES ============
-- Tout ce qui nomme l'ancien type passe par `execute` : une fois la reprise
-- faite, `fiche_stage_ancien` n'existe plus, et une référence en clair
-- empêcherait le script de seulement se lire.

do $migration$
begin
  if not exists (select 1 from pg_type where typname = 'fiche_stage_ancien') then
    return; -- déjà converti
  end if;

  execute $fn$
    create or replace function fiche_stage_migre(ancien fiche_stage_ancien)
    returns fiche_stage
    language sql
    immutable
    as $body$
      select case ancien::text
        when 'nouveau_contact'  then 'nouveau_lead'
        when 'contacte'         then 'releve_preliminaire'
        when 'metre_releve'     then 'releve_preliminaire'
        when 'conception_devis' then 'conception_devis'
        when 'devis_envoye'     then 'conception_devis'
        when 'rdv_showroom'     then 'rdv_showroom'
        when 'negociation'      then 'cloture'
        when 'signe'            then 'signe'
        when 'en_pause'         then 'en_pause'
        when 'perdu'            then 'perdu'
      end::fiche_stage
    $body$
  $fn$;

  execute 'alter table fiches_contact alter column stage drop default';
  execute 'alter table fiches_contact
             alter column stage type fiche_stage using fiche_stage_migre(stage)';

  execute 'alter table fiche_historique
             alter column stage_from type fiche_stage using fiche_stage_migre(stage_from),
             alter column stage_to   type fiche_stage using fiche_stage_migre(stage_to)';

  -- `sequences` n'existe que si 0014 a tourné.
  if to_regclass('public.sequences') is not null then
    execute 'alter table sequences
               alter column stage_cible type fiche_stage using fiche_stage_migre(stage_cible)';
  end if;

  execute 'drop function fiche_stage_migre(fiche_stage_ancien)';
  execute 'drop type fiche_stage_ancien';
end
$migration$;

alter table fiches_contact alter column stage set default 'nouveau_lead';

-- ============ DÉPENDANCES, REMISES ============

alter table fiches_contact
  add constraint perdu_requires_motif
  check (stage <> 'perdu' or motif_perte is not null);

alter table fiches_contact
  add constraint pause_requires_motif
  check (stage <> 'en_pause' or motif_pause is not null);

create index if not exists idx_fiches_pause_reprise
  on fiches_contact (pause_reprise_le)
  where stage = 'en_pause';

-- ============ CLIENT ACTIF ============
-- Le suivi de production. Une ligne par dossier envoyé, créée par le trigger
-- ci-dessous — jamais à la main : c'est le passage en « dossier envoyé » qui
-- fait foi, pas la mémoire de celui qui aurait dû cliquer.

do $migration$
begin
  if not exists (select 1 from pg_type where typname = 'etape_production') then
    create type etape_production as enum (
      'bureau_ordre',
      'bureau_etude',
      'approvisionnement',
      'achat',
      'production',
      'planification'
    );
  end if;
end
$migration$;

create table if not exists clients_actifs (
  id uuid primary key default gen_random_uuid(),
  fiche_id uuid not null unique references fiches_contact (id) on delete cascade,
  etape etape_production not null default 'bureau_ordre',
  point_de_vente_id uuid not null references points_de_vente (id),
  -- Qui suivait le dossier côté commercial : on garde le lien pour que le
  -- conseiller puisse répondre au client qui l'appelle pendant la production.
  conseiller_id uuid not null references profiles (id),
  remarques text,
  entre_le timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clients_actifs_etape
  on clients_actifs (etape, updated_at);
create index if not exists idx_clients_actifs_pdv
  on clients_actifs (point_de_vente_id);

drop trigger if exists clients_actifs_updated_at on clients_actifs;
create trigger clients_actifs_updated_at
  before update on clients_actifs
  for each row execute function touch_updated_at();

-- L'historique des étapes de production, même principe que fiche_historique.
create table if not exists client_actif_historique (
  id uuid primary key default gen_random_uuid(),
  client_actif_id uuid not null references clients_actifs (id) on delete cascade,
  etape_from etape_production,
  etape_to etape_production not null,
  user_id uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_client_actif_hist
  on client_actif_historique (client_actif_id, created_at desc);

-- ============ BASCULE AUTOMATIQUE ============
-- « Dossier envoyé » ouvre la fiche de production. Repasser en arrière puis
-- revenir ne crée pas de doublon (`on conflict do nothing`) et ne remet pas le
-- dossier au début : l'atelier a pu avancer entre-temps.

create or replace function ouvrir_client_actif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stage = 'dossier_envoye'
     and (old.stage is distinct from new.stage) then
    insert into clients_actifs (
      fiche_id, point_de_vente_id, conseiller_id
    )
    values (new.id, new.point_de_vente_id, new.conseiller_id)
    on conflict (fiche_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists fiches_ouvrir_client_actif on fiches_contact;
create trigger fiches_ouvrir_client_actif
  after update of stage on fiches_contact
  for each row execute function ouvrir_client_actif();

-- ============ RLS ============
-- Même périmètre que les fiches : le conseiller voit les siennes, le chef de
-- showroom son point de vente, la direction tout.

alter table clients_actifs enable row level security;
alter table client_actif_historique enable row level security;

drop policy if exists clients_actifs_select on clients_actifs;
create policy clients_actifs_select on clients_actifs
  for select to authenticated
  using (can_read_fiche(conseiller_id, point_de_vente_id));

drop policy if exists clients_actifs_update on clients_actifs;
create policy clients_actifs_update on clients_actifs
  for update to authenticated
  using (can_read_fiche(conseiller_id, point_de_vente_id))
  with check (can_read_fiche(conseiller_id, point_de_vente_id));

drop policy if exists clients_actifs_delete on clients_actifs;
create policy clients_actifs_delete on clients_actifs
  for delete to authenticated
  using (is_direction());

drop policy if exists client_actif_hist_select on client_actif_historique;
create policy client_actif_hist_select on client_actif_historique
  for select to authenticated
  using (
    exists (
      select 1 from clients_actifs ca
      where ca.id = client_actif_id
        and can_read_fiche(ca.conseiller_id, ca.point_de_vente_id)
    )
  );

drop policy if exists client_actif_hist_insert on client_actif_historique;
create policy client_actif_hist_insert on client_actif_historique
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from clients_actifs ca
      where ca.id = client_actif_id
        and can_read_fiche(ca.conseiller_id, ca.point_de_vente_id)
    )
  );
