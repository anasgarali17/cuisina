-- CUISINA CRM — 0014 : les séquences WhatsApp
--
-- Ce fichier prépare l'automatisation sans l'allumer. Tout est là — le
-- déclencheur, le délai, le texte, le destinataire, l'heure — sauf la
-- passerelle qui appuie sur « envoyer ». Une séquence en mode `simulation`
-- calcule sa file d'attente et s'arrête là : le conseiller la vide à la main,
-- d'un tap sur wa.me. Le jour où la passerelle arrive, on bascule le mode et
-- rien d'autre ne change.
--
-- Pourquoi cet ordre : on veut d'abord voir ce que la machine VOUDRAIT
-- envoyer, à qui et quand, pendant quelques semaines de vraie activité. Un
-- message automatique mal réglé ne se rappelle pas — il est déjà lu.
--
-- Trois tables :
--   modeles_message   — les textes, validés une fois, réutilisés partout
--   sequences         — quand ça part, dans quelle fenêtre, avec quels garde-fous
--   sequence_etapes   — J+0, J+3, J+10… chaque palier pointe un modèle
--   messages_envoyes  — la trace : simulé, envoyé à la main, ou parti tout seul

-- Rejouable : ce fichier se colle dans l'éditeur SQL, parfois deux fois.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'sequence_declencheur') then
    create type sequence_declencheur as enum (
      'fiche_creee',        -- un lead vient d'entrer
      'stage_atteint',      -- la fiche arrive sur une étape donnée
      'rdv_planifie',       -- rappel avant un rendez-vous
      'devis_sans_reponse', -- devis remis, silence depuis
      'pause_reprise',      -- la date de re-contact d'un lead en pause
      'apres_signature',    -- accompagnement post-vente
      'client_inactif'      -- plus rien ne bouge depuis longtemps
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'sequence_mode') then
    create type sequence_mode as enum ('simulation', 'actif');
  end if;

  if not exists (select 1 from pg_type where typname = 'envoi_statut') then
    create type envoi_statut as enum (
      'simule', 'planifie', 'envoye', 'repondu', 'echec', 'annule'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'modele_categorie') then
    create type modele_categorie as enum (
      'relance', 'rdv', 'devis', 'apres_vente', 'courtoisie'
    );
  end if;
end $$;

-- ============ MODÈLES DE MESSAGES ============

