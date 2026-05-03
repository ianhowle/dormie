# Trips Real-Data Wiring Spec — Complete Operational Trips Feature

**Date:** 2026-05-03
**Session goal:** Ship Trips as a fully operational feature, end-to-end. By session end, Ian can create a trip, see it in the Trips list, open it to a fully real trip-detail screen, generate invite codes/links, have someone join via invite, and reach the scoring bridge.
**Estimated time:** 4-6 hours of focused work
**Approach:** Four phases, separate commits per phase, validated incrementally.

---

## Context — What's Already Done

Last night we shipped end-to-end trip creation. The full pipeline works:

- ✅ Four Supabase migrations applied: `search_courses` RPC, `trip_invites` table + RLS + `join_trip_by_invite` RPC, `trip_members` guest support, `get_recent_co_players` RPC
- ✅ Create Trip button: 6 bug fixes, dynamic labels, gold disabled border, proper validation toasts
- ✅ CourseLocationPicker: 3-tier autocomplete (Supabase → GolfCourseAPI → Google Places), explicit user-triggered fallbacks, no FlatList warning
- ✅ AddPlayerSheet: Friends/Recent/Invite/Guest tabs, fire-and-forget Guest add, multi-select for Friends/Recent
- ✅ Database fixes: trips_select RLS policy now allows organizers to see their own trips (was rejecting RETURNING clause), role check constraint extended to allow 'player'
- ✅ Navigation: param key alignment between create-trip → trip-detail (accepts both `id` and `tripId`)
- ✅ trip-detail header renders REAL data: name, location, dates, derived invite code

**What's still mock content (this spec's primary work):**

- The Trips list at `app/(tabs)/trips.tsx` shows hardcoded MOCK_UPCOMING_TRIPS / MOCK_COMPLETED_TRIPS even though `realTrips` is fetched
- The trip-detail screen body (everything below the header): Players, Chat, Trip Tools, Trip Moments, Head to Head, Trip Info counts
- Demo mode never auto-disables when user creates a real trip

---

## CRITICAL: Read Before Writing Any Code

Claude Code MUST read these files first to ground work in actual codebase shape:

1. `app/(tabs)/trips.tsx` — full file, especially lines 440-540 where realTrips is fetched but not rendered
2. `app/trip-detail.tsx` — focus on lines 2200-2470 for the screen entry, hooks, and early returns
3. `src/services/trips.service.ts` — confirm exports: `getByUser(userId)`, `getMembers(tripId)`, `getById(tripId)`, etc.
4. `src/contexts/DemoModeContext.tsx` — `checkAndDisable()` function, current data checks (rounds, group_members, friendships — needs trips added)
5. `src/data/trips.ts` — MOCK_UPCOMING_TRIPS, MOCK_COMPLETED_TRIPS, the shape TripCard expects
6. `src/components/TripCard.tsx` (or wherever TripCard lives) — what props/shape it takes
7. `src/services/tripInvites.service.ts` — confirm `createInvite()`, `joinByInvite()` exports
8. `app/trip-invite.tsx` — the invite landing screen
9. Any avatar component — for rendering player avatars consistently

**If anything in this spec doesn't match actual code, adjust accordingly. Don't invent.**

---

## Guiding Principles

1. **Real data when present, mocks only as empty-state peek.** When `realTrips.length > 0`, render real trips. Only fall back to mocks when `realTrips.length === 0 && demoMode === true`.
2. **Empty states matter.** Every section that can be empty (Trip Moments, Head to Head, Players list when small, Chat) needs a designed empty state with clear copy and (where appropriate) a CTA.
3. **No silent catches.** Every async operation has try/catch with user-facing toast on error.
4. **No new dependencies.** Use what's already installed.
5. **Match Dormie design tokens exactly:** bg `#0D0A06`, surface `#151312`, elevated `#1A1816`, Augusta green `#006747`, gold `#C9A227`, Georgia serif for headings/numbers, sharp edges (no border-radius), light haptics on interactive elements.
6. **TypeScript strict.** `npx tsc --noEmit` must pass after every commit.

---

