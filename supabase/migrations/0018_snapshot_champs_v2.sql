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
