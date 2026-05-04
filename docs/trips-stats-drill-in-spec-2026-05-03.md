# Trips Stats Drill-In Spec

**Date created:** 2026-05-03
**Phase reference:** Item 7 from `docs/trips-product-vision-2026-05-03.md`
**Estimated time:** 60-90 minutes focused work
**Goal:** Make the Stats card on the Trips landing page tappable. Tap opens a drill-in screen showing the user's full trip-performance data story instead of just four numbers.

---

## Strategic Context

Reference `docs/trips-product-vision-2026-05-03.md` and `docs/dormie-strategy.md`.

The Stats card today shows: TRIPS / WINS / TRIP AVG / REG AVG, plus the headline insight "You play 2.4 strokes better on trips." That single insight is genuinely interesting — nobody else surfaces it. But the card is currently a dead-end. Tap does nothing. Users see four numbers, can't go deeper, and any user who likes the headline insight has nowhere to go to investigate.

The fix isn't more numbers on the card itself (that dilutes the headline). The fix is making the card a tappable doorway into a full data story screen.

This is high-leverage because it's the kind of detail that signals "this app actually thought about you" — the difference between a generic dashboard and a personal data product.

---

## CRITICAL: Read Before Writing Any Code

Claude Code MUST read these files first to ground the work in actual codebase shape:

1. `app/(tabs)/trips.tsx` — confirm where the Stats card renders, what data flows into it
2. The Stats card component (search for "TRIP AVG", "REG AVG", "strokes better")
3. `src/services/` — figure out what trip-stats service exists, or where the underlying numbers come from. Could be a dedicated service, could be derived in-component
4. `src/services/rounds.service.ts` (if it exists) — round-level data needed for drill-in
5. `src/services/trips.service.ts` — trip metadata for cross-reference
6. Any existing chart/visualization component in the codebase (recharts, victory-native, etc.) — search for chart imports
7. `docs/trips-product-vision-2026-05-03.md` for vision context

If anything in this spec doesn't match actual code, adjust accordingly.

**Critical first check:** does the Stats card use real data today, or are those numbers (7 / 3 / 76.8 / 79.2 / "2.4 strokes better") hardcoded mock values? If they're hardcoded, this spec scope changes — we'd need to wire real data to the card itself before drill-in makes sense. Report this finding before writing any code.

---

## Required Behavior

### Stats card becomes tappable

The card on the Trips landing page (the one with TRIPS / WINS / TRIP AVG / REG AVG) gets a Pressable wrapper. On tap:
- Light haptic
- Navigate to `/stats-drill-in` (new screen)

Optional visual hint that it's tappable: a small chevron-right icon in the bottom-right of the card, or a subtle "Tap to explore" affordance. My preference is a chevron — minimal, on-brand, doesn't compete with the data.

### Drill-in screen content

A new screen `app/stats-drill-in.tsx` showing the user's full trip-performance data story. Sections in order:

**Section 1 — Headline insight (top)**
The same "You play X strokes better on trips" stat, but bigger and more prominent. Plus a one-line context: "Across X trips and Y rounds since [date]." Sets the scene.

**Section 2 — Trip avg vs regular avg breakdown**
- A simple bar chart or paired-number visualization
- Two bars: Trip Avg (e.g. 76.8) and Regular Avg (e.g. 79.2)
- The 2.4-stroke gap visualized
- Sub-text: "Why might this be? Better focus, better company, better courses."

**Section 3 — Trip-by-trip breakdown**
A list of all the user's completed trips with:
- Trip name
- Date range
- Course(s) played
- Average score on that trip
- Whether the user won that trip (trophy icon if so)
- Sorted reverse-chronological by default

Each row tappable to go to the trip detail screen.

**Section 4 — Course-by-course breakdown** (if data permits)
For courses the user has played multiple times across trips:
- Course name
- Times played
- Average score on that course
- Best score, with date

**Section 5 — Year-over-year (if user has 2+ years of data)**
- Number of trips per year
- Average score per year
- Trend indicator (improving / steady / declining)

**Section 6 — Stat callouts (small, fun)**
- Most-played course
- Longest gap between trips
- Highest single round (for honesty/humility)
- Lowest single round (for celebration)

