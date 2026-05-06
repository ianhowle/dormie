# Trip Creation Wizard — Philosophy + Implementation Spec

**Date created:** 2026-05-05
**Scope:** Quick Trip + Plan Ahead wizard redesign. Ryder Cup deferred to dedicated follow-up session.
**Phase reference:** Outcome of trip-creation philosophy session
**Estimated time:** Multi-session work — Phase 1 foundations (4-6 hours), Phase 2 Quick Trip (3-4 hours), Phase 3 Plan Ahead (4-5 hours)
**Goal:** Replace the current bottom-of-form-style trip creation with a structured wizard that designs the trip experience rather than just logging data, while triggering immediate social momentum on launch.

---

## Strategic Context

This spec emerged from a strategic session where Ian questioned whether the current Quick Trip wizard was the right flow at all. The answer was no — the wizard was data-capture-shaped when it should be experience-design-shaped. This spec defines the new philosophy and applies it to Quick Trip and Plan Ahead.

**Companion docs:**
- `docs/dormie-strategy.md` — strategic context
- `docs/trips-product-vision-2026-05-03.md` — Trips workstream vision
- `docs/dormie-design-dna.md` — design language reference
- `docs/trips-wizard-audit-spec-2026-05-04.md` — original audit plan that surfaced this redesign

---

## Philosophy

### What trip creation IS

Trip creation is fundamentally **(B) Designing the experience**, with **(C) Starting social momentum** as the immediate downstream payoff.

It is NOT (A) Logging an upcoming event. Pure logging produces transactional flows that capture data but don't help users make good trips. Pure social momentum without structure produces trips that feel half-baked. The combination — guide the user through experience-shaping decisions, then immediately fire social momentum on completion — produces trips that feel both intentional and exciting.

### Three user personas

Trip creation serves three distinct mental models:

**Persona 1 — The Booker (50-60% of trips at beta launch):**
Already has trip details mostly decided. Course, dates, players known. Wants to capture the trip and start trash-talk in group chat. Optimization: speed and respect for context.

**Persona 2 — The Planner (20-25%):**
Has the dream but not the plan. "Thinking about Pinehurst in October." Wants Dormie to help shape the trip — see options, learn about courses, get sensible recommendations. Optimization: guidance and education.

**Persona 3 — The Annual Repeater (15-25%, growing over time):**
Plans the same trip every year. Just needs to refresh it. Optimization: duplication and minimal friction. Mostly served by existing "Duplicate Trip" feature (Item 8 long-press); wizard provides the entry point.

### Universal wizard DNA

All three trip types (Quick Trip, Plan Ahead, Ryder Cup) share the same underlying wizard philosophy. They differ in scope and depth, not in soul.

- **Quick Trip:** 7 steps, ~60-90 seconds for a Booker
- **Plan Ahead:** 9-10 steps with multi-day extensions, ~3-5 minutes
- **Ryder Cup:** 10-12 steps with team-formation theater (deferred — designed in follow-up session, refinement-not-rebuild approach)

Quick Trip is for trips you've already designed (in your head). Plan Ahead is for trips you're still designing. Same quality bar.

---

## Universal Wizard Structure

The 7-step skeleton with a persona fork at entry. Quick Trip uses all 7. Plan Ahead expands Steps 1, 2, 4, 5, 6 with multi-day options.

### Step 0 — Entry (Persona Fork)

When user taps "+ New Trip":

```
What's this trip?

  [ Quick round or short getaway ]    → Quick Trip flow
  [ Multi-day trip planning ]         → Plan Ahead flow
  [ Team competition (Ryder Cup) ]    → Ryder Cup flow

Or repeat a past trip:
  [ Pinehurst Oct 2025 → Plan again ] → Duplicate flow (only shown if history exists)
```

Eliminates the "select trip type from a list" feel. Each option is described in user-mental-model terms. The Annual Repeater path bypasses the wizard entirely via Duplicate.

**Visual treatment:** Three large tappable cards stacked vertically, each with brief description. Background dark surface, light haptic on tap. The Duplicate option appears as a subtle link or recent-trips suggestion below.

### Step 1 — Where (Location-First Course Selection)

Single autocomplete field with intelligent multi-mode behavior:

- User types course name → matches Dormie catalog → selected with ✓ indicator
- User types city/state/region → returns courses in that area as suggestions
- User taps "Browse destinations" link → opens Dream Board–style destination browser
- User free-texts a course not in catalog → falls back to GolfCourseAPI/Google Places lookup

