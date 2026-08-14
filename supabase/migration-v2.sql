-- CUISINA CRM — MIGRATION v2
--
-- A coller dans l editeur SQL de Supabase, en une fois, AVANT de deployer le
-- nouveau code.
--
-- Contenu, dans l ordre :
--   0015  Pipeline -> Etat du dossier (8 etapes) + module Client actif
--   0016  Fiche contact allegee : WhatsApp, signature, pieces jointes
--   0017  Formulaire client en 2 etapes + showrooms publics
--   0018  app_snapshot rattrape les nouvelles colonnes
--   0019  « Publicite » devient « Reseaux sociaux »
--
-- REJOUABLE. Si 0015-0018 ont deja tourne, ils ne refont rien : seul 0019
-- s appliquera. Recoller le fichier entier est sans danger.
--
-- Verifie sur PostgreSQL 17 : chaine 0001->0019 sur base vierge, reprise a
-- mi-chemin, conversion des etapes et des origines, bascule Client actif,
-- et second passage sans erreur.

-- ========== supabase/migrations/0015_etat_dossier.sql ==========

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

-- ========== supabase/migrations/0016_fiche_allegee.sql ==========

-- CUISINA CRM — 0016 : la fiche contact allégée
--
-- Quatre champs quittent la saisie (code postal, état du chantier, budget,
-- observations) et trois arrivent (WhatsApp, signature, pièces jointes).
--
-- Les colonnes retirées de l'écran ne sont PAS supprimées : les fiches déjà
-- saisies les ont remplies, le budget alimente encore la valeur du pipeline,
-- et une colonne qu'on laisse dormir ne coûte rien. Ce qui change est qu'on
-- ne les demande plus.

-- ============ NOUVEAUX CHAMPS ============

alter table fiches_contact
  -- Le mobile est joignable sur WhatsApp. Un booléen suffit : le numéro est
  -- déjà là, le dupliquer inviterait les deux à diverger.
  add column if not exists whatsapp boolean not null default false,
  -- Signature du client, en data URL PNG. Stockée avec la fiche plutôt que
  -- dans le bucket : elle ne vit jamais sans elle.
  add column if not exists signature text,
  add column if not exists signature_le timestamptz;

-- ============ PIÈCES JOINTES ============
-- Une table plutôt qu'un tableau de chemins : on veut le nom d'origine, la
-- taille et qui a déposé quoi. Le fichier lui-même part dans le bucket.

