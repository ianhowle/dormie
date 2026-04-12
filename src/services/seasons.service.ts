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

  /** Submit (upsert) a score for a season week. Supports multi-round weeks. */
  async submitScore(score: SeasonScoreInsert): Promise<void> {
    const { error } = await supabase
      .from('season_scores')
      .upsert(score, { onConflict: 'season_week_id,user_id,round_id' });
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

  /**
   * Client-side standings computation that respects is_counting flags.
   * Sums only counting scores per user, adds participation bonuses,
   * and sorts by total points descending.
   */
  async getStandingsWithCounting(seasonId: string): Promise<SeasonStandingsEntry[]> {
    // Fetch all weeks with scores for this season
    const { data: weeks, error: wErr } = await supabase
      .from('season_weeks')
      .select('id, week_number, season_scores(user_id, points, is_counting, participation_bonus, user:users(id, name))')
      .eq('season_id', seasonId)
      .order('week_number', { ascending: true });
    if (wErr) throw wErr;

    // Aggregate per-user totals from counting scores only
    const userTotals = new Map<string, {
      name: string;
      totalPoints: number;
      weeksPlayed: number;
      bestFinish: number;
      participationTotal: number;
    }>();

    for (const week of (weeks ?? [])) {
      // Group scores by user for this week
      const weekScores = (week as any).season_scores ?? [];
      const userScoresInWeek = new Map<string, number[]>();

      for (const score of weekScores) {
        if (!score.is_counting) continue;
        const userId = score.user_id;
        const userName = score.user?.name ?? 'Unknown';

        if (!userTotals.has(userId)) {
          userTotals.set(userId, {
            name: userName,
            totalPoints: 0,
            weeksPlayed: 0,
            bestFinish: 999,
            participationTotal: 0,
          });
        }

        const entry = userTotals.get(userId)!;
        entry.totalPoints += score.points + (score.participation_bonus ?? 0);
        entry.participationTotal += score.participation_bonus ?? 0;

        if (!userScoresInWeek.has(userId)) {
          userScoresInWeek.set(userId, []);
        }
        userScoresInWeek.get(userId)!.push(score.points);
      }

      // Count weeks played
      for (const userId of userScoresInWeek.keys()) {
        const entry = userTotals.get(userId)!;
        entry.weeksPlayed += 1;
      }
    }

    // Convert to array and sort
    const standings: SeasonStandingsEntry[] = [];
    for (const [userId, data] of userTotals) {
      standings.push({
        user_id: userId,
        user_name: data.name,
        total_points: data.totalPoints,
        weeks_played: data.weeksPlayed,
        best_finish: data.bestFinish < 999 ? data.bestFinish : 1,
      });
    }

    standings.sort((a, b) => b.total_points - a.total_points);
    return standings;
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

  // ─── Weekly Side Games ───────────────────────────────────────────────

  /** Get side games for a specific week. */
  async getSideGames(weekId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('season_week_side_games')
      .select('*, winner:users(id, name)')
      .eq('week_id', weekId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  /** Add a side game to a week. */
  async addSideGame(sideGame: {
    week_id: string;
    type: string;
    label: string;
    description: string;
    points: number;
    hole_number?: number | null;
  }): Promise<any> {
    const { data, error } = await supabase
      .from('season_week_side_games')
      .insert(sideGame)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Remove a side game. */
  async removeSideGame(sideGameId: string): Promise<void> {
    const { error } = await supabase
      .from('season_week_side_games')
      .delete()
      .eq('id', sideGameId);
    if (error) throw error;
  },

  /** Pick the winner for a side game. */
  async pickSideGameWinner(
    sideGameId: string,
    winnerUserId: string,
  ): Promise<void> {
    const { error } = await supabase
      .from('season_week_side_games')
      .update({ winner_user_id: winnerUserId })
      .eq('id', sideGameId);
    if (error) throw error;
  },

  /** Batch-update side game winners. */
  async confirmSideGameWinners(
    picks: { sideGameId: string; winnerUserId: string | null }[],
  ): Promise<void> {
    for (const pick of picks) {
      if (!pick.winnerUserId) continue;
      const { error } = await supabase
        .from('season_week_side_games')
        .update({ winner_user_id: pick.winnerUserId })
        .eq('id', pick.sideGameId);
      if (error) throw error;
    }
  },
};
