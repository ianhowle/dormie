import { supabase } from '../lib/supabase';
import { calculateWeeklyPoints } from '../data/seasons-detail';
import type { MultiRoundConfig, ParticipationConfig } from '../data/seasons-detail';
import type { HoleScore, Season } from '../lib/database.types';

/**
 * Calculate Stableford points from a full round's hole-by-hole scores.
 *
 * Scoring: Double bogey+ = 0, Bogey = 1, Par = 2, Birdie = 3, Eagle = 4, Albatross+ = 5
 *
 * @param holeScores  Hole-by-hole gross scores (e.g. [4, 5, 3, ...])
 * @param coursePars  Par for each hole in the same order (e.g. [4, 4, 3, ...])
 * @returns           Total Stableford points for the round
 */
export function calculateStablefordFromRound(
  holeScores: number[],
  coursePars: number[],
): number {
  const len = Math.min(holeScores.length, coursePars.length);
  let total = 0;

  for (let i = 0; i < len; i++) {
    const diff = holeScores[i] - coursePars[i];
    if (diff >= 2) total += 0;       // Double bogey or worse
    else if (diff === 1) total += 1;  // Bogey
    else if (diff === 0) total += 2;  // Par
    else if (diff === -1) total += 3; // Birdie
    else if (diff === -2) total += 4; // Eagle
    else total += 5;                  // Albatross or better
  }

  return total;
}

/**
 * After a round linked to a season is saved, recalculate which round(s)
 * count for that user/week and update season_scores accordingly.
 *
 * Flow:
 * 1. Calculate Stableford points for the new round
 * 2. Query all existing scores for this user+week
 * 3. Use calculateWeeklyPoints to pick the best round(s)
 * 4. Update is_counting flags so only the best round counts
 * 5. Apply participation bonus if configured
 */
export async function processSeasonRound(params: {
  roundId: string;
  userId: string;
  seasonWeekId: string;
  seasonId: string;
  holeScores: HoleScore[];
  coursePars: number[];
}): Promise<{ stablefordPoints: number; weeklyTotal: number; participationAwarded: boolean }> {
  const { roundId, userId, seasonWeekId, seasonId, holeScores, coursePars } = params;

  // 1. Calculate Stableford points for this round
  const grossScores = holeScores.map((h) => h.gross);
  const stablefordPoints = calculateStablefordFromRound(grossScores, coursePars);

  // 2. Upsert this round's score (use round_id to allow multiple per user/week)
  const { error: upsertErr } = await supabase
    .from('season_scores')
    .upsert(
      {
        season_week_id: seasonWeekId,
        user_id: userId,
        round_id: roundId,
        points: stablefordPoints,
        is_counting: true,
      },
      { onConflict: 'season_week_id,user_id,round_id' },
    );
  if (upsertErr) throw upsertErr;

  // 3. Fetch all scores for this user in this week
  const { data: allScores, error: fetchErr } = await supabase
    .from('season_scores')
    .select('id, round_id, points')
    .eq('season_week_id', seasonWeekId)
    .eq('user_id', userId)
    .order('points', { ascending: false });
  if (fetchErr) throw fetchErr;

  // 4. Load season config for multi-round and participation settings
  const { data: season, error: seasonErr } = await supabase
    .from('seasons')
    .select('config')
    .eq('id', seasonId)
    .single();
  if (seasonErr) throw seasonErr;

  const config = (season as { config: Record<string, any> }).config ?? {};
  const multiRound: MultiRoundConfig | null = config.multi_round_week
    ? {
        multiRoundWeek: true,
        roundsAllowedPerWeek: config.rounds_allowed_per_week ?? 3,
        bestRoundsCount: config.best_rounds_count ?? 1,
      }
    : null;

  const participation: ParticipationConfig | null = config.participation_bonus
    ? {
        participationBonus: true,
        participationPoints: config.participation_points ?? 2,
      }
    : null;

  // 5. Use calculateWeeklyPoints to determine which rounds count
  const roundPointsList = (allScores ?? []).map((s: any) => s.points as number);
  const weekResult = calculateWeeklyPoints(roundPointsList, multiRound, participation);

  // 6. Mark counting vs non-counting rounds
  // Sort allScores descending by points (already sorted from query)
  const sortedScores = [...(allScores ?? [])].sort((a: any, b: any) => b.points - a.points);
  const countingCount = weekResult.countingRounds.length;

  for (let i = 0; i < sortedScores.length; i++) {
    const score = sortedScores[i] as any;
    const shouldCount = i < countingCount;
    const { error: updateErr } = await supabase
      .from('season_scores')
      .update({
        is_counting: shouldCount,
        participation_bonus: shouldCount && weekResult.participationAwarded
          ? (participation?.participationPoints ?? 0)
          : 0,
      })
      .eq('id', score.id);
    if (updateErr) throw updateErr;
  }

  return {
    stablefordPoints,
    weeklyTotal: weekResult.total,
    participationAwarded: weekResult.participationAwarded,
  };
}
