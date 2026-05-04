# Trips Dream Trip Intent-Capture Form Spec (Item 3)

**Date created:** 2026-05-03
**Phase reference:** Item 3 from `docs/trips-product-vision-2026-05-03.md`
**Estimated time:** 90-120 minutes focused work
**Goal:** Stub out Explore as an intent-capture form for dream trips. Restructure the Explore section on the Trips landing page around a new form. Capture lead-quality data without committing to follow-up. Build the foundation for the future AI trip planner by collecting real user intent NOW.

---

## Strategic Context

Reference `docs/trips-product-vision-2026-05-03.md` (Phase B item B1) and `docs/dormie-strategy.md`.

**The strategic bet:** before building an AI trip planner, validate demand by collecting real user intent. Every submission is a future customer signal. The form questions shape every submission you ever get — these have been deliberately designed by Ian and Claude in a strategic conversation, not invented during build time.

**Form purpose:** Lead generation primary, market research secondary. NO commitment to respond. Framing positions users as co-creators of Dormie's future trip planning, not waiting customers.

**The Explore section transformation:** Currently three destination tiles (Scottsdale / Hilton Head / Palm Springs) sit at the bottom of Trips landing page. After this work, the form becomes the primary content of the Explore section. Existing destination tiles either go away or move below the form CTA.

---

## CRITICAL: Read Before Writing Any Code

Claude Code MUST read these files first to ground the work in actual codebase shape:

1. `app/(tabs)/trips.tsx` — find the Explore section, understand current tile rendering
2. `src/data/trips.ts` — confirm what mock data exists for Explore tiles, the destinations seed
3. `src/services/destinations.service.ts` — already exists from Aspirational Layer work, has `listAll()` method that returns destinations with `best_season` data
4. `src/lib/supabase.ts` — client config (already verified)
5. Any existing form-style screens — search for screens with multi-step forms or pill pickers (the AddPlayerSheet has multi-tab navigation; create-trip wizard has pill pickers — both are reference patterns)
6. `docs/trips-product-vision-2026-05-03.md` for vision context

If anything in this spec doesn't match actual code, adjust accordingly. Don't invent.

---

## Schema Design

### New Table: `dream_trip_inquiries`

```sql
create table public.dream_trip_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,

  -- Section 1: The Trip
  destination_categories text[] default '{}',
    -- ['coastal', 'mountain', 'desert', 'links', 'tropical', 'top_100', 'bucket_list']
  destination_text text,
    -- Free-text destination, can be a catalog destination name OR a city/state OR free-form
  destination_id uuid references public.destinations(id) on delete set null,
    -- Set if user picked from autocomplete catalog match; null if free text
  when_window text not null
    check (when_window in ('next_3_months', 'this_year', 'next_year', 'someday', 'still_determining')),
  group_size text not null
    check (group_size in ('just_me', 'me_plus_1', 'small_group', 'big_group', 'still_determining')),

  -- Section 2: The Vision (optional, may all be null for "someday" or "still determining" submissions)
  trip_kinds text[] default '{}',
    -- ['bachelor_party', 'annual_friends', 'couples_retreat', 'bucket_list', 'business', 'family', 'other']
  budget_tier text
    check (budget_tier in ('under_500', '500_to_1500', '1500_to_3000', '3000_to_5000', '5000_plus', 'variable', 'still_determining')),
  what_matters text[] default '{}',
    -- ['iconic_courses', 'course_variety', 'off_the_beaten_path', 'resort_experience', 'easy_logistics', 'food_nightlife', 'affordability', 'weather_guarantee']
  unforgettable_text text,
    -- Free text, story-driven response to "What would make this trip unforgettable for your group?"

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
```

### Migration file

`supabase/migrations/20260504_dream_trip_inquiries.sql` with the above SQL.

Ian applies via Supabase SQL Editor before testing.

---

## Service Layer

Create `src/services/inquiries.service.ts`:

