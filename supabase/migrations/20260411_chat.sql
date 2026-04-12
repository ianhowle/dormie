-- ============================================================================
-- Group chat: messages + read receipts
-- ============================================================================

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  attachment_url text,
  reply_to_id uuid references public.chat_messages(id) on delete set null,
  created_at timestamptz default now() not null,
  edited_at timestamptz,
  deleted_at timestamptz
);

create index idx_chat_messages_group on public.chat_messages(group_id, created_at desc);
create index idx_chat_messages_user on public.chat_messages(user_id);

create table public.chat_read_receipts (
  group_id uuid not null,
  user_id uuid not null references public.users(id) on delete cascade,
  last_read_message_id uuid references public.chat_messages(id) on delete set null,
  last_read_at timestamptz default now() not null,
  primary key (group_id, user_id)
);

create index idx_chat_read_receipts_user on public.chat_read_receipts(user_id);

alter table public.chat_messages enable row level security;
alter table public.chat_read_receipts enable row level security;

-- Permissive read: anyone authenticated. In production this should be scoped
-- to group membership — add a groups/group_members join once that table lands.
create policy "chat_messages_read" on public.chat_messages for select to authenticated using (true);
create policy "chat_messages_insert_self" on public.chat_messages for insert to authenticated
  with check (user_id = auth.uid() and deleted_at is null);
create policy "chat_messages_update_own" on public.chat_messages for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "chat_read_receipts_rw_self" on public.chat_read_receipts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table public.chat_messages;
