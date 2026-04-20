# Trips P0 Implementation Spec — Elite Quality (v3, corrected against actual codebase)

**Date:** 2026-04-19
**Supersedes:** `docs/trips-p0-spec-v2-2026-04-19.md` (v2)
**Validated against:** Claude Code audit of actual codebase on 2026-04-19
**Scope:** Top 3 P0 fixes from `docs/trips-frontend-audit-2026-04-19.md`

This version has been corrected for 10 discrepancies between previous spec assumptions and the actual codebase. All service method names, file locations, environment variable names, and existing system behaviors are now verified accurate.

---

## Why v3 Exists — Summary of Corrections from v2

| # | v2 Assumption | Actual Reality |
|---|---------------|----------------|
| 1 | `src/lib/invite.ts` exists with friend deep link parser | **Does not exist.** No deep link system in codebase. All new work. |
| 2 | `src/contexts/ToastContext.tsx` with `toast.show()` | **Lives at `src/components/Toast.tsx`** — uses `useToast()` → `showToast({ message, type, icon, duration })` |
| 3 | `DESIGN.md` and `docs/dormie-design-spec.md` | **Don't exist.** Design tokens live in `CLAUDE.md`, `src/theme/colors.ts`, `src/theme/fonts.ts` |
| 4 | `src/theme/spacing.ts` | **Doesn't exist.** Spacing is ad-hoc per stylesheet. |
| 5 | Build new 3-tier course search fallback | **`coursesService.searchAll()` already does this.** Reuse, don't rebuild. |
| 6 | Create Trip button is totally broken | **Handler exists but has 6 narrow bugs** — missing payload fields, lenient validation, wrong navigation target, premature haptic, no loading state |
| 7 | `GOLF_COURSE_API_KEY`, `GOOGLE_PLACES_KEY` | **Actual: `EXPO_PUBLIC_GOLF_API_KEY`, `EXPO_PUBLIC_GOOGLE_PLACES_KEY`** |
| 8 | `join_trip_by_code` RPC doesn't exist | **Already exists, reads from `trips.invite_code`.** Keep for permanent codes; build new `join_trip_by_invite` RPC for expiring links. |
| 9 | `tripsService.addMembers()` supports guest players | **Only accepts `user_id` strings.** Type signature needs update after migration. |
| 10 | Dark bg is `#141210` | **Actual: `bg: '#0D0A06'`, `surface: '#151312'`** |
| 11 | Friend service methods: `sendFriendRequest`, `acceptFriendRequest`, `rejectFriendRequest` | **Actual: `sendRequest`, `acceptRequest`, `rejectRequest`** (also `getActiveFriends(userId)` — note userId param) |

---

## CRITICAL: Key Existing Systems to Reuse

**Before writing any code**, Claude Code must reference these confirmed-real services and components:

### Services (all exported as named objects, use dot notation)

- **`friendsService`** (`src/services/friends.service.ts`):
  - `getActiveFriends(userId)` — accepted friends, requires userId param
  - `getPendingRequests(userId)`, `getSentRequests(userId)`
  - `sendRequest(userId, friendId)`, `acceptRequest(friendshipId)`, `rejectRequest(friendshipId)`
  - `searchUsers(query, limit = 20)`

- **`tripsService`** (`src/services/trips.service.ts`):
  - `create(trip: TripInsert)` — auto-adds organizer as confirmed member
  - `joinByCode(code)` — existing, calls `join_trip_by_code` RPC against `trips.invite_code` column (permanent codes)
  - `getById`, `getByUser`, `update`, `rsvp`, `inviteMember`, `getCourses`, `addCourse`, `getLeaderboard`, `addMembers`, `updateMemberTeam`, `getMembers`, `getTripRounds`, `subscribe`, `unsubscribe`

