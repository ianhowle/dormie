# Trips Visual Polish — Member Avatars + Live Trip Indicator

**Date created:** 2026-05-03
**Phase reference:** Items 4 + 9 from `docs/trips-product-vision-2026-05-03.md`
**Estimated time:** 60-90 minutes focused work
**Goal:** Make trip cards feel more like a product and less like a list of metadata. Add member avatars stacked on each card so users can scan visually. Add distinct visual treatment for trips currently in progress (Live Trip state).

---

## Strategic Context

Reference `docs/trips-product-vision-2026-05-03.md` and `docs/dormie-strategy.md` for full context.

The Trips list is the entry point to the most-used feature in the app. Today the trip cards show name, location, round count, and a days-until indicator. That's metadata. What's missing is the social signal (who's going) and the temporal urgency (this is happening RIGHT NOW). These are the two highest-leverage visual upgrades we can make to the Trips list with minimal scope.

**Why these two together:**

Both touch the trip card component. Doing them in one session means one careful design pass on the card rather than two. They share an underlying need: helping users instantly answer "what is this trip?" at a glance.

---

## CRITICAL: Read Before Writing Any Code

Claude Code MUST read these files first to ground the work in actual codebase shape:

1. `app/(tabs)/trips.tsx` — confirm where TripCard renders, the adaptSupabaseTrip function, the rendering branches for upcoming/completed sections
2. `src/components/trip/TripCard.tsx` (or wherever TripCard lives — search if not at this path) — current props, layout, and styling
3. `src/services/trips.service.ts` — confirm getByUser returns members on each trip; if not, we need to fetch them
4. `src/components/Avatar.tsx` (or however avatars are currently rendered) — reuse existing avatar component, don't invent
5. Any existing TripStatus enum or status field — search for "live", "in_progress", "active" in codebase
6. `docs/trips-product-vision-2026-05-03.md` for full vision context

If anything in this spec doesn't match actual code, adjust accordingly.

---

## Item 4 — Member Avatars on Trip Cards

### Current state

Trip cards show small dot indicators ("1 2 4 6" colored dots) representing player count, but not WHO. With multiple trips and shared groups, users can't tell at a glance which trip had Drew vs which had Tommy.

### Required behavior

Replace (or supplement) the dot indicators with stacked avatar circles. Specifically:

- Show up to **4 visible avatars** in a horizontal stack
- If trip has 5+ members, show the first 4 avatars plus a "+N" overflow indicator
- Avatars use existing avatar component (initials + color, or photo if user has profile_photo_url)
- Stack with overlap (each avatar offset right by ~70% of avatar width, creating the cascading look)
- Border around each avatar matches card background color so they pop visually
- Size: small enough to fit on card without crowding (24-28px diameter recommended)

### Visual placement

Bottom-left of the trip card, replacing or supplementing the current dot indicators. Reference the position of the colored dots in the current screenshots. Keep the days-until ring on the right unchanged.

### Implementation steps

**Step 1.** In `app/(tabs)/trips.tsx`, the `adaptSupabaseTrip` function already passes through `members` data. Confirm that members array is populated with user info (name, profile_photo_url, avatar_color, etc.). If members aren't included in `getByUser`, update the service to join trip_members + users in the query.

**Step 2.** In `TripCard.tsx`, accept `members` prop (array of member objects with avatar metadata).

**Step 3.** Render the stacked avatar component:

```tsx
{members.length > 0 && (
  <View style={styles.avatarStack}>
    {members.slice(0, 4).map((member, idx) => (
      <View key={member.id} style={[styles.avatarWrapper, { zIndex: 4 - idx, marginLeft: idx === 0 ? 0 : -8 }]}>
        <Avatar member={member} size={26} />
      </View>
    ))}
    {members.length > 4 && (
      <View style={[styles.avatarOverflow, { marginLeft: -8 }]}>
        <Text style={styles.avatarOverflowText}>+{members.length - 4}</Text>
      </View>
    )}
  </View>
)}
```

**Step 4.** Style the overflow indicator to match Dormie design tokens — surface bg, primary text, same dimensions as avatars, sharp edges.

**Step 5.** Decide what to do with the existing colored dots. Either remove (cleaner, more space for avatars) or keep them above/below the avatar stack. My recommendation: remove. The dots were a placeholder for what we're now doing properly. Cleaner visual hierarchy results.

### Acceptance criteria

- [ ] Trip cards show member avatars in a horizontal stacked row
- [ ] Up to 4 avatars visible, plus overflow count if more
- [ ] Avatars use existing avatar component with consistent styling
- [ ] Real users show their initials/photo, guests show their guest_name initial
- [ ] Cards with 1 member show 1 avatar (no overflow), cards with 8 members show 4 + "+4"
- [ ] Removing the old colored dot indicators (recommended) doesn't break layout
- [ ] Demo trips also show avatars (mock data should already include member info)
- [ ] Visually balanced — avatars don't crowd the days-until ring on the right

### Edge cases

- **Trip with only the organizer (1 member):** show 1 avatar, no overflow indicator
- **Trip with only guests (no real users):** show guest avatars correctly
- **Trip with very long names:** avatar stack should wrap or truncate gracefully
- **Real trip with no member fetch yet (loading):** show skeleton avatars matching the existing skeleton pattern from previous polish work

---

## Item 9 — Live Trip Indicator

### Current state

A trip happening today (start_date = today, end_date = today or future) shows the same visual treatment as a trip happening 6 months from now. Both show "0 days" or some days count, both render with the same card style, both feel equally important. The app doesn't acknowledge that the active trip is the most critical context.

### Required behavior

When a trip is currently in progress (i.e., `start_date <= today <= end_date`), surface it with distinct visual treatment:

- **A "LIVE" badge** in the top-right corner of the card (not the days-until ring) — pulsing animation, Augusta green or a custom live-state red/teal color
- **The card gets a subtle glow or border accent** to differentiate from scheduled-but-not-started trips
- **The "0 days" indicator changes** to "LIVE" or "Day 2 of 4" depending on multi-day trip context
- **A persistent banner at the top of the Trips tab** when ANY trip is currently live, showing "Final Test is happening now — tap to open" or similar
- **Sort order: live trips appear at the top of the UPCOMING section**, above future trips

### Visual placement

The LIVE badge replaces the days-until ring (or sits where the ring was) for live trips. The persistent banner sits between the Trips header and the Stats card on the Trips landing page.

### Implementation steps

**Step 1.** Add a derived `isLive` field to `adaptSupabaseTrip`:

```typescript
const today = new Date();
const startDate = new Date(trip.start_date);
const endDate = new Date(trip.end_date || trip.start_date);
const isLive = startDate <= today && today <= endDate && trip.status !== 'completed';
```

**Step 2.** In the sort/split logic for `upcomingRealTrips` vs `completedRealTrips`, ensure live trips are included in upcoming, AND sort live trips first within upcoming:

```typescript
const upcomingRealTrips = trips.filter(t => /* upcoming logic */);
upcomingRealTrips.sort((a, b) => {
  if (a.isLive && !b.isLive) return -1;
  if (!a.isLive && b.isLive) return 1;
  // Then by start_date ascending
  return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
});
```

**Step 3.** In `TripCard`, conditionally render the LIVE badge when `isLive === true`:

```tsx
{isLive && (
  <View style={styles.liveBadge}>
    <View style={styles.liveDot} />
    <Text style={styles.liveText}>LIVE</Text>
  </View>
)}
```

The pulsing dot uses an Animated.Value with a loop:

```typescript
const pulseAnim = useRef(new Animated.Value(1)).current;
useEffect(() => {
  if (!isLive) return;
  Animated.loop(
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ])
  ).start();
}, [isLive]);
```

**Step 4.** Replace days-until ring text with "LIVE" label OR multi-day context like "Day 2 of 4":

```typescript
const liveLabel = (() => {
  if (!isLive) return null;
  const totalDays = differenceInDays(endDate, startDate) + 1;
  if (totalDays === 1) return 'LIVE';
  const currentDay = differenceInDays(today, startDate) + 1;
  return `Day ${currentDay} of ${totalDays}`;
})();
```

**Step 5.** In `app/(tabs)/trips.tsx`, render a persistent live trip banner at the top of the screen when any trip in `realTrips` has `isLive === true`:

```tsx
{liveTrips.length > 0 && (
  <Pressable
    style={styles.liveTripBanner}
    onPress={() => router.push(`/trip-detail?tripId=${liveTrips[0].id}`)}
  >
    <View style={styles.liveDot} />
    <Text style={styles.liveBannerText}>
      {liveTrips[0].name} is happening now
    </Text>
    <Text style={styles.liveBannerCta}>Open →</Text>
  </Pressable>
)}
```

The banner has Augusta green or warm amber bg, gold text, sharp edges, light haptic on tap. Sits above the Stats card.

### Acceptance criteria

- [ ] Trip with start_date=today and end_date=today shows LIVE badge instead of "0 days"
- [ ] Trip with start_date=today and end_date=tomorrow shows "Day 1 of 2"
- [ ] Trip with start_date=yesterday and end_date=tomorrow shows "Day 2 of 3"
- [ ] LIVE dot pulses smoothly (not jarringly fast or slow)
- [ ] Live trips appear at the TOP of the UPCOMING section, before scheduled-future trips
- [ ] Persistent banner appears at top of Trips tab when any trip is live
- [ ] Banner tap navigates to trip detail
- [ ] Banner only renders when at least one trip is live; otherwise hidden
- [ ] If multiple live trips (rare but possible — back-to-back trips), banner shows the most recently started one
- [ ] Completed trips are NEVER shown as live, even if dates overlap (status check)

### Edge cases

- **Trip dates not set:** treat as not live
- **Trip with start_date in past but no end_date:** treat end_date = start_date (single-day trip), so it would only be live the day of
- **Trip with status='completed' but dates overlap today:** never live (status wins)
- **Multiple live trips simultaneously:** banner shows one (most recent start), card-level LIVE badges still appear on all
- **Timezone weirdness:** use device local time. Cross-timezone edge cases are acceptable for beta — refine post-launch

---

## Visual Design Notes

Match Dormie design tokens exactly:
- Background: `#0D0A06`
- Surface: `#151312`
- Augusta green: `#006747`
- Gold: `#C9A227`
- Live state color: warm red/amber `#E07857` (suggested) or muted gold — pick one and apply consistently
- Sharp edges (no border-radius)
- Georgia serif for numbers/headings
- Light haptics on banner tap

---

## Definition of Done

- [ ] Member avatars rendered on all trip cards (real and mock)
- [ ] Up to 4 visible + overflow indicator
- [ ] Old colored dot indicators removed (or kept if they add value — judgment call)
- [ ] LIVE badge appears on live trips with pulsing animation
- [ ] Multi-day live trips show "Day X of Y" instead of "LIVE"
- [ ] Live trips sorted to top of UPCOMING section
- [ ] Persistent banner at top of Trips tab when any trip is live
- [ ] Banner tap navigates correctly
- [ ] No regressions on existing trip card behavior
- [ ] `npx tsc --noEmit` passes
- [ ] Tested on phone with at least: 1 live trip, 1 future trip, 1 completed trip, 1 trip with 1 member, 1 trip with 5+ members

---

## Test Setup

To validate Item 9 (Live Trip), Ian needs at least one trip with dates spanning today. Two options:

**Option A:** Create a real trip via the app with start_date=today, end_date=today (or +1 day). Quickest path.

**Option B:** Manually update an existing trip in Supabase SQL Editor to have today's dates:

```sql
UPDATE public.trips
SET start_date = current_date, end_date = current_date + interval '1 day'
WHERE name = 'Final Test';
```

After testing, restore original dates if desired:

```sql
UPDATE public.trips
SET start_date = '2026-05-15', end_date = '2026-05-17'
WHERE name = 'Final Test';
```

---

## Hand-Off Prompt for Claude Code

Paste this at the start of next session:

```
Read docs/trips-visual-polish-spec-2026-05-03.md carefully. Two-item implementation: member avatars on trip cards (Item 4) and Live Trip indicator (Item 9) from the Trips product vision.

Goal: make the Trips list feel like a real product. Visible upgrades that every user notices on every app open.

Before writing code:
1. Read the spec
2. Read the 6 critical files listed
3. Confirm the actual exports and shapes (TripCard props, member data flow, existing avatar component)
4. Summarize the implementation in your own words
5. Flag any spec assumptions that don't match the codebase

Then implement Item 4 first (avatars). Commit and report. Wait for Ian's go-ahead before Item 9 (Live indicator). Each item commits separately.

Run npx tsc --noEmit after each commit. Push when complete.
```

---

*End of spec. Two items, one focused session, immediately visible polish.*
