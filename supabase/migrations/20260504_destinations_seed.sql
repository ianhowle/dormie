-- ============================================================================
-- Seed initial destinations from existing MOCK arrays in src/data/trips.ts
-- (MOCK_DREAM_DESTINATIONS, MOCK_BUCKET_COURSES, MOCK_EXPLORE_DESTINATIONS).
--
-- hero_image_url is left null because the app's getDreamImage() helper is
-- a stub; DestinationImage fetches via Google Places at render time using
-- the destination name. We can backfill curated URLs later.
-- ============================================================================

insert into public.destinations (name, region, country, description, course_count, price_tier, best_season) values
  -- From MOCK_DREAM_DESTINATIONS
  ('Pebble Beach',     'Pebble Beach, CA', 'USA', 'Iconic Pacific cliffs and the most photographed greens in golf.',                    5, 4, ARRAY['Apr','May','Jun','Sep','Oct']),
  ('Bandon Dunes',     'Bandon, OR',       'USA', 'Links golf at the edge of the Pacific. Six courses, no carts.',                       6, 4, ARRAY['May','Jun','Jul','Aug','Sep']),
  ('Pinehurst No. 2',  'Pinehurst, NC',    'USA', 'The cradle of American golf. Nine courses across the Sandhills.',                     9, 3, ARRAY['Mar','Apr','May','Sep','Oct','Nov']),
  -- From MOCK_BUCKET_COURSES (deduplicated: Pebble Beach Golf Links and Bandon Dunes overlap with Dream)
  ('St Andrews Old Course', 'St Andrews, Scotland', 'Scotland', 'The Home of Golf. Walk the same fairways as every legend of the game.', 7, 4, ARRAY['May','Jun','Jul','Aug','Sep']),
  -- From MOCK_EXPLORE_DESTINATIONS
  ('Scottsdale',       'Scottsdale, AZ',   'USA', '12 courses nearby. Desert golf, year-round sun, Stadium course on tour every year.', 12, 3, ARRAY['Oct','Nov','Dec','Jan','Feb','Mar','Apr']),
  ('Hilton Head',      'Hilton Head, SC',  'USA', '8 courses nearby. Lowcountry charm, oak-lined fairways, Harbour Town Lighthouse.',   8, 3, ARRAY['Mar','Apr','May','Sep','Oct','Nov']),
  ('Palm Springs',     'Palm Springs, CA', 'USA', '15 courses nearby. Mountain backdrops, immaculate conditions, vintage Rat Pack vibe.',15, 3, ARRAY['Oct','Nov','Dec','Jan','Feb','Mar','Apr']),
  ('Austin',           'Austin, TX',       'USA', '6 courses nearby. Hill Country golf with live music and barbecue between rounds.',   6, 2, ARRAY['Mar','Apr','May','Sep','Oct','Nov']);
