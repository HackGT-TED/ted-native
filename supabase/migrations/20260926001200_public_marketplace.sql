-- Open the marketplace to everyone, and keep users from saving their own stories.
-- Safe to re-run. Run after 20260926001100.
begin;

-- 1. Signed-out visitors can browse and play marketplace stories.
--    They may read only the columns a tile and the player need, and only rows the
--    policy below allows (published, marketplace_visible). Signed-in users keep
--    their existing access, including every column of their own stories.
revoke select on public.all_stories from anon;
grant select (id, author_id, title, description, published_at, cover_image_path,
  stereo_audio_path, duration_ms, marketplace_visible, visibility)
  on public.all_stories to anon;

drop policy if exists "Read marketplace stories" on public.all_stories;
create policy "Read marketplace stories" on public.all_stories for select to anon, authenticated
  using (marketplace_visible and visibility = 'published');

drop policy if exists "tedtime_read_marketplace_audio" on storage.objects;
create policy "tedtime_read_marketplace_audio" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'recordings'
    and exists (
      select 1 from public.all_stories s
      where s.stereo_audio_path = storage.objects.name
        and s.marketplace_visible
        and s.visibility = 'published'
    )
  );

drop policy if exists "tedtime_read_marketplace_covers" on storage.objects;
create policy "tedtime_read_marketplace_covers" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'recordings'
    and exists (
      select 1 from public.all_stories s
      where s.cover_image_path = storage.objects.name
        and s.marketplace_visible
        and s.visibility = 'published'
    )
  );

-- 2. Saved stories are other people's stories. Your own already live in your Library.
delete from public.saved_stories ss
  using public.all_stories s
  where s.id = ss.story_id and s.author_id = ss.user_id;

drop policy if exists "Save visible stories" on public.saved_stories;
create policy "Save visible stories" on public.saved_stories for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.all_stories s
      where s.id = story_id and s.author_id <> (select auth.uid())
    )
  );

commit;
