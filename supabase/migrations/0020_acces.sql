-- CUISINA CRM — 0020 : les accès
--
-- Trois corrections, toutes additives : rien n'est supprimé, aucune donnée
-- n'est convertie, et rejouer le fichier ne refait rien.
--
--   1. Un compte désactivé ne lit plus rien.
--   2. Un compte créé à la main n'est plus « direction » par défaut.
--   3. Le rôle et le showroom ne se changent plus tout seul.

/* ============================================================
   1. « actif » devient une condition d'accès
   ============================================================

   La colonne existait et l'application la respectait ; la base, non. Un
   profil passé à `actif = false` gardait donc ses droits de lecture pour qui
   parlait à l'API directement.

   `auth_role()` est la fonction dont dépendent toutes les politiques : elle
   ne renvoie désormais un rôle que pour un profil actif. Un compte désactivé
   obtient `null`, ne satisfait plus aucune politique, et ne lit rien. */

create or replace function auth_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid() and actif;
$$;

create or replace function auth_pdv()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select point_de_vente_id from profiles where id = auth.uid() and actif;
$$;

-- La lecture d'une fiche passait par `f_conseiller = auth.uid()` sans regarder
-- le profil : un conseiller désactivé conservait donc les siennes. On exige
-- maintenant un rôle — donc un compte actif — dans les trois cas.
create or replace function can_read_fiche(f_conseiller uuid, f_pdv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_role() is not null
    and (
      is_direction()
      or f_conseiller = auth.uid()
      or (auth_role() = 'chef_showroom' and f_pdv = auth_pdv())
    );
$$;

/* ============================================================
   2. Un nouveau compte n'est plus « direction »
   ============================================================

   Le trigger de 0004 donnait le rôle « direction » à tout utilisateur créé
   depuis le tableau de bord Supabase — pratique en développement, beaucoup
   moins une fois l'outil en service : créer un compte revenait à ouvrir le
   réseau entier.

   Le défaut devient « conseiller », sans showroom et **inactif**. Un compte
   fraîchement créé ne voit donc rien tant que quelqu'un ne lui a pas
   attribué son rôle et son point de vente — c'est ce que fait
   `scripts/provision-acces.ts`. */

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, nom, prenom, role, locale, actif)
  values (
    new.id,
    coalesce(nullif(split_part(split_part(new.email, '@', 1), '.', 2), ''), 'Cuisina'),
    initcap(split_part(split_part(new.email, '@', 1), '.', 1)),
    'conseiller',
    'fr',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

/* ============================================================
   3. On ne se donne pas ses propres droits
   ============================================================

   `profiles_update_own` laisse chacun modifier sa ligne — c'est voulu, pour
   la langue et l'avatar. Mais rien n'empêchait d'y écrire aussi
   `role = 'admin'` : la politique ne regardait que l'identifiant.

   Le déclencheur ci-dessous remet role, point_de_vente_id et actif à leur
   valeur d'avant, sauf pour un administrateur. La politique reste donc
   permissive et lisible ; c'est la base qui refuse la promotion. */

create or replace function protege_champs_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- La clé de service n'a pas d'`auth.uid()` : c'est le script de
  -- provisionnement, et lui a le droit de nommer les rôles. Sans cette
  -- sortie, le déclencheur annulerait silencieusement ses écritures.
  if coalesce(current_setting('request.jwt.claim.role', true),
              current_setting('role', true)) = 'service_role'
     or auth.uid() is null
     or auth_role() = 'admin' then
    return new;
  end if;
  new.role := old.role;
  new.point_de_vente_id := old.point_de_vente_id;
  new.actif := old.actif;
  return new;
end;
$$;

drop trigger if exists trg_protege_champs_profil on profiles;
create trigger trg_protege_champs_profil
  before update on profiles
  for each row execute function protege_champs_profil();
