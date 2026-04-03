# Course Data Strategy — API Research & Recommendations

**Date:** 2026-04-03
**Context:** GolfCourseAPI.com key (`2YEJEWRI4KQD57RRNDERURHZJA`) is dead; USGA scraper is blocked. Need reliable source for course rating, slope, par, tee boxes, and hole-by-hole data.

---

## Current State

Our `courses.service.ts` currently uses:
1. **GolfCourseAPI.com** (`api.golfcourseapi.com/v1/search`) — primary scorecard source (dead key)
2. **Google Places** — course search/discovery only (no golf-specific data)
3. **Supabase community data** — fallback for courses users have entered
4. **Claude AI fallback** — generates plausible but unverified course data

The AI fallback is a creative stopgap but produces **hallucinated data** — it cannot be trusted for official course ratings and slopes needed for handicap calculations.

---

## Option 1: GolfAPI.io

**Website:** https://www.golfapi.io | **Docs:** https://golfapi.io/docs/

### Data Coverage
- 42,000+ courses in 100+ countries
- Complete scorecard data (pars, stroke indexes)
- Tee boxes with distances to green
- Slope and course ratings per tee
- Green/POI coordinates

### Endpoints
| Endpoint | Description | Cost |
|----------|-------------|------|
| `GET /clubs?name=&country=&state=&city=` | Search clubs | 0.1 API call |
| `GET /clubs/{id}` | Club detail + courses | 1 API call |
| `GET /courses/{id}` | Full course data (tees, holes, ratings) | 1 API call |
| `GET /coordinates/{id}` | GPS coordinates | 1 API call |

### Authentication
Bearer token in Authorization header. Key obtained by contacting `contact@golfapi.io`.

### Pricing
**Not publicly listed.** Must contact sales. Call-based system — each response includes `apiRequestsLeft` field. Search calls cost 0.1; detail calls cost 1.0.

### Assessment

| Criteria | Rating |
|----------|--------|
| Course rating & slope | Yes — per tee box |
| Multiple tee boxes | Yes |
| Hole-by-hole par & yardage | Yes |
| Free tier | Unknown — must contact |
| REST + JSON | Yes |
| US coverage | Good (42k+ global) |

**Pros:** Most comprehensive dataset. Includes coordinates, stroke indexes, all tee data.
**Cons:** No public pricing. Must email for access. Unknown cost. No self-serve signup.

---

## Option 2: RapidAPI "Golf Course API" by foshesco

**URL:** https://rapidapi.com/foshesco-65zCww9c1y0/api/golf-course-api

### Data Coverage
- Scorecards, tee boxes, coordinates, address, phone
- US-focused coverage

### Endpoints
Available via RapidAPI marketplace with standard `X-RapidAPI-Key` auth.

### Pricing (RapidAPI tiers)
Typical RapidAPI structure (exact numbers need verification on their pricing page):
- **Free:** Limited requests/month (likely 100-500)
- **Basic:** ~$10-30/month
- **Pro:** ~$50-100/month
- **Ultra/Enterprise:** Custom

### Assessment

| Criteria | Rating |
|----------|--------|
| Course rating & slope | Likely yes (advertised tee boxes) |
| Multiple tee boxes | Yes (advertised) |
| Hole-by-hole par & yardage | Scorecards included |
| Free tier | Yes (limited) |
| REST + JSON | Yes (RapidAPI standard) |
| US coverage | Focused on US |

**Pros:** Easy integration via RapidAPI. Self-serve signup. Standard REST/JSON.
**Cons:** Coverage depth unverified. Free tier likely very limited. Developer (foshesco) is a single contributor — reliability risk. No guarantees on data accuracy or uptime.

---

## Option 3: GolfCourseAPI.com (Our Current Provider)

**URL:** https://golfcourseapi.com

### Status
- Claims to be "the completely free golf course API"
- ~30,000 courses worldwide
- Sign up with email only (magic link auth)
- **Our old key (`2YEJEWRI4KQD57RRNDERURHZJA`) returns 403**

### Action Needed
1. Go to https://golfcourseapi.com/sign-in/
2. Enter the email associated with the old account
3. If account exists, get magic link and retrieve/regenerate key
4. If account is gone, create new account with project email

### Data Fields (from our existing integration)
Based on our `courses.service.ts` parsing (lines 240-265):
```json
{
  "courses": [{
    "name": "...",
    "par": 72,
    "tees": [
      {
        "name": "White",
        "color": "#FFFFFF",
        "course_rating": 72.1,
        "slope_rating": 131,
        "total_yards": 6400
      }
    ],
    "holes": [
      {
        "number": 1,
        "par": 4,
        "stroke_index": 7,
        "yards": 415
      }
    ]
  }]
}
```

### Assessment

| Criteria | Rating |
|----------|--------|
| Course rating & slope | Yes — per tee |
| Multiple tee boxes | Yes |
| Hole-by-hole par & yardage | Yes |
| Free tier | Entire API is free (was) |
| REST + JSON | Yes |
| US coverage | ~30k courses globally |

