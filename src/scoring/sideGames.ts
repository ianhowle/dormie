// ─── Side game detection and state management ─────────────────────────
import type { PlayerConfig, HoleData, HoleScore, SideGameEvent } from './types';
import { isGIR } from './calculations';
import { detectSideGameEvents } from '../components/SideGameToast';
import { scoreName as scoreNameUtil } from '../lib/scoring-utils';

export function generateScoringEvents(
  holeNumber: number,
  allScores: Map<number, Map<string, HoleScore>>,
  holes: HoleData[],
  players: PlayerConfig[],
): { text: string; time: Date }[] {
  const newEvents: { text: string; time: Date }[] = [];
  const holeData = holes.find((h) => h.number === holeNumber);
  if (!holeData) return newEvents;
  const holeScores = allScores.get(holeNumber);
  if (!holeScores) return newEvents;

  holeScores.forEach((s, pid) => {
    const player = players.find((p) => p.id === pid);
    if (!player) return;
    const name = player.id === '1' ? 'You' : player.name.split(' ')[0];
    const diff = s.gross - holeData.par;

    if (diff <= -2) newEvents.push({ text: `${name} eagled Hole ${holeNumber}!`, time: new Date() });
    else if (diff === -1) newEvents.push({ text: `${name} birdied Hole ${holeNumber}`, time: new Date() });
    else if (diff >= 2) newEvents.push({ text: `${name} made ${scoreNameUtil(s.gross, holeData.par)} on Hole ${holeNumber}`, time: new Date() });
    if (s.putts >= 3) newEvents.push({ text: `${name} 3-putted Hole ${holeNumber}`, time: new Date() });
    if (s.putts === 0) newEvents.push({ text: `${name} chipped in on Hole ${holeNumber}!`, time: new Date() });
  });

  return newEvents;
}

export function detectToastEvents(
  holeNumber: number,
  allScores: Map<number, Map<string, HoleScore>>,
  holes: HoleData[],
  players: PlayerConfig[],
  sideGameKeys: string[],
): SideGameEvent[] {
  const holeData = holes.find((h) => h.number === holeNumber);
  if (!holeData) return [];
  const holeScores = allScores.get(holeNumber);
  if (!holeScores) return [];

  const newEvents: SideGameEvent[] = [];
  holeScores.forEach((s, pid) => {
    const player = players.find((p) => p.id === pid);
    if (!player) return;
    const name = player.id === '1' ? 'You' : player.name.split(' ')[0];
    const gir = isGIR(s.gross, s.putts, holeData.par);
    const isSave = !gir && s.gross <= holeData.par;

    sideGameKeys.forEach((gameKey) => {
      const events = detectSideGameEvents(
        gameKey,
        holeNumber,
        holeData.par,
        s.gross,
        s.putts,
        name,
        s.fir,
        gir,
        isSave,
      );
      newEvents.push(...events);
    });
  });

  return newEvents;
}
