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

export const coursesService = {
  /** Fuzzy search courses by name in Supabase. */
  async search(query: string, limit = 20): Promise<Course[]> {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(limit);
    if (error) throw error;
    return data as Course[];
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

  /** Search external golf course API. */
  async searchAPI(query: string) {
    if (!GOLF_API_KEY) {
      console.log('[CourseSearch] No GOLF_API_KEY configured');
      return [];
    }
    try {
      console.log(`[CourseSearch] query="${query}" key=${GOLF_API_KEY.slice(0, 4)}...`);
      const response = await fetch(
        `https://api.golfcourseapi.com/v1/search?query=${encodeURIComponent(query)}&key=${GOLF_API_KEY}`
      );
      const data = await response.json();
      console.log(`[CourseSearch] status=${response.status} results=${Array.isArray(data?.courses) ? data.courses.length : 0}`);
      if (!response.ok) return [];
      return data?.courses ?? [];
    } catch (err) {
      console.log('[CourseSearch] error:', err);
      return [];
    }
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

  /** Unified search: local + Google Places in parallel, GolfCourseAPI fallback. */
  async searchAll(query: string): Promise<SearchResult[]> {
    const [localResults, googleResults] = await Promise.all([
      this.search(query).catch(() => [] as Course[]),
      this.searchGooglePlaces(query),
    ]);

    // Map local to SearchResult
    const local: SearchResult[] = localResults.map((c) => ({
      id: c.id,
      name: c.name,
      par: (c as any).par ?? 72,
      city: (c as any).city ?? '',
      state: (c as any).state ?? '',
      location: (c as any).location ?? '',
      source: 'local' as const,
    }));

    // Dedup: local first, then google (skip if name is very similar)
    const seen = new Set(local.map((r) => r.name.toLowerCase()));
    const deduped = [...local];
    for (const g of googleResults) {
      const key = g.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
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

    // 2. Try GolfCourseAPI search
    if (GOLF_API_KEY) {
      try {
        console.log(`[Scorecard] Fetching from GolfCourseAPI: "${courseName}"`);
        const response = await fetch(
          `https://api.golfcourseapi.com/v1/search?query=${encodeURIComponent(courseName)}&key=${GOLF_API_KEY}`
        );
        if (response.ok) {
          const data = await response.json();
          const course = data?.courses?.[0];
          if (course) {
            const teeBoxes: TeeBox[] = (course.tees ?? course.tee_boxes ?? []).map((t: any) => ({
              name: t.name ?? t.tee_name ?? 'Unknown',
              color: t.color ?? '#1B2A4A',
              rating: t.course_rating ?? t.rating ?? 72.0,
              slope: t.slope_rating ?? t.slope ?? 113,
              yards: t.total_yards ?? t.yards ?? 6500,
            }));

            const holes: HoleInfo[] = (course.holes ?? []).map((h: any) => ({
              number: h.number ?? h.hole_number,
              par: h.par ?? 4,
              strokeIndex: h.stroke_index ?? h.handicap ?? h.number,
              yards: h.yards ?? h.yardage ?? 400,
            }));

            const par = course.par ?? (holes.reduce((s: number, h: HoleInfo) => s + h.par, 0) || 72);
            const defaultTee = teeBoxes.find((t) => t.name.toLowerCase().includes('white')) ?? teeBoxes[0];

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
