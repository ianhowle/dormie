-- ============================================================================
-- 006: Seasons and related tables
-- ============================================================================

-- Seasons (FedEx Cup style competitions)
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'fedex' check (type in ('fedex', 'ryder', 'custom')),
  config jsonb default '{}'::jsonb, -- {pointsSystem, playoffWeeks, etc.}
  status text not null default 'active' check (status in ('draft', 'active', 'playoffs', 'completed')),
  creator_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz default now() not null
);

create index idx_seasons_creator on public.seasons(creator_id);
create index idx_seasons_status on public.seasons(status);

-- Season members
create table public.season_members (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  team text, -- for team-based seasons

  unique (season_id, user_id)
);

create index idx_season_members_season on public.season_members(season_id);
create index idx_season_members_user on public.season_members(user_id);

-- Season weeks (each scoring period)
create table public.season_weeks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  week_number integer not null,
  format text default 'stroke_play',
  multiplier decimal(3,1) default 1.0,
  is_playoff boolean default false,
  is_championship boolean default false,
  is_major boolean default false,
  major_name text, -- 'The Masters', 'The Open', etc.
  start_date date,
  end_date date,

  unique (season_id, week_number)
);

create index idx_season_weeks_season on public.season_weeks(season_id);

-- Season scores (points earned per week)
create table public.season_scores (
  id uuid primary key default gen_random_uuid(),
  season_week_id uuid not null references public.season_weeks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  round_id uuid references public.rounds(id) on delete set null,
  points decimal(6,1) not null default 0,

  unique (season_week_id, user_id)
);

create index idx_season_scores_week on public.season_scores(season_week_id);
create index idx_season_scores_user on public.season_scores(user_id);

-- Add FK from rounds to season_weeks (deferred from 004)
alter table public.rounds
  add constraint fk_rounds_season_week
  foreign key (season_week_id) references public.season_weeks(id) on delete set null;

-- ── RLS ──────────────────────────────────────────────────────────────

alter table public.seasons enable row level security;
alter table public.season_members enable row level security;
alter table public.season_weeks enable row level security;
alter table public.season_scores enable row level security;

-- Seasons: members can read
create policy "seasons_select_members"
  on public.seasons for select
  to authenticated
  using (
    exists (
      select 1 from public.season_members sm
      where sm.season_id = id and sm.user_id = auth.uid()
    )
    or creator_id = auth.uid()
  );

-- Seasons: any user can create
create policy "seasons_insert_auth"
  on public.seasons for insert
  to authenticated
  with check (auth.uid() = creator_id);

-- Seasons: only creator can update
create policy "seasons_update_creator"
  on public.seasons for update
  to authenticated
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

-- Seasons: only creator can delete
create policy "seasons_delete_creator"
  on public.seasons for delete
  to authenticated
  using (auth.uid() = creator_id);

-- Season members: members can read all members in their season
create policy "season_members_select"
  on public.season_members for select
  to authenticated
  using (
    exists (
      select 1 from public.season_members sm2
      where sm2.season_id = season_id and sm2.user_id = auth.uid()
    )
  );

-- Season members: creator can add, or user joins self
create policy "season_members_insert"
  on public.season_members for insert
  to authenticated
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.seasons s
      where s.id = season_id and s.creator_id = auth.uid()
    )
  );

-- Season members: creator or self can update
create policy "season_members_update"
  on public.season_members for update
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.seasons s
      where s.id = season_id and s.creator_id = auth.uid()
    )
  );

-- Season members: creator or self can remove
create policy "season_members_delete"
  on public.season_members for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.seasons s
      where s.id = season_id and s.creator_id = auth.uid()
    )
  );

-- Season weeks: members can read
create policy "season_weeks_select"
  on public.season_weeks for select
  to authenticated
  using (
    exists (
      select 1 from public.season_members sm
      where sm.season_id = season_weeks.season_id and sm.user_id = auth.uid()
    )
  );

-- Season weeks: creator can manage
create policy "season_weeks_insert"
  on public.season_weeks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.seasons s
      where s.id = season_id and s.creator_id = auth.uid()
    )
  );

create policy "season_weeks_update"
  on public.season_weeks for update
  to authenticated
  using (
    exists (
      select 1 from public.seasons s
      where s.id = season_id and s.creator_id = auth.uid()
    )
  );

create policy "season_weeks_delete"
  on public.season_weeks for delete
  to authenticated
  using (
    exists (
      select 1 from public.seasons s
      where s.id = season_id and s.creator_id = auth.uid()
    )
  );

-- Season scores: members can read
create policy "season_scores_select"
  on public.season_scores for select
  to authenticated
  using (
    exists (
      select 1 from public.season_weeks sw
      join public.season_members sm on sm.season_id = sw.season_id
      where sw.id = season_week_id and sm.user_id = auth.uid()
    )
  );

-- Season scores: user can insert own, or creator can insert for scoring
create policy "season_scores_insert"
  on public.season_scores for insert
  to authenticated
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.season_weeks sw
      join public.seasons s on s.id = sw.season_id
      where sw.id = season_week_id and s.creator_id = auth.uid()
    )
  );

-- Season scores: user or creator can update
create policy "season_scores_update"
  on public.season_scores for update
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.season_weeks sw
      join public.seasons s on s.id = sw.season_id
      where sw.id = season_week_id and s.creator_id = auth.uid()
    )
  );
