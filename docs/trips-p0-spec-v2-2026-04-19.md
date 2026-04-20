# Trips P0 Implementation Spec — Elite Quality (v2, corrected)

**Date:** 2026-04-19
**Supersedes:** `docs/trips-p0-spec-2026-04-19.md` (v1)
**Scope:** Top 3 P0 fixes from `docs/trips-frontend-audit-2026-04-19.md`
**Target:** Claude Code should produce production-grade, ship-ready implementations on first pass that **extend existing Dormie systems** rather than duplicate them.

---

## CRITICAL: Read Before Writing Any Code

Claude Code MUST read these files first and confirm their actual shape before writing any new code. The spec uses likely names based on conversation history but the real codebase is source of truth:

1. `src/services/friends.service.ts` — confirm actual exports (likely `getActiveFriends`, `sendFriendRequest`, `acceptFriendRequest`, `rejectFriendRequest`)
2. `src/services/trips.service.ts` — confirm `create()` signature and any existing invite logic
3. `src/services/courses.service.ts` — confirm existing search, lookup, and create functions
4. `src/services/googlePlaces.ts` (or wherever Google Places lives) — confirm existing photo fetch logic
5. `src/lib/invite.ts` — the EXISTING friend invite deep link parser and AsyncStorage persistence
6. `app/_layout.tsx` — the EXISTING `useInviteLinkListener` and `useAutoAcceptInvite` hooks
7. `app.json` — the EXISTING iOS associated domains (`applinks:dormie.golf`) and Android intent filters for `dormie.golf/invite` URLs
8. `src/components/PostRoundSummary.tsx` — the EXISTING `ViewShot` + `Sharing.shareAsync()` + `MediaLibrary.saveToLibraryAsync()` pattern for branded image sharing
9. `src/contexts/ToastContext.tsx` — the EXISTING toast system used everywhere for user-facing errors
10. `DESIGN.md` and `docs/dormie-design-spec.md` for brand tokens
11. `src/theme/colors.ts`, `src/theme/fonts.ts`, `src/theme/spacing.ts` — exact design token values
12. `app/add-friends.tsx` — the EXISTING Add Friends screen with contacts integration, People You May Know, search by name, pending requests
13. `.env` — confirm `GOLF_COURSE_API_KEY` (GolfCourseAPI, account 7159) and `GOOGLE_PLACES_KEY` are present

**If any of these files don't match the assumed shape, adjust the implementation accordingly. Do not invent — use what's there.**

---

## Guiding Principles

1. **Extend, don't duplicate.** If a system exists (invite listener, friend search, toast, haptics, ViewShot), extend it.
2. **Match Dormie patterns exactly.** Dark surfaces (bg → surface → elevated), gold accents, Georgia serif for numbers, sharp edges (NO border-radius anywhere), spring animations (friction 5) with light haptics, 2–4px letter-spacing on uppercase kickers.
3. **No silent catches.** Every async wrapped in try/catch with user-facing toast.
4. **Loading states always shown.** Spinner on buttons, skeleton on lists. Never a blank screen.
5. **Empty states designed, not default.** Every list, every tab.
6. **No new dependencies unless justified.** Use React Native's `Modal` + existing patterns. Only add libraries if genuinely needed (e.g., `react-native-qrcode-svg` if QR is required and not already present).
7. **TypeScript strict.** `npx tsc --noEmit` must pass after every commit.

---

## Data Source Hierarchy for Courses

This is the **correct order** for course data lookup throughout Dormie:

```
USER TYPES IN SEARCH
   ↓
1. Search Supabase courses table (local, fast, ~20ms)
   ↓ [no results]
2. Offer GolfCourseAPI fallback (external, rich data: par, slope, rating, tees)
   ↓ [no results]
3. Offer Google Places fallback (location, photo, address only)
   ↓
4. Create new courses row with whatever data was returned, backfill missing fields over time
```

**Rationale:** GolfCourseAPI has real golf-specific data (par, slope, rating, tee boxes) that Google Places doesn't. Google Places is for **photos and addresses**, not course metadata. Use both, in this order.

