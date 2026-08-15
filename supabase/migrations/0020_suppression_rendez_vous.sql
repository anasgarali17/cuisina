-- CUISINA CRM — 0020 : un rendez-vous peut enfin se supprimer
--
-- `rendez_vous` porte depuis 0002 des policies de lecture, d'insertion et de
-- mise à jour — mais aucune de suppression. RLS étant activée, l'absence de
-- policy vaut refus : tout DELETE sur la table est rejeté, en silence.
--
-- En silence, littéralement. PostgREST répond « 204 No Content » avec un
-- `Content-Range: */0` : aucune erreur, aucune ligne touchée. Côté
-- application, `deleteRdv` ne voit donc pas d'erreur et renvoie un succès ;
-- l'agenda retire le bloc de l'écran, et le rendez-vous réapparaît au
-- rafraîchissement suivant. Le bouton « supprimer » de l'agenda n'a jamais
-- rien supprimé.
--
-- Le même refus empêchait `supprimerFiche` de nettoyer les rendez-vous d'une
-- fiche effacée : `rendez_vous.fiche_id` étant en `on delete set null`
-- (0001), la cascade les détache sans les supprimer, et le rattrapage côté
-- serveur se heurtait à cette policy manquante. Résultat : un créneau bloqué
-- dans l'agenda, et un client attendu que plus aucun dossier ne justifie.
--
-- Le périmètre est celui des trois autres policies de la table, mot pour
-- mot : son propre rendez-vous pour le conseiller, son point de vente pour
-- le chef de showroom, tout pour la direction.

drop policy if exists rdv_delete on rendez_vous;

create policy rdv_delete on rendez_vous
  for delete to authenticated
  using (
    conseiller_id = auth.uid()
    or is_direction()
    or (auth_role() = 'chef_showroom' and point_de_vente_id = auth_pdv())
  );
