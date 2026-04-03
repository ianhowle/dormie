// ─── Scoring calculations: Stableford, match play, skins, dots, snake, nassau, settlement ──
import type {
  PlayerConfig, HoleData, HoleScore, HoleData as HD,
  PlayerTotals, GameResult, WolfHoleState, BBBHolePoints,
} from './types';
import { useTheme } from '../theme/ThemeContext';

// ─── Default hole pars (standard layout) ──────────────────────────────
export function buildHoles(coursePar: number, holeRange: string): HoleData[] {
  const standardPars = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 5, 4];
  const standardSI = [7, 3, 15, 1, 11, 5, 17, 9, 13, 8, 2, 16, 6, 4, 12, 18, 10, 14];

  const pars = [...standardPars];
  const totalStd = pars.reduce((a, b) => a + b, 0);
  let diff = coursePar - totalStd;
  let idx = 0;
  while (diff > 0) {
    if (pars[idx] === 4) { pars[idx] = 5; diff--; }
    idx++;
    if (idx >= 18) break;
  }
  while (diff < 0) {
    if (pars[17 - idx] === 4) { pars[17 - idx] = 3; diff++; }
    idx++;
    if (idx >= 18) break;
  }

  let holes: HoleData[] = pars.map((p, i) => ({
    number: i + 1,
    par: p,
    strokeIndex: standardSI[i],
  }));

  if (holeRange === 'front9') holes = holes.slice(0, 9);
  else if (holeRange === 'back9') holes = holes.slice(9, 18);

  return holes;
}

export function calcCourseHandicap(
  hcpIndex: number,
  slope: number,
  rating: number,
  par: number,
): number {
  return Math.round(hcpIndex * (slope / 113) + (rating - par));
}

export function isGIR(gross: number, putts: number, par: number): boolean {
  return (gross - putts) <= (par - 2);
}

export function computePlayerTotals(
  players: PlayerConfig[],
  holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
  handicapStrokes: Map<string, Map<number, number>>,
): PlayerTotals[] {
  return players.map((p) => {
    let gross = 0, net = 0, putts = 0, firHit = 0, firTotal = 0;
    let girCount = 0, holesPlayed = 0;
    let par3Total = 0, par3Count = 0, par4Total = 0, par4Count = 0;
    let par5Total = 0, par5Count = 0;
    let upDownAttempts = 0, upDownMade = 0;
    const scores: { hole: HoleData; score: HoleScore }[] = [];

    holes.forEach((h) => {
      const s = allScores.get(h.number)?.get(p.id);
      if (!s) return;
      holesPlayed++;
      gross += s.gross;
      const strokes = handicapStrokes.get(p.id)?.get(h.number) ?? 0;
      net += s.gross - strokes;
      putts += s.putts;
      scores.push({ hole: h, score: s });

      if (h.par >= 4) { firTotal++; if (s.fir === true) firHit++; }
      const gir = isGIR(s.gross, s.putts, h.par);
      if (gir) girCount++;
      if (!gir) {
        upDownAttempts++;
        if (s.gross <= h.par) upDownMade++;
      }
      if (h.par === 3) { par3Total += s.gross; par3Count++; }
      if (h.par === 4) { par4Total += s.gross; par4Count++; }
      if (h.par === 5) { par5Total += s.gross; par5Count++; }
    });

    return {
      player: p, gross, net, putts, firHit, firTotal, girCount, holesPlayed, scores,
      par3Avg: par3Count > 0 ? par3Total / par3Count : 0,
      par4Avg: par4Count > 0 ? par4Total / par4Count : 0,
      par5Avg: par5Count > 0 ? par5Total / par5Count : 0,
      upDownAttempts, upDownMade,
    };
  });
}

// ─── Side game result builders ───────────────────────────────────────
export function pName(p: PlayerConfig): string {
  return p.id === '1' ? 'You' : p.name.split(' ')[0];
}

export function buildSkinsResult(
  label: string, players: PlayerConfig[], holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
  c: ReturnType<typeof useTheme>['theme']['colors'],
): GameResult {
  const skinWins = new Map<string, number>();
  players.forEach((p) => skinWins.set(p.id, 0));
  let carryover = 0;

  holes.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores || holeScores.size < players.length) { carryover++; return; }
    let best = Infinity;
    let winners: string[] = [];
    holeScores.forEach((s, pid) => {
      if (s.gross < best) { best = s.gross; winners = [pid]; }
      else if (s.gross === best) winners.push(pid);
    });
    if (winners.length === 1) {
      skinWins.set(winners[0], (skinWins.get(winners[0]) ?? 0) + 1 + carryover);
      carryover = 0;
    } else {
      carryover++;
    }
  });

  const lines: GameResult['lines'] = players
    .map((p) => ({
      text: pName(p),
      value: `${skinWins.get(p.id) ?? 0} skins`,
      highlight: p.id === '1',
    }))
    .sort((a, b) => parseInt(b.value!) - parseInt(a.value!));

  if (carryover > 0) lines.push({ text: `${carryover} skin${carryover !== 1 ? 's' : ''} carried over` });

  return { title: label, lines };
}