Existing usage in the codebase:
- **GolfCourseAPI** is currently used when users add a course. Key in `.env` as `GOLF_COURSE_API_KEY`. User ID 7159.
- **Google Places** is currently used for course photos. Key in `.env` as `GOOGLE_PLACES_KEY`. Recent fix to URL-encoding of photo references.

Reuse the existing service methods for both. Do not write new wrappers.

---

## Fix 1 — Create Trip button does not work

### Problem restated
After filling out the Quick Trip wizard, tapping "Create Trip" does nothing — no navigation, no toast, no error.

### Required diagnostic order

Claude Code MUST run these diagnostics in sequence BEFORE writing any fix. Report findings for each step.

**Step 1 — Verify the handler is attached.** Find the `onPress` on the Create Trip button in `app/create-trip.tsx`. Report the handler name.

**Step 2 — Add temporary instrumentation.** Add console.log statements:
```typescript
console.log('[CreateTrip] button tapped');
console.log('[CreateTrip] payload', payload);
console.log('[CreateTrip] result', result);
console.log('[CreateTrip] error', err);
```

Tell Ian to tap the button and share the Metro console output.

**Step 3 — Inspect validation.** Check for silent `return` statements on missing fields. The #1 likely cause is a guard clause returning silently when location is unresolved or no players added. Every guard must toast the user — never silent.

**Step 4 — Inspect the service call.** Confirm `tripsService.create(payload)` is invoked with complete data: `name`, `location`, `course_id`, `player_count`, `format`, `side_games`, `stakes`, `players`. A null `course_id` likely fails a DB CHECK constraint.

**Step 5 — Inspect navigation after success.** On success, must call `router.replace('/trip-detail?id=' + result.id)`. Missing = user stuck on form.

### Implementation requirements

Once root cause is known, the handler must match this quality bar (using **existing** ToastContext and Haptics):

```typescript
const handleCreate = async () => {
  // 1. Haptic feedback on tap
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  // 2. Validation with user feedback via existing toast
  if (!name.trim()) {
    toast.show('Trip name is required', { type: 'error' });
    return;
  }
  if (!selectedCourse?.id) {
    toast.show('Select a course for the trip location', { type: 'error' });
    return;
  }
  if (players.length < 2) {
    toast.show('Add at least one other player', { type: 'error' });
    return;
  }

  // 3. Loading state
  setIsCreating(true);

  try {
    // 4. Build payload
    const payload = {
      name: name.trim(),
      location: selectedCourse.name,
      course_id: selectedCourse.id,
      player_count: players.length,
      format,
      side_games: Array.from(sideGames),
      stakes: stakes || null,
      players: players.map(p => ({
        user_id: p.user_id ?? null,
        guest_name: p.user_id ? null : p.name,
        handicap: p.handicap
      })),
    };

    // 5. Service call
    const trip = await tripsService.create(payload);

    // 6. Success feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.show('Trip created', { type: 'success' });

    // 7. Navigate
    router.replace(`/trip-detail?id=${trip.id}`);
  } catch (err) {
    // 8. Error feedback — never silent
    console.error('[CreateTrip] failed', err);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    toast.show(err?.message ?? 'Could not create trip', { type: 'error' });
  } finally {
    setIsCreating(false);
  }
};
```

### Button component requirements

- Show `isCreating` state: disable taps, ActivityIndicator replaces "Create Trip" text, opacity 0.6
- Use existing PrimaryButton or equivalent from `src/components/`
- Augusta green `#006747` fill, gold `#C9A227` text, sharp edges, no border-radius

### Acceptance criteria

- [ ] Diagnostic logs added, root cause documented in commit message
- [ ] Empty name → error toast, no navigation
- [ ] Unresolved course → error toast, no navigation
- [ ] <2 players → error toast, no navigation
- [ ] Valid submission → loading spinner, success toast, navigation to trip detail
- [ ] Network failure → error toast with actual message, button re-enabled
- [ ] Trip row in Supabase has all fields populated
- [ ] trip_members rows inserted for all selected players
- [ ] Light haptic on tap, success haptic on create, error haptic on failure
- [ ] `npx tsc --noEmit` passes

---

## Fix 2 — Location input must resolve to a course_id via autocomplete

