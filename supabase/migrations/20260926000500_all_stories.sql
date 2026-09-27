-- Story saving on the existing public.all_stories table. Safe to re-run.
--
-- Uses the table's own columns: id, author_id, title, description, category, visibility,
-- cover_image_path, stereo_audio_path, duration_ms, created_at, published_at,
-- "familyID", category_tags. Adds published_segments.
--
-- A story's id is the creation session UUID its recording_segments share. Each
-- account's older unnamed workspace (creation_session_id is null) uses the
-- author's own id as its story id. visibility is the story's state: 'draft' or 'published'.
-- recording_segments is only read here, never changed.
begin;

alter table public.all_stories
  add column if not exists published_segments jsonb not null default '[]'::jsonb;
alter table public.all_stories alter column description set default '';
alter table public.all_stories alter column category set default 'Stories';
alter table public.all_stories alter column visibility set default 'draft';
alter table public.all_stories alter column created_at set default now();

-- Publish uploads the backend's mixed MP3 to <author_id>/<story id>/ in the recordings bucket.
update storage.buckets
  set allowed_mime_types = array_append(allowed_mime_types, 'audio/mpeg')
  where id = 'recordings' and not ('audio/mpeg' = any(coalesce(allowed_mime_types, array[]::text[])));

create index if not exists all_stories_library
  on public.all_stories (author_id, created_at desc, id);

alter table public.all_stories enable row level security;
grant select on public.all_stories to authenticated;
drop policy if exists "Read own stories" on public.all_stories;
create policy "Read own stories" on public.all_stories for select to authenticated
  using ((select auth.uid()) = author_id);

-- Publish captures an ordered version. Later timeline edits and Save leave
-- that published version intact until Publish is pressed again.
-- Returns the app's Story shape: id, user_id, creation_session_id, title,
-- status, created_at, updated_at, published_at.
-- Publish also takes the mixed MP3's storage path and the backend's description and hashtags.
drop function if exists public.save_story(uuid, text, boolean, text[]);
drop function if exists public.save_story(uuid, text, boolean, text[], text, text, text);
create function public.save_story(p_creation_session_id uuid, p_title text,
  p_publish boolean, p_segment_ids text[], p_stereo_audio_path text default null,
  p_description text default null, p_category_tags text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  story_id uuid;
  segment_ids text[];
  snapshot jsonb;
  total_ms bigint;
  owner_family uuid;
  result public.all_stories;
begin
  if owner_id is null then raise exception 'Sign in to save a story'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 80 then
    raise exception 'A story name must be between 1 and 80 characters';
  end if;
  story_id := coalesce(p_creation_session_id, owner_id);

  select coalesce(array_agg(id order by position, recorded_at, id), array[]::text[]),
    coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title,
      'storage_path', storage_path, 'duration_ms', duration_ms, 'position', position)
      order by position, recorded_at, id), '[]'::jsonb),
    coalesce(sum(duration_ms), 0)
  into segment_ids, snapshot, total_ms from public.recording_segments
  where user_id = owner_id and creation_session_id is not distinct from p_creation_session_id
    and deleted_at is null;
  if p_segment_ids is null or segment_ids <> p_segment_ids then
    raise exception 'Wait for all story moments and edits to finish syncing';
  end if;
  if p_publish and cardinality(segment_ids) = 0 then
    raise exception 'Record at least one moment before publishing';
  end if;

  select "familyID" into owner_family from public."userProfiles" where id = owner_id;

  insert into public.all_stories(id, author_id, title, description, category, visibility,
    duration_ms, created_at, published_at, "familyID", published_segments,
    stereo_audio_path, category_tags)
  values (story_id, owner_id, btrim(p_title), coalesce(p_description, ''), 'Stories',
    -- duration_ms must be > 0 when set, so an empty draft stores null.
    case when p_publish then 'published' else 'draft' end, nullif(total_ms, 0), now(),
    case when p_publish then now() end, owner_family,
    case when p_publish then snapshot else '[]'::jsonb end,
    p_stereo_audio_path, p_category_tags)
  on conflict (id) do update set title = excluded.title, duration_ms = excluded.duration_ms,
    "familyID" = coalesce(all_stories."familyID", excluded."familyID"),
    visibility = case when p_publish then 'published' else all_stories.visibility end,
    published_at = case when p_publish then now() else all_stories.published_at end,
    published_segments = case when p_publish then snapshot else all_stories.published_segments end,
    stereo_audio_path = coalesce(excluded.stereo_audio_path, all_stories.stereo_audio_path),
    description = coalesce(p_description, all_stories.description),
    category_tags = coalesce(excluded.category_tags, all_stories.category_tags)
  where all_stories.author_id = owner_id
  returning * into result;
  if result.id is null then raise exception 'This story belongs to another account'; end if;

  return jsonb_build_object(
    'id', result.id,
    'user_id', result.author_id,
    'creation_session_id', case when result.id = owner_id then null else result.id end,
    'title', result.title,
    'status', result.visibility,
    'created_at', result.created_at,
    'updated_at', coalesce(result.published_at, result.created_at),
    'published_at', result.published_at);
end;
$$;
revoke all on function public.save_story(uuid, text, boolean, text[], text, text, text) from public;
grant execute on function public.save_story(uuid, text, boolean, text[], text, text, text) to authenticated;

commit;
