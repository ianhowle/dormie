-- ============================================================================
-- 001: Users table
-- ============================================================================

-- Users profile table (extends Supabase auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  handicap_index decimal(4,1) default 0,
  city text,
  state text,
  avatar_color text default '#2A9D8F',
  created_at timestamptz default now() not null
);

-- Index for email lookups
create index idx_users_email on public.users(email);

-- Enable RLS
alter table public.users enable row level security;

-- Users can read any user (needed for leaderboards, friend search, etc.)
create policy "users_select_all"
  on public.users for select
  to authenticated
  using (true);

-- Users can only insert their own profile
create policy "users_insert_own"
  on public.users for insert
  to authenticated
  with check (auth.uid() = id);

-- Users can only update their own profile
create policy "users_update_own"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Users can only delete their own profile
create policy "users_delete_own"
  on public.users for delete
  to authenticated
  using (auth.uid() = id);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
