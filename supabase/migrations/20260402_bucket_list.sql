-- Create bucket_list table
create table if not exists bucket_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  notes text,
  unique(user_id, course_id)
);

-- Index for fast lookups by user
create index if not exists idx_bucket_list_user_id on bucket_list(user_id);