- **`coursesService`** (`src/services/courses.service.ts`):
  - `search(query, limit = 20)` — local Supabase only (fuzzy match)
  - `searchAPI(query)` — GolfCourseAPI only
  - `searchGooglePlaces(query)` — Google Places only
  - `searchAll(query)` — **already orchestrates 3-tier fallback**, returns unified results
  - `ensureCourse(course)` — upsert by name+location
  - `saveGooglePlacesCourse(result)`, `saveCourseWithData(...)`, `cacheAPICoursToSupabase(...)`
  - `parseTeeBoxes(course)`, `teeNameToColor(name)`
  - `fetchScorecard`, `cacheCourse`, `getCachedCourse`, `searchWithCache`, `searchWithAIFallback`, `generateHoleData`

### Components

- **Toast** (`src/components/Toast.tsx`):
  ```typescript
  const { showToast } = useToast();
  showToast({ message: 'Trip created', type: 'success' });
  // types: 'success' | 'info' | 'gold' | 'error'
  ```

- **Existing modal patterns** — check `src/components/DormieMoment.tsx` and scoring overlays. Use React Native's built-in `Modal` with `presentationStyle="pageSheet"` for the AddPlayerSheet.

- **ViewShot + Share** — shipped in `src/components/PostRoundSummary.tsx`. Uses `ViewShot` → `viewShotRef.capture()` → `Sharing.shareAsync()` or `MediaLibrary.saveToLibraryAsync()`. Reference this pattern if building branded invite share cards.

### Design tokens (actual values)

From `src/theme/colors.ts`:
- `bg: '#0D0A06'` (true dark page)
- `surface: '#151312'` (cards)
- `elevated: '#1A1816'` (interactive/featured)
- Primary text: `#E8E4DE`
- Muted text: `#8A857F`
- Tertiary text: `#6B6560`
- Borders: `rgba(255,255,255,0.06)`
- Augusta green (primary): `#006747`
- Gold: `#C9A227`
- Urgent red: `#C41E3A`

From `src/theme/fonts.ts`:
- Georgia serif — all numbers and headings
- System sans — body
- Sizes: `xs 12 / sm 14 / md 16 / lg 18 / xl 20 / xxl 24 / xxxl 32 / hero 48`

Sharp edges throughout — no border-radius anywhere.

### Environment variables (confirmed present in `.env`)

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOLF_API_KEY` (GolfCourseAPI, user 7159)
- `EXPO_PUBLIC_GOOGLE_PLACES_KEY`
- `EXPO_PUBLIC_ANTHROPIC_API_KEY`

### Dependencies NOT installed (do not require)

- `@gorhom/bottom-sheet` — use React Native `Modal` instead
- `react-native-qrcode-svg` — skip QR code feature for now

---

## Guiding Principles

1. **Reuse over rebuild.** If `searchAll()` exists, use it. If `Toast.tsx` exists, use it. If `PostRoundSummary.tsx` has a share pattern, extend it.
2. **Match Dormie patterns exactly.** Dark surfaces (bg → surface → elevated), gold accents, Georgia serif for numbers, sharp edges (NO border-radius), spring animations (friction 5) with light haptics, 2–4px letter-spacing on uppercase kickers.
3. **No silent catches.** Every async wrapped in try/catch with user-facing `showToast`.
4. **Loading states always shown.** Button spinners, list skeletons. Never blank screens.
5. **Empty states designed, not default.** Every list, every tab.
6. **TypeScript strict.** `npx tsc --noEmit` must pass after every commit.

---

## Invite Philosophy — Dual System (Philosophy C)

Dormie will maintain **two complementary invite systems**:

### System 1 — Permanent Trip Code (existing, unchanged)

- Every trip gets an auto-generated 6-char uppercase code at creation (`trips.invite_code`)
- Never expires, never caps usage
- Reads via existing `join_trip_by_code` RPC and `tripsService.joinByCode(code)`
- Use case: "Hey Drew, you joining this weekend? Code is ABCDEF"
- Simple. Works forever. No complexity for the trip organizer.

### System 2 — Expiring Share Link (new)

- Generated on demand from the trip detail screen
- Time-limited (7 days default) and usage-capped (8 uses default)
- Stored in new `trip_invites` table
- Reads via new `join_trip_by_invite` RPC
- Use case: "Text Drew a link to join — auto-expires if the chat gets forwarded"
- Secure. Ephemeral. Shareable.

The AddPlayerSheet's Invite tab shows BOTH:
- **Trip Code** section displayed prominently (the permanent code, non-expiring)
- **Share Link** section below with "Generate Share Link" button that creates a time-limited `trip_invites` entry

---

## Fix 1 — Create Trip button bugs

### Problem restated (corrected from v2)

The handler exists in `app/create-trip.tsx` (lines 568-589) but has six narrow bugs that combine to make the button feel broken:

1. Payload is missing `course_id` — only sends free-text location
2. Payload is missing `player_count` and `players` array
3. `canCreate` only checks name and location string, not resolved course object
4. On success, calls `router.back()` instead of navigating to `/trip-detail?id=<id>`
5. No loading state on the button
6. `haptics.success()` fires on line 571 BEFORE the async call — so the success haptic plays even on failure

### Implementation requirements

The corrected handler (using actual Toast API):

```typescript
import { useToast } from '../src/components/Toast';
import * as Haptics from 'expo-haptics';

