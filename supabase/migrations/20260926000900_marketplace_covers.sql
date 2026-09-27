-- Let signed-in users see the cover image of published marketplace stories. Safe to re-run.
-- Run after 20260926000800. Same rule as the marketplace audio, for cover_image_path.
begin;

drop policy if exists "tedtime_read_marketplace_covers" on storage.objects;
create policy "tedtime_read_marketplace_covers" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'recordings'
    and exists (
      select 1 from public.all_stories s
      where s.cover_image_path = storage.objects.name
        and s.marketplace_visible
        and s.visibility = 'published'
    )
  );

commit;
