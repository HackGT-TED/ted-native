begin;

-- Files remain in the existing private bucket; these rows describe draft inputs,
-- not published stories. Null session IDs represent each user's ongoing draft.
create table if not exists public.recording_segments (
  id text not null check (id ~ '^[A-Za-z0-9_-]{8,80}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  creation_session_id uuid,
  storage_path text not null,
  title text not null check (char_length(title) between 1 and 80),
  recorded_at timestamptz not null,
  duration_ms bigint not null check (duration_ms > 0),
  position bigint not null check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (storage_path),
  check (split_part(storage_path, '/', 1) = user_id::text)
);
create index if not exists recording_segments_timeline
  on public.recording_segments(user_id, creation_session_id, position, recorded_at);

alter table public.recording_segments enable row level security;
grant select, insert on public.recording_segments to authenticated;
create policy "Read own recording segments" on public.recording_segments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own recording segments" on public.recording_segments
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Recover metadata from uploads made before the timeline existed.
insert into public.recording_segments
  (id, user_id, storage_path, title, recorded_at, duration_ms, position)
select o.id::text, u.id, o.name,
  left(coalesce(nullif(o.user_metadata->>'title', ''), 'A story moment'), 80),
  o.created_at,
  (o.user_metadata->>'durationMs')::bigint,
  floor(extract(epoch from o.created_at) * 1000)::bigint
from storage.objects o
join auth.users u on u.id::text = split_part(o.name, '/', 1)
where o.bucket_id = 'recordings'
  and o.user_metadata->>'durationMs' ~ '^[0-9]{1,15}$'
  and (o.user_metadata->>'durationMs')::numeric > 0
on conflict do nothing;

commit;
