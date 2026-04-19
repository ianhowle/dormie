# Dormie Trips Feature Audit

**Date:** 2026-04-19
**Scope:** Full trips pipeline — creation wizard, member management, trip-to-scoring bridge, rounds aggregation, chat, moments, post-trip summary, Ryder Cup variant
**Status:** Read-only investigation. No code changes made.

---

## 1. TRIP CREATION FLOW

### Files Audited
- `app/create-trip.tsx` — 3-step wizard for quick/planned trips (~600 lines)
- `src/services/trips.service.ts` — Trip CRUD service (~120 lines)
- `src/data/trips.ts` — Type definitions + mock data (~116 lines)
- `src/lib/database.types.ts` — Supabase-generated schema (source of truth)

### Findings

**🔴 CRITICAL — TripForm drops side_games, stakes, and players on save**
`create-trip.tsx:573-581` — The wizard collects side games (Set), stakes (string), and a players array, but `tripsService.create()` is called with only `name`, `location`, `start_date`, `end_date`, `organizer_id`, `trip_type`, and `format`. The other fields are silently lost. Players added during wizard setup are never inserted into `trip_members`. The Ryder Cup wizard handles this correctly; quick/planned trips do not.

**🔴 CRITICAL — Empty catch block swallows all creation errors**
`create-trip.tsx:582` — `catch {}` with no logging, no user feedback. Success toast and `router.back()` execute regardless of whether the trip was actually created. User believes the trip was saved even on network or constraint failures.

**🟡 WARNING — No date validation**
`create-trip.tsx:576-577` — Accepts malformed dates ("abc", "2026-99-99"), does not check `endDate >= startDate`, and defaults both to today's date if empty. Past dates accepted for planned trips.

**🟡 WARNING — Organizer auto-add not transactional**
`trips.service.ts:27-33` — After trip creation, the organizer is inserted into `trip_members` in a separate query. If this insert fails (constraint violation, RLS issue), the trip exists without an organizer member. No rollback, no error surfaced.

**🟡 WARNING — Hardcoded test user in player list**
`create-trip.tsx:206` — Initial player is `{ id: '1', name: 'Ian McGowan', handicap: 8 }` instead of the authenticated user. Carries into production data if players are eventually saved.

**🟡 WARNING — playerCount collected but ignored**
`create-trip.tsx` — Player count (2-12) is selected via pills but never used. The manually-added players list can have any number of entries regardless of selection.

**⚪ NOTE — No trip name length limit**
No max length validation on the name input. DB may have constraints but UI does not enforce them.

**⚪ NOTE — Type mismatch between trips.ts and database.types.ts**
`src/data/trips.ts` uses camelCase (`startDate`, `destination`, `createdBy`) while the DB schema uses snake_case (`start_date`, `location`, `organizer_id`). The `trips.ts` types appear to be stale mock types not used in the creation flow.

---

## 2. MEMBER MANAGEMENT

### Files Audited
- `src/services/trips.service.ts` — invite, join, RSVP, addMembers methods
- `supabase/migrations/005_trips.sql` — trip_members schema + RLS
- `supabase/migrations/007_rpc_functions.sql` — `join_trip_by_code` RPC
- `app/trip-detail.tsx` — Member display UI

### Findings

**🔴 CRITICAL — No member removal UI exists**
`app/trip-detail.tsx` — Members are displayed in the roster but there is no remove/kick button or action sheet. The RLS policy (005_trips.sql:167-176) allows organizer deletion, and direct Supabase calls would work, but no UI surface exists for it.

**🟡 WARNING — inviteMember() method defined but never called**
`trips.service.ts:82-87` — Creates a `trip_members` row with `rsvp_status: 'pending'`. No UI triggers this method. The only way to add members is via invite code or the Ryder Cup wizard's `addMembers()`.

**🟡 WARNING — Invite codes never expire**
`005_trips.sql:14` — Code generated via `upper(substr(md5(random()::text), 1, 6))` at trip creation. No TTL, no expiration column, no revocation mechanism. Codes are permanent and guessable (6 uppercase hex chars = ~16M combinations). No rate limiting on code attempts.

**🟡 WARNING — Removed member's rounds orphaned silently**
`005_trips.sql` — Foreign key `rounds.trip_id` uses `ON DELETE SET NULL`. When a member is removed, their rounds remain in the DB but `trip_id` is nulled out, removing them from trip standings without notification.