### Problem restated
Location field shows static chips unrelated to typed text. No autocomplete, no course_id resolution, downstream scoring bridge breaks.

### Required behavior

As user types, Location field must:

1. **Debounce** 300ms
2. **Search local courses first** via Supabase RPC (fast, free)
3. **Show typeahead dropdown** below input, max 5 visible
4. **Each result shows** course name (Georgia serif), city + state (muted), "+" icon (gold, right-aligned)
5. **Tap to select** — sets resolved course, dismisses dropdown, displays selected state with gold border accent + green checkmark + "×" to clear
6. **No local results** → "Search GolfCourseAPI for '<query>'?" row
7. **GolfCourseAPI returns results** → show in same dropdown style; on select, create courses row with full data (par, slope, rating, tees)
8. **GolfCourseAPI returns nothing** → "Search Google Places for '<query>'?" row (last resort)
9. **Google Places selected** → create courses row with name/city/state/photo_url only, par/slope/rating nullable for backfill later
10. **Light haptic** on each selection

### Component structure

Create `src/components/trip/CourseLocationPicker.tsx`:

```typescript
interface CourseLocationPickerProps {
  value: Course | null;
  onChange: (course: Course | null) => void;
  placeholder?: string;
}
```

Internal state: `query`, `localResults`, `golfApiResults`, `placesResults`, `isSearching`, `fallbackStage` ('local' | 'golfApi' | 'places').

### Supabase RPC for local search

Create migration `supabase/migrations/20260420_course_search.sql`:

```sql
create or replace function public.search_courses(p_query text, p_limit int default 10)
returns table (
  id uuid,
  name text,
  city text,
  state text,
  par int,
  slope int,
  rating decimal,
  photo_url text,
  match_rank int
)
language sql
stable
as $$
  select
    c.id, c.name, c.city, c.state, c.par, c.slope, c.rating, c.photo_url,
    case
      when lower(c.name) = lower(p_query) then 1
      when lower(c.name) like lower(p_query) || '%' then 2
      when lower(c.name) like '%' || lower(p_query) || '%' then 3
      when lower(c.city) like lower(p_query) || '%' then 4
      when lower(c.state) like lower(p_query) || '%' then 5
      else 6
    end as match_rank
  from public.courses c
  where
    lower(c.name) like '%' || lower(p_query) || '%'
    or lower(c.city) like '%' || lower(p_query) || '%'
    or lower(c.state) like '%' || lower(p_query) || '%'
  order by match_rank, c.name
  limit p_limit;
$$;

grant execute on function public.search_courses(text, int) to authenticated, anon;
```

### Service additions

Add a single `search()` method to the existing `src/services/courses.service.ts`:

```typescript
export async function search(query: string, limit = 10): Promise<Course[]> {
  const { data, error } = await supabase.rpc('search_courses', {
    p_query: query.trim(),
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}
```

### Fallback logic — REUSE existing integrations

**Do NOT create new service wrappers for GolfCourseAPI or Google Places.** These services already exist. Read them first to find the exact method names.

Expected flow:
```typescript
// Stage 1: Local search (always first)
const local = await coursesService.search(query);
if (local.length > 0) {
  setResults(local);
  setFallbackStage('local');
  return;
}

// Stage 2: GolfCourseAPI fallback (when user taps the "Search GolfCourseAPI" row)
const golfApi = await golfCourseApiService.search(query); // CONFIRM ACTUAL NAME
if (golfApi.length > 0) {
  setResults(golfApi);
  setFallbackStage('golfApi');
  return;
}

// Stage 3: Google Places (last resort, only if user taps through)
const places = await googlePlacesService.search(query); // CONFIRM ACTUAL NAME
// Display in dropdown
```

On selection from GolfCourseAPI or Google Places, create a `courses` row via `coursesService.ensureCourse()` (existing method — confirm shape).

### Visual design — match Dormie patterns exactly

Dropdown container:
- Background: surface token `#151312`
- Border: 1px `rgba(255,255,255,0.06)`
- Sharp edges (no border-radius)
- Multi-layer shadow for elevation

