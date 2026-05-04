-- ============================================================================
-- Dream Trip Inquiries: lead-quality intent capture for the future AI trip
-- planner. Append-only from the user's perspective (no update/delete RLS in
-- v1). Two logical sections: "The Trip" (always answered) and "The Vision"
-- (skipped when the user is in dreamer mode — when_window = someday or
-- still_determining).
-- ============================================================================

create table public.dream_trip_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,

  -- Section 1: The Trip
  destination_categories text[] default '{}',
    -- ['coastal', 'mountain', 'desert', 'links', 'tropical', 'top_100', 'bucket_list']
  destination_text varchar(200),
    -- Free-text destination, can be a catalog destination name OR a city/state OR free-form
  destination_id uuid references public.destinations(id) on delete set null,
    -- Set if user picked from autocomplete catalog match; null if free text
  when_window text not null
    check (when_window in ('next_3_months', 'this_year', 'next_year', 'someday', 'still_determining')),
  group_size text not null
    check (group_size in ('just_me', 'me_plus_1', 'small_group', 'big_group', 'still_determining')),

  -- Section 2: The Vision (optional, may all be null for "someday" or "still_determining" submissions)
  trip_kinds text[] default '{}',
    -- ['bachelor_party', 'annual_friends', 'couples_retreat', 'bucket_list', 'business', 'family', 'other']
  budget_tier text
    check (budget_tier in ('under_500', '500_to_1500', '1500_to_3000', '3000_to_5000', '5000_plus', 'variable', 'still_determining')),
  what_matters text[] default '{}',
    -- ['iconic_courses', 'course_variety', 'off_the_beaten_path', 'resort_experience', 'easy_logistics', 'food_nightlife', 'affordability', 'weather_guarantee']
  unforgettable_text varchar(1000),

  created_at timestamp with time zone default now()
);

create index idx_dream_trip_inquiries_user on public.dream_trip_inquiries(user_id);
create index idx_dream_trip_inquiries_created on public.dream_trip_inquiries(created_at desc);

alter table public.dream_trip_inquiries enable row level security;

create policy "dream_trip_inquiries_select_own"
  on public.dream_trip_inquiries for select
  to authenticated
  using (user_id = auth.uid());

create policy "dream_trip_inquiries_insert_own"
  on public.dream_trip_inquiries for insert
  to authenticated
  with check (user_id = auth.uid());

-- No update or delete policies for v1 — inquiries are append-only from user perspective
