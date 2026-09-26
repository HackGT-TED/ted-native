-- For a new project, or a compatible existing profiles table.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  website text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;

create policy "tedtime_select_own_profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "tedtime_insert_own_profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "tedtime_update_own_profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
