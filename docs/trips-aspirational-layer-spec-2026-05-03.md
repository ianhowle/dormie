# Trips Aspirational Layer Implementation Spec

**Date:** 2026-05-03
**Phase reference:** A1 + A4 + A6 from `docs/trips-product-vision-2026-05-03.md`
**Estimated time:** 2-3 hours focused work
**Goal:** Ship a fully interactive Dream Board with merged Bucket List, remove the redundant Discover button. By session end, the user can add destinations to their personal Dream Board (max 3), track status (Saved/Planning/Booked/Played), and the Dream Board feels like a real feature instead of static UI.

---

## Strategic Context (Read First)

Reference `docs/trips-product-vision-2026-05-03.md` for full context. The short version:

The Dream Board is the most visually compelling thing on the Trips landing screen and currently the most broken — it's a beautiful promise the app doesn't keep. Tapping "Plan Trip" goes nowhere. There's no way to add or remove destinations. It's identical for every user.

This session changes that. Dream Board becomes interactive, capped at 3 destinations per user (constraint creates meaning), with a status field that tracks the user's relationship with each destination over time. We also merge Bucket List into Dream Board because they're conceptually overlapping, and remove the Discover button which duplicates Explore.

This is the foundation for the social layer (Phase C) and sponsorship integration (Phase F). Architect accordingly — destinations should be queryable from the database, not hardcoded JSON.

---

## CRITICAL: Read Before Writing Any Code

Claude Code MUST read these files first to ground the work in actual codebase shape:

1. `app/(tabs)/trips.tsx` — Dream Board rendering, Bucket List rendering, Discover/Join/New Trip header buttons
2. `src/data/trips.ts` — current MOCK destinations, mock structure
3. `src/services/` — list all existing services to identify pattern for a new destinations service
4. `src/lib/supabase.ts` — confirm client config (already verified working)
5. Any existing destination-related components — search for "Dream", "Bucket", "destination", "Pebble Beach"
6. `docs/trips-product-vision-2026-05-03.md` — strategic context
7. `docs/trips-frontend-audit-2026-04-19.md` — original audit findings on Dream Board / Bucket List redundancy

If anything in this spec doesn't match actual code, adjust accordingly. Don't invent.

---

## Product Decisions (Locked In)

These are not up for re-debate during implementation. They're product decisions Ian has made:

1. **Dream Board cap: 3 destinations per user.** Constraint creates meaning.
2. **Bucket List merges into Dream Board.** Single unified concept. Bucket List section disappears from the UI.
3. **Discover button is removed.** Redundant with Explore. Single CTA.
4. **Status field on each destination:** `'saved' | 'planning' | 'booked' | 'played'`. Default = `'saved'`.
5. **Destinations are stored in Supabase, not hardcoded.** Two tables needed (see Schema section).
6. **No social layer yet.** This session ships the personal Dream Board only. Friend visibility is Phase C.
7. **Visual design largely preserved.** The Dream Board card style stays the same. Just adds interactivity.

---

## Schema Design

Two tables. Reasoning included so we don't second-guess later.

### Table 1 — `destinations` (the catalog)

The master list of destinations the app knows about. Pre-seeded with the existing mock destinations, expandable later for sponsored/curated additions.

```sql
create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  name text not null,                                    -- e.g. "Pebble Beach"
  region text not null,                                  -- e.g. "Pebble Beach, CA"
  country text not null default 'USA',
  description text,                                      -- short blurb for UI
  hero_image_url text,                                   -- the photo shown on the card
  hero_image_credit text,                                -- e.g. "Google" or photographer credit
  course_count int default 1,                           -- e.g. Pebble Beach has 5 nearby courses
  price_tier int check (price_tier between 1 and 4),    -- 1 = $, 4 = $$$$
  best_season text[],                                    -- ['Apr','May','Jun','Sep','Oct'] etc.
  is_curated boolean default true,                       -- false for user-submitted future
  is_sponsored boolean default false,                    -- for future sponsorship layer
  sponsored_until timestamp with time zone,              -- when sponsorship expires
  created_at timestamp with time zone default now()
);

create index idx_destinations_curated on public.destinations(is_curated) where is_curated = true;
create index idx_destinations_sponsored on public.destinations(is_sponsored) where is_sponsored = true;

alter table public.destinations enable row level security;

create policy "destinations_select_all"
  on public.destinations for select
  to authenticated, anon
  using (true);  -- destinations are public catalog
```

### Table 2 — `user_dream_board` (the user's personal selections)

