-- Sending published stories to specific people ("Sent to you"). Safe to re-run.
-- Run after 20260926001200.
--
-- A share lets its recipient read that story, play its audio, and see its cover,
-- even when the story is private (not in the marketplace). userProfiles stays
-- owner-only: finding people and showing sender names go through the functions
-- below, which return only names.
begin;

create table if not exists public.story_shares (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.all_stories(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  listened_at timestamptz,
  unique (story_id, recipient_id),
  check (sender_id <> recipient_id)
);
create index if not exists story_shares_inbox on public.story_shares (recipient_id, sent_at desc);

alter table public.story_shares enable row level security;
grant select, insert, delete on public.story_shares to authenticated;
-- Recipients only mark a story as played.
grant update (listened_at) on public.story_shares to authenticated;

drop policy if exists "Read own shares" on public.story_shares;
create policy "Read own shares" on public.story_shares for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));

-- Only the author sends, and only a published story.
drop policy if exists "Send own published stories" on public.story_shares;
create policy "Send own published stories" on public.story_shares for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (
      select 1 from public.all_stories s
      where s.id = story_id and s.author_id = (select auth.uid()) and s.visibility = 'published'
    )
  );

drop policy if exists "Mark received stories played" on public.story_shares;
create policy "Mark received stories played" on public.story_shares for update to authenticated
  using ((select auth.uid()) = recipient_id) with check ((select auth.uid()) = recipient_id);

-- The sender can unsend; the recipient can dismiss.
drop policy if exists "Remove own shares" on public.story_shares;
create policy "Remove own shares" on public.story_shares for delete to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));

-- Recipients can open, play, and see the cover of stories sent to them.
drop policy if exists "Read stories sent to me" on public.all_stories;
create policy "Read stories sent to me" on public.all_stories for select to authenticated
  using (
    visibility = 'published'
    and exists (
      select 1 from public.story_shares sh
      where sh.story_id = all_stories.id and sh.recipient_id = (select auth.uid())
    )
  );

drop policy if exists "tedtime_read_shared_audio" on storage.objects;
create policy "tedtime_read_shared_audio" on storage.objects for select to authenticated
  using (
    bucket_id = 'recordings'
    and exists (
      select 1 from public.all_stories s
      join public.story_shares sh on sh.story_id = s.id
      where sh.recipient_id = (select auth.uid()) and s.visibility = 'published'
        and storage.objects.name in (s.stereo_audio_path, s.cover_image_path)
    )
  );

-- Find people to send to by username or name. Returns names only, never emails.
create or replace function public.search_profiles(p_query text)
returns table (id uuid, username text, full_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.full_name
  from public."userProfiles" p
  where (select auth.uid()) is not null
    and p.id <> (select auth.uid())
    and char_length(btrim(p_query)) >= 2
    and (p.username ilike btrim(p_query) || '%' or p.full_name ilike '%' || btrim(p_query) || '%')
  order by p.username nulls last, p.full_name
  limit 10;
$$;
revoke all on function public.search_profiles(text) from public;
grant execute on function public.search_profiles(text) to authenticated;

-- The signed-in user's inbox: shares with their story and the sender's name.
create or replace function public.get_inbox()
returns table (share_id uuid, story_id uuid, author_id uuid, sender_name text, sent_at timestamptz,
  listened_at timestamptz, title text, description text, published_at timestamptz,
  cover_image_path text, stereo_audio_path text, duration_ms bigint)
language sql stable security definer set search_path = '' as $$
  select sh.id, s.id, s.author_id,
    coalesce(nullif(btrim(p.full_name), ''), p.username, 'Someone'),
    sh.sent_at, sh.listened_at, s.title, s.description, s.published_at,
    s.cover_image_path, s.stereo_audio_path, s.duration_ms::bigint
  from public.story_shares sh
  join public.all_stories s on s.id = sh.story_id and s.visibility = 'published'
  left join public."userProfiles" p on p.id = sh.sender_id
  where sh.recipient_id = (select auth.uid())
  order by sh.sent_at desc
  limit 200;
$$;
revoke all on function public.get_inbox() from public;
grant execute on function public.get_inbox() to authenticated;

commit;
