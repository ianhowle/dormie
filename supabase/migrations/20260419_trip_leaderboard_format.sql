-- ============================================================================
-- Fix trip leaderboard to respect scoring format
-- Previously hardcoded stroke-play (SUM gross ASC). Now branches by format:
--   stroke_play / best_ball / scramble / shamble / fourball → SUM gross ASC
--   stableford → compute points from hole_scores, SUM points DESC
--   modified_stableford → same with aggressive point scale, SUM points DESC
--   match_play → SUM gross ASC (match results not stored per-round)
-- ============================================================================

create or replace function public.get_trip_leaderboard(p_trip_id uuid)
returns table (
  user_id uuid,
  user_name text,
  handicap decimal,
  total_gross integer,
  total_net integer,
  rounds_played bigint,
  best_round integer,
  scoring_avg decimal,
  total_points integer
)
language plpgsql
security definer
stable
as $$
declare
  v_format text;
begin
  -- Look up the trip's scoring format
  select coalesce(t.format, 'stroke_play') into v_format
  from public.trips t
  where t.id = p_trip_id;

  if v_format = 'stableford' then
    return query
      with round_pts as (
        select
          r.user_id,
          r.gross_score,
          coalesce(r.net_score, r.gross_score) as net_score,
          coalesce((
            select sum(
              case
                when (hs.value->>'gross')::int - (hd.value->>'par')::int <= -3 then 5
                when (hs.value->>'gross')::int - (hd.value->>'par')::int = -2 then 4
                when (hs.value->>'gross')::int - (hd.value->>'par')::int = -1 then 3
                when (hs.value->>'gross')::int - (hd.value->>'par')::int = 0 then 2
                when (hs.value->>'gross')::int - (hd.value->>'par')::int = 1 then 1
                else 0
              end
            )
            from jsonb_array_elements(r.hole_scores) as hs(value)
            join public.courses c2 on c2.id = r.course_id
            cross join lateral jsonb_array_elements(c2.hole_data) as hd(value)
            where (hd.value->>'number')::int = (hs.value->>'hole')::int
          ), 0)::integer as pts
        from public.rounds r
        where r.trip_id = p_trip_id
      )
      select
        rp.user_id,
        u.name,
        u.handicap_index,
        sum(rp.gross_score)::integer,
        sum(rp.net_score)::integer,
        count(*),
        min(rp.gross_score),
        round(avg(rp.gross_score)::decimal, 1),
        sum(rp.pts)::integer
      from round_pts rp
      join public.users u on u.id = rp.user_id
      group by rp.user_id, u.name, u.handicap_index
      order by sum(rp.pts) desc;

  elsif v_format = 'modified_stableford' then
    return query
      with round_pts as (
        select
          r.user_id,
          r.gross_score,
          coalesce(r.net_score, r.gross_score) as net_score,
          coalesce((
            select sum(
              case
                when (hs.value->>'gross')::int - (hd.value->>'par')::int <= -3 then 8
                when (hs.value->>'gross')::int - (hd.value->>'par')::int = -2 then 5
                when (hs.value->>'gross')::int - (hd.value->>'par')::int = -1 then 2
                when (hs.value->>'gross')::int - (hd.value->>'par')::int = 0 then 0
                when (hs.value->>'gross')::int - (hd.value->>'par')::int = 1 then -1
                when (hs.value->>'gross')::int - (hd.value->>'par')::int = 2 then -3
                else -5
              end
            )
            from jsonb_array_elements(r.hole_scores) as hs(value)
            join public.courses c2 on c2.id = r.course_id
            cross join lateral jsonb_array_elements(c2.hole_data) as hd(value)
            where (hd.value->>'number')::int = (hs.value->>'hole')::int
          ), 0)::integer as pts
        from public.rounds r
        where r.trip_id = p_trip_id
      )
      select
        rp.user_id,
        u.name,
        u.handicap_index,
        sum(rp.gross_score)::integer,
        sum(rp.net_score)::integer,
        count(*),
        min(rp.gross_score),
        round(avg(rp.gross_score)::decimal, 1),
        sum(rp.pts)::integer
      from round_pts rp
      join public.users u on u.id = rp.user_id
      group by rp.user_id, u.name, u.handicap_index
      order by sum(rp.pts) desc;

  else
    -- Default: stroke play and all other formats — sum gross scores ASC
    return query
      select
        r.user_id,
        u.name as user_name,
        u.handicap_index as handicap,
        sum(r.gross_score)::integer as total_gross,
        sum(coalesce(r.net_score, r.gross_score))::integer as total_net,
        count(*) as rounds_played,
        min(r.gross_score) as best_round,
        round(avg(r.gross_score)::decimal, 1) as scoring_avg,
        0::integer as total_points
      from public.rounds r
      join public.users u on u.id = r.user_id
      where r.trip_id = p_trip_id
      group by r.user_id, u.name, u.handicap_index
      order by total_gross asc;
  end if;
end;
$$;