**Pros:** Free. Already integrated. Our code parses their response format. 30k courses.
**Cons:** Key is dead — may indicate service instability. Single-dev project risk. No SLA. "Free" may not last. Unknown if still operational.

---

## Option 4: USGA NCRDB (National Course Rating Database)

**URL:** https://ncrdb.usga.org

### What It Is
The official USGA database of course ratings and slopes for every rated course in the US. This is the **authoritative source** for handicap calculations.

### Programmatic Access
- **No public API.** Web-only search interface.
- Individual course pages at `ncrdb.usga.org/courseTeeInfo?CourseID={id}`
- Returns: course name, tee names, gender, course rating, slope rating, bogey rating, front/back/total yardage

### GHIN API (GPA Program)
- The USGA offers a **Golfer Product Access (GPA)** program for approved vendors
- Provides API access to handicap data, score posting, and course ratings
- **Requires formal application** to USGA
- Designed for established golf technology companies
- Not self-serve; approval process can take weeks/months
- More info: https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system/GPA-Program-Overview.html

### Assessment

| Criteria | Rating |
|----------|--------|
| Course rating & slope | Yes — THE authoritative source |
| Multiple tee boxes | Yes (men's/women's per tee) |
| Hole-by-hole par & yardage | Yardage yes, hole-by-hole par limited |
| Free tier | N/A — no public API |
| REST + JSON | No — web scraping only (or GPA approval) |
| US coverage | Complete US coverage |

**Pros:** Authoritative data. Complete US coverage. Includes bogey rating.
**Cons:** No API. Scraping is blocked/fragile. GPA program requires formal application and is not guaranteed. Not viable as primary data source short-term.

---

## Option 5: Other APIs Discovered

### Golf Course Database (golf-course-database.com)
- Subscription-based database + API
- Must purchase database, then subscribe for automatic updates
- Contact: `support@golf-course-database.com`
- Likely expensive (enterprise-oriented)

### Zyla Labs Golf Courses Data API
- Available at https://zylalabs.com/api-marketplace/sports+&+gaming/golf+courses+data+api/2029
- Another marketplace API, unverified data quality

### TeeRadar (teeradar.online)
- Golf course data & database services
- Details unclear; website was unreachable during research

### Slash Golf (slashgolf.dev)
- Focused on **PGA Tour/LIV live scoring data**, NOT course databases
- Not relevant for our use case

### iGolf Solutions (igolf.com)
- Enterprise-grade course data including tee box names, colors, hole yardages, slope, rating for men's and women's tees
- Likely expensive enterprise pricing
- Contact-based sales

---

## Comparison Matrix

| Feature | GolfAPI.io | RapidAPI foshesco | GolfCourseAPI.com | USGA NCRDB | iGolf |
|---------|-----------|-------------------|-------------------|------------|-------|
| Rating & Slope | Yes | Likely | Yes | Yes (authoritative) | Yes |
| Tee Boxes | Yes | Yes | Yes | Yes | Yes |
| Hole-by-hole | Yes | Yes | Yes | Partial | Yes |
| Coverage | 42k+ global | US focused | 30k global | All US | Unknown |
| Free tier | Unknown | Yes (limited) | Free (was) | No API | No |
| Self-serve | No (email) | Yes | Yes | No | No |
| Already integrated | No | No | YES | No | No |
| Reliability | Unknown | Low (solo dev) | Uncertain | High (USGA) | High |
| Cost at scale | Unknown | ~$50-100/mo | Free? | N/A | Enterprise |

---

## Recommendation

### Immediate Action (This Week)

1. **Revive GolfCourseAPI.com** — Go to https://golfcourseapi.com/sign-in/, sign in with the account email, and get a new key. This is the fastest path since our integration already exists. If the account is gone, create a new one.

2. **Test the key** — Hit `https://api.golfcourseapi.com/v1/search?query=Pebble+Beach&key=NEW_KEY` and verify the response matches our expected format.

### Short-Term Backup (This Month)

3. **Sign up for GolfAPI.io** — Email `contact@golfapi.io` requesting API access and pricing. This is the most comprehensive dataset and would be the best upgrade if affordable.

4. **Test RapidAPI foshesco** — Sign up for free tier, test a few courses, evaluate data quality. Low effort, worth checking.

### Medium-Term Strategy (If All APIs Fail)

5. **Hybrid crowd-sourced + NCRDB approach:**

```
┌─────────────────────────────────────────────────┐
│              Course Data Pipeline                │
│                                                  │
│  User searches for course                        │
│       │                                          │
│       ▼                                          │
│  [Supabase local DB] ──hit──▶ Return data        │
│       │ miss                                     │
│       ▼                                          │
│  [External API] ──hit──▶ Cache to Supabase       │
│       │ miss                                     │
│       ▼                                          │
│  [Google Places] ──▶ Basic info (name, location) │
│       │                                          │
│       ▼                                          │
│  [User Entry Modal]                              │
│  "Add scorecard data for this course"            │
│  - Par, Rating, Slope from scorecard             │
│  - Tee box selection                             │
│  - Hole-by-hole optional                         │
│       │                                          │
│       ▼                                          │
│  [Save to Supabase] ──▶ Community database       │
│  (verified by 2+ users = "confirmed")            │
└─────────────────────────────────────────────────┘
```

