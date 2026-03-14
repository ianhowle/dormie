-- ============================================================================
-- 007: RPC functions, views, and real-time config
-- ============================================================================

-- ── Join trip by invite code ─────────────────────────────────────────
create or replace function public.join_trip_by_code(code text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_trip_id uuid;
begin
  select id into v_trip_id
  from public.trips
  where invite_code = upper(code);

  if v_trip_id is null then
    raise exception 'Invalid invite code';
  end if;

  -- Check if already a member
  if exists (
    select 1 from public.trip_members
    where trip_id = v_trip_id and user_id = auth.uid()
  ) then
    return v_trip_id; -- Already a member, just return trip id
  end if;

  insert into public.trip_members (trip_id, user_id, rsvp_status, role)
  values (v_trip_id, auth.uid(), 'confirmed', 'player');

  return v_trip_id;
end;
$$;

-- ── Course leaderboard ───────────────────────────────────────────────
create or replace function public.get_course_leaderboard(p_course_id uuid)
returns table (
  user_id uuid,
  user_name text,
  best_score integer,
  avg_score decimal,
  rounds_played bigint,
  best_to_par integer
)
language sql
security definer
stable
as $$
  select
    r.user_id,
    u.name as user_name,
    min(r.gross_score) as best_score,
    round(avg(r.gross_score)::decimal, 1) as avg_score,
    count(*) as rounds_played,
    min(r.gross_score) - c.par as best_to_par
  from public.rounds r
  join public.users u on u.id = r.user_id
  join public.courses c on c.id = r.course_id
  where r.course_id = p_course_id
  group by r.user_id, u.name, c.par
  order by best_score asc;
$$;

-- ── Season standings (FedEx Cup points) ──────────────────────────────
create or replace function public.get_season_standings(p_season_id uuid)
returns table (
  user_id uuid,
  user_name text,
  total_points decimal,
  weeks_played bigint,
  best_finish integer
)
language sql
security definer
stable
as $$
  select
    ss.user_id,
    u.name as user_name,
    sum(ss.points) as total_points,
    count(*) as weeks_played,
    min(
      (select count(*) + 1
       from public.season_scores ss2
       where ss2.season_week_id = ss.season_week_id
         and ss2.points > ss.points)::integer
    ) as best_finish
  from public.season_scores ss
  join public.users u on u.id = ss.user_id
  join public.season_weeks sw on sw.id = ss.season_week_id
  where sw.season_id = p_season_id
  group by ss.user_id, u.name
  order by total_points desc;
$$;

-- ── Trip leaderboard ─────────────────────────────────────────────────
create or replace function public.get_trip_leaderboard(p_trip_id uuid)
returns table (
  user_id uuid,
  user_name text,
  handicap decimal,
  total_gross integer,
  total_net integer,
  rounds_played bigint,
  best_round integer,
  scoring_avg decimal
)
language sql
security definer
stable
as $$
  select
    r.user_id,
    u.name as user_name,
    u.handicap_index as handicap,
    sum(r.gross_score)::integer as total_gross,
    sum(coalesce(r.net_score, r.gross_score))::integer as total_net,
    count(*) as rounds_played,
    min(r.gross_score) as best_round,
    round(avg(r.gross_score)::decimal, 1) as scoring_avg
  from public.rounds r
  join public.users u on u.id = r.user_id
  where r.trip_id = p_trip_id
  group by r.user_id, u.name, u.handicap_index
  order by total_gross asc;
$$;

-- ── User stats ───────────────────────────────────────────────────────
create or replace function public.get_user_stats(p_user_id uuid)
returns table (
  total_rounds bigint,
  courses_played bigint,
  best_round integer,
  best_round_course text,
  scoring_avg decimal,
  trips_played bigint
)
language sql
security definer
stable
as $$
  select
    count(*) as total_rounds,
    count(distinct r.course_id) as courses_played,
    min(r.gross_score) as best_round,
    (select c.name from public.courses c
     join public.rounds r2 on r2.course_id = c.id
     where r2.user_id = p_user_id
     order by r2.gross_score asc limit 1) as best_round_course,
    round(avg(r.gross_score)::decimal, 1) as scoring_avg,
    count(distinct r.trip_id) as trips_played
  from public.rounds r
  where r.user_id = p_user_id;
$$;

-- ── Handicap calculation (last 20 rounds, best 8 differentials) ──────
create or replace function public.calculate_handicap(p_user_id uuid)
returns decimal
language plpgsql
security definer
as $$
declare
  v_handicap decimal;
begin
  with recent_rounds as (
    select
      r.gross_score,
      c.rating,
      c.slope
    from public.rounds r
    join public.courses c on c.id = r.course_id
    where r.user_id = p_user_id
      and c.rating is not null
      and c.slope is not null
    order by r.played_at desc
    limit 20
  ),
  differentials as (
    select
      round(((gross_score - rating) * 113.0 / slope)::decimal, 1) as diff
    from recent_rounds
    order by diff asc
    limit 8
  )
  select round(avg(diff)::decimal, 1)
  into v_handicap
  from differentials;

  -- Update user's handicap
  if v_handicap is not null then
    update public.users set handicap_index = v_handicap where id = p_user_id;
  end if;

  return coalesce(v_handicap, 0);
end;
$$;

-- ── Add reaction to message (avoids full row update) ─────────────────
create or replace function public.toggle_message_reaction(
  p_message_id uuid,
  p_emoji text
)
returns void
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_reactions jsonb;
  v_existing int;
begin
  select reactions into v_reactions
  from public.trip_messages
  where id = p_message_id;

  -- Check if user already reacted with this emoji
  select count(*) into v_existing
  from jsonb_array_elements(coalesce(v_reactions, '[]'::jsonb)) as elem
  where elem ->> 'emoji' = p_emoji and elem ->> 'userId' = v_user_id::text;

  if v_existing > 0 then
    -- Remove the reaction
    v_reactions := (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements(v_reactions) as elem
      where not (elem ->> 'emoji' = p_emoji and elem ->> 'userId' = v_user_id::text)
    );
  else
    -- Add the reaction
    v_reactions := coalesce(v_reactions, '[]'::jsonb) ||
      jsonb_build_object('emoji', p_emoji, 'userId', v_user_id)::jsonb;
  end if;

  update public.trip_messages
  set reactions = v_reactions
  where id = p_message_id;
end;
$$;

-- ── Enable real-time for scores ──────────────────────────────────────
alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.season_scores;