## Phase 1 — Wire Trips List to Real Data

**Estimated time:** 60-90 min
**File:** `app/(tabs)/trips.tsx`

### Current state

Lines 450-454 fetch real trips:
```typescript
useEffect(() => {
  if (!user) return;
  tripsService.getByUser(user.id).then(setRealTrips).catch(() => {});
}, [user]);
```

But `realTrips` is only used as a length check (`realTrips.length === 0`, etc.) at lines 487, 493, 496, 501, 504, 510, 524, 535, 543. The actual list renderers at lines 517 and 528 always iterate over `MOCK_UPCOMING_TRIPS` and `MOCK_COMPLETED_TRIPS`.

### Required behavior

The screen renders this priority:
1. If `realTrips.length > 0` → render real trips (split into upcoming and completed by status/date)
2. Else if `demoMode === true` → render mock trips as preview (current behavior, kept for new users)
3. Else → render `<TripsEmpty />` (the existing empty-state component)

### Implementation steps

**Step 1: Adapter function.** Real trips come from Supabase as `TripWithMembers` (or whatever the actual return type of `getByUser` is). Mock trips have a different shape that `TripCard` expects (gradient colors, player avatars, days-until count). Create an adapter:

```typescript
// In app/(tabs)/trips.tsx or a new src/lib/tripAdapters.ts
function adaptSupabaseTrip(trip: TripWithMembers): TripCardData {
  // Map Supabase fields to TripCard props
  // Be defensive: handle missing fields, null members, etc.
  return {
    id: trip.id,
    name: trip.name,
    location: trip.location,
    startDate: trip.start_date,
    endDate: trip.end_date,
    status: deriveTripStatus(trip), // 'upcoming' | 'live' | 'completed'
    members: trip.members.map(m => ({
      avatar: m.user_id ? userAvatarFor(m) : guestAvatarFor(m),
      name: m.user_id ? m.user.name : m.guest_name,
    })),
    daysUntil: computeDaysUntil(trip.start_date),
    // Gradient colors: derive from trip name hash or use a default Dormie gradient
    gradientColors: deriveGradientColors(trip.name),
    isRyderCup: trip.trip_type === 'ryder_cup',
  };
}
```

**Step 2: Split real trips by status.** Upcoming = trips where `end_date >= today` OR `status !== 'completed'`. Completed = trips where `end_date < today` OR `status === 'completed'`. The exact field/logic depends on what `trips.status` values exist — confirm against the schema.

**Step 3: Replace the mock map calls.** At line 517 (Upcoming section) and line 528 (Completed section):

```typescript
// BEFORE:
{(realTrips.length > 0 || showDemoData) && MOCK_UPCOMING_TRIPS.length > 0 && (
  ...
  {MOCK_UPCOMING_TRIPS.map((trip) => (
    <TripCard key={trip.id} trip={trip} showDays />
  ))}
)}

// AFTER:
{realTrips.length > 0 ? (
  // Real upcoming trips
  upcomingRealTrips.length > 0 && (
    <Section title="UPCOMING">
      {upcomingRealTrips.map((trip) => (
        <TripCard key={trip.id} trip={adaptSupabaseTrip(trip)} showDays />
      ))}
    </Section>
  )
) : showDemoData ? (
  // Demo peek
  <Section title="UPCOMING" footer={<DemoBanner />}>
    {MOCK_UPCOMING_TRIPS.map((trip) => (
      <TripCard key={trip.id} trip={trip} showDays />
    ))}
  </Section>
) : (
  // Truly empty
  <TripsEmpty />
)}
```

Apply same pattern to Completed section.

**Step 4: Pull-to-refresh.** Existing pull-to-refresh at lines 456-471 already calls `tripsService.getByUser(user.id)`. Keep as-is. Maybe add a toast on success ("Trips updated") and on error ("Couldn't refresh trips").

**Step 5: Update DemoModeContext.checkAndDisable().** File: `src/contexts/DemoModeContext.tsx`. The function currently checks rounds, group_members, friendships. Add a check for trips:

