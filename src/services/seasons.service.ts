import { supabase } from '../lib/supabase';

export const seasonsService = {
  async createSeason(seasonData: Record<string, unknown>) {
    return supabase.from('seasons').insert(seasonData).select().single();
  },

  async getSeason(seasonId: string) {
    return supabase.from('seasons').select('*').eq('id', seasonId).single();
  },

  async getGroupSeasons(groupId: string) {
    return supabase
      .from('seasons')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
  },

  async getSeasonStandings(seasonId: string) {
    return supabase.rpc('get_season_standings', { p_season_id: seasonId });
  },

  async getSeasonSchedule(seasonId: string) {
    return supabase
      .from('season_events')
      .select('*')
      .eq('season_id', seasonId)
      .order('event_date', { ascending: true });
  },
};
