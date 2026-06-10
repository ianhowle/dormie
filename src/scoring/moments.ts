// ─── Dormie moment detection logic ──────────────────────────────────
import type { PlayerConfig, HoleData, HoleScore, MomentType } from './types';
import { haptics } from '../lib/haptics';
import { sounds } from '../lib/sounds';

export type MomentResult = {
  type: MomentType;
  playerName: string;
  detail: string;
} | null;

export function checkDormieMoments(
  holeNumber: number,
  allScores: Map<number, Map<string, HoleScore>>,
  players: PlayerConfig[],
  holes: HoleData[],
  sideGameKeys: string[],
  isMatchPlay: boolean,
): MomentResult {
  const holeScores = allScores.get(holeNumber);
  if (!holeScores || players.length < 2) return null;

  const holesRemaining = holes.length - holes.findIndex((h) => h.number === holeNumber) - 1;
  if (holesRemaining <= 0) return null;

  // Match play dormie/match-closed: only meaningful for actual match-play rounds.
  // Gated so it never fires on stroke/Stableford/etc. (skins block below stays unconditional).
  if (isMatchPlay) {
    // Match play dormie: player leads by exactly as many holes as remain
    const totals = players.map((p) => {
      let total = 0;
      holes.forEach((h) => {
        if (h.number > holeNumber) return;
        const s = allScores.get(h.number)?.get(p.id);
        if (s) total += s.gross;
      });
      return { player: p, total };
    }).sort((a, b) => a.total - b.total);

    if (totals.length >= 2 && totals[0].total > 0 && totals[1].total > 0) {
      let holesWon = 0;
      holes.forEach((h) => {
        if (h.number > holeNumber) return;
        const s1 = allScores.get(h.number)?.get(totals[0].player.id);
        const s2 = allScores.get(h.number)?.get(totals[1].player.id);
        if (s1 && s2) {
          if (s1.gross < s2.gross) holesWon++;
          else if (s1.gross > s2.gross) holesWon--;
        }
      });

      const lead = Math.abs(holesWon);
      const leaderName = holesWon > 0 ? (totals[0].player.id === '1' ? 'You' : totals[0].player.name) :
        holesWon < 0 ? (totals[1].player.id === '1' ? 'You' : totals[1].player.name) : '';

      if (lead > 0 && lead === holesRemaining) {
        haptics.heavy();
        sounds.chime();
        return {
          type: 'DORMIE',
          playerName: leaderName,
          detail: `${lead} up with ${holesRemaining} to play`,
        };
      }
      if (lead > holesRemaining) {
        haptics.heavy();
        sounds.chime();
        return {
          type: 'MATCH_CLOSED',
          playerName: leaderName,
          detail: `${lead} & ${holesRemaining} — match closed`,
        };
      }
    }
  }

  // Skins jackpot: check if a skin carries over 3+ holes
  if (sideGameKeys.includes('skins')) {
    let carryover = 0;
    let result: MomentResult = null;
    holes.forEach((h) => {
      if (h.number > holeNumber) return;
      const hs = allScores.get(h.number);
      if (!hs || hs.size < players.length) { carryover++; return; }
      let best = Infinity;
      let winners: string[] = [];
      hs.forEach((s, pid) => {
        if (s.gross < best) { best = s.gross; winners = [pid]; }
        else if (s.gross === best) winners.push(pid);
      });
      if (winners.length === 1) {
        if (carryover >= 3) {
          haptics.heavy();
          sounds.chime();
          const wp = players.find((p) => p.id === winners[0]);
          result = {
            type: 'SKINS_JACKPOT',
            playerName: wp ? (wp.id === '1' ? 'You' : wp.name) : 'Player',
            detail: `${carryover + 1} skins won on Hole ${h.number}!`,
          };
        }
        carryover = 0;
      } else {
        carryover++;
      }
    });
    if (result) return result;
  }

  return null;
}
