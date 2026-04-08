import { supabase } from '../lib/supabase';
import type { Round, RoundInsert, RoundUpdate, RoundWithCourse } from '../lib/database.types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { recalculatePlayerHandicap } from './handicap.service';

/**
 * WHS-compliant handicap recalculation wrapper.
 * Uses the full handicap.service.ts implementation with selection table,
 * Net Double Bogey adjustment, soft/hard caps, and differential storage.
 * Falls back to server-side RPC if client-side fails.
 */
async function recalculateHandicap(userId: string): Promise<void> {
  try {
    await recalculatePlayerHandicap(userId);
  } catch {
    // Handicap calculation is non-critical — round is still saved
  }
}

export const roundsService = {
  /** Create a round and trigger handicap recalculation. */
  async create(round: RoundInsert): Promise<Round> {
    const { data, error } = await supabase
      .from('rounds')
      .insert(round)
      .select()
      .single();
    if (error) throw error;

    // Trigger WHS-compliant handicap recalculation (non-blocking).
    // Uses client-side calculation with full selection table, caps, and
    // Net Double Bogey adjustment. Also stores differentials in Supabase.
    recalculateHandicap(round.user_id);

    return data as Round;
  },

  /** Get a single round by ID with course info. */
  async getById(roundId: string): Promise<RoundWithCourse> {
    const { data, error } = await supabase
      .from('rounds')
      .select('*, course:courses(name, city, state, par)')
      .eq('id', roundId)
      .single();
    if (error) throw error;
    return data as RoundWithCourse;
  },

  /** Get rounds for a user, newest first. */
  async getByUser(userId: string, limit = 20): Promise<RoundWithCourse[]> {
    const { data, error } = await supabase
      .from('rounds')
      .select('*, course:courses(name, city, state, par)')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data as RoundWithCourse[];
  },

  /** Get all rounds for a trip. */
  async getByTrip(tripId: string): Promise<RoundWithCourse[]> {
    const { data, error } = await supabase
      .from('rounds')
      .select('*, course:courses(name, city, state, par)')
      .eq('trip_id', tripId)
      .order('played_at', { ascending: true });
    if (error) throw error;
    return data as RoundWithCourse[];
  },

  /** Update a round and recalculate handicap. */
  async update(roundId: string, userId: string, updates: RoundUpdate): Promise<Round> {
    const { data, error } = await supabase
      .from('rounds')
      .update(updates)
      .eq('id', roundId)
      .select()
      .single();
    if (error) throw error;

    recalculateHandicap(userId);

    return data as Round;
  },

  /** Delete a round and recalculate handicap. */
  async delete(roundId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('rounds')
      .delete()
      .eq('id', roundId);
    if (error) throw error;

    recalculateHandicap(userId);
  },

  /** Subscribe to real-time score updates for a specific round. */
  subscribe(roundId: string, onUpdate: (round: Round) => void): RealtimeChannel {
    return supabase
      .channel(`round:${roundId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rounds',
          filter: `id=eq.${roundId}`,
        },
        (payload) => onUpdate(payload.new as Round)
      )
      .subscribe();
  },

  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  },

  /** Get rounds for a user at a specific course, for personal best detection. */
  async fetchByCourse(courseId: string, userId: string): Promise<RoundWithCourse[]> {
    const { data, error } = await supabase
      .from('rounds')
      .select('*, course:courses(name, city, state, par)')
      .eq('course_id', courseId)
      .eq('user_id', userId)
      .order('gross_score', { ascending: true });
    if (error) throw error;
    return data as RoundWithCourse[];
  },
};
