# Dormie Cinematic Features — Deeper Exploration

**Date:** 2026-05-04
**Status:** Strategic exploration, not a build spec
**Purpose:** Capture the thinking on cinematic moments — the emotional payoffs that turn Dormie from a useful app into an iconic one. These features compound emotional value over time and create the kind of moments users screenshot and share unprompted.

---

## What Cinematic Means in This Context

Cinematic features are emotional payoff moments the product earns by capturing data over time. They're not utilities. They don't help users complete tasks. They make users feel something — pride, nostalgia, anticipation, belonging.

The category includes:
- **Strava's Year in Sport** — annual recap of every run, ride, swim
- **Spotify Wrapped** — annual recap of listening habits
- **Apple Activity Awards** — moment-of-achievement celebrations
- **Goodreads Year in Books** — annual reading recap
- **Letterboxd Year in Review** — annual film recap

Common pattern: data captured over time → designed moment of reflection → shareable artifact → drives organic growth via social proof.

These are some of the most-shared assets each platform produces. They drive seasonal traffic spikes, retention, and acquisition. They're disproportionately valuable relative to the engineering effort.

---

## Why Cinematic Matters for Dormie Specifically

Golf trips are inherently cinematic events. Friends get away, play storied courses, generate stories. The trip is already emotionally significant — Dormie's job is to crystallize that significance into shareable, rememberable artifacts.

Most golf apps fail this completely. After a round, you might see a leaderboard. After a trip, you see... nothing. The most emotionally peak moment in a golfer's year (the trip) gets zero post-trip product treatment.

This is open territory. No one in golf has done what Strava did for running. Dormie can be the first.

**The strategic lens:** cinematic features compound. Year 1 user gets a decent post-trip recap. Year 5 user with multiple annual trips gets a "5 years of Myrtle Beach" highlight reel. The longer users stay, the better the cinematic experiences become — which makes leaving harder. That's defensible retention.

---

## The Five Cinematic Moments

Five moments where Dormie should produce iconic emotional payoffs. Listed in priority order based on data availability and impact.

### 1. Post-Trip Recap (the big one)

**The moment:** Trip ends. User opens Dormie. They see a beautifully designed full-screen recap.

**Content:**
- Trip name, dates, courses played (hero header)
- Final scoring leaderboard (the rivalry resolution)
- Trip MVP — most strokes-under-handicap performance, OR the moment that mattered (hole-in-one, biggest comeback)
- Best moment of the trip — pulled from Trip Moments if any logged, or auto-generated from scoring data ("Drew's hole-in-one on #16")
- Trip stats — total holes played, lowest round, biggest comeback, longest putt made
- "Trip awards" — auto-generated fun titles: "Closest to Pin Specialist," "Comeback Kid," "Sandman" (most sand saves), "Closer" (best back-9 average)
- Photo highlights if photos were captured during trip
- Share button → generates a beautiful image card optimized for group chat sharing

**Design references:** Spotify Wrapped's "Top Songs" reveal animation. Strava's annual mileage card. Letterboxd's year-in-review.

**Engineering scope:** 6-12 hours of focused work, depending on photo handling and animation depth. Requires:
- Real round/score data (gates this until users actually play scored rounds in Dormie)
- Trip Moments creation flow (currently empty state — need at least minimal capture before recap can pull moments)
- Share card generation (system share sheet + image generation)
- Animation framework decision

**Strategic value:** HIGHEST. This is the artifact that gets screenshot and shared, driving organic acquisition. One viral group chat moment converts 4-12 people to install Dormie.

### 2. Live Trip Cinematic Moments

**The moment(s):** Various points during an active trip where Dormie heightens the experience.

**Sub-moments:**
- **Welcome to the trip** — first time user opens Dormie on Day 1, full-screen animation: "Final Test starts now. 4 players. 1 course. May the best swing win." Anticipation-to-reality crystallization.
- **Daily evening recap** — at end of each day, push notification: "Day 1 wrapped. Drew shot 78. You're 2 strokes back. Tomorrow: Pebble Beach Links." In-app version expands with full day's leaderboard, biggest moment, tomorrow's preview.
- **Hole-in-one celebration** — when someone in the group scores 1 on any par-3, instant push to all members: "🎉 Drew just hit a hole-in-one on #16!" Card-style moment on Trip detail screen.
- **Comeback alerts** — mid-round push when scoring data shows someone's making a charge: "Jake is +3 through 6 holes. He's coming for you."
- **Final round drama** — last few holes of the trip, real-time leaderboard with countdown energy.

**Engineering scope:** Each sub-moment is 3-8 hours. Real-time push notifications require APNs setup (beta foundation work). The hole-in-one detection requires structured score entry (already exists in scoring engine).

**Strategic value:** HIGH. Live moments are the most-engaged usage period. Push notifications during a trip make Dormie the home base for the entire group's attention.

### 3. Year-in-Review Season Recap

**The moment:** End of calendar year (or end of golf season). User opens Dormie, sees "Your 2026 in golf."

**Content:**
- Total trips taken, courses played, holes walked
- Best round of the year (with date and course)
- Most-played course
- Trip win count
- Top opponents (head-to-head records)
- Standout moments compiled from across the year's trips
- Comparison to previous years (year-2 onward)
- Personal "title" auto-generated from data ("The Iron Striker" / "The Comeback King" / "The Sandman")

**Design references:** Spotify Wrapped's full multi-screen scroll experience. Apple's annual fitness summary.

**Engineering scope:** 8-15 hours. Requires multi-trip aggregation queries, design-heavy storytelling sequence, share-card generation.

