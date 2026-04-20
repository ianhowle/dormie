-- ============================================================================
-- Recent co-players RPC
-- Returns users who shared a trip with the caller in the last N days
-- ============================================================================

create or replace function public.get_recent_co_players(p_user_id uuid, p_days int default 90)
returns table (
  id uuid,
  name text,
  handicap_index decimal,
  avatar_url text,
  last_played_at timestamp,
  rounds_together int
)
language sql
stable
as $$
  with co_rounds as (
    select r.trip_id, r.created_at
    from public.rounds r
    where r.user_id = p_user_id
      and r.trip_id is not null
      and r.created_at > now() - (p_days || ' days')::interval
  ),
  co_users as (
    select r2.user_id, r2.created_at
    from co_rounds cr
    join public.rounds r2 on r2.trip_id = cr.trip_id and r2.user_id <> p_user_id
  )
  select
    u.id,
    u.name,
    u.handicap_index,
    u.avatar_url,
    max(cu.created_at) as last_played_at,
    count(*)::int as rounds_together
  from co_users cu
  join public.users u on u.id = cu.user_id
  group by u.id, u.name, u.handicap_index, u.avatar_url
  order by max(cu.created_at) desc
  limit 20;
$$;

grant execute on function public.get_recent_co_players(uuid, int) to authenticated;
