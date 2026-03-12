import { supabase } from '../lib/supabase';

export const tripsService = {
  async createTrip(tripData: Record<string, unknown>) {
    return supabase.from('trips').insert(tripData).select().single();
  },

  async getTrip(tripId: string) {
    return supabase
      .from('trips')
      .select('*, trip_members(*, profile:profiles(*))')
      .eq('id', tripId)
      .single();
  },

  async getUserTrips(userId: string) {
    return supabase
      .from('trip_members')
      .select('*, trip:trips(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
  },

  async joinTrip(inviteCode: string, userId: string) {
    return supabase.rpc('join_trip_by_code', {
      p_invite_code: inviteCode,
      p_user_id: userId,
    });
  },

  async updateTrip(tripId: string, updates: Record<string, unknown>) {
    return supabase.from('trips').update(updates).eq('id', tripId);
  },

  async getTripRounds(tripId: string) {
    return supabase
      .from('rounds')
      .select('*, course:courses(name), scores(*)')
      .eq('trip_id', tripId)
      .order('played_at', { ascending: true });
  },
};
