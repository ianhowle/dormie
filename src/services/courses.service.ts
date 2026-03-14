import { supabase } from '../lib/supabase';
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
    if (!GOLF_API_KEY) return [];
    try {
      const response = await fetch(
        `https://api.golfcourseapi.com/v1/search?query=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${GOLF_API_KEY}` } }
      );
      if (!response.ok) return [];
      return response.json();
    } catch {
      return [];
    }
  },
};