create table if not exists fiche_pieces_jointes (
  id uuid primary key default gen_random_uuid(),
  fiche_id uuid not null references fiches_contact (id) on delete cascade,
  chemin text not null,
  nom_fichier text not null,
  type_mime text,
  taille_octets integer,
  ajoute_par uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_pieces_jointes_fiche
  on fiche_pieces_jointes (fiche_id, created_at desc);

alter table fiche_pieces_jointes enable row level security;

drop policy if exists pieces_jointes_select on fiche_pieces_jointes;
create policy pieces_jointes_select on fiche_pieces_jointes
  for select to authenticated
  using (
    exists (
      select 1 from fiches_contact f
      where f.id = fiche_id
        and can_read_fiche(f.conseiller_id, f.point_de_vente_id)
    )
  );

drop policy if exists pieces_jointes_insert on fiche_pieces_jointes;
create policy pieces_jointes_insert on fiche_pieces_jointes
  for insert to authenticated
  with check (
    ajoute_par = auth.uid()
    and exists (
      select 1 from fiches_contact f
      where f.id = fiche_id
        and can_read_fiche(f.conseiller_id, f.point_de_vente_id)
    )
  );

drop policy if exists pieces_jointes_delete on fiche_pieces_jointes;
create policy pieces_jointes_delete on fiche_pieces_jointes
  for delete to authenticated
  using (
    exists (
      select 1 from fiches_contact f
      where f.id = fiche_id
        and can_read_fiche(f.conseiller_id, f.point_de_vente_id)
    )
  );

-- Le bucket : mêmes règles que les photos de fiche papier, dossier par uid.
insert into storage.buckets (id, name, public)
values ('fiches-pieces', 'fiches-pieces', false)
on conflict (id) do nothing;

drop policy if exists pieces_read on storage.objects;
create policy pieces_read on storage.objects
  for select to authenticated
  using (bucket_id = 'fiches-pieces');

drop policy if exists pieces_insert on storage.objects;
create policy pieces_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fiches-pieces'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists pieces_delete on storage.objects;
create policy pieces_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fiches-pieces'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ========== supabase/migrations/0017_formulaire_client.sql ==========

-- CUISINA CRM — 0017 : le formulaire client en deux étapes
--
-- Le client ne décrit plus seulement qui il est : il dit ce qu'il veut. Le
-- commercial arrive au rendez-vous en le sachant, ce qui change la nature du
-- rendez-vous — on n'y découvre plus le projet, on le précise.
--
-- Tout ce que le client choisit est un vœu, jamais une commande : aucune
-- colonne n'est obligatoire, et rien ici n'engage un prix.

do $migration$
begin
  if not exists (select 1 from pg_type where typname = 'type_projet') then
    create type type_projet as enum ('cuisine', 'dressing');
  end if;
end
$migration$;

-- ============ CE QUE LE CLIENT SOUHAITE ============
-- Sur la demande reçue…

alter table fiche_submissions
  add column if not exists type_projet type_projet,
  add column if not exists modele text,
  add column if not exists facade text,
  -- Les coloris retenus, du grès cérame comme du quartz. Un tableau plutôt
  -- qu'une colonne par matière : le client en montre deux ou trois, et la
  -- liste des matières bougera avant la structure.
  add column if not exists couleurs text[] not null default '{}',
  add column if not exists croquis_client text,
  add column if not exists photos text[] not null default '{}',
  add column if not exists commentaire_client text,
  -- Le showroom que le client a choisi lui-même, qui peut différer de celui
  -- du lien : une affiche posée à Tunis attire des gens de Sousse.
  add column if not exists pdv_choisi_id uuid references points_de_vente (id);

-- …et sur la fiche, une fois la demande acceptée.
alter table fiches_contact
  add column if not exists type_projet type_projet,
  add column if not exists modele text,
  add column if not exists facade text,
  add column if not exists couleurs text[] not null default '{}',
  add column if not exists croquis_client text,
  add column if not exists photos_client text[] not null default '{}',
  add column if not exists commentaire_client text;

-- ============ DÉPÔT PUBLIC ============
-- La fonction remplacée : mêmes garde-fous (lien valide, nom présent, frein
-- anti-abus), plus les champs de l'étape 2. Le code postal, l'état du
-- chantier, le budget et les observations ne sont plus demandés — les
-- colonnes restent, elles ne se remplissent simplement plus.

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
  pdv_choisi uuid;
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

  -- Un showroom choisi qui n'existe pas est ignoré plutôt que fatal : la
  -- demande vaut mieux que son point de vente.
  select id into pdv_choisi
  from points_de_vente
  where id = nullif(p_payload->>'point_de_vente_id', '')::uuid
    and actif;

  insert into fiche_submissions (
    lien_id, audience,
    client_nom, tel_domicile, tel_bureau, tel_mobile, email,
    adresse_complete, ville,
    origine, origine_detail,
    nb_cuisines, nb_dressings, nb_sdb,
    date_livraison_souhaitee, exigences,
    type_projet, modele, facade, couleurs,
    croquis_client, photos, commentaire_client, pdv_choisi_id,
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
    nullif(btrim(coalesce(p_payload->>'ville', '')), ''),
    (p_payload->>'origine')::origine_contact,
    nullif(btrim(coalesce(p_payload->>'origine_detail', '')), ''),
    coalesce((p_payload->>'nb_cuisines')::integer, 0),
    coalesce((p_payload->>'nb_dressings')::integer, 0),
    coalesce((p_payload->>'nb_sdb')::integer, 0),
    (p_payload->>'date_livraison_souhaitee')::date,
    coalesce(p_payload->'exigences', '{}'::jsonb),
    (p_payload->>'type_projet')::type_projet,
    nullif(btrim(coalesce(p_payload->>'modele', '')), ''),
    nullif(btrim(coalesce(p_payload->>'facade', '')), ''),
    coalesce(
      array(select jsonb_array_elements_text(p_payload->'couleurs')),
      '{}'
    ),
    nullif(p_payload->>'croquis_client', ''),
    coalesce(
      array(select jsonb_array_elements_text(p_payload->'photos')),
      '{}'
    ),
    nullif(btrim(coalesce(p_payload->>'commentaire_client', '')), ''),
    pdv_choisi,
    least(greatest(coalesce((p_payload->>'score_completude')::integer, 0), 0), 100),
    l.conseiller_id,
    -- Le choix du client l'emporte : c'est là qu'il ira.
    coalesce(pdv_choisi, l.point_de_vente_id)
  )
  returning reference into ref;

  update fiche_liens set soumissions = soumissions + 1 where id = l.id;

  return json_build_object('ok', true, 'reference', ref);
exception
  when others then
    return json_build_object('ok', false, 'error', 'validation');
end;
$$;

grant execute on function soumettre_fiche(text, jsonb) to anon, authenticated;

-- ============ LES SHOWROOMS, CÔTÉ PUBLIC ============
-- Le client choisit sa zone puis son showroom, et voit aussitôt le numéro à
-- appeler. `points_de_vente` n'est lisible que par les comptes authentifiés,
-- et le client n'en a pas : cette fonction expose le strict nécessaire —
-- nom, ville, adresse, téléphone. Rien qui ne soit déjà sur la devanture.

create or replace function showrooms_publics()
returns table (
  id uuid,
  nom text,
  ville text,
  adresse text,
  telephone text
)
language sql
stable
security definer
set search_path = public
as $$
  select id, nom, ville, adresse, telephone
  from points_de_vente
  where actif
  order by ville, nom;
$$;

grant execute on function showrooms_publics() to anon, authenticated;

-- ============ PHOTOS DU CLIENT ============
-- Un bucket à part, où `anon` peut déposer : le client n'a pas de compte.
-- L'écriture seule est ouverte — la lecture reste à l'équipe, sinon un
-- inconnu pourrait parcourir les photos de cuisine des autres.

insert into storage.buckets (id, name, public)
values ('demandes-photos', 'demandes-photos', false)
on conflict (id) do nothing;

drop policy if exists demandes_photos_insert on storage.objects;
create policy demandes_photos_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'demandes-photos');

