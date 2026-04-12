-- ============================================================================
-- Enable Supabase Realtime on rounds and season_standings
-- ============================================================================

alter publication supabase_realtime add table public.rounds;

-- season_standings may be computed via RPC; for realtime we listen to
-- the underlying season_scores table. If a physical standings table exists,
-- swap the statement below.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'season_standings') then
    execute 'alter publication supabase_realtime add table public.season_standings';
  end if;
end$$;

alter publication supabase_realtime add table public.season_scores;
