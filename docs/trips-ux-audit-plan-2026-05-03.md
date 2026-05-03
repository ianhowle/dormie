# Trips UX Audit — Next Session Plan

**Date created:** 2026-05-03
**Purpose:** Before adding more Trips features (Trip Tools wiring, real chat, etc.), conduct a deliberate UX audit to ensure the existing Trips experience is genuinely elite. Then prioritize and execute fixes.

**Approach:** Audit first, prioritize second, execute third, backlog the rest.

---

## Why This Session Matters

The Trips feature is now functional end-to-end (create → list → detail → invite → join). That's the engineering milestone. But functional and elite are different things. Before we pile more features on top, we want the existing experience to be:

- **Efficient** — minimum taps, minimum friction, anticipates the user's next move
- **Optional** — gives users choices without overwhelming them
- **Accurate** — every option does what users expect, no broken paths or stub features
- **Fun** — feels like a golf app for friends, not a SaaS spreadsheet
- **Scalable** — works for groups of 2 and groups of 16, for users with 1 trip and users with 50
- **Elite** — competitive with Notion, Linear, Stripe — products people pay attention to

Visual design polish (gradient palettes, typography refinement, spacing, color) is deferred to a dedicated design session. This audit is about *interaction quality*, not pixel-perfect aesthetics.

---

## Audit Framework — Nine Dimensions

For every Trips flow we examine, we'll ask these questions:

### 1. Efficiency
- How many taps to complete this action?
- Are there unnecessary screens or confirmations?
- Does the UI anticipate the user's likely next action?
- Are common actions accessible from multiple contexts?

### 2. Optionality
- Does the user have appropriate choice without being overwhelmed?
- Are advanced options hidden behind progressive disclosure?
- Can users customize without forcing complexity on those who don't need it?
- Are there "happy paths" that take care of 80% of users with default behavior?