const { showToast } = useToast();
const [isCreating, setIsCreating] = useState(false);

const handleCreate = async () => {
  // Haptic feedback on tap (not on success yet)
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  // Validation with actual toast API
  if (!name.trim()) {
    showToast({ message: 'Trip name is required', type: 'error' });
    return;
  }
  if (!selectedCourse?.id) {
    showToast({ message: 'Select a course for the trip location', type: 'error' });
    return;
  }
  if (players.length < 2) {
    showToast({ message: 'Add at least one other player', type: 'error' });
    return;
  }

  setIsCreating(true);

  try {
    const payload = {
      name: name.trim(),
      location: selectedCourse.name,
      course_id: selectedCourse.id,
      player_count: players.length,
      format,
      side_games: Array.from(sideGames),
      stakes: stakes || null,
      // ... other existing payload fields
    };

    const trip = await tripsService.create(payload);

    // Add non-organizer players via addMembers (accepts user_id strings currently;
    // will be extended for guests in Phase 4)
    const memberUserIds = players
      .filter(p => p.user_id && p.user_id !== trip.organizer_id)
      .map(p => p.user_id);
    if (memberUserIds.length > 0) {
      await tripsService.addMembers(trip.id, memberUserIds);
    }

    // Success feedback AFTER the async call completes
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast({ message: 'Trip created', type: 'success' });

    // Navigate to trip detail, not back
    router.replace(`/trip-detail?id=${trip.id}`);
  } catch (err: any) {
    console.error('[CreateTrip] failed', err);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    showToast({ message: err?.message ?? 'Could not create trip', type: 'error' });
  } finally {
    setIsCreating(false);
  }
};
```

### Button component requirements

- Show `isCreating` state: disable taps, ActivityIndicator replaces "Create Trip" label, opacity 0.6
- Use whatever primary-CTA component exists in `src/components/` — do not create a new one
- Augusta green fill, sharp edges, no border-radius

### Acceptance criteria

- [ ] Root cause of each of the 6 bugs addressed in the commit message
- [ ] Empty name → error toast
- [ ] Unresolved course (no course_id) → error toast
- [ ] Fewer than 2 players → error toast
- [ ] Valid submission → loading spinner on button → success toast → navigate to `/trip-detail?id=<id>`
- [ ] Network failure → error toast with actual error message, button re-enabled
- [ ] Trip row in Supabase has `course_id`, `player_count`, all format/side_games fields populated
- [ ] `trip_members` rows inserted for all non-organizer players via `addMembers`
- [ ] Success haptic fires AFTER success, never before
- [ ] Error haptic fires on failure
- [ ] `npx tsc --noEmit` passes

---

## Fix 2 — Location input: autocomplete to real course_id

### Problem restated

Location field currently takes free text with static chip suggestions unrelated to input. No resolution to `course_id`. Breaks scoring bridge downstream.

### Required behavior

As user types, Location field must:

1. **Debounce** 300ms
2. **Call `coursesService.search(query, 10)`** first — local Supabase only
3. **Show typeahead dropdown** below input, max 5 visible, scroll for more
4. **Each result**: course name (Georgia serif), city + state (muted), gold "+" right-aligned
5. **Tap to select** — sets resolved course, dismisses dropdown, displays selected state with gold left-border accent + green checkmark + "×" to clear
6. **If `search()` returns empty** → render row: *"Search GolfCourseAPI for '<query>'"* (gold italic)
7. **User taps that row** → call `coursesService.searchAPI(query)`, show results in same dropdown
8. **If GolfCourseAPI returns empty** → render row: *"Search Google Places for '<query>'"*
9. **User taps that row** → call `coursesService.searchGooglePlaces(query)`
10. **On selection from external source** → call `coursesService.ensureCourse(...)` to create local row, then set as selected
11. **Light haptic** on each selection
12. **Loading spinner** inline during async calls

### Why decompose rather than use `searchAll()` directly

`coursesService.searchAll()` automatically cascades through all three tiers. The UI we want is **explicit user choice** — show local first, let the user opt into each external fallback. This is better UX because:
- Users see local results instantly without waiting for external API calls
- No surprise cost burn on external API quotas
- Clear mental model: "I searched Dormie's courses" vs "I asked the internet"

If Claude Code finds this friction too much and you'd accept automatic cascade (v1 behavior), `searchAll()` could be called directly and the dropdown would mix tiers with a badge ("From GolfCourseAPI" / "From Google Places"). I'd recommend trying the explicit-opt-in version first since it matches the UX described in the audit.

### Component structure

Create `src/components/trip/CourseLocationPicker.tsx`:

```typescript
interface CourseLocationPickerProps {
  value: Course | null;
  onChange: (course: Course | null) => void;
  placeholder?: string;
}

