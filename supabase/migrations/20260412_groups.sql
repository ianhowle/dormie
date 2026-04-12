-- ============================================================================
-- Groups: table + members + RLS
-- ============================================================================

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text default '#006747',
  created_by uuid not null references public.users(id) on delete cascade,
  active_season_id uuid references public.seasons(id) on delete set null,
  created_at timestamptz default now() not null
);

create index idx_groups_created_by on public.groups(created_by);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz default now() not null,
  primary key (group_id, user_id)
);

create index idx_group_members_user on public.group_members(user_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Members can read groups they belong to
create policy "groups_select_member" on public.groups for select to authenticated
  using (
    created_by = auth.uid() or exists (
      select 1 from public.group_members gm where gm.group_id = id and gm.user_id = auth.uid()
    )
  );

-- Any authenticated user can create a group (they become admin via creator row)
create policy "groups_insert_creator" on public.groups for insert to authenticated
  with check (created_by = auth.uid());

-- Only admins can update/delete the group
create policy "groups_update_admin" on public.groups for update to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = id and gm.user_id = auth.uid() and gm.role = 'admin'
    )
  );

create policy "groups_delete_admin" on public.groups for delete to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = id and gm.user_id = auth.uid() and gm.role = 'admin'
    )
  );

-- Members can read the roster of groups they belong to
create policy "group_members_select" on public.group_members for select to authenticated
  using (
    user_id = auth.uid() or exists (
      select 1 from public.group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
    )
  );

-- Admins can add/remove members; users can remove themselves
create policy "group_members_insert_admin" on public.group_members for insert to authenticated
  with check (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role = 'admin'
    )
    or not exists (select 1 from public.group_members where group_id = group_members.group_id)
  );

create policy "group_members_delete" on public.group_members for delete to authenticated
  using (
    user_id = auth.uid() or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role = 'admin'
    )
  );
