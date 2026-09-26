-- CUISINA CRM — 0021 : le conseiller peut supprimer sa fiche
--
-- Jusqu'ici, seule la direction pouvait supprimer une fiche contact. En
-- showroom, la fiche créée deux fois pour le même client — le conseiller
-- reprend la saisie parce qu'il croit l'avoir perdue — restait à l'écran
-- jusqu'à ce que quelqu'un pense à demander à la direction de la retirer.
-- Personne ne demandait, et les listes se remplissaient de doublons.
--
-- La suppression suit désormais le même périmètre que la lecture et
-- l'écriture : sa fiche pour le conseiller, son showroom pour le chef, tout
-- pour la direction. C'est `can_read_fiche()`, déjà en place depuis 0002.
--
-- ATTENTION — la suppression est définitive et emporte, par cascade :
--   · fiche_historique, fiche_relances, taches liées   (0001)
--   · fiche_pieces_jointes                             (0016)
--   · clients_actifs et son historique                 (0015)
-- Ne survivent que le client créé à la signature et la demande publique
-- d'origine, tous deux en `set null`.
--
-- Les rendez-vous sont en `set null` eux aussi : la cascade les détacherait
-- sans les supprimer. C'est l'action serveur `supprimerFiche` qui les retire,
-- avec les objets des buckets, que Postgres ne voit pas.

drop policy if exists fiches_delete on fiches_contact;

create policy fiches_delete on fiches_contact
  for delete to authenticated
  using (can_read_fiche(conseiller_id, point_de_vente_id));

-- ============ SUPPRESSION D'UN RENDEZ-VOUS ============
-- `rendez_vous` porte des policies de lecture, d'insertion et de mise à jour
-- depuis 0002, mais aucune de suppression. RLS activée, l'absence de policy
-- vaut refus : PostgREST répond « 204 No Content » avec zéro ligne touchée.
-- Aucune erreur, aucun effet — le bouton « supprimer » de l'agenda n'a donc
-- jamais rien supprimé, et `supprimerFiche` ne pourrait pas nettoyer les
-- créneaux d'une fiche effacée.

drop policy if exists rdv_delete on rendez_vous;

create policy rdv_delete on rendez_vous
  for delete to authenticated
  using (
    conseiller_id = auth.uid()
    or is_direction()
    or (auth_role() = 'chef_showroom' and point_de_vente_id = auth_pdv())
  );
