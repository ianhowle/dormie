-- ============================================================================
-- Ranked course search RPC
-- Replaces naive ilike with match-ranking for typeahead quality
-- ============================================================================

create or replace function public.search_courses(p_query text, p_limit int default 10)
returns table (
  id uuid,
  name text,
  city text,
  state text,
  par int,
  slope int,
  rating decimal,
  photo_url text,
  match_rank int
)
language sql
stable
as $$
  select
    c.id, c.name, c.city, c.state, c.par, c.slope, c.rating, c.photo_url,
    case
      when lower(c.name) = lower(p_query) then 1
      when lower(c.name) like lower(p_query) || '%' then 2
      when lower(c.name) like '%' || lower(p_query) || '%' then 3
      when lower(c.city) like lower(p_query) || '%' then 4
      when lower(c.state) like lower(p_query) || '%' then 5
      else 6
    end as match_rank
  from public.courses c
  where
    lower(c.name) like '%' || lower(p_query) || '%'
    or lower(c.city) like '%' || lower(p_query) || '%'
    or lower(c.state) like '%' || lower(p_query) || '%'
  order by match_rank, c.name
  limit p_limit;
$$;

grant execute on function public.search_courses(text, int) to authenticated, anon;