create table if not exists modeles_message (
  id uuid primary key default gen_random_uuid(),
  -- Identifiant lisible : c'est lui qu'on cite en réunion, pas l'uuid.
  code text not null unique check (char_length(code) between 2 and 60),
  libelle text not null check (char_length(libelle) between 2 and 120),
  categorie modele_categorie not null default 'relance',
  locale text not null default 'fr' check (locale in ('fr', 'ar', 'en')),
  -- Le texte, avec ses {{variables}}. La liste autorisée vit côté app
  -- (src/lib/domain.ts) : une variable inventée partirait telle quelle.
  corps text not null check (char_length(corps) between 2 and 900),
  -- Modèle maison d'un showroom, ou texte validé par la direction (null).
  point_de_vente_id uuid references points_de_vente (id) on delete cascade,
  actif boolean not null default true,
  cree_par uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_modeles_categorie
  on modeles_message (categorie, locale);

-- ============ SÉQUENCES ============

create table if not exists sequences (
  id uuid primary key default gen_random_uuid(),
  -- Unique : le nom est la clé de lecture humaine, et il rend ce fichier
  -- rejouable — les insertions plus bas s'y raccrochent.
  nom text not null unique check (char_length(nom) between 2 and 120),
  description text,
  declencheur sequence_declencheur not null,
  -- Renseigné seulement pour 'stage_atteint' : quelle étape arme la séquence.
  stage_cible fiche_stage,
  -- Seuil du déclencheur, en jours : l'ancienneté qui fait un 'client_inactif',
  -- le silence qui fait un 'devis_sans_reponse'. Ignoré ailleurs.
  seuil_jours integer not null default 0 check (seuil_jours between 0 and 365),

  mode sequence_mode not null default 'simulation',
  actif boolean not null default true,

  -- Fenêtre d'envoi, heure locale. Un message calculé pour 6 h du matin
  -- attend l'ouverture plutôt que de réveiller le client.
  fenetre_debut smallint not null default 9 check (fenetre_debut between 0 and 23),
  fenetre_fin smallint not null default 19 check (fenetre_fin between 1 and 24),
  check (fenetre_fin > fenetre_debut),
  -- Le dimanche est un jour de showroom en Tunisie ; le vendredi après-midi,
  -- non. Par défaut on n'exclut rien et on laisse le réglage à l'usage.
  exclure_dimanche boolean not null default false,
  exclure_vendredi boolean not null default false,

  -- Garde-fous. Le client qui répond n'est plus une cible : il est en
  -- conversation. Idem s'il avance dans le pipeline — la relance qui suit
  -- parlerait d'une étape qu'il a déjà passée.
  stop_si_reponse boolean not null default true,
  stop_si_stage_change boolean not null default true,
  -- Plafond de sécurité, quoi qu'en disent les étapes.
  max_messages smallint not null default 4 check (max_messages between 1 and 12),

  -- Séquence propre à un showroom, ou commune à tous (null).
  point_de_vente_id uuid references points_de_vente (id) on delete cascade,
  cree_par uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sequences_declencheur
  on sequences (declencheur, actif);

-- ============ ÉTAPES ============

create table if not exists sequence_etapes (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references sequences (id) on delete cascade,
  ordre smallint not null check (ordre between 1 and 12),
  -- Décalage par rapport au déclencheur. Négatif = avant : c'est ainsi qu'on
  -- rappelle un rendez-vous la veille (-1 jour).
  delai_jours smallint not null default 0 check (delai_jours between -30 and 365),
  delai_heures smallint not null default 0 check (delai_heures between -23 and 23),
  modele_id uuid not null references modeles_message (id) on delete restrict,
  -- Une étape peut dormir sans qu'on démonte la séquence.
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (sequence_id, ordre)
);

create index if not exists idx_etapes_sequence on sequence_etapes (sequence_id, ordre);

-- ============ JOURNAL D'ENVOI ============

create table if not exists messages_envoyes (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid references sequences (id) on delete set null,
  etape_id uuid references sequence_etapes (id) on delete set null,
  fiche_id uuid references fiches_contact (id) on delete cascade,
  client_id uuid references clients (id) on delete set null,

  destinataire text not null,
  -- Le texte tel qu'il part, variables déjà remplacées. On garde le rendu et
  -- pas seulement le modèle : le modèle sera réécrit, le message envoyé non.
  corps_rendu text not null,

  statut envoi_statut not null default 'simule',
  planifie_le timestamptz not null,
  envoye_le timestamptz,
  -- Renseigné quand un humain a appuyé sur envoyer depuis la file d'attente.
  envoye_par uuid references profiles (id),
  erreur text,
  created_at timestamptz not null default now()
);

create index if not exists idx_envois_planifie
  on messages_envoyes (planifie_le desc);
create index if not exists idx_envois_fiche
  on messages_envoyes (fiche_id, created_at desc);
-- Une étape ne se déclenche qu'une fois par fiche : sans ça, chaque passage
-- du planificateur reprogrammerait le même message.
create unique index if not exists idx_envois_unicite
  on messages_envoyes (fiche_id, etape_id)
  where etape_id is not null and statut <> 'annule';

-- ============ RLS ============
--
-- Modèles et séquences sont du paramétrage : toute l'équipe les lit, la
-- direction les écrit. Le journal suit la fiche — un conseiller voit les
-- messages de ses clients, pas ceux du showroom d'à côté.

alter table modeles_message enable row level security;
alter table sequences enable row level security;
alter table sequence_etapes enable row level security;
alter table messages_envoyes enable row level security;

drop policy if exists modeles_select on modeles_message;
create policy modeles_select on modeles_message
  for select to authenticated using (true);

drop policy if exists modeles_admin_all on modeles_message;
create policy modeles_admin_all on modeles_message
  for all to authenticated
  using (auth_role() in ('direction', 'admin', 'chef_showroom'))
  with check (auth_role() in ('direction', 'admin', 'chef_showroom'));

drop policy if exists sequences_select on sequences;
create policy sequences_select on sequences
  for select to authenticated using (true);

drop policy if exists sequences_admin_all on sequences;
create policy sequences_admin_all on sequences
  for all to authenticated
  using (auth_role() in ('direction', 'admin'))
  with check (auth_role() in ('direction', 'admin'));

drop policy if exists etapes_select on sequence_etapes;
create policy etapes_select on sequence_etapes
  for select to authenticated using (true);

drop policy if exists etapes_admin_all on sequence_etapes;
create policy etapes_admin_all on sequence_etapes
  for all to authenticated
  using (auth_role() in ('direction', 'admin'))
  with check (auth_role() in ('direction', 'admin'));

drop policy if exists envois_select on messages_envoyes;
create policy envois_select on messages_envoyes
  for select to authenticated using (
    auth_role() in ('direction', 'admin')
    or exists (
      select 1 from fiches_contact f
      where f.id = messages_envoyes.fiche_id
        and (
          f.conseiller_id = auth.uid()
          or (auth_role() = 'chef_showroom' and f.point_de_vente_id = auth_pdv())
        )
    )
  );

-- Marquer un message parti, c'est ce que fait le conseiller depuis la file
-- d'attente. Il écrit donc sur les siens.
drop policy if exists envois_write on messages_envoyes;
create policy envois_write on messages_envoyes
  for all to authenticated
  using (
    auth_role() in ('direction', 'admin')
    or exists (
      select 1 from fiches_contact f
      where f.id = messages_envoyes.fiche_id and f.conseiller_id = auth.uid()
    )
  )
  with check (
    auth_role() in ('direction', 'admin')
    or exists (
      select 1 from fiches_contact f
      where f.id = messages_envoyes.fiche_id and f.conseiller_id = auth.uid()
    )
  );

-- ============ LES MODÈLES DE DÉPART ============
--
-- Écrits en français tunisien de showroom : on vouvoie, on signe du prénom du
-- conseiller, on ne vend rien dans la première phrase.

insert into modeles_message (code, libelle, categorie, corps) values
  (
    'accueil-j0',
    'Accueil — premier contact',
    'relance',
    E'Bonjour {{client}}, ici {{conseiller}} de CUISINA {{showroom}}.\nMerci pour votre demande — je m''occupe personnellement de votre projet.\nQuand seriez-vous disponible pour en parler quelques minutes ?'
  ),
  (
    'relance-sans-nouvelle',
    'Relance — sans nouvelle',
    'relance',
    E'Bonjour {{client}}, {{conseiller}} de CUISINA {{showroom}}.\nJe n''ai pas réussi à vous joindre. Souhaitez-vous qu''on reprenne votre projet cette semaine, ou préférez-vous que je vous rappelle plus tard ?'
  ),
  (
    'invitation-showroom',
    'Invitation showroom',
    'rdv',
    E'Bonjour {{client}}, rien ne remplace le fait de toucher les matières.\nNotre showroom de {{showroom}} vous accueille du lundi au samedi. Je peux vous réserver un créneau — quel jour vous arrange ?\n{{conseiller}}'
  ),
  (
    'rappel-rdv-veille',
    'Rappel de rendez-vous — la veille',
    'rdv',
    E'Bonjour {{client}}, petit rappel pour notre rendez-vous du {{date_rdv}} à {{heure_rdv}} — {{lieu_rdv}}.\nÀ demain !\n{{conseiller}}, CUISINA {{showroom}}'
  ),
  (
    'devis-suivi',
    'Devis — suivi à J+3',
    'devis',
    E'Bonjour {{client}}, avez-vous pu prendre connaissance du devis {{reference}} ?\nJe reste disponible pour l''ajuster avec vous — sur les finitions comme sur le budget.\n{{conseiller}}'
  ),
  (
    'devis-relance-finale',
    'Devis — dernière relance',
    'devis',
    E'Bonjour {{client}}, je ne veux pas insister davantage sur le devis {{reference}}.\nDites-moi simplement si le projet est reporté : je garde votre dossier au chaud et je vous recontacte au bon moment.\n{{conseiller}}'
  ),
  (
    'merci-signature',
    'Merci — après signature',
    'apres_vente',
    E'Merci pour votre confiance, {{client}} 🙏\nVotre projet est lancé. Je reste votre interlocuteur unique jusqu''à la pose — vous pouvez m''écrire ici à tout moment.\n{{conseiller}}, CUISINA {{showroom}}'
  ),
  (
    'nouvelles-apres-pose',
    'Des nouvelles après la pose',
    'apres_vente',
    E'Bonjour {{client}}, quelques semaines après la pose : tout se passe bien dans votre cuisine ?\nSi un détail vous chiffonne, c''est le bon moment pour le dire.\n{{conseiller}}'
  ),
  (
    'reprise-apres-pause',
    'Reprise — après une pause',
    'courtoisie',
    E'Bonjour {{client}}, on s''était donné rendez-vous à cette période pour reparler de votre projet.\nOù en êtes-vous ? Je peux vous refaire un point sans engagement.\n{{conseiller}}, CUISINA {{showroom}}'
  )
on conflict (code) do nothing;

-- ============ LES SÉQUENCES DE DÉPART ============
--
-- Toutes en `simulation` : elles remplissent la file d'attente, elles
-- n'envoient rien. C'est exactement l'objet de cette étape.

insert into sequences
  (nom, description, declencheur, stage_cible, seuil_jours, mode, max_messages)
values
  (
    'Nouveau lead — les 72 premières heures',
    'Un lead qu''on ne rappelle pas dans la journée est un lead à moitié perdu. Trois messages, puis on arrête.',
    'fiche_creee', null, 0, 'simulation', 3
  ),
  (
    'Devis envoyé — sans réponse',
    'Deux relances espacées après la remise du devis, puis on classe.',
    'devis_sans_reponse', null, 3, 'simulation', 2
  ),
  (
    'Rappel de rendez-vous',
    'La veille au soir. Divise par deux les rendez-vous manqués.',
    'rdv_planifie', null, 0, 'simulation', 1
  ),
  (
    'Après signature',
    'Remercier, puis prendre des nouvelles une fois la cuisine posée.',
    'apres_signature', null, 0, 'simulation', 2
  ),
  (
    'Reprise des leads en pause',
    'Le jour où la pause arrive à échéance, un message sans pression.',
    'pause_reprise', null, 0, 'simulation', 1
  )
on conflict (nom) do nothing;

-- Les étapes, rattachées par code de modèle et nom de séquence.
insert into sequence_etapes (sequence_id, ordre, delai_jours, delai_heures, modele_id)
select s.id, v.ordre, v.jours, v.heures, m.id
from (values
  ('Nouveau lead — les 72 premières heures', 1, 0,  2, 'accueil-j0'),
  ('Nouveau lead — les 72 premières heures', 2, 1,  0, 'relance-sans-nouvelle'),
  ('Nouveau lead — les 72 premières heures', 3, 3,  0, 'invitation-showroom'),
  ('Devis envoyé — sans réponse',            1, 3,  0, 'devis-suivi'),
  ('Devis envoyé — sans réponse',            2, 10, 0, 'devis-relance-finale'),
  ('Rappel de rendez-vous',                  1, -1, 0, 'rappel-rdv-veille'),
  ('Après signature',                        1, 0,  1, 'merci-signature'),
  ('Après signature',                        2, 45, 0, 'nouvelles-apres-pose'),
  ('Reprise des leads en pause',             1, 0,  0, 'reprise-apres-pause')
) as v (sequence, ordre, jours, heures, code)
join sequences s on s.nom = v.sequence
join modeles_message m on m.code = v.code
on conflict (sequence_id, ordre) do nothing;

-- ============ SNAPSHOT ============
--
-- `app_snapshot` recréée avec les trois listes de paramétrage en plus. Le
-- journal n'y entre pas : il grossit vite et une seule page le lit.

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