### Empty states

- **User with 0 completed trips:** Show only the headline section saying "No trip data yet. Your stats will populate after your first completed trip." Disable navigation back to other sections.
- **User with 1 completed trip:** Show Sections 1-3 only. Skip year-over-year and course-by-course (they need multiple data points).
- **User with all trips at the same course:** Skip Section 4 (no breakdown to show).

### Loading state

While fetching the trip+rounds data, show skeleton loading for each section. Reuse existing skeleton primitive from previous polish work.

### Header

Standard Dormie header with back button, screen title "Your Trip Story" (or similar — reach for warm copy, not generic "Statistics"), no other actions.

---

## Implementation Steps

### Step 1 — Confirm data availability

Before writing any UI:
- Confirm Stats card uses real data (not mocks). If mocks, flag this as a blocker.
- Confirm there's a way to fetch all the user's completed trips with their associated rounds.
- Confirm there's a way to fetch a user's regular (non-trip) round averages. This might already exist in a stats service.

If any of this doesn't exist, the scope expands and we should pause and discuss before continuing.

### Step 2 — Create stats service or extend existing

Wherever the existing Stats card data comes from, extend that to support drill-in queries:

```typescript
// src/services/stats.service.ts (or wherever)
export interface TripStats {
  totalTrips: number;
  totalWins: number;
  tripAvg: number;
  regularAvg: number;
  diffStrokes: number;  // tripAvg - regularAvg, negative if better on trips
  earliestTripDate: string | null;
}

export interface TripPerformance {
  tripId: string;
  tripName: string;
  startDate: string;
  endDate: string;
  courseName: string;  // primary course
  avgScore: number;
  isWinner: boolean;
  rounds: number;
}

export interface CourseStats {
  courseId: string;
  courseName: string;
  timesPlayed: number;
  avgScore: number;
  bestScore: number;
  bestScoreDate: string;
}

export interface YearStats {
  year: number;
  trips: number;
  avgScore: number;
}

export const statsService = {
  async getOverview(userId: string): Promise<TripStats> { /* ... */ },
  async getTripPerformanceList(userId: string): Promise<TripPerformance[]> { /* ... */ },
  async getCourseBreakdown(userId: string): Promise<CourseStats[]> { /* ... */ },
  async getYearOverYear(userId: string): Promise<YearStats[]> { /* ... */ },
  async getCallouts(userId: string): Promise<{
    mostPlayedCourse: { name: string; times: number };
    longestGap: { months: number; from: string; to: string };
    highestRound: { score: number; date: string; course: string };
    lowestRound: { score: number; date: string; course: string };
  }> { /* ... */ },
};
```

### Step 3 — Wrap Stats card in Pressable

In `app/(tabs)/trips.tsx`:

```tsx
<Pressable
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/stats-drill-in');
  }}
  style={styles.statsCardWrapper}
>
  <StatsCard /* existing props */ />
  <Icon name="chevron-right" size={20} color={c.muted} style={styles.statsCardChevron} />
</Pressable>
```

### Step 4 — Create drill-in screen

`app/stats-drill-in.tsx`:

```tsx
export default function StatsDrillInScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<TripStats | null>(null);
  const [trips, setTrips] = useState<TripPerformance[]>([]);
  const [courses, setCourses] = useState<CourseStats[]>([]);
  const [years, setYears] = useState<YearStats[]>([]);
  const [callouts, setCallouts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [o, t, c, y, cl] = await Promise.all([
          statsService.getOverview(user.id),
          statsService.getTripPerformanceList(user.id),
          statsService.getCourseBreakdown(user.id),
          statsService.getYearOverYear(user.id),
          statsService.getCallouts(user.id),
        ]);
        setOverview(o); setTrips(t); setCourses(c); setYears(y); setCallouts(cl);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  if (loading) return <SkeletonScreen />;
  if (!overview || overview.totalTrips === 0) return <EmptyState />;

  return (
    <ScrollView>
      <Header title="Your Trip Story" />
      <HeadlineSection overview={overview} />
      <ComparisonSection overview={overview} />
      <TripBreakdownSection trips={trips} />
      {courses.length > 1 && <CourseBreakdownSection courses={courses} />}
      {years.length >= 2 && <YearOverYearSection years={years} />}
      {callouts && <CalloutsSection callouts={callouts} />}
    </ScrollView>
  );
}
```

