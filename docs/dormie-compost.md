# Dormie Compost Pile

**Purpose:** Capture every idea, observation, half-thought, feature concept, competitor note, beta tester comment, and stray insight as soon as it surfaces. Do NOT organize. Do NOT act on. Just append.

**Cadence:** Review every 3-4 weeks. Each item gets one of three fates:
- Promote to a real spec or strategy doc section
- Demote to deletion (no longer relevant)
- Re-compost (still interesting, not actionable yet)

**Format:** One line per item. Date-stamped. New entries at the top.

---

## Active Compost

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
