import { supabase } from '../lib/supabase';
import type { Round, RoundInsert, RoundUpdate, RoundWithCourse } from '../lib/database.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Calculate handicap index client-side:
 * Fetch last 20 rounds, take best 8 differentials, average, multiply by 0.96.
 * Differential = (gross - rating) * 113 / slope
 */
async function recalculateHandicap(userId: string): Promise<void> {
  try {
    const { data: rounds } = await supabase
      .from('rounds')
      .select('gross_score, course:courses(par, slope, rating)')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(20);

    if (!rounds || rounds.length < 3) return;

    const differentials = rounds
      .map((r: any) => {
        const rating = r.course?.rating ?? 72;
        const slope = r.course?.slope ?? 113;
        return ((r.gross_score - rating) * 113) / slope;
      })
      .sort((a: number, b: number) => a - b);

    const best8 = differentials.slice(0, Math.min(8, Math.ceil(differentials.length * 0.4)));
    const avg = best8.reduce((a: number, b: number) => a + b, 0) / best8.length;
    const handicapIndex = Math.round(avg * 0.96 * 10) / 10;

    await supabase
      .from('users')
      .update({ handicap_index: handicapIndex })
      .eq('id', userId);
  } catch {
    // Handicap calculation is non-critical
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

    // Trigger async handicap recalculation (non-blocking)
    // Try RPC first, fall back to client-side calculation
    supabase.rpc('calculate_handicap', { p_user_id: round.user_id })
      .then(({ error: rpcErr }) => {
        if (rpcErr) recalculateHandicap(round.user_id);
      })
      .catch(() => recalculateHandicap(round.user_id));

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