This approach builds our own database over time:
- Users photograph their scorecard → OCR extracts rating/slope
- Manual entry for rating/slope/par (takes 30 seconds)
- Community verification: if 2+ users enter the same data, mark as "confirmed"
- Gradually reduces API dependency

### Long-Term (If We Scale)

6. **Apply for USGA GPA Program** — Once we have meaningful user numbers, apply for official GHIN API access. This gives us authoritative data and the ability to post scores directly to GHIN.

---

## Integration Code (Ready to Swap)

The current `courses.service.ts` already has a clean abstraction. When we get a new API key or switch providers, the changes are minimal:

### For GolfCourseAPI.com (just update the key):
```typescript
// .env
EXPO_PUBLIC_GOLF_API_KEY=NEW_KEY_HERE
```

### For GolfAPI.io (if we switch):
```typescript
// In courses.service.ts, replace searchAPI():
async searchAPI(query: string) {
  const GOLFAPI_IO_KEY = process.env.EXPO_PUBLIC_GOLFAPI_IO_KEY;
  if (!GOLFAPI_IO_KEY) return [];
  try {
    const response = await fetch(
      `https://api.golfapi.io/clubs?name=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${GOLFAPI_IO_KEY}` } }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data?.clubs ?? [];
  } catch { return []; }
}

// Replace fetchScorecard() API section:
async fetchScorecardFromGolfApiIo(courseId: string): Promise<ScorecardData | null> {
  const GOLFAPI_IO_KEY = process.env.EXPO_PUBLIC_GOLFAPI_IO_KEY;
  if (!GOLFAPI_IO_KEY) return null;
  try {
    const response = await fetch(
      `https://api.golfapi.io/courses/${courseId}`,
      { headers: { Authorization: `Bearer ${GOLFAPI_IO_KEY}` } }
    );
    if (!response.ok) return null;
    const course = await response.json();
    const teeBoxes: TeeBox[] = (course.tees ?? []).map((t: any) => ({
      name: t.name,
      color: t.color ?? '#1B2A4A',
      rating: t.courseRating ?? t.rating,
      slope: t.slopeRating ?? t.slope,
      yards: t.totalLength ?? t.yards,
    }));
    const holes: HoleInfo[] = (course.holes ?? []).map((h: any) => ({
      number: h.number,
      par: h.par,
      strokeIndex: h.strokeIndex ?? h.handicap,
      yards: h.length ?? h.yards,
    }));
    return {
      par: course.par ?? holes.reduce((s, h) => s + h.par, 0),
      rating: teeBoxes[0]?.rating ?? 72.0,
      slope: teeBoxes[0]?.slope ?? 113,
      teeBoxes,
      holes,
      source: 'api',
    };
  } catch { return null; }
}
```

### For RapidAPI foshesco:
```typescript
async searchRapidAPI(query: string) {
  const RAPID_KEY = process.env.EXPO_PUBLIC_RAPIDAPI_KEY;
  if (!RAPID_KEY) return [];
  try {
    const response = await fetch(
      `https://golf-course-api.p.rapidapi.com/search?name=${encodeURIComponent(query)}`,
      {
        headers: {
          'X-RapidAPI-Key': RAPID_KEY,
          'X-RapidAPI-Host': 'golf-course-api.p.rapidapi.com',
        },
      }
    );
    if (!response.ok) return [];
    return await response.json();
  } catch { return []; }
}
```

---

## GolfCourseAPI.com Account Status

**Old key:** `2YEJEWRI4KQD57RRNDERURHZJA`
**Status:** Returns 403 (forbidden). Key is either expired, revoked, or the service changed auth.

### To recover/recreate:
1. Visit https://golfcourseapi.com/sign-in/
2. Enter the email used to create the original account
3. Check email for magic link
4. Navigate to dashboard/settings to find or regenerate the API key
5. If no account exists, sign up creates one automatically
6. Update `EXPO_PUBLIC_GOLF_API_KEY` in `.env`

**Note:** I cannot create accounts or authenticate on your behalf. This requires manual action.

---

## Summary

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| 1 | Get new GolfCourseAPI.com key | 5 min | Restores existing integration |
| 2 | Email GolfAPI.io for access/pricing | 5 min | Best long-term data source |
| 3 | Test RapidAPI foshesco free tier | 30 min | Backup option evaluation |
| 4 | Build user entry modal for crowd-sourced data | 2-3 days | Eliminates API dependency |
| 5 | Apply for USGA GPA program | 1 hour + wait | Authoritative data source |

**Bottom line:** Get a new GolfCourseAPI.com key today. Email GolfAPI.io for pricing. Build the crowd-sourced entry modal as insurance. The user entry approach is the only thing fully in our control and will build a valuable dataset regardless of which API we use.
