-- Fix "infinite recursion detected in policy" when sending a story. Safe to re-run.
-- Run after 20260926001400.
--
-- story_shares' insert rule read all_stories, whose "Read stories sent to me" rule
-- reads story_shares again, so Postgres rejected every send (HTTP 500). The two
-- cross-table checks now run in security definer functions, which read the other
-- table without applying its row level security. The rules mean the same thing.
begin;

-- The caller wrote this story and it is published.
create or replace function public.tedtime_is_own_published_story(p_story_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.all_stories s
    where s.id = p_story_id and s.author_id = (select auth.uid()) and s.visibility = 'published'
  );
$$;
revoke all on function public.tedtime_is_own_published_story(uuid) from public;
grant execute on function public.tedtime_is_own_published_story(uuid) to authenticated;

-- Someone sent this story to the caller.
create or replace function public.tedtime_was_sent_to_me(p_story_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.story_shares sh
    where sh.story_id = p_story_id and sh.recipient_id = (select auth.uid())
  );
$$;
revoke all on function public.tedtime_was_sent_to_me(uuid) from public;
grant execute on function public.tedtime_was_sent_to_me(uuid) to authenticated;

drop policy if exists "Send own published stories" on public.story_shares;
create policy "Send own published stories" on public.story_shares for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and public.tedtime_is_own_published_story(story_id)
  );

drop policy if exists "Read stories sent to me" on public.all_stories;
create policy "Read stories sent to me" on public.all_stories for select to authenticated
  using (visibility = 'published' and public.tedtime_was_sent_to_me(id));

commit;