drop policy if exists demandes_photos_read on storage.objects;
create policy demandes_photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'demandes-photos');

-- ========== supabase/migrations/0018_snapshot_champs_v2.sql ==========

-- CUISINA CRM — 0018 : le snapshot rattrape les champs de la v2
--
-- « app_snapshot » liste ses colonnes une à une — c'est voulu (voir 0008),
-- mais cela veut dire qu'une colonne ajoutée ailleurs n'arrive jamais aux
-- écrans tant qu'elle n'est pas nommée ici. Fonction reprise à l'identique de
-- 0014 : seule la liste des colonnes de « fiches » change.
--
-- Les nouveautés légères entrent : WhatsApp, et ce que le client a choisi dans
-- le formulaire public. Les trois lourdes n'entrent pas — signature, croquis
-- du client et photos sont des data URLs de plusieurs centaines de kilo-octets,
-- et 500 fiches les portant écraseraient la charge utile pour un affichage que
-- seules les pages de détail font. Elles restent lues par « select * » sur la
-- fiche ouverte, comme « exigences » et « croquis » déjà.

create or replace function app_snapshot(p_since timestamptz)
returns json
language sql
stable
as $$
  select json_build_object(
    'fiches', coalesce((
      select json_agg(f order by f.updated_at desc)
      from (
        select id, reference, client_nom, tel_mobile, email, adresse_complete,
               ville, origine, nb_cuisines, nb_dressings, nb_sdb,
               budget_estimatif, observations, stage, motif_perte,
               motif_perte_libre, motif_pause, motif_pause_detail,
               pause_cadence_jours, pause_reprise_le,
               date_prevue_remise_devis, date_effective_remise_devis,
               score_completude, conseiller_id, point_de_vente_id, client_id,
               whatsapp, type_projet, modele, facade, couleurs,
               commentaire_client,
               created_at, updated_at
        from fiches_contact
        order by updated_at desc
        limit 500
      ) f
    ), '[]'::json),
    'profiles', coalesce((
      select json_agg(p order by p.nom)
      from (
        select id, nom, prenom, role, point_de_vente_id, locale,
               objectif_mensuel, avatar_url, actif, created_at
        from profiles where actif
      ) p
    ), '[]'::json),
    'pdvs', coalesce((
      select json_agg(v order by v.nom)
      from (
        select id, nom, ville, adresse, telephone, actif, created_at
        from points_de_vente
      ) v
    ), '[]'::json),
    'taches', coalesce((
      select json_agg(t)
      from (
        select id, titre, description, echeance, priorite, statut, fiche_id,
               assigne_a, cree_par, auto_generee, canal, created_at
        from taches
        order by echeance nulls last
        limit 500
      ) t
    ), '[]'::json),
    'rdv', coalesce((
      select json_agg(r order by r.debut)
      from (
        select id, titre, type, debut, fin, fiche_id, client_id, conseiller_id,
               point_de_vente_id, lieu, notes, created_at
        from rendez_vous
        order by debut
        limit 200
      ) r
    ), '[]'::json),
    'clients', coalesce((
      select json_agg(c order by c.created_at desc)
      from (
        select id, nom, tel, email, adresse, ville, ca_cumule, nb_projets,
               vip, point_de_vente_id, created_at
        from clients
        order by created_at desc
        limit 500
      ) c
    ), '[]'::json),
    'fournisseurs', coalesce((
      select json_agg(fo order by fo.nom)
      from (
        select id, nom, categorie, ville, adresse, telephone, email,
               contact_nom, delai_jours, notes, actif, created_at
        from fournisseurs
        where actif
      ) fo
    ), '[]'::json),
    'sequences', coalesce((
      select json_agg(sq order by sq.created_at)
      from (
        select id, nom, description, declencheur, stage_cible, seuil_jours,
               mode, actif, fenetre_debut, fenetre_fin, exclure_dimanche,
               exclure_vendredi, stop_si_reponse, stop_si_stage_change,
               max_messages, point_de_vente_id, cree_par, created_at, updated_at
        from sequences
      ) sq
    ), '[]'::json),
    'sequence_etapes', coalesce((
      select json_agg(e order by e.sequence_id, e.ordre)
      from (
        select id, sequence_id, ordre, delai_jours, delai_heures, modele_id,
               actif, created_at
        from sequence_etapes
      ) e
    ), '[]'::json),
    'modeles', coalesce((
      select json_agg(md order by md.categorie, md.libelle)
      from (
        select id, code, libelle, categorie, locale, corps, point_de_vente_id,
               actif, cree_par, created_at, updated_at
        from modeles_message
      ) md
    ), '[]'::json),
    'historique', coalesce((
      select json_agg(h)
      from (
        select id, fiche_id, stage_from, stage_to, user_id, created_at
        from fiche_historique
        where created_at >= p_since
        limit 2000
      ) h
    ), '[]'::json),
    'relances', coalesce((
      select json_agg(rl)
      from (
        select rel.id, rel.fiche_id, rel.numero_contact, rel.canal,
               rel.resultat, rel.commentaire, rel.user_id, rel.created_at
        from fiche_relances rel
        join fiches_contact f on f.id = rel.fiche_id
        where f.stage not in ('signe', 'perdu')
      ) rl
    ), '[]'::json)
  );