type FallbackStage = 'local' | 'golfApi' | 'places';

// Internal state
const [query, setQuery] = useState('');
const [results, setResults] = useState<Course[]>([]);
const [isSearching, setIsSearching] = useState(false);
const [stage, setStage] = useState<FallbackStage>('local');
const [exhaustedStages, setExhaustedStages] = useState<Set<FallbackStage>>(new Set());
```

### Supabase RPC for local search (may not be needed)

**First check if a search RPC or view already exists.** If `coursesService.search()` already uses a sufficient fuzzy-match query, no new migration is needed. If it uses a naive `ilike` with no ranking, create this migration:

`supabase/migrations/20260420_course_search_ranked.sql`:

```sql
create or replace function public.search_courses(p_query text, p_limit int default 10)
returns table (
  id uuid, name text, city text, state text,
  par int, slope int, rating decimal, photo_url text,
  match_rank int
)
language sql stable
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

Claude Code decides whether this migration is needed based on inspecting the existing `search()` implementation.

### Visual design

Dropdown container:
- Background: surface `#151312`
- Border: 1px `rgba(255,255,255,0.06)`
- Sharp edges
- Multi-layer shadow

Each result row:
- 56px height, 16px horizontal padding
- Course name: Georgia, 16px, `#E8E4DE`
- Location subtitle: system sans, 13px, `#8A857F`
- "+" icon: gold `#C9A227`, 24px, right-aligned
- Spring animation (friction 5) on selection
- Light haptic

Selected state:
- Gold left-border accent (3px, `#C9A227`)
- Green checkmark (Augusta green `#006747`)
- Course name in Georgia, city + state subtitle
- "×" on right to clear

Fallback rows:
- Vertical separator above
- Gold italic text: "Search GolfCourseAPI for '<query>'"
- Tap triggers next stage

### Acceptance criteria

