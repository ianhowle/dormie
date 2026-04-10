// Competition impact data — computes how a round affects active competitions
import type {
  SeasonImpact,
  RyderCupImpact,
  HandicapImpact,
  LinkedSeason,
  PlayerConfig,
  PlayerTotals,
} from '../scoring/types';
import { calculateFedExPoints } from './seasons-detail';

// ─── Season Impact ──────────────────────────────────────────────────

/** Ordinal suffix for rank display: 1st, 2nd, 3rd, 4th, etc. */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Compute the season impact from this round.
 * Uses the player's week position among all players and the season's
 * FedEx-style points table + multiplier.
 */
export function computeSeasonImpact(
  linkedSeason: LinkedSeason,
  playerTotals: PlayerTotals[],
  userId: string,
): SeasonImpact | null {
  const sorted = [...playerTotals].sort((a, b) => a.gross - b.gross);
  const weekPosition = sorted.findIndex((r) => r.player.id === userId) + 1;
  if (weekPosition === 0) return null;

  const points = calculateFedExPoints(weekPosition, linkedSeason.multiplier);

  // Mock previous standings — in production these come from Supabase
  const previousRank = Math.min(weekPosition + 2, 10);
  const currentRank = Math.max(previousRank - 2, 1);
  const rankChange = previousRank - currentRank;

  const isPlayoff = linkedSeason.multiplier === 1.5 ||
    linkedSeason.format?.toLowerCase().includes('playoff');
  const isChampionship = linkedSeason.multiplier >= 2.5 ||
    linkedSeason.format?.toLowerCase().includes('championship');

  return {
    seasonName: linkedSeason.seasonName,
    pointsEarned: points,
    weekPosition,
    weekLabel: `${ordinal(weekPosition)} place this week`,
    previousRank,
    currentRank,
    rankChange,
    pointsBehindLeader: weekPosition === 1 ? 0 : Math.round(points * 0.8 + 3),
    leaderName: weekPosition === 1 ? '' : 'McGowan',
    isPlayoffWeek: isPlayoff,
    isChampionshipWeek: isChampionship,
    multiplier: linkedSeason.multiplier,
    isSeasonHigh: points >= 16,
  };
}

// ─── Ryder Cup Impact ───────────────────────────────────────────────

type RyderCupConfig = {
  opponentId: string;
  opponentName: string;
  teamName: string;
  teamColor: 'red' | 'blue';
  teamScoreBefore: number;
  opponentTeamScoreBefore: number;
};

/**
 * Compute the Ryder Cup impact from this round.
 * Compares user score vs opponent score in the player totals.
 */
export function computeRyderCupImpact(
  config: RyderCupConfig,
  playerTotals: PlayerTotals[],
  userId: string,
): RyderCupImpact | null {
  const userRow = playerTotals.find((r) => r.player.id === userId);
  const oppRow = playerTotals.find((r) => r.player.id === config.opponentId);
  if (!userRow || !oppRow) return null;

  let matchResult: 'win' | 'loss' | 'halved';
  let pointsForTeam: number;

  if (userRow.gross < oppRow.gross) {
    matchResult = 'win';
    pointsForTeam = 1;
  } else if (userRow.gross > oppRow.gross) {
    matchResult = 'loss';
    pointsForTeam = 0;
  } else {
    matchResult = 'halved';
    pointsForTeam = 0.5;
  }

  return {
    opponentName: config.opponentName,
    userScore: userRow.gross,
    opponentScore: oppRow.gross,
    matchResult,
    pointsForTeam,
    teamName: config.teamName,
    teamColor: config.teamColor,
    teamScore: config.teamScoreBefore + pointsForTeam,
    opponentTeamScore: config.opponentTeamScoreBefore + (1 - pointsForTeam),
  };
}

// ─── Handicap Impact ────────────────────────────────────────────────

/**
 * Compute the handicap change from this round.
 * In production, this reads from the handicap service after recalculation.
 * For now, uses a mock differential estimate.
 */
export function computeHandicapImpact(
  player: PlayerConfig,
  grossScore: number,
  coursePar: number,
  courseSlope: number,
  courseRating: number,
): HandicapImpact {
  const prevIndex = player.handicap;

  // WHS differential estimate: (113 / slope) * (gross - rating)
  const differential = (113 / (courseSlope || 113)) * (grossScore - (courseRating || coursePar));
  // Simple estimate: new index shifts toward this differential
  const shift = (differential - prevIndex) * 0.05; // 1/20 weight for new round
  const newIndex = Math.max(0, Math.round((prevIndex + shift) * 10) / 10);
  const change = Math.round((newIndex - prevIndex) * 10) / 10;

  return {
    previousIndex: prevIndex,
    newIndex,
    change,
    isCountingRound: true,
    droppedRoundScore: grossScore > coursePar + 15 ? null : coursePar + 12,
  };
}
