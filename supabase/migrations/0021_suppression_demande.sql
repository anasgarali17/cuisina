-- CUISINA CRM — 0021 : effacer une demande refusée depuis son showroom
--
-- Depuis 0010, `fiche_submissions` se lit au périmètre habituel et se décide
-- — accepter, refuser, remettre en attente — « direction ou son propre point
-- de vente ». La suppression, elle, était restée à la direction seule.
--
-- L'écart se voyait mal tant que rien n'appelait la suppression. Maintenant
-- que la pile des demandes s'efface d'un balayage, il donne un chef de
-- showroom qui peut refuser une demande mais pas la retirer de sa propre
-- pile : il la voit s'accumuler et doit demander à la direction de faire le
-- ménage. La suppression suit donc exactement la même règle que la décision.
--
-- Le garde-fou n'est pas ici mais dans l'action serveur `deleteSubmission` :
-- seule une demande au statut « refuse » est effaçable. Une demande en
-- attente n'a pas encore été jugée, une demande acceptée a produit une fiche
-- qu'elle explique. La RLS dit qui ; l'action dit quoi.

drop policy if exists submissions_delete on fiche_submissions;

create policy submissions_delete on fiche_submissions
  for delete to authenticated
  using (is_direction() or point_de_vente_id = auth_pdv());
