-- Let signed-in users play the mixed audio of published marketplace stories. Safe to re-run.
-- Run after 20260926000700.
--
-- Only the exact file a marketplace story points to (all_stories.stereo_audio_path)
-- becomes readable. Original moment recordings, drafts, and stories that are not in
-- the marketplace stay readable by their owner only (tedtime_select_own_recording).
-- The lookup goes through all_stories' "Read marketplace stories" policy, so it can
-- only match rows that are published and marketplace_visible.
begin;

create index if not exists all_stories_marketplace_audio
  on public.all_stories (stereo_audio_path)
  where marketplace_visible and visibility = 'published';

drop policy if exists "tedtime_read_marketplace_audio" on storage.objects;
create policy "tedtime_read_marketplace_audio" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'recordings'
    and exists (
      select 1 from public.all_stories s
      where s.stereo_audio_path = storage.objects.name
        and s.marketplace_visible
        and s.visibility = 'published'
    )
  );

commit;
