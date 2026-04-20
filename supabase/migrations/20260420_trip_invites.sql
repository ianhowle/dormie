-- ============================================================================
-- Trip invites: expiring, usage-capped share links
-- Complements the permanent trips.invite_code column
-- ============================================================================

create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.users(id),
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone default (now() + interval '7 days'),
  max_uses int default 8,
  times_used int default 0
);

create index idx_trip_invites_code on public.trip_invites(code);
create index idx_trip_invites_trip_id on public.trip_invites(trip_id);

alter table public.trip_invites enable row level security;

-- Members can view invites for trips they belong to
create policy "trip_invites_select_members"
  on public.trip_invites for select
  to authenticated
  using (
    trip_id in (
      select trip_id from public.trip_members where user_id = auth.uid()
    )
  );

-- Members can create invites for trips they belong to
create policy "trip_invites_insert_members"
  on public.trip_invites for insert
  to authenticated
  with check (
    trip_id in (
      select trip_id from public.trip_members where user_id = auth.uid()
    )
  );

-- ── RPC: join trip via expiring invite ──────────────────────────────────

create or replace function public.join_trip_by_invite(p_code text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_invite public.trip_invites%rowtype;
  v_now timestamp with time zone := now();
begin
  -- Look up the invite
  select * into v_invite
  from public.trip_invites
  where code = upper(p_code);

  if v_invite.id is null then
    raise exception 'Invalid invite code';
  end if;

  if v_invite.expires_at < v_now then
    raise exception 'This invite has expired';
  end if;

  if v_invite.times_used >= v_invite.max_uses then
    raise exception 'This invite has reached its limit';
  end if;

  -- If already a member, return trip_id without incrementing usage
  if exists (
    select 1 from public.trip_members
    where trip_id = v_invite.trip_id and user_id = auth.uid()
  ) then
    return v_invite.trip_id;
  end if;

  -- Insert membership
  insert into public.trip_members (trip_id, user_id, rsvp_status, role)
  values (v_invite.trip_id, auth.uid(), 'confirmed', 'player');

  -- Increment usage
  update public.trip_invites
  set times_used = times_used + 1
  where id = v_invite.id;

  return v_invite.trip_id;
end;
$$;

grant execute on function public.join_trip_by_invite(text) to authenticated;
