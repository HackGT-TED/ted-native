-- Families with invite codes. Safe to re-run. Run after 20260926001500.
--
-- A person belongs to at most one family: userProfiles."familyID". Families are
-- created, joined, and left only through the functions below, so nobody can list
-- families or look up invite codes. Members see each other's names, never emails.
begin;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  invite_code text not null unique check (invite_code ~ '^[A-Z2-9]{6}$'),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
-- No policies: only the security definer functions below read or write families.
alter table public.families enable row level security;

-- familyID had nothing to point at before this migration; clear leftovers, then link it.
update public."userProfiles" set "familyID" = null
  where "familyID" is not null and not exists (select 1 from public.families f where f.id = "familyID");
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'userProfiles_familyID_fkey') then
    alter table public."userProfiles"
      add constraint "userProfiles_familyID_fkey" foreign key ("familyID")
      references public.families(id) on delete set null;
  end if;
end $$;
create index if not exists "userProfiles_familyID_idx" on public."userProfiles" ("familyID");

-- Six characters without look-alikes (no 0/O, 1/I/L), easy to read aloud.
create or replace function public.tedtime_new_invite_code()
returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.families where invite_code = code);
  end loop;
  return code;
end;
$$;
revoke all on function public.tedtime_new_invite_code() from public;

-- The caller's family with its members, or null.
create or replace function public.get_my_family()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', f.id,
    'name', f.name,
    'invite_code', f.invite_code,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'username', m.username,
        'full_name', m.full_name,
        'is_me', m.id = (select auth.uid())
      ) order by m.id <> (select auth.uid()), m.full_name nulls last, m.username)
      from public."userProfiles" m where m."familyID" = f.id
    ), '[]'::jsonb))
  from public."userProfiles" me
  join public.families f on f.id = me."familyID"
  where me.id = (select auth.uid());
$$;

create or replace function public.create_family(p_name text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then raise exception 'Sign in to start a family'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then
    raise exception 'A family name must be between 1 and 60 characters';
  end if;
  if exists (select 1 from public."userProfiles" where id = me and "familyID" is not null) then
    raise exception 'Leave your current family before starting a new one';
  end if;
  insert into public.families (name, invite_code, created_by)
    values (btrim(p_name), public.tedtime_new_invite_code(), me)
    returning id into new_id;
  -- Every account has a profile row (sign-up trigger); insert only as a fallback.
  update public."userProfiles" set "familyID" = new_id, updated_at = now() where id = me;
  if not found then
    insert into public."userProfiles" (id, "familyID", updated_at) values (me, new_id, now());
  end if;
  return public.get_my_family();
end;
$$;

create or replace function public.join_family(p_code text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  target uuid;
begin
  if me is null then raise exception 'Sign in to join a family'; end if;
  select id into target from public.families
    where invite_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if target is null then raise exception 'That code did not match a family. Check it and try again'; end if;
  if exists (select 1 from public."userProfiles" where id = me and "familyID" is not null and "familyID" <> target) then
    raise exception 'Leave your current family before joining another';
  end if;
  -- Every account has a profile row (sign-up trigger); insert only as a fallback.
  update public."userProfiles" set "familyID" = target, updated_at = now() where id = me;
  if not found then
    insert into public."userProfiles" (id, "familyID", updated_at) values (me, target, now());
  end if;
  return public.get_my_family();
end;
$$;

-- Leaving removes the family once its last member is gone.
create or replace function public.leave_family()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  old_family uuid;
begin
  if me is null then raise exception 'Sign in to leave a family'; end if;
  select "familyID" into old_family from public."userProfiles" where id = me;
  if old_family is null then return; end if;
  update public."userProfiles" set "familyID" = null, updated_at = now() where id = me;
  if not exists (select 1 from public."userProfiles" where "familyID" = old_family) then
    delete from public.families where id = old_family;
  end if;
end;
$$;

revoke all on function public.get_my_family() from public;
revoke all on function public.create_family(text) from public;
revoke all on function public.join_family(text) from public;
revoke all on function public.leave_family() from public;
grant execute on function public.get_my_family() to authenticated;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.join_family(text) to authenticated;
grant execute on function public.leave_family() to authenticated;

commit;
