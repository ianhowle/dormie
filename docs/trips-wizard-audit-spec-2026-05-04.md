# Trip Wizard Audit — Next Session Plan

**Date created:** 2026-05-04
**Phase reference:** "Audit gap" from `docs/trips-product-vision-2026-05-03.md`
**Estimated time:** 60-90 minutes focused walkthrough + diagnosis
**Goal:** Validate end-to-end that all three trip types (Quick / Plan Ahead / Ryder Cup) work correctly through the create-trip wizard. Surface bugs and missing functionality before beta testers do.

---

## Why This Session

Across two days of build sessions, we've shipped most of the priority Trips features. But we've never deliberately validated:

1. **Plan Ahead trip type** end-to-end. Has not been touched in any deliberate audit since April backend work.
2. **Ryder Cup trip type** end-to-end. April had a backend audit (`docs/trips-audit-2026-04-19.md`) but the frontend post-Trips work may have introduced drift.
3. **Each scoring format** in the wizard — does selecting "stableford" actually produce a stableford-scored trip?
4. **Each side game** in the wizard — does selecting "skins" actually track skins?
5. **The quality of the wizard itself** — does the flow feel premium across all three trip types?

This is the highest beta risk remaining. Inviting Kara or Drew to use Plan Ahead or Ryder Cup without validation is the kind of gap that produces immediate uninstalls.

---

## The Three Trip Types — Current State

For reference before audit:

**Quick Trip:** single course, single round, fast wizard. Most validated path because it's what we built and tested through the create-trip stabilization work this session. Probable status: working well.

**Plan Ahead:** multi-course, multi-day trip with course assignments per day. Significantly more complex wizard. Status: untested post-Trips work.

**Ryder Cup:** team-based competitive format with captains, teams, format alternating across days. Most complex of the three. Backend audited in April; frontend status unknown.

---

## CRITICAL: Read Before Auditing

Reference these files for context but DO NOT modify anything during the audit phase. This is diagnosis, not execution.

1. `app/create-trip.tsx` — the wizard itself
2. `src/data/scoring.ts` — confirm what scoring formats exist
3. `src/data/trips.ts` — side game definitions
4. `docs/trips-audit-2026-04-19.md` — original backend audit
5. `docs/trips-frontend-audit-2026-04-19.md` — original frontend audit
6. `docs/trips-p0-spec-v3-2026-04-19.md` and `v3.1-patch-2026-04-19.md` — implementation specs
7. `docs/trips-ux-audit-plan-2026-05-03.md` — the audit framework with 9 quality dimensions

---

## Audit Method

Walk through each trip type on the phone systematically. For each, capture:

- **What works** — concrete examples
- **What's broken** — specific bugs with reproduction steps
- **What's confusing** — UX friction even when functional
- **What's missing** — features users would expect that don't exist
- **What feels premium** — moments that hit the elite bar
- **What feels cheap** — moments that betray "demo-grade" implementation

Output is a prioritized findings document, not code changes. Fixes happen in follow-on sessions.

---

## Audit Sequence

### Phase 1 — Quick Trip Regression Check (~15 minutes)

We know this works. We're confirming nothing broke during recent Trips changes.

**Walkthrough:**
1. Open Trips tab → tap + New Trip → select Quick Trip
2. Walk through every wizard step:
   - Trip name entry
   - Course picker (test autocomplete with 3+ characters, test the catalog match, test free-text fallback to GolfCourseAPI/Google Places)
   - Number of players selector (2 / 4 / 6 / 8)
   - Scoring format radio list — try selecting EACH format, note any that visually break or seem confusing
   - Side games checkboxes — try selecting EACH, note any that seem to lack explanation
   - Stakes input
   - Add Player → exercise Friends, Recent, Invite, Guest tabs
   - Create Trip button
3. Verify the resulting trip detail screen renders correctly
4. Take screenshots of any quirks

