-- ============================================================================
-- 010: Virtual/Async rounds
-- Allow rounds without a pre-seeded Course record. Each round can instead
-- carry its own course identity + slope/rating (pulled from GolfCourseAPI
-- at the time of play). This unlocks virtual/async season play where each
-- member picks their own course on their own schedule.
-- ============================================================================

-- Make course_id nullable (null = virtual/async round played on any course)
alter table public.rounds
  alter column course_id drop not null;

-- Store course identity + handicap parameters directly on the round so
-- handicap index calculation works even when course_id is null (course
-- was freshly pulled from the API and not yet persisted to our courses
-- table).
alter table public.rounds
  add column if not exists course_name text,
  add column if not exists course_slope integer,
  add column if not exists course_rating numeric(4, 1),
  add column if not exists course_source text;

comment on column public.rounds.course_id is
  'Optional FK to courses table. Null for virtual/async rounds played on courses not in our seed DB.';
comment on column public.rounds.course_name is
  'Course name copy for virtual rounds or when course_id is null. Denormalized for display and handicap calc.';
comment on column public.rounds.course_slope is
  'Slope rating (55-155). Used for handicap differential when course_id is null.';
comment on column public.rounds.course_rating is
  'Course rating (e.g., 72.4). Used for handicap differential when course_id is null.';
comment on column public.rounds.course_source is
  'Provider of the course metadata (e.g., golfapi, manual).';