Many-to-many: a user has up to 3 destinations on their Dream Board, each with its own status.

```sql
create table public.user_dream_board (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  destination_id uuid not null references public.destinations(id) on delete cascade,
  status text not null default 'saved'
    check (status in ('saved', 'planning', 'booked', 'played')),
  notes text,                                            -- optional user-private notes
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

-- Enforce 3-destination cap via trigger
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
```

### Seed data

Populate the `destinations` table with the current mock destinations so the existing UI keeps working with real data. Include all 6+ destinations referenced in the existing mock data (Pebble Beach, Bandon Dunes, Bethpage, St Andrews, Augusta-area equivalents, Pinehurst, Scottsdale, Hilton Head, Palm Springs).

```sql
insert into public.destinations (name, region, country, description, hero_image_url, hero_image_credit, course_count, price_tier, best_season) values
  ('Pebble Beach', 'Pebble Beach, CA', 'USA', 'Iconic Pacific cliffs and the most photographed greens in golf.', '<existing_pebble_url>', 'Google', 5, 4, ARRAY['Apr','May','Jun','Sep','Oct']),
  ('Bandon Dunes', 'Bandon, OR', 'USA', 'Links golf at the edge of the Pacific. Six courses, no carts.', '<existing_bandon_url>', 'Google', 6, 4, ARRAY['May','Jun','Jul','Aug','Sep']),
  ('Pinehurst', 'Pinehurst, NC', 'USA', 'The cradle of American golf. Nine courses across the Sandhills.', '<existing_pinehurst_url>', 'Google', 9, 3, ARRAY['Mar','Apr','May','Sep','Oct','Nov']),
  -- Add the rest based on existing MOCK data
  ;
```

Use the actual hero image URLs from the existing mock data file (`src/data/trips.ts` or wherever they live). Don't break references that work.

---

## Implementation Phases

Three commits. Validate each before moving to the next.

### Commit 1 — Schema + seed + service layer

**Migrations:**

- `supabase/migrations/20260504_destinations_table.sql` — destinations catalog
- `supabase/migrations/20260504_user_dream_board.sql` — user's personal board with cap trigger
- `supabase/migrations/20260504_destinations_seed.sql` — seed initial destinations

Ian applies these via Supabase SQL Editor.

**Service:**

Create `src/services/destinations.service.ts`:

```typescript
import { supabase } from '../lib/supabase';

export type DestinationStatus = 'saved' | 'planning' | 'booked' | 'played';

export interface Destination {
  id: string;
  name: string;
  region: string;
  country: string;
  description: string | null;
  hero_image_url: string | null;
  hero_image_credit: string | null;
  course_count: number;
  price_tier: number | null;
  best_season: string[] | null;
  is_curated: boolean;
  is_sponsored: boolean;
}

export interface DreamBoardEntry {
  id: string;
  user_id: string;
  destination_id: string;
  status: DestinationStatus;
  notes: string | null;
  added_at: string;
  destination: Destination;
}

export const destinationsService = {
  async listAll(): Promise<Destination[]> {
    const { data, error } = await supabase
      .from('destinations')
      .select('*')
      .order('is_sponsored', { ascending: false })
      .order('name', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getDreamBoard(userId: string): Promise<DreamBoardEntry[]> {
    const { data, error } = await supabase
      .from('user_dream_board')
      .select('*, destination:destinations(*)')
      .eq('user_id', userId)
      .order('added_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async addToDreamBoard(userId: string, destinationId: string): Promise<DreamBoardEntry> {
    const { data, error } = await supabase
      .from('user_dream_board')
      .insert({ user_id: userId, destination_id: destinationId, status: 'saved' })
      .select('*, destination:destinations(*)')
      .single();
    if (error) {
      // The trigger throws a clear message — surface it directly
      throw error;
    }
    return data;
  },

  async updateStatus(entryId: string, status: DestinationStatus): Promise<void> {
    const { error } = await supabase
      .from('user_dream_board')
      .update({ status })
      .eq('id', entryId);
    if (error) throw error;
  },

  async removeFromDreamBoard(entryId: string): Promise<void> {
    const { error } = await supabase
      .from('user_dream_board')
      .delete()
      .eq('id', entryId);
    if (error) throw error;
  },
};
```

**Acceptance:**
- All three migrations apply cleanly
- `destinationsService.listAll()` returns seeded destinations
- `destinationsService.getDreamBoard(user.id)` returns empty array on first call
- `addToDreamBoard()` succeeds for first 3 destinations, throws clear error on 4th
- `updateStatus()` and `removeFromDreamBoard()` work as expected

