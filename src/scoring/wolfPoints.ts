// ─── Wolf point calculation per Dormie spec ─────────────────────────
// Partner win: wolf +2, partner +2
// Partner lose: wolf -1, partner -1 (opponents +0; spec: losers pay field)
// Actually: spec reads "partner +2/+2 win, -1/-1 lose" meaning losing team
// drops -1 each and opponents pick up the field's share. We implement:
//   - partner win: team +2 each, opponents -1 each
//   - partner lose: team -1 each, opponents +2 each (symmetric payout)
// Lone wolf win: wolf +3, opponents -1 each
// Lone wolf lose: wolf -3, opponents +1 each
// Blind wolf win: wolf +6, opponents -2 each
// Blind wolf lose: wolf -6, opponents +2 each
// Halved holes split the applicable points evenly (go to field).
import type { HoleScore, PlayerConfig, WolfHoleState } from './types';

export type WolfHoleOutcome = {
  perPlayer: Record<string, number>;
  note: string;
};

export function computeWolfHolePoints(
  players: PlayerConfig[],
  holeScores: Map<string, HoleScore>,
  decision: WolfHoleState | null | undefined,
): WolfHoleOutcome {
  const perPlayer: Record<string, number> = {};
  players.forEach((p) => { perPlayer[p.id] = 0; });
  if (!decision || !decision.decision) return { perPlayer, note: 'no-decision' };
  const wolfId = decision.wolfPlayerId;
  const wolfScore = holeScores.get(wolfId)?.gross;
  if (wolfScore == null) return { perPlayer, note: 'incomplete' };

  if (decision.decision === 'lone' || decision.decision === 'blind') {
    const others = players.filter((p) => p.id !== wolfId);
    const otherScores = others
      .map((p) => ({ id: p.id, gross: holeScores.get(p.id)?.gross }))
      .filter((s): s is { id: string; gross: number } => typeof s.gross === 'number');
    if (otherScores.length < others.length) return { perPlayer, note: 'incomplete' };
    const bestOther = Math.min(...otherScores.map((s) => s.gross));
    const isBlind = decision.decision === 'blind';
    const wolfPts = isBlind ? 6 : 3;
    const perOppPts = isBlind ? 2 : 1;
    if (wolfScore < bestOther) {
      perPlayer[wolfId] += wolfPts;
      otherScores.forEach((s) => { perPlayer[s.id] -= perOppPts; });
      return { perPlayer, note: isBlind ? 'blind-win' : 'lone-win' };
    }
    if (wolfScore > bestOther) {
      perPlayer[wolfId] -= wolfPts;
      otherScores.forEach((s) => { perPlayer[s.id] += perOppPts; });
      return { perPlayer, note: isBlind ? 'blind-lose' : 'lone-lose' };
    }
    return { perPlayer, note: 'halved' }; // ties go to field (no points)
  }

  // Partner decision
  if (decision.decision === 'partner' && decision.partnerId) {
    const teamIds = [wolfId, decision.partnerId];
    const oppIds = players.filter((p) => !teamIds.includes(p.id)).map((p) => p.id);
    const teamScores = teamIds
      .map((id) => holeScores.get(id)?.gross)
      .filter((v): v is number => typeof v === 'number');
    const oppScores = oppIds
      .map((id) => holeScores.get(id)?.gross)
      .filter((v): v is number => typeof v === 'number');
    if (teamScores.length < 2 || oppScores.length < oppIds.length) {
      return { perPlayer, note: 'incomplete' };
    }
    const teamBest = Math.min(...teamScores);
    const oppBest = Math.min(...oppScores);
    if (teamBest < oppBest) {
      teamIds.forEach((id) => { perPlayer[id] += 2; });
      oppIds.forEach((id) => { perPlayer[id] -= 1; });
      return { perPlayer, note: 'team-win' };
    }
    if (oppBest < teamBest) {
      teamIds.forEach((id) => { perPlayer[id] -= 1; });
      oppIds.forEach((id) => { perPlayer[id] += 2; });
      return { perPlayer, note: 'team-lose' };
    }
    return { perPlayer, note: 'halved' };
  }

  return { perPlayer, note: 'no-decision' };
}

export function computeWolfTotals(
  players: PlayerConfig[],
  allScores: Map<number, Map<string, HoleScore>>,
  wolfHoleDecisions: Map<number, WolfHoleState>,
  throughHole?: number,
): Record<string, number> {
  const totals: Record<string, number> = {};
  players.forEach((p) => { totals[p.id] = 0; });
  wolfHoleDecisions.forEach((decision, holeNumber) => {
    if (throughHole != null && holeNumber > throughHole) return;
    const holeScores = allScores.get(holeNumber);
    if (!holeScores) return;
    const outcome = computeWolfHolePoints(players, holeScores, decision);
    Object.entries(outcome.perPlayer).forEach(([pid, pts]) => {
      totals[pid] = (totals[pid] ?? 0) + pts;
    });
  });
  return totals;
}
