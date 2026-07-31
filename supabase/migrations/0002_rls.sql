-- CUISINA CRM — 0002: Row Level Security
-- conseiller: own rows · chef_showroom: own point de vente · direction/admin: all

-- ============ HELPERS ============
-- security definer + fixed search_path so policies can read profiles without recursion.

create or replace function auth_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function auth_pdv()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select point_de_vente_id from profiles where id = auth.uid();
$$;

create or replace function is_direction()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_role() in ('direction', 'admin');
$$;

-- Read access to a fiche row, reused by child tables.
create or replace function can_read_fiche(f_conseiller uuid, f_pdv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_direction()
    or f_conseiller = auth.uid()
    or (auth_role() = 'chef_showroom' and f_pdv = auth_pdv());
$$;

-- ============ ENABLE ============

alter table points_de_vente enable row level security;
alter table profiles enable row level security;
alter table clients enable row level security;
alter table fiches_contact enable row level security;
alter table fiche_historique enable row level security;
alter table fiche_relances enable row level security;
alter table taches enable row level security;
alter table rendez_vous enable row level security;

-- ============ POINTS DE VENTE ============
-- Referential data: readable by every authenticated user; admin manages.

create policy pdv_select on points_de_vente
  for select to authenticated using (true);

create policy pdv_admin_all on points_de_vente
  for all to authenticated
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ============ PROFILES ============
-- Team directory is visible to all (needed for avatars, classement, filters).

create policy profiles_select on profiles
  for select to authenticated using (true);

create policy profiles_update_own on profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_update on profiles
  for update to authenticated
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- ============ FICHES CONTACT ============

create policy fiches_select on fiches_contact
  for select to authenticated
  using (can_read_fiche(conseiller_id, point_de_vente_id));

create policy fiches_insert on fiches_contact
  for insert to authenticated
  with check (
    conseiller_id = auth.uid()
    or is_direction()
    or (auth_role() = 'chef_showroom' and point_de_vente_id = auth_pdv())
  );

create policy fiches_update on fiches_contact
  for update to authenticated
  using (can_read_fiche(conseiller_id, point_de_vente_id))
  with check (can_read_fiche(conseiller_id, point_de_vente_id));

create policy fiches_delete on fiches_contact
  for delete to authenticated
  using (is_direction());

-- ============ FICHE HISTORIQUE / RELANCES ============
-- Visible when the parent fiche is visible; writes always stamped with auth.uid().

create policy historique_select on fiche_historique
  for select to authenticated
  using (exists (
    select 1 from fiches_contact f
    where f.id = fiche_id
      and can_read_fiche(f.conseiller_id, f.point_de_vente_id)
  ));

create policy historique_insert on fiche_historique
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from fiches_contact f
      where f.id = fiche_id
        and can_read_fiche(f.conseiller_id, f.point_de_vente_id)
    )
  );

create policy relances_select on fiche_relances
  for select to authenticated
  using (exists (
    select 1 from fiches_contact f
    where f.id = fiche_id
      and can_read_fiche(f.conseiller_id, f.point_de_vente_id)
  ));

create policy relances_insert on fiche_relances
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from fiches_contact f
      where f.id = fiche_id
        and can_read_fiche(f.conseiller_id, f.point_de_vente_id)
    )
  );

-- ============ TACHES ============

create policy taches_select on taches
  for select to authenticated
  using (
    assigne_a = auth.uid()
    or cree_par = auth.uid()
    or is_direction()
    or (auth_role() = 'chef_showroom' and exists (
      select 1 from profiles p
      where p.id = assigne_a and p.point_de_vente_id = auth_pdv()
    ))
  );

create policy taches_insert on taches
  for insert to authenticated
  with check (
    cree_par = auth.uid()
    and (
      assigne_a = auth.uid()
      or is_direction()
      or (auth_role() = 'chef_showroom' and exists (
        select 1 from profiles p
        where p.id = assigne_a and p.point_de_vente_id = auth_pdv()
      ))
    )
  );

create policy taches_update on taches
  for update to authenticated
  using (
    assigne_a = auth.uid()
    or cree_par = auth.uid()
    or is_direction()
  )
  with check (
    assigne_a = auth.uid()
    or cree_par = auth.uid()
    or is_direction()
  );

create policy taches_delete on taches
  for delete to authenticated
  using (cree_par = auth.uid() or is_direction());

-- ============ CLIENTS ============

create policy clients_select on clients
  for select to authenticated
  using (
    is_direction()
    or point_de_vente_id = auth_pdv()
    or exists (
      select 1 from fiches_contact f
      where f.client_id = clients.id and f.conseiller_id = auth.uid()
    )
  );

create policy clients_insert on clients
  for insert to authenticated
  with check (is_direction() or point_de_vente_id = auth_pdv());

create policy clients_update on clients
  for update to authenticated
  using (is_direction() or point_de_vente_id = auth_pdv())
  with check (is_direction() or point_de_vente_id = auth_pdv());

-- ============ RENDEZ-VOUS ============

create policy rdv_select on rendez_vous
  for select to authenticated
  using (
    conseiller_id = auth.uid()
    or is_direction()
    or (auth_role() = 'chef_showroom' and point_de_vente_id = auth_pdv())
  );

create policy rdv_write on rendez_vous
  for insert to authenticated
  with check (
    conseiller_id = auth.uid()
    or is_direction()
    or (auth_role() = 'chef_showroom' and point_de_vente_id = auth_pdv())
  );

create policy rdv_update on rendez_vous
  for update to authenticated
  using (
    conseiller_id = auth.uid()
    or is_direction()
    or (auth_role() = 'chef_showroom' and point_de_vente_id = auth_pdv())
  )
  with check (
    conseiller_id = auth.uid()
    or is_direction()
    or (auth_role() = 'chef_showroom' and point_de_vente_id = auth_pdv())
  );
