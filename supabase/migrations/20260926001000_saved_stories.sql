-- Each user's saved marketplace stories (their library bookmarks). Safe to re-run.
-- Run after 20260926000900.
--
-- A save points at an all_stories row. Reading it back through all_stories' own
-- policies means a saved story disappears from the library if its author takes it
-- off the marketplace, and its audio stops being readable (000800).
begin;

create table if not exists public.saved_stories (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  story_id uuid not null references public.all_stories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, story_id)
);
create index if not exists saved_stories_library on public.saved_stories (user_id, created_at desc);

alter table public.saved_stories enable row level security;
grant select, insert, delete on public.saved_stories to authenticated;

drop policy if exists "Read own saved stories" on public.saved_stories;
create policy "Read own saved stories" on public.saved_stories for select to authenticated
  using ((select auth.uid()) = user_id);

-- Only stories the user can already see (their own, or published to the marketplace).
drop policy if exists "Save visible stories" on public.saved_stories;
create policy "Save visible stories" on public.saved_stories for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.all_stories s where s.id = story_id)
  );

drop policy if exists "Remove own saved stories" on public.saved_stories;
create policy "Remove own saved stories" on public.saved_stories for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;
