-- CUISINA CRM — 0019 : le conseiller peut supprimer sa fiche
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
--   · fiche_historique, fiche_relances          (0001)
--   · taches liées                              (0001)
--   · fiche_pieces_jointes                      (0016)
--   · clients_actifs et son historique          (0015)
--   · messages_envoyes liés                     (0014)
-- Ne survivent que le client créé à la signature (`clients`) et la demande
-- publique d'origine (`fiche_submissions`), tous deux en `set null` : une
-- fiche supprimée par erreur ne doit pas emporter le fichier client.
--
-- Les fichiers déposés dans les buckets `fiches-pieces` et `fiches` ne sont
-- PAS concernés par la cascade Postgres — c'est l'action serveur
-- `supprimerFiche` qui les retire avant d'effacer la ligne.

drop policy if exists fiches_delete on fiches_contact;

create policy fiches_delete on fiches_contact
  for delete to authenticated
  using (can_read_fiche(conseiller_id, point_de_vente_id));