```typescript
async function checkAndDisable(userId: string) {
  const [rounds, groupMembers, friendships, trips] = await Promise.all([
    supabase.from('rounds').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('group_members').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('friendships').select('id', { count: 'exact', head: true }).or(`user_id.eq.${userId},friend_id.eq.${userId}`),
    supabase.from('trip_members').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  const hasRealData = (rounds.count ?? 0) > 0 || (groupMembers.count ?? 0) > 0 || (friendships.count ?? 0) > 0 || (trips.count ?? 0) > 0;

  if (hasRealData) {
    await setDemoMode(false);
  }
}
```

Then call `checkAndDisable(user.id)` from `app/(tabs)/trips.tsx` after `getByUser` returns successfully:

```typescript
useEffect(() => {
  if (!user) return;
  tripsService.getByUser(user.id).then(trips => {
    setRealTrips(trips);
    if (trips.length > 0) {
      checkAndDisable(user.id); // auto-disable demo mode
    }
  }).catch(() => {});
}, [user]);
```

### Acceptance criteria

- [ ] User with at least one real trip sees their real trip(s) in the Trips list, NOT mock trips
- [ ] User with zero real trips and demo mode ON sees mock trips as preview with DemoBanner
- [ ] User with zero real trips and demo mode OFF sees TripsEmpty component
- [ ] Real trip card shows correct name, location, dates, days-until count, player avatars
- [ ] Tapping a real trip navigates to `/trip-detail?tripId=<id>` and loads the real trip
- [ ] Pull-to-refresh fetches latest trips and updates state
- [ ] Demo mode auto-disables when user has trips (or rounds/groups/friendships)
- [ ] No regression: tapping a demo trip still works for users in demo mode
- [ ] `npx tsc --noEmit` passes

### Commit message

```
[Trips Phase 1] Wire Trips list to real data with demo peek fallback

What changed:
- app/(tabs)/trips.tsx now renders realTrips when populated
- Mock trips kept as empty-state peek when demo mode is on
- DemoModeContext.checkAndDisable() extended to include trips
- New adapter function maps Supabase TripWithMembers to TripCard shape

Why:
- Reference docs/trips-real-data-wiring-spec-2026-05-03.md Phase 1
- Closes the bug where real trips were fetched but never rendered

Testing:
- Created a real trip, confirmed it appears in Trips list
- Verified mock trips still appear when demo mode is on with no real trips
- Confirmed demo mode auto-disables after first real trip is created
```

---

## Phase 2 — Wire Trip Detail Real Data

**Estimated time:** 90-120 min
**File:** `app/trip-detail.tsx`

This is the biggest phase. The header renders real data already. Now wire the body sections.

### Section A — Players list (HIGH PRIORITY)

Currently uses MOCK_PLAYERS (line 58-62). Render real members from `tripsService.getMembers(trip.id)`.

```typescript
const [members, setMembers] = useState<TripMember[]>([]);

useEffect(() => {
  if (!trip?.id) return;
  tripsService.getMembers(trip.id).then(setMembers).catch(err => {
    console.error('Failed to load members', err);
    showToast({ message: 'Could not load players', type: 'error' });
  });
}, [trip?.id]);
```

Replace MOCK_PLAYERS references at lines 364, 662, 2444, 2450, 2453, 2554, 2649 with `members`.

**Member rendering:**
- Real users: show user.name (or initials), avatar from `users.profile_photo_url` OR generated avatar based on `users.avatar_mode`/`avatar_theme`/`avatar_color`
- Guests: show `guest_name`, generic guest avatar with "G" or first letter
- Show role badge: "Organizer" gold tag for role === 'organizer', no badge for 'player'
- Handicap: show as "8.0 HCP" subtitle if `handicap_index` is set

**Empty state:** If members.length === 1 (just organizer), show "No other players yet. Add friends or generate an invite link to grow your trip."

### Section B — Trip Info counts (HIGH PRIORITY)

Currently shows hardcoded "SP / 3 / 4 / 4" for Format/Rounds/Games/Players.

Replace with derived values:

