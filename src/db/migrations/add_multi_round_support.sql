-- Migration: Add multi-round week support to season_scores
--
-- Problem: The unique constraint on (season_week_id, user_id) blocks users
-- from submitting multiple rounds in the same week. This migration adds
-- round_id to the constraint and a counting flag for best-round selection.

-- Step 1: Add round_id column (nullable FK to rounds)
ALTER TABLE season_scores
  ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES rounds(id) ON DELETE SET NULL;

-- Step 2: Add is_counting flag (true = this round counts toward standings)
ALTER TABLE season_scores
  ADD COLUMN IF NOT EXISTS is_counting BOOLEAN NOT NULL DEFAULT true;

-- Step 3: Add participation_bonus column (stores bonus points separately for display)
ALTER TABLE season_scores
  ADD COLUMN IF NOT EXISTS participation_bonus INTEGER NOT NULL DEFAULT 0;

-- Step 4: Drop the old unique constraint that blocks multiple rounds per week
-- (constraint name may vary — use the most common naming convention)
ALTER TABLE season_scores
  DROP CONSTRAINT IF EXISTS season_scores_season_week_id_user_id_key;

-- Step 5: Create new unique constraint that allows multiple rounds per user/week
-- Each (week, user, round) combination is unique
ALTER TABLE season_scores
  ADD CONSTRAINT season_scores_week_user_round_key
    UNIQUE (season_week_id, user_id, round_id);

-- Step 6: Index for fast lookups when computing standings
CREATE INDEX IF NOT EXISTS idx_season_scores_counting
  ON season_scores (season_week_id, user_id)
  WHERE is_counting = true;
