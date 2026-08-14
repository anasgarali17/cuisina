-- CUISINA CRM — 0011: les deux liens de collecte de départ
--
-- Tokens lisibles à dessein : ils finissent imprimés sur une affiche, et
-- quelqu'un les recopiera à la main quand l'appareil photo refusera de
-- coopérer. Ce qu'ils ouvrent est un formulaire vide — rien à protéger.

insert into fiche_liens (token, libelle, audience, conseiller_id, point_de_vente_id, locale)
select
  v.token,
  v.libelle,
  v.audience::lien_audience,
  p.id,
  coalesce(p.point_de_vente_id, (select id from points_de_vente where nom = 'Tunis' limit 1)),
  'fr'
from (values
  ('fiche-contact', 'Fiche Contact — Client', 'client'),
  ('fiche-equipe',  'Fiche Contact — Équipe', 'equipe')
) as v (token, libelle, audience)
cross join lateral (
  select id, point_de_vente_id
  from profiles
  where role in ('direction', 'admin') and actif
  order by created_at
  limit 1
) p
on conflict (token) do nothing;
