-- CUISINA CRM — 0019 : l'addendum
--
-- Trois ajouts, tous additifs : aucune colonne n'est supprimée, aucun type
-- n'est reconstruit, aucune donnée n'est convertie. Une base déjà en service
-- accepte ce fichier sans rien perdre, et le recoller une seconde fois ne
-- refait rien.
--
--   1. Demande de métrage      → fiches_contact.metrage_demande_le / _par
--   2. Architecte du projet    → fiches_contact.architecte
--   3. Agenda personnel        → table evenements_personnels
--   4. Retrait de « Clôturé »  → les dossiers concernés reviennent au RDV

/* ============================================================
   1. Demande de métrage
   ============================================================

   Le conseiller déclare que le client est prêt pour le relevé. Ce n'est pas
   une étape du dossier — l'étape, c'est « Relevé préliminaire » — mais un
   marqueur horodaté : la demande a été faite, le métrage n'a pas encore eu
   lieu. La tâche de planification, elle, est créée côté application, avec
   les mêmes règles que les autres rappels.

   Deux colonnes plutôt qu'un booléen : « quand » et « par qui » sont
   exactement ce qu'on cherche quand un métrage traîne depuis trois semaines.
   Nulles ensemble = aucune demande en cours. */

alter table fiches_contact
  add column if not exists metrage_demande_le timestamptz,
  add column if not exists metrage_demande_par uuid references profiles (id);

comment on column fiches_contact.metrage_demande_le is
  'Horodatage de la demande de métrage. Null = aucune demande en cours.';

-- Les dossiers en attente de métrage se cherchent par date ; l'index ne
-- porte que sur eux, les autres n'ayant rien à y faire.
create index if not exists idx_fiches_metrage_demande
  on fiches_contact (metrage_demande_le)
  where metrage_demande_le is not null;

/* ============================================================
   2. Architecte du projet
   ============================================================

   Texte libre, et facultatif : la plupart des projets n'en ont pas. Un champ
   libre plutôt qu'une table d'architectes — tant qu'on ne fait que noter un
   nom, une table serait une contrainte de saisie sans contrepartie. */

alter table fiches_contact
  add column if not exists architecte text;

comment on column fiches_contact.architecte is
  'Nom de l''architecte du projet, quand il y en a un. Saisie libre.';

/* ============================================================
   3. Agenda personnel
   ============================================================

   « rendez_vous » ne convient pas : la table exige un point de vente et un
   conseiller, parce qu'un rendez-vous client appartient à un showroom. Un
   rendez-vous personnel n'appartient à personne d'autre qu'à son
   propriétaire — pas de showroom, pas de fiche, pas de client.

   D'où une table à part, volontairement pauvre : un titre, un créneau, une
   note. Elle sert la direction aujourd'hui ; rien n'y interdit qu'un
   conseiller ait la sienne demain. */

create table if not exists evenements_personnels (
  id uuid primary key default gen_random_uuid(),
  proprietaire_id uuid not null references profiles (id) on delete cascade,
  titre text not null,
  debut timestamptz not null,
  fin timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_evenements_perso_proprietaire
  on evenements_personnels (proprietaire_id, debut);

alter table evenements_personnels enable row level security;

/* La règle tient en une ligne, et c'est le but : on ne voit que ses propres
   événements, on ne peut en créer que pour soi. Aucune exception — la
   direction ne lit pas l'agenda d'un conseiller, l'administrateur non plus.
   Une politique unique en « for all » plutôt que quatre : les quatre auraient
   dit la même chose, et quatre endroits à corriger valent quatre occasions
   de se tromper. */
do $rls$
begin
  if not exists (
    select 1 from pg_policy
    where polrelid = 'evenements_personnels'::regclass
      and polname = 'evenements_personnels_proprietaire'
  ) then
    create policy evenements_personnels_proprietaire
      on evenements_personnels
      for all
      using (proprietaire_id = auth.uid())
      with check (proprietaire_id = auth.uid());
  end if;
end
$rls$;

-- « updated_at » suit les modifications, comme sur les autres tables.
do $trg$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'evenements_personnels'::regclass
      and tgname = 'trg_evenements_perso_updated'
  ) then
    create trigger trg_evenements_perso_updated
      before update on evenements_personnels
      for each row execute function touch_updated_at();
  end if;
end
$trg$;

/* ============================================================
   4. Retrait de l'étape « Clôturé »
   ============================================================

   L'étape disparaît du parcours, mais pas de l'enum : `fiche_historique`
   garde la trace des dossiers qui y sont passés, et un historique dont on
   ne sait plus lire les valeurs ne vaut plus rien. Reconstruire le type
   pour économiser une valeur inutilisée coûterait bien plus que de la
   laisser dormir.

   Les dossiers qui s'y trouvent reviennent au « RDV showroom », l'étape
   qui la précédait. Reculer d'un cran plutôt que d'avancer vers « Signé » :
   une signature déclenche la création du client et alimente le chiffre
   d'affaires. Marquer signé ce qui ne l'est pas fausserait les compteurs de
   la direction, et se rattraperait mal. Un dossier rendu à l'étape
   précédente, lui, se rattrape d'un glissement sur le tableau. */

update fiches_contact
   set stage = 'rdv_showroom'
 where stage = 'cloture';

/* ============================================================
   5. Le snapshot rattrape les nouvelles colonnes
   ============================================================

   « app_snapshot » nomme ses colonnes une à une (voir 0008) : une colonne
   ajoutée plus haut n'atteint aucun écran tant qu'elle n'est pas citée ici.
   Fonction reprise à l'identique de 0018 — seules trois colonnes de
   « fiches » s'ajoutent.

   Les événements personnels n'entrent pas dans le snapshot : il est partagé
   par tous les écrans et mis en cache, alors que ces lignes sont privées.
   L'agenda personnel les lira lui-même, sous RLS. */

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
               architecte, metrage_demande_le, metrage_demande_par,
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