export function buildSnakeResult(
  label: string, players: PlayerConfig[], holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
): GameResult {
  let holder: string | null = null;
  holes.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores) return;
    holeScores.forEach((s, pid) => {
      if (s.putts >= 3) holder = pid;
    });
  });

  const holderPlayer = holder ? players.find((p) => p.id === holder) : null;
  return {
    title: label,
    lines: [
      {
        text: holderPlayer ? `${pName(holderPlayer)} holds the snake` : 'No 3-putts!',
        highlight: holder === '1',
      },
    ],
  };
}

export function buildGreeniesResult(
  label: string, players: PlayerConfig[], holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
): GameResult {
  const par3s = holes.filter((h) => h.par === 3);
  const wins = new Map<string, number>();
  players.forEach((p) => wins.set(p.id, 0));

  par3s.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores) return;
    let best = Infinity;
    let winner: string | null = null;
    holeScores.forEach((s, pid) => {
      if (s.gross < best) { best = s.gross; winner = pid; }
    });
    if (winner) wins.set(winner, (wins.get(winner) ?? 0) + 1);
  });

  return {
    title: label,
    lines: players
      .filter((p) => (wins.get(p.id) ?? 0) > 0)
      .map((p) => ({ text: pName(p), value: `${wins.get(p.id)} greenie${(wins.get(p.id) ?? 0) !== 1 ? 's' : ''}`, highlight: p.id === '1' })),
  };
}

export function buildNassauResult(
  label: string, players: PlayerConfig[], holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
): GameResult {
  if (players.length < 2) return { title: label, lines: [{ text: 'Need 2+ players' }] };

  function nineTotal(pid: string, nineHoles: HoleData[]): number {
    let t = 0;
    nineHoles.forEach((h) => { const s = allScores.get(h.number)?.get(pid); if (s) t += s.gross; });
    return t;
  }

  const front = holes.filter((h) => h.number <= 9);
  const back = holes.filter((h) => h.number > 9);
  const lines: GameResult['lines'] = [];

  if (front.length > 0) {
    let best = Infinity; const winners: string[] = [];
    players.forEach((p) => { const t = nineTotal(p.id, front); if (t > 0 && t < best) { best = t; winners.length = 0; winners.push(p.id); } else if (t > 0 && t === best) { winners.push(p.id); } });
    if (winners.length === 1) { const wp = players.find((p) => p.id === winners[0]); if (wp) lines.push({ text: `Front 9: ${pName(wp)}`, value: String(best), highlight: winners[0] === '1' }); }
    else if (winners.length > 1) lines.push({ text: `Front 9: Tied`, value: String(best) });
  }
  if (back.length > 0) {
    let best = Infinity; const winners: string[] = [];
    players.forEach((p) => { const t = nineTotal(p.id, back); if (t > 0 && t < best) { best = t; winners.length = 0; winners.push(p.id); } else if (t > 0 && t === best) { winners.push(p.id); } });
    if (winners.length === 1) { const wp = players.find((p) => p.id === winners[0]); if (wp) lines.push({ text: `Back 9: ${pName(wp)}`, value: String(best), highlight: winners[0] === '1' }); }
    else if (winners.length > 1) lines.push({ text: `Back 9: Tied`, value: String(best) });
  }
  {
    let best = Infinity; const winners: string[] = [];
    players.forEach((p) => { const t = nineTotal(p.id, holes); if (t > 0 && t < best) { best = t; winners.length = 0; winners.push(p.id); } else if (t > 0 && t === best) { winners.push(p.id); } });
    if (winners.length === 1) { const wp = players.find((p) => p.id === winners[0]); if (wp) lines.push({ text: `Overall: ${pName(wp)}`, value: String(best), highlight: winners[0] === '1' }); }
    else if (winners.length > 1) lines.push({ text: `Overall: Tied`, value: String(best) });
  }

  return { title: label, lines };
}

export function buildDotsResult(
  label: string, players: PlayerConfig[], holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
): GameResult {
  const dots = new Map<string, number>();
  players.forEach((p) => dots.set(p.id, 0));

  holes.forEach((h) => {
    const holeScores = allScores.get(h.number);
    if (!holeScores) return;
    holeScores.forEach((s, pid) => {
      const diff = s.gross - h.par;
      let pts = 0;
      if (diff <= -2) pts += 2;
      else if (diff === -1) pts += 1;
      if (s.putts === 1) pts += 1;
      if (s.putts >= 3) pts -= 1;
      dots.set(pid, (dots.get(pid) ?? 0) + pts);
    });
  });

  return {
    title: label,
    lines: players
      .map((p) => ({
        text: pName(p),
        value: `${(dots.get(p.id) ?? 0) >= 0 ? '+' : ''}${dots.get(p.id) ?? 0} pts`,
        highlight: p.id === '1',
      }))
      .sort((a, b) => parseInt(b.value!) - parseInt(a.value!)),
  };
}

