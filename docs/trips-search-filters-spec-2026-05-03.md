# Trips Search and Filters Spec

**Date created:** 2026-05-03
**Phase reference:** Item 5 from `docs/trips-product-vision-2026-05-03.md`
**Estimated time:** 60-90 minutes focused work
**Goal:** Add search and basic filtering to the Trips list. Becomes essential at 20+ trips. Worth shipping before the painful threshold, not after.

---

## Strategic Context

Reference `docs/trips-product-vision-2026-05-03.md` for full Trips vision and `docs/dormie-strategy.md` for the company-level Notion-founder lens (power users are 10x users; search is non-negotiable).

You currently have ~7 real trips plus mock trips when demo mode is on. By the time a power user has been through 2-3 annual trip cycles with multiple groups, they'll easily have 20-30 trips. At that volume, scrolling becomes painful and "find the trip with Drew at Hermitage" becomes a real friction point.

This is one of those features that's invisible until it's needed, and once needed, becomes painful to live without. Ship it before it hurts.

---

## CRITICAL: Read Before Writing Any Code

Claude Code MUST read these files first to ground the work in actual codebase shape:

1. `app/(tabs)/trips.tsx` — current Trips list rendering, header structure, realTrips state
2. `src/components/trip/TripCard.tsx` — confirm the data the card displays (so we know what's filterable)
3. `src/services/trips.service.ts` — confirm the shape of trip data returned by getByUser
4. Any existing search/filter UI elsewhere in the app — search for `TextInput` with search styling, filter chips, etc. Reuse patterns
5. `docs/trips-product-vision-2026-05-03.md` — vision context

If anything in this spec doesn't match actual code, adjust accordingly.

---

## Required Behavior

### Search

- A search bar appears in the Trips header area, below the existing buttons (Discover/Join/New Trip... wait, Discover is gone — so just Join and New Trip)
- Text input with placeholder: "Search trips by name, location, or member"
- Search is **client-side only** for v1 — operates on already-loaded trip data
- Live filtering as user types (debounced ~150ms)
- Case-insensitive substring match across:
  - Trip name
  - Trip location
  - Member names (real users and guests)
- Clear button (X) inside the input when text is present
- Search applies to both UPCOMING and COMPLETED sections — both filter together
- DEMO trips also filter when demo mode is on

### Filters

A row of filter chips below the search bar. Each chip is a single-select state. Chips:

- **All** (default, selected initially)
- **Live** (only shows trips where `isLive === true`)
- **Upcoming** (only future trips, not completed, not live)
- **Completed** (only completed trips)

Filter and search compose — you can search "Hermitage" with the "Completed" filter active to find completed trips at Hermitage.

### Empty states

When search/filter combination yields zero results:
- Hide the UPCOMING and COMPLETED section headers
- Show a single empty state with icon + warm copy: "No trips match your search. Try different terms or clear the filter."
- "Clear filters" button if any filter chip other than "All" is active

When user has zero real trips and demo is off (existing TripsEmpty state):
- Search bar still renders but disabled
- Filter chips still render but disabled

---

## Implementation Steps

### Step 1 — Search state and filtering

In `app/(tabs)/trips.tsx`, add state:

```typescript
const [searchQuery, setSearchQuery] = useState('');
const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
```

Add a filtering helper:

```typescript
const filterTrips = (trips: TripCard[], query: string, filter: typeof activeFilter): TripCard[] => {
  let filtered = trips;

  // Apply filter chip
  if (filter === 'live') {
    filtered = filtered.filter(t => t.isLive);
  } else if (filter === 'upcoming') {
    filtered = filtered.filter(t => !t.isLive && t.status !== 'completed');
  } else if (filter === 'completed') {
    filtered = filtered.filter(t => t.status === 'completed');
  }

  // Apply search query
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter(t => {
      const nameMatch = t.name?.toLowerCase().includes(q);
      const locationMatch = t.location?.toLowerCase().includes(q);
      const memberMatch = t.members?.some(m =>
        (m.name || m.guest_name || '').toLowerCase().includes(q)
      );
      return nameMatch || locationMatch || memberMatch;
    });
  }

  return filtered;
};
```

Apply to both real and mock arrays:

```typescript
const filteredUpcomingReal = filterTrips(upcomingRealTrips, searchQuery, activeFilter);
const filteredCompletedReal = filterTrips(completedRealTrips, searchQuery, activeFilter);
const filteredUpcomingMock = showDemoData ? filterTrips(MOCK_UPCOMING_TRIPS, searchQuery, activeFilter) : [];
const filteredCompletedMock = showDemoData ? filterTrips(MOCK_COMPLETED_TRIPS, searchQuery, activeFilter) : [];

const totalResults = filteredUpcomingReal.length + filteredCompletedReal.length + filteredUpcomingMock.length + filteredCompletedMock.length;
```

### Step 2 — Search bar component

Render below the header row (Trips title + Join + New Trip):

```tsx
<View style={styles.searchContainer}>
  <Icon name="search" size={18} color={c.muted} style={styles.searchIcon} />
  <TextInput
    style={styles.searchInput}
    placeholder="Search trips by name, location, or member"
    placeholderTextColor={c.muted}
    value={searchQuery}
    onChangeText={setSearchQuery}
    autoCapitalize="none"
    autoCorrect={false}
    returnKeyType="search"
  />
  {searchQuery.length > 0 && (
    <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
      <Icon name="x-circle" size={18} color={c.muted} />
    </Pressable>
  )}
</View>
```

Style the search container with surface bg, sharp edges, gold border on focus (optional — match existing input patterns in the app).

### Step 3 — Filter chips row

Render below the search bar:

```tsx
<View style={styles.filterRow}>
  {(['all', 'live', 'upcoming', 'completed'] as const).map(filter => (
    <Pressable
      key={filter}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveFilter(filter);
      }}
      style={[
        styles.filterChip,
        activeFilter === filter && styles.filterChipActive,
      ]}
    >
      <Text style={[
        styles.filterChipText,
        activeFilter === filter && styles.filterChipTextActive,
      ]}>
        {filter === 'all' ? 'All' : filter[0].toUpperCase() + filter.slice(1)}
      </Text>
    </Pressable>
  ))}
</View>
```

Active chip styling: Augusta green fill, gold text. Inactive: surface bg, muted text. Sharp edges.

### Step 4 — Section rendering with empty states

Replace the existing UPCOMING/COMPLETED rendering with filtered versions:

```tsx
{totalResults === 0 && (searchQuery || activeFilter !== 'all') && (
  <View style={styles.emptySearchState}>
    <Icon name="search" size={48} color={c.muted} />
    <Text style={styles.emptySearchTitle}>No trips match your search</Text>
    <Text style={styles.emptySearchBody}>Try different terms or clear the filter.</Text>
    {(searchQuery || activeFilter !== 'all') && (
      <Pressable onPress={() => { setSearchQuery(''); setActiveFilter('all'); }} style={styles.clearButton}>
        <Text style={styles.clearButtonText}>Clear filters</Text>
      </Pressable>
    )}
  </View>
)}

{(filteredUpcomingReal.length > 0 || filteredUpcomingMock.length > 0) && (
  <Section title="UPCOMING">
    {filteredUpcomingReal.map(t => <TripCard key={t.id} trip={t} showDays />)}
    {filteredUpcomingMock.map(t => <TripCard key={t.id} trip={t} showDays isDemo />)}
  </Section>
)}

{(filteredCompletedReal.length > 0 || filteredCompletedMock.length > 0) && (
  <Section title="COMPLETED">
    {filteredCompletedReal.map(t => <TripCard key={t.id} trip={t} />)}
    {filteredCompletedMock.map(t => <TripCard key={t.id} trip={t} isDemo />)}
  </Section>
)}
```

### Step 5 — Debouncing search input (optional polish)

If search feels janky as user types, add a 150ms debounce:

```typescript
const [searchInput, setSearchInput] = useState('');
const [searchQuery, setSearchQuery] = useState('');

useEffect(() => {
  const timer = setTimeout(() => setSearchQuery(searchInput), 150);
  return () => clearTimeout(timer);
}, [searchInput]);
```

Use `searchInput` for the TextInput value, `searchQuery` for the filter logic.

---

## Visual Design Notes

Match Dormie design tokens:
- Background: `#0D0A06`
- Surface: `#151312` (search bar background)
- Augusta green: `#006747` (active filter chip fill)
- Gold: `#C9A227` (active filter chip text)
- Muted: `#8A857F` (placeholder, inactive chip text, search icon)
- Sharp edges (no border-radius)
- Light haptics on filter chip taps

---

## Acceptance Criteria

- [ ] Search bar renders below the header buttons
- [ ] Filter chip row renders below search bar
- [ ] All, Live, Upcoming, Completed chips work correctly
- [ ] Typing in search bar filters live as user types
- [ ] Search matches against trip name, location, AND member names
- [ ] Search and filter compose correctly (e.g. "Hermitage" + "Completed" works)
- [ ] X button clears search input
- [ ] DEMO trips also filter when demo mode is on
- [ ] Zero results state shows with "Clear filters" button
- [ ] Section headers (UPCOMING/COMPLETED) hide when no matching trips in that section
- [ ] Avatars and Live indicators from previous polish work still render correctly on filtered trips
- [ ] Pull-to-refresh still works
- [ ] `npx tsc --noEmit` passes
- [ ] Tested on phone with: empty search, partial-match search, full-match search, each filter chip, search + filter combinations, search clearing

---

## Edge Cases

- **Search query with leading/trailing whitespace**: `query.trim()` before matching
- **Empty members array on a trip**: search just doesn't match member field, still works on name/location
- **Case sensitivity**: all matches are case-insensitive (toLowerCase on both sides)
- **Special characters in search**: just substring match, no regex — special chars treated literally
- **User clears search while filter is active**: filter persists, results update
- **User changes filter while search is active**: search persists, results update

---

## Hand-Off Prompt for Claude Code

Paste this at the start of next session:

```
Read docs/trips-search-filters-spec-2026-05-03.md carefully. Single-feature implementation: search and filter chips for the Trips list (Item 5 from the Trips product vision).

Goal: ship Trips polish that becomes essential at 20+ trips. Search by name/location/member, filter by All/Live/Upcoming/Completed. Single commit.

Before writing code:
1. Read the spec
2. Read the 4 critical files listed
3. Confirm actual exports and shapes
4. Summarize the implementation in your own words
5. Flag any spec assumptions that don't match the codebase

Then implement. Single commit when complete.

Run npx tsc --noEmit. Push.
```

---

*End of spec. Single feature, one focused session, ships the Trips polish arc cleanly.*
