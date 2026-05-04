import { supabase } from '../lib/supabase';
import type {
  Trip,
  TripInsert,
  TripUpdate,
  TripWithMembers,
  TripMember,
  TripMemberWithUser,
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

  /** Get all trips the user is a member of, with members joined for avatar/player rendering. */
  async getByUser(userId: string): Promise<TripWithMembers[]> {
    const { data, error } = await supabase
      .from('trip_members')
      .select('trip:trips(*, trip_members(*, user:users(id, name, handicap_index, avatar_color)))')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map((row: any) => row.trip) as TripWithMembers[];
  },

  /** Delete a trip (organizer only via RLS). Cascades to trip_members,
   *  trip_courses, trip_invites, messages, moments, etc. via FK constraints. */
  async delete(tripId: string): Promise<void> {
    const { error } = await supabase.from('trips').delete().eq('id', tripId);
    if (error) throw error;
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

  /** Add multiple members to a trip in bulk.
   *  Supports both registered users (upsert by trip_id,user_id)
   *  and guest players (insert with user_id: null + guest_name). */
  async addMembers(
    tripId: string,
    members: (
      | { user_id: string; role?: TripMember['role']; team?: TripMember['team'] }
      | { guest_name: string; handicap?: number }
    )[],
  ): Promise<void> {
    const userRows = members
      .filter((m): m is { user_id: string; role?: TripMember['role']; team?: TripMember['team'] } => 'user_id' in m)
      .map((m) => ({
        trip_id: tripId,
        user_id: m.user_id,
        rsvp_status: 'confirmed' as const,
        role: m.role ?? 'player',
        team: m.team ?? null,
      }));

    const guestRows = members
      .filter((m): m is { guest_name: string; handicap?: number } => 'guest_name' in m)
      .map((m) => ({
        trip_id: tripId,
        user_id: null as string | null,
        guest_name: m.guest_name,
        rsvp_status: 'confirmed' as const,
        role: 'player' as const,
      }));

    // Upsert registered users (handles re-invites gracefully)
    if (userRows.length > 0) {
      const { error } = await supabase.from('trip_members').upsert(userRows, {
        onConflict: 'trip_id,user_id',
      });
      if (error) throw error;
    }

    // Insert guests (no conflict path — guests don't dedupe)
    if (guestRows.length > 0) {
      const { error } = await supabase.from('trip_members').insert(guestRows);
      if (error) throw error;
    }
  },

  /** Update a member's team assignment. */
  async updateMemberTeam(
    tripId: string,
    userId: string,
    team: 'red' | 'blue' | null,
  ): Promise<void> {
    const { error } = await supabase
      .from('trip_members')
      .update({ team })
      .eq('trip_id', tripId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  /** Get all members for a trip with user profiles. */
  async getMembers(tripId: string): Promise<TripMemberWithUser[]> {
    const { data, error } = await supabase
      .from('trip_members')
      .select('*, user:users(id, name, handicap_index, avatar_color)')
      .eq('trip_id', tripId);
    if (error) throw error;
    return (data ?? []) as TripMemberWithUser[];
  },

  /** Get rounds linked to a trip, with course info. */
  async getTripRounds(tripId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('rounds')
      .select('*, course:courses(name, par)')
      .eq('trip_id', tripId)
      .order('played_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
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
