# Trips Product Vision

**Date:** 2026-05-03
**Status:** Strategic vision document — not a build spec
**Purpose:** Capture the long-term product ambition for Trips, the framing that makes Dormie defensible, and the prioritized path to get there.

---

## The Strategic Bet

Trips is not a feature inside a golf app. Trips is the centerpiece around which everything else orbits. Most golf apps treat trips as a folder for rounds. Dormie treats trips as the social travel experience that golfers actually want — planning, dreaming, going, remembering, repeating.

**The competitive landscape we're entering:**

- **GolfNow** — tee time booking. Transactional. Weak retention.
- **18Birdies** — round scoring + social. Commoditized scoring engine. Mid retention.
- **GolfPass (NBC)** — content + booking. Brand-driven. Decent retention.
- **Hole 19, Arccos, Shot Scope** — shot tracking and stats. Hardware-tied. Power user only.

None of these own the social travel experience. None capture trip *intent* (the dreaming and planning before the booking). None build the friend-graph around shared destinations. That's the open territory.

**The reframe:** if Dormie wins, we're not competing with golf scoring apps. We're competing with Airbnb Experiences and Strava in a niche they haven't entered.

---

## The Three Loops That Make This Work

### Loop 1 — Aspiration to action
User adds a destination to Dream Board → friend has the same destination → mutual-interest notification → planning conversation begins → trip created → trip happens → memories captured → returns to Dream Board with new aspirations.

This is the **compounding social loop**. Every completed trip strengthens future aspirations. Every shared destination compounds friend graph value.

### Loop 2 — Intent capture to revenue
User builds Dream Board over time → app accumulates intent signal (where, with whom, when) → AI planner (Explore) surfaces tailored trip suggestions → user converts intent into bookings → resort partners pay platform for high-intent leads.

This is the **monetization loop**. Most golf apps monetize behavior (rounds played) which has limited revenue per user. Trips monetizes intent (rounds dreamed about), which converts to actual travel spending of $500-5000 per trip per person. Even at 5% take rate, that's $25-250 per trip booked through the platform — a different unit economic story than ad-supported scoring.

### Loop 3 — Memory to repeat
Completed trip → photos, moments, scores, awards captured → trip card lives in user's history → next year's trip uses the previous trip as template → annual trip becomes ritual → ritual becomes a Season → Season becomes a multi-year storyline.

This is the **retention loop**. Memories are sticky in a way that single-round scores are not. Annual trips don't churn. They invite friends.

---

## The Five Pillars of Trips

These are the conceptual building blocks. Each one needs to be elite for the whole to feel elite.

### Pillar 1 — Aspiration (Dream Board)
The user's emotional connection to the future of their golf life. Where do they want to play? With whom? When?

**Today's state:** Beautiful static UI that does nothing.
**Vision:** Three-destination cap. Per-destination status (Saved → Planning → Booked → Played). Friend visibility with mutual-interest notifications. Sponsorship-ready architecture.

### Pillar 2 — Discovery (Explore)
How users find new places to dream about and plan toward.

**Today's state:** Tile that links to a generic destination list.
**Vision:** AI-powered trip planning agent. User describes their ideal trip in natural language ("3 days in Charleston, 4 players, mid-handicaps, $2000/person"). System returns a draft itinerary with courses, accommodation, weather windows, dining. User customizes, then converts to a real trip.

### Pillar 3 — Planning (Trip creation + management)
The mechanical work of turning a dream into a logistics-complete trip.

**Today's state:** Solid Quick Trip flow. Plan Ahead and Ryder Cup not deeply audited yet. Member management, invite system, scoring formats all functional.
**Vision:** Multi-day trip support is real (not just a date range). Per-day course assignments. Per-day side games and stakes. Trip Tools (Budget, Packing List, Tee Groups, RSVP) genuinely useful. Trip templates ("Plan a trip like Myrtle Beach 2025").

### Pillar 4 — The Trip Itself (Live state)
The experience of being on a trip — actively scoring, chatting, sharing moments, tracking head-to-head.

**Today's state:** Scoring works. Chat is empty state. Moments are empty state. Live indicator doesn't exist.
**Vision:** A trip in progress dominates the app's UI when active. Persistent header banner. Push notifications for moments, head-to-head shifts, scoring milestones. Real-time chat. Photo/video moments. Voice note moments. The most intense usage period of the app's lifecycle.

### Pillar 5 — Memory (Completed trips)
What the trip becomes after it's over. The story that lives forever.

**Today's state:** Completed trips appear in the list. No deeper memory layer.
**Vision:** Trip recap screen with stats, awards, best moments, head-to-head winner, photo highlights. Shareable. Becomes the seed for next year's planning.

