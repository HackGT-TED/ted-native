begin;

create table public.all_stories (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- A stable key also covers each account's pre-existing, unnamed workspace.
  id text generated always as (coalesce(creation_session_id::text, 'legacy')) stored,
  creation_session_id uuid,
  title text not null default 'Untitled story' check (char_length(btrim(title)) between 1 and 80),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  published_segments jsonb not null default '[]'::jsonb,
  primary key (user_id, id),
  check ((status = 'published') = (published_at is not null))
);
create index all_stories_library on public.all_stories(user_id, updated_at desc, id);
alter table public.all_stories enable row level security;
grant select on public.all_stories to authenticated;
create policy "Read own stories" on public.all_stories for select to authenticated
  using ((select auth.uid()) = user_id);

-- Uploading the first moment retains a draft even before the explicit Save.
create function public.retain_segment_story() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.all_stories(user_id, creation_session_id, created_at)
    values (new.user_id, new.creation_session_id, new.recorded_at)
  on conflict (user_id, id) do update set updated_at = now();
  return new;
end;
$$;
revoke all on function public.retain_segment_story() from public;
create trigger retain_segment_story after insert or update on public.recording_segments
  for each row execute function public.retain_segment_story();

insert into public.all_stories(user_id, creation_session_id, created_at, updated_at)
select user_id, creation_session_id, min(recorded_at), max(recorded_at)
from public.recording_segments group by user_id, creation_session_id;

-- Publish captures an ordered version. Later timeline edits and Save leave
-- that published version intact until Publish is pressed again.
create function public.save_story(p_creation_session_id uuid, p_title text,
  p_publish boolean, p_segment_ids text[]) returns public.all_stories
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  segment_ids text[];
  snapshot jsonb;
  result public.all_stories;
begin
  if owner_id is null then raise exception 'Sign in to save a story'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 80 then
    raise exception 'A story name must be between 1 and 80 characters';
  end if;
  select coalesce(array_agg(id order by position, recorded_at, id), array[]::text[]),
    coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title,
      'storage_path', storage_path, 'duration_ms', duration_ms, 'position', position)
      order by position, recorded_at, id), '[]'::jsonb)
  into segment_ids, snapshot from public.recording_segments
  where user_id = owner_id and creation_session_id is not distinct from p_creation_session_id
    and deleted_at is null;
  if p_segment_ids is null or segment_ids <> p_segment_ids then
    raise exception 'Wait for all story moments and edits to finish syncing';
  end if;
  if p_publish and cardinality(segment_ids) = 0 then
    raise exception 'Record at least one moment before publishing';
  end if;
  insert into public.all_stories(user_id, creation_session_id, title, status, published_at, published_segments)
  values (owner_id, p_creation_session_id, btrim(p_title),
    case when p_publish then 'published' else 'draft' end,
    case when p_publish then now() end, case when p_publish then snapshot else '[]'::jsonb end)
  on conflict (user_id, id) do update set title = excluded.title, updated_at = now(),
    status = case when p_publish then 'published' else all_stories.status end,
    published_at = case when p_publish then now() else all_stories.published_at end,
    published_segments = case when p_publish then snapshot else all_stories.published_segments end
  returning * into result;
  return result;
end;
$$;
revoke all on function public.save_story(uuid, text, boolean, text[]) from public;
grant execute on function public.save_story(uuid, text, boolean, text[]) to authenticated;

commit;