Each result row:
- 56px height, 16px horizontal padding
- Course name: Georgia serif, 16px, primary text `#E8E4DE`
- Location subtitle: system sans, 13px, muted `#8A857F`
- "+" icon: gold `#C9A227`, 24px, right-aligned
- Spring animation on selection (friction 5)
- Light haptic on selection

Selected state:
- Gold left-border accent (3px, `#C9A227`)
- Green checkmark icon (Augusta green `#006747`)
- Course name in Georgia, city + state subtitle
- "×" icon on right to clear

Fallback rows:
- Slight vertical separation from results
- Gold icon + italicized text: "Search GolfCourseAPI for '<query>'"
- Tap triggers next fallback stage

### Acceptance criteria

- [ ] Typing "hilton" returns local Hilton Head courses
- [ ] Debounce works (no search until 300ms after last keystroke)
- [ ] Local results appear within 500ms
- [ ] No local results → GolfCourseAPI fallback row visible
- [ ] GolfCourseAPI selection creates courses row with par/slope/rating, sets selected
- [ ] GolfCourseAPI empty → Google Places fallback row visible
- [ ] Google Places selection creates courses row (partial data), toasts "Rating and slope will be filled when first played"
- [ ] Selected state: gold border + green checkmark + "×" to clear
- [ ] Haptics + animations match Dormie spec
- [ ] `npx tsc --noEmit` passes

### Where to integrate

- `app/create-trip.tsx` — replace existing Location field with `<CourseLocationPicker>`
- `app/create-trip-planned.tsx` if it exists — same
- Consider reusing in future round-creation flows

---

## Fix 3 — Add Player flow must include friend picker, invite, and guest fallback

### Problem restated
Add Player currently only supports manual entry. Breaks Dormie's social loop. Must include friend picker, recent co-players, invite link, and guest fallback.

### CRITICAL: Extend existing systems, don't duplicate

**Existing systems to reuse, NOT rewrite:**

1. **`src/lib/invite.ts`** — existing friend invite deep link parser. Handles `dormie://invite/[id]` and `dormie.golf/invite/[id]`. Uses AsyncStorage for persistence across signup. The trip invite system must **extend this pattern**, not duplicate it.

2. **`app/_layout.tsx`** — has `useInviteLinkListener()` and `useAutoAcceptInvite()` hooks. The trip invite listener extends the same pattern.

3. **`app.json`** — already has `applinks:dormie.golf` configured. Extend the associated domains / intent filters if needed, don't recreate.

4. **`app/add-friends.tsx`** — existing friend search, "People You May Know" contacts integration, pending requests. Reuse components where possible.

5. **`src/services/friends.service.ts`** — existing `getActiveFriends()` (NOT `getAccepted()`), `sendFriendRequest()`, `acceptFriendRequest()`, `rejectFriendRequest()`. Confirm exact exports.

6. **`React Native Modal` with existing Dormie modal patterns** — do NOT install `@gorhom/bottom-sheet` unless it's already a dependency. Check `package.json` first. If not there, use the existing Modal pattern from DormieMoment or similar.

7. **`Share.share()` system share sheet** — do NOT build separate Copy/SMS/Email buttons. One share button that opens the iOS/Android share sheet.

8. **`ViewShot` + `Sharing.shareAsync()` + `MediaLibrary.saveToLibraryAsync()`** — already shipped in `PostRoundSummary.tsx`. Use the same pattern for a branded invite share card (optional polish).

### Required behavior

Tapping "Add Player" opens a modal with four tabs:

1. **Friends** (default) — existing friends list, multi-select
2. **Recent** — co-players from last 90 days
3. **Invite** — generate shareable trip invite link
4. **Guest** — manual entry for non-users

### Component structure

Create `src/components/trip/AddPlayerSheet.tsx`:

```typescript
interface AddPlayerSheetProps {
  tripId?: string;                 // undefined during create flow, set post-creation
  existingPlayers: Player[];       // already in trip, grayed out
  onAddPlayers: (players: PendingPlayer[]) => void;
  onClose: () => void;
  isVisible: boolean;
}

type PendingPlayer = {
  user_id?: string;
  guest_name?: string;
  handicap: number;
  source: 'friends' | 'recent' | 'guest' | 'invite';
};
```

