-- 0004: auto-create a profile for users added outside the seed
-- (e.g. via the Supabase dashboard). Dashboard-created users are admins in
-- practice, so they default to the 'direction' role and full visibility;
-- real conseillers are provisioned with explicit profiles.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, nom, prenom, role, locale)
  values (
    new.id,
    coalesce(nullif(split_part(split_part(new.email, '@', 1), '.', 2), ''), 'Cuisina'),
    initcap(split_part(split_part(new.email, '@', 1), '.', 1)),
    'direction',
    'fr'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_auto_profile on auth.users;
create trigger trg_auto_profile
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill: any existing auth user without a profile gets one now.
insert into profiles (id, nom, prenom, role, locale)
select u.id,
  coalesce(nullif(split_part(split_part(u.email, '@', 1), '.', 2), ''), 'Cuisina'),
  initcap(split_part(split_part(u.email, '@', 1), '.', 1)),
  'direction',
  'fr'
from auth.users u
left join profiles p on p.id = u.id
where p.id is null;
