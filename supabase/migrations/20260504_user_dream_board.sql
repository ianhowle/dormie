-- ============================================================================
-- User Dream Board: per-user personal selection of destinations (max 3)
-- ============================================================================

create table public.user_dream_board (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  destination_id uuid not null references public.destinations(id) on delete cascade,
  status text not null default 'saved'
    check (status in ('saved', 'planning', 'booked', 'played')),
  notes text,
  added_at timestamp with time zone default now(),
  unique (user_id, destination_id)
);

create index idx_user_dream_board_user on public.user_dream_board(user_id);

alter table public.user_dream_board enable row level security;

create policy "user_dream_board_select_own"
  on public.user_dream_board for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_dream_board_insert_own"
  on public.user_dream_board for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_dream_board_update_own"
  on public.user_dream_board for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_dream_board_delete_own"
  on public.user_dream_board for delete
  to authenticated
  using (user_id = auth.uid());

-- Hard-cap at 3 destinations per user, enforced at the database level so the
-- frontend can't accidentally bypass it. The trigger raises a clear error
-- the service layer surfaces directly to the user via toast.
create or replace function public.enforce_dream_board_cap()
returns trigger
language plpgsql
as $$
declare
  current_count int;
begin
  select count(*) into current_count
  from public.user_dream_board
  where user_id = new.user_id;

  if current_count >= 3 then
    raise exception 'Dream Board limit reached. Remove a destination before adding another.';
  end if;

  return new;
end;
$$;

create trigger enforce_dream_board_cap_trigger
  before insert on public.user_dream_board
  for each row execute function public.enforce_dream_board_cap();