**Smart defaults by persona:**

- **Quick Trip (Booker):** Below the input, show "Recently played" list (last 5 courses user has created trips at). Single tap to select.
- **Plan Ahead (Planner):** Below the input, show Dream Board destinations + "Popular trip destinations" (curated list).
- **Annual Repeater:** Pre-fill the course from the duplicated trip.

**Sponsorship integration (architecture, content deferred to v1.5+):**

The destinations table already has `is_sponsored` and `sponsored_until` columns. Sponsored courses get prioritized placement in suggestions with a subtle "Featured" gold badge. Never deceptive — clearly marked as sponsored. The mechanism is in place at v1; rich sponsored content layered in once content team produces it.

**Educational layer (architecture, content deferred to v1.5+):**

Each course suggestion can include a one-line educational note:

- "Donald Ross original — Sandhills' most iconic"
- "Top 100 Public — best for groups of 4+"
- "Recently renovated greens (2024)"

Each region can include area context:

- "Pinehurst is the heart of American golf — 40+ courses within 30 minutes"
- "Charleston has links-style coastal courses with year-round playable weather"

Initial implementation: architecture supports a `description` and `region_note` field on destinations and courses. Empty strings render no callout. Content team populates over time. Mechanism present from v1; rich copy ships in v1.5+.

**Plan Ahead extension:** After the user picks a primary destination/course, optionally add additional courses for multi-day trips. UI: "Add another course" button after first selection, repeatable up to N courses. Each additional course can have its own location intelligence.

### Step 2 — When (Date Intelligence)

Two modes:

- **Specific dates** (Booker default): start/end date picker. Quick Trip uses single date; Plan Ahead/Ryder Cup use date range.
- **Window** (Planner default): pill picker — "Next 30 days" / "This summer" / "October-ish" / "Custom"

User can switch modes via toggle: "I have specific dates" / "Still flexible." Same field, two presentations.

**Smart defaults:**

- **Quick Trip (Booker):** Defaults to today's date for Today's round, future dates for upcoming rounds.
- **Plan Ahead (Planner):** Defaults to "Window" mode with current month suggestion.
- **Annual Repeater:** Pre-fills last year's date range, prompts to adjust.

**Plan Ahead extension:** Date range picker. If multi-course trip, show course-per-day assignment after dates are chosen (e.g., "Day 1 — Pinehurst No. 2 / Day 2 — Pinehurst No. 4 / Day 3 — Tobacco Road").

### Step 3 — Who (Member Selection)

The current AddPlayerSheet UX is mostly correct but should be a discrete wizard step, not buried at the bottom of a form.

