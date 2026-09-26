begin;

-- Soft deletions survive offline edits and late upload retries. Audio remains
-- private; deleting a segment removes it from story timelines, not the bucket.
alter table public.recording_segments add column if not exists deleted_at timestamptz;
alter table public.recording_segments alter column storage_path drop not null;
alter table public.recording_segments add constraint active_segment_has_audio
  check (deleted_at is not null or storage_path is not null);

grant update on public.recording_segments to authenticated;
create policy "Update own recording segments" on public.recording_segments
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
