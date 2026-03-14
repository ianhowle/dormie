-- ============================================================================
-- 005: Trips and related tables
-- ============================================================================

-- Trips
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  city text,
  state text,
  start_date date not null,
  end_date date not null,
  invite_code text unique not null default upper(substr(md5(random()::text), 1, 6)),
  trip_type text not null default 'planned' check (trip_type in ('quick', 'planned', 'ryder')),
  format text default 'stroke_play',
  side_games jsonb default '[]'::jsonb,
  stakes text,
  status text not null default 'planning' check (status in ('planning', 'upcoming', 'active', 'completed')),
  organizer_id uuid not null references public.users(id) on delete cascade,
  ryder_cup_config jsonb, -- {teamRedName, teamBlueName, sessions[], formation}
  gradient jsonb default '["#3A5A3A","#6B8F6B"]'::jsonb,
  created_at timestamptz default now() not null,

  check (end_date >= start_date)
);

create index idx_trips_organizer on public.trips(organizer_id);
create index idx_trips_status on public.trips(status);
create index idx_trips_invite on public.trips(invite_code);
create index idx_trips_dates on public.trips(start_date, end_date);

-- Trip members
create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  rsvp_status text not null default 'pending' check (rsvp_status in ('confirmed', 'pending', 'declined')),
  role text not null default 'player' check (role in ('organizer', 'captain', 'player')),
  team text check (team in ('red', 'blue')), -- for Ryder Cup
  created_at timestamptz default now() not null,

  unique (trip_id, user_id)
);

create index idx_trip_members_trip on public.trip_members(trip_id);
create index idx_trip_members_user on public.trip_members(user_id);

-- Trip courses (which courses are played on which day)
create table public.trip_courses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  day_number integer not null,
  tee_time time,
  confirmed boolean default false,

  unique (trip_id, course_id, day_number)
);

create index idx_trip_courses_trip on public.trip_courses(trip_id);

-- Trip messages (real-time chat)
create table public.trip_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  reactions jsonb default '[]'::jsonb, -- [{emoji, userId}]
  created_at timestamptz default now() not null
);

create index idx_trip_messages_trip on public.trip_messages(trip_id, created_at desc);

-- Trip moments (memorable events)
create table public.trip_moments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  text text not null,
  photo_url text,
  created_at timestamptz default now() not null
);

create index idx_trip_moments_trip on public.trip_moments(trip_id, created_at desc);

-- Add FK from rounds to trips (deferred from 004)
alter table public.rounds
  add constraint fk_rounds_trip
  foreign key (trip_id) references public.trips(id) on delete set null;

-- ── RLS ──────────────────────────────────────────────────────────────

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_courses enable row level security;
alter table public.trip_messages enable row level security;
alter table public.trip_moments enable row level security;

-- Trips: members can read
create policy "trips_select_members"
  on public.trips for select
  to authenticated
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = id and tm.user_id = auth.uid()
    )
    or organizer_id = auth.uid()
  );

-- Trips: any authenticated user can create
create policy "trips_insert_auth"
  on public.trips for insert
  to authenticated
  with check (auth.uid() = organizer_id);

-- Trips: only organizer can update
create policy "trips_update_organizer"
  on public.trips for update
  to authenticated
  using (auth.uid() = organizer_id)
  with check (auth.uid() = organizer_id);

-- Trips: only organizer can delete
create policy "trips_delete_organizer"
  on public.trips for delete
  to authenticated
  using (auth.uid() = organizer_id);

-- Trip members: members of the trip can read all members
create policy "trip_members_select"
  on public.trip_members for select
  to authenticated
  using (
    exists (
      select 1 from public.trip_members tm2
      where tm2.trip_id = trip_id and tm2.user_id = auth.uid()
    )
  );

-- Trip members: organizer can add members, or user can add themselves
create policy "trip_members_insert"
  on public.trip_members for insert
  to authenticated
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.trips t
      where t.id = trip_id and t.organizer_id = auth.uid()
    )
  );

-- Trip members: user can update their own membership (RSVP), organizer can update any
create policy "trip_members_update"
  on public.trip_members for update
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.trips t
      where t.id = trip_id and t.organizer_id = auth.uid()
    )
  );

-- Trip members: organizer can remove, user can remove self
create policy "trip_members_delete"
  on public.trip_members for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.trips t
      where t.id = trip_id and t.organizer_id = auth.uid()
    )
  );

-- Trip courses: trip members can read
create policy "trip_courses_select"
  on public.trip_courses for select
  to authenticated
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_courses.trip_id and tm.user_id = auth.uid()
    )
  );

-- Trip courses: organizer can manage
create policy "trip_courses_insert"
  on public.trip_courses for insert
  to authenticated
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.organizer_id = auth.uid()
    )
  );

create policy "trip_courses_update"
  on public.trip_courses for update
  to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.organizer_id = auth.uid()
    )
  );

create policy "trip_courses_delete"
  on public.trip_courses for delete
  to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.organizer_id = auth.uid()
    )
  );

-- Trip messages: members can read
create policy "trip_messages_select"
  on public.trip_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_messages.trip_id and tm.user_id = auth.uid()
    )
  );

-- Trip messages: members can send
create policy "trip_messages_insert"
  on public.trip_messages for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_messages.trip_id and tm.user_id = auth.uid()
    )
  );

-- Trip messages: author can update their own (reactions handled separately)
create policy "trip_messages_update"
  on public.trip_messages for update
  to authenticated
  using (auth.uid() = user_id);

-- Trip messages: author can delete their own
create policy "trip_messages_delete"
  on public.trip_messages for delete
  to authenticated
  using (auth.uid() = user_id);

-- Trip moments: members can read
create policy "trip_moments_select"
  on public.trip_moments for select
  to authenticated
  using (
    exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_moments.trip_id and tm.user_id = auth.uid()
    )
  );

-- Trip moments: members can add
create policy "trip_moments_insert"
  on public.trip_moments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.trip_members tm
      where tm.trip_id = trip_moments.trip_id and tm.user_id = auth.uid()
    )
  );

-- Trip moments: author can update/delete
create policy "trip_moments_update"
  on public.trip_moments for update
  to authenticated
  using (auth.uid() = user_id);

create policy "trip_moments_delete"
  on public.trip_moments for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── Enable real-time for messages ────────────────────────────────────
alter publication supabase_realtime add table public.trip_messages;