**✅ PASS — Invite code join RPC is safe**
`007_rpc_functions.sql:6-35` — `join_trip_by_code` uppercases input, validates code exists, checks for existing membership (idempotent), and creates `trip_members` row with `confirmed` status. Duplicate joins return trip_id without error.

**✅ PASS — RSVP status management**
`trips.service.ts:72-79` — Updates `rsvp_status` scoped to user's own membership via RLS. Supports `confirmed`, `pending`, `declined`.

---

## 3. TRIP-TO-SCORING BRIDGE

### Files Audited
- `app/trip-detail.tsx` — "Score Hole-by-Hole" navigation (~line 2379)
- `app/score.tsx` — Score setup with optional trip linking (~1700 lines)
- `src/scoring/useScoringState.ts` — tripId param handling (lines 67, 109, 736)
- `src/services/rounds.service.ts` — Round creation with trip_id

### Findings

**🔴 CRITICAL — Direct scoring nav from trip passes only tripId, no course or players**
`trip-detail.tsx:2379` — `router.push({ pathname: '/scoring', params: { tripId: trip.id } })`. This bypasses the score setup screen entirely. The scoring screen receives no course, no players, no format — just a trip ID. Players default to the hardcoded `[{ id: '1', name: 'Ian McGowan', handicap: 8 }]`. Course data is empty. The round is technically linked to the trip but has no meaningful context.

**🟡 WARNING — Score setup "Link to Trip" exists but disconnected**
`score.tsx:1593-1651` — The setup screen has a "LINK TO" section where users can select a trip. When a trip is linked, `tripId` is included in router params (line 1289). However, linking a trip does NOT pre-populate the course from `trip_courses` or the player list from `trip_members`. The user must manually configure everything.

**🟡 WARNING — Trip's course not propagated to scoring context**
No code path exists to query `trip_courses` and auto-fill the scoring setup when starting a round from within a trip. The trip may have courses added (via wizard), but they're display-only.

**🟡 WARNING — Trip's member roster not propagated to scoring context**
No code path fetches `trip_members` to pre-populate the player picker when scoring from a trip. Users must manually re-enter all players.

**✅ PASS — trip_id correctly persisted on round save**
`useScoringState.ts:736` — `...(tripId ? { trip_id: tripId } : {})` conditionally includes trip_id in the round insert. Offline queue also preserves tripId (line 839).

**✅ PASS — Rounds without trip context work independently**
When `tripId` is null, the spread operator produces no `trip_id` field, and the round is created as a standalone. No errors or side effects.

---

## 4. TRIP ROUNDS AGGREGATION

### Files Audited
- `supabase/migrations/007_rpc_functions.sql` — `get_trip_leaderboard` RPC (lines 98-128)
- `app/trip-detail.tsx` — Competition leaderboard display (lines 1874-1893)
- `src/services/trips.service.ts` — `getLeaderboard()` method

### Findings

**🔴 CRITICAL — Aggregation is stroke-play-only, ignores trip format**
`007_rpc_functions.sql:98-128` — `get_trip_leaderboard` always sums `gross_score` and sorts ascending. The `trips.format` column is stored but never consulted. A Stableford trip aggregates gross scores instead of points. A match play trip sums stroke totals instead of match results. Only stroke play produces correct standings.

**🟡 WARNING — No tiebreaker logic**
`get_trip_leaderboard` sorts by `total_gross ASC` only. Ties are resolved by arbitrary database row order. No secondary sort (best round, head-to-head, scoring average) and no tiebreaker UI.

**🟡 WARNING — Net score calculated client-side with simple formula**
`trip-detail.tsx:1880-1883` — Net is computed as `total - (handicap × roundsPlayed)`. This is a rough stroke-play approximation, not a WHS-compliant per-hole handicap allocation. Differs from the per-hole net calculation used in individual scoring (useScoringState.ts:148-162).

**🟡 WARNING — Incomplete rounds included in aggregation**
`007_rpc_functions.sql` — No `status` or `is_complete` filter. If a round record exists with `trip_id` set, it's included in the sum regardless of whether all 18 holes were scored. The `rounds.gross_score` is `NOT NULL`, so partial rounds must have some score to exist, but it may be inaccurate.

**✅ PASS — RPC function returns useful metrics**
Returns `total_gross`, `total_net`, `rounds_played`, `best_round`, `scoring_avg` per player. Sufficient for a basic leaderboard.

**✅ PASS — Null-safe client sorting**
`trip-detail.tsx:1874-1876` — Players with `total === null` are sorted to the bottom.

---

## 5. TRIP CHAT

