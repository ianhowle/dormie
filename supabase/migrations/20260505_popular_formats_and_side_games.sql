-- ============================================================================
-- Cross-user aggregation RPCs for the wizard's "popular across Dormie"
-- fallback layer (Phase 1.3 of trips-wizard-redesign-spec-2026-05-05.md).
--
-- Why these need to be RPCs:
-- RLS on the trips table (trips_select_members, 005_trips.sql:101) limits
-- client-side select to trip members. To power the middle-layer fallback
-- — which surfaces formats and side games popular across the ENTIRE user
-- base, not just the calling user's own trips — we need security_definer
-- functions that bypass RLS for the aggregation only. Both functions are
-- read-only and return the most popular keys, ordered by usage count.
--
-- 'draft' and 'cancelled' trips are excluded from the aggregation per
-- spec — drafts aren't real history, and cancelled trips don't represent
-- preference signal.
--
-- Returns text[] rather than a row set so the service layer can consume
-- the result with a single .rpc() call.
-- ============================================================================

create or replace function public.get_popular_formats(p_limit int default 5)
returns text[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(format order by usage_count desc), '{}'::text[])
  from (
    select format, count(*) as usage_count
    from public.trips
    where status not in ('draft', 'cancelled')
      and format is not null
    group by format
    order by usage_count desc
    limit p_limit
  ) sub;
$$;

grant execute on function public.get_popular_formats(int) to authenticated, anon;

create or replace function public.get_popular_side_games(p_limit int default 5)
returns text[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(side_game order by usage_count desc), '{}'::text[])
  from (
    select side_game, count(*) as usage_count
    from public.trips,
         lateral jsonb_array_elements_text(side_games) as side_game
    where status not in ('draft', 'cancelled')
      and side_games is not null
      and jsonb_typeof(side_games) = 'array'
    group by side_game
    order by usage_count desc
    limit p_limit
  ) sub;
$$;

grant execute on function public.get_popular_side_games(int) to authenticated, anon;
