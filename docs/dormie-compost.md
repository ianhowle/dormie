# Dormie Compost Pile

**Purpose:** Capture every idea, observation, half-thought, feature concept, competitor note, beta tester comment, and stray insight as soon as it surfaces. Do NOT organize. Do NOT act on. Just append.

**Cadence:** Review every 3-4 weeks. Each item gets one of three fates:
- Promote to a real spec or strategy doc section
- Demote to deletion (no longer relevant)
- Re-compost (still interesting, not actionable yet)

**Format:** One line per item. Date-stamped. New entries at the top.

---

## Active Compost

- 2026-05-20 — TIER 2 SCORING DE-DUPLICATION TRACKING (rolling list — fold into the audit's Tier 2 dedup workstream)

  Rolling list of code-level duplications introduced or unresolved during scoring engine work. Per the audit (docs/audits/2026-05-17-scoring-engine-audit.md §3 + Tier 2), duplicate scoring logic is a real bug surface — silent divergence between two copies has bitten Stableford already.

  Currently tracked:
  - isGreenInRegulation duplicated in src/data/scoring.ts (copied from src/scoring/calculations.ts:49 to avoid ThemeContext JSX import breaking ts-node when the test runner compiles data/scoring). Consolidate when the ts-node/import boundary is resolved — likely extract pure GIR helper to a JSX-free module both can import.
  - Hogans 4-condition definition (calculateHogansCount) is over-specified — FIR + GIR + 2-putt mathematically implies par-or-better in standard scoring. The fourth check (gross <= par) is harmless but redundant. Matches the stated SIDE_GAMES definition; trim when re-examining at consolidation time.
  - (Pre-existing from audit) 3 Stableford implementations: calculateStablefordPoints (handicap-aware orphan), calculateStablefordFromRound (gross-only season path), test-file inline copy. See audit §3a.
  - (Pre-existing from audit) Match Play × 2: calculateMatchPlay (general) vs evaluateMatch (Ryder Cup, pre-resolved hole records). See Match Play architecture compost entry — intentional domain split, NOT urgent.
  - (Pre-existing from audit) 6-6-6 segment "match_play" mode collides naming-wise with the match_play format key. See audit §3c. Rename to mp_segment or head_to_head_low_high before wiring match_play as a primary format.

  PRE-BETA PRIORITY: LOW. None of these cause active bugs; they're maintenance debt. Address as a single focused "Tier 2 de-dup" session after the Phase 5 + 6 work lands.

- 2026-05-20 — ONE-BALL FORMAT SCORE-ENTRY UX + GUIDANCE (design workstream, pairs with team-handicap cluster)

  Covers the score-entry model and in-round guidance for one-ball team formats: Scramble, Chapman/Pinehurst, and upcoming Alternate Shot + Greensomes. These share a shape, so design ONCE for the family, not per-format.

  ALREADY-DECIDED (from earlier design sessions — confirm still current when building):
  - Score entry uses TEAM TABS instead of player tabs; one score entry per team per hole
  - Setup reuses the Best Ball team-selection UI, relabeled per format ('SCRAMBLE TEAMS', 'CHAPMAN TEAMS')
  - In-round screen shows a team indicator banner with a hint: 'Enter team score' (Scramble), 'Alternate shot' (Chapman)
  - Leaderboard shows team vs team; side games apply at team level

  OPEN QUESTIONS raised (need decisions before/during the UI wiring pass):

  1. UI-model vs engine-shape reconciliation (Chapman): Earlier design = 'enter one team score per hole like Scramble.' But the Chapman engine (calculateChapmanHoleScore) computes 2 + alternateShots and keys on an alternateShots count, not a raw team score. Decision needed: either (a) UI collects team total and converts (alternateShots = teamScore − 2), or (b) simplify the engine to take a team score directly like calculateScrambleTeamScore. Pairs with the ChapmanHoleScore dead-data finding (5 of 6 struct fields unused).

  2. Data collection depth — do we ask 'whose drive was used' / capture drive + second-shot detail, or just the team number? Tradeoff: richer capture future-proofs stats + makes the round feel engaged + un-deads the dead ChapmanHoleScore fields, BUT adds per-hole friction and collects data nothing currently consumes. Lean for beta: collect the minimum the engine needs (one team number); treat shot-level capture as a deliberate later feature only if a specific stat/feature wants it. Revisit if product vision wants shot-level detail from day one.

  3. Guidance placement — these formats are confusing (most golfers don't play Chapman regularly). Recommended pattern: TEACH AT SETUP (brief format explainer when the format is selected in the wizard — natural teaching moment, nobody's mid-round) + INLINE REFERENCE (tappable '?' / expandable hint at score entry for whoever forgot). AVOID per-hole tutorial prompts (friction trap). The existing 'Alternate shot' banner hint IS a lightweight version of inline reference — question is whether Chapman needs a fuller setup explainer given its complexity.

  4. Scramble likely needs LESS guidance than Chapman — scramble is intuitive (everyone hits, take the best, play from there). Chapman/Alt Shot/Greensomes are the confusing ones. Guidance depth should scale with format complexity, not be uniform across the family.

  PAIRS WITH:
  - The team-handicap cluster compost (Scramble + Chapman team-scalar handicap, blocked on formula decision) — same family of formats, same 'decide once' opportunity. A single focused session could resolve team-handicap formulas AND score-entry-UX AND guidance for the whole one-ball family at once.
  - Alternate Shot + Greensomes (Phase 4 roadmap) — design the score-entry + guidance pattern to cover these before building them, so they inherit the family treatment rather than getting bespoke flows.

  PRE-BETA PRIORITY: MEDIUM. The formats render gross team totals and function for beta; this workstream is about making them clear and well-guided, which matters for the 'full scope, everything visible' decision (a visible-but-confusing format is a poor experience).

- 2026-05-20 — CHAPMAN TEAM-HANDICAP ENGINE + ChapmanHoleScore DEAD-DATA FIELDS (blocked on product decisions)

  Phase 2 added tests for calculateChapmanHoleScore + calculateChapmanTotal (committed 22a98ea) but did NOT add a calculateNetChapmanTotal wrapper. The Chapman engine breaks the Tier 1 wrapper template the same way Scramble did — both use a one-ball team-scoring model where the team plays a single ball from shot 3 onward, so there is no per-player score to apply per-hole strokes to. The roadmap (docs/scoring-completion-roadmap.md Phase 2) listed Chapman as "wrap-and-test"; investigation found it is "test-and-compost like Scramble." Roadmap decision-log update flagged for next session.

  TWO BLOCKED DECISIONS:

  A. CHAPMAN TEAM-HANDICAP ENGINE
     Chapman handicap is a TEAM-LEVEL SCALAR applied at the trip total, not per-hole. USGA standard is 60% of low partner + 40% of high partner. Some clubs use 50/50, some use handicap-differential allowances. This is a NEW engine, not a wrapper around the existing trivial sum.

     Blocked on:
     1. Which formula — USGA 60/40 standard, 50/50, differential-based, or configurable per trip?
     2. Configurable vs hardcoded — does the trip organizer pick percentages, or is one default fine?
     3. Gross-only vs trip-flag-driven — does every Chapman trip compute a handicap, or only when a "use handicap" trip flag is set?
     4. Where the handicap is computed and stored — at trip creation, at round finalize, at display only?

     PAIRS NATURALLY WITH the composted Scramble team-handicap workstream (same one-ball-model problem, same team-scalar shape, same blocking decisions). Worth tackling in a single "team-handicap formats" focused session that handles both Chapman and Scramble together.

  B. ChapmanHoleScore DEAD-DATA FIELDS — design question affecting score-entry UI
     The ChapmanHoleScore struct collects 6 fields but the engine math (return 2 + hole.alternateShots) consumes only 1 of them:

     | Field | Used by engine? |
     | driveA | ❌ Dead (always 1 stroke by golf rules) |
     | driveB | ❌ Dead |
     | secondShotA | ❌ Dead |
     | secondShotB | ❌ Dead |
     | selectedBall ('A' \| 'B') | ❌ Dead — engine doesn't care which ball was picked |
     | alternateShots | ✅ Used (the only field that affects the result) |

     Test 10.3 ("DEAD-DATA LOCK") locks this contract — passing garbage (NaN, -42, 999) into the 5 unused fields still yields a deterministic 2 + alternateShots result. Tripwire for any future dev who adds reliance on those fields.

     Pre-beta design questions when Chapman score-entry UI gets built:
     1. Drop the dead fields from the struct? (cleanest schema)
     2. Keep them for stats tracking — drive distance, fairway hits, etc.? (richer data, but requires defining the semantic)
     3. Repurpose for a richer Chapman variant — e.g., scoring quality of drives/second shots? (engine change, not data-only)

     Affects the score-entry UI design directly: which numbers do we ask the team scorekeeper to record per hole? Today the answer is "alternateShots only" but the struct shape suggests we should ask for more.

  C. PINEHURST VARIANT QUESTION (one-line note, part of the Chapman-cluster decision set)
     SCORING_FORMATS describes pinehurst as "Same engine as Chapman" but adds: "Some clubs use Pinehurst and Chapman interchangeably; others differ on when the ball is selected." The current engine doesn't differentiate — both pinehurst and chapman map to the same calculateChapmanHoleScore call. If the variant difference ever matters, that's a deeper engine change. Nothing to act on yet; flag is part of the Chapman-cluster decision set so it gets considered when (A) and (B) get decided.

  PRE-BETA PRIORITY: MEDIUM. Chapman trips will display correctly with gross totals via the render pass (calculateChapmanTotal works). Adding handicap is a polish item, not a correctness blocker. The dead-data question matters when score-entry UI is designed — that's a Phase 1+ task in the roadmap. Pinehurst variant is informational only.

- 2026-05-20 — SCRAMBLE TEAM-HANDICAP ENGINE (separate workstream, blocked on formula decision)

  Session 2B added tests for calculateScrambleTeamScore (trivial sum) and validateScrambleScore (real validator logic) but did NOT add a calculateNetScrambleTeamScore wrapper. The Tier 1 handicap-conversion template (subtract per-player per-hole strokes → delegate) doesn't fit scramble: the team plays one ball and posts one score per hole — there is no per-player score to apply strokes to.

  Scramble handicap is a TEAM-LEVEL SCALAR applied at the trip total, not per-hole. The USGA standard is a size-dependent fractional formula:
  - 2-player team: 35% of low handicap + 15% of high
  - 3-player team: 20% low + 15% middle + 10% high
  - 4-player team: 20% lowest + 15% + 10% + 5% highest

  Then team net = team gross − team handicap. This is a NEW engine, not a wrapper around the existing trivial sum.

  BLOCKED ON PRODUCT DECISIONS:
  1. Which formula to ship — USGA standard, custom Dormie variant, or configurable per trip?
  2. Configurable vs hardcoded — should the trip organizer pick percentages, or is one default fine?
  3. Gross-only vs trip-flag-driven — does every scramble trip compute a handicap, or only when a "use handicap" trip flag is set?
  4. Where the handicap is computed and stored — at trip creation, at round finalize, at display only?

  PAIRS WITH:
  - The future render-pass work (Tier 1 PostRoundSummary integrations) — scramble display needs to either show gross only (no handicap) or surface a team handicap somewhere. That decision drives the engine shape.
  - The fourball composition note (above) — both are about how multi-player team formats surface results without a per-player wrapper. Worth tackling in the same focused session.

  PRE-BETA PRIORITY: MEDIUM. Scramble trips will display correctly with gross totals out of the box (calculateScrambleTeamScore works). Adding handicap is a polish item, not a correctness blocker. Decide after the more pressing renders land.

- 2026-05-20 — FOURBALL WIRING = DISPLAY-LAYER COMPOSITION (no new engine needed)

  When the render pass arrives for Four-Ball trips, the implementation is composition of two existing wrappers, NOT a new scoring engine. For each team, call calculateNetBestBall(team.playerScores, team.handicapStrokesPerPlayer) to get teamScorePerHole, then feed the two teams' teamScorePerHole arrays into calculateNetMatchPlay(team1.teamScorePerHole, team2.teamScorePerHole) to resolve the 2v2 match hole-by-hole. The Best Ball engine handles the per-hole best-ball mechanic; the Match Play engine handles the head-to-head resolution and "X&Y" close-out vocabulary. Per SCORING_FORMATS (scoring.ts:202), fourball shares the Best Ball engine — only the post-engine treatment differs.

- 2026-05-20 — MATCH PLAY ENGINE ARCHITECTURE REVIEW (LOW priority — intentional domain split, NOT a correctness divergence)

  Two Match Play engines exist in the codebase. Unlike the Stableford #1-vs-#2 case (composted earlier as a real urgent divergence), these two are intentionally architected for different domains and do NOT compute the same thing from the same input:

  - src/data/scoring.ts calculateMatchPlay — operates on raw gross score arrays (number[][]). General Match Play engine. Just got wrapped by calculateNetMatchPlay (commit 1f4ee35) for handicap-aware use, with comprehensive engine + wrapper tests.
  - src/services/fourTeamRyder.service.ts evaluateMatch — operates on pre-resolved hole-winner records (Record<number, FourTeamRyderHoleResult>). Ryder Cup four-team variant. Caller resolves who won each hole; engine tallies. Has in-progress status semantics (returns 'in_progress' if played < totalHoles); the scoring.ts engine assumes complete rounds.

  Why this is NOT urgent like Stableford:
  - The two engines take fundamentally different input shapes. Unifying would require either pre-resolving holes outside the Ryder Cup engine (loses its in-progress semantics) or threading raw scores through the four-team flow (significant refactor).
  - Each engine is correct for its domain — no production bug, no data divergence between paths.
  - Stableford had two functions that COULD compute the same number differently (orphan handicap-aware vs wired gross-only). Match Play has two functions that compute DIFFERENT things from different inputs.

  IF taken up later: pick one canonical Match Play engine and re-architect the other as a thin wrapper or eliminate it. Likely scope: 1-2 days of focused work. Not blocking beta. Not urgent.

  PAIRS WITH: future "scoring engine architecture pass" workstream — once all Tier 1 formats are wrapped + tested, a unified architectural review could address both this and the Stableford #1-vs-#2 case in one focused session.

- 2026-05-20 — PHONE-VERIFY + COMMIT STAGED STABLEFORD POSTROUND RENDER (Session 2A Phase 2B)

  Phase 2A landed committed (d581ca4): calculateNetStablefordTotal handicap-aware wrapper + 14 unit tests, all green. Phase 2B is the display-layer integration in the LIVE PostRoundSummary — STAGED (not committed) because it changes what users see on the post-round screen and needs device verification.

  STAGED FILE (working-tree only, unstaged):
  - src/components/scoring/PostRoundSummary.tsx — adds isStableford = formatLabel === 'Stableford' branch. When true: computes per-player points via calculateNetStablefordTotal from existing props (playerTotals.scores + handicapStrokes — no new prop threading), renders POINTS column instead of GROSS/NET/TO PAR, sorts descending. When false: existing render byte-identical (copied verbatim into the else branch). TSC stays at 34.

  PHONE VERIFICATION STEPS (on normal network):
  1. Create a trip with format = Stableford (or update an existing one).
  2. Start a round on that trip and play several holes with varied scores (include at least one birdie, one bogey, one double-bogey-or-worse to exercise the cap).
  3. Tap through to the post-round summary.
  4. Confirm FINAL STANDINGS shows: POS | PLAYER | POINTS columns (NOT gross/net/to par).
  5. Confirm players are sorted POINTS DESCENDING (higher = better).
  6. Confirm the POINTS value matches hand-computed Stableford for your scorecard.
  7. Negative test: open an in-flight or completed STROKE PLAY trip's summary. Confirm it still renders POS | PLAYER | GROSS | NET (if net mode) | TO PAR exactly as before — non-Stableford path is byte-identical.

  THEN commit:
  '[Scoring] Render Stableford points in PostRoundSummary final standings (Tier 1 template)'

  FOLLOW-UPS COMPOSTED (separate sessions, surfaced by Session 2A):

  A. formatKey THREADING (brittle string match → stable identifier)
     Currently params.format is the display LABEL ('Stableford', 'Modified Stableford', 'Stroke Play') — passed from app/(tabs)/score.tsx:1273 as activeFormat?.label. The Phase 2B branch uses formatLabel === 'Stableford' as a string match. This works for Tier 1 but is brittle: any rename of the label string silently breaks the format branch. Follow-up: also pass the ScoringFormat key (e.g., 'stableford') alongside the label and branch on key.

  B. STABLEFORD-POINTS PERSISTENCE
     Today the computed points are display-only — not written to Supabase. The round is saved with gross/net only (useScoringState.ts:724-740 in handlePostRound). Follow-up: extend the round shape to persist stableford_points so the value survives reloads, appears in trip leaderboards, and unifies with the season scoring path.

  C. #1-vs-#2 STABLEFORD ENGINE DIVERGENCE RISK
     Two Stableford engines exist: calculateNetStablefordTotal (src/data/scoring.ts, handicap-aware, NOW wired into live display) and calculateStablefordFromRound (src/services/scoring.service.ts, GROSS-ONLY, wired into season path via processSeasonRound). For a Stableford season round, the live summary will show net-aware points while the season standings show gross-only points — same player, same scorecard, two different totals. Follow-up: pick one engine as canonical for both paths. The handicap-aware version is the correct golf semantics, but switching the season path requires either threading handicapStrokesPerHole through processSeasonRound or computing it server-side. Worth a focused session — this is a data-divergence bug waiting to surface.

  D. DELETE DEAD src/components/PostRoundSummary.tsx
     Audit confirmed zero importers. Session 1B's LinearGradient sweep edited this dead file harmlessly. Safe to delete entirely. 1-line follow-up commit ('[Cleanup] Delete dead PostRoundSummary duplicate — confirmed 0 importers in scoring engine audit') any time the working tree is clean.

- 2026-05-20 — PHONE-VERIFY + COMMIT 3 STAGED TIMEZONE FIXES (Session 1C Phase 3)

  Three timezone bug fixes were applied and STAGED (not committed) during Session 1C — held because hospital WiFi blocked phone verification. They change runtime behavior and need device testing before commit.

  STAGED FIXES (apply via git diff to recover if working tree was reset):
  1. src/data/trips.ts:83 getDaysUntilTrip — was new Date(startDate).getTime() - Date.now(); now daysBetweenYMD(todayYMD(), startDate). HIGH IMPACT: powers Trips tab 'X DAYS AWAY' badge (trips.tsx:725) + trip-detail countdown (trip-detail.tsx:2406). This is the Phase 2.9 bug that escaped — Home was fixed inline (69a3ffd) but these two screens call getDaysUntilTrip which was never touched.
  2. app/create-trip.tsx:594-595 — start_date/end_date no-date fallback was new Date().toISOString().slice(0,10) (UTC); now todayYMD() (local).
  3. src/components/RyderCupWizard.tsx:1392-1393 — same fallback fix for Ryder Cup wizard.

  PHONE VERIFICATION STEPS (on normal network):
  - Fix #1: Create or view a trip dated TOMORROW, check after ~7pm local. Trips tab badge should read '1 DAY AWAY' not 'TODAY'/'0'. Same for trip-detail countdown.
  - Fix #2/#3: In create-trip and Ryder Cup wizard, submit a trip WITHOUT picking a date after ~7pm local. Should default to TODAY's local date, not tomorrow.

  THEN commit (suggested, one or split):
  '[DateHelpers] Fix getDaysUntilTrip timezone bug (Trips tab + trip-detail countdown) — the Phase 2.9 escapee'
  '[DateHelpers] Fix UTC date-default fallback in create-trip + RyderCup wizard'

  ALSO COMPOST (separate follow-ups surfaced by the audit):
  - roster.ts:413 caller-side audit — trace where input.startDate is constructed to confirm local-time Date (function itself correct, callers unverified)
  - Migrate 3 external dateHelpers callers (index.tsx, trips.tsx, stats.service.ts) off the wizard re-export shim to src/lib/dateHelpers directly, then delete the shim (trivial cleanup from Phase 1)

- 2026-05-20 — ROTATE EXPOSED CREDENTIALS (security, pre-launch blocker)

  During Sentry setup, several client-side keys were exposed and should be rotated before production launch:
  - Sentry DSN (already flagged)
  - Google Places API key — rotate in Google Cloud Console + ADD application restrictions (bundle ID + API restrictions)
  - Golf API key — regenerate with provider
  - Supabase anon key — publishable/RLS-protected by design (low risk) but verify RLS policies are airtight; rotate if desired

  None are server-admin keys (all EXPO_PUBLIC_ client-side), so exposure is not catastrophic — but rotation + restrictions are correct pre-launch hygiene.

  ALSO: deleted stray 'Sentry .env' duplicate file; hardened .gitignore with *.env pattern.

- 2026-05-17 — VERIFY SENTRY CAPTURE END-TO-END (deferred from Session 1B)

  Sentry DSN configured in .env (EXPO_PUBLIC_SENTRY_DSN), confirmed loading via env export line. Sentry code wiring verified correct in Phase 2 audit (initSentry at app/_layout.tsx:15, setSentryUser/clearSentryUser wired, plugin configured in app.json). Logger (src/lib/logger.ts) routes logError → Sentry.captureException.

  NOT YET VERIFIED: that a captured error actually lands in the Sentry dashboard. Phone verification blocked at config time (hospital WiFi network isolation + single-iPhone hotspot limitation).

  TO VERIFY (on a normal network):
  1. Run app on phone (same WiFi as Mac) or iOS Simulator (press i in Metro)
  2. Confirm no '[Dormie] Sentry DSN not set' warning at boot
  3. Trigger a logError path (kill network, trigger a failing fetch with a logError catch)
  4. Confirm event appears in Sentry dashboard → Issues tab within ~30 seconds

  ALSO FLAGGED: @sentry/react-native@6.5.0 installed vs expected ~7.2.0, plus 13 other Expo SDK packages behind expected versions. Consider a dependency-update session before beta.

  ROTATE DSN: A DSN was exposed in a chat session during setup. Rotate the Sentry client key before public launch.

  PRE-BETA PRIORITY: MEDIUM. Logger provides console value immediately. Sentry capture verification matters before relying on it for production monitoring.

- 2026-05-06 — DREAM BOARD CATALOG SEARCH + FILTERING (product question raised during Phase 2.9 closeout)

  Phase 2.9 testing surfaced a product question: should the Add to Dream Board catalog have a search affordance?

  Current state: 8-destination curated catalog, vertical scrollable list. Search would be overkill at this size.

  Future-state considerations:
  - If catalog grows to 30+ destinations, search becomes useful for discoverability
  - Filtering by region (Southeast, West Coast, UK/Ireland, etc.), course type (links/parkland/desert/heathland), access (public/invitation/private), or season (year-round vs. summer-only) could add value
  - Search + filters pair with the Discover/Explore section concept already in the app — could share a destinations primitive

  PRE-BETA PRIORITY: LOW. Not blocking. Catalog is small enough that search isn't needed.

  PAIRS NATURALLY WITH:
  - Dream Board catalog curation expansion (15+ destination workstream)
  - Discover/Explore section redesign
  - Claude Design pass on remaining screens

- 2026-05-06 — TIMEZONE BUG CLEANUP IN LEGACY CREATE PATHS (deferred to Phase 4 Ryder Cup migration)

  Audit-grep during Phase 2.9 closeout surfaced same-shape duplicates of the trip persistence timezone bug in legacy create-trip and RyderCupWizard fallback date paths. Both fire when user submits without picking a date — rare but real. Defer to Phase 4 when Ryder Cup migration touches these files anyway.

  Affected:
  - app/create-trip.tsx:594-595 (fallback start_date + end_date)
  - src/components/RyderCupWizard.tsx:1392-1393 (same shape)

  Fix: swap new Date().toISOString().slice(0, 10) for todayYMD() from dateHelpers.

  PRE-BETA PRIORITY: LOW (only triggers on rare submit-without-date edge case)
  PAIRS WITH: Phase 4 Ryder Cup migration

- 2026-05-06 — DUPLICATE TRIP FLOW MIGRATION (deferred from Phase 2.9 closeout)

  Phase 2.9 legacy /create-trip caller sweep redirected 4 of 5 production callers to /create-trip-quick. Caller #3 (duplicate trip flow at app/(tabs)/trips.tsx:1202) was preserved on legacy because the new wizard at /create-trip-quick does not currently consume the duplicate prefill params (duplicateFromName, duplicateFromFormat, duplicateFromSideGames, duplicateFromStakes). Migrating this caller to the new wizard would silently degrade the duplicate intent — user taps Duplicate, lands on Step 0 with no prefilled trip details.

  Two paths now reach /create-trip in production:
  1. Step 0 persona fork → Ryder Cup path (deliberate, until Phase 4 migrates Ryder Cup)
  2. Trips tab → trip card → Duplicate action (preserved working feature, until Phase 3+ wires duplicate-prefill through the new wizard)

  WORK REQUIRED FOR DUPLICATE FLOW MIGRATION:

  1. WizardContext extension — accept duplicate prefill params and seed wizard state on mount:
     - duplicateFromName → state.tripName + tripNameOverridden flag
     - duplicateFromFormat → state.format (if compatible with current player count, else show 'Format requires X players' warning)
     - duplicateFromSideGames → state.sideGames
     - duplicateFromStakes → state.perGameStakes (deserialize from URL-safe format)

  2. URL param schema — define how duplicate state serializes/deserializes. Current legacy implementation reads these as comma-separated strings; new wizard probably wants JSON-encoded or individual params per field.

  3. Edge case handling — what if the source trip's course or date is in the past, or the format requires more players than current selection allows? Should the wizard pre-fill what it can and skip invalid fields gracefully, or refuse to load and show a warning?

  4. Step navigation hint — if user duplicates a complete trip, should wizard jump to Step 7 confirm (review and launch) or start at Step 0 (let user review each step)? Probably depends on how complete the prefill is.

  5. UI surface — after migration, the trip card's 'Duplicate' menu item could remain unchanged, but Step 0 Persona Fork should show 'Duplicating from: {sourceTripName}' as a header element so user knows they're in duplicate mode.

  ESTIMATED SCOPE: 2-4 hours. Pairs naturally with Phase 3 Plan Ahead extensions since Plan Ahead already adds state-restoration capabilities (draft persistence). The same primitives that restore a draft can restore from a duplicate source.

  PRE-BETA PRIORITY: MEDIUM. Duplicate is a nice-to-have feature not load-bearing on initial trips. Current state (legacy path still works) is acceptable for closed beta.

  PAIRS NATURALLY WITH: Phase 3 Plan Ahead (state-restoration primitives), Phase 4 Ryder Cup migration (both finish retiring /create-trip legacy traffic), Step 0 Persona Fork (duplicate intent has a 'Duplicate an existing trip' affordance there already showing a 'coming next release' toast — same UI surface).

- 2026-05-06 — CLAUDE DESIGN PASS ON REMAINING USER-FACING SCREENS (pre-beta workstream)

  Phase 1.9 cinematic moment + Phase 2 wizard polish established the design DNA standard for Dormie's most emotionally-loaded surfaces. Other user-facing screens haven't yet received the same Claude Design treatment and may not match that standard.

  CANDIDATE SCREENS FOR DESIGN PASS:

  1. Trip Detail screen — where users land after the cinematic. Currently functional but composition + voice may not match the wizard or cinematic. The cinematic ends with 'TAP TO VIEW TRIP →' which leads here; Trip Detail needs to feel like a continuation of that moment, not a downgrade.

  2. Post-Round Summary — what users see after submitting scores. Already composted that most side games fall through to 'Results tracked — coming soon' (theater). Beyond fixing the engine theater, the visual presentation of round results deserves a design pass: how does the moment of seeing your round play out? Skins won, money owed, leaderboard movement.

  3. Leaderboard — how rankings render across friend groups, both at trip-level and season-level. Currently uses get_trip_leaderboard RPC. Visual treatment unknown without audit.

  4. Profile screen — the 'front door' of user identity in Dormie. Avatar, handicap, home course, friends, settings, season history. Currently has Developer section (about to be cleaned), home course, profile visibility — visual hierarchy and voice unaudited.

  5. Onboarding flow — auth/onboarding.tsx captures home course during signup. Currently functional but probably hasn't had a design pass. First impression matters disproportionately.

  6. Friends list / Add Friends — social surface, key for trip invites. Visual treatment unknown.

  7. Score entry screen (app/scoring.tsx) — where users actually score rounds. Shared between trip-context and standalone scoring. Critical functional + emotional surface.

  8. Discover screen — destinations, dream board, future trip aspirations. Mock data currently per audit findings.

  9. Season detail / Season ledger — multi-trip season rollup with FedEx-Cup-style standings. Differentiating Dormie feature, deserves cinematic-level treatment.

  ESTIMATED SCOPE: Per-screen design pass ~2-4 hours each (exploration + spec lock + implementation). Full sweep across 9 candidate screens = significant workstream, ~20-30 hours total. Pre-beta priority varies per screen.

  RECOMMENDED PRIORITIZATION:
  - HIGHEST (pre-beta blocker): Trip Detail, Post-Round Summary, Score entry — these are the post-launch flows users will hit immediately and repeatedly.
  - HIGH: Leaderboard, Profile, Onboarding — first-impression + recurring-attention surfaces.
  - MEDIUM: Friends/Add Friends, Season detail — important but less frequent touchpoints.
  - LOWER: Discover — currently mock data, depends on Dream Board feature scoping.

  PAIRS NATURALLY WITH:
  - Scoring engine integration sprint (Post-Round Summary depends on engine wire-up + has visual presentation gap)
  - Step 6 redesign backlog (currency input could become reusable primitive across Trip Detail + Score entry)
  - Step 7 redesign backlog (Trip Detail visual language should echo the trip card object Step 7 launches with)
  - The wizard's gap-above rule + voice principles could become Dormie-wide design DNA documented in dormie-design-dna.md

- 2026-05-06 — STEP 7 (CONFIRM + LAUNCH) REDESIGN BACKLOG (deferred from Phase 2.9 audit, post-revision)

  Phase 2 revision pass resolved the trip card title truncation/duplication bug — auto-derive is firing correctly via shortVenueName helper, and the card now reads as a real Dormie object ("Hermitage May 2026"). Footer button ambiguity also resolved this pass — [DONE] removed at Step 7 so the in-screen CTA is unambiguous. Deferred items below are largely unchanged from the prior pass; the screen still reads as form-around-a-card rather than launch threshold.

  DEFERRED ITEMS (in priority order):

  1. Subhead → trip-as-sentence — Still the #1 unaddressed lever. "Review your trip and either save as a draft or launch it now." is help-doc voice; should be one Georgia serif sentence assembled from trip data: e.g. "Hermitage in May. You and Kara. Stroke Play, Skins, Greenies on the line." Asymmetry between strong card and weak subhead is louder because the card got better. ~half session.

  2. Footer button ambiguity — [RESOLVED Phase 2.9]. [DONE] hidden at Step 7. In-screen CREATE TRIP & INVITE ALL is sole primary action. [BACK] preserved for navigation correction.

  3. Drop step chrome at Step 7 — "STEP 7 OF 7 / Confirm" header still present. Pattern from Linear / Things 3: wizards lose chrome at threshold. Pairs with item #2 (now resolved) — both about the wizard chrome stepping back at the launch moment. ~quarter session.

  4. Cinematic anticipation cue — Step 7 → cinematic transition still feels like form submit. Add subtle anticipation: button gold underglow, press-state hold, or thin gold rule above CTA. Cinematic only feels earned if prelude builds tension. ~half to 1 session.

  5. Subtitle truncation cleanup — "Hermitage Golf Course - Presidents Reserve · …" still truncates with dot-ellipsis. Title fix solved the hero but subtitle is still hiding data. Either show full string, drop "·" separator, or wrap to two lines. Decision needed on what comes after "Reserve" (likely date or tees) and whether it's worth showing. ~quarter session.

  6. Voice rewrites: chrome subtitle, headline, metadata labels — "Confirm" / "Ready to launch?" / "2 players" / "No invite needed" / "via Dormie." Voice problem concentrated in three places — chrome, subhead, metadata labels. ~quarter session (copy work, no engineering beyond label refactor).

  7. Trip card visual dominance — Card got compositionally better with title fix; spatial dominance still equal-weight to INVITING + actions. Card should dominate further. Pattern from Things 3 review screens. ~half session.

  8. "Edit trip details" link reposition — Still inline-left under format chip, interrupting card narrative. Should be corner-anchored top-right of card. ~quarter session.

  9. Dashed-border "ADD ANOTHER PLAYER" visual quiet-down — Still competing with primary CTA. Reduce to inline link or quieter affordance. ~quarter session.

  10. Trip card surface depth — Card still flat-on-flat aside from green left rail. Add subtle inner-glow or top-edge highlight for WHOOP-style lift. ~quarter session.

  11. Avatar size consistency — Trip card ~48pt overlapping vs INVITING ~64pt non-overlapping. Pick one system. ~quarter session.

  12. Trip card haptic + tap feedback — Most premium element on screen still inert. Light haptic on tap. Possibly long-press preview affordance (likely too much, defer decision). ~quarter session.

  13. Section header → content spacing on INVITING — "INVITING" → first invite row at ~24pt is still tight relative to gap-above rule applied elsewhere. ~quarter session.

  14. Viewport behavior verification — "SAVE AS DRAFT" appears to have moved below fold or been removed in this pass. Confirm safety valve is visible at launch moment without scroll. ~quarter session diagnostic.

  15. CTA voice escalation at launch moment — "CREATE TRIP & INVITE ALL →" still functional but procedural. At the actual launch moment, voice could stretch: "Launch the trip" / "Tee it up" / "Send it." Defer to post-beta voice pass. ~quarter session.

  Pre-beta priority: HIGH

  Items 1, 3, 4 are pre-beta priority HIGH (voice transformation, chrome reduction, cinematic anticipation). Items 5, 6, 7, 9 are pre-beta priority MEDIUM. Items 8, 10-15 are post-beta polish. Items 1 (title bug) and 2 (footer ambiguity) resolved Phase 2.9.

  This screen has higher beta-blocking weight than other wizard steps because it is the threshold screen — the last impression before the cinematic and the first time the trip exists as an object. A weak Step 7 dampens the cinematic that follows. Items 1, 3, 4 alone shift the screen materially.

  Pairs naturally with: cinematic mount-in transition (item 4 bridges directly to Phase 1.9 cinematic — both are part of the same "launch moment" composition); wizard-wide footer chrome audit (item 2 may surface a broader pattern about how wizard footers should behave on terminal steps — could affect future wizards beyond Quick Trip); auto-derive trip-name logic (now stable primitive — shortVenueName helper could be reused on trip-detail and other surfaces); voice-system compost (items 1, 6, 15 should inform a wizard-wide voice audit covering all 8 steps).

- 2026-05-06 — STEP 6 (STAKES) REDESIGN BACKLOG (deferred items, post-revision)

  Phase 2 revision pass resolved the headline voice failure, currency input premium treatment, side-game render bug, and Nassau three-input pattern. The screen now reads as on-DNA. Deferred items below are what stands between "shipped" and "Dormie moment."

  DEFERRED ITEMS (in priority order):

  1. Live running total — Still the #1 unaddressed lever. Headline asks "What's it worth?" — screen should answer in real time. Position: subhead slot below headline, OR sticky footer row above [BACK]/[NEXT]. Updates as fields fill: "About $25 a head, $100 in the pot." Converts emotional arc into single composition. ~1 session (compute logic + reactive subhead/footer component).

  2. Headline breathing room + alignment — Headline currently shares left-gutter with form columns. Reads as form label rather than hero composition. Linear/Things 3 pattern: hero text breathes wider than form (smaller left margin, ~24-32px). ~quarter session (alignment tokens). [Partial fix landed Phase 2.9 — vertical breathing increased to 48pt, horizontal alignment still pending.]

  3. Greenies config asymmetry — Skins has carry-over toggle; Greenies has no toggle despite having real config questions (par-3 only vs any green-in-regulation, validation method). Pairs directly with KP par 3 audit — same hole-metadata infrastructure question. Defer until KP audit findings clarify scope. ~half to 1 session pending audit.

  4. Skins individual-vs-team mode — Skins card assumes individual play. Real Skins games run 2-man team variants frequently. Either lock to individual at this step with disclosure, or surface the choice. ~half session (mode toggle + payout logic branch).

  5. Unit label commit microinteraction — When input has real value, "per player"/"per skin"/"per greenie" subtly shifts weight/color to confirm commit. No current acknowledgment of filled state. ~half session.

  6. Carry-over "why" affordance — Tap label → brief in-card explanation. First-time Skins players don't know what carry-over means. Premium apps teach without lecturing. ~half session (disclosure pattern + copy).

  7. Currency input field width — Currently sized for ~5 digits, most stakes are 1-3. Empty space inside field reads as form bloat. Tighten to content-appropriate width. ~quarter session.

  8. Footer chrome density — "SKIP STAKES — HANDLE OFFLINE" link visually crowded between content and [BACK]/[NEXT]. Needs more breathing room above so escape-valve language doesn't read as third button. ~quarter session.

  9. Card-to-card spacing inside SIDE GAME STAKES — Currently ~24pt (no-decision middle). Pick a side: 16pt (one ledger) or 40pt (distinct objects). ~quarter session, design call required first.

  10. Voice tightening pass — "Split top 3" → "Pays three deep"; "Carry-over on tied holes" → "Carry ties." Marginal but compounding. ~quarter session.

  11. Stableford "Fixed per place" toggle is THEATER. Investigation confirmed: tap mutates state.perGameStakes config to { kind: 'stablefordPayoutKind', stableford: { payout: 'per_place' } }, but per_place value is never read by step7Helpers.ts, roster.ts, cinematic copy, or trip persistence. No per-place dollar inputs reveal. No downstream consumer. Belongs in the Scoring Engine Integration Sprint scope (Tier 4 payout structure overhaul depends on per-place input UI + downstream consumption).

  Pre-beta priority: MEDIUM

  Item 1 alone is HIGH priority. Items 2, 3, 4 are MEDIUM. Items 5-11 are post-beta polish. Total remaining backlog is materially smaller than after the first diagnostic pass — most of the original 13 items shipped or are obsolete.

  Pairs naturally with: KP par 3 audit findings (item 3 directly depends); future "currency input component" if treated as reusable primitive (will appear in trip-detail stake editing, settle-up, future Venmo flows); Step 7 confirm/launch screen (running-total language from item 1 should echo into the launch summary — same data, different surface, narrative continuity).

- 2026-05-06 — COURSE DATA QUALITY: BACKFILL + LEAK FIXES (Phase 2.9 audit finding)

  Diagnostic confirmed GolfCourseAPI integration works correctly for new lookups via score tab and onboarding paths. 100 of 324 production courses have full per-hole data (par, yardage, handicap per hole + per-tee slope/rating).

  Stale data cohort: 216 courses imported as bulk seed batch on 2026-04-03 (data_source: 'verified' or 'community') with hole_data containing only the count, not per-hole arrays. These are recoverable — fetchable via current API integration.

  Three leaks identified, patched in Phase 2.9 commit:
  - CourseLocationPicker.handleSelect was discarding per-hole API data during trip wizard course selection
  - searchAll was skipping cacheAPICoursToSupabase when API returned a parent club name with seeded sub-courses
  - parseTeeBoxes was writing hole.number: 0 for all holes (API uses position indexing, not number field) — broke greenies/skins logic keying by hole.number

  Remaining items for future scoped session ('data quality sprint'):
  - Backfill script: loop 216 count-only courses, fetch via searchAPI, refresh via cacheAPICoursToSupabase. Estimated ~216 API calls, 1-2 hours work + verification.
  - AsyncStorage 30-day TTL: currently hides stale local caches from API for 30 days. Worth shortening to 7 days OR adding cache-bust on user action.
  - Verify no other hole-keyed logic relies on the broken hole.number field beyond greenies/skins (audit calculations.ts comprehensively).

  This is foundational infrastructure that pairs with the previously-composted 'hole-aware side games infrastructure gap' work. Once both land, KP/greenies/dots can compute against real course data for the majority of trips.

- 2026-05-06 — SCORING ENGINE INTEGRATION GAP (Phase 2.9 audit finding, deferred to dedicated sprint)

  Earlier compost framing assumed Dormie needed engines BUILT for missing formats. Investigation revealed the truth is messier: most engines exist but are orphaned. This is an integration problem with a tail of true gaps, not a greenfield engine build.

  Six engine layers exist in the codebase, mostly disconnected:

  1. src/data/scoring.ts calculate* functions (Apr 11-12) — calculateMatchPlay (full: 2&1, 1 UP, AS, dormie, close-out), calculateBestBall, calculateScrambleTeamScore, validateScrambleScore, calculateChapmanHoleScore, calculateChapmanTotal, calculateStablefordPoints (handicap-aware), calculateModifiedStablefordPoints, calculateBestNHoles. ~600 lines, 53 + 48 passing tests. NEVER imported by any production code path. Pure orphan.

  2. src/scoring/calculations.ts build* functions (Apr 12-19) — buildSkinsResult, buildSnakeResult, buildGreeniesResult, buildNassauResult, buildDotsResult, buildWolfResult, buildBBBResult, buildGenericResult fallback. Wired into PostRoundSummary. SIDE GAMES ONLY — no format-level builders.

  3. useScoringState.ts inline computation — bestBallTeamScores, lowHighResults, lowHighPoints, sixSixSixResult (full per-segment with rotations). Real engines, computed in state but most have no PostRoundSummary surface (sixsixsix shipped without buildSixSixSixResult).

  4. src/services/scoring.service.ts — calculateStablefordFromRound. DUPLICATE of #1's calculateStablefordPoints, no handicap support. Used by processSeasonRound when round saves to a season. The Apr 19 audit (docs/scoring-audit-2026-04-19.md line 238) flags this as 'if a season uses Net Stableford, all points calculated as gross' — known bug.

  5. RyderCupHub.tsx computeMatchStatus — separate match play engine for Ryder Cup mode. Full state machine (red/blue, dormie, close-out, halved, finalResult). Used live in RC view only. Disconnected from the rest of the scoring stack.

  6. Supabase RPC get_trip_leaderboard (commit 8080ba2 Apr 19) — server-side stableford point computation for trip leaderboard view. Completely separate from any TS engine.

  Plus src/lib/scoring-utils.ts:matchStatus — third match play status formatter. No production consumers.

  IMPLICATIONS:
  - Match Play has TWO working engines (calculateMatchPlay + computeMatchStatus), neither wired into live /scoring screen
  - Stableford has THREE implementations that disagree on handicap support; none surface during live play (only at season-write or leaderboard-render)
  - Best Ball, Scramble, Chapman, Pinehurst all have orphan engines waiting to be wired
  - True engine gaps remain for: fourball, alternate_shot, greensomes, shamble (no engine anywhere)
  - Side games genuinely missing engines: hammer, sandies, arnies, hogans, murphys, poleys, bark, KP/close_shave, three_putt_poker (settlement)

  RE-SCOPED SPRINT: 'Scoring Engine Integration Sprint' (~15-25 hrs, 3-4 sessions)

  Tier 1 — WIRE-UP (~4-8 hrs, highest leverage): Add buildMatchPlayResult, buildBestBallResult, buildScrambleResult, buildChapmanResult, buildStablefordResult, buildModifiedStablefordResult adapters in src/scoring/calculations.ts that import from src/data/scoring.ts. Wire into PostRoundSummary's switch (currently side-game-only). Add buildSixSixSixResult exposing the existing useScoringState computation. Each adapter is ~30-50 lines because the math already exists.

  Tier 2 — DE-DUPLICATION (~2-4 hrs): Consolidate three Stableford implementations to a single canonical source (calculateStablefordPoints). Update scoring.service.ts to call it with handicap support. Update get_trip_leaderboard RPC OR move trip leaderboard format-switching to client. Pick one match play engine as canonical (recommend src/data/scoring.ts), have RyderCupHub adapt. Remove src/lib/scoring-utils.ts:matchStatus orphan.

  Tier 3 — TRUE ENGINE WORK (~6-10 hrs): Build engines that don't exist anywhere — fourball, alternate_shot, greensomes, shamble (formats); hammer, sandies, arnies, hogans, murphys, poleys, bark, close_shave, three_putt_poker settlement (side games). Some of these may consolidate (e.g., chapman/pinehurst are functionally identical — see existing 'catalog product debt' compost item).

  Tier 4 — SERVER + UX SURFACING (~2-4 hrs): Update Supabase RPCs to use canonical TS engines via Edge Functions OR keep server-side and ensure parity. Add user-visible 'this format uses live scoring' vs 'this format computes at end of round' affordances. Wire payout config kinds (matchPlayPayout, teamFormatPayout, wolfPayout, sixsixsixTriple) on top of the now-real engines.

  This sprint subsumes the previously-scoped 'payout structure overhaul' work — payout configs only stop being theater once their underlying engines are wired up. Build engines first, payout UX second.

  PRE-BETA PRIORITY: HIGH. Currently the wizard's 15-format catalog advertises capabilities the live scoring engine can't deliver on for ~8 of 15 formats. Beta users selecting Match Play, Stableford, Scramble, Chapman, Pinehurst etc. will see undifferentiated stroke play during live scoring with no settlement display — eroding trust at exactly the moment we're proving Dormie does scoring better than its competitors.

  PAIRS WITH (one cluster, three compost items):
  - 'COURSE DATA QUALITY' (above) — backfill 216 stale courses so engines have real par data
  - 'HOLE-AWARE SIDE GAMES INFRASTRUCTURE GAP' (below) — schema + UI for KP designation, BBB hole tracking
  - 'CATALOG PRODUCT DEBT' (earlier compost item) — fourball/best_ball disambiguation, chapman/pinehurst consolidation, wolf format-vs-side-game cleanup

  All three are 'does Dormie's scoring engine actually deliver on what the catalog advertises' work. Worth treating as one pre-beta sprint with three ordered phases: course data backfill (foundation) → engine integration (this entry) → UX/payout surfacing.

- 2026-05-06 — HOLE-AWARE SIDE GAMES INFRASTRUCTURE GAP (Phase 2.9 audit finding)

  Audit revealed Dormie's per-hole par data is incomplete and several side games silently degrade when data is missing.

  Schema reality:
  - courses.hole_data jsonb is a single column, not a separate holes table
  - 324 courses in production: 8 null, 216 with hole COUNT only (no per-hole pars), 100 with real per-hole arrays from GolfCourseAPI cache
  - Hermitage Presidents Reserve (and most catalog courses) have count-only data
  - Fallback synthesis (generateDefaultHoles) places par 3s at holes 3/8/12/17 and par 5s at 5/9/13/16 — these are guesses, not reality

  Side games affected by missing per-hole pars:
  - Greenies: filters h.par === 3 — silently uses synthesized par 3s when real data missing
  - Dots: uses h.par for par-relative scoring — same silent degradation
  - Bingo Bango Bongo: needs hole_number (not par specifically) — still works without par data
  - Other side games (Skins, Snake, Sandies, etc.): no par dependency, work fine

  KP (close_shave) infrastructure status:
  - No par 3 designation anywhere
  - trips.side_games stores flat array of game keys, no per-game configuration
  - No buildKPResult — uses buildGenericResult ('Results tracked — detailed scoring coming soon')
  - Manual toast prompts collect distance-to-pin entries but aren't persisted into structured KP results
  - No auto-settlement (only nassau and skins auto-settle today)

  Multi-layer feature build required to ship hole-aware side games:
  1. Course hole data backfill — populate per-hole pars for the 216 count-only courses (likely via GolfCourseAPI batch import)
  2. Schema migration — add side_game_config jsonb to trips OR new trip_side_game_config table for per-game per-trip configuration (KP designation, BBB hole-by-hole, etc.)
  3. Scoring engine — buildKPResult, buildGreeniesResult improvements that handle missing par data gracefully, auto-settlement for KP
  4. UI — Step 5 side games picker should surface 'this course doesn't have hole data, results may be approximate' warnings for greenies/dots/KP when applicable
  5. Trip-detail/scoring flow — proper KP designation UI ('which par 3 is THE KP hole?') if going beyond per-par-3 mode
  6. Result display — PostRoundSummary needs proper KP results card

  Strategic options for v1:
  - Option A: 'KP-on-every-par-3 + greenies-on-every-par-3' mode — no designation needed. Requires only course data backfill + result builders. Most work for least UX complexity.
  - Option B: 'Designate one KP par 3' mode — adds designation UI in Step 5 or trip-detail. Standard golf bet structure but requires schema changes.
  - Option C: 'Designate KP per round in multi-round trips' mode — most flexible but most complex storage.

  Estimated work: 6-12 hours across at least 2-3 dedicated sessions. Pairs naturally with the existing 'catalog product debt' compost item (fourball/best_ball disambiguation, wolf format/side-game duplication, pinehurst/chapman consolidation). All of these are scoring catalog quality work.

  Pre-beta priority: medium-high. Greenies and Dots SILENTLY DEGRADE on incomplete data — users won't know their KP/greenies results are computed against fake par 3s. This is a trust issue worth addressing before public launch.

- 2026-05-06 — Voice diagnostic pattern: when wizard copy reads informational ("Pick a quick option or any day on the calendar"), it violates Dormie's "19th hole at the clubhouse" design DNA. The test: would this sentence appear in a generic golf app? If yes, rewrite it. The Quick Trip persona description shift from "Single-day round with friends. Locked-in date, casual format, ready to launch." to "Next on the tee — Ian, plus the crew." is the canonical example.
- 2026-05-06 — Wizard layout convention — gap-ABOVE rule: section headers should have meaningful vertical space ABOVE them, not below. The vertical separation between distinct sections (FIND A COURSE → YOUR HOME COURSE → RECENT COURSES) should read as composition breaks. Implementation: marginTop on each section's container, NOT marginBottom on the previous section.
- 2026-05-06 — Build pattern — data-then-UI: when adding data layer + UI together, ship data layer first (foundation), then UI second (visual treatment). Two commits, single responsibility each. Lets you fix data assignments without touching UI, and isolate UI changes for review. Used in Phase 2.9 for player-count compatibility (playerRequirement + remoteSafe added as data layer, UI lock-out queued as separate sub-phase).
- 2026-05-06 — Catalog product debt identified during Phase 2.9 audit: (a) fourball + best_ball described as identical engines — needs disambiguation; (b) wolf exists as both format and side game with separate copy — verify intentional; (c) pinehurst description says "Functionally Chapman" — consolidation candidate or distinct format?; (d) close_shave key with "KP" label — terminology cleanup needed. None blocking, all worth a scoped catalog cleanup session before public beta.
- 2026-05-06 — Phase 2.9 audit surfaced 7 missing scoring formats not in current catalog: Match Play variants (Singles/Fourball/Team), Virtual Match Play (Dormie-specific remote-adapted), Vegas, Quota, Rabbit, 6-Point Game, Team Aggregate. Each requires new scoring engine logic, new copy, possibly DB constraint updates. Deserve a scoped catalog expansion session — pairs naturally with the catalog product debt cleanup. Phase 3 or beyond.
- 2026-05-06 — Dormie-specific data dimension: `remoteSafe: boolean` on every scoring format and side game. Indicates whether the format works asynchronously across courses (Stableford, Quota, fourball) or requires same-course timing (alternate shot mechanics, Wolf, Bingo Bango Bongo). This dimension powers future product features: multi-course play in Plan Ahead, async friend group scoring, "remote-friendly" format filtering. Not in any other golf app catalog. Lock as a structural advantage.
- 2026-05-06 — Design pattern — surface stable user data as front-door affordance: when a user has set persistent profile data (home course, default group, etc.), surface it AT THE TOP of any flow that consumes that data. Step 1 home course section transformed Quick Trip from 5+ taps to potentially 4 taps for the most common scenario (your home course this Saturday). Apply this pattern to: future home course extensions, default trip group, default scoring format, default stakes.
- 2026-05-06 — v1 limitation honesty: Step 3 Invite tab discloses "We'll create an SMS invite link on launch. You'll copy the link to your messages from the next step." This is honest copy admitting we don't have automated SMS sending (Twilio integration deferred). Phase 3+ should automate this — until then, the disclosure is correct but exposes the limitation. Twilio/Bandwidth/Sinch integration is real feature work (~4-8 hours setup + A2P 10DLC registration + cost-per-message). Worth scoping for v2.
- 2026-05-06 — Wizard architecture decision pattern — combine vs upgrade: when a step feels too lightweight, the instinct is to combine it with another step. The better move is usually to UPGRADE the existing step's depth (add tee time to Step 2, surface home course on Step 1) rather than collapse step boundaries. Reason: each wizard step is a unit of focus — combining steps creates decision paralysis, breaks momentum beats, and risks visual crowding on mobile. Speed in wizards comes from each step taking 5 seconds, not from fewer steps total.
- 2026-05-06 — Phase 2.9 scope drift acknowledgment: scope expanded from pure polish to meaningful product work — (a) Step 0 voice refinement, (b) Step 1 home course surfacing + multi-course off-ramp, (c) Step 2 tee time picker (real product gap), (d) playerRequirement + remoteSafe data layer. The expansion was deliberate — each item was a real product gap caught during audit, not feature creep. Pattern: when audit surfaces real gaps, address them in-phase rather than splitting into Phase 2.9.5. But name the expansion explicitly so it's a conscious choice, not drift.
- 2026-05-06 — Step 7 buildAndCreate error handling validated via 167-test stress pass + manual phone testing during Phase 2.9. Mocked-service unit tests for Supabase write failures deferred until error logic complexity grows (likely Phase 3 multi-day persistence or Phase 4 Ryder Cup migration).
- 2026-05-06 — Future infrastructure: add React Native Testing Library for component-level test coverage. Would unlock per-step rendering assertions, full mounted-wizard transition tests, and component-level regression coverage. Estimated 4-6 hours setup + ongoing maintenance. Worth doing before Phase 4 Ryder Cup migration when wizard component complexity grows.
- 2026-05-06 — Step 1 wizard richer treatment deferred to v1.5+. The trip-creation spec (docs/trips-wizard-redesign-spec-2026-05-05.md Step 1) describes location-first autocomplete with sponsor placement (`is_sponsored` / `sponsored_until` columns already on `destinations`) and an educational layer (one-line course/region notes via `description` / `region_note` fields). Phase 2.2 ships with the existing CourseLocationPicker as-is; the recent-courses section + free-text fallback + sponsor + education affordances all layer in once content team supplies copy. Architecture is ready — content + UI polish drives the unlock.
- 2026-05-06 — Phase 1.9 cinematic moment shipped. Six phases, four beats, 18 harness variants validated. Pinstripe persistent texture, native-driver you-underline, fire-floor enforcement, computeTotalDuration export, multi-destination tripName override, full adaptive time table all locked. Architecture: progress-driven Animated.parallel scheduling with native-driver discipline for transforms/opacity, JS-thread for width-driven animations. Variant detection via roster.ts helpers. Component lives at src/components/wizard/trip-launched/.
- 2026-05-06 — Ryder Cup avatar priority override: spec said isYou > team > neutral, real-world phone testing on drafted variants showed team color winning was the better visual hierarchy because team identity dominates the Ryder Cup frame. Sentence ("and you on Team A") handles individual identity callout. Documented in design spec doc.
- 2026-05-06 — Cinematic moment build pattern proven: phase-by-phase implementation with phone testing between each phase catches micro-bugs at the cheapest possible layer. Six fixes during Beat 3 alone (sentence wrap, dismiss target, status bar, spacing, type alignment, italic optical centering) would have been compounded if all four beats had built simultaneously. Pattern: incremental visual layers + harness preview + screenshot comparison to locked design = high-fidelity output.
- 2026-05-05 — Two-cinematic-moments insight from Trip Launched design exploration: big trips earn multiple peak emotional moments, not one. Trip Launched at announce, Draft Night at draft, Day 1 Welcome at start. Pattern applies beyond Ryder Cup — annual trips, bachelor parties, bucket-list trips all have multi-moment arcs. Develop as a framework for cinematic exploration doc.
- 2026-05-05 — Design principle from Trip Launched exploration: in editorial typography, the personality is the typography, not the noun. Italic Georgia at hero scale carries emotional weight whether it contains "Pinehurst" or "Tennessee Three-Course Tour." Add to dormie-design-dna.md when convenient.
- 2026-05-05 — Legacy borderRadius: 12 on existing trip card in app/(tabs)/trips.tsx:2140 violates design DNA's zero-border-radius rule. Should be cleaned up alongside any other rounded-corner UI surfaces in a sweep — see TripCardPreview's sharp-edges treatment as the canonical pattern.
- 2026-05-05 — Wizard navigation pattern decision deferred to v1.5+. Linear (back button only) shipping in v1; progressive disclosure (jump between steps from sidebar) is the v1.5+ candidate. Evaluate after we have real beta usage data on where users drop off in the wizard.
- 2026-05-05 — Wizard mid-flow persistence: session-state for v1, Supabase persistence for v2. Cross-device wizard continuation is the v2 win — start a trip on phone, finish on iPad. Evaluate when multi-device usage signals appear.
- 2026-05-05 — Default format for first-time users: shipping Stroke Play default for v1 (most universal). Worth A/B testing Match Play or Stableford as alternative defaults later — Dormie's premium positioning could justify a more "golf insider" default that stands out from generic golf apps.
- 2026-05-05 — Trip detail UX for trips with no stakes set: v1 ships with small "No stakes set — handle settlement offline" indicator. Watch beta feedback for whether users find this confusing or want a richer "informal stakes" mode (verbal commitments tracked but not calculated). The full stakes feature with per-game configuration ships in v1 — this question is only about the skip-stakes edge case.
- 2026-05-04 — Cinematic features queued for post-beta deep work. See docs/dormie-cinematic-exploration.md for full strategic exploration. Five moments identified: post-trip recap (the big one), live trip moments, year-in-review, anniversary triggers, achievement system. Build sequence depends on real beta data. Verify post-round share card existence in next audit session.
- 2026-05-04 — Design DNA consolidated. See docs/dormie-design-dna.md for canonical reference. Pulls together design language from Jan-Apr 2026 chats into single source of truth. Use as orientation doc for future design-focused sessions.
- 2026-05-03 — Form sub-headline copy gap (Item 3 build). "Explore your next dream trip" needs a 1-2 sentence sub-headline explaining what users get from filling out the form. Claude (this assistant) suggested writing it during spec; flagging that Ian has better taste for Dormie voice than I do, so this should be Ian's call when we draft final form copy. Don't ship with a blank.
- 2026-05-03 — Dynamic destination popularity ranking (post-beta). "Where do you want to go" autocomplete should eventually show top destinations weighted by Dormie user popularity, not alphabetical or curated-only. Once we have submission data, sort the suggestions by frequency. Could become a "Trending in Dormie" indicator. Strategic moat: showing what real golfers are dreaming about beats showing what marketing teams suggest.
- 2026-05-03 — Inquiry admin view (post-launch). Once dream_trip_inquiries has real submissions, build a simple admin/founder view (could be a Supabase SQL query, or a basic Dormie web admin) to read submissions, filter by category/budget/window, and identify high-intent leads.
- 2026-05-03 — Stats card revealed as 100% hardcoded mock data despite appearing functional. Sweep other surfaces post-beta to find any other "looks real, isn't real" content (Home tab Stats, Season standings, Scoreboard, anywhere displaying user-specific numbers). Don't ship to beta with hidden mock data.

### 2026-05-03 — Initial seeding

These are everything Ian and I have surfaced across our conversations that hasn't been acted on yet.

- The Dream Board could become a moat via mutual-interest notifications between friends ("Drew also has Bandon Dunes saved → plan together?") — Strava-style social proof but for travel intent
- Sponsorship architecture: destinations table already has `is_sponsored` and `sponsored_until` columns ready for revenue layer when scale supports it
- Top-entrepreneur lens — there are at least four mental models that should periodically be applied to Dormie decisions: Strava (segments/social proof), Airbnb (wishlist/aspiration), Notion (power-user scaling), Goodreads (intent capture)
- The Stats card on Trips landing should be tap-to-drill, becoming a full data story rather than four numbers
- Long-press quick actions on trip cards (Edit / Duplicate / Share / Delete) — power user feature, doesn't crowd casual UI
- Trip templates: "Plan a trip like Myrtle Beach 2025" — duplicate group + format + side games for new course/date. Most repeat trips share patterns
- Live trip state needs distinct visual treatment — pulsing indicator, different color, banner at top of Trips tab when a trip is currently happening
- Member avatars stacked on trip cards — currently you only see player count via dots, not who. By 30 trips users will want visual scan
- Trip search and filters become essential at 20+ trips per user
- Pagination/collapsing for long trip lists — show 2-3 of each section, "See all" affordance
- Year-in-review Season recap — surface best trips, top opponents, biggest moments. Annual ritual content
- Trip-to-Season conversion flow — annual trips becoming explicit multi-year storylines
- Trip recap screen post-trip — generated with stats, awards, best moments, photos, head-to-head winner. Designed to be shared
- Real-time chat with reactions, threading, voice notes — full feature, not Phase 2 quick wire
- Trip Moments creation flow — photo, voice note, text, with reactions and threading
- Live head-to-head tracking — real-time during scoring, not post-round only
- Trip-mode UI takeover when a trip is live — primary navigation contextualizes around it
- Explore as AI-powered trip planner agent — natural language input, full itinerary output, integration with course/weather/accommodation APIs. Long-term vision, validate manually first
- Pre-beta validation: stub Explore as intent-capture form, get 100-500 real submissions, hand-plan first 10 trips, validate unit economics before building AI
- Personalization layer for Explore — compounding recommendations based on user's history. Year 2 user gets vastly better suggestions than year 1 user
- Direct booking integration (tee times, hotels, flights) — Phase F, post-funding territory likely
- Per-game stakes (current Stakes field is single $ amount which is limiting) — multi-game trips need granular stakes
- Number of players selector — currently 2-8 pill picker. What about 12-person trips? 16-person?
- Quick Trip vs Plan Ahead vs Ryder Cup audit — only Quick Trip thoroughly validated. Other two need walkthrough
- Trip type expansion — Tournament? Casual round? Standing weekly group? Member-guest? Annual member tournament for clubs?
- Non-golfer trip participants (spouses, kids) — currently no role in product, probably right, but periodic review
- Stats card filterability — by year, by region, by group, by course difficulty
- Course difficulty badging in Discover/Explore — handicap-relative difficulty (this course plays 4.2 strokes harder than your average)
- Weather integration in trip planning — best season recommendations baked into destination cards
- Resort partnership outreach playbook — when do we approach Pinehurst, Bandon, Pebble for sponsorship? What's the pitch deck?
- Per-organizer subscription model needs market validation — willingness to pay $5/mo, $10/mo, $80/year? Beta will tell
- Anti-feature discipline doc — what we say no to and why. Powerful for solo dev focus
- Onboarding for first-time trip organizer needs design attention — empty state today, but the conversion moment is critical
- Friend invitation flow optimization — current SMS share is okay but could be more shareable, more viral
- Group identity within Dormie — friend groups have implicit identity (the regulars, the annual crew, the bachelor party group). Should this be explicit? Group profiles?
- Anniversary trips and milestones — "5th annual Myrtle trip" is a real thing. Worth surfacing
- Photo/video moments with auto-organization — "best shots of the trip" generated reel
- Course recommendations based on group's average handicap — find the right difficulty fit
- Trip difficulty scoring — was this course brutal for our group? Track for future planning
- Dormie newsletter / content layer — long-term, post-launch. Course reviews, trip planning guides, gear recommendations
- Pro vs Casual user differentiation — interface complexity that scales with engagement
- Trip leaderboard during live trip — running totals, who's up, who's down, daily winners
- Achievement/award system for trips — Player of the Day, Comeback Kid, Sandman, Closer
- Friend tagging in moments — "@Drew @Jake great putt"
- Voice note as a moment type — first-class citizen, not buried
- AR-something? Maybe overhead view of trip courses? Worth thinking about. Vision Pro era?
- Apple Watch companion for live scoring? Far future
- Apple Pay / Venmo split for trip stakes settlement — could replace the spreadsheet entirely
- Trademark monitoring for "Dormie" variations — InterLAN abandonment April 2026 expected, plus other potential conflicts
- LLC formation timing — pre-beta, before any revenue, before any liability surface
- Feedback capture for beta testers — TestFlight, in-app form, dedicated email, hosted Discord?
- Beta cadence — weekly group? Monthly? How do we decide what to ship next based on input?
- Dormie demo video / landing page when website ships — show the product, don't tell
- App Store Optimization (ASO) strategy — keywords, screenshots, description for App Store ranking
- Brand voice guidelines — confident, simple, golf-specific, warm. Should be written down for consistency
- Photography style guidelines — golf course photography is a specific aesthetic. Sourcing strategy?
- Press strategy for launch — Golf Digest, Golf.com, McKinsey-of-golf publications. Worth mapping
- Founders we admire who built in adjacent categories — Strava, Airbnb, Notion, Stripe, Whoop. Lessons to extract
- Anthropic prompt engineering improvements for Claude Code workflow — meta-improvement for productivity
- Multi-language support — eventually international markets, especially UK/Australia/Japan golf cultures
- Dark mode is locked in — but what would a light mode look like? Worth one-off exploration?
- Accessibility audit — VoiceOver, dynamic type, color contrast. Should happen pre-beta
- Performance audit — Trips list load time at 50+ trips, image optimization, query optimization
- Database backups beyond Supabase Pro auto-backup — paranoid safety check
- Deletion flows — what happens when a user deletes their account, leaves a trip, removes a friend? Needs deliberate design
- Privacy paranoia — handicap data, location data, photos. What's the privacy policy actually saying?
- GDPR compliance for any European testers — required, even small scale
- iOS vs Android user research — when does Android matter? Current bet is post-launch
- Customer support model — when there's no team, how does support actually work?
- Error reporting and crash recovery — Sentry foundation, but what's the response process?
- Feature flag system — for beta vs production differentiation. May want before broader launch
- A/B testing infrastructure — much later, but worth knowing where it fits
- The "Ian is Dormie" branding question — when does the founder become public-facing? Tradeoffs
- Influencer partnerships in golf — long-term marketing channel, who are the right voices?
- Newsletter/content strategy as moat-building — Dormie POV on trips, courses, friend golf
- Conference/trade show presence — PGA Show in Orlando is a thing. Worth attending eventually?
- The competitive blind spot — what could 18Birdies build in 90 days that would hurt us most? How do we get ahead of it?
- Defensive moat thinking — what's actually defensible long-term? Friend graph? Data? Brand? Network effects?

---

## How to Use This Document

**When you have a thought:** Add it to the top with today's date. One line. Don't think about it more.

**When you tell Claude something interesting in a session:** Ask Claude to add it to compost. Easier than remembering to do it yourself.

**Every 3-4 weeks:** Review the list. For each item:
- Promote to spec or strategy doc — write it as a real plan
- Delete — no longer interesting or wrong
- Leave — still interesting, not actionable yet

**The compost pile is a feature, not a bug.** Most ideas should die. The point is capturing them so the good ones don't get lost in the noise of everything else.

**Don't try to organize this list.** The format is intentionally simple. Resist the urge to add categories, priorities, or structure beyond date-stamping. Organization comes during the periodic review, not during capture.

---

*The compost pile is where Dormie's future lives until it's ready to be born.*
