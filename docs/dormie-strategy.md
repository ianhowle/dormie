# Dormie Master Strategy

**Last updated:** 2026-05-03
**Owner:** Ian Howle
**Status:** Living document — update when fundamentals shift, not when tactics change
**Read frequency:** Every 2-4 weeks, when work feels disconnected from purpose

---

## Why This Document Exists

Tactical work makes you forget the big picture. Code-level decisions accumulate, accommodations get made, scope drifts. This document is the reorientation point. When Dormie feels like it's becoming something other than what it should be, come back here.

It's deliberately short. If it grows past 10 pages, you've stopped distinguishing strategy from tactics. Strategy is the small set of decisions that everything else flows from.

---

## The Strategic Bet

**Dormie is the social travel platform for golfers, not a golf scoring app.**

Most golf apps treat the round as the product. Dormie treats the trip as the product, with scoring as one feature inside the trip. This reframe changes everything downstream — the user we attract, the features we build, how we monetize, what we're worth.

The category we're entering is empty. GolfNow is transactional booking. 18Birdies is commoditized scoring. GolfPass is content. Strava-for-golf, Airbnb-for-golf-trips, Goodreads-for-golf-courses — none of these exist. We're building all three at once, layered on a trip-centric core.

If this works, we're not competing with golf apps. We're competing with travel apps in a niche they don't serve.

---

## Target User

**Primary user (sharp focus):** the trip organizer in a friend group of 4-12 golfers who plays 0-10 rounds at home but takes 1-3 dedicated golf trips per year.

This person is:
- 30-55 years old, mid handicap (8-22), reasonable disposable income
- The friend who books the Airbnb, organizes the tee times, sets up the Venmo for stakes
- Frustrated that no app handles trips well — they cobble together group chats, spreadsheets, paper scorecards
- The economic decision-maker for their group's golf travel ($500-3000 spent per trip per person)

**Secondary user:** trip participants. They use Dormie because the organizer set up the trip there. Their experience needs to be effortless — install, join via code, score, see moments, done.

**Anti-target user:** The serious-tournament golfer, the daily-driver scoring user, the gear-stat obsessive. Hole 19, Arccos, Shot Scope serve them well. We are not competing for that user. Building for them dilutes us.

---

## Competitive Positioning

| Player | Strength | Weakness | Our angle |
|--------|----------|----------|-----------|
| GolfNow | Booking volume | Transactional, no community | We own the planning + group experience that precedes booking |
| 18Birdies | Free scoring, large user base | Commoditized, ad-driven, weak retention | We're trip-first; their group features are afterthoughts |
| GolfPass (NBC) | Content + brand | Subscription priced for power users | Different value prop entirely |
| Hole 19, Arccos | Power-user analytics | Hardware-tied, narrow appeal | Different user, different category |
| GolfGenius | Tournament-grade tooling | Built for clubs, not friend groups | We're the friendly version |

**The defensible position:** Dormie wins because we own the friend graph around shared golf travel. Once a group's trips, members, and history live in Dormie, switching costs are real. Photos, moments, head-to-head records, dream destinations, season standings — these compound over years.

---

## Monetization Model

**The tiered model we're betting on:**

**Tier 1 — Free.** Personal use, single group, basic trip features. Acquisition fuel.

**Tier 2 — Pro subscription** (~$5-10/month or $50-80/year). Multiple groups, advanced features (Trip Tools, real-time chat, custom scoring formats, full historical analytics). Per-organizer pricing — only the trip planner needs to subscribe; their group plays free.

**Tier 3 — Trip facilitation revenue.** When trips book through Dormie's planner (Phase F future state), we take 3-5% of the trip spend or earn referral fees from resort partners. At scale, this is the dominant revenue stream — average trip spend $500-3000/person × 4-12 people × 5% = $100-1800 per booked trip.

**Tier 4 — Sponsored destinations.** Pinehurst, Bandon, Pebble, Streamsong, Cabot pay for prominent placement in Discover/Explore. Only feasible after we have user volume.

**Reasoning:** Ad-supported scoring apps (18Birdies model) ceiling at maybe $5-10 ARPU per year. Trip-driven platforms can hit $50-500 ARPU per year. Different unit economics, different valuation outcomes.

**Pre-beta:** All free. Validate the product loops before charging.
**Beta to v1:** Introduce Pro tier once active groups exceed 50.
**Post-v1:** Begin trip facilitation experiments with hand-curated bookings before automating.

---

## Pre-Beta Scope (What MUST Ship)

These are non-negotiable for a real beta launch. Beta = real friend groups using Dormie for real trips, not Ian + Kara + Drew test runs.

**Trips feature** — fully operational end-to-end ✅ (largely shipped as of 2026-05-03)
- Create, manage, invite, join, score
- Mock data eliminated from real-trip flows
- Aspirational layer (interactive Dream Board) ✅
- Trip Tools at minimum show "coming soon" without breaking

**Scoring** — works correctly across the formats we ship
- Stroke play, match play, stableford, scramble, best ball minimum
- Already audited (`docs/scoring-audit-2026-04-19.md`)
- Side games render and track correctly

**Seasons** — minimum viable
- Address the 7 schema gaps from `docs/seasons-audit-2026-04-19.md`
- Basic functionality for repeat-trip groups (annual Myrtle trip becomes a Season)

**Social loop primitives**
- Friends system ✅
- Friend Dream Board visibility (Phase C, deferred — not pre-beta blocker)
- Real-time chat (deferred — empty state acceptable for beta)

