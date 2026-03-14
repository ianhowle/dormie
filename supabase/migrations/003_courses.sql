-- ============================================================================
-- 003: Courses table
-- ============================================================================

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  city text,
  state text,
  par integer not null default 72,
  slope integer,
  rating decimal(4,1),
  yards integer,
  image_gradient jsonb default '["#3A5A3A","#6B8F6B"]'::jsonb,
  hole_data jsonb, -- array of {number, par, strokeIndex, yards}
  created_at timestamptz default now() not null
);

create index idx_courses_name on public.courses using gin (name gin_trgm_ops);
create index idx_courses_location on public.courses(location);

-- Install trigram extension for fuzzy course search
create extension if not exists pg_trgm;

alter table public.courses enable row level security;

-- All authenticated users can read courses
create policy "courses_select_all"
  on public.courses for select
  to authenticated
  using (true);

-- Any authenticated user can add a course
create policy "courses_insert_auth"
  on public.courses for insert
  to authenticated
  with check (true);

-- Any authenticated user can update courses (community data)
create policy "courses_update_auth"
  on public.courses for update
  to authenticated
  using (true);
