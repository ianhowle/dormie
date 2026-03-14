-- ============================================================================
-- 004: Rounds table
-- Key design: a round can belong to a trip AND/OR a season_week.
-- This lets one round feed leaderboard, trips, and seasons simultaneously.
-- ============================================================================

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  gross_score integer not null,
  net_score integer,
  to_par integer generated always as (gross_score - 72) stored, -- default par; overridden by course join
  hole_scores jsonb, -- array of {hole, gross, putts, fir}
  source text not null default 'app' check (source in ('app', 'manual', 'ghin')),
  trip_id uuid, -- nullable: FK added in 005 after trips table exists
  season_week_id uuid, -- nullable: FK added in 006 after season_weeks exists
  played_at date not null default current_date,
  created_at timestamptz default now() not null
);

create index idx_rounds_user on public.rounds(user_id);
create index idx_rounds_course on public.rounds(course_id);
create index idx_rounds_trip on public.rounds(trip_id) where trip_id is not null;
create index idx_rounds_season_week on public.rounds(season_week_id) where season_week_id is not null;
create index idx_rounds_played_at on public.rounds(played_at desc);
create index idx_rounds_user_played on public.rounds(user_id, played_at desc);

alter table public.rounds enable row level security;

-- Users can read their own rounds
create policy "rounds_select_own"
  on public.rounds for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can read friends' rounds
create policy "rounds_select_friends"
  on public.rounds for select
  to authenticated
  using (public.are_friends(auth.uid(), user_id));

-- Users can read rounds from trips they belong to
create policy "rounds_select_trip_members"
  on public.rounds for select
  to authenticated
  using (
    trip_id is not null
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = rounds.trip_id
        and tm.user_id = auth.uid()
    )
  );

-- Users can read rounds from seasons they belong to
create policy "rounds_select_season_members"
  on public.rounds for select
  to authenticated
  using (
    season_week_id is not null
    and exists (
      select 1 from public.season_weeks sw
      join public.season_members sm on sm.season_id = sw.season_id
      where sw.id = rounds.season_week_id
        and sm.user_id = auth.uid()
    )
  );

-- Users can only insert their own rounds
create policy "rounds_insert_own"
  on public.rounds for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can only update their own rounds
create policy "rounds_update_own"
  on public.rounds for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can only delete their own rounds
create policy "rounds_delete_own"
  on public.rounds for delete
  to authenticated
  using (auth.uid() = user_id);