**Tab structure:**
- **Friends** (multi-select from Dormie friends list)
- **Recent** (people you've played with recently — quick-add chips)
- **Invite** (phone number or email — sends invitation when trip is created)
- **Guest** (no Dormie account, just a name — for one-off players)

**Smart defaults:**

- **Quick Trip:** Pre-fills "Just me." Prominent "Add players" CTA. Solo rounds are valid.
- **Plan Ahead:** Empty state, prompts to add players for trip planning.
- **Annual Repeater:** Pre-fills last year's group with edit-in-place to remove/add.

**Plan Ahead extension:** Optional member roles or designations (organizer, captain, treasurer for stakes settlement). Implemented as optional metadata, not required.

### Step 4 — How (Format Selection)

This is where today's wizard fails hardest. The redesign uses a B+D combined pattern.

**Layout:**

```
How do you want to play?

  ─── Your most-used ───
  [✓] Stroke Play         ⓘ
       "Total score, lowest wins"

  ─── Other formats ───
  [ ] Match Play          ⓘ
       "Hole-by-hole, head-to-head"
  [ ] Stableford          ⓘ
       "Earn points based on score"
  [ ] Best Ball (team)    ⓘ
       "Best score per hole counts"
  [ ] Scramble (team)     ⓘ
       "All play, best shot, repeat"
  [ ] Mod Stableford      ⓘ
       "Points-based with modified scoring"
  [ ] Total Strokes       ⓘ
       "Aggregate strokes across multiple rounds"

  [ Help me choose ] →
```

**Recent at top (D pattern):** First section shows 1-2 formats user has used most recently. Single-tap selection. For first-time users with no history, this section gracefully degrades to "Most popular with Dormie golfers" using aggregate data (likely stroke play + match play at top).

**Educated list below (B pattern):** Full list of available formats with one-line description visible inline. Each has an ⓘ icon that opens a modal with full explanation, example scoring, when to use it, complexity rating.

**Help me choose link (C escape hatch):** Opens a 3-question sub-flow:

1. How competitive is the group? (Casual / Mixed / Serious)
2. Team or individual? (Each for themselves / Pairs / Bigger teams)
3. Simple or interesting scoring? (Just count strokes / Something more dynamic)

→ Recommends a format with rationale: "We recommend Stableford — it rewards aggressive play and works well for mixed-handicap groups." Single-tap accept or "Show me other options" returns to the list.

**Plan Ahead extension:** Format-per-day option. After selecting a primary format, an optional toggle: "Use a different format on different days?" If yes, show a per-day matrix:

```
Day 1 — Pinehurst No. 2: Stroke Play     ⓘ
Day 2 — Pinehurst No. 4: Match Play       ⓘ
Day 3 — Tobacco Road:    Best Ball         ⓘ
```

### Step 5 — Side Games (Optional Spice)

Same B+D pattern as Step 4. Multi-select.

**Layout:**

```
Add side games? (optional)

  ─── Your most-used ───
  [✓] Skins              ⓘ

  ─── Other games ───
  [ ] Snake              ⓘ
  [ ] Wolf               ⓘ
  [ ] Bingo Bango Bongo  ⓘ
  [ ] 3 Putt Poker       ⓘ
  [ ] Nassau             ⓘ
  [ ] Dots               ⓘ

  [ Help me pick a game ] →
  [ Skip side games ]
```

ⓘ icons open the same disclosure modal pattern. "Help me pick" runs a similar 2-3 question sub-flow tuned for side game selection (How fun-vs-serious / How simple-vs-complex / Group of friends or strangers).

**Skip option:** Some trips don't have side games. The "Skip side games" link confirms that explicitly so users don't feel obligated.

**Plan Ahead extension:** Side games per day if formats vary by day. Same matrix UI as Step 4.

### Step 6 — Stakes (Per-Game with Adjustability)

Replaces the current single-stake field. ONE stake input per selected game/format.

**Layout:**

```
Set the stakes (optional)

  ╔═══════════════════════════════╗
  ║ Stroke Play                    ║
  ║ $ [   20  ] per player          ║
  ║ Winner takes all                ║
  ║ [ Change to: split top 3 ]      ║
  ╚═══════════════════════════════╝

  ╔═══════════════════════════════╗
  ║ Skins                          ║
  ║ $ [   1   ] per skin            ║
  ║ Carry-over: ☑                   ║
  ╚═══════════════════════════════╝

  [ Skip stakes — handle offline ]
```

Each game has its own stake input + game-specific configuration:

- **Stroke Play:** dollar amount per player + payout structure (winner takes all / split top 3)
- **Skins:** dollar per skin + carry-over toggle
- **Match Play:** dollar per match
- **Stableford:** dollar per point (or fixed payout per place)
- **Nassau:** front 9 / back 9 / total amounts
- **Wolf:** dollar per hole won
- **Bingo Bango Bongo:** dollar per achievement

**Smart defaults:** Sensible suggested amounts based on format ($20 stroke play / $1 skin / $5 match play). User adjusts to taste.

**Adjustability mechanic:** Critical design decision — stakes are EDITABLE in trip detail until the round starts. After wizard completion, a "Stakes" panel in trip detail shows current configuration with edit-in-place. Group can renegotiate up to tee-off. When scoring begins, stakes lock with explicit "Stakes locked at start of round" copy.

**At trip end:** Automatic settlement calculation per agreed stakes. No more whiteboard math at the bar. (Settlement engine itself is separate work — schema must support it from this spec onward.)

**Plan Ahead extension:** Stakes per day if formats vary. Same matrix UI.

### Step 7 — Confirm and Launch

The social momentum payoff. Three components.

**Component 1: Trip card preview**

```
╔══════════════════════════════════════╗
║  PINEHURST OCT 2026                   ║
║  ────────────────────────────────     ║
║  Pinehurst Resort • Oct 15-17          ║
║  4 players • Stroke Play + Skins       ║
║                                        ║
║  [Edit trip details →]                 ║
╚══════════════════════════════════════╝
```

Georgia serif title, Augusta green accents, sharp edges (per design DNA). Subtle "Edit" link allows last-minute corrections without dropping out of the flow.

**Component 2: Invite preview**

```
INVITING

  Drew Sullivan          via Dormie
  Jake Patterson         via Dormie
  Tommy Chen             via SMS — (615) 555-0123
                         (Tap to copy invite link)

  [Add another player →]
```

Each row shows how that person will receive the invite. Dormie users get push notifications and in-app invites. Non-Dormie users get SMS (in v2 once Twilio integration ships) or "Copy invite link" fallback in v1.

**Component 3: Launch button (or save as draft)**

Two paths:

```
[ Save as draft ]                [ Create trip & invite all → ]
```

**Create & invite all (primary path):**
- Single tap creates the trip in Supabase (status = 'active')
- Invitations fire to all selected members
- Group chat for the trip activates
- Brief Dormie Moment celebration animation plays (3-5 seconds, dismissable)
- Lands user on the trip detail screen

**Save as draft (alternative path):**
- Trip is created in Supabase with status = 'draft'
- Visible only to creator (RLS-enforced)
- No invitations fire
- Lands user on a "Draft saved" confirmation with options to edit, publish later, or delete
- Drafts appear in a "Drafts" section at the top of Trips list (dimmed visual treatment)

**Schema implication:** `trips` table needs a `status` column with values:
- `draft` — only visible to creator, no invitations
- `active` — visible to all members, invitations fired
- `completed` — past trips (existing behavior)
- `cancelled` — explicitly cancelled trips (out of scope for this spec but reserved)

Migration needed.

**The Dormie Moment celebration:**

```
[ Full-screen modal with gradient bg ]

🏌️ TRIP LAUNCHED

PINEHURST OCT 2026
Drew, Jake, Tommy invited

[ Tap to view trip ]
```

Gold corner brackets per design DNA. Georgia serif numerals. Masters green gradient background. Light pinstripe overlay. Subtle haptic on launch. Auto-dismiss after 4 seconds OR tap to dismiss. Lands on trip detail.

This moment is what makes trip creation feel like an event, not data entry. It's the (C) Social Momentum payoff baked into the wizard.

---

## Implementation Phasing

This is significant work. Phase it carefully.

### Phase 1 — Foundations (4-6 hours)

Build the reusable infrastructure that all three trip types will use.

1. **Migration:** Add `status` column to `trips` table with values `draft / active / completed / cancelled`. Default `active` for backwards compatibility. RLS policies for draft visibility.

2. **InfoDisclosureModal component:** Reusable modal for ⓘ icon explanations. Props: title, description, example, complexity rating, when-to-use copy. Same component used across formats and side games.

3. **Format/SideGame data layer:** Extend `src/data/scoring.ts` and `src/data/trips.ts` (or wherever side games live) with:
   - Display name
   - One-line description (for inline list)
   - Full description (for ⓘ modal)
   - Example scoring scenario
   - Complexity rating
   - When-to-use copy

   Content for all current formats and side games. This is mostly copywriting work but lives in code as data.

4. **Recent/most-used queries:** New service methods in `tripsService` or `userService`:
   - `getRecentFormats(userId, limit=2)` — formats user has used most recently
   - `getRecentSideGames(userId, limit=2)` — same for side games
   - Fallback to aggregate "most popular" data when user has no history

5. **HelpMeChoose sub-flow component:** Reusable 2-3 question wizard for guided format/side-game selection. Props: questions array, recommendation logic. Same component, different question sets for format vs. side game.

6. **PerGameStakeInput component:** Reusable per-game stake input with game-specific config (carry-over toggle for skins, payout structure for stroke play, etc.). Props: gameType, defaultAmount, configOptions.

7. **TripCardPreview component:** Reusable preview card for the confirm step. Props: trip object. Renders in the same visual style as the Trips list card.

8. **InvitePreview component:** Lists planned invitations with delivery method indicators (Dormie push / SMS / copy link).

9. **DormieMomentTripLaunched component:** New cinematic moment for trip launch. Reuses existing Dormie Moment infrastructure with new copy and styling.

   **Deferred to a separate Claude Design pass (decided 2026-05-05).** The Trip Launched moment is design-driven (sound, animation choreography, gradient palette tuning) and benefits from a focused design conversation rather than implementation alongside the structural foundations. Phases 1.1–1.8 ship the structural pieces; 1.9 lands when the design pass produces a concrete spec. Consumer code in Phase 2 (Quick Trip wizard's Step 7 launch button) will stub the Trip Launched call until 1.9 ships.

### Phase 2 — Quick Trip (3-4 hours)

Rebuild the Quick Trip wizard using Phase 1 foundations.

1. Replace current Quick Trip wizard at `app/create-trip.tsx` (or split into a new `app/create-trip-quick.tsx` if cleaner).

2. Implement Steps 0–7 per spec. Quick Trip uses single-day variant.

3. Wire to Phase 1 components.

4. Implement persona fork at Step 0 with three trip type cards + duplicate fallback.

5. Test all paths on phone:
   - Booker fast path (recent course → recent format → recent side games → standard stakes → invite all)
   - Planner path (browse destinations → help me choose format → skip side games → save as draft)
   - First-time user (no history → "popular with Dormie golfers" defaults → educated list selection)

### Phase 3 — Plan Ahead (4-5 hours)

Extend the wizard for multi-day trips.

1. Add multi-day extensions at Steps 1, 2, 4, 5, 6:
   - Step 1: "Add another course" button after first selection
   - Step 2: Date range mode + per-day course assignment matrix
   - Step 4: "Use different format on different days?" toggle + per-day matrix
   - Step 5: Side games per day (optional, only if formats vary)
   - Step 6: Stakes per day (optional, only if formats vary)

2. Build the per-day matrix UI components (reusable for course/format/side game/stakes).

3. Test all paths on phone:
   - 3-day trip with single course (most common Plan Ahead pattern)
   - 3-day trip with multiple courses, same format every day
   - 3-day trip with different format/games per day (most complex)
   - Save-as-draft flow (likely common for Plan Ahead users still figuring it out)

### Phase 4 — Ryder Cup migration (deferred to dedicated session)

Separate spec to be written after Phase 1-3 ship. Migration approach:
- Keep Ryder Cup's structural bones (captain assignment, team draft, team identity, format-per-day matrix)
- Layer in the universal patterns (info disclosure, location-first, per-match stakes, smart defaults)
- Estimated 2-4 hours of focused refinement work after Phase 1 foundations exist

---

## Acceptance Criteria

### Phase 1 (Foundations)
- [ ] `status` column migration applied
- [ ] InfoDisclosureModal renders correctly with all formats and side games
- [ ] Format/side game data layer fully populated
- [ ] Recent/most-used queries return expected results (with fallback for new users)
- [ ] HelpMeChoose sub-flow renders and recommends sensibly
- [ ] PerGameStakeInput renders correctly for all game types with appropriate config options
- [ ] TripCardPreview matches Trips list card visual
- [ ] InvitePreview correctly indicates delivery method per player
- [ ] DormieMomentTripLaunched plays correctly with sound design and haptics
- [ ] All Phase 1 components pass `npx tsc --noEmit`

### Phase 2 (Quick Trip)
- [ ] Persona fork at entry routes correctly
- [ ] All 7 wizard steps function end-to-end
- [ ] Smart defaults populate appropriately for Booker / Planner / Annual Repeater paths
- [ ] Save as draft creates trip with status='draft', visible only to creator
- [ ] Create & invite all creates trip with status='active', invitations fire (push immediately, SMS as copy-link fallback in v1)
- [ ] DormieMomentTripLaunched plays after Create & invite all
- [ ] Trip detail screen renders correctly post-creation
- [ ] All formats and side games tested through wizard
- [ ] Per-game stakes calculated and displayed correctly in trip detail

### Phase 3 (Plan Ahead)
- [ ] Multi-day date range works correctly
- [ ] Per-day course assignment renders and saves
- [ ] Per-day format variation toggle works
- [ ] Per-day side games variation works
- [ ] Per-day stakes variation works
- [ ] All variation matrices save correctly to Supabase
- [ ] Plan Ahead trips render correctly in Trips list and trip detail
- [ ] Save as draft works for Plan Ahead

---

## Edge Cases

- **User starts wizard, abandons mid-flow:** Wizard state should persist if they return within session. New session = empty wizard. Don't auto-create draft from abandonment (creates clutter).
- **User selects 0 friends + 0 invites + 0 guests:** Solo trip should be valid (Quick Trip Booker default). Trip detail shows just the user.
- **Single course + multi-day trip:** Common pattern. Wizard should default Day 1 = course, Day 2 = same course, Day 3 = same course (auto-fill matrix).
- **User saves as draft, then later wants to create:** "Drafts" section in Trips list. Tapping a draft re-opens the wizard pre-filled. Tapping "Create & invite all" from there transitions status to 'active' and fires invitations.
- **User pre-fills from Annual Repeat, but original trip's course is no longer in catalog:** Show warning, prompt to re-select course. Don't silently fail.
- **User adds non-Dormie guest with no phone number:** Trip created, guest appears as a name-only player. No invitation fires. They get included in scoring but don't have a Dormie account. (Existing behavior, preserve.)
- **Settlement calculation for non-monetary stakes:** Some groups play "for nothing" or "for trash talk." If user skips stakes entirely, no settlement panel renders at trip end. Just leaderboards.

---

## What's NOT In Scope

To keep this spec focused:

- Twilio integration for automated SMS invites (v2)
- Sponsored course content layer (v1.5+)
- Educational copy for courses and regions (v1.5+)
- Full Settlement engine (separate spec — schema supported here, calculations elsewhere)
- Ryder Cup wizard migration (separate session per Phase 4)
- Trip checklist persistence (separate beta foundation work)
- Real-time chat in trip detail (separate post-beta work)
- Historical trip recap features (post-beta cinematic exploration)

---

## Open Strategic Questions (Decide During Build)

These are decisions that became apparent during spec writing but don't need to be resolved before implementation begins.

1. **Wizard navigation pattern:** Linear (back button only) vs. progressive disclosure (jump between steps from a sidebar)? Linear is simpler. Progressive disclosure is more flexible. Recommendation: Linear for v1, evaluate progressive for v1.5+.

2. **Wizard persistence:** Save mid-flow state to Supabase or just session-state? Session-state is simpler. Supabase persistence allows cross-device wizard continuation but adds complexity. Recommendation: Session-state for v1.

3. **Default format for first-time user:** Stroke Play is most universal. But for Dormie's premium positioning, maybe Match Play or Stableford to feel more "golf insider"? Recommendation: Stroke Play default, but make Match Play/Stableford feel equally first-class in the educated list.

4. **Plan Ahead "single course, multi-day" auto-fill:** Should the wizard assume single course unless user explicitly adds another, or always show "add courses" upfront? Recommendation: Single course default, "Add another course" button after first selection.

5. **Stakes "skip" implications:** If user skips stakes, settlement panel doesn't render at trip end. Should we show a clear callout in trip detail saying "No stakes set — handle settlement offline" so users aren't confused? Recommendation: Yes, small "No stakes" indicator in trip detail.

---

## Hand-Off Prompt for Claude Code

Paste this at the start of next implementation session:

```
Read docs/trips-wizard-redesign-spec-2026-05-05.md carefully. This is a multi-phase implementation. We're starting with Phase 1 (Foundations) only.

Goal: build the reusable infrastructure that Quick Trip and Plan Ahead wizards (Phases 2-3) will use. No wizard work yet — just the foundations.

Before writing code:
1. Read the spec end-to-end, not just Phase 1
2. Read the related docs:
   - docs/trips-wizard-audit-spec-2026-05-04.md
   - docs/trips-product-vision-2026-05-03.md
   - docs/dormie-design-dna.md
3. Read the current implementation files:
   - app/create-trip.tsx (current wizard)
   - src/data/scoring.ts (formats data)
   - src/data/trips.ts (side games and trip data)
   - src/services/trips.service.ts
4. Summarize the Phase 1 plan in your own words
5. Flag any assumptions in the spec that don't match the codebase

Then implement Phase 1 incrementally:
1. Migration first (status column)
2. Data layer extensions (format/side game descriptions)
3. Service methods (recent/most-used queries)
4. UI components in order: InfoDisclosureModal → HelpMeChoose → PerGameStakeInput → TripCardPreview → InvitePreview → DormieMomentTripLaunched

Run npx tsc --noEmit after each component. Commit incrementally — one commit per logical chunk (e.g., "Add status column migration", "Add format/side game data layer").

Pause for review after migration applies and after each major component lands. Don't run-on-build the entire phase without checkpoints.
```

---

## Notes on Process

- This spec was written after a strategic conversation that questioned whether Quick Trip's flow was right at all. The audit was reframed mid-session into a philosophy session. The output of that session is this spec.
- Three trip types share the same DNA (philosophy locked: B + C — designing experience + social momentum).
- Quick Trip and Plan Ahead are designed first; Ryder Cup migrates the proven patterns later in a focused refinement session.
- Phase 1 foundations are the highest-leverage work because they enable both Quick Trip and Plan Ahead — and eventually the Ryder Cup migration.
- This is multi-session work. Do not attempt to ship all phases in a single session.

---

*End of spec. The wizard is the front door of Dormie. Getting this right makes every trip ever created in the app feel intentional and exciting.*