### Step 5 — Visualization choices

Keep visualizations simple. Don't bring in heavy charting libraries unless one is already in the codebase:

- **Comparison section:** two side-by-side stat cards with bars showing relative magnitude. Simple `View` with `flex` + `width` percentages. No chart library needed.
- **Year-over-year:** small horizontal bars or just a list with year + trips count + avg score. Avoid a line chart unless the existing codebase already has chart infrastructure.
- **Trip breakdown:** vertical list, no chart.
- **Course breakdown:** vertical list, no chart.
- **Callouts:** four small cards in a 2x2 grid, each showing one stat.

If the codebase already has react-native-svg or victory-native installed, we can use it. If not, plain View-based bar visualizations are sufficient and ship faster.

---

## Visual Design Notes

Match Dormie design tokens:
- Background: `#0D0A06`
- Surface: `#151312`
- Augusta green: `#006747` (for "better than regular" stat highlights)
- Gold: `#C9A227` (for trophy/win indicators, accents)
- Muted: `#8A857F` (secondary text, chevrons)
- Sharp edges (no border-radius)
- Georgia serif for headline numbers, sans for labels
- Section headers: small uppercase gold (matching existing TRIP MOMENTS / HEAD TO HEAD pattern)

For the drill-in screen specifically:
- Generous spacing — this is a "lean back" reading experience, not dense data
- Each section visually distinct with subtle dividers
- Trip rows tappable with subtle press state

---

## Acceptance Criteria

- [ ] Stats card on Trips tab is tappable, with chevron affordance
- [ ] Tap navigates to /stats-drill-in
- [ ] Drill-in screen shows headline section with prominent "X strokes better on trips" stat
- [ ] Comparison section shows trip avg vs regular avg
- [ ] Trip breakdown lists all completed trips with key stats, sorted reverse-chronological
- [ ] Trip rows tappable to navigate to trip detail
- [ ] Course breakdown shows multi-played courses with stats (skipped if user has <2 courses)
- [ ] Year-over-year shows yearly aggregates (skipped if user has <2 years of data)
- [ ] Callouts section shows fun stats (most played, longest gap, highest, lowest)
- [ ] Empty state for users with 0 completed trips
- [ ] Reduced sections for users with 1 completed trip
- [ ] Loading skeletons during data fetch
- [ ] Back button returns to Trips tab
- [ ] No regressions on existing Stats card display
- [ ] `npx tsc --noEmit` passes

---

## Edge Cases

- **User has trips but no rounds yet (trips not played):** treat as 0 completed trips, show empty state
- **User has only round data, no trip data:** Stats card shows 0 trips, drill-in shows empty state
- **All scores are the same (no variance):** show stats but without trend indicators
- **Negative diffStrokes (user plays WORSE on trips):** still show the stat honestly. "You play 1.2 strokes worse on trips. Maybe pre-trip jitters?" — humorous on-brand framing
- **Year boundary edge cases:** trip spanning Dec 31 / Jan 1 counts as the year of start_date

---

## Hand-Off Prompt for Claude Code

Paste this at the start of next session:

```
Read docs/trips-stats-drill-in-spec-2026-05-03.md carefully. Single-feature implementation: Stats card tap-to-drill (Item 7 from the Trips product vision).

Goal: turn the Stats card from dead-end metadata into a doorway to a full data story screen.

CRITICAL FIRST CHECK: does the Stats card use real data today, or are the numbers (7/3/76.8/79.2) hardcoded? Report this finding BEFORE writing any code. If hardcoded, the scope changes substantially.

Then before writing code:
1. Read the spec
2. Read the 7 critical files listed
3. Confirm what data services exist for trip stats and round averages
4. Decide on visualization approach (existing chart lib vs. plain View bars)
5. Summarize the implementation in your own words
6. Flag any spec assumptions that don't match the codebase

Then implement. Single commit when complete.

Run npx tsc --noEmit. Push.
```

---

*End of spec. Single feature, one focused session.*