```typescript
import { supabase } from '../lib/supabase';

export type WhenWindow = 'next_3_months' | 'this_year' | 'next_year' | 'someday' | 'still_determining';
export type GroupSize = 'just_me' | 'me_plus_1' | 'small_group' | 'big_group' | 'still_determining';
export type BudgetTier = 'under_500' | '500_to_1500' | '1500_to_3000' | '3000_to_5000' | '5000_plus' | 'variable' | 'still_determining';
export type DestinationCategory = 'coastal' | 'mountain' | 'desert' | 'links' | 'tropical' | 'top_100' | 'bucket_list';
export type TripKind = 'bachelor_party' | 'annual_friends' | 'couples_retreat' | 'bucket_list' | 'business' | 'family' | 'other';
export type WhatMatters = 'iconic_courses' | 'course_variety' | 'off_the_beaten_path' | 'resort_experience' | 'easy_logistics' | 'food_nightlife' | 'affordability' | 'weather_guarantee';

export interface DreamTripInquiryInput {
  destination_categories: DestinationCategory[];
  destination_text: string | null;
  destination_id: string | null;
  when_window: WhenWindow;
  group_size: GroupSize;
  trip_kinds: TripKind[];
  budget_tier: BudgetTier | null;
  what_matters: WhatMatters[];
  unforgettable_text: string | null;
}

export interface DreamTripInquiry extends DreamTripInquiryInput {
  id: string;
  user_id: string;
  created_at: string;
}

export const inquiriesService = {
  async create(userId: string, input: DreamTripInquiryInput): Promise<DreamTripInquiry> {
    const { data, error } = await supabase
      .from('dream_trip_inquiries')
      .insert({ user_id: userId, ...input })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listForUser(userId: string): Promise<DreamTripInquiry[]> {
    const { data, error } = await supabase
      .from('dream_trip_inquiries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};
```

---

## Form UI Specification

### File location

`app/explore-dream-trip.tsx` — new screen, navigated to from a "Plan your dream trip" CTA in the Explore section.

### Header copy

- Screen title (top): "Explore your next dream trip"
- Sub-headline: TBD by Ian during build. Flagged in compost pile. **DO NOT SHIP WITH BLANK** — Claude Code should pause and request the sub-headline copy from Ian before final commit. Suggested working copy as placeholder during dev: "Tell us where you're dreaming of and what matters most. Your input shapes how Dormie helps plan trips."

### Layout structure

Single-screen form (not multi-step wizard). All fields visible on a scrollable screen. Section headers separate the two logical groups.

### Section 1 — "The Trip" (top)

**Section header:** "THE TRIP" (small uppercase gold, matching existing pattern from TRIP MOMENTS / HEAD TO HEAD)

**Field 1.1 — Destination categories (optional)**

Label: "What kind of place draws you in?"
Help text: "Pick any that fit — or skip if you have a specific spot in mind."

Multi-select chip row, wraps on small screens:
- Coastal
- Mountain
- Desert
- Links
- Tropical
- Top 100
- Bucket list

Selected chips: Augusta green fill with gold text. Unselected: surface bg with muted text. Sharp edges. Light haptic on tap.

**Field 1.2 — Destination text (optional but encouraged)**

Label: "Where specifically?"
Help text: "Type a course, city, or just a vibe."

Autocomplete TextInput. As user types (3+ chars), show dropdown of matching destinations from `destinationsService.listAll()` — match against `name` and `region` fields.

If user picks a catalog destination from dropdown:
- `destination_id` is set to the catalog UUID
- `destination_text` is set to the catalog name
- The field shows the catalog name with a small ✓ checkmark indicating it's a known destination
- If the destination has `best_season` data, a small contextual callout appears below Q2 (When) — see Field 2.1