---

## What Top Entrepreneurs Would Notice

If you put this product in front of someone who's built and scaled consumer apps in adjacent categories, here's what they'd flag.

### From a Strava founder's lens
Social proof drives retention. Show me what my friends are doing. Mutual segments, mutual courses, mutual destinations. The Dream Board social layer is the equivalent of Strava's segment leaderboards — it's what makes solo activity feel social.

### From an Airbnb founder's lens
Trust and aspiration drive bookings. The platform's job is to remove uncertainty and enable inspiration. Photography matters. Reviews matter. "Saved" lists matter. The Dream Board concept maps directly to Airbnb's wishlist.

### From a Notion founder's lens
Power users are 10x users. Build features that scale from "casual user with 2 trips" to "power user with 50 trips" without compromise. Search is non-negotiable. Templates are non-negotiable. Bulk actions are non-negotiable.

### From a Goodreads founder's lens
The "want to" list is more valuable than the "did" list. Wishlists predict future spending. They're shareable in a way completed activities aren't (no spoilers). They're how networks form (mutual interests).

### From a sponsorship perspective
Resorts spend millions on lead acquisition. A platform that says "your friends are dreaming about Bandon, plan a trip together" is selling pre-qualified leads at 10-50x the conversion rate of cold traffic. Architect the Dream Board now so that sponsored destinations can slot in alongside organic ones without rebuilding the feature.

### From a unit economics perspective
The trip-driven revenue model has dramatically better economics than ad-supported scoring. Average trip spend per person ranges $500-5000 depending on destination tier. Even at 5% commission, that's $25-250 per trip booked. With 800 active groups doing 2 trips a year, that's $40-400K in annual revenue from trip facilitation alone. Sponsorship and subscription stack on top.

---

## Prioritized Roadmap

This is the path from current state to elite. Each phase is a deliberate session or set of sessions, not a sprint.

### Phase A — Foundation (next 1-2 sessions)

These are the highest-leverage UX gaps that block elite feel without requiring new pillars.

**A1. Dream Board interactivity (with constraint).** Three-destination cap per user. Status field (Saved → Planning → Booked → Played). Tap-to-add from Discover/Explore. Tap-to-remove from Dream Board card. No social layer yet. Just make the existing visual interactive.

**A2. Trip search and basic filters.** Search by trip name, by location, by year. Single text input at the top of the Trips list. Required before user has 20+ trips.

**A3. Member avatars on trip cards.** Visible without opening the trip. Stack of 3-4 avatars with "+N" overflow.

**A4. Resolve Dream Board vs Bucket List.** Product decision: separate with sharper distinction OR merge. My recommendation: merge into unified Dream Board with optional region grouping. Simpler mental model.

**A5. Live trip state.** Distinct visual treatment for trips currently in progress. Banner at top of Trips tab. Pulsing live indicator on the trip card.

**A6. Kill the Discover button.** Redundant with Explore. Pick one CTA.

**Estimated total:** 1-2 focused sessions. All Foundation work is bounded, achievable, and visible.

### Phase B — Intelligence layer (next 2-4 sessions)

These build the core differentiation. They're harder than Foundation work but they're where the moat starts.

**B1. Stub Explore as intent-capture form.** Before building any AI, get 100-500 real user submissions of dream trips. Hand-plan the first 10. Charge for it. Validate unit economics. THEN build the AI.

**B2. Tap-to-drill on Stats card.** The "you play 2.4 strokes better on trips" insight becomes a full data story. Course-by-course breakdown, year-over-year, best/worst trips, stroke distribution.

**B3. Trip templates.** "Plan a trip like Myrtle Beach 2025." Duplicate previous trip metadata (group, format, side games) for new course/date. Most trips repeat patterns.

**B4. Long-press trip card quick actions.** Edit, Delete, Duplicate, Share. Power user feature that doesn't crowd the UI for casual users.

**B5. Pagination/collapsing for long Trips lists.** Show 2-3 of each section, "See all" affordance to dedicated full-list view.

**Estimated total:** 2-4 sessions across these.

### Phase C — Social layer (after Phase B)

This is where Dream Board becomes a moat.

**C1. Friend Dream Board visibility.** "Drew has Bandon Dunes on his Dream Board too" surfaces in the UI. Mutual-interest indicator.

**C2. Notification system for mutual destinations.** When a friend adds a destination matching yours, push notification with a "Plan together?" CTA.

**C3. Group Dream Boards.** Friend groups can have a shared Dream Board for collective planning.

