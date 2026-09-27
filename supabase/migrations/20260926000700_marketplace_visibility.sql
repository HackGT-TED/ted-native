-- Marketplace visibility for all_stories. Safe to re-run. Run after 20260926000500.
--
-- visibility stays 'draft' / 'published' (the table's check constraint). Whether a
-- published story appears in the marketplace for everyone is a separate switch,
-- marketplace_visible, off by default. It is set only when a story is published.
begin;

alter table public.all_stories
  add column if not exists marketplace_visible boolean not null default false;

-- Signed-in users can read published marketplace stories, in addition to their own.
drop policy if exists "Read marketplace stories" on public.all_stories;
create policy "Read marketplace stories" on public.all_stories for select to authenticated
  using (marketplace_visible and visibility = 'published');

-- Same as 000500, plus p_marketplace and the returned 'marketplace' field.
drop function if exists public.save_story(uuid, text, boolean, text[]);
drop function if exists public.save_story(uuid, text, boolean, text[], text, text, text);
drop function if exists public.save_story(uuid, text, boolean, text[], text, text, text, boolean);
create function public.save_story(p_creation_session_id uuid, p_title text,
  p_publish boolean, p_segment_ids text[], p_stereo_audio_path text default null,
  p_description text default null, p_category_tags text default null,
  p_marketplace boolean default null) returns jsonb
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
    stereo_audio_path, category_tags, marketplace_visible)
  values (story_id, owner_id, btrim(p_title), coalesce(p_description, ''), 'Stories',
    -- duration_ms must be > 0 when set, so an empty draft stores null.
    case when p_publish then 'published' else 'draft' end, nullif(total_ms, 0), now(),
    case when p_publish then now() end, owner_family,
    case when p_publish then snapshot else '[]'::jsonb end,
    p_stereo_audio_path, p_category_tags,
    case when p_publish then coalesce(p_marketplace, false) else false end)
  on conflict (id) do update set title = excluded.title, duration_ms = excluded.duration_ms,
    "familyID" = coalesce(all_stories."familyID", excluded."familyID"),
    visibility = case when p_publish then 'published' else all_stories.visibility end,
    published_at = case when p_publish then now() else all_stories.published_at end,
    published_segments = case when p_publish then snapshot else all_stories.published_segments end,
    stereo_audio_path = coalesce(excluded.stereo_audio_path, all_stories.stereo_audio_path),
    description = coalesce(p_description, all_stories.description),
    category_tags = coalesce(excluded.category_tags, all_stories.category_tags),
    -- Only Publish changes marketplace visibility; Save leaves it as it was.
    marketplace_visible = case when p_publish then coalesce(p_marketplace, all_stories.marketplace_visible)
      else all_stories.marketplace_visible end
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
    'published_at', result.published_at,
    'marketplace', result.marketplace_visible);
end;
$$;
revoke all on function public.save_story(uuid, text, boolean, text[], text, text, text, boolean) from public;
grant execute on function public.save_story(uuid, text, boolean, text[], text, text, text, boolean) to authenticated;

commit;