**Operational foundations**
- Apple Developer enrollment ($99/yr)
- EAS Development Build setup
- Sentry crash reporting active
- APNs certificate configured
- Privacy Policy + Terms of Service published
- LLC formation (TN, ~$300)
- Trademark resolved (currently blocked by Dormie Network LLC; InterLAN abandonment expected April 2026)

**Beta tester onboarding**
- First real beta group seeded with Kara + Drew + immediate friends
- Feedback capture mechanism (TestFlight feedback, in-app form, email)
- Designated cadence for processing feedback into work

---

## Post-Beta Roadmap (Next 12 Months at High Altitude)

After beta launches, here's the rough sequence. None of this is committed to specifically — the sequence depends on what beta testers tell us.

**Months 1-2 (post-beta):** Stabilize. Fix what beta testers break. Polish the Trips experience based on real usage patterns. Resist building new features. The hardest discipline.

**Months 3-4:** Real-time chat, Trip Moments creation flow, social Dream Board (Phase C from Trips vision doc). The features that make trips feel alive during the trip itself.

**Months 5-7:** Trip Tools real wiring. Budget tracking, packing lists, tee group management, RSVP flows. Six features that have to be built deliberately. Could be slower if we discover beta testers don't actually want these.

**Months 8-12:** Explore as intent-capture form (B1 from Trips vision). Begin collecting dream-trip data. Hand-plan first 10 trips for revenue validation. Don't build the AI agent yet — validate the manual version first.

**Year 2+:** AI-powered Explore agent if validation supports it. Sponsorship integrations. Scale work.

This sequence is fragile. Every milestone could shift based on what beta tells us. Hold the strategy loosely.

---

## Non-Goals (Equally Important)

What Dormie explicitly is NOT and will not become:

- **Not a daily-use scoring app.** If someone scores 4 rounds a week with us, great, but we're not optimizing for that.
- **Not a tournament management platform.** GolfGenius owns that.
- **Not a hardware-paired analytics product.** Arccos owns that.
- **Not an ad-supported free product at scale.** Subscription + transaction revenue.
- **Not a social network.** Following, feeds, public discovery — all anti-pattern. Friend graph only.
- **Not an instructional content product.** Lessons, tips, drills — no.
- **Not a launch monitor companion.** Different category.
- **Not multi-sport.** Golf only, forever.

When tempted to add scope, check this list. If something belongs here that isn't, write it down and don't build it.

---

## Open Strategic Questions

Decisions deferred. Tracked here so they don't get lost. Each will need a deliberate strategic session to answer.

1. **What's the right pricing for Pro tier?** $5/mo, $10/mo, $80/year? Need beta data on willingness-to-pay.

2. **Should the trip organizer pay or the whole group?** Per-seat would yield higher ARPU but raises adoption friction. Per-organizer is what we're betting on, but worth re-examining.

3. **What's our stance on competitive overlap with 18Birdies if they add trip features?** Defensive moat building vs. category-leading speed.

4. **Do we ever build for golf clubs (B2B) as a side channel?** Annual member-guest tournaments are essentially trips. Could be a real segment.

5. **What's the relationship between Trips and Seasons in the long run?** Annual trips compound into Seasons. But are Seasons their own concept or are they trip-of-trips? Deferred until post-beta to see how users naturally use both.

6. **Should non-golfer trip participants (spouses, kids) have any role in the product?** Most trips have non-playing attendees. Today they don't exist. Probably right to keep it that way, but worth periodic review.

7. **What's our long-term play on data ownership and exports?** Power users will want their trip data exportable. Architectural decision to make before too much data accumulates.

8. **Is Dormie a venture-backed company or a profitable solo business?** Different decisions follow from each. The trip-facilitation revenue model can support either path. Need a deliberate session on this within 6-12 months.

---

## Strategic Decisions Already Made

Captured here so we don't re-litigate.

- **Trip-first, scoring-second.** The reframe that defines everything.
- **Friend group focus, not solo or open social.** Closed graph by design.
- **Subscription + transaction revenue, not ads.** Different unit economics.
- **Solo build through beta, then evaluate funding.** Don't raise prematurely.
- **iOS-first, Android later.** Solo dev capacity, plus golfers skew iOS.
- **Premium aesthetic, not casual SaaS.** Augusta National / Masters / Stripe Dashboard reference points.
- **Real-time chat is post-beta.** Empty state acceptable for beta.
- **AI Explore is post-beta validation, not pre-beta build.** Validate manual version first.
- **Trademark conflict navigated, not resolved.** InterLAN abandonment expected April 2026, monitor and refile.
- **TN LLC formation is the right legal entity.** Don't overthink corporate structure pre-revenue.

---

## How to Use This Document

**When tactical work feels meaningless:** read the Strategic Bet. Reorient.

**When tempted to add scope:** read Non-Goals. Most temptations belong on that list.

**When considering a feature:** ask if it serves the Primary User. If not, it's probably wrong.

**When making a decision:** check if it's already in Strategic Decisions Already Made. Don't re-litigate.

**When the answer isn't obvious:** add it to Open Strategic Questions. Don't force a decision under build pressure.

**When something fundamental changes:** update this document. Then update what it implies. The doc is the canonical reference.

---

*The smallest version of Dormie that matters: a friend group of golfers can plan a trip together, take it together, score it together, remember it together, and do it again next year. Everything else is iteration on that core loop.*