### 3. Accuracy
- Does every option actually work?
- Are there stub features or "Coming Soon" toasts that shouldn't be visible yet?
- Do all the scoring formats actually compute correctly?
- Do all the side games render and track properly?
- Are there orphaned UI elements (buttons that don't do anything, tabs with no content)?

### 4. Fun
- Does this feel like a tool for friends, or a tool for accountants?
- Where could we add delight (haptics, animations, copy)?
- Where does the app currently feel transactional when it could feel social?
- Are there moments to celebrate (creation, joining, scoring)?

### 5. Scale — multiple users over time
- What happens when a trip has 16 members instead of 4?
- What happens when a user has 50 trips instead of 2?
- Are there N+1 query problems lurking?
- Does the UI handle long lists gracefully (virtualization, pagination, search)?
- What about a user who's been a member of 200 trips over years?

### 6. Scale — single user heavy use
- Power users who run weekly trips — does the app keep up?
- What's the load time of the Trips list with many trips?
- Does pull-to-refresh stay snappy?
- Are there features that don't scale (like loading all members upfront)?

### 7. Trip setup accuracy across types
- Quick Trip — fully audited (this is what we built tonight)
- Plan Ahead — needs walkthrough audit
- Ryder Cup — needs walkthrough audit (backend audit said 11/0 critical, but UX may differ)
- Are there trip types we should add? (Tournament? Casual round? Standing weekly group?)

### 8. Game functionality verification
- Walk through every scoring format in the create-trip wizard
- Walk through every side game
- Confirm each one renders correctly when selected
- Confirm each one tracks correctly during scoring (this overlaps with the scoring audit)
- Hide or remove anything that's not production-ready

### 9. Layout elite-ness
- Is the screen hierarchy clear?
- Is the visual rhythm right (Augusta green / gold / dark surfaces / serif numbers)?
- Are sections appropriately spaced?
- Does the eye know where to look first?
- Could we hide chrome to focus on content?

---

## Walkthrough Order

We audit every major flow systematically. Take notes during each walkthrough.

### Flow 1 — Trips tab landing
- Open Trips tab from each tab bar entry point
- Empty state (demo off + zero real trips) — does it convince a new user to create their first trip?
- Empty state with demo on — does the peek work? Is it obvious what's demo vs real?
- Real-trips-populated state with demo on — does the new "DEMO" badge feel right?
- Real-trips-populated state with demo off — clean state
- Discover button — does it work? Useful?
- Pull to refresh — feels right?
- Trip card design — does it convey enough info at a glance?
- Multiple trips — sorted correctly (upcoming by date, completed by recency)?

### Flow 2 — Create Trip wizard
- + New Trip → trip type picker
- Walk through all three trip types (Quick / Plan Ahead / Ryder Cup) and audit each one
- Trip name field — should it have suggestions? Auto-naming based on course + date?
- Course picker — is the autocomplete fast enough? GolfCourseAPI fallback feel right?
- Number of players selector — the 2-8 pill picker, does that feel right? What if you want 12?
- Scoring format radio list — too many options? Too few? Are they explained well? Is "Total Strokes" different enough from "Stroke Play" to matter?
- Side games checkboxes — same questions
- Stakes field — single $ amount feels limiting (per-game stakes is a known gap)
- Players list — Add Player button visible and works
- Create Trip button — dynamic labels work
- After successful creation — lands on trip detail, which we audit next

### Flow 3 — Trip detail
- Header — shows real data, days countdown
- Player avatar row — varies by member count (test with 2, 4, 8, 16)
- Tab bar (Clubhouse / Courses / Players / Checklist / 19th Hole)
- Each tab — content, empty states, copy
- Trip Tools panel — currently all "coming soon"
- Trip Moments — empty state, Add Moment button (deferred)
- Head to Head — empty state
- Latest preview — empty chat
- Invite Code section — Copy button works
- Format / Rounds / Games / Players row — accurate values
- Start Trip button (top-right) — does it lead anywhere meaningful?

### Flow 4 — Players tab and Add Player
- Players list rendering for organizer vs non-organizer
- Empty state ("share your invite code to grow the trip")
- Add Player button — only visible to organizer
- AddPlayerSheet → Friends / Recent / Invite / Guest tabs
- Each tab — does it feel intuitive?
- Multi-select on Friends/Recent — clear UX?
- Guest tab — fire-and-forget, dismisses cleanly?
- Invite tab — Trip Code visible, Generate Share Link works
- Share button — system share sheet experience

### Flow 5 — Joining a trip
- Trips tab → Join button
- Modal opens — title, subtitle, input field
- Code input — auto-format, auto-uppercase, paste handling
- Submit — both code formats work (9-char permanent, 6-char expiring)
- Success — toast, navigation, trip appears in list
- Errors — invalid code, expired, maxed out
- Already-member case — silent navigation

### Flow 6 — Deep link entry
- Tap a `dormie://trip-invite/<code>` link from Messages
- Lands on trip-invite screen with preview
- Join Trip button works
- Already-member case
- Edge cases (expired, invalid)

---

## Per-Flow Audit Output Format

For each flow we walk through, document:

```markdown
### Flow X — [Name]

**What works well:**
- [bullet list]

**Friction points:**
- [bullet list of friction, ordered by severity]

**Missing functionality:**
- [bullet list]

**Scale concerns:**
- [bullet list]

**Fun deficit:**
- [bullet list — places that should be more delightful]

**Accuracy bugs:**
- [bullet list — broken or stub features]

**Top 3 priorities for this flow:**
1. [highest impact fix]
2. [second]
3. [third]
```

---

## After the Walkthrough

We compile a master list of all findings across all flows. Each finding gets tagged:

- **Severity:** P0 (blocks launch) / P1 (should fix before beta) / P2 (post-beta polish)
- **Effort:** S (under 30 min) / M (under 2 hours) / L (dedicated session)
- **Category:** Bug / Friction / Missing / Scale / Fun / Layout

We sort by Severity → Effort. Top 5-10 P0/P1 items get tackled in the same session. Everything else goes to backlog for future sessions.

---

## What This Session Does NOT Do

To keep scope manageable:

- **Visual design refinement** — that's a dedicated design pass with mockups, color exploration, etc. Not interaction work.
- **Trip Tools wiring** — Budget, Packing List, etc. — those are six dedicated features. Don't touch them yet.
- **Real-time chat** — separate feature.
- **Scoring system audit** — already done in `docs/scoring-audit-2026-04-19.md`. Reference findings but don't re-audit.
- **Seasons functionality** — separate audit/work cycle.

---

## Hand-Off Prompt for Claude Code

Paste this at the start of next session:

```
Read docs/trips-ux-audit-plan-2026-05-03.md carefully. We're conducting a UX audit of the Trips feature before adding more functionality. The app is functional end-to-end now — this audit is about elite quality, not engineering.

Your role today: I'll walk through each flow on my phone while sharing screenshots and observations. You document findings against the nine-dimension framework in the doc. After we walk through all six flows, you compile a prioritized master list and we execute the top items.

Don't write any code yet. Read the plan doc and confirm you understand the framework. Then wait for me to start the walkthrough.
```

---

## Definition of Done — Next Session

- [ ] All six flows walked through with notes captured
- [ ] Master finding list compiled with severity/effort/category tags
- [ ] Top 5-10 items prioritized
- [ ] At least 3-5 high-priority items shipped
- [ ] Remaining items documented as backlog for future sessions
- [ ] Ian feels confident the Trips feature is elite (or knows exactly what remains to make it so)

---

*End of audit plan. Tomorrow's work is fundamentally different from today's — diagnostic and design-critical rather than engineering. Slow down enough to see the gaps.*