- [ ] Typing "hilton" returns local Hilton Head courses instantly
- [ ] Debounce works (no search < 300ms from last keystroke)
- [ ] Local results appear within 500ms
- [ ] No local results → GolfCourseAPI fallback row visible
- [ ] User taps fallback → GolfCourseAPI results appear with loading state
- [ ] GolfCourseAPI selection creates local `courses` row via `ensureCourse()` with par/slope/rating, sets as selected
- [ ] GolfCourseAPI empty → Google Places fallback row visible
- [ ] Google Places selection creates partial courses row, toasts "Rating and slope will be filled when first played"
- [ ] Selected state: gold border + green checkmark + "×"
- [ ] `npx tsc --noEmit` passes

### Where to integrate

`app/create-trip.tsx` — replace Location field with `<CourseLocationPicker>`, wire `selectedCourse` state, pass `course_id` into the Create Trip handler's payload.

---

## Fix 3 — AddPlayerSheet with Friends, Recent, Invite (dual codes), Guest

### CRITICAL: Key reality adjustments from v2

1. **No existing `src/lib/invite.ts`.** Deep link system is fully new work. Create `src/lib/inviteLinks.ts` from scratch.
2. **No existing deep link listener in `app/_layout.tsx`.** Create `useTripInviteLinkListener` from scratch.
3. **`app.json` has `"scheme": "dormie"` but no `applinks:` associated domains.** We'll use `dormie://` custom scheme only for now. Universal links (https) are a v1.1 feature.
4. **`tripsService.addMembers()` only accepts `user_id` strings.** Guest support requires extending its signature after the `trip_members` guest migration lands.
5. **Dual invite system:** Trip Code (permanent, from `trips.invite_code`) + Share Link (expiring, from new `trip_invites` table).

### Component structure

Create `src/components/trip/AddPlayerSheet.tsx`:

```typescript
interface AddPlayerSheetProps {
  tripId?: string;                 // undefined during create flow
  tripName?: string;               // for the invite tab hero
  tripInviteCode?: string;         // the permanent code from trips.invite_code
  existingPlayers: Player[];
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

Use React Native `Modal` with `presentationStyle="pageSheet"`. Tab bar at top: sharp edges, teal active underline, muted inactive.

### Tab 1 — Friends

```typescript
const { user } = useAuth(); // or however auth is accessed in existing code
const friends = await friendsService.getActiveFriends(user.id);
```

- Reuse existing avatar component (check `src/components/` for pattern)
- Georgia serif name (16px), "8.0 HCP" subtitle (13px muted)
- Checkbox right-aligned, Augusta green fill when selected
- Existing trip players: opacity 0.4, disabled, "Already in trip" subtitle
- Search input at top (reuse search UX from `app/add-friends.tsx`)
- Empty state: "No friends yet. Add someone to your crew →" links to `app/add-friends.tsx`
- Light haptic on each toggle
- Bottom CTA: "Add X Players" (Augusta green, sharp edges) when count > 0

### Tab 2 — Recent

Requires new RPC. Add to `supabase/migrations/20260420_recent_co_players.sql`:

```sql
create or replace function public.get_recent_co_players(p_user_id uuid, p_days int default 90)
returns table (
  id uuid, name text, handicap_index decimal, avatar_url text,
  last_played_at timestamp, rounds_together int
)
language sql stable
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

Add service method to `src/services/trips.service.ts` or a new `src/services/coPlayers.service.ts`:

```typescript
export async function getRecentCoPlayers(userId: string, days = 90): Promise<CoPlayer[]> {
  const { data, error } = await supabase.rpc('get_recent_co_players', {
    p_user_id: userId,
    p_days: days,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}
```

Visual pattern matches Tab 1. Subtitle: "Played X times · Last round Y days ago".

### Tab 3 — Invite (Dual System)

**Hero section (always visible when tripId is set):**
- "DORMIE" brand header in Georgia
- Trip name in gold (from `tripName` prop)