If user types free-text and submits without picking from dropdown:
- `destination_id` stays null
- `destination_text` is whatever the user typed
- No best_season callout (free text destinations don't have catalog data)

X button to clear.

**Field 1.3 — When (required)**

Label: "When?"

Pill picker (single-select):
- "In the next 3 months"
- "This year"
- "Next year"
- "Someday"
- "Still determining"

Selected pill: Augusta green fill, gold text. Unselected: surface bg, muted text.

**Conditional best season callout:** If the user picked a catalog destination in Field 1.2 AND that destination has `best_season` data, show a small callout below this field:

```
Best at <Destination Name>: April through June and September through October.
Off-season (Nov-Mar) is typically half the price but rain risk is real.
```

The exact copy is dynamically generated. For seeded destinations, the months are in `destinations.best_season` array. Format the months naturally (e.g. ['Apr','May','Jun','Sep','Oct'] becomes "April through June and September through October").

If `best_season` is null, no off-season copy is shown — just nothing renders.

**Field 1.4 — Group size (required)**

Label: "Who's going?"

Pill picker (single-select):
- "Just me"
- "Me +1"
- "Small group (3-5)"
- "Big group (6+)"
- "Still determining"

### Section 2 — "The Vision" (bottom)

**This entire section is hidden if when_window is "someday" or "still_determining".** That's the dreamer-mode short-circuit. They submit with just Section 1 answered.

**Section header:** "THE VISION"

Help text under section header: "All optional, but the more you tell us the better we understand what you actually want."

**Field 2.1 — Trip kind (optional)**

Label: "What kind of trip is this?"

Multi-select chip row:
- Bachelor party
- Annual trip with friends
- Couples retreat
- Bucket list
- Business
- Family
- Other

**Field 2.2 — Budget per person (optional)**

Label: "Budget per person?"
Help text: "Rough estimate is fine."

Pill picker (single-select):
- "Under $500"
- "$500-1,500"
- "$1,500-3,000"
- "$3,000-5,000"
- "$5,000+"
- "Variable / mix"
- "Still determining"

**Field 2.3 — What matters most (optional)**

Label: "What matters most?"
Help text: "Pick up to 3."

Multi-select chip row, max 3 selections. After 3 are selected, additional taps show a brief toast: "Pick your top 3 priorities."

- Iconic courses
- Course variety
- Off-the-beaten-path
- Resort experience
- Easy travel logistics
- Great food/nightlife
- Affordability
- Weather guarantee

**Field 2.4 — Unforgettable text (optional)**

Label: "What would make this trip unforgettable for your group?"
Help text: "Anything from 'a hole-in-one celebration spot' to 'Drew's last trip before his kids are born' to specific course requests."

Multiline TextInput, ~4 lines visible. Optional. Free text.

### Submit area

Sticky bottom or end of scroll:

- Primary button: "Submit"
  - Augusta green fill, gold text, sharp edges, light haptic on tap
  - Disabled if required fields (Q1.3 and Q1.4) not filled
- Cancel/Back: standard nav back button in header

### Submit handler

On submit:
- Light haptic on tap
- Build the input object from form state
- Call `inquiriesService.create(user.id, input)`
- On success:
  - Success haptic
  - Navigate to a success state (could be a dedicated screen or a modal sheet)
  - Show success copy: "Got it. We're using these submissions to design Dormie's trip planning recommendations. The more we hear from golfers like you, the better we can help plan trips that actually match what you want."
  - "Done" button returns to Trips tab
- On error:
  - Error haptic
  - Toast with error message
  - Form remains filled, user can retry

### Validation

- Required: Q1.3 (when), Q1.4 (group_size). Submit disabled until both selected.
- All other fields optional. NULL or empty array values are fine.

---

## Explore Section Restructuring on Trips Landing Page

In `app/(tabs)/trips.tsx`, the Explore section currently has three destination tiles. Restructure:

### New layout

**Section header:** "EXPLORE" (existing)

**Primary CTA:** A prominent card-style CTA at the top of the Explore section:

```
┌─────────────────────────────────────────────┐
│   Explore your next dream trip              │  (Georgia serif, primary text color)
│                                              │
│   Tell us where you're dreaming of and       │  (sub-headline by Ian, smaller body text)
│   what matters most.                         │
│                                              │
│            [ Start →  ]                      │  (Augusta green button, gold text)
└─────────────────────────────────────────────┘
```

Tap navigates to `/explore-dream-trip`.

**Existing destination tiles:** Move below the CTA, label them as something like "Trending destinations" or "Popular with Dormie golfers." For now, the tiles aren't tappable to anything meaningful (Discover was removed). Either:

**Option A:** Make the tiles tap-to-add-to-Dream-Board (since tile destinations are in the destinations catalog). Tap → opens add-to-dream-board picker pre-filled with that destination.

**Option B:** Make the tiles non-interactive for now, purely visual. Future state will be content-driven (course reviews, trip guides, etc.).

**Recommendation: Option A** — gives the tiles a real purpose and reinforces the Dream Board feature.

---

## Visual Design Notes

Match Dormie design tokens:
- Background: `#0D0A06`
- Surface: `#151312`
- Augusta green: `#006747`
- Gold: `#C9A227`
- Primary text: `#E8E4DE`
- Muted text: `#8A857F`
- Sharp edges (no border-radius)
- Georgia serif for headings/numbers
- Light haptics on chip taps and pill taps
- Spring animations on chip select states (existing pattern)

Form spacing should be generous — this is a thoughtful exercise, not a fast checkout. Each section visually distinct with subtle dividers.

---

## Acceptance Criteria

- [ ] Migration applied: `dream_trip_inquiries` table exists with correct schema, RLS, and indexes
- [ ] `inquiriesService.create()` and `listForUser()` work as expected
- [ ] New screen at `app/explore-dream-trip.tsx` renders correctly
- [ ] All 7 form fields render and behave correctly
- [ ] Multi-select chips work with proper visual states
- [ ] Pill pickers work as single-select with proper visual states
- [ ] Destination autocomplete pulls from `destinationsService.listAll()` and matches name/region
- [ ] Picking a catalog destination sets destination_id correctly
- [ ] Free-text destination leaves destination_id null
- [ ] Best season callout appears for catalog destinations with best_season data
- [ ] Section 2 hides when when_window is "someday" or "still_determining"
- [ ] What matters most enforces max 3 selections with helpful toast
- [ ] Submit button disabled until required fields filled
- [ ] Submit creates row in dream_trip_inquiries
- [ ] Success state shows with warm copy
- [ ] Cancel/back returns to Trips tab without saving
- [ ] Sub-headline copy filled in by Ian (NOT shipped blank)
- [ ] Explore section CTA renders correctly
- [ ] Tapping CTA navigates to form
- [ ] Existing destination tiles repurposed (Option A: tap-to-add-to-Dream-Board)
- [ ] `npx tsc --noEmit` passes
- [ ] Test on phone: full submission flow, dreamer-mode short form, validation, error handling

---

## Edge Cases

- **User submits with only required fields filled** — succeeds, optional fields stored as null/empty arrays
- **User picks a catalog destination then changes to free text** — destination_id should be cleared
- **User picks "someday" then changes to "this year"** — Section 2 should reveal
- **User answers Section 2 then changes to "someday"** — Section 2 hides BUT the answers should persist in state in case they change back. On submit while "someday" is selected, only Q1 data is saved (Q2 fields explicitly nullified)
- **User has no internet** — submit fails, error toast, form stays filled, retry possible
- **User submits same form twice** — both submissions saved (no dedup logic in v1, this is fine)
- **Free-text destination contains odd characters or super long text** — capped at 200 chars in DB. UI shows char counter when approaching limit
- **Unforgettable text super long** — capped at 1000 chars. UI shows char counter when approaching limit

---

## Compost Pile Updates (Append These During Implementation)

```
2026-05-03 — Form sub-headline copy gap (Item 3 build)
"Explore your next dream trip" needs a 1-2 sentence sub-headline explaining what users get from filling out the form. Claude (this assistant) suggested writing it during spec; flagging that Ian has better taste for Dormie voice than I do, so this should be Ian's call when we draft final form copy. Don't ship with a blank.

2026-05-03 — Dynamic destination popularity ranking (post-beta)
"Where do you want to go" autocomplete should eventually show top destinations weighted by Dormie user popularity, not alphabetical or curated-only. Once we have submission data, sort the suggestions by frequency. Could become a "Trending in Dormie" indicator. Strategic moat: showing what real golfers are dreaming about beats showing what marketing teams suggest.

2026-05-03 — Inquiry admin view (post-launch)
Once dream_trip_inquiries has real submissions, build a simple admin/founder view (could be a Supabase SQL query, or a basic Dormie web admin) to read submissions, filter by category/budget/window, and identify high-intent leads.
```

---

## Hand-Off Prompt for Claude Code

Paste this at the start of next session:

```
Read docs/trips-explore-form-spec-2026-05-03.md carefully. Single-feature implementation: Item 3 from the Trips product vision — the Dream Trip intent-capture form replacing the Explore section.

Goal: collect lead-quality data on what trips users dream about, without committing to follow-up. Form questions deliberately designed in a strategic conversation between Ian and Claude. DO NOT change the form questions during build.

Before writing code:
1. Read the spec
2. Read the 6 critical files listed
3. Confirm destinationsService is already in place from the Aspirational Layer work
4. PAUSE and ask Ian for the sub-headline copy under "Explore your next dream trip" before final commit
5. Summarize the implementation in your own words
6. Flag any spec assumptions that don't match the codebase

Then implement in this order:
1. Migration (apply via Supabase SQL Editor — Ian runs)
2. inquiriesService
3. Form screen UI
4. Explore section restructuring on Trips landing
5. Compost pile entries
6. Pause for Ian's sub-headline copy
7. Apply sub-headline, npx tsc --noEmit, commit, push

Single commit when complete (or up to 2 commits if migration is logically separate).
```

---

*End of spec. Two days of strategic design + 90-120 minutes of implementation = a real intent-capture engine for Dormie's trip planning future.*