```typescript
const formatLabel = formatLabelFor(trip.format); // e.g. 'stroke_play' -> 'SP'
const roundsCount = trip.courses?.length ?? 0; // count from trip_courses
const gamesCount = (trip.side_games as string[])?.length ?? 0;
const playersCount = members.length;
```

Consider: rounds and side games might need a fallback display ("0" or "—" if not set yet). Keep the visual layout identical — just swap the values.

### Section C — Invite Code section (MEDIUM PRIORITY)

The trip's permanent `invite_code` from Supabase is already mapped through `dbTrip.inviteCode` (per the diagnosis in earlier work). Confirm it displays correctly:

- Real trips: show actual invite_code from trips table (e.g. "ABCDEF" — 6-char auto-generated)
- The "DORMIE-HER-2026" we saw on the test screen is the OLD formatInviteCode behavior — should now use real code

If the display is still using `formatInviteCode(trip.name)` → fix to use `trip.inviteCode` directly.

Also wire the **Copy** button to actually copy the code:

```typescript
import * as Clipboard from 'expo-clipboard';

const handleCopyCode = async () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  await Clipboard.setStringAsync(trip.inviteCode);
  showToast({ message: 'Invite code copied', type: 'success' });
};
```

### Section D — Trip Moments (LOW PRIORITY — empty state only)

Currently uses MOCK_MOMENTS. Real moments are user-generated, and we don't have a moment-creation flow yet.

For tomorrow: render an empty state for new trips:

```typescript
{moments.length === 0 ? (
  <EmptyState
    icon="✨"
    title="No moments yet"
    body="Capture hole-in-ones, epic shots, and trip-defining stories as they happen."
    cta="Add Moment"
    onCtaPress={() => showToast({ message: 'Moment creation coming soon', type: 'info' })}
  />
) : (
  // Future: render real moments
  ...
)}
```

For now, treat `moments` as always empty `[]`. Don't fetch yet. The empty state with disabled "Add Moment" CTA is the deliverable.

### Section E — Head to Head (LOW PRIORITY — empty state only)

Same approach. New trips have no scoring history. Render:

```typescript
<EmptyState
  icon="⚔️"
  title="No head-to-head yet"
  body="Once rounds are scored, head-to-head matchups will appear here."
/>
```

### Section F — Chat (per Ian's choice: empty state only)

Replace MOCK_CHAT with empty state. New trips have no messages.

```typescript
<View style={styles.chatEmptyState}>
  <Icon name="message-circle" size={48} color={c.muted} />
  <Text style={styles.emptyTitle}>No messages yet</Text>
  <Text style={styles.emptyBody}>Trip chat is coming soon. Stay tuned.</Text>
  {/* Disabled-looking input below */}
  <View style={styles.disabledInputContainer}>
    <TextInput
      placeholder="Chat coming soon..."
      placeholderTextColor={c.tertiary}
      editable={false}
      style={styles.disabledInput}
    />
  </View>
</View>
```

The "Live" indicator and message bubbles should NOT render at all when chat is empty/disabled. Just the empty state.

### Section G — Trip Tools panel (per Ian's choice: leave visible, "Coming soon" toast)

The 6 tool tiles (Budget, Packing List, Tee Groups, RSVP Preview, Trip Awards, Weather) stay visually identical. Each tile's onPress shows a toast:

```typescript
const handleToolPress = (toolName: string) => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  showToast({ message: `${toolName} coming soon`, type: 'info' });
};
```

DO NOT navigate anywhere. Just the toast.

### Section H — Courses tab (within trip-detail) (MEDIUM PRIORITY)

The Courses tab currently shows MOCK_COURSES. Real courses come from `tripsService.getCourses(tripId)`:

```typescript
const [courses, setCourses] = useState<Course[]>([]);

useEffect(() => {
  if (!trip?.id) return;
  tripsService.getCourses(trip.id).then(setCourses).catch(() => {});
}, [trip?.id]);
```

For a brand-new trip created via Quick Trip with one course, courses.length === 1. Render the single course card with real data.