**Section 1 — Trip Code (permanent, from `trips.invite_code`):**
- Label: "TRIP CODE" (uppercase, gold, 2-4px letter-spacing)
- Code displayed in Georgia 48px, centered (e.g., "ABCDEF")
- Subtitle: "Share with your crew — this code never expires"
- Single "Share" button using system share sheet:
  ```typescript
  Share.share({
    message: `Join my trip on Dormie: ${tripName}\n\nTrip code: ${tripInviteCode}\n\nDownload Dormie and enter the code to join.`,
    title: 'Join my Dormie trip'
  });
  ```
- Uses existing `tripsService.joinByCode()` on the receiving end

**Section 2 — Share Link (expiring):**
- Label: "SHARE LINK"
- If no link generated yet: "Generate Share Link" button
- On tap: calls new `tripInvitesService.createInvite(tripId)` which creates a row in `trip_invites`, then displays:
  - Link: `dormie://trip-invite/<code>` (6-char uppercase, different from permanent code)
  - Share button using `Share.share()` with prefilled text
  - Footer: "Expires in 7 days · Up to 8 uses"
- Multiple share links can exist per trip (one per invite moment)

**During create flow (no tripId):** Invite tab shows disabled state: "Create the trip first to generate an invite."

### Tab 4 — Guest

Form:
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

Guest players = `trip_members` rows with `user_id: null` + `guest_name` populated. Requires the migration below.

### Required migrations

**Migration A — `trip_invites` table:**

`supabase/migrations/20260420_trip_invites.sql`:

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
create index idx_trip_invites_trip_id on public.trip_invites(trip_id);

alter table public.trip_invites enable row level security;

create policy "Members can view invites for their trips"
  on public.trip_invites for select
  using (
    trip_id in (
      select trip_id from public.trip_members where user_id = auth.uid()
    )
  );

create policy "Members can create invites for their trips"
  on public.trip_invites for insert
  with check (
    trip_id in (
      select trip_id from public.trip_members where user_id = auth.uid()
    )
  );

-- RPC for joining via expiring invite
create or replace function public.join_trip_by_invite(p_code text)
returns uuid
language plpgsql security definer
as $$
declare
  v_invite public.trip_invites%rowtype;
  v_now timestamp with time zone := now();
begin
  -- Look up the invite
  select * into v_invite
  from public.trip_invites
  where code = upper(p_code);

  if v_invite.id is null then
    raise exception 'Invalid invite code';
  end if;

  if v_invite.expires_at < v_now then
    raise exception 'This invite has expired';
  end if;

  if v_invite.times_used >= v_invite.max_uses then
    raise exception 'This invite has reached its limit';
  end if;

  -- If already a member, return trip_id without incrementing usage
  if exists (
    select 1 from public.trip_members
    where trip_id = v_invite.trip_id and user_id = auth.uid()
  ) then
    return v_invite.trip_id;
  end if;

  -- Insert membership
  insert into public.trip_members (trip_id, user_id, rsvp_status, role)
  values (v_invite.trip_id, auth.uid(), 'confirmed', 'player');

  -- Increment usage
  update public.trip_invites
  set times_used = times_used + 1
  where id = v_invite.id;

  return v_invite.trip_id;
end;
$$;

grant execute on function public.join_trip_by_invite(text) to authenticated;
```

**Migration B — `trip_members` guest support:**

`supabase/migrations/20260420_trip_members_guest.sql`:

```sql
alter table public.trip_members
  alter column user_id drop not null;

alter table public.trip_members
  add column if not exists guest_name text;

alter table public.trip_members
  add constraint trip_members_user_or_guest
    check ((user_id is not null) or (guest_name is not null));
```

### Service additions

Create `src/services/tripInvites.service.ts`:

```typescript
import { supabase } from '../lib/supabase';