$$;

grant execute on function app_snapshot(timestamptz) to authenticated;

-- ========== supabase/migrations/0019_reseaux_sociaux.sql ==========

-- CUISINA CRM — 0019 : « Publicité » devient « Réseaux sociaux »
--
-- Ce n'est plus par des spots et des catalogues papier que les clients
-- arrivent. Le libellé change, et les sous-choix avec lui : Facebook,
-- Instagram, TikTok remplacent spot / magazine / affiche / catalogue.
--
-- `rename value` plutôt qu'un nouveau type : les fiches déjà classées en
-- publicité restent classées, elles changent seulement de nom. Rien à
-- convertir, aucune donnée perdue.
--
-- Rejouable : ne fait rien si le renommage a déjà eu lieu.

do $migration$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'origine_contact' and e.enumlabel = 'publicite'
  ) then
    alter type origine_contact rename value 'publicite' to 'reseaux_sociaux';
  end if;
end
$migration$;

-- Les anciens détails ne veulent plus rien dire sous ce libellé. On les
-- efface plutôt que de laisser « affiche_enseigne » sous « Réseaux sociaux » —
-- l'origine, elle, est conservée.
update fiches_contact
   set origine_detail = null
 where origine = 'reseaux_sociaux'
   and origine_detail in
       ('spot_publicitaire', 'magasine', 'affiche_enseigne', 'catalogue');

update fiche_submissions
   set origine_detail = null
 where origine = 'reseaux_sociaux'
   and origine_detail in
       ('spot_publicitaire', 'magasine', 'affiche_enseigne', 'catalogue');

