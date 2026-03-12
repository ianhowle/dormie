import { supabase } from '../lib/supabase';

export const roundsService = {
  async createRound(roundData: Record<string, unknown>) {
    return supabase.from('rounds').insert(roundData).select().single();
  },

  async updateRound(roundId: string, updates: Record<string, unknown>) {
    return supabase.from('rounds').update(updates).eq('id', roundId);
  },

  async getRound(roundId: string) {
    return supabase
      .from('rounds')
      .select('*, scores(*), side_game_results(*)')
      .eq('id', roundId)
      .single();
  },

  async getUserRounds(userId: string, limit = 20) {
    return supabase
      .from('rounds')
      .select('*, course:courses(name, city, state)')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(limit);
  },

  async saveScores(scores: Record<string, unknown>[]) {
    return supabase.from('scores').upsert(scores);
  },

  async saveSideGameResults(results: Record<string, unknown>[]) {
    return supabase.from('side_game_results').upsert(results);
  },

  subscribeToRound(roundId: string, callback: (payload: unknown) => void) {
    return supabase
      .channel(`round:${roundId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores', filter: `round_id=eq.${roundId}` },
        (payload) => callback(payload)
      )
      .subscribe();
  },
};