### Files Audited
- `src/services/messages.service.ts` — Trip message CRUD + real-time (~80 lines)
- `src/services/chat.service.ts` — Group chat (richer feature set, ~150 lines)
- `src/hooks/useGroupChat.ts` — Group chat hook with pagination (~95 lines)
- `app/trip-detail.tsx` — Chat tab UI (lines 789-833)

### Findings

**🟡 WARNING — Real-time messages arrive without user name**
`trip-detail.tsx:819` — When a new message arrives via Supabase real-time, `userName` is set to `''` (empty string). Initial fetch correctly joins user data (`m.user?.name`), but the subscription callback receives raw payload without the join. Other users' messages display with a blank name until the component remounts.

**🟡 WARNING — Reactions are client-only, never persisted**
`trip-detail.tsx` — Reaction toggle UI is fully implemented with emoji selection, but reactions are stored only in local React state. No Supabase call is made. Reactions vanish on refresh or for other users. The group chat service has `toggle_message_reaction` RPC, but trip messages don't use it.

**🟡 WARNING — Unread badge hardcoded to 3**
`trip-detail.tsx:1847` — `const [unreadChat] = useState(3)`. Not connected to actual unread count. `chatService.getUnreadCount()` and `chatService.markAsRead()` exist but are never called in the trip context.

**🟡 WARNING — No pagination, limited to 50 messages**
`messages.service.ts` — Fetches last 50 messages with no "load more" mechanism. Group chat (`useGroupChat.ts`) has proper cursor-based pagination, but trip messages do not. Long-running trips will lose message history from the UI.

**⚪ NOTE — No offline message queuing**
`src/lib/offline.ts` defines a `'send_message'` pending action type, but no handler is registered. Failed sends show an alert but are not retried.

**⚪ NOTE — Two separate chat implementations**
Trip messages use `messages.service.ts` (basic text, no attachments, no replies, no edits). Group chat uses `chat.service.ts` (attachments, replies, soft deletes, edit tracking, reactions). Feature parity gap may confuse users.

**✅ PASS — Real-time subscription lifecycle correct**
`trip-detail.tsx:789-833` — Effect sets up subscription with `messagesService.subscribe()`, uses `cancelled` flag for unmount safety, and calls `messagesService.unsubscribe()` in cleanup. Duplicate detection via `prev.some((m) => m.id === newMsg.id)`.

**✅ PASS — Chat scoped to trip correctly**
Queries filter by `trip_id`, and real-time channel is scoped with `trip_id=eq.${tripId}`. No cross-trip message leakage.

---

## 6. TRIP MOMENTS

### Files Audited
- `supabase/migrations/005_trips.sql` — `trip_moments` table (lines 75-85)
- `src/services/moments.service.ts` — Moment CRUD
- `src/components/DormieMoment.tsx` — 16 moment types + modal display (~250 lines)
- `src/scoring/moments.ts` — Moment detection logic (~103 lines)

### Findings

**🟡 WARNING — Trip moments (memories) and Dormie Moments (achievements) are disconnected**
`trip_moments` table stores user-created text+photo memories. `DormieMoment` component handles automatic in-game achievements (DORMIE, SKINS_JACKPOT, CUP_CLINCHED, etc.). There is no mechanism to persist a DormieMoment achievement to the `trip_moments` table. Scoring achievements fire as ephemeral modals and are not recorded in trip history.

**🟡 WARNING — WORST_PUTTER moment type defined but never triggered**
`DormieMoment.tsx:46` — Declared in the moment config map but no code in `moments.ts` or `useScoringState.ts` ever fires it.

**✅ PASS — DormieMoment share card functional**
`src/components/share/DormieMomentCard.tsx` — Renders premium card via `react-native-view-shot`, with text-only fallback via native `Share.share()`. Format: `"{LABEL}\n{playerName}\n{detail}\n\nvia Dormie"`.

**✅ PASS — Trip moments CRUD complete**
`moments.service.ts` — `create()`, `getByTrip()` (with user join, ordered by `created_at desc`), and `delete()`. RLS-enabled. Index on `(trip_id, created_at desc)` for performance.

---

## 7. POST-TRIP SUMMARY

### Files Audited
- `app/trip-detail.tsx` — "Finish Trip" flow (lines 2330-2370)
- `supabase/migrations/007_rpc_functions.sql` — `get_trip_leaderboard` RPC
- `src/services/trips.service.ts` — `update()` for status change

### Findings