**Commit message:**
```
[Aspirational A1.1] Add destinations table, user_dream_board with cap trigger, and service layer

What changed:
- 3 migrations: destinations catalog, user_dream_board with cap, seed data
- New src/services/destinations.service.ts with listAll/getDreamBoard/add/updateStatus/remove

Why:
- Foundation for interactive Dream Board per docs/trips-product-vision-2026-05-03.md
- Reference docs/trips-aspirational-layer-spec-2026-05-03.md Commit 1
```

### Commit 2 — Dream Board UI: replace static rendering with real data

**File:** `app/(tabs)/trips.tsx` and any Dream Board card component

Replace the existing hardcoded Dream Board rendering with:

1. **Fetch user's Dream Board entries** on mount via `destinationsService.getDreamBoard(user.id)`
2. **Render real entries** — same visual style as today (hero image, name, region, "Plan Trip" link)
3. **Add status badge to each card** — small chip in top-left corner: SAVED (gold) / PLANNING (teal) / BOOKED (Augusta green) / PLAYED (muted)
4. **Add "Remove" affordance** — long-press card brings up Action Sheet: "Update Status" (opens picker) / "Remove from Dream Board"
5. **Empty state** — when user has 0 destinations on Dream Board, show: "Your Dream Board is empty. Browse Explore to add up to 3 destinations." with a tap-to-Explore CTA
6. **Add destination flow** — when user has < 3 destinations, show a "+" tile at the end of the horizontal scroll: "Add Destination" → opens a modal/sheet picker showing all available destinations

**Add Destination picker design:**
- Modal with `presentationStyle="pageSheet"`
- Title: "Add to Dream Board"
- Subtitle: "X of 3 spots open"
- List of destinations from `destinationsService.listAll()` minus those already on the user's board
- Each row: hero image thumbnail, name, region, price tier dots ($-$$$$), course count
- Tap to add → calls `addToDreamBoard()` → success toast → close modal → board refreshes
- Empty state if user has all available destinations (unlikely for now)

**Bucket List section: REMOVE entirely.** The current Bucket List section in `app/(tabs)/trips.tsx` is deleted as part of this commit. Decision is locked: merged into Dream Board.

**Status update flow:**
- Long-press destination card → Action Sheet
- "Update Status" → opens secondary picker:
  - SAVED — "Just dreaming"
  - PLANNING — "Working on it"
  - BOOKED — "It's happening"
  - PLAYED — "Memory in the books"
- Tap status → `updateStatus()` → success haptic + toast → card updates with new badge

**"Plan Trip" button on Dream Board cards:** For now, navigates to create-trip wizard with the destination region pre-filled in the location field. Full pre-fill with destination's specific course is Phase C work. For now, just pass the region as a query param and have create-trip use it as a starting search query.

**Acceptance:**
- New users see empty state with clear path to add destinations
- Existing users see only what they've added (no more universal mock data)
- Adding works up to 3, blocked with clear error toast on 4th attempt
- Status badges render correctly per destination
- Long-press → Action Sheet works on all four options
- "Plan Trip" navigates to create-trip with region pre-filled
- Bucket List section is gone
- All existing visual design (gradients, sharp edges, gold accents, Georgia serif) preserved

**Commit message:**
```
[Aspirational A1.2 + A4] Make Dream Board interactive, merge Bucket List into Dream Board

What changed:
- app/(tabs)/trips.tsx fetches real Dream Board entries from Supabase
- Add Destination picker modal with available destinations
- Status badges (SAVED/PLANNING/BOOKED/PLAYED) on each card
- Long-press Action Sheet with status update + remove
- Empty state and 3-destination cap with clear error messaging
- Bucket List section removed entirely (merged into Dream Board)
- Plan Trip button pre-fills create-trip with destination region

Why:
- Reference docs/trips-aspirational-layer-spec-2026-05-03.md Commit 2
- Closes Dream Board static-UI gap that was identified in original Trips audit
```

### Commit 3 — Remove Discover button (A6)

**File:** `app/(tabs)/trips.tsx` header

The header currently has three buttons: Discover, Join, + New Trip.

Remove Discover. Keep Join and + New Trip.

If Discover linked to a destinations page, that destinations page is now reached via "Browse Explore to add destinations" link in the empty Dream Board state, OR by tapping "Add Destination" tile. Verify both paths work and no orphan navigation exists.