export function buildGenericResult(label: string, players: PlayerConfig[]): GameResult {
  return {
    title: label,
    lines: [{ text: 'Results tracked — detailed scoring coming soon' }],
  };
}

export function buildWolfResult(
  label: string, players: PlayerConfig[], holes: HoleData[],
  allScores: Map<number, Map<string, HoleScore>>,
  wolfHoleDecisions: Map<number, WolfHoleState>,
): GameResult {
  const points = new Map<string, number>();
  players.forEach((p) => points.set(p.id, 0));

  holes.forEach((h, idx) => {
    const holeScores = allScores.get(h.number);
    const decision = wolfHoleDecisions.get(h.number);
    if (!holeScores || !decision || holeScores.size < players.length) return;

    const wolfId = decision.wolfPlayerId;

    if (decision.decision === 'lone' || decision.decision === 'blind') {
      const wolfScore = holeScores.get(wolfId);
      if (!wolfScore) return;
      const othersScores: number[] = [];
      players.forEach((p) => {
        if (p.id !== wolfId) {
          const s = holeScores.get(p.id);
          if (s) othersScores.push(s.gross);
        }
      });
      const bestOther = Math.min(...othersScores);
      const wolfWins = wolfScore.gross < bestOther;
      const isBlind = decision.decision === 'blind';

      if (wolfWins) {
        const wolfPts = isBlind ? 4 : 3;
        points.set(wolfId, (points.get(wolfId) ?? 0) + wolfPts);
      } else {
        const otherPts = isBlind ? 2 : 1;
        players.forEach((p) => {
          if (p.id !== wolfId) {
            points.set(p.id, (points.get(p.id) ?? 0) + otherPts);
          }
        });
      }
    } else if (decision.decision === 'partner' && decision.partnerId) {
      const teamIds = [wolfId, decision.partnerId];
      const opponentIds = players.filter((p) => !teamIds.includes(p.id)).map((p) => p.id);

      let teamBest = Infinity;
      teamIds.forEach((id) => {
        const s = holeScores.get(id);
        if (s && s.gross < teamBest) teamBest = s.gross;
      });
      let oppBest = Infinity;
      opponentIds.forEach((id) => {
        const s = holeScores.get(id);
        if (s && s.gross < oppBest) oppBest = s.gross;
      });

      if (teamBest < oppBest) {
        teamIds.forEach((id) => points.set(id, (points.get(id) ?? 0) + 1));
      } else if (oppBest < teamBest) {
        opponentIds.forEach((id) => points.set(id, (points.get(id) ?? 0) + 1));
      }
    }
  });

  return {
    title: label,
    lines: players
      .map((p) => ({
        text: pName(p),
        value: `${points.get(p.id) ?? 0} pts`,
        highlight: p.id === '1',
      }))
      .sort((a, b) => parseInt(b.value!) - parseInt(a.value!)),
  };
}

export function buildBBBResult(
  label: string, players: PlayerConfig[],
  bbbHolePoints: Map<number, BBBHolePoints>,
): GameResult {
  const totals = new Map<string, { bingo: number; bango: number; bongo: number }>();
  players.forEach((p) => totals.set(p.id, { bingo: 0, bango: 0, bongo: 0 }));

  bbbHolePoints.forEach((hp) => {
    if (hp.bingo) {
      const t = totals.get(hp.bingo);
      if (t) t.bingo++;
    }
    if (hp.bango) {
      const t = totals.get(hp.bango);
      if (t) t.bango++;
    }
    if (hp.bongo) {
      const t = totals.get(hp.bongo);
      if (t) t.bongo++;
    }
  });

  return {
    title: label,
    lines: players
      .map((p) => {
        const t = totals.get(p.id) ?? { bingo: 0, bango: 0, bongo: 0 };
        const total = t.bingo + t.bango + t.bongo;
        return {
          text: pName(p),
          value: `${total} pts (${t.bingo}/${t.bango}/${t.bongo})`,
          highlight: p.id === '1',
        };
      })
      .sort((a, b) => parseInt(b.value!) - parseInt(a.value!)),
  };
}

// ─── Side game labels lookup ──────────────────────────────────────────
export const SIDE_GAME_DISPLAY: Record<string, string> = {
  dots: 'Dots', snake: 'Snake', greenies: 'Greenies', skins: 'Skins',
  hammer: 'Hammer', nassau: 'Nassau', wolf: 'Wolf', sandies: 'Sandies',
  bark: 'Barkies', arnies: 'Arnies', close_shave: 'KP',
  bingo_bango_bongo: 'Bingo Bango Bongo',
};