### Tab 1 — Friends

```typescript
const friends = await friendshipsService.getActiveFriends(); // CONFIRM METHOD NAME
```

- Avatar (use existing avatar component from Dormie — initials/course theme)
- Georgia serif name, 16px
- Handicap subtitle: "8.0 HCP", 13px muted
- Checkbox right-aligned, teal fill when selected
- Existing trip players: opacity 0.4, disabled, "Already in trip" subtitle
- Search bar at top (reuse pattern from add-friends.tsx)
- Empty state: "No friends yet. Invite someone to Dormie →" links to existing add-friends.tsx
- Light haptic on each toggle
- Bottom: "Add X Players" button (Augusta green) when count > 0

### Tab 2 — Recent

Same visual pattern. Data source via new RPC:

```sql
-- Add to supabase/migrations/20260420_course_search.sql (or new file)
create or replace function public.get_recent_co_players(p_user_id uuid, p_days int default 90)
returns table (
  id uuid,
  name text,
  handicap_index decimal,
  avatar_url text,
  last_played_at timestamp,
  rounds_together int
)
language sql
stable
as $$
  with co_rounds as (
    select r.trip_id, r.created_at
    from public.rounds r
    where r.user_id = p_user_id
      and r.created_at > now() - (p_days || ' days')::interval
  ),
  co_users as (
    select distinct r2.user_id, r2.created_at
    from co_rounds cr
    join public.rounds r2 on r2.trip_id = cr.trip_id and r2.user_id <> p_user_id
  )
  select
    u.id, u.name, u.handicap_index, u.avatar_url,
    max(cu.created_at) as last_played_at,
    count(*)::int as rounds_together
  from co_users cu
  join public.users u on u.id = cu.user_id
  group by u.id, u.name, u.handicap_index, u.avatar_url
  order by max(cu.created_at) desc
  limit 20;
$$;

grant execute on function public.get_recent_co_players(uuid, int) to authenticated;
```

Subtitle: "Played X times · Last round Y days ago"

### Tab 3 — Invite

**IMPORTANT:** Extend the existing `dormie://invite/` pattern rather than duplicating it.

Existing pattern uses `dormie://invite/[userId]` for friend invites. Trip invites use a different path segment to disambiguate:

`dormie://trip-invite/[code]` and `https://dormie.app/trip-invite/[code]`

Update `src/lib/invite.ts` to parse both formats:
- `/invite/[id]` → friend invite (existing behavior)
- `/trip-invite/[code]` → new trip invite path

Update `app/_layout.tsx` listener similarly.

Requires migration `supabase/migrations/20260420_trip_invites.sql`:

```sql
create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.users(id),
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone default (now() + interval '7 days'),
  max_uses int default 8,
  times_used int default 0
);

create index idx_trip_invites_code on public.trip_invites(code);

alter table public.trip_invites enable row level security;

create policy "Users can view invites for trips they're in"
  on public.trip_invites for select
  using (
    trip_id in (
      select trip_id from public.trip_members where user_id = auth.uid()
    )
  );

create policy "Users can create invites for their trips"
  on public.trip_invites for insert
  with check (
    trip_id in (
      select trip_id from public.trip_members where user_id = auth.uid()
    )
  );
```

Service method in new `src/services/tripInvites.service.ts`:

```typescript
export async function createInvite(tripId: string): Promise<TripInvite> {
  const code = generateCode(); // 6 char, uppercase, no 0/O/1/I/L
  const userId = (await supabase.auth.getUser()).data.user!.id;
  const { data, error } = await supabase
    .from('trip_invites')
    .insert({ trip_id: tripId, code, created_by: userId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
```

### Invite tab UI

