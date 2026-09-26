-- Owner-only access to public."userProfiles", plus a row created automatically on sign-up.
-- Safe to re-run. Run it in the Supabase SQL editor.
--
-- Expects the existing table: id (uuid, references auth.users), updated_at, username,
-- full_name, avatar_url, email, "familyID". Other columns must be nullable or have
-- defaults, or the sign-up trigger's insert (and so the sign-up itself) will fail.
begin;

alter table public."userProfiles" enable row level security;
grant select, insert, update on public."userProfiles" to authenticated;

drop policy if exists "tedtime_select_own_user_profile" on public."userProfiles";
create policy "tedtime_select_own_user_profile" on public."userProfiles"
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "tedtime_insert_own_user_profile" on public."userProfiles";
create policy "tedtime_insert_own_user_profile" on public."userProfiles"
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "tedtime_update_own_user_profile" on public."userProfiles";
create policy "tedtime_update_own_user_profile" on public."userProfiles"
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Sign-up with email confirmation returns no session, so the app cannot insert the
-- row itself. This trigger runs inside Supabase instead.
create or replace function public.tedtime_create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public."userProfiles" (id, email, full_name, updated_at)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists tedtime_on_auth_user_created on auth.users;
create trigger tedtime_on_auth_user_created
  after insert on auth.users
  for each row execute function public.tedtime_create_user_profile();

-- Give accounts that already exist a profile row too.
insert into public."userProfiles" (id, email, full_name, updated_at)
select id, email, nullif(trim(raw_user_meta_data ->> 'display_name'), ''), now()
from auth.users
on conflict (id) do nothing;

commit;
