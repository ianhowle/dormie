import { supabase } from '../lib/supabase';

const GOLF_API_KEY = process.env.EXPO_PUBLIC_GOLF_API_KEY;

export const coursesService = {
  async searchLocal(query: string) {
    return supabase
      .from('courses')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(20);
  },

  async searchAPI(query: string) {
    // External golf course API search
    const response = await fetch(
      `https://api.golfcourseapi.com/v1/search?query=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${GOLF_API_KEY}` } }
    );
    return response.json();
  },

  async getCourse(courseId: string) {
    return supabase.from('courses').select('*').eq('id', courseId).single();
  },

  async getCourseTeeBoxes(courseId: string) {
    return supabase.from('tee_boxes').select('*').eq('course_id', courseId);
  },

  async getCourseLeaderboard(courseId: string, groupId?: string) {
    return supabase.rpc('get_course_leaderboard', {
      p_course_id: courseId,
      ...(groupId && { p_group_id: groupId }),
    });
  },
};
