import { supabase } from '../lib/supabase';
import type { TripMoment, TripMomentWithUser } from '../lib/database.types';

export const momentsService = {
  /** Create a new trip moment. */
  async create(
    tripId: string,
    userId: string,
    text: string,
    photoUrl?: string
  ): Promise<TripMoment> {
    const { data, error } = await supabase
      .from('trip_moments')
      .insert({
        trip_id: tripId,
        user_id: userId,
        text,
        photo_url: photoUrl ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as TripMoment;
  },

  /** Get all moments for a trip, with user details. */
  async getByTrip(tripId: string): Promise<TripMomentWithUser[]> {
    const { data, error } = await supabase
      .from('trip_moments')
      .select('*, user:users!trip_moments_user_id_fkey(id, name, avatar_color)')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as TripMomentWithUser[];
  },

  /** Delete a moment by ID. */
  async delete(momentId: string): Promise<void> {
    const { error } = await supabase
      .from('trip_moments')
      .delete()
      .eq('id', momentId);
    if (error) throw error;
  },
};