**Specifically test:**
- Trip created with stroke_play scoring → trip detail shows "SP" format correctly (the format label fix from earlier work)
- Trip created with side games selected → trip detail shows those games in "Games on the Line" section
- Trip created with NO side games → trip detail hides the "Games on the Line" section entirely

**Output:** Quick Trip regression findings (likely thin — this should be solid)

### Phase 2 — Plan Ahead End-to-End (~25 minutes)

This is the highest-uncertainty trip type. Walk through it carefully.

**Walkthrough:**
1. Open Trips tab → tap + New Trip → select Plan Ahead
2. Note the wizard differences from Quick Trip — what fields appear that aren't in Quick Trip?
3. Walk through every step:
   - Multi-day date range picker
   - Multi-course assignment (a course per day? a course pool?)
   - Tee times if that's part of it
   - Scoring format applied per round or trip-wide?
   - Side games applied per round or trip-wide?
   - Members
   - Anything else specific to Plan Ahead
4. Submit the wizard
5. Verify the resulting trip detail shows all the data correctly:
   - Multiple courses listed in the Courses tab?
   - Per-day breakdown anywhere?
   - Trip Info row counts (Format / Rounds / Games / Players) match what was selected?
6. If anything looks broken, screenshot and document specifics

**Open questions to resolve during audit:**
- Does Plan Ahead actually create a multi-round trip in Supabase, or does it create a single trip with metadata?
- Does the trip-detail screen handle multi-course display correctly?
- Does the scoring engine know how to handle multi-round trips? (this connects to scoring audit eventually)

**Output:** Plan Ahead bug list with severity ratings

### Phase 3 — Ryder Cup End-to-End (~25 minutes)

Most complex flow. April had a backend audit; frontend may have drift.

**Walkthrough:**
1. Open Trips tab → tap + New Trip → select Ryder Cup
2. Walk through team setup:
   - Captain assignment(s)?
   - Team color selection?
   - Player-to-team assignment?
3. Walk through format setup:
   - Format per day (foursomes, four-ball, singles)?
   - Points scoring system?
4. Walk through scheduling:
   - Multi-day support?
   - Course assignments per day?
5. Submit wizard
6. Verify resulting trip detail:
   - Does it show team affiliations on player avatars?
   - Does it show format breakdown by day?
   - Does the Trip Info row reflect Ryder Cup correctly (FORMAT shows "RC"? PLAYERS shows total?)
7. Also test: does the existing Ryder Cup demo trip ("The McGowan Cup," "The Sullivan Cup") render correctly post-Trips changes?

**Specifically validate against the April audit findings:**
- The 11 critical issues flagged in `docs/trips-audit-2026-04-19.md` — were they fixed? Are any back?
- Schema gaps in `seasons-audit-2026-04-19.md` since Ryder Cup ties to Seasons logic — out of scope for this audit but flag if Ryder Cup behavior implies a Seasons gap

**Output:** Ryder Cup bug list with severity ratings, plus comparison to April audit findings

### Phase 4 — Scoring Format Selection Audit (~10 minutes)

For each scoring format that appears in the wizard, verify the user-facing experience:

**For each of:** stroke_play, total_strokes, match_play, stableford, mod_stableford, best_ball, scramble (and any others)

- Is there explanatory text or just the format name?
- Does the UI tell the user what this format means?
- Can a non-golfer understand the difference between "stroke play" and "total strokes"?
- Are any formats fundamentally broken in selection (radio not registering, etc.)?

**Note:** This is wizard-level UX audit, NOT scoring-engine validation. The April scoring audit (`docs/scoring-audit-2026-04-19.md`) addressed the math. We're auditing whether users can understand what they're selecting.

**Output:** Scoring format selection findings — likely many small copy/explanation gaps

### Phase 5 — Side Game Audit (~10 minutes)

Same approach for side games:

**For each of:** Skins, Nassau, Dots, Snake, Wolf, and any others

