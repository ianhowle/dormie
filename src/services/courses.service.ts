import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Course, CourseInsert, CourseLeaderboardEntry } from '../lib/database.types';

const GOLF_API_KEY = process.env.EXPO_PUBLIC_GOLF_API_KEY;

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
