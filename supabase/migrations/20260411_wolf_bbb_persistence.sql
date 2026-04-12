-- ============================================================================
-- Persist side-game data on rounds
-- ============================================================================

alter table public.rounds
  add column if not exists wolf_data jsonb,
  add column if not exists bbb_data jsonb;
