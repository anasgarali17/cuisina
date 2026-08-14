-- CUISINA CRM — 0012: le niveau client, et le VIP épinglé à la main
--
-- Le niveau (Essentiel · Signature · Prestige) se déduit du CA cumulé : il
-- n'a pas à être saisi, il est déjà dans les chiffres. Le VIP, lui, ne se
-- déduit pas — un architecte qui envoie quatre chantiers par an pèse plus
-- que son propre CA ne le dit. C'est donc la seule chose stockée ici.

alter table clients add column if not exists vip boolean not null default false;

-- Index partiel : on ne cherche jamais les non-VIP, seulement la poignée qui l'est.
create index if not exists idx_clients_vip on clients (vip) where vip;

-- app_snapshot recréée à l'identique, `vip` en plus : sans ça la
-- colonne existe en base mais n'arrive jamais jusqu'à l'écran.

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