**Strategic value:** HIGH. Annual moment that drives end-of-year traffic, retention spike, social sharing. The compound feature — gets dramatically better in years 2, 3, 5.

### 4. Trip Anniversary Memory Triggers

**The moment:** Random, surprise. Push notification or app banner: "5 years ago this week: your first Myrtle Beach trip with Drew, Jake, and Tommy. Drew shot 98. Want to plan another?"

**Content:**
- Reference to a past trip on its anniversary
- Key data point from that trip
- CTA: Plan a similar trip OR add destination to Dream Board OR view the original trip
- Photo from the original trip if available

**Engineering scope:** 4-8 hours once the foundation exists. Background job that queries trips with anniversaries (1, 2, 5, 10 years ago this week) and triggers push.

**Strategic value:** MEDIUM-HIGH for retention. Surprise nostalgia moments are sticky. Drives Dream Board adds, drives trip planning, drives re-engagement.

**Critical dependency:** Requires multi-year data, which is years away. But the architecture should be designed now so it activates naturally as data accumulates.

### 5. Achievement / Award Moments

**The moment:** Triggered by specific accomplishments — first hole-in-one ever logged in Dormie, first round under 80, 100th round, first trip win, etc.

**Content:**
- Full-screen unlock-style animation
- Achievement title + description
- Stats context ("This is your 47th sub-80 round")
- Share button

**Design references:** Apple Watch achievement animations. Pokémon Go badge unlocks (without the cheesiness).

**Engineering scope:** 6-10 hours for a system that handles multiple achievement types. Each individual achievement is small once the framework exists.

**Strategic value:** MEDIUM. Adds delight, drives some retention. Less viral than the recap moments because they're personal, not group-shareable.

---

## What Cinematic Features Aren't

Equally important to define what we're NOT building:

- **Not a feed/social network.** No public profiles, no following, no comments on other people's moments. Dormie's social layer is friend-graph only. Cinematic moments are personal or group-internal.
- **Not gamification.** No points, levels, daily streaks, "missed your goal" guilt patterns. Dormie respects the user's relationship with golf — it doesn't manipulate it.
- **Not analytics dashboards.** Cinematic ≠ data visualization. The Stats card drill-in is a useful utility. Cinematic features are emotional storytelling.
- **Not commemorative for everyone.** Not every round needs a moment. Not every trip needs an award. Scarcity matters — cinematic moments hit hardest when they're rare.

---

## Sequencing — When to Build Each

Cinematic features depend heavily on data availability. The sequence:

**Pre-beta (now):** Capture the vision. Don't build any cinematic features yet. Real beta data is required to design these well.

**Beta (months 1-2):** First post-trip recap design exploration. Build a minimum-viable recap for Kara + Drew's first real Dormie trip. Hand-design it for them as a first instance, evaluate response.

**Beta (months 2-3):** Live Trip cinematic moments — welcome animation, daily recap. These work with even one real trip.

**v1 launch (months 3-6):** Polished post-trip recap as a real product feature. Share card generation. System integration with iOS share sheet.

**Year 1 (months 6-12):** Achievement system framework. First Year-in-Review Season recap (December if launched in spring).

**Year 2+:** Trip anniversary triggers. Compounding multi-year cinematic experiences.

---

## Per-Round Share Cards (Today's Status — Verify)

Ian flagged uncertainty about whether Dormie currently produces post-round share cards. Need to verify:

1. After completing a round in Dormie, what does the user see?
2. Is there a share button or share card generated?
3. What's the visual treatment?

**If they exist:** confirm they match the visual language we'd want for trip recaps. Brand consistency matters.

**If they don't exist:** that's a smaller cinematic gap to fill before tackling trip-level recaps. Round-level recaps are the foundation pattern.

This verification should happen during the trip wizard audit session — easy to check while we're already doing screen-by-screen review.

---

## Strategic Note: The "Memory Layer" Framing

In the Trips product vision doc, Pillar 5 is "Memory" — what a trip becomes after it's over. Cinematic features ARE the Memory layer made visible.

The full Memory loop:
- Trip happens → data captured (scores, moments, photos)
- Trip ends → cinematic recap generated
- Recap shared → drives organic acquisition + group nostalgia
- Anniversary triggers → memory resurfaces → drives next year's trip planning
- Year-end → Season recap aggregates the year's memory layer
- Multi-year → compounding nostalgia, Dormie becomes the chronicle of someone's golf life

This is genuinely valuable beyond utility. People pay for things that hold memories — it's why physical photo albums still exist. Dormie can be the digital chronicle of a friend group's golf life across years.

That's the strategic prize.

---

## Compost Entries (Add These During Implementation)

Beyond the line in compost.md, the following sub-thoughts:

- The hole-in-one detection in scoring data is already there — celebration moment is mostly UI work, not data work
- Push notification infrastructure (APNs) is on the beta foundations list anyway — cinematic features benefit from that work landing
- Photo handling is the hard part — moments need photos, photos need cloud storage, cloud storage needs cost management
- Voice notes as a moment type could be brilliant — golfers narrate their own highlights
- Group chat integration is important — the share card generation needs to work as a single image or animated GIF for SMS/iMessage/group chat
- Resort partnerships could include "trip postcard" co-branding — Pinehurst-branded share card from your Pinehurst trip

---

*End of cinematic exploration. Reference when designing the post-beta roadmap. The features here are the most strategically valuable Dormie can build, and the most likely to drive viral acquisition in the post-launch phase.*