If courses.length === 0 (shouldn't happen for Quick Trip but possible for other trip types), show empty state with "Add a course" CTA.

### Section I — Checklist tab (LOW PRIORITY)

Currently uses MOCK_CHECKLIST (line 190). For new trips, render empty state with a CTA to add checklist items. Defer the checklist creation flow — show "Checklist coming soon" toast on CTA tap, similar to Trip Tools.

Alternatively if there's a pre-defined default checklist (clubs, balls, tees, ball markers, etc.), render it in a read-only state with checkboxes that don't persist. Simpler: just empty state.

### Section J — 19th Hole tab (LEAVE AS-IS)

This tab is a separate aspirational feature (post-round bar/restaurant chat). Leave whatever it currently shows. Same rationale as Trip Tools — telegraphs future feature, doesn't need wiring tonight.

### Acceptance criteria for Phase 2

- [ ] Players list shows real members from Supabase (organizer + any others added during creation)
- [ ] Real player names, handicaps, avatars (or initial-style fallback)
- [ ] Guest players show as guest_name with "Guest" indicator
- [ ] Trip Info counts (Format, Rounds, Games, Players) show real values
- [ ] Invite Code shows the trip's real `invite_code` from Supabase
- [ ] Copy button copies invite_code to clipboard with success toast
- [ ] Trip Moments shows empty state (not Drew's bunker shot)
- [ ] Head to Head shows empty state (not Drew/Jake/Tommy stats)
- [ ] Chat shows empty state with disabled input (no Tommy/Ian/Drew mock messages)
- [ ] Trip Tools tiles tappable with "coming soon" toast
- [ ] Courses tab shows the real course(s) added to the trip
- [ ] No mock data renders for any new real trip
- [ ] `npx tsc --noEmit` passes

### Commit message

```
[Trips Phase 2] Wire trip-detail body to real data with empty states

What changed:
- Players list: real members from tripsService.getMembers
- Trip Info counts: derived from real trip and member data
- Invite Code: uses trips.invite_code from Supabase, Copy button works
- Trip Moments: empty state with disabled "Add Moment" CTA
- Head to Head: empty state, no mock player stats
- Chat: empty state, disabled input ("Chat coming soon")
- Trip Tools: tappable tiles show "coming soon" toast
- Courses tab: real courses from tripsService.getCourses

Why:
- Reference docs/trips-real-data-wiring-spec-2026-05-03.md Phase 2
- Eliminates mock data rendering on real trips

Testing:
- Created real trip, confirmed all sections show real or empty-state data
- No mock content (Drew/Jake/Tommy) appears on real trips
```

---

## Phase 3 — Test Full Social Loop

**Estimated time:** 45 min
**No code changes if everything works. Bug fixes only as surfaced.**

### Test sequence

**Test 1 — Permanent invite code flow:**
1. Create a fresh trip on your phone (e.g. "Phase 3 Test")
2. Open the trip detail
3. Locate the trip's permanent invite_code (the 6-char code from `trips.invite_code`, e.g. "ABCDEF")
4. From a different device (or the simulator with a different test account), open the app
5. Use the existing "Join by Code" flow (search for it — likely in the Trips tab or a + menu)
6. Enter the invite_code
7. Confirm: the second device joins the trip, sees it in their Trips list, can open trip-detail and see themselves listed as a member

**Test 2 — Expiring share link flow:**
1. On the original phone, open the trip detail
2. Open Add Player → Invite tab
3. Tap "Generate Share Link" — confirm a 6-char code appears (e.g. "XYZABC", different from the permanent one)
4. Tap Share — system share sheet opens with the link `dormie://trip-invite/XYZABC`
5. From the second device, simulate tapping the link (or copy/paste the URL into the app's URL handler)
6. Confirm: trip-invite landing screen appears with trip preview
7. Tap "Join Trip"
8. Confirm: navigates to trip-detail, second device is now a member, `trip_invites.times_used` incremented in Supabase

**Test 3 — Edge cases:**
- Try to join with an expired invite (manually update `trip_invites.expires_at` to past date in Supabase) — should toast "This invite has expired"
- Try to join with a maxed-out invite (set `times_used` = `max_uses`) — should toast "This invite has reached its limit"
- Try to join a trip you're already a member of — should silently navigate to trip-detail without erroring

### Bug-fix-only mode

If any test fails, log the issue with the same diagnostic precision we used last night (console.log payload, check Supabase, isolate the root cause). Apply minimal targeted fix. Commit with message `[Trips Phase 3] Fix [specific issue] surfaced during invite flow testing`.

If all tests pass, no commit needed for Phase 3.

---

## Phase 4 — Polish + Close

**Estimated time:** 30-60 min
**Scope:** Whatever surfaces during testing.

### Likely candidates

1. **Empty state copy** — read each empty state aloud, make sure copy is warm and on-brand. Dormie's voice is confident, simple, and golf-specific. Avoid generic SaaS empty-state language.

2. **Toast wording** — error messages and success toasts should be clear and warm. "Couldn't refresh trips" is better than "Error fetching trips."

3. **Loading states** — every async operation should show a skeleton or spinner. Players list loading: skeleton row with shimmer. Members loading: small inline spinner.

4. **Edge case: trip with zero members** — shouldn't be possible (organizer auto-added by trigger), but if it happens, render gracefully.

5. **Edge case: organizer leaves** — what happens to the trip? Out of scope tonight, but flag if it surfaces.

6. **Visual polish** — gradient colors on real trip cards (mock trips have hand-tuned gradients; real trips need a derivation function). Could use a hash of trip name → gradient palette.

### Commit message (if changes)

```
[Trips Phase 4] Polish empty states, loading states, and edge case handling

What changed:
- [list specific changes]

Why:
- Reference docs/trips-real-data-wiring-spec-2026-05-03.md Phase 4

Testing:
- [list verifications]
```

---

## Implementation Order

Claude Code executes phases in this exact order:

1. **Phase 1** (Trips list) — smallest scope, builds momentum, validates adapter pattern
2. **Phase 2** (trip-detail body) — biggest scope, but the adapter pattern from Phase 1 carries forward
3. **Phase 3** (testing) — no code unless bugs surface
4. **Phase 4** (polish) — only what's needed

Commit after each phase. Push at end of each phase or at end of session.

---

## Definition of Done — End of Session

- [ ] Trips list renders real trips, mocks only as empty-state peek
- [ ] Demo mode auto-disables when user has any real data (rounds/groups/friendships/trips)
- [ ] Trip detail screen renders entirely real or empty-state data — zero mock content
- [ ] Permanent invite code flow works end-to-end (create → share → second user joins)
- [ ] Expiring share link flow works end-to-end (generate → share → second user joins)
- [ ] Trip Tools tiles show "coming soon" toast (not navigate to broken screens)
- [ ] Chat shows empty state with disabled input
- [ ] All empty states have warm, on-brand copy
- [ ] `npx tsc --noEmit` passes
- [ ] All commits pushed to remote
- [ ] Trips feature is FULLY OPERATIONAL — Ian could invite Kara to a real trip tomorrow and she could join it

---

## Hand-Off Prompt for Claude Code

Paste this into Claude Code at the start of tomorrow's session (after `cd ~/dormie && claude`):

```
Read docs/trips-real-data-wiring-spec-2026-05-03.md carefully. This is a four-phase plan to ship the Trips feature as fully operational by end of session.

Last night we shipped end-to-end trip creation. Tonight's work is wiring real data through the Trips list and trip-detail body, then testing the full social loop (invite → join).

Before starting:
1. Read the 9 critical files listed in the spec
2. Confirm the actual exports and shapes (TripWithMembers, TripCard props, etc.)
3. Summarize the 4 phases in your own words
4. Flag any spec assumptions that don't match the codebase

Then implement Phase 1 first. Commit and report. Wait for Ian's go-ahead before starting Phase 2.

Each phase commits separately. Push at end of each phase.

The full Definition of Done is in the spec. The goal is: by end of session, Ian can invite Kara to a real trip and she can join it.
```

That hand-off prompt forces Claude Code to validate the spec before acting, which is the pattern that made last night's six-phase implementation work cleanly.

---

*End of spec. Ready for tomorrow morning.*