- Large hero block: "DORMIE" brand header + gold trip name
- Code in Georgia 48px (e.g., "ABCDEF")
- URL display: `dormie.app/trip-invite/ABCDEF`
- **Single Share button** — opens system share sheet via `Share.share()`:
  ```typescript
  Share.share({
    message: `Join my trip on Dormie: ${tripName}\n\ndormie.app/trip-invite/${code}`,
    url: `https://dormie.app/trip-invite/${code}`, // iOS-specific
    title: 'Join my Dormie trip'
  });
  ```
- QR code (only if `react-native-qrcode-svg` already installed — check package.json; otherwise skip)
- Footer: "Expires in 7 days · Up to 8 uses"

**Optional polish (ship if time):** Use existing `ViewShot` + `MediaLibrary` pattern from PostRoundSummary.tsx to let users save a branded invite card image (dark card with DORMIE branding, trip name, code, QR). This matches what your crew already does with share cards.

### Deep link handling

Update `src/lib/invite.ts` to handle both patterns:

```typescript
export function parseInviteUrl(url: string): ParsedInvite | null {
  // Friend invite (existing)
  const friendMatch = url.match(/(?:dormie:\/\/|dormie\.app\/|dormie\.golf\/)invite\/([a-z0-9-]+)/i);
  if (friendMatch) return { type: 'friend', id: friendMatch[1] };

  // Trip invite (new)
  const tripMatch = url.match(/(?:dormie:\/\/|dormie\.app\/|dormie\.golf\/)trip-invite\/([A-Z0-9]{6})/i);
  if (tripMatch) return { type: 'trip', code: tripMatch[1] };

  return null;
}
```

Update `useInviteLinkListener` in `app/_layout.tsx` to branch on type:
- `type === 'friend'` → existing friend auto-accept flow
- `type === 'trip'` → route to new `app/trip-invite.tsx`

Create `app/trip-invite.tsx`:
1. Look up trip_invites by code
2. Show trip preview (name, location, current members, creator)
3. "Join Trip" CTA calls `tripsService.joinViaInvite(code)`
4. On success: increments `times_used`, creates `trip_members` row, navigates to `/trip-detail?id=<trip_id>`
5. Handle expired / over-used codes with error toasts

### Tab 4 — Guest

Simple form:
- Name input (required)
- Handicap input (0-54, decimal allowed)
- Add button

```typescript
onAddPlayers([{
  guest_name: name.trim(),
  handicap: parseFloat(hcp),
  source: 'guest',
}]);
```

Guest players do NOT create `users` rows. They're `trip_members` rows with `user_id: null`, `guest_name: populated`. Requires schema migration:

```sql
-- supabase/migrations/20260420_trip_members_guest.sql
alter table public.trip_members
  alter column user_id drop not null,
  add column if not exists guest_name text,
  add constraint trip_members_user_or_guest
    check ((user_id is not null) or (guest_name is not null));
```

### Visual design — match Dormie modal patterns

- Use React Native `Modal` with `presentationStyle="pageSheet"` (iOS native sheet feel)
- Reference the existing Dormie modal pattern (check `DormieMoment.tsx` or scoring modals)
- Dark surface background
- Sharp edges throughout
- Gold accent on primary action (Add X Players button)
- Light haptic on open, spring animation (friction 5)
- Tab bar at top: sharp edges, teal active underline, muted inactive

### Acceptance criteria

- [ ] Sheet opens with spring animation, light haptic
- [ ] Friends tab loads real friends via existing `friends.service.ts`
- [ ] Existing trip players grayed out with "Already in trip" label
- [ ] Multi-select works with running count
- [ ] Recent tab shows co-players from last 90 days with "played X times" subtitle
- [ ] Invite tab generates 6-char code, creates trip_invites row
- [ ] Share button opens system share sheet via `Share.share()` (no custom Copy/SMS/Email buttons)
- [ ] Guest tab adds player with null user_id + populated guest_name
- [ ] Deep link `dormie://trip-invite/XXXXXX` opens trip join screen
- [ ] Friend invite deep link (`dormie://invite/XXX`) still works (no regression)
- [ ] Joining via invite creates trip_members row and increments times_used
- [ ] Expired codes show "This invite has expired" toast
- [ ] Over-used codes show "This invite has reached its limit" toast
- [ ] Sheet dismisses with light haptic
- [ ] During create flow (no tripId): Invite tab shows "Create the trip first to generate an invite link"
- [ ] `npx tsc --noEmit` passes

### Where to integrate

Replace Add Player button in `app/create-trip.tsx`:

