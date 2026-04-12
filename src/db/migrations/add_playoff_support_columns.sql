-- Migration: Add columns required for playoff/championship week advancement
--
-- The handleAdvanceWeek logic in season-detail.tsx depends on these columns
-- to track week completion status and player elimination.

-- Step 1: Add completed flag to season_weeks (tracks whether a week has been advanced)
ALTER TABLE season_weeks
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Add all_scores_submitted flag to season_weeks
-- (computed client-side for now, but stored for cache/display)
ALTER TABLE season_weeks
  ADD COLUMN IF NOT EXISTS all_scores_submitted BOOLEAN NOT NULL DEFAULT false;

-- Step 3: Add eliminated flag to season_members
-- Set to true for players below the cut line when playoffs begin
ALTER TABLE season_members
  ADD COLUMN IF NOT EXISTS eliminated BOOLEAN NOT NULL DEFAULT false;

-- Step 4: Index for fast lookup of active (non-eliminated) members
CREATE INDEX IF NOT EXISTS idx_season_members_active
  ON season_members (season_id)
  WHERE eliminated = false;
