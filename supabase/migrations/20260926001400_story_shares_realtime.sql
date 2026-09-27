-- Live "new story" notifications. Safe to re-run. Run after 20260926001300.
--
-- Adds story_shares to Supabase Realtime so a recipient's app hears about a new
-- share right away. Realtime respects row level security: each user is only told
-- about shares they can read (ones sent to or by them).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'story_shares'
  ) then
    alter publication supabase_realtime add table public.story_shares;
  end if;
end $$;