```typescript
const [sheetVisible, setSheetVisible] = useState(false);

<Pressable onPress={() => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  setSheetVisible(true);
}}>
  <AddPlayerButton />
</Pressable>

<AddPlayerSheet
  isVisible={sheetVisible}
  tripId={undefined}  // undefined during create flow
  existingPlayers={players}
  onAddPlayers={(newPlayers) => {
    setPlayers([...players, ...newPlayers]);
    setSheetVisible(false);
  }}
  onClose={() => setSheetVisible(false)}
/>
```

Also accessible from trip-detail screen with `tripId` set — unlocks Invite tab.

---

## Implementation Order

Claude Code must execute in this order, committing each as a separate commit:

**Phase 1 — Schema migrations.**
- `supabase/migrations/20260420_course_search.sql` (search_courses + get_recent_co_players RPCs)
- `supabase/migrations/20260420_trip_invites.sql` (trip_invites table + RLS)
- `supabase/migrations/20260420_trip_members_guest.sql` (guest_name column)

Ian will apply these via Supabase SQL Editor (same pattern as the trip_leaderboard migration). Commit each migration as a separate commit with clear subject line.

**Phase 2 — Fix 1 (Create Trip button).**
Smallest scope. Gets primary flow working. Establishes error-surfacing pattern the rest will reuse.

**Phase 3 — Fix 2 (CourseLocationPicker).**
New component. Unblocks downstream. Reuses existing GolfCourseAPI and Google Places services.

**Phase 4 — Fix 3 Part A (AddPlayerSheet Friends + Recent + Guest tabs).**
Core sheet + three of four tabs. Uses existing friends.service.ts.

**Phase 5 — Fix 3 Part B (Invite tab + deep link extension).**
Extends existing `src/lib/invite.ts` and `app/_layout.tsx` pattern. Creates `app/trip-invite.tsx`.

**Phase 6 — Integration + regression.**
Wire all three fixes into `app/create-trip.tsx`. Run `npx tsc --noEmit`. Manually verify friend invite deep links still work (no regression). Push.

---

## Commit Message Template

```
[Phase X of 6] Brief description

What changed:
- File-level bullet list

Why:
- Reference to docs/trips-p0-spec-v2-2026-04-19.md and trips-frontend-audit

How it integrates with existing systems:
- [e.g., "Extends src/lib/invite.ts parseInviteUrl() to handle trip-invite path"]

Testing:
- What was verified
```

---

## Definition of Done

- All 3 P0s resolved per acceptance criteria
- Schema migrations applied to Supabase and verified
- `npx tsc --noEmit` passes
- Ian manually walks through Create Trip end-to-end on device with a real course, friend-picker players, side games, stakes, and successfully creates a trip
- Trip appears in Trips tab, trip detail screen, all data populated
- Friend invite deep link regression: tap a friend invite URL, still auto-accepts as before
- Trip invite deep link: tap a trip invite URL, opens trip join screen
- No silent catches anywhere
- All new components match Dormie design tokens exactly
- No new dependencies installed (or clear justification in commit message if one was required)

---

## Hand-Off Prompt for Claude Code

Paste this into Claude Code after committing the spec to the repo:

```
Read docs/trips-p0-spec-v2-2026-04-19.md carefully. Also read the 13 critical files listed in the "CRITICAL: Read Before Writing Any Code" section to understand existing systems — especially src/lib/invite.ts, app/_layout.tsx, src/services/friends.service.ts, src/services/courses.service.ts, and any existing GolfCourseAPI / Google Places service.

Before writing any code:
1. Confirm the actual exports and method names of the existing services
2. Confirm whether @gorhom/bottom-sheet and react-native-qrcode-svg are in package.json
3. Summarize the 6 implementation phases in your own words
4. Flag any discrepancies between the spec's assumptions and the actual code

Wait for my go-ahead before writing any code.
```

This pattern forces Claude Code to validate assumptions before acting, which prevents the most common failure mode of this kind of work — building on assumed code that doesn't match reality.

---

*End of v2 spec. This version corrects the Google-Places-first bug from v1 and explicitly references every existing Dormie system the fixes must extend rather than duplicate.*
