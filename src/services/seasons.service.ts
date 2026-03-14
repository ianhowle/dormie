import { supabase } from '../lib/supabase';
import type {
  Season,
  SeasonInsert,
  SeasonUpdate,
  SeasonMemberInsert,
  SeasonWeekInsert,
  SeasonScoreInsert,
  SeasonStandingsEntry,
  SeasonWithMembers,
  SeasonWeekWithScores,
} from '../lib/database.types';

export const seasonsService = {
  /**
   * Create a season with weeks and initial members in one go.
   * Inserts season, then bulk-inserts weeks and members.
   */
  async create(
    season: SeasonInsert,
    weeks: Omit<SeasonWeekInsert, 'season_id'>[],
    memberIds: string[]
  ): Promise<Season> {
    const { data: created, error: sErr } = await supabase
      .from('seasons')
      .insert(season)
      .select()
      .single();
    if (sErr) throw sErr;
    const seasonId = (created as Season).id;

    if (weeks.length > 0) {
      const weekRows = weeks.map((w) => ({ ...w, season_id: seasonId }));
      const { error: wErr } = await supabase.from('season_weeks').insert(weekRows);
      if (wErr) throw wErr;
    }

    const uniqueIds = [...new Set([season.creator_id, ...memberIds])];
    const memberRows: SeasonMemberInsert[] = uniqueIds.map((uid) => ({
      season_id: seasonId,
      user_id: uid,
    }));
    const { error: mErr } = await supabase.from('season_members').insert(memberRows);
    if (mErr) throw mErr;

    return created as Season;
  },

  /** Get a season with its members and their profiles. */
  async getById(seasonId: string): Promise<SeasonWithMembers> {
    const { data, error } = await supabase
      .from('seasons')
      .select('*, season_members(*, user:users(id, name, handicap_index, avatar_color))')
      .eq('id', seasonId)
      .single();
    if (error) throw error;
    return data as SeasonWithMembers;
  },

  /** Get all seasons the user belongs to. */
  async getByUser(userId: string): Promise<Season[]> {
    const { data, error } = await supabase
      .from('season_members')
      .select('season:seasons(*)')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map((row: any) => row.season) as Season[];
  },

  /** Update season metadata. */
  async update(seasonId: string, updates: SeasonUpdate): Promise<Season> {
    const { data, error } = await supabase
      .from('seasons')
      .update(updates)
      .eq('id', seasonId)
      .select()
      .single();
    if (error) throw error;
    return data as Season;
  },

  /** Get all weeks for a season with their scores. */
  async getWeeks(seasonId: string): Promise<SeasonWeekWithScores[]> {
    const { data, error } = await supabase
      .from('season_weeks')
      .select('*, season_scores(*, user:users(id, name))')
      .eq('season_id', seasonId)
      .order('week_number', { ascending: true });
    if (error) throw error;
    return data as SeasonWeekWithScores[];
  },

  /** Submit (upsert) a score for a season week. */
  async submitScore(score: SeasonScoreInsert): Promise<void> {
    const { error } = await supabase
      .from('season_scores')
      .upsert(score, { onConflict: 'season_week_id,user_id' });
    if (error) throw error;
  },

  /** Get FedEx Cup standings via RPC. */
  async getStandings(seasonId: string): Promise<SeasonStandingsEntry[]> {
    const { data, error } = await supabase.rpc('get_season_standings', {
      p_season_id: seasonId,
    });
    if (error) throw error;
    return data as SeasonStandingsEntry[];
  },

  /** Add a member to a season. */
  async addMember(seasonId: string, userId: string, team?: string): Promise<void> {
    const { error } = await supabase
      .from('season_members')
      .insert({ season_id: seasonId, user_id: userId, team });
    if (error) throw error;
  },

  /** Remove a member from a season. */
  async removeMember(seasonId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('season_members')
      .delete()
      .eq('season_id', seasonId)
      .eq('user_id', userId);
    if (error) throw error;
  },
};