function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export const tripInvitesService = {
  async create(tripId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const code = generateCode();
    const { data, error } = await supabase
      .from('trip_invites')
      .insert({ trip_id: tripId, code, created_by: user.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async joinByInvite(code: string) {
    const { data, error } = await supabase.rpc('join_trip_by_invite', {
      p_code: code.toUpperCase(),
    });
    if (error) throw new Error(error.message);
    return data as string; // trip_id
  },

  async getByTrip(tripId: string) {
    const { data, error } = await supabase
      .from('trip_invites')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};
```

Extend `tripsService.addMembers()` to handle guest players. Current signature accepts `user_id` strings only. New signature:

```typescript
type AddMemberInput = { user_id: string } | { guest_name: string; handicap: number };

async addMembers(tripId: string, members: AddMemberInput[]) {
  const rows = members.map(m => ({
    trip_id: tripId,
    user_id: 'user_id' in m ? m.user_id : null,
    guest_name: 'guest_name' in m ? m.guest_name : null,
    handicap: 'handicap' in m ? m.handicap : null,
    rsvp_status: 'confirmed',
    role: 'player',
  }));
  const { data, error } = await supabase
    .from('trip_members')
    .insert(rows)
    .select();
  if (error) throw new Error(error.message);
  return data;
}
```

### Deep link handling (new work)

Create `src/lib/inviteLinks.ts`:

```typescript
import * as Linking from 'expo-linking';

export type ParsedInvite =
  | { type: 'trip-invite'; code: string };

export function parseInviteUrl(url: string): ParsedInvite | null {
  // dormie://trip-invite/ABCDEF
  const match = url.match(/dormie:\/\/trip-invite\/([A-Z0-9]{6})/i);
  if (match) return { type: 'trip-invite', code: match[1].toUpperCase() };
  return null;
}

export function getInviteUrl(code: string): string {
  return `dormie://trip-invite/${code}`;
}
```

Add to `app/_layout.tsx` (new hook):

```typescript
function useTripInviteLinkListener() {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = (url: string) => {
      const parsed = parseInviteUrl(url);
      if (!parsed) return;
      if (parsed.type === 'trip-invite') {
        router.push(`/trip-invite?code=${parsed.code}`);
      }
    };

    // Initial URL (cold start from link)
    Linking.getInitialURL().then(url => url && handleUrl(url));

    // Warm-state listener
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [router]);
}
```

Call the hook inside `RootLayoutNav` (or wherever app-level hooks live).

Create `app/trip-invite.tsx`:

```typescript
export default function TripInviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  // On mount: look up trip preview via code (NEW RPC could support preview-without-join)
  useEffect(() => {
    // Simplest approach: attempt join when user taps button, don't preview
    // Alternative: new RPC get_trip_by_invite_preview that returns trip name/members count without joining
  }, [code]);

  const handleJoin = async () => {
    setIsJoining(true);
    try {
      const tripId = await tripInvitesService.joinByInvite(code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ message: 'Joined trip!', type: 'success' });
      router.replace(`/trip-detail?id=${tripId}`);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast({ message: err.message, type: 'error' });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View style={{ backgroundColor: '#0D0A06', flex: 1 }}>
      <Text style={/* DORMIE hero */}>DORMIE</Text>
      <Text style={/* Trip invite kicker */}>TRIP INVITE</Text>
      <Text style={/* Code display */}>{code}</Text>
      <PrimaryButton onPress={handleJoin} loading={isJoining}>
        Join Trip
      </PrimaryButton>
    </View>
  );
}
```

### Acceptance criteria

- [ ] Sheet opens with spring animation, light haptic
- [ ] Friends tab loads via `friendsService.getActiveFriends(userId)`
- [ ] Existing trip players grayed out with "Already in trip" label
- [ ] Multi-select with running count
- [ ] Recent tab shows co-players from last 90 days via new RPC
- [ ] Invite tab shows Trip Code prominently
- [ ] Invite tab "Generate Share Link" creates `trip_invites` row
- [ ] Share button opens system share sheet via `Share.share()` — no custom Copy/SMS/Email buttons
- [ ] Guest tab adds player with `user_id: null` and `guest_name` populated
- [ ] `tripsService.addMembers()` handles mixed user_id and guest rows
- [ ] Deep link `dormie://trip-invite/XXXXXX` opens `app/trip-invite.tsx`
- [ ] Joining via expiring invite increments `times_used`
- [ ] Expired invites show "This invite has expired" toast
- [ ] Over-used invites show "This invite has reached its limit" toast
- [ ] Existing `joinByCode()` permanent flow still works (no regression)
- [ ] `npx tsc --noEmit` passes

---

## Implementation Order

Claude Code executes in this order, committing each phase as a separate commit:

**Phase 1 — Schema migrations (3 files):**
- `supabase/migrations/20260420_course_search_ranked.sql` (only if needed after inspecting existing search)
- `supabase/migrations/20260420_trip_invites.sql` (table + RLS + RPC)
- `supabase/migrations/20260420_trip_members_guest.sql` (guest column)
- `supabase/migrations/20260420_recent_co_players.sql` (RPC only)

Ian applies these via Supabase SQL Editor using the same pattern as the trip_leaderboard migration. Commit each as a separate commit.

**Phase 2 — Fix 1 (Create Trip button bugs):**
Smallest scope. Fixes the six existing bugs in the existing handler. Establishes toast + loading + haptic patterns.

**Phase 3 — Fix 2 (CourseLocationPicker):**
New component. Reuses `coursesService` methods. Integrated into `app/create-trip.tsx`.

**Phase 4 — Fix 3 Part A (AddPlayerSheet Friends + Recent + Guest):**
Core sheet + three tabs. Uses `friendsService.getActiveFriends()`. Creates `getRecentCoPlayers` service method. Extends `tripsService.addMembers()` for guest support.

**Phase 5 — Fix 3 Part B (Invite tab + deep link listener + trip-invite screen):**
Creates `tripInvitesService`, `src/lib/inviteLinks.ts`, adds `useTripInviteLinkListener` to `app/_layout.tsx`, creates `app/trip-invite.tsx`.

**Phase 6 — Integration + regression:**
Wire all three into `app/create-trip.tsx`. Run `npx tsc --noEmit`. Manually verify permanent invite code flow still works. Push.

---

## Commit Message Template

```
[Phase X of 6] Brief description

What changed:
- File-level bullet list

Why:
- Reference to docs/trips-p0-spec-v3-2026-04-19.md and discrepancy addressed

Integration with existing systems:
- [e.g., "Reuses coursesService.search() and searchAPI() — no new service wrappers"]
- [e.g., "Extends tripsService.addMembers() to accept guest rows post-migration"]

Testing:
- What was verified
```

---

## Definition of Done

- All 3 P0s resolved per acceptance criteria
- 4 migrations applied to Supabase and verified
- `npx tsc --noEmit` passes
- Ian manually walks Create Trip end-to-end on device: real course selected via autocomplete, friend-picker players added, side games + stakes set, Create Trip button succeeds, trip appears in Trips tab and trip-detail screen
- Trip Code flow still works (existing `joinByCode` — no regression)
- Trip Share Link flow works end-to-end (generate link → share → friend taps → joins trip)
- Guest player added successfully with null user_id + populated guest_name
- No silent catches anywhere
- All new components match Dormie design tokens exactly (bg `#0D0A06`, surface `#151312`, Augusta green `#006747`, gold `#C9A227`, Georgia serif)
- No new dependencies installed

---

## Hand-Off Prompt for Claude Code

```
Read docs/trips-p0-spec-v3-2026-04-19.md carefully. This version is 
corrected against the actual codebase per your earlier audit.

Before starting implementation:
1. Confirm the migrations directory path (supabase/migrations/)
2. Confirm Share import path for Share.share() (react-native)
3. Summarize the 6 phases in your own words
4. Flag any remaining discrepancies not addressed in v3

Then implement in the order specified. Commit each phase separately. 
Push when all 6 phases complete.
```

---

*End of v3 spec. Validated against actual codebase. Ready for implementation.*
