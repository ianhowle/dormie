import { supabase } from '../lib/supabase';
import type { BucketListItem, BucketListItemWithCourse } from '../lib/database.types';

export const bucketListService = {
  /** Add a course to the user's bucket list. */
  async add(userId: string, courseId: string, notes?: string): Promise<BucketListItem> {
    const { data, error } = await supabase
      .from('bucket_list')
      .insert({ user_id: userId, course_id: courseId, notes: notes ?? null })
      .select()
      .single();
    if (error) throw error;
    return data as BucketListItem;
  },

  /** Remove a course from the user's bucket list. */
  async remove(userId: string, courseId: string): Promise<void> {
    const { error } = await supabase
      .from('bucket_list')
      .delete()
      .eq('user_id', userId)
      .eq('course_id', courseId);
    if (error) throw error;
  },

  /** Get all bucket list items for a user, with course details. */
  async getByUser(userId: string): Promise<BucketListItemWithCourse[]> {
    const { data, error } = await supabase
      .from('bucket_list')
      .select('*, course:courses(id, name, location)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as BucketListItemWithCourse[];
  },

  /** Check which course IDs are already in the user's bucket list. */
  async getIds(userId: string): Promise<Set<string>> {
    const { data, error } = await supabase
      .from('bucket_list')
      .select('course_id')
      .eq('user_id', userId);
    if (error) throw error;
    return new Set((data || []).map((row: any) => row.course_id));
  },
};