**C4. Dream Board → trip creation flow.** "Plan Trip" button on a Dream Board destination becomes a real, prefilled trip wizard with that destination's data.

### Phase D — The Live Trip experience (after Phase C)

This is the most-used moment of the app's lifecycle and currently the least developed.

**D1. Real-time chat with Supabase Realtime + push.**

**D2. Trip Moments creation flow.** Photo, voice note, text. With reactions and threading.

**D3. Live head-to-head tracking.** Real-time during scoring.

**D4. Trip-mode UI takeover.** When a trip is live, the app's primary navigation contextualizes around it.

### Phase E — Memory layer (after Phase D)

This makes trips matter forever, not just during.

**E1. Trip recap screen.** Generated post-trip with stats, awards, best moments, photos, head-to-head winner. Designed to be shared.

**E2. Year-in-review Season recap.** Same idea but Season-level, surfacing best trips, top opponents, biggest moments.

**E3. Trip-to-Season conversion.** Annual trips become explicit Seasons that compound over years.

### Phase F — Discovery and intelligence (long-term)

This is the AI agent vision. Build only after A through E are solid.

**F1. Real AI trip planner.** Natural language input → full itinerary output. Course recommendations based on handicap, group preferences, budget, weather windows. Integration with course APIs, weather services, accommodation providers.

**F2. Personalization layer.** Compounding recommendations based on user's trip history and preferences.

**F3. Sponsorship integration.** Featured/sponsored destinations alongside organic. Revenue share with resort partners.

**F4. Booking integration.** Direct tee time booking, accommodation booking, payment processing.

**Estimated total:** 6-12 months of dedicated development. Not for solo builder timeline. This is post-funding territory.

---

## What Phase A Actually Looks Like — Picking 2-3 to Execute Now

From Phase A, the highest-leverage 2-3 items to ship in the very next session:

**Recommended: A1 (Dream Board interactivity), A4 (resolve Dream Board vs Bucket List), and A6 (kill Discover button).**

Why these three together:
- They're related — all touch the aspirational layer of Trips
- A4's product decision unlocks A1's implementation cleanly
- A6 is a 5-minute fix that ships obvious progress
- A1 alone ships visible new functionality users will notice immediately

**Alternative: A2 (search), A3 (avatars), A5 (live trip state).** These are all Trips list polish — different lens than aspiration. Pick this set if you want to make the Trips landing screen elite before tackling Dream Board.

**Alternative: A1 + B1 (intent capture stub).** If you want to start collecting Explore data immediately. B1 is a form, not an AI — fast to build, valuable to have in market.

---

## Open Product Questions

These are decisions that need to be made deliberately, not ad-hoc.

1. Is Bucket List a separate concept or merged into Dream Board?
2. Should Dream Board be limited (3 destinations) or unlimited?
3. Does the app's monetization model assume ads, subscription, sponsorship, or revenue share on bookings?
4. How does Dormie handle non-golfer trip participants (spouses, kids)?
5. What's the relationship between Trips and Seasons in the long-term mental model?
6. Should the Stats card aggregate across all trips or be filterable by year/region/group?
7. What's the trip-template UX for groups that have done the same trip 5 years running?

---

## Backlog from this audit (smaller items not in pillars)

These are individual fixes that don't fit a phase but need to be tracked.

- DEMO badge looks slightly clipped at the right edge on some cards (visual polish)
- "Plan Trip" button on Dream Board cards is non-functional (Foundation A1 covers this)
- "Just now" timestamp on Upcoming section is good — keep, but verify it updates correctly
- Tab bar at bottom (Home/Seasons/Trips/Board) — Trips badge with notification dot logic to be reviewed later
- Stats card has no filter or drill-down (Phase B2 covers this)
- Bucket List entries lack interaction (Phase A1 + A4 cover this)
- Explore tiles cut off the third tile visually (responsive issue or intentional preview?)

---

## Closing Frame

The smallest version of Dormie that's still strategically right ships Foundation (Phase A) plus a stubbed intent-capture form (B1). Everything else is iteration.

The biggest version of Dormie that's strategically right is the AI-powered golf travel concierge with sponsorship monetization. That's a unicorn product if it works.

The path between these is sequencing, not scope. Each phase strengthens the previous foundation. Don't skip phases, don't rush phases, don't add new pillars before the existing ones are solid.

The single most important thing to internalize: **most golf apps fail because they treat scoring as the product. Dormie wins by treating travel as the product, with scoring as one feature.** That reframe drives every decision below.

---

*End of vision document. Use as the strategic context for all Trips-related sessions. Update as decisions are made.*
