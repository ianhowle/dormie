import { supabase } from '../lib/supabase';
import type {
  Trip,
  TripInsert,
  TripUpdate,
  TripWithMembers,
  TripMember,
  TripCourse,
  TripCourseInsert,
  TripLeaderboardEntry,
} from '../lib/database.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const tripsService = {
  /** Create a trip and add the organizer as a confirmed member. */
  async create(trip: TripInsert): Promise<Trip> {
    const { data, error } = await supabase
      .from('trips')
      .insert(trip)
      .select()
      .single();
    if (error) throw error;

    const created = data as Trip;

    // Auto-add organizer as confirmed member
    await supabase.from('trip_members').insert({
      trip_id: created.id,
      user_id: trip.organizer_id,
      rsvp_status: 'confirmed',
      role: 'organizer',
    });

    return created;
  },

  /** Get a trip with all members and their user profiles. */
  async getById(tripId: string): Promise<TripWithMembers> {
    const { data, error } = await supabase
      .from('trips')
      .select('*, trip_members(*, user:users(id, name, handicap_index, avatar_color))')
      .eq('id', tripId)
      .single();
    if (error) throw error;
    return data as TripWithMembers;
  },

  /** Get all trips the user is a member of. */
  async getByUser(userId: string): Promise<Trip[]> {
    const { data, error } = await supabase
      .from('trip_members')
      .select('trip:trips(*)')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map((row: any) => row.trip) as Trip[];
  },

  /** Update trip details (organizer only via RLS). */
  async update(tripId: string, updates: TripUpdate): Promise<Trip> {
    const { data, error } = await supabase
      .from('trips')
      .update(updates)
      .eq('id', tripId)
      .select()
      .single();
    if (error) throw error;
    return data as Trip;
  },

  /** RSVP to a trip (update your own membership status). */
  async rsvp(tripId: string, userId: string, status: TripMember['rsvp_status']): Promise<void> {
    const { error } = await supabase
      .from('trip_members')
      .update({ rsvp_status: status })
      .eq('trip_id', tripId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  /** Invite a user to a trip (add as pending member). */
  async inviteMember(tripId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('trip_members')
      .insert({ trip_id: tripId, user_id: userId, rsvp_status: 'pending', role: 'player' });
    if (error) throw error;
  },

  /** Join a trip using an invite code (via RPC). Returns the trip ID. */
  async joinByCode(code: string): Promise<string> {
    const { data, error } = await supabase.rpc('join_trip_by_code', {
      code: code.toUpperCase(),
    });
    if (error) throw error;
    return data as string;
  },

  /** Get trip courses for a specific trip. */
  async getCourses(tripId: string): Promise<TripCourse[]> {
    const { data, error } = await supabase
      .from('trip_courses')
      .select('*, course:courses(*)')
      .eq('trip_id', tripId)
      .order('day_number', { ascending: true });
    if (error) throw error;
    return data as TripCourse[];
  },

  /** Add a course to a trip day. */
  async addCourse(tripCourse: TripCourseInsert): Promise<void> {
    const { error } = await supabase.from('trip_courses').insert(tripCourse);
    if (error) throw error;
  },

  /** Get trip leaderboard via RPC. */
  async getLeaderboard(tripId: string): Promise<TripLeaderboardEntry[]> {
    const { data, error } = await supabase.rpc('get_trip_leaderboard', {
      p_trip_id: tripId,
    });
    if (error) throw error;
    return data as TripLeaderboardEntry[];
  },

  /** Subscribe to real-time trip member changes (joins, RSVPs). */
  subscribe(
    tripId: string,
    onUpdate: (payload: { event: string; member: TripMember }) => void
  ): RealtimeChannel {
    return supabase
      .channel(`trip:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_members',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) =>
          onUpdate({
            event: payload.eventType,
            member: payload.new as TripMember,
          })
      )
      .subscribe();
  },

  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  },
};
