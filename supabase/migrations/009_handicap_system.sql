-- ============================================================================
-- 009: WHS-compliant Handicap System
--
-- Adds columns and tables required for proper World Handicap System tracking:
-- 1. users: low_handicap_index, handicap_last_updated
-- 2. New table: handicap_differentials (stores per-round differential history)
-- 3. Updated RPC: calculate_handicap now uses WHS selection table
-- ============================================================================

-- ── Add handicap tracking columns to users ──────────────────────────────
alter table public.users
  add column if not exists low_handicap_index decimal(4,1),
  add column if not exists handicap_last_updated timestamptz;

-- ── Handicap differentials table ────────────────────────────────────────
create table if not exists public.handicap_differentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  adjusted_gross_score integer not null,
  course_rating decimal(4,1) not null,
  slope_rating integer not null,
  differential decimal(4,1) not null,
  played_at date not null,
  created_at timestamptz default now() not null
);

create index if not exists idx_hcp_diff_user
  on public.handicap_differentials(user_id, played_at desc);

create index if not exists idx_hcp_diff_round
  on public.handicap_differentials(round_id);

-- Enable RLS
alter table public.handicap_differentials enable row level security;

-- Users can read their own differentials
create policy "hcp_diff_select_own"
  on public.handicap_differentials for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can read friends' differentials (for H2H comparison)
create policy "hcp_diff_select_friends"
  on public.handicap_differentials for select
  to authenticated
  using (public.are_friends(auth.uid(), user_id));

-- Users can insert their own differentials
create policy "hcp_diff_insert_own"
  on public.handicap_differentials for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can delete their own differentials (for recalculation)
create policy "hcp_diff_delete_own"
  on public.handicap_differentials for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── Updated handicap RPC with WHS selection table ───────────────────────
create or replace function public.calculate_handicap(p_user_id uuid)
returns decimal
language plpgsql
security definer
as $$
declare
  v_handicap decimal;
  v_count integer;
  v_num_select integer;
  v_adjustment decimal;
  v_low_hcp decimal;
  v_soft_cap decimal;
  v_hard_cap decimal;
begin
  -- Count available rated rounds
  select count(*) into v_count
  from public.rounds r
  join public.courses c on c.id = r.course_id
  where r.user_id = p_user_id
    and c.rating is not null
    and c.slope is not null;

  if v_count < 3 then
    return 0;
  end if;

  -- WHS selection table
  if v_count >= 20 then v_num_select := 8; v_adjustment := 0;
  elsif v_count = 19 then v_num_select := 7; v_adjustment := 0;
  elsif v_count >= 17 then v_num_select := 6; v_adjustment := 0;
  elsif v_count >= 15 then v_num_select := 5; v_adjustment := 0;
  elsif v_count >= 12 then v_num_select := 4; v_adjustment := 0;
  elsif v_count >= 9 then v_num_select := 3; v_adjustment := 0;
  elsif v_count >= 7 then v_num_select := 2; v_adjustment := 0;
  elsif v_count = 6 then v_num_select := 2; v_adjustment := 1.0;
  elsif v_count = 5 then v_num_select := 1; v_adjustment := 0;
  elsif v_count = 4 then v_num_select := 1; v_adjustment := 1.0;
  else v_num_select := 1; v_adjustment := 2.0; -- 3 rounds
  end if;

  -- Calculate handicap: average of best N differentials minus adjustment
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
      ((gross_score - rating) * 113.0 / slope) as diff
    from recent_rounds
    order by diff asc
    limit v_num_select
  )
  select (avg(diff) - v_adjustment)
  into v_handicap
  from differentials;

  if v_handicap is null then
    return 0;
  end if;

  -- Get low handicap index for cap checks
  select low_handicap_index into v_low_hcp
  from public.users where id = p_user_id;

  -- Apply soft cap: if > low + 3.0, only 50% of excess
  if v_low_hcp is not null and v_handicap > (v_low_hcp + 3.0) then
    v_soft_cap := (v_low_hcp + 3.0) + (v_handicap - (v_low_hcp + 3.0)) * 0.5;
    v_handicap := v_soft_cap;
  end if;

  -- Apply hard cap: cannot exceed low + 5.0
  if v_low_hcp is not null and v_handicap > (v_low_hcp + 5.0) then
    v_handicap := v_low_hcp + 5.0;
  end if;

  -- WHS maximum
  if v_handicap > 54.0 then
    v_handicap := 54.0;
  end if;

  -- Truncate to 1 decimal
  v_handicap := trunc(v_handicap::numeric, 1);

  -- Update user's handicap and tracking fields
  update public.users
  set handicap_index = v_handicap,
      handicap_last_updated = now(),
      low_handicap_index = case
        when low_handicap_index is null then v_handicap
        when v_handicap < low_handicap_index then v_handicap
        else low_handicap_index
      end
  where id = p_user_id;

  return v_handicap;
end;
$$;
