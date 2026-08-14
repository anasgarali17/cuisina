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
