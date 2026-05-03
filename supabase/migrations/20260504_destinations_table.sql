-- ============================================================================
-- Destinations catalog: master list of golf destinations the app knows about
-- Seeded with curated entries; expandable later for sponsored/user-submitted
-- ============================================================================

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null,
  country text not null default 'USA',
  description text,
  hero_image_url text,
  hero_image_credit text,
  course_count int default 1,
  price_tier int check (price_tier between 1 and 4),
  best_season text[],
  is_curated boolean default true,
  is_sponsored boolean default false,
  sponsored_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create index idx_destinations_curated on public.destinations(is_curated) where is_curated = true;
create index idx_destinations_sponsored on public.destinations(is_sponsored) where is_sponsored = true;

alter table public.destinations enable row level security;

-- Public catalog: readable by anyone, including unauthenticated requests
create policy "destinations_select_all"
  on public.destinations for select
  to authenticated, anon
  using (true);
