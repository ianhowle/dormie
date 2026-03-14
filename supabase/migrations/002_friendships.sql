-- ============================================================================
-- 002: Friendships table
-- ============================================================================

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  friend_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz default now() not null,

  -- Prevent duplicate friendships
  unique (user_id, friend_id),
  -- Prevent self-friendship
  check (user_id != friend_id)
);

create index idx_friendships_user on public.friendships(user_id);
create index idx_friendships_friend on public.friendships(friend_id);
create index idx_friendships_status on public.friendships(status);

alter table public.friendships enable row level security;

-- Users can see friendships they're part of
create policy "friendships_select_own"
  on public.friendships for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Users can only send friend requests as themselves
create policy "friendships_insert_own"
  on public.friendships for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Either party can update (accept/block)
create policy "friendships_update_own"
  on public.friendships for update
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Either party can delete (unfriend)
create policy "friendships_delete_own"
  on public.friendships for delete
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Helper: check if two users are friends
create or replace function public.are_friends(uid1 uuid, uid2 uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and (
        (user_id = uid1 and friend_id = uid2)
        or (user_id = uid2 and friend_id = uid1)
      )
  );
$$;