**🟡 WARNING — Post-trip summary is an Alert dialog, not a dedicated screen**
`trip-detail.tsx:2355-2362` — Finishing a trip calls `tripsService.update(trip.id, { status: 'completed' })`, then displays a native `Alert.alert()` with winner name, course count, and best round. No cinematic summary screen, no animation, no share card. Contrast with the Ryder Cup completion view which has a full cinematic (gradient background, trophy, animated score reveal).

**🟡 WARNING — No automatic trip completion on end date**
Trip status transitions (`planning → upcoming → active → completed`) require the organizer to manually press "Finish Trip". A trip with `end_date: '2026-04-01'` remains `active` indefinitely until the button is pressed.

**🟡 WARNING — tripCompleted state is UI-local, not persisted**
`trip-detail.tsx` — The `tripCompleted` flag controls competition mode exit but is React state only. If the user refreshes or another member views the trip, the completion context is lost. Only `trip.status === 'completed'` in the DB is persistent, but the post-trip summary Alert only fires on the button press, not on re-visiting a completed trip.

**⚪ NOTE — No trip share card**
Individual rounds have share cards (PostRoundSummary). DormieMoments have share cards. Trips have no share card for overall results.

**✅ PASS — Status update is correct**
`trips.service.ts` — `update()` method patches trip record via Supabase. Status transition to `'completed'` is a simple field update with RLS enforcement.

---

## 8. RYDER CUP TRIP VARIANT

### Files Audited
- `src/components/RyderCupWizard.tsx` — 7-step setup (~2,139 lines)
- `src/components/RyderCupHub.tsx` — Execution dashboard (~2,100 lines)
- `src/components/CaptainsPairings.tsx` — Pairing UI (~450 lines)
- `src/components/DormieMoment.tsx` — CUP_CLINCHED type

### a. Wizard Setup (7 Steps)

**✅ PASS — Step flow is complete**
Steps: Welcome → Basics → Teams → Courses → Schedule → Formation → Players → Review. All required data collected. Review screen shows full summary before launch.

**✅ PASS — Team size options are always even**
Team size pills: 4, 6, 8, 10, 12. No odd numbers offered. Auto-calculates `perSide`, `maxSessions`, `estimatedPoints`.

**🟡 WARNING — No session count validation**
Step 4 allows 0 sessions to pass through. A Ryder Cup with no scheduled sessions creates a trip with nothing to score.

**🟡 WARNING — firstToTarget has no upper bound check**
Step 2 — If `winCondition === 'first_to'`, the target can exceed total possible points. E.g., `estimatedPoints = 12` but `firstToTarget = 30` is accepted. Cup becomes unwinnable.

### b. Team Formation

**✅ PASS — Three formation methods implemented**
Captain's Picks (manual red/blue assignment), Auto-Balance (snake by handicap), Snake Draft (alternating picks with turn indicator). All three persist via `tripsService.addMembers()`.

**✅ PASS — Auto-balance algorithm correct**
`RyderCupHub.tsx:1406-1418` — Players sorted by handicap ascending. Snake-style assignment: R, B, B, R, R, B... Produces balanced teams by interleaving best-worst.

**✅ PASS — Draft completion validation**
`canConfirm = redTeam.length === maxPerSide && blueTeam.length === maxPerSide`. Cannot proceed until teams are full.

### c. Match Pairings

**✅ PASS — CaptainsPairings suggest-optimal logic**
`CaptainsPairings.tsx` — "Suggest Optimal Pairings" pairs lowest handicap with highest. Captain-only view shows assignment controls; viewer sees read-only pairings.

**✅ PASS — Format-specific pairing sizes**
Foursomes/Four-Ball/Scramble: 2v2 pairings. Singles: 1v1. Match count auto-calculated from `perSide` and format.

### d. Session Scoring

**✅ PASS — Hole-by-hole match scoring implemented**
`RyderCupHub.tsx:1136-1532` — `RCMatchScoring` component handles per-hole score entry for all formats. Foursomes: one score per team. Four-Ball: individual scores, best-of-two used. Singles: one score per player.

**✅ PASS — Match status computation correct**
`RyderCupHub.tsx:226-262` — `computeMatchStatus()` correctly derives status from hole results: `AS` (all square), `X UP`, `DORMIE` (lead equals remaining holes), `HALVED`, `FINAL` (lead exceeds remaining). Winner determined when `lead > holesRemaining`.

**✅ PASS — Match point values correct**
Win = 1 point, Halved = 0.5 points each, Loss = 0 points. Session score is sum of all match points.

