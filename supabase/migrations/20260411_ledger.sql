-- ============================================================================
-- Bet tracking ledger: wagers, participants, entries, balances, settlements
-- ============================================================================

create table public.wagers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.users(id) on delete cascade,
  round_id uuid references public.rounds(id) on delete set null,
  trip_id uuid references public.trips(id) on delete set null,
  name text not null,
  type text not null check (type in ('nassau','skins','match','custom','dots','press','auto_nassau','auto_skins')),
  stakes jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','settled','voided')),
  created_at timestamptz default now() not null,
  settled_at timestamptz
);

create index idx_wagers_creator on public.wagers(creator_id);
create index idx_wagers_round on public.wagers(round_id);
create index idx_wagers_trip on public.wagers(trip_id);

create table public.wager_participants (
  wager_id uuid not null references public.wagers(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  team text,
  buy_in numeric(10,2) default 0,
  primary key (wager_id, user_id)
);

-- Double-entry ledger: each economic event creates paired rows
-- (or a balanced multi-way set) where the amount column nets to zero.
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  wager_id uuid references public.wagers(id) on delete cascade,
  round_id uuid references public.rounds(id) on delete set null,
  trip_id uuid references public.trips(id) on delete set null,
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(10,2) not null,
  memo text,
  kind text not null check (kind in ('wager','settlement','adjustment')),
  group_key text, -- groups multi-way entries from a single event
  created_at timestamptz default now() not null
);

create index idx_ledger_wager on public.ledger_entries(wager_id);
create index idx_ledger_from on public.ledger_entries(from_user_id);
create index idx_ledger_to on public.ledger_entries(to_user_id);
create index idx_ledger_group on public.ledger_entries(group_key);

-- Materialized per-user balance (sum across all entries).
-- Implemented as a view so it auto-updates with ledger mutations.
create view public.user_balances as
select
  u.id as user_id,
  coalesce((
    select sum(amount) from public.ledger_entries where to_user_id = u.id
  ), 0) -
  coalesce((
    select sum(amount) from public.ledger_entries where from_user_id = u.id
  ), 0) as net_balance
from public.users u;

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  method text, -- venmo, cash, zelle, etc.
  note text,
  settled_at timestamptz default now() not null
);

create index idx_settlements_from on public.settlements(from_user_id);
create index idx_settlements_to on public.settlements(to_user_id);

alter table public.wagers enable row level security;
alter table public.wager_participants enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.settlements enable row level security;

create policy "wagers_participant_read" on public.wagers for select to authenticated
  using (
    creator_id = auth.uid() or exists (
      select 1 from public.wager_participants wp where wp.wager_id = id and wp.user_id = auth.uid()
    )
  );

create policy "wagers_creator_write" on public.wagers for all to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());

create policy "wager_participants_read" on public.wager_participants for select to authenticated
  using (
    user_id = auth.uid() or exists (
      select 1 from public.wagers w where w.id = wager_id and w.creator_id = auth.uid()
    )
  );

create policy "wager_participants_write" on public.wager_participants for all to authenticated
  using (
    exists (select 1 from public.wagers w where w.id = wager_id and w.creator_id = auth.uid())
  ) with check (
    exists (select 1 from public.wagers w where w.id = wager_id and w.creator_id = auth.uid())
  );

create policy "ledger_read_self" on public.ledger_entries for select to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid());

create policy "ledger_insert_self" on public.ledger_entries for insert to authenticated
  with check (from_user_id = auth.uid() or to_user_id = auth.uid());

create policy "settlements_read_self" on public.settlements for select to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid());

create policy "settlements_insert_self" on public.settlements for insert to authenticated
  with check (from_user_id = auth.uid() or to_user_id = auth.uid());
