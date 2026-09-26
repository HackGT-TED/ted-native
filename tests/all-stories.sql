-- Run after migrations 003–005 against a disposable test database.
-- Uses a transaction so the test users, stories and edits are rolled back.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
insert into public.recording_segments(id, user_id, creation_session_id, storage_path, title, recorded_at, duration_ms, position)
values ('moment-001', auth.uid(), null, auth.uid()::text || '/one.m4a', 'First moment', now(), 1000, 1);
do $$ begin
  if (select count(*) from public.all_stories where status = 'draft') <> 1 then raise exception 'Upload did not retain a draft'; end if;
end $$;
select public.save_story(null, 'Saved story', false, array['moment-001']);
select public.save_story(null, 'Published story', true, array['moment-001']);
-- Saving changes must retain the published snapshot and avoid duplicate stories.
update public.recording_segments set title = 'Edited moment' where id = 'moment-001';
select public.save_story(null, 'Updated name', false, array['moment-001']);
do $$ begin
  if (select count(*) from public.all_stories) <> 1 then raise exception 'Duplicate story'; end if;
  if not exists(select 1 from public.all_stories where status = 'published' and title = 'Updated name'
    and published_segments->0->>'title' = 'First moment') then raise exception 'Published version was lost'; end if;
  begin
    perform public.save_story(null, 'Incomplete', true, array['missing-moment']);
    raise exception 'Unexpected success';
  exception when raise_exception then
    if sqlerrm = 'Unexpected success' then raise; end if;
  end;
end $$;
select public.save_story(null, 'Republished', true, array['moment-001']);
do $$ begin
  if not exists(select 1 from public.all_stories where published_segments->0->>'title' = 'Edited moment') then
    raise exception 'Republish did not refresh the snapshot'; end if;
end $$;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$ begin
  if exists(select 1 from public.all_stories) then raise exception 'Another account can read private stories'; end if;
  begin
    perform public.save_story(null, 'Empty publication', true, array[]::text[]);
    raise exception 'Unexpected success';
  exception when raise_exception then
    if sqlerrm = 'Unexpected success' then raise; end if;
  end;
end $$;
select public.save_story(null, 'An empty draft', false, array[]::text[]);
do $$ begin
  if (select count(*) from public.all_stories) <> 1 then raise exception 'Empty draft was not retained'; end if;
  if has_function_privilege('anon', 'public.save_story(uuid,text,boolean,text[])', 'execute') then
    raise exception 'Anonymous publishing is allowed'; end if;
end $$;
rollback;