### e. Points Aggregation & Cup Clinching

**✅ PASS — Tournament total aggregation correct**
`RyderCupHub.tsx:1859-1862` — `redTotal = sessions.reduce((s, ss) => s + (ss.redScore ?? 0), 0)`. Sums session scores across all completed sessions.

**✅ PASS — Win threshold calculation correct**
`RyderCupHub.tsx:1864-1867` — First-to mode uses `rcConfig.firstToTarget`. Most-points mode uses `totalPoints / 2 + 0.5` (majority needed). Handles both win conditions.

**✅ PASS — CUP_CLINCHED moment triggers correctly**
`RyderCupHub.tsx:1869-1886` — Detects winner when `redTotal >= winThreshold` or `blueTotal >= winThreshold` (first-to), or when all sessions complete and one team leads (most-points). Also handles mid-tournament math clinch. Triggers `DormieMoment` type `CUP_CLINCHED` with team name and final score.

**✅ PASS — Completion cinematic is premium**
`RyderCupHub.tsx:1537-1633` — Full-screen gradient (red, blue, or gold for tie), trophy emoji, winner name in large text, final score display. Auto-persists results to `ryder_cup_config` JSON: `winner`, `finalScore`, `matchResults`.

**🟡 WARNING — Pairings are ephemeral (React state only)**
Pairings exist in component state and are converted to matches immediately. If the app crashes between pairing creation and match reveal, pairings are lost. Only finalized matches are persisted via `ryder_cup_config`.

**🟡 WARNING — No sit-out logic for odd player count within a session**
If a captain assigns fewer players than match slots require, the UI allows proceeding with empty pairing slots. No warning or enforcement.

**⚪ NOTE — 9-hole match point halving**
When `nineHoleMatches` is enabled, each 9-hole section is worth 0.5 points (not 1). The `getPointsForFormat()` function doubles match count for half points. Logic is correct but may confuse users without explanation.

**⚪ NOTE — No 4-team variant**
Despite the audit scope mentioning 4-team sessions, the codebase implements 2-team only (Red vs Blue). No multi-team bracket or round-robin structure exists.

---

## SUMMARY

| Area | 🔴 Critical | 🟡 Warning | ⚪ Note | ✅ Pass |
|------|------------|-----------|--------|--------|
| Trip Creation | 2 | 4 | 2 | 0 |
| Member Management | 1 | 3 | 0 | 2 |
| Trip-to-Scoring Bridge | 1 | 3 | 0 | 2 |
| Rounds Aggregation | 1 | 3 | 0 | 2 |
| Trip Chat | 0 | 4 | 2 | 2 |
| Trip Moments | 0 | 2 | 0 | 2 |
| Post-Trip Summary | 0 | 3 | 1 | 1 |
| Ryder Cup Variant | 0 | 4 | 2 | 11 |
| **Total** | **5** | **26** | **7** | **22** |

---

## TOP 3 PRIORITIES

### 1. Fix trip creation to save side_games, stakes, and players
**Severity:** 🔴 CRITICAL — Data loss on every quick/planned trip creation
**Files:** `create-trip.tsx:573-581` (pass all collected fields to service), `trips.service.ts` (insert players into `trip_members` after trip creation)
**Impact:** Three fields are collected in the wizard UI but silently dropped. Players must be re-invited via code after creation. Side games and stakes are lost permanently. The Ryder Cup wizard handles this correctly — the quick/planned path needs parity.

### 2. Fix trip leaderboard to respect scoring format
**Severity:** 🔴 CRITICAL — Wrong standings for non-stroke-play trips
**Files:** `007_rpc_functions.sql:98-128` (branch aggregation by `trips.format`), `trip-detail.tsx:1874-1893` (format-aware sorting)
**Impact:** `get_trip_leaderboard` hardcodes `SUM(gross_score) ORDER BY ASC`. Stableford trips should sum points (higher is better). Match play trips should aggregate match results. Any non-stroke-play trip produces meaningless standings.

### 3. Bridge trip context into scoring flow
**Severity:** 🔴 CRITICAL — "Score from trip" produces empty round
**Files:** `trip-detail.tsx:2379` (pass course + player params), `score.tsx` (pre-populate from trip context), `useScoringState.ts:109-111` (consume trip course/members)
**Impact:** Tapping "Score Hole-by-Hole" from a trip navigates directly to `/scoring` with only `tripId`. No course, no players, no format. The round starts with a hardcoded test player and no course data. Users must back out and manually set up the round via the Score tab instead.