If the Explore section at the bottom of the Trips landing screen is still there (per current screenshots, it is), keep it — we're not removing Explore, just the redundant Discover button. Explore stays as the section header for the bottom row of destination tiles.

If there's any other place in the app that links to Discover, redirect to Explore equivalent.

**Acceptance:**
- Discover button gone from Trips header
- Join + New Trip buttons remain, properly spaced
- No orphan navigation references to Discover route remain
- Explore section at bottom of page still works
- "Add Destination" flow from Dream Board works without Discover

**Commit message:**
```
[Aspirational A6] Remove redundant Discover button from Trips header

What changed:
- Discover button removed from app/(tabs)/trips.tsx header
- Verified no orphan navigation references
- Explore section preserved as the destination-discovery surface

Why:
- Discover and Explore were doing the same thing
- Reference docs/trips-aspirational-layer-spec-2026-05-03.md Commit 3
```

---

## Visual Design Notes (Match Existing Patterns)

All implementation must match Dormie's existing design tokens:

- Background: `#0D0A06`
- Surface: `#151312`
- Elevated: `#1A1816`
- Augusta green: `#006747`
- Gold: `#C9A227`
- Primary text: `#E8E4DE`
- Muted text: `#8A857F`
- Sharp edges (NO border-radius anywhere)
- Georgia serif for numbers and headings
- System sans for body text
- Light haptics on interactive elements
- Spring animations (friction 5)

**Status badge colors (consistent across the app):**
- SAVED: gold (`#C9A227`) text on dark surface, gold border
- PLANNING: teal (`#3FA897` or similar — match existing teal usage) text on dark surface
- BOOKED: Augusta green text on dark surface
- PLAYED: muted (`#6B6560`) text on dark surface, slightly faded card overall

---

## Edge Cases to Handle

1. **User reaches 3-destination cap** — clear error toast: "Dream Board is full. Remove a destination to add another." Don't just block silently.

2. **User tries to add a destination already on their board** — tappable destinations in the picker should hide (or grey out with "Already on your board" subtitle) entries already added.

3. **User removes a destination, then immediately tries to add it back** — should work seamlessly. No stale-state issues.

4. **Status set to PLAYED then user wants to "play it again"** — they don't need to. PLAYED is the end state. Future trip planning happens via create-trip, which is independent of Dream Board status.

5. **User deletes their account** — `on delete cascade` on user_dream_board handles this.

6. **Destination is deleted from catalog (admin action)** — `on delete cascade` removes user's saved entries cleanly.

7. **First-time user with empty Dream Board** — empty state should be inviting, not punitive. Tone: "Your Dream Board is empty. Browse Explore to add up to 3 destinations you want to play."

---

## Definition of Done

- [ ] All 3 migrations applied to Supabase
- [ ] Seed data populates with all current mock destinations
- [ ] `destinationsService` fully functional (5 methods)
- [ ] Dream Board on Trips tab fetches real data from Supabase
- [ ] Bucket List section gone from UI
- [ ] User can add up to 3 destinations
- [ ] User cannot add a 4th — clear error message
- [ ] Status badges render correctly
- [ ] Long-press Action Sheet works (status update + remove)
- [ ] Plan Trip button pre-fills create-trip with destination region
- [ ] Add Destination picker shows available destinations
- [ ] Discover button removed from Trips header
- [ ] No orphan navigation references
- [ ] Empty state copy is warm and on-brand
- [ ] All design tokens match Dormie patterns exactly
- [ ] `npx tsc --noEmit` passes
- [ ] Manual phone test: full add → status update → remove cycle works smoothly
- [ ] Manual phone test: 3-cap enforcement works
- [ ] Manual phone test: Plan Trip pre-fills correctly

---

## Hand-Off Prompt for Claude Code (Next Session)

Paste this at session start:

```
Read docs/trips-aspirational-layer-spec-2026-05-03.md carefully. Three-commit implementation of Phase A items A1, A4, A6 from the Trips product vision.

Goal: Make Dream Board interactive (3-destination cap, status field, add/remove flows), merge Bucket List into Dream Board, remove redundant Discover button.

Before writing code:
1. Read the spec
2. Read the 7 critical files listed
3. Confirm actual exports and shapes
4. Summarize the 3 commits in your own words
5. Flag any spec assumptions that don't match the codebase

Then implement Commit 1 first (schema + service). Commit and report. Wait for Ian's go-ahead before Commit 2 (UI rewiring). Same for Commit 3 (Discover removal).

Each commit pushes separately.
```

---

*End of spec. Aspirational layer ships in one focused session.*
