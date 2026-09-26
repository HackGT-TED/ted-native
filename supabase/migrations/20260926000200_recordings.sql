-- Private recordings. Safe to re-run, including after creating the bucket manually.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recordings', 'recordings', false, 26214400,
  array['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/webm', 'audio/ogg']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tedtime_insert_own_recording" on storage.objects;

create policy "tedtime_insert_own_recording" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "tedtime_select_own_recording" on storage.objects;
create policy "tedtime_select_own_recording" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
