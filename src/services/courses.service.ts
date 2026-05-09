import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Course, CourseInsert, CourseLeaderboardEntry } from '../lib/database.types';

const GOLF_API_KEY = process.env.EXPO_PUBLIC_GOLF_API_KEY;
const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? '';

export type SearchResult = {
  id: string;
  name: string;
  par: number;
  city: string;
  state: string;
  location?: string;
  source?: 'local' | 'google' | 'golfapi';
};

export type TeeBox = {
  name: string;
  color: string;
  rating: number;
  slope: number;
  yards: number;
  par?: number;
  gender?: 'male' | 'female';
  holes?: HoleInfo[];
};

export type HoleInfo = {
  number: number;
  par: number;
  strokeIndex: number;
  yards: number;
};

export type ScorecardData = {
  par: number;
  rating: number;
  slope: number;
  teeBoxes: TeeBox[];
  holes: HoleInfo[];
  source: 'api' | 'community' | 'none';
};

/** Strip common golf prefixes/suffixes for fuzzy name comparison. */
const stripGolfWords = (name: string) =>
  name
    .toLowerCase()
    .replace(/^the\s+/i, '')
    .replace(/\s*(golf\s*(course|club)|country\s*club|links|resort|club)\s*/gi, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Strip common suffixes from tee display names (e.g. "Gold CB" → "Gold"). */
export const stripTeeSuffix = (name: string) =>
  name.replace(/\s+(CB|Combo|Course)$/i, '').trim();

export const coursesService = {
  /** Fuzzy search courses by name and location in Supabase.
   *  Strips "The " prefix and common golf suffixes so "Classic Club" matches "The Classic Club".
   */
  async search(query: string, limit = 20): Promise<Course[]> {
    // Try original query first
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .or(`name.ilike.%${query}%,location.ilike.%${query}%`)
      .limit(limit);
    if (error) throw error;

    const results = (data ?? []) as Course[];

    // If we got results, return them
    if (results.length > 0) return results;

    // Strip "The " prefix and try again
    const noThe = query.replace(/^the\s+/i, '').trim();
    if (noThe !== query) {
      const { data: d2 } = await supabase
        .from('courses')
        .select('*')
        .or(`name.ilike.%${noThe}%,location.ilike.%${noThe}%`)
        .limit(limit);
      if (d2 && d2.length > 0) return d2 as Course[];
    }

    // Strip common golf words and try again
    const stripped = query
      .replace(/^the\s+/i, '')
      .replace(/\s*(golf\s*(course|club)|country\s*club|golf\s*links|resort)\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (stripped && stripped !== query && stripped !== noThe) {
      const { data: d3 } = await supabase
        .from('courses')
        .select('*')
        .or(`name.ilike.%${stripped}%,location.ilike.%${stripped}%`)
        .limit(limit);
      if (d3 && d3.length > 0) return d3 as Course[];
    }

    return results;
  },

  /** Get a single course by ID. */
  async getById(courseId: string): Promise<Course> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();
    if (error) throw error;
    return data as Course;
  },

  /** Get course leaderboard via RPC. */
  async getLeaderboard(courseId: string): Promise<CourseLeaderboardEntry[]> {
    const { data, error } = await supabase.rpc('get_course_leaderboard', {
      p_course_id: courseId,
    });
    if (error) throw error;
    return data as CourseLeaderboardEntry[];
  },

  /** Insert a course if it doesn't already exist (by name+location). Returns the course. */
  async ensureCourse(course: CourseInsert): Promise<Course> {
    const { data: existing } = await supabase
      .from('courses')
      .select('*')
      .eq('name', course.name)
      .eq('location', course.location)
      .maybeSingle();

    if (existing) return existing as Course;

    const { data, error } = await supabase
      .from('courses')
      .insert(course)
      .select()
      .single();
    if (error) throw error;
    return data as Course;
  },

  /** Search external golf course API using club_name parameter. */
  async searchAPI(query: string) {
    if (!GOLF_API_KEY) {
      console.log('[CourseSearch] No GOLF_API_KEY configured');
      return [];
    }
    try {
      console.log(`[CourseSearch] query="${query}" key=${GOLF_API_KEY.slice(0, 4)}...`);
      const response = await fetch(
        `https://api.golfcourseapi.com/v1/courses?club_name=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Key ${GOLF_API_KEY}` } }
      );
      const data = await response.json();
      const courses = data?.courses ?? [];
      console.log(`[CourseSearch] status=${response.status} results=${Array.isArray(courses) ? courses.length : 0}`);
      if (!response.ok) return [];
      return courses;
    } catch (err) {
      console.log('[CourseSearch] error:', err);
      return [];
    }
  },

  /** Parse tee boxes from GolfCourseAPI response (male and female arrays). */
  parseTeeBoxes(course: any): TeeBox[] {
    const tees: TeeBox[] = [];
    const teeData = course.tees ?? {};

    for (const gender of ['male', 'female'] as const) {
      const genderTees = teeData[gender] ?? [];
      for (const t of genderTees) {
        // GolfCourseAPI returns holes position-indexed without a `number` field;
        // fall back to i + 1 so downstream side-game logic that keys by
        // hole.number (greenies, skins, nassau) gets correct hole identifiers.
        const holes: HoleInfo[] = (t.holes ?? []).map((h: any, i: number) => ({
          number: h.number ?? h.hole_number ?? i + 1,
          par: h.par ?? 4,
          strokeIndex: h.handicap ?? h.stroke_index ?? 0,
          yards: h.yardage ?? h.yards ?? 0,
        }));

        const rawName = t.tee_name ?? t.name ?? 'Unknown';
        tees.push({
          name: stripTeeSuffix(rawName),
          color: this.teeNameToColor(rawName),
          rating: t.course_rating ?? t.rating ?? 72.0,
          slope: t.slope_rating ?? t.slope ?? 113,
          yards: t.total_yards ?? t.yards ?? 0,
          par: t.par_total ?? t.par ?? (holes.reduce((s, h) => s + h.par, 0) || 72),
          gender,
          holes,
        });
      }
    }

    return tees;
  },

  /** Map tee name to a display color. */
  teeNameToColor(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('black')) return '#1A1A1A';
    if (n.includes('blue') || n.includes('championship')) return '#1B2A4A';
    if (n.includes('white') || n.includes('middle')) return '#CCCCCC';
    if (n.includes('gold') || n.includes('senior')) return '#C9A227';
    if (n.includes('red') || n.includes('forward')) return '#C41E3A';
    if (n.includes('green')) return '#006747';
    return '#1B2A4A';
  },

  /** Search Google Places for golf courses. */
  async searchGooglePlaces(query: string): Promise<SearchResult[]> {
    if (!GOOGLE_PLACES_KEY) {
      console.log('[CourseSearch] No GOOGLE_PLACES_KEY configured');
      return [];
    }
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' golf course')}&type=establishment&key=${GOOGLE_PLACES_KEY}`;
      console.log(`[CourseSearch:Google] query="${query}" key=${GOOGLE_PLACES_KEY.slice(0, 4)}...`);
      const response = await fetch(url);
      const data = await response.json();
      console.log(`[CourseSearch:Google] status=${data.status} results=${data.results?.length ?? 0}`);
      if (data.status !== 'OK' || !data.results) return [];

      return data.results.slice(0, 8).map((place: any) => {
        const addr = place.formatted_address ?? '';
        const parts = addr.split(',').map((s: string) => s.trim());
        // Typical: "123 Main St, City, ST 12345, USA" or "City, ST 12345"
        let city = '';
        let state = '';
        if (parts.length >= 3) {
          city = parts[parts.length - 3] ?? '';
          const stateZip = parts[parts.length - 2] ?? '';
          state = stateZip.replace(/\d{5}(-\d{4})?/, '').trim();
        } else if (parts.length === 2) {
          city = parts[0];
          state = parts[1].replace(/\d{5}(-\d{4})?/, '').trim();
        }
        return {
          id: `gp_${place.place_id}`,
          name: place.name,
          par: 72,
          city,
          state,
          location: addr,
          source: 'google' as const,
        };
      });
    } catch (err) {
      console.log('[CourseSearch:Google] error:', err);
      return [];
    }
  },

  /** Unified search: Supabase first, then GolfCourseAPI for golf-specific data, Google Places for location/photos only. */
  async searchAll(query: string): Promise<SearchResult[]> {
    // 1. Check Supabase verified/seeded courses first (instant)
    const localResults = await this.search(query).catch(() => [] as Course[]);

    const local: SearchResult[] = localResults.map((c) => ({
      id: c.id,
      name: c.name,
      par: (c as any).par ?? 72,
      city: (c as any).city ?? '',
      state: (c as any).state ?? '',
      location: (c as any).location ?? '',
      source: 'local' as const,
    }));

    // Track both full-normalized and stripped (no golf words) forms for dedup
    const seenFull = new Set<string>();
    const seenStripped = new Set<string>();
    const deduped = [...local];

    const addToSeen = (name: string) => {
      seenFull.add(name.toLowerCase().replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim());
      seenStripped.add(stripGolfWords(name));
    };
    const isDuplicate = (name: string) => {
      const full = name.toLowerCase().replace(/[-–—]/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      const stripped = stripGolfWords(name);
      for (const existing of seenFull) {
        if (existing.includes(full) || full.includes(existing)) return true;
      }
      for (const existing of seenStripped) {
        if (existing.includes(stripped) || stripped.includes(existing)) return true;
      }
      return false;
    };

    for (const r of local) addToSeen(r.name);

    // 2. Hit GolfCourseAPI for courses not in the seed list (has golf-specific data)
    const apiResults = await this.searchAPI(query);
    for (const course of apiResults) {
      const name = course.club_name ?? course.name ?? '';
      if (!name) continue;

      const city = course.city ?? course.location?.city ?? '';
      const state = course.state ?? course.location?.state ?? '';

      // Multi-course resort check: if the API returns a generic club name
      // (e.g. "Indian Wells Golf Resort") but Supabase has individual courses
      // (e.g. "Indian Wells Golf Resort - Celebrity Course"), show those instead.
      const strippedApiName = stripGolfWords(name);
      const seededIndividual = localResults.filter((lr) => {
        const strippedLocal = stripGolfWords(lr.name);
        return strippedLocal !== strippedApiName &&
               (lr.name.toLowerCase().includes(name.toLowerCase()) ||
                strippedLocal.includes(strippedApiName));
      });
      if (seededIndividual.length > 1) {
        // We found multiple seeded sub-courses for this resort — add them instead.
        // Also: if this specific API entry's course_name matches one of the
        // seeded sub-courses (e.g. API returns "President'S Reserve" while the
        // seeded row is "Hermitage Golf Course - Presidents Reserve"), refresh
        // that seeded row with the API's per-hole data. Previously this branch
        // skipped caching entirely.
        //
        // Gate: only proceed when course_name names a SPECIFIC sub-course —
        // i.e. it's distinct from the umbrella club_name. Skips API entries
        // where course_name === club_name (umbrella records like "Hermitage /
        // Hermitage") which would otherwise false-match shared parent fragments.
        const apiCourseName = (course.course_name ?? '').trim();
        const apiCourseStripped = stripGolfWords(apiCourseName);
        const apiClubStripped = stripGolfWords(course.club_name ?? '');
        const isSpecificSubCourse = apiCourseStripped &&
          apiCourseStripped !== apiClubStripped &&
          !apiClubStripped.includes(apiCourseStripped) &&
          !apiCourseStripped.includes(apiClubStripped);
        if (isSpecificSubCourse) {
          const matchingSub = seededIndividual.find((sub) => {
            const subStripped = stripGolfWords(sub.name);
            return subStripped.includes(apiCourseStripped) ||
                   apiCourseStripped.includes(subStripped);
          });
          if (matchingSub) {
            const subTeeBoxes = this.parseTeeBoxes(course);
            const subMaleTees = subTeeBoxes.filter((t) => t.gender === 'male');
            const subDefaultTee = subMaleTees[0] ?? subTeeBoxes[0];
            const subPar = subDefaultTee?.par ?? (matchingSub as any).par ?? 72;
            const subLoc = (matchingSub as any).location ??
              ([(matchingSub as any).city, (matchingSub as any).state].filter(Boolean).join(', '));
            this.cacheAPICoursToSupabase(course, subTeeBoxes, subPar, subDefaultTee, {
              name: matchingSub.name,
              location: subLoc,
            }).catch(() => {});
          }
        }
        for (const sub of seededIndividual) {
          if (!isDuplicate(sub.name)) {
            addToSeen(sub.name);
            deduped.push({
              id: sub.id,
              name: sub.name,
              par: (sub as any).par ?? 72,
              city: (sub as any).city ?? city,
              state: (sub as any).state ?? state,
              location: (sub as any).location ?? '',
              source: 'local' as const,
            });
          }
        }
        continue;
      }

      if (isDuplicate(name)) continue;
      addToSeen(name);

      const teeBoxes = this.parseTeeBoxes(course);
      const maleTees = teeBoxes.filter((t) => t.gender === 'male');
      const defaultTee = maleTees[0] ?? teeBoxes[0];
      const par = defaultTee?.par ?? 72;

      deduped.push({
        id: `gca_${course.id ?? stripGolfWords(name)}`,
        name,
        par,
        city,
        state,
        location: course.location_string ?? (city && state ? `${city}, ${state}` : ''),
        source: 'golfapi' as const,
      });

      // Cache to Supabase in background so future searches are instant
      this.cacheAPICoursToSupabase(course, teeBoxes, par, defaultTee).catch(() => {});
    }

    // 3. Fall back to Google Places for location/photos only (no golf-specific data)
    if (deduped.length < 5) {
      const googleResults = await this.searchGooglePlaces(query);
      for (const g of googleResults) {
        if (isDuplicate(g.name)) continue;
        addToSeen(g.name);
        deduped.push(g);
      }
    }

    return deduped.slice(0, 10);
  },

  /** Save a Google Places result to Supabase for future local searches. */
  async saveGooglePlacesCourse(result: SearchResult): Promise<void> {
    if (!result.id.startsWith('gp_')) return;
    try {
      await this.ensureCourse({
        name: result.name,
        location: result.location ?? `${result.city}, ${result.state}`,
      } as CourseInsert);
    } catch (err) {
      console.log('[CourseSearch] Failed to save course:', err);
    }
  },

  /** Fetch scorecard data from GolfCourseAPI, then check Supabase community data. */
  async fetchScorecard(courseName: string, location?: string): Promise<ScorecardData> {
    const none: ScorecardData = { par: 72, rating: 72.0, slope: 113, teeBoxes: [], holes: [], source: 'none' };

    // 1. Check AsyncStorage cache first
    const cacheKey = `scorecard_${courseName.toLowerCase().replace(/\s+/g, '_')}`;
    const cached = await this.getCachedCourse(cacheKey);
    if (cached) {
      console.log(`[Scorecard] Cache hit for "${courseName}"`);
      return cached as ScorecardData;
    }

    // 2. Try GolfCourseAPI search using club_name parameter
    if (GOLF_API_KEY) {
      try {
        console.log(`[Scorecard] Fetching from GolfCourseAPI: "${courseName}"`);
        const response = await fetch(
          `https://api.golfcourseapi.com/v1/courses?club_name=${encodeURIComponent(courseName)}`,
          { headers: { Authorization: `Key ${GOLF_API_KEY}` } }
        );
        if (response.ok) {
          const data = await response.json();
          const course = data?.courses?.[0];
          if (course) {
            const teeBoxes = this.parseTeeBoxes(course);

            // Use male tees for default scorecard display
            const maleTees = teeBoxes.filter((t) => t.gender === 'male');
            const defaultTee =
              maleTees.find((t) => t.name.toLowerCase().includes('white')) ??
              maleTees.find((t) => t.name.toLowerCase().includes('middle')) ??
              maleTees[0] ??
              teeBoxes[0];

            // Get holes from the default tee (each tee has per-hole data)
            const holes = defaultTee?.holes ?? [];
            const par = defaultTee?.par ?? (holes.reduce((s, h) => s + h.par, 0) || 72);

            const result: ScorecardData = {
              par,
              rating: defaultTee?.rating ?? 72.0,
              slope: defaultTee?.slope ?? 113,
              teeBoxes,
              holes,
              source: 'api',
            };
            console.log(`[Scorecard] API hit: par=${par} tees=${teeBoxes.length} holes=${holes.length}`);
            await this.cacheCourse(cacheKey, result);

            // Cache to Supabase for future searches
            await this.cacheAPICoursToSupabase(course, teeBoxes, par, defaultTee);

            return result;
          }
        }
      } catch (err) {
        console.log('[Scorecard] GolfCourseAPI error:', err);
      }
    }

    // 3. Check Supabase community data
    try {
      const { data: community } = await supabase
        .from('courses')
        .select('*')
        .ilike('name', `%${courseName}%`)
        .maybeSingle();

      if (community && (community as any).par) {
        const c = community as any;
        const hd = c.hole_data ?? {};
        const result: ScorecardData = {
          par: c.par ?? 72,
          rating: c.rating ?? 72.0,
          slope: c.slope ?? 113,
          teeBoxes: hd.tee_boxes ?? [],
          holes: hd.holes ?? [],
          source: 'community',
        };
        console.log(`[Scorecard] Community data: par=${result.par}`);
        await this.cacheCourse(cacheKey, result);
        return result;
      }
    } catch {}

    return none;
  },

  /** Save course with scorecard data and source tag to Supabase. */
  async saveCourseWithData(
    searchResult: SearchResult,
    scorecard: { par: number; rating: number; slope: number; tee?: string },
    dataSource: 'api' | 'user_entered',
  ): Promise<void> {
    try {
      const loc = searchResult.location ?? `${searchResult.city}, ${searchResult.state}`;
      const insert: any = {
        name: searchResult.name,
        location: loc,
        par: scorecard.par,
        rating: scorecard.rating,
        slope: scorecard.slope,
        hole_data: { data_source: dataSource },
      };

      const { data: existing } = await supabase
        .from('courses')
        .select('*')
        .eq('name', searchResult.name)
        .ilike('location', `%${searchResult.city || loc}%`)
        .maybeSingle();

      if (existing) {
        if (!(existing as any).par || dataSource === 'api') {
          const existingHoleData = (existing as any).hole_data ?? {};
          await supabase
            .from('courses')
            .update({
              par: scorecard.par,
              rating: scorecard.rating,
              slope: scorecard.slope,
              hole_data: { ...existingHoleData, data_source: dataSource },
            })
            .eq('id', existing.id);
        }
      } else {
        await supabase.from('courses').insert(insert);
      }
      console.log(`[CourseSearch] Saved ${searchResult.name} (source: ${dataSource})`);
    } catch (err) {
      console.log('[CourseSearch] Failed to save course:', err);
    }
  },

  /** Cache an API-found course to Supabase with data_source: 'api' for future searches.
   *  When `override` is provided, the row is identified by the override name/location
   *  instead of the API-derived ones — used to refresh seeded sub-course rows
   *  (e.g. "Hermitage Golf Course - Presidents Reserve") with API per-hole data
   *  even when the API entry's club_name is the parent club. */
  async cacheAPICoursToSupabase(
    course: any,
    teeBoxes: TeeBox[],
    par: number,
    defaultTee?: TeeBox,
    override?: { name: string; location: string },
  ): Promise<void> {
    try {
      const apiName = course.club_name ?? course.name ?? '';
      const city = course.city ?? course.location?.city ?? '';
      const state = course.state ?? course.location?.state ?? '';
      const apiLoc = city && state ? `${city}, ${state}` : city || state || '';
      const name = override?.name ?? apiName;
      const loc = override?.location ?? apiLoc;

      if (!name) return;

      // Serialize tee boxes for storage (strip holes to keep hole_data manageable)
      const storedTees = teeBoxes.map((t) => ({
        name: t.name,
        color: t.color,
        rating: t.rating,
        slope: t.slope,
        yards: t.yards,
        par: t.par,
        gender: t.gender,
        holes: t.holes,
      }));

      const insert: CourseInsert = {
        name,
        location: loc,
        par,
        slope: defaultTee?.slope ?? null,
        rating: defaultTee?.rating ?? null,
        yards: defaultTee?.yards ?? null,
        hole_data: {
          data_source: 'api',
          tee_boxes: storedTees,
          holes: defaultTee?.holes ?? [],
        },
      };

      const { data: existing } = await supabase
        .from('courses')
        .select('id, hole_data')
        .eq('name', name)
        .ilike('location', `%${city || loc || ''}%`)
        .maybeSingle();

      if (existing) {
        const existingSource = (existing.hole_data as any)?.data_source;
        // Only overwrite if existing data is not already from API or is stale
        if (existingSource !== 'api') {
          await supabase
            .from('courses')
            .update({
              par,
              slope: defaultTee?.slope ?? null,
              rating: defaultTee?.rating ?? null,
              yards: defaultTee?.yards ?? null,
              hole_data: insert.hole_data,
            })
            .eq('id', existing.id);
          console.log(`[CourseSearch] Updated ${name} in Supabase (data_source: api)`);
        }
      } else {
        await supabase.from('courses').insert(insert);
        console.log(`[CourseSearch] Saved ${name} to Supabase (data_source: api)`);
      }
    } catch (err) {
      console.log('[CourseSearch] Failed to cache API course to Supabase:', err);
    }
  },

  // ─── Feature 18: Course Data Caching ──────────────────────────────

  /** Cache course data with 30-day expiry */
  async cacheCourse(courseId: string, data: any): Promise<void> {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };
    await AsyncStorage.setItem(`course_${courseId}`, JSON.stringify(cacheEntry));
  },

  /** Get cached course data, returns null if expired or missing */
  async getCachedCourse(courseId: string): Promise<any | null> {
    try {
      const cached = await AsyncStorage.getItem(`course_${courseId}`);
      if (!cached) return null;
      const entry = JSON.parse(cached);
      if (Date.now() > entry.expiresAt) {
        await AsyncStorage.removeItem(`course_${courseId}`);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },

  /** Search with cache-first approach */
  async searchWithCache(query: string): Promise<any[]> {
    // Try Supabase first
    const results = await this.search(query);
    // Cache each result
    for (const course of results) {
      await this.cacheCourse(course.id, course);
    }
    return results;
  },

  // ─── Feature 19: AI Course Search Fallback ────────────────────────

  /** AI-powered course search fallback using Claude API */
  async searchWithAIFallback(query: string): Promise<any[]> {
    // Try normal API first
    const apiResults = await this.searchAPI(query);
    if (apiResults && apiResults.length > 0) return apiResults;

    // Fallback to Claude API if key exists
    const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) return [];

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `I'm looking for a golf course matching "${query}". Return JSON array with objects containing: name, city, state, par (number), slope (number), rating (number), yards (number). Return up to 3 matches. Only return the JSON array, no other text.`,
          }],
        }),
      });
      if (!response.ok) return [];
      const data = await response.json();
      const text = data.content?.[0]?.text ?? '';
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  // ─── Feature 20: AI Hole Data Generation ──────────────────────────

  /** Generate realistic hole data using AI when not available from API */
  async generateHoleData(courseName: string, coursePar: number): Promise<any[] | null> {
    const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: `Generate realistic hole data for the golf course "${courseName}" with par ${coursePar}. Return a JSON array of 18 objects, each with: number (1-18), par (3/4/5), strokeIndex (1-18, each unique), yards (realistic for the par). The pars must sum to ${coursePar}. Standard distribution: four par 3s, ten par 4s, four par 5s for par 72. Adjust proportionally for other pars. Only return the JSON array.`,
          }],
        }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      const text = data.content?.[0]?.text ?? '';
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length === 18) {
        // Cache the generated data
        await this.cacheCourse(`holes_${courseName}`, parsed);
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  },
};
