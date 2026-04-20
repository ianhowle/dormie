# Trips P0 Spec v3.1 — Schema Alignment Patch

**Purpose:** Addresses discrepancies #3, #4, and #5 raised by Claude Code's v3 review. Read this alongside `docs/trips-p0-spec-v3-2026-04-19.md` — this patch supersedes specific sections below but the rest of v3 remains authoritative.

---

## Patch #1 — `trips.course_id` (Item 3 from v3 review)

**Issue:** v3 instructs Claude Code to include `course_id` in the Create Trip payload. The `trips` table has no `course_id` column.

**Resolution:** Do NOT add `course_id` to the `trips` table. Instead, use the existing `trip_courses` junction table to associate the selected course with the trip at creation time. This is more correct for Dormie's domain — real trips play multiple courses (Bandon plays 4, Pinehurst plays 3, buddies trips to Pebble play all three Monterey courses).

### Updated Fix 1 — Create Trip handler

The payload sent to `tripsService.create(payload)` must NOT include `course_id`. Remove it.

After `tripsService.create()` returns successfully, add a follow-up call to `tripsService.addCourse(tripId, courseId)` to associate the selected course.

Corrected handler excerpt:

```typescript
// Build payload — NO course_id here
const payload = {
  name: name.trim(),
  location: selectedCourse.name,  // free-text location for display
  format,
  side_games: Array.from(sideGames),
  stakes: stakes || null,
  // ... other existing payload fields
  // NO course_id — trips table doesn't have this column
  // NO player_count — derive from trip_members count
};

const trip = await tripsService.create(payload);

// Associate the selected course via the junction table
if (selectedCourse.id) {
  await tripsService.addCourse(trip.id, selectedCourse.id);
}

// Add non-organizer members
const memberUserIds = players
  .filter(p => p.user_id && p.user_id !== trip.organizer_id)
  .map(p => p.user_id);
if (memberUserIds.length > 0) {
  await tripsService.addMembers(trip.id, memberUserIds);
}
```

### Trip-to-scoring bridge implication

When launching scoring from a trip, the scoring screen needs a course. Since trips now have N courses via `trip_courses`:

- **If trip has 1 course:** use it directly, no prompt
- **If trip has 2+ courses:** show a course picker before launching scoring ("Which course are you playing today?")
- Use existing `tripsService.getCourses(tripId)` to retrieve the list

For the v3 scope, Phase 6 integration verification should confirm single-course trips work. Multi-course course-picker UX is a minor follow-up, not blocking.

### Leaderboard implication

The `get_trip_leaderboard` RPC (already live from earlier work) queries rounds linked to a trip, not courses. No change needed — it works regardless of how many courses the trip has.

---

## Patch #2 — `player_count` column (Item 4 from v3 review)

**Issue:** v3 payload includes `player_count`. The `trips` table has no such column.

**Resolution:** Remove `player_count` from the create payload. Derive it from `trip_members` count wherever displayed. This is already how the trip detail screen shows member counts. No schema change needed.

The `player_count` shown in the Quick Trip wizard (the 2–8 selector) becomes a **UI-side slot count** that determines how many empty player rows to render. It doesn't need to be persisted — users fill slots, each filled slot becomes a `trip_members` row, the "count" is just `trip_members.length` going forward.

---

## Patch #3 — Recent Co-Players scope (Item 5 from v3 review, informational)

**Issue:** `get_recent_co_players` RPC joins on `rounds.trip_id`, excluding standalone rounds.

**Resolution:** Intentional for this spec. Keep as-is. The "Recent" tab in AddPlayerSheet is for people you've been on trips with. Future enhancement (V1.1) could add a secondary section for "People from recent rounds" that includes non-trip rounds. Not blocking.

---

## Patch #4 — `addMembers()` upsert vs insert split (Item 2 from v3 review)

**Issue:** Current `addMembers()` uses upsert with `onConflict: 'trip_id,user_id'`. Guest rows (`user_id: null`) don't match this conflict target.

**Resolution:** Extend `addMembers()` to split by row type:

```typescript
type AddMemberInput =
  | { user_id: string }
  | { guest_name: string; handicap: number };

async addMembers(tripId: string, members: AddMemberInput[]) {
  const userRows = members
    .filter(m => 'user_id' in m)
    .map(m => ({
      trip_id: tripId,
      user_id: (m as { user_id: string }).user_id,
      rsvp_status: 'confirmed',
      role: 'player',
    }));

  const guestRows = members
    .filter(m => 'guest_name' in m)
    .map(m => {
      const g = m as { guest_name: string; handicap: number };
      return {
        trip_id: tripId,
        user_id: null,
        guest_name: g.guest_name,
        handicap: g.handicap,
        rsvp_status: 'confirmed',
        role: 'player',
      };
    });

  const results = [];

  // Upsert real users (handles re-invites gracefully)
  if (userRows.length > 0) {
    const { data, error } = await supabase
      .from('trip_members')
      .upsert(userRows, { onConflict: 'trip_id,user_id' })
      .select();
    if (error) throw new Error(error.message);
    results.push(...(data ?? []));
  }

  // Insert guests (no conflict path — guests don't dedupe)
  if (guestRows.length > 0) {
    const { data, error } = await supabase
      .from('trip_members')
      .insert(guestRows)
      .select();
    if (error) throw new Error(error.message);
    results.push(...(data ?? []));
  }

  return results;
}
```

---

## Updated Phase 1 — Migration List (final)

Three migrations (not four). Claude Code should apply these in order:

1. `supabase/migrations/20260420_course_search_ranked.sql` — `search_courses` RPC with match ranking (only if `coursesService.search()` currently uses naive ilike — Claude Code confirmed it does, so this migration is needed)
2. `supabase/migrations/20260420_trip_invites.sql` — `trip_invites` table + RLS + `join_trip_by_invite` RPC
3. `supabase/migrations/20260420_trip_members_guest.sql` — make `user_id` nullable + add `guest_name` column + add CHECK constraint `(user_id IS NOT NULL) OR (guest_name IS NOT NULL)`
4. `supabase/migrations/20260420_recent_co_players.sql` — `get_recent_co_players` RPC

NO migration to the `trips` table itself. The `trips` schema stays as-is. Course association goes through the existing `trip_courses` junction table.

---

## Summary of Changes From v3

| Area | v3 Said | v3.1 Correction |
|------|---------|-----------------|
| Trip create payload | Include `course_id` | **Remove.** Use `trip_courses` junction after trip creation. |
| Trip create payload | Include `player_count` | **Remove.** Derive from `trip_members` count. |
| Trips schema | (implied) Add `course_id` FK | **No change to trips table.** |
| `addMembers()` | Extend for guests (vague) | **Explicit split**: upsert users, insert guests. |
| Recent co-players scope | Trip-joined rounds only | **Confirmed intentional.** V1.1 could add non-trip rounds. |

---

## Go-Ahead Conditions

Claude Code may proceed with implementation when:

- [ ] Claude Code acknowledges reading this v3.1 patch
- [ ] Claude Code confirms no migration will be added to the `trips` table
- [ ] Claude Code confirms `tripsService.addCourse(tripId, courseId)` is the right method to call post-creation (verifies against `src/services/trips.service.ts`)
- [ ] Ian gives final go-ahead

---

*End of v3.1 patch. Apply alongside v3 spec. Together they represent the final authoritative implementation plan.*