- Is there explanatory text?
- Can users understand what they're selecting?
- Do they render correctly when selected (visual states)?
- Does the trip detail show them properly when the trip is created?

**Output:** Side game selection findings

### Phase 6 — Per-Round Share Card Verification (~10 minutes)

Ian flagged uncertainty about whether Dormie produces post-round share cards.

**Walkthrough:**
1. Find an existing round in Dormie (or create one for testing — even a 9-hole quick round works)
2. After completing the round, what does the user see?
3. Is there a share button or share card?
4. What's the visual quality?
5. How does it compare to what a trip recap card would need to look like?

**Output:** Confirm or deny existence of post-round share cards. Document visual quality and gaps.

This connects to `docs/dormie-cinematic-exploration.md` — the post-trip recap should match the visual language of post-round cards.

---

## Severity Tagging

For every finding, tag with:

- **P0:** Blocks beta launch. User flow completely broken or produces wrong outcome.
- **P1:** Should fix before beta. Confusing UX, missing functionality users would expect, visual bugs.
- **P2:** Post-beta polish. Refinement opportunities, minor copy issues.
- **P3:** Future feature work. Things missing that aren't expected at this stage.

Plus effort tag:

- **S:** Under 30 minutes
- **M:** Under 2 hours
- **L:** Dedicated session

---

## Output Document Structure

After the audit, write a findings doc at `docs/trips-wizard-audit-findings-2026-XX-XX.md` with:

```markdown
# Trip Wizard Audit Findings

## Quick Trip
- [P-tier / Effort tag] Finding description
- [P-tier / Effort tag] Finding description
...

## Plan Ahead
[same format]

## Ryder Cup
[same format]

## Scoring Formats (wizard UX)
[same format]

## Side Games (wizard UX)
[same format]

## Post-Round Share Cards
[same format]

## Recommended Fix Sequence
1. P0 items first (in order of dependency)
2. P1 items second
3. P2 items in batches
```

This doc becomes the input for follow-on fix sessions.

---

## Post-Audit Decisions

Once the findings are compiled:

**If 0-2 P0 issues:** schedule fixes for one focused session, ship before any other Trips polish.

**If 3-5 P0 issues:** more concerning. Consider whether Trips is truly beta-ready or whether the audit gap was bigger than expected.

**If 6+ P0 issues:** Trips needs another deliberate stabilization arc before beta. The post-audit conversation becomes strategic, not tactical.

**For all P1 issues:** prioritize against beta foundations and decide what's pre-beta vs. post-beta.

---

## Hand-Off Prompt for Claude Code (Next Session)

Paste this at session start:

```
Read docs/trips-wizard-audit-spec-2026-05-04.md carefully. We're conducting a deliberate end-to-end audit of all three trip types in the create-trip wizard. This is diagnosis, not implementation.

Your role: I'll walk through each trip type and the scoring format / side game selections on my phone. I'll share screenshots and observations. You document findings against the severity/effort framework.

Don't write any code yet. Read the spec, confirm the audit method, then wait for me to start the walkthrough on phone.

Output for the session: a prioritized findings document at docs/trips-wizard-audit-findings-2026-XX-XX.md (use today's date) with P0/P1/P2/P3 + S/M/L tags, organized by trip type and feature.
```

---

## Definition of Done — Next Session

- [ ] All three trip types walked through end-to-end on phone
- [ ] Scoring format wizard UX audited
- [ ] Side game wizard UX audited
- [ ] Post-round share card existence confirmed/denied
- [ ] Findings document written with severity + effort tags
- [ ] At least one P0 fix shipped same session if any are found and small enough
- [ ] Recommended fix sequence documented
- [ ] Confidence level (high/medium/low) on Trips readiness for beta clearly stated

---

*End of audit spec. The audit is the highest-value diagnostic remaining before beta. The output guides every Trips-related session that follows.*
