-- CUISINA CRM — remise a zero avant la mise en service
--
-- Efface toutes les donnees de demonstration : leads, clients, taches,
-- rendez-vous, demandes en ligne et leur historique.
--
-- CE QUI EST CONSERVE, volontairement :
--   points_de_vente   les 9 showrooms reels
--   profiles          les comptes (a revoir ensemble juste apres)
--   fiche_liens       les 2 QR codes (commercial et client)
--   modeles_message   les textes WhatsApp
--   sequences         l activation automatique
--
-- Le tout dans une transaction : si une seule ligne resiste, rien n est
-- efface et la base reste exactement dans l etat d avant.

begin;

-- Etat avant, pour comparaison.
select 'AVANT' as moment,
       (select count(*) from fiches_contact)   as fiches,
       (select count(*) from clients)          as clients,
       (select count(*) from taches)           as taches,
       (select count(*) from rendez_vous)      as rdv,
       (select count(*) from fiche_submissions) as demandes;

-- Les enfants d abord : les cles etrangeres refusent l ordre inverse.
delete from fiche_relances;
delete from fiche_historique;
delete from fiche_pieces_jointes;
delete from client_actif_historique;
delete from clients_actifs;
delete from taches;
delete from rendez_vous;
delete from messages_envoyes;
delete from fiche_submissions;
delete from fiches_contact;
delete from clients;

-- Motifs de perte ajoutes a la main pendant les essais.
delete from motifs_personnalises;

-- Le compteur de soumissions des liens ne correspond plus a rien : les
-- demandes qu il comptait viennent de partir.
update fiche_liens set soumissions = 0;

-- Les references FC-2026-XXXX repartent de 1 pour les vraies fiches.
-- La sequence est recreee par le trigger si elle n existe pas.
do $seq$
begin
  if exists (select 1 from pg_class where relname = 'fiche_reference_seq') then
    perform setval('fiche_reference_seq', 1, false);
  end if;
end
$seq$;

-- Etat apres : tout doit etre a zero.
select 'APRES' as moment,
       (select count(*) from fiches_contact)   as fiches,
       (select count(*) from clients)          as clients,
       (select count(*) from taches)           as taches,
       (select count(*) from rendez_vous)      as rdv,
       (select count(*) from fiche_submissions) as demandes,
       (select count(*) from points_de_vente)  as showrooms_conserves,
       (select count(*) from profiles)         as comptes_conserves;

commit;
